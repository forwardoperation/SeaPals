"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getStorePreorderCampaign } from "@/data/store/preorders.js";
import { formatMoney } from "@/lib/store/cart.mjs";
import { getStoreProductOrderState, getStoreProductPath } from "@/lib/store/productDetails.mjs";
import {
  HOME_STARTER_KIT_CART_STORAGE_KEY as CART_STORAGE_KEY,
  addHomeStarterKitToCart,
  countHomeStarterKitCart as countCart,
  readHomeStarterKitCart,
} from "./HomeStarterKitCart.mjs";
import styles from "./HomeStarterKit.module.css";

const EMPTY_PRODUCTS = Object.freeze([]);

/** Pass only the server's visible catalog and checkout configuration. */
export default function HomeStarterKit({
  product,
  cartProducts = EMPTY_PRODUCTS,
  currency = "usd",
  checkoutEnabled = false,
  preorderCampaign,
  paymentMode,
}) {
  const [cart, setCart] = useState({});
  const [cartReady, setCartReady] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [notice, setNotice] = useState("");
  const campaign = preorderCampaign ?? getStorePreorderCampaign();
  const catalog = useMemo(() => Array.isArray(cartProducts) ? cartProducts : [], [cartProducts]);

  useEffect(() => {
    function refreshCart() {
      setNotice("");
      try {
        setCart(readHomeStarterKitCart(window.localStorage.getItem(CART_STORAGE_KEY), catalog));
        setStorageUnavailable(false);
      } catch {
        setStorageUnavailable(true);
      }
      setCartReady(true);
    }
    function handleStorage(event) {
      if (event.key === null || event.key === CART_STORAGE_KEY) {
        setNotice("");
        refreshCart();
      }
    }
    refreshCart();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", refreshCart);
    window.addEventListener("pageshow", refreshCart);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", refreshCart);
      window.removeEventListener("pageshow", refreshCart);
    };
  }, [catalog]);

  if (!product) return null;

  const quantityInCart = cart[product.id] ?? 0;
  const cartCount = countCart(cart);
  const catalogAllowsProduct = catalog.some((entry) => entry.id === product.id && entry.available);
  const orderState = getStoreProductOrderState({
    product,
    checkoutEnabled,
    quantityInCart,
    cartCount,
  });
  const canAdd = cartReady && catalogAllowsProduct && orderState.canAdd;
  const productPath = getStoreProductPath(product.id);
  const hasPrice = Number.isSafeInteger(product.priceCents) && product.priceCents > 0;

  function addToCart() {
    if (!canAdd || storageUnavailable) return;
    try {
      const result = addHomeStarterKitToCart({
        storage: window.localStorage,
        products: catalog,
        product,
        checkoutEnabled,
      });
      setCart(result.cart);
      setNotice(result.notice);
    } catch {
      // Never announce success if the store would be unable to read the cart.
      setStorageUnavailable(true);
      setNotice("");
    }
  }

  return (
    <section id="starter-kit" className={styles.section} aria-labelledby="home-starter-kit-heading">
      <div className={styles.imageColumn} data-dive-reveal>
        <Link href={productPath} className={styles.imageLink} aria-label={`Explore the ${product.name}`}>
          <Image
            src={product.image}
            alt={product.imageAlt || `${product.name} product photo`}
            width={1448}
            height={1086}
            sizes="(max-width: 767px) calc(100vw - 48px), (max-width: 1151px) 47vw, 560px"
            className={styles.image}
          />
        </Link>
        <p className={styles.imageCaption}>One kit. Two players. A whole ocean to explore.</p>
      </div>

      <div className={styles.copy} data-dive-reveal>
        <p className={styles.eyebrow}>{product.productLabel || "Bring SeaRealm to your table"}</p>
        <h2 id="home-starter-kit-heading" className={styles.heading}>{product.name}</h2>
        <p className={styles.description}>{product.description}</p>
        {Array.isArray(product.includedItems) && product.includedItems.length > 0 ? (
          <ul className={styles.contents} aria-label="Included in the Starter Kit">
            {product.includedItems.map((item) => (
              <li key={item}><span aria-hidden="true">✓</span><span>{item}</span></li>
            ))}
          </ul>
        ) : product.details ? <p className={styles.description}>{product.details}</p> : null}
        <p className={styles.setupNote}>Bring a few small counters for damage or HP, and you&apos;re ready to play.</p>

        <div className={styles.ordering}>
          <div className={styles.priceRow}>
            <p className={styles.price}>{hasPrice ? formatMoney(product.priceCents, currency) : "Price to be confirmed"}</p>
            {product.preorder ? <span className={styles.badge}>Pre-order</span> : null}
          </div>
          {product.preorder ? (
            <p className={styles.fulfillment}>{campaign.fulfillmentLabel}</p>
          ) : null}
          <div className={styles.actions}>
            {storageUnavailable && checkoutEnabled && product.available ? (
              <Link href={productPath} className={styles.addButton}>Add in the store</Link>
            ) : (
              <button
                type="button"
                onClick={addToCart}
                disabled={!canAdd}
                className={styles.addButton}
                aria-describedby="home-starter-kit-status"
              >
                {orderState.canAdd ? "Add to cart" : orderState.buttonLabel}
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                  <path d="M3 4h2l2.2 10.1a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L20.5 8H6.1M9.5 19h.01M17.5 19h.01" />
                </svg>
              </button>
            )}
            <Link href={productPath} className={styles.detailsLink}>Explore the kit <span aria-hidden="true">↗</span></Link>
          </div>
          <div id="home-starter-kit-status" className={styles.cartStatus} role="status" aria-live="polite" aria-atomic="true">
            {storageUnavailable && checkoutEnabled && product.available ? (
              <p>Your browser couldn&apos;t save the cart here. You can add the kit in the store.</p>
            ) : notice ? <p>{notice}</p> : quantityInCart > 0 ? <p>{quantityInCart} {quantityInCart === 1 ? "kit" : "kits"} in your cart.</p> : null}
            {cartCount > 0 ? (
              <Link href="/store#store-cart-summary" className={styles.cartLink}>View cart ({cartCount}) <span aria-hidden="true">→</span></Link>
            ) : null}
          </div>
          {!checkoutEnabled ? (
            <p className={styles.availability}>Ordering opens soon. <Link href="#signup" className={styles.signupLink}>Join the crew</Link> for launch updates.</p>
          ) : !product.available ? (
            <p className={styles.availability}>{product.availabilityNote || "This kit is currently unavailable. Explore the kit for more details."}</p>
          ) : paymentMode === "test" ? (
            <p className={styles.fulfillment}>Store test mode is on. Checkout uses test payments only.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
