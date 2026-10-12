import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ADVENTURE_LOCAL_PREVIEW_STORAGE_PREFIX,
  createAdventureLocalPreviewStorage,
  isAdventureLocalPreviewEnabled,
} from "./adventureLocalPreview.mjs";
import {
  ADVENTURE_PROFILE_STORAGE_KEYS,
  ADVENTURE_UNSCOPED_SAVE_CLAIM_KEY,
  LEGACY_ADVENTURE_PROGRESS_KEY,
  createAccountScopedAdventureStorage,
  createAdventureStorageAdapter,
} from "./adventureStorage.mjs";
import { createInitialAdventureSave } from "./adventureProgression.mjs";

test("local playtesting fails closed outside the development server", () => {
  for (const environment of ["production", "test", undefined, "staging", ""]) {
    assert.equal(isAdventureLocalPreviewEnabled(true, environment), false);
  }
  assert.equal(isAdventureLocalPreviewEnabled(false, "development"), false);
  assert.equal(isAdventureLocalPreviewEnabled("true", "development"), false);
  assert.equal(isAdventureLocalPreviewEnabled(true, "development"), true);
});

test("guest saves persist and delete without accessing account or legacy saves", () => {
  const values = new Map();
  const backend = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  const real = createAdventureStorageAdapter({ backend: createAccountScopedAdventureStorage({
    backend, accountId: "family-account",
  }) });
  assert.equal(real.startNewProfile("profile-1").ok, true);
  values.set(ADVENTURE_PROFILE_STORAGE_KEYS["profile-1"].primary, "existing unscoped save");
  values.set(LEGACY_ADVENTURE_PROGRESS_KEY, "existing legacy save");
  values.set(ADVENTURE_UNSCOPED_SAVE_CLAIM_KEY, "existing account claim");
  const original = new Map(values);
  // A stricter backing store makes accidental reads as well as writes fail.
  const calls = [];
  const isolatedBackend = Object.fromEntries(Object.entries(backend).map(([method, fn]) => [method, (key, ...args) => {
    assert.ok(key.startsWith(ADVENTURE_LOCAL_PREVIEW_STORAGE_PREFIX), `${method} reached ${key}`);
    calls.push({ method, key });
    return fn(key, ...args);
  }]));
  const preview = () => createAdventureStorageAdapter({ backend: createAdventureLocalPreviewStorage(isolatedBackend) });
  const first = preview();
  assert.equal(first.loadProfile("profile-1").status, "empty");
  const save = createInitialAdventureSave("profile-1");
  save.player.name = "Preview check";
  assert.equal(first.startNewProfile("profile-1", { saveValue: save }).ok, true);
  save.playtimeSeconds = 12;
  assert.equal(first.manualSave("profile-1", save).ok, true);
  assert.deepEqual(preview().loadProfile("profile-1").save, save);
  assert.equal(preview().deleteProfile("profile-1", { confirmed: true }).ok, true);
  assert.equal(preview().loadProfile("profile-1").status, "empty");
  for (const [key, value] of original) assert.equal(values.get(key), value, key);
  assert.ok(calls.some(({ method }) => method === "setItem"));
  assert.ok(calls.some(({ method }) => method === "removeItem"));
});

test("the guest entry uses the real game, disables remote sync, and cannot ship as an auth bypass", () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
  const route = read("../dev/reefbound/play/page.jsx");
  const entry = read("../dev/reefbound/play/ReefboundLocalPlaytest.jsx");
  const game = read("./AdventureGame.jsx");
  const accountRoute = read("./page.jsx");
  assert.ok(route.indexOf('process.env.NODE_ENV !== "development"') < route.indexOf("return <ReefboundLocalPlaytest"));
  assert.match(route, /notFound\(\)/);
  assert.match(entry, /<AdventureGame\b[\s\S]*localPreview/);
  assert.doesNotMatch(entry, /ReefboundPreview|createAdventureSave|fetch\(/);
  assert.match(game, /isAdventureLocalPreviewEnabled\(localPreview, process.env.NODE_ENV\)/);
  assert.match(game, /cloudClientRef.current = isLocalPreview \? null : createAdventureCloudSaveClient/);
  const sync = game.slice(game.indexOf("const initializeCloudSync ="), game.indexOf("cloudInitializeRef.current = initializeCloudSync"));
  assert.match(sync, /if \(isLocalPreview\) \{[\s\S]*cloudSyncReadyRef.current = false;[\s\S]*return;[\s\S]*await loadCloudRecords/);
  assert.match(game, /const unscoped = isLocalPreview \? \{ ok: true, hasImportableSaves: false \} : inspectUnscopedAdventureSaves/);
  assert.doesNotMatch(accountRoute, /localPreview|ReefboundLocalPlaytest/);
  assert.match(accountRoute, /!claims\?\.sub \|\| claims.role !== "authenticated"/);
});
