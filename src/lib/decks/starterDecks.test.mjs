import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ADVENTURE_CONTENT } from "../../app/adventure/adventureContent.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(filename), "../../..");
const jiti = createJiti(filename, {
  fsCache: false,
  alias: { "@": path.join(projectRoot, "src") },
});

const { cardsById } = jiti(
  path.join(projectRoot, "src/data/cards/index.js")
);
const { getPlayableDeckById, playableDecks, prebuiltDecks, storyOpponentDecks } = jiti(
  path.join(projectRoot, "src/data/decks/prebuiltDecks.js")
);
const { defaultDeckRules, isBaseFoundation } = jiti(
  path.join(projectRoot, "src/lib/decks/deckRules.js")
);
const { getDeckStats } = jiti(
  path.join(projectRoot, "src/lib/decks/deckStats.js")
);
const { getGalleryData } = jiti(
  path.join(projectRoot, "src/lib/gallery.js")
);
const { validateGameDeck } = jiti(
  path.join(projectRoot, "src/lib/decks/deckValidation.js")
);

const starterDeckIds = ["coral-garden", "murky-water", "blue-water"];

const expectedOpenOceanManifest = [
  { cardId: "cast-net", quantity: 2 },
  { cardId: "deep-sea-fishing", quantity: 2 },
  { cardId: "fishing", quantity: 2 },
  { cardId: "spearfishing", quantity: 1 },
  { cardId: "scientist-jes", quantity: 1 },
  { cardId: "crab-trap", quantity: 1 },
  { cardId: "remote-search", quantity: 3 },
  { cardId: "capt-dani", quantity: 1 },
  { cardId: "ocean-jake", quantity: 1 },
  { cardId: "blue-sea-dragon", quantity: 1 },
  { cardId: "sardine-ball-base", quantity: 4 },
  { cardId: "sardine-ball-stage1", quantity: 2 },
  { cardId: "sardine-ball-stage2", quantity: 1 },
  { cardId: "herring-ball-base", quantity: 4 },
  { cardId: "herring-ball-stage1", quantity: 3 },
  { cardId: "herring-ball-stage2", quantity: 2 },
  { cardId: "halfbeak", quantity: 3 },
  { cardId: "frigate-tuna", quantity: 1 },
  { cardId: "bonito-tuna", quantity: 1 },
  { cardId: "ocean-triggerfish", quantity: 1 },
  { cardId: "bluefin-tuna-juvenile", quantity: 1 },
  { cardId: "man-o-war", quantity: 2 },
  { cardId: "flying-fish", quantity: 1 },
  { cardId: "pompano", quantity: 1 },
  { cardId: "market-squid", quantity: 2 },
  { cardId: "mahi-mahi", quantity: 1 },
  { cardId: "lookdown", quantity: 1 },
  { cardId: "remora", quantity: 2 },
  { cardId: "loggerhead-sea-turtle", quantity: 2 },
  { cardId: "thresher-shark", quantity: 1 },
  { cardId: "sailfish", quantity: 1 },
  { cardId: "silky-shark", quantity: 1 },
  { cardId: "yellowfin-tuna", quantity: 1 },
  { cardId: "killer-whale-oceanic", quantity: 1 },
  { cardId: "shortfin-mako-shark", quantity: 1 },
  { cardId: "bluefin-tuna", quantity: 1 },
  { cardId: "swordfish", quantity: 1 },
  { cardId: "blue-whale", quantity: 1 },
  { cardId: "open-ocean", quantity: 1 },
];

test("White Grunt matches its printed Creature School data", () => {
  const card = cardsById["white-grunt"];

  assert.ok(card);
  assert.equal(card.name, "White Grunt");
  assert.equal(card.image, "/images/cards/fish/Reef/white-grunt.png");
  assert.equal(card.kind, "creature");
  assert.equal(card.category, "fish");
  assert.equal(card.subtype, "baitball");
  assert.equal(card.stage, 0);
  assert.equal(card.cost.rp, 2);
  assert.equal(card.health, 30);
  assert.equal(card.schoolDensity, 30);
  assert.ok(card.tags.includes("creature-school"));
  assert.ok(isBaseFoundation(card));
  assert.ok(
    card.specialRules.some((rule) =>
      /only have three fish school stacks/i.test(rule)
    )
  );
  assert.ok(
    card.specialRules.some((rule) =>
      /attack dice result \* 10/i.test(rule)
    )
  );
  assert.deepEqual(card.passives[0].effect, {
    type: "gainResource",
    resource: "rp",
    amount: 1,
  });
});

for (const deckId of starterDeckIds) {
  test(`${deckId} is a resolved, legal 60-card game deck`, () => {
    const deck = prebuiltDecks.find((candidate) => candidate.id === deckId);

    assert.ok(deck, `Missing starter deck: ${deckId}`);
    assert.equal(
      deck.cards.reduce((total, entry) => total + entry.quantity, 0),
      defaultDeckRules.deckSize
    );
    assert.deepEqual(
      deck.cards.filter((entry) => !cardsById[entry.cardId]),
      []
    );
    assert.ok(
      deck.cards.every(
        (entry) =>
          !Object.hasOwn(entry, "unavailableName") &&
          entry.quantity <= defaultDeckRules.maxCopiesPerCard
      )
    );

    const validation = validateGameDeck({ cards: deck.cards });
    assert.deepEqual(validation, {
      isValid: true,
      errors: [],
      warnings: [],
    });
    assert.ok(
      getDeckStats(deck).totalVictoryPoints >= defaultDeckRules.minVictoryPoints
    );
  });
}

test("Open Ocean matches the revised 60-card physical deck", () => {
  const deck = prebuiltDecks.find(
    (candidate) => candidate.id === "open-ocean-hunt"
  );

  assert.ok(deck);
  assert.deepEqual(deck.cards, expectedOpenOceanManifest);
  assert.equal(
    deck.cards.reduce((total, entry) => total + entry.quantity, 0),
    60
  );
  assert.deepEqual(deck.cards.filter((entry) => !cardsById[entry.cardId]), []);
  assert.deepEqual(validateGameDeck({ cards: deck.cards }), {
    isValid: true,
    errors: [],
    warnings: [],
  });
});

test("revised Oceanic cards and habitats expose their printed metadata", () => {
  assert.equal(cardsById["market-squid"].passives[0], "EcoBoost: +2 RP to your bank cap.");
  assert.match(cardsById["ocean-triggerfish"].passives[0], /\+30 HP/i);
  assert.match(cardsById["silky-shark"].actions[0], /top 5 cards/i);
  assert.match(cardsById["thresher-shark"].onPlay[0], /roll a 4 or higher, add \+2/i);

  const loggerhead = cardsById["loggerhead-sea-turtle"];
  assert.equal(loggerhead.cost.rp, 4);
  assert.equal(loggerhead.victoryPoints, 4);
  assert.equal(loggerhead.defense.dice, "D10");
  assert.deepEqual(
    loggerhead.onPlay[0].effects.map((effect) => effect.type),
    ["attack", "damage"]
  );

  const oceanJake = cardsById["ocean-jake"];
  assert.equal(oceanJake.cost.rp, 0);
  assert.equal(oceanJake.hideFromGallery, true);
  assert.equal(oceanJake.destinationAfterUse, "lost");
  assert.deepEqual(oceanJake.effects, [
    {
      type: "recoverCardFromLostZone",
      amount: 1,
      destination: "hand",
      cannotPlayThisTurn: true,
    },
  ]);

  const openOcean = cardsById["open-ocean"];
  assert.equal(openOcean.health, 40);
  assert.equal(openOcean.image, "/images/cards/habitats/open-ocean.png");
  assert.deepEqual(openOcean.playRequirements[0], {
    type: "ecosystemComposition",
    minimumCreatureSchools: 4,
    minimumOceanicFish: 2,
    minimumOceanicInvertebrates: 2,
    text: "Requires 4 Creature Schools, 2 Oceanic Fish, and 2 Oceanic Invertebrates in your ecosystem.",
  });
  assert.equal(openOcean.maintenance.damage, 10);
});

test("gallery exposes revised card art and complete rule text", async () => {
  const gallery = await getGalleryData();
  const cards = gallery.flatMap((zone) => zone.images);
  const byId = Object.fromEntries(cards.map((entry) => [entry.cardId, entry]));

  for (const cardId of [
    "loggerhead-sea-turtle",
    "coral-reef",
    "open-ocean",
    "abyss",
    "elkhorn-coral-base",
    "elkhorn-coral-stage-1",
    "elkhorn-coral-stage-2",
    "clubfinger-coral-base",
    "clubfinger-coral-stage-1",
    "sea-urchin",
  ]) {
    assert.equal(byId[cardId]?.hasImage, true, `${cardId} should show its card art`);
  }

  assert.match(byId.halfbeak.card.actions[0].text, /base Creature School/i);
  assert.match(byId["loggerhead-sea-turtle"].card.onPlay[0].text, /20 HP/i);
  assert.match(byId["open-ocean"].card.maintenance[0].text, /10 HP damage/i);
  assert.equal(byId.halfbeak.card.schoolDensity, 10);
  assert.equal(byId["ocean-jake"], undefined, "Ocean Jake should stay out of the gallery for now");
});

test("every planned story encounter references a legal playable opponent deck", () => {
  const decksById = new Map(playableDecks.map((deck) => [deck.id, deck]));
  const referencedDeckIds = new Set(
    ADVENTURE_CONTENT.encounters.map((encounter) => encounter.opponentDeckId)
  );

  for (const deckId of referencedDeckIds) {
    const deck = decksById.get(deckId);
    assert.ok(deck, `Missing planned opponent deck: ${deckId}`);
    assert.deepEqual(
      deck.cards.filter((entry) => !cardsById[entry.cardId]),
      [],
      `${deckId} contains unresolved card references`
    );
    assert.deepEqual(
      validateGameDeck({ cards: deck.cards }),
      { isValid: true, errors: [], warnings: [] },
      `${deckId} must satisfy the game-facing deck rules`
    );
  }
});

test("story-only opponent variants stay legal and separate from retail prebuilt decks", () => {
  assert.deepEqual(
    storyOpponentDecks.map(({ id, name, storyOnly }) => ({ id, name, storyOnly })),
    [
      { id: "the-abyss", name: "The Abyss", storyOnly: true },
      { id: "deep-waters", name: "Deep Waters", storyOnly: true },
      { id: "pelagic-zone", name: "Pelagic Zone", storyOnly: true },
    ],
  );

  const retailIds = new Set(prebuiltDecks.map((deck) => deck.id));
  for (const deck of storyOpponentDecks) {
    assert.equal(retailIds.has(deck.id), false, `${deck.id} must remain story-only`);
    assert.equal(getPlayableDeckById(deck.id), deck);
    assert.equal(
      deck.cards.reduce((total, entry) => total + entry.quantity, 0),
      defaultDeckRules.deckSize,
    );
    assert.deepEqual(deck.cards.filter((entry) => !cardsById[entry.cardId]), []);
    assert.deepEqual(
      validateGameDeck({ cards: deck.cards }),
      { isValid: true, errors: [], warnings: [] },
    );
  }
});

test("Kelpwatch assigns its three encounters to the intended legal prebuilt decks", () => {
  const expectedDeckByEncounterId = new Map([
    ["encounter-kelpwatch-resident-diver", "murky-water"],
    ["encounter-kelpwatch-resident-ranger", "coral-garden"],
    ["encounter-kelpwatch-qualifier", "stinging-fortress"],
  ]);
  const decksById = new Map(prebuiltDecks.map((deck) => [deck.id, deck]));

  for (const [encounterId, deckId] of expectedDeckByEncounterId) {
    const encounter = ADVENTURE_CONTENT.encounters.find(({ id }) => id === encounterId);
    assert.equal(encounter?.opponentDeckId, deckId);
    const deck = decksById.get(deckId);
    assert.ok(deck, `Missing Kelpwatch deck ${deckId}`);
    assert.equal(
      deck.cards.reduce((total, entry) => total + entry.quantity, 0),
      defaultDeckRules.deckSize,
    );
    assert.deepEqual(deck.cards.filter((entry) => !cardsById[entry.cardId]), []);
    assert.deepEqual(
      validateGameDeck({ cards: deck.cards }),
      { isValid: true, errors: [], warnings: [] },
    );
  }
});
