import {
  STORE_MAX_CART_QUANTITY,
  STORE_MAX_PER_PRODUCT_QUANTITY,
} from "./cart.mjs";

export function getStoreProductPath(productId) {
  if (typeof productId !== "string" || productId.length === 0) {
    throw new TypeError("A product ID is required.");
  }
  return `/store/${encodeURIComponent(productId)}`;
}

// Resolve only the server's visible catalog. A known inventory SKU or a future
// product definition does not make a hidden product route public.
export function getStoreProductById(products, productId) {
  if (!Array.isArray(products) || typeof productId !== "string") return null;
  return products.find((product) => product?.id === productId) ?? null;
}

export function getStoreProductOrderState({
  product,
  checkoutEnabled,
  quantityInCart = 0,
  cartCount = 0,
  isCheckingOut = false,
}) {
  const limitReached = quantityInCart >= STORE_MAX_PER_PRODUCT_QUANTITY ||
    cartCount >= STORE_MAX_CART_QUANTITY;
  const canAdd = Boolean(checkoutEnabled && product?.available) &&
    !limitReached && !isCheckingOut;

  let buttonLabel;
  if (!product?.available) {
    buttonLabel = product?.requiresConfiguration
      ? "Options coming soon"
      : !product?.priceConfigured
        ? "Price to confirm"
        : checkoutEnabled ? "Unavailable" : "Preview only";
  } else if (!checkoutEnabled) {
    buttonLabel = "Preview only";
  } else if (isCheckingOut) {
    buttonLabel = "Preparing checkout…";
  } else if (limitReached) {
    buttonLabel = "Cart limit reached";
  } else if (quantityInCart > 0) {
    buttonLabel = product.preorder ? "Add another pre-order" : "Add another";
  } else {
    buttonLabel = product.preorder ? "Pre-order" : "Add to cart";
  }

  return { canAdd, buttonLabel };
}
