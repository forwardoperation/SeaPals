import assert from "node:assert/strict";
import test from "node:test";
import { createInitialAdventureSave } from "./adventureProgression.mjs";
import {
  ADVENTURE_PROFILE_COUNT,
  ADVENTURE_PROFILE_IDS,
  ADVENTURE_PROFILE_STORAGE_KEYS,
  ADVENTURE_STORAGE_FORMAT_VERSION,
  LEGACY_ADVENTURE_PROGRESS_KEY,
  createAdventureStorageAdapter,
} from "./adventureStorage.mjs";

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
    this.failReads = new Set();
    this.failWrites = new Set();
    this.failRemovals = new Set();
    this.truncateWrites = new Set();
  }

  getItem(key) {
    if (this.failReads.has(key)) throw new Error(`read blocked for ${key}`);
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (this.failWrites.has(key)) throw new Error(`quota exceeded for ${key}`);
    const text = String(value);
    this.values.set(key, this.truncateWrites.has(key) ? text.slice(0, -1) : text);
  }

  removeItem(key) {
    if (this.failRemovals.has(key)) throw new Error(`remove blocked for ${key}`);
    this.values.delete(key);
  }
}

function createAdapter(
  backend = new MemoryStorage(),
  now = () => "2026-07-17T15:30:00.000Z",
) {
  return {
    backend,
    adapter: createAdventureStorageAdapter({
      backend,
      now,
    }),
  };
}

function saveWith(profileId, changes = {}) {
  const save = createInitialAdventureSave(profileId);
  Object.assign(save, changes);
  return save;
}

function decode(backend, key) {
  return JSON.parse(backend.getItem(key));
}

test("the adapter exposes exactly three fixed local profile slots", () => {
  assert.equal(ADVENTURE_PROFILE_COUNT, 3);
  assert.deepEqual(ADVENTURE_PROFILE_IDS, ["profile-1", "profile-2", "profile-3"]);
  assert.equal(Object.isFrozen(ADVENTURE_PROFILE_IDS), true);
  assert.deepEqual(Object.keys(ADVENTURE_PROFILE_STORAGE_KEYS), ADVENTURE_PROFILE_IDS);

  const { adapter } = createAdapter();
  const list = adapter.listProfileSummaries();
  assert.equal(list.ok, true);
  assert.equal(list.profiles.length, 3);
  assert.deepEqual(list.profiles.map((profile) => profile.status), ["empty", "empty", "empty"]);
  assert.deepEqual(list.profiles.map((profile) => profile.slot), [1, 2, 3]);
  assert.ok(list.profiles.every((profile) => !profile.occupied && !profile.canContinue));

  const invalid = adapter.loadProfile("profile-4");
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error.code, "INVALID_PROFILE_ID");
});

test("manual saves validate, canonicalize, verify, and expose title-screen metadata", () => {
  const { adapter, backend } = createAdapter();
  const save = createInitialAdventureSave("profile-1");
  save.world.townId = "sunpatch-cay";
  save.world.sceneId = "sunpatch-harbor";
  save.player.starterDeckId = "coral-garden";
  save.progression.completedEncounterIds = ["encounter-b", "encounter-a", "encounter-b"];
  save.progression.tideMarkIds = ["tide-mark-sunpatch"];
  save.playtimeSeconds = 145;

  const result = adapter.manualSave("profile-1", save);
  assert.equal(result.ok, true);
  assert.equal(result.operation, "manual-save");
  assert.equal(result.saveKind, "manual");
  assert.equal(result.savedAt, "2026-07-17T15:30:00.000Z");
  assert.equal(result.backupCreated, false);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.summary.canContinue, true);
  assert.equal(result.summary.townId, "sunpatch-cay");
  assert.equal(result.summary.sceneId, "sunpatch-harbor");
  assert.equal(result.summary.starterDeckId, "coral-garden");
  assert.equal(result.summary.tideMarkCount, 1);
  assert.equal(result.summary.completedEncounterCount, 2);

  const keys = ADVENTURE_PROFILE_STORAGE_KEYS["profile-1"];
  const stored = decode(backend, keys.primary);
  assert.equal(stored.storageVersion, ADVENTURE_STORAGE_FORMAT_VERSION);
  assert.equal(stored.save.schemaVersion, 1);
  assert.deepEqual(stored.save.progression.completedEncounterIds, ["encounter-b", "encounter-a"]);
  assert.equal(backend.getItem(keys.backup), null);
  assert.equal(backend.getItem(keys.staging), null);

  const loaded = adapter.loadProfile("profile-1");
  assert.equal(loaded.ok, true);
  assert.equal(loaded.status, "ready");
  assert.equal(loaded.source, "primary");
  assert.equal(loaded.recovery, null);
  assert.deepEqual(loaded.save, result.save);
  assert.equal(loaded.summary.playtimeSeconds, 145);
});

test("autosaves record their checkpoint and rotate the prior valid primary into backup", () => {
  const { adapter, backend } = createAdapter();
  const first = saveWith("profile-1", { playtimeSeconds: 10 });
  const second = saveWith("profile-1", { playtimeSeconds: 25 });

  assert.equal(adapter.manualSave("profile-1", first).ok, true);
  const result = adapter.autosave("profile-1", second, "after-docking");
  assert.equal(result.ok, true);
  assert.equal(result.operation, "autosave");
  assert.equal(result.saveKind, "autosave");
  assert.equal(result.checkpointId, "after-docking");
  assert.equal(result.backupCreated, true);

  const keys = ADVENTURE_PROFILE_STORAGE_KEYS["profile-1"];
  assert.equal(decode(backend, keys.primary).save.playtimeSeconds, 25);
  assert.equal(decode(backend, keys.primary).checkpointId, "after-docking");
  assert.equal(decode(backend, keys.backup).save.playtimeSeconds, 10);
  assert.equal(backend.getItem(keys.staging), null);
});

test("invalid and cross-profile saves return structured failures without touching storage", () => {
  const { adapter, backend } = createAdapter();
  const keys = ADVENTURE_PROFILE_STORAGE_KEYS["profile-1"];
  const invalid = createInitialAdventureSave("profile-1");
  invalid.world.position.x = Number.NaN;

  const invalidResult = adapter.manualSave("profile-1", invalid);
  assert.equal(invalidResult.ok, false);
  assert.equal(invalidResult.error.code, "INVALID_SAVE");
  assert.match(invalidResult.error.message, /finite x and y/);
  assert.equal(backend.getItem(keys.primary), null);

  const mismatch = adapter.manualSave("profile-1", createInitialAdventureSave("profile-2"));
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.error.code, "PROFILE_ID_MISMATCH");
  assert.equal(backend.getItem(keys.primary), null);

  const badCheckpoint = adapter.autosave(
    "profile-1",
    createInitialAdventureSave("profile-1"),
    "",
  );
  assert.equal(badCheckpoint.ok, false);
  assert.equal(badCheckpoint.error.code, "INVALID_CHECKPOINT");
});

test("a malformed primary automatically loads the last valid backup with recovery details", () => {
  const { adapter, backend } = createAdapter();
  adapter.manualSave("profile-1", saveWith("profile-1", { playtimeSeconds: 12 }));
  adapter.autosave("profile-1", saveWith("profile-1", { playtimeSeconds: 30 }), "quest-transition");

  const keys = ADVENTURE_PROFILE_STORAGE_KEYS["profile-1"];
  backend.setItem(keys.primary, "{not-json");

  const loaded = adapter.loadProfile("profile-1");
  assert.equal(loaded.ok, true);
  assert.equal(loaded.status, "recovered");
  assert.equal(loaded.source, "backup");
  assert.equal(loaded.save.playtimeSeconds, 12);
  assert.equal(loaded.recovery.needed, true);
  assert.equal(loaded.recovery.available, true);
  assert.equal(loaded.recovery.action, "save-profile-to-repair-primary");
  assert.equal(loaded.issues[0].source, "primary");
  assert.equal(loaded.issues[0].error.code, "MALFORMED_JSON");
  assert.equal(loaded.summary.canContinue, true);
  assert.equal(loaded.summary.status, "recovered");
});

test("unsupported primary data can recover from backup and never throws", () => {
  const { adapter, backend } = createAdapter();
  adapter.manualSave("profile-2", saveWith("profile-2", { playtimeSeconds: 4 }));
  adapter.manualSave("profile-2", saveWith("profile-2", { playtimeSeconds: 8 }));

  const keys = ADVENTURE_PROFILE_STORAGE_KEYS["profile-2"];
  const future = decode(backend, keys.primary);
  future.storageVersion = 99;
  backend.setItem(keys.primary, JSON.stringify(future));

  let result;
  assert.doesNotThrow(() => {
    result = adapter.loadProfile("profile-2");
  });
  assert.equal(result.ok, true);
  assert.equal(result.source, "backup");
  assert.equal(result.save.playtimeSeconds, 4);
  assert.equal(result.issues[0].error.code, "UNSUPPORTED_STORAGE_VERSION");
});

test("an incomplete current-schema envelope cannot outrank a complete backup", () => {
  const { adapter, backend } = createAdapter();
  adapter.manualSave("profile-1", saveWith("profile-1", { playtimeSeconds: 14 }));
  adapter.autosave(
    "profile-1",
    saveWith("profile-1", { playtimeSeconds: 28 }),
    "quest-progress",
  );

  const keys = ADVENTURE_PROFILE_STORAGE_KEYS["profile-1"];
  const incomplete = decode(backend, keys.primary);
  incomplete.save = { schemaVersion: 1, profileId: "profile-1" };
  backend.setItem(keys.primary, JSON.stringify(incomplete));

  const loaded = adapter.loadProfile("profile-1");
  assert.equal(loaded.ok, true);
  assert.equal(loaded.status, "recovered");
  assert.equal(loaded.source, "backup");
  assert.equal(loaded.save.playtimeSeconds, 14);
  assert.equal(loaded.issues[0].error.code, "INCOMPLETE_SAVE_DATA");
});

test("malformed copies return an actionable unrecoverable result instead of a blank", () => {
  const { adapter, backend } = createAdapter();
  const keys = ADVENTURE_PROFILE_STORAGE_KEYS["profile-3"];
  backend.setItem(keys.primary, "null");
  backend.setItem(keys.backup, JSON.stringify({ schemaVersion: 99, profileId: "profile-3" }));
  backend.setItem(keys.staging, "[]");

  let result;
  assert.doesNotThrow(() => {
    result = adapter.loadProfile("profile-3");
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, "unrecoverable");
  assert.equal(result.save, null);
  assert.equal(result.hasStoredData, true);
  assert.equal(result.error.code, "PROFILE_UNRECOVERABLE");
  assert.equal(result.recovery.needed, true);
  assert.equal(result.recovery.available, false);
  assert.equal(result.recovery.action, "start-new-profile-or-import-backup");
  assert.equal(result.issues.length, 3);
  assert.equal(result.summary.occupied, true);
  assert.equal(result.summary.canContinue, false);
});

test("an interrupted first write leaves a validated staging copy available for recovery", () => {
  const { adapter, backend } = createAdapter();
  const keys = ADVENTURE_PROFILE_STORAGE_KEYS["profile-1"];
  backend.failWrites.add(keys.primary);

  const write = adapter.manualSave(
    "profile-1",
    saveWith("profile-1", { playtimeSeconds: 88 }),
  );
  assert.equal(write.ok, false);
  assert.equal(write.error.code, "STORAGE_WRITE_FAILED");
  assert.equal(write.error.retryable, true);
  assert.equal(write.recovery.available, true);
  assert.equal(backend.getItem(keys.primary), null);
  assert.notEqual(backend.getItem(keys.staging), null);

  const loaded = adapter.loadProfile("profile-1");
  assert.equal(loaded.ok, true);
  assert.equal(loaded.status, "recovered");
  assert.equal(loaded.source, "staging");
  assert.equal(loaded.save.playtimeSeconds, 88);
});

test("recovery chooses a newer staging write over an older backup", () => {
  const backend = new MemoryStorage();
  const timestamps = [
    "2026-07-17T15:00:00.000Z",
    "2026-07-17T16:00:00.000Z",
  ];
  const { adapter } = createAdapter(backend, () => timestamps.shift());
  const keys = ADVENTURE_PROFILE_STORAGE_KEYS["profile-1"];

  assert.equal(
    adapter.manualSave("profile-1", saveWith("profile-1", { playtimeSeconds: 10 })).ok,
    true,
  );
  backend.failWrites.add(keys.primary);
  const interrupted = adapter.autosave(
    "profile-1",
    saveWith("profile-1", { playtimeSeconds: 20 }),
    "reward-granted",
  );
  assert.equal(interrupted.ok, false);
  assert.equal(decode(backend, keys.backup).save.playtimeSeconds, 10);
  assert.equal(decode(backend, keys.staging).save.playtimeSeconds, 20);

  backend.failWrites.delete(keys.primary);
  backend.setItem(keys.primary, "{corrupted-primary");
  const recovered = adapter.loadProfile("profile-1");
  assert.equal(recovered.ok, true);
  assert.equal(recovered.status, "recovered");
  assert.equal(recovered.source, "staging");
  assert.equal(recovered.metadata.savedAt, "2026-07-17T16:00:00.000Z");
  assert.equal(recovered.save.playtimeSeconds, 20);
});

test("a newer verified staging write outranks an older valid primary", () => {
  const backend = new MemoryStorage();
  const timestamps = [
    "2026-07-17T15:00:00.000Z",
    "2026-07-17T16:00:00.000Z",
  ];
  const { adapter } = createAdapter(backend, () => timestamps.shift());
  const keys = ADVENTURE_PROFILE_STORAGE_KEYS["profile-1"];

  assert.equal(
    adapter.manualSave("profile-1", saveWith("profile-1", { playtimeSeconds: 10 })).ok,
    true,
  );
  backend.failWrites.add(keys.primary);
  const interrupted = adapter.autosave(
    "profile-1",
    saveWith("profile-1", { playtimeSeconds: 20 }),
    "scene-transition",
  );
  assert.equal(interrupted.ok, false);
  backend.failWrites.delete(keys.primary);

  const recovered = adapter.loadProfile("profile-1");
  assert.equal(recovered.ok, true);
  assert.equal(recovered.status, "recovered");
  assert.equal(recovered.source, "staging");
  assert.equal(recovered.save.playtimeSeconds, 20);
});

test("write revisions recover interrupted progress even when the device clock moves backward", () => {
  const backend = new MemoryStorage();
  const timestamps = [
    "2026-07-17T16:00:00.000Z",
    "2026-07-17T15:00:00.000Z",
  ];
  const { adapter } = createAdapter(backend, () => timestamps.shift());
  const keys = ADVENTURE_PROFILE_STORAGE_KEYS["profile-1"];

  const first = adapter.manualSave(
    "profile-1",
    saveWith("profile-1", { playtimeSeconds: 10 }),
  );
  assert.equal(first.revision, 1);
  backend.failWrites.add(keys.primary);
  const interrupted = adapter.autosave(
    "profile-1",
    saveWith("profile-1", { playtimeSeconds: 20 }),
    "clock-skewed-write",
  );
  assert.equal(interrupted.ok, false);
  backend.failWrites.delete(keys.primary);

  const recovered = adapter.loadProfile("profile-1");
  assert.equal(recovered.source, "staging");
  assert.equal(recovered.metadata.revision, 2);
  assert.equal(recovered.metadata.savedAt, "2026-07-17T15:00:00.000Z");
  assert.equal(recovered.save.playtimeSeconds, 20);
});

test("a silently truncated staging write cannot replace a valid primary", () => {
  const { adapter, backend } = createAdapter();
  const keys = ADVENTURE_PROFILE_STORAGE_KEYS["profile-1"];
  assert.equal(
    adapter.manualSave("profile-1", saveWith("profile-1", { playtimeSeconds: 7 })).ok,
    true,
  );

  backend.truncateWrites.add(keys.staging);
  const result = adapter.autosave(
    "profile-1",
    saveWith("profile-1", { playtimeSeconds: 77 }),
    "scene-transition",
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "STORAGE_STAGING_VERIFICATION_FAILED");
  assert.equal(result.error.retryable, true);
  assert.equal(decode(backend, keys.primary).save.playtimeSeconds, 7);
});

test("a failed backup rotation never replaces the last valid primary", () => {
  const { adapter, backend } = createAdapter();
  const keys = ADVENTURE_PROFILE_STORAGE_KEYS["profile-1"];
  adapter.manualSave("profile-1", saveWith("profile-1", { playtimeSeconds: 5 }));
  backend.failWrites.add(keys.backup);

  const result = adapter.autosave(
    "profile-1",
    saveWith("profile-1", { playtimeSeconds: 99 }),
    "duel-result",
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "STORAGE_WRITE_FAILED");
  assert.equal(decode(backend, keys.primary).save.playtimeSeconds, 5);
  assert.equal(backend.getItem(keys.staging), null);
});

test("a silently truncated backup never replaces the last valid primary", () => {
  const { adapter, backend } = createAdapter();
  const keys = ADVENTURE_PROFILE_STORAGE_KEYS["profile-1"];
  adapter.manualSave("profile-1", saveWith("profile-1", { playtimeSeconds: 5 }));
  backend.truncateWrites.add(keys.backup);

  const result = adapter.autosave(
    "profile-1",
    saveWith("profile-1", { playtimeSeconds: 99 }),
    "duel-result",
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "STORAGE_BACKUP_VERIFICATION_FAILED");
  assert.equal(decode(backend, keys.primary).save.playtimeSeconds, 5);
  assert.equal(backend.getItem(keys.staging), null);
});

test("backend read failures are structured and keep all three profile summaries visible", () => {
  const { adapter, backend } = createAdapter();
  backend.failReads.add(ADVENTURE_PROFILE_STORAGE_KEYS["profile-2"].primary);

  let list;
  assert.doesNotThrow(() => {
    list = adapter.listProfileSummaries();
  });
  assert.equal(list.ok, false);
  assert.equal(list.profiles.length, 3);
  assert.equal(list.profiles[1].status, "unavailable");
  assert.equal(list.profiles[1].occupied, false);
  assert.equal(list.profiles[1].canContinue, false);
  assert.equal(list.profiles[0].status, "empty");
  assert.equal(list.profiles[2].status, "empty");
});

test("legacy prototype progress migrates into an explicitly selected profile", () => {
  const legacy = JSON.stringify({ defeated: ["marina", "stale", "marina", "dorian"] });
  const { adapter, backend } = createAdapter(new MemoryStorage({
    [LEGACY_ADVENTURE_PROGRESS_KEY]: legacy,
  }));

  const result = adapter.migrateLegacyProfile("profile-2");
  assert.equal(result.ok, true);
  assert.equal(result.migrated, true);
  assert.equal(result.status, "migrated");
  assert.equal(result.save.profileId, "profile-2");
  assert.deepEqual(result.save.progression.completedEncounterIds, [
    "encounter-shellshore-marina",
    "encounter-shellshore-dorian",
  ]);
  assert.equal(result.saveKind, "migration");
  assert.equal(backend.getItem(LEGACY_ADVENTURE_PROGRESS_KEY), null);

  const loaded = adapter.loadProfile("profile-2");
  assert.equal(loaded.ok, true);
  assert.equal(loaded.save.profileId, "profile-2");
  assert.equal(adapter.loadProfile("profile-1").status, "empty");
});

test("malformed legacy progress stays intact and returns a recovery path", () => {
  const raw = "{broken legacy";
  const { adapter, backend } = createAdapter(new MemoryStorage({
    [LEGACY_ADVENTURE_PROGRESS_KEY]: raw,
  }));

  let result;
  assert.doesNotThrow(() => {
    result = adapter.migrateLegacyProfile("profile-1");
  });
  assert.equal(result.ok, false);
  assert.equal(result.migrated, false);
  assert.equal(result.status, "invalid-legacy");
  assert.equal(result.error.code, "MALFORMED_LEGACY_DATA");
  assert.equal(result.recovery.action, "keep-legacy-data-and-start-new-profile");
  assert.equal(backend.getItem(LEGACY_ADVENTURE_PROGRESS_KEY), raw);
  assert.equal(adapter.loadProfile("profile-1").status, "empty");
});

test("legacy import, new-game overwrite, and deletion require explicit confirmation", () => {
  const { adapter, backend } = createAdapter(new MemoryStorage({
    [LEGACY_ADVENTURE_PROGRESS_KEY]: JSON.stringify({ defeated: ["marina"] }),
  }));
  adapter.manualSave("profile-1", saveWith("profile-1", { playtimeSeconds: 40 }));

  const importResult = adapter.migrateLegacyProfile("profile-1");
  assert.equal(importResult.ok, false);
  assert.equal(importResult.error.code, "OVERWRITE_CONFIRMATION_REQUIRED");

  const newGame = adapter.startNewProfile("profile-1");
  assert.equal(newGame.ok, false);
  assert.equal(newGame.error.code, "OVERWRITE_CONFIRMATION_REQUIRED");

  const overwrite = adapter.startNewProfile("profile-1", { overwriteConfirmed: true });
  assert.equal(overwrite.ok, true);
  assert.equal(overwrite.save.playtimeSeconds, 0);

  const refusedDelete = adapter.deleteProfile("profile-1");
  assert.equal(refusedDelete.ok, false);
  assert.equal(refusedDelete.error.code, "DELETE_CONFIRMATION_REQUIRED");
  assert.equal(adapter.loadProfile("profile-1").status, "ready");

  assert.equal(adapter.deleteProfile("profile-1", { confirmed: true }).ok, true);
  assert.equal(adapter.loadProfile("profile-1").status, "empty");
});

test("new profiles can persist the fully initialized game session", () => {
  const { adapter } = createAdapter();
  const session = createInitialAdventureSave("profile-2");
  session.progression.quests["quest-shellshore-first-voyage"] = {
    status: "active",
    flags: {},
  };

  const created = adapter.startNewProfile("profile-2", { saveValue: session });
  assert.equal(created.ok, true);
  assert.equal(
    adapter.loadProfile("profile-2").save.progression.quests["quest-shellshore-first-voyage"].status,
    "active",
  );
});

test("a bare canonical save can be loaded as a recovery import and normalized", () => {
  const backend = new MemoryStorage();
  const keys = ADVENTURE_PROFILE_STORAGE_KEYS["profile-3"];
  const bare = createInitialAdventureSave("profile-3");
  bare.rewardLedger = ["reward-one", "reward-one"];
  backend.setItem(keys.primary, JSON.stringify(bare));
  const { adapter } = createAdapter(backend);

  const result = adapter.loadProfile("profile-3");
  assert.equal(result.ok, true);
  assert.equal(result.status, "recovered");
  assert.equal(result.source, "primary");
  assert.equal(result.metadata.bareSave, true);
  assert.deepEqual(result.save.rewardLedger, ["reward-one"]);
  assert.equal(result.recovery.action, "save-profile-to-repair-primary");
});

test("records written before monotonic revisions remain loadable", () => {
  const { adapter, backend } = createAdapter();
  adapter.manualSave("profile-2", saveWith("profile-2", { playtimeSeconds: 21 }));
  const keys = ADVENTURE_PROFILE_STORAGE_KEYS["profile-2"];
  const olderRecord = decode(backend, keys.primary);
  delete olderRecord.revision;
  backend.setItem(keys.primary, JSON.stringify(olderRecord));

  const loaded = adapter.loadProfile("profile-2");
  assert.equal(loaded.ok, true);
  assert.equal(loaded.status, "ready");
  assert.equal(loaded.metadata.revision, null);
  assert.equal(loaded.save.playtimeSeconds, 21);
});

test("a bare recovery import cannot outrank a timestamped envelope backup", () => {
  const { adapter, backend } = createAdapter();
  adapter.manualSave("profile-3", saveWith("profile-3", { playtimeSeconds: 33 }));
  adapter.autosave(
    "profile-3",
    saveWith("profile-3", { playtimeSeconds: 44 }),
    "later-progress",
  );
  const keys = ADVENTURE_PROFILE_STORAGE_KEYS["profile-3"];
  backend.setItem(keys.primary, JSON.stringify({ schemaVersion: 1, profileId: "profile-3" }));

  const result = adapter.loadProfile("profile-3");
  assert.equal(result.ok, true);
  assert.equal(result.status, "recovered");
  assert.equal(result.source, "backup");
  assert.equal(result.save.playtimeSeconds, 33);
});
