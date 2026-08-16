import {
  expireStripeCheckoutSession,
  retrieveStripeCheckoutSession,
} from "./stripe.mjs";
import { normalizeStripeCheckoutEvent } from "./stripeWebhook.mjs";

export const STORE_INVENTORY_RECONCILIATION_BATCH_LIMIT = 10;
export const STORE_INVENTORY_RECONCILIATION_LEASE_SECONDS = 180;
export const STORE_INVENTORY_RECONCILIATION_RETRY_SECONDS = 300;

const MAX_BATCH_LIMIT = 25;
const MIN_LEASE_SECONDS = 60;
const MAX_LEASE_SECONDS = 600;
const MIN_RETRY_SECONDS = 60;
const MAX_RETRY_SECONDS = 3600;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHECKOUT_SESSION_PATTERN = /^cs_[A-Za-z0-9_]+$/;

export class InventoryReservationReconciliationError extends Error {
  constructor(message, { code = "inventory_reconciliation_failed", summary } = {}) {
    super(message);
    this.name = "InventoryReservationReconciliationError";
    this.code = code;
    if (summary) this.summary = summary;
  }
}

function reconciliationError(message, code, summary) {
  return new InventoryReservationReconciliationError(message, {
    code,
    summary,
  });
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeErrorCode(error) {
  const value = safeString(error?.code || error?.name || "unknown");
  const normalized = value.replaceAll(/[^A-Za-z0-9_-]/g, "_").slice(0, 70);
  return normalized || "unknown";
}

function readConfiguration(environment) {
  const serviceRoleKey = safeString(environment.SUPABASE_SERVICE_ROLE_KEY);
  const stripeSecretKey = safeString(environment.STRIPE_SECRET_KEY);
  let supabaseUrl = null;

  try {
    const parsed = new URL(safeString(environment.NEXT_PUBLIC_SUPABASE_URL));
    if (parsed.protocol === "https:") supabaseUrl = parsed.origin;
  } catch {
    // Report a fixed error below without echoing configuration or secrets.
  }

  if (!supabaseUrl || serviceRoleKey.length < 20) {
    throw reconciliationError(
      "Inventory reconciliation storage is not configured.",
      "inventory_reconciliation_store_not_configured"
    );
  }
  if (!/^[sr]k_(?:test|live)_[A-Za-z0-9_]{8,}$/.test(stripeSecretKey)) {
    throw reconciliationError(
      "Inventory reconciliation payment access is not configured.",
      "inventory_reconciliation_stripe_not_configured"
    );
  }

  return { serviceRoleKey, stripeSecretKey, supabaseUrl };
}

async function readJsonResponse(response, code) {
  if (!response?.ok) {
    throw reconciliationError(
      "The inventory reconciliation store rejected a request.",
      code
    );
  }

  try {
    return await response.json();
  } catch {
    throw reconciliationError(
      "The inventory reconciliation store returned an invalid response.",
      code
    );
  }
}

function createStoreClient({ fetchImpl, serviceRoleKey, supabaseUrl }) {
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  async function rpc(name, body, errorCode) {
    let response;
    try {
      response = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } catch {
      throw reconciliationError(
        "The inventory reconciliation store could not be reached.",
        errorCode
      );
    }
    return readJsonResponse(response, errorCode);
  }

  return {
    async listOverdue(limit) {
      const rows = await rpc(
        "list_overdue_store_inventory_reservations",
        { p_limit: limit },
        "inventory_reconciliation_list_failed"
      );
      if (!Array.isArray(rows)) {
        throw reconciliationError(
          "The inventory reconciliation queue returned an invalid list.",
          "inventory_reconciliation_list_invalid"
        );
      }
      const orderIds = rows.map((row) => safeString(row?.order_id));
      if (orderIds.some((orderId) => !UUID_PATTERN.test(orderId))) {
        throw reconciliationError(
          "The inventory reconciliation queue returned an invalid order.",
          "inventory_reconciliation_list_invalid"
        );
      }
      return [...new Set(orderIds)];
    },

    async claim({ orderId, claimToken, leaseSeconds }) {
      const payload = await rpc(
        "claim_overdue_store_inventory_reservation",
        {
          p_order_id: orderId,
          p_claim_token: claimToken,
          p_lease_seconds: leaseSeconds,
        },
        "inventory_reconciliation_claim_failed"
      );
      const row = Array.isArray(payload) ? payload[0] : payload;
      const status = safeString(row?.claim_status);
      if (
        ![
          "claimed",
          "busy",
          "missing",
          "not_due",
          "resolved",
          "retry_later",
        ].includes(status) ||
        safeString(row?.order_id) !== orderId
      ) {
        throw reconciliationError(
          "The inventory reconciliation claim was invalid.",
          "inventory_reconciliation_claim_invalid"
        );
      }
      if (
        status === "claimed" &&
        row?.checkout_session_id !== null &&
        !CHECKOUT_SESSION_PATTERN.test(safeString(row?.checkout_session_id))
      ) {
        throw reconciliationError(
          "The inventory reconciliation claim was invalid.",
          "inventory_reconciliation_claim_invalid"
        );
      }

      return {
        status,
        checkoutSessionId:
          status === "claimed" ? row.checkout_session_id : null,
        paymentLivemode:
          status === "claimed" && typeof row?.payment_livemode === "boolean"
            ? row.payment_livemode
            : null,
      };
    },

    release({ orderId, claimToken, failureCode, retrySeconds }) {
      return rpc(
        "release_store_inventory_reconciliation_claim",
        {
          p_order_id: orderId,
          p_claim_token: claimToken,
          p_failure_code: failureCode,
          p_retry_seconds: retrySeconds,
        },
        "inventory_reconciliation_claim_release_failed"
      );
    },

    complete({ orderId, claimToken }) {
      return rpc(
        "complete_store_inventory_reconciliation_claim",
        { p_order_id: orderId, p_claim_token: claimToken },
        "inventory_reconciliation_claim_complete_failed"
      );
    },

    processPaymentEvent(details) {
      return rpc(
        "process_store_payment_event",
        {
          p_provider_event_id: details.providerEventId,
          p_event_type: details.eventType,
          p_event_created_at: details.eventCreatedAt,
          p_order_id: details.orderId,
          p_checkout_session_id: details.checkoutSessionId,
          p_payment_intent_id: details.paymentIntentId,
          p_charge_id: details.chargeId,
          p_payment_status: details.paymentStatus,
          p_customer_email: details.customerEmail,
          p_customer_name: details.customerName,
          p_shipping_address: details.shippingAddress,
          p_currency: details.currency,
          p_subtotal_cents: details.subtotalCents,
          p_production_option_id: details.productionOptionId ?? null,
          p_production_option_name: details.productionOptionName ?? null,
          p_production_max_business_days:
            details.productionMaxBusinessDays ?? null,
          p_production_cents: details.productionCents ?? null,
          p_shipping_cents: details.shippingCents,
          p_tax_cents: details.taxCents,
          p_total_cents: details.totalCents,
          p_amount_refunded_cents: details.amountRefundedCents ?? null,
          p_receipt_url: details.receiptUrl,
          p_receipt_number: details.receiptNumber,
          p_payment_livemode: details.paymentLivemode,
          p_fulfillment_method: details.fulfillmentMethod ?? null,
          p_fulfillment_option_id: details.fulfillmentOptionId ?? null,
          p_fulfillment_option_name: details.fulfillmentOptionName ?? null,
          p_pickup_location: details.pickupLocation ?? null,
          p_stripe_shipping_rate_id: details.stripeShippingRateId ?? null,
        },
        "inventory_reconciliation_payment_event_failed"
      );
    },
  };
}

function sessionVerificationFailure(session, claim, orderId) {
  if (
    session?.object !== "checkout.session" ||
    session?.id !== claim.checkoutSessionId ||
    session?.mode !== "payment" ||
    !["open", "complete", "expired"].includes(session?.status) ||
    !["paid", "unpaid", "no_payment_required"].includes(
      session?.payment_status
    ) ||
    typeof session?.livemode !== "boolean" ||
    session.livemode !== claim.paymentLivemode ||
    session?.client_reference_id !== orderId ||
    session?.metadata?.order_id !== orderId ||
    session?.metadata?.inventory_reservation !== "v1"
  ) {
    return "inventory_reconciliation_session_mismatch";
  }
  return null;
}

function terminalDecision(session) {
  if (session.payment_status === "paid") {
    return session.status === "complete"
      ? { kind: "terminal", paymentStatus: "paid" }
      : { kind: "hold", code: "inventory_reconciliation_paid_ambiguous" };
  }
  if (session.status === "complete") {
    return {
      kind: "hold",
      code: "inventory_reconciliation_complete_unpaid",
    };
  }
  if (session.status === "expired") {
    return session.payment_status === "unpaid"
      ? { kind: "terminal", paymentStatus: "failed" }
      : { kind: "hold", code: "inventory_reconciliation_expired_ambiguous" };
  }
  if (session.status === "open" && session.payment_status === "unpaid") {
    return { kind: "expire" };
  }
  return { kind: "hold", code: "inventory_reconciliation_state_ambiguous" };
}

function stripeObjectId(value, prefix) {
  const id = typeof value === "object" ? value?.id : value;
  return typeof id === "string" && id.startsWith(prefix) ? id : null;
}

function buildPaymentEventDetails(session, orderId, paymentStatus, nowMilliseconds) {
  const eventType =
    paymentStatus === "paid"
      ? "checkout.session.completed"
      : "checkout.session.expired";
  const event = {
    id: `seapals_inventory_reconcile_${session.id}_${paymentStatus}`,
    type: eventType,
    created: Math.floor(nowMilliseconds / 1000),
    livemode: session.livemode,
    data: { object: session },
  };
  const details = normalizeStripeCheckoutEvent(event);
  const paymentIntent =
    session.payment_intent && typeof session.payment_intent === "object"
      ? session.payment_intent
      : null;
  const charge =
    paymentIntent?.latest_charge &&
    typeof paymentIntent.latest_charge === "object"
      ? paymentIntent.latest_charge
      : null;

  return {
    ...details,
    orderId,
    paymentIntentId: stripeObjectId(session.payment_intent, "pi_"),
    chargeId: stripeObjectId(charge, "ch_"),
    receiptUrl:
      typeof charge?.receipt_url === "string" ? charge.receipt_url : null,
    receiptNumber:
      typeof charge?.receipt_number === "string"
        ? charge.receipt_number.slice(0, 100)
        : null,
  };
}

async function inspectClaim({
  claim,
  orderId,
  retrieveSession,
  expireSession,
  nowMilliseconds,
}) {
  if (!claim.checkoutSessionId) {
    return {
      kind: "hold",
      code: "inventory_reconciliation_session_missing",
    };
  }
  if (typeof claim.paymentLivemode !== "boolean") {
    return {
      kind: "hold",
      code: "inventory_reconciliation_mode_missing",
    };
  }

  let session = await retrieveSession(claim.checkoutSessionId);
  let verificationFailure = sessionVerificationFailure(session, claim, orderId);
  if (verificationFailure) return { kind: "hold", code: verificationFailure };

  let decision = terminalDecision(session);
  if (decision.kind === "expire") {
    await expireSession(claim.checkoutSessionId);
    // A POST response is not enough: retrieve the Session again so release is
    // possible only after Stripe independently reports the terminal state.
    session = await retrieveSession(claim.checkoutSessionId);
    verificationFailure = sessionVerificationFailure(session, claim, orderId);
    if (verificationFailure) return { kind: "hold", code: verificationFailure };
    decision = terminalDecision(session);
    if (decision.kind === "expire") {
      return {
        kind: "hold",
        code: "inventory_reconciliation_expiration_unconfirmed",
      };
    }
  }

  if (decision.kind !== "terminal") return decision;
  return {
    kind: "terminal",
    paymentStatus: decision.paymentStatus,
    details: buildPaymentEventDetails(
      session,
      orderId,
      decision.paymentStatus,
      nowMilliseconds
    ),
  };
}

function validateOptions({ limit, leaseSeconds, retrySeconds, fetchImpl }) {
  if (typeof fetchImpl !== "function") {
    throw reconciliationError(
      "Inventory reconciliation transport is unavailable.",
      "inventory_reconciliation_transport_unavailable"
    );
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_BATCH_LIMIT) {
    throw reconciliationError(
      "Inventory reconciliation batch size is invalid.",
      "inventory_reconciliation_limit_invalid"
    );
  }
  if (
    !Number.isSafeInteger(leaseSeconds) ||
    leaseSeconds < MIN_LEASE_SECONDS ||
    leaseSeconds > MAX_LEASE_SECONDS
  ) {
    throw reconciliationError(
      "Inventory reconciliation lease is invalid.",
      "inventory_reconciliation_lease_invalid"
    );
  }
  if (
    !Number.isSafeInteger(retrySeconds) ||
    retrySeconds < MIN_RETRY_SECONDS ||
    retrySeconds > MAX_RETRY_SECONDS
  ) {
    throw reconciliationError(
      "Inventory reconciliation retry delay is invalid.",
      "inventory_reconciliation_retry_invalid"
    );
  }
}

export async function reconcileOverdueInventoryReservations({
  environment = {},
  fetchImpl = globalThis.fetch,
  limit = STORE_INVENTORY_RECONCILIATION_BATCH_LIMIT,
  leaseSeconds = STORE_INVENTORY_RECONCILIATION_LEASE_SECONDS,
  retrySeconds = STORE_INVENTORY_RECONCILIATION_RETRY_SECONDS,
  retrieveSession,
  expireSession,
  nowMilliseconds = Date.now(),
  randomUUID = () => globalThis.crypto.randomUUID(),
} = {}) {
  validateOptions({ limit, leaseSeconds, retrySeconds, fetchImpl });
  if (!Number.isFinite(nowMilliseconds) || typeof randomUUID !== "function") {
    throw reconciliationError(
      "Inventory reconciliation runtime is invalid.",
      "inventory_reconciliation_runtime_invalid"
    );
  }

  const configuration = readConfiguration(environment);
  const store = createStoreClient({ fetchImpl, ...configuration });
  const retrieve =
    retrieveSession ??
    ((sessionId) =>
      retrieveStripeCheckoutSession(sessionId, {
        secretKey: configuration.stripeSecretKey,
      }));
  const expire =
    expireSession ??
    ((sessionId) =>
      expireStripeCheckoutSession(sessionId, {
        secretKey: configuration.stripeSecretKey,
        idempotencyKey: `seapals-reservation-expire-${sessionId}`,
      }));
  if (typeof retrieve !== "function" || typeof expire !== "function") {
    throw reconciliationError(
      "Inventory reconciliation payment transport is unavailable.",
      "inventory_reconciliation_stripe_transport_unavailable"
    );
  }

  const orderIds = await store.listOverdue(limit);
  const summary = {
    queued: orderIds.length,
    claimed: 0,
    committed: 0,
    released: 0,
    held: 0,
    busy: 0,
    skipped: 0,
    failed: 0,
  };
  let firstFailureCode = null;

  // Deliberately sequential: the batch is bounded and at most one Stripe
  // mutation is in flight from this Worker invocation.
  for (const orderId of orderIds) {
    const claimToken = randomUUID();
    let claimed = false;
    try {
      if (!UUID_PATTERN.test(String(claimToken ?? ""))) {
        throw reconciliationError(
          "Inventory reconciliation could not create a claim token.",
          "inventory_reconciliation_claim_token_invalid"
        );
      }

      const claim = await store.claim({ orderId, claimToken, leaseSeconds });
      if (claim.status === "busy") {
        summary.busy += 1;
        continue;
      }
      if (claim.status !== "claimed") {
        summary.skipped += 1;
        continue;
      }
      claimed = true;
      summary.claimed += 1;

      const decision = await inspectClaim({
        claim,
        orderId,
        retrieveSession: retrieve,
        expireSession: expire,
        nowMilliseconds,
      });
      if (decision.kind === "hold") {
        const releasedClaim = await store.release({
          orderId,
          claimToken,
          failureCode: decision.code,
          retrySeconds,
        });
        if (releasedClaim !== true) {
          throw reconciliationError(
            "Inventory reconciliation could not preserve its retry state.",
            "inventory_reconciliation_claim_release_conflict"
          );
        }
        claimed = false;
        summary.held += 1;
        continue;
      }

      await store.processPaymentEvent(decision.details);
      const completed = await store.complete({ orderId, claimToken });
      if (completed !== true) {
        throw reconciliationError(
          "Inventory reconciliation completion was not confirmed.",
          "inventory_reconciliation_claim_complete_conflict"
        );
      }
      claimed = false;
      if (decision.paymentStatus === "paid") summary.committed += 1;
      else summary.released += 1;
    } catch (error) {
      summary.failed += 1;
      const failureCode = `inventory_reconcile_${safeErrorCode(error)}`.slice(
        0,
        100
      );
      firstFailureCode ??= safeErrorCode(error);
      if (claimed) {
        try {
          await store.release({
            orderId,
            claimToken,
            failureCode,
            retrySeconds,
          });
        } catch {
          firstFailureCode = "inventory_reconciliation_claim_release_failed";
        }
      }
    }
  }

  if (summary.failed > 0) {
    throw reconciliationError(
      "One or more overdue inventory reservations could not be reconciled.",
      firstFailureCode || "inventory_reconciliation_partial_failure",
      summary
    );
  }

  return summary;
}
