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
  const paymentComplete =
    session?.payment_status === "paid" ||
    session?.paymentStatus === "paid" ||
    session?.payment_state === "paid" ||
    session?.paymentState === "paid" ||
    session?.payment_status === "no_payment_required";

  return (
    <main className="pb-16 md:pb-24">
      {paymentComplete ? <ClearCart /> : null}
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
                ? "Your reef is on its way."
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
