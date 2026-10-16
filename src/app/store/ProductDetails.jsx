"use client";

import Image from "next/image";
import Link from "next/link";
import { getStorePreorderCampaign } from "@/data/store/preorders.js";
import { formatMoney } from "@/lib/store/cart.mjs";
import {
  getStoreProductById,
  getStoreProductOrderState,
} from "@/lib/store/productDetails.mjs";

export default function ProductDetails({
  product,
  products = [],
  currency,
  preorderCampaign,
  checkoutEnabled,
  quantityInCart = 0,
  cartCount = 0,
  isCheckingOut = false,
  onAddToCart,
}) {
  const campaign = preorderCampaign ?? getStorePreorderCampaign();
  const { canAdd, buttonLabel } = getStoreProductOrderState({
    product, checkoutEnabled, quantityInCart, cartCount, isCheckingOut,
  });
  const includedItems = product.includedItems?.length
    ? product.includedItems
    : product.details ? [product.details] : [];
  const trialDecks = Array.isArray(product.trialDecks) ? product.trialDecks : [];
  const dispatchDays = Number(product.buildDispatchMaxBusinessDays);
  const hasDispatchWindow = Number.isSafeInteger(dispatchDays) && dispatchDays > 0;

  return (
    <article className="min-w-0" aria-labelledby="product-detail-heading">
      <Link
        href="/store"
        className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-bold text-cyan-800 underline-offset-4 transition hover:text-cyan-950 hover:underline focus:outline-none focus:ring-4 focus:ring-cyan-200/70"
      >
        <span aria-hidden="true">←</span> Back to shop
      </Link>

      <div className="mt-5 overflow-hidden rounded-[1.75rem] border border-cyan-100 bg-white shadow-lg shadow-cyan-950/5">
        <div className="grid md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div className="relative aspect-[4/3] min-w-0 overflow-hidden bg-gradient-to-br from-cyan-100 via-sky-50 to-amber-50 md:aspect-auto md:min-h-80 lg:aspect-[4/3] xl:aspect-auto">
            <Image
              src={product.image}
              alt={product.imageAlt || `${product.name} product photo`}
              fill
              priority
              sizes="(max-width: 767px) 92vw, (max-width: 1023px) 45vw, (max-width: 1279px) 60vw, 400px"
              className="object-contain p-6 sm:p-8"
            />
          </div>

          <div className="flex min-w-0 flex-col justify-center p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">
                {product.productLabel || product.shortName}
              </p>
              {product.preorder ? (
                <span className="rounded-full bg-amber-200 px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-wider text-amber-950">
                  Pre-order
                </span>
              ) : null}
            </div>
            <h1 id="product-detail-heading" className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {product.name}
            </h1>
            <p className="mt-4 text-3xl font-black text-[#075b7d]">
              {product.priceCents == null ? "Price TBA" : formatMoney(product.priceCents, currency)}
            </p>
            {product.details ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">{product.details}</p>
            ) : null}

            <button
              type="button"
              disabled={!canAdd}
              onClick={() => onAddToCart(product)}
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#f7c948] px-5 py-3 font-black text-[#082f49] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#ffda68] focus:outline-none focus:ring-4 focus:ring-cyan-200/70 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
            >
              {buttonLabel}
            </button>
            {quantityInCart > 0 ? (
              <p className="mt-3 text-sm font-semibold text-slate-600" aria-live="polite">
                {quantityInCart} in your cart · <a href="#store-cart-summary" className="rounded font-bold text-cyan-800 underline underline-offset-4 focus:outline-none focus:ring-4 focus:ring-cyan-200/70">View cart</a>
              </p>
            ) : null}
            {product.availabilityNote && (!checkoutEnabled || !product.available) ? (
              <p className="mt-3 text-sm leading-6 text-slate-500">{product.availabilityNote}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-7 border-t border-slate-100 p-6 sm:p-8">
          <section aria-labelledby="product-about-heading">
            <h2 id="product-about-heading" className="text-xl font-black tracking-tight text-slate-950">About this product</h2>
            <p className="mt-3 leading-7 text-slate-600">{product.description}</p>
            {product.playerSetupNote ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-950">
                <p className="font-black">One kit supports two players</p>
                <p className="mt-1">{product.playerSetupNote}</p>
              </div>
            ) : null}
          </section>

          {includedItems.length ? (
            <section className="border-t border-slate-100 pt-6" aria-labelledby="product-contents-heading">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="product-contents-heading" className="text-xl font-black tracking-tight text-slate-950">What’s included</h2>
                {product.fullContentsHref ? (
                  <Link href={product.fullContentsHref} className="rounded font-bold text-cyan-800 underline decoration-cyan-300 underline-offset-4 hover:text-cyan-950 focus:outline-none focus:ring-4 focus:ring-cyan-200/70">Full deck contents</Link>
                ) : null}
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {includedItems.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {trialDecks.length ? (
            <section className="border-t border-slate-100 pt-6" aria-labelledby="product-preview-heading">
              <h2 id="product-preview-heading" className="text-xl font-black tracking-tight text-slate-950">Preview the {trialDecks.length > 1 ? "decks" : "deck"}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {product.simulatorNote || "Try this deck in our free online simulator before you order."}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {trialDecks.map((deck) => {
                  const retailName = getStoreProductById(products, deck.id)?.shortName ??
                    (trialDecks.length === 1 ? product.shortName : deck.name.replace(/\s+Deck$/i, ""));
                  return (
                    <Link key={deck.id} href={deck.href} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border-2 border-cyan-700 bg-cyan-50 px-4 py-2 text-center text-sm font-black text-cyan-900 transition hover:bg-cyan-100 focus:outline-none focus:ring-4 focus:ring-cyan-200/70">
                      Preview {retailName} online
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="border-t border-slate-100 pt-6" aria-labelledby="product-delivery-heading">
            <h2 id="product-delivery-heading" className="text-xl font-black tracking-tight text-slate-950">Ordering &amp; delivery</h2>
            {product.preorder ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-950">
                <p className="font-black">{campaign.fulfillmentLabel}</p>
                <p className="mt-2">{campaign.message}</p>
                <p className="mt-2">Items in this order ship together when the pre-order is ready. Order Dive Packs or accessories separately if you would like them sooner. Expedited production is unavailable for pre-orders.</p>
              </div>
            ) : (
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                {product.madeToOrder ? (
                  <p><strong className="font-bold text-cyan-900">Made to order.</strong>{hasDispatchWindow ? ` Standard production is included, with dispatch within ${dispatchDays} business ${dispatchDays === 1 ? "day" : "days"} after payment.` : " Production timing is shown in your cart."}</p>
                ) : null}
                <p>Available delivery choices are shown in your cart. Carrier transit time is separate from production.</p>
                {product.category === "dive-packs" ? (
                  <p>Dive Pack-only mailed orders up to 1 lb qualify for $5 Standard or $10 Priority Shipping &amp; Handling.</p>
                ) : null}
              </div>
            )}
            <Link href="/terms#purchases" className="mt-3 inline-block rounded text-sm font-bold text-cyan-800 underline underline-offset-4 hover:text-cyan-950 focus:outline-none focus:ring-4 focus:ring-cyan-200/70">Purchase terms</Link>
          </section>
        </div>
      </div>
    </article>
  );
}
