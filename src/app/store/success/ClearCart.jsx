"use client";

import { useEffect } from "react";

const CART_STORAGE_KEY = "seapals-store-cart-v1";

export default function ClearCart() {
  useEffect(() => {
    try {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    } catch {
      // Checkout has completed even if browser storage is unavailable.
    }
  }, []);

  return null;
}
