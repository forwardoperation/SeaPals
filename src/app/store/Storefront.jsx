"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const CART_STORAGE_KEY = "seapals-store-cart-v1";
const MAX_PRODUCT_QUANTITY = 10;
const MAX_CART_QUANTITY = 20;

const CATEGORY_ORDER = [
  "starter-kits",
  "expansion-decks",
  "game-accessories",
  "apparel",
  "storage",
  "plush-toys",
];

const CATEGORY_META = {
  "starter-kits": {
    label: "Starter Kits",
    eyebrow: "Start playing",
    description:
      "Two-player bundles with decks and the shared pieces needed for a complete match.",
  },
  "expansion-decks": {
    label: "Expansion Decks",
    eyebrow: "Choose a strategy",
    description:
      "Seven ready-to-play 60-card options, each with a different way to grow and defend your reef.",
  },
  "game-accessories": {
    label: "Game Accessories",
    eyebrow: "Build the table",
    description:
      "Dice, condition cards, and Reef Point tokens for expanding or refreshing your play setup.",
  },
  apparel: {
    label: "Custom T-Shirts",
    eyebrow: "Wear SeaPals",
    description:
      "Custom apparel is previewed here while size, color, design, and pricing choices are prepared.",
  },
  storage: {
    label: "Binders & Backpacks",
    eyebrow: "Carry the reef",
    description:
      "SeaPals storage gear for organizing cards and bringing a full play setup along.",
  },
  "plush-toys": {
    label: "Plush Toys",
    eyebrow: "Meet the crew",
    description:
      "A future collection of soft SeaPals character companions for players and ocean fans.",
  },
};

function unavailableButtonLabel(product) {
  if (product.requiresConfiguration) return "Options coming soon";
  if (product.priceCents === null || product.priceCents === undefined) {
    return "Price coming soon";
  }
  return "Not available yet";
}

function formatMoney(cents, currency) {
  const normalizedCurrency =
    typeof currency === "string" && currency.trim()
      ? currency.trim().toUpperCase()
      : "USD";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency,
    }).format(Number(cents ?? 0) / 100);
  } catch {
    return normalizedCurrency + " " + (Number(cents ?? 0) / 100).toFixed(2);
  }
}

function formatCatalogPrice(cents, currency) {
  if (cents === null || cents === undefined || !Number.isFinite(Number(cents))) {
    return "Price TBA";
  }

  return formatMoney(cents, currency);
}

function readStoredCart(productById) {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    let savedItems = [];

    if (Array.isArray(parsed)) {
      savedItems = parsed;
    } else if (Array.isArray(parsed?.items)) {
      savedItems = parsed.items;
    } else if (parsed && typeof parsed === "object") {
      savedItems = Object.entries(parsed).map(([productId, quantity]) => ({
        productId,
        quantity,
      }));
    }

    let savedTotal = 0;
    return savedItems.reduce((nextCart, item) => {
      const productId = String(item?.productId ?? "");
      const product = productById.get(productId);
      const quantity = Math.min(
        MAX_PRODUCT_QUANTITY,
        Math.floor(Number(item?.quantity ?? 0))
      );

      if (!product?.available || !Number.isFinite(quantity) || quantity < 1) {
        return nextCart;
      }

      const acceptedQuantity = Math.min(
        MAX_PRODUCT_QUANTITY,
        MAX_CART_QUANTITY - savedTotal,
        quantity
      );
      if (acceptedQuantity < 1) return nextCart;

      nextCart[productId] = acceptedQuantity;
      savedTotal += acceptedQuantity;
      return nextCart;
    }, {});
  } catch {
    return {};
  }
}

function CartGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 4h2l2.2 10.1a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L20.5 8H6.1" />
      <circle cx="9.5" cy="19" r="1.2" />
      <circle cx="17.5" cy="19" r="1.2" />
    </svg>
  );
}

export default function Storefront({
  checkoutEnabled,
  currency,
  shippingCents,
  automaticTaxEnabled,
  products,
  highlightedProductId,
}) {
  const catalogProducts = Array.isArray(products) ? products : [];
  const productById = useMemo(
    () => new Map(catalogProducts.map((product) => [product.id, product])),
    [catalogProducts]
  );
  const highlightedProduct = useMemo(
    () =>
      catalogProducts.find(
        (product) =>
          product.id === highlightedProductId ||
          product.deckId === highlightedProductId
      ) ?? null,
    [catalogProducts, highlightedProductId]
  );
  const categoryGroups = useMemo(() => {
    const knownCategories = new Set(CATEGORY_ORDER);
    const categories = [
      ...CATEGORY_ORDER,
      ...catalogProducts
        .map((product) => product.category)
        .filter((category) => category && !knownCategories.has(category)),
    ];

    return [...new Set(categories)]
      .map((category) => {
        const categoryProducts = catalogProducts.filter(
          (product) => product.category === category
        );
        if (highlightedProduct?.category === category) {
          categoryProducts.sort((first, second) => {
            if (first.id === highlightedProduct.id) return -1;
            if (second.id === highlightedProduct.id) return 1;
            return 0;
          });
        }

        return {
          id: category,
          meta: CATEGORY_META[category] ?? {
            label: "More SeaPals Gear",
            eyebrow: "Explore the shop",
            description: "More products being prepared for the SeaPals store.",
          },
          products: categoryProducts,
        };
      })
      .filter((group) => group.products.length > 0);
  }, [catalogProducts, highlightedProduct]);

  const [cart, setCart] = useState({});
  const [cartReady, setCartReady] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  useEffect(() => {
    setCart(readStoredCart(productById));
    setCartReady(true);
  }, [productById]);

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .map(([productId, quantity]) => ({
          product: productById.get(productId),
          quantity,
        }))
        .filter(({ product, quantity }) => product && quantity > 0),
    [cart, productById]
  );

  useEffect(() => {
    if (!cartReady) return;

    try {
      if (!cartItems.length) {
        window.localStorage.removeItem(CART_STORAGE_KEY);
        return;
      }

      window.localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify({
          items: cartItems.map(({ product, quantity }) => ({
            productId: product.id,
            quantity,
          })),
        })
      );
    } catch {
      // The cart still works for this visit when storage is unavailable.
    }
  }, [cartItems, cartReady]);

  const cartCount = cartItems.reduce(
    (total, item) => total + item.quantity,
    0
  );
  const subtotalCents = cartItems.reduce(
    (total, { product, quantity }) =>
      total + Number(product.priceCents ?? 0) * quantity,
    0
  );
  const normalizedShippingCents = Math.max(
    0,
    Number.isFinite(Number(shippingCents)) ? Number(shippingCents) : 0
  );
  const totalCents = subtotalCents + normalizedShippingCents;

  function addToCart(product) {
    if (!checkoutEnabled || !product.available || isCheckingOut) return;

    const currentTotal = Object.values(cart).reduce(
      (total, quantity) => total + Number(quantity || 0),
      0
    );
    if (currentTotal >= MAX_CART_QUANTITY) {
      setCheckoutError(
        `Online checkout supports up to ${MAX_CART_QUANTITY} items per order.`
      );
      return;
    }

    setCheckoutError("");
    setCart((currentCart) => ({
      ...currentCart,
      [product.id]: Math.min(
        MAX_PRODUCT_QUANTITY,
        (currentCart[product.id] ?? 0) + 1
      ),
    }));
  }

  function changeQuantity(productId, amount) {
    setCheckoutError("");
    if (amount > 0 && cartCount >= MAX_CART_QUANTITY) {
      setCheckoutError(
        `Online checkout supports up to ${MAX_CART_QUANTITY} items per order.`
      );
      return;
    }

    setCart((currentCart) => {
      const nextQuantity = Math.min(
        MAX_PRODUCT_QUANTITY,
        (currentCart[productId] ?? 0) + amount
      );
      const nextCart = { ...currentCart };

      if (nextQuantity < 1) {
        delete nextCart[productId];
      } else {
        nextCart[productId] = nextQuantity;
      }

      return nextCart;
    });
  }

  function removeFromCart(productId) {
    setCheckoutError("");
    setCart((currentCart) => {
      const nextCart = { ...currentCart };
      delete nextCart[productId];
      return nextCart;
    });
  }

  async function beginCheckout() {
    if (!checkoutEnabled) {
      setCheckoutError(
        "Checkout is in preview mode. Payments are not enabled yet."
      );
      return;
    }

    if (!cartItems.length || isCheckingOut) return;

    setCheckoutError("");
    setIsCheckingOut(true);

    try {
      const response = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems.map(({ product, quantity }) => ({
            productId: product.id,
            quantity,
          })),
        }),
      });

      let result = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : "Checkout could not be started. Please try again."
        );
      }

      if (typeof result?.url !== "string" || !result.url) {
        throw new Error("Checkout did not return a payment link.");
      }

      const checkoutUrl = new URL(result.url, window.location.origin);
      if (checkoutUrl.protocol !== "https:") {
        throw new Error("Checkout returned an invalid payment link.");
      }

      window.location.assign(checkoutUrl.toString());
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "Checkout could not be started. Please try again."
      );
      setIsCheckingOut(false);
    }
  }

  return (
    <main className="pb-16 text-slate-900 md:pb-24">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-[#062f46] text-white shadow-2xl shadow-cyan-950/15 md:rounded-[2.75rem]">
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-32 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-36 -left-24 h-80 w-80 rounded-full bg-emerald-400/15 blur-3xl"
        />

        <div className="relative grid gap-8 px-6 pb-7 pt-9 sm:px-9 md:px-12 md:pt-12 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:gap-12 lg:px-14">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="inline-flex rounded-full border border-cyan-200/25 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-100">
                SeaPals shop
              </p>
              <span
                className={
                  "inline-flex rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.14em] " +
                  (checkoutEnabled
                    ? "bg-emerald-300 text-emerald-950"
                    : "bg-[#f7c948] text-[#082f49]")
                }
              >
                {checkoutEnabled ? "Checkout open" : "Store preview"}
              </span>
            </div>

            <h1 className="mt-6 max-w-2xl font-serif text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              Choose how your reef grows.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-cyan-50/85">
              Starter kits, expansion decks, game accessories, and SeaPals gear
              for every kind of ocean crew.
            </p>

            {highlightedProduct ? (
              <p className="mt-6 rounded-2xl border border-[#f7c948]/40 bg-[#f7c948]/10 px-4 py-3 text-sm font-semibold text-amber-50">
                You came to see {highlightedProduct.name}. It is highlighted
                in its collection below.
              </p>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-[1.5rem] border border-cyan-200/15 bg-slate-950/20 p-2 shadow-2xl shadow-black/20">
            <Image
              src="/images/promo/decks-promo.png"
              alt="The seven SeaPals prebuilt deck designs"
              width={6596}
              height={1202}
              priority
              sizes="(max-width: 1024px) 90vw, 560px"
              className="h-auto w-full rounded-[1.1rem]"
            />
          </div>
        </div>

        {!checkoutEnabled ? (
          <div
            role="status"
            className="relative border-t border-white/10 bg-white/5 px-6 py-4 text-sm leading-6 text-cyan-50/80 sm:px-9 md:px-12 lg:px-14"
          >
            Preview mode is on. You can browse established prices and upcoming
            products, but cart and payment controls stay disabled until the
            payment account, inventory, and launch settings are ready.
          </div>
        ) : null}
      </section>

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="store-products-heading">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-700">
                The SeaPals collection
              </p>
              <h2
                id="store-products-heading"
                className="mt-2 font-serif text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl"
              >
                Shop the whole reef
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-500">
              Cash prices from the purchase sheet are shown for the Starter Kit,
              Expansion Decks, and Accessory Set. Products without a confirmed
              price stay safely unavailable.
            </p>
          </div>

          {categoryGroups.length ? (
            <>
              <nav
                aria-label="Store categories"
                className="mt-6 flex flex-wrap gap-2"
              >
                {categoryGroups.map((group) => (
                  <Link
                    key={group.id}
                    href={`#category-${group.id}`}
                    className="rounded-full border border-cyan-200 bg-white px-4 py-2 text-sm font-bold text-cyan-800 shadow-sm transition hover:border-cyan-400 hover:bg-cyan-50 focus:outline-none focus:ring-4 focus:ring-cyan-200/60"
                  >
                    {group.meta.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-9 space-y-14">
                {categoryGroups.map((group, categoryIndex) => (
                  <section
                    key={group.id}
                    id={`category-${group.id}`}
                    aria-labelledby={`category-${group.id}-heading`}
                    className="scroll-mt-8"
                  >
                    <div className="border-b border-cyan-100 pb-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
                        {group.meta.eyebrow}
                      </p>
                      <h3
                        id={`category-${group.id}-heading`}
                        className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl"
                      >
                        {group.meta.label}
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                        {group.meta.description}
                      </p>
                    </div>

                    <div className="mt-6 grid gap-6 sm:grid-cols-2">
                      {group.products.map((product, productIndex) => {
                        const isHighlighted =
                          product.id === highlightedProduct?.id;
                        const quantityInCart = cart[product.id] ?? 0;
                        const canAdd =
                          Boolean(checkoutEnabled) &&
                          Boolean(product.available) &&
                          quantityInCart < MAX_PRODUCT_QUANTITY &&
                          cartCount < MAX_CART_QUANTITY &&
                          !isCheckingOut;
                        const comingSoonLabel = product.requiresConfiguration
                          ? "Options coming soon"
                          : product.priceCents === null ||
                              product.priceCents === undefined
                            ? "Price TBA"
                            : "Preview";

                        return (
                          <article
                            key={product.id}
                            id={`product-${product.id}`}
                            className={
                              "group flex scroll-mt-8 flex-col overflow-hidden rounded-[1.75rem] border bg-white shadow-lg shadow-cyan-950/5 transition duration-200 " +
                              (isHighlighted
                                ? "border-amber-400 ring-4 ring-amber-200/70"
                                : "border-slate-200 hover:-translate-y-1 hover:border-cyan-300 hover:shadow-xl")
                            }
                          >
                            <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-cyan-100 via-sky-50 to-amber-50">
                              <div
                                aria-hidden="true"
                                className="absolute -right-8 -top-10 h-40 w-40 rounded-full border-[24px] border-white/45"
                              />
                              <Image
                                src={product.image}
                                alt={`${product.name} product preview`}
                                fill
                                loading={
                                  categoryIndex === 0 && productIndex === 0
                                    ? "eager"
                                    : "lazy"
                                }
                                sizes="(max-width: 640px) 90vw, (max-width: 1024px) 44vw, 340px"
                                className="object-contain p-5 transition duration-300 group-hover:scale-[1.03]"
                              />

                              <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                                {isHighlighted ? (
                                  <span className="rounded-full bg-[#f7c948] px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#082f49] shadow-sm">
                                    Your selection
                                  </span>
                                ) : product.featured ? (
                                  <span className="rounded-full bg-[#073d58] px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white shadow-sm">
                                    Featured
                                  </span>
                                ) : null}

                                {!product.available ? (
                                  <span className="rounded-full bg-slate-900/85 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white shadow-sm">
                                    {comingSoonLabel}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex flex-1 flex-col p-5 sm:p-6">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">
                                    {product.productLabel || product.shortName}
                                  </p>
                                  <h4 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                                    {product.name}
                                  </h4>
                                </div>
                                <p className="shrink-0 text-lg font-black text-[#075b7d]">
                                  {formatCatalogPrice(product.priceCents, currency)}
                                </p>
                              </div>

                              <p className="mt-4 leading-7 text-slate-600">
                                {product.description}
                              </p>

                              {product.includedItems?.length ? (
                                <div className="mt-5 rounded-2xl bg-cyan-50/70 p-4">
                                  <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-800">
                                    Includes
                                  </p>
                                  <ul className="mt-2 space-y-1.5 text-sm leading-5 text-slate-700">
                                    {product.includedItems.map((item) => (
                                      <li key={item} className="flex gap-2">
                                        <span
                                          aria-hidden="true"
                                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400"
                                        />
                                        <span>{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}

                              <div className="mt-auto flex items-start justify-between gap-4 border-t border-slate-100 pt-4 text-sm">
                                <span className="inline-flex items-start gap-2 font-bold leading-5 text-slate-700">
                                  <span
                                    aria-hidden="true"
                                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400"
                                  />
                                  {product.details}
                                </span>
                                {product.fullContentsHref ? (
                                  <Link
                                    href={product.fullContentsHref}
                                    className="shrink-0 font-bold text-cyan-700 underline decoration-cyan-300 underline-offset-4 transition hover:text-cyan-900 focus:outline-none focus:ring-4 focus:ring-cyan-200/60"
                                  >
                                    Full contents
                                  </Link>
                                ) : null}
                              </div>

                              {product.availabilityNote ? (
                                <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
                                  {product.availabilityNote}
                                </p>
                              ) : null}

                              <button
                                type="button"
                                disabled={!canAdd}
                                onClick={() => addToCart(product)}
                                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#f7c948] px-5 py-3 font-black text-[#082f49] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#ffda68] focus:outline-none focus:ring-4 focus:ring-cyan-200/70 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
                              >
                                <CartGlyph />
                                {!product.available
                                  ? unavailableButtonLabel(product)
                                  : !checkoutEnabled
                                    ? "Preview only"
                                    : quantityInCart >= MAX_PRODUCT_QUANTITY ||
                                        cartCount >= MAX_CART_QUANTITY
                                      ? "Cart limit reached"
                                    : quantityInCart
                                      ? "Add another"
                                      : "Add to cart"}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-7 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <h3 className="text-xl font-bold text-slate-950">
                Products are being prepared
              </h3>
              <p className="mt-2 text-slate-600">
                Check back soon to explore the SeaPals store.
              </p>
            </div>
          )}
        </section>

        <aside
          aria-labelledby="cart-heading"
          className="overflow-hidden rounded-[1.75rem] border border-cyan-100 bg-white shadow-xl shadow-cyan-950/10 lg:sticky lg:top-6"
        >
          <div className="bg-[#073d58] px-5 py-5 text-white">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-cyan-100">
                  <CartGlyph />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-cyan-200">
                    Order summary
                  </p>
                  <h2 id="cart-heading" className="text-xl font-bold">
                    Your cart
                  </h2>
                </div>
              </div>
              <span
                aria-live="polite"
                aria-label={
                  cartCount === 1 ? "1 item in cart" : cartCount + " items in cart"
                }
                className="flex min-h-9 min-w-9 items-center justify-center rounded-full bg-[#f7c948] px-2 text-sm font-black text-[#082f49]"
              >
                {cartCount}
              </span>
            </div>
          </div>

          <div className="p-5">
            {!cartReady ? (
              <p className="py-8 text-center text-sm text-slate-500" role="status">
                Loading your saved cart...
              </p>
            ) : cartItems.length ? (
              <div className="space-y-5">
                <ul className="divide-y divide-slate-100" aria-label="Cart items">
                  {cartItems.map(({ product, quantity }) => (
                    <li key={product.id} className="py-4 first:pt-0">
                      <div className="flex items-start gap-3">
                        <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-cyan-50">
                          <Image
                            src={product.image}
                            alt=""
                            fill
                            sizes="56px"
                            className="object-contain"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-bold leading-5 text-slate-950">
                              {product.name}
                            </h3>
                            <span className="shrink-0 text-sm font-bold text-slate-800">
                              {formatMoney(
                                Number(product.priceCents ?? 0) * quantity,
                                currency
                              )}
                            </span>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div
                              role="group"
                              className="inline-flex items-center rounded-full border border-slate-200"
                              aria-label={"Quantity for " + product.name}
                            >
                              <button
                                type="button"
                                onClick={() => changeQuantity(product.id, -1)}
                                className="flex h-9 w-9 items-center justify-center rounded-l-full text-lg font-bold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-cyan-200/60"
                                aria-label={"Decrease " + product.name + " quantity"}
                              >
                                -
                              </button>
                              <span className="min-w-8 text-center text-sm font-black tabular-nums text-slate-950">
                                {quantity}
                              </span>
                              <button
                                type="button"
                                disabled={
                                  !checkoutEnabled ||
                                  quantity >= MAX_PRODUCT_QUANTITY ||
                                  cartCount >= MAX_CART_QUANTITY
                                }
                                onClick={() => changeQuantity(product.id, 1)}
                                className="flex h-9 w-9 items-center justify-center rounded-r-full text-lg font-bold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-cyan-200/60 disabled:cursor-not-allowed disabled:text-slate-300"
                                aria-label={"Increase " + product.name + " quantity"}
                              >
                                +
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFromCart(product.id)}
                              className="text-xs font-bold text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-rose-700 focus:outline-none focus:ring-4 focus:ring-cyan-200/60"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                <dl className="space-y-2 border-t border-slate-200 pt-4 text-sm">
                  <div className="flex justify-between gap-4 text-slate-600">
                    <dt>Subtotal</dt>
                    <dd className="font-bold text-slate-900">
                      {formatMoney(subtotalCents, currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 text-slate-600">
                    <dt>Shipping</dt>
                    <dd className="font-bold text-slate-900">
                      {normalizedShippingCents
                        ? formatMoney(normalizedShippingCents, currency)
                        : "Free"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-slate-200 pt-3 text-base">
                    <dt className="font-black text-slate-950">
                      {automaticTaxEnabled ? "Estimated total" : "Total"}
                    </dt>
                    <dd className="font-black text-[#075b7d]">
                      {formatMoney(totalCents, currency)}
                    </dd>
                  </div>
                </dl>

                {automaticTaxEnabled ? (
                  <p className="text-xs leading-5 text-slate-500">
                    Applicable tax is calculated from the delivery address in
                    secure checkout.
                  </p>
                ) : null}

                {checkoutError ? (
                  <p
                    role="alert"
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold leading-5 text-rose-800"
                  >
                    {checkoutError}
                  </p>
                ) : null}

                <p className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs leading-5 text-slate-600">
                  Stripe will collect the adult purchaser&apos;s payment,
                  contact, billing, and shipping details for checkout. By
                  continuing, you agree to the{" "}
                  <Link
                    href="/terms#purchases"
                    className="font-bold text-cyan-800 underline underline-offset-4"
                  >
                    Terms of Use
                  </Link>{" "}
                  and acknowledge the{" "}
                  <Link
                    href="/privacy#collection"
                    className="font-bold text-cyan-800 underline underline-offset-4"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>

                <button
                  type="button"
                  disabled={!checkoutEnabled || isCheckingOut}
                  onClick={beginCheckout}
                  aria-busy={isCheckingOut}
                  className="inline-flex min-h-13 w-full items-center justify-center rounded-xl bg-[#f7c948] px-5 py-3.5 text-base font-black text-[#082f49] shadow-md transition hover:-translate-y-0.5 hover:bg-[#ffda68] focus:outline-none focus:ring-4 focus:ring-cyan-200/70 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
                >
                  {isCheckingOut
                    ? "Opening secure checkout..."
                    : checkoutEnabled
                      ? "Continue to payment"
                      : "Checkout preview only"}
                </button>
              </div>
            ) : (
              <div className="py-8 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
                  <CartGlyph />
                </span>
                <h3 className="mt-4 font-bold text-slate-950">
                  Your cart is empty
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Choose an available product to begin your order.
                </p>
              </div>
            )}

            <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
              Prices and availability shown here come from the current SeaPals
              store catalog. The checkout service verifies them again before
              payment.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
