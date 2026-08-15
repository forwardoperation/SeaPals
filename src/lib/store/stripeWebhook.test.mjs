import assert from "node:assert/strict";
import test from "node:test";
import {
  eventClaimsSeaPalsOrderMetadata,
  hasStoreOrderReference,
  normalizeStripeCheckoutEvent,
  recoverStripeStoreEventOwnership,
  shouldProcessStripeStoreEvent,
} from "./stripeWebhook.mjs";

test("checkout normalization separates the signed per-order production fee", () => {
  const details = normalizeStripeCheckoutEvent({
    id: "evt_expedited",
    type: "checkout.session.completed",
    created: 1_800_000_000,
    livemode: true,
    data: {
      object: {
        id: "cs_test_expedited",
        client_reference_id: "00000000-0000-4000-8000-000000000001",
        payment_intent: "pi_test_expedited",
        payment_status: "paid",
        currency: "usd",
        amount_subtotal: 5400,
        amount_total: 6225,
        total_details: { amount_shipping: 750, amount_tax: 75 },
        metadata: {
          order_id: "00000000-0000-4000-8000-000000000001",
          production_option_id: "expedited-production",
          production_option_name: "Expedited production",
          production_max_business_days: "1",
          production_cents: "1000",
          fulfillment_method: "shipping",
          fulfillment_option_id: "standard",
          fulfillment_option_name: "Standard Shipping & Handling",
        },
      },
    },
  });

  assert.equal(details.subtotalCents, 4400);
  assert.equal(details.productionOptionId, "expedited-production");
  assert.equal(details.productionOptionName, "Expedited production");
  assert.equal(details.productionMaxBusinessDays, 1);
  assert.equal(details.productionCents, 1000);
  assert.equal(details.shippingCents, 750);
  assert.equal(details.taxCents, 75);
  assert.equal(details.totalCents, 6225);
});

test("checkout normalization fails closed when production exceeds Stripe subtotal", () => {
  const details = normalizeStripeCheckoutEvent({
    id: "evt_invalid_production",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_invalid_production",
        payment_status: "paid",
        amount_subtotal: 500,
        metadata: { production_cents: "1000" },
      },
    },
  });

  assert.equal(details.subtotalCents, null);
  assert.equal(details.productionCents, 1000);
});

test("legacy checkout sessions reconcile as the migration's standard production default", () => {
  const details = normalizeStripeCheckoutEvent({
    id: "evt_legacy_standard",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_legacy_standard",
        payment_status: "paid",
        amount_subtotal: 4400,
        metadata: {
          order_id: "00000000-0000-4000-8000-000000000001",
        },
      },
    },
  });

  assert.equal(details.subtotalCents, 4400);
  assert.equal(details.productionOptionId, "standard-production");
  assert.equal(details.productionOptionName, "Standard production");
  assert.equal(details.productionMaxBusinessDays, 5);
  assert.equal(details.productionCents, 0);
});

test("partial production metadata remains invalid instead of using legacy defaults", () => {
  const details = normalizeStripeCheckoutEvent({
    id: "evt_partial_production",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_partial_production",
        payment_status: "paid",
        amount_subtotal: 4400,
        metadata: { production_cents: "0" },
      },
    },
  });

  assert.equal(details.productionOptionId, null);
  assert.equal(details.productionOptionName, null);
  assert.equal(details.productionMaxBusinessDays, null);
  assert.equal(details.productionCents, 0);
});

const externalCheckoutEvent = {
  id: "evt_external",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_external",
      metadata: {},
      payment_intent: "pi_external",
    },
  },
};

const externalDetails = {
  orderId: null,
  checkoutSessionId: "cs_external",
  paymentIntentId: "pi_external",
  chargeId: null,
};

test("unowned Stripe events are acknowledged without entering order reconciliation", async () => {
  let lookupCount = 0;
  const shouldProcess = await shouldProcessStripeStoreEvent(
    externalCheckoutEvent,
    externalDetails,
    async () => {
      lookupCount += 1;
      return false;
    }
  );

  assert.equal(shouldProcess, false);
  assert.equal(lookupCount, 1);
});

test("events with no order metadata or provider references are ignored without a lookup", async () => {
  let lookupCount = 0;
  const shouldProcess = await shouldProcessStripeStoreEvent(
    externalCheckoutEvent,
    {
      orderId: null,
      checkoutSessionId: null,
      paymentIntentId: null,
      chargeId: null,
    },
    async () => {
      lookupCount += 1;
      return true;
    }
  );

  assert.equal(shouldProcess, false);
  assert.equal(lookupCount, 0);
});

test("malformed SeaPals order metadata remains fail-loud", async () => {
  let lookupCount = 0;
  const claimedEvent = {
    ...externalCheckoutEvent,
    data: {
      object: {
        ...externalCheckoutEvent.data.object,
        metadata: { order_id: "not-a-valid-order-id" },
      },
    },
  };

  assert.equal(eventClaimsSeaPalsOrderMetadata(claimedEvent), true);
  await assert.rejects(
    shouldProcessStripeStoreEvent(
      claimedEvent,
      externalDetails,
      async () => {
        lookupCount += 1;
        return false;
      }
    ),
    /invalid SeaPals order metadata/
  );
  assert.equal(lookupCount, 0);
});

test("valid SeaPals order metadata always enters reconciliation", async () => {
  const orderId = "00000000-0000-4000-8000-000000000001";
  const claimedEvent = {
    ...externalCheckoutEvent,
    data: {
      object: {
        ...externalCheckoutEvent.data.object,
        metadata: { order_id: orderId, order_number: "SP-TEST" },
      },
    },
  };
  let lookupCount = 0;

  const shouldProcess = await shouldProcessStripeStoreEvent(
    claimedEvent,
    { ...externalDetails, orderId },
    async () => {
      lookupCount += 1;
      return false;
    }
  );

  assert.equal(shouldProcess, true);
  assert.equal(lookupCount, 0);
});

test("saved Stripe references keep untagged events on the reconciliation path", async () => {
  const shouldProcess = await shouldProcessStripeStoreEvent(
    externalCheckoutEvent,
    externalDetails,
    async (details) => details.checkoutSessionId === "cs_external"
  );

  assert.equal(hasStoreOrderReference(externalDetails), true);
  assert.equal(shouldProcess, true);
});

test("ownership lookup failures remain retryable instead of acknowledging the event", async () => {
  await assert.rejects(
    shouldProcessStripeStoreEvent(
      externalCheckoutEvent,
      externalDetails,
      async () => {
        throw new Error("ledger unavailable");
      }
    ),
    /ledger unavailable/
  );
});

test("an out-of-order dispute recovers SeaPals ownership from its Charge", async () => {
  const dispute = {
    id: "evt_dispute",
    type: "charge.dispute.created",
    data: {
      object: {
        id: "dp_test",
        charge: "ch_test_dispute",
        metadata: {},
      },
    },
  };
  const details = {
    orderId: null,
    checkoutSessionId: null,
    paymentIntentId: null,
    chargeId: "ch_test_dispute",
  };

  const recovered = await recoverStripeStoreEventOwnership(
    dispute,
    details,
    async () => ({
      chargeId: "ch_test_dispute",
      paymentIntentId: "pi_test_dispute",
      orderId: "00000000-0000-4000-8000-000000000001",
      orderNumber: "SP-TEST",
    })
  );

  assert.equal(
    recovered.event.data.object.metadata.order_id,
    "00000000-0000-4000-8000-000000000001"
  );
  assert.equal(recovered.details.paymentIntentId, "pi_test_dispute");
  assert.equal(eventClaimsSeaPalsOrderMetadata(recovered.event), true);
});

test("unrelated recovered payments remain unclaimed", async () => {
  const recovered = await recoverStripeStoreEventOwnership(
    {
      id: "evt_dispute_external",
      type: "charge.dispute.created",
      data: { object: { charge: "ch_external", metadata: {} } },
    },
    {
      orderId: null,
      checkoutSessionId: null,
      paymentIntentId: null,
      chargeId: "ch_external",
    },
    async () => ({
      chargeId: "ch_external",
      paymentIntentId: "pi_external",
      orderId: null,
      orderNumber: null,
    })
  );

  assert.equal(eventClaimsSeaPalsOrderMetadata(recovered.event), false);
  assert.equal(recovered.recoveredOrderId, null);
});
