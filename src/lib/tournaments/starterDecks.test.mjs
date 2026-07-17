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
const { prebuiltDecks } = jiti(
  path.join(projectRoot, "src/data/tournaments/prebuiltDecks.js")
);
const { defaultDeckRules, isBaseFoundation } = jiti(
  path.join(projectRoot, "src/lib/tournaments/deckRules.js")
);
const { getDeckStats } = jiti(
  path.join(projectRoot, "src/lib/tournaments/deckStats.js")
);
const { validateDeck, validateGameDeck } = jiti(
  path.join(projectRoot, "src/lib/tournaments/validateDeck.js")
);

const starterDeckIds = ["coral-garden", "murky-water", "blue-water"];

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

test("game deck validation omits tournament submission fields", () => {
  const deck = prebuiltDecks.find((candidate) => candidate.id === "coral-garden");
  const gameDeck = { cards: deck.cards };

  assert.equal(validateGameDeck(gameDeck).isValid, true);

  const tournamentValidation = validateDeck(gameDeck);
  assert.equal(tournamentValidation.isValid, false);
  assert.deepEqual(tournamentValidation.errors, [
    "Deck name is required.",
    "Player name is required.",
  ]);
});

test("every planned story encounter references a legal prebuilt opponent deck", () => {
  const decksById = new Map(prebuiltDecks.map((deck) => [deck.id, deck]));
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
