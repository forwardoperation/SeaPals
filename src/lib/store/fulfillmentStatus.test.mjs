import assert from "node:assert/strict";
import test from "node:test";

import {
  STORE_FULFILLMENT_STATUS_VALUES,
  isFulfillmentStatusAllowedForMethod,
  isPaidFulfillmentAdvancement,
  isShippingQueueStatus,
  isStoreFulfillmentStatus,
  storeFulfillmentStatusLabel,
} from "./fulfillmentStatus.mjs";

test("fulfillment statuses expose the complete production workflow", () => {
  assert.deepEqual(STORE_FULFILLMENT_STATUS_VALUES, [
    "unfulfilled",
    "in_production",
    "packing",
    "awaiting_shipment",
    "ready_for_pickup",
    "picked_up",
    "on_hold",
    "shipped",
    "cancelled",
  ]);
  assert.equal(storeFulfillmentStatusLabel("unfulfilled"), "Awaiting production");
  assert.equal(storeFulfillmentStatusLabel("in_production"), "In production");
  assert.equal(storeFulfillmentStatusLabel("awaiting_shipment"), "Awaiting shipment");
  assert.equal(storeFulfillmentStatusLabel("packing", "pickup"), "Packing for pickup");
});

test("shipping and pickup workflows reject each other's terminal path", () => {
  assert.equal(isFulfillmentStatusAllowedForMethod("awaiting_shipment", "shipping"), true);
  assert.equal(isFulfillmentStatusAllowedForMethod("awaiting_shipment", "pickup"), false);
  assert.equal(isFulfillmentStatusAllowedForMethod("ready_for_pickup", "pickup"), true);
  assert.equal(isFulfillmentStatusAllowedForMethod("ready_for_pickup", "shipping"), false);
  assert.equal(isFulfillmentStatusAllowedForMethod("in_production", "shipping"), true);
  assert.equal(isFulfillmentStatusAllowedForMethod("in_production", "pickup"), true);
  assert.equal(isFulfillmentStatusAllowedForMethod("not_real", "shipping"), false);
});

test("only fully paid orders may advance into active work states", () => {
  for (const status of [
    "in_production",
    "packing",
    "awaiting_shipment",
    "ready_for_pickup",
    "picked_up",
    "shipped",
  ]) {
    assert.equal(isPaidFulfillmentAdvancement(status), true, status);
  }
  assert.equal(isPaidFulfillmentAdvancement("unfulfilled"), false);
  assert.equal(isPaidFulfillmentAdvancement("on_hold"), false);
});

test("the shipping queue includes every paid pre-shipment stage", () => {
  for (const status of [
    "unfulfilled",
    "in_production",
    "packing",
    "awaiting_shipment",
  ]) {
    assert.equal(isShippingQueueStatus(status), true, status);
  }
  for (const status of ["on_hold", "cancelled", "shipped", "ready_for_pickup"]) {
    assert.equal(isShippingQueueStatus(status), false, status);
  }
  assert.equal(isStoreFulfillmentStatus("awaiting_shipment"), true);
  assert.equal(isStoreFulfillmentStatus("not_real"), false);
});
