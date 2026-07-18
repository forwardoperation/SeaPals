import assert from "node:assert/strict";
import test from "node:test";
import { storeProductDefinitions } from "../../data/store/products.js";
import { getStoreConfiguration } from "./catalog.js";
import {
  CartValidationError,
  formatMoney,
  quoteCart,
} from "./cart.mjs";

const products = [
  {
    id: "coral-garden",
    sku: "SP-DECK-CORAL-GARDEN",
    deckId: "coral-garden",
    category: "expansion-decks",
    name: "Coral Garden",
    description: "A balanced deck.",
    checkoutDescription: "Coral Garden 60-card ready-to-play expansion deck.",
    image: "/coral.png",
    taxCode: "txcd_99999999",
    priceCents: 2000,
    available: true,
  },
  {
    id: "darkness-shroud",
    sku: "SP-DECK-DARKNESS-SHROUD",
    deckId: "darkness-shroud",
    category: "expansion-decks",
    name: "Darkness Shroud",
    description: "A deep-sea deck.",
    checkoutDescription: "Darkness Shroud 60-card expansion deck.",
    image: "/deep.png",
    taxCode: "txcd_99999999",
    priceCents: 2000,
    available: false,
  },
  {
    id: "starter-kit",
    sku: "SP-KIT-STARTER",
    deckId: null,
    category: "starter-kits",
    name: "Starter Kit",
    description: "Everything two players need to play.",
    checkoutDescription:
      "Includes two 60-card decks, conditions, dice, and Reef Point tokens.",
    image: "/starter-kit.svg",
    taxCode: "txcd_99999999",
    priceCents: 4000,
    available: true,
  },
  {
    id: "accessory-set",
    sku: "SP-ACC-SET",
    deckId: null,
    category: "game-accessories",
    name: "Accessory Set",
    description: "Shared gameplay accessories.",
    checkoutDescription:
      "Includes Dice Pack, Conditions Deck, and Reef Point Tokens.",
    image: "/accessory-set.svg",
    taxCode: "txcd_99999999",
    priceCents: 1000,
    available: true,
  },
];

const infrastructureEnvironment = {
  STORE_CHECKOUT_ENABLED: "true",
  STRIPE_SECRET_KEY: "sk_test_example",
  STRIPE_WEBHOOK_SECRET: "whsec_example",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-example",
};

function withStoreEnvironment(values, callback) {
  const relevantKeys = Object.keys(process.env).filter(
    (key) =>
      key.startsWith("STORE_") ||
      key.startsWith("STRIPE_") ||
      key === "NEXT_PUBLIC_SUPABASE_URL" ||
      key === "SUPABASE_SERVICE_ROLE_KEY"
  );
  const keys = new Set([...relevantKeys, ...Object.keys(values)]);
  const previousValues = new Map(
    [...keys].map((key) => [key, process.env[key]])
  );

  for (const key of keys) delete process.env[key];
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) process.env[key] = String(value);
  }

  try {
    return callback();
  } finally {
    for (const key of keys) {
      const previousValue = previousValues.get(key);
      if (previousValue === undefined) delete process.env[key];
      else process.env[key] = previousValue;
    }
  }
}

test("the catalog definitions use the established cash prices", () => {
  const definitionsById = new Map(
    storeProductDefinitions.map((product) => [product.id, product])
  );
  const expansionDecks = storeProductDefinitions.filter(
    (product) => product.category === "expansion-decks"
  );

  assert.equal(definitionsById.get("starter-kit").defaultPriceCents, 4000);
  assert.equal(definitionsById.get("accessory-set").defaultPriceCents, 1000);
  assert.equal(expansionDecks.length, 7);
  assert.ok(expansionDecks.every((product) => product.defaultPriceCents === 2000));

  for (const productId of [
    "reef-point-tokens",
    "dice-pack",
    "conditions-deck",
    "custom-t-shirt",
    "card-binder",
    "backpack",
    "plush-toy",
  ]) {
    assert.equal(definitionsById.get(productId).defaultPriceCents, null);
  }
});

test("the server catalog requires explicit product allowlisting", () => {
  withStoreEnvironment(
    {
      ...infrastructureEnvironment,
      STORE_AVAILABLE_PRODUCT_IDS:
        "starter-kit, accessory-set, reef-point-tokens, custom-t-shirt",
      STORE_AVAILABLE_DECK_IDS: "coral-garden",
      STORE_PRICE_CUSTOM_TSHIRT_CENTS: "2500",
    },
    () => {
      const configuration = getStoreConfiguration();
      const productsById = new Map(
        configuration.products.map((product) => [product.id, product])
      );

      assert.equal(productsById.get("starter-kit").priceCents, 4000);
      assert.equal(productsById.get("starter-kit").available, true);
      assert.equal(productsById.get("accessory-set").priceCents, 1000);
      assert.equal(productsById.get("accessory-set").available, true);
      assert.equal(productsById.get("reef-point-tokens").priceCents, null);
      assert.equal(productsById.get("reef-point-tokens").available, false);
      assert.equal(productsById.get("coral-garden").priceCents, 2000);
      assert.equal(productsById.get("coral-garden").available, false);

      const shirt = productsById.get("custom-t-shirt");
      assert.equal(shirt.priceCents, 2500);
      assert.equal(shirt.requiresConfiguration, true);
      assert.match(shirt.availabilityNote, /size/i);
      assert.equal(shirt.available, false);
      assert.equal(configuration.checkoutEnabled, true);
    }
  );
});

test("checkout stays closed when no product is actually available", () => {
  withStoreEnvironment(infrastructureEnvironment, () => {
    const configuration = getStoreConfiguration();

    assert.equal(
      configuration.products.some((product) => product.available),
      false
    );
    assert.equal(configuration.checkoutEnabled, false);
  });
});

test("legacy deck allowlisting and shared deck pricing remain supported", () => {
  withStoreEnvironment(
    {
      ...infrastructureEnvironment,
      STORE_AVAILABLE_DECK_IDS: "coral-garden",
      STORE_DEFAULT_PRICE_CENTS: "2250",
    },
    () => {
      const configuration = getStoreConfiguration();
      const coralGarden = configuration.products.find(
        (product) => product.id === "coral-garden"
      );
      const starterKit = configuration.products.find(
        (product) => product.id === "starter-kit"
      );

      assert.equal(coralGarden.priceCents, 2250);
      assert.equal(coralGarden.available, true);
      assert.equal(starterKit.priceCents, 4000);
      assert.equal(starterKit.available, false);
    }
  );
});

test("automatic tax requires a resolved code for every available product", () => {
  const baseEnvironment = {
    ...infrastructureEnvironment,
    STORE_AVAILABLE_PRODUCT_IDS: "starter-kit,backpack",
    STORE_PRICE_BACKPACK_CENTS: "3500",
    STRIPE_AUTOMATIC_TAX: "true",
    STRIPE_GAME_PRODUCT_TAX_CODE: "txcd_10000000",
  };

  withStoreEnvironment(baseEnvironment, () => {
    const configuration = getStoreConfiguration();
    const starterKit = configuration.products.find(
      (product) => product.id === "starter-kit"
    );
    const backpack = configuration.products.find(
      (product) => product.id === "backpack"
    );

    assert.equal(starterKit.taxCode, "txcd_10000000");
    assert.equal(backpack.taxCode, null);
    assert.equal(configuration.checkoutEnabled, false);
  });

  withStoreEnvironment(
    {
      ...baseEnvironment,
      STRIPE_STORAGE_TAX_CODE: "txcd_20000000",
    },
    () => {
      const configuration = getStoreConfiguration();
      const backpack = configuration.products.find(
        (product) => product.id === "backpack"
      );

      assert.equal(backpack.taxCode, "txcd_20000000");
      assert.equal(configuration.checkoutEnabled, true);
    }
  );
});

test("quoteCart resolves prices from the server catalog and totals shipping", () => {
  const quote = quoteCart(
    [
      { productId: "coral-garden", quantity: 1, priceCents: 1 },
      { productId: "coral-garden", quantity: 2, priceCents: 1 },
    ],
    products,
    { shippingCents: 500 }
  );

  assert.equal(quote.items.length, 1);
  assert.equal(quote.items[0].quantity, 3);
  assert.equal(quote.items[0].unitAmountCents, 2000);
  assert.equal(quote.items[0].checkoutDescription, products[0].checkoutDescription);
  assert.equal(quote.items[0].taxCode, "txcd_99999999");
  assert.equal(quote.items[0].category, "expansion-decks");
  assert.equal(quote.subtotalCents, 6000);
  assert.equal(quote.shippingCents, 500);
  assert.equal(quote.totalCents, 6500);
});

test("quoteCart supports kits and accessories without deck ids", () => {
  const quote = quoteCart(
    [
      { productId: "starter-kit", quantity: 1 },
      { productId: "accessory-set", quantity: 2 },
    ],
    products
  );

  assert.equal(quote.items[0].deckId, null);
  assert.equal(quote.items[0].unitAmountCents, 4000);
  assert.match(quote.items[0].checkoutDescription, /two 60-card decks/i);
  assert.equal(quote.items[1].deckId, null);
  assert.equal(quote.items[1].unitAmountCents, 1000);
  assert.equal(quote.totalQuantity, 3);
  assert.equal(quote.subtotalCents, 6000);
});

test("quoteCart rejects unknown and unavailable products", () => {
  assert.throws(
    () => quoteCart([{ productId: "not-real", quantity: 1 }], products),
    (error) =>
      error instanceof CartValidationError && error.code === "unknown_product"
  );

  assert.throws(
    () => quoteCart([{ productId: "darkness-shroud", quantity: 1 }], products),
    (error) =>
      error instanceof CartValidationError &&
      error.code === "unavailable_product"
  );
});

test("quoteCart enforces per-product and whole-cart quantity limits", () => {
  assert.throws(
    () => quoteCart([{ productId: "coral-garden", quantity: 11 }], products),
    (error) => error.code === "quantity_limit"
  );

  assert.throws(
    () =>
      quoteCart(
        [
          { productId: "coral-garden", quantity: 10 },
          { productId: "starter-kit", quantity: 11 },
        ],
        products,
        { maxPerProduct: 20, maxTotalQuantity: 20 }
      ),
    (error) => error.code === "cart_quantity_limit"
  );
});

test("quoteCart rejects empty and malformed carts", () => {
  assert.throws(() => quoteCart([], products), CartValidationError);
  assert.throws(
    () => quoteCart([{ productId: "coral-garden", quantity: 1.5 }], products),
    CartValidationError
  );
  assert.throws(() => quoteCart(null, products), CartValidationError);
});

test("formatMoney formats minor currency units", () => {
  assert.equal(formatMoney(2000, "usd"), "$20.00");
  assert.equal(formatMoney(null, "usd"), "Price pending");
});
