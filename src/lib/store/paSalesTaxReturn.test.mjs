import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPaSalesTaxReconciliationCsv,
  buildPaSalesTaxReturnCsv,
  currentPaQuarterEnd,
  paQuarterPeriod,
  reconcilePaSalesTaxPeriod,
} from "./paSalesTaxReturn.mjs";

function order(overrides = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    order_number: "SP-260801-ABC123",
    paid_at: "2026-08-01T16:00:00.000Z",
    payment_livemode: true,
    payment_status: "paid",
    currency: "usd",
    fulfillment_method: "shipping",
    shipping_address: {
      address: {
        city: "Reading",
        state: "PA",
        postal_code: "19601",
        country: "US",
      },
    },
    subtotal_cents: 5000,
    production_cents: 0,
    shipping_cents: 1000,
    tax_cents: 360,
    total_cents: 6360,
    store_order_items: [{ line_total_cents: 5000 }],
    store_refunds: [],
    ...overrides,
  };
}

test("quarter periods use Pennsylvania midnight boundaries", () => {
  assert.deepEqual(paQuarterPeriod("2026-09-30"), {
    year: 2026,
    quarter: 3,
    label: "Q3 2026",
    periodEnd: "2026-09-30",
    startDate: "2026-07-01",
    endExclusiveDate: "2026-10-01",
    startIso: "2026-07-01T04:00:00.000Z",
    endExclusiveIso: "2026-10-01T04:00:00.000Z",
    dueDate: "2026-10-20",
  });
  assert.equal(currentPaQuarterEnd(new Date("2026-08-24T12:00:00Z")), "2026-09-30");
  assert.equal(
    paQuarterPeriod("2026-12-31").endExclusiveIso,
    "2027-01-01T05:00:00.000Z"
  );
  assert.equal(paQuarterPeriod("2024-12-31").dueDate, "2025-01-21");
  assert.throws(() => paQuarterPeriod("2026-08-31"), /calendar-quarter/);
});

test("sales use Eastern-time quarter boundaries and remain reportable after a later refund status", () => {
  const beforeBoundary = order({
    id: "00000000-0000-4000-8000-000000000020",
    order_number: "SP-BEFORE",
    paid_at: "2026-07-01T03:59:59.999Z",
  });
  const onBoundary = order({
    id: "00000000-0000-4000-8000-000000000021",
    order_number: "SP-BOUNDARY",
    paid_at: "2026-07-01T04:00:00.000Z",
    payment_status: "refunded",
  });

  const result = reconcilePaSalesTaxPeriod(
    [beforeBoundary, onBoundary],
    "2026-09-30"
  );
  assert.equal(result.summary.includedSales, 1);
  assert.equal(result.records[0].reference, "SP-BOUNDARY");
});

test("identifier-free private-ledger rows remain distinct and preserve dispute review", () => {
  const result = reconcilePaSalesTaxPeriod(
    [
      order({
        id: undefined,
        order_number: undefined,
        paid_at: "2026-08-01T16:00:00.000Z",
        has_dispute: false,
      }),
      order({
        id: undefined,
        order_number: undefined,
        paid_at: "2026-08-02T16:00:00.000Z",
        has_dispute: true,
        dispute_updated_at: "2026-08-20T12:00:00.000Z",
      }),
    ],
    "2026-09-30"
  );

  assert.equal(result.summary.includedSales, 2);
  assert.deepEqual(
    result.records.map((record) => record.reference),
    ["Ledger row 1", "Ledger row 2"]
  );
  assert.ok(result.issues.some((issue) => issue.code === "dispute_review"));
});

test("reconciliation includes pickup and PA delivery sales while excluding test and out-of-state sales", () => {
  const result = reconcilePaSalesTaxPeriod(
    [
      order(),
      order({
        id: "00000000-0000-4000-8000-000000000002",
        order_number: "SP-PICKUP",
        fulfillment_method: "pickup",
        pickup_location: "Elverson, PA",
        shipping_address: null,
        subtotal_cents: 2000,
        shipping_cents: 0,
        tax_cents: 120,
        total_cents: 2120,
        store_order_items: [{ line_total_cents: 2000 }],
      }),
      order({
        id: "00000000-0000-4000-8000-000000000003",
        order_number: "SP-OUT",
        shipping_address: {
          address: {
            city: "Wilmington",
            state: "DE",
            postal_code: "19801",
            country: "US",
          },
        },
        tax_cents: 0,
        total_cents: 6000,
      }),
      order({
        id: "00000000-0000-4000-8000-000000000004",
        order_number: "SP-TEST",
        payment_livemode: false,
      }),
    ],
    "2026-09-30"
  );

  assert.equal(result.ready, true);
  assert.deepEqual(result.summary, {
    includedSales: 2,
    excludedSales: 2,
    issueCount: 0,
    paGrossSalesCents: 8000,
    paTaxableSalesCents: 8000,
    salesTaxCollectedCents: 480,
  });
  assert.equal(result.rows[0].actualSalesTaxCollectedCents, 480);
  assert.equal(result.rows[1].grossSalesCents, 0);
  assert.equal(result.rows[2].grossSalesCents, 0);
  assert.equal(result.exclusions[0].grossSalesCents, 6000);
});

test("post-enforcement PA deliveries fail closed without authoritative local sourcing", () => {
  const result = reconcilePaSalesTaxPeriod(
    [
      order({
        paid_at: "2026-10-01T04:00:00.000Z",
        shipping_address: {
          address: {
            city: "Philadelphia",
            state: "PA",
            postal_code: "19103",
            country: "US",
          },
        },
      }),
    ],
    "2026-12-31"
  );

  assert.equal(result.ready, false);
  assert.equal(result.rows[0].grossSalesCents, 6000);
  assert.equal(result.rows[0].netTaxableSalesCents, 0);
  assert.match(result.issues[0].message, /October 1, 2026/);
});

test("pickup location and payment mode snapshots fail closed when incomplete", () => {
  const result = reconcilePaSalesTaxPeriod(
    [
      order({
        id: "00000000-0000-4000-8000-000000000030",
        order_number: "SP-PICKUP-UNKNOWN",
        fulfillment_method: "pickup",
        pickup_location: null,
        shipping_address: null,
      }),
      order({
        id: "00000000-0000-4000-8000-000000000031",
        order_number: "SP-MODE-UNKNOWN",
        payment_livemode: null,
      }),
    ],
    "2026-09-30"
  );

  assert.equal(result.ready, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.code).sort(),
    ["tax_jurisdiction", "unknown_payment_mode"]
  );
});

test("unknown payment mode on a cross-quarter refund fallback fails closed", () => {
  const result = reconcilePaSalesTaxPeriod(
    [
      order({
        paid_at: "2026-05-01T12:00:00Z",
        payment_livemode: null,
        amount_refunded_cents: 6360,
        refunded_at: "2026-08-20T12:00:00Z",
        store_refunds: [],
      }),
    ],
    "2026-09-30"
  );

  assert.deepEqual(result.issues.map((issue) => issue.code), [
    "unknown_payment_mode",
  ]);
});

test("reconciliation drafts local rows but blocks them pending authoritative review", () => {
  const allegheny = order({
    id: "00000000-0000-4000-8000-000000000010",
    order_number: "SP-ALLEGHENY",
    shipping_address: {
      address: {
        city: "Pittsburgh",
        state: "PA",
        postal_code: "15222",
        country: "US",
      },
    },
    tax_cents: 420,
    total_cents: 6420,
  });
  const philadelphia = order({
    id: "00000000-0000-4000-8000-000000000011",
    order_number: "SP-PHILLY",
    shipping_address: {
      address: {
        city: "Philadelphia",
        state: "PA",
        postal_code: "19103",
        country: "US",
      },
    },
    subtotal_cents: 2500,
    shipping_cents: 500,
    tax_cents: 240,
    total_cents: 3240,
    store_order_items: [{ line_total_cents: 2500 }],
  });

  const result = reconcilePaSalesTaxPeriod(
    [allegheny, philadelphia],
    "2026-09-30"
  );

  assert.equal(result.ready, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ["local_tax_breakdown_review", "local_tax_breakdown_review"]
  );
  assert.deepEqual(
    result.rows.map((row) => [
      row.code,
      row.grossSalesCents,
      row.actualSalesTaxCollectedCents,
    ]),
    [
      ["00", 9000, 540],
      ["02", 6000, 60],
      ["51", 3000, 60],
    ]
  );
});

test("unreconciled tax and succeeded refunds fail closed", () => {
  const result = reconcilePaSalesTaxPeriod(
    [
      order({
        tax_cents: 361,
        total_cents: 6361,
        store_refunds: [
          {
            status: "succeeded",
            provider_created_at: "2026-08-15T12:00:00Z",
            amount_cents: 1000,
          },
        ],
      }),
    ],
    "2026-09-30"
  );

  assert.equal(result.ready, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.code).sort(),
    ["refund_review", "tax_jurisdiction"]
  );
});

test("a cross-quarter refund is reviewed even when its original sale is outside the period", () => {
  const result = reconcilePaSalesTaxPeriod(
    [
      order({
        paid_at: "2026-05-01T12:00:00Z",
        payment_status: "refunded",
        amount_refunded_cents: 6360,
        refunded_at: "2026-08-20T12:00:00Z",
        store_refunds: [
          {
            status: "succeeded",
            provider_created_at: "2026-06-30T12:00:00Z",
            provider_updated_at: "2026-08-20T12:00:00Z",
            amount_cents: 6360,
          },
        ],
      }),
    ],
    "2026-09-30"
  );

  assert.equal(result.summary.includedSales, 0);
  assert.deepEqual(result.issues.map((issue) => issue.code), ["refund_review"]);
});

test("a missing dated refund row also fails closed", () => {
  const result = reconcilePaSalesTaxPeriod(
    [
      order({
        paid_at: "2026-05-01T12:00:00Z",
        payment_status: "refunded",
        amount_refunded_cents: 6360,
        refunded_at: "2026-08-20T12:00:00Z",
        store_refunds: [],
      }),
    ],
    "2026-09-30"
  );

  assert.deepEqual(result.issues.map((issue) => issue.code), [
    "refund_ledger_review",
  ]);
});

test("the generated PA upload CSV has 14 data columns, no header, and omits unused local rows", () => {
  const reconciliation = reconcilePaSalesTaxPeriod([order()], "2026-09-30");
  reconciliation.rows[0].useTaxCents = 75;
  const csv = buildPaSalesTaxReturnCsv({
    accountNumber: "12-345678",
    entityId: "12-3456789",
    entityIdType: "001",
    periodEnd: "2026-09-30",
    rows: reconciliation.rows,
  });

  const lines = csv.split("\r\n");
  assert.equal(lines.length, 1);
  assert.equal(lines[0].split(",").length, 14);
  assert.equal(
    csv,
    "12345678,9/30/2026,00,60.00,60.00,3.60,0.00,N,N,0.75,0.00,123456789,001,O"
  );
});

test("an empty period produces the required state zero-return record", () => {
  const reconciliation = reconcilePaSalesTaxPeriod([], "2026-06-30");
  const csv = buildPaSalesTaxReturnCsv({
    accountNumber: "12345678",
    entityId: "123456789",
    periodEnd: "2026-06-30",
    rows: reconciliation.rows,
  });

  assert.equal(reconciliation.ready, true);
  assert.equal(
    csv,
    "12345678,6/30/2026,00,0.00,0.00,0.00,0.00,N,N,0.00,0.00,123456789,001,O"
  );
});

test("the audit CSV contains order-level PA calculations", () => {
  const reconciliation = reconcilePaSalesTaxPeriod([order()], "2026-09-30");
  const csv = buildPaSalesTaxReconciliationCsv(reconciliation);
  assert.match(csv, /"Record Type","Order Number","Paid At"/);
  assert.match(csv, /"Included PA sale"/);
  assert.match(csv, /"SP-260801-ABC123"/);
  assert.match(csv, /"60\.00","3\.60","0\.00","3\.60"/);
});

test("return generation validates identifiers and state-row invariants", () => {
  const row = {
    code: "00",
    grossSalesCents: 0,
    netTaxableSalesCents: 0,
    actualSalesTaxCollectedCents: 0,
  };
  assert.throws(
    () =>
      buildPaSalesTaxReturnCsv({
        accountNumber: "123",
        entityId: "123456789",
        periodEnd: "2026-09-30",
        rows: [row],
      }),
    /Account number/
  );
  assert.throws(
    () =>
      buildPaSalesTaxReturnCsv({
        accountNumber: "12345678",
        entityId: "123456789",
        periodEnd: "2026-09-30",
        rows: [{ ...row, code: "02" }],
      }),
    /state tax row/
  );
  assert.throws(
    () =>
      buildPaSalesTaxReturnCsv({
        accountNumber: "12345678",
        entityId: "123456789",
        periodEnd: "2026-09-30",
        rows: [{ ...row, creditCents: 100 }],
      }),
    /matching TPPR or Other/
  );
  assert.throws(
    () =>
      buildPaSalesTaxReturnCsv({
        accountNumber: "12345678",
        entityId: "123456789",
        periodEnd: "2026-09-30",
        rows: [{ ...row, tpprCredit: true }],
      }),
    /matching TPPR or Other/
  );
});
