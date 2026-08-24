import {
  ADVENTURE_SAVE_SCHEMA_VERSION,
  migrateAdventureSave,
} from "./adventureProgression.mjs";
import { ADVENTURE_PROFILE_IDS } from "./adventureStorage.mjs";

export const ADVENTURE_CLOUD_SYNC_FORMAT_VERSION = 1;
export const ADVENTURE_CLOUD_SYNC_HASH_ALGORITHM = "sha256";
export const ADVENTURE_CLOUD_SYNC_METADATA_KEY_PREFIX = "seapals-reefbound-cloud-sync-v1";
export const ADVENTURE_CLOUD_SYNC_KINDS = Object.freeze([
  "absent",
  "active",
  "tombstone",
]);

const PROFILE_ID_SET = new Set(ADVENTURE_PROFILE_IDS);
const STATE_KIND_SET = new Set(ADVENTURE_CLOUD_SYNC_KINDS);
const METADATA_FORMAT = "seapals-adventure-cloud-sync-metadata";
const HASH_PATTERN = /^[a-f0-9]{64}$/;

function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertProfileId(profileId) {
  if (!PROFILE_ID_SET.has(profileId)) {
    throw new TypeError(`Profile ID must be one of: ${ADVENTURE_PROFILE_IDS.join(", ")}.`);
  }
  return profileId;
}

function assertAccountId(accountId) {
  if (
    typeof accountId !== "string"
    || accountId.length < 1
    || accountId.length > 128
    || accountId !== accountId.trim()
    || /[\u0000-\u001f\u007f]/.test(accountId)
  ) {
    throw new TypeError(
      "Adventure cloud-sync account ID must be a 1-128 character string without surrounding whitespace or control characters.",
    );
  }
  return accountId;
}

function assertStorageBackend(backend) {
  if (
    !backend
    || ["getItem", "setItem", "removeItem"].some(
      (method) => typeof backend[method] !== "function",
    )
  ) {
    throw new TypeError("Adventure cloud sync requires a localStorage-like backend.");
  }
}

function assertCloudVersion(value, { allowZero = true } = {}) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new TypeError(`Cloud version must be a ${allowZero ? "non-negative" : "positive"} safe integer.`);
  }
  return value;
}

function normalizeHash(value, path = "save hash") {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256 hex digest.`);
  }
  return value;
}

function normalizeSaveMetadata(value = {}) {
  const metadata = isRecord(value) ? value : {};
  const saveKind = metadata.saveKind ?? null;
  const checkpointId = metadata.checkpointId ?? null;
  if (saveKind !== null && typeof saveKind !== "string") {
    throw new TypeError("Save kind must be null or a string.");
  }
  if (checkpointId !== null && typeof checkpointId !== "string") {
    throw new TypeError("Checkpoint ID must be null or a string.");
  }
  return { saveKind, checkpointId };
}

/**
 * Recursively serializes JSON with lexicographically sorted object keys.
 * Arrays retain their canonical game-defined order. This deliberately excludes
 * timestamps and local write revisions: only the normalized save is hashed.
 */
export function stableStringifyAdventureCloudValue(value) {
  const ancestors = new Set();

  function encode(candidate, path) {
    if (candidate === null || typeof candidate === "boolean" || typeof candidate === "string") {
      return JSON.stringify(candidate);
    }
    if (typeof candidate === "number") {
      if (!Number.isFinite(candidate)) throw new TypeError(`${path} must contain only finite numbers.`);
      return JSON.stringify(candidate);
    }
    if (Array.isArray(candidate)) {
      if (ancestors.has(candidate)) throw new TypeError(`${path} must not be cyclic.`);
      ancestors.add(candidate);
      const encoded = candidate.map((item, index) => encode(item, `${path}[${index}]`));
      ancestors.delete(candidate);
      return `[${encoded.join(",")}]`;
    }
    if (!isRecord(candidate)) {
      throw new TypeError(`${path} must contain only plain JSON values.`);
    }
    if (ancestors.has(candidate)) throw new TypeError(`${path} must not be cyclic.`);
    ancestors.add(candidate);
    const encoded = Object.keys(candidate).sort().map((key) => {
      const item = candidate[key];
      if (item === undefined || typeof item === "function" || typeof item === "symbol") {
        throw new TypeError(`${path}.${key} must not be undefined or non-JSON data.`);
      }
      return `${JSON.stringify(key)}:${encode(item, `${path}.${key}`)}`;
    });
    ancestors.delete(candidate);
    return `{${encoded.join(",")}}`;
  }

  return encode(value, "value");
}

/** Migrates and normalizes a save before it crosses the cloud boundary. */
export function canonicalizeAdventureSave(saveValue, { profileId = saveValue?.profileId } = {}) {
  assertProfileId(profileId);
  const save = migrateAdventureSave(saveValue, { profileId });
  if (save.profileId !== profileId) {
    throw new TypeError(`Save belongs to ${save.profileId}, not ${profileId}.`);
  }
  // Return a detached JSON value so callers cannot mutate a state after it was
  // hashed while an upload is in flight.
  return JSON.parse(stableStringifyAdventureCloudValue(save));
}

/** Returns a lowercase SHA-256 digest of the canonical save JSON. */
export async function hashAdventureSave(saveValue, options = {}) {
  const save = canonicalizeAdventureSave(saveValue, options);
  if (!globalThis.crypto?.subtle || typeof globalThis.TextEncoder !== "function") {
    throw new Error("Adventure cloud sync requires Web Crypto SHA-256 support.");
  }
  const bytes = new TextEncoder().encode(stableStringifyAdventureCloudValue(save));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function absentState(profileId) {
  return {
    profileId,
    kind: "absent",
    save: null,
    hash: null,
    schemaVersion: null,
    cloudVersion: 0,
    saveKind: null,
    checkpointId: null,
  };
}

function tombstoneState(profileId, cloudVersion = null) {
  return {
    profileId,
    kind: "tombstone",
    save: null,
    hash: null,
    schemaVersion: null,
    cloudVersion,
    saveKind: null,
    checkpointId: null,
  };
}

/**
 * Creates the local three-state representation used by reconciliation. A null
 * save is `absent` unless `deleted` is explicit, in which case it is a pending
 * tombstone.
 */
export async function createAdventureCloudLocalState({
  profileId,
  save = null,
  deleted = false,
  saveKind = null,
  checkpointId = null,
} = {}) {
  assertProfileId(profileId);
  if (typeof deleted !== "boolean") throw new TypeError("Local deleted must be a boolean.");
  if (save === null) {
    return deleted ? tombstoneState(profileId) : absentState(profileId);
  }
  if (deleted) throw new TypeError("A local cloud state cannot contain both a save and a tombstone.");
  const canonicalSave = canonicalizeAdventureSave(save, { profileId });
  const hash = await hashAdventureSave(canonicalSave, { profileId });
  const normalizedMetadata = normalizeSaveMetadata({ saveKind, checkpointId });
  return {
    profileId,
    kind: "active",
    save: canonicalSave,
    hash,
    schemaVersion: canonicalSave.schemaVersion,
    cloudVersion: null,
    ...normalizedMetadata,
  };
}

/**
 * Normalizes the API record into the same three-state representation. The
 * finalized API names (`payload`, `canonicalHash`, `deleted`) are canonical;
 * the former `save`/`saveHash`/`deletedAt` aliases remain accepted during the
 * rollout. Active payloads are re-hashed and a mismatched server hash fails
 * closed.
 */
export async function createAdventureCloudRemoteState(record, { profileId } = {}) {
  if (record === null || record === undefined) {
    return absentState(assertProfileId(profileId));
  }
  if (!isRecord(record)) throw new TypeError("Cloud save record must be a plain object or null.");
  const normalizedProfileId = assertProfileId(profileId ?? record.profileId);
  if (record.profileId !== undefined && record.profileId !== normalizedProfileId) {
    throw new TypeError(`Cloud record belongs to ${String(record.profileId)}, not ${normalizedProfileId}.`);
  }
  const cloudVersion = assertCloudVersion(record.cloudVersion, { allowZero: false });
  const payload = record.payload !== undefined ? record.payload : (record.save ?? null);
  const deleted = record.deleted === true || record.deletedAt != null;
  if (deleted) {
    if (payload !== null) throw new TypeError("A cloud tombstone must not contain a save payload.");
    return {
      ...tombstoneState(normalizedProfileId, cloudVersion),
      createdAt: record.createdAt ?? null,
      updatedAt: record.updatedAt ?? null,
      deletedAt: record.deletedAt ?? record.updatedAt ?? null,
    };
  }
  if (payload === null) {
    throw new TypeError("An active cloud record must contain a save payload or be marked deleted.");
  }
  const save = canonicalizeAdventureSave(payload, { profileId: normalizedProfileId });
  const hash = await hashAdventureSave(save, { profileId: normalizedProfileId });
  const claimedHash = record.canonicalHash ?? record.saveHash;
  if (claimedHash !== undefined && claimedHash !== null && normalizeHash(claimedHash, "Cloud canonical hash") !== hash) {
    throw new TypeError("Cloud canonical hash does not match its normalized save payload.");
  }
  if (record.schemaVersion !== undefined && record.schemaVersion !== save.schemaVersion) {
    throw new TypeError("Cloud schema version does not match its normalized save payload.");
  }
  const metadata = normalizeSaveMetadata(record.metadata ?? {
    saveKind: record.saveKind,
    checkpointId: record.checkpointId,
  });
  return {
    profileId: normalizedProfileId,
    kind: "active",
    save,
    hash,
    schemaVersion: save.schemaVersion,
    cloudVersion,
    ...metadata,
    createdAt: record.createdAt ?? null,
    updatedAt: record.updatedAt ?? null,
    deletedAt: null,
  };
}

function normalizeBaseSnapshot(value, profileId) {
  if (value === null || value === undefined) return null;
  if (!isRecord(value) || !STATE_KIND_SET.has(value.kind)) {
    throw new TypeError("Cloud-sync base snapshot is invalid.");
  }
  const cloudVersion = assertCloudVersion(value.cloudVersion);
  if (value.kind === "active") {
    return {
      profileId,
      kind: "active",
      hash: normalizeHash(value.hash, "Base save hash"),
      schemaVersion: Number.isSafeInteger(value.schemaVersion) ? value.schemaVersion : null,
      cloudVersion,
    };
  }
  return {
    profileId,
    kind: value.kind,
    hash: null,
    schemaVersion: null,
    cloudVersion,
  };
}

function stateSnapshot(state, { includeSave = false } = {}) {
  const snapshot = {
    profileId: state.profileId,
    kind: state.kind,
    hash: state.kind === "active" ? state.hash : null,
    schemaVersion: state.kind === "active" ? state.schemaVersion : null,
    cloudVersion: state.cloudVersion ?? 0,
  };
  if (includeSave) {
    snapshot.save = state.kind === "active" ? state.save : null;
    snapshot.saveKind = state.saveKind ?? null;
    snapshot.checkpointId = state.checkpointId ?? null;
  }
  return snapshot;
}

function normalizeConflict(value, profileId) {
  if (value === null || value === undefined) return null;
  if (!isRecord(value) || value.profileId !== profileId || typeof value.reason !== "string") {
    throw new TypeError("Persisted cloud-sync conflict is invalid.");
  }
  // Conflict payloads are intentionally retained verbatim. They are the
  // recoverable copies shown to a player, not an input to automatic merging.
  return JSON.parse(stableStringifyAdventureCloudValue(value));
}

function normalizeRetry(value) {
  if (value === null || value === undefined) return null;
  if (
    !isRecord(value)
    || typeof value.operationKey !== "string"
    || !Number.isSafeInteger(value.attemptCount)
    || value.attemptCount < 1
  ) {
    throw new TypeError("Persisted cloud-sync retry metadata is invalid.");
  }
  return JSON.parse(stableStringifyAdventureCloudValue(value));
}

export function createAdventureCloudSyncMetadata(profileId, value = {}) {
  assertProfileId(profileId);
  const source = isRecord(value) ? value : {};
  return {
    format: METADATA_FORMAT,
    version: ADVENTURE_CLOUD_SYNC_FORMAT_VERSION,
    profileId,
    base: normalizeBaseSnapshot(source.base, profileId),
    pendingTombstone: source.pendingTombstone === true,
    conflict: normalizeConflict(source.conflict, profileId),
    retry: normalizeRetry(source.retry),
  };
}

/**
 * Returns true only when an otherwise empty slot has no protected or pending
 * sync work that a "keep both" copy could erase.
 */
export function isAdventureCloudConflictCopyTargetAvailable({
  profileId,
  localStatus,
  remoteKind,
  metadata,
} = {}) {
  const normalized = createAdventureCloudSyncMetadata(profileId, metadata);
  return Boolean(
    localStatus === "empty"
    && (remoteKind === "absent" || remoteKind === "tombstone")
    && !normalized.conflict
    && !normalized.pendingTombstone
    && !normalized.retry,
  );
}

export function getAdventureCloudSyncMetadataKey(accountId, profileId) {
  return `${ADVENTURE_CLOUD_SYNC_METADATA_KEY_PREFIX}:${encodeURIComponent(assertAccountId(accountId))}:${assertProfileId(profileId)}`;
}

/**
 * Persists the distinction between an intentionally deleted local slot and a
 * slot that has never been downloaded. Call this at the same time as the local
 * profile deletion; it survives reloads and is cleared only by acknowledgement.
 */
export function markAdventureCloudLocalDeletion(metadata) {
  const profileId = assertProfileId(metadata?.profileId);
  return {
    ...createAdventureCloudSyncMetadata(profileId, metadata),
    pendingTombstone: true,
    conflict: null,
    retry: null,
  };
}

function storageError(code, message, error) {
  return {
    code,
    message,
    retryable: true,
    ...(error ? { cause: String(error?.message ?? error) } : {}),
  };
}

/** Persists sync cursors, unresolved conflicts, and retry state per account/slot. */
export function createAdventureCloudSyncMetadataStore({ backend, accountId } = {}) {
  assertStorageBackend(backend);
  const normalizedAccountId = assertAccountId(accountId);

  function load(profileId) {
    assertProfileId(profileId);
    const key = getAdventureCloudSyncMetadataKey(normalizedAccountId, profileId);
    let raw;
    try {
      raw = backend.getItem(key);
    } catch (error) {
      return {
        ok: false,
        profileId,
        metadata: createAdventureCloudSyncMetadata(profileId),
        error: storageError("SYNC_METADATA_READ_FAILED", "Cloud-sync metadata could not be read.", error),
      };
    }
    if (raw === null) {
      return { ok: true, profileId, status: "empty", metadata: createAdventureCloudSyncMetadata(profileId) };
    }
    try {
      if (typeof raw !== "string") throw new TypeError("Storage returned non-string metadata.");
      const parsed = JSON.parse(raw);
      if (
        parsed?.format !== METADATA_FORMAT
        || parsed?.version !== ADVENTURE_CLOUD_SYNC_FORMAT_VERSION
        || parsed?.profileId !== profileId
      ) {
        throw new TypeError("Metadata envelope is unsupported or belongs to another profile.");
      }
      return {
        ok: true,
        profileId,
        status: "ready",
        metadata: createAdventureCloudSyncMetadata(profileId, parsed),
      };
    } catch (error) {
      return {
        ok: false,
        profileId,
        metadata: createAdventureCloudSyncMetadata(profileId),
        error: storageError("SYNC_METADATA_INVALID", "Stored cloud-sync metadata is invalid.", error),
      };
    }
  }

  function save(profileId, value) {
    assertProfileId(profileId);
    const metadata = createAdventureCloudSyncMetadata(profileId, value);
    try {
      backend.setItem(
        getAdventureCloudSyncMetadataKey(normalizedAccountId, profileId),
        stableStringifyAdventureCloudValue(metadata),
      );
      return { ok: true, profileId, metadata };
    } catch (error) {
      return {
        ok: false,
        profileId,
        metadata,
        error: storageError("SYNC_METADATA_WRITE_FAILED", "Cloud-sync metadata could not be saved.", error),
      };
    }
  }

  function remove(profileId) {
    assertProfileId(profileId);
    try {
      backend.removeItem(getAdventureCloudSyncMetadataKey(normalizedAccountId, profileId));
      return { ok: true, profileId };
    } catch (error) {
      return {
        ok: false,
        profileId,
        error: storageError("SYNC_METADATA_REMOVE_FAILED", "Cloud-sync metadata could not be removed.", error),
      };
    }
  }

  function loadAll() {
    const profiles = ADVENTURE_PROFILE_IDS.map((profileId) => load(profileId));
    return { ok: profiles.every((result) => result.ok), profiles };
  }

  return Object.freeze({ accountId: normalizedAccountId, load, loadAll, save, remove });
}

function sameContent(left, right) {
  if (!left || !right || left.kind !== right.kind) return false;
  return left.kind !== "active" || left.hash === right.hash;
}

function assertPreparedState(state, profileId, label, { remote = false } = {}) {
  if (!isRecord(state) || state.profileId !== profileId || !STATE_KIND_SET.has(state.kind)) {
    throw new TypeError(`${label} is not a prepared cloud-sync state for ${profileId}.`);
  }
  if (state.kind === "active") {
    normalizeHash(state.hash, `${label} hash`);
    if (!isRecord(state.save)) throw new TypeError(`${label} active state is missing its save.`);
  }
  if (remote) assertCloudVersion(state.cloudVersion);
  return state;
}

function operationKey(profileId, type, expectedCloudVersion, hash = "none") {
  return `${profileId}:${type}:v${expectedCloudVersion}:${hash}`;
}

function remoteRecordFromState(remote) {
  return {
    profileId: remote.profileId,
    cloudVersion: remote.cloudVersion,
    schemaVersion: remote.kind === "active" ? remote.schemaVersion : ADVENTURE_SAVE_SCHEMA_VERSION,
    canonicalHash: remote.kind === "active" ? remote.hash : null,
    deleted: remote.kind === "tombstone",
    payload: remote.kind === "active" ? remote.save : null,
    metadata: {
      saveKind: remote.saveKind ?? null,
      checkpointId: remote.checkpointId ?? null,
    },
  };
}

function pullAction(profileId, remote) {
  const type = remote.kind === "active" ? "pull" : "delete-local";
  return {
    type,
    profileId,
    expectedCloudVersion: remote.cloudVersion,
    remoteRecord: remoteRecordFromState(remote),
    metadata: {
      saveKind: remote.saveKind ?? (remote.kind === "tombstone" ? "delete" : null),
      checkpointId: remote.checkpointId ?? null,
    },
    remote: stateSnapshot(remote, { includeSave: true }),
    coalesceKey: operationKey(profileId, type, remote.cloudVersion, remote.hash ?? remote.kind),
  };
}

function pushAction(profileId, local, remote, { conflictResolution = false } = {}) {
  const desired = local.kind === "active" ? local : tombstoneState(profileId);
  const expectedCloudVersion = remote.cloudVersion;
  if (desired.kind === "active") {
    const saveKind = desired.saveKind ?? "autosave";
    return {
      type: "push",
      mutation: "save",
      method: "PUT",
      profileId,
      expectedCloudVersion,
      localSave: desired.save,
      metadata: {
        saveKind,
        checkpointId: desired.checkpointId ?? null,
      },
      body: {
        profileId,
        expectedCloudVersion,
        save: desired.save,
        metadata: {
          saveKind,
          checkpointId: desired.checkpointId ?? null,
        },
      },
      desired: stateSnapshot(desired, { includeSave: true }),
      conflictResolution,
      coalesceKey: operationKey(profileId, "push-save", expectedCloudVersion, desired.hash),
    };
  }
  return {
    type: "push",
    mutation: "delete",
    method: "DELETE",
    profileId,
    expectedCloudVersion,
    localSave: null,
    metadata: { saveKind: "delete", checkpointId: desired.checkpointId ?? null },
    body: {
      profileId,
      expectedCloudVersion,
      metadata: { saveKind: "delete", checkpointId: desired.checkpointId ?? null },
    },
    desired: stateSnapshot(desired, { includeSave: true }),
    conflictResolution,
    coalesceKey: operationKey(profileId, "push-delete", expectedCloudVersion, "tombstone"),
  };
}

function conflictReason(local, remote, tracked) {
  if (local.kind === "tombstone" || remote.kind === "tombstone") return "tombstone-vs-active";
  return tracked ? "divergent-changes" : "untracked-divergence";
}

function conflictPlan(profileId, local, remote, metadata, reason = conflictReason(local, remote, metadata.base !== null)) {
  const conflict = {
    profileId,
    reason,
    base: metadata.base,
    local: stateSnapshot(local, { includeSave: true }),
    remote: stateSnapshot(remote, { includeSave: true }),
  };
  return {
    profileId,
    status: "conflict",
    action: { type: "conflict", profileId, metadata: { reason }, conflict },
    conflict,
    nextMetadata: { ...metadata, conflict, retry: null },
  };
}

function planned(profileId, status, action, metadata, remote) {
  return {
    profileId,
    status,
    action: action ?? { type: "noop", profileId, metadata: null },
    conflict: null,
    nextMetadata: status === "synced"
      ? {
          ...metadata,
          base: stateSnapshot(remote),
          pendingTombstone: false,
          conflict: null,
          retry: null,
        }
      : metadata,
  };
}

/**
 * Three-way reconciliation based only on hashes, kinds, and the last accepted
 * server version. Device timestamps and local write revisions are never read.
 */
export function reconcileAdventureCloudProfile({ profileId, local, remote, metadata } = {}) {
  assertProfileId(profileId);
  assertPreparedState(local, profileId, "Local state");
  assertPreparedState(remote, profileId, "Remote state", { remote: true });
  const normalizedMetadata = createAdventureCloudSyncMetadata(profileId, metadata);
  const effectiveLocal = normalizedMetadata.pendingTombstone && local.kind === "absent"
    ? tombstoneState(profileId)
    : local;

  // Once surfaced, a conflict remains stable until the player explicitly
  // chooses a side. Background polling cannot erase either preserved copy.
  if (normalizedMetadata.conflict) {
    return {
      profileId,
      status: "conflict",
      action: {
        type: "conflict",
        profileId,
        metadata: { reason: normalizedMetadata.conflict.reason },
        conflict: normalizedMetadata.conflict,
      },
      conflict: normalizedMetadata.conflict,
      current: {
        local: stateSnapshot(effectiveLocal, { includeSave: true }),
        remote: stateSnapshot(remote, { includeSave: true }),
      },
      nextMetadata: normalizedMetadata,
    };
  }

  // The service represents deletion with tombstones. Once a device has
  // tracked a concrete row, a physically missing row is an integrity anomaly,
  // not a newer deletion. Fail closed instead of clearing or recreating data.
  if (
    normalizedMetadata.base
    && normalizedMetadata.base.kind !== "absent"
    && remote.kind === "absent"
  ) {
    return conflictPlan(
      profileId,
      effectiveLocal,
      remote,
      normalizedMetadata,
      "missing-remote-record",
    );
  }

  if (sameContent(effectiveLocal, remote)) {
    return planned(profileId, "synced", null, normalizedMetadata, remote);
  }

  const base = normalizedMetadata.base;
  if (base === null) {
    if (effectiveLocal.kind === "absent") {
      return planned(profileId, "pull", pullAction(profileId, remote), normalizedMetadata, remote);
    }
    if (remote.kind === "absent") {
      if (effectiveLocal.kind === "tombstone") {
        const action = pushAction(profileId, effectiveLocal, remote);
        const result = planned(profileId, "push", action, normalizedMetadata, remote);
        result.nextMetadata = { ...normalizedMetadata, pendingTombstone: true };
        return result;
      }
      return planned(profileId, "push", pushAction(profileId, effectiveLocal, remote), normalizedMetadata, remote);
    }
    // In particular, an untracked local save never overwrites a remote
    // tombstone. That requires an explicit conflict choice and prevents a stale
    // offline device from resurrecting a deleted slot.
    return conflictPlan(profileId, effectiveLocal, remote, normalizedMetadata);
  }


  // Missing local data is not proof of player intent: browsers can evict or
  // clear localStorage. Only pendingTombstone/the explicit tombstone kind may
  // issue a remote DELETE. Recover any tracked remote value instead.
  if (effectiveLocal.kind === "absent") {
    return planned(profileId, "pull", pullAction(profileId, remote), normalizedMetadata, remote);
  }

  const localMatchesBase = sameContent(effectiveLocal, base);
  const remoteMatchesBase = sameContent(remote, base);
  if (localMatchesBase && !remoteMatchesBase) {
    return planned(profileId, "pull", pullAction(profileId, remote), normalizedMetadata, remote);
  }
  if (remoteMatchesBase && !localMatchesBase) {
    const action = pushAction(profileId, effectiveLocal, remote);
    const result = planned(profileId, "push", action, normalizedMetadata, remote);
    if (action.mutation === "delete") {
      result.nextMetadata = { ...normalizedMetadata, pendingTombstone: true };
    }
    return result;
  }
  if (!localMatchesBase && !remoteMatchesBase) {
    return conflictPlan(profileId, effectiveLocal, remote, normalizedMetadata);
  }

  // This is reachable only if a future state kind extends equality semantics.
  return conflictPlan(profileId, effectiveLocal, remote, normalizedMetadata, "ambiguous-state");
}

async function prepareLocalInput(profileId, value) {
  if (isRecord(value) && STATE_KIND_SET.has(value.kind)) {
    if (value.kind === "active") {
      return createAdventureCloudLocalState({
        profileId,
        save: value.save ?? value.payload,
        saveKind: value.saveKind ?? value.metadata?.saveKind,
        checkpointId: value.checkpointId ?? value.metadata?.checkpointId,
      });
    }
    return createAdventureCloudLocalState({ profileId, deleted: value.kind === "tombstone" });
  }
  if (isRecord(value) && Object.prototype.hasOwnProperty.call(value, "save")) {
    return createAdventureCloudLocalState({
      profileId,
      save: value.save,
      saveKind: value.metadata?.saveKind,
      checkpointId: value.metadata?.checkpointId,
    });
  }
  return createAdventureCloudLocalState({ profileId, save: value ?? null });
}

/** Prepares and reconciles all three fixed slots for direct React consumption. */
export async function planAdventureCloudSync({
  localByProfile = {},
  remoteByProfile = {},
  metadataByProfile = {},
} = {}) {
  const profiles = await Promise.all(ADVENTURE_PROFILE_IDS.map(async (profileId) => {
    const local = await prepareLocalInput(profileId, localByProfile[profileId]);
    const remote = await createAdventureCloudRemoteState(remoteByProfile[profileId], { profileId });
    return reconcileAdventureCloudProfile({
      profileId,
      local,
      remote,
      metadata: metadataByProfile[profileId],
    });
  }));
  const actions = coalesceAdventureCloudSyncActions(
    profiles.map((profile) => profile.action).filter((action) => action.type !== "noop"),
  );
  return {
    status: profiles.some((profile) => profile.status === "conflict")
      ? "conflict"
      : (actions.length > 0 ? "pending" : "synced"),
    profiles,
    actions,
    hasConflicts: profiles.some((profile) => profile.status === "conflict"),
  };
}

export function shouldCoalesceAdventureCloudSyncActions(left, right) {
  return Boolean(
    left
    && right
    && typeof left.coalesceKey === "string"
    && left.coalesceKey === right.coalesceKey,
  );
}

/** Removes only exact duplicate operations; differing writes retain their order. */
export function coalesceAdventureCloudSyncActions(actions = []) {
  const result = [];
  const keys = new Set();
  for (const action of actions) {
    if (!action) continue;
    if (action.type === "noop") continue;
    if (typeof action.coalesceKey !== "string") {
      result.push(action);
      continue;
    }
    if (keys.has(action.coalesceKey)) continue;
    keys.add(action.coalesceKey);
    result.push(action);
  }
  return result;
}

/** Plans an explicit player choice without discarding the preserved conflict. */
export async function planAdventureCloudConflictResolution({
  metadata,
  choice,
  currentRemote,
  currentLocal,
} = {}) {
  const profileId = assertProfileId(metadata?.profileId);
  const normalizedMetadata = createAdventureCloudSyncMetadata(profileId, metadata);
  const conflict = normalizedMetadata.conflict;
  if (!conflict) throw new TypeError("There is no cloud-save conflict to resolve.");
  if (choice !== "local" && choice !== "remote") {
    throw new TypeError("Conflict choice must be local or remote.");
  }
  const remote = currentRemote === undefined
    ? await prepareConflictState(conflict.remote, profileId, true)
    : await createAdventureCloudRemoteState(currentRemote, { profileId });
  if (choice === "remote") {
    return {
      profileId,
      status: "resolving",
      choice,
      action: pullAction(profileId, remote),
      conflict,
      nextMetadata: normalizedMetadata,
    };
  }
  // A conflict can remain protected while the player finishes an active
  // session. Prefer the latest verified device snapshot when the caller has
  // one so choosing "this device" never rolls progress back to the snapshot
  // that originally raised the conflict.
  const local = currentLocal === undefined
    ? await prepareConflictState(conflict.local, profileId, false)
    : await prepareLocalInput(profileId, currentLocal);
  const action = sameContent(local, remote)
    ? { type: "noop", profileId, metadata: null }
    : pushAction(profileId, local, remote, { conflictResolution: true });
  return {
    profileId,
    status: action.type !== "noop" ? "resolving" : "synced",
    choice,
    action,
    conflict,
    nextMetadata: action.type !== "noop"
      ? normalizedMetadata
      : { ...normalizedMetadata, base: stateSnapshot(remote), conflict: null, retry: null },
  };
}

async function prepareConflictState(snapshot, profileId, remote) {
  if (snapshot.kind === "active") {
    const local = await createAdventureCloudLocalState({
      profileId,
      save: snapshot.save,
      saveKind: snapshot.saveKind,
      checkpointId: snapshot.checkpointId,
    });
    return remote ? { ...local, cloudVersion: assertCloudVersion(snapshot.cloudVersion) } : local;
  }
  if (snapshot.kind === "tombstone") {
    return { ...tombstoneState(profileId), cloudVersion: remote ? assertCloudVersion(snapshot.cloudVersion) : null };
  }
  return absentState(profileId);
}

/**
 * Advances the sync cursor only after the local write or remote mutation has
 * actually succeeded. Push acknowledgements are verified against the desired
 * content before conflict/retry data is cleared.
 */
export async function acknowledgeAdventureCloudSyncAction({ metadata, action, record } = {}) {
  if (!action || !isRecord(action)) throw new TypeError("A cloud-sync action is required.");
  const profileId = assertProfileId(action.profileId);
  const normalizedMetadata = createAdventureCloudSyncMetadata(profileId, metadata);
  let accepted;
  if (action.type === "pull" || action.type === "delete-local") {
    accepted = await prepareConflictState(action.remote, profileId, true);
  } else if (action.type === "push") {
    accepted = await createAdventureCloudRemoteState(record, { profileId });
    const desired = await prepareConflictState(action.desired, profileId, false);
    if (!sameContent(accepted, desired)) {
      throw new TypeError("Cloud acknowledgement does not match the requested save mutation.");
    }
  } else {
    throw new TypeError(`Unsupported cloud-sync action type ${String(action.type)}.`);
  }
  return {
    ...normalizedMetadata,
    base: stateSnapshot(accepted),
    pendingTombstone: false,
    conflict: null,
    retry: null,
  };
}

/**
 * Preserves local intent recorded while an older cloud mutation was in flight.
 * The accepted server snapshot advances the CAS base, while a newer deletion,
 * conflict, or retry marker remains pending for the serialized follow-up.
 */
export function preserveAdventureCloudConcurrentIntent({
  acknowledgedMetadata,
  latestMetadata,
} = {}) {
  const profileId = assertProfileId(
    acknowledgedMetadata?.profileId ?? latestMetadata?.profileId,
  );
  const acknowledged = createAdventureCloudSyncMetadata(
    profileId,
    acknowledgedMetadata,
  );
  const latest = createAdventureCloudSyncMetadata(profileId, latestMetadata);
  return {
    ...acknowledged,
    pendingTombstone: latest.pendingTombstone,
    conflict: latest.conflict,
    retry: latest.retry,
  };
}

export function classifyAdventureCloudSyncError(error) {
  const status = Number(error?.status ?? error?.statusCode ?? error?.response?.status);
  if (status === 409 || error?.conflict === true) {
    return { kind: "conflict", retryable: false, conflict: true, status: 409 };
  }
  if (status === 401 || status === 403) {
    return { kind: "authentication", retryable: false, conflict: false, status };
  }
  if ([408, 425, 429].includes(status) || status >= 500) {
    return { kind: "transient", retryable: true, conflict: false, status };
  }
  if (error?.retryable === true) {
    const code = typeof error.code === "string" ? error.code : "";
    return {
      kind: !Number.isFinite(status) || /OFFLINE|NETWORK|FETCH/i.test(code) ? "network" : "transient",
      retryable: true,
      conflict: false,
      status: Number.isFinite(status) ? status : null,
    };
  }
  if (!Number.isFinite(status) && (error instanceof TypeError || error?.name === "AbortError")) {
    return { kind: "network", retryable: true, conflict: false, status: null };
  }
  return {
    kind: "fatal",
    retryable: false,
    conflict: false,
    status: Number.isFinite(status) ? status : null,
  };
}

/** Records a retry decision without relying on a device clock. */
export function recordAdventureCloudSyncFailure({ metadata, action, error } = {}) {
  if (!action?.coalesceKey) throw new TypeError("A coalescible cloud-sync action is required.");
  const profileId = assertProfileId(action.profileId);
  const normalizedMetadata = createAdventureCloudSyncMetadata(profileId, metadata);
  const classification = classifyAdventureCloudSyncError(error);
  if (!classification.retryable) {
    return { metadata: normalizedMetadata, classification };
  }
  const prior = normalizedMetadata.retry;
  const attemptCount = prior?.operationKey === action.coalesceKey
    ? prior.attemptCount + 1
    : 1;
  return {
    classification,
    metadata: {
      ...normalizedMetadata,
      retry: {
        operationKey: action.coalesceKey,
        attemptCount,
        error: {
          kind: classification.kind,
          status: classification.status,
          code: typeof error?.code === "string" ? error.code : null,
        },
      },
    },
  };
}

export function getAdventureCloudSyncRetryDelay(
  attemptCount,
  { baseDelayMs = 1_000, maxDelayMs = 30_000 } = {},
) {
  if (!Number.isSafeInteger(attemptCount) || attemptCount < 1) {
    throw new TypeError("Retry attempt count must be a positive safe integer.");
  }
  if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0 || !Number.isFinite(maxDelayMs) || maxDelayMs < 0) {
    throw new TypeError("Retry delays must be non-negative finite numbers.");
  }
  return Math.min(maxDelayMs, baseDelayMs * (2 ** Math.min(attemptCount - 1, 30)));
}
