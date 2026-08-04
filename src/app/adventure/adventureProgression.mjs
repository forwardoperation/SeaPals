import {
  ADVENTURE_OPENING_CONTENT_VERSION,
  ADVENTURE_OPENING_STATUS,
  ADVENTURE_OPENING_STATUSES,
  ELVERSON_PROLOGUE_BEAT_IDS,
} from "./adventureOpeningContract.mjs";
import {
  ELVERSON_TOWN_LAYOUT_VERSION,
  ELVERSON_TOWN_LAYOUT_VERSION_LEGACY,
  ELVERSON_TOWN_SAFE_POSITIONS,
} from "./adventureElversonTownLayout.mjs";

export {
  ADVENTURE_OPENING_CONTENT_VERSION,
  ADVENTURE_OPENING_STATUS,
  ADVENTURE_OPENING_STATUSES,
} from "./adventureOpeningContract.mjs";

export const ADVENTURE_SAVE_SCHEMA_VERSION = 4;

export const QUEST_STATUSES = Object.freeze([
  "notStarted",
  "active",
  "readyToTurnIn",
  "complete",
]);

export const QUEST_TRANSITIONS = Object.freeze({
  notStarted: Object.freeze(["active"]),
  active: Object.freeze(["readyToTurnIn"]),
  readyToTurnIn: Object.freeze(["complete"]),
  complete: Object.freeze([]),
});

export const TOURNAMENT_STATUSES = Object.freeze([
  "locked",
  "available",
  "active",
  "complete",
]);

export const ADVENTURE_START_LOCATION = Object.freeze({
  townId: "shellshore-village",
  sceneId: "town",
  position: ELVERSON_TOWN_SAFE_POSITIONS.shellshoreDock,
  facing: "down",
  lastSafeDockId: "shellshore-dock",
});

const FACING_DIRECTIONS = new Set(["up", "down", "left", "right"]);
const QUEST_STATUS_SET = new Set(QUEST_STATUSES);
const TOURNAMENT_STATUS_SET = new Set(TOURNAMENT_STATUSES);
const ADVENTURE_OPENING_STATUS_SET = new Set(ADVENTURE_OPENING_STATUSES);
const TEXT_SPEEDS = new Set(["slow", "normal", "fast", "instant"]);
const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/;
const MAX_IDENTIFIER_LENGTH = 128;
const MAX_LABEL_LENGTH = 80;

const LEGACY_TRAINER_IDS = Object.freeze(["marina", "dorian"]);

export class AdventureSaveValidationError extends TypeError {
  constructor(message) {
    super(message);
    this.name = "AdventureSaveValidationError";
  }
}

function fail(path, message) {
  throw new AdventureSaveValidationError(`${path} ${message}`);
}

function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireRecord(value, path, fallback) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (!isRecord(value)) fail(path, "must be a plain object.");
  return value;
}

function normalizeIdentifier(value, path, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== "string") fail(path, `must be ${nullable ? "null or " : ""}a string identifier.`);

  const normalized = value.trim();
  if (!normalized) fail(path, "must not be empty.");
  if (normalized.length > MAX_IDENTIFIER_LENGTH) {
    fail(path, `must be at most ${MAX_IDENTIFIER_LENGTH} characters.`);
  }
  if (!IDENTIFIER_PATTERN.test(normalized)) {
    fail(path, "must contain only lowercase letters, numbers, and single separators (., _, :, or -).");
  }
  return normalized;
}

function normalizeLabel(value, path) {
  if (typeof value !== "string") fail(path, "must be a string.");
  const normalized = value.trim();
  if (!normalized) fail(path, "must not be empty.");
  if (normalized.length > MAX_LABEL_LENGTH) fail(path, `must be at most ${MAX_LABEL_LENGTH} characters.`);
  return normalized;
}

function normalizeNullableIdentifier(value, path, fallback = null) {
  const candidate = value === undefined ? fallback : value;
  return normalizeIdentifier(candidate, path, { nullable: true });
}

function normalizeBoolean(value, path, fallback) {
  const candidate = value === undefined ? fallback : value;
  if (typeof candidate !== "boolean") fail(path, "must be a boolean.");
  return candidate;
}

function normalizeNonNegativeInteger(value, path, fallback = 0) {
  const candidate = value === undefined ? fallback : value;
  if (!Number.isSafeInteger(candidate) || candidate < 0) {
    fail(path, "must be a non-negative safe integer.");
  }
  return candidate;
}

function normalizePosition(value, path, fallback) {
  const record = requireRecord(value, path, fallback);
  if (!Number.isFinite(record.x) || !Number.isFinite(record.y)) {
    fail(path, "must contain finite x and y coordinates.");
  }
  return { x: record.x, y: record.y };
}

function normalizeIdentifierList(value, path, fallback = []) {
  const candidate = value === undefined ? fallback : value;
  if (!Array.isArray(candidate)) fail(path, "must be an array of identifiers.");

  const seen = new Set();
  const normalized = [];
  for (let index = 0; index < candidate.length; index += 1) {
    const identifier = normalizeIdentifier(candidate[index], `${path}[${index}]`);
    if (!seen.has(identifier)) {
      seen.add(identifier);
      normalized.push(identifier);
    }
  }
  return normalized;
}

function normalizeQuantityRecord(value, path, fallback = {}) {
  const record = requireRecord(value, path, fallback);
  const entries = [];

  for (const [rawIdentifier, quantity] of Object.entries(record)) {
    const identifier = normalizeIdentifier(rawIdentifier, `${path} key`);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      fail(`${path}.${identifier}`, "must be a positive safe integer.");
    }
    entries.push([identifier, quantity]);
  }

  entries.sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries);
}

function normalizeNonNegativeIntegerRecord(value, path, fallback = {}) {
  const record = requireRecord(value, path, fallback);
  const entries = [];

  for (const [rawIdentifier, rawValue] of Object.entries(record)) {
    const identifier = normalizeIdentifier(rawIdentifier, `${path} key`);
    entries.push([
      identifier,
      normalizeNonNegativeInteger(rawValue, `${path}.${identifier}`),
    ]);
  }

  entries.sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries);
}

function normalizeQuestFlag(value, path) {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length <= 256) return value;
  fail(path, "must be a JSON scalar (null, boolean, finite number, or a string of at most 256 characters).");
}

function normalizeQuestFlags(value, path, fallback = {}) {
  const record = requireRecord(value, path, fallback);
  const entries = Object.entries(record).map(([rawIdentifier, flagValue]) => {
    const identifier = normalizeIdentifier(rawIdentifier, `${path} key`);
    return [identifier, normalizeQuestFlag(flagValue, `${path}.${identifier}`)];
  });
  entries.sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries);
}

function normalizeQuestState(value, path) {
  const record = requireRecord(value, path);
  const status = record.status ?? "notStarted";
  if (!QUEST_STATUS_SET.has(status)) fail(`${path}.status`, "is not a supported quest status.");

  return {
    status,
    flags: normalizeQuestFlags(record.flags, `${path}.flags`),
  };
}

function normalizeQuests(value, path, fallback = {}) {
  const record = requireRecord(value, path, fallback);
  const entries = Object.entries(record).map(([rawIdentifier, questState]) => {
    const identifier = normalizeIdentifier(rawIdentifier, `${path} key`);
    return [identifier, normalizeQuestState(questState, `${path}.${identifier}`)];
  });
  entries.sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries);
}

function normalizeNpcStates(value, path, fallback = {}) {
  const record = requireRecord(value, path, fallback);
  const entries = Object.entries(record).map(([rawNpcId, rawStateId]) => {
    const npcId = normalizeIdentifier(rawNpcId, `${path} key`);
    const stateId = normalizeIdentifier(rawStateId, `${path}.${npcId}`);
    return [npcId, stateId];
  });
  entries.sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries);
}

const DUEL_RESULT_OUTCOMES = new Set(["victory", "defeat"]);
const DUEL_COMPLETION_REASONS = new Set(["vp-target", "deck-depletion", "resolved-effect"]);
const DECK_FINGERPRINT_PATTERN = /^deck-v1-[0-9a-f]{16}$/;

function normalizeEncounterResultSummary(value, path) {
  const summary = requireRecord(value, path);
  const outcome = normalizeIdentifier(summary.outcome, `${path}.outcome`);
  if (!DUEL_RESULT_OUTCOMES.has(outcome)) fail(`${path}.outcome`, "must be victory or defeat.");
  const completionReason = normalizeIdentifier(summary.completionReason, `${path}.completionReason`);
  if (!DUEL_COMPLETION_REASONS.has(completionReason)) {
    fail(`${path}.completionReason`, "is not a supported duel completion reason.");
  }
  const playerDeckFingerprint = String(summary.playerDeckFingerprint ?? "").trim();
  if (!DECK_FINGERPRINT_PATTERN.test(playerDeckFingerprint)) {
    fail(`${path}.playerDeckFingerprint`, "must use the deck-v1-<16 lowercase hex> format.");
  }
  return {
    outcome,
    completionReason,
    playerDeckId: normalizeIdentifier(summary.playerDeckId, `${path}.playerDeckId`),
    playerDeckFingerprint,
    opponentId: normalizeIdentifier(summary.opponentId, `${path}.opponentId`),
    playerVp: normalizeNonNegativeInteger(summary.playerVp, `${path}.playerVp`),
    opponentVp: normalizeNonNegativeInteger(summary.opponentVp, `${path}.opponentVp`),
    targetVp: normalizeNonNegativeInteger(summary.targetVp, `${path}.targetVp`),
    round: normalizeNonNegativeInteger(summary.round, `${path}.round`),
    turn: normalizeNonNegativeInteger(summary.turn, `${path}.turn`),
  };
}

function normalizeEncounterResults(value, path, fallback = {}) {
  const record = requireRecord(value, path, fallback);
  const entries = Object.entries(record).map(([rawEncounterId, rawRecord]) => {
    const encounterId = normalizeIdentifier(rawEncounterId, `${path} key`);
    const resultRecord = requireRecord(rawRecord, `${path}.${encounterId}`);
    const attempts = normalizeNonNegativeInteger(
      resultRecord.attempts,
      `${path}.${encounterId}.attempts`,
    );
    if (attempts < 1) fail(`${path}.${encounterId}.attempts`, "must be at least 1.");
    const latest = normalizeEncounterResultSummary(
      resultRecord.latest,
      `${path}.${encounterId}.latest`,
    );
    const firstVictory = resultRecord.firstVictory == null
      ? null
      : normalizeEncounterResultSummary(
        resultRecord.firstVictory,
        `${path}.${encounterId}.firstVictory`,
      );
    if (firstVictory && firstVictory.outcome !== "victory") {
      fail(`${path}.${encounterId}.firstVictory.outcome`, "must be victory.");
    }
    return [encounterId, { attempts, latest, firstVictory }];
  });
  entries.sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries);
}

function normalizeTournamentDeckSnapshot(value, path, fallback = null) {
  const candidate = value === undefined ? fallback : value;
  if (candidate === null) return null;

  const snapshot = requireRecord(candidate, path);
  if (!Array.isArray(snapshot.cards) || snapshot.cards.length === 0) {
    fail(`${path}.cards`, "must be a non-empty array of card quantities.");
  }

  const seen = new Set();
  const cards = snapshot.cards.map((rawEntry, index) => {
    const entryPath = `${path}.cards[${index}]`;
    const entry = requireRecord(rawEntry, entryPath);
    const cardId = normalizeIdentifier(entry.cardId, `${entryPath}.cardId`);
    if (seen.has(cardId)) fail(`${entryPath}.cardId`, `duplicates card identifier ${cardId}.`);
    seen.add(cardId);
    if (!Number.isSafeInteger(entry.quantity) || entry.quantity <= 0) {
      fail(`${entryPath}.quantity`, "must be a positive safe integer.");
    }
    return { cardId, quantity: entry.quantity };
  });
  cards.sort((left, right) => left.cardId.localeCompare(right.cardId));

  const fingerprint = String(snapshot.fingerprint ?? "").trim();
  if (!DECK_FINGERPRINT_PATTERN.test(fingerprint)) {
    fail(`${path}.fingerprint`, "must use the deck-v1-<16 lowercase hex> format.");
  }

  return {
    id: normalizeIdentifier(snapshot.id, `${path}.id`),
    name: normalizeLabel(snapshot.name, `${path}.name`),
    cards,
    fingerprint,
  };
}

function normalizeSavedDecks(value, path, fallback = {}) {
  const record = requireRecord(value, path, fallback);
  const entries = Object.entries(record).map(([rawDeckId, rawDeck]) => {
    const deckId = normalizeIdentifier(rawDeckId, `${path} key`);
    const deck = requireRecord(rawDeck, `${path}.${deckId}`);
    return [deckId, {
      name: normalizeLabel(deck.name, `${path}.${deckId}.name`),
      cards: normalizeQuantityRecord(deck.cards, `${path}.${deckId}.cards`),
    }];
  });
  entries.sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries);
}

function createInitialState(profileId) {
  return {
    schemaVersion: ADVENTURE_SAVE_SCHEMA_VERSION,
    profileId,
    opening: {
      contentVersion: ADVENTURE_OPENING_CONTENT_VERSION,
      status: ADVENTURE_OPENING_STATUS.NOT_STARTED,
      completedBeatIds: [],
    },
    player: {
      starterDeckId: null,
      activeDeckId: null,
    },
    world: {
      layoutVersion: ELVERSON_TOWN_LAYOUT_VERSION,
      townId: ADVENTURE_START_LOCATION.townId,
      sceneId: ADVENTURE_START_LOCATION.sceneId,
      position: { ...ADVENTURE_START_LOCATION.position },
      facing: ADVENTURE_START_LOCATION.facing,
      lastSafeDockId: ADVENTURE_START_LOCATION.lastSafeDockId,
      unlockedRouteIds: [],
      completedRouteIds: [],
    },
    progression: {
      quests: {},
      npcStates: {},
      completedEncounterIds: [],
      encounterResults: {},
      tideMarkIds: [],
      tournament: {
        status: "locked",
        activeRoundId: null,
        completedRoundIds: [],
        lockedDeckSnapshot: null,
        roundAttemptBaselines: {},
        roundVictoryAttemptCounts: {},
      },
    },
    inventory: {
      cards: {},
      unopenedPacks: {},
      storyItems: {},
      boatItems: {},
    },
    savedDecks: {},
    tutorial: {
      status: "notStarted",
      completedStepIds: [],
    },
    fieldNotes: {
      entryIds: [],
    },
    settings: {
      textSpeed: "normal",
      reducedMotion: false,
      highContrast: false,
      boatAutoSteer: false,
    },
    playtimeSeconds: 0,
    rewardLedger: [],
  };
}

/** Creates a new canonical schema-v4 save without reading time, storage, or random state. */
export function createInitialAdventureSave(profileId) {
  return createInitialState(normalizeIdentifier(profileId, "profileId"));
}

/**
 * Converts a schema-v4 value into its canonical JSON shape. Missing optional
 * fields receive their launch defaults; opening provenance is integrity-
 * required so a damaged current save can never be mistaken for a new game.
 */
export function normalizeAdventureSave(value) {
  const save = requireRecord(value, "save");
  if (save.schemaVersion !== ADVENTURE_SAVE_SCHEMA_VERSION) {
    fail("save.schemaVersion", `must equal ${ADVENTURE_SAVE_SCHEMA_VERSION}; migrate older saves first.`);
  }

  const profileId = normalizeIdentifier(save.profileId, "save.profileId");
  const defaults = createInitialState(profileId);
  const opening = requireRecord(save.opening, "save.opening");
  const player = requireRecord(save.player, "save.player", defaults.player);
  const world = requireRecord(save.world, "save.world", defaults.world);
  const progression = requireRecord(save.progression, "save.progression", defaults.progression);
  const tournament = requireRecord(
    progression.tournament,
    "save.progression.tournament",
    defaults.progression.tournament,
  );
  const inventory = requireRecord(save.inventory, "save.inventory", defaults.inventory);
  const tutorial = requireRecord(save.tutorial, "save.tutorial", defaults.tutorial);
  const fieldNotes = requireRecord(save.fieldNotes, "save.fieldNotes", defaults.fieldNotes);
  const settings = requireRecord(save.settings, "save.settings", defaults.settings);

  if (!Object.prototype.hasOwnProperty.call(opening, "contentVersion")) {
    fail("save.opening.contentVersion", "is required for schema-v4 saves.");
  }
  const openingContentVersion = normalizeNonNegativeInteger(
    opening.contentVersion,
    "save.opening.contentVersion",
  );
  if (openingContentVersion !== ADVENTURE_OPENING_CONTENT_VERSION) {
    fail(
      "save.opening.contentVersion",
      `must equal ${ADVENTURE_OPENING_CONTENT_VERSION}.`,
    );
  }
  if (!ADVENTURE_OPENING_STATUS_SET.has(opening.status)) {
    fail("save.opening.status", "is not a supported opening status.");
  }
  if (!Object.prototype.hasOwnProperty.call(opening, "completedBeatIds")) {
    fail("save.opening.completedBeatIds", "is required for schema-v4 saves.");
  }
  const openingCompletedBeatIds = normalizeIdentifierList(
    opening.completedBeatIds,
    "save.opening.completedBeatIds",
  );
  if (openingCompletedBeatIds.length !== opening.completedBeatIds.length) {
    fail("save.opening.completedBeatIds", "must not contain duplicate beats.");
  }
  if (
    openingCompletedBeatIds.length > ELVERSON_PROLOGUE_BEAT_IDS.length
    || openingCompletedBeatIds.some((beatId, index) => (
      beatId !== ELVERSON_PROLOGUE_BEAT_IDS[index]
    ))
  ) {
    fail(
      "save.opening.completedBeatIds",
      "must be an exact ordered prefix of the supported Elverson opening beats.",
    );
  }
  const openingBeatCount = openingCompletedBeatIds.length;
  const finalOpeningBeatCount = ELVERSON_PROLOGUE_BEAT_IDS.length;
  const openingStatusCoherent = (
    (opening.status === ADVENTURE_OPENING_STATUS.NOT_STARTED && openingBeatCount === 0)
    || (
      opening.status === ADVENTURE_OPENING_STATUS.ACTIVE
      && openingBeatCount < finalOpeningBeatCount
    )
    || (
      opening.status === ADVENTURE_OPENING_STATUS.COMPLETE
      && openingBeatCount === finalOpeningBeatCount
    )
    || (
      opening.status === ADVENTURE_OPENING_STATUS.LEGACY_SKIPPED
      && openingBeatCount === 0
    )
  );
  if (!openingStatusCoherent) {
    fail(
      "save.opening",
      "status and completedBeatIds must describe one coherent opening checkpoint.",
    );
  }

  const facing = world.facing ?? defaults.world.facing;
  if (!FACING_DIRECTIONS.has(facing)) fail("save.world.facing", "must be up, down, left, or right.");
  if (!Object.prototype.hasOwnProperty.call(world, "layoutVersion")) {
    fail("save.world.layoutVersion", "is required for schema-v4 saves.");
  }
  const layoutVersion = normalizeNonNegativeInteger(
    world.layoutVersion,
    "save.world.layoutVersion",
  );
  if (![ELVERSON_TOWN_LAYOUT_VERSION_LEGACY, ELVERSON_TOWN_LAYOUT_VERSION].includes(layoutVersion)) {
    fail(
      "save.world.layoutVersion",
      `must be ${ELVERSON_TOWN_LAYOUT_VERSION_LEGACY} or ${ELVERSON_TOWN_LAYOUT_VERSION}.`,
    );
  }

  const tournamentStatus = tournament.status ?? defaults.progression.tournament.status;
  if (!TOURNAMENT_STATUS_SET.has(tournamentStatus)) {
    fail("save.progression.tournament.status", "is not a supported tournament status.");
  }

  const tutorialStatus = tutorial.status ?? defaults.tutorial.status;
  if (!QUEST_STATUS_SET.has(tutorialStatus)) {
    fail("save.tutorial.status", "is not a supported tutorial status.");
  }

  const textSpeed = settings.textSpeed ?? defaults.settings.textSpeed;
  if (!TEXT_SPEEDS.has(textSpeed)) {
    fail("save.settings.textSpeed", "must be slow, normal, fast, or instant.");
  }

  return {
    schemaVersion: ADVENTURE_SAVE_SCHEMA_VERSION,
    profileId,
    opening: {
      contentVersion: openingContentVersion,
      status: opening.status,
      completedBeatIds: openingCompletedBeatIds,
    },
    player: {
      starterDeckId: normalizeNullableIdentifier(
        player.starterDeckId,
        "save.player.starterDeckId",
        defaults.player.starterDeckId,
      ),
      activeDeckId: normalizeNullableIdentifier(
        player.activeDeckId,
        "save.player.activeDeckId",
        defaults.player.activeDeckId,
      ),
    },
    world: {
      layoutVersion,
      townId: normalizeIdentifier(world.townId ?? defaults.world.townId, "save.world.townId"),
      sceneId: normalizeIdentifier(world.sceneId ?? defaults.world.sceneId, "save.world.sceneId"),
      position: normalizePosition(world.position, "save.world.position", defaults.world.position),
      facing,
      lastSafeDockId: normalizeIdentifier(
        world.lastSafeDockId ?? defaults.world.lastSafeDockId,
        "save.world.lastSafeDockId",
      ),
      unlockedRouteIds: normalizeIdentifierList(
        world.unlockedRouteIds,
        "save.world.unlockedRouteIds",
        defaults.world.unlockedRouteIds,
      ),
      completedRouteIds: normalizeIdentifierList(
        world.completedRouteIds,
        "save.world.completedRouteIds",
        defaults.world.completedRouteIds,
      ),
    },
    progression: {
      quests: normalizeQuests(progression.quests, "save.progression.quests"),
      npcStates: normalizeNpcStates(progression.npcStates, "save.progression.npcStates"),
      completedEncounterIds: normalizeIdentifierList(
        progression.completedEncounterIds,
        "save.progression.completedEncounterIds",
      ),
      encounterResults: normalizeEncounterResults(
        progression.encounterResults,
        "save.progression.encounterResults",
        defaults.progression.encounterResults,
      ),
      tideMarkIds: normalizeIdentifierList(progression.tideMarkIds, "save.progression.tideMarkIds"),
      tournament: {
        status: tournamentStatus,
        activeRoundId: normalizeNullableIdentifier(
          tournament.activeRoundId,
          "save.progression.tournament.activeRoundId",
          defaults.progression.tournament.activeRoundId,
        ),
        completedRoundIds: normalizeIdentifierList(
          tournament.completedRoundIds,
          "save.progression.tournament.completedRoundIds",
        ),
        lockedDeckSnapshot: normalizeTournamentDeckSnapshot(
          tournament.lockedDeckSnapshot,
          "save.progression.tournament.lockedDeckSnapshot",
          defaults.progression.tournament.lockedDeckSnapshot,
        ),
        roundAttemptBaselines: normalizeNonNegativeIntegerRecord(
          tournament.roundAttemptBaselines,
          "save.progression.tournament.roundAttemptBaselines",
          defaults.progression.tournament.roundAttemptBaselines,
        ),
        roundVictoryAttemptCounts: normalizeNonNegativeIntegerRecord(
          tournament.roundVictoryAttemptCounts,
          "save.progression.tournament.roundVictoryAttemptCounts",
          defaults.progression.tournament.roundVictoryAttemptCounts,
        ),
      },
    },
    inventory: {
      cards: normalizeQuantityRecord(inventory.cards, "save.inventory.cards"),
      unopenedPacks: normalizeQuantityRecord(
        inventory.unopenedPacks,
        "save.inventory.unopenedPacks",
      ),
      storyItems: normalizeQuantityRecord(inventory.storyItems, "save.inventory.storyItems"),
      boatItems: normalizeQuantityRecord(inventory.boatItems, "save.inventory.boatItems"),
    },
    savedDecks: normalizeSavedDecks(save.savedDecks, "save.savedDecks"),
    tutorial: {
      status: tutorialStatus,
      completedStepIds: normalizeIdentifierList(
        tutorial.completedStepIds,
        "save.tutorial.completedStepIds",
      ),
    },
    fieldNotes: {
      entryIds: normalizeIdentifierList(fieldNotes.entryIds, "save.fieldNotes.entryIds"),
    },
    settings: {
      textSpeed,
      reducedMotion: normalizeBoolean(
        settings.reducedMotion,
        "save.settings.reducedMotion",
        defaults.settings.reducedMotion,
      ),
      highContrast: normalizeBoolean(
        settings.highContrast,
        "save.settings.highContrast",
        defaults.settings.highContrast,
      ),
      boatAutoSteer: normalizeBoolean(
        settings.boatAutoSteer,
        "save.settings.boatAutoSteer",
        defaults.settings.boatAutoSteer,
      ),
    },
    playtimeSeconds: normalizeNonNegativeInteger(save.playtimeSeconds, "save.playtimeSeconds"),
    rewardLedger: normalizeIdentifierList(save.rewardLedger, "save.rewardLedger"),
  };
}

/** Returns a serializable validation result and, when valid, the canonical value. */
export function validateAdventureSave(value) {
  try {
    return { valid: true, errors: [], value: normalizeAdventureSave(value) };
  } catch (error) {
    if (error instanceof AdventureSaveValidationError) {
      return { valid: false, errors: [error.message], value: null };
    }
    throw error;
  }
}

export function legacyEncounterId(trainerId) {
  return `encounter-shellshore-${normalizeIdentifier(trainerId, "trainerId")}`;
}

function migrateV0(value, options) {
  const profileId = value.profileId ?? options.profileId;
  const migrated = createInitialState(
    normalizeIdentifier(profileId, "profileId"),
  );
  migrated.schemaVersion = 1;
  delete migrated.opening;
  delete migrated.world.layoutVersion;
  delete migrated.world.completedRouteIds;
  delete migrated.progression.encounterResults;
  const legacyLocation = isRecord(value.location) ? value.location : value;

  migrated.world.sceneId = normalizeIdentifier(
    legacyLocation.sceneId ?? migrated.world.sceneId,
    "saveV0.sceneId",
  );
  migrated.world.position = normalizePosition(
    legacyLocation.position,
    "saveV0.position",
    migrated.world.position,
  );
  const facing = legacyLocation.facing ?? migrated.world.facing;
  if (!FACING_DIRECTIONS.has(facing)) fail("saveV0.facing", "must be up, down, left, or right.");
  migrated.world.facing = facing;

  const defeated = value.defeated === undefined ? [] : value.defeated;
  if (!Array.isArray(defeated)) fail("saveV0.defeated", "must be an array of trainer identifiers.");
  // The prototype silently ignored stale or malformed trainer entries. Keep
  // that recovery behavior while still canonicalizing the known IDs.
  const knownDefeated = [...new Set(defeated.filter(
    (trainerId) => typeof trainerId === "string" && LEGACY_TRAINER_IDS.includes(trainerId),
  ))];

  migrated.progression.completedEncounterIds = knownDefeated.map(legacyEncounterId);
  return migrated;
}

function migrateV1(value) {
  // Phase 4 added route-completion and encounter-result provenance. They did
  // not exist in original v1 records, so migration supplies their empty
  // defaults while preserving either field when a later v1 writer included it.
  return {
    ...value,
    schemaVersion: 2,
    ...(isRecord(value.world)
      ? {
          world: {
            ...value.world,
            completedRouteIds: value.world.completedRouteIds ?? [],
          },
        }
      : {}),
    ...(isRecord(value.progression)
      ? {
          progression: {
            ...value.progression,
            encounterResults: value.progression.encounterResults ?? {},
          },
        }
      : {}),
  };
}

function migrateV2(value) {
  return {
    ...value,
    schemaVersion: 3,
    opening: {
      contentVersion: ADVENTURE_OPENING_CONTENT_VERSION,
      status: ADVENTURE_OPENING_STATUS.LEGACY_SKIPPED,
      completedBeatIds: [],
    },
  };
}

function migrateV3(value) {
  return {
    ...value,
    schemaVersion: 4,
    ...(isRecord(value.world)
      ? {
          world: {
            ...value.world,
            layoutVersion: ELVERSON_TOWN_LAYOUT_VERSION_LEGACY,
          },
        }
      : {}),
  };
}

/** Migrates each historical shape one schema at a time or normalizes a v4 save. */
export function migrateAdventureSave(value, options = {}) {
  const save = requireRecord(value, "save");
  const version = save.schemaVersion ?? 0;

  if (version === ADVENTURE_SAVE_SCHEMA_VERSION) return normalizeAdventureSave(save);
  if (!Number.isSafeInteger(version) || version < 0) {
    fail("save.schemaVersion", "must be a non-negative safe integer.");
  }
  if (version > ADVENTURE_SAVE_SCHEMA_VERSION) {
    fail(
      "save.schemaVersion",
      `is newer than supported version ${ADVENTURE_SAVE_SCHEMA_VERSION}.`,
    );
  }

  let migrated = save;
  let migratedVersion = version;
  const migrationOptions = requireRecord(options, "options", {});
  while (migratedVersion < ADVENTURE_SAVE_SCHEMA_VERSION) {
    if (migratedVersion === 0) migrated = migrateV0(migrated, migrationOptions);
    else if (migratedVersion === 1) migrated = migrateV1(migrated);
    else if (migratedVersion === 2) migrated = migrateV2(migrated);
    else if (migratedVersion === 3) migrated = migrateV3(migrated);
    else {
      fail(
        "save.schemaVersion",
        `has no migration path to version ${ADVENTURE_SAVE_SCHEMA_VERSION}.`,
      );
    }
    migratedVersion = migrated.schemaVersion;
  }

  return normalizeAdventureSave(migrated);
}

export function transitionQuest(saveValue, questIdValue, nextStatus) {
  const save = normalizeAdventureSave(saveValue);
  const questId = normalizeIdentifier(questIdValue, "questId");
  if (!QUEST_STATUS_SET.has(nextStatus)) fail("nextStatus", "is not a supported quest status.");

  const current = save.progression.quests[questId] ?? { status: "notStarted", flags: {} };
  if (current.status === nextStatus) return save;
  if (!QUEST_TRANSITIONS[current.status].includes(nextStatus)) {
    throw new RangeError(`Quest ${questId} cannot transition from ${current.status} to ${nextStatus}.`);
  }

  return {
    ...save,
    progression: {
      ...save.progression,
      quests: {
        ...save.progression.quests,
        [questId]: { ...current, status: nextStatus },
      },
    },
  };
}

export function setQuestFlag(saveValue, questIdValue, flagIdValue, flagValue) {
  const save = normalizeAdventureSave(saveValue);
  const questId = normalizeIdentifier(questIdValue, "questId");
  const flagId = normalizeIdentifier(flagIdValue, "flagId");
  const value = normalizeQuestFlag(flagValue, "flagValue");
  const current = save.progression.quests[questId] ?? { status: "notStarted", flags: {} };

  return {
    ...save,
    progression: {
      ...save.progression,
      quests: {
        ...save.progression.quests,
        [questId]: {
          ...current,
          flags: { ...current.flags, [flagId]: value },
        },
      },
    },
  };
}

export function normalizeRewardGrant(value) {
  const grant = requireRecord(value, "grant");
  return {
    grantId: normalizeIdentifier(grant.grantId, "grant.grantId"),
    cards: normalizeQuantityRecord(grant.cards, "grant.cards"),
    packs: normalizeQuantityRecord(grant.packs, "grant.packs"),
    storyItems: normalizeQuantityRecord(grant.storyItems, "grant.storyItems"),
    boatItems: normalizeQuantityRecord(grant.boatItems, "grant.boatItems"),
    tideMarkIds: normalizeIdentifierList(grant.tideMarkIds, "grant.tideMarkIds"),
    routeIds: normalizeIdentifierList(grant.routeIds, "grant.routeIds"),
    fieldNoteIds: normalizeIdentifierList(grant.fieldNoteIds, "grant.fieldNoteIds"),
  };
}

/** Returns the same serializable validation shape used by save validation. */
export function validateRewardGrant(value) {
  try {
    return { valid: true, errors: [], value: normalizeRewardGrant(value) };
  } catch (error) {
    if (error instanceof AdventureSaveValidationError) {
      return { valid: false, errors: [error.message], value: null };
    }
    throw error;
  }
}

function addQuantities(current, additions, path) {
  const result = { ...current };
  for (const [identifier, quantity] of Object.entries(additions)) {
    const nextQuantity = (result[identifier] ?? 0) + quantity;
    if (!Number.isSafeInteger(nextQuantity)) fail(path, `would overflow quantity for ${identifier}.`);
    result[identifier] = nextQuantity;
  }
  return result;
}

function appendUnique(current, additions) {
  const seen = new Set(current);
  const result = [...current];
  for (const identifier of additions) {
    if (!seen.has(identifier)) {
      seen.add(identifier);
      result.push(identifier);
    }
  }
  return result;
}

/**
 * Applies a reward once. If grantId already exists, the ledger wins and the
 * payload is intentionally ignored so content edits cannot replay old grants.
 */
export function grantReward(saveValue, grantValue) {
  const save = normalizeAdventureSave(saveValue);
  const grantRecord = requireRecord(grantValue, "grant");
  const grantId = normalizeIdentifier(grantRecord.grantId, "grant.grantId");

  if (save.rewardLedger.includes(grantId)) return { save, applied: false };

  const grant = normalizeRewardGrant(grantRecord);
  return {
    applied: true,
    save: {
      ...save,
      world: {
        ...save.world,
        unlockedRouteIds: appendUnique(save.world.unlockedRouteIds, grant.routeIds),
      },
      progression: {
        ...save.progression,
        tideMarkIds: appendUnique(save.progression.tideMarkIds, grant.tideMarkIds),
      },
      inventory: {
        cards: addQuantities(save.inventory.cards, grant.cards, "grant.cards"),
        unopenedPacks: addQuantities(save.inventory.unopenedPacks, grant.packs, "grant.packs"),
        storyItems: addQuantities(save.inventory.storyItems, grant.storyItems, "grant.storyItems"),
        boatItems: addQuantities(save.inventory.boatItems, grant.boatItems, "grant.boatItems"),
      },
      fieldNotes: {
        ...save.fieldNotes,
        entryIds: appendUnique(save.fieldNotes.entryIds, grant.fieldNoteIds),
      },
      rewardLedger: [...save.rewardLedger, grant.grantId],
    },
  };
}
