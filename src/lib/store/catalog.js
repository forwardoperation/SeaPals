import { storeProductDefinitions } from "../../data/store/products.js";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function readBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return TRUE_VALUES.has(String(value).trim().toLowerCase());
}

function readCents(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const cents = Number(value);
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

function readPositiveInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function readCurrency(value) {
  const currency = String(value || "usd").trim().toLowerCase();
  return /^[a-z]{3}$/.test(currency) ? currency : "usd";
}

function readAvailableProductIds(value) {
  const normalized = String(value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return new Set(normalized);
}

function readAllowedCountries(value) {
  const countries = String(value || "US")
    .split(",")
    .map((country) => country.trim().toUpperCase())
    .filter((country) => /^[A-Z]{2}$/.test(country));

  return countries.length ? [...new Set(countries)].slice(0, 20) : ["US"];
}

function readStripeTaxCode(value) {
  const taxCode = String(value ?? "").trim();
  return /^txcd_[0-9]+$/.test(taxCode) ? taxCode : null;
}

export function getStoreConfiguration() {
  const currency = readCurrency(process.env.STORE_CURRENCY);
  const legacyDeckPriceCents = readCents(
    process.env.STORE_DEFAULT_PRICE_CENTS
  );
  const shippingCents = readCents(process.env.STORE_SHIPPING_CENTS) ?? 0;
  const availableProductIds = readAvailableProductIds(
    process.env.STORE_AVAILABLE_PRODUCT_IDS !== undefined
      ? process.env.STORE_AVAILABLE_PRODUCT_IDS
      : process.env.STORE_AVAILABLE_DECK_IDS
  );
  const automaticTaxEnabled = readBoolean(process.env.STRIPE_AUTOMATIC_TAX);
  const productTaxCode = readStripeTaxCode(
    process.env.STRIPE_PRODUCT_TAX_CODE
  );
  const shippingEstimateMinDays = readPositiveInteger(
    process.env.STORE_SHIPPING_ESTIMATE_MIN_DAYS
  );
  const shippingEstimateMaxDays = readPositiveInteger(
    process.env.STORE_SHIPPING_ESTIMATE_MAX_DAYS
  );

  const products = storeProductDefinitions.map((definition) => {
    const configuredPrice = readCents(process.env[definition.priceEnvKey]);
    const defaultPriceCents = readCents(definition.defaultPriceCents);
    const priceCents =
      configuredPrice ??
      (definition.deckId ? legacyDeckPriceCents : null) ??
      defaultPriceCents;
    const taxCode =
      readStripeTaxCode(process.env[definition.taxCodeEnvKey]) ??
      productTaxCode;
    const available =
      !definition.requiresConfiguration &&
      priceCents !== null &&
      availableProductIds.has(definition.id);

    return {
      id: definition.id,
      sku: definition.sku,
      deckId: definition.deckId ?? null,
      category: definition.category,
      name: definition.name,
      shortName: definition.shortName,
      productLabel: definition.productLabel,
      description: definition.description,
      details: definition.details,
      checkoutDescription: definition.checkoutDescription,
      includedItems: definition.includedItems
        ? [...definition.includedItems]
        : null,
      image: definition.image,
      cardsIncluded: definition.cardsIncluded ?? null,
      defaultPriceCents,
      featured: definition.featured,
      requiresConfiguration: Boolean(definition.requiresConfiguration),
      availabilityNote: definition.availabilityNote ?? null,
      fullContentsHref: definition.deckId
        ? `/decks#${definition.deckId}`
        : null,
      priceCents,
      taxCode,
      available,
    };
  });

  const availableProducts = products.filter((product) => product.available);
  const availableProductsHaveTaxCodes = availableProducts
    .every((product) => Boolean(product.taxCode));

  const infrastructureReady = Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      availableProducts.length > 0 &&
      (!automaticTaxEnabled || availableProductsHaveTaxCodes)
  );

  return {
    checkoutEnabled:
      readBoolean(process.env.STORE_CHECKOUT_ENABLED) && infrastructureReady,
    currency,
    shippingCents,
    shippingEstimateMinDays,
    shippingEstimateMaxDays:
      shippingEstimateMinDays &&
      shippingEstimateMaxDays &&
      shippingEstimateMaxDays >= shippingEstimateMinDays
        ? shippingEstimateMaxDays
        : null,
    automaticTaxEnabled,
    productTaxCode,
    allowPromotionCodes: readBoolean(process.env.STRIPE_ALLOW_PROMOTION_CODES),
    collectPhone: readBoolean(process.env.STORE_COLLECT_PHONE),
    allowedCountries: readAllowedCountries(process.env.STORE_ALLOWED_COUNTRIES),
    products,
  };
}
