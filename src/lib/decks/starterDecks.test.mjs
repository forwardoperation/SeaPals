import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ADVENTURE_CONTENT } from "../../app/adventure/adventureContent.mjs";
import { getDeckSimulationWarnings } from "./deckSimulationWarnings.mjs";

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

test("revised decks preserve exact printed creature identities and legacy saved-card IDs", () => {
  const dropOff = prebuiltDecks.find((deck) => deck.id === "blue-water");
  assert.equal(dropOff.name, "Drop Off");
  assert.equal(dropOff.cards.find((entry) => entry.cardId === "winter-flounder")?.quantity, 3);
  assert.equal(cardsById["winter-flounder"].onPlay[0].effects[0].attackDice, "D4-1");
  assert.deepEqual(cardsById["winter-flounder"].onPlay[0].effects[0].target.categories, ["invertebrate"]);
  assert.equal(cardsById["spotfin-butterflyfish"].passives[0].effect.amount, 1);
  assert.ok(cardsById["twinspot-butterflyfish"]);
  assert.ok(cardsById.boxfish);
  for (const deck of prebuiltDecks) {
    assert.ok(!deck.cards.some((entry) => ["boxfish", "twinspot-butterflyfish"].includes(entry.cardId)));
  }
});

test("every revised retail deck supports its printed effects in digital matches", () => {
  for (const deck of prebuiltDecks) {
    assert.deepEqual(getDeckSimulationWarnings(deck, cardsById), [], deck.name);
    assert.deepEqual(getDeckSimulationWarnings({ cards: Object.fromEntries(deck.cards.map(({ cardId, quantity }) => [cardId, quantity])) }, cardsById), [], deck.name);
  }
});

const expectedOpenOceanManifest = [
  { cardId: "cast-net", quantity: 2 },
  { cardId: "deep-sea-fishing", quantity: 2 },
  { cardId: "fishing", quantity: 2 },
  { cardId: "remote-search", quantity: 3 },
  { cardId: "spearfishing", quantity: 2 },
  { cardId: "crab-trap", quantity: 2 },
  { cardId: "scientist-jes", quantity: 1 },
  { cardId: "dr-evans", quantity: 1 },
  { cardId: "sardine-ball-base", quantity: 4 },
  { cardId: "sardine-ball-stage1", quantity: 2 },
  { cardId: "herring-ball-base", quantity: 4 },
  { cardId: "sardine-ball-stage2", quantity: 2 },
  { cardId: "remora", quantity: 1 },
  { cardId: "herring-ball-stage2", quantity: 2 },
  { cardId: "herring-ball-stage1", quantity: 3 },
  { cardId: "halfbeak", quantity: 3 },
  { cardId: "bluefin-tuna-juvenile", quantity: 1 },
  { cardId: "ocean-triggerfish", quantity: 1 },
  { cardId: "frigate-tuna", quantity: 1 },
  { cardId: "bonito-tuna", quantity: 2 },
  { cardId: "pompano", quantity: 1 },
  { cardId: "mahi-mahi", quantity: 3 },
  { cardId: "market-squid", quantity: 3 },
  { cardId: "man-o-war", quantity: 2 },
  { cardId: "blue-sea-dragon", quantity: 2 },
  { cardId: "oceanic-manta-ray", quantity: 1 },
  { cardId: "killer-whale-oceanic", quantity: 1 },
  { cardId: "yellowfin-tuna", quantity: 1 },
  { cardId: "open-ocean", quantity: 1 },
  { cardId: "silky-shark", quantity: 1 },
  { cardId: "sailfish", quantity: 1 },
  { cardId: "loggerhead-sea-turtle", quantity: 2 },
];

const expectedDarknessShroudManifest = [
  { cardId: "abyss", quantity: 1 },
  { cardId: "chimera", quantity: 2 },
  { cardId: "giant-squid", quantity: 1 },
  { cardId: "goblin-shark", quantity: 2 },
  { cardId: "cookie-cutter-shark", quantity: 2 },
  { cardId: "giant-red-shrimp", quantity: 2 },
  { cardId: "giant-isopod", quantity: 2 },
  { cardId: "deep-cucumber", quantity: 2 },
  { cardId: "deep-sea-jelly", quantity: 2 },
  { cardId: "fangtooth-fish", quantity: 2 },
  { cardId: "vampire-squid", quantity: 2 },
  { cardId: "humpback-anglerfish", quantity: 2 },
  { cardId: "black-swallower", quantity: 2 },
  { cardId: "bristlemouth", quantity: 2 },
  { cardId: "barrel-eye-fish", quantity: 2 },
  { cardId: "owlfish", quantity: 2 },
  { cardId: "fishing", quantity: 1 },
  { cardId: "dr-evans", quantity: 2 },
  { cardId: "deep-sea-fishing", quantity: 2 },
  { cardId: "remote-search", quantity: 3 },
  { cardId: "coral-gardener", quantity: 2 },
  { cardId: "crab-trap", quantity: 2 },
  { cardId: "bamboo_coral_base", quantity: 4 },
  { cardId: "bamboo_coral_stage1", quantity: 2 },
  { cardId: "bamboo_coral_stage2", quantity: 2 },
  { cardId: "scientist-jes", quantity: 2 },
  { cardId: "deep_mushroom_base", quantity: 4 },
  { cardId: "deep_mushroom_stage1", quantity: 2 },
  { cardId: "deep_mushroom_stage2", quantity: 2 },
];

test("White Grunt matches its printed Creature School data", () => {
  const card = cardsById["white-grunt"];

  assert.ok(card);
  assert.equal(card.name, "White Grunt");
  assert.match(card.image, /^\/images\/cards\/fish\/Reef\/white-grunt\.png\?v=[a-f0-9]{12}$/);
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

for (const deckId of prebuiltDecks.map((deck) => deck.id)) {
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

for (const [deckId, expectedManifest] of [
  ["open-ocean-hunt", expectedOpenOceanManifest],
  ["darkness-shroud", expectedDarknessShroudManifest],
]) test(`${deckId} matches the October 5 Figma print sheets`, () => {
  const deck = prebuiltDecks.find((candidate) => candidate.id === deckId);

  assert.ok(deck);
  const byCardId = (entries) => [...entries].sort((left, right) => left.cardId.localeCompare(right.cardId));
  assert.deepEqual(byCardId(deck.cards), byCardId(expectedManifest));
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
  assert.match(openOcean.image, /^\/images\/cards\/habitats\/open-ocean\.png\?v=[a-f0-9]{12}$/);
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
    "ocean-jake",
  ]) {
    assert.equal(byId[cardId]?.hasImage, true, `${cardId} should show its card art`);
  }

  assert.match(byId.halfbeak.card.actions[0].text, /base Creature School/i);
  assert.match(byId["loggerhead-sea-turtle"].card.onPlay[0].text, /20 HP/i);
  assert.match(byId["open-ocean"].card.maintenance[0].text, /10 HP damage/i);
  assert.equal(byId.halfbeak.card.schoolDensity, 10);
  assert.equal(byId["ocean-jake"].name, "Ocean Jake");
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
