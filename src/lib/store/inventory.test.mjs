import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStoreOrderReservationArguments,
  createInventoryReservationDeadline,
  expeditedCapacityReservationIsUnavailable,
  inventoryReservationIsUnavailable,
  parseCheckoutRequestStorage,
  parseStoreOrderReservationResult,
  serializeCheckoutRequestStorage,
} from "./inventory.mjs";

test("inventory reservations use the same one-hour deadline for the ledger and Stripe", () => {
  assert.equal(
    createInventoryReservationDeadline(Date.parse("2026-08-13T12:00:00.000Z")),
    "2026-08-13T13:00:00.000Z"
  );
  assert.throws(
    () => createInventoryReservationDeadline(Number.NaN),
    /must be finite/
  );
});

test("reservation RPC arguments retain immutable order item snapshots", () => {
  const argumentsPayload = buildStoreOrderReservationArguments({
    orderId: "00000000-0000-4000-8000-000000000001",
    orderNumber: "SP-260813-ABC123",
    currency: "usd",
    paymentLivemode: true,
    checkoutRequestId: "00000000-0000-4000-8000-000000000099",
    inventoryReservedUntil: "2026-08-13T13:00:00.000Z",
    quote: {
      subtotalCents: 4400,
      productionOptionId: "expedited-production",
      productionOptionName: "Expedited production",
      productionMaxBusinessDays: 1,
      productionCents: 1000,
      fulfillmentMethod: "pickup",
      fulfillmentOptionId: "pickup-elverson-pa",
      fulfillmentOptionName: "Local pickup - Elverson, PA",
      pickupLocation: "Elverson, PA",
      shippingCents: 0,
      totalCents: 5400,
      items: [
        {
          productId: "starter-kit",
          category: "starter-kits",
          sku: "SP-KIT-STARTER",
          deckId: null,
          name: "Starter Kit",
          unitAmountCents: 4400,
          quantity: 1,
          lineTotalCents: 4400,
        },
      ],
    },
  });

  assert.deepEqual(argumentsPayload.p_items, [
    {
      product_id: "starter-kit",
      product_category: "starter-kits",
      sku: "SP-KIT-STARTER",
      deck_id: null,
      product_name: "Starter Kit",
      unit_amount_cents: 4400,
      quantity: 1,
      line_total_cents: 4400,
    },
  ]);
  assert.equal(argumentsPayload.p_inventory_reserved_until, "2026-08-13T13:00:00.000Z");
  assert.equal(argumentsPayload.p_payment_livemode, true);
  assert.equal(argumentsPayload.p_production_option_id, "expedited-production");
  assert.equal(argumentsPayload.p_production_option_name, "Expedited production");
  assert.equal(argumentsPayload.p_production_max_business_days, 1);
  assert.equal(argumentsPayload.p_production_cents, 1000);
  assert.equal(
    argumentsPayload.p_checkout_request_id,
    "00000000-0000-4000-8000-000000000099"
  );
});

test("reservation results must echo the exact server-generated order and deadline", () => {
  const expected = {
    orderId: "00000000-0000-4000-8000-000000000001",
    orderNumber: "SP-260813-ABC123",
    inventoryReservedUntil: "2026-08-13T13:00:00.000Z",
    productionOptionId: "expedited-production",
  };

  assert.deepEqual(
    parseStoreOrderReservationResult(
      {
        id: expected.orderId,
        order_number: expected.orderNumber,
        inventory_reserved_until: expected.inventoryReservedUntil,
        inventory_state: "reserved",
        production_due_date: "2026-08-14",
        expedited_capacity_state: "reserved",
        created: true,
        checkout_session_id: "cs_test_existing",
        checkout_url: "https://checkout.stripe.com/test",
      },
      expected
    ),
    {
      id: expected.orderId,
      orderNumber: expected.orderNumber,
      inventoryReservationExpiresAt: expected.inventoryReservedUntil,
      created: true,
      inventoryState: "reserved",
      productionDueDate: "2026-08-14",
      expeditedCapacityState: "reserved",
      checkoutSessionId: "cs_test_existing",
      checkoutUrl: "https://checkout.stripe.com/test",
    }
  );
  assert.deepEqual(
    parseStoreOrderReservationResult(
      {
        id: "00000000-0000-4000-8000-000000000002",
        order_number: "SP-260813-REPLAY",
        inventory_reserved_until: "2026-08-13T12:45:00.000Z",
        inventory_state: "reserved",
        production_due_date: "2026-08-14",
        expedited_capacity_state: "reserved",
        created: false,
        checkout_session_id: "cs_test_replay",
        checkout_url: "https://checkout.stripe.com/replay",
      },
      expected
    ),
    {
      id: "00000000-0000-4000-8000-000000000002",
      orderNumber: "SP-260813-REPLAY",
      inventoryReservationExpiresAt: "2026-08-13T12:45:00.000Z",
      created: false,
      inventoryState: "reserved",
      productionDueDate: "2026-08-14",
      expeditedCapacityState: "reserved",
      checkoutSessionId: "cs_test_replay",
      checkoutUrl: "https://checkout.stripe.com/replay",
    }
  );

  assert.throws(
    () =>
      parseStoreOrderReservationResult(
        {
          id: expected.orderId,
          order_number: expected.orderNumber,
          inventory_reserved_until: expected.inventoryReservedUntil,
          inventory_state: "reserved",
          production_due_date: "2026-08-14",
          expedited_capacity_state: "committed",
          checkout_session_id: null,
          checkout_url: null,
          created: true,
        },
        expected
      ),
    /reservation response was invalid/
  );

  assert.deepEqual(
    parseStoreOrderReservationResult(
      {
        id: expected.orderId,
        order_number: expected.orderNumber,
        inventory_reserved_until: expected.inventoryReservedUntil,
        inventory_state: "reserved",
        production_due_date: null,
        expedited_capacity_state: "not_applicable",
        checkout_session_id: null,
        checkout_url: null,
        created: true,
      },
      { ...expected, productionOptionId: "standard-production" }
    ),
    {
      id: expected.orderId,
      orderNumber: expected.orderNumber,
      inventoryReservationExpiresAt: expected.inventoryReservedUntil,
      created: true,
      inventoryState: "reserved",
      productionDueDate: null,
      expeditedCapacityState: "not_applicable",
      checkoutSessionId: null,
      checkoutUrl: null,
    }
  );
});

test("only the database's explicit unavailable marker becomes a sold-out response", () => {
  assert.equal(
    inventoryReservationIsUnavailable({
      message: "store_inventory_unavailable",
      details: "SKU SP-KIT-STARTER has 0 units available.",
    }),
    true
  );
  assert.equal(
    inventoryReservationIsUnavailable({
      message: "Could not find the function public.reserve_store_order_inventory",
    }),
    false
  );
});

test("only the explicit expedited marker becomes a daily rush-cap response", () => {
  assert.equal(
    expeditedCapacityReservationIsUnavailable({
      message: "store_expedited_capacity_unavailable",
      details: "Expedited production already has 10 active orders.",
    }),
    true
  );
  assert.equal(
    expeditedCapacityReservationIsUnavailable({
      message: "store_inventory_unavailable",
    }),
    false
  );
});

test("checkout request storage survives a cancel/reload but expires safely", () => {
  const now = Date.parse("2026-08-13T12:00:00.000Z");
  const request = {
    id: "00000000-0000-4000-8000-000000000099",
    fingerprint: "cart-v1",
  };
  const serialized = serializeCheckoutRequestStorage(request, now);

  assert.deepEqual(parseCheckoutRequestStorage(serialized, now + 60_000), request);
  assert.equal(
    parseCheckoutRequestStorage(serialized, now + 24 * 60 * 60 * 1000 + 1),
    null
  );
  assert.equal(parseCheckoutRequestStorage("not-json", now), null);
});
