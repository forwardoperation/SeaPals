export const STORE_BASE_SHIPPING_MAX_WEIGHT_OUNCES = 16;
export const STORE_MAX_SHIPPING_WEIGHT_OUNCES = 128;

const standardShippingRateTiers = Object.freeze([
  Object.freeze({
    id: "base",
    maxWeightOunces: STORE_BASE_SHIPPING_MAX_WEIGHT_OUNCES,
    defaultAmountCents: 1000,
    amountEnvKey: "STORE_STANDARD_SHIPPING_CENTS",
  }),
  Object.freeze({
    id: "large",
    maxWeightOunces: STORE_MAX_SHIPPING_WEIGHT_OUNCES,
    defaultAmountCents: 2000,
    amountEnvKey: "STORE_LARGE_STANDARD_SHIPPING_CENTS",
  }),
]);

const priorityShippingRateTiers = Object.freeze([
  Object.freeze({
    id: "base",
    maxWeightOunces: STORE_BASE_SHIPPING_MAX_WEIGHT_OUNCES,
    defaultAmountCents: 1500,
    amountEnvKey: "STORE_PRIORITY_SHIPPING_CENTS",
  }),
  Object.freeze({
    id: "large",
    maxWeightOunces: STORE_MAX_SHIPPING_WEIGHT_OUNCES,
    defaultAmountCents: 3500,
    amountEnvKey: "STORE_LARGE_PRIORITY_SHIPPING_CENTS",
  }),
]);

export const storeShippingOptionDefinitions = Object.freeze([
  Object.freeze({
    id: "standard",
    displayName: "Standard Shipping & Handling",
    shortName: "Standard",
    description:
      "Economy carrier service after production; estimated 2–7 business days in transit.",
    fulfillmentMethod: "shipping",
    defaultAmountCents: 1000,
    amountEnvKey: "STORE_STANDARD_SHIPPING_CENTS",
    rateTiers: standardShippingRateTiers,
    deliveryEstimateMinDays: 2,
    deliveryEstimateMaxDays: 7,
  }),
  Object.freeze({
    id: "priority",
    displayName: "Priority Shipping & Handling",
    shortName: "Priority",
    description:
      "USPS Priority Mail after production; estimated 2–3 business days in transit. This does not change production time.",
    fulfillmentMethod: "shipping",
    defaultAmountCents: 1500,
    amountEnvKey: "STORE_PRIORITY_SHIPPING_CENTS",
    rateTiers: priorityShippingRateTiers,
    deliveryEstimateMinDays: 2,
    deliveryEstimateMaxDays: 3,
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

export function resolveStoreShippingRateTier(option, weightOunces) {
  const optionId = String(option?.id ?? "").trim().toLowerCase();
  const definition = storeShippingOptionDefinitions.find(
    (candidate) => candidate.id === optionId
  );

  if (!definition) return null;

  if (definition.fulfillmentMethod === "pickup") {
    return Object.freeze({
      id: "pickup",
      maxWeightOunces: null,
      amountCents: 0,
    });
  }

  if (!Number.isSafeInteger(weightOunces) || weightOunces < 1) return null;

  const configuredTiers = Array.isArray(option?.rateTiers)
    ? option.rateTiers
    : [];
  const configuredTiersById = new Map(
    configuredTiers.map((tier) => [tier?.id, tier])
  );
  const definitionTiers = definition.rateTiers ?? [];

  for (const definitionTier of definitionTiers) {
    if (weightOunces > definitionTier.maxWeightOunces) continue;

    const configuredTier = configuredTiersById.get(definitionTier.id);
    const configuredAmount = Number(configuredTier?.amountCents);
    const legacyBaseAmount = Number(option?.amountCents);
    const amountCents = Number.isSafeInteger(configuredAmount)
      ? configuredAmount
      : definitionTier.id === "base" && Number.isSafeInteger(legacyBaseAmount)
        ? legacyBaseAmount
        : definitionTier.defaultAmountCents;

    if (amountCents < 0) return null;

    return Object.freeze({
      id: definitionTier.id,
      maxWeightOunces: definitionTier.maxWeightOunces,
      amountCents,
    });
  }

  return null;
}
