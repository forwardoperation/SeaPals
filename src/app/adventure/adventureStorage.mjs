import {
  ADVENTURE_SAVE_SCHEMA_VERSION,
  createInitialAdventureSave,
  migrateAdventureSave,
  normalizeAdventureSave,
} from "./adventureProgression.mjs";

export const ADVENTURE_PROFILE_IDS = Object.freeze([
  "profile-1",
  "profile-2",
  "profile-3",
]);

export const ADVENTURE_PROFILE_COUNT = ADVENTURE_PROFILE_IDS.length;
export const ADVENTURE_STORAGE_FORMAT_VERSION = 1;
export const ADVENTURE_STORAGE_KEY_PREFIX = "seapals-reefbound-saves-v1";
export const LEGACY_ADVENTURE_PROGRESS_KEY = "seapals-reefbound-progress-v1";

const PROFILE_ID_SET = new Set(ADVENTURE_PROFILE_IDS);
const SAVE_KINDS = new Set(["manual", "autosave", "migration", "new-game"]);
const RECORD_FORMAT = "seapals-adventure-profile";
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
const CANONICAL_SAVE_REQUIRED_PATHS = Object.freeze([
  ...CANONICAL_SAVE_V1_REQUIRED_PATHS,
  ["world", "completedRouteIds"],
  ["progression", "encounterResults"],
]);

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
    const canonicalPaths = parsed.save.schemaVersion === ADVENTURE_SAVE_SCHEMA_VERSION
      ? CANONICAL_SAVE_REQUIRED_PATHS
      : parsed.save.schemaVersion === 1
        ? CANONICAL_SAVE_V1_REQUIRED_PATHS
        : null;
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
      metadata: { savedAt, revision, saveKind, checkpointId, bareSave: false },
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
