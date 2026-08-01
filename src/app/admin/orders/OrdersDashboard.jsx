"use client";

import { useEffect, useId, useMemo, useState } from "react";

const TOKEN_STORAGE_KEY = "seapals-store-admin-token";

const FULFILLMENT_OPTIONS = [
  { value: "unfulfilled", label: "Unfulfilled" },
  { value: "packing", label: "Packing" },
  { value: "ready_for_pickup", label: "Ready for pickup" },
  { value: "picked_up", label: "Picked up" },
  { value: "on_hold", label: "On hold" },
  { value: "shipped", label: "Shipped" },
  { value: "cancelled", label: "Cancelled" },
];

const READY_FULFILLMENT_STATUSES = new Set(["unfulfilled", "packing"]);
const PAYMENT_HOLD_STATUSES = new Set([
  "partially_refunded",
  "refunded",
  "disputed",
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

function isPaid(order) {
  return cleanStatus(order?.payment_status) === "paid";
}

function isPickup(order) {
  return cleanStatus(order?.fulfillment_method, "shipping") === "pickup";
}

function fulfillmentLabel(order) {
  const status = cleanStatus(order?.fulfillment_status, "unfulfilled");
  if (!isPickup(order)) return statusLabel(status);

  return (
    {
      unfulfilled: "Awaiting preparation",
      packing: "Preparing pickup",
      ready_for_pickup: "Ready for pickup",
      picked_up: "Picked up",
    }[status] || statusLabel(status)
  );
}

function isPaidUnshipped(order) {
  return (
    isPaid(order) &&
    !isPickup(order) &&
    READY_FULFILLMENT_STATUSES.has(
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
    normalized === "disputed"
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
  const fulfillmentOnHold = PAYMENT_HOLD_STATUSES.has(paymentStatus);
  const hasChanges =
    fulfillmentStatus !== currentStatus ||
    trackingNumber.trim() !== String(order.tracking_number ?? "").trim() ||
    trackingUrl.trim() !== String(order.tracking_url ?? "").trim() ||
    internalNotes.trim() !== String(order.internal_notes ?? "").trim();
  const methodFulfillmentOptions = FULFILLMENT_OPTIONS.filter((option) =>
    pickupOrder
      ? option.value !== "shipped"
      : !["ready_for_pickup", "picked_up"].includes(option.value)
  );
  const permittedStatuses = !fulfillmentOnHold
    ? methodFulfillmentOptions
    : currentStatus === "shipped"
      ? methodFulfillmentOptions.filter((option) => option.value === "shipped")
      : currentStatus === "picked_up"
        ? methodFulfillmentOptions.filter(
            (option) => option.value === "picked_up"
          )
      : paymentStatus === "refunded"
        ? methodFulfillmentOptions.filter(
            (option) => option.value === "cancelled"
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
        { value: fulfillmentStatus, label: statusLabel(fulfillmentStatus) },
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
      setFormError("Refunded or disputed orders must remain on hold.");
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

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded((current) => !current)}
        className="grid w-full gap-4 px-5 py-5 text-left transition hover:bg-cyan-50/50 focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-cyan-200 md:grid-cols-[1.2fr_1fr_auto_auto_2rem] md:items-center"
      >
        <span>
          <span className="block text-xs font-black uppercase tracking-[0.16em] text-cyan-700">
            Order {orderLabel}
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

        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-600"
        >
          {expanded ? "−" : "+"}
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
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-lg font-black text-slate-950">
                  {pickupOrder ? "Local pickup" : "Ship to"}
                </h3>
                {pickupOrder ? (
                  <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-950">
                    <p className="font-black">
                      {order.fulfillment_option_name ||
                        "Local pickup — Elverson, PA"}
                    </p>
                    <p className="mt-1">
                      Prepare the order, mark it ready for pickup, and contact
                      the customer before marking it picked up.
                    </p>
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
              <p className="font-black">Fulfillment hold</p>
              <p className="mt-1 leading-6">
                {paymentStatus === "partially_refunded"
                  ? "This order has a partial refund. Keep it on hold and resolve the order before shipping."
                  : paymentStatus === "disputed"
                    ? "This payment is disputed. Do not pack or ship the order while the dispute is open."
                    : "This order was refunded and must not be fulfilled."}
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
                    ? "Track preparation, customer notification, and pickup completion."
                    : "Update the packing status and add customer-facing tracking."}
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
              Internal notes
              <textarea
                value={internalNotes}
                onChange={(event) => setInternalNotes(event.target.value)}
                rows={3}
                placeholder="Packing details, exceptions, or follow-up notes."
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
          fulfillmentFilter !== "all" &&
          fulfillmentFilter !== "paid-unshipped" &&
          fulfillmentFilter !== "pickup-orders" &&
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
          order.pickup_location,
          itemText,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(normalizedQuery);
      })
      .sort((first, second) => {
        const firstTime = new Date(first.created_at ?? 0).getTime() || 0;
        const secondTime = new Date(second.created_at ?? 0).getTime() || 0;
        return secondTime - firstTime;
      });
  }, [fulfillmentFilter, orderList, paymentFilter, query]);

  const stats = useMemo(() => {
    const packing = orderList.filter(
      (order) => cleanStatus(order.fulfillment_status) === "packing"
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

    return { packing, pickup, shipped, paidTotal, currency };
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
    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `seapals-paid-unshipped-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotice(
      `Exported ${paidUnshippedOrders.length} paid unshipped ${
        paidUnshippedOrders.length === 1 ? "order" : "orders"
      }.`
    );
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
          <section aria-label="Order totals" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <StatCard label="All orders" value={orderList.length} />
            <StatCard label="Paid" value={paidOrders.length} tone="cyan" />
            <StatCard
              label="Ready to ship"
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
            <StatCard label="Packing" value={stats.packing} tone="amber" />
            <StatCard
              label="Paid total"
              value={formatMoney(stats.paidTotal, stats.currency)}
              detail={`${stats.shipped} shipped`}
              tone="emerald"
            />
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
                    <option value="paid-unshipped">Paid & ready to ship</option>
                    <option value="pickup-orders">Local pickup orders</option>
                    {fulfillmentStatuses.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
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
