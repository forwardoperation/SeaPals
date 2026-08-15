import {
  defaultStoreProductionOptionId,
  storeProductionOptionDefinitions,
} from "../../data/store/production.js";
import {
  resolveStoreShippingRateTier,
  STORE_MAX_SHIPPING_WEIGHT_OUNCES,
  storeShippingOptionDefinitions,
} from "../../data/store/shipping.js";

export const STORE_MAX_PER_PRODUCT_QUANTITY = 8;
export const STORE_MAX_CART_QUANTITY = 8;

export class CartValidationError extends Error {
  constructor(message, code = "invalid_cart") {
    super(message);
    this.name = "CartValidationError";
    this.code = code;
  }
}

function normalizeProductionOption(value) {
  const requestedId = String(value?.id ?? defaultStoreProductionOptionId)
    .trim()
    .toLowerCase();
  const definition = storeProductionOptionDefinitions.find(
    (option) => option.id === requestedId
  );

  if (!definition) {
    throw new CartValidationError(
      "That production option is not available.",
      "invalid_production_option"
    );
  }

  const amountCents = Number(value?.amountCents ?? definition.amountCents);
  const maxBusinessDays = Number(
    value?.maxBusinessDays ?? definition.maxBusinessDays
  );
  const displayName = String(value?.displayName ?? definition.displayName)
    .trim()
    .slice(0, 100);

  if (
    amountCents !== definition.amountCents ||
    maxBusinessDays !== definition.maxBusinessDays ||
    displayName !== definition.displayName
  ) {
    throw new CartValidationError(
      "That production option is not configured correctly.",
      "invalid_production_option"
    );
  }

  return {
    id: definition.id,
    displayName: definition.displayName,
    description: definition.description,
    amountCents: definition.amountCents,
    maxBusinessDays: definition.maxBusinessDays,
    expedited: definition.expedited,
    taxCodeEnvKey: definition.taxCodeEnvKey,
    defaultTaxCode: definition.defaultTaxCode,
  };
}

export function normalizeCartItems(value) {
  if (!Array.isArray(value)) {
    throw new CartValidationError("Your cart could not be read.");
  }

  const quantities = new Map();

  for (const entry of value) {
    const productId = String(entry?.productId ?? "").trim();
    const quantity = Number(entry?.quantity);

    if (!productId || !Number.isSafeInteger(quantity) || quantity < 1) {
      throw new CartValidationError(
        "Every cart item needs a valid product and quantity."
      );
    }

    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
  }

  return [...quantities.entries()].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

function normalizeShippingOption(value, fallbackShippingCents, weightOunces) {
  const id = String(value?.id ?? "standard").trim().toLowerCase();
  const definition = storeShippingOptionDefinitions.find(
    (option) => option.id === id
  );

  if (!definition) {
    throw new CartValidationError(
      "That fulfillment option is not available.",
      "invalid_shipping_option"
    );
  }

  const providedAmount = value?.amountCents ?? fallbackShippingCents;
  if (
    providedAmount !== null &&
    providedAmount !== undefined &&
    (!Number.isSafeInteger(Number(providedAmount)) || Number(providedAmount) < 0)
  ) {
    throw new CartValidationError("Shipping is not configured correctly.");
  }

  const fulfillmentMethod = definition.fulfillmentMethod;
  if (
    value?.fulfillmentMethod &&
    value.fulfillmentMethod !== fulfillmentMethod
  ) {
    throw new CartValidationError(
      "That fulfillment option is not available.",
      "invalid_shipping_option"
    );
  }

  const displayName = String(value?.displayName ?? definition.displayName)
    .trim()
    .slice(0, 100);
  const pickupLocation =
    fulfillmentMethod === "pickup"
      ? String(value?.pickupLocation ?? definition.pickupLocation ?? "")
          .trim()
          .slice(0, 100)
      : null;

  if (!displayName) {
    throw new CartValidationError(
      "That fulfillment option is not available.",
      "invalid_shipping_option"
    );
  }

  if (
    fulfillmentMethod === "pickup" &&
    ((providedAmount !== null &&
      providedAmount !== undefined &&
      Number(providedAmount) !== 0) ||
      !pickupLocation)
  ) {
    throw new CartValidationError(
      "Scheduled pickup is not configured correctly."
    );
  }

  const rateTier = resolveStoreShippingRateTier(
    {
      ...definition,
      ...value,
      ...(providedAmount !== null && providedAmount !== undefined
        ? { amountCents: Number(providedAmount) }
        : {}),
    },
    weightOunces
  );

  if (!rateTier) {
    throw new CartValidationError(
      "Shipping is not configured for that order.",
      "shipping_weight_limit"
    );
  }

  return {
    id,
    displayName,
    description: String(value?.description ?? definition.description ?? "")
      .trim()
      .slice(0, 200),
    fulfillmentMethod,
    pickupLocation,
    amountCents: rateTier.amountCents,
    rateTierId: rateTier.id,
    rateTierMaxWeightOunces: rateTier.maxWeightOunces,
    deliveryEstimateMinDays:
      Number.isSafeInteger(
        value?.deliveryEstimateMinDays ?? definition.deliveryEstimateMinDays
      ) &&
      (value?.deliveryEstimateMinDays ?? definition.deliveryEstimateMinDays) > 0
        ? (value?.deliveryEstimateMinDays ?? definition.deliveryEstimateMinDays)
        : null,
    deliveryEstimateMaxDays:
      Number.isSafeInteger(
        value?.deliveryEstimateMaxDays ?? definition.deliveryEstimateMaxDays
      ) &&
      (value?.deliveryEstimateMaxDays ?? definition.deliveryEstimateMaxDays) > 0
        ? (value?.deliveryEstimateMaxDays ?? definition.deliveryEstimateMaxDays)
        : null,
  };
}

export function quoteCart(
  requestedItems,
  products,
  {
    fulfillmentOption = null,
    productionOption = null,
    shippingOption = null,
    shippingCents = null,
    maxPerProduct = STORE_MAX_PER_PRODUCT_QUANTITY,
    maxTotalQuantity = STORE_MAX_CART_QUANTITY,
  } = {}
) {
  const items = normalizeCartItems(requestedItems);

  if (!items.length) {
    throw new CartValidationError("Add at least one item before checking out.");
  }

  const productsById = new Map(products.map((product) => [product.id, product]));
  const effectiveMaxPerProduct = Math.min(
    STORE_MAX_PER_PRODUCT_QUANTITY,
    Number.isSafeInteger(maxPerProduct) && maxPerProduct > 0
      ? maxPerProduct
      : STORE_MAX_PER_PRODUCT_QUANTITY
  );
  const effectiveMaxTotalQuantity = Math.min(
    STORE_MAX_CART_QUANTITY,
    Number.isSafeInteger(maxTotalQuantity) && maxTotalQuantity > 0
      ? maxTotalQuantity
      : STORE_MAX_CART_QUANTITY
  );
  let totalQuantity = 0;
  let subtotalCents = 0;
  let shippingWeightOunces = 0;

  const quotedItems = items.map(({ productId, quantity }) => {
    const product = productsById.get(productId);

    if (!product) {
      throw new CartValidationError(
        "One of those items is no longer in the catalog.",
        "unknown_product"
      );
    }

    if (!product.available || !Number.isSafeInteger(product.priceCents)) {
      throw new CartValidationError(
        `${product.name} is not available to order yet.`,
        "unavailable_product"
      );
    }

    if (quantity > effectiveMaxPerProduct) {
      throw new CartValidationError(
        `You can order up to ${effectiveMaxPerProduct} of each item at once.`,
        "quantity_limit"
      );
    }

    if (
      !Number.isSafeInteger(product.shippingWeightOunces) ||
      product.shippingWeightOunces < 1
    ) {
      throw new CartValidationError(
        `${product.name} does not have a valid shipping weight.`,
        "invalid_shipping_weight"
      );
    }

    const lineTotalCents = product.priceCents * quantity;
    const lineShippingWeightOunces = product.shippingWeightOunces * quantity;
    if (
      !Number.isSafeInteger(lineTotalCents) ||
      !Number.isSafeInteger(lineShippingWeightOunces)
    ) {
      throw new CartValidationError("That order total is too large.");
    }

    totalQuantity += quantity;
    subtotalCents += lineTotalCents;
    shippingWeightOunces += lineShippingWeightOunces;

    return {
      productId: product.id,
      sku: product.sku,
      deckId: product.deckId,
      category: product.category,
      name: product.name,
      description: product.description,
      checkoutDescription:
        product.checkoutDescription || product.description || product.name,
      image: product.image,
      taxCode: product.taxCode ?? null,
      unitAmountCents: product.priceCents,
      shippingWeightOunces: product.shippingWeightOunces,
      quantity,
      lineTotalCents,
      lineShippingWeightOunces,
    };
  });

  if (totalQuantity > effectiveMaxTotalQuantity) {
    throw new CartValidationError(
      `You can order up to ${effectiveMaxTotalQuantity} items at once. Contact us for a larger order.`,
      "cart_quantity_limit"
    );
  }

  if (
    !Number.isSafeInteger(shippingWeightOunces) ||
    shippingWeightOunces > STORE_MAX_SHIPPING_WEIGHT_OUNCES
  ) {
    throw new CartValidationError(
      "Online checkout supports mailed orders up to 8 lb. Contact us for a larger order.",
      "shipping_weight_limit"
    );
  }

  const normalizedShippingOption = normalizeShippingOption(
    fulfillmentOption ?? shippingOption,
    shippingCents,
    shippingWeightOunces
  );
  const normalizedShipping = normalizedShippingOption.amountCents;
  const normalizedProductionOption = normalizeProductionOption(productionOption);
  const productionCents = normalizedProductionOption.amountCents;

  const totalCents = subtotalCents + productionCents + normalizedShipping;
  if (!Number.isSafeInteger(totalCents)) {
    throw new CartValidationError("That order total is too large.");
  }

  return {
    items: quotedItems,
    totalQuantity,
    shippingWeightOunces,
    subtotalCents,
    productionOption: normalizedProductionOption,
    productionOptionId: normalizedProductionOption.id,
    productionOptionName: normalizedProductionOption.displayName,
    productionMaxBusinessDays: normalizedProductionOption.maxBusinessDays,
    productionCents,
    fulfillmentOption: normalizedShippingOption,
    fulfillmentOptionId: normalizedShippingOption.id,
    fulfillmentOptionName: normalizedShippingOption.displayName,
    fulfillmentMethod: normalizedShippingOption.fulfillmentMethod,
    pickupLocation: normalizedShippingOption.pickupLocation,
    shippingRateTierId: normalizedShippingOption.rateTierId,
    shippingCents: normalizedShipping,
    totalCents,
  };
}

export function formatMoney(amountCents, currency = "usd", locale = "en-US") {
  if (!Number.isFinite(amountCents)) return "Price pending";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: String(currency).toUpperCase(),
  }).format(amountCents / 100);
}
