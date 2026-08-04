import {
  ADVENTURE_SAVE_SCHEMA_VERSION,
  createInitialAdventureSave,
  migrateAdventureSave,
  normalizeAdventureSave,
} from "./adventureProgression.mjs";
import { ELVERSON_TOWN_LAYOUT_VERSION } from "./adventureElversonTownLayout.mjs";

export const ADVENTURE_PROFILE_IDS = Object.freeze([
  "profile-1",
  "profile-2",
  "profile-3",
]);

export const ADVENTURE_PROFILE_COUNT = ADVENTURE_PROFILE_IDS.length;
export const ADVENTURE_STORAGE_FORMAT_VERSION = 1;
export const ADVENTURE_STORAGE_KEY_PREFIX = "seapals-reefbound-saves-v1";
export const LEGACY_ADVENTURE_PROGRESS_KEY = "seapals-reefbound-progress-v1";
export const ADVENTURE_ACCOUNT_STORAGE_KEY_PREFIX = "seapals-reefbound-account-saves-v1";
export const ADVENTURE_UNSCOPED_SAVE_CLAIM_KEY = "seapals-reefbound-unscoped-save-claim-v1";

const PROFILE_ID_SET = new Set(ADVENTURE_PROFILE_IDS);
const SAVE_KINDS = new Set(["manual", "autosave", "migration", "new-game"]);
const RECORD_FORMAT = "seapals-adventure-profile";
const UNSCOPED_CLAIM_FORMAT = "seapals-adventure-unscoped-save-claim";
const UNSCOPED_CLAIM_FORMAT_VERSION = 1;
const ADVENTURE_ACCOUNT_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._:@-]{0,126}[A-Za-z0-9])?$/;
const RECOVERY_SOURCE_PRIORITY = Object.freeze({ staging: 3, backup: 2, primary: 1 });
const CANONICAL_SAVE_V1_REQUIRED_PATHS = Object.freeze([
  ["schemaVersion"],
  ["profileId"],
  ["player"],
  ["player", "starterDeckId"],
  ["player", "activeDeckId"],
  ["world"],
  ["world", "townId"],
  ["world", "sceneId"],
  ["world", "position"],
  ["world", "position", "x"],
  ["world", "position", "y"],
  ["world", "facing"],
  ["world", "lastSafeDockId"],
  ["world", "unlockedRouteIds"],
  ["progression"],
  ["progression", "quests"],
  ["progression", "npcStates"],
  ["progression", "completedEncounterIds"],
  ["progression", "tideMarkIds"],
  ["progression", "tournament"],
  ["progression", "tournament", "status"],
  ["progression", "tournament", "activeRoundId"],
  ["progression", "tournament", "completedRoundIds"],
  ["inventory"],
  ["inventory", "cards"],
  ["inventory", "unopenedPacks"],
  ["inventory", "storyItems"],
  ["inventory", "boatItems"],
  ["savedDecks"],
  ["tutorial"],
  ["tutorial", "status"],
  ["tutorial", "completedStepIds"],
  ["fieldNotes"],
  ["fieldNotes", "entryIds"],
  ["settings"],
  ["settings", "textSpeed"],
  ["settings", "reducedMotion"],
  ["settings", "highContrast"],
  ["settings", "boatAutoSteer"],
  ["playtimeSeconds"],
  ["rewardLedger"],
]);
const CANONICAL_SAVE_V2_REQUIRED_PATHS = Object.freeze([
  ...CANONICAL_SAVE_V1_REQUIRED_PATHS,
  ["world", "completedRouteIds"],
  ["progression", "encounterResults"],
]);
const CANONICAL_SAVE_V3_REQUIRED_PATHS = Object.freeze([
  ...CANONICAL_SAVE_V2_REQUIRED_PATHS,
  ["opening"],
  ["opening", "contentVersion"],
  ["opening", "status"],
  ["opening", "completedBeatIds"],
]);
const CANONICAL_SAVE_V4_REQUIRED_PATHS = Object.freeze([
  ...CANONICAL_SAVE_V3_REQUIRED_PATHS,
  ["world", "layoutVersion"],
]);

function canonicalRequiredPathsForVersion(schemaVersion) {
  if (schemaVersion === 1) return CANONICAL_SAVE_V1_REQUIRED_PATHS;
  if (schemaVersion === 2) return CANONICAL_SAVE_V2_REQUIRED_PATHS;
  if (schemaVersion === 3) return CANONICAL_SAVE_V3_REQUIRED_PATHS;
  if (schemaVersion === 4) return CANONICAL_SAVE_V4_REQUIRED_PATHS;
  return null;
}

function firstMissingOwnPath(value, paths) {
  for (const path of paths) {
    let cursor = value;
    let present = true;
    for (const segment of path) {
      if (
        cursor === null
        || typeof cursor !== "object"
        || !Object.prototype.hasOwnProperty.call(cursor, segment)
      ) {
        present = false;
        break;
      }
      cursor = cursor[segment];
    }
    if (!present) return path.join(".");
  }
  return null;
}

function profileKeys(profileId) {
  const base = `${ADVENTURE_STORAGE_KEY_PREFIX}:${profileId}`;
  return Object.freeze({
    primary: base,
    backup: `${base}:backup`,
    staging: `${base}:staging`,
  });
}

export const ADVENTURE_PROFILE_STORAGE_KEYS = Object.freeze(Object.fromEntries(
  ADVENTURE_PROFILE_IDS.map((profileId) => [profileId, profileKeys(profileId)]),
));

function assertStorageBackend(backend, label = "Adventure storage") {
  if (
    !backend
    || ["getItem", "setItem", "removeItem"].some((method) => typeof backend[method] !== "function")
  ) {
    throw new TypeError(`${label} requires a localStorage-like backend.`);
  }
}

function normalizeAdventureAccountId(accountId) {
  if (typeof accountId !== "string") {
    throw new TypeError("Adventure account ID must be a string.");
  }
  if (accountId !== accountId.trim()) {
    throw new TypeError("Adventure account ID must not contain surrounding whitespace.");
  }
  if (!ADVENTURE_ACCOUNT_ID_PATTERN.test(accountId)) {
    throw new TypeError(
      "Adventure account ID must be 1-128 characters using only letters, numbers, dots, underscores, colons, @, or hyphens.",
    );
  }
  return accountId;
}

function normalizeStorageKey(key) {
  if (typeof key !== "string" || !key || /[\u0000-\u001f\u007f]/.test(key)) {
    throw new TypeError("Adventure storage key must be a non-empty string without control characters.");
  }
  return key;
}

/** Returns the physical local-storage key used for one authenticated account. */
export function getAccountScopedAdventureStorageKey(accountId, key) {
  const normalizedAccountId = normalizeAdventureAccountId(accountId);
  const normalizedKey = normalizeStorageKey(key);
  return `${ADVENTURE_ACCOUNT_STORAGE_KEY_PREFIX}:${encodeURIComponent(normalizedAccountId)}:${normalizedKey}`;
}

/**
 * Wraps a synchronous localStorage-like backend so the existing adventure
 * adapter can keep its fixed logical profile IDs without sharing them between
 * authenticated accounts.
 */
export function createAccountScopedAdventureStorage({ backend, accountId } = {}) {
  assertStorageBackend(backend, "Account-scoped adventure storage");
  const normalizedAccountId = normalizeAdventureAccountId(accountId);
  const keyFor = (key) => getAccountScopedAdventureStorageKey(normalizedAccountId, key);

  return Object.freeze({
    accountId: normalizedAccountId,
    getItem(key) {
      return backend.getItem(keyFor(key));
    },
    setItem(key, value) {
      backend.setItem(keyFor(key), value);
    },
    removeItem(key) {
      backend.removeItem(keyFor(key));
    },
  });
}

function errorDetail(code, message, options = {}) {
  return {
    code,
    message,
    retryable: options.retryable ?? false,
    ...(options.cause ? { cause: String(options.cause?.message ?? options.cause) } : {}),
  };
}

function invalidProfileResult(operation, profileId) {
  return {
    ok: false,
    operation,
    profileId,
    error: errorDetail(
      "INVALID_PROFILE_ID",
      `Profile ID must be one of: ${ADVENTURE_PROFILE_IDS.join(", ")}.`,
    ),
  };
}

function timestampFrom(clock) {
  const value = clock();
  const timestamp = value instanceof Date ? value.toISOString() : String(value);
  if (!timestamp.trim() || !Number.isFinite(Date.parse(timestamp))) {
    throw new TypeError("The storage clock must return a valid date or timestamp string.");
  }
  return new Date(timestamp).toISOString();
}

function encodeRecord({ profileId, save, savedAt, saveKind, checkpointId = null, revision }) {
  return JSON.stringify({
    format: RECORD_FORMAT,
    storageVersion: ADVENTURE_STORAGE_FORMAT_VERSION,
    profileId,
    savedAt,
    revision,
    saveKind,
    checkpointId,
    save,
  });
}

function decodeRecord(raw, expectedProfileId) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      valid: false,
      error: errorDetail("MALFORMED_JSON", "Stored profile is not valid JSON.", { cause: error }),
    };
  }

  try {
    // Accept a bare adventure save as a recoverable import boundary. All new
    // writes use the storage envelope below.
    if (parsed?.format === undefined && parsed?.storageVersion === undefined) {
      const sourceSchemaVersion = parsed?.schemaVersion ?? 0;
      const save = migrateAdventureSave(parsed, { profileId: expectedProfileId });
      if (save.profileId !== expectedProfileId) {
        return {
          valid: false,
          error: errorDetail(
            "PROFILE_ID_MISMATCH",
            `Stored profile belongs to ${save.profileId}, not ${expectedProfileId}.`,
          ),
        };
      }
      return {
        valid: true,
        save,
        metadata: {
          savedAt: null,
          revision: null,
          saveKind: "migration",
          checkpointId: null,
          bareSave: true,
          sourceSchemaVersion,
          migratedFromSchemaVersion: sourceSchemaVersion === ADVENTURE_SAVE_SCHEMA_VERSION
            ? null
            : sourceSchemaVersion,
          needsRewrite: true,
        },
      };
    }

    if (parsed?.format !== RECORD_FORMAT) {
      return {
        valid: false,
        error: errorDetail("UNSUPPORTED_RECORD_FORMAT", "Stored profile uses an unknown record format."),
      };
    }
    if (parsed.storageVersion !== ADVENTURE_STORAGE_FORMAT_VERSION) {
      return {
        valid: false,
        error: errorDetail(
          "UNSUPPORTED_STORAGE_VERSION",
          `Stored profile format version ${String(parsed.storageVersion)} is not supported.`,
        ),
      };
    }
    if (parsed.profileId !== expectedProfileId) {
      return {
        valid: false,
        error: errorDetail(
          "PROFILE_ID_MISMATCH",
          `Stored profile belongs to ${String(parsed.profileId)}, not ${expectedProfileId}.`,
        ),
      };
    }
    if (typeof parsed.savedAt !== "string" || !Number.isFinite(Date.parse(parsed.savedAt))) {
      return {
        valid: false,
        error: errorDetail("INVALID_SAVE_METADATA", "Stored profile has an invalid save timestamp."),
      };
    }
    if (
      parsed.revision !== undefined
      && (!Number.isSafeInteger(parsed.revision) || parsed.revision < 1)
    ) {
      return {
        valid: false,
        error: errorDetail("INVALID_SAVE_METADATA", "Stored profile has an invalid write revision."),
      };
    }
    if (!SAVE_KINDS.has(parsed.saveKind)) {
      return {
        valid: false,
        error: errorDetail("INVALID_SAVE_METADATA", "Stored profile has an invalid save kind."),
      };
    }
    if (parsed.checkpointId !== null && typeof parsed.checkpointId !== "string") {
      return {
        valid: false,
        error: errorDetail("INVALID_SAVE_METADATA", "Stored profile has an invalid checkpoint ID."),
      };
    }

    if (
      parsed.save === null
      || typeof parsed.save !== "object"
      || Array.isArray(parsed.save)
      || !Object.prototype.hasOwnProperty.call(parsed.save, "schemaVersion")
    ) {
      return {
        valid: false,
        error: errorDetail(
          "INCOMPLETE_SAVE_DATA",
          "Stored profile is missing its versioned canonical save payload.",
        ),
      };
    }
    const sourceSchemaVersion = parsed.save.schemaVersion;
    const canonicalPaths = canonicalRequiredPathsForVersion(sourceSchemaVersion);
    if (canonicalPaths) {
      const missingPath = firstMissingOwnPath(parsed.save, canonicalPaths);
      if (missingPath) {
        return {
          valid: false,
          error: errorDetail(
            "INCOMPLETE_SAVE_DATA",
            `Stored profile is missing canonical save field ${missingPath}.`,
          ),
        };
      }
    }

    const save = migrateAdventureSave(parsed.save, { profileId: expectedProfileId });
    if (save.profileId !== expectedProfileId) {
      return {
        valid: false,
        error: errorDetail(
          "PROFILE_ID_MISMATCH",
          `Stored save belongs to ${save.profileId}, not ${expectedProfileId}.`,
        ),
      };
    }
    return {
      valid: true,
      save,
      metadata: {
        savedAt: new Date(parsed.savedAt).toISOString(),
        revision: parsed.revision ?? null,
        saveKind: parsed.saveKind,
        checkpointId: parsed.checkpointId,
        bareSave: false,
        sourceSchemaVersion,
        migratedFromSchemaVersion: sourceSchemaVersion === ADVENTURE_SAVE_SCHEMA_VERSION
          ? null
          : sourceSchemaVersion,
        needsRewrite: sourceSchemaVersion !== ADVENTURE_SAVE_SCHEMA_VERSION
          || save.world.layoutVersion !== ELVERSON_TOWN_LAYOUT_VERSION,
      },
    };
  } catch (error) {
    return {
      valid: false,
      error: errorDetail(
        "INVALID_SAVE_DATA",
        error?.message ?? "Stored profile failed save validation.",
        { cause: error },
      ),
    };
  }
}

function summaryFromLoad(profileId, result) {
  const slot = ADVENTURE_PROFILE_IDS.indexOf(profileId) + 1;
  if (!result.save) {
    return {
      profileId,
      slot,
      occupied: result.hasStoredData,
      canContinue: false,
      status: result.status,
      source: null,
      savedAt: null,
      saveKind: null,
      checkpointId: null,
      townId: null,
      sceneId: null,
      starterDeckId: null,
      activeDeckId: null,
      playtimeSeconds: 0,
      tideMarkCount: 0,
      completedEncounterCount: 0,
      recovery: result.recovery ?? null,
    };
  }

  return {
    profileId,
    slot,
    occupied: true,
    canContinue: true,
    status: result.status,
    source: result.source,
    savedAt: result.metadata.savedAt,
    saveKind: result.metadata.saveKind,
    checkpointId: result.metadata.checkpointId,
    townId: result.save.world.townId,
    sceneId: result.save.world.sceneId,
    starterDeckId: result.save.player.starterDeckId,
    activeDeckId: result.save.player.activeDeckId,
    playtimeSeconds: result.save.playtimeSeconds,
    tideMarkCount: result.save.progression.tideMarkIds.length,
    completedEncounterCount: result.save.progression.completedEncounterIds.length,
    recovery: result.recovery ?? null,
  };
}

function compareRecoveryCandidates(left, right) {
  const leftRevision = left.decoded.metadata.revision ?? 0;
  const rightRevision = right.decoded.metadata.revision ?? 0;
  if (leftRevision !== rightRevision) return rightRevision - leftRevision;

  const leftTime = left.decoded.metadata.savedAt
    ? Date.parse(left.decoded.metadata.savedAt)
    : Number.NEGATIVE_INFINITY;
  const rightTime = right.decoded.metadata.savedAt
    ? Date.parse(right.decoded.metadata.savedAt)
    : Number.NEGATIVE_INFINITY;
  if (leftTime !== rightTime) return rightTime - leftTime;
  if (left.raw === right.raw) return 0;
  return RECOVERY_SOURCE_PRIORITY[right.source] - RECOVERY_SOURCE_PRIORITY[left.source];
}

/**
 * Creates the local-first adapter. `backend` must expose the localStorage
 * getItem/setItem/removeItem interface; the adapter never reads browser globals.
 */
export function createAdventureStorageAdapter({ backend, now = () => new Date() } = {}) {
  if (!backend || ["getItem", "setItem", "removeItem"].some((method) => typeof backend[method] !== "function")) {
    throw new TypeError("Adventure storage requires an injected localStorage-like backend.");
  }
  if (typeof now !== "function") throw new TypeError("Adventure storage now must be a function.");

  function readKey(key, operation) {
    try {
      const value = backend.getItem(key);
      if (value !== null && typeof value !== "string") {
        return {
          ok: false,
          error: errorDetail("STORAGE_READ_FAILED", "Storage returned a non-string value.", { retryable: true }),
        };
      }
      return { ok: true, value };
    } catch (error) {
      return {
        ok: false,
        error: errorDetail("STORAGE_READ_FAILED", `${operation} could not read local storage.`, {
          retryable: true,
          cause: error,
        }),
      };
    }
  }

  function writeKey(key, value, operation) {
    try {
      backend.setItem(key, value);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: errorDetail("STORAGE_WRITE_FAILED", `${operation} could not write local storage.`, {
          retryable: true,
          cause: error,
        }),
      };
    }
  }

  function removeKey(key, operation) {
    try {
      backend.removeItem(key);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: errorDetail("STORAGE_REMOVE_FAILED", `${operation} could not clean up local storage.`, {
          retryable: true,
          cause: error,
        }),
      };
    }
  }

  function loadProfile(profileId) {
    const operation = "load-profile";
    if (!PROFILE_ID_SET.has(profileId)) return invalidProfileResult(operation, profileId);

    const keys = ADVENTURE_PROFILE_STORAGE_KEYS[profileId];
    const issues = [];
    let hasStoredData = false;
    const recoveryCandidates = [];
    let primaryCandidate = null;

    function resultFromCandidate(source, decoded, recovered) {
      const result = {
        ok: true,
        operation,
        profileId,
        status: recovered ? "recovered" : "ready",
        source,
        save: decoded.save,
        metadata: decoded.metadata,
        hasStoredData: true,
        issues,
        recovery: recovered
          ? {
              needed: true,
              available: true,
              source,
              action: "save-profile-to-repair-primary",
              issues,
            }
          : null,
      };
      return { ...result, summary: summaryFromLoad(profileId, result) };
    }

    for (const source of ["primary", "staging", "backup"]) {
      const read = readKey(keys[source], operation);
      if (!read.ok) {
        issues.push({ source, error: read.error });
        continue;
      }
      if (read.value === null) continue;
      hasStoredData = true;

      const decoded = decodeRecord(read.value, profileId);
      if (!decoded.valid) {
        issues.push({ source, error: decoded.error });
        continue;
      }

      if (source === "primary") {
        if (decoded.metadata.bareSave) {
          recoveryCandidates.push({ source, decoded, raw: read.value });
          continue;
        }
        primaryCandidate = { source, decoded, raw: read.value };
        continue;
      }
      recoveryCandidates.push({ source, decoded, raw: read.value });
    }

    if (primaryCandidate) {
      const stagedCandidate = recoveryCandidates.find(({ source }) => source === "staging");
      if (stagedCandidate && compareRecoveryCandidates(stagedCandidate, primaryCandidate) < 0) {
        return resultFromCandidate("staging", stagedCandidate.decoded, true);
      }
      return resultFromCandidate(
        "primary",
        primaryCandidate.decoded,
        primaryCandidate.decoded.metadata.bareSave,
      );
    }

    if (recoveryCandidates.length > 0) {
      recoveryCandidates.sort(compareRecoveryCandidates);
      const selected = recoveryCandidates[0];
      return resultFromCandidate(selected.source, selected.decoded, true);
    }

    const storageUnavailable = issues.some((issue) => issue.error.code === "STORAGE_READ_FAILED");
    if (!hasStoredData && !storageUnavailable) {
      const result = {
        ok: true,
        operation,
        profileId,
        status: "empty",
        source: null,
        save: null,
        metadata: null,
        hasStoredData: false,
        issues: [],
        recovery: null,
      };
      return { ...result, summary: summaryFromLoad(profileId, result) };
    }

    const result = {
      ok: false,
      operation,
      profileId,
      status: storageUnavailable ? "unavailable" : "unrecoverable",
      source: null,
      save: null,
      metadata: null,
      hasStoredData,
      issues,
      recovery: {
        needed: true,
        available: false,
        action: storageUnavailable ? "retry-storage-access" : "start-new-profile-or-import-backup",
        issues,
      },
      error: errorDetail(
        storageUnavailable ? "STORAGE_READ_FAILED" : "PROFILE_UNRECOVERABLE",
        storageUnavailable
          ? "The profile could not be read from local storage."
          : "No valid copy of this stored profile could be loaded.",
        { retryable: storageUnavailable },
      ),
    };
    return { ...result, summary: summaryFromLoad(profileId, result) };
  }

  function persist(profileId, saveValue, saveKind, checkpointId = null) {
    const operation = {
      autosave: "autosave",
      manual: "manual-save",
      migration: "migrate-legacy-profile",
      "new-game": "new-game",
    }[saveKind] ?? "save-profile";
    if (!PROFILE_ID_SET.has(profileId)) return invalidProfileResult(operation, profileId);

    let save;
    let savedAt;
    let raw;
    let revision;
    try {
      save = normalizeAdventureSave(saveValue);
      if (save.profileId !== profileId) {
        return {
          ok: false,
          operation,
          profileId,
          error: errorDetail(
            "PROFILE_ID_MISMATCH",
            `Cannot write save for ${save.profileId} into ${profileId}.`,
          ),
        };
      }
      if (!SAVE_KINDS.has(saveKind)) {
        return {
          ok: false,
          operation,
          profileId,
          error: errorDetail("INVALID_SAVE_KIND", `Unsupported save kind: ${String(saveKind)}.`),
        };
      }
      if (checkpointId !== null && (typeof checkpointId !== "string" || !checkpointId.trim())) {
        return {
          ok: false,
          operation,
          profileId,
          error: errorDetail("INVALID_CHECKPOINT", "Autosave checkpoint ID must be a non-empty string."),
        };
      }
      savedAt = timestampFrom(now);
    } catch (error) {
      return {
        ok: false,
        operation,
        profileId,
        error: errorDetail("INVALID_SAVE", error?.message ?? "Save validation failed.", { cause: error }),
      };
    }

    const keys = ADVENTURE_PROFILE_STORAGE_KEYS[profileId];
    const current = readKey(keys.primary, operation);
    if (!current.ok) return { ok: false, operation, profileId, error: current.error };

    let highestRevision = 0;
    const revisionCopies = [current];
    for (const source of ["staging", "backup"]) {
      const read = readKey(keys[source], operation);
      if (!read.ok) return { ok: false, operation, profileId, error: read.error };
      revisionCopies.push(read);
    }
    for (const copy of revisionCopies) {
      if (copy.value === null) continue;
      const decoded = decodeRecord(copy.value, profileId);
      if (decoded.valid && decoded.metadata.revision) {
        highestRevision = Math.max(highestRevision, decoded.metadata.revision);
      }
    }
    if (highestRevision >= Number.MAX_SAFE_INTEGER) {
      return {
        ok: false,
        operation,
        profileId,
        error: errorDetail(
          "STORAGE_REVISION_EXHAUSTED",
          "This profile cannot allocate another safe write revision.",
        ),
      };
    }
    revision = highestRevision + 1;
    raw = encodeRecord({
      profileId,
      save,
      savedAt,
      saveKind,
      checkpointId,
      revision,
    });

    let backupCreated = false;
    if (current.value !== null && decodeRecord(current.value, profileId).valid) {
      const backup = writeKey(keys.backup, current.value, operation);
      if (!backup.ok) return { ok: false, operation, profileId, error: backup.error };
      const backupVerification = readKey(keys.backup, operation);
      if (!backupVerification.ok || backupVerification.value !== current.value) {
        return {
          ok: false,
          operation,
          profileId,
          error: backupVerification.ok
            ? errorDetail(
                "STORAGE_BACKUP_VERIFICATION_FAILED",
                "The prior save could not be verified in backup; the primary was not replaced.",
                { retryable: true },
              )
            : backupVerification.error,
        };
      }
      backupCreated = true;
    }

    const staged = writeKey(keys.staging, raw, operation);
    if (!staged.ok) return { ok: false, operation, profileId, error: staged.error };

    const stagedVerification = readKey(keys.staging, operation);
    if (!stagedVerification.ok || stagedVerification.value !== raw) {
      return {
        ok: false,
        operation,
        profileId,
        error: stagedVerification.ok
          ? errorDetail(
              "STORAGE_STAGING_VERIFICATION_FAILED",
              "The recoverable staging copy could not be verified; the primary was not replaced.",
              { retryable: true },
            )
          : stagedVerification.error,
      };
    }

    const primary = writeKey(keys.primary, raw, operation);
    if (!primary.ok) {
      return {
        ok: false,
        operation,
        profileId,
        error: primary.error,
        recovery: {
          needed: true,
          available: true,
          source: "staging",
          action: "retry-save-or-load-staging-copy",
        },
      };
    }

    const verified = readKey(keys.primary, operation);
    if (!verified.ok || verified.value !== raw) {
      return {
        ok: false,
        operation,
        profileId,
        error: verified.ok
          ? errorDetail("STORAGE_VERIFICATION_FAILED", "Saved profile could not be verified.", { retryable: true })
          : verified.error,
        recovery: {
          needed: true,
          available: true,
          source: "staging",
          action: "retry-save-or-load-staging-copy",
        },
      };
    }

    const cleanup = removeKey(keys.staging, operation);
    const warnings = cleanup.ok ? [] : [cleanup.error];
    const loaded = {
      ok: true,
      operation: "load-profile",
      profileId,
      status: "ready",
      source: "primary",
      save,
      metadata: {
        savedAt,
        revision,
        saveKind,
        checkpointId,
        bareSave: false,
        sourceSchemaVersion: ADVENTURE_SAVE_SCHEMA_VERSION,
        migratedFromSchemaVersion: null,
        needsRewrite: false,
      },
      hasStoredData: true,
      issues: [],
      recovery: null,
    };
    return {
      ok: true,
      operation,
      profileId,
      save,
      savedAt,
      revision,
      saveKind,
      checkpointId,
      backupCreated,
      warnings,
      summary: summaryFromLoad(profileId, loaded),
    };
  }

  function manualSave(profileId, save) {
    return persist(profileId, save, "manual");
  }

  function autosave(profileId, save, checkpointId) {
    return persist(profileId, save, "autosave", checkpointId);
  }

  function listProfileSummaries() {
    const loads = ADVENTURE_PROFILE_IDS.map(loadProfile);
    return {
      ok: loads.every((result) => result.ok),
      operation: "list-profile-summaries",
      profiles: loads.map((result) => result.summary),
      issues: loads.flatMap((result) => result.issues ?? []),
    };
  }

  function startNewProfile(
    profileId,
    { overwriteConfirmed = false, saveValue = null } = {},
  ) {
    const operation = "new-game";
    if (!PROFILE_ID_SET.has(profileId)) return invalidProfileResult(operation, profileId);
    const existing = loadProfile(profileId);
    if (!existing.ok && existing.status === "unavailable") {
      return {
        ok: false,
        operation,
        profileId,
        error: existing.error,
        recovery: existing.recovery,
      };
    }
    if (existing.hasStoredData && !overwriteConfirmed) {
      return {
        ok: false,
        operation,
        profileId,
        error: errorDetail("OVERWRITE_CONFIRMATION_REQUIRED", "Starting a new game would overwrite this profile."),
        existingSummary: existing.summary,
      };
    }
    return persist(
      profileId,
      saveValue ?? createInitialAdventureSave(profileId),
      "new-game",
    );
  }

  function deleteProfile(profileId, { confirmed = false } = {}) {
    const operation = "delete-profile";
    if (!PROFILE_ID_SET.has(profileId)) return invalidProfileResult(operation, profileId);
    if (!confirmed) {
      return {
        ok: false,
        operation,
        profileId,
        error: errorDetail("DELETE_CONFIRMATION_REQUIRED", "Deleting a profile requires confirmation."),
      };
    }

    const errors = [];
    for (const key of Object.values(ADVENTURE_PROFILE_STORAGE_KEYS[profileId])) {
      const result = removeKey(key, operation);
      if (!result.ok) errors.push(result.error);
    }
    if (errors.length > 0) {
      return {
        ok: false,
        operation,
        profileId,
        error: errors[0],
        errors,
        recovery: { needed: true, available: false, action: "retry-delete" },
      };
    }
    return { ok: true, operation, profileId };
  }

  function migrateLegacyProfile(profileId, { overwriteConfirmed = false } = {}) {
    const operation = "migrate-legacy-profile";
    if (!PROFILE_ID_SET.has(profileId)) return invalidProfileResult(operation, profileId);

    const legacyRead = readKey(LEGACY_ADVENTURE_PROGRESS_KEY, operation);
    if (!legacyRead.ok) return { ok: false, operation, profileId, error: legacyRead.error };
    if (legacyRead.value === null) {
      return { ok: true, operation, profileId, migrated: false, status: "not-found" };
    }

    const existing = loadProfile(profileId);
    if (!existing.ok && existing.status === "unavailable") {
      return {
        ok: false,
        operation,
        profileId,
        migrated: false,
        error: existing.error,
        recovery: existing.recovery,
      };
    }
    if (existing.hasStoredData && !overwriteConfirmed) {
      return {
        ok: false,
        operation,
        profileId,
        migrated: false,
        error: errorDetail(
          "OVERWRITE_CONFIRMATION_REQUIRED",
          "Importing legacy progress would overwrite this profile.",
        ),
        existingSummary: existing.summary,
      };
    }

    let legacy;
    try {
      legacy = JSON.parse(legacyRead.value);
    } catch (error) {
      return {
        ok: false,
        operation,
        profileId,
        migrated: false,
        status: "invalid-legacy",
        error: errorDetail("MALFORMED_LEGACY_DATA", "Legacy progress is not valid JSON.", { cause: error }),
        recovery: {
          needed: true,
          available: false,
          action: "keep-legacy-data-and-start-new-profile",
        },
      };
    }

    let migrated;
    try {
      migrated = legacy?.schemaVersion === ADVENTURE_SAVE_SCHEMA_VERSION
        ? normalizeAdventureSave({ ...legacy, profileId })
        : migrateAdventureSave(legacy, { profileId });
    } catch (error) {
      return {
        ok: false,
        operation,
        profileId,
        migrated: false,
        status: "invalid-legacy",
        error: errorDetail("INVALID_LEGACY_DATA", error?.message ?? "Legacy progress could not be migrated.", {
          cause: error,
        }),
        recovery: {
          needed: true,
          available: false,
          action: "keep-legacy-data-and-start-new-profile",
        },
      };
    }

    const written = persist(profileId, migrated, "migration");
    if (!written.ok) return { ...written, operation, migrated: false };

    const cleanup = removeKey(LEGACY_ADVENTURE_PROGRESS_KEY, operation);
    return {
      ...written,
      operation,
      migrated: true,
      status: "migrated",
      warnings: [...written.warnings, ...(cleanup.ok ? [] : [cleanup.error])],
    };
  }

  return Object.freeze({
    loadProfile,
    listProfileSummaries,
    manualSave,
    autosave,
    startNewProfile,
    deleteProfile,
    migrateLegacyProfile,
  });
}

function readRootStorageKey(backend, key, operation) {
  try {
    const value = backend.getItem(key);
    if (value !== null && typeof value !== "string") {
      return {
        ok: false,
        error: errorDetail(
          "STORAGE_READ_FAILED",
          `${operation} received a non-string value from local storage.`,
          { retryable: true },
        ),
      };
    }
    return { ok: true, value };
  } catch (error) {
    return {
      ok: false,
      error: errorDetail(
        "STORAGE_READ_FAILED",
        `${operation} could not read local storage.`,
        { retryable: true, cause: error },
      ),
    };
  }
}

function decodeUnscopedClaim(raw) {
  if (raw === null) return { ok: true, claim: null };

  try {
    const parsed = JSON.parse(raw);
    if (
      parsed?.format !== UNSCOPED_CLAIM_FORMAT
      || parsed?.storageVersion !== UNSCOPED_CLAIM_FORMAT_VERSION
    ) {
      throw new TypeError("Unscoped save claim uses an unsupported format.");
    }
    const accountId = normalizeAdventureAccountId(parsed.accountId);
    if (
      typeof parsed.claimedAt !== "string"
      || !Number.isFinite(Date.parse(parsed.claimedAt))
    ) {
      throw new TypeError("Unscoped save claim has an invalid timestamp.");
    }
    return {
      ok: true,
      claim: Object.freeze({
        accountId,
        claimedAt: new Date(parsed.claimedAt).toISOString(),
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: errorDetail(
        "INVALID_UNSCOPED_SAVE_CLAIM",
        "The unscoped save claim marker is malformed or unsupported.",
        { cause: error },
      ),
    };
  }
}

function decodeLegacyProgressForCopy(raw) {
  if (raw === null) {
    return { present: false, valid: false, save: null, error: null };
  }

  try {
    const parsed = JSON.parse(raw);
    const save = parsed?.schemaVersion === ADVENTURE_SAVE_SCHEMA_VERSION
      ? normalizeAdventureSave({ ...parsed, profileId: "profile-1" })
      : migrateAdventureSave(parsed, { profileId: "profile-1" });
    return { present: true, valid: true, save, error: null };
  } catch (error) {
    return {
      present: true,
      valid: false,
      save: null,
      error: errorDetail(
        "INVALID_LEGACY_DATA",
        "Legacy adventure progress could not be validated for copying.",
        { cause: error },
      ),
    };
  }
}

/**
 * Inspects only the original root-level save keys. It never reads an
 * account-scoped namespace and never mutates either source or destination.
 */
export function inspectUnscopedAdventureSaves({ backend, accountId = null } = {}) {
  const operation = "inspect-unscoped-adventure-saves";
  assertStorageBackend(backend, "Unscoped adventure save inspection");
  const normalizedAccountId = accountId === null
    ? null
    : normalizeAdventureAccountId(accountId);
  const adapter = createAdventureStorageAdapter({ backend });
  const loads = ADVENTURE_PROFILE_IDS.map((profileId) => adapter.loadProfile(profileId));
  const unavailable = loads.find((result) => result.status === "unavailable");

  const legacyRead = readRootStorageKey(
    backend,
    LEGACY_ADVENTURE_PROGRESS_KEY,
    operation,
  );
  const claimRead = readRootStorageKey(
    backend,
    ADVENTURE_UNSCOPED_SAVE_CLAIM_KEY,
    operation,
  );
  if (!legacyRead.ok || !claimRead.ok || unavailable) {
    return {
      ok: false,
      operation,
      error: legacyRead.error
        ?? claimRead.error
        ?? unavailable.error
        ?? errorDetail("STORAGE_READ_FAILED", "Unscoped saves could not be inspected.", {
          retryable: true,
        }),
    };
  }

  const decodedClaim = decodeUnscopedClaim(claimRead.value);
  if (!decodedClaim.ok) {
    return { ok: false, operation, error: decodedClaim.error };
  }

  const legacy = decodeLegacyProgressForCopy(legacyRead.value);
  const profiles = loads.map((result) => result.summary);
  const importableProfileIds = loads
    .filter((result) => result.ok && result.save)
    .map((result) => result.profileId);
  const claim = decodedClaim.claim
    ? {
        ...decodedClaim.claim,
        matchesAccount: normalizedAccountId === null
          ? null
          : decodedClaim.claim.accountId === normalizedAccountId,
      }
    : null;

  return {
    ok: true,
    operation,
    hasUnscopedSaves: loads.some((result) => result.hasStoredData) || legacy.present,
    hasImportableSaves: importableProfileIds.length > 0 || legacy.valid,
    importableProfileIds,
    profiles,
    profileIssues: loads.flatMap((result) => result.issues ?? []),
    legacy: {
      present: legacy.present,
      valid: legacy.valid,
      error: legacy.error,
    },
    claim,
  };
}

/**
 * Places a root-level, write-once ownership marker before legacy data can be
 * copied. Repeating the claim for the same account is idempotent; a different
 * account is refused. Source save keys are never changed or removed.
 */
export function claimUnscopedAdventureSaves({
  backend,
  accountId,
  now = () => new Date(),
} = {}) {
  const operation = "claim-unscoped-adventure-saves";
  assertStorageBackend(backend, "Unscoped adventure save claim");
  const normalizedAccountId = normalizeAdventureAccountId(accountId);
  if (typeof now !== "function") {
    throw new TypeError("Unscoped adventure save claim now must be a function.");
  }

  const inspection = inspectUnscopedAdventureSaves({
    backend,
    accountId: normalizedAccountId,
  });
  if (!inspection.ok) return { ...inspection, operation };
  if (inspection.claim) {
    if (inspection.claim.matchesAccount) {
      return {
        ok: true,
        operation,
        accountId: normalizedAccountId,
        claimedAt: inspection.claim.claimedAt,
        alreadyClaimed: true,
      };
    }
    return {
      ok: false,
      operation,
      accountId: normalizedAccountId,
      error: errorDetail(
        "UNSCOPED_SAVES_ALREADY_CLAIMED",
        "These unscoped adventure saves were already claimed by another account.",
      ),
    };
  }
  if (!inspection.hasImportableSaves) {
    return {
      ok: false,
      operation,
      accountId: normalizedAccountId,
      error: errorDetail(
        "NO_IMPORTABLE_UNSCOPED_SAVES",
        "No valid unscoped adventure saves are available to claim.",
      ),
    };
  }

  let claimedAt;
  try {
    claimedAt = timestampFrom(now);
  } catch (error) {
    return {
      ok: false,
      operation,
      accountId: normalizedAccountId,
      error: errorDetail(
        "INVALID_CLAIM_TIMESTAMP",
        "The unscoped save claim timestamp is invalid.",
        { cause: error },
      ),
    };
  }
  const raw = JSON.stringify({
    format: UNSCOPED_CLAIM_FORMAT,
    storageVersion: UNSCOPED_CLAIM_FORMAT_VERSION,
    accountId: normalizedAccountId,
    claimedAt,
  });

  try {
    backend.setItem(ADVENTURE_UNSCOPED_SAVE_CLAIM_KEY, raw);
  } catch (error) {
    return {
      ok: false,
      operation,
      accountId: normalizedAccountId,
      error: errorDetail(
        "STORAGE_WRITE_FAILED",
        "The unscoped save claim marker could not be written.",
        { retryable: true, cause: error },
      ),
    };
  }

  const verification = readRootStorageKey(
    backend,
    ADVENTURE_UNSCOPED_SAVE_CLAIM_KEY,
    operation,
  );
  if (!verification.ok || verification.value !== raw) {
    return {
      ok: false,
      operation,
      accountId: normalizedAccountId,
      error: verification.error
        ?? errorDetail(
          "STORAGE_VERIFICATION_FAILED",
          "The unscoped save claim marker could not be verified.",
          { retryable: true },
        ),
    };
  }

  return {
    ok: true,
    operation,
    accountId: normalizedAccountId,
    claimedAt,
    alreadyClaimed: false,
  };
}

function savesMatch(left, right) {
  return JSON.stringify(normalizeAdventureSave(left))
    === JSON.stringify(normalizeAdventureSave(right));
}

/**
 * Copies every recoverable root-level profile into an empty account namespace.
 * A valid claim for that account is mandatory. Existing differing destination
 * data aborts the whole preflight, and root-level source data is never changed.
 */
export function copyUnscopedAdventureSavesToAccount({ backend, accountId } = {}) {
  const operation = "copy-unscoped-adventure-saves";
  assertStorageBackend(backend, "Unscoped adventure save copy");
  const normalizedAccountId = normalizeAdventureAccountId(accountId);
  const inspection = inspectUnscopedAdventureSaves({
    backend,
    accountId: normalizedAccountId,
  });
  if (!inspection.ok) return { ...inspection, operation };
  if (!inspection.claim) {
    return {
      ok: false,
      operation,
      accountId: normalizedAccountId,
      error: errorDetail(
        "UNSCOPED_SAVE_CLAIM_REQUIRED",
        "Unscoped saves must be explicitly claimed before they can be copied.",
      ),
    };
  }
  if (!inspection.claim.matchesAccount) {
    return {
      ok: false,
      operation,
      accountId: normalizedAccountId,
      error: errorDetail(
        "UNSCOPED_SAVES_ALREADY_CLAIMED",
        "These unscoped adventure saves belong to another account claim.",
      ),
    };
  }

  const sourceAdapter = createAdventureStorageAdapter({ backend });
  const candidates = [];
  for (const profileId of ADVENTURE_PROFILE_IDS) {
    const loaded = sourceAdapter.loadProfile(profileId);
    if (loaded.ok && loaded.save) {
      candidates.push({ profileId, save: loaded.save, source: loaded.source });
    }
  }

  if (!candidates.some((candidate) => candidate.profileId === "profile-1")) {
    const legacyRead = readRootStorageKey(
      backend,
      LEGACY_ADVENTURE_PROGRESS_KEY,
      operation,
    );
    if (!legacyRead.ok) {
      return {
        ok: false,
        operation,
        accountId: normalizedAccountId,
        error: legacyRead.error,
      };
    }
    const legacy = decodeLegacyProgressForCopy(legacyRead.value);
    if (legacy.valid) {
      candidates.push({
        profileId: "profile-1",
        save: legacy.save,
        source: "legacy-progress",
      });
    }
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      operation,
      accountId: normalizedAccountId,
      error: errorDetail(
        "NO_IMPORTABLE_UNSCOPED_SAVES",
        "No valid unscoped adventure saves are available to copy.",
      ),
    };
  }

  const scopedBackend = createAccountScopedAdventureStorage({
    backend,
    accountId: normalizedAccountId,
  });
  const targetAdapter = createAdventureStorageAdapter({ backend: scopedBackend });
  const alreadyPresentProfileIds = [];
  const conflicts = [];
  const pending = [];

  for (const candidate of candidates) {
    const target = targetAdapter.loadProfile(candidate.profileId);
    if (target.ok && target.save && savesMatch(target.save, candidate.save)) {
      alreadyPresentProfileIds.push(candidate.profileId);
      continue;
    }
    if (target.hasStoredData) {
      conflicts.push(candidate.profileId);
      continue;
    }
    if (!target.ok) {
      return {
        ok: false,
        operation,
        accountId: normalizedAccountId,
        error: target.error,
      };
    }
    pending.push(candidate);
  }

  if (conflicts.length > 0) {
    return {
      ok: false,
      operation,
      accountId: normalizedAccountId,
      copiedProfileIds: [],
      alreadyPresentProfileIds,
      conflictingProfileIds: conflicts,
      error: errorDetail(
        "ACCOUNT_SCOPED_SAVE_CONFLICT",
        "Account-scoped adventure saves already occupy one or more legacy slots; no saves were copied.",
      ),
    };
  }

  const copiedProfileIds = [];
  for (const candidate of pending) {
    const copied = targetAdapter.manualSave(candidate.profileId, candidate.save);
    if (!copied.ok) {
      return {
        ok: false,
        operation,
        accountId: normalizedAccountId,
        copiedProfileIds,
        alreadyPresentProfileIds,
        error: copied.error,
      };
    }
    copiedProfileIds.push(candidate.profileId);
  }

  return {
    ok: true,
    operation,
    accountId: normalizedAccountId,
    copiedProfileIds,
    alreadyPresentProfileIds,
    sources: Object.fromEntries(
      candidates.map((candidate) => [candidate.profileId, candidate.source]),
    ),
    sourcePreserved: true,
  };
}
