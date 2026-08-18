import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  storeLaunchProductIds,
  storeProductDefinitions,
} from "../../data/store/products.js";

const storeProductDefinitionsById = new Map(
  storeProductDefinitions.map((product) => [product.id, product])
);

const launchEnvironment = {
  ...process.env,
  STORE_SKIP_LOCAL_ENV: "true",
  SITE_URL: "",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-value",
  STRIPE_SECRET_KEY: "sk_test_storefront",
  STRIPE_WEBHOOK_SECRET: "whsec_storefront_test_value",
  STRIPE_PAYMENT_METHOD_CONFIGURATION_ID: "pmc_test_synchronous",
  STORE_ADMIN_TOKEN: "test-admin-token-that-is-at-least-32-characters",
  RESEND_API_KEY: "re_storefront_test_value",
  EMAIL_FROM: "SeaPals <maker@seapalstcg.com>",
  STORE_ORDER_NOTIFICATION_ENABLED: "true",
  STORE_ORDER_NOTIFICATION_EMAIL: "maker@seapalstcg.com",
  STORE_ORDER_NOTIFICATION_DELIVERY_CONFIRMED: "true",
  STORE_CHECKOUT_ENABLED: "false",
  STORE_AVAILABLE_PRODUCT_IDS: storeLaunchProductIds.join(","),
  STORE_TAX_REGISTRATION_CONFIRMED: "false",
  STRIPE_AUTOMATIC_TAX: "false",
  STORE_EXPEDITED_PRODUCTION_ENABLED: "false",
  STORE_EXPEDITED_PRODUCTION_CENTS: "1000",
  STORE_EXPEDITED_PRODUCTION_DAILY_ORDER_LIMIT: "10",
  STORE_EXPEDITED_PRODUCTION_TIME_ZONE: "America/New_York",
  STRIPE_PRODUCTION_TAX_CODE: "txcd_92010004",
  STORE_EXPEDITED_PRODUCTION_CAPACITY_CONFIRMED: "false",
  STRIPE_ALLOW_PROMOTION_CODES: "false",
  STORE_LOCAL_PICKUP_ENABLED: "false",
  STORE_PICKUP_TAX_CONFIRMED: "false",
  STRIPE_PICKUP_TAX_RATE_ID: "",
  STORE_STANDARD_SHIPPING_CENTS: "1000",
  STORE_PRIORITY_SHIPPING_CENTS: "1500",
  STORE_LARGE_STANDARD_SHIPPING_CENTS: "2000",
  STORE_LARGE_PRIORITY_SHIPPING_CENTS: "3500",
};

const onlineFetchMock = String.raw`
const fixtures = JSON.parse(process.env.STORE_READINESS_FIXTURES);

globalThis.fetch = async (input) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  let payload;

  if (url.hostname === "api.stripe.com" && url.pathname === "/v1/account") {
    payload = fixtures.account;
  } else if (
    url.hostname === "api.stripe.com" &&
    url.pathname === "/v1/tax/settings"
  ) {
    payload = fixtures.taxSettings;
  } else if (
    url.hostname === "api.stripe.com" &&
    url.pathname === "/v1/tax/registrations" &&
    url.searchParams.get("status") === "active"
  ) {
    payload = {
      object: "list",
      data: fixtures.taxRegistrations,
      has_more: false,
    };
  } else if (
    url.hostname === "api.stripe.com" &&
    url.pathname.startsWith("/v1/payment_method_configurations/")
  ) {
    payload = fixtures.paymentMethodConfiguration;
  } else if (
    url.hostname === "api.stripe.com" &&
    url.pathname.startsWith("/v1/tax_rates/")
  ) {
    payload = fixtures.pickupTaxRate;
  } else if (
    url.hostname === "example.supabase.co" &&
    url.pathname === "/rest/v1/rpc/check_store_inventory_contract_v6"
  ) {
    payload = fixtures.supabaseInventoryContract;
  } else if (
    url.hostname === "example.supabase.co" &&
    url.pathname === "/rest/v1/store_inventory"
  ) {
    payload = fixtures.supabaseInventory;
  } else if (url.hostname === "example.supabase.co") {
    payload = [];
  } else {
    return new Response(JSON.stringify({ error: "unexpected request" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  if (payload?.__mockStatus) {
    const { __mockStatus, ...body } = payload;
    return new Response(JSON.stringify(body), {
      status: __mockStatus,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

await import("./scripts/check-store-readiness.mjs");
`;

function runLaunchCheck(overrides = {}) {
  return spawnSync(
    process.execPath,
    ["scripts/check-store-readiness.mjs", "--launch-catalog"],
    {
      cwd: process.cwd(),
      env: { ...launchEnvironment, ...overrides },
      encoding: "utf8",
    }
  );
}

function readLiveCatalogConfiguration(overrides = {}) {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      'const { getStoreConfiguration } = await import("./src/lib/store/catalog.js"); process.stdout.write(JSON.stringify(getStoreConfiguration()));',
    ],
    {
      cwd: process.cwd(),
      env: {
        ...launchEnvironment,
        STRIPE_SECRET_KEY: "rk_live_storefront",
        STORE_CHECKOUT_ENABLED: "true",
        STORE_TAX_REGISTRATION_CONFIRMED: "true",
        STORE_CATALOG_CONFIRMED: "true",
        STORE_SHIPPING_RATES_CONFIRMED: "true",
        STORE_SYNCHRONOUS_PAYMENT_METHODS_CONFIRMED: "true",
        STORE_EXPEDITED_PRODUCTION_ENABLED: "true",
        STORE_EXPEDITED_PRODUCTION_CAPACITY_CONFIRMED: "true",
        STRIPE_AUTOMATIC_TAX: "true",
        STRIPE_GAME_PRODUCT_TAX_CODE: "txcd_99999999",
        STRIPE_SHIPPING_TAX_CODE: "txcd_92010001",
        ...overrides,
      },
      encoding: "utf8",
    }
  );

  assert.equal(result.status, 0, result.stdout + result.stderr);
  return JSON.parse(result.stdout);
}

function runOnlineLiveCheck(fixtureOverrides = {}, environmentOverrides = {}) {
  const fixtures = {
    account: {
      details_submitted: true,
      charges_enabled: true,
      payouts_enabled: true,
    },
    taxSettings: { status: "active", livemode: true },
    taxRegistrations: [
      {
        id: "taxreg_fixture",
        status: "active",
        livemode: true,
        country: "US",
        country_options: {
          us: { state: "PA", type: "state_sales_tax" },
        },
      },
    ],
    supabaseInventoryContract: true,
    supabaseInventory: storeLaunchProductIds.map((productId) => ({
      sku: storeProductDefinitionsById.get(productId).sku,
      on_hand_quantity: 0,
      reserved_quantity: 0,
    })),
    paymentMethodConfiguration: {
      id: "pmc_test_synchronous",
      active: true,
      livemode: true,
    },
    pickupTaxRate: {
      id: "txr_live_elverson_pa",
      active: true,
      inclusive: false,
      percentage: 6,
      country: "US",
      state: "PA",
      livemode: true,
    },
    ...fixtureOverrides,
  };

  return spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", onlineFetchMock, "--", "--online"],
    {
      cwd: process.cwd(),
      env: {
        ...launchEnvironment,
        SITE_URL: "https://seapalstcg.example",
        NEXT_PUBLIC_SITE_URL: "",
        STRIPE_SECRET_KEY: "rk_live_storefront",
        STORE_TAX_REGISTRATION_CONFIRMED: "true",
        STORE_CATALOG_CONFIRMED: "true",
        STORE_SHIPPING_RATES_CONFIRMED: "true",
        STORE_LOCAL_PICKUP_ENABLED: "true",
        STORE_PICKUP_TAX_CONFIRMED: "true",
        STRIPE_PICKUP_TAX_RATE_ID: "txr_live_elverson_pa",
        STORE_SYNCHRONOUS_PAYMENT_METHODS_CONFIRMED: "true",
        STORE_EXPEDITED_PRODUCTION_ENABLED: "true",
        STORE_EXPEDITED_PRODUCTION_CENTS: "1000",
        STORE_EXPEDITED_PRODUCTION_DAILY_ORDER_LIMIT: "10",
        STORE_EXPEDITED_PRODUCTION_TIME_ZONE: "America/New_York",
        STRIPE_PRODUCTION_TAX_CODE: "txcd_92010004",
        STORE_EXPEDITED_PRODUCTION_CAPACITY_CONFIRMED: "true",
        STRIPE_AUTOMATIC_TAX: "true",
        STRIPE_PRODUCT_TAX_CODE: "txcd_99999999",
        STRIPE_SHIPPING_TAX_CODE: "txcd_92010001",
        STORE_READINESS_FIXTURES: JSON.stringify(fixtures),
        ...environmentOverrides,
      },
      encoding: "utf8",
    }
  );
}

test("launch readiness accepts the exact nine approved products while checkout is off", () => {
  const result = runLaunchCheck();

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /PASS.*Exact approved launch allowlist/);
  assert.match(result.stdout, /PASS.*Approved launch prices/);
  assert.match(result.stdout, /INFO.*Checkout launch switch/);
});

test("launch readiness names a missing approved product", () => {
  const result = runLaunchCheck({
    STORE_AVAILABLE_PRODUCT_IDS: storeLaunchProductIds
      .filter((productId) => productId !== "blue-water")
      .join(","),
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Exact approved launch allowlist/);
  assert.match(result.stdout, /blue-water/);
});

test("launch readiness rejects prepared products outside the approved allowlist", () => {
  const result = runLaunchCheck({
    STORE_AVAILABLE_PRODUCT_IDS: `${storeLaunchProductIds.join(",")},conditions-deck`,
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Exact approved launch allowlist/);
  assert.match(result.stdout, /Remove non-launch products: conditions-deck/);
});

test("launch readiness rejects a deck price that differs from the approved $22", () => {
  const result = runLaunchCheck({ STORE_PRICE_BLUE_WATER_CENTS: "2199" });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Approved launch prices/);
  assert.match(result.stdout, /blue-water/);
});

test("launch readiness rejects an Accessories Kit price other than $12", () => {
  const result = runLaunchCheck({ STORE_PRICE_ACCESSORY_SET_CENTS: "1199" });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Approved launch prices/);
  assert.match(result.stdout, /accessory-set/);
});

test("launch readiness rejects a Starter Kit price other than $44", () => {
  const result = runLaunchCheck({ STORE_PRICE_STARTER_KIT_CENTS: "4399" });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Approved launch prices/);
  assert.match(result.stdout, /starter-kit/);
});

test("launch readiness requires every owner-approved shipping tier", () => {
  const result = runLaunchCheck({
    STORE_LARGE_PRIORITY_SHIPPING_CENTS: "3499",
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Shipping options/);
  assert.match(result.stdout, /1000\/1500 cents through one pound/);
  assert.match(result.stdout, /2000\/3500 cents over one through eight pounds/);
});

test("automatic tax remains blocked without government registration confirmation", () => {
  const result = runLaunchCheck({
    STRIPE_AUTOMATIC_TAX: "true",
    STRIPE_PRODUCT_TAX_CODE: "txcd_99999999",
    STRIPE_SHIPPING_TAX_CODE: "txcd_92010001",
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Tax registration launch gate/);
});

test("live launch readiness requires Stripe automatic tax", () => {
  const result = runLaunchCheck({
    SITE_URL: "https://seapalstcg.example",
    NEXT_PUBLIC_SITE_URL: "",
    STRIPE_SECRET_KEY: "rk_live_storefront",
    STORE_TAX_REGISTRATION_CONFIRMED: "true",
    STORE_SHIPPING_RATES_CONFIRMED: "true",
    STRIPE_AUTOMATIC_TAX: "false",
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Live Stripe automatic tax/);
});

test("live launch readiness requires owner-confirmed catalog", () => {
  const result = runLaunchCheck({
    SITE_URL: "https://seapalstcg.example",
    NEXT_PUBLIC_SITE_URL: "",
    STRIPE_SECRET_KEY: "rk_live_storefront",
    STORE_TAX_REGISTRATION_CONFIRMED: "true",
    STORE_SHIPPING_RATES_CONFIRMED: "true",
    STRIPE_AUTOMATIC_TAX: "true",
    STRIPE_PRODUCT_TAX_CODE: "txcd_99999999",
    STRIPE_SHIPPING_TAX_CODE: "txcd_92010001",
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Owner-confirmed launch catalog/);
});

test("live launch readiness requires owner-confirmed synchronous payment methods", () => {
  const result = runLaunchCheck({
    SITE_URL: "https://seapalstcg.example",
    NEXT_PUBLIC_SITE_URL: "",
    STRIPE_SECRET_KEY: "rk_live_storefront",
    STORE_TAX_REGISTRATION_CONFIRMED: "true",
    STORE_CATALOG_CONFIRMED: "true",
    STORE_SHIPPING_RATES_CONFIRMED: "true",
    STRIPE_AUTOMATIC_TAX: "true",
    STRIPE_PRODUCT_TAX_CODE: "txcd_99999999",
    STRIPE_SHIPPING_TAX_CODE: "txcd_92010001",
    STORE_SYNCHRONOUS_PAYMENT_METHODS_CONFIRMED: "false",
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Owner-confirmed synchronous payment methods/);
});

test("an enabled live switch fails when an owner launch gate is missing", () => {
  const result = runLaunchCheck({
    SITE_URL: "https://seapalstcg.example",
    NEXT_PUBLIC_SITE_URL: "",
    STRIPE_SECRET_KEY: "rk_live_storefront",
    STORE_CHECKOUT_ENABLED: "true",
    STORE_TAX_REGISTRATION_CONFIRMED: "true",
    STORE_CATALOG_CONFIRMED: "false",
    STORE_SHIPPING_RATES_CONFIRMED: "true",
    STRIPE_AUTOMATIC_TAX: "true",
    STRIPE_PRODUCT_TAX_CODE: "txcd_99999999",
    STRIPE_SHIPPING_TAX_CODE: "txcd_92010001",
    STORE_SYNCHRONOUS_PAYMENT_METHODS_CONFIRMED: "true",
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Live launch gate/);
});

test("readiness fails closed when Stripe promotion codes are enabled", () => {
  const result = runLaunchCheck({ STRIPE_ALLOW_PROMOTION_CODES: "true" });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Promotion codes disabled/);
});

test("readiness fails closed without a synchronous payment-method configuration", () => {
  const result = runLaunchCheck({
    STRIPE_PAYMENT_METHOD_CONFIGURATION_ID: "",
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Synchronous payment-method configuration/);
});

test("live readiness requires owner-confirmed one-day expedited capacity", () => {
  const result = runLaunchCheck({
    SITE_URL: "https://seapalstcg.example",
    NEXT_PUBLIC_SITE_URL: "",
    STRIPE_SECRET_KEY: "rk_live_storefront",
    STORE_TAX_REGISTRATION_CONFIRMED: "true",
    STORE_CATALOG_CONFIRMED: "true",
    STORE_SHIPPING_RATES_CONFIRMED: "true",
    STORE_SYNCHRONOUS_PAYMENT_METHODS_CONFIRMED: "true",
    STRIPE_AUTOMATIC_TAX: "true",
    STRIPE_PRODUCT_TAX_CODE: "txcd_99999999",
    STRIPE_SHIPPING_TAX_CODE: "txcd_92010001",
    STORE_EXPEDITED_PRODUCTION_ENABLED: "true",
    STORE_EXPEDITED_PRODUCTION_CAPACITY_CONFIRMED: "false",
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stdout,
    /TODO.*Owner-confirmed expedited production capacity/
  );
});

test("enabled expedited production requires the approved ten-dollar fee", () => {
  const result = runLaunchCheck({
    STORE_EXPEDITED_PRODUCTION_ENABLED: "true",
    STORE_EXPEDITED_PRODUCTION_CENTS: "999",
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Expedited production fee/);
});

test("enabled expedited production requires Stripe's exact handling tax code", () => {
  const result = runLaunchCheck({
    STORE_EXPEDITED_PRODUCTION_ENABLED: "true",
    STRIPE_PRODUCTION_TAX_CODE: "txcd_99999999",
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stdout,
    /TODO.*Expedited production handling tax code/
  );
});

test("enabled expedited production requires the hard ten-order daily limit", () => {
  const result = runLaunchCheck({
    STORE_EXPEDITED_PRODUCTION_ENABLED: "true",
    STORE_EXPEDITED_PRODUCTION_DAILY_ORDER_LIMIT: "9",
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stdout,
    /TODO.*Expedited production daily order limit/
  );
});

test("enabled expedited production requires the Eastern production time zone", () => {
  const result = runLaunchCheck({
    STORE_EXPEDITED_PRODUCTION_ENABLED: "true",
    STORE_EXPEDITED_PRODUCTION_TIME_ZONE: "UTC",
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Expedited production time zone/);
});

test("live catalog checkout fails closed unless the rush-capacity contract is exact", () => {
  const ready = readLiveCatalogConfiguration();

  assert.equal(ready.checkoutEnabled, true);
  assert.equal(ready.expeditedProductionDailyOrderLimit, 10);
  assert.equal(ready.expeditedProductionTimeZone, "America/New_York");

  for (const override of [
    { STORE_EXPEDITED_PRODUCTION_CAPACITY_CONFIRMED: "false" },
    { STORE_EXPEDITED_PRODUCTION_DAILY_ORDER_LIMIT: "9" },
    { STORE_EXPEDITED_PRODUCTION_TIME_ZONE: "UTC" },
  ]) {
    assert.equal(readLiveCatalogConfiguration(override).checkoutEnabled, false);
  }
});

test("online live readiness verifies active Stripe Tax settings and PA registration", () => {
  const result = runOnlineLiveCheck();

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /PASS.*Stripe Tax settings API/);
  assert.match(result.stdout, /PASS.*Stripe Tax registrations API/);
  assert.match(result.stdout, /PASS.*Live Stripe Tax settings active/);
  assert.match(result.stdout, /PASS.*Live Pennsylvania Stripe Tax registration/);
  assert.match(result.stdout, /PASS.*Stripe payment-method configuration identity/);
  assert.match(result.stdout, /PASS.*Stripe Elverson pickup tax rate/);
  assert.match(result.stdout, /PASS.*Supabase order inventory columns/);
  assert.match(result.stdout, /PASS.*Supabase inventory table/);
  assert.match(result.stdout, /PASS.*Supabase inventory RPC contract/);
});

test("readiness requires lease-backed paid-order merchant alerts", () => {
  const result = runLaunchCheck({ STORE_ORDER_NOTIFICATION_ENABLED: "false" });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Paid-order merchant notifications/);
});

test("live checkout requires a successfully delivered merchant alert", () => {
  const configuration = readLiveCatalogConfiguration({
    STORE_ORDER_NOTIFICATION_DELIVERY_CONFIRMED: "false",
  });
  assert.equal(configuration.orderNotificationDeliveryConfirmed, false);
  assert.equal(configuration.checkoutEnabled, false);

  const result = runLaunchCheck({
    STRIPE_SECRET_KEY: "rk_live_storefront",
    STORE_ORDER_NOTIFICATION_DELIVERY_CONFIRMED: "false",
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Paid-order alert delivery confirmation/);
});

test("enabled pickup fails closed without an owner-confirmed Stripe Tax Rate", () => {
  const result = runLaunchCheck({
    STORE_LOCAL_PICKUP_ENABLED: "true",
    STORE_PICKUP_TAX_CONFIRMED: "false",
    STRIPE_PICKUP_TAX_RATE_ID: "",
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Elverson pickup manual tax rate/);
});

test("online readiness rejects the wrong fixed pickup Tax Rate", () => {
  const result = runOnlineLiveCheck({
    pickupTaxRate: {
      id: "txr_live_elverson_pa",
      active: true,
      inclusive: false,
      percentage: 8,
      country: "US",
      state: "PA",
      livemode: true,
    },
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Stripe Elverson pickup tax rate/);
});

test("online readiness fails closed without the inventory RPC contract", () => {
  const result = runOnlineLiveCheck({
    supabaseInventoryContract: {
      __mockStatus: 500,
      error: "do-not-print-provider-payload",
    },
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Supabase inventory RPC contract/);
  assert.doesNotMatch(result.stdout + result.stderr, /do-not-print-provider-payload/);
});

test("online readiness fails closed when an enabled SKU has no inventory row", () => {
  const missingProductId = "blue-water";
  const missingSku = storeProductDefinitionsById.get(missingProductId).sku;
  const inventory = storeLaunchProductIds
    .filter((productId) => productId !== missingProductId)
    .map((productId) => ({
      sku: storeProductDefinitionsById.get(productId).sku,
      on_hand_quantity: 0,
      reserved_quantity: 0,
    }));
  const result = runOnlineLiveCheck({ supabaseInventory: inventory });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Supabase inventory table/);
  assert.match(result.stdout, new RegExp(`${missingProductId}.*${missingSku}`));
});

test("online live readiness rejects inactive Stripe Tax settings", () => {
  const result = runOnlineLiveCheck({
    taxSettings: { status: "pending", livemode: true },
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Live Stripe Tax settings active/);
});

test("online live readiness requires an exact active US PA sales-tax registration", () => {
  const result = runOnlineLiveCheck({
    taxRegistrations: [
      {
        id: "taxreg_fixture",
        status: "active",
        livemode: true,
        country: "US",
        country_options: {
          us: { state: "NJ", type: "state_sales_tax" },
        },
      },
    ],
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Live Pennsylvania Stripe Tax registration/);
});

test("online Stripe Tax failures do not print provider payloads", () => {
  const sensitiveMarker = "taxreg_sensitive_fixture";
  const result = runOnlineLiveCheck({
    taxSettings: {
      __mockStatus: 403,
      error: { message: `denied for ${sensitiveMarker}` },
    },
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Stripe Tax settings API/);
  assert.doesNotMatch(result.stdout, new RegExp(sensitiveMarker));
  assert.doesNotMatch(result.stderr, new RegExp(sensitiveMarker));
});
