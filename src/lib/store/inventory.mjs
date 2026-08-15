const INVENTORY_RESERVATION_DURATION_MS = 60 * 60 * 1000;
const INVENTORY_UNAVAILABLE_MARKER = "store_inventory_unavailable";
const EXPEDITED_CAPACITY_UNAVAILABLE_MARKER =
  "store_expedited_capacity_unavailable";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHECKOUT_REQUEST_STORAGE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function createInventoryReservationDeadline(
  nowMilliseconds = Date.now()
) {
  if (!Number.isFinite(nowMilliseconds)) {
    throw new TypeError("Inventory reservation time must be finite.");
  }

  return new Date(
    Math.trunc(nowMilliseconds) + INVENTORY_RESERVATION_DURATION_MS
  ).toISOString();
}

export function buildStoreOrderReservationArguments({
  orderId,
  orderNumber,
  quote,
  currency,
  paymentLivemode,
  checkoutRequestId,
  inventoryReservedUntil,
}) {
  return {
    p_order_id: orderId,
    p_order_number: orderNumber,
    p_currency: currency,
    p_payment_livemode: Boolean(paymentLivemode),
    p_checkout_request_id: checkoutRequestId,
    p_subtotal_cents: quote.subtotalCents,
    p_production_option_id: quote.productionOptionId,
    p_production_option_name: quote.productionOptionName,
    p_production_max_business_days: quote.productionMaxBusinessDays,
    p_production_cents: quote.productionCents,
    p_fulfillment_method: quote.fulfillmentMethod,
    p_fulfillment_option_id: quote.fulfillmentOptionId,
    p_fulfillment_option_name: quote.fulfillmentOptionName,
    p_pickup_location: quote.pickupLocation,
    p_shipping_cents: quote.shippingCents,
    p_total_cents: quote.totalCents,
    p_inventory_reserved_until: inventoryReservedUntil,
    p_items: quote.items.map((item) => ({
      product_id: item.productId,
      product_category: item.category || "uncategorized",
      sku: item.sku,
      deck_id: item.deckId || null,
      product_name: item.name,
      unit_amount_cents: item.unitAmountCents,
      quantity: item.quantity,
      line_total_cents: item.lineTotalCents,
    })),
  };
}

export function parseStoreOrderReservationResult(
  data,
  { orderId, orderNumber, inventoryReservedUntil, productionOptionId }
) {
  const result = Array.isArray(data) ? data[0] : data;
  const deadline = result?.inventory_reserved_until;
  const created = result?.created === true;
  const productionDueDate = normalizeProductionDueDate(
    result?.production_due_date
  );
  const expeditedCapacityState = result?.expedited_capacity_state;
  const expedited = productionOptionId === "expedited-production";

  if (
    !UUID_PATTERN.test(String(result?.id ?? "")) ||
    !/^SP-[A-Za-z0-9-]+$/.test(String(result?.order_number ?? "")) ||
    typeof deadline !== "string" ||
    !Number.isFinite(Date.parse(deadline)) ||
    (created && result.id !== orderId) ||
    (created && result.order_number !== orderNumber) ||
    (created && Date.parse(deadline) !== Date.parse(inventoryReservedUntil)) ||
    !["reserved", "committed"].includes(result?.inventory_state) ||
    !["standard-production", "expedited-production"].includes(
      productionOptionId
    ) ||
    (expedited && productionDueDate === null) ||
    (expedited &&
      !["reserved", "committed"].includes(expeditedCapacityState)) ||
    (expedited &&
      result?.inventory_state !== expeditedCapacityState) ||
    (!expedited && result?.production_due_date !== null) ||
    (!expedited && expeditedCapacityState !== "not_applicable") ||
    (result?.inventory_state === "committed" &&
      normalizeStripeCheckoutUrl(result.checkout_url) === null)
  ) {
    throw new Error("The inventory reservation response was invalid.");
  }

  return {
    id: result.id,
    orderNumber: result.order_number,
    inventoryReservationExpiresAt: deadline,
    created,
    inventoryState: result.inventory_state,
    productionDueDate,
    expeditedCapacityState,
    checkoutSessionId:
      typeof result.checkout_session_id === "string" &&
      /^cs_[A-Za-z0-9_]+$/.test(result.checkout_session_id)
        ? result.checkout_session_id
        : null,
    checkoutUrl: normalizeStripeCheckoutUrl(result.checkout_url),
  };
}

function normalizeProductionDueDate(value) {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
    ? value
    : null;
}

function normalizeStripeCheckoutUrl(value) {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "checkout.stripe.com"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function inventoryReservationIsUnavailable(error) {
  return [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .some((value) =>
      String(value).toLowerCase().includes(INVENTORY_UNAVAILABLE_MARKER)
    );
}

export function expeditedCapacityReservationIsUnavailable(error) {
  return [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .some((value) =>
      String(value)
        .toLowerCase()
        .includes(EXPEDITED_CAPACITY_UNAVAILABLE_MARKER)
    );
}

export function serializeCheckoutRequestStorage(request, nowMilliseconds) {
  if (
    !UUID_PATTERN.test(String(request?.id ?? "")) ||
    typeof request?.fingerprint !== "string" ||
    !request.fingerprint ||
    !Number.isFinite(nowMilliseconds)
  ) {
    return null;
  }

  return JSON.stringify({
    id: request.id.toLowerCase(),
    fingerprint: request.fingerprint,
    createdAt: Math.trunc(nowMilliseconds),
  });
}

export function parseCheckoutRequestStorage(value, nowMilliseconds) {
  if (!Number.isFinite(nowMilliseconds)) return null;

  try {
    const stored = JSON.parse(String(value ?? ""));
    const createdAt = Number(stored?.createdAt);
    if (
      !UUID_PATTERN.test(String(stored?.id ?? "")) ||
      typeof stored?.fingerprint !== "string" ||
      !stored.fingerprint ||
      !Number.isFinite(createdAt) ||
      createdAt > nowMilliseconds + 60_000 ||
      nowMilliseconds - createdAt > CHECKOUT_REQUEST_STORAGE_MAX_AGE_MS
    ) {
      return null;
    }

    return {
      id: stored.id.toLowerCase(),
      fingerprint: stored.fingerprint,
    };
  } catch {
    return null;
  }
}
