"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { resolveStoreShippingRateTier } from "@/data/store/shipping.js";
import {
  STORE_MAX_CART_QUANTITY,
  STORE_MAX_PER_PRODUCT_QUANTITY,
} from "@/lib/store/cart.mjs";
import { getOrCreateCheckoutRequest } from "@/lib/store/checkoutRequest.mjs";
import {
  parseCheckoutRequestStorage,
  serializeCheckoutRequestStorage,
} from "@/lib/store/inventory.mjs";
import {
  isCartSummaryAheadOfViewport,
  shouldShowMobileCartDock,
} from "@/lib/store/mobileCartAccess.mjs";

const CART_STORAGE_KEY = "seapals-store-cart-v1";
const CHECKOUT_REQUEST_STORAGE_KEY = "seapals-store-checkout-request-v1";
const FALLBACK_PRODUCTION_OPTIONS = Object.freeze([
  Object.freeze({
    id: "standard-production",
    displayName: "Standard production",
    description:
      "Complete production within 5 business days; mailed orders are dispatched and pickup orders are marked ready.",
    amountCents: 0,
    maxBusinessDays: 5,
    expedited: false,
  }),
]);

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
      "Choose the complete Accessories Kit or individual condition cards, dice, and Reef Point tokens.",
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
  if (!product.priceConfigured) {
    return "Price to confirm";
  }
  return "Prelaunch";
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
        STORE_MAX_PER_PRODUCT_QUANTITY,
        Math.floor(Number(item?.quantity ?? 0))
      );

      if (!product?.available || !Number.isFinite(quantity) || quantity < 1) {
        return nextCart;
      }

      const acceptedQuantity = Math.min(
        STORE_MAX_PER_PRODUCT_QUANTITY,
        STORE_MAX_CART_QUANTITY - savedTotal,
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
  paymentMode,
  currency,
  shippingCents,
  shippingOptions,
  defaultShippingOptionId,
  productionOptions,
  defaultProductionOptionId,
  defaultProductionOption,
  expeditedProductionDailyOrderLimit,
  expeditedProductionTimeZone,
  automaticTaxEnabled,
  products,
  highlightedProductId,
}) {
  const testCheckout = checkoutEnabled && paymentMode === "test";
  const catalogProducts = Array.isArray(products) ? products : [];
  const productById = useMemo(
    () => new Map(catalogProducts.map((product) => [product.id, product])),
    [catalogProducts]
  );
  const highlightedProduct = useMemo(
    () => {
      const requestedProductId = String(highlightedProductId ?? "").trim();
      if (!requestedProductId) return null;

      return (
        catalogProducts.find(
          (product) =>
            product.id === requestedProductId ||
            product.deckId === requestedProductId
        ) ?? null
      );
    },
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

  const fulfillmentOptions = useMemo(() => {
    const configuredOptions = (Array.isArray(shippingOptions)
      ? shippingOptions
      : []
    ).filter(
      (option) =>
        option &&
        typeof option.id === "string" &&
        typeof option.displayName === "string" &&
        Number.isSafeInteger(option.amountCents) &&
        option.amountCents >= 0
    );

    if (configuredOptions.length) return configuredOptions;

    return [
      {
        id: "standard",
        displayName: "Standard Shipping & Handling",
        description: "Ships to your address.",
        fulfillmentMethod: "shipping",
        pickupLocation: null,
        amountCents: Math.max(
          0,
          Number.isFinite(Number(shippingCents)) ? Number(shippingCents) : 0
        ),
      },
    ];
  }, [shippingCents, shippingOptions]);

  const productionChoices = useMemo(() => {
    const configuredOptions = (Array.isArray(productionOptions)
      ? productionOptions
      : []
    ).filter(
      (option) =>
        option &&
        typeof option.id === "string" &&
        typeof option.displayName === "string" &&
        Number.isSafeInteger(option.amountCents) &&
        option.amountCents >= 0 &&
        Number.isSafeInteger(option.maxBusinessDays) &&
        option.maxBusinessDays > 0
    );

    return configuredOptions.length
      ? configuredOptions
      : FALLBACK_PRODUCTION_OPTIONS;
  }, [productionOptions]);
  const configuredDefaultProductionOptionId = String(
    defaultProductionOptionId ??
      (typeof defaultProductionOption === "string"
        ? defaultProductionOption
        : defaultProductionOption?.id ?? "")
  ).trim();
  const expeditedProductionOption =
    productionChoices.find((option) => option.expedited) ??
    productionChoices.find((option) => option.id === "expedited-production") ??
    null;
  const normalizedExpeditedDailyOrderLimit = Number(
    expeditedProductionDailyOrderLimit
  );
  const hasExpeditedDailyOrderLimit =
    Number.isSafeInteger(normalizedExpeditedDailyOrderLimit) &&
    normalizedExpeditedDailyOrderLimit > 0;
  const normalizedExpeditedTimeZone = String(
    expeditedProductionTimeZone ?? ""
  ).trim();

  const [cart, setCart] = useState({});
  const [cartReady, setCartReady] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [isCartSummaryAhead, setIsCartSummaryAhead] = useState(true);
  const cartSummaryRef = useRef(null);
  const checkoutRequestRef = useRef(null);
  const [selectedFulfillmentOptionId, setSelectedFulfillmentOptionId] =
    useState(() => {
      const configuredDefault = String(defaultShippingOptionId ?? "").trim();
      return fulfillmentOptions.some(
        (option) => option.id === configuredDefault
      )
        ? configuredDefault
        : fulfillmentOptions[0].id;
    });
  const [selectedProductionOptionId, setSelectedProductionOptionId] = useState(
    () =>
      productionChoices.some(
        (option) => option.id === configuredDefaultProductionOptionId
      )
        ? configuredDefaultProductionOptionId
        : productionChoices[0].id
  );

  useEffect(() => {
    if (
      fulfillmentOptions.some(
        (option) => option.id === selectedFulfillmentOptionId
      )
    ) {
      return;
    }

    setSelectedFulfillmentOptionId(
      fulfillmentOptions.find(
        (option) => option.id === defaultShippingOptionId
      )?.id ?? fulfillmentOptions[0].id
    );
  }, [
    defaultShippingOptionId,
    fulfillmentOptions,
    selectedFulfillmentOptionId,
  ]);

  useEffect(() => {
    if (
      productionChoices.some(
        (option) => option.id === selectedProductionOptionId
      )
    ) {
      return;
    }

    setSelectedProductionOptionId(
      productionChoices.find(
        (option) => option.id === configuredDefaultProductionOptionId
      )?.id ?? productionChoices[0].id
    );
  }, [
    configuredDefaultProductionOptionId,
    productionChoices,
    selectedProductionOptionId,
  ]);

  useEffect(() => {
    setCart(readStoredCart(productById));
    try {
      checkoutRequestRef.current = parseCheckoutRequestStorage(
        window.sessionStorage.getItem(CHECKOUT_REQUEST_STORAGE_KEY),
        Date.now()
      );
    } catch {
      checkoutRequestRef.current = null;
    }
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

  useEffect(() => {
    const cartSummary = cartSummaryRef.current;
    if (!cartSummary || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsCartSummaryAhead(isCartSummaryAheadOfViewport(entry));
      },
      { threshold: 0.1 }
    );
    observer.observe(cartSummary);

    return () => observer.disconnect();
  }, []);

  const cartCount = cartItems.reduce(
    (total, item) => total + item.quantity,
    0
  );
  const subtotalCents = cartItems.reduce(
    (total, { product, quantity }) =>
      total + Number(product.priceCents ?? 0) * quantity,
    0
  );
  const cartShippingWeightOunces = cartItems.reduce(
    (total, { product, quantity }) =>
      total + Number(product.shippingWeightOunces ?? 0) * quantity,
    0
  );
  const selectedFulfillmentOption =
    fulfillmentOptions.find(
      (option) => option.id === selectedFulfillmentOptionId
    ) ?? fulfillmentOptions[0];
  const selectedShippingRateTier = resolveStoreShippingRateTier(
    selectedFulfillmentOption,
    Math.max(1, cartShippingWeightOunces)
  );
  const normalizedShippingCents =
    selectedFulfillmentOption.fulfillmentMethod === "pickup"
      ? 0
      : Math.max(
          0,
          Number(
            selectedShippingRateTier?.amountCents ??
              selectedFulfillmentOption.amountCents
          )
        );
  const selectedProductionOption =
    productionChoices.find(
      (option) => option.id === selectedProductionOptionId
    ) ?? productionChoices[0];
  const normalizedProductionCents = Math.max(
    0,
    Number(selectedProductionOption.amountCents)
  );
  const totalCents =
    subtotalCents + normalizedProductionCents + normalizedShippingCents;

  function addToCart(product) {
    if (!checkoutEnabled || !product.available || isCheckingOut) return;

    const currentTotal = Object.values(cart).reduce(
      (total, quantity) => total + Number(quantity || 0),
      0
    );
    if (currentTotal >= STORE_MAX_CART_QUANTITY) {
      setCheckoutError(
        `Online checkout supports up to ${STORE_MAX_CART_QUANTITY} items per order.`
      );
      return;
    }

    setCheckoutError("");
    setCart((currentCart) => ({
      ...currentCart,
      [product.id]: Math.min(
        STORE_MAX_PER_PRODUCT_QUANTITY,
        (currentCart[product.id] ?? 0) + 1
      ),
    }));
  }

  function changeQuantity(productId, amount) {
    setCheckoutError("");
    if (amount > 0 && cartCount >= STORE_MAX_CART_QUANTITY) {
      setCheckoutError(
        `Online checkout supports up to ${STORE_MAX_CART_QUANTITY} items per order.`
      );
      return;
    }

    setCart((currentCart) => {
      const nextQuantity = Math.min(
        STORE_MAX_PER_PRODUCT_QUANTITY,
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

  function viewCart() {
    const cartSummary = cartSummaryRef.current;
    if (!cartSummary) return;

    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    )?.matches;
    cartSummary.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
    window.requestAnimationFrame(() => {
      cartSummary.focus({ preventScroll: true });
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
    const checkoutInput = {
      fulfillmentOptionId: selectedFulfillmentOption.id,
      productionOptionId: selectedProductionOption.id,
      items: cartItems.map(({ product, quantity }) => ({
        productId: product.id,
        quantity,
      })),
    };

    try {
      const checkoutRequest = getOrCreateCheckoutRequest(
        checkoutRequestRef.current,
        checkoutInput
      );
      checkoutRequestRef.current = checkoutRequest;
      try {
        const storedRequest = serializeCheckoutRequestStorage(
          checkoutRequest,
          Date.now()
        );
        if (storedRequest) {
          window.sessionStorage.setItem(
            CHECKOUT_REQUEST_STORAGE_KEY,
            storedRequest
          );
        }
      } catch {
        // Memory-only idempotency remains available for this visit.
      }
      const response = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutRequestId: checkoutRequest.id,
          ...checkoutInput,
        }),
      });

      let result = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        if (
          response.status < 500 ||
          result?.code !== "retry_same_request"
        ) {
          checkoutRequestRef.current = null;
          try {
            window.sessionStorage.removeItem(CHECKOUT_REQUEST_STORAGE_KEY);
          } catch {
            // The in-memory key is already cleared.
          }
        }
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
      if (
        checkoutUrl.protocol !== "https:" ||
        checkoutUrl.hostname !== "checkout.stripe.com"
      ) {
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
    <main
      className={
        "text-slate-900 " +
        (checkoutEnabled && cartReady && cartCount > 0
          ? "pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-24"
          : "pb-16 md:pb-24")
      }
    >
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
                {checkoutEnabled ? "SeaPals shop" : "SeaPals store preview"}
              </p>
              <span
                className={
                  "inline-flex rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.14em] " +
                  (checkoutEnabled && !testCheckout
                    ? "bg-emerald-300 text-emerald-950"
                    : "bg-[#f7c948] text-[#082f49]")
                }
              >
                {testCheckout
                  ? "Test checkout"
                  : checkoutEnabled
                    ? "Checkout open"
                    : "Store preview"}
              </span>
            </div>

            <h1 className="mt-6 max-w-2xl font-serif text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              Choose how your reef grows.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-cyan-50/85">
              Seven ready-to-play SeaPals decks, built to order for your next
              reef.
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

        {testCheckout ? (
          <div
            role="status"
            className="relative border-t border-amber-200/20 bg-amber-300/10 px-6 py-4 text-sm font-semibold leading-6 text-amber-50 sm:px-9 md:px-12 lg:px-14"
          >
            Stripe sandbox mode is on. Use test payment details only; no real
            charge or payout will occur.
          </div>
        ) : !checkoutEnabled ? (
          <div
            role="status"
            className="relative border-t border-white/10 bg-white/5 px-6 py-4 text-sm leading-6 text-cyan-50/80 sm:px-9 md:px-12 lg:px-14"
          >
            Store preview is on. Ordering stays disabled while shipping-rate,
            inventory, tax, and fulfillment launch checks are completed.
          </div>
        ) : null}
      </section>

      <section
        aria-label="Made-to-order production timing"
        className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-4 text-sm leading-6 text-cyan-950 shadow-sm"
      >
        <p>
          <strong>Made to order:</strong> standard production is included, and
          launch products are dispatched within 5 business days.
          {expeditedProductionOption ? (
            <>
              {" "}One-business-day production {checkoutEnabled
                ? "can be requested at checkout"
                : "will be offered when ordering opens"} for{" "}
              <strong>
                {formatMoney(expeditedProductionOption.amountCents, currency)}
                {" per order"}
              </strong>
              {" "}when a daily rush slot remains.
            </>
          ) : null}{" "}
          Carrier transit time is additional.
        </p>
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
                {checkoutEnabled
                  ? "Shop the SeaPals collection"
                  : "Preview the launch collection"}
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-500">
              {checkoutEnabled
                ? "Choose your products and add available items to your order. Prices and availability reflect the current catalog."
                : "The seven approved $22 launch decks are shown. Ordering remains disabled until the final launch checks are complete."}
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
                          quantityInCart < STORE_MAX_PER_PRODUCT_QUANTITY &&
                          cartCount < STORE_MAX_CART_QUANTITY &&
                          !isCheckingOut;
                        const comingSoonLabel = product.requiresConfiguration
                          ? "Options coming soon"
                          : !product.priceConfigured
                            ? "Price to confirm"
                            : "Prelaunch";

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

                              {product.madeToOrder ? (
                                <p className="mt-3 text-sm font-bold leading-6 text-cyan-800">
                                  Made to order
                                  {product.buildDispatchMaxBusinessDays
                                    ? ` · standard dispatch within ${product.buildDispatchMaxBusinessDays} business days`
                                    : ""}
                                </p>
                              ) : null}

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

                              {product.trialDecks?.length ? (
                                <div
                                  className="mt-4 flex flex-wrap gap-2"
                                  aria-label={`Try ${product.name} decks in the simulator`}
                                >
                                  {product.trialDecks.map((deck) => (
                                    <Link
                                      key={deck.id}
                                      href={deck.href}
                                      className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border-2 border-cyan-700 bg-cyan-50 px-4 py-2 text-center text-sm font-black text-cyan-900 transition hover:-translate-y-0.5 hover:bg-cyan-100 focus:outline-none focus:ring-4 focus:ring-cyan-200/70"
                                    >
                                      {product.trialDecks.length > 1
                                        ? `Try ${deck.name.replace(/\s+Deck$/i, "")}`
                                        : "Try this deck"}
                                    </Link>
                                  ))}
                                </div>
                              ) : null}

                              {product.availabilityNote &&
                              !(
                                checkoutEnabled &&
                                paymentMode === "live" &&
                                product.available
                              ) ? (
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
                                    : quantityInCart >=
                                        STORE_MAX_PER_PRODUCT_QUANTITY ||
                                        cartCount >= STORE_MAX_CART_QUANTITY
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
          id="store-cart-summary"
          ref={cartSummaryRef}
          tabIndex={-1}
          aria-labelledby="cart-heading"
          className="scroll-mt-4 overflow-hidden rounded-[1.75rem] border border-cyan-100 bg-white shadow-xl shadow-cyan-950/10 focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/70 lg:sticky lg:top-6"
        >
          <div className="bg-[#073d58] px-5 py-5 text-white">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-cyan-100">
                  <CartGlyph />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-cyan-200">
                    {checkoutEnabled ? "Order summary" : "Store preview"}
                  </p>
                  <h2 id="cart-heading" className="text-xl font-bold">
                    {checkoutEnabled ? "Your cart" : "Ordering opens soon"}
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
                                  quantity >= STORE_MAX_PER_PRODUCT_QUANTITY ||
                                  cartCount >= STORE_MAX_CART_QUANTITY
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

                <fieldset className="space-y-2 border-t border-slate-200 pt-4">
                  <legend className="text-sm font-black text-slate-950">
                    Production speed
                  </legend>
                  {productionChoices.map((option) => {
                    const selected = option.id === selectedProductionOption.id;
                    return (
                      <label
                        key={option.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${
                          selected
                            ? "border-cyan-500 bg-cyan-50"
                            : "border-slate-200 bg-white hover:border-cyan-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="production-option"
                          value={option.id}
                          checked={selected}
                          disabled={isCheckingOut}
                          onChange={() => {
                            setCheckoutError("");
                            setSelectedProductionOptionId(option.id);
                          }}
                          className="mt-1 h-4 w-4 accent-cyan-700"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-3">
                            <span className="text-sm font-bold text-slate-900">
                              {option.displayName}
                            </span>
                            <span className="shrink-0 text-sm font-black text-slate-900">
                              {option.amountCents
                                ? `+${formatMoney(option.amountCents, currency)}`
                                : "Included"}
                            </span>
                          </span>
                          {option.description ? (
                            <span className="mt-1 block text-xs leading-5 text-slate-500">
                              {option.description}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                  <p className="px-1 text-xs leading-5 text-slate-500">
                    Production timing ends when a mailed order is handed to the
                    carrier or a pickup order is marked ready. It is not a
                    delivery estimate.
                  </p>
                  {expeditedProductionOption ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-950">
                      Expedited production is limited to{" "}
                      {hasExpeditedDailyOrderLimit
                        ? `${normalizedExpeditedDailyOrderLimit} orders per SeaPals production day`
                        : "a fixed number of orders per SeaPals production day"}
                      {normalizedExpeditedTimeZone
                        ? ` (${normalizedExpeditedTimeZone})`
                        : ""}
                      {" "}and is subject to server-confirmed availability.
                      Selecting it does not reserve a rush slot; checkout
                      confirms the slot before opening payment.
                    </p>
                  ) : null}
                </fieldset>

                <fieldset className="space-y-2 border-t border-slate-200 pt-4">
                  <legend className="text-sm font-black text-slate-950">
                    Shipping or pickup
                  </legend>
                  {fulfillmentOptions.map((option) => {
                    const selected = option.id === selectedFulfillmentOption.id;
                    const rateTier = resolveStoreShippingRateTier(
                      option,
                      Math.max(1, cartShippingWeightOunces)
                    );
                    const displayedAmountCents =
                      option.fulfillmentMethod === "pickup"
                        ? 0
                        : (rateTier?.amountCents ?? option.amountCents);
                    return (
                      <label
                        key={option.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${
                          selected
                            ? "border-cyan-500 bg-cyan-50"
                            : "border-slate-200 bg-white hover:border-cyan-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="fulfillment-option"
                          value={option.id}
                          checked={selected}
                          disabled={isCheckingOut}
                          onChange={() => {
                            setCheckoutError("");
                            setSelectedFulfillmentOptionId(option.id);
                          }}
                          className="mt-1 h-4 w-4 accent-cyan-700"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-3">
                            <span className="text-sm font-bold text-slate-900">
                              {option.displayName}
                            </span>
                            <span className="shrink-0 text-sm font-black text-slate-900">
                              {displayedAmountCents
                                ? formatMoney(displayedAmountCents, currency)
                                : "Free"}
                            </span>
                          </span>
                          {option.fulfillmentMethod === "pickup" ? (
                            <span className="mt-1 block text-xs leading-5 text-slate-500">
                              Free scheduled pickup in Elverson, PA. After your
                              order is built, we will email you to arrange a
                              pickup time. You do not choose a pickup time during
                              checkout.
                            </span>
                          ) : option.description ? (
                            <span className="mt-1 block text-xs leading-5 text-slate-500">
                              {option.description}{" "}
                              {rateTier?.id === "large"
                                ? "Large-parcel rate applies above 1 lb through 8 lb."
                                : "Base rate applies through 1 lb."}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </fieldset>

                <dl className="space-y-2 border-t border-slate-200 pt-4 text-sm">
                  <div className="flex justify-between gap-4 text-slate-600">
                    <dt>Subtotal</dt>
                    <dd className="font-bold text-slate-900">
                      {formatMoney(subtotalCents, currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 text-slate-600">
                    <dt>{selectedProductionOption.displayName}</dt>
                    <dd className="font-bold text-slate-900">
                      {normalizedProductionCents
                        ? formatMoney(normalizedProductionCents, currency)
                        : "Included"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 text-slate-600">
                    <dt>
                      {selectedFulfillmentOption.fulfillmentMethod === "pickup"
                        ? selectedFulfillmentOption.displayName
                        : "Shipping & handling"}
                    </dt>
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
                    Applicable tax is calculated in secure checkout.
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

                <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600">
                  Need to change an order? Email{" "}
                  <a
                    href="mailto:maker@seapalstcg.com"
                    className="font-bold text-cyan-800 underline underline-offset-4"
                  >
                    maker@seapalstcg.com
                  </a>{" "}
                  within two hours to request cancellation. Unopened items may
                  be returned within 30 days after delivery or pickup; the{" "}
                  <Link
                    href="/terms#purchases"
                    className="font-bold text-cyan-800 underline underline-offset-4"
                  >
                    purchase terms
                  </Link>{" "}
                  explain return postage, exceptions, and problem-reporting
                  deadlines.
                </p>

                <p className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs leading-5 text-slate-600">
                  Stripe will collect the adult purchaser&apos;s payment,
                  contact, and billing details
                  {selectedFulfillmentOption.fulfillmentMethod === "shipping"
                    ? ", plus the delivery address"
                    : "; no delivery address is required for local pickup"}
                  . By
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
                    : testCheckout
                      ? "Continue to test payment"
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
                  {checkoutEnabled
                    ? "Choose an available product to begin your order."
                    : "Browse the collection while final launch checks are completed."}
                </p>
              </div>
            )}

            <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
              Prices and availability shown here come from the current SeaPals
              store catalog. {checkoutEnabled
                ? "The checkout service verifies them again before payment."
                : "Ordering will open after the final launch checks are complete."}
            </p>
          </div>
        </aside>
      </div>

      {shouldShowMobileCartDock({
        checkoutEnabled,
        cartReady,
        cartCount,
        isCartSummaryAhead,
      }) ? (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-cyan-100 bg-white/95 pt-3 shadow-[0_-12px_30px_rgba(6,47,70,0.16)] backdrop-blur lg:hidden"
          style={{
            paddingRight: "max(1rem, env(safe-area-inset-right))",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
            paddingLeft: "max(1rem, env(safe-area-inset-left))",
          }}
        >
          <button
            type="button"
            onClick={viewCart}
            aria-controls="store-cart-summary"
            aria-label={`${cartCount === 1 ? "1 item" : `${cartCount} items`} in cart. View cart. Subtotal ${formatMoney(subtotalCents, currency)}.`}
            className="mx-auto flex min-h-14 w-full max-w-lg items-center justify-between gap-4 rounded-2xl bg-[#073d58] px-4 py-3 text-left text-white shadow-lg shadow-cyan-950/25 transition active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-cyan-300/70"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-cyan-100">
                <CartGlyph />
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#f7c948] px-1 text-[11px] font-black tabular-nums text-[#082f49]"
                >
                  {cartCount}
                </span>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black">View cart</span>
                <span className="block text-xs text-cyan-100">
                  {cartCount === 1 ? "1 item" : `${cartCount} items`}
                </span>
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-200">
                Subtotal
              </span>
              <span className="block text-base font-black text-white">
                {formatMoney(subtotalCents, currency)}
              </span>
            </span>
          </button>
        </div>
      ) : null}
    </main>
  );
}
