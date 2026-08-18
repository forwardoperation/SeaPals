export const STORE_FULFILLMENT_STATUS_VALUES = Object.freeze([
  "unfulfilled",
  "in_production",
  "packing",
  "awaiting_shipment",
  "ready_for_pickup",
  "picked_up",
  "on_hold",
  "shipped",
  "cancelled",
]);

const STATUS_LABELS = Object.freeze({
  unfulfilled: "Awaiting production",
  in_production: "In production",
  packing: "Packing",
  awaiting_shipment: "Awaiting shipment",
  ready_for_pickup: "Ready for pickup",
  picked_up: "Picked up",
  on_hold: "On hold",
  shipped: "Shipped",
  cancelled: "Cancelled",
});

const PAID_ADVANCEMENT_STATUSES = new Set([
  "in_production",
  "packing",
  "awaiting_shipment",
  "ready_for_pickup",
  "picked_up",
  "shipped",
]);

const SHIPPING_QUEUE_STATUSES = new Set([
  "unfulfilled",
  "in_production",
  "packing",
  "awaiting_shipment",
]);

function cleanStatus(value, fallback = "unknown") {
  return String(value ?? fallback).trim().toLowerCase() || fallback;
}

export function storeFulfillmentStatusLabel(value, fulfillmentMethod) {
  const status = cleanStatus(value, "unfulfilled");
  if (status === "packing" && fulfillmentMethod === "pickup") {
    return "Packing for pickup";
  }
  return STATUS_LABELS[status] ?? status
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isStoreFulfillmentStatus(value) {
  return STORE_FULFILLMENT_STATUS_VALUES.includes(cleanStatus(value));
}

export function isFulfillmentStatusAllowedForMethod(value, method) {
  const status = cleanStatus(value);
  if (!STORE_FULFILLMENT_STATUS_VALUES.includes(status)) return false;
  const pickup = cleanStatus(method, "shipping") === "pickup";
  if (pickup) return !["awaiting_shipment", "shipped"].includes(status);
  return !["ready_for_pickup", "picked_up"].includes(status);
}

export function isPaidFulfillmentAdvancement(value) {
  return PAID_ADVANCEMENT_STATUSES.has(cleanStatus(value));
}

export function isShippingQueueStatus(value) {
  return SHIPPING_QUEUE_STATUSES.has(cleanStatus(value, "unfulfilled"));
}
