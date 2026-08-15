import assert from "node:assert/strict";
import test from "node:test";
import { excludesAnalytics } from "./googleAnalyticsRouting.mjs";

test("analytics excludes private and checkout-result routes", () => {
  for (const pathname of [
    "/adventure",
    "/adventure/save",
    "/auth",
    "/auth/callback",
    "/store/success",
    "/store/success/details",
    "/store/cancel",
    "/store/cancel/details",
    "/admin",
    "/admin/orders",
  ]) {
    assert.equal(excludesAnalytics(pathname), true, pathname);
  }
});

test("analytics remains enabled on public storefront routes", () => {
  for (const pathname of [
    "/",
    "/store",
    "/store/products",
    "/administrator",
    "/store/successful",
    "/store/cancellation-policy",
  ]) {
    assert.equal(excludesAnalytics(pathname), false, pathname);
  }
});
