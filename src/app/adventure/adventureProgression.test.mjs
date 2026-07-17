import assert from "node:assert/strict";
import test from "node:test";
import {
  ADVENTURE_SAVE_SCHEMA_VERSION,
  ADVENTURE_START_LOCATION,
  AdventureSaveValidationError,
  QUEST_STATUSES,
  createInitialAdventureSave,
  grantReward,
  legacyEncounterId,
  migrateAdventureSave,
  normalizeAdventureSave,
  normalizeRewardGrant,
  setQuestFlag,
  transitionQuest,
  validateAdventureSave,
  validateRewardGrant,
} from "./adventureProgression.mjs";
import { ADVENTURE_SAVE_V0_FIXTURE } from "./fixtures/adventureSaveV0.mjs";

function jsonRoundTrip(value) {
  return JSON.parse(JSON.stringify(value));
}

test("initial save is canonical schema v1 and contains every launch save domain", () => {
  const save = createInitialAdventureSave("profile-1");

  assert.equal(save.schemaVersion, ADVENTURE_SAVE_SCHEMA_VERSION);
  assert.equal(save.profileId, "profile-1");
  assert.deepEqual(save.world, {
    ...ADVENTURE_START_LOCATION,
    position: { ...ADVENTURE_START_LOCATION.position },
    unlockedRouteIds: [],
  });
  assert.deepEqual(save.player, { starterDeckId: null, activeDeckId: null });
  assert.deepEqual(save.progression.quests, {});
  assert.deepEqual(save.progression.completedEncounterIds, []);
  assert.deepEqual(save.progression.tideMarkIds, []);
  assert.deepEqual(save.inventory, {
    cards: {},
    unopenedPacks: {},
    storyItems: {},
    boatItems: {},
  });
  assert.deepEqual(save.savedDecks, {});
  assert.deepEqual(save.rewardLedger, []);
  assert.deepEqual(jsonRoundTrip(save), save);
  assert.deepEqual(validateAdventureSave(save), { valid: true, errors: [], value: save });
});

test("initial saves do not share mutable arrays or objects", () => {
  const first = createInitialAdventureSave("profile-1");
  const second = createInitialAdventureSave("profile-1");

  first.world.position.x = 99;
  first.rewardLedger.push("reward-test");
  first.inventory.cards["white-grunt"] = 4;

  assert.deepEqual(second.world.position, { x: 7, y: 8 });
  assert.deepEqual(second.rewardLedger, []);
  assert.deepEqual(second.inventory.cards, {});
});

test("normalization fills omitted v1 fields and canonicalizes IDs, arrays, and records", () => {
  const normalized = normalizeAdventureSave({
    schemaVersion: 1,
    profileId: " profile-2 ",
    player: { starterDeckId: " coral-garden " },
    world: {
      unlockedRouteIds: ["route-sunpatch", "route-shellshore", "route-sunpatch"],
    },
    progression: {
      quests: {
        "quest-sunpatch-reef-response": {
          status: "active",
          flags: { "evidence-count": 2, "saw-pale-coral": true },
        },
      },
    },
    inventory: { cards: { "white-grunt": 2, "blue-crab": 1 } },
    savedDecks: {
      "deck-starter": {
        name: "  Reef Team  ",
        cards: { "white-grunt": 2 },
      },
    },
    rewardLedger: ["reward-first", "reward-first", "reward-second"],
    ignoredSameVersionField: "removed",
  });

  assert.equal(normalized.profileId, "profile-2");
  assert.deepEqual(normalized.player, { starterDeckId: "coral-garden", activeDeckId: null });
  assert.deepEqual(normalized.world.unlockedRouteIds, ["route-sunpatch", "route-shellshore"]);
  assert.deepEqual(Object.keys(normalized.inventory.cards), ["blue-crab", "white-grunt"]);
  assert.equal(normalized.savedDecks["deck-starter"].name, "Reef Team");
  assert.deepEqual(normalized.rewardLedger, ["reward-first", "reward-second"]);
  assert.equal("ignoredSameVersionField" in normalized, false);
  assert.equal(validateAdventureSave(normalized).valid, true);
});

test("validation returns a recovery-friendly result for malformed saves", () => {
  const malformed = createInitialAdventureSave("profile-1");
  malformed.world.position.x = Number.NaN;

  const result = validateAdventureSave(malformed);
  assert.equal(result.valid, false);
  assert.equal(result.value, null);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /save\.world\.position must contain finite x and y/);
  assert.doesNotThrow(() => JSON.stringify(result));
});

test("normalization rejects unsupported versions and non-JSON progression values", () => {
  assert.throws(
    () => normalizeAdventureSave({ schemaVersion: 2, profileId: "profile-1" }),
    /migrate older saves first/,
  );

  const nestedFlag = createInitialAdventureSave("profile-1");
  nestedFlag.progression.quests["quest-test"] = {
    status: "active",
    flags: { evidence: { nested: true } },
  };
  assert.throws(() => normalizeAdventureSave(nestedFlag), /must be a JSON scalar/);

  const badQuantity = createInitialAdventureSave("profile-1");
  badQuantity.inventory.cards["white-grunt"] = 0;
  assert.throws(() => normalizeAdventureSave(badQuantity), /positive safe integer/);
});

test("profile and content identifiers are bounded and portable", () => {
  assert.throws(
    () => createInitialAdventureSave("Player One"),
    AdventureSaveValidationError,
  );
  assert.throws(
    () => createInitialAdventureSave("profile//one"),
    /lowercase letters, numbers, and single separators/,
  );
  assert.equal(createInitialAdventureSave("profile-local-3").profileId, "profile-local-3");
});

test("v0 fixture migrates known wins without inventing rewards the prototype never granted", () => {
  const before = jsonRoundTrip(ADVENTURE_SAVE_V0_FIXTURE);
  const migrated = migrateAdventureSave(ADVENTURE_SAVE_V0_FIXTURE);

  assert.equal(migrated.schemaVersion, 1);
  assert.equal(migrated.profileId, "profile-legacy-1");
  assert.equal(migrated.world.sceneId, "coral-home");
  assert.deepEqual(migrated.world.position, { x: 5.25, y: 4.5 });
  assert.equal(migrated.world.facing, "left");
  assert.deepEqual(migrated.progression.completedEncounterIds, [
    "encounter-shellshore-marina",
    "encounter-shellshore-dorian",
  ]);
  assert.deepEqual(migrated.rewardLedger, []);
  assert.deepEqual(jsonRoundTrip(ADVENTURE_SAVE_V0_FIXTURE), before);
  assert.equal(validateAdventureSave(migrated).valid, true);

  const laterReward = grantReward(migrated, {
    grantId: "reward-shellshore-marina-first-win",
    storyItems: { "coral-crest": 1 },
  });
  assert.equal(laterReward.applied, true);
  assert.equal(laterReward.save.inventory.storyItems["coral-crest"], 1);
});

test("unversioned prototype data can receive a caller-selected profile ID", () => {
  const migrated = migrateAdventureSave(
    { defeated: ["marina"] },
    { profileId: "profile-import-1" },
  );

  assert.equal(migrated.profileId, "profile-import-1");
  assert.deepEqual(migrated.progression.completedEncounterIds, [legacyEncounterId("marina")]);
  assert.deepEqual(migrated.rewardLedger, []);
  assert.throws(() => migrateAdventureSave({ defeated: [] }), /profileId must be a string identifier/);
});

test("reward grant validation exposes the canonical contract without applying it", () => {
  const valid = validateRewardGrant({
    grantId: "reward-sunpatch-qualifier",
    packs: { "pack-pool-sunpatch-coral": 1 },
    routeIds: ["route-sunpatch-brackwater", "route-sunpatch-brackwater"],
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.value, normalizeRewardGrant({
    grantId: "reward-sunpatch-qualifier",
    packs: { "pack-pool-sunpatch-coral": 1 },
    routeIds: ["route-sunpatch-brackwater"],
  }));

  const invalid = validateRewardGrant({
    grantId: "reward-bad-pack",
    packs: { "pack-pool-sunpatch-coral": 0 },
  });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.value, null);
  assert.match(invalid.errors[0], /positive safe integer/);
});

test("migration normalizes v1 and refuses unknown future versions", () => {
  const v1 = createInitialAdventureSave("profile-1");
  v1.rewardLedger = ["reward-one", "reward-one"];
  assert.deepEqual(migrateAdventureSave(v1).rewardLedger, ["reward-one"]);
  assert.throws(
    () => migrateAdventureSave({ schemaVersion: 99, profileId: "profile-1" }),
    /newer than supported version 1/,
  );
  assert.throws(
    () => migrateAdventureSave({ schemaVersion: -1, profileId: "profile-1" }),
    /non-negative safe integer/,
  );
});

test("quests follow the explicit forward-only state machine", () => {
  const initial = createInitialAdventureSave("profile-1");
  const active = transitionQuest(initial, "quest-sunpatch-reef-response", "active");
  const ready = transitionQuest(active, "quest-sunpatch-reef-response", "readyToTurnIn");
  const complete = transitionQuest(ready, "quest-sunpatch-reef-response", "complete");

  assert.deepEqual(QUEST_STATUSES, ["notStarted", "active", "readyToTurnIn", "complete"]);
  assert.equal(initial.progression.quests["quest-sunpatch-reef-response"], undefined);
  assert.equal(active.progression.quests["quest-sunpatch-reef-response"].status, "active");
  assert.equal(ready.progression.quests["quest-sunpatch-reef-response"].status, "readyToTurnIn");
  assert.equal(complete.progression.quests["quest-sunpatch-reef-response"].status, "complete");
  assert.deepEqual(transitionQuest(complete, "quest-sunpatch-reef-response", "complete"), complete);
});

test("quest transitions preserve flags and reject skips or regressions", () => {
  const initial = createInitialAdventureSave("profile-1");
  const flagged = setQuestFlag(
    initial,
    "quest-sunpatch-reef-response",
    "pale-coral-observed",
    true,
  );
  const active = transitionQuest(flagged, "quest-sunpatch-reef-response", "active");

  assert.equal(active.progression.quests["quest-sunpatch-reef-response"].flags["pale-coral-observed"], true);
  assert.throws(
    () => transitionQuest(initial, "quest-sunpatch-reef-response", "complete"),
    /cannot transition from notStarted to complete/,
  );
  assert.throws(
    () => transitionQuest(active, "quest-sunpatch-reef-response", "notStarted"),
    /cannot transition from active to notStarted/,
  );
  assert.throws(
    () => transitionQuest(active, "quest-sunpatch-reef-response", "paused"),
    /not a supported quest status/,
  );
});

test("quest flags accept only bounded JSON scalars", () => {
  let save = createInitialAdventureSave("profile-1");
  save = setQuestFlag(save, "quest-test", "boolean", false);
  save = setQuestFlag(save, "quest-test", "number", 3);
  save = setQuestFlag(save, "quest-test", "text", "suspected-disease");
  save = setQuestFlag(save, "quest-test", "empty", null);

  assert.deepEqual(save.progression.quests["quest-test"].flags, {
    boolean: false,
    empty: null,
    number: 3,
    text: "suspected-disease",
  });
  assert.throws(() => setQuestFlag(save, "quest-test", "nested", []), /JSON scalar/);
  assert.throws(() => setQuestFlag(save, "quest-test", "number", Infinity), /JSON scalar/);
});

test("a first-time reward atomically updates every supported progression domain", () => {
  const initial = createInitialAdventureSave("profile-1");
  initial.inventory.cards["white-grunt"] = 1;
  initial.world.unlockedRouteIds.push("route-shellshore");

  const result = grantReward(initial, {
    grantId: "reward-sunpatch-qualification-first-win",
    cards: { "white-grunt": 2, "elkhorn-coral-stage-1": 1 },
    packs: { "pack-sunpatch-coral": 1 },
    storyItems: { "tide-compass": 1 },
    boatItems: { "reef-safe-anchor": 1 },
    tideMarkIds: ["tide-mark-sunpatch"],
    routeIds: ["route-shellshore", "route-brackwater"],
    fieldNoteIds: ["field-note-coral-bleaching"],
  });

  assert.equal(result.applied, true);
  assert.equal(result.save.inventory.cards["white-grunt"], 3);
  assert.equal(result.save.inventory.cards["elkhorn-coral-stage-1"], 1);
  assert.equal(result.save.inventory.unopenedPacks["pack-sunpatch-coral"], 1);
  assert.equal(result.save.inventory.storyItems["tide-compass"], 1);
  assert.equal(result.save.inventory.boatItems["reef-safe-anchor"], 1);
  assert.deepEqual(result.save.progression.tideMarkIds, ["tide-mark-sunpatch"]);
  assert.deepEqual(result.save.world.unlockedRouteIds, ["route-shellshore", "route-brackwater"]);
  assert.deepEqual(result.save.fieldNotes.entryIds, ["field-note-coral-bleaching"]);
  assert.deepEqual(result.save.rewardLedger, ["reward-sunpatch-qualification-first-win"]);
  assert.equal(initial.inventory.cards["white-grunt"], 1);
  assert.deepEqual(initial.rewardLedger, []);
  assert.equal(validateAdventureSave(result.save).valid, true);
});

test("reward ledger makes retries idempotent even when content payload changes", () => {
  const first = grantReward(createInitialAdventureSave("profile-1"), {
    grantId: "reward-sunpatch-marina-first-win",
    packs: { "pack-sunpatch-coral": 1 },
  });
  const retry = grantReward(first.save, {
    grantId: "reward-sunpatch-marina-first-win",
    packs: { "pack-sunpatch-coral": 999 },
    cards: "this stale payload is intentionally not inspected",
  });

  assert.equal(first.applied, true);
  assert.equal(retry.applied, false);
  assert.deepEqual(retry.save, first.save);
  assert.equal(retry.save.inventory.unopenedPacks["pack-sunpatch-coral"], 1);
  assert.deepEqual(retry.save.rewardLedger, ["reward-sunpatch-marina-first-win"]);
});

test("different reward IDs accumulate and duplicate item IDs remain unique", () => {
  const first = grantReward(createInitialAdventureSave("profile-1"), {
    grantId: "reward-one",
    cards: { "white-grunt": 1 },
    tideMarkIds: ["tide-mark-sunpatch"],
  });
  const second = grantReward(first.save, {
    grantId: "reward-two",
    cards: { "white-grunt": 2 },
    tideMarkIds: ["tide-mark-sunpatch"],
  });

  assert.equal(second.save.inventory.cards["white-grunt"], 3);
  assert.deepEqual(second.save.progression.tideMarkIds, ["tide-mark-sunpatch"]);
  assert.deepEqual(second.save.rewardLedger, ["reward-one", "reward-two"]);
});

test("new reward grants reject malformed quantities and overflow", () => {
  const initial = createInitialAdventureSave("profile-1");
  assert.throws(
    () => grantReward(initial, { grantId: "reward-bad", cards: { "white-grunt": 0 } }),
    /positive safe integer/,
  );

  initial.inventory.cards["white-grunt"] = Number.MAX_SAFE_INTEGER;
  assert.throws(
    () => grantReward(initial, { grantId: "reward-overflow", cards: { "white-grunt": 1 } }),
    /would overflow quantity/,
  );
  assert.deepEqual(initial.rewardLedger, []);
});

test("progression results survive a JSON round trip without sets, dates, or functions", () => {
  let save = createInitialAdventureSave("profile-1");
  save = transitionQuest(save, "quest-sunpatch-reef-response", "active");
  save = grantReward(save, {
    grantId: "reward-field-note",
    fieldNoteIds: ["field-note-bleaching-is-stress-response"],
  }).save;

  const restored = migrateAdventureSave(jsonRoundTrip(save));
  assert.deepEqual(restored, save);
  assert.equal(validateAdventureSave(restored).valid, true);
});
