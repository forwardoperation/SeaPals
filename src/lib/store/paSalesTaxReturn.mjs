const PA_TIME_ZONE = "America/New_York";
const PA_STATE_RATE_BPS = 600;
const PA_LOCAL_DESTINATION_ENFORCEMENT_ISO = localMidnightIso("2026-10-01");
const EXPECTED_PICKUP_LOCATION = "elverson, pa";

export const PA_ENTITY_ID_TYPES = Object.freeze([
  Object.freeze({ code: "001", label: "Federal Employer ID Number (FEIN)" }),
  Object.freeze({ code: "002", label: "Social Security Number (SSN)" }),
  Object.freeze({ code: "009", label: "Individual Taxpayer ID Number (ITIN)" }),
]);

export const PA_SALES_TAX_CODES = Object.freeze([
  Object.freeze({ code: "00", label: "Pennsylvania state sales tax", rateBps: 600 }),
  Object.freeze({ code: "02", label: "Allegheny County local sales tax", rateBps: 100 }),
  Object.freeze({ code: "51", label: "Philadelphia local sales tax", rateBps: 200 }),
]);

const PA_QUARTER_MONTHS = new Map([
  ["03-31", { startMonth: 1, endExclusiveMonth: 4, quarter: 1 }],
  ["06-30", { startMonth: 4, endExclusiveMonth: 7, quarter: 2 }],
  ["09-30", { startMonth: 7, endExclusiveMonth: 10, quarter: 3 }],
  ["12-31", { startMonth: 10, endExclusiveMonth: 13, quarter: 4 }],
]);

function datePartsInTimeZone(date, timeZone = PA_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type) => Number(parts.find((part) => part.type === type)?.value);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function localMidnightIso(dateKey, timeZone = PA_TIME_ZONE) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey ?? ""));
  if (!match) throw new Error("The filing date is invalid.");

  const [, yearText, monthText, dayText] = match;
  const desiredUtc = Date.UTC(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText)
  );
  let instant = desiredUtc;

  for (let pass = 0; pass < 3; pass += 1) {
    const parts = datePartsInTimeZone(new Date(instant), timeZone);
    const representedUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    instant += desiredUtc - representedUtc;
  }

  return new Date(instant).toISOString();
}

function dateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function nextBusinessDateKey(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  if (weekday === 6) date.setUTCDate(date.getUTCDate() + 2);
  if (weekday === 0) date.setUTCDate(date.getUTCDate() + 1);
  // Quarterly Q4 returns are nominally due January 20. When that date is the
  // third Monday, the federal Martin Luther King Jr. holiday moves the filing
  // deadline to the next business day.
  if (
    date.getUTCMonth() === 0 &&
    date.getUTCDate() >= 15 &&
    date.getUTCDate() <= 21 &&
    date.getUTCDay() === 1
  ) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

export function paQuarterPeriod(periodEnd) {
  const match = /^(\d{4})-(\d{2}-\d{2})$/.exec(String(periodEnd ?? "").trim());
  const definition = match ? PA_QUARTER_MONTHS.get(match[2]) : null;
  if (!match || !definition) {
    throw new Error("Choose a Pennsylvania calendar-quarter end date.");
  }

  const year = Number(match[1]);
  if (year < 2000 || year > 2100) {
    throw new Error("Choose a Pennsylvania calendar-quarter end date.");
  }

  const startDate = dateKey(year, definition.startMonth, 1);
  const endYear = definition.endExclusiveMonth === 13 ? year + 1 : year;
  const endMonth = definition.endExclusiveMonth === 13 ? 1 : definition.endExclusiveMonth;
  const endExclusiveDate = dateKey(endYear, endMonth, 1);
  const dueYear = definition.quarter === 4 ? year + 1 : year;
  const dueMonth = definition.quarter === 4 ? 1 : definition.endExclusiveMonth;

  return Object.freeze({
    year,
    quarter: definition.quarter,
    label: `Q${definition.quarter} ${year}`,
    periodEnd: `${match[1]}-${match[2]}`,
    startDate,
    endExclusiveDate,
    startIso: localMidnightIso(startDate),
    endExclusiveIso: localMidnightIso(endExclusiveDate),
    dueDate: nextBusinessDateKey(dueYear, dueMonth, 20),
  });
}

export function currentPaQuarterEnd(now = new Date()) {
  const parts = datePartsInTimeZone(now);
  const quarter = Math.floor((parts.month - 1) / 3) + 1;
  const monthDay = ["03-31", "06-30", "09-30", "12-31"][quarter - 1];
  return `${parts.year}-${monthDay}`;
}

function cleanStatus(value) {
  return String(value ?? "").trim().toLowerCase();
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function timestampInPeriod(value, period) {
  const milliseconds = Date.parse(String(value ?? ""));
  return (
    Number.isFinite(milliseconds) &&
    milliseconds >= Date.parse(period.startIso) &&
    milliseconds < Date.parse(period.endExclusiveIso)
  );
}

function parseAddress(value) {
  if (!value) return {};
  let parsed = value;

  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {};
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const address =
    parsed.address && typeof parsed.address === "object" ? parsed.address : parsed;

  return {
    city: String(address.city ?? "").trim(),
    state: String(address.state ?? address.province ?? address.region ?? "").trim(),
    postalCode: String(
      address.postal_code ?? address.postalCode ?? address.zip ?? ""
    ).trim(),
    country: String(address.country ?? "").trim(),
  };
}

function isUnitedStates(value) {
  return ["US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA"].includes(
    String(value ?? "").trim().toUpperCase()
  );
}

function isPennsylvania(value) {
  return ["PA", "PENNSYLVANIA"].includes(
    String(value ?? "").trim().toUpperCase()
  );
}

function expectedTaxForComponents(components, rateBps) {
  return components.reduce(
    (sum, cents) => sum + Math.round((cents * rateBps) / 10_000),
    0
  );
}

function orderAmounts(order) {
  const subtotalCents = nonNegativeInteger(order?.subtotal_cents);
  const productionCents = nonNegativeInteger(order?.production_cents ?? 0);
  const shippingCents = nonNegativeInteger(order?.shipping_cents);
  const taxCents = nonNegativeInteger(order?.tax_cents);
  const totalCents = nonNegativeInteger(order?.total_cents);

  if (
    [subtotalCents, productionCents, shippingCents, taxCents, totalCents].includes(
      null
    )
  ) {
    return { error: "The stored order totals are incomplete." };
  }

  const taxableBaseCents = subtotalCents + productionCents + shippingCents;
  if (taxableBaseCents <= 0 || taxableBaseCents + taxCents !== totalCents) {
    return { error: "The stored subtotal, fees, tax, and total do not reconcile." };
  }

  const itemAmounts = Array.isArray(order?.store_order_items)
    ? order.store_order_items
        .map((item) => nonNegativeInteger(item?.line_total_cents))
        .filter((amount) => amount !== null && amount > 0)
    : [];
  const components =
    itemAmounts.length > 0 &&
    itemAmounts.reduce((sum, amount) => sum + amount, 0) === subtotalCents
      ? [...itemAmounts]
      : [subtotalCents];

  if (productionCents > 0) components.push(productionCents);
  if (shippingCents > 0) components.push(shippingCents);

  return { taxableBaseCents, taxCents, components };
}

function jurisdictionForOrder(order, amounts) {
  const pickup = cleanStatus(order?.fulfillment_method) === "pickup";
  const pickupLocation = cleanStatus(order?.pickup_location);
  const address = parseAddress(order?.shipping_address);

  if (pickup && pickupLocation !== EXPECTED_PICKUP_LOCATION) {
    return {
      error:
        "The pickup location snapshot is missing or is not the expected Elverson, Pennsylvania location.",
      address,
    };
  }

  if (!pickup) {
    if (!address.country || !address.state) {
      return { error: "The shipping destination is incomplete." };
    }
    if (!isUnitedStates(address.country) || !isPennsylvania(address.state)) {
      return { excluded: "out_of_state", address };
    }
    if (
      Date.parse(String(order?.paid_at ?? "")) >=
      Date.parse(PA_LOCAL_DESTINATION_ENFORCEMENT_ISO)
    ) {
      return {
        error:
          "A Pennsylvania delivery on or after October 1, 2026 requires an authoritative destination county and state/local tax breakdown.",
        address,
        paDestination: true,
      };
    }
  }

  const candidates = pickup
    ? [{ code: "00", localRateBps: 0 }]
    : [
        { code: "00", localRateBps: 0 },
        { code: "02", localRateBps: 100 },
        { code: "51", localRateBps: 200 },
      ];
  const matches = candidates
    .map((candidate) => {
      const stateTaxCents = expectedTaxForComponents(
        amounts.components,
        PA_STATE_RATE_BPS
      );
      const localTaxCents = expectedTaxForComponents(
        amounts.components,
        candidate.localRateBps
      );
      return {
        ...candidate,
        stateTaxCents,
        localTaxCents,
        totalTaxCents: stateTaxCents + localTaxCents,
      };
    })
    .filter((candidate) => candidate.totalTaxCents === amounts.taxCents);

  if (matches.length !== 1) {
    return {
      error:
        "The collected tax does not uniquely reconcile to Pennsylvania's 6%, 7%, or 8% destination rate.",
      address,
      paDestination: true,
    };
  }

  return {
    ...matches[0],
    address,
    pickup,
    pickupLocation: order.pickup_location,
  };
}

function emptyRow(code) {
  return {
    code,
    grossSalesCents: 0,
    netTaxableSalesCents: 0,
    actualSalesTaxCollectedCents: 0,
    creditCents: 0,
    tpprCredit: false,
    otherCredit: false,
    useTaxCents: 0,
    e911FeesCents: 0,
  };
}

function orderReference(order, rowIndex = null) {
  const reference =
    String(order?.order_number ?? "").trim() ||
    String(order?.id ?? "").trim();
  if (reference) return reference;
  return Number.isInteger(rowIndex) ? `Ledger row ${rowIndex + 1}` : "Unknown order";
}

function hasDispute(order) {
  return order?.has_dispute === true || Boolean(order?.dispute_id);
}

function adjustmentInPeriod(order, period) {
  const refundInPeriod = (Array.isArray(order?.store_refunds)
    ? order.store_refunds
    : []
  ).some(
    (refund) =>
      cleanStatus(refund?.status) === "succeeded" &&
      (timestampInPeriod(refund?.provider_created_at, period) ||
        timestampInPeriod(refund?.provider_updated_at, period))
  );
  return (
    refundInPeriod ||
    (nonNegativeInteger(order?.amount_refunded_cents ?? 0) > 0 &&
      timestampInPeriod(order?.refunded_at, period)) ||
    (hasDispute(order) &&
      timestampInPeriod(order?.dispute_updated_at, period))
  );
}

export function reconcilePaSalesTaxPeriod(orders, periodEnd) {
  const period = paQuarterPeriod(periodEnd);
  const rows = {
    "00": emptyRow("00"),
    "02": emptyRow("02"),
    "51": emptyRow("51"),
  };
  const records = [];
  const exclusions = [];
  const issues = [];
  const seen = new Set();

  const ledger = Array.isArray(orders) ? orders : [];
  for (const [rowIndex, order] of ledger.entries()) {
    const identity =
      String(order?.id ?? "").trim() ||
      String(order?.order_number ?? "").trim();
    if (identity && seen.has(identity)) continue;
    if (identity) seen.add(identity);

    const reference = orderReference(order, rowIndex);
    const live = order?.payment_livemode === true;
    const test = order?.payment_livemode === false;
    const saleInPeriod = timestampInPeriod(order?.paid_at, period);

    if (!live && !test && (saleInPeriod || adjustmentInPeriod(order, period))) {
      issues.push({
        reference,
        code: "unknown_payment_mode",
        message:
          "The order does not identify whether the payment was live or test mode.",
      });
    } else if (saleInPeriod && test) {
      exclusions.push({ reference, reason: "test_mode" });
    } else if (saleInPeriod && live) {
      if (cleanStatus(order?.currency) !== "usd") {
        issues.push({
          reference,
          code: "unsupported_currency",
          message: "The live sale is not denominated in USD.",
        });
      } else {
        const amounts = orderAmounts(order);
        if (amounts.error) {
          issues.push({
            reference,
            code: "order_totals",
            message: amounts.error,
          });
        } else {
          const jurisdiction = jurisdictionForOrder(order, amounts);
          if (jurisdiction.excluded) {
            exclusions.push({
              reference,
              reason: jurisdiction.excluded,
              grossSalesCents: amounts.taxableBaseCents,
              destination: [
                jurisdiction.address.city,
                jurisdiction.address.state,
                jurisdiction.address.postalCode,
              ]
                .filter(Boolean)
                .join(" "),
            });
          } else if (jurisdiction.error) {
            if (jurisdiction.paDestination) {
              rows["00"].grossSalesCents += amounts.taxableBaseCents;
            }
            issues.push({
              reference,
              code: "tax_jurisdiction",
              message: jurisdiction.error,
            });
          } else {
            rows["00"].grossSalesCents += amounts.taxableBaseCents;
            rows["00"].netTaxableSalesCents += amounts.taxableBaseCents;
            rows["00"].actualSalesTaxCollectedCents +=
              jurisdiction.stateTaxCents;

            if (jurisdiction.code !== "00") {
              rows[jurisdiction.code].grossSalesCents += amounts.taxableBaseCents;
              rows[jurisdiction.code].netTaxableSalesCents +=
                amounts.taxableBaseCents;
              rows[jurisdiction.code].actualSalesTaxCollectedCents +=
                jurisdiction.localTaxCents;
            }

            records.push({
              reference,
              paidAt: order.paid_at,
              fulfillmentMethod: jurisdiction.pickup ? "pickup" : "shipping",
              destination: jurisdiction.pickup
                ? `${jurisdiction.pickupLocation} pickup`
                : [
                    jurisdiction.address.city,
                    jurisdiction.address.state,
                    jurisdiction.address.postalCode,
                  ]
                    .filter(Boolean)
                    .join(" "),
              code: jurisdiction.code,
              grossSalesCents: amounts.taxableBaseCents,
              stateTaxCents: jurisdiction.stateTaxCents,
              localTaxCents: jurisdiction.localTaxCents,
              totalTaxCents: amounts.taxCents,
            });

            if (jurisdiction.code !== "00") {
              issues.push({
                reference,
                code: "local_tax_breakdown_review",
                message:
                  "This destination appears to include local tax, but the historical ledger does not retain Stripe's authoritative state/local split.",
              });
            }
          }
        }
      }
    }

    if (live) {
      const refunds = Array.isArray(order?.store_refunds)
        ? order.store_refunds
        : [];
      let refundReviewRecorded = false;
      for (const refund of refunds) {
        if (
          cleanStatus(refund?.status) === "succeeded" &&
          (timestampInPeriod(refund?.provider_created_at, period) ||
            timestampInPeriod(refund?.provider_updated_at, period))
        ) {
          refundReviewRecorded = true;
          issues.push({
            reference,
            code: "refund_review",
            message:
              "A succeeded refund occurred in this filing period and its taxable/tax split needs review.",
          });
        }
      }
      if (
        !refundReviewRecorded &&
        nonNegativeInteger(order?.amount_refunded_cents ?? 0) > 0 &&
        timestampInPeriod(order?.refunded_at, period)
      ) {
        issues.push({
          reference,
          code: "refund_ledger_review",
          message:
            "The order shows a refund in this period without a dated succeeded refund row that can be placed safely.",
        });
      }

      if (
        hasDispute(order) &&
        timestampInPeriod(order?.dispute_updated_at, period)
      ) {
        issues.push({
          reference,
          code: "dispute_review",
          message: "A payment dispute changed in this filing period and needs review.",
        });
      }
    }
  }

  return {
    period,
    ready: issues.length === 0,
    rows: [rows["00"], rows["02"], rows["51"]],
    records,
    exclusions,
    issues,
    summary: {
      includedSales: records.length,
      excludedSales: exclusions.length,
      issueCount: issues.length,
      paGrossSalesCents: rows["00"].grossSalesCents,
      paTaxableSalesCents: rows["00"].netTaxableSalesCents,
      salesTaxCollectedCents:
        rows["00"].actualSalesTaxCollectedCents +
        rows["02"].actualSalesTaxCollectedCents +
        rows["51"].actualSalesTaxCollectedCents,
    },
  };
}

function requiredDigits(value, lengths, label) {
  const text = String(value ?? "").replace(/[\s-]/g, "");
  if (!lengths.includes(text.length) || !/^\d+$/.test(text)) {
    throw new Error(`${label} must contain ${lengths.join(" or ")} digits.`);
  }
  return text;
}

function requiredCents(value, label) {
  const cents = Number(value);
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error(`${label} must be a non-negative cent amount.`);
  }
  return cents;
}

function centsDecimal(value) {
  return (value / 100).toFixed(2);
}

function paUploadDate(periodEnd) {
  const [year, month, day] = periodEnd.split("-").map(Number);
  return `${month}/${day}/${year}`;
}

export function buildPaSalesTaxReturnCsv({
  accountNumber,
  entityId,
  entityIdType = "001",
  periodEnd,
  rows,
  returnType = "O",
}) {
  const account = requiredDigits(accountNumber, [8, 11], "Account number");
  const entity = requiredDigits(entityId, [9], "Entity ID");
  const entityType = String(entityIdType ?? "").trim();
  if (!PA_ENTITY_ID_TYPES.some((option) => option.code === entityType)) {
    throw new Error("Choose a supported Pennsylvania entity ID type.");
  }
  const normalizedReturnType = String(returnType ?? "").trim().toUpperCase();
  if (!["O", "A"].includes(normalizedReturnType)) {
    throw new Error("Return type must be Original or Amended.");
  }

  const period = paQuarterPeriod(periodEnd);
  const suppliedRows = Array.isArray(rows) ? rows : [];
  const codes = new Set();
  const normalizedRows = suppliedRows.map((row) => {
    const code = String(row?.code ?? "").trim();
    if (!PA_SALES_TAX_CODES.some((option) => option.code === code) || codes.has(code)) {
      throw new Error("The Pennsylvania return contains an invalid or duplicate tax code.");
    }
    codes.add(code);

    const normalized = {
      code,
      grossSalesCents: requiredCents(row?.grossSalesCents, "Gross sales"),
      netTaxableSalesCents: requiredCents(
        row?.netTaxableSalesCents,
        "Net taxable sales"
      ),
      actualSalesTaxCollectedCents: requiredCents(
        row?.actualSalesTaxCollectedCents,
        "Actual sales tax collected"
      ),
      creditCents: requiredCents(row?.creditCents ?? 0, "Credit"),
      tpprCredit: Boolean(row?.tpprCredit),
      otherCredit: Boolean(row?.otherCredit),
      useTaxCents: requiredCents(row?.useTaxCents ?? 0, "Use tax"),
      e911FeesCents: requiredCents(row?.e911FeesCents ?? 0, "E-911 fees"),
    };
    if (normalized.netTaxableSalesCents > normalized.grossSalesCents) {
      throw new Error("Net taxable sales cannot exceed gross sales.");
    }
    if (
      (normalized.creditCents > 0) !==
      (normalized.tpprCredit || normalized.otherCredit)
    ) {
      throw new Error(
        "A Pennsylvania return credit must have a matching TPPR or Other credit type."
      );
    }
    return normalized;
  });

  if (!codes.has("00")) {
    throw new Error("The Pennsylvania state tax row (code 00) is required.");
  }

  const includedRows = normalizedRows.filter(
    (row) =>
      row.code === "00" ||
      [
        row.grossSalesCents,
        row.netTaxableSalesCents,
        row.actualSalesTaxCollectedCents,
        row.creditCents,
        row.useTaxCents,
        row.e911FeesCents,
      ].some((amount) => amount > 0) ||
      row.tpprCredit ||
      row.otherCredit
  );

  return includedRows
    .map((row) =>
      [
        account,
        paUploadDate(period.periodEnd),
        row.code,
        centsDecimal(row.grossSalesCents),
        centsDecimal(row.netTaxableSalesCents),
        centsDecimal(row.actualSalesTaxCollectedCents),
        centsDecimal(row.creditCents),
        row.tpprCredit ? "Y" : "N",
        row.otherCredit ? "Y" : "N",
        centsDecimal(row.useTaxCents),
        centsDecimal(row.e911FeesCents),
        entity,
        entityType,
        normalizedReturnType,
      ].join(",")
    )
    .join("\r\n");
}

function safeCsvCell(value) {
  let text = String(value ?? "");
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildPaSalesTaxReconciliationCsv(reconciliation) {
  const headers = [
    "Record Type",
    "Order Number",
    "Paid At",
    "Fulfillment",
    "Destination",
    "PA Tax Code",
    "Gross Sales",
    "State Tax",
    "Local Tax",
    "Total Tax",
    "Note",
  ];
  const includedRows = (reconciliation?.records ?? []).map((record) => [
    "Included PA sale",
    record.reference,
    record.paidAt,
    record.fulfillmentMethod,
    record.destination,
    record.code,
    centsDecimal(record.grossSalesCents),
    centsDecimal(record.stateTaxCents),
    centsDecimal(record.localTaxCents),
    centsDecimal(record.totalTaxCents),
    "",
  ]);
  const exclusionRows = (reconciliation?.exclusions ?? []).map((record) => [
    "Excluded sale",
    record.reference,
    record.grossSalesCents === undefined
      ? ""
      : centsDecimal(record.grossSalesCents),
    "",
    record.destination ?? "",
    "",
    "",
    "",
    "",
    "",
    record.reason === "out_of_state"
      ? "out of state; excluded from PA gross and taxable sales"
      : String(record.reason ?? "").replaceAll("_", " "),
  ]);
  const issueRows = (reconciliation?.issues ?? []).map((issue) => [
    "Exception",
    issue.reference,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    issue.message,
  ]);

  return [headers, ...includedRows, ...exclusionRows, ...issueRows]
    .map((row) => row.map(safeCsvCell).join(","))
    .join("\r\n");
}
