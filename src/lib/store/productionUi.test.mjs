import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [storefront, success, admin, shipping, terms] = await Promise.all(
  [
    "../../app/store/Storefront.jsx",
    "../../app/store/success/page.jsx",
    "../../app/admin/orders/OrdersDashboard.jsx",
    "../../data/store/shipping.js",
    "../../app/terms/page.jsx",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8"))
);

test("the storefront keeps production speed independent from shipping or pickup", () => {
  assert.match(storefront, /productionOptions/);
  assert.match(storefront, /defaultProductionOptionId/);
  assert.match(storefront, /id: "standard-production"/);
  assert.match(storefront, /option\.id === "expedited-production"/);
  const fallbackBlock = storefront.slice(
    storefront.indexOf("const FALLBACK_PRODUCTION_OPTIONS"),
    storefront.indexOf("const CATEGORY_ORDER")
  );
  assert.doesNotMatch(fallbackBlock, /expedited-production/);
  assert.match(storefront, /name="production-option"/);
  assert.match(storefront, /name="fulfillment-option"/);
  assert.match(storefront, /productionOptionId: selectedProductionOption\.id/);
  assert.match(
    storefront,
    /subtotalCents \+ normalizedProductionCents \+ normalizedShippingCents/
  );
  assert.match(storefront, /Production speed/);
  assert.match(storefront, /per order/);
  assert.match(storefront, /Carrier transit time is additional/);
  assert.match(storefront, /will be offered when ordering opens/);
  assert.match(storefront, /It is not a\s+delivery estimate/);
  assert.match(storefront, /expeditedProductionDailyOrderLimit/);
  assert.match(storefront, /expeditedProductionTimeZone/);
  assert.match(storefront, /subject to server-confirmed availability/);
  assert.match(storefront, /Selecting it does not reserve a rush slot/);
});

test("carrier choices explain that they follow production", () => {
  assert.match(shipping, /Economy carrier service after production/);
  assert.match(shipping, /estimated 2–7 business days in transit/);
  assert.match(shipping, /USPS Priority Mail after production/);
  assert.match(shipping, /estimated 2–3 business days in transit/);
  assert.match(shipping, /This does not change production time/);
  assert.match(shipping, /Free scheduled pickup/);
  assert.match(shipping, /email after your order is built to arrange a pickup time/);
});

test("the storefront previews the same weight tier enforced by the server", () => {
  assert.match(storefront, /resolveStoreShippingRateTier/);
  assert.match(storefront, /STORE_MAX_CART_QUANTITY/);
  assert.match(storefront, /STORE_MAX_PER_PRODUCT_QUANTITY/);
  assert.match(storefront, /product\.shippingWeightOunces/);
  assert.match(storefront, /cartShippingWeightOunces/);
  assert.match(storefront, /productCategories: cartProductCategories/);
  assert.match(storefront, /selectedShippingRateTier\?\.amountCents/);
  assert.match(storefront, /Large-parcel rate applies above 1 lb through 8 lb/);
  assert.match(storefront, /Dive Pack-only rate applies through 1 lb/);
  assert.match(storefront, /Base rate applies through 1 lb/);
  assert.match(shipping, /exclusiveProductCategory/);
  assert.doesNotMatch(storefront, /const MAX_CART_QUANTITY = 20/);
});

test("scheduled pickup is arranged privately after production", () => {
  const fulfillmentStart = storefront.indexOf('name="fulfillment-option"');
  const fulfillmentEnd = storefront.indexOf("</fieldset>", fulfillmentStart);
  assert.ok(fulfillmentStart >= 0);
  assert.ok(fulfillmentEnd > fulfillmentStart);
  const fulfillmentSelection = storefront.slice(
    fulfillmentStart,
    fulfillmentEnd
  );

  assert.match(fulfillmentSelection, /Free scheduled pickup in Elverson, PA/);
  assert.match(
    fulfillmentSelection,
    /After your\s+order is built, we will email you to arrange a\s+pickup time/
  );
  assert.match(
    fulfillmentSelection,
    /You do not choose a pickup time during\s+checkout/
  );
  assert.match(success, /No pickup time has been\s+scheduled yet/);
  assert.match(success, /privately\s+share the pickup instructions/);
  assert.match(admin, /record the agreed time in\s+Internal notes/);
  assert.match(admin, /Internal notes — pickup schedule/);
  assert.match(admin, /Set Ready for pickup after the order is built/);
  assert.match(admin, /Email customer to arrange pickup/);
  assert.match(terms, /No pickup\s+appointment is selected or confirmed during checkout/);
  assert.match(terms, /privately provide the pickup address and instructions/);

  for (const publicView of [storefront, success, terms]) {
    assert.doesNotMatch(publicView, /26\s+(?:E(?:ast)?\.?\s+)?Main\s+St/i);
  }
});

test("confirmation and staff views preserve the production snapshot", () => {
  for (const field of [
    "production_option_id",
    "production_option_name",
    "production_max_business_days",
    "production_cents",
  ]) {
    assert.match(success, new RegExp(field));
    assert.match(admin, new RegExp(field));
  }

  assert.match(success, /Shipping or pickup/);
  assert.match(success, /Carrier transit is separate/);
  assert.match(admin, /Rush · 1 business day/i);
  assert.match(admin, /Production fee/);
  assert.match(admin, /Rush production orders/);
  assert.match(admin, /rush-orders"\) \{[\s\S]*firstTime - secondTime/);
  assert.match(admin, /Production Max Business Days/);
  assert.match(admin, /production_due_date/);
  assert.match(admin, /expedited_capacity_state/);
});

test("the rush queue uses server due dates and New York production-day semantics", () => {
  assert.match(admin, /const STORE_TIME_ZONE = "America\/New_York"/);
  assert.match(admin, /function newYorkDateKey/);
  assert.match(admin, /function productionDueDateKey/);
  assert.match(admin, /function isActionablePaidRush/);
  assert.match(admin, /function productionDueState/);
  assert.match(admin, /Overdue · due/);
  assert.match(admin, /Due today/);
  assert.match(admin, /Capacity: \{capacityStateLabel\}/);
  assert.match(admin, /firstDueDate\.localeCompare\(secondDueDate\)/);
  assert.match(admin, /return firstTime - secondTime/);
  assert.doesNotMatch(admin, /addBusinessDays|setUTCDate\(|setDate\(/);
});

test("purchase terms disclose the ten-order daily rush limit", () => {
  assert.match(terms, /limited to ten orders per SeaPals\s+production day/);
  assert.match(terms, /server-confirmed availability/);
});
