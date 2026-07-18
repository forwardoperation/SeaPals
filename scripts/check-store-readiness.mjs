import { existsSync } from "node:fs";

if (existsSync(".env.local") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env.local");
}

const online = process.argv.includes("--online");
const checks = [];

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

const stripeKey = String(process.env.STRIPE_SECRET_KEY ?? "").trim();
const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
const adminToken = String(process.env.STORE_ADMIN_TOKEN ?? "").trim();
const availableProducts = String(
  process.env.STORE_AVAILABLE_PRODUCT_IDS ??
    process.env.STORE_AVAILABLE_DECK_IDS ??
    ""
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const stripeKeyPattern = /^(?:sk|rk)_(?:test|live)_/;
const productTaxEnvironment = new Map([
  ["starter-kit", "STRIPE_GAME_PRODUCT_TAX_CODE"],
  ["blue-water", "STRIPE_GAME_PRODUCT_TAX_CODE"],
  ["disruption", "STRIPE_GAME_PRODUCT_TAX_CODE"],
  ["coral-garden", "STRIPE_GAME_PRODUCT_TAX_CODE"],
  ["darkness-shroud", "STRIPE_GAME_PRODUCT_TAX_CODE"],
  ["open-ocean-hunt", "STRIPE_GAME_PRODUCT_TAX_CODE"],
  ["murky-water", "STRIPE_GAME_PRODUCT_TAX_CODE"],
  ["stinging-fortress", "STRIPE_GAME_PRODUCT_TAX_CODE"],
  ["accessory-set", "STRIPE_GAME_PRODUCT_TAX_CODE"],
  ["reef-point-tokens", "STRIPE_GAME_PRODUCT_TAX_CODE"],
  ["dice-pack", "STRIPE_GAME_PRODUCT_TAX_CODE"],
  ["conditions-deck", "STRIPE_GAME_PRODUCT_TAX_CODE"],
  ["custom-t-shirt", "STRIPE_APPAREL_TAX_CODE"],
  ["card-binder", "STRIPE_STORAGE_TAX_CODE"],
  ["backpack", "STRIPE_STORAGE_TAX_CODE"],
  ["plush-toy", "STRIPE_PLUSH_TAX_CODE"],
]);
const invalidProductIds = availableProducts.filter(
  (productId) => !productTaxEnvironment.has(productId)
);

addCheck(
  "Public site URL",
  validSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
  "Use localhost for testing and the final HTTPS domain for the live webhook."
);
if (stripeKey.includes("_live_")) {
  addCheck(
    "Live HTTPS site URL",
    String(process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"),
    "Live checkout must use the public HTTPS domain."
  );
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

if (trueValue("STRIPE_AUTOMATIC_TAX")) {
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
}
addCheck(
  "Checkout launch switch",
  trueValue("STORE_CHECKOUT_ENABLED"),
  "Keep false until test payment, webhook, receipt, tax, and fulfillment checks pass.",
  false
);

let stripeAccount = null;

if (online && stripeKeyPattern.test(stripeKey)) {
  try {
    const response = await fetch("https://api.stripe.com/v1/account", {
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Stripe-Version": "2026-06-24.dahlia",
      },
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error?.message || "Stripe account lookup failed.");
    }

    stripeAccount = payload;
    addCheck(
      "Stripe account API",
      true,
      `${stripeKey.includes("_live_") ? "Live" : "Test"} account credentials are valid.`
    );
    addCheck(
      "Stripe details submitted",
      payload.details_submitted,
      payload.details_submitted
        ? "Business and representative details are submitted."
        : `Still due: ${(payload.requirements?.currently_due ?? []).join(", ") || "check the Stripe Dashboard"}.`
    );
    addCheck(
      "Stripe charges enabled",
      payload.charges_enabled,
      payload.charges_enabled
        ? "Stripe reports that the account can accept live charges."
        : "Finish the currently due account requirements before launch."
    );
    addCheck(
      "Stripe payouts enabled",
      payload.payouts_enabled,
      payload.payouts_enabled
        ? "Stripe reports that payouts are enabled."
        : "The bank account or another payout requirement still needs owner action."
    );
  } catch (error) {
    addCheck("Stripe account API", false, error.message);
  }
}

if (
  online &&
  present("NEXT_PUBLIC_SUPABASE_URL") &&
  present("SUPABASE_SERVICE_ROLE_KEY")
) {
  try {
    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(
      /\/$/,
      ""
    );
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const response = await fetch(
      `${supabaseUrl}/rest/v1/store_orders?select=id&limit=1`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    if (!response.ok) {
      const payload = await response.text();
      throw new Error(
        response.status === 404
          ? "Run supabase/store-orders.sql."
          : `Order-ledger check returned ${response.status}: ${payload.slice(0, 120)}`
      );
    }

    addCheck("Supabase order ledger", true, "The private orders table is reachable.");
  } catch (error) {
    addCheck("Supabase order ledger", false, error.message);
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

if (stripeAccount && !stripeAccount.payouts_enabled) {
  console.log(
    "\nBank handoff reached: open Stripe Dashboard > Settings > Bank accounts and currencies to add the payout account. Do not send banking details through source code or chat."
  );
}

const missingRequired = checks.some((check) => check.required && !check.passed);
process.exitCode = missingRequired ? 1 : 0;
