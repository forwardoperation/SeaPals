import Link from "next/link";
import { retrieveStripeCheckoutSession } from "@/lib/store/stripe.mjs";
import ClearCart from "./ClearCart";

export const metadata = {
  title: "Order received | SeaPals TCG",
  description: "Review the payment status for your SeaPals order.",
};

const PAYMENT_LABELS = {
  paid: "Paid",
  unpaid: "Not paid",
  no_payment_required: "No payment required",
  processing: "Processing",
  requires_payment_method: "Payment required",
  complete: "Complete",
  open: "In progress",
  expired: "Expired",
};

function firstString(...values) {
  const value = values.find(
    (candidate) => typeof candidate === "string" && candidate.trim()
  );
  return value ? value.trim().slice(0, 80) : null;
}

function getOrderNumber(session) {
  return firstString(
    session?.orderNumber,
    session?.order_number,
    session?.metadata?.orderNumber,
    session?.metadata?.order_number
  );
}

function getPaymentState(session) {
  const rawState = firstString(
    session?.paymentState,
    session?.payment_state,
    session?.paymentStatus,
    session?.payment_status,
    session?.status
  );

  return rawState && PAYMENT_LABELS[rawState]
    ? PAYMENT_LABELS[rawState]
    : "Status unavailable";
}

function getFulfillmentDetails(session) {
  const method = firstString(session?.metadata?.fulfillment_method);
  const optionName = firstString(session?.metadata?.fulfillment_option_name);
  const pickupLocation = firstString(session?.metadata?.pickup_location);
  const localPickup = method === "pickup";

  return {
    method: localPickup ? "pickup" : "shipping",
    optionName:
      optionName ?? (localPickup ? "Scheduled pickup — Elverson, PA" : null),
    pickupLocation:
      pickupLocation ?? (localPickup ? "Elverson, PA" : null),
  };
}

function firstNonNegativeInteger(...values) {
  const candidate = values.find((value) => {
    if (value === undefined || value === null || String(value).trim() === "") {
      return false;
    }
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0;
  });
  return candidate === undefined ? null : Number(candidate);
}

function getProductionDetails(session) {
  const metadata = session?.metadata ?? {};
  const id = firstString(metadata.production_option_id);
  const optionName = firstString(metadata.production_option_name);
  const maxBusinessDays = firstNonNegativeInteger(
    metadata.production_max_business_days
  );
  const amountCents = firstNonNegativeInteger(metadata.production_cents);

  if (!id && !optionName && maxBusinessDays === null && amountCents === null) {
    return null;
  }

  return {
    id,
    optionName: optionName ??
      (id === "expedited-production"
        ? "Expedited production"
        : "Standard production"),
    maxBusinessDays,
    amountCents,
  };
}

function formatProductionAmount(cents, currency) {
  if (!Number.isSafeInteger(cents) || cents <= 0) return "Included";

  try {
    return `+${new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(currency || "usd").toUpperCase(),
    }).format(cents / 100)} per order`;
  } catch {
    return `+$${(cents / 100).toFixed(2)} per order`;
  }
}

function getReceiptUrl(session) {
  const candidate = firstString(
    session?.receiptUrl,
    session?.receipt_url,
    session?.invoice?.hosted_invoice_url,
    session?.payment_intent?.latest_charge?.receipt_url
  );

  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    const hostname = url.hostname.toLowerCase();
    const isStripeHost =
      hostname === "stripe.com" || hostname.endsWith(".stripe.com");
    return url.protocol === "https:" && isStripeHost ? url.toString() : null;
  } catch {
    return null;
  }
}

export default async function StoreSuccessPage({ searchParams }) {
  const params = await searchParams;
  const sessionId =
    typeof params?.session_id === "string" ? params.session_id : null;
  let session = null;

  if (sessionId) {
    try {
      session = await retrieveStripeCheckoutSession(sessionId);
    } catch {
      session = null;
    }
  }

  const orderNumber = getOrderNumber(session);
  const paymentState = getPaymentState(session);
  const receiptUrl = getReceiptUrl(session);
  const fulfillment = getFulfillmentDetails(session);
  const production = getProductionDetails(session);
  const localPickup = fulfillment.method === "pickup";
  const paymentComplete =
    session?.payment_status === "paid" ||
    session?.paymentStatus === "paid" ||
    session?.payment_state === "paid" ||
    session?.paymentState === "paid" ||
    session?.payment_status === "no_payment_required";

  return (
    <main className="pb-16 md:pb-24">
      <ClearCart clearCart={paymentComplete} />
      <section className="relative isolate mx-auto max-w-3xl overflow-hidden rounded-[2rem] bg-[#062f46] px-6 py-10 text-white shadow-2xl shadow-cyan-950/15 sm:px-10 md:rounded-[2.75rem] md:px-14 md:py-14">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl"
        />

        <div className="relative">
          <span
            aria-hidden="true"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-300 text-3xl font-black text-emerald-950 shadow-lg shadow-black/15"
          >
            {session ? "\u2713" : "i"}
          </span>
          <p className="mt-7 text-sm font-black uppercase tracking-[0.2em] text-[#f7c948]">
            {paymentComplete ? "Order received" : "Order status"}
          </p>
          <h1 className="mt-3 font-serif text-4xl font-bold tracking-tight sm:text-5xl">
            {session
              ? paymentComplete
                ? localPickup
                  ? "Your pickup order is confirmed."
                  : "Your order is confirmed."
                : "Thanks for checking your order."
              : "We could not verify this checkout."}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-cyan-50/80">
            {session
              ? "Keep the order details below for your records."
              : "The checkout reference may be missing or unavailable. Return to the store to review your cart."}
          </p>

          {session ? (
            <dl className="mt-8 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/15 bg-white/5">
              <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <dt className="text-sm font-bold text-cyan-100/70">
                  Order number
                </dt>
                <dd className="font-black text-white">
                  {orderNumber ?? "Pending"}
                </dd>
              </div>
              <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <dt className="text-sm font-bold text-cyan-100/70">
                  Payment state
                </dt>
                <dd className="font-black text-white">{paymentState}</dd>
              </div>
              {production ? (
                <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <dt className="text-sm font-bold text-cyan-100/70">
                    Production
                  </dt>
                  <dd className="text-right font-black text-white">
                    {production.optionName}
                    <span className="mt-1 block text-xs font-semibold text-cyan-100/70">
                      {production.maxBusinessDays
                        ? `${localPickup ? "Built" : "Built and dispatched"} within ${production.maxBusinessDays} business ${production.maxBusinessDays === 1 ? "day" : "days"}. `
                        : ""}
                      {formatProductionAmount(
                        production.amountCents,
                        session?.currency
                      )}
                      {localPickup
                        ? " · We will email after it is built to arrange pickup."
                        : " · Carrier transit is separate."}
                    </span>
                  </dd>
                </div>
              ) : null}
              {fulfillment.optionName ? (
                <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <dt className="text-sm font-bold text-cyan-100/70">
                    Shipping or pickup
                  </dt>
                  <dd className="text-right font-black text-white">
                    {fulfillment.optionName}
                    {localPickup && fulfillment.pickupLocation ? (
                      <span className="mt-1 block text-xs font-semibold text-cyan-100/70">
                        After your order is built, we will email you to arrange a
                        pickup time in {fulfillment.pickupLocation} and privately
                        share the pickup instructions. No pickup time has been
                        scheduled yet.
                      </span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
              {receiptUrl ? (
                <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <dt className="text-sm font-bold text-cyan-100/70">
                    Receipt
                  </dt>
                  <dd>
                    <a
                      href={receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-black text-[#f7c948] underline decoration-amber-200/50 underline-offset-4 transition hover:text-[#ffda68] focus:outline-none focus:ring-4 focus:ring-cyan-200/40"
                    >
                      View receipt
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/store"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#f7c948] px-6 py-3 font-black text-[#082f49] transition hover:-translate-y-0.5 hover:bg-[#ffda68] focus:outline-none focus:ring-4 focus:ring-cyan-200/50"
            >
              Return to store
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 bg-white/10 px-6 py-3 font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/15 focus:outline-none focus:ring-4 focus:ring-cyan-200/40"
            >
              SeaPals home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
