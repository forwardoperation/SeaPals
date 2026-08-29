import assert from "node:assert/strict";
import test from "node:test";
import {
  storeLaunchProductIds,
  storeProductDefinitions,
} from "../../data/store/products.js";
import { getStoreConfiguration } from "./catalog.js";
import {
  CartValidationError,
  formatMoney,
  quoteCart,
  STORE_MAX_CART_QUANTITY,
  STORE_MAX_PER_PRODUCT_QUANTITY,
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
    shippingWeightOunces: 8,
    taxCode: "txcd_99999999",
    priceCents: 2200,
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
    shippingWeightOunces: 8,
    taxCode: "txcd_99999999",
    priceCents: 2200,
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
      "Includes two 60-card decks, an 18-card Conditions Deck, seven dice, and 15 Reef Point tokens.",
    image: "/starter-kit.svg",
    shippingWeightOunces: 16,
    taxCode: "txcd_99999999",
    priceCents: 4400,
    available: true,
  },
  {
    id: "accessory-set",
    sku: "SP-ACC-SET",
    deckId: null,
    category: "game-accessories",
    name: "Accessories Kit",
    description: "Shared gameplay accessories.",
    checkoutDescription:
      "Includes an 18-card Conditions Deck, seven dice, and 15 Reef Point tokens.",
    image: "/accessory-set.svg",
    shippingWeightOunces: 16,
    taxCode: "txcd_99999999",
    priceCents: 1200,
    available: true,
  },
  {
    id: "oceanic-dive-pack",
    sku: "SP-PACK-OCEANIC",
    deckId: null,
    category: "dive-packs",
    name: "Pelagic Rush Dive Pack",
    description: "An Oceanic Set Dive Pack.",
    checkoutDescription: "One Oceanic Set Dive Pack.",
    image: "/killer-whale.png",
    shippingWeightOunces: 8,
    taxCode: "txcd_99999999",
    priceCents: 1000,
    available: true,
  },
];

const infrastructureEnvironment = {
  STORE_CHECKOUT_ENABLED: "true",
  STRIPE_SECRET_KEY: "sk_test_example",
  STRIPE_WEBHOOK_SECRET: "whsec_example",
  STRIPE_PAYMENT_METHOD_CONFIGURATION_ID: "pmc_test_synchronous",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-example",
  RESEND_API_KEY: "re_storefront_test_value",
  EMAIL_FROM: "SeaPals <maker@seapalstcg.com>",
  STORE_ORDER_NOTIFICATION_ENABLED: "true",
  STORE_ORDER_NOTIFICATION_EMAIL: "maker@seapalstcg.com",
  STORE_ORDER_NOTIFICATION_DELIVERY_CONFIRMED: "true",
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
  const divePacks = storeProductDefinitions.filter(
    (product) => product.category === "dive-packs"
  );

  assert.equal(definitionsById.get("starter-kit").defaultPriceCents, 4400);
  assert.equal(definitionsById.get("accessory-set").defaultPriceCents, 1200);
  assert.equal(expansionDecks.length, 7);
  assert.ok(expansionDecks.every((product) => product.defaultPriceCents === 2200));
  assert.equal(divePacks.length, 3);
  assert.ok(divePacks.every((product) => product.defaultPriceCents === 1000));
  assert.equal(
    definitionsById.get("dice-pack").details,
    "7 dice: one each D4, D6, D8, D10, D12, D20, and D100"
  );
  assert.equal(
    definitionsById.get("reef-point-tokens").details,
    "15 Reef Point tokens"
  );

  for (const productId of [
    "custom-t-shirt",
    "card-binder",
    "backpack",
    "plush-toy",
  ]) {
    assert.equal(definitionsById.get(productId).defaultPriceCents, null);
  }

  for (const productId of [
    "reef-point-tokens",
    "dice-pack",
    "conditions-deck",
  ]) {
    assert.equal(definitionsById.get(productId).defaultPriceCents, 500);
  }
});

test("the default storefront is limited to the twelve approved launch products", () => {
  withStoreEnvironment({}, () => {
    const configuration = getStoreConfiguration();

    assert.deepEqual(
      configuration.products.map((product) => product.id),
      storeLaunchProductIds
    );
    assert.equal(configuration.products.length, 12);
    assert.equal(
      configuration.products.some((product) => product.id === "starter-kit"),
      true
    );
    assert.equal(
      configuration.products.some((product) => product.id === "accessory-set"),
      true
    );
    assert.equal(
      configuration.products.some(
        (product) => product.id === "oceanic-dive-pack"
      ),
      true
    );
    assert.equal(
      configuration.products.some((product) => product.id === "custom-t-shirt"),
      false
    );
    assert.deepEqual(
      configuration.shippingOptions.map((option) => ({
        id: option.id,
        amountCents: option.amountCents,
        deliveryEstimateMinDays: option.deliveryEstimateMinDays,
        deliveryEstimateMaxDays: option.deliveryEstimateMaxDays,
      })),
      [
        {
          id: "standard",
          amountCents: 1000,
          deliveryEstimateMinDays: 2,
          deliveryEstimateMaxDays: 7,
        },
        {
          id: "priority",
          amountCents: 1500,
          deliveryEstimateMinDays: 2,
          deliveryEstimateMaxDays: 3,
        },
      ]
    );
  });
});

test("the catalog exposes server-controlled shipping and scheduled Elverson pickup", () => {
  withStoreEnvironment(
    {
      STORE_STANDARD_SHIPPING_CENTS: "800",
      STORE_PRIORITY_SHIPPING_CENTS: "1350",
      STORE_DIVE_PACK_ONLY_STANDARD_SHIPPING_CENTS: "450",
      STORE_DIVE_PACK_ONLY_PRIORITY_SHIPPING_CENTS: "950",
      STORE_LARGE_STANDARD_SHIPPING_CENTS: "2100",
      STORE_LARGE_PRIORITY_SHIPPING_CENTS: "3600",
      STORE_LOCAL_PICKUP_ENABLED: "true",
    },
    () => {
      const configuration = getStoreConfiguration();

      assert.equal(configuration.defaultShippingOptionId, "standard");
      assert.deepEqual(
        configuration.shippingOptions.map((option) => ({
          id: option.id,
          displayName: option.displayName,
          shortName: option.shortName,
          description: option.description,
          amountCents: option.amountCents,
          fulfillmentMethod: option.fulfillmentMethod,
          pickupLocation: option.pickupLocation,
          rateTiers: option.rateTiers,
          deliveryEstimateMinDays: option.deliveryEstimateMinDays,
          deliveryEstimateMaxDays: option.deliveryEstimateMaxDays,
        })),
        [
          {
            id: "standard",
            displayName: "Standard Shipping & Handling",
            shortName: "Standard",
            description:
              "Economy carrier service after production; estimated 2–7 business days in transit.",
            amountCents: 800,
            fulfillmentMethod: "shipping",
            pickupLocation: null,
            rateTiers: [
              {
                id: "dive-pack-base",
                maxWeightOunces: 16,
                amountCents: 450,
              },
              { id: "base", maxWeightOunces: 16, amountCents: 800 },
              { id: "large", maxWeightOunces: 128, amountCents: 2100 },
            ],
            deliveryEstimateMinDays: 2,
            deliveryEstimateMaxDays: 7,
          },
          {
            id: "priority",
            displayName: "Priority Shipping & Handling",
            shortName: "Priority",
            description:
              "USPS Priority Mail after production; estimated 2–3 business days in transit. This does not change production time.",
            amountCents: 1350,
            fulfillmentMethod: "shipping",
            pickupLocation: null,
            rateTiers: [
              {
                id: "dive-pack-base",
                maxWeightOunces: 16,
                amountCents: 950,
              },
              { id: "base", maxWeightOunces: 16, amountCents: 1350 },
              { id: "large", maxWeightOunces: 128, amountCents: 3600 },
            ],
            deliveryEstimateMinDays: 2,
            deliveryEstimateMaxDays: 3,
          },
          {
            id: "pickup-elverson-pa",
            displayName: "Scheduled pickup — Elverson, PA",
            shortName: "Scheduled pickup",
            description:
              "Free scheduled pickup. We will email after your order is built to arrange a pickup time.",
            amountCents: 0,
            fulfillmentMethod: "pickup",
            pickupLocation: "Elverson, PA",
            rateTiers: [],
            deliveryEstimateMinDays: null,
            deliveryEstimateMaxDays: null,
          },
        ]
      );
    }
  );
});

test("scheduled pickup can be shown while its unconfirmed tax sourcing keeps live checkout closed", () => {
  withStoreEnvironment(
    {
      ...infrastructureEnvironment,
      STRIPE_SECRET_KEY: "rk_live_example",
      STORE_CHECKOUT_ENABLED: "true",
      STORE_AVAILABLE_PRODUCT_IDS: "starter-kit",
      STORE_LOCAL_PICKUP_ENABLED: "true",
      STORE_TAX_REGISTRATION_CONFIRMED: "true",
      STORE_CATALOG_CONFIRMED: "true",
      STORE_SHIPPING_RATES_CONFIRMED: "true",
      STORE_PICKUP_TAX_CONFIRMED: "false",
      STRIPE_PICKUP_TAX_RATE_ID: "txr_live_elverson_pa",
      STORE_SYNCHRONOUS_PAYMENT_METHODS_CONFIRMED: "true",
      STRIPE_AUTOMATIC_TAX: "true",
      STRIPE_GAME_PRODUCT_TAX_CODE: "txcd_99999999",
      STRIPE_SHIPPING_TAX_CODE: "txcd_92010001",
    },
    () => {
      const configuration = getStoreConfiguration();
      const pickup = configuration.shippingOptions.find(
        (option) => option.id === "pickup-elverson-pa"
      );

      assert.equal(pickup?.displayName, "Scheduled pickup — Elverson, PA");
      assert.equal(pickup?.amountCents, 0);
      assert.equal(configuration.pickupTaxConfirmed, false);
      assert.equal(
        configuration.pickupTaxRateId,
        "txr_live_elverson_pa"
      );
      assert.equal(configuration.checkoutEnabled, false);
    }
  );

  withStoreEnvironment(
    {
      ...infrastructureEnvironment,
      STRIPE_SECRET_KEY: "rk_live_example",
      STORE_CHECKOUT_ENABLED: "true",
      STORE_AVAILABLE_PRODUCT_IDS: "starter-kit",
      STORE_LOCAL_PICKUP_ENABLED: "true",
      STORE_TAX_REGISTRATION_CONFIRMED: "true",
      STORE_CATALOG_CONFIRMED: "true",
      STORE_SHIPPING_RATES_CONFIRMED: "true",
      STORE_PICKUP_TAX_CONFIRMED: "true",
      STRIPE_PICKUP_TAX_RATE_ID: "not-a-tax-rate",
      STORE_SYNCHRONOUS_PAYMENT_METHODS_CONFIRMED: "true",
      STRIPE_AUTOMATIC_TAX: "true",
      STRIPE_GAME_PRODUCT_TAX_CODE: "txcd_99999999",
      STRIPE_SHIPPING_TAX_CODE: "txcd_92010001",
    },
    () => {
      const configuration = getStoreConfiguration();

      assert.equal(configuration.pickupTaxConfirmed, true);
      assert.equal(configuration.pickupTaxRateId, null);
      assert.equal(configuration.checkoutEnabled, false);
    }
  );

  withStoreEnvironment(
    {
      ...infrastructureEnvironment,
      STRIPE_SECRET_KEY: "rk_live_example",
      STORE_CHECKOUT_ENABLED: "false",
      STORE_AVAILABLE_PRODUCT_IDS: "starter-kit",
      STORE_LOCAL_PICKUP_ENABLED: "true",
      STORE_TAX_REGISTRATION_CONFIRMED: "true",
      STORE_CATALOG_CONFIRMED: "true",
      STORE_SHIPPING_RATES_CONFIRMED: "true",
      STORE_PICKUP_TAX_CONFIRMED: "true",
      STRIPE_PICKUP_TAX_RATE_ID: "txr_live_elverson_pa",
      STORE_SYNCHRONOUS_PAYMENT_METHODS_CONFIRMED: "true",
      STRIPE_AUTOMATIC_TAX: "true",
      STRIPE_GAME_PRODUCT_TAX_CODE: "txcd_99999999",
      STRIPE_SHIPPING_TAX_CODE: "txcd_92010001",
    },
    () => {
      const configuration = getStoreConfiguration();

      assert.equal(configuration.pickupTaxConfirmed, true);
      assert.equal(
        configuration.pickupTaxRateId,
        "txr_live_elverson_pa"
      );
      assert.equal(configuration.checkoutEnabled, false);
    }
  );
});

test("future catalog products require an explicit preview switch", () => {
  withStoreEnvironment({ STORE_SHOW_FUTURE_PRODUCTS: "true" }, () => {
    const configuration = getStoreConfiguration();

    assert.equal(configuration.products.length, storeProductDefinitions.length);
    assert.ok(
      configuration.products.some((product) => product.id === "conditions-deck")
    );
    assert.ok(
      configuration.products.some((product) => product.id === "custom-t-shirt")
    );
  });
});

test("the server catalog requires explicit product allowlisting", () => {
  withStoreEnvironment(
    {
      ...infrastructureEnvironment,
      STORE_SHOW_FUTURE_PRODUCTS: "true",
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

      assert.equal(productsById.get("starter-kit").priceCents, 4400);
      assert.equal(productsById.get("starter-kit").available, true);
      assert.equal(productsById.get("accessory-set").priceCents, 1200);
      assert.equal(productsById.get("accessory-set").available, true);
      assert.equal(productsById.get("reef-point-tokens").priceCents, 500);
      assert.equal(productsById.get("reef-point-tokens").available, true);
      assert.equal(productsById.get("coral-garden").priceCents, 2200);
      assert.equal(productsById.get("coral-garden").available, false);

      const shirt = productsById.get("custom-t-shirt");
      assert.equal(shirt.priceCents, 2500);
      assert.equal(shirt.requiresConfiguration, true);
      assert.match(shirt.availabilityNote, /size/i);
      assert.equal(shirt.available, false);
      assert.equal(configuration.checkoutEnabled, true);
      assert.equal(configuration.paymentMode, "test");
    }
  );
});

test("game accessories retain their server-controlled source prices", () => {
  const accessoryIds = [
    "accessory-set",
    "conditions-deck",
    "dice-pack",
    "reef-point-tokens",
  ];

  withStoreEnvironment(
    {
      ...infrastructureEnvironment,
      STORE_SHOW_FUTURE_PRODUCTS: "true",
      STORE_AVAILABLE_PRODUCT_IDS: accessoryIds.join(","),
    },
    () => {
      const accessories = getStoreConfiguration().products.filter((product) =>
        accessoryIds.includes(product.id)
      );

      assert.equal(accessories.length, 4);
      assert.ok(accessories.every((product) => product.priceConfigured));
      assert.ok(accessories.every((product) => product.available));
      assert.deepEqual(
        Object.fromEntries(
          accessories.map((product) => [product.id, product.priceCents])
        ),
        {
          "accessory-set": 1200,
          "conditions-deck": 500,
          "dice-pack": 500,
          "reef-point-tokens": 500,
        }
      );
    }
  );
});

test("the twelve-product launch catalog preserves the eight-item cart limit", () => {
  withStoreEnvironment(
    {
      ...infrastructureEnvironment,
      STORE_CHECKOUT_ENABLED: "false",
      STORE_AVAILABLE_PRODUCT_IDS: storeLaunchProductIds.join(","),
      // Exercise the legacy single-rate fallback independently of the approved defaults.
      STORE_SHIPPING_CENTS: "750",
      STRIPE_AUTOMATIC_TAX: "false",
    },
    () => {
      const configuration = getStoreConfiguration();
      const ids = configuration.products.map((product) => product.id);
      const skus = configuration.products.map((product) => product.sku);
      const decks = configuration.products.filter((product) => product.deckId);

      assert.deepEqual(ids, storeLaunchProductIds);
      assert.equal(new Set(ids).size, 12);
      assert.equal(new Set(skus).size, 12);
      assert.equal(decks.length, 7);
      assert.ok(configuration.products.every((product) => product.madeToOrder));
      assert.equal(
        configuration.products.find((product) => product.id === "blue-water")
          ?.buildDispatchMaxBusinessDays,
        5
      );
      assert.ok(
        configuration.products.every(
          (product) => product.buildDispatchMaxBusinessDays === 5
        )
      );
      assert.ok(
        decks.every(
          (product) =>
            product.cardsIncluded === 60 && product.deckId === product.id
        )
      );
      assert.ok(configuration.products.every((product) => product.available));
      assert.equal(configuration.checkoutEnabled, false);
      assert.equal(configuration.automaticTaxEnabled, false);

      const maximumMixedCartIds = storeLaunchProductIds.slice(
        0,
        STORE_MAX_CART_QUANTITY
      );
      const quote = quoteCart(
        maximumMixedCartIds.map((productId) => ({
          productId,
          quantity: 1,
        })),
        configuration.products,
        { fulfillmentOption: configuration.shippingOptions[0] }
      );

      assert.equal(quote.items.length, STORE_MAX_CART_QUANTITY);
      assert.equal(quote.totalQuantity, STORE_MAX_CART_QUANTITY);
      assert.equal(quote.subtotalCents, 19_800);
      assert.equal(quote.shippingWeightOunces, 72);
      assert.equal(quote.shippingRateTierId, "large");
      assert.equal(quote.shippingCents, 2000);
      assert.equal(quote.totalCents, 21_800);

      assert.throws(
        () =>
          quoteCart(
            storeLaunchProductIds.map((productId) => ({
              productId,
              quantity: 1,
            })),
            configuration.products,
            { fulfillmentOption: configuration.shippingOptions[0] }
          ),
        (error) => error.code === "cart_quantity_limit"
      );
    }
  );
});

test("the catalog exposes structured simulator trials for decks and the starter kit", () => {
  withStoreEnvironment(
    {
      ...infrastructureEnvironment,
      STORE_CHECKOUT_ENABLED: "false",
      STORE_SHOW_FUTURE_PRODUCTS: "true",
      STORE_AVAILABLE_PRODUCT_IDS: storeLaunchProductIds.join(","),
    },
    () => {
      const productsById = new Map(
        getStoreConfiguration().products.map((product) => [product.id, product])
      );
      const starterKit = productsById.get("starter-kit");
      const openOcean = productsById.get("open-ocean-hunt");
      const accessories = productsById.get("accessory-set");

      assert.deepEqual(starterKit.includedDeckIds, [
        "coral-garden",
        "blue-water",
      ]);
      assert.deepEqual(starterKit.trialDecks, [
        {
          id: "coral-garden",
          name: "Coral Garden",
          href: "/simulator?deck=coral-garden",
        },
        {
          id: "blue-water",
          name: "Blue Water Deck",
          href: "/simulator?deck=blue-water",
        },
      ]);
      assert.match(
        starterKit.playerSetupNote,
        /One Starter Kit provides both decks needed for two players/
      );
      assert.match(
        starterKit.simulatorNote,
        /Both physical decks are already included/
      );
      assert.deepEqual(openOcean.includedDeckIds, ["open-ocean-hunt"]);
      assert.deepEqual(openOcean.trialDecks, [
        {
          id: "open-ocean-hunt",
          name: "Open Ocean",
          href: "/simulator?deck=open-ocean-hunt",
        },
      ]);
      assert.deepEqual(accessories.includedDeckIds, []);
      assert.deepEqual(accessories.trialDecks, []);
    }
  );
});

test("checkout rejects unrecognized Stripe key formats", () => {
  withStoreEnvironment(
    {
      ...infrastructureEnvironment,
      STRIPE_SECRET_KEY: "replace-me",
      STORE_AVAILABLE_PRODUCT_IDS: "starter-kit",
    },
    () => {
      const configuration = getStoreConfiguration();

      assert.equal(configuration.paymentMode, null);
      assert.equal(configuration.checkoutEnabled, false);
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
      STORE_SHOW_FUTURE_PRODUCTS: "true",
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
      assert.equal(starterKit.priceCents, 4400);
      assert.equal(starterKit.available, false);
    }
  );
});

test("automatic tax requires a resolved code for every available product", () => {
  const baseEnvironment = {
    ...infrastructureEnvironment,
    STORE_SHOW_FUTURE_PRODUCTS: "true",
    STORE_AVAILABLE_PRODUCT_IDS: "starter-kit,backpack",
    STORE_PRICE_BACKPACK_CENTS: "3500",
    STORE_TAX_REGISTRATION_CONFIRMED: "true",
    STORE_PICKUP_TAX_CONFIRMED: "true",
    STRIPE_AUTOMATIC_TAX: "true",
    STRIPE_GAME_PRODUCT_TAX_CODE: "txcd_10000000",
    STRIPE_SHIPPING_TAX_CODE: "txcd_92010001",
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

test("live checkout requires catalog, tax, and shipping owner gates", () => {
  const liveEnvironment = {
    ...infrastructureEnvironment,
    STRIPE_SECRET_KEY: "rk_live_example",
    STORE_AVAILABLE_PRODUCT_IDS: "coral-garden",
  };

  withStoreEnvironment(liveEnvironment, () => {
    const configuration = getStoreConfiguration();

    assert.equal(configuration.taxRegistrationConfirmed, false);
    assert.equal(configuration.checkoutEnabled, false);
  });

  withStoreEnvironment(
    {
      ...liveEnvironment,
      STORE_TAX_REGISTRATION_CONFIRMED: "true",
    },
    () => {
      assert.equal(getStoreConfiguration().checkoutEnabled, false);
    }
  );

  withStoreEnvironment(
    {
      ...liveEnvironment,
      STORE_TAX_REGISTRATION_CONFIRMED: "true",
      STORE_SHIPPING_RATES_CONFIRMED: "true",
    },
    () => {
      const configuration = getStoreConfiguration();

      assert.equal(configuration.automaticTaxEnabled, false);
      assert.equal(configuration.checkoutEnabled, false);
    }
  );

  withStoreEnvironment(
    {
      ...liveEnvironment,
      STORE_TAX_REGISTRATION_CONFIRMED: "true",
      STORE_CATALOG_CONFIRMED: "true",
      STORE_SHIPPING_RATES_CONFIRMED: "true",
      STORE_PICKUP_TAX_CONFIRMED: "true",
      STORE_SYNCHRONOUS_PAYMENT_METHODS_CONFIRMED: "true",
      STRIPE_AUTOMATIC_TAX: "true",
      STRIPE_GAME_PRODUCT_TAX_CODE: "txcd_99999999",
      STRIPE_SHIPPING_TAX_CODE: "txcd_92010001",
      STORE_DIVE_PACK_ONLY_STANDARD_SHIPPING_CENTS: "499",
    },
    () => {
      const configuration = getStoreConfiguration();

      assert.equal(configuration.shippingConfigurationReady, false);
      assert.equal(configuration.checkoutEnabled, false);
    }
  );

  withStoreEnvironment(
    {
      ...liveEnvironment,
      STORE_TAX_REGISTRATION_CONFIRMED: "true",
      STORE_SHIPPING_RATES_CONFIRMED: "true",
      STORE_PICKUP_TAX_CONFIRMED: "true",
      STRIPE_AUTOMATIC_TAX: "true",
      STRIPE_GAME_PRODUCT_TAX_CODE: "txcd_99999999",
      STRIPE_SHIPPING_TAX_CODE: "txcd_92010001",
    },
    () => {
      const configuration = getStoreConfiguration();

      assert.equal(configuration.catalogConfirmed, false);
      assert.equal(configuration.checkoutEnabled, false);
    }
  );

  withStoreEnvironment(
    {
      ...liveEnvironment,
      STORE_TAX_REGISTRATION_CONFIRMED: "true",
      STORE_CATALOG_CONFIRMED: "true",
      STORE_SHIPPING_RATES_CONFIRMED: "true",
      STORE_PICKUP_TAX_CONFIRMED: "true",
      STORE_SYNCHRONOUS_PAYMENT_METHODS_CONFIRMED: "true",
      STRIPE_AUTOMATIC_TAX: "true",
      STRIPE_GAME_PRODUCT_TAX_CODE: "txcd_99999999",
      STRIPE_SHIPPING_TAX_CODE: "txcd_92010001",
    },
    () => {
      const configuration = getStoreConfiguration();

      assert.equal(configuration.automaticTaxEnabled, true);
      assert.equal(configuration.checkoutEnabled, true);
    }
  );

  withStoreEnvironment(
    {
      ...liveEnvironment,
      STORE_TAX_REGISTRATION_CONFIRMED: "true",
      STORE_CATALOG_CONFIRMED: "true",
      STORE_SHIPPING_RATES_CONFIRMED: "true",
      STORE_PICKUP_TAX_CONFIRMED: "true",
      STORE_SYNCHRONOUS_PAYMENT_METHODS_CONFIRMED: "true",
      STRIPE_AUTOMATIC_TAX: "true",
      STRIPE_GAME_PRODUCT_TAX_CODE: "txcd_99999999",
      STRIPE_SHIPPING_TAX_CODE: "txcd_92010001",
      STORE_LARGE_PRIORITY_SHIPPING_CENTS: "0",
    },
    () => {
      const configuration = getStoreConfiguration();

      assert.equal(configuration.shippingConfigurationReady, false);
      assert.equal(configuration.checkoutEnabled, false);
    }
  );

  withStoreEnvironment(
    {
      ...liveEnvironment,
      STORE_TAX_REGISTRATION_CONFIRMED: "true",
      STORE_CATALOG_CONFIRMED: "true",
      STORE_SHIPPING_RATES_CONFIRMED: "true",
      STORE_PICKUP_TAX_CONFIRMED: "true",
      STRIPE_AUTOMATIC_TAX: "true",
      STRIPE_GAME_PRODUCT_TAX_CODE: "txcd_99999999",
      STRIPE_SHIPPING_TAX_CODE: "txcd_92010001",
    },
    () => {
      const configuration = getStoreConfiguration();

      assert.equal(configuration.synchronousPaymentMethodsConfirmed, false);
      assert.equal(configuration.checkoutEnabled, false);
    }
  );

  withStoreEnvironment(
    {
      ...infrastructureEnvironment,
      STORE_AVAILABLE_PRODUCT_IDS: "starter-kit",
      STRIPE_AUTOMATIC_TAX: "true",
      STRIPE_GAME_PRODUCT_TAX_CODE: "txcd_10000000",
      STRIPE_SHIPPING_TAX_CODE: "txcd_92010001",
    },
    () => {
      const configuration = getStoreConfiguration();

      assert.equal(configuration.automaticTaxRequested, true);
      assert.equal(configuration.automaticTaxEnabled, false);
      assert.equal(configuration.checkoutEnabled, false);
    }
  );
});

test("checkout fails closed when paid-order merchant alerts are not configured", () => {
  withStoreEnvironment(
    {
      ...infrastructureEnvironment,
      STORE_AVAILABLE_PRODUCT_IDS: "starter-kit",
      STORE_ORDER_NOTIFICATION_ENABLED: "false",
    },
    () => {
      const configuration = getStoreConfiguration();

      assert.equal(configuration.orderNotificationEnabled, false);
      assert.equal(configuration.orderNotificationConfigurationReady, false);
      assert.equal(configuration.checkoutEnabled, false);
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
  assert.equal(quote.items[0].unitAmountCents, 2200);
  assert.equal(quote.items[0].checkoutDescription, products[0].checkoutDescription);
  assert.equal(quote.items[0].taxCode, "txcd_99999999");
  assert.equal(quote.items[0].category, "expansion-decks");
  assert.equal(quote.subtotalCents, 6600);
  assert.equal(quote.shippingWeightOunces, 24);
  assert.equal(quote.shippingRateTierId, "large");
  assert.equal(quote.shippingCents, 2000);
  assert.equal(quote.totalCents, 8600);
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
  assert.equal(quote.items[0].unitAmountCents, 4400);
  assert.match(quote.items[0].checkoutDescription, /two 60-card decks/i);
  assert.equal(quote.items[1].deckId, null);
  assert.equal(quote.items[1].unitAmountCents, 1200);
  assert.equal(quote.totalQuantity, 3);
  assert.equal(quote.subtotalCents, 6800);
});

test("quoteCart snapshots the selected fulfillment option and its server price", () => {
  const priorityQuote = quoteCart(
    [{ productId: "starter-kit", quantity: 1 }],
    products,
    {
      fulfillmentOption: {
        id: "priority",
        displayName: "Priority Shipping & Handling",
        description:
          "USPS Priority Mail after production; estimated 2–3 business days in transit.",
        fulfillmentMethod: "shipping",
        pickupLocation: null,
        amountCents: 1500,
      },
    }
  );

  assert.equal(priorityQuote.fulfillmentOptionId, "priority");
  assert.equal(priorityQuote.fulfillmentMethod, "shipping");
  assert.equal(priorityQuote.shippingWeightOunces, 16);
  assert.equal(priorityQuote.shippingRateTierId, "base");
  assert.equal(priorityQuote.shippingCents, 1500);
  assert.equal(priorityQuote.totalCents, 5900);

  const pickupQuote = quoteCart(
    [{ productId: "starter-kit", quantity: 1 }],
    products,
    {
      fulfillmentOption: {
        id: "pickup-elverson-pa",
        displayName: "Scheduled pickup — Elverson, PA",
        description:
          "Free scheduled pickup. We will email after your order is built to arrange a pickup time.",
        fulfillmentMethod: "pickup",
        pickupLocation: "Elverson, PA",
        amountCents: 0,
      },
    }
  );

  assert.equal(pickupQuote.fulfillmentMethod, "pickup");
  assert.equal(
    pickupQuote.fulfillmentOptionName,
    "Scheduled pickup — Elverson, PA"
  );
  assert.match(pickupQuote.fulfillmentOption.description, /arrange a pickup time/i);
  assert.equal(pickupQuote.pickupLocation, "Elverson, PA");
  assert.equal(pickupQuote.shippingRateTierId, "pickup");
  assert.equal(pickupQuote.shippingCents, 0);
  assert.equal(pickupQuote.totalCents, 4400);

  assert.throws(
    () =>
      quoteCart([{ productId: "starter-kit", quantity: 1 }], products, {
        fulfillmentOption: {
          id: "pickup-elverson-pa",
          displayName: "Scheduled pickup — Elverson, PA",
          fulfillmentMethod: "pickup",
          pickupLocation: "Elverson, PA",
          amountCents: 100,
        },
      }),
    CartValidationError
  );
});

test("quoteCart snapshots an independent fixed per-order production option", () => {
  const standardQuote = quoteCart(
    [{ productId: "starter-kit", quantity: 2 }],
    products,
    { shippingCents: 1000 }
  );
  assert.equal(standardQuote.productionOptionId, "standard-production");
  assert.equal(standardQuote.productionOptionName, "Standard production");
  assert.equal(standardQuote.productionMaxBusinessDays, 5);
  assert.equal(standardQuote.productionCents, 0);
  assert.equal(standardQuote.subtotalCents, 8800);
  assert.equal(standardQuote.shippingRateTierId, "large");
  assert.equal(standardQuote.shippingCents, 2000);
  assert.equal(standardQuote.totalCents, 10_800);

  const expeditedQuote = quoteCart(
    [{ productId: "starter-kit", quantity: 2 }],
    products,
    {
      shippingCents: 1000,
      productionOption: {
        id: "expedited-production",
        displayName: "Expedited production",
        amountCents: 1000,
        maxBusinessDays: 1,
      },
    }
  );
  assert.equal(expeditedQuote.productionOptionId, "expedited-production");
  assert.equal(expeditedQuote.productionMaxBusinessDays, 1);
  assert.equal(expeditedQuote.productionCents, 1000);
  assert.equal(expeditedQuote.subtotalCents, 8800);
  assert.equal(expeditedQuote.shippingCents, 2000);
  assert.equal(expeditedQuote.totalCents, 11_800);

  assert.throws(
    () =>
      quoteCart([{ productId: "starter-kit", quantity: 1 }], products, {
        productionOption: {
          id: "expedited-production",
          displayName: "Expedited production",
          amountCents: 999,
          maxBusinessDays: 1,
        },
      }),
    (error) => error?.code === "invalid_production_option"
  );
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
    () =>
      quoteCart(
        [
          {
            productId: "coral-garden",
            quantity: STORE_MAX_PER_PRODUCT_QUANTITY + 1,
          },
        ],
        products
      ),
    (error) => error.code === "quantity_limit"
  );

  assert.throws(
    () =>
      quoteCart(
        [
          { productId: "coral-garden", quantity: 4 },
          { productId: "starter-kit", quantity: 5 },
        ],
        products,
        { maxPerProduct: 20, maxTotalQuantity: 20 }
      ),
    (error) => error.code === "cart_quantity_limit"
  );
});

test("quoteCart applies the confirmed weight tiers and rejects parcels over eight pounds", () => {
  const baseStandard = quoteCart(
    [{ productId: "coral-garden", quantity: 2 }],
    products
  );
  assert.equal(baseStandard.shippingWeightOunces, 16);
  assert.equal(baseStandard.shippingRateTierId, "base");
  assert.equal(baseStandard.shippingCents, 1000);

  const divePackStandard = quoteCart(
    [{ productId: "oceanic-dive-pack", quantity: 2 }],
    products
  );
  assert.equal(divePackStandard.shippingWeightOunces, 16);
  assert.equal(divePackStandard.shippingRateTierId, "dive-pack-base");
  assert.equal(divePackStandard.shippingCents, 500);

  const divePackPriority = quoteCart(
    [{ productId: "oceanic-dive-pack", quantity: 1 }],
    products,
    { fulfillmentOption: { id: "priority" } }
  );
  assert.equal(divePackPriority.shippingWeightOunces, 8);
  assert.equal(divePackPriority.shippingRateTierId, "dive-pack-base");
  assert.equal(divePackPriority.shippingCents, 1000);

  const mixedBaseCart = quoteCart(
    [
      { productId: "oceanic-dive-pack", quantity: 1 },
      { productId: "coral-garden", quantity: 1 },
    ],
    products
  );
  assert.equal(mixedBaseCart.shippingWeightOunces, 16);
  assert.equal(mixedBaseCart.shippingRateTierId, "base");
  assert.equal(mixedBaseCart.shippingCents, 1000);

  const heavierDivePackCart = quoteCart(
    [{ productId: "oceanic-dive-pack", quantity: 3 }],
    products
  );
  assert.equal(heavierDivePackCart.shippingWeightOunces, 24);
  assert.equal(heavierDivePackCart.shippingRateTierId, "large");
  assert.equal(heavierDivePackCart.shippingCents, 2000);

  const largePriority = quoteCart(
    [
      { productId: "coral-garden", quantity: 1 },
      { productId: "starter-kit", quantity: 1 },
    ],
    products,
    {
      fulfillmentOption: {
        id: "priority",
        fulfillmentMethod: "shipping",
        rateTiers: [
          { id: "base", amountCents: 1500 },
          { id: "large", amountCents: 3500 },
        ],
      },
    }
  );
  assert.equal(largePriority.shippingWeightOunces, 24);
  assert.equal(largePriority.shippingRateTierId, "large");
  assert.equal(largePriority.shippingCents, 3500);

  const maximumParcel = quoteCart(
    [{ productId: "accessory-set", quantity: 8 }],
    products
  );
  assert.equal(maximumParcel.shippingWeightOunces, 128);
  assert.equal(maximumParcel.shippingRateTierId, "large");
  assert.equal(maximumParcel.shippingCents, 2000);

  const overweightProduct = {
    ...products[0],
    id: "overweight",
    name: "Overweight parcel",
    shippingWeightOunces: 129,
  };
  assert.throws(
    () =>
      quoteCart(
        [{ productId: overweightProduct.id, quantity: 1 }],
        [overweightProduct]
      ),
    (error) => error.code === "shipping_weight_limit"
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
  assert.equal(formatMoney(2200, "usd"), "$22.00");
  assert.equal(formatMoney(null, "usd"), "Price pending");
});
