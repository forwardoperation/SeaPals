export const SCRIPTED_TUTORIAL_CONDITION_ORDER = Object.freeze([
  "abundant-sunlight",
  "clear-water",
  "algae-bloom",
  // The Round 4 discount is what makes the habitat + predator + Stage 2
  // lesson fit the player's exact nine-RP bank.
  "murky-water",
  // The Creature School remains affordable while this condition demonstrates
  // how coral weaknesses can reduce the next collection.
  "severe-coral-bleaching",
  // White Grunt's 30 School Density exactly meets Whale Shark's discounted
  // 180 - 150 requirement.
  "krill-ball",
  // The final Apex remains affordable despite the smaller RP bank.
  "bleak-overcast",
]);

export const SCRIPTED_TUTORIAL_FOUNDATION_OPENING_ORDER = Object.freeze([
  "mustard-hill-coral-base",
  "brain-coral-base",
  "brain-coral-stage-1",
  "brain-coral-stage-2",
]);

export const SCRIPTED_TUTORIAL_PALS_OPENING_ORDER = Object.freeze([
  "coral-gardener",
  "arrow-crab",
  "nudibranch",
  "coral-reef",
]);

const SCRIPTED_TUTORIAL_TURN_DRAWS = Object.freeze({
  1: Object.freeze({ deckType: "foundation", cardId: "pillar-coral-base" }),
  2: Object.freeze({ deckType: "pals", cardId: "spanish-hogfish" }),
  3: Object.freeze({ deckType: "pals", cardId: "fairy-parrotfish" }),
  4: Object.freeze({ deckType: "pals", cardId: "great-barracuda" }),
  5: Object.freeze({ deckType: "foundation", cardId: "white-grunt" }),
  6: Object.freeze({ deckType: "pals", cardId: "whale-shark" }),
  7: Object.freeze({ deckType: "pals", cardId: "deep-sea-fishing" }),
});

export const SCRIPTED_TUTORIAL_SEARCH_SEQUENCE = Object.freeze([
  "lettuce-coral-base",
  "hammerhead",
]);

export const SCRIPTED_TUTORIAL_PLACEMENT_PLAN = Object.freeze({
  "arrow-crab": Object.freeze({
    foundationCardId: "mustard-hill-coral-base",
    slotClass: "invertebrate",
  }),
  "spanish-hogfish": Object.freeze({
    foundationCardId: "mustard-hill-coral-base",
    slotClass: "fish",
  }),
  nudibranch: Object.freeze({
    foundationCardId: "pillar-coral-base",
    slotClass: "invertebrate",
  }),
  "fairy-parrotfish": Object.freeze({
    foundationCardId: "pillar-coral-base",
    slotClass: "fish",
  }),
  "great-barracuda": Object.freeze({
    foundationCardId: "pillar-coral-base",
    slotClass: "predator",
  }),
  hammerhead: Object.freeze({
    foundationCardId: "brain-coral-stage-2",
    slotClass: "apex",
  }),
});

/**
 * The tutorial guide begins with a legal mid-game practice reef. Pillar Coral
 * supplies the Invertebrate, Fish, and Predator targets; upgraded Clubfinger
 * Coral supplies two more Fish. Both Corals survive Parrotfish's 10 damage so
 * Hammerhead can still demonstrate Ravage in the final lesson.
 */
export const SCRIPTED_TUTORIAL_OPPONENT_TABLEAU = Object.freeze([
  Object.freeze({
    foundationCardId: "pillar-coral-base",
    placements: Object.freeze([
      Object.freeze({ cardId: "sea-urchin", slotClass: "invertebrate" }),
      Object.freeze({ cardId: "picasso-triggerfish", slotClass: "fish" }),
      Object.freeze({ cardId: "reef-shark", slotClass: "predator" }),
    ]),
  }),
  Object.freeze({
    foundationCardId: "clubfinger-coral-stage-1",
    placements: Object.freeze([
      Object.freeze({ cardId: "frogfish", slotClass: "fish" }),
      Object.freeze({ cardId: "porcupine-fish", slotClass: "fish" }),
    ]),
  }),
]);

/**
 * Every card needed for the academy route, in its authored personal-deck
 * order. The first four entries are the opening Pals hand. Later entries are
 * membership pins rather than assumptions about the top of the deck: Support
 * searches shuffle both personal decks, so turn draws use
 * getScriptedTutorialTurnDraw and remove the requested card by id.
 */
export const SCRIPTED_TUTORIAL_PALS_ORDER = Object.freeze([
  ...SCRIPTED_TUTORIAL_PALS_OPENING_ORDER,
  "spanish-hogfish",
  "fairy-parrotfish",
  "great-barracuda",
  "whale-shark",
  "deep-sea-fishing",
  "hammerhead",
]);

export const SCRIPTED_TUTORIAL_FINISH_PLAN = Object.freeze({
  curriculumVersion: 3,
  victoryTarget: 26,
  finishRound: 7,
  opponentTurnMode: "observe",

  setupCardId: "mustard-hill-coral-base",
  economyCardId: "pillar-coral-base",
  coralSearchSupportCardId: "coral-gardener",
  searchedCoralCardId: "lettuce-coral-base",
  reefBuilderCardId: "brain-coral-base",
  reefBuilderStageOneCardId: "brain-coral-stage-1",
  reefBuilderStageTwoCardId: "brain-coral-stage-2",

  bankBoostCardId: "arrow-crab",
  utilityCardId: "nudibranch",
  secondInvertebrateCardId: "nudibranch",
  attackCardId: "spanish-hogfish",
  attackTargetCardId: "sea-urchin",
  reefFishCardId: "fairy-parrotfish",
  habitatCardId: "coral-reef",
  predatorCardId: "great-barracuda",
  creatureSchoolCardId: "white-grunt",
  filterFeederCardId: "whale-shark",
  apexSearchSupportCardId: "deep-sea-fishing",
  apexCardId: "hammerhead",

  placementPlan: SCRIPTED_TUTORIAL_PLACEMENT_PLAN,

  coralRequirement: Object.freeze({ corals: 4, fish: 2, invertebrates: 2 }),
  creatureSchoolDensity: 30,
  filterFeederPrintedDensityRequirement: 180,
  filterFeederDensityDiscount: 150,
  preApexVp: 20,
  apexVp: 6,
});

// Crunch needs an Invertebrate. Great Barracuda has two Bites after Coral
// Reef enters play, and Hammerhead has two mandatory attacks after its coral
// damage, so four separate Fish/Predator targets keep every target prompt
// useful even when each preceding attack succeeds.
export const SCRIPTED_TUTORIAL_OPPONENT_TARGET_CARD_IDS = Object.freeze([
  SCRIPTED_TUTORIAL_FINISH_PLAN.attackTargetCardId,
  "frogfish",
  "picasso-triggerfish",
  "porcupine-fish",
  "reef-shark",
]);

const FOUNDATION_PINS = Object.freeze([
  ...SCRIPTED_TUTORIAL_FOUNDATION_OPENING_ORDER.map((cardId, index) => Object.freeze({ index, cardId })),
  Object.freeze({ index: 4, cardId: "pillar-coral-base" }),
  Object.freeze({ index: 5, cardId: "lettuce-coral-base" }),
  Object.freeze({ index: 6, cardId: "white-grunt" }),
]);

const PROTECTED_HAND_CARD_IDS = new Set([
  ...SCRIPTED_TUTORIAL_FOUNDATION_OPENING_ORDER,
  ...SCRIPTED_TUTORIAL_PALS_OPENING_ORDER,
  ...Object.values(SCRIPTED_TUTORIAL_TURN_DRAWS).map((draw) => draw.cardId),
  ...SCRIPTED_TUTORIAL_SEARCH_SEQUENCE,
]);

function normalizeDeckType(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "foundation" || normalized === "foundationdeck") return "foundation";
  if (normalized === "pals" || normalized === "palsdeck") return "pals";
  return null;
}

/**
 * Returns the one authored normal turn draw for the supplied academy round.
 * Consumers must remove cardId from anywhere in deckType, not assume it is the
 * top card, because the preceding Support lesson may have shuffled the deck.
 */
export function getScriptedTutorialTurnDraw({ round, deckType = null } = {}) {
  const draw = SCRIPTED_TUTORIAL_TURN_DRAWS[Number(round)] ?? null;
  if (!draw) return null;
  const requestedDeckType = deckType == null ? null : normalizeDeckType(deckType);
  if (deckType != null && requestedDeckType !== draw.deckType) return null;
  return draw;
}

// Compatibility for call sites that previously asked for the first authored
// Foundation draw without passing a round.
export function getScriptedTutorialFoundationDrawCardId() {
  return getScriptedTutorialTurnDraw({ round: 1, deckType: "foundation" })?.cardId
    ?? "pillar-coral-base";
}

function normalizeCardIds(value) {
  return Array.isArray(value)
    ? value.map((cardId) => String(cardId ?? "").trim()).filter(Boolean)
    : [];
}

/** Returns the next authored Support-search result still present in a deck. */
export function getScriptedTutorialSearchTargetCardId({
  cardsInPlay = [],
  cardsInHand = [],
  searchCandidates = [],
} = {}) {
  const alreadyOwned = new Set([
    ...normalizeCardIds(cardsInPlay),
    ...normalizeCardIds(cardsInHand),
  ]);
  const candidates = new Set(normalizeCardIds(searchCandidates));
  return SCRIPTED_TUTORIAL_SEARCH_SEQUENCE.find((cardId) => (
    !alreadyOwned.has(cardId) && candidates.has(cardId)
  )) ?? null;
}

/**
 * Retained for Simulator compatibility. The 26-VP curriculum does not spend
 * Arrow Crab's Scavenge: its two-card discard plus 2-RP cost does not fit the
 * exact authored budget without sacrificing one of the seven-round lesson cards.
 */
export function getScriptedTutorialDiscardEntries(
  handEntries,
  { searchTargetCardId = null, amount = 2 } = {},
) {
  if (!Array.isArray(handEntries)) return Object.freeze([]);
  const required = Math.max(0, Number.isSafeInteger(Number(amount)) ? Number(amount) : 2);
  const entries = handEntries.map((entry, index) => Object.freeze({
    cardId: String(entry?.cardId ?? "").trim(),
    index: Number.isSafeInteger(Number(entry?.index)) ? Number(entry.index) : index,
  })).filter((entry) => entry.cardId);
  return Object.freeze(entries.filter((entry) => (
    entry.cardId !== searchTargetCardId && !PROTECTED_HAND_CARD_IDS.has(entry.cardId)
  )).slice(0, required));
}

function requireCardList(value, label) {
  if (!Array.isArray(value) || !value.length) {
    throw new TypeError(`${label} must be a non-empty card-id array.`);
  }
  return value.map((cardId) => String(cardId ?? "").trim()).filter(Boolean);
}

function pinCardsAtIndexes(cardIds, pins, { replaceMissing = true } = {}) {
  const source = requireCardList(cardIds, "cardIds");
  const entries = pins.map((pin) => ({
    index: Number(pin.index),
    cardId: String(pin.cardId ?? "").trim(),
  }));
  const occupiedIndexes = new Set();
  entries.forEach(({ index, cardId }) => {
    if (!Number.isSafeInteger(index) || index < 0 || index >= source.length) {
      throw new RangeError(`Pinned card index ${index} is outside a ${source.length}-card deck.`);
    }
    if (!cardId) throw new TypeError("Pinned card id is required.");
    if (occupiedIndexes.has(index)) throw new RangeError(`Pinned card index ${index} is duplicated.`);
    occupiedIndexes.add(index);
  });

  const pool = [...source];
  const output = new Array(source.length);
  const loanerCardIds = [];
  entries.forEach(({ index, cardId }, entryIndex) => {
    const existingIndex = pool.indexOf(cardId);
    if (existingIndex >= 0) {
      pool.splice(existingIndex, 1);
    } else if (replaceMissing) {
      if (!pool.length) throw new RangeError("The scripted lesson cannot replace another card in this deck.");
      const futureRequiredCounts = entries.slice(entryIndex + 1).reduce((counts, entry) => {
        counts.set(entry.cardId, (counts.get(entry.cardId) ?? 0) + 1);
        return counts;
      }, new Map());
      const availableCounts = pool.reduce((counts, poolCardId) => {
        counts.set(poolCardId, (counts.get(poolCardId) ?? 0) + 1);
        return counts;
      }, new Map());
      const replacementIndex = pool.findLastIndex((poolCardId) => (
        (availableCounts.get(poolCardId) ?? 0) > (futureRequiredCounts.get(poolCardId) ?? 0)
      ));
      if (replacementIndex < 0) {
        throw new RangeError("The scripted lesson cannot preserve its remaining pinned cards.");
      }
      pool.splice(replacementIndex, 1);
      loanerCardIds.push(cardId);
    } else {
      throw new RangeError(`The scripted lesson card ${cardId} is missing from the supplied deck.`);
    }
    output[index] = cardId;
  });

  let poolIndex = 0;
  for (let index = 0; index < output.length; index += 1) {
    if (!output[index]) output[index] = pool[poolIndex++];
  }
  return Object.freeze({
    cards: Object.freeze(output),
    loanerCardIds: Object.freeze(loanerCardIds),
  });
}

/**
 * Builds the academy's seven-round, 26-VP practice curriculum. Missing lesson
 * cards are temporary loaners; the saved starter deck is never mutated.
 */
export function createScriptedTutorialScenario({
  playerDeckId,
  foundationCards,
  palsCards,
  conditionCards,
}) {
  const foundation = pinCardsAtIndexes(foundationCards, FOUNDATION_PINS, { replaceMissing: true });
  const pals = pinCardsAtIndexes(
    palsCards,
    SCRIPTED_TUTORIAL_PALS_ORDER.map((cardId, index) => ({ index, cardId })),
    { replaceMissing: true },
  );
  const conditions = pinCardsAtIndexes(
    conditionCards,
    SCRIPTED_TUTORIAL_CONDITION_ORDER.map((cardId, index) => ({ index, cardId })),
    { replaceMissing: false },
  );

  return Object.freeze({
    playerDeckId: String(playerDeckId ?? ""),
    foundationCards: foundation.cards,
    palsCards: pals.cards,
    conditionCards: conditions.cards,
    foundationDrawCardId: getScriptedTutorialFoundationDrawCardId(playerDeckId),
    turnDraws: SCRIPTED_TUTORIAL_TURN_DRAWS,
    finishPlan: SCRIPTED_TUTORIAL_FINISH_PLAN,
    opponentTurnMode: SCRIPTED_TUTORIAL_FINISH_PLAN.opponentTurnMode,
    opponentStartingReefCardIds: SCRIPTED_TUTORIAL_OPPONENT_TARGET_CARD_IDS,
    opponentStartingTableau: SCRIPTED_TUTORIAL_OPPONENT_TABLEAU,
    loanerCardIds: Object.freeze([...new Set([
      ...foundation.loanerCardIds,
      ...pals.loanerCardIds,
    ])]),
  });
}

export function isScriptedTutorialSearchTarget(cardId) {
  return SCRIPTED_TUTORIAL_SEARCH_SEQUENCE.includes(cardId);
}
