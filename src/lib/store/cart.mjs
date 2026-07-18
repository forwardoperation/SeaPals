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

export function quoteCart(
  requestedItems,
  products,
  { shippingCents = 0, maxPerProduct = 10, maxTotalQuantity = 20 } = {}
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

  const normalizedShipping = Number(shippingCents);
  if (!Number.isSafeInteger(normalizedShipping) || normalizedShipping < 0) {
    throw new CartValidationError("Shipping is not configured correctly.");
  }

  const totalCents = subtotalCents + normalizedShipping;
  if (!Number.isSafeInteger(totalCents)) {
    throw new CartValidationError("That order total is too large.");
  }

  return {
    items: quotedItems,
    totalQuantity,
    subtotalCents,
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
