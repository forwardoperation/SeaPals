import { NextResponse } from "next/server";
import {
  processStorePaymentEvent,
  storePaymentEventReferencesKnownOrder,
} from "@/lib/store/orders";
import { deliverPaidStoreOrderMerchantNotification } from "@/lib/store/merchantOrderNotification";
import {
  retrieveStripePaymentOwnership,
  retrieveStripePaymentReceiptDetails,
  verifyStripeWebhookSignature,
} from "@/lib/store/stripe.mjs";
import {
  normalizeStripeCheckoutEvent,
  recoverStripeStoreEventOwnership,
  shouldProcessStripeStoreEvent,
} from "@/lib/store/stripeWebhook.mjs";

export const runtime = "nodejs";
const MAX_WEBHOOK_BODY_BYTES = 1_000_000;

const CHECKOUT_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

function safeErrorCode(error) {
  const code = String(error?.code ?? error?.name ?? "unknown_error");
  return /^[A-Za-z0-9_-]{1,100}$/.test(code) ? code : "unknown_error";
}

function nullableInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function nullableId(value, prefix) {
  const id = typeof value === "object" ? value?.id : value;
  return typeof id === "string" && id.startsWith(prefix) ? id : null;
}

function nullableUuid(value) {
  const id = String(value ?? "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  )
    ? id
    : null;
}

function nullableText(value, maxLength = 100) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, maxLength) : null;
}

function nullableOptionId(value) {
  const id = nullableText(value, 100);
  return id && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ? id : null;
}

function eventTimestamp(event) {
  const milliseconds = Number(event?.created) * 1000;
  return Number.isFinite(milliseconds)
    ? new Date(milliseconds).toISOString()
    : new Date().toISOString();
}

async function addCheckoutReceiptDetails(details) {
  if (details.paymentStatus !== "paid" || !details.paymentIntentId) {
    return details;
  }

  try {
    const receipt = await retrieveStripePaymentReceiptDetails(
      details.paymentIntentId
    );
    return {
      ...details,
      chargeId: receipt?.chargeId ?? null,
      receiptUrl: receipt?.receiptUrl ?? null,
      receiptNumber: receipt?.receiptNumber ?? null,
    };
  } catch (error) {
    // Stripe still emails its configured receipt. A later retry or manual
    // Dashboard lookup can fill this optional convenience link.
    console.error("Stripe receipt lookup failed", safeErrorCode(error));
    return details;
  }
}

function normalizeRefundEvent(event) {
  const charge = event.data.object;
  const amount = nullableInteger(charge?.amount);
  const amountRefunded = nullableInteger(charge?.amount_refunded);
  const fullyRefunded =
    amount !== null && amountRefunded !== null && amountRefunded >= amount;

  return {
    providerEventId: event.id,
    eventType: event.type,
    eventCreatedAt: eventTimestamp(event),
    orderId: nullableUuid(charge?.metadata?.order_id),
    checkoutSessionId: null,
    paymentIntentId: nullableId(charge?.payment_intent, "pi_"),
    chargeId: nullableId(charge?.id, "ch_"),
    paymentStatus: fullyRefunded ? "refunded" : "partially_refunded",
    customerEmail: null,
    customerName: null,
    shippingAddress: null,
    currency: charge?.currency ?? null,
    subtotalCents: null,
    shippingCents: null,
    taxCents: null,
    totalCents: null,
    amountRefundedCents: amountRefunded,
    receiptUrl: charge?.receipt_url ?? null,
    receiptNumber: charge?.receipt_number ?? null,
    paymentLivemode: Boolean(event?.livemode),
  };
}

function normalizeDisputeEvent(event) {
  const dispute = event.data.object;

  return {
    providerEventId: event.id,
    eventType: event.type,
    eventCreatedAt: eventTimestamp(event),
    orderId: nullableUuid(dispute?.metadata?.order_id),
    checkoutSessionId: null,
    paymentIntentId: nullableId(dispute?.payment_intent, "pi_"),
    chargeId: nullableId(dispute?.charge, "ch_"),
    paymentStatus: "disputed",
    customerEmail: null,
    customerName: null,
    shippingAddress: null,
    currency: dispute?.currency ?? null,
    subtotalCents: null,
    shippingCents: null,
    taxCents: null,
    totalCents: null,
    amountRefundedCents: null,
    receiptUrl: null,
    receiptNumber: null,
    paymentLivemode: Boolean(event?.livemode),
  };
}

function normalizeFailedPaymentIntentEvent(event) {
  const intent = event.data.object;
  return {
    providerEventId: event.id,
    eventType: event.type,
    eventCreatedAt: eventTimestamp(event),
    orderId: nullableUuid(intent?.metadata?.order_id),
    checkoutSessionId: null,
    paymentIntentId: nullableId(intent?.id, "pi_"),
    chargeId: null,
    // A PaymentIntent can fail while its Checkout Session remains open for a
    // retry. Record the event without releasing its inventory reservation;
    // only Checkout's terminal async-failure/expired events release stock.
    paymentStatus: "pending",
    customerEmail: intent?.receipt_email ?? null,
    customerName: null,
    shippingAddress: null,
    currency: intent?.currency ?? null,
    subtotalCents: null,
    shippingCents: null,
    taxCents: null,
    totalCents: null,
    amountRefundedCents: null,
    receiptUrl: null,
    receiptNumber: null,
    paymentLivemode: Boolean(event?.livemode),
  };
}

export async function POST(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_WEBHOOK_BODY_BYTES) {
    return NextResponse.json({ error: "Webhook payload too large." }, { status: 413 });
  }

  const payload = await request.text();
  if (new TextEncoder().encode(payload).byteLength > MAX_WEBHOOK_BODY_BYTES) {
    return NextResponse.json({ error: "Webhook payload too large." }, { status: 413 });
  }

  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  const verified = await verifyStripeWebhookSignature(
    payload,
    signature,
    secret
  );
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  let details;
  if (CHECKOUT_EVENT_TYPES.has(event.type)) {
    details = normalizeStripeCheckoutEvent(event);
  } else if (event.type === "charge.refunded") {
    details = normalizeRefundEvent(event);
  } else if (event.type === "charge.dispute.created") {
    details = normalizeDisputeEvent(event);
  } else if (event.type === "payment_intent.payment_failed") {
    details = normalizeFailedPaymentIntentEvent(event);
  } else {
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    let shouldProcess = await shouldProcessStripeStoreEvent(
      event,
      details,
      storePaymentEventReferencesKnownOrder
    );
    if (
      !shouldProcess &&
      ["charge.refunded", "charge.dispute.created"].includes(event.type)
    ) {
      const recovered = await recoverStripeStoreEventOwnership(
        event,
        details,
        retrieveStripePaymentOwnership
      );
      event = recovered.event;
      details = {
        ...recovered.details,
        orderId: nullableUuid(recovered.recoveredOrderId),
      };
      shouldProcess = await shouldProcessStripeStoreEvent(
        event,
        details,
        storePaymentEventReferencesKnownOrder
      );
    }
    if (!shouldProcess) {
      return NextResponse.json({ received: true, ignored: true });
    }

    if (CHECKOUT_EVENT_TYPES.has(event.type)) {
      details = await addCheckoutReceiptDetails(details);
    }

    const result = await processStorePaymentEvent(details);
    const notification = await deliverPaidStoreOrderMerchantNotification(details);
    return NextResponse.json({
      received: true,
      ...result,
      merchantNotification: notification.status,
    });
  } catch (error) {
    // Log only a stable diagnostic code. Provider, database, and customer
    // details stay out of Worker logs.
    console.error("Store payment webhook failed", safeErrorCode(error));
    return NextResponse.json(
      { error: "The payment event could not be recorded." },
      { status: 500 }
    );
  }
}
