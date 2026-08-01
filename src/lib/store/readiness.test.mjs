import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { storeLaunchProductIds } from "../../data/store/products.js";

const launchEnvironment = {
  ...process.env,
  STORE_SKIP_LOCAL_ENV: "true",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-value",
  STRIPE_SECRET_KEY: "sk_test_storefront",
  STRIPE_WEBHOOK_SECRET: "whsec_storefront_test_value",
  STORE_ADMIN_TOKEN: "test-admin-token-that-is-at-least-32-characters",
  STORE_CHECKOUT_ENABLED: "false",
  STORE_AVAILABLE_PRODUCT_IDS: storeLaunchProductIds.join(","),
  STORE_TAX_REGISTRATION_CONFIRMED: "false",
  STRIPE_AUTOMATIC_TAX: "false",
};

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

test("launch readiness accepts all twelve priced products while checkout is off", () => {
  const result = runLaunchCheck();

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /PASS.*Complete twelve-product launch allowlist/);
  assert.match(result.stdout, /INFO.*Checkout launch switch/);
});

test("launch readiness names a missing approved product", () => {
  const result = runLaunchCheck({
    STORE_AVAILABLE_PRODUCT_IDS: storeLaunchProductIds
      .filter((productId) => productId !== "dice-pack")
      .join(","),
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /TODO.*Complete twelve-product launch allowlist/);
  assert.match(result.stdout, /dice-pack/);
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
