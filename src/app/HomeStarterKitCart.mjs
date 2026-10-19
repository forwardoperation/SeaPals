import {
  STORE_MAX_CART_QUANTITY,
  STORE_MAX_PER_PRODUCT_QUANTITY,
} from "../lib/store/cart.mjs";
import { getStoreProductOrderState } from "../lib/store/productDetails.mjs";

// Shared with Storefront and ClearCart. Preserve their existing storage format.
export const HOME_STARTER_KIT_CART_STORAGE_KEY = "seapals-store-cart-v1";

export function readHomeStarterKitCart(raw, products) {
  if (!raw) return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  const items = Array.isArray(parsed) ? parsed
    : Array.isArray(parsed?.items) ? parsed.items
      : parsed && typeof parsed === "object"
        ? Object.entries(parsed).map(([productId, quantity]) => ({ productId, quantity }))
        : [];
  const available = new Set(products.filter((product) => product.available).map((product) => product.id));
  const cart = {};
  let total = 0;
  for (const item of items) {
    const productId = String(item?.productId ?? "");
    const quantity = Math.floor(Number(item?.quantity ?? 0));
    if (!available.has(productId) || !Number.isFinite(quantity) || quantity < 1) continue;
    const accepted = Math.min(quantity,
      STORE_MAX_PER_PRODUCT_QUANTITY - (cart[productId] ?? 0),
      STORE_MAX_CART_QUANTITY - total);
    if (accepted < 1) continue;
    cart[productId] = (cart[productId] ?? 0) + accepted;
    total += accepted;
  }
  return cart;
}

export function countHomeStarterKitCart(cart) {
  return Object.values(cart).reduce((total, quantity) => total + quantity, 0);
}

export function addHomeStarterKitToCart({ storage, products, product, checkoutEnabled }) {
  // Re-read at click time so a newer saved cart is not replaced by an older
  // homepage snapshot, including changes made in another tab.
  const currentCart = readHomeStarterKitCart(storage.getItem(HOME_STARTER_KIT_CART_STORAGE_KEY), products);
  const currentQuantity = currentCart[product.id] ?? 0;
  const currentState = getStoreProductOrderState({
    product,
    checkoutEnabled,
    quantityInCart: currentQuantity,
    cartCount: countHomeStarterKitCart(currentCart),
  });
  const catalogAllowsProduct = products.some((entry) => entry.id === product.id && entry.available);
  if (!catalogAllowsProduct || !currentState.canAdd) {
    return {
      added: false,
      cart: currentCart,
      notice: currentState.buttonLabel === "Cart limit reached"
        ? currentQuantity >= STORE_MAX_PER_PRODUCT_QUANTITY
          ? `You can add up to ${STORE_MAX_PER_PRODUCT_QUANTITY} of this kit per order. You can make changes in the store.`
          : `Your cart has reached its ${STORE_MAX_CART_QUANTITY}-item limit. You can make changes in the store.`
        : "This kit cannot be added right now. Check the store for availability.",
    };
  }
  const nextCart = { ...currentCart, [product.id]: currentQuantity + 1 };
  // Let storage errors reach the caller. Success is returned only after the
  // store's canonical { items } payload is saved successfully.
  storage.setItem(HOME_STARTER_KIT_CART_STORAGE_KEY, JSON.stringify({
    items: Object.entries(nextCart).map(([productId, quantity]) => ({ productId, quantity })),
  }));
  return {
    added: true,
    cart: nextCart,
    notice: `${product.name} added. ${currentQuantity + 1} in your cart.`,
  };
}
