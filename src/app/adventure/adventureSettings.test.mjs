import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ADVENTURE_TEXT_SPEEDS,
  DEFAULT_ADVENTURE_SETTINGS,
  normalizeAdventureSettings,
  updateAdventureSettings,
} from "./adventureSettings.mjs";
import { createInitialAdventureSave } from "./adventureProgression.mjs";

test("adventure settings use the four schema-backed defaults", () => {
  assert.deepEqual(ADVENTURE_TEXT_SPEEDS, ["slow", "normal", "fast", "instant"]);
  assert.deepEqual(DEFAULT_ADVENTURE_SETTINGS, {
    textSpeed: "normal",
    reducedMotion: false,
    highContrast: false,
    boatAutoSteer: false,
  });
  assert.deepEqual(normalizeAdventureSettings(null), DEFAULT_ADVENTURE_SETTINGS);
});

test("stored settings normalize malformed values and remove unsupported fields", () => {
  const normalized = normalizeAdventureSettings({
    textSpeed: "warp",
    reducedMotion: "yes",
    highContrast: true,
    boatAutoSteer: false,
    audioVolume: 0.5,
  });

  assert.deepEqual(normalized, {
    textSpeed: "normal",
    reducedMotion: false,
    highContrast: true,
    boatAutoSteer: false,
  });
});

test("a partial settings update is immutable and preserves the rest of the save", () => {
  const save = createInitialAdventureSave("settings-profile");
  const originalWorld = save.world;
  const originalSettings = save.settings;
  const result = updateAdventureSettings(save, {
    textSpeed: "fast",
    reducedMotion: true,
  });

  assert.equal(result.applied, true);
  assert.deepEqual(result.changedKeys, ["textSpeed", "reducedMotion"]);
  assert.deepEqual(result.settings, {
    textSpeed: "fast",
    reducedMotion: true,
    highContrast: false,
    boatAutoSteer: false,
  });
  assert.notEqual(result.save, save);
  assert.notEqual(result.save.settings, originalSettings);
  assert.equal(result.save.world, originalWorld);
  assert.deepEqual(save.settings, DEFAULT_ADVENTURE_SETTINGS);
});

test("canonical no-op updates keep the original save reference", () => {
  const save = createInitialAdventureSave("settings-profile");
  const result = updateAdventureSettings(save, { textSpeed: "normal" });

  assert.equal(result.applied, false);
  assert.deepEqual(result.changedKeys, []);
  assert.equal(result.save, save);
});

test("an empty update repairs a noncanonical settings object without touching other state", () => {
  const save = createInitialAdventureSave("settings-profile");
  const interrupted = {
    ...save,
    settings: {
      textSpeed: "instant",
      reducedMotion: true,
      unsupported: true,
    },
  };
  const result = updateAdventureSettings(interrupted);

  assert.equal(result.applied, true);
  assert.deepEqual(result.changedKeys, []);
  assert.deepEqual(result.save.settings, {
    textSpeed: "instant",
    reducedMotion: true,
    highContrast: false,
    boatAutoSteer: false,
  });
  assert.equal(result.save.progression, interrupted.progression);
});

test("invalid or unsupported updates are rejected", () => {
  const save = createInitialAdventureSave("settings-profile");

  assert.throws(
    () => updateAdventureSettings(save, { textSpeed: "very-fast" }),
    /Unknown adventure text speed/,
  );
  assert.throws(
    () => updateAdventureSettings(save, { highContrast: 1 }),
    /highContrast must be true or false/,
  );
  assert.throws(
    () => updateAdventureSettings(save, { audioVolume: 0.5 }),
    /Unknown adventure setting: audioVolume/,
  );
  assert.throws(
    () => updateAdventureSettings(save, null),
    /updates must be an object/,
  );
});

test("settings modal includes a focus-trapped labelled dialog and generous controls", () => {
  const component = readFileSync(
    new URL("./AdventureSettingsModal.jsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(
    new URL("./AdventureSettingsModal.module.css", import.meta.url),
    "utf8",
  );

  assert.match(component, /role="dialog"/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /aria-labelledby=\{titleId\}/);
  assert.match(component, /data-adventure-modal="true"/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /event\.key !== "Tab"/);
  assert.match(component, /Dialogue reading pace/);
  assert.match(component, /First voyages still require steering/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
