"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  STORE_FULFILLMENT_STATUS_VALUES,
  isFulfillmentStatusAllowedForMethod,
  isShippingQueueStatus,
  storeFulfillmentStatusLabel,
} from "@/lib/store/fulfillmentStatus.mjs";
import {
  PA_ENTITY_ID_TYPES,
  PA_SALES_TAX_CODES,
  buildPaSalesTaxReconciliationCsv,
  buildPaSalesTaxReturnCsv,
  currentPaQuarterEnd,
  paQuarterPeriod,
  reconcilePaSalesTaxPeriod,
} from "@/lib/store/paSalesTaxReturn.mjs";

const TOKEN_STORAGE_KEY = "seapals-store-admin-token";

const FULFILLMENT_OPTIONS = STORE_FULFILLMENT_STATUS_VALUES.map((value) => ({
  value,
  label: storeFulfillmentStatusLabel(value),
}));
const PAYMENT_HOLD_STATUSES = new Set([
  "partially_refunded",
  "refunded",
  "disputed",
  "chargeback",
]);
const ACTIVE_REFUND_STATUSES = new Set(["pending", "requires_action"]);
const FAILED_REFUND_STATUSES = new Set(["failed", "canceled"]);
const STORE_TIME_ZONE = "America/New_York";
const SHIPPING_PRODUCTION_COMPLETE_STATUSES = new Set([
  "shipped",
  "cancelled",
]);
const PICKUP_PRODUCTION_COMPLETE_STATUSES = new Set([
  "ready_for_pickup",
  "picked_up",
  "cancelled",
]);

function cleanStatus(value, fallback = "unknown") {
  return String(value ?? fallback).trim().toLowerCase() || fallback;
}

function statusLabel(value) {
  return cleanStatus(value)
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value, includeTime = true) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "numeric",
          minute: "2-digit",
        }
      : {}),
  }).format(date);
}

function formatMoney(cents, currency = "usd") {
  const amount = Number(cents ?? 0) / 100;
  const normalizedCurrency = String(currency || "usd").toUpperCase();

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency,
    }).format(amount);
  } catch {
    return `${normalizedCurrency} ${amount.toFixed(2)}`;
  }
}

function centsToDecimal(cents) {
  return (Number(cents ?? 0) / 100).toFixed(2);
}

function dollarsToCents(value, label) {
  const text = String(value ?? "").trim();
  if (!text) return 0;
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new Error(`${label} must be a dollar amount with no more than two decimals.`);
  }
  const cents = Math.round(Number(text) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error(`${label} is too large.`);
  }
  return cents;
}

function paQuarterOptions(count = 8) {
  const current = paQuarterPeriod(currentPaQuarterEnd());
  const options = [];

  for (let offset = 0; offset < count; offset += 1) {
    const index = current.year * 4 + (current.quarter - 1) - offset;
    const year = Math.floor(index / 4);
    const quarter = (index % 4) + 1;
    const monthDay = ["03-31", "06-30", "09-30", "12-31"][quarter - 1];
    const period = paQuarterPeriod(`${year}-${monthDay}`);
    options.push(period);
  }

  return options;
}

function downloadCsvFile(csv, filename, includeBom = false) {
  const blob = new Blob([includeBom ? "\uFEFF" : "", csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function paReconciliationFingerprint(reconciliation) {
  return JSON.stringify({
    rows: reconciliation?.rows,
    records: reconciliation?.records,
    exclusions: reconciliation?.exclusions,
    issues: reconciliation?.issues,
  });
}

function isPaid(order) {
  return cleanStatus(order?.payment_status) === "paid";
}

function isPickup(order) {
  return cleanStatus(order?.fulfillment_method, "shipping") === "pickup";
}

function isExpeditedProduction(order) {
  return (
    cleanStatus(order?.production_option_id, "standard-production") ===
      "expedited-production" ||
    (Number(order?.production_max_business_days) === 1 &&
      Number(order?.production_cents) > 0)
  );
}

function productionName(order) {
  const configuredName = String(order?.production_option_name ?? "").trim();
  if (configuredName) return configuredName;
  return isExpeditedProduction(order)
    ? "Expedited production"
    : "Standard production";
}

function productionMaxBusinessDays(order) {
  const days = Number(order?.production_max_business_days);
  if (Number.isSafeInteger(days) && days > 0) return days;
  return isExpeditedProduction(order) ? 1 : 5;
}

function expeditedCapacityState(order) {
  const value = String(order?.expedited_capacity_state ?? "").trim();
  if (value) return cleanStatus(value);
  return isExpeditedProduction(order) ? "unknown" : "not_applicable";
}

function expeditedCapacityStateLabel(order) {
  const state = expeditedCapacityState(order);
  return state === "unknown" ? "State missing" : statusLabel(state);
}

function expeditedCapacityStateClasses(order) {
  const state = expeditedCapacityState(order);
  if (state === "committed") {
    return "border-emerald-200 bg-emerald-100 text-emerald-900";
  }
  if (state === "reserved") {
    return "border-cyan-200 bg-cyan-100 text-cyan-900";
  }
  if (state === "released" || state === "not_applicable") {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }
  return "border-rose-200 bg-rose-100 text-rose-900";
}

function productionDueDateKey(order) {
  const value = String(order?.production_due_date ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return "";
  }

  return value;
}

function newYorkDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type) => parts.find((entry) => entry.type === type)?.value ?? "";
  const year = part("year");
  const month = part("month");
  const day = part("day");
  return year && month && day ? `${year}-${month}-${day}` : "";
}

function formatProductionDueDate(order) {
  const dueDate = productionDueDateKey(order);
  if (!dueDate) return "Due date missing";

  const [year, month, day] = dueDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function isActionablePaidRush(order) {
  if (!isExpeditedProduction(order) || !isPaid(order)) return false;
  if (expeditedCapacityState(order) === "released") return false;

  const status = cleanStatus(order?.fulfillment_status, "unfulfilled");
  const completedStatuses = isPickup(order)
    ? PICKUP_PRODUCTION_COMPLETE_STATUSES
    : SHIPPING_PRODUCTION_COMPLETE_STATUSES;
  return !completedStatuses.has(status);
}

function productionDueState(order, now = new Date()) {
  if (!isActionablePaidRush(order)) return "complete";

  const dueDate = productionDueDateKey(order);
  if (!dueDate) return "missing";

  const today = newYorkDateKey(now);
  if (!today) return "scheduled";
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "due-today";
  return "scheduled";
}

function fulfillmentLabel(order) {
  return storeFulfillmentStatusLabel(
    cleanStatus(order?.fulfillment_status, "unfulfilled"),
    isPickup(order) ? "pickup" : "shipping"
  );
}

function isPaidUnshipped(order) {
  return (
    isPaid(order) &&
    !isPickup(order) &&
    isShippingQueueStatus(
      cleanStatus(order?.fulfillment_status, "unfulfilled")
    )
  );
}

function itemCount(order) {
  return (order?.store_order_items ?? []).reduce(
    (sum, item) => sum + Number(item.quantity ?? 0),
    0
  );
}

function parseAddress(value) {
  if (!value) return {};

  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return { line1: value };
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  const address =
    parsed.address && typeof parsed.address === "object"
      ? parsed.address
      : parsed;

  return {
    name: parsed.name ?? address.name ?? "",
    line1: address.line1 ?? address.address_line_1 ?? "",
    line2: address.line2 ?? address.address_line_2 ?? "",
    city: address.city ?? "",
    state: address.state ?? address.province ?? address.region ?? "",
    postalCode: address.postal_code ?? address.postalCode ?? address.zip ?? "",
    country: address.country ?? "",
    phone: parsed.phone ?? address.phone ?? "",
  };
}

function cityLine(address) {
  const cityAndState = [address.city, address.state].filter(Boolean).join(", ");
  return [cityAndState, address.postalCode].filter(Boolean).join(" ");
}

function safeStripeUrl(value) {
  if (!value) return "";

  try {
    const url = new URL(String(value));
    const hostname = url.hostname.toLowerCase();
    const isStripeHost =
      hostname === "stripe.com" || hostname.endsWith(".stripe.com");

    return url.protocol === "https:" && isStripeHost ? url.toString() : "";
  } catch {
    return "";
  }
}

function safeHttpsUrl(value) {
  if (!value) return "";

  try {
    const url = new URL(String(value));
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function stripeDashboardUrl(order) {
  const paymentIntentId = String(order?.payment_intent_id ?? "").trim();
  if (!/^pi_[A-Za-z0-9_]+$/.test(paymentIntentId)) return "";

  const modePath = order.payment_livemode === true ? "" : "test/";
  return `https://dashboard.stripe.com/${modePath}payments/${encodeURIComponent(
    paymentIntentId
  )}`;
}

function statusClasses(status, type) {
  const normalized = cleanStatus(status);

  if (
    normalized === "paid" ||
    normalized === "shipped" ||
    normalized === "picked_up"
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (
    normalized === "packing" ||
    normalized === "in_production" ||
    normalized === "awaiting_shipment" ||
    normalized === "ready_for_pickup" ||
    normalized === "on_hold" ||
    normalized === "pending" ||
    normalized === "partially_refunded"
  ) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (
    normalized === "failed" ||
    normalized === "cancelled" ||
    normalized === "refunded" ||
    normalized === "disputed" ||
    normalized === "chargeback"
  ) {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  if (type === "payment") {
    return "border-violet-200 bg-violet-50 text-violet-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function StatusBadge({ value, type, label }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses(
        value,
        type
      )}`}
    >
      {label || statusLabel(value)}
    </span>
  );
}

function csvCell(value) {
  let text = String(value ?? "");

  // Prevent spreadsheet applications from interpreting customer data as a formula.
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;

  return `"${text.replaceAll('"', '""')}"`;
}

function buildShippingCsv(orders) {
  const headers = [
    "Order Number",
    "Order ID",
    "Paid At",
    "Recipient Name",
    "Email",
    "Fulfillment Method",
    "Fulfillment Option",
    "Production Option",
    "Production Max Business Days",
    "Production Fee",
    "Production Due Date",
    "Expedited Capacity State",
    "Address Line 1",
    "Address Line 2",
    "City",
    "State / Province",
    "Postal Code",
    "Country",
    "Phone",
    "SKUs",
    "Items",
    "Total Quantity",
    "Currency",
    "Subtotal",
    "Shipping",
    "Tax",
    "Total",
    "Internal Notes",
    "Receipt Number",
    "Payment Intent",
    "Charge ID",
  ];

  const rows = orders.map((order) => {
    const address = parseAddress(order.shipping_address);
    const items = order.store_order_items ?? [];
    const skuSummary = items
      .map((item) => `${item.sku} x${Number(item.quantity ?? 0)}`)
      .join("; ");
    const itemSummary = items
      .map((item) => `${item.product_name} x${Number(item.quantity ?? 0)}`)
      .join("; ");

    return [
      order.order_number,
      order.id,
      order.paid_at,
      address.name || order.customer_name,
      order.customer_email,
      order.fulfillment_method,
      order.fulfillment_option_name,
      productionName(order),
      productionMaxBusinessDays(order),
      centsToDecimal(order.production_cents),
      order.production_due_date,
      order.expedited_capacity_state,
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.postalCode,
      address.country,
      address.phone,
      skuSummary,
      itemSummary,
      itemCount(order),
      String(order.currency || "usd").toUpperCase(),
      centsToDecimal(order.subtotal_cents),
      centsToDecimal(order.shipping_cents),
      centsToDecimal(order.tax_cents),
      centsToDecimal(order.total_cents),
      order.internal_notes,
      order.receipt_number,
      order.payment_intent_id,
      order.charge_id,
    ];
  });

  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

function StatCard({ label, value, detail, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-950",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
    rose: "border-rose-200 bg-rose-50 text-rose-950",
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-black uppercase tracking-[0.16em] opacity-65">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black tabular-nums">{value}</p>
      {detail ? <p className="mt-1 text-xs font-semibold opacity-65">{detail}</p> : null}
    </div>
  );
}

function Totals({ order }) {
  const rows = [
    ["Subtotal", order.subtotal_cents],
    [productionName(order), order.production_cents],
    [isPickup(order) ? "Local pickup" : "Shipping & handling", order.shipping_cents],
    ["Tax", order.tax_cents],
  ];

  return (
    <dl className="space-y-2 text-sm">
      {rows.map(([label, cents]) => (
        <div key={label} className="flex items-center justify-between gap-4">
          <dt className="text-slate-500">{label}</dt>
          <dd className="font-semibold text-slate-800">
            {formatMoney(cents, order.currency)}
          </dd>
        </div>
      ))}
      {Number(order.amount_refunded_cents ?? 0) > 0 ? (
        <div className="flex items-center justify-between gap-4 text-rose-700">
          <dt className="font-semibold">Refunded</dt>
          <dd className="font-bold">
            {formatMoney(order.amount_refunded_cents, order.currency)}
          </dd>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3 text-base">
        <dt className="font-black text-slate-950">Total</dt>
        <dd className="font-black text-slate-950">
          {formatMoney(order.total_cents, order.currency)}
        </dd>
      </div>
    </dl>
  );
}

function OrderCard({ order, onSave, saving }) {
  const detailsId = useId();
  const [expanded, setExpanded] = useState(false);
  const [fulfillmentStatus, setFulfillmentStatus] = useState(
    cleanStatus(order.fulfillment_status, "unfulfilled")
  );
  const [trackingNumber, setTrackingNumber] = useState(
    String(order.tracking_number ?? "")
  );
  const [trackingUrl, setTrackingUrl] = useState(String(order.tracking_url ?? ""));
  const [internalNotes, setInternalNotes] = useState(
    String(order.internal_notes ?? "")
  );
  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setFulfillmentStatus(
      cleanStatus(order.fulfillment_status, "unfulfilled")
    );
    setTrackingNumber(String(order.tracking_number ?? ""));
    setTrackingUrl(String(order.tracking_url ?? ""));
    setInternalNotes(String(order.internal_notes ?? ""));
  }, [order]);

  const address = parseAddress(order.shipping_address);
  const pickupOrder = isPickup(order);
  const receiptUrl = safeStripeUrl(order.receipt_url);
  const dashboardUrl = stripeDashboardUrl(order);
  const savedTrackingUrl = pickupOrder ? "" : safeHttpsUrl(order.tracking_url);
  const currentStatus = cleanStatus(order.fulfillment_status, "unfulfilled");
  const paymentStatus = cleanStatus(order.payment_status);
  const refundRecords = Array.isArray(order.store_refunds)
    ? [...order.store_refunds].sort(
        (left, right) =>
          new Date(right.provider_updated_at ?? 0).getTime() -
          new Date(left.provider_updated_at ?? 0).getTime()
      )
    : [];
  const activeRefunds = refundRecords.filter((refund) =>
    ACTIVE_REFUND_STATUSES.has(cleanStatus(refund.status))
  );
  const failedRefunds = refundRecords.filter((refund) =>
    FAILED_REFUND_STATUSES.has(cleanStatus(refund.status))
  );
  const fulfillmentOnHold =
    PAYMENT_HOLD_STATUSES.has(paymentStatus) || activeRefunds.length > 0;
  const hasChanges =
    fulfillmentStatus !== currentStatus ||
    trackingNumber.trim() !== String(order.tracking_number ?? "").trim() ||
    trackingUrl.trim() !== String(order.tracking_url ?? "").trim() ||
    internalNotes.trim() !== String(order.internal_notes ?? "").trim();
  const fulfillmentMethod = pickupOrder ? "pickup" : "shipping";
  const methodFulfillmentOptions = FULFILLMENT_OPTIONS.filter((option) =>
    isFulfillmentStatusAllowedForMethod(option.value, fulfillmentMethod)
  ).map((option) => ({
    ...option,
    label: storeFulfillmentStatusLabel(option.value, fulfillmentMethod),
  }));
  const permittedStatuses = !fulfillmentOnHold
    ? methodFulfillmentOptions
    : currentStatus === "shipped"
      ? methodFulfillmentOptions.filter((option) => option.value === "shipped")
      : currentStatus === "picked_up"
        ? methodFulfillmentOptions.filter(
            (option) => option.value === "picked_up"
          )
      : ["refunded", "chargeback"].includes(paymentStatus)
        ? methodFulfillmentOptions.filter(
            (option) => option.value === "cancelled"
          )
        : activeRefunds.length > 0
          ? methodFulfillmentOptions.filter(
              (option) => option.value === "on_hold"
            )
        : methodFulfillmentOptions.filter((option) =>
            ["on_hold", "cancelled"].includes(option.value)
          );
  const availableStatuses = permittedStatuses.some(
    (option) => option.value === fulfillmentStatus
  )
    ? permittedStatuses
    : [
        ...permittedStatuses,
        {
          value: fulfillmentStatus,
          label: storeFulfillmentStatusLabel(
            fulfillmentStatus,
            fulfillmentMethod
          ),
        },
      ];

  async function handleSubmit(event) {
    event.preventDefault();
    setFormMessage("");
    setFormError("");

    if (
      !pickupOrder &&
      trackingUrl.trim() &&
      !safeHttpsUrl(trackingUrl.trim())
    ) {
      setFormError("Tracking links must be valid HTTPS URLs.");
      return;
    }

    if (
      fulfillmentOnHold &&
      fulfillmentStatus !== currentStatus &&
      !permittedStatuses.some((option) => option.value === fulfillmentStatus)
    ) {
      setFormError("This payment or refund lifecycle must remain on hold.");
      return;
    }

    try {
      await onSave({
        id: order.id,
        fulfillmentStatus,
        trackingNumber: pickupOrder ? "" : trackingNumber.trim(),
        trackingUrl: pickupOrder ? "" : trackingUrl.trim(),
        internalNotes: internalNotes.trim(),
      });
      setFormMessage("Fulfillment details saved.");
    } catch (error) {
      setFormError(error.message || "Could not save this order.");
    }
  }

  const orderLabel = order.order_number || String(order.id).slice(0, 8);
  const rushProduction = isExpeditedProduction(order);
  const rushDueState = productionDueState(order);
  const productionDueDate = productionDueDateKey(order);
  const productionDueLabel = formatProductionDueDate(order);
  const capacityStateLabel = expeditedCapacityStateLabel(order);
  const capacityStateClasses = expeditedCapacityStateClasses(order);

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
        rushDueState === "overdue"
          ? "border-rose-400 ring-2 ring-rose-100"
          : rushDueState === "due-today"
            ? "border-orange-300 ring-2 ring-orange-100"
            : rushProduction
              ? "border-amber-200"
              : "border-slate-200"
      }`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded((current) => !current)}
        className={`grid w-full gap-4 px-5 py-5 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-cyan-200 md:grid-cols-[1.2fr_1fr_auto_auto_auto] md:items-center ${
          rushDueState === "overdue"
            ? "bg-rose-50/70 hover:bg-rose-100/70"
            : rushDueState === "due-today"
              ? "bg-orange-50/60 hover:bg-orange-100/60"
              : "hover:bg-cyan-50/50"
        }`}
      >
        <span>
          <span className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-700">
            <span>Order {orderLabel}</span>
            {isExpeditedProduction(order) ? (
              <span className="rounded-full bg-amber-300 px-2.5 py-1 text-[0.65rem] tracking-[0.13em] text-amber-950 shadow-sm">
                Rush · 1 business day
              </span>
            ) : null}
            {rushProduction ? (
              <>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[0.65rem] tracking-[0.1em] ${capacityStateClasses}`}
                >
                  Capacity: {capacityStateLabel}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[0.65rem] tracking-[0.1em] ${
                    rushDueState === "overdue"
                      ? "bg-rose-600 text-white"
                      : rushDueState === "due-today"
                        ? "bg-orange-500 text-white"
                        : !productionDueDate
                          ? "bg-rose-100 text-rose-900"
                          : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {rushDueState === "overdue"
                    ? `Overdue · due ${productionDueLabel}`
                    : rushDueState === "due-today"
                      ? `Due today · ${productionDueLabel}`
                      : !productionDueDate
                        ? "Production due date missing"
                        : `Due ${productionDueLabel}`}
                </span>
              </>
            ) : null}
          </span>
          <span className="mt-1 block text-lg font-black text-slate-950">
            {order.customer_name || order.customer_email || "Customer name unavailable"}
          </span>
          <span className="mt-1 block text-sm text-slate-500">
            {formatDate(order.created_at)}
          </span>
        </span>

        <span>
          <span className="block text-sm font-semibold text-slate-700">
            {itemCount(order)} {itemCount(order) === 1 ? "item" : "items"}
          </span>
          <span className="mt-1 block text-lg font-black text-slate-950">
            {formatMoney(order.total_cents, order.currency)}
          </span>
          <span className="mt-1 block text-xs font-semibold text-slate-500">
            {order.fulfillment_option_name ||
              (pickupOrder ? "Local pickup" : "Shipping")}
          </span>
          <span
            className={`mt-1 block text-xs font-black ${
              isExpeditedProduction(order)
                ? "text-amber-700"
                : "text-slate-500"
            }`}
          >
            {productionName(order)}
          </span>
        </span>

        <span className="flex md:justify-center">
          <StatusBadge value={order.payment_status} type="payment" />
        </span>

        <span className="flex md:justify-center">
          <StatusBadge
            value={order.fulfillment_status || "unfulfilled"}
            type="fulfillment"
            label={fulfillmentLabel(order)}
          />
        </span>

        <span className="flex min-h-10 items-center justify-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">
          <span>{expanded ? "Close" : "Manage"}</span>
          <span aria-hidden="true">{expanded ? "−" : "+"}</span>
        </span>
      </button>

      {expanded ? (
        <div id={detailsId} className="border-t border-slate-200 bg-slate-50/70 p-5 md:p-6">
          <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-950">Items</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Product and price snapshots recorded at checkout.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {receiptUrl ? (
                    <a
                      href={receiptUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-800 hover:bg-cyan-100"
                    >
                      Customer receipt ↗
                    </a>
                  ) : null}
                  {dashboardUrl ? (
                    <a
                      href={dashboardUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800 hover:bg-violet-100"
                    >
                      Stripe payment ↗
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[540px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="pb-3 pr-4 font-bold">Product</th>
                      <th className="pb-3 pr-4 font-bold">SKU</th>
                      <th className="pb-3 pr-4 text-right font-bold">Qty</th>
                      <th className="pb-3 text-right font-bold">Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(order.store_order_items ?? []).map((item) => (
                      <tr key={item.id || `${item.sku}-${item.product_name}`} className="border-b border-slate-100 last:border-b-0">
                        <td className="py-3 pr-4 font-bold text-slate-900">
                          {item.product_name || "Unnamed product"}
                          <span className="mt-0.5 block text-xs font-normal text-slate-500">
                            {formatMoney(item.unit_amount_cents, order.currency)} each
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-600">
                          {item.sku || "—"}
                        </td>
                        <td className="py-3 pr-4 text-right font-semibold text-slate-800">
                          {Number(item.quantity ?? 0)}
                        </td>
                        <td className="py-3 text-right font-bold text-slate-950">
                          {formatMoney(
                            item.line_total_cents ??
                              Number(item.unit_amount_cents ?? 0) *
                                Number(item.quantity ?? 0),
                            order.currency
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(order.store_order_items ?? []).length === 0 ? (
                <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  No line items were returned for this order.
                </p>
              ) : null}
            </section>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
              <section
                className={`rounded-2xl border p-5 ${
                  rushDueState === "overdue"
                    ? "border-rose-400 bg-rose-50"
                    : rushDueState === "due-today"
                      ? "border-orange-300 bg-orange-50"
                      : rushProduction
                        ? "border-amber-300 bg-amber-50"
                        : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-black text-slate-950">
                    Production
                  </h3>
                  {rushProduction ? (
                    <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-amber-950">
                      Rush
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 font-black text-slate-950">
                  {productionName(order)}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {pickupOrder ? "Build and mark ready" : "Build and dispatch"}{" "}
                  within {productionMaxBusinessDays(order)} business{" "}
                  {productionMaxBusinessDays(order) === 1 ? "day" : "days"}.
                  {!pickupOrder ? " Carrier transit is additional." : ""}
                </p>
                <dl className="mt-4 grid gap-2 text-sm">
                  {rushProduction ? (
                    <div
                      className={`rounded-xl border px-3 py-3 ${
                        rushDueState === "overdue"
                          ? "border-rose-300 bg-rose-100 text-rose-950"
                          : rushDueState === "due-today"
                            ? "border-orange-300 bg-orange-100 text-orange-950"
                            : !productionDueDate
                              ? "border-rose-200 bg-rose-100 text-rose-950"
                              : "border-amber-200 bg-amber-100 text-amber-950"
                      }`}
                    >
                      <dt className="text-xs font-black uppercase tracking-[0.12em] opacity-70">
                        Production due
                      </dt>
                      <dd className="mt-1 font-black">
                        {rushDueState === "overdue" ? "Overdue · " : ""}
                        {rushDueState === "due-today" ? "Due today · " : ""}
                        {productionDueLabel}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-current/10 px-3 py-2">
                    <dt className="text-slate-600">Rush capacity</dt>
                    <dd
                      className={`rounded-full border px-2.5 py-1 text-xs font-black ${capacityStateClasses}`}
                    >
                      {capacityStateLabel}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex items-center justify-between gap-4 border-t border-current/10 pt-3 text-sm">
                  <span className="text-slate-600">Production fee</span>
                  <span className="font-black text-slate-950">
                    {Number(order.production_cents ?? 0) > 0
                      ? formatMoney(order.production_cents, order.currency)
                      : "Included"}
                  </span>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-lg font-black text-slate-950">
                  {pickupOrder ? "Scheduled pickup" : "Ship to"}
                </h3>
                {pickupOrder ? (
                  <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-950">
                    <p className="font-black">
                      {order.fulfillment_option_name ||
                        "Scheduled pickup — Elverson, PA"}
                    </p>
                    <p className="mt-1">
                      After the order is built, email the customer to arrange a
                      pickup time. Share the exact pickup address and instructions
                      privately in that email, then record the agreed time in
                      Internal notes.
                    </p>
                    <p className="mt-2 text-xs font-semibold text-cyan-800">
                      Set Ready for pickup after the order is built and the
                      arrangement email is sent. Set Picked up only after
                      handoff.
                    </p>
                    {order.customer_email ? (
                      <a
                        href={
                          "mailto:" +
                          order.customer_email +
                          "?subject=" +
                          encodeURIComponent(
                            "SeaPals order " +
                              orderLabel +
                              " pickup scheduling"
                          )
                        }
                        className="mt-3 inline-flex rounded-full border border-cyan-300 bg-white px-3 py-2 text-xs font-black text-cyan-800 hover:bg-cyan-100"
                      >
                        Email customer to arrange pickup
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <address className="mt-3 space-y-1 text-sm not-italic leading-6 text-slate-700">
                    <p className="font-bold text-slate-950">
                      {address.name || order.customer_name || "Name unavailable"}
                    </p>
                    {address.line1 ? <p>{address.line1}</p> : null}
                    {address.line2 ? <p>{address.line2}</p> : null}
                    {cityLine(address) ? <p>{cityLine(address)}</p> : null}
                    {address.country ? (
                      <p>{String(address.country).toUpperCase()}</p>
                    ) : null}
                  </address>
                )}
                {!pickupOrder && !address.line1 ? (
                  <p className="mt-3 text-sm font-semibold text-rose-700">
                    Shipping address is missing.
                  </p>
                ) : null}
                <div className="mt-4 border-t border-slate-100 pt-4 text-sm">
                  <p className="break-all text-slate-700">
                    {order.customer_email || "Email unavailable"}
                  </p>
                  {address.phone ? <p className="mt-1 text-slate-700">{address.phone}</p> : null}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-lg font-black text-slate-950">Payment</h3>
                <div className="mt-4">
                  <Totals order={order} />
                </div>
                {refundRecords.length > 0 ? (
                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                      Refund lifecycle
                    </p>
                    {refundRecords.map((refund) => (
                      <div
                        key={refund.id || refund.provider_refund_id}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <StatusBadge value={refund.status} type="payment" />
                          <span className="font-black text-slate-800">
                            {formatMoney(refund.amount_cents, refund.currency)}
                          </span>
                        </div>
                        <p className="mt-2 break-all font-mono text-[11px] text-slate-500">
                          {refund.provider_refund_id}
                        </p>
                        {refund.pending_reason ? (
                          <p className="mt-1 font-semibold text-amber-800">
                            Pending reason: {statusLabel(refund.pending_reason)}
                          </p>
                        ) : null}
                        {refund.failure_reason ? (
                          <p className="mt-1 font-semibold text-rose-800">
                            Failure reason: {statusLabel(refund.failure_reason)}
                          </p>
                        ) : null}
                        <p className="mt-1 text-slate-500">
                          Updated {formatDate(refund.provider_updated_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
                <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs">
                  <div className="flex justify-between gap-4">
                    <dt className="font-semibold text-slate-500">Paid</dt>
                    <dd className="text-right font-semibold text-slate-700">
                      {formatDate(order.paid_at)}
                    </dd>
                  </div>
                  {order.refunded_at ? (
                    <div className="flex justify-between gap-4">
                      <dt className="font-semibold text-slate-500">Refund updated</dt>
                      <dd className="text-right font-semibold text-slate-700">
                        {formatDate(order.refunded_at)}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-4">
                    <dt className="font-semibold text-slate-500">Mode</dt>
                    <dd className="font-bold text-slate-700">
                      {order.payment_livemode === true ? "Live" : "Test"}
                    </dd>
                  </div>
                  {order.payment_intent_id ? (
                    <div>
                      <dt className="font-semibold text-slate-500">Payment intent</dt>
                      <dd className="mt-1 break-all font-mono text-[11px] text-slate-700">
                        {order.payment_intent_id}
                      </dd>
                    </div>
                  ) : null}
                  {order.charge_id ? (
                    <div>
                      <dt className="font-semibold text-slate-500">Charge</dt>
                      <dd className="mt-1 break-all font-mono text-[11px] text-slate-700">
                        {order.charge_id}
                      </dd>
                    </div>
                  ) : null}
                  {order.dispute_id ? (
                    <div>
                      <dt className="font-semibold text-slate-500">Dispute</dt>
                      <dd className="mt-1 break-all font-mono text-[11px] text-slate-700">
                        {order.dispute_id}
                      </dd>
                      <dd className="mt-1 font-bold text-slate-700">
                        {statusLabel(order.dispute_status)} - updated {formatDate(order.dispute_updated_at)}
                      </dd>
                    </div>
                  ) : null}
                  {order.receipt_number ? (
                    <div className="flex justify-between gap-4">
                      <dt className="font-semibold text-slate-500">
                        Receipt number
                      </dt>
                      <dd className="text-right font-mono text-[11px] font-bold text-slate-700">
                        {order.receipt_number}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            </div>
          </div>

          {fulfillmentOnHold ? (
            <div className="mt-5 rounded-2xl border border-rose-300 bg-rose-50 px-5 py-4 text-sm text-rose-900">
              <p className="font-black">
                {activeRefunds.length > 0 ? "Refund pending" : "Fulfillment hold"}
              </p>
              <p className="mt-1 leading-6">
                {activeRefunds.length > 0
                  ? "Stripe has not completed this refund. Keep the order on hold; do not treat the amount as refunded unless the Refund status becomes Succeeded."
                  : paymentStatus === "partially_refunded"
                  ? "This order has a partial refund. Keep it on hold and resolve the order before shipping."
                  : paymentStatus === "disputed"
                    ? "This payment is disputed. Do not pack or ship the order while the dispute is open."
                    : paymentStatus === "chargeback"
                      ? "This dispute was lost. The charge was reversed and this unfulfilled order must remain cancelled."
                      : "This order was refunded and must not be fulfilled."}
              </p>
            </div>
          ) : null}

          {failedRefunds.length > 0 ? (
            <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
              <p className="font-black">Refund needs attention</p>
              <p className="mt-1 leading-6">
                A refund failed or was canceled. The failed amount is not included
                in Refunded above, inventory was not restocked, and fulfillment
                remains on hold until you retry or deliberately resume the order.
              </p>
            </div>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className="mt-5 rounded-2xl border border-cyan-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-950">
                  Fulfillment
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {pickupOrder
                    ? "Workflow: Awaiting production, In production, Packing for pickup, Ready for pickup, then Picked up."
                    : "Workflow: Awaiting production, In production, Packing, Awaiting shipment, then Shipped."}
                </p>
              </div>
              {savedTrackingUrl ? (
                <a
                  href={savedTrackingUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm font-bold text-cyan-700 hover:text-cyan-900"
                >
                  Open saved tracking ↗
                </a>
              ) : null}
            </div>

            <div
              className={`mt-5 grid gap-4 ${
                pickupOrder ? "md:grid-cols-1" : "md:grid-cols-3"
              }`}
            >
              <label className="text-sm font-bold text-slate-700">
                Fulfillment status
                <select
                  value={fulfillmentStatus}
                  onChange={(event) => setFulfillmentStatus(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                >
                  {availableStatuses.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {!pickupOrder ? (
                <>
                  <label className="text-sm font-bold text-slate-700">
                    Tracking number
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(event) => setTrackingNumber(event.target.value)}
                      placeholder="e.g. 9400 1000 0000"
                      className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                    />
                  </label>

                  <label className="text-sm font-bold text-slate-700">
                    Tracking URL
                    <input
                      type="url"
                      inputMode="url"
                      value={trackingUrl}
                      onChange={(event) => setTrackingUrl(event.target.value)}
                      placeholder="https://carrier.example/track/..."
                      className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                    />
                  </label>
                </>
              ) : null}
            </div>

            <label className="mt-4 block text-sm font-bold text-slate-700">
              {pickupOrder ? "Internal notes — pickup schedule" : "Internal notes"}
              <textarea
                value={internalNotes}
                onChange={(event) => setInternalNotes(event.target.value)}
                rows={3}
                placeholder={
                  pickupOrder
                    ? "Agreed pickup date and time, contact attempts, or handoff notes."
                    : "Packing details, exceptions, or follow-up notes."
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
            </label>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div aria-live="polite" className="min-h-5 text-sm font-semibold">
                {formError ? <span className="text-rose-700">{formError}</span> : null}
                {!formError && formMessage ? (
                  <span className="text-emerald-700">{formMessage}</span>
                ) : null}
              </div>
              <button
                type="submit"
                disabled={saving || !hasChanges}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-cyan-700 px-5 py-3 font-black text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {saving ? "Saving…" : hasChanges ? "Save fulfillment" : "Saved"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </article>
  );
}

export default function OrdersDashboard() {
  const [adminToken, setAdminToken] = useState("");
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [query, setQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("all");
  const [paPeriodEnd, setPaPeriodEnd] = useState(() => currentPaQuarterEnd());
  const [paLinkedPeriod, setPaLinkedPeriod] = useState(null);
  const [paLinkScrollPending, setPaLinkScrollPending] = useState(false);
  const [paFilingOrders, setPaFilingOrders] = useState(null);
  const [paFilingLoading, setPaFilingLoading] = useState(false);
  const [paFilingError, setPaFilingError] = useState("");
  const [paFilingNotice, setPaFilingNotice] = useState("");
  const [paAccountNumber, setPaAccountNumber] = useState("");
  const [paEntityId, setPaEntityId] = useState("");
  const [paEntityIdType, setPaEntityIdType] = useState("001");
  const [paUseTaxDollars, setPaUseTaxDollars] = useState("");
  const [paCreditDollars, setPaCreditDollars] = useState("");
  const [paTpprCredit, setPaTpprCredit] = useState(false);
  const [paOtherCredit, setPaOtherCredit] = useState(false);
  const [paWebsiteOnlyConfirmed, setPaWebsiteOnlyConfirmed] = useState(false);
  const [paUseTaxReviewed, setPaUseTaxReviewed] = useState(false);
  const [paStripeReviewed, setPaStripeReviewed] = useState(false);
  const [paUploadReviewConfirmed, setPaUploadReviewConfirmed] = useState(false);

  useEffect(() => {
    try {
      const storedToken = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
      if (storedToken) setAdminToken(storedToken);
    } catch {
      // The page still works when browser storage is unavailable.
    }
  }, []);

  const orderList = orders ?? [];
  const paidOrders = useMemo(() => orderList.filter(isPaid), [orderList]);
  const paidUnshippedOrders = useMemo(
    () => orderList.filter(isPaidUnshipped),
    [orderList]
  );
  const availablePaQuarters = useMemo(() => {
    const periods = paQuarterOptions();
    if (
      !paLinkedPeriod ||
      periods.some((period) => period.periodEnd === paLinkedPeriod.periodEnd)
    ) {
      return periods;
    }
    return [...periods, paLinkedPeriod].sort((left, right) =>
      right.periodEnd.localeCompare(left.periodEnd)
    );
  }, [paLinkedPeriod]);

  useEffect(() => {
    const requestedPeriodEnd = new URLSearchParams(
      window.location.search
    ).get("paPeriodEnd")?.trim();
    if (!requestedPeriodEnd) return;

    try {
      const period = paQuarterPeriod(requestedPeriodEnd);
      setPaLinkedPeriod(period);
      setPaPeriodEnd(period.periodEnd);
      setPaLinkScrollPending(true);
      setPaFilingOrders(null);
      setPaFilingError("");
      setPaFilingNotice(
        `${period.label} was selected from the secure email link. Reconcile the complete period to prepare its CSV.`
      );
    } catch {
      setPaFilingError(
        "The emailed filing-period link is invalid. Select the quarter manually."
      );
    }
  }, []);

  useEffect(() => {
    if (!paLinkScrollPending || orders === null) return;
    const filingWorkspace = document.getElementById("pa-sales-tax-filing");
    if (!filingWorkspace) return;
    filingWorkspace.scrollIntoView({ block: "start" });
    filingWorkspace.focus({ preventScroll: true });
    setPaLinkScrollPending(false);
  }, [orders, paLinkScrollPending]);
  const paReconciliation = useMemo(
    () =>
      paFilingOrders === null
        ? null
        : reconcilePaSalesTaxPeriod(paFilingOrders, paPeriodEnd),
    [paFilingOrders, paPeriodEnd]
  );
  const selectedPaPeriod = useMemo(
    () => paQuarterPeriod(paPeriodEnd),
    [paPeriodEnd]
  );
  const paPeriodClosed =
    Date.now() >= Date.parse(selectedPaPeriod.endExclusiveIso);
  const paAttestationsComplete =
    paWebsiteOnlyConfirmed &&
    paUseTaxReviewed &&
    paStripeReviewed &&
    paUploadReviewConfirmed;

  const fulfillmentStatuses = useMemo(() => {
    const values = new Set(FULFILLMENT_OPTIONS.map((option) => option.value));
    orderList.forEach((order) => {
      values.add(cleanStatus(order.fulfillment_status, "unfulfilled"));
    });
    return [...values];
  }, [orderList]);

  const paymentStatuses = useMemo(() => {
    const values = new Set();
    orderList.forEach((order) => values.add(cleanStatus(order.payment_status)));
    return [...values].sort();
  }, [orderList]);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return orderList
      .filter((order) => {
        if (
          paymentFilter !== "all" &&
          cleanStatus(order.payment_status) !== paymentFilter
        ) {
          return false;
        }

        if (
          fulfillmentFilter === "paid-unshipped" &&
          !isPaidUnshipped(order)
        ) {
          return false;
        }

        if (
          fulfillmentFilter === "pickup-orders" &&
          !isPickup(order)
        ) {
          return false;
        }

        if (
          fulfillmentFilter === "rush-orders" &&
          !isExpeditedProduction(order)
        ) {
          return false;
        }

        if (
          fulfillmentFilter !== "all" &&
          fulfillmentFilter !== "paid-unshipped" &&
          fulfillmentFilter !== "pickup-orders" &&
          fulfillmentFilter !== "rush-orders" &&
          cleanStatus(order.fulfillment_status, "unfulfilled") !==
            fulfillmentFilter
        ) {
          return false;
        }

        if (!normalizedQuery) return true;

        const itemText = (order.store_order_items ?? [])
          .map((item) => `${item.sku} ${item.product_name}`)
          .join(" ");
        const searchable = [
          order.order_number,
          order.id,
          order.customer_name,
          order.customer_email,
          order.tracking_number,
          order.receipt_number,
          order.payment_intent_id,
          order.charge_id,
          order.fulfillment_method,
          order.fulfillment_option_name,
          order.production_option_id,
          order.production_option_name,
          order.production_due_date,
          order.expedited_capacity_state,
          order.pickup_location,
          itemText,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(normalizedQuery);
      })
      .sort((first, second) => {
        if (fulfillmentFilter === "rush-orders") {
          const actionableDifference =
            Number(!isActionablePaidRush(first)) -
            Number(!isActionablePaidRush(second));
          if (actionableDifference !== 0) return actionableDifference;

          const firstDueDate = productionDueDateKey(first);
          const secondDueDate = productionDueDateKey(second);
          if (firstDueDate !== secondDueDate) {
            if (!firstDueDate) return -1;
            if (!secondDueDate) return 1;
            return firstDueDate.localeCompare(secondDueDate);
          }

          const firstTime =
            new Date(first.paid_at ?? first.created_at ?? 0).getTime() || 0;
          const secondTime =
            new Date(second.paid_at ?? second.created_at ?? 0).getTime() || 0;
          return firstTime - secondTime;
        }
        const firstTime = new Date(first.created_at ?? 0).getTime() || 0;
        const secondTime = new Date(second.created_at ?? 0).getTime() || 0;
        return secondTime - firstTime;
      });
  }, [fulfillmentFilter, orderList, paymentFilter, query]);

  const stats = useMemo(() => {
    const now = new Date();
    const inProduction = orderList.filter(
      (order) => cleanStatus(order.fulfillment_status) === "in_production"
    ).length;
    const awaitingShipment = orderList.filter(
      (order) => cleanStatus(order.fulfillment_status) === "awaiting_shipment"
    ).length;
    const shipped = orderList.filter((order) =>
      ["shipped"].includes(cleanStatus(order.fulfillment_status))
    ).length;
    const pickup = orderList.filter(
      (order) =>
        isPickup(order) &&
        isPaid(order) &&
        !["picked_up", "cancelled"].includes(
          cleanStatus(order.fulfillment_status)
        )
    ).length;
    const paidTotal = paidOrders.reduce(
      (sum, order) => sum + Number(order.total_cents ?? 0),
      0
    );
    const currency = paidOrders[0]?.currency || "usd";
    const rushQueue = orderList.filter(isActionablePaidRush).length;
    const overdueRush = orderList.filter(
      (order) => productionDueState(order, now) === "overdue"
    ).length;

    return {
      inProduction,
      awaitingShipment,
      pickup,
      shipped,
      paidTotal,
      currency,
      rushQueue,
      overdueRush,
    };
  }, [orderList, paidOrders]);

  async function loadOrders(event) {
    event?.preventDefault();
    const token = adminToken.trim();

    setError("");
    setNotice("");

    if (!token) {
      setError("Enter the staff admin token to load orders.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/admin/store-orders", {
        method: "GET",
        headers: { "x-admin-token": token },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          try {
            window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
          } catch {
            // Ignore unavailable browser storage.
          }
        }
        throw new Error(payload.error || "Could not load store orders.");
      }

      const nextOrders = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.orders)
          ? payload.orders
          : [];

      setOrders(nextOrders);
      setLastUpdated(new Date());
      setNotice(
        `${nextOrders.length} ${nextOrders.length === 1 ? "order" : "orders"} loaded.`
      );

      try {
        window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      } catch {
        // The token remains in memory for this page when storage is unavailable.
      }
    } catch (requestError) {
      setError(requestError.message || "Could not load store orders.");
    } finally {
      setLoading(false);
    }
  }

  function forgetToken() {
    try {
      window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Ignore unavailable browser storage.
    }

    setAdminToken("");
    setOrders(null);
    setError("");
    setNotice("The staff token was cleared from this tab.");
    setLastUpdated(null);
    setPaFilingOrders(null);
    setPaAccountNumber("");
    setPaEntityId("");
    setPaUseTaxDollars("");
    setPaCreditDollars("");
    setPaTpprCredit(false);
    setPaOtherCredit(false);
    resetPaFilingReview();
    setPaFilingError("");
    setPaFilingNotice("");
  }

  async function saveFulfillment(update) {
    const token = adminToken.trim();
    if (!token) throw new Error("Enter the staff admin token again.");

    setSavingId(update.id);
    setError("");

    try {
      const response = await fetch("/api/admin/store-orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify({
          id: update.id,
          fulfillmentStatus: update.fulfillmentStatus,
          trackingNumber: update.trackingNumber,
          trackingUrl: update.trackingUrl,
          internalNotes: update.internalNotes,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Could not update fulfillment.");
      }

      const returnedOrder =
        payload.order && typeof payload.order === "object" ? payload.order : null;

      setOrders((current) =>
        (current ?? []).map((order) =>
          order.id === update.id
            ? {
                ...order,
                ...(returnedOrder ?? {}),
                fulfillment_status:
                  returnedOrder?.fulfillment_status ?? update.fulfillmentStatus,
                tracking_number:
                  returnedOrder?.tracking_number ?? update.trackingNumber,
                tracking_url: returnedOrder?.tracking_url ?? update.trackingUrl,
                internal_notes:
                  returnedOrder?.internal_notes ?? update.internalNotes,
              }
            : order
        )
      );
      setLastUpdated(new Date());
    } finally {
      setSavingId("");
    }
  }

  function exportShippingCsv() {
    if (paidUnshippedOrders.length === 0) return;

    const csv = buildShippingCsv(paidUnshippedOrders);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsvFile(csv, `seapals-paid-unshipped-${date}.csv`, true);
    setNotice(
      `Exported ${paidUnshippedOrders.length} paid unshipped ${
        paidUnshippedOrders.length === 1 ? "order" : "orders"
      }.`
    );
  }

  function resetPaFilingReview() {
    setPaWebsiteOnlyConfirmed(false);
    setPaUseTaxReviewed(false);
    setPaStripeReviewed(false);
    setPaUploadReviewConfirmed(false);
  }

  async function requestPaFilingOrders() {
    const token = adminToken.trim();
    if (!token) {
      throw new Error("Enter the staff admin token before loading tax records.");
    }

    const response = await fetch(
      `/api/admin/store-orders?paPeriodEnd=${encodeURIComponent(paPeriodEnd)}`,
      {
        method: "GET",
        headers: { "x-admin-token": token },
        cache: "no-store",
      }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Could not load the filing period.");
    }
    return {
      orders: Array.isArray(payload.orders) ? payload.orders : [],
      period: payload.period,
    };
  }

  async function loadPaFilingPeriod() {
    setPaFilingError("");
    setPaFilingNotice("");

    setPaFilingLoading(true);
    try {
      const payload = await requestPaFilingOrders();
      const filingOrders = payload.orders;
      setPaFilingOrders(filingOrders);
      resetPaFilingReview();
      setPaFilingNotice(
        `Reconciled ${payload.period?.label || selectedPaPeriod.label} from the complete live-order ledger.`
      );
    } catch (requestError) {
      setPaFilingOrders(null);
      setPaFilingError(
        requestError.message || "Could not load the filing period."
      );
    } finally {
      setPaFilingLoading(false);
    }
  }

  function exportPaReconciliationCsv() {
    if (!paReconciliation) return;
    const csv = buildPaSalesTaxReconciliationCsv(paReconciliation);
    downloadCsvFile(
      csv,
      `seapals-pa-sales-tax-audit-${paPeriodEnd}.csv`,
      true
    );
    setPaFilingNotice(`Exported the ${selectedPaPeriod.label} website audit.`);
  }

  async function exportPaReturnCsv() {
    setPaFilingError("");
    setPaFilingNotice("");

    try {
      if (!paReconciliation?.ready) {
        throw new Error("Resolve every filing exception before creating the return file.");
      }
      if (!paPeriodClosed) {
        throw new Error("This quarter is still open. Create the return after the period ends.");
      }
      if (!paAttestationsComplete) {
        throw new Error("Complete all four quarterly review confirmations first.");
      }

      const creditCents = dollarsToCents(paCreditDollars, "Credit");
      const useTaxCents = dollarsToCents(paUseTaxDollars, "Use tax");
      if (creditCents > 0 && !paTpprCredit && !paOtherCredit) {
        throw new Error("Identify the entered credit as TPPR, Other, or both.");
      }
      if (creditCents === 0 && (paTpprCredit || paOtherCredit)) {
        throw new Error("Clear the credit-type boxes or enter the related credit amount.");
      }

      setPaFilingLoading(true);
      const latestPayload = await requestPaFilingOrders();
      const latestReconciliation = reconcilePaSalesTaxPeriod(
        latestPayload.orders,
        paPeriodEnd
      );
      if (
        paReconciliationFingerprint(latestReconciliation) !==
        paReconciliationFingerprint(paReconciliation)
      ) {
        setPaFilingOrders(latestPayload.orders);
        resetPaFilingReview();
        throw new Error(
          "The live ledger changed since your review. Review the refreshed totals and confirmations before downloading."
        );
      }
      if (!latestReconciliation.ready) {
        setPaFilingOrders(latestPayload.orders);
        resetPaFilingReview();
        throw new Error(
          "A new filing exception appeared. Review the refreshed ledger before downloading."
        );
      }

      const rows = latestReconciliation.rows.map((row) => ({ ...row }));
      rows[0].creditCents = creditCents;
      rows[0].tpprCredit = paTpprCredit;
      rows[0].otherCredit = paOtherCredit;
      rows[0].useTaxCents = useTaxCents;

      const csv = buildPaSalesTaxReturnCsv({
        accountNumber: paAccountNumber,
        entityId: paEntityId,
        entityIdType: paEntityIdType,
        periodEnd: paPeriodEnd,
        rows,
        returnType: "O",
      });
      // Deliberately omit a UTF-8 BOM from the state import file. Every field
      // is constrained to PA's published numeric/code schema.
      downloadCsvFile(csv, `seapals-pa-sales-tax-return-${paPeriodEnd}.csv`);
      setPaFilingNotice(
        "Created the myPATH return file. Upload it, review validation totals, and select Submit yourself."
      );
    } catch (filingError) {
      setPaFilingError(filingError.message || "The return file could not be created.");
    } finally {
      setPaFilingLoading(false);
    }
  }

  return (
    <main className="space-y-6 pb-16">
      <section className="overflow-hidden rounded-3xl border border-cyan-200 bg-gradient-to-br from-cyan-950 via-sky-900 to-cyan-800 px-6 py-8 text-white shadow-xl shadow-cyan-950/10 md:px-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
          Staff workspace
        </p>
        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight md:text-5xl">
              Orders & Fulfillment
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-cyan-50/80">
              Review paid orders, prepare product shipments, and keep tracking and
              packing notes together.
            </p>
          </div>
          {lastUpdated ? (
            <p className="text-sm font-semibold text-cyan-100/70">
              Updated {formatDate(lastUpdated)}
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <form onSubmit={loadOrders} className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <label className="min-w-0 flex-1 text-sm font-black text-slate-800">
            Staff admin token
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={adminToken}
              onChange={(event) => setAdminToken(event.target.value)}
              placeholder="Enter the private admin token"
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 py-3 font-mono text-sm text-slate-950 outline-none placeholder:font-sans placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-cyan-700 px-5 py-3 font-black text-white transition hover:bg-cyan-800 disabled:cursor-wait disabled:bg-cyan-400"
            >
              {loading ? "Loading…" : orders === null ? "Load orders" : "Refresh orders"}
            </button>
            {adminToken || orders !== null ? (
              <button
                type="button"
                onClick={forgetToken}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 px-5 py-3 font-bold text-slate-700 hover:bg-slate-50"
              >
                Forget token
              </button>
            ) : null}
          </div>
        </form>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          The token is kept only in this browser tab&apos;s session storage and is
          never added to the page URL.
        </p>

        <div aria-live="polite" className="mt-3 min-h-5 text-sm font-semibold">
          {error ? <p className="text-rose-700">{error}</p> : null}
          {!error && notice ? <p className="text-emerald-700">{notice}</p> : null}
        </div>
      </section>

      {orders !== null ? (
        <>
          <section aria-label="Order totals" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="All orders" value={orderList.length} />
            <StatCard label="Paid" value={paidOrders.length} tone="cyan" />
            <StatCard
              label="Rush queue"
              value={stats.rushQueue}
              detail="Paid rush orders not yet dispatched"
              tone="amber"
            />
            <StatCard
              label="Overdue rush"
              value={stats.overdueRush}
              detail={`Compared in ${STORE_TIME_ZONE}`}
              tone={stats.overdueRush > 0 ? "rose" : "emerald"}
            />
            <StatCard
              label="Shipping queue"
              value={paidUnshippedOrders.length}
              detail="Paid and not shipped"
              tone="amber"
            />
            <StatCard
              label="Local pickup"
              value={stats.pickup}
              detail="Paid and awaiting pickup"
              tone="cyan"
            />
            <StatCard
              label="In production"
              value={stats.inProduction}
              tone="amber"
            />
            <StatCard
              label="Awaiting shipment"
              value={stats.awaitingShipment}
              tone="amber"
            />
            <StatCard
              label="Paid total"
              value={formatMoney(stats.paidTotal, stats.currency)}
              detail={`${stats.shipped} shipped`}
              tone="emerald"
            />
          </section>

          <section
            id="pa-sales-tax-filing"
            tabIndex={-1}
            className="rounded-3xl border border-blue-200 bg-gradient-to-br from-white to-blue-50 p-5 shadow-sm md:p-6"
          >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                    Pennsylvania quarterly filing
                  </p>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800">
                    No filing-service fee
                  </span>
                </div>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  Build the myPATH return from the website ledger
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This prepares Pennsylvania&apos;s 14-field sales-return CSV and an
                  order-level audit. It never stores your license number or FEIN,
                  never sends bank details, and never submits or debits tax without
                  you. Tax owed is still due.
                </p>
              </div>
              <a
                href="https://mypath.pa.gov/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-blue-300 bg-white px-4 py-2 text-sm font-black text-blue-800 hover:bg-blue-50"
              >
                Open myPATH
              </a>
            </div>

            <div className="mt-5 grid gap-4 border-t border-blue-100 pt-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <label className="text-sm font-bold text-slate-700">
                Filing quarter
                <select
                  value={paPeriodEnd}
                  onChange={(event) => {
                    setPaPeriodEnd(event.target.value);
                    setPaFilingOrders(null);
                    setPaFilingError("");
                    setPaFilingNotice("");
                    setPaUseTaxDollars("");
                    setPaCreditDollars("");
                    setPaTpprCredit(false);
                    setPaOtherCredit(false);
                    resetPaFilingReview();
                  }}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  {availablePaQuarters.map((period) => (
                    <option key={period.periodEnd} value={period.periodEnd}>
                      {period.label} · ends {formatDate(`${period.periodEnd}T12:00:00Z`, false)}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-medium text-slate-500">
                  Scheduled return and payment due{
                  " "
                  }
                  {formatDate(`${selectedPaPeriod.dueDate}T12:00:00Z`, false)};
                  confirm the open period in myPATH.
                </span>
              </label>
              <button
                type="button"
                onClick={loadPaFilingPeriod}
                disabled={paFilingLoading}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-5 py-2 text-sm font-black text-white transition hover:bg-blue-800 disabled:cursor-wait disabled:bg-blue-300"
              >
                {paFilingLoading ? "Reconciling…" : "Reconcile complete period"}
              </button>
            </div>

            <div aria-live="polite" className="mt-3 min-h-5 text-sm font-semibold">
              {paFilingError ? <p className="text-rose-700">{paFilingError}</p> : null}
              {!paFilingError && paFilingNotice ? (
                <p className="text-emerald-700">{paFilingNotice}</p>
              ) : null}
            </div>

            {paReconciliation ? (
              <div className="mt-5 space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="Website PA gross"
                    value={formatMoney(paReconciliation.summary.paGrossSalesCents)}
                    detail={`${paReconciliation.summary.includedSales} included live sales`}
                    tone="cyan"
                  />
                  <StatCard
                    label="PA taxable"
                    value={formatMoney(paReconciliation.summary.paTaxableSalesCents)}
                  />
                  <StatCard
                    label="Tax collected"
                    value={formatMoney(
                      paReconciliation.summary.salesTaxCollectedCents
                    )}
                    tone="emerald"
                  />
                  <StatCard
                    label="Exceptions"
                    value={paReconciliation.summary.issueCount}
                    detail={`${paReconciliation.summary.excludedSales} test/outbound excluded from the PA return`}
                    tone={paReconciliation.ready ? "emerald" : "rose"}
                  />
                </div>

                {!paPeriodClosed ? (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                    <strong>This quarter is still open.</strong> You can preview the
                    ledger now, but the return download stays locked until after{
                    " "
                    }
                    {formatDate(
                      `${selectedPaPeriod.periodEnd}T12:00:00Z`,
                      false
                    )}.
                  </div>
                ) : null}

                {paReconciliation.issues.length > 0 ? (
                  <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4">
                    <h3 className="font-black text-rose-950">
                      Review required before filing
                    </h3>
                    <ul className="mt-2 space-y-2 text-sm leading-6 text-rose-900">
                      {paReconciliation.issues.map((issue, index) => (
                        <li key={`${issue.reference}-${issue.code}-${index}`}>
                          <strong>{issue.reference}:</strong> {issue.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
                    The website ledger reconciles without tax-rate, refund, or dispute
                    exceptions. A zero-sales quarter is valid and still produces the
                    required state row.
                  </div>
                )}

                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Jurisdiction</th>
                        <th className="px-4 py-3 text-right">Gross</th>
                        <th className="px-4 py-3 text-right">Taxable</th>
                        <th className="px-4 py-3 text-right">Collected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paReconciliation.rows.map((row) => {
                        const definition = PA_SALES_TAX_CODES.find(
                          (option) => option.code === row.code
                        );
                        return (
                          <tr key={row.code} className="border-t border-slate-100">
                            <td className="px-4 py-3 font-mono font-black text-slate-900">
                              {row.code}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-700">
                              {definition?.label}
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {formatMoney(row.grossSalesCents)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {formatMoney(row.netTaxableSalesCents)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {formatMoney(row.actualSalesTaxCollectedCents)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <label className="text-sm font-bold text-slate-700">
                    Sales License / Account ID
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      spellCheck={false}
                      value={paAccountNumber}
                      onChange={(event) => setPaAccountNumber(event.target.value)}
                      placeholder="8 or 11 digits"
                      className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </label>
                  <label className="text-sm font-bold text-slate-700">
                    Entity ID
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      spellCheck={false}
                      value={paEntityId}
                      onChange={(event) => setPaEntityId(event.target.value)}
                      placeholder="9-digit FEIN / SSN / ITIN"
                      className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </label>
                  <label className="text-sm font-bold text-slate-700">
                    Entity ID type
                    <select
                      value={paEntityIdType}
                      onChange={(event) => setPaEntityIdType(event.target.value)}
                      className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    >
                      {PA_ENTITY_ID_TYPES.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.code} · {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-bold text-slate-700">
                    PA state use tax due
                    <div className="mt-2 flex min-h-11 items-center rounded-xl border border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                      <span className="pl-3 text-slate-500">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={paUseTaxDollars}
                        onChange={(event) => {
                          setPaUseTaxDollars(event.target.value);
                          resetPaFilingReview();
                        }}
                        placeholder="0.00"
                        className="min-h-10 w-full rounded-xl px-2 py-2 font-mono text-slate-950 outline-none"
                      />
                    </div>
                    <span className="mt-1 block text-xs font-medium leading-5 text-slate-500">
                      Enter the tax amount, not the untaxed purchase price.
                    </span>
                  </label>
                  <label className="text-sm font-bold text-slate-700">
                    Return credit
                    <div className="mt-2 flex min-h-11 items-center rounded-xl border border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                      <span className="pl-3 text-slate-500">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={paCreditDollars}
                        onChange={(event) => {
                          setPaCreditDollars(event.target.value);
                          resetPaFilingReview();
                        }}
                        placeholder="0.00"
                        className="min-h-10 w-full rounded-xl px-2 py-2 font-mono text-slate-950 outline-none"
                      />
                    </div>
                    <span className="mt-1 block text-xs font-medium leading-5 text-slate-500">
                      Do not include prepayments or the timely-filer discount.
                    </span>
                  </label>
                  <fieldset className="rounded-xl border border-slate-300 bg-white p-3">
                    <legend className="px-1 text-sm font-bold text-slate-700">
                      Credit type
                    </legend>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={paTpprCredit}
                        onChange={(event) => {
                          setPaTpprCredit(event.target.checked);
                          resetPaFilingReview();
                        }}
                        className="size-4 accent-blue-700"
                      />
                      TPPR credit
                    </label>
                    <label className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={paOtherCredit}
                        onChange={(event) => {
                          setPaOtherCredit(event.target.checked);
                          resetPaFilingReview();
                        }}
                        className="size-4 accent-blue-700"
                      />
                      Other credit
                    </label>
                  </fieldset>
                </div>

                <p className="rounded-xl bg-slate-100 px-4 py-3 text-xs leading-5 text-slate-600">
                  The account and entity IDs stay only in this page&apos;s memory and
                  the downloaded file. They are cleared when you choose Forget token
                  or close the tab. E-911 is fixed at $0 because the current catalog
                  contains no prepaid-wireless products.
                </p>

                <fieldset className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <legend className="px-1 font-black text-slate-900">
                    Quarterly review
                  </legend>
                  {[
                    {
                      checked: paWebsiteOnlyConfirmed,
                      set: setPaWebsiteOnlyConfirmed,
                      label:
                        "All Pennsylvania sales for this period came through this website; there were no offline, exempt, or marketplace sales to add.",
                    },
                    {
                      checked: paUseTaxReviewed,
                      set: setPaUseTaxReviewed,
                      label:
                        "I reviewed untaxed business purchases used in Pennsylvania and entered any use tax due above.",
                    },
                    {
                      checked: paStripeReviewed,
                      set: setPaStripeReviewed,
                      label:
                        "I checked Stripe for live sales or refunds missing from this website ledger.",
                    },
                    {
                      checked: paUploadReviewConfirmed,
                      set: setPaUploadReviewConfirmed,
                      label:
                        "I will review myPATH's validation totals, select Submit, save the confirmation, and verify Processed status.",
                    },
                  ].map((confirmation) => (
                    <label
                      key={confirmation.label}
                      className="flex items-start gap-3 text-sm font-semibold leading-6 text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={confirmation.checked}
                        onChange={(event) => confirmation.set(event.target.checked)}
                        className="mt-1 size-4 shrink-0 accent-blue-700"
                      />
                      {confirmation.label}
                    </label>
                  ))}
                </fieldset>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={exportPaReturnCsv}
                    disabled={
                      paFilingLoading ||
                      !paReconciliation.ready ||
                      !paPeriodClosed ||
                      !paAttestationsComplete
                    }
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 py-2 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {paFilingLoading
                      ? "Checking live ledger…"
                      : "Download myPATH return CSV"}
                  </button>
                  <button
                    type="button"
                    onClick={exportPaReconciliationCsv}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
                  >
                    Download website audit CSV
                  </button>
                </div>

                <p className="text-xs leading-5 text-slate-500">
                  Pennsylvania says myPATH does not support automation. The final
                  authenticated upload, Submit action, and ACH approval therefore
                  remain yours; the portal itself charges no filing fee, and ACH
                  avoids the card convenience fee.
                </p>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="grid flex-1 gap-4 md:grid-cols-3">
                <label className="text-sm font-bold text-slate-700">
                  Search orders
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Order, customer, email, SKU…"
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Payment
                  <select
                    value={paymentFilter}
                    onChange={(event) => setPaymentFilter(event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  >
                    <option value="all">All payment statuses</option>
                    {paymentStatuses.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Fulfillment
                  <select
                    value={fulfillmentFilter}
                    onChange={(event) => setFulfillmentFilter(event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  >
                    <option value="all">All fulfillment statuses</option>
                    <option value="paid-unshipped">Paid & unshipped</option>
                    <option value="pickup-orders">Local pickup orders</option>
                    <option value="rush-orders">
                      Rush production orders (due date first)
                    </option>
                    {fulfillmentStatuses.map((status) => (
                      <option key={status} value={status}>
                        {storeFulfillmentStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <button
                type="button"
                onClick={exportShippingCsv}
                disabled={paidUnshippedOrders.length === 0}
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Export paid unshipped CSV ({paidUnshippedOrders.length})
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-100 pt-4 text-sm">
              <p className="font-semibold text-slate-600">
                Showing {filteredOrders.length} of {orderList.length} orders
              </p>
              {query || paymentFilter !== "all" || fulfillmentFilter !== "all" ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setPaymentFilter("all");
                    setFulfillmentFilter("all");
                  }}
                  className="font-bold text-cyan-700 hover:text-cyan-900"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </section>

          <section aria-label="Store orders" className="space-y-4">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onSave={saveFulfillment}
                saving={savingId === order.id}
              />
            ))}

            {filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                <h2 className="text-xl font-black text-slate-900">No matching orders</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Adjust the filters or refresh to check for new purchases.
                </p>
              </div>
            ) : null}
          </section>
        </>
      ) : (
        <section className="rounded-2xl border border-dashed border-cyan-300 bg-cyan-50 px-6 py-12 text-center">
          <h2 className="text-xl font-black text-cyan-950">Unlock the order queue</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-cyan-900/70">
            Enter the staff token above to view customer information and begin
            fulfillment.
          </p>
        </section>
      )}
    </main>
  );
}
