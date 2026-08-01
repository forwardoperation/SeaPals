import { NextResponse } from "next/server";
import { processStorePaymentEvent } from "@/lib/store/orders";
import {
  retrieveStripePaymentReceiptDetails,
  verifyStripeWebhookSignature,
} from "@/lib/store/stripe.mjs";

export const runtime = "nodejs";
const MAX_WEBHOOK_BODY_BYTES = 1_000_000;

const CHECKOUT_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

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

function normalizeCheckoutPaymentStatus(eventType, session) {
  if (
    (eventType === "checkout.session.completed" ||
      eventType === "checkout.session.async_payment_succeeded") &&
    session?.payment_status === "paid"
  ) {
    return "paid";
  }

  if (
    eventType === "checkout.session.async_payment_failed" ||
    eventType === "checkout.session.expired"
  ) {
    return "failed";
  }

  return "pending";
}

function normalizeShippingAddress(session) {
  if (session?.metadata?.fulfillment_method === "pickup") return null;

  const customer = session?.customer_details ?? {};
  const shipping =
    session?.collected_information?.shipping_details ??
    session?.shipping_details ??
    {};
  const address = shipping?.address ?? null;

  if (!address) return null;

  return {
    name: shipping?.name || customer?.name || null,
    phone: customer?.phone || null,
    address: {
      line1: address.line1 || null,
      line2: address.line2 || null,
      city: address.city || null,
      state: address.state || null,
      postal_code: address.postal_code || null,
      country: address.country || null,
    },
  };
}

async function normalizeCheckoutEvent(event) {
  const session = event.data.object;
  const fulfillmentMethod = ["shipping", "pickup"].includes(
    session?.metadata?.fulfillment_method
  )
    ? session.metadata.fulfillment_method
    : null;
  const paymentStatus = normalizeCheckoutPaymentStatus(event.type, session);
  const paymentIntentId = nullableId(session.payment_intent, "pi_");
  let receipt = null;

  if (paymentStatus === "paid" && paymentIntentId) {
    try {
      receipt = await retrieveStripePaymentReceiptDetails(paymentIntentId);
    } catch (error) {
      // Stripe still emails its configured receipt. A later retry or manual
      // Dashboard lookup can fill this optional convenience link.
      console.error("Stripe receipt lookup failed", error);
    }
  }

  return {
    providerEventId: event.id,
    eventType: event.type,
    eventCreatedAt: eventTimestamp(event),
    orderId: nullableUuid(
      session?.metadata?.order_id || session?.client_reference_id
    ),
    checkoutSessionId: nullableId(session.id, "cs_"),
    paymentIntentId,
    chargeId: receipt?.chargeId ?? null,
    paymentStatus,
    customerEmail: session?.customer_details?.email ?? null,
    customerName: session?.customer_details?.name ?? null,
    shippingAddress: normalizeShippingAddress(session),
    currency: session?.currency ?? null,
    subtotalCents: nullableInteger(session?.amount_subtotal),
    shippingCents: nullableInteger(session?.total_details?.amount_shipping),
    taxCents: nullableInteger(session?.total_details?.amount_tax),
    totalCents: nullableInteger(session?.amount_total),
    amountRefundedCents: null,
    receiptUrl: receipt?.receiptUrl ?? null,
    receiptNumber: receipt?.receiptNumber ?? null,
    paymentLivemode: Boolean(event?.livemode),
    fulfillmentMethod,
    fulfillmentOptionId: nullableOptionId(
      session?.metadata?.fulfillment_option_id
    ),
    fulfillmentOptionName: nullableText(
      session?.metadata?.fulfillment_option_name
    ),
    pickupLocation: nullableText(session?.metadata?.pickup_location),
    stripeShippingRateId: nullableId(
      session?.shipping_cost?.shipping_rate,
      "shr_"
    ),
  };
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
    paymentStatus: "failed",
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
    details = await normalizeCheckoutEvent(event);
  } else if (event.type === "charge.refunded") {
    details = normalizeRefundEvent(event);
  } else if (event.type === "charge.dispute.created") {
    details = normalizeDisputeEvent(event);
  } else if (event.type === "payment_intent.payment_failed") {
    details = normalizeFailedPaymentIntentEvent(event);
  } else {
    return NextResponse.json({ received: true, ignored: true });
  }

  if (
    !details.orderId &&
    !details.checkoutSessionId &&
    !details.paymentIntentId &&
    !details.chargeId
  ) {
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    const result = await processStorePaymentEvent(details);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error("Store payment webhook failed", error);
    return NextResponse.json(
      { error: "The payment event could not be recorded." },
      { status: 500 }
    );
  }
}
