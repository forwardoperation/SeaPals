"use client";

import { useEffect } from "react";
import { urlWithoutCheckoutSessionId } from "./successUrl.mjs";

const CART_STORAGE_KEY = "seapals-store-cart-v1";
const CHECKOUT_REQUEST_STORAGE_KEY = "seapals-store-checkout-request-v1";

export default function ClearCart({ clearCart = false }) {
  useEffect(() => {
    if (clearCart) {
      try {
        window.localStorage.removeItem(CART_STORAGE_KEY);
        window.sessionStorage.removeItem(CHECKOUT_REQUEST_STORAGE_KEY);
      } catch {
        // Checkout has completed even if browser storage is unavailable.
      }
    }

    const sanitizedUrl = urlWithoutCheckoutSessionId(window.location.href);
    if (sanitizedUrl) {
      window.history.replaceState(window.history.state, "", sanitizedUrl);
    }
  }, [clearCart]);

  return null;
}
