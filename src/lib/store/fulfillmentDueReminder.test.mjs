import assert from "node:assert/strict";
import test from "node:test";

import {
  FULFILLMENT_DUE_NOTIFICATION_TYPE,
  buildFulfillmentDueReminderEmail,
  deliverFulfillmentDueReminderNotification,
  fulfillmentDueDateForOrder,
  fulfillmentDueReminderIdempotencyKey,
  isFulfillmentDueReminderEligible,
  isFulfillmentDueReminderInWindow,
  sendFulfillmentDueReminderEmail,
} from "./fulfillmentDueReminder.mjs";
import { merchantPurchaseIdempotencyKey } from "./merchantOrderEmail.mjs";

const ORDER_ID = "00000000-0000-4000-8000-000000000021";
const CLAIM_TOKEN = "10000000-0000-4000-8000-000000000021";
const DUE_DATE = "2026-08-24";
const REMINDER_NOW = "2026-08-21T13:00:00.000Z";

function dueOrder(overrides = {}) {
  return {
    id: ORDER_ID,
    order_number: "SP-260822-TIDE21",
    customer_name: "Alex <script>alert(1)</script>",
    customer_email: "buyer@example.com",
    payment_status: "paid",
    payment_livemode: true,
    production_due_date: DUE_DATE,
    fulfillment_method: "shipping",
    fulfillment_status: "packing",
    ...overrides,
  };
}

const configuredEnvironment = {
  STORE_ORDER_NOTIFICATION_ENABLED: "true",
  STORE_FULFILLMENT_DUE_NOTIFICATION_ENABLED: "true",
  STORE_ORDER_NOTIFICATION_EMAIL: "maker@seapalstcg.com",
  RESEND_API_KEY: "test-provider-secret",
  EMAIL_FROM: "SeaPals Orders <orders@seapalstcg.com>",
  SITE_URL: "https://seapalstcg.com",
};

test("eligibility requires the current live paid due date and keeps on-hold orders eligible", () => {
  assert.equal(isFulfillmentDueReminderEligible(dueOrder(), DUE_DATE), true);
  assert.equal(
    isFulfillmentDueReminderEligible(
      dueOrder({ fulfillment_status: "on_hold" }),
      DUE_DATE
    ),
    true
  );
  assert.equal(
    isFulfillmentDueReminderEligible(
      dueOrder({ payment_status: "pending" }),
      DUE_DATE
    ),
    false
  );
  assert.equal(
    isFulfillmentDueReminderEligible(
      dueOrder({ payment_livemode: false }),
      DUE_DATE
    ),
    false
  );
  assert.equal(
    isFulfillmentDueReminderEligible(dueOrder(), "2026-08-25"),
    false
  );
  assert.equal(
    isFulfillmentDueReminderEligible(dueOrder(), "2026-02-30"),
    false
  );
});

test("standard due dates count weekdays after the Eastern payment date", () => {
  const standardOrder = dueOrder({
    paid_at: "2026-08-17T18:00:00.000Z",
    production_option_id: "standard-production",
    production_max_business_days: 5,
    production_due_date: null,
  });
  assert.equal(fulfillmentDueDateForOrder(standardOrder), "2026-08-24");
  assert.equal(
    isFulfillmentDueReminderEligible(standardOrder, "2026-08-24"),
    true
  );

  assert.equal(
    fulfillmentDueDateForOrder({
      ...standardOrder,
      paid_at: "2026-08-14T03:30:00.000Z",
    }),
    "2026-08-20",
    "03:30Z is still Thursday in New York daylight time"
  );
  assert.equal(
    fulfillmentDueDateForOrder({
      ...standardOrder,
      paid_at: "2026-08-14T04:30:00.000Z",
    }),
    "2026-08-21",
    "04:30Z is Friday in New York daylight time"
  );
});

test("shipping and pickup eligibility stop at their respective ready states", () => {
  for (const status of ["awaiting_shipment", "shipped", "cancelled"]) {
    assert.equal(
      isFulfillmentDueReminderEligible(
        dueOrder({ fulfillment_status: status }),
        DUE_DATE
      ),
      false,
      `shipping ${status}`
    );
  }
  for (const status of ["ready_for_pickup", "picked_up", "cancelled"]) {
    assert.equal(
      isFulfillmentDueReminderEligible(
        dueOrder({
          fulfillment_method: "pickup",
          fulfillment_status: status,
        }),
        DUE_DATE
      ),
      false,
      `pickup ${status}`
    );
  }
  assert.equal(
    isFulfillmentDueReminderEligible(
      dueOrder({
        fulfillment_method: "pickup",
        fulfillment_status: "on_hold",
      }),
      DUE_DATE
    ),
    true
  );
});

test("the reminder window opens at 9 AM Eastern on the previous business day and closes after the due date", () => {
  assert.equal(
    isFulfillmentDueReminderInWindow(DUE_DATE, "2026-08-21T12:59:59Z"),
    false
  );
  assert.equal(
    isFulfillmentDueReminderInWindow(DUE_DATE, REMINDER_NOW),
    true
  );
  assert.equal(
    isFulfillmentDueReminderInWindow(DUE_DATE, "2026-08-22T16:00:00Z"),
    true,
    "weekend catch-up remains open for a Monday due date"
  );
  assert.equal(
    isFulfillmentDueReminderInWindow(DUE_DATE, "2026-08-25T03:59:59Z"),
    true,
    "the due date remains open through 11:59 PM Eastern"
  );
  assert.equal(
    isFulfillmentDueReminderInWindow(DUE_DATE, "2026-08-25T04:00:00Z"),
    false
  );
});

test("shipping reminder includes the order, due date, action, and private link with escaped HTML", () => {
  const email = buildFulfillmentDueReminderEmail(
    dueOrder({ order_number: "SP-21 <danger>" }),
    DUE_DATE,
    configuredEnvironment
  );

  assert.match(email.subject, /SP-21 <danger> is due Aug 24, 2026/);
  assert.match(email.text, /Order: SP-21 <danger>/);
  assert.match(email.text, /Due date: Aug 24, 2026/);
  assert.match(
    email.text,
    /Required action: Awaiting shipment \(ready to ship\)/
  );
  assert.match(
    email.text,
    /https:\/\/seapalstcg\.com\/admin\/orders\?order=00000000-0000-4000-8000-000000000021/
  );
  assert.doesNotMatch(email.html, /<danger>/);
  assert.match(email.html, /SP-21 &lt;danger&gt;/);
  assert.doesNotMatch(email.text, /Alex|buyer@example\.com/);
  assert.doesNotMatch(email.html, /Alex|buyer@example\.com/);
});

test("pickup reminder uses the pickup-specific action", () => {
  const email = buildFulfillmentDueReminderEmail(
    dueOrder({
      fulfillment_method: "pickup",
      fulfillment_status: "packing",
    }),
    DUE_DATE,
    configuredEnvironment
  );

  assert.equal(email.pickup, true);
  assert.equal(email.action, "Ready for pickup");
  assert.match(email.text, /Required action: Ready for pickup/);
});

test("mutable fulfillment and customer fields do not change the idempotent email payload", () => {
  const packing = buildFulfillmentDueReminderEmail(
    dueOrder({ fulfillment_status: "packing" }),
    DUE_DATE,
    configuredEnvironment
  );
  const onHold = buildFulfillmentDueReminderEmail(
    dueOrder({
      fulfillment_status: "on_hold",
      customer_name: "Changed Customer",
      customer_email: "changed@example.com",
    }),
    DUE_DATE,
    configuredEnvironment
  );

  assert.deepEqual(
    { subject: packing.subject, text: packing.text, html: packing.html },
    { subject: onHold.subject, text: onHold.text, html: onHold.html }
  );
});

test("idempotency is stable per order and due date and distinct from purchase delivery", () => {
  const key = fulfillmentDueReminderIdempotencyKey(ORDER_ID, DUE_DATE);
  assert.equal(FULFILLMENT_DUE_NOTIFICATION_TYPE, "merchant_fulfillment_due");
  assert.equal(
    key,
    `seapals-merchant_fulfillment_due-${ORDER_ID}-${DUE_DATE}`
  );
  assert.equal(
    fulfillmentDueReminderIdempotencyKey(ORDER_ID, DUE_DATE),
    key
  );
  assert.notEqual(key, merchantPurchaseIdempotencyKey(ORDER_ID));
  assert.notEqual(
    key,
    fulfillmentDueReminderIdempotencyKey(ORDER_ID, "2026-08-25")
  );
  assert.throws(
    () => fulfillmentDueReminderIdempotencyKey(ORDER_ID, "2026-02-30"),
    (error) =>
      error.code === "fulfillment_due_notification_due_date_invalid"
  );
});

test("Resend request uses shared merchant settings, both gates, and the due-date idempotency key", async () => {
  let request;
  const result = await sendFulfillmentDueReminderEmail({
    order: dueOrder(),
    dueDate: DUE_DATE,
    environment: configuredEnvironment,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "email_due_123" }),
      };
    },
  });

  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(
    request.options.headers["Idempotency-Key"],
    fulfillmentDueReminderIdempotencyKey(ORDER_ID, DUE_DATE)
  );
  assert.equal(
    request.options.headers.Authorization,
    "Bearer test-provider-secret"
  );
  const body = JSON.parse(request.options.body);
  assert.equal(body.from, "SeaPals Orders <orders@seapalstcg.com>");
  assert.equal(body.to, "maker@seapalstcg.com");
  assert.equal(body.reply_to, undefined);
  assert.match(body.text, /Awaiting shipment \(ready to ship\)/);
  assert.doesNotMatch(request.options.body, /buyer@example\.com|Alex/);
  assert.doesNotMatch(request.options.body, /test-provider-secret/);
  assert.equal(result.providerMessageId, "email_due_123");
});

test("both the shared order-email gate and reminder-specific gate are required", async () => {
  for (const disabledKey of [
    "STORE_ORDER_NOTIFICATION_ENABLED",
    "STORE_FULFILLMENT_DUE_NOTIFICATION_ENABLED",
  ]) {
    await assert.rejects(
      sendFulfillmentDueReminderEmail({
        order: dueOrder(),
        dueDate: DUE_DATE,
        environment: { ...configuredEnvironment, [disabledKey]: "false" },
        fetchImpl: async () => {
          throw new Error("must not send");
        },
      }),
      (error) => error.code === "fulfillment_due_email_not_enabled",
      disabledKey
    );
  }
});

test("provider failures expose a safe retry code without reading private response content", async () => {
  let responseBodyRead = false;
  await assert.rejects(
    sendFulfillmentDueReminderEmail({
      order: dueOrder(),
      dueDate: DUE_DATE,
      environment: configuredEnvironment,
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        text: async () => {
          responseBodyRead = true;
          return "buyer@example.com private provider response";
        },
      }),
    }),
    (error) =>
      error.code === "resend_http_503" &&
      !error.message.includes("buyer@example.com")
  );
  assert.equal(responseBodyRead, false);
});

test("orchestration claims, reloads, revalidates, sends, and completes one reminder", async () => {
  const calls = [];
  const result = await deliverFulfillmentDueReminderNotification({
    orderId: ORDER_ID,
    dueDate: DUE_DATE,
    now: REMINDER_NOW,
    claimToken: CLAIM_TOKEN,
    environment: configuredEnvironment,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: "email_due_accepted" }),
    }),
    claim: async (details) => {
      calls.push(["claim", details]);
      return "claimed";
    },
    loadOrder: async (details) => {
      calls.push(["load", details]);
      return dueOrder();
    },
    complete: async (details) => {
      calls.push(["complete", details]);
      return true;
    },
    release: async (details) => calls.push(["release", details]),
  });

  assert.deepEqual(result, { status: "sent", delivered: true });
  assert.deepEqual(
    calls.map(([name]) => name),
    ["claim", "load", "complete"]
  );
  for (const [, details] of calls) {
    assert.equal(details.orderId, ORDER_ID);
    assert.equal(details.dueDate, DUE_DATE);
  }
  assert.equal(calls[2][1].providerMessageId, "email_due_accepted");
});

test("a stale claimed reminder completes without sending", async () => {
  const completions = [];
  let fetchCount = 0;
  const result = await deliverFulfillmentDueReminderNotification({
    orderId: ORDER_ID,
    dueDate: DUE_DATE,
    now: REMINDER_NOW,
    claimToken: CLAIM_TOKEN,
    environment: configuredEnvironment,
    fetchImpl: async () => {
      fetchCount += 1;
      throw new Error("must not send");
    },
    claim: async () => "claimed",
    loadOrder: async () =>
      dueOrder({ fulfillment_status: "awaiting_shipment" }),
    complete: async (details) => {
      completions.push(details);
      return true;
    },
    release: async () => {
      throw new Error("must not release a completed stale reminder");
    },
  });

  assert.deepEqual(result, { status: "stale", delivered: false });
  assert.equal(fetchCount, 0);
  assert.equal(completions.length, 1);
  assert.equal(completions[0].providerMessageId, null);
  assert.equal(completions[0].dueDate, DUE_DATE);
});

test("a claimed reminder after its due date completes as stale without sending", async () => {
  let fetchCount = 0;
  const completions = [];
  const result = await deliverFulfillmentDueReminderNotification({
    orderId: ORDER_ID,
    dueDate: DUE_DATE,
    now: "2026-08-25T04:00:00.000Z",
    claimToken: CLAIM_TOKEN,
    environment: configuredEnvironment,
    fetchImpl: async () => {
      fetchCount += 1;
      throw new Error("must not send");
    },
    claim: async () => "claimed",
    loadOrder: async () => dueOrder(),
    complete: async (details) => {
      completions.push(details);
      return true;
    },
    release: async () => {
      throw new Error("must not release a completed stale reminder");
    },
  });

  assert.deepEqual(result, { status: "stale", delivered: false });
  assert.equal(fetchCount, 0);
  assert.equal(completions.length, 1);
  assert.equal(completions[0].providerMessageId, null);
});

test("a delivery failure releases the lease with the due date and safe code", async () => {
  const releases = [];
  await assert.rejects(
    deliverFulfillmentDueReminderNotification({
      orderId: ORDER_ID,
      dueDate: DUE_DATE,
      now: REMINDER_NOW,
      claimToken: CLAIM_TOKEN,
      environment: configuredEnvironment,
      fetchImpl: async () => ({ ok: false, status: 429 }),
      claim: async () => "claimed",
      loadOrder: async () => dueOrder({ fulfillment_status: "on_hold" }),
      complete: async () => true,
      release: async (details) => {
        releases.push(details);
        return true;
      },
    }),
    (error) => error.code === "resend_http_429"
  );

  assert.equal(releases.length, 1);
  assert.equal(releases[0].orderId, ORDER_ID);
  assert.equal(releases[0].dueDate, DUE_DATE);
  assert.equal(releases[0].claimToken, CLAIM_TOKEN);
  assert.equal(releases[0].failureCode, "resend_http_429");
});

test("already-sent and busy claims never load or send", async () => {
  let sideEffectCount = 0;
  const callbacks = {
    loadOrder: async () => {
      sideEffectCount += 1;
      return dueOrder();
    },
    complete: async () => {
      sideEffectCount += 1;
      return true;
    },
    release: async () => {
      sideEffectCount += 1;
      return true;
    },
  };

  const sent = await deliverFulfillmentDueReminderNotification({
    orderId: ORDER_ID,
    dueDate: DUE_DATE,
    now: REMINDER_NOW,
    environment: configuredEnvironment,
    fetchImpl: async () => {
      sideEffectCount += 1;
    },
    claim: async () => "sent",
    ...callbacks,
  });
  assert.deepEqual(sent, { status: "sent", delivered: false });

  await assert.rejects(
    deliverFulfillmentDueReminderNotification({
      orderId: ORDER_ID,
      dueDate: DUE_DATE,
      now: REMINDER_NOW,
      environment: configuredEnvironment,
      fetchImpl: async () => {
        sideEffectCount += 1;
      },
      claim: async () => "busy",
      ...callbacks,
    }),
    (error) => error.code === "fulfillment_due_notification_busy"
  );
  assert.equal(sideEffectCount, 0);
});
