export class CartValidationError extends Error {
  constructor(message, code = "invalid_cart") {
    super(message);
    this.name = "CartValidationError";
    this.code = code;
  }
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

function normalizeShippingOption(value, fallbackShippingCents) {
  const amountCents = Number(value?.amountCents ?? fallbackShippingCents);
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new CartValidationError("Shipping is not configured correctly.");
  }

  const fulfillmentMethod =
    value?.fulfillmentMethod === "pickup" ? "pickup" : "shipping";
  const id = String(value?.id ?? "standard").trim().toLowerCase();
  const displayName = String(
    value?.displayName ?? "Standard Shipping & Handling"
  )
    .trim()
    .slice(0, 100);
  const pickupLocation =
    fulfillmentMethod === "pickup"
      ? String(value?.pickupLocation ?? "").trim().slice(0, 100)
      : null;

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !displayName) {
    throw new CartValidationError(
      "That fulfillment option is not available.",
      "invalid_shipping_option"
    );
  }

  if (fulfillmentMethod === "pickup" && (amountCents !== 0 || !pickupLocation)) {
    throw new CartValidationError("Local pickup is not configured correctly.");
  }

  return {
    id,
    displayName,
    description: String(value?.description ?? "").trim().slice(0, 200),
    fulfillmentMethod,
    pickupLocation,
    amountCents,
    deliveryEstimateMinDays:
      Number.isSafeInteger(value?.deliveryEstimateMinDays) &&
      value.deliveryEstimateMinDays > 0
        ? value.deliveryEstimateMinDays
        : null,
    deliveryEstimateMaxDays:
      Number.isSafeInteger(value?.deliveryEstimateMaxDays) &&
      value.deliveryEstimateMaxDays > 0
        ? value.deliveryEstimateMaxDays
        : null,
  };
}

export function quoteCart(
  requestedItems,
  products,
  {
    fulfillmentOption = null,
    shippingOption = null,
    shippingCents = 0,
    maxPerProduct = 10,
    maxTotalQuantity = 20,
  } = {}
) {
  const items = normalizeCartItems(requestedItems);

  if (!items.length) {
    throw new CartValidationError("Add at least one item before checking out.");
  }

  const productsById = new Map(products.map((product) => [product.id, product]));
  let totalQuantity = 0;
  let subtotalCents = 0;

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

    if (quantity > maxPerProduct) {
      throw new CartValidationError(
        `You can order up to ${maxPerProduct} of each item at once.`,
        "quantity_limit"
      );
    }

    const lineTotalCents = product.priceCents * quantity;
    if (!Number.isSafeInteger(lineTotalCents)) {
      throw new CartValidationError("That order total is too large.");
    }

    totalQuantity += quantity;
    subtotalCents += lineTotalCents;

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
      quantity,
      lineTotalCents,
    };
  });

  if (totalQuantity > maxTotalQuantity) {
    throw new CartValidationError(
      `You can order up to ${maxTotalQuantity} items at once. Contact us for a larger order.`,
      "cart_quantity_limit"
    );
  }

  const normalizedShippingOption = normalizeShippingOption(
    fulfillmentOption ?? shippingOption,
    shippingCents
  );
  const normalizedShipping = normalizedShippingOption.amountCents;

  const totalCents = subtotalCents + normalizedShipping;
  if (!Number.isSafeInteger(totalCents)) {
    throw new CartValidationError("That order total is too large.");
  }

  return {
    items: quotedItems,
    totalQuantity,
    subtotalCents,
    fulfillmentOption: normalizedShippingOption,
    fulfillmentOptionId: normalizedShippingOption.id,
    fulfillmentOptionName: normalizedShippingOption.displayName,
    fulfillmentMethod: normalizedShippingOption.fulfillmentMethod,
    pickupLocation: normalizedShippingOption.pickupLocation,
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
