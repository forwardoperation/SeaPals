export const STORE_BINDER_PRODUCT_ID = "card-binder";
export const STORE_BINDER_SKU = "SP-MERCH-CARD-BINDER";
export const STORE_BINDER_SHIPPING_CENTS = 999;
export const STORE_BINDER_LEAD_TIME_WEEKS = 5;

export function cartContainsStoreBinder(items) {
  return items.some((item) =>
    (item.productId ?? item.product?.id ?? item.id) === STORE_BINDER_PRODUCT_ID
  );
}

// Retain the standard production identifier and zero production fee. The
// ledger stores 25 weekdays for compatibility, but binder deadlines use five
// calendar weeks after payment, including orders placed on a weekend.
export const storeBinderProductionOption = Object.freeze({
  id: "standard-production",
  displayName: "Standard production",
  description: "5-week lead time after payment before shipping or pickup. Shipping transit time is additional. No expedited production or shipping.",
  amountCents: 0,
  maxBusinessDays: 25,
  leadTimeWeeks: STORE_BINDER_LEAD_TIME_WEEKS,
  expedited: false,
  taxCodeEnvKey: null,
  defaultTaxCode: null,
});
