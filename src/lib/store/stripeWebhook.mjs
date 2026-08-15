function nonEmptyText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function metadataInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function stripeId(value, prefix) {
  const id = typeof value === "object" ? value?.id : value;
  return typeof id === "string" && id.startsWith(prefix) ? id : null;
}

function uuid(value) {
  const id = String(value ?? "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  )
    ? id
    : null;
}

function text(value, maxLength = 100) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? normalized.slice(0, maxLength) : null;
}

function optionId(value) {
  const id = text(value, 100);
  return id && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ? id : null;
}

function checkoutPaymentStatus(eventType, session) {
  if (
    [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
    ].includes(eventType) && session?.payment_status === "paid"
  ) {
    return "paid";
  }

  if (
    [
      "checkout.session.async_payment_failed",
      "checkout.session.expired",
    ].includes(eventType)
  ) {
    return "failed";
  }

  return "pending";
}

function checkoutShippingAddress(session) {
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

export function normalizeStripeCheckoutEvent(event) {
  const session = event?.data?.object ?? {};
  const productionMetadataKeys = [
    "production_option_id",
    "production_option_name",
    "production_max_business_days",
    "production_cents",
  ];
  const hasProductionMetadata = productionMetadataKeys.some(
    (key) => Object.hasOwn(session?.metadata ?? {}, key)
  );
  const fulfillmentMethod = ["shipping", "pickup"].includes(
    session?.metadata?.fulfillment_method
  )
    ? session.metadata.fulfillment_method
    : null;
  // Sessions created before the production-speed contract had no production
  // metadata. The migration snapshots those legacy orders as Standard/$0/5
  // days, so preserve that exact compatibility case while partial or malformed
  // new metadata still fails reconciliation.
  const productionCents = hasProductionMetadata
    ? metadataInteger(session?.metadata?.production_cents)
    : 0;
  const stripeSubtotalCents = nonNegativeInteger(session?.amount_subtotal);
  const subtotalCents =
    stripeSubtotalCents !== null &&
    (productionCents ?? 0) <= stripeSubtotalCents
      ? stripeSubtotalCents - (productionCents ?? 0)
      : null;
  const createdMilliseconds = Number(event?.created) * 1000;

  return {
    providerEventId: event?.id,
    eventType: event?.type,
    eventCreatedAt: Number.isFinite(createdMilliseconds)
      ? new Date(createdMilliseconds).toISOString()
      : new Date().toISOString(),
    orderId: uuid(session?.metadata?.order_id || session?.client_reference_id),
    checkoutSessionId: stripeId(session?.id, "cs_"),
    paymentIntentId: stripeId(session?.payment_intent, "pi_"),
    chargeId: null,
    paymentStatus: checkoutPaymentStatus(event?.type, session),
    customerEmail: session?.customer_details?.email ?? null,
    customerName: session?.customer_details?.name ?? null,
    shippingAddress: checkoutShippingAddress(session),
    currency: session?.currency ?? null,
    subtotalCents,
    productionOptionId: hasProductionMetadata
      ? optionId(session?.metadata?.production_option_id)
      : "standard-production",
    productionOptionName: hasProductionMetadata
      ? text(session?.metadata?.production_option_name)
      : "Standard production",
    productionMaxBusinessDays: hasProductionMetadata
      ? metadataInteger(session?.metadata?.production_max_business_days)
      : 5,
    productionCents,
    shippingCents: nonNegativeInteger(
      session?.total_details?.amount_shipping
    ),
    taxCents: nonNegativeInteger(session?.total_details?.amount_tax),
    totalCents: nonNegativeInteger(session?.amount_total),
    amountRefundedCents: null,
    receiptUrl: null,
    receiptNumber: null,
    paymentLivemode: Boolean(event?.livemode),
    fulfillmentMethod,
    fulfillmentOptionId: optionId(
      session?.metadata?.fulfillment_option_id
    ),
    fulfillmentOptionName: text(
      session?.metadata?.fulfillment_option_name
    ),
    pickupLocation: text(session?.metadata?.pickup_location),
    stripeShippingRateId: stripeId(
      session?.shipping_cost?.shipping_rate,
      "shr_"
    ),
  };
}

export function eventClaimsSeaPalsOrderMetadata(event) {
  const object = event?.data?.object;
  const metadata = object?.metadata;

  return (
    nonEmptyText(metadata?.order_id) ||
    (nonEmptyText(metadata?.order_number) &&
      /^SP-/i.test(metadata.order_number.trim()))
  );
}

export function hasStoreOrderReference(details) {
  return Boolean(
    details?.orderId ||
      details?.checkoutSessionId ||
      details?.paymentIntentId ||
      details?.chargeId
  );
}

export async function shouldProcessStripeStoreEvent(
  event,
  details,
  storeOrderReferenceExists
) {
  // A SeaPals-tagged event must fail loudly if its order cannot be found or its
  // references conflict. A 2xx response would hide a broken payment record.
  if (eventClaimsSeaPalsOrderMetadata(event)) {
    if (!details?.orderId) {
      throw new Error("Stripe event supplied invalid SeaPals order metadata.");
    }
    return true;
  }

  // Events without SeaPals metadata can still belong to an older order whose
  // provider references are already saved in the private ledger.
  if (!hasStoreOrderReference(details)) return false;

  return Boolean(await storeOrderReferenceExists(details));
}

export async function recoverStripeStoreEventOwnership(
  event,
  details,
  retrievePaymentOwnership
) {
  if (
    eventClaimsSeaPalsOrderMetadata(event) ||
    details?.orderId ||
    !["charge.refunded", "charge.dispute.created"].includes(event?.type)
  ) {
    return { event, details, recoveredOrderId: null };
  }

  const ownership = await retrievePaymentOwnership({
    chargeId: details?.chargeId,
    paymentIntentId: details?.paymentIntentId,
  });
  const recoveredMetadata = {
    ...(event?.data?.object?.metadata ?? {}),
    ...(ownership?.orderId ? { order_id: ownership.orderId } : {}),
    ...(ownership?.orderNumber ? { order_number: ownership.orderNumber } : {}),
  };

  return {
    event: {
      ...event,
      data: {
        ...event?.data,
        object: {
          ...event?.data?.object,
          metadata: recoveredMetadata,
        },
      },
    },
    details: {
      ...details,
      paymentIntentId:
        ownership?.paymentIntentId ?? details?.paymentIntentId ?? null,
      chargeId: ownership?.chargeId ?? details?.chargeId ?? null,
    },
    recoveredOrderId: ownership?.orderId ?? null,
  };
}
