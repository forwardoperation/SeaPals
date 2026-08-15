export const storeProductionOptionDefinitions = Object.freeze([
  Object.freeze({
    id: "standard-production",
    displayName: "Standard production",
    description:
      "Complete production within 5 business days; mailed orders are dispatched and pickup orders are marked ready.",
    amountCents: 0,
    maxBusinessDays: 5,
    expedited: false,
    taxCodeEnvKey: null,
    defaultTaxCode: null,
  }),
  Object.freeze({
    id: "expedited-production",
    displayName: "Expedited production",
    description:
      "Complete production within 1 business day; mailed orders are dispatched and pickup orders are marked ready. Carrier transit is additional.",
    amountCents: 1000,
    maxBusinessDays: 1,
    expedited: true,
    taxCodeEnvKey: "STRIPE_PRODUCTION_TAX_CODE",
    defaultTaxCode: "txcd_92010004",
  }),
]);

export const defaultStoreProductionOptionId = "standard-production";
