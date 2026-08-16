import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(filename), "../../..");
const jiti = createJiti(filename, {
  fsCache: false,
  alias: { "@": path.join(projectRoot, "src") },
});

const { allCards } = jiti(path.join(projectRoot, "src/data/cards/index.js"));
const { CardKind } = jiti(
  path.join(projectRoot, "src/data/cards/types.js")
);
const {
  encyclopediaCreatureBySlug,
  encyclopediaCreatures,
  encyclopediaSlugByCardId,
} = jiti(path.join(projectRoot, "src/data/encyclopedia/index.js"));
const { getCreatureDeckDiscovery, getCreatureDisplayGrammar } = jiti(
  path.join(projectRoot, "src/data/encyclopedia/deckDiscovery.js")
);
const { storeLaunchProductIds, storeProductDefinitions } = jiti(
  path.join(projectRoot, "src/data/store/products.js")
);
const { prebuiltDecks } = jiti(
  path.join(projectRoot, "src/data/tournaments/prebuiltDecks.js")
);

function copiesByDeck(slug) {
  return Object.fromEntries(
    getCreatureDeckDiscovery(encyclopediaCreatureBySlug[slug]).decks.map(
      ({ deckId, copies }) => [deckId, copies]
    )
  );
}

test("every creature card has exactly one exact encyclopedia owner", () => {
  const creatureCardIds = allCards
    .filter((card) => card.kind === CardKind.CREATURE)
    .map((card) => card.id)
    .sort();
  const profileCardIds = encyclopediaCreatures
    .flatMap((creature) => creature.cardIds)
    .sort();

  assert.equal(new Set(profileCardIds).size, profileCardIds.length);
  assert.deepEqual(profileCardIds, creatureCardIds);
  assert.deepEqual(Object.keys(encyclopediaSlugByCardId).sort(), creatureCardIds);
});

test("every prebuilt deck maps one-to-one to a current store deck product", () => {
  const launchIds = new Set(storeLaunchProductIds);
  const launchDeckProducts = storeProductDefinitions.filter(
    (product) => launchIds.has(product.id) && product.deckId
  );
  const productDeckIds = launchDeckProducts
    .map((product) => product.deckId)
    .sort();
  const prebuiltDeckIds = prebuiltDecks.map((deck) => deck.id).sort();

  assert.equal(new Set(productDeckIds).size, launchDeckProducts.length);
  assert.deepEqual(productDeckIds, prebuiltDeckIds);
});

test("explicit owners resolve overlapping animal names without alias collisions", () => {
  assert.equal(encyclopediaSlugByCardId["fairy-parrotfish"], "fairy-parrotfish");
  assert.equal(
    encyclopediaSlugByCardId["spectacled-parrotfish"],
    "spectacled-parrotfish"
  );
  assert.equal(encyclopediaSlugByCardId["frogfish"], "frogfish");
  assert.equal(encyclopediaSlugByCardId["humpback-anglerfish"], "anglerfish");
  assert.equal(encyclopediaSlugByCardId["great-barracuda"], "great-barracuda");
  assert.equal(encyclopediaSlugByCardId["barracuda-oceanic"], "barracuda");
});

test("creature commerce copy uses natural singular and plural references", async () => {
  assert.deepEqual(
    encyclopediaCreatures
      .filter((creature) => creature.grammaticalNumber === "plural")
      .map((creature) => creature.slug)
      .sort(),
    ["oysters", "spinner-dolphins"]
  );
  assert.deepEqual(
    getCreatureDisplayGrammar(encyclopediaCreatureBySlug.anemone),
    { demonstrative: "this", seaPalReference: "this SeaPal" }
  );
  assert.deepEqual(
    getCreatureDisplayGrammar(encyclopediaCreatureBySlug["crown-of-thorns"]),
    { demonstrative: "this", seaPalReference: "this SeaPal" }
  );
  assert.deepEqual(
    getCreatureDisplayGrammar(encyclopediaCreatureBySlug["spinner-dolphins"]),
    { demonstrative: "these", seaPalReference: "these SeaPals" }
  );

  const pageSource = await readFile(
    path.join(projectRoot, "src/app/encyclopedia/[slug]/page.jsx"),
    "utf8"
  );
  assert.match(pageSource, /Bring \{demonstrative\} \{creature\.name\} home/);
  assert.match(pageSource, /cards"\}\{" "\}\s*featuring \{creature\.name\}/);
  assert.match(pageSource, /Also included in a bundle/);
  assert.match(pageSource, /SeaPals card featuring \$\{creature\.name\}/);
  assert.match(pageSource, /\$\{creature\.name\}: Facts for Kids/);
});

test("deck discovery aggregates exact creature cards across current store decks", () => {
  assert.deepEqual(copiesByDeck("fairy-parrotfish"), {
    "blue-water": 2,
    "murky-water": 1,
  });
  assert.deepEqual(copiesByDeck("spectacled-parrotfish"), {
    disruption: 3,
    "coral-garden": 2,
  });
  assert.deepEqual(copiesByDeck("anglerfish"), { "darkness-shroud": 2 });
  assert.deepEqual(copiesByDeck("frogfish"), {
    "blue-water": 1,
    disruption: 2,
    "coral-garden": 1,
    "stinging-fortress": 2,
  });
  assert.deepEqual(copiesByDeck("great-barracuda"), {
    "murky-water": 2,
    "stinging-fortress": 2,
  });
  assert.deepEqual(copiesByDeck("barracuda"), {});
});

test("multi-stage creatures sum every owned card in a deck", () => {
  const discovery = getCreatureDeckDiscovery(
    encyclopediaCreatureBySlug["herring-ball"]
  );

  assert.equal(discovery.decks.length, 1);
  assert.equal(discovery.decks[0].deckId, "open-ocean-hunt");
  assert.equal(discovery.decks[0].copies, 9);
  assert.deepEqual(discovery.decks[0].matchedCards, [
    { cardId: "herring-ball-base", quantity: 4 },
    { cardId: "herring-ball-stage1", quantity: 3 },
    { cardId: "herring-ball-stage2", quantity: 2 },
  ]);
});

test("discovery returns actionable deck routes and available bundles", () => {
  const discovery = getCreatureDeckDiscovery(
    encyclopediaCreatureBySlug["fairy-parrotfish"]
  );
  const blueWater = discovery.decks.find(
    (deck) => deck.deckId === "blue-water"
  );

  assert.equal(blueWater.simulatorHref, "/simulator?deck=blue-water");
  assert.equal(blueWater.storeHref, "/store?product=blue-water");
  assert.equal(blueWater.deckListHref, "/decks#blue-water");
  assert.deepEqual(discovery.bundles, [
    {
      productId: "starter-kit",
      productName: "Starter Kit",
      matchingDeckIds: ["blue-water"],
      storeHref: "/store?product=starter-kit",
    },
  ]);
});

test("a creature outside current decks gets a stable empty state", () => {
  assert.deepEqual(
    getCreatureDeckDiscovery(encyclopediaCreatureBySlug.barracuda),
    { decks: [], bundles: [] }
  );
});

test("the helper is pure and only considers launch products", () => {
  const discovery = getCreatureDeckDiscovery(
    { cardIds: ["exact-card"] },
    {
      decks: [
        {
          id: "test-deck",
          name: "Test Deck",
          cards: [
            { cardId: "exact-card", quantity: 2 },
            { cardId: "similar-card", quantity: 9 },
          ],
        },
      ],
      products: [
        {
          id: "test-product",
          name: "Test Product",
          deckId: "test-deck",
        },
        {
          id: "hidden-bundle",
          name: "Hidden Bundle",
          includedDeckIds: ["test-deck"],
        },
      ],
      launchProductIds: ["test-product"],
    }
  );

  assert.equal(discovery.decks[0].copies, 2);
  assert.deepEqual(discovery.decks[0].matchedCards, [
    { cardId: "exact-card", quantity: 2 },
  ]);
  assert.deepEqual(discovery.bundles, []);
});
