export const storeShippingOptionDefinitions = Object.freeze([
  Object.freeze({
    id: "standard",
    displayName: "Standard Shipping & Handling",
    shortName: "Standard",
    description: "Flat rate for standard carrier service.",
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
    description: "Flat rate for faster carrier service.",
    fulfillmentMethod: "shipping",
    defaultAmountCents: 1250,
    amountEnvKey: "STORE_PRIORITY_SHIPPING_CENTS",
    deliveryEstimateMinDays: null,
    deliveryEstimateMaxDays: null,
  }),
  Object.freeze({
    id: "pickup-elverson-pa",
    displayName: "Local pickup — Elverson, PA",
    shortName: "Local pickup",
    description: "Free pickup in Elverson after we email that your order is ready.",
    fulfillmentMethod: "pickup",
    pickupLocation: "Elverson, PA",
    defaultAmountCents: 0,
    amountEnvKey: null,
    deliveryEstimateMinDays: null,
    deliveryEstimateMaxDays: null,
  }),
]);

export const defaultStoreShippingOptionId = "standard";
