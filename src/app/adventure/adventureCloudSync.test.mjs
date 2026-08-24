import assert from "node:assert/strict";
import test from "node:test";
import {
  ADVENTURE_SAVE_SCHEMA_VERSION,
  createInitialAdventureSave,
} from "./adventureProgression.mjs";
import { ADVENTURE_SAVE_V1_FIXTURE } from "./fixtures/adventureSaveV1.mjs";
import {
  acknowledgeAdventureCloudSyncAction,
  canonicalizeAdventureSave,
  classifyAdventureCloudSyncError,
  coalesceAdventureCloudSyncActions,
  createAdventureCloudLocalState,
  createAdventureCloudRemoteState,
  createAdventureCloudSyncMetadata,
  createAdventureCloudSyncMetadataStore,
  getAdventureCloudSyncMetadataKey,
  getAdventureCloudSyncRetryDelay,
  isAdventureCloudConflictCopyTargetAvailable,
  hashAdventureSave,
  markAdventureCloudLocalDeletion,
  planAdventureCloudConflictResolution,
  planAdventureCloudSync,
  preserveAdventureCloudConcurrentIntent,
  reconcileAdventureCloudProfile,
  recordAdventureCloudSyncFailure,
  shouldCoalesceAdventureCloudSyncActions,
  stableStringifyAdventureCloudValue,
} from "./adventureCloudSync.mjs";

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.failReads = false;
    this.failWrites = false;
    this.failRemovals = false;
  }

  getItem(key) {
    if (this.failReads) throw new Error("read unavailable");
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (this.failWrites) throw new Error("quota exceeded");
    this.values.set(key, String(value));
  }

  removeItem(key) {
    if (this.failRemovals) throw new Error("remove unavailable");
    this.values.delete(key);
  }
}

function saveWith(profileId, playtimeSeconds, name = "Explorer") {
  const save = createInitialAdventureSave(profileId);
  save.playtimeSeconds = playtimeSeconds;
  save.player.name = name;
  return save;
}

function reverseObjectKeys(value) {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).reverse().map(([key, child]) => [key, reverseObjectKeys(child)]),
  );
}

async function cloudRecord(save, cloudVersion, overrides = {}) {
  const profileId = save.profileId;
  return {
    profileId,
    cloudVersion,
    schemaVersion: ADVENTURE_SAVE_SCHEMA_VERSION,
    canonicalHash: await hashAdventureSave(save, { profileId }),
    deleted: false,
    payload: save,
    metadata: { saveKind: "autosave", checkpointId: "dock-arrival" },
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
    ...overrides,
  };
}

function tombstoneRecord(profileId, cloudVersion, overrides = {}) {
  return {
    profileId,
    cloudVersion,
    schemaVersion: ADVENTURE_SAVE_SCHEMA_VERSION,
    canonicalHash: null,
    deleted: true,
    payload: null,
    metadata: { saveKind: "delete", checkpointId: null },
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
    ...overrides,
  };
}

function metadataAt(profileId, state) {
  return createAdventureCloudSyncMetadata(profileId, {
    base: {
      kind: state.kind,
      hash: state.hash,
      schemaVersion: state.schemaVersion,
      cloudVersion: state.cloudVersion,
    },
  });
}

test("canonical JSON recursively sorts keys and rejects non-JSON or cyclic input", () => {
  assert.equal(
    stableStringifyAdventureCloudValue({ z: 1, a: { y: 2, b: [3, { d: 4, c: 5 }] } }),
    '{"a":{"b":[3,{"c":5,"d":4}],"y":2},"z":1}',
  );
  assert.throws(() => stableStringifyAdventureCloudValue({ bad: undefined }), /undefined/);
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => stableStringifyAdventureCloudValue(cyclic), /cyclic/);
});

test("save canonicalization migrates historical saves and hashing ignores input key order", async () => {
  const migrated = canonicalizeAdventureSave(ADVENTURE_SAVE_V1_FIXTURE, { profileId: "profile-1" });
  assert.equal(migrated.schemaVersion, ADVENTURE_SAVE_SCHEMA_VERSION);

  const save = saveWith("profile-1", 42, "Nia");
  const reversed = reverseObjectKeys(save);
  const firstHash = await hashAdventureSave(save, { profileId: "profile-1" });
  const secondHash = await hashAdventureSave(reversed, { profileId: "profile-1" });
  assert.equal(firstHash, secondHash);
  assert.match(firstHash, /^[a-f0-9]{64}$/);
  assert.notEqual(await hashAdventureSave(saveWith("profile-1", 43, "Nia")), firstHash);
  assert.throws(
    () => canonicalizeAdventureSave(save, { profileId: "profile-2" }),
    /belongs to profile-1/,
  );
});

test("prepared active states are detached and remote hashes are verified", async () => {
  const source = saveWith("profile-2", 8);
  const local = await createAdventureCloudLocalState({
    profileId: "profile-2",
    save: source,
    saveKind: "manual",
  });
  source.playtimeSeconds = 900;
  assert.equal(local.save.playtimeSeconds, 8);
  assert.equal(local.saveKind, "manual");

  const record = await cloudRecord(local.save, 3);
  const remote = await createAdventureCloudRemoteState(record, { profileId: "profile-2" });
  assert.equal(remote.kind, "active");
  assert.equal(remote.cloudVersion, 3);
  await assert.rejects(
    createAdventureCloudRemoteState({ ...record, canonicalHash: "0".repeat(64) }, { profileId: "profile-2" }),
    /does not match/,
  );
});

test("remote normalization accepts rollout aliases and models explicit tombstones", async () => {
  const save = saveWith("profile-3", 17);
  const hash = await hashAdventureSave(save);
  const aliased = await createAdventureCloudRemoteState({
    profileId: "profile-3",
    cloudVersion: 2,
    schemaVersion: ADVENTURE_SAVE_SCHEMA_VERSION,
    save,
    saveHash: hash,
    saveKind: "manual",
    checkpointId: "after-duel",
  }, { profileId: "profile-3" });
  assert.equal(aliased.hash, hash);
  assert.equal(aliased.checkpointId, "after-duel");

  const tombstone = await createAdventureCloudRemoteState(
    tombstoneRecord("profile-3", 4),
    { profileId: "profile-3" },
  );
  assert.equal(tombstone.kind, "tombstone");
  assert.equal(tombstone.save, null);
  assert.equal(tombstone.cloudVersion, 4);
});

test("metadata is isolated per account and profile and survives reloads", () => {
  const backend = new MemoryStorage();
  const first = createAdventureCloudSyncMetadataStore({ backend, accountId: "account-a" });
  const second = createAdventureCloudSyncMetadataStore({ backend, accountId: "account-b" });
  const value = createAdventureCloudSyncMetadata("profile-1", {
    base: { kind: "tombstone", hash: null, schemaVersion: null, cloudVersion: 7 },
    pendingTombstone: true,
    retry: {
      operationKey: "profile-1:push:v7:tombstone",
      attemptCount: 2,
      error: { kind: "network", status: null, code: null },
    },
  });
  assert.equal(first.save("profile-1", value).ok, true);
  assert.equal(first.load("profile-1").metadata.pendingTombstone, true);
  assert.equal(first.load("profile-1").metadata.retry.attemptCount, 2);
  assert.equal(second.load("profile-1").status, "empty");
  assert.notEqual(
    getAdventureCloudSyncMetadataKey("account-a", "profile-1"),
    getAdventureCloudSyncMetadataKey("account-b", "profile-1"),
  );
  assert.equal(first.load("profile-2").status, "empty");
});

test("keep-both targets reject protected or pending sync metadata", () => {
  const profileId = "profile-2";
  const baseInput = {
    profileId,
    localStatus: "empty",
    remoteKind: "tombstone",
  };
  assert.equal(isAdventureCloudConflictCopyTargetAvailable(baseInput), true);
  assert.equal(isAdventureCloudConflictCopyTargetAvailable({
    ...baseInput,
    metadata: markAdventureCloudLocalDeletion({ profileId }),
  }), false);
  assert.equal(isAdventureCloudConflictCopyTargetAvailable({
    ...baseInput,
    metadata: {
      profileId,
      conflict: {
        profileId,
        reason: "divergent-edits",
        local: { profileId, kind: "absent", hash: null, schemaVersion: null, cloudVersion: null },
        remote: { profileId, kind: "tombstone", hash: null, schemaVersion: null, cloudVersion: 3 },
      },
    },
  }), false);
  assert.equal(isAdventureCloudConflictCopyTargetAvailable({
    ...baseInput,
    localStatus: "valid",
  }), false);
  assert.equal(isAdventureCloudConflictCopyTargetAvailable({
    ...baseInput,
    remoteKind: "active",
  }), false);
});

test("metadata storage failures and malformed envelopes are structured and non-destructive", () => {
  const backend = new MemoryStorage();
  const store = createAdventureCloudSyncMetadataStore({ backend, accountId: "account-a" });
  backend.setItem(getAdventureCloudSyncMetadataKey("account-a", "profile-1"), "{broken");
  const malformed = store.load("profile-1");
  assert.equal(malformed.ok, false);
  assert.equal(malformed.error.code, "SYNC_METADATA_INVALID");
  assert.equal(backend.getItem(getAdventureCloudSyncMetadataKey("account-a", "profile-1")), "{broken");

  backend.failWrites = true;
  const failedWrite = store.save("profile-2", createAdventureCloudSyncMetadata("profile-2"));
  assert.equal(failedWrite.ok, false);
  assert.equal(failedWrite.error.code, "SYNC_METADATA_WRITE_FAILED");
  assert.equal(failedWrite.error.retryable, true);
});

test("initial reconciliation noops empty slots, pushes local-only saves, and pulls remote-only saves", async () => {
  const profileId = "profile-1";
  const absent = await createAdventureCloudLocalState({ profileId });
  const local = await createAdventureCloudLocalState({
    profileId,
    save: saveWith(profileId, 5),
    saveKind: "manual",
  });
  const remoteAbsent = await createAdventureCloudRemoteState(null, { profileId });
  const remote = await createAdventureCloudRemoteState(
    await cloudRecord(saveWith(profileId, 10), 1),
    { profileId },
  );

  const empty = reconcileAdventureCloudProfile({ profileId, local: absent, remote: remoteAbsent });
  assert.equal(empty.status, "synced");
  assert.equal(empty.action.type, "noop");
  assert.equal(empty.nextMetadata.base.kind, "absent");

  const upload = reconcileAdventureCloudProfile({ profileId, local, remote: remoteAbsent });
  assert.equal(upload.status, "push");
  assert.equal(upload.action.type, "push");
  assert.equal(upload.action.mutation, "save");
  assert.equal(upload.action.expectedCloudVersion, 0);
  assert.deepEqual(upload.action.body, {
    profileId,
    expectedCloudVersion: 0,
    save: local.save,
    metadata: { saveKind: "manual", checkpointId: null },
  });

  const download = reconcileAdventureCloudProfile({ profileId, local: absent, remote });
  assert.equal(download.status, "pull");
  assert.equal(download.action.type, "pull");
  assert.equal(download.action.remoteRecord.payload.playtimeSeconds, 10);
});

test("equal hashes synchronize regardless of server timestamps or local revisions", async () => {
  const profileId = "profile-2";
  const save = saveWith(profileId, 33);
  const local = await createAdventureCloudLocalState({ profileId, save });
  // Deliberately add fields reconciliation must never inspect.
  local.savedAt = "2099-01-01T00:00:00.000Z";
  local.revision = 999;
  const remote = await createAdventureCloudRemoteState(await cloudRecord(save, 11, {
    updatedAt: "2000-01-01T00:00:00.000Z",
  }), { profileId });
  const result = reconcileAdventureCloudProfile({
    profileId,
    local,
    remote,
    metadata: createAdventureCloudSyncMetadata(profileId, {
      base: { kind: "absent", hash: null, schemaVersion: null, cloudVersion: 0 },
    }),
  });
  assert.equal(result.status, "synced");
  assert.equal(result.nextMetadata.base.cloudVersion, 11);
  assert.equal(result.nextMetadata.base.hash, local.hash);
});

test("a clean local copy pulls a changed server record", async () => {
  const profileId = "profile-1";
  const original = saveWith(profileId, 10);
  const changed = saveWith(profileId, 20);
  const local = await createAdventureCloudLocalState({ profileId, save: original });
  const baseRemote = await createAdventureCloudRemoteState(await cloudRecord(original, 2), { profileId });
  const currentRemote = await createAdventureCloudRemoteState(await cloudRecord(changed, 3), { profileId });
  const result = reconcileAdventureCloudProfile({
    profileId,
    local,
    remote: currentRemote,
    metadata: metadataAt(profileId, baseRemote),
  });
  assert.equal(result.status, "pull");
  assert.equal(result.action.type, "pull");
  assert.equal(result.action.remoteRecord.cloudVersion, 3);
  assert.equal(result.action.remoteRecord.payload.playtimeSeconds, 20);
});

test("a dirty local copy pushes only against the observed server version", async () => {
  const profileId = "profile-1";
  const original = saveWith(profileId, 10);
  const changed = saveWith(profileId, 21);
  const local = await createAdventureCloudLocalState({
    profileId,
    save: changed,
    saveKind: "autosave",
    checkpointId: "new-scene",
  });
  const remote = await createAdventureCloudRemoteState(await cloudRecord(original, 6), { profileId });
  const result = reconcileAdventureCloudProfile({
    profileId,
    local,
    remote,
    metadata: metadataAt(profileId, remote),
  });
  assert.equal(result.status, "push");
  assert.equal(result.action.type, "push");
  assert.equal(result.action.expectedCloudVersion, 6);
  assert.equal(result.action.body.expectedCloudVersion, 6);
  assert.equal(result.action.body.save.playtimeSeconds, 21);
  assert.deepEqual(result.action.metadata, { saveKind: "autosave", checkpointId: "new-scene" });
});

test("divergent local and remote changes become a durable explicit conflict", async () => {
  const profileId = "profile-2";
  const original = saveWith(profileId, 1);
  const localSave = saveWith(profileId, 2, "Local");
  const remoteSave = saveWith(profileId, 3, "Remote");
  const originalRemote = await createAdventureCloudRemoteState(await cloudRecord(original, 4), { profileId });
  const local = await createAdventureCloudLocalState({ profileId, save: localSave });
  const remote = await createAdventureCloudRemoteState(await cloudRecord(remoteSave, 5), { profileId });
  const result = reconcileAdventureCloudProfile({
    profileId,
    local,
    remote,
    metadata: metadataAt(profileId, originalRemote),
  });
  assert.equal(result.status, "conflict");
  assert.equal(result.action.type, "conflict");
  assert.equal(result.conflict.reason, "divergent-changes");
  assert.equal(result.conflict.local.save.player.name, "Local");
  assert.equal(result.conflict.remote.save.player.name, "Remote");

  // Even if background state later happens to match, the preserved copies stay
  // available until an explicit choice is made.
  const polled = reconcileAdventureCloudProfile({
    profileId,
    local,
    remote: { ...local, cloudVersion: 6 },
    metadata: result.nextMetadata,
  });
  assert.equal(polled.status, "conflict");
  assert.equal(polled.conflict.remote.save.player.name, "Remote");
});

test("a tracked server tombstone deletes a clean stale local copy instead of resurrecting it", async () => {
  const profileId = "profile-3";
  const save = saveWith(profileId, 70);
  const local = await createAdventureCloudLocalState({ profileId, save });
  const base = await createAdventureCloudRemoteState(await cloudRecord(save, 8), { profileId });
  const deleted = await createAdventureCloudRemoteState(tombstoneRecord(profileId, 9), { profileId });
  const result = reconcileAdventureCloudProfile({
    profileId,
    local,
    remote: deleted,
    metadata: metadataAt(profileId, base),
  });
  assert.equal(result.status, "pull");
  assert.equal(result.action.type, "delete-local");
  assert.equal(result.action.remoteRecord.deleted, true);
  assert.equal(result.action.expectedCloudVersion, 9);
});

test("an untracked local save never overwrites a server tombstone automatically", async () => {
  const profileId = "profile-1";
  const local = await createAdventureCloudLocalState({ profileId, save: saveWith(profileId, 5) });
  const deleted = await createAdventureCloudRemoteState(tombstoneRecord(profileId, 2), { profileId });
  const result = reconcileAdventureCloudProfile({ profileId, local, remote: deleted });
  assert.equal(result.status, "conflict");
  assert.equal(result.conflict.reason, "tombstone-vs-active");
  assert.equal(result.action.type, "conflict");
});

test("plain local absence restores cloud data; only persistent deletion intent emits DELETE", async () => {
  const profileId = "profile-2";
  const remote = await createAdventureCloudRemoteState(
    await cloudRecord(saveWith(profileId, 9), 4),
    { profileId },
  );
  const absent = await createAdventureCloudLocalState({ profileId });
  const tracked = metadataAt(profileId, remote);
  const first = reconcileAdventureCloudProfile({ profileId, local: absent, remote, metadata: tracked });
  assert.equal(first.status, "pull");
  assert.equal(first.action.type, "pull");

  const persisted = markAdventureCloudLocalDeletion(tracked);
  const afterReload = reconcileAdventureCloudProfile({
    profileId,
    local: absent,
    remote,
    metadata: persisted,
  });
  assert.equal(afterReload.action.mutation, "delete");
  assert.equal(afterReload.action.expectedCloudVersion, 4);
  assert.deepEqual(afterReload.action.body, {
    profileId,
    expectedCloudVersion: 4,
    metadata: { saveKind: "delete", checkpointId: null },
  });
  assert.equal(afterReload.nextMetadata.pendingTombstone, true);
});

test("an offline delete creates a version-one tombstone before another device can resurrect it", async () => {
  const profileId = "profile-2";
  const absentRemote = await createAdventureCloudRemoteState(null, { profileId });
  const absentLocal = await createAdventureCloudLocalState({ profileId });
  const deletion = reconcileAdventureCloudProfile({
    profileId,
    local: absentLocal,
    remote: absentRemote,
    metadata: markAdventureCloudLocalDeletion({ profileId }),
  });
  assert.equal(deletion.status, "push");
  assert.equal(deletion.action.mutation, "delete");
  assert.equal(deletion.action.expectedCloudVersion, 0);
  assert.equal(deletion.nextMetadata.pendingTombstone, true);

  const tombstone = await createAdventureCloudRemoteState(
    tombstoneRecord(profileId, 1),
    { profileId },
  );
  const staleOtherDevice = await createAdventureCloudLocalState({
    profileId,
    save: saveWith(profileId, 5, "Offline device"),
  });
  const resurrection = reconcileAdventureCloudProfile({
    profileId,
    local: staleOtherDevice,
    remote: tombstone,
  });
  assert.equal(resurrection.status, "conflict");
  assert.equal(resurrection.action.type, "conflict");
});

test("a tracked row that vanishes without a tombstone fails closed", async () => {
  const profileId = "profile-2";
  const save = saveWith(profileId, 9);
  const base = await createAdventureCloudRemoteState(await cloudRecord(save, 4), { profileId });
  const local = await createAdventureCloudLocalState({ profileId, save });
  const missing = await createAdventureCloudRemoteState(null, { profileId });
  const result = reconcileAdventureCloudProfile({
    profileId,
    local,
    remote: missing,
    metadata: metadataAt(profileId, base),
  });
  assert.equal(result.status, "conflict");
  assert.equal(result.conflict.reason, "missing-remote-record");
  assert.equal(result.action.type, "conflict");
});

test("a deletion queued during an older PUT survives its acknowledgement and follows with DELETE", async () => {
  const profileId = "profile-1";
  const originalSave = saveWith(profileId, 10);
  const newerSave = saveWith(profileId, 20);
  const originalRemoteRecord = await cloudRecord(originalSave, 3);
  const originalRemote = await createAdventureCloudRemoteState(
    originalRemoteRecord,
    { profileId },
  );
  const local = await createAdventureCloudLocalState({
    profileId,
    save: newerSave,
    saveKind: "autosave",
    checkpointId: "before-delete",
  });
  const metadata = metadataAt(profileId, originalRemote);
  const upload = reconcileAdventureCloudProfile({
    profileId,
    local,
    remote: originalRemote,
    metadata,
  });
  assert.equal(upload.action.mutation, "save");
  assert.equal(upload.action.expectedCloudVersion, 3);

  const concurrentDeletion = markAdventureCloudLocalDeletion(upload.nextMetadata);
  const acceptedRecord = await cloudRecord(newerSave, 4, {
    metadata: { saveKind: "autosave", checkpointId: "before-delete" },
  });
  const acknowledged = await acknowledgeAdventureCloudSyncAction({
    metadata: upload.nextMetadata,
    action: upload.action,
    record: acceptedRecord,
  });
  const merged = preserveAdventureCloudConcurrentIntent({
    acknowledgedMetadata: acknowledged,
    latestMetadata: concurrentDeletion,
  });
  assert.equal(merged.pendingTombstone, true);
  assert.equal(merged.base.cloudVersion, 4);

  const absent = await createAdventureCloudLocalState({ profileId });
  const acceptedRemote = await createAdventureCloudRemoteState(acceptedRecord, {
    profileId,
  });
  const deletion = reconcileAdventureCloudProfile({
    profileId,
    local: absent,
    remote: acceptedRemote,
    metadata: merged,
  });
  assert.equal(deletion.action.mutation, "delete");
  assert.equal(deletion.action.expectedCloudVersion, 4);
});

test("an already-applied tombstone clears a pending deletion after a lost response", async () => {
  const profileId = "profile-3";
  const remote = await createAdventureCloudRemoteState(tombstoneRecord(profileId, 6), { profileId });
  const absent = await createAdventureCloudLocalState({ profileId });
  const metadata = markAdventureCloudLocalDeletion(metadataAt(profileId, remote));
  const result = reconcileAdventureCloudProfile({ profileId, local: absent, remote, metadata });
  assert.equal(result.status, "synced");
  assert.equal(result.action.type, "noop");
  assert.equal(result.nextMetadata.pendingTombstone, false);
  assert.equal(result.nextMetadata.base.cloudVersion, 6);
});

test("a new save created after an acknowledged tombstone may replace it with CAS", async () => {
  const profileId = "profile-3";
  const tombstone = await createAdventureCloudRemoteState(tombstoneRecord(profileId, 12), { profileId });
  const local = await createAdventureCloudLocalState({ profileId, save: saveWith(profileId, 0) });
  const result = reconcileAdventureCloudProfile({
    profileId,
    local,
    remote: tombstone,
    metadata: metadataAt(profileId, tombstone),
  });
  assert.equal(result.status, "push");
  assert.equal(result.action.mutation, "save");
  assert.equal(result.action.expectedCloudVersion, 12);
  assert.equal(result.action.metadata.saveKind, "autosave");
  assert.equal(result.action.body.metadata.saveKind, "autosave");
});

test("acknowledgement verifies server content and clears deletion, retry, and conflict state", async () => {
  const profileId = "profile-1";
  const oldSave = saveWith(profileId, 1);
  const nextSave = saveWith(profileId, 2);
  const remote = await createAdventureCloudRemoteState(await cloudRecord(oldSave, 2), { profileId });
  const local = await createAdventureCloudLocalState({ profileId, save: nextSave });
  const action = reconcileAdventureCloudProfile({
    profileId,
    local,
    remote,
    metadata: metadataAt(profileId, remote),
  }).action;
  const metadata = {
    ...metadataAt(profileId, remote),
    pendingTombstone: true,
    retry: {
      operationKey: action.coalesceKey,
      attemptCount: 1,
      error: { kind: "network", status: null, code: null },
    },
  };
  const accepted = await acknowledgeAdventureCloudSyncAction({
    metadata,
    action,
    record: await cloudRecord(nextSave, 3),
  });
  assert.equal(accepted.base.cloudVersion, 3);
  assert.equal(accepted.base.hash, local.hash);
  assert.equal(accepted.pendingTombstone, false);
  assert.equal(accepted.retry, null);
  assert.equal(accepted.conflict, null);

  await assert.rejects(
    acknowledgeAdventureCloudSyncAction({
      metadata,
      action,
      record: await cloudRecord(saveWith(profileId, 99), 3),
    }),
    /does not match/,
  );
});

test("conflict resolution explicitly supports either preserved side", async () => {
  const profileId = "profile-1";
  const base = await createAdventureCloudRemoteState(await cloudRecord(saveWith(profileId, 1), 1), { profileId });
  const local = await createAdventureCloudLocalState({ profileId, save: saveWith(profileId, 2, "Local") });
  const remoteRecord = await cloudRecord(saveWith(profileId, 3, "Remote"), 2);
  const remote = await createAdventureCloudRemoteState(remoteRecord, { profileId });
  const conflictMetadata = reconcileAdventureCloudProfile({
    profileId,
    local,
    remote,
    metadata: metadataAt(profileId, base),
  }).nextMetadata;

  const chooseRemote = await planAdventureCloudConflictResolution({
    metadata: conflictMetadata,
    choice: "remote",
    currentRemote: remoteRecord,
  });
  assert.equal(chooseRemote.action.type, "pull");
  assert.equal(chooseRemote.conflict.local.save.player.name, "Local");

  const chooseLocal = await planAdventureCloudConflictResolution({
    metadata: conflictMetadata,
    choice: "local",
    currentRemote: remoteRecord,
  });
  assert.equal(chooseLocal.action.type, "push");
  assert.equal(chooseLocal.action.conflictResolution, true);
  assert.equal(chooseLocal.action.expectedCloudVersion, 2);
  assert.equal(chooseLocal.action.localSave.player.name, "Local");
});

test("choosing this device uses progress saved after the conflict was detected", async () => {
  const profileId = "profile-1";
  const base = await createAdventureCloudRemoteState(
    await cloudRecord(saveWith(profileId, 1), 1),
    { profileId },
  );
  const localAtConflict = await createAdventureCloudLocalState({
    profileId,
    save: saveWith(profileId, 2, "Local v2"),
  });
  const remoteRecord = await cloudRecord(saveWith(profileId, 3, "Remote"), 2);
  const remote = await createAdventureCloudRemoteState(remoteRecord, { profileId });
  const conflictMetadata = reconcileAdventureCloudProfile({
    profileId,
    local: localAtConflict,
    remote,
    metadata: metadataAt(profileId, base),
  }).nextMetadata;
  const latestLocal = await createAdventureCloudLocalState({
    profileId,
    save: saveWith(profileId, 4, "Local v3"),
    saveKind: "autosave",
    checkpointId: "after-conflict",
  });

  const resolution = await planAdventureCloudConflictResolution({
    metadata: conflictMetadata,
    choice: "local",
    currentRemote: remoteRecord,
    currentLocal: latestLocal,
  });

  assert.equal(resolution.action.type, "push");
  assert.equal(resolution.action.expectedCloudVersion, 2);
  assert.equal(resolution.action.localSave.player.name, "Local v3");
  assert.equal(resolution.action.body.metadata.checkpointId, "after-conflict");
});

test("three-slot planning returns compact React-friendly actions", async () => {
  const remoteTwo = await cloudRecord(saveWith("profile-2", 20), 1);
  const plan = await planAdventureCloudSync({
    localByProfile: {
      "profile-1": { save: saveWith("profile-1", 10), metadata: { saveKind: "manual" } },
      "profile-2": null,
      "profile-3": null,
    },
    remoteByProfile: {
      "profile-1": null,
      "profile-2": remoteTwo,
      "profile-3": null,
    },
  });
  assert.equal(plan.status, "pending");
  assert.equal(plan.profiles.length, 3);
  assert.deepEqual(plan.profiles.map((profile) => profile.profileId), [
    "profile-1",
    "profile-2",
    "profile-3",
  ]);
  assert.deepEqual(plan.actions.map((action) => action.type), ["push", "pull"]);
});

test("coalescing removes exact duplicates without dropping a newer CAS operation", async () => {
  const profileId = "profile-1";
  const local = await createAdventureCloudLocalState({ profileId, save: saveWith(profileId, 2) });
  const remoteV1 = await createAdventureCloudRemoteState(await cloudRecord(saveWith(profileId, 1), 1), { profileId });
  const actionV1 = reconcileAdventureCloudProfile({
    profileId,
    local,
    remote: remoteV1,
    metadata: metadataAt(profileId, remoteV1),
  }).action;
  const actionV2 = { ...actionV1, expectedCloudVersion: 2, coalesceKey: `${profileId}:push-save:v2:${local.hash}` };
  assert.equal(shouldCoalesceAdventureCloudSyncActions(actionV1, { ...actionV1 }), true);
  assert.equal(shouldCoalesceAdventureCloudSyncActions(actionV1, actionV2), false);
  assert.deepEqual(coalesceAdventureCloudSyncActions([actionV1, { ...actionV1 }, actionV2]), [
    actionV1,
    actionV2,
  ]);
});

test("retry decisions are bounded, clock-free, and reset for a different operation", async () => {
  assert.deepEqual(classifyAdventureCloudSyncError({ status: 409 }), {
    kind: "conflict", retryable: false, conflict: true, status: 409,
  });
  assert.equal(classifyAdventureCloudSyncError({ status: 503 }).retryable, true);
  assert.equal(classifyAdventureCloudSyncError({ status: 401 }).retryable, false);
  assert.equal(classifyAdventureCloudSyncError(new TypeError("fetch failed")).kind, "network");
  assert.deepEqual(
    classifyAdventureCloudSyncError({
      code: "CLOUD_SAVE_OFFLINE",
      retryable: true,
      status: null,
    }),
    { kind: "network", retryable: true, conflict: false, status: null },
  );
  assert.equal(getAdventureCloudSyncRetryDelay(1), 1_000);
  assert.equal(getAdventureCloudSyncRetryDelay(10), 30_000);

  const profileId = "profile-1";
  const local = await createAdventureCloudLocalState({ profileId, save: saveWith(profileId, 4) });
  const remote = await createAdventureCloudRemoteState(null, { profileId });
  const action = reconcileAdventureCloudProfile({ profileId, local, remote }).action;
  const first = recordAdventureCloudSyncFailure({
    metadata: createAdventureCloudSyncMetadata(profileId),
    action,
    error: new TypeError("offline"),
  });
  assert.equal(first.metadata.retry.attemptCount, 1);
  assert.equal(Object.hasOwn(first.metadata.retry, "updatedAt"), false);
  const second = recordAdventureCloudSyncFailure({
    metadata: first.metadata,
    action,
    error: { status: 503, code: "UPSTREAM" },
  });
  assert.equal(second.metadata.retry.attemptCount, 2);
  const changed = recordAdventureCloudSyncFailure({
    metadata: second.metadata,
    action: { ...action, coalesceKey: `${action.coalesceKey}:changed` },
    error: { status: 503 },
  });
  assert.equal(changed.metadata.retry.attemptCount, 1);
});
