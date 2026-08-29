import {
  storeLaunchProductIds,
  storeProductDefinitions,
} from "../../data/store/products.js";
import {
  defaultStoreShippingOptionId,
  storeShippingOptionDefinitions,
} from "../../data/store/shipping.js";
import {
  defaultStoreProductionOptionId,
  storeProductionOptionDefinitions,
} from "../../data/store/production.js";
import { prebuiltDecks } from "../../data/decks/prebuiltDecks.js";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const EXPEDITED_PRODUCTION_DAILY_ORDER_LIMIT = 10;
const EXPEDITED_PRODUCTION_TIME_ZONE = "America/New_York";
const PREBUILT_DECKS_BY_ID = new Map(
  prebuiltDecks.map((deck) => [deck.id, deck])
);

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

function readPriceCents(value) {
  const cents = readCents(value);
  return cents !== null && cents > 0 ? cents : null;
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

function readStripeTaxRateId(value) {
  const taxRateId = String(value ?? "").trim();
  return /^txr_[A-Za-z0-9_]+$/.test(taxRateId) ? taxRateId : null;
}

function readStripeMode(value) {
  const key = String(value ?? "").trim();
  if (/^(?:sk|rk)_test_/.test(key)) return "test";
  if (/^(?:sk|rk)_live_/.test(key)) return "live";
  return null;
}

function readEmailAddress(value) {
  const header = String(value ?? "").trim();
  if (!header || header.length > 500 || /[\r\n]/.test(header)) return null;
  const angleAddress = /<([^<>]+)>$/.exec(header)?.[1]?.trim();
  const address = angleAddress ?? header;
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)
    ? address
    : null;
}

export function getStoreConfiguration() {
  const currency = readCurrency(process.env.STORE_CURRENCY);
  const paymentMode = readStripeMode(process.env.STRIPE_SECRET_KEY);
  const showFutureProducts = readBoolean(
    process.env.STORE_SHOW_FUTURE_PRODUCTS
  );
  const launchProductIds = new Set(storeLaunchProductIds);
  const productDefinitionsById = new Map(
    storeProductDefinitions.map((definition) => [definition.id, definition])
  );
  const legacyDeckPriceCents = readPriceCents(
    process.env.STORE_DEFAULT_PRICE_CENTS
  );
  const legacyShippingCents = readCents(process.env.STORE_SHIPPING_CENTS);
  const availableProductIds = readAvailableProductIds(
    process.env.STORE_AVAILABLE_PRODUCT_IDS !== undefined
      ? process.env.STORE_AVAILABLE_PRODUCT_IDS
      : process.env.STORE_AVAILABLE_DECK_IDS
  );
  const taxRegistrationConfirmed = readBoolean(
    process.env.STORE_TAX_REGISTRATION_CONFIRMED
  );
  const automaticTaxRequested = readBoolean(
    process.env.STRIPE_AUTOMATIC_TAX
  );
  const automaticTaxEnabled =
    automaticTaxRequested && taxRegistrationConfirmed;
  const productTaxCode = readStripeTaxCode(
    process.env.STRIPE_PRODUCT_TAX_CODE
  );
  const shippingTaxCode = readStripeTaxCode(
    process.env.STRIPE_SHIPPING_TAX_CODE
  );
  const legacyShippingEstimateMinDays = readPositiveInteger(
    process.env.STORE_SHIPPING_ESTIMATE_MIN_DAYS
  );
  const legacyShippingEstimateMaxDays = readPositiveInteger(
    process.env.STORE_SHIPPING_ESTIMATE_MAX_DAYS
  );
  const localPickupEnabled = readBoolean(
    process.env.STORE_LOCAL_PICKUP_ENABLED,
    false
  );
  const shippingRatesConfirmed = readBoolean(
    process.env.STORE_SHIPPING_RATES_CONFIRMED
  );
  const pickupTaxConfirmed = readBoolean(
    process.env.STORE_PICKUP_TAX_CONFIRMED
  );
  const pickupTaxRateId = readStripeTaxRateId(
    process.env.STRIPE_PICKUP_TAX_RATE_ID
  );
  const pickupTaxConfigurationReady =
    !localPickupEnabled ||
    (pickupTaxConfirmed && Boolean(pickupTaxRateId));
  const paymentMethodConfiguration = String(
    process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION_ID ?? ""
  ).trim();
  const paymentMethodConfigurationReady =
    /^pmc_[A-Za-z0-9_]+$/.test(paymentMethodConfiguration);
  const synchronousPaymentMethodsConfirmed = readBoolean(
    process.env.STORE_SYNCHRONOUS_PAYMENT_METHODS_CONFIRMED
  );
  const orderNotificationEnabled = readBoolean(
    process.env.STORE_ORDER_NOTIFICATION_ENABLED
  );
  const orderNotificationDeliveryConfirmed = readBoolean(
    process.env.STORE_ORDER_NOTIFICATION_DELIVERY_CONFIRMED
  );
  const orderNotificationConfigurationReady = Boolean(
    orderNotificationEnabled &&
      /^re_[A-Za-z0-9_-]{8,}$/.test(
        String(process.env.RESEND_API_KEY ?? "").trim()
      ) &&
      readEmailAddress(process.env.EMAIL_FROM) &&
      readEmailAddress(process.env.STORE_ORDER_NOTIFICATION_EMAIL)
  );
  const catalogConfirmed = readBoolean(
    process.env.STORE_CATALOG_CONFIRMED
  );
  const expeditedProductionEnabled = readBoolean(
    process.env.STORE_EXPEDITED_PRODUCTION_ENABLED
  );
  const expeditedProductionCapacityConfirmed = readBoolean(
    process.env.STORE_EXPEDITED_PRODUCTION_CAPACITY_CONFIRMED
  );
  const expeditedProductionDailyOrderLimit = readPositiveInteger(
    process.env.STORE_EXPEDITED_PRODUCTION_DAILY_ORDER_LIMIT
  );
  const expeditedProductionTimeZone = String(
    process.env.STORE_EXPEDITED_PRODUCTION_TIME_ZONE ?? ""
  ).trim();
  const expeditedProductionDefinition = storeProductionOptionDefinitions.find(
    (definition) => definition.expedited
  );
  const expeditedProductionCentsValue =
    process.env.STORE_EXPEDITED_PRODUCTION_CENTS;
  const expeditedProductionCents =
    expeditedProductionCentsValue === undefined ||
    expeditedProductionCentsValue === null ||
    String(expeditedProductionCentsValue).trim() === ""
      ? expeditedProductionDefinition?.amountCents ?? 1000
      : readCents(expeditedProductionCentsValue);
  const productionTaxCode =
    readStripeTaxCode(process.env.STRIPE_PRODUCTION_TAX_CODE) ??
    readStripeTaxCode(expeditedProductionDefinition?.defaultTaxCode);
  const productionOptions = storeProductionOptionDefinitions
    .filter(
      (definition) => !definition.expedited || expeditedProductionEnabled
    )
    .map((definition) => ({
      id: definition.id,
      displayName: definition.displayName,
      description: definition.description,
      amountCents: definition.expedited
        ? expeditedProductionCents
        : definition.amountCents,
      maxBusinessDays: definition.maxBusinessDays,
      expedited: definition.expedited,
    }));
  const expeditedProductionConfigurationReady =
    !expeditedProductionEnabled ||
    (expeditedProductionCents === 1000 &&
      productionTaxCode === "txcd_92010004" &&
      expeditedProductionDailyOrderLimit ===
        EXPEDITED_PRODUCTION_DAILY_ORDER_LIMIT &&
      expeditedProductionTimeZone === EXPEDITED_PRODUCTION_TIME_ZONE);
  const shippingOptions = storeShippingOptionDefinitions
    .filter(
      (definition) =>
        definition.fulfillmentMethod !== "pickup" || localPickupEnabled
    )
    .map((definition) => {
      const configuredAmount = definition.amountEnvKey
        ? readCents(process.env[definition.amountEnvKey])
        : null;
      const legacyBaseAmountCents =
        configuredAmount ??
        (definition.id === "standard" ? legacyShippingCents : null) ??
        definition.defaultAmountCents;
      const rateTiers = Array.isArray(definition.rateTiers)
        ? definition.rateTiers.map((tier) => {
            const configuredTierAmount = tier.amountEnvKey
              ? readCents(process.env[tier.amountEnvKey])
              : null;

            return {
              id: tier.id,
              maxWeightOunces: tier.maxWeightOunces,
              amountCents:
                configuredTierAmount ??
                (tier.id === "base" ? legacyBaseAmountCents : null) ??
                tier.defaultAmountCents,
            };
          })
        : [];
      const amountCents =
        rateTiers.find((tier) => tier.id === "base")?.amountCents ??
        legacyBaseAmountCents;
      const minimumDays =
        definition.id === "standard" && legacyShippingEstimateMinDays
          ? legacyShippingEstimateMinDays
          : definition.deliveryEstimateMinDays;
      const configuredMaximumDays =
        definition.id === "standard" && legacyShippingEstimateMaxDays
          ? legacyShippingEstimateMaxDays
          : definition.deliveryEstimateMaxDays;

      return {
        id: definition.id,
        displayName: definition.displayName,
        shortName: definition.shortName,
        description: definition.description,
        fulfillmentMethod: definition.fulfillmentMethod,
        pickupLocation: definition.pickupLocation ?? null,
        amountCents,
        rateTiers,
        deliveryEstimateMinDays: minimumDays,
        deliveryEstimateMaxDays:
          minimumDays &&
          configuredMaximumDays &&
          configuredMaximumDays >= minimumDays
            ? configuredMaximumDays
            : null,
      };
    });
  const defaultShippingOption =
    shippingOptions.find(
      (option) => option.id === defaultStoreShippingOptionId
    ) ?? shippingOptions[0];
  const standardShippingOption = shippingOptions.find(
    (option) => option.id === "standard"
  );
  const priorityShippingOption = shippingOptions.find(
    (option) => option.id === "priority"
  );
  const shippingRateAmountCents = (option, tierId) =>
    option?.rateTiers?.find((tier) => tier.id === tierId)?.amountCents;
  const shippingConfigurationReady = Boolean(
    shippingRateAmountCents(standardShippingOption, "dive-pack-base") === 500 &&
      shippingRateAmountCents(standardShippingOption, "base") === 1000 &&
      shippingRateAmountCents(standardShippingOption, "large") === 2000 &&
      shippingRateAmountCents(priorityShippingOption, "dive-pack-base") ===
        1000 &&
      shippingRateAmountCents(priorityShippingOption, "base") === 1500 &&
      shippingRateAmountCents(priorityShippingOption, "large") === 3500
  );

  const catalogDefinitions = showFutureProducts
    ? storeProductDefinitions
    : storeLaunchProductIds
        .map((productId) => productDefinitionsById.get(productId))
        .filter(Boolean);

  const products = catalogDefinitions.map((definition) => {
    const configuredPrice = readPriceCents(process.env[definition.priceEnvKey]);
    const defaultPriceCents = readPriceCents(definition.defaultPriceCents);
    const priceCents =
      configuredPrice ??
      (definition.deckId ? legacyDeckPriceCents : null) ??
      defaultPriceCents;
    const taxCode =
      readStripeTaxCode(process.env[definition.taxCodeEnvKey]) ??
      productTaxCode;
    const priceConfigured =
      !definition.requiresConfiguration &&
      priceCents !== null;
    const available =
      priceConfigured &&
      availableProductIds.has(definition.id);
    const includedDeckIds = [
      ...new Set(
        (
          definition.includedDeckIds ??
          (definition.deckId ? [definition.deckId] : [])
        ).filter((deckId) => PREBUILT_DECKS_BY_ID.has(deckId))
      ),
    ];
    const trialDecks = includedDeckIds.map((deckId) => {
      const deck = PREBUILT_DECKS_BY_ID.get(deckId);
      return {
        id: deck.id,
        name: deck.name,
        href: `/simulator?deck=${encodeURIComponent(deck.id)}`,
      };
    });

    return {
      id: definition.id,
      sku: definition.sku,
      madeToOrder: Boolean(definition.madeToOrder),
      buildDispatchMaxBusinessDays:
        Number.isSafeInteger(definition.buildDispatchMaxBusinessDays) &&
        definition.buildDispatchMaxBusinessDays > 0
          ? definition.buildDispatchMaxBusinessDays
          : null,
      deckId: definition.deckId ?? null,
      category: definition.category,
      name: definition.name,
      shortName: definition.shortName,
      productLabel: definition.productLabel,
      description: definition.description,
      playerSetupNote: definition.playerSetupNote ?? null,
      simulatorNote: definition.simulatorNote ?? null,
      details: definition.details,
      checkoutDescription: definition.checkoutDescription,
      includedItems: definition.includedItems
        ? [...definition.includedItems]
        : null,
      includedDeckIds,
      trialDecks,
      image: definition.image,
      cardsIncluded: definition.cardsIncluded ?? null,
      shippingWeightOunces: definition.shippingWeightOunces ?? null,
      defaultPriceCents,
      featured: definition.featured,
      requiresConfiguration: Boolean(definition.requiresConfiguration),
      availabilityNote: definition.availabilityNote ?? null,
      fullContentsHref: definition.deckId
        ? `/decks#${definition.deckId}`
        : null,
      priceCents,
      taxCode,
      priceConfigured,
      available,
      launchProduct: launchProductIds.has(definition.id),
    };
  });

  const availableProducts = products.filter((product) => product.available);
  const availableProductsHaveTaxCodes = availableProducts
    .every((product) => Boolean(product.taxCode));

  const infrastructureReady = Boolean(
    paymentMode &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      availableProducts.length > 0 &&
      paymentMethodConfigurationReady &&
      orderNotificationConfigurationReady &&
      expeditedProductionConfigurationReady &&
      pickupTaxConfigurationReady &&
      shippingConfigurationReady &&
      (paymentMode !== "live" || synchronousPaymentMethodsConfirmed) &&
      (paymentMode !== "live" || orderNotificationDeliveryConfirmed) &&
      (!automaticTaxRequested || taxRegistrationConfirmed) &&
      (paymentMode !== "live" ||
        (taxRegistrationConfirmed &&
          catalogConfirmed &&
          shippingRatesConfirmed &&
          automaticTaxEnabled &&
          (!expeditedProductionEnabled ||
            expeditedProductionCapacityConfirmed))) &&
      (!automaticTaxEnabled ||
        (availableProductsHaveTaxCodes &&
          Boolean(shippingTaxCode)))
  );

  return {
    checkoutEnabled:
      readBoolean(process.env.STORE_CHECKOUT_ENABLED) && infrastructureReady,
    paymentMode,
    paymentMethodConfiguration,
    synchronousPaymentMethodsConfirmed,
    orderNotificationEnabled,
    orderNotificationConfigurationReady,
    orderNotificationDeliveryConfirmed,
    showFutureProducts,
    currency,
    shippingOptions,
    defaultShippingOptionId: defaultShippingOption?.id ?? null,
    productionOptions,
    defaultProductionOptionId: defaultStoreProductionOptionId,
    productionTaxCode,
    expeditedProductionEnabled,
    expeditedProductionCapacityConfirmed,
    expeditedProductionDailyOrderLimit,
    expeditedProductionTimeZone,
    catalogConfirmed,
    shippingRatesConfirmed,
    shippingConfigurationReady,
    pickupTaxConfirmed,
    pickupTaxRateId,
    // Retain the legacy fields for older local tooling while Checkout uses the
    // selected server-controlled shipping option below.
    shippingCents: defaultShippingOption?.amountCents ?? 0,
    shippingEstimateMinDays:
      defaultShippingOption?.deliveryEstimateMinDays ?? null,
    shippingEstimateMaxDays:
      defaultShippingOption?.deliveryEstimateMaxDays ?? null,
    automaticTaxEnabled,
    automaticTaxRequested,
    taxRegistrationConfirmed,
    productTaxCode,
    shippingTaxCode,
    allowPromotionCodes: readBoolean(process.env.STRIPE_ALLOW_PROMOTION_CODES),
    collectPhone: readBoolean(process.env.STORE_COLLECT_PHONE),
    allowedCountries: readAllowedCountries(process.env.STORE_ALLOWED_COUNTRIES),
    products,
  };
}
