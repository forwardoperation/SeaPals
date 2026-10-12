import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  ADVENTURE_TOUCH_MEDIA_QUERY,
  getAdventureGraphicsProfile,
  isAdventureMobileDevice,
} from "./adventureGraphics.mjs";
import { createInitialAdventureSave, normalizeAdventureSave } from "./adventureProgression.mjs";
import { updateAdventureSettings } from "./adventureSettings.mjs";
import { createAdventureFrameGate } from "./adventurePerspective.mjs";
import { ELVERSON_TOWN_PORTALS } from "./adventureElversonTownLayout.mjs";
import { getDoorwayTransition, movePlayerContinuous } from "./adventureWorld.mjs";

function device(navigator, touchFirst = false, width = 390) {
  return { navigator, innerWidth: width, matchMedia: (query) => ({
    matches: query === ADVENTURE_TOUCH_MEDIA_QUERY && touchFirst,
  }) };
}

test("automatic graphics detects phones and tablets in either orientation", () => {
  const devices = [
    device({ userAgentData: { mobile: true } }),
    device({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", maxTouchPoints: 5 }),
    device({ userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel) Mobile", maxTouchPoints: 5 }),
    device({ userAgent: "Mozilla/5.0 (Linux; Android 15; Tablet)", userAgentData: { mobile: false } }),
    device({ userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)" }),
    device({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", platform: "MacIntel", maxTouchPoints: 5 }),
    device({ userAgent: "Privacy browser", maxTouchPoints: 5 }, true),
  ];
  for (const browser of devices) {
    for (const width of [390, 844, 1366]) {
      assert.equal(isAdventureMobileDevice({ ...browser, innerWidth: width }), true);
      const profile = getAdventureGraphicsProfile("auto", isAdventureMobileDevice(browser));
      assert.equal(profile.mode, "battery");
      assert.equal(profile.batterySaver, true);
      assert.equal(profile.worldFrameRate, 30);
    }
  }
});

test("desktop, a narrow desktop window, and a mouse-first touchscreen laptop keep full perspective", () => {
  for (const browser of [
    null, {}, device({ userAgent: "Windows NT 10.0", maxTouchPoints: 0 }),
    device({ userAgent: "Windows NT 10.0", maxTouchPoints: 10, userAgentData: { mobile: false } }),
    device({ userAgent: "Macintosh", platform: "MacIntel", maxTouchPoints: 0 }),
  ]) {
    assert.equal(isAdventureMobileDevice(browser), false);
    assert.equal(getAdventureGraphicsProfile(undefined, isAdventureMobileDevice(browser)).mode, "perspective");
  }
});

test("explicit graphics choices override detection and returning to auto restores it", () => {
  for (const mobile of [false, true]) {
    for (const mode of ["perspective", "battery", "classic"]) {
      const profile = getAdventureGraphicsProfile(mode, mobile);
      assert.equal(profile.mode, mode);
      assert.equal(profile.automatic, false);
      assert.equal(profile.worldFrameRate, mode === "battery" ? 30 : 60);
    }
    for (const preference of ["auto", undefined, "invalid"]) {
      const profile = getAdventureGraphicsProfile(preference, mobile);
      assert.equal(profile.mode, mobile ? "battery" : "perspective");
      assert.equal(profile.automatic, true);
    }
  }
});

test("device detection never persists into the save or changes gameplay domains", () => {
  const legacy = createInitialAdventureSave("graphics-compatibility");
  delete legacy.settings.graphicsMode;
  const save = normalizeAdventureSave(legacy);
  const before = structuredClone(save);
  assert.equal(save.settings.graphicsMode, "auto");
  for (const mode of ["auto", "perspective", "battery", "classic"]) {
    const updated = updateAdventureSettings(save, { graphicsMode: mode }).save;
    const restored = normalizeAdventureSave(JSON.parse(JSON.stringify(updated)));
    for (const mobile of [true, false, true]) getAdventureGraphicsProfile(restored.settings.graphicsMode, mobile);
    assert.deepEqual({ ...restored, settings: before.settings }, before);
    assert.equal(restored.settings.graphicsMode, mode);
    assert.deepEqual(Object.keys(restored.settings), Object.keys(before.settings));
  }
  assert.deepEqual(save, before);
});

test("30 and 60 fps modes retain every town doorway and the original walking stall limit", () => {
  for (const fps of [30, 60]) {
    const stalled = createAdventureFrameGate(fps, 50);
    stalled(0);
    assert.equal(stalled(1000), 50);
    for (const portal of ELVERSON_TOWN_PORTALS) {
      let position = { x: portal.doorway.x, y: portal.doorway.y + 0.6 };
      const gate = createAdventureFrameGate(fps, 50);
      let doorway;
      for (let frame = 0; frame <= 120 && !doorway; frame++) {
        const elapsed = gate(frame * 1000 / 120);
        if (!elapsed) continue;
        position = movePlayerContinuous("town", position, { x: 0, y: -1 }, elapsed, {
          speed: 3.6, radius: 0.22, maxStepDistance: 0.08, ignoreActorTiles: true,
        });
        doorway = getDoorwayTransition("town", position, "up");
      }
      assert.equal(doorway?.interactionId, portal.id, `${portal.id} at ${fps} fps`);
    }
  }
});

test("the authenticated full game owns graphics and retains its gameplay interfaces", () => {
  const game = readFileSync(new URL("./AdventureGame.jsx", import.meta.url), "utf8");
  const bridge = readFileSync(new URL("./AdventureAccountBridge.jsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("./page.jsx", import.meta.url), "utf8");
  assert.match(game, /useAdventureGraphics\(gameSave\?\.settings\?\.graphicsMode\)/);
  assert.match(bridge, /<AdventureGame\b/);
  assert.match(page, /<AdventureAccountBridge\b/);
  assert.doesNotMatch(game + bridge + page, /ReefboundPreview/);
  for (const component of ["Simulator", "AdventureHandNetModal", "AdventureBaitShopModal", "AdventureAquariumGallery", "AdventureDecksModal", "AdventureWorldMapModal", "PauseMenu"]) {
    assert.match(game, new RegExp(`<${component}\\b`));
  }
});
