import { existsSync } from "node:fs";
import {
  storeLaunchProductIds,
  storeProductDefinitions,
} from "../src/data/store/products.js";
import {
  STORE_BASE_SHIPPING_MAX_WEIGHT_OUNCES,
  STORE_MAX_SHIPPING_WEIGHT_OUNCES,
} from "../src/data/store/shipping.js";
import {
  STORE_MAX_CART_QUANTITY,
  STORE_MAX_PER_PRODUCT_QUANTITY,
} from "../src/lib/store/cart.mjs";

if (
  process.env.STORE_SKIP_LOCAL_ENV !== "true" &&
  existsSync(".env.local") &&
  typeof process.loadEnvFile === "function"
) {
  process.loadEnvFile(".env.local");
}

const online = process.argv.includes("--online");
const launchCatalog = process.argv.includes("--launch-catalog");
const checks = [];
const STRIPE_API_VERSION = "2026-07-29.dahlia";
const EXPEDITED_PRODUCTION_CENTS = 1000;
const EXPEDITED_PRODUCTION_TAX_CODE = "txcd_92010004";
const EXPEDITED_PRODUCTION_DAILY_ORDER_LIMIT = 10;
const EXPEDITED_PRODUCTION_TIME_ZONE = "America/New_York";
const STANDARD_SHIPPING_CENTS = 1000;
const PRIORITY_SHIPPING_CENTS = 1500;
const LARGE_STANDARD_SHIPPING_CENTS = 2000;
const LARGE_PRIORITY_SHIPPING_CENTS = 3500;
const APPROVED_LAUNCH_PRICE_CENTS_BY_PRODUCT_ID = Object.freeze({
  "blue-water": 2200,
  disruption: 2200,
  "coral-garden": 2200,
  "darkness-shroud": 2200,
  "open-ocean-hunt": 2200,
  "murky-water": 2200,
  "stinging-fortress": 2200,
  "accessory-set": 1200,
});

function addCheck(label, passed, detail, required = true) {
  checks.push({ label, passed: Boolean(passed), detail, required });
}

function present(name) {
  return Boolean(String(process.env[name] ?? "").trim());
}

function trueValue(name) {
  return ["1", "true", "yes", "on"].includes(
    String(process.env[name] ?? "").trim().toLowerCase()
  );
}

function centsValue(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const cents = Number(value);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

function validSiteUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    const localHostname = ["localhost", "127.0.0.1", "[::1]"].includes(
      url.hostname
    );
    return url.protocol === "https:" ||
      (url.protocol === "http:" && localHostname);
  } catch {
    return false;
  }
}

function emailAddress(value) {
  const header = String(value ?? "").trim();
  if (!header || header.length > 500 || /[\r\n]/.test(header)) return null;
  const angleAddress = /<([^<>]+)>$/.exec(header)?.[1]?.trim();
  const address = angleAddress ?? header;
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)
    ? address
    : null;
}

const stripeKey = String(process.env.STRIPE_SECRET_KEY ?? "").trim();
const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
const adminToken = String(process.env.STORE_ADMIN_TOKEN ?? "").trim();
const resendKey = String(process.env.RESEND_API_KEY ?? "").trim();
const orderNotificationEnabled = trueValue(
  "STORE_ORDER_NOTIFICATION_ENABLED"
);
const orderNotificationDeliveryConfirmed = trueValue(
  "STORE_ORDER_NOTIFICATION_DELIVERY_CONFIRMED"
);
const orderNotificationEmail = emailAddress(
  process.env.STORE_ORDER_NOTIFICATION_EMAIL
);
const orderNotificationFrom = emailAddress(process.env.EMAIL_FROM);
const localPickupEnabled = trueValue("STORE_LOCAL_PICKUP_ENABLED");
const pickupTaxConfirmed = trueValue("STORE_PICKUP_TAX_CONFIRMED");
const pickupTaxRateId = String(
  process.env.STRIPE_PICKUP_TAX_RATE_ID ?? ""
).trim();
const siteUrl =
  String(process.env.SITE_URL ?? "").trim() ||
  String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
const availableProducts = String(
  process.env.STORE_AVAILABLE_PRODUCT_IDS ??
    process.env.STORE_AVAILABLE_DECK_IDS ??
    ""
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const stripeKeyPattern = /^(?:sk|rk)_(?:test|live)_/;
const productDefinitions = new Map(
  storeProductDefinitions.map((product) => [product.id, product])
);
const productTaxEnvironment = new Map(
  storeProductDefinitions.map((product) => [
    product.id,
    product.taxCodeEnvKey,
  ])
);
const invalidProductIds = availableProducts.filter(
  (productId) => !productTaxEnvironment.has(productId)
);
const expectedInventoryProducts = availableProducts
  .map((productId) => ({
    productId,
    sku: productDefinitions.get(productId)?.sku ?? null,
  }))
  .filter(({ sku }) => Boolean(sku));
const standardShippingCents =
  centsValue(process.env.STORE_STANDARD_SHIPPING_CENTS) ??
  centsValue(process.env.STORE_SHIPPING_CENTS) ??
  STANDARD_SHIPPING_CENTS;
const priorityShippingCents =
  centsValue(process.env.STORE_PRIORITY_SHIPPING_CENTS) ??
  PRIORITY_SHIPPING_CENTS;
const largeStandardShippingCents =
  centsValue(process.env.STORE_LARGE_STANDARD_SHIPPING_CENTS) ??
  LARGE_STANDARD_SHIPPING_CENTS;
const largePriorityShippingCents =
  centsValue(process.env.STORE_LARGE_PRIORITY_SHIPPING_CENTS) ??
  LARGE_PRIORITY_SHIPPING_CENTS;
const expeditedProductionEnabled = trueValue(
  "STORE_EXPEDITED_PRODUCTION_ENABLED"
);
const expeditedProductionCentsValue = String(
  process.env.STORE_EXPEDITED_PRODUCTION_CENTS ?? ""
).trim();
const expeditedProductionCents = expeditedProductionCentsValue
  ? Number(expeditedProductionCentsValue)
  : EXPEDITED_PRODUCTION_CENTS;
const productionTaxCode = String(
  process.env.STRIPE_PRODUCTION_TAX_CODE ??
    EXPEDITED_PRODUCTION_TAX_CODE
).trim();
const expeditedProductionDailyOrderLimit = Number(
  String(process.env.STORE_EXPEDITED_PRODUCTION_DAILY_ORDER_LIMIT ?? "").trim()
);
const expeditedProductionTimeZone = String(
  process.env.STORE_EXPEDITED_PRODUCTION_TIME_ZONE ?? ""
).trim();

async function readStripeResource(path) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Stripe-Version": STRIPE_API_VERSION,
    },
  });

  if (!response.ok) {
    throw new Error("Stripe API read failed.");
  }

  const payload = await response.json();
  if (!payload || typeof payload !== "object") {
    throw new Error("Stripe API returned an invalid response.");
  }

  return payload;
}

async function readActiveStripeTaxRegistrations() {
  const registrations = [];
  let startingAfter = null;

  for (let page = 0; page < 100; page += 1) {
    const query = new URLSearchParams({ status: "active", limit: "100" });
    if (startingAfter) query.set("starting_after", startingAfter);

    const payload = await readStripeResource(
      `/v1/tax/registrations?${query.toString()}`
    );
    if (!Array.isArray(payload.data)) {
      throw new Error("Stripe API returned an invalid registration list.");
    }

    registrations.push(...payload.data);
    if (!payload.has_more) return registrations;

    startingAfter = payload.data.at(-1)?.id;
    if (!startingAfter) {
      throw new Error("Stripe API returned an invalid registration cursor.");
    }
  }

  throw new Error("Stripe API registration pagination did not finish.");
}

function resolvedProductPrice(productId) {
  const definition = productDefinitions.get(productId);
  if (!definition || definition.requiresConfiguration) return null;

  return centsValue(process.env[definition.priceEnvKey]) ??
    (definition.deckId
      ? centsValue(process.env.STORE_DEFAULT_PRICE_CENTS)
      : null) ??
    centsValue(definition.defaultPriceCents);
}

addCheck(
  "Public site URL",
  validSiteUrl(siteUrl),
  "Set server-only SITE_URL to localhost for testing and the final HTTPS domain for live checkout."
);
if (stripeKey.includes("_live_")) {
  addCheck(
    "Live HTTPS site URL",
    siteUrl.startsWith("https://"),
    "Live checkout must use the public HTTPS domain."
  );
  addCheck(
    "Owner-confirmed sales tax registration",
    trueValue("STORE_TAX_REGISTRATION_CONFIRMED"),
    "Keep false until Pennsylvania has issued or activated the sales tax license; a Stripe Tax registration entry alone is not enough."
  );
  addCheck(
    "Owner-confirmed shipping rates",
    trueValue("STORE_SHIPPING_RATES_CONFIRMED"),
    "Confirm the fixed Standard and Priority rates against packaged weights before live checkout."
  );
  addCheck(
    "Owner-confirmed launch catalog",
    trueValue("STORE_CATALOG_CONFIRMED"),
    "Confirm finished stock or owner-approved made-to-order ATP capacity, packaged contents, prices, and fulfillment for every allowlisted SKU before live checkout."
  );
  addCheck(
    "Live Stripe automatic tax",
    trueValue("STRIPE_AUTOMATIC_TAX"),
    "Live shipped orders require Stripe Automatic Tax; fixed-location pickup uses its separately verified manual rate."
  );
  addCheck(
    "Owner-confirmed synchronous payment methods",
    trueValue("STORE_SYNCHRONOUS_PAYMENT_METHODS_CONFIRMED"),
    "Confirm every enabled method in the dedicated Stripe configuration has a synchronous final result before live inventory holds."
  );
  if (expeditedProductionEnabled) {
    addCheck(
      "Owner-confirmed expedited production capacity",
      trueValue("STORE_EXPEDITED_PRODUCTION_CAPACITY_CONFIRMED"),
      "Confirm shared production labor can build and dispatch every accepted expedited order within one business day."
    );
  }
}
addCheck(
  "Supabase server credentials",
  present("NEXT_PUBLIC_SUPABASE_URL") && present("SUPABASE_SERVICE_ROLE_KEY"),
  "Required for the private order ledger."
);
addCheck(
  "Stripe secret key",
  stripeKeyPattern.test(stripeKey),
  "Use a test secret or restricted key until a complete test order and refund pass."
);
addCheck(
  "Stripe webhook secret",
  webhookSecret.startsWith("whsec_") && webhookSecret.length > 12,
  "Use the signing secret for /api/store/webhook."
);
addCheck(
  "Store admin token",
  adminToken.length >= 32,
  "Use a unique random value of at least 32 characters."
);
addCheck(
  "Paid-order merchant notifications",
  orderNotificationEnabled &&
    /^re_[A-Za-z0-9_-]{8,}$/.test(resendKey) &&
    Boolean(orderNotificationFrom) &&
    Boolean(orderNotificationEmail),
  "Enable paid-order alerts and configure RESEND_API_KEY, a verified EMAIL_FROM, and an explicit STORE_ORDER_NOTIFICATION_EMAIL."
);
addCheck(
  "Paid-order alert delivery confirmation",
  orderNotificationDeliveryConfirmed,
  "Set STORE_ORDER_NOTIFICATION_DELIVERY_CONFIRMED=true only after a synthetic alert reaches the private inbox.",
  stripeKey.includes("_live_")
);
addCheck(
  "Explicit product allowlist",
  availableProducts.length > 0 && !availableProducts.includes("all"),
  "List reviewed product IDs individually; the catalog intentionally rejects an all-products wildcard."
);
addCheck(
  "Known product IDs",
  invalidProductIds.length === 0,
  invalidProductIds.length
    ? `Unknown IDs: ${invalidProductIds.join(", ")}.`
    : "Every allowlisted ID exists in the server catalog."
);

const unpricedAvailableProducts = availableProducts.filter(
  (productId) =>
    productDefinitions.has(productId) && resolvedProductPrice(productId) === null
);
addCheck(
  "Prices for allowlisted products",
  unpricedAvailableProducts.length === 0,
  unpricedAvailableProducts.length
    ? `Set an integer-cent price for: ${unpricedAvailableProducts.join(", ")}.`
    : "Every allowlisted product has a server-controlled price."
);
addCheck(
  "Shipping options",
  standardShippingCents === STANDARD_SHIPPING_CENTS &&
    priorityShippingCents === PRIORITY_SHIPPING_CENTS &&
    largeStandardShippingCents === LARGE_STANDARD_SHIPPING_CENTS &&
    largePriorityShippingCents === LARGE_PRIORITY_SHIPPING_CENTS,
  standardShippingCents === STANDARD_SHIPPING_CENTS &&
    priorityShippingCents === PRIORITY_SHIPPING_CENTS &&
    largeStandardShippingCents === LARGE_STANDARD_SHIPPING_CENTS &&
    largePriorityShippingCents === LARGE_PRIORITY_SHIPPING_CENTS
    ? localPickupEnabled
      ? `Up to one pound is ${standardShippingCents}/${priorityShippingCents} cents, over one through eight pounds is ${largeStandardShippingCents}/${largePriorityShippingCents} cents, and optional Elverson pickup is enabled.`
      : `Up to one pound is ${standardShippingCents}/${priorityShippingCents} cents, over one through eight pounds is ${largeStandardShippingCents}/${largePriorityShippingCents} cents, and local pickup is disabled.`
    : `Use the owner-approved tiers: ${STANDARD_SHIPPING_CENTS}/${PRIORITY_SHIPPING_CENTS} cents through one pound and ${LARGE_STANDARD_SHIPPING_CENTS}/${LARGE_PRIORITY_SHIPPING_CENTS} cents over one through eight pounds.`,
  true
);
const invalidShippingWeightProducts = availableProducts.filter((productId) => {
  const ounces = productDefinitions.get(productId)?.shippingWeightOunces;
  return !Number.isSafeInteger(ounces) || ounces < 1 || ounces > 16;
});
addCheck(
  "Conservative product shipping weights",
  invalidShippingWeightProducts.length === 0,
  invalidShippingWeightProducts.length
    ? `Set a conservative one-to-sixteen-ounce shipping weight for: ${invalidShippingWeightProducts.join(", ")}.`
    : "Every allowlisted product has a conservative shipping weight for the one- and eight-pound rate tiers."
);
addCheck(
  "Mailed-order cart limits",
  STORE_MAX_PER_PRODUCT_QUANTITY === 8 &&
    STORE_MAX_CART_QUANTITY === 8 &&
    STORE_BASE_SHIPPING_MAX_WEIGHT_OUNCES === 16 &&
    STORE_MAX_SHIPPING_WEIGHT_OUNCES === 128,
  "Checkout must cap each SKU and the whole cart at eight items, with approved one- and eight-pound tier boundaries."
);
if (localPickupEnabled) {
  addCheck(
    "Elverson pickup manual tax rate",
    pickupTaxConfirmed && /^txr_[A-Za-z0-9_]+$/.test(pickupTaxRateId),
    "Configure and owner-confirm the active exclusive 6% US/PA Stripe Tax Rate used for fixed-location pickup."
  );
}
if (expeditedProductionEnabled) {
  addCheck(
    "Expedited production fee",
    expeditedProductionCents === EXPEDITED_PRODUCTION_CENTS,
    `The enabled expedited option must remain one ${EXPEDITED_PRODUCTION_CENTS}-cent charge per order.`
  );
  addCheck(
    "Expedited production handling tax code",
    productionTaxCode === EXPEDITED_PRODUCTION_TAX_CODE,
    `The enabled expedited option must use Stripe's exact Handling Charge code ${EXPEDITED_PRODUCTION_TAX_CODE}.`
  );
  addCheck(
    "Expedited production daily order limit",
    expeditedProductionDailyOrderLimit ===
      EXPEDITED_PRODUCTION_DAILY_ORDER_LIMIT,
    `The enabled expedited option must enforce exactly ${EXPEDITED_PRODUCTION_DAILY_ORDER_LIMIT} orders per Eastern-time production due date.`
  );
  addCheck(
    "Expedited production time zone",
    expeditedProductionTimeZone === EXPEDITED_PRODUCTION_TIME_ZONE,
    `The enabled expedited option must allocate daily capacity in ${EXPEDITED_PRODUCTION_TIME_ZONE}.`
  );
}
addCheck(
  "Promotion codes disabled",
  !trueValue("STRIPE_ALLOW_PROMOTION_CODES"),
  "Keep promotion codes off until discount_cents and amount_discount are reconciled in the order ledger."
);
addCheck(
  "Synchronous payment-method configuration",
  /^pmc_[A-Za-z0-9_]+$/.test(
    String(process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION_ID ?? "").trim()
  ),
  "Set a dedicated Stripe payment-method configuration that enables only synchronous launch methods."
);

if (launchCatalog) {
  const availableProductIdSet = new Set(availableProducts);
  const missingLaunchProducts = storeLaunchProductIds.filter(
    (productId) => !availableProductIdSet.has(productId)
  );
  const unexpectedLaunchProducts = availableProducts.filter(
    (productId) => !storeLaunchProductIds.includes(productId)
  );
  const duplicateLaunchProducts = availableProducts.filter(
    (productId, index) => availableProducts.indexOf(productId) !== index
  );
  const incorrectlyPricedLaunchProducts = storeLaunchProductIds.filter(
    (productId) =>
      resolvedProductPrice(productId) !==
      APPROVED_LAUNCH_PRICE_CENTS_BY_PRODUCT_ID[productId]
  );

  addCheck(
    "Exact approved launch allowlist",
    missingLaunchProducts.length === 0 &&
      unexpectedLaunchProducts.length === 0 &&
      duplicateLaunchProducts.length === 0,
    missingLaunchProducts.length
      ? `Still missing: ${missingLaunchProducts.join(", ")}.`
      : unexpectedLaunchProducts.length
        ? `Remove non-launch products: ${unexpectedLaunchProducts.join(", ")}.`
        : duplicateLaunchProducts.length
          ? `Remove duplicate product IDs: ${[...new Set(duplicateLaunchProducts)].join(", ")}.`
          : "Only the seven approved decks and Accessories Kit are selected."
  );
  addCheck(
    "Approved launch prices",
    incorrectlyPricedLaunchProducts.length === 0,
    incorrectlyPricedLaunchProducts.length
      ? `Restore the owner-approved price for: ${incorrectlyPricedLaunchProducts.join(", ")}.`
      : "The seven decks are $22 each and the Accessories Kit is $12."
  );
}

if (trueValue("STRIPE_AUTOMATIC_TAX")) {
  addCheck(
    "Tax registration launch gate",
    trueValue("STORE_TAX_REGISTRATION_CONFIRMED"),
    "Automatic tax stays blocked until the owner confirms the government registration is active."
  );
  const globalTaxCode = String(
    process.env.STRIPE_PRODUCT_TAX_CODE ?? ""
  ).trim();
  const missingTaxCodes = availableProducts.filter((productId) => {
    const categoryEnvironment = productTaxEnvironment.get(productId);
    const categoryTaxCode = String(
      process.env[categoryEnvironment] ?? ""
    ).trim();
    return !/^txcd_[0-9]+$/.test(categoryTaxCode) &&
      !/^txcd_[0-9]+$/.test(globalTaxCode);
  });
  addCheck(
    "Tax codes for available products",
    missingTaxCodes.length === 0,
    missingTaxCodes.length
      ? `Missing a validated category tax code for: ${missingTaxCodes.join(", ")}.`
      : "Every available product has a configured Stripe Tax code."
  );
  const shippingTaxCode = String(
    process.env.STRIPE_SHIPPING_TAX_CODE ?? ""
  ).trim();
  addCheck(
    "Shipping tax code",
    /^txcd_[0-9]+$/.test(shippingTaxCode),
    "Set a validated Stripe shipping tax code before automatic tax is enabled."
  );
}
addCheck(
  "Checkout launch switch",
  trueValue("STORE_CHECKOUT_ENABLED"),
  "Keep false until test payment, webhook, receipt, tax, and fulfillment checks pass.",
  false
);

if (stripeKey.includes("_live_") && trueValue("STORE_CHECKOUT_ENABLED")) {
  addCheck(
    "Live launch gate",
    trueValue("STORE_CATALOG_CONFIRMED") &&
      trueValue("STORE_SHIPPING_RATES_CONFIRMED") &&
      trueValue("STORE_TAX_REGISTRATION_CONFIRMED") &&
      trueValue("STRIPE_AUTOMATIC_TAX") &&
      trueValue("STORE_SYNCHRONOUS_PAYMENT_METHODS_CONFIRMED") &&
      orderNotificationEnabled &&
      /^re_[A-Za-z0-9_-]{8,}$/.test(resendKey) &&
      Boolean(orderNotificationFrom) &&
      Boolean(orderNotificationEmail) &&
      orderNotificationDeliveryConfirmed &&
      (!localPickupEnabled ||
        (pickupTaxConfirmed && /^txr_[A-Za-z0-9_]+$/.test(pickupTaxRateId))) &&
      (!expeditedProductionEnabled ||
        trueValue("STORE_EXPEDITED_PRODUCTION_CAPACITY_CONFIRMED")) &&
      (!expeditedProductionEnabled ||
        (expeditedProductionCents === EXPEDITED_PRODUCTION_CENTS &&
          productionTaxCode === EXPEDITED_PRODUCTION_TAX_CODE &&
          expeditedProductionDailyOrderLimit ===
            EXPEDITED_PRODUCTION_DAILY_ORDER_LIMIT &&
          expeditedProductionTimeZone === EXPEDITED_PRODUCTION_TIME_ZONE)),
    "Never enable live checkout unless every owner confirmation and the implemented tax/payment path are active."
  );
}

let stripeAccount = null;
let stripeTaxSettings = null;
let stripeActiveTaxRegistrations = null;
let stripePaymentMethodConfiguration = null;
let stripePickupTaxRate = null;

if (online && stripeKeyPattern.test(stripeKey)) {
  try {
    stripeAccount = await readStripeResource("/v1/account");
    addCheck(
      "Stripe account API",
      true,
      `${stripeKey.includes("_live_") ? "Live" : "Test"} account credentials are valid.`
    );
    addCheck(
      "Stripe details submitted",
      stripeAccount.details_submitted,
      stripeAccount.details_submitted
        ? "Business and representative details are submitted."
        : `Still due: ${(stripeAccount.requirements?.currently_due ?? []).join(", ") || "check the Stripe Dashboard"}.`
    );
    addCheck(
      "Stripe charges enabled",
      stripeAccount.charges_enabled,
      stripeAccount.charges_enabled
        ? "Stripe reports that the account can accept live charges."
        : "Finish the currently due account requirements before launch."
    );
    addCheck(
      "Stripe payouts enabled",
      stripeAccount.payouts_enabled,
      stripeAccount.payouts_enabled
        ? "Stripe reports that payouts are enabled."
        : "The bank account or another payout requirement still needs owner action."
    );
  } catch {
    addCheck(
      "Stripe account API",
      false,
      "Could not read the Stripe account. Grant Account: Read and inspect Stripe request logs."
    );
  }

  try {
    stripeTaxSettings = await readStripeResource("/v1/tax/settings");
    addCheck(
      "Stripe Tax settings API",
      true,
      "Tax Settings are readable with the configured Stripe key."
    );
  } catch {
    addCheck(
      "Stripe Tax settings API",
      false,
      "Could not read Tax Settings. Grant Tax Settings: Read and inspect Stripe request logs."
    );
  }

  try {
    stripeActiveTaxRegistrations = await readActiveStripeTaxRegistrations();
    addCheck(
      "Stripe Tax registrations API",
      true,
      "Active Tax Registrations are readable with the configured Stripe key."
    );
  } catch {
    addCheck(
      "Stripe Tax registrations API",
      false,
      "Could not read Tax Registrations. Grant Tax Registrations: Read and inspect Stripe request logs."
    );
  }

  const paymentMethodConfigurationId = String(
    process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION_ID ?? ""
  ).trim();
  if (/^pmc_[A-Za-z0-9_]+$/.test(paymentMethodConfigurationId)) {
    try {
      stripePaymentMethodConfiguration = await readStripeResource(
        `/v1/payment_method_configurations/${encodeURIComponent(paymentMethodConfigurationId)}`
      );
      addCheck(
        "Stripe payment-method configuration identity",
        stripePaymentMethodConfiguration?.id === paymentMethodConfigurationId &&
          stripePaymentMethodConfiguration?.active === true &&
          Boolean(stripePaymentMethodConfiguration?.livemode) ===
            stripeKey.includes("_live_"),
        "The dedicated configuration must be active and belong to the configured Stripe mode."
      );
    } catch {
      addCheck(
        "Stripe payment-method configuration identity",
        false,
        "Could not read the dedicated configuration. Grant Payment Method Configurations: Read and inspect Stripe request logs."
      );
    }
  }

  if (localPickupEnabled && /^txr_[A-Za-z0-9_]+$/.test(pickupTaxRateId)) {
    try {
      stripePickupTaxRate = await readStripeResource(
        `/v1/tax_rates/${encodeURIComponent(pickupTaxRateId)}`
      );
      const expectedLiveMode = stripeKey.includes("_live_");
      addCheck(
        "Stripe Elverson pickup tax rate",
        stripePickupTaxRate?.id === pickupTaxRateId &&
          stripePickupTaxRate?.active === true &&
          stripePickupTaxRate?.inclusive === false &&
          Number(stripePickupTaxRate?.percentage) === 6 &&
          stripePickupTaxRate?.country === "US" &&
          stripePickupTaxRate?.state === "PA" &&
          Boolean(stripePickupTaxRate?.livemode) === expectedLiveMode,
        "The configured pickup Tax Rate must be active, exclusive, exactly 6%, US/PA, and belong to the configured Stripe mode."
      );
    } catch {
      addCheck(
        "Stripe Elverson pickup tax rate",
        false,
        "Could not read the pickup Tax Rate. Grant Tax Rates: Read and inspect Stripe request logs."
      );
    }
  }

  if (
    stripeKey.includes("_live_") &&
    trueValue("STORE_TAX_REGISTRATION_CONFIRMED")
  ) {
    addCheck(
      "Live Stripe Tax settings active",
      stripeTaxSettings?.status === "active" &&
        stripeTaxSettings?.livemode === true,
      "The live Stripe Tax Settings status must be active before launch."
    );
    const hasActivePennsylvaniaRegistration =
      Array.isArray(stripeActiveTaxRegistrations) &&
      stripeActiveTaxRegistrations.some(
        (registration) =>
          registration?.status === "active" &&
          registration?.livemode === true &&
          registration?.country === "US" &&
          registration?.country_options?.us?.state === "PA" &&
          registration?.country_options?.us?.type === "state_sales_tax"
      );
    addCheck(
      "Live Pennsylvania Stripe Tax registration",
      hasActivePennsylvaniaRegistration,
      "Stripe must report an active live US/PA state_sales_tax registration before launch."
    );
  }
}

if (
  online &&
  present("NEXT_PUBLIC_SUPABASE_URL") &&
  present("SUPABASE_SERVICE_ROLE_KEY")
) {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(
    /\/$/,
    ""
  );
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };

  try {
    const orderColumns = [
      "id",
      "checkout_request_id",
      "checkout_request_snapshot",
      "checkout_url",
      "inventory_state",
      "inventory_reserved_until",
      "inventory_committed_at",
      "inventory_released_at",
      "inventory_release_reason",
    ].join(",");
    const response = await fetch(
      `${supabaseUrl}/rest/v1/store_orders?select=${orderColumns}&limit=1`,
      { headers: supabaseHeaders }
    );
    if (!response.ok) throw new Error("Store order schema is unavailable.");

    addCheck(
      "Supabase order inventory columns",
      true,
      "The private order ledger exposes the reservation lifecycle columns."
    );
  } catch {
    addCheck(
      "Supabase order inventory columns",
      false,
      "Run the current supabase/store-orders.sql migration before checkout."
    );
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/store_inventory?select=sku,on_hand_quantity,reserved_quantity`,
      { headers: supabaseHeaders }
    );
    if (!response.ok) throw new Error("Store inventory schema is unavailable.");

    const inventoryRows = await response.json();
    if (!Array.isArray(inventoryRows)) {
      throw new Error("Store inventory response is invalid.");
    }

    const rowsBySku = new Map(
      inventoryRows.map((row) => [String(row?.sku ?? ""), row])
    );
    const missingInventory = expectedInventoryProducts.filter(
      ({ sku }) => !rowsBySku.has(sku)
    );
    const invalidInventory = expectedInventoryProducts.filter(({ sku }) => {
      const row = rowsBySku.get(sku);
      return row && !(
        Number.isSafeInteger(row.on_hand_quantity) &&
        row.on_hand_quantity >= 0 &&
        Number.isSafeInteger(row.reserved_quantity) &&
        row.reserved_quantity >= 0 &&
        row.reserved_quantity <= row.on_hand_quantity
      );
    });
    const inventoryReady =
      missingInventory.length === 0 && invalidInventory.length === 0;

    addCheck(
      "Supabase inventory table",
      inventoryReady,
      missingInventory.length
        ? `Seed verified inventory or made-to-order ATP rows for: ${missingInventory
            .map(({ productId, sku }) => `${productId} (${sku})`)
            .join(", ")}.`
        : invalidInventory.length
          ? `Fix invalid stock counters for: ${invalidInventory
              .map(({ productId, sku }) => `${productId} (${sku})`)
              .join(", ")}.`
          : "Every enabled product has a valid private per-SKU inventory/ATP row; zero on-hand is allowed as sold out."
    );
  } catch {
    addCheck(
      "Supabase inventory table",
      false,
      "Run the current supabase/store-orders.sql migration before checkout."
    );
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/check_store_inventory_contract_v5`,
      {
        method: "POST",
        headers: { ...supabaseHeaders, "Content-Type": "application/json" },
        body: "{}",
      }
    );
    if (!response.ok || (await response.json()) !== true) {
      throw new Error("Store inventory RPC contract is unavailable.");
    }

    addCheck(
      "Supabase inventory RPC contract",
      true,
      "The read-only schema check confirms reservation and merchant-notification RPCs."
    );
  } catch {
    addCheck(
      "Supabase inventory RPC contract",
      false,
      "Run the current supabase/store-orders.sql migration before checkout."
    );
  }
}

console.log("\nSeaPals storefront readiness\n");
for (const check of checks) {
  const marker = check.passed ? "PASS" : check.required ? "TODO" : "INFO";
  console.log(`[${marker}] ${check.label}`);
  console.log(`       ${check.detail}`);
}

if (!online) {
  console.log(
    "\nRun `npm run store:check:online` after adding Stripe test credentials to validate the provider account and Supabase schema."
  );
}

if (!launchCatalog) {
  console.log(
    "Run `npm run store:check:launch` to verify the exact approved launch catalog."
  );
}

if (stripeAccount && !stripeAccount.payouts_enabled) {
  console.log(
    "\nBank handoff reached: open Stripe Dashboard > Settings > Bank accounts and currencies to add the payout account. Do not send banking details through source code or chat."
  );
}

const missingRequired = checks.some((check) => check.required && !check.passed);
process.exitCode = missingRequired ? 1 : 0;
