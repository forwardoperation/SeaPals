export const storeShippingOptionDefinitions = Object.freeze([
  Object.freeze({
    id: "standard",
    displayName: "Standard Shipping & Handling",
    shortName: "Standard",
    description: "Standard carrier service after production.",
    fulfillmentMethod: "shipping",
    defaultAmountCents: 750,
    amountEnvKey: "STORE_STANDARD_SHIPPING_CENTS",
    deliveryEstimateMinDays: null,
    deliveryEstimateMaxDays: null,
  }),
  Object.freeze({
    id: "priority",
    displayName: "Priority Shipping & Handling",
    shortName: "Priority",
    description:
      "Faster carrier service after production. This does not change production time.",
    fulfillmentMethod: "shipping",
    defaultAmountCents: 1250,
    amountEnvKey: "STORE_PRIORITY_SHIPPING_CENTS",
    deliveryEstimateMinDays: null,
    deliveryEstimateMaxDays: null,
  }),
  Object.freeze({
    id: "pickup-elverson-pa",
    displayName: "Scheduled pickup — Elverson, PA",
    shortName: "Scheduled pickup",
    description:
      "Free scheduled pickup. We will email after your order is built to arrange a pickup time.",
    fulfillmentMethod: "pickup",
    pickupLocation: "Elverson, PA",
    defaultAmountCents: 0,
    amountEnvKey: null,
    deliveryEstimateMinDays: null,
    deliveryEstimateMaxDays: null,
  }),
]);

export const defaultStoreShippingOptionId = "standard";
