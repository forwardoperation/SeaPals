import assert from "node:assert/strict";
import test from "node:test";
import { createInitialAdventureSave } from "./adventureProgression.mjs";
import {
  ADVENTURE_PROFILE_STORAGE_KEYS,
  ADVENTURE_UNSCOPED_SAVE_CLAIM_KEY,
  LEGACY_ADVENTURE_PROGRESS_KEY,
  claimUnscopedAdventureSaves,
  copyUnscopedAdventureSavesToAccount,
  createAccountScopedAdventureStorage,
  createAdventureStorageAdapter,
  getAccountScopedAdventureStorageKey,
  inspectUnscopedAdventureSaves,
} from "./adventureStorage.mjs";

const ACCOUNT_A = "1d4eff4c-8f50-4c58-b671-f3881d72eb2d";
const ACCOUNT_B = "767c5743-f397-48d3-a528-e8d10c7b8188";

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

function adapterFor(backend, now = () => "2026-07-29T12:00:00.000Z") {
  return createAdventureStorageAdapter({ backend, now });
}

function accountAdapter(backend, accountId) {
  return adapterFor(createAccountScopedAdventureStorage({ backend, accountId }));
}

function saveAt(profileId, playtimeSeconds) {
  const save = createInitialAdventureSave(profileId);
  save.playtimeSeconds = playtimeSeconds;
  return save;
}

function snapshotUnscopedProfileKeys(backend) {
  return Object.fromEntries(
    Object.values(ADVENTURE_PROFILE_STORAGE_KEYS)
      .flatMap((keys) => Object.values(keys))
      .map((key) => [key, backend.getItem(key)]),
  );
}

test("account-scoped storage validates account IDs and isolates identical logical save keys", () => {
  const backend = new MemoryStorage();
  const first = accountAdapter(backend, ACCOUNT_A);
  const second = accountAdapter(backend, ACCOUNT_B);

  assert.equal(first.manualSave("profile-1", saveAt("profile-1", 41)).ok, true);
  assert.equal(first.loadProfile("profile-1").save.playtimeSeconds, 41);
  assert.equal(second.loadProfile("profile-1").status, "empty");
  assert.equal(
    backend.getItem(ADVENTURE_PROFILE_STORAGE_KEYS["profile-1"].primary),
    null,
  );

  const physicalKey = getAccountScopedAdventureStorageKey(
    ACCOUNT_A,
    ADVENTURE_PROFILE_STORAGE_KEYS["profile-1"].primary,
  );
  assert.notEqual(backend.getItem(physicalKey), null);
  assert.match(physicalKey, new RegExp(ACCOUNT_A));

  assert.throws(
    () => createAccountScopedAdventureStorage({ backend, accountId: ` ${ACCOUNT_A}` }),
    /surrounding whitespace/,
  );
  assert.throws(
    () => createAccountScopedAdventureStorage({ backend, accountId: "account/with/slashes" }),
    /1-128 characters/,
  );
  assert.throws(
    () => createAccountScopedAdventureStorage({ backend: {}, accountId: ACCOUNT_A }),
    /localStorage-like backend/,
  );
});

test("unscoped inspection detects fixed profiles and legacy progress without seeing scoped saves", () => {
  const backend = new MemoryStorage({
    [LEGACY_ADVENTURE_PROGRESS_KEY]: JSON.stringify({ defeated: ["marina"] }),
  });
  const root = adapterFor(backend);
  const scoped = accountAdapter(backend, ACCOUNT_A);
  assert.equal(root.manualSave("profile-2", saveAt("profile-2", 22)).ok, true);
  assert.equal(scoped.manualSave("profile-3", saveAt("profile-3", 33)).ok, true);

  const inspection = inspectUnscopedAdventureSaves({
    backend,
    accountId: ACCOUNT_A,
  });
  assert.equal(inspection.ok, true);
  assert.equal(inspection.hasUnscopedSaves, true);
  assert.equal(inspection.hasImportableSaves, true);
  assert.deepEqual(inspection.importableProfileIds, ["profile-2"]);
  assert.equal(inspection.profiles[1].playtimeSeconds, 22);
  assert.equal(inspection.profiles[2].status, "empty");
  assert.deepEqual(inspection.legacy, {
    present: true,
    valid: true,
    error: null,
  });
  assert.equal(inspection.claim, null);
});

test("the root claim marker is idempotent for one account and rejects every other account", () => {
  const backend = new MemoryStorage();
  const root = adapterFor(backend);
  assert.equal(root.manualSave("profile-1", saveAt("profile-1", 15)).ok, true);
  const before = snapshotUnscopedProfileKeys(backend);

  const claimed = claimUnscopedAdventureSaves({
    backend,
    accountId: ACCOUNT_A,
    now: () => "2026-07-29T14:30:00.000Z",
  });
  assert.equal(claimed.ok, true);
  assert.equal(claimed.alreadyClaimed, false);
  assert.equal(claimed.claimedAt, "2026-07-29T14:30:00.000Z");
  assert.notEqual(backend.getItem(ADVENTURE_UNSCOPED_SAVE_CLAIM_KEY), null);
  assert.deepEqual(snapshotUnscopedProfileKeys(backend), before);

  const repeated = claimUnscopedAdventureSaves({
    backend,
    accountId: ACCOUNT_A,
    now: () => "2030-01-01T00:00:00.000Z",
  });
  assert.equal(repeated.ok, true);
  assert.equal(repeated.alreadyClaimed, true);
  assert.equal(repeated.claimedAt, claimed.claimedAt);

  const refused = claimUnscopedAdventureSaves({
    backend,
    accountId: ACCOUNT_B,
  });
  assert.equal(refused.ok, false);
  assert.equal(refused.error.code, "UNSCOPED_SAVES_ALREADY_CLAIMED");

  const inspection = inspectUnscopedAdventureSaves({
    backend,
    accountId: ACCOUNT_B,
  });
  assert.equal(inspection.claim.matchesAccount, false);
  assert.equal(inspection.claim.accountId, ACCOUNT_A);
});

test("copy requires the matching claim, preserves every unscoped record, and is retry-safe", () => {
  const backend = new MemoryStorage();
  const root = adapterFor(backend);
  assert.equal(root.manualSave("profile-1", saveAt("profile-1", 10)).ok, true);
  assert.equal(root.autosave("profile-1", saveAt("profile-1", 20), "legacy-latest").ok, true);
  assert.equal(root.manualSave("profile-3", saveAt("profile-3", 30)).ok, true);

  const beforeClaim = copyUnscopedAdventureSavesToAccount({
    backend,
    accountId: ACCOUNT_A,
  });
  assert.equal(beforeClaim.ok, false);
  assert.equal(beforeClaim.error.code, "UNSCOPED_SAVE_CLAIM_REQUIRED");

  assert.equal(claimUnscopedAdventureSaves({ backend, accountId: ACCOUNT_A }).ok, true);
  const sourceSnapshot = snapshotUnscopedProfileKeys(backend);
  const copied = copyUnscopedAdventureSavesToAccount({
    backend,
    accountId: ACCOUNT_A,
  });
  assert.equal(copied.ok, true);
  assert.deepEqual(copied.copiedProfileIds, ["profile-1", "profile-3"]);
  assert.deepEqual(copied.alreadyPresentProfileIds, []);
  assert.equal(copied.sourcePreserved, true);
  assert.deepEqual(snapshotUnscopedProfileKeys(backend), sourceSnapshot);

  const target = accountAdapter(backend, ACCOUNT_A);
  assert.equal(target.loadProfile("profile-1").save.playtimeSeconds, 20);
  assert.equal(target.loadProfile("profile-2").status, "empty");
  assert.equal(target.loadProfile("profile-3").save.playtimeSeconds, 30);

  const retry = copyUnscopedAdventureSavesToAccount({
    backend,
    accountId: ACCOUNT_A,
  });
  assert.equal(retry.ok, true);
  assert.deepEqual(retry.copiedProfileIds, []);
  assert.deepEqual(retry.alreadyPresentProfileIds, ["profile-1", "profile-3"]);

  const otherAccount = copyUnscopedAdventureSavesToAccount({
    backend,
    accountId: ACCOUNT_B,
  });
  assert.equal(otherAccount.ok, false);
  assert.equal(otherAccount.error.code, "UNSCOPED_SAVES_ALREADY_CLAIMED");
});

test("copy preflight never overwrites a differing scoped save or partially fills other slots", () => {
  const backend = new MemoryStorage();
  const root = adapterFor(backend);
  assert.equal(root.manualSave("profile-1", saveAt("profile-1", 11)).ok, true);
  assert.equal(root.manualSave("profile-2", saveAt("profile-2", 22)).ok, true);
  assert.equal(
    accountAdapter(backend, ACCOUNT_A).manualSave(
      "profile-2",
      saveAt("profile-2", 999),
    ).ok,
    true,
  );
  assert.equal(claimUnscopedAdventureSaves({ backend, accountId: ACCOUNT_A }).ok, true);

  const result = copyUnscopedAdventureSavesToAccount({
    backend,
    accountId: ACCOUNT_A,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "ACCOUNT_SCOPED_SAVE_CONFLICT");
  assert.deepEqual(result.conflictingProfileIds, ["profile-2"]);

  const target = accountAdapter(backend, ACCOUNT_A);
  assert.equal(target.loadProfile("profile-1").status, "empty");
  assert.equal(target.loadProfile("profile-2").save.playtimeSeconds, 999);
  assert.equal(root.loadProfile("profile-1").save.playtimeSeconds, 11);
  assert.equal(root.loadProfile("profile-2").save.playtimeSeconds, 22);
});

test("prototype legacy progress copies into scoped profile 1 without deleting its root key", () => {
  const rawLegacy = JSON.stringify({
    defeated: ["marina", "dorian", "marina"],
  });
  const backend = new MemoryStorage({
    [LEGACY_ADVENTURE_PROGRESS_KEY]: rawLegacy,
  });
  assert.equal(claimUnscopedAdventureSaves({ backend, accountId: ACCOUNT_A }).ok, true);

  const copied = copyUnscopedAdventureSavesToAccount({
    backend,
    accountId: ACCOUNT_A,
  });
  assert.equal(copied.ok, true);
  assert.deepEqual(copied.copiedProfileIds, ["profile-1"]);
  assert.equal(copied.sources["profile-1"], "legacy-progress");
  assert.equal(backend.getItem(LEGACY_ADVENTURE_PROGRESS_KEY), rawLegacy);

  const loaded = accountAdapter(backend, ACCOUNT_A).loadProfile("profile-1");
  assert.deepEqual(loaded.save.progression.completedEncounterIds, [
    "encounter-shellshore-marina",
    "encounter-shellshore-dorian",
  ]);
});

test("missing valid data and malformed claim markers fail closed", () => {
  const empty = new MemoryStorage();
  const noData = claimUnscopedAdventureSaves({
    backend: empty,
    accountId: ACCOUNT_A,
  });
  assert.equal(noData.ok, false);
  assert.equal(noData.error.code, "NO_IMPORTABLE_UNSCOPED_SAVES");

  const malformed = new MemoryStorage({
    [LEGACY_ADVENTURE_PROGRESS_KEY]: JSON.stringify({ defeated: ["marina"] }),
    [ADVENTURE_UNSCOPED_SAVE_CLAIM_KEY]: "{broken",
  });
  const inspection = inspectUnscopedAdventureSaves({
    backend: malformed,
    accountId: ACCOUNT_A,
  });
  assert.equal(inspection.ok, false);
  assert.equal(inspection.error.code, "INVALID_UNSCOPED_SAVE_CLAIM");
  assert.equal(
    claimUnscopedAdventureSaves({ backend: malformed, accountId: ACCOUNT_A }).ok,
    false,
  );
});
