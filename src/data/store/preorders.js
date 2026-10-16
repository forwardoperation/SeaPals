// This is the 2026 holiday campaign, not a deadline that rolls into later years.
export const STORE_PREORDER_CAMPAIGN = Object.freeze({
  id: "christmas-2026",
  year: 2026,
  timeZone: "America/New_York",
  orderBefore: "2026-12-11T05:00:00.000Z",
  deliveryBefore: "2026-12-25T05:00:00.000Z",
  deliveryBy: "2026-12-24",
  fulfillmentDate: "2026-12-11",
});

export function getStorePreorderCampaign(now = new Date()) {
  const timestamp = now === null || now === "" || typeof now === "boolean"
    ? Number.NaN
    : new Date(now).getTime();
  const guaranteeOpen = Number.isFinite(timestamp) &&
    timestamp < Date.parse(STORE_PREORDER_CAMPAIGN.orderBefore);
  const christmasUpcoming = Number.isFinite(timestamp) &&
    timestamp < Date.parse(STORE_PREORDER_CAMPAIGN.deliveryBefore);

  return {
    ...STORE_PREORDER_CAMPAIGN,
    guaranteeOpen,
    christmasUpcoming,
    fulfillmentLabel: guaranteeOpen
      ? "Pre-order · Fulfilled by Christmas 2026"
      : "Pre-order · Fulfillment timing confirmed by email",
    headline: guaranteeOpen ? "Pre-Order Today!" : "Pre-Orders",
    message: guaranteeOpen
      ? "Starter Kits and Expansion Decks are pre-orders for Christmas 2026. Orders placed before December 11, 2026 (Eastern Time) are guaranteed delivery before Christmas."
      : christmasUpcoming
        ? "The Christmas delivery guarantee has closed. Pre-order fulfillment timing will be confirmed by email."
        : "Pre-order fulfillment timing will be confirmed by email.",
  };
}

export function getStorePreorderFulfillmentLabel(now = new Date()) {
  return getStorePreorderCampaign(now).fulfillmentLabel;
}

export function cartContainsPreorders(items) {
  return Array.isArray(items) && items.some(
    (item) => item?.fulfillmentType === "preorder" || item?.preorder === true
  );
}

export function getStoreItemFulfillmentSnapshot(product) {
  const preorder = product?.preorder === true;
  return {
    fulfillmentType: preorder ? "preorder" : "regular",
    preorderCampaignId: preorder ? STORE_PREORDER_CAMPAIGN.id : null,
    preorderCutoffAt: preorder ? STORE_PREORDER_CAMPAIGN.orderBefore : null,
    preorderDeliveryBy: preorder ? STORE_PREORDER_CAMPAIGN.deliveryBy : null,
    preorderFulfillmentDate: preorder ? STORE_PREORDER_CAMPAIGN.fulfillmentDate : null,
  };
}

export function getStoreOrderFulfillmentType(items) {
  if (!cartContainsPreorders(items)) return "regular";
  return items.every((item) => item?.fulfillmentType === "preorder" || item?.preorder === true)
    ? "preorder"
    : "mixed";
}

// Use the persisted order/item snapshot. Catalog changes must never relabel
// an earlier regular purchase as a pre-order.
export function orderContainsStorePreorders(order) {
  return ["preorder", "mixed"].includes(order?.fulfillment_type) ||
    (Array.isArray(order?.store_order_items) &&
      order.store_order_items.some((item) => item?.fulfillment_type === "preorder"));
}

export function getStoreOrderPreorderFulfillmentLabel(order) {
  if (!orderContainsStorePreorders(order)) return null;
  if (order.preorder_delivery_guaranteed === true &&
      order.preorder_campaign_id === STORE_PREORDER_CAMPAIGN.id) {
    return "Pre-order · Guaranteed delivery before Christmas 2026";
  }
  return "Pre-order · Fulfillment timing confirmed by email";
}

export function getStorePreorderConfirmation(session, paymentRecord = null) {
  if (!orderContainsStorePreorders(paymentRecord) &&
      session?.metadata?.preorder_campaign_id !== STORE_PREORDER_CAMPAIGN.id) {
    return null;
  }
  const paidTimestamp = Date.parse(paymentRecord?.paid_at ?? "");
  const guaranteed = session?.payment_status === "paid" &&
    orderContainsStorePreorders(paymentRecord) &&
    paymentRecord?.payment_status === "paid" &&
    paymentRecord?.preorder_campaign_id === STORE_PREORDER_CAMPAIGN.id &&
    paymentRecord?.preorder_delivery_guaranteed === true &&
    Number.isFinite(paidTimestamp) && paidTimestamp > 0 &&
    getStorePreorderCampaign(paidTimestamp).guaranteeOpen;
  return guaranteed
    ? "Your pre-order is guaranteed to arrive before Christmas 2026. Items in this order ship together when the pre-order is ready."
    : "This order contains pre-order items. Fulfillment timing will be confirmed by email; items in this order ship together when the pre-order is ready.";
}
