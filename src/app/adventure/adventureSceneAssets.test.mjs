import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SCENES } from "./adventureWorld.mjs";
import {
  ADVENTURE_CHARACTER_SPRITE_ASSETS,
  collectAdventureSceneAssetPaths,
  createAdventureSceneAssetPreloader,
  getAdventureCharacterSpriteAssetPath,
  getAdventureInteriorDestinationSceneIds,
} from "./adventureSceneAssets.mjs";

const styles = readFileSync(new URL("./adventure.module.css", import.meta.url), "utf8");

test("scene asset collection includes ground, unique layered art, and unique character sheets", () => {
  const scene = {
    kind: "town",
    theme: "sunpatch-cay",
    interactions: [],
    layeredObjects: [
      { sprite: { src: "/objects/tree.png" } },
      { sprite: { src: "/objects/tree.png" } },
      { sprite: { src: "/objects/bench.png" } },
    ],
  };
  const paths = collectAdventureSceneAssetPaths(scene, {
    characterSpriteProfileIds: ["player", "fisherman-wyeth", "player", "unknown"],
  });

  assert.deepEqual(paths, [
    "/images/adventure/sunpatch-cay.png",
    "/objects/tree.png",
    "/objects/bench.png",
    "/images/adventure/player-sprites-512-v3.webp",
    "/images/adventure/fisherman-wyeth-sprites-512-v3.webp",
  ]);
  assert.equal(Object.isFrozen(paths), true);
  assert.equal(getAdventureCharacterSpriteAssetPath("unknown"), null);
});

test("only interior doorway destinations are selected for background warming", () => {
  const interior = {
    kind: "interior",
    interactions: [
      { targetScene: "town" },
      { targetScene: "town" },
      { targetScene: "shellshore-sunpatch-sea" },
      { trainerId: "marina" },
    ],
  };
  assert.deepEqual(
    getAdventureInteriorDestinationSceneIds(interior),
    ["town", "shellshore-sunpatch-sea"],
  );
  assert.deepEqual(getAdventureInteriorDestinationSceneIds({ ...interior, kind: "town" }), []);
  assert.equal(Object.isFrozen(getAdventureInteriorDestinationSceneIds(interior)), true);
});

test("scene image promises are decoded once and reused across warm-up and transition callers", async () => {
  const createdPaths = [];
  const decodeResolvers = new Map();
  const preloader = createAdventureSceneAssetPreloader({
    createImage: () => {
      const image = {
        _src: "",
        complete: false,
        set src(path) {
          this._src = path;
          this.complete = true;
          createdPaths.push(path);
        },
        get src() {
          return this._src;
        },
        decode() {
          return new Promise((resolve) => decodeResolvers.set(this._src, resolve));
        },
      };
      return image;
    },
  });

  const firstGroundPromise = preloader.preloadAsset("/ground.png");
  assert.equal(preloader.preloadAsset("/ground.png"), firstGroundPromise);
  const scenePromise = preloader.preloadAssetPaths([
    "/ground.png",
    "/object.png",
    "/ground.png",
  ]);
  assert.deepEqual(createdPaths, ["/ground.png", "/object.png"]);
  assert.equal(preloader.hasCachedAsset("/object.png"), true);

  let settled = false;
  scenePromise.then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false);
  decodeResolvers.get("/ground.png")();
  decodeResolvers.get("/object.png")();
  await scenePromise;
  assert.equal(settled, true);
});

test("decode failures remain best-effort and cannot reject a scene preload", async () => {
  let createCount = 0;
  const preloader = createAdventureSceneAssetPreloader({
    createImage: () => {
      createCount += 1;
      return {
        complete: true,
        set src(_path) {},
        decode: () => Promise.reject(new Error("decode unavailable")),
      };
    },
  });
  await assert.doesNotReject(preloader.preloadAssetPaths(["/unavailable.png"]));
  await preloader.preloadAsset("/unavailable.png");
  assert.equal(createCount, 1, "a loaded image with unsupported decode should remain cached");
});

test("transport failures resolve best-effort but are evicted so the next call retries", async () => {
  const images = [];
  const preloader = createAdventureSceneAssetPreloader({
    createImage: () => {
      const image = { complete: false, set src(path) { this.path = path; } };
      images.push(image);
      return image;
    },
  });

  const firstAttempt = preloader.preloadAsset("/retry-me.png");
  images[0].onerror();
  await firstAttempt;
  assert.equal(preloader.hasCachedAsset("/retry-me.png"), false);

  const secondAttempt = preloader.preloadAsset("/retry-me.png");
  assert.equal(images.length, 2);
  images[1].onload();
  await secondAttempt;
  assert.equal(preloader.hasCachedAsset("/retry-me.png"), true);
});

test("Elverson's town manifest covers its ground, layered objects, and resident profiles", () => {
  const paths = collectAdventureSceneAssetPaths(SCENES.town, {
    characterSpriteProfileIds: [
      "player",
      "fisherman-wyeth",
      "town-adult",
      "dorian",
    ],
  });
  assert.equal(paths[0], "/images/adventure/elverson-ground-v3.webp");
  assert.equal(SCENES.town.layeredObjects.length, 9);
  for (const { sprite } of SCENES.town.layeredObjects) {
    assert.ok(paths.includes(sprite.src), `${sprite.src} must be preloaded`);
  }
  for (const residentPath of [
    "/images/adventure/player-sprites-512-v3.webp",
    "/images/adventure/fisherman-wyeth-sprites-512-v3.webp",
    "/images/adventure/town-adult-sprites-512-v3.webp",
    "/images/adventure/dorian-sprites-512-v3.webp",
  ]) {
    assert.ok(paths.includes(residentPath), `${residentPath} must be preloaded`);
  }
  assert.ok(
    paths.includes("/images/adventure/explorer-jordan-sprites-512-v3.webp"),
    "the dock-speech crowd profiles should be preloaded while the player explores town",
  );
  assert.ok(
    paths.includes("/images/adventure/mr-easterling-sprites-627-v4.webp"),
    "the progression-staged dock speaker should be preloaded even though he is not authored",
  );
  assert.equal(paths.length, new Set(paths).size);
});

test("every preloaded character sheet matches the first live CSS sprite source", () => {
  for (const [profileId, assetPath] of Object.entries(ADVENTURE_CHARACTER_SPRITE_ASSETS)) {
    const selector = `.${profileId}SpriteArtwork`;
    let selectorIndex = styles.indexOf(selector);
    let cssPath;
    while (selectorIndex !== -1 && !cssPath) {
      const blockStart = styles.indexOf("{", selectorIndex);
      const blockEnd = styles.indexOf("}", blockStart);
      const declaration = styles.slice(blockStart + 1, blockEnd);
      cssPath = declaration.match(/background-image:\s*url\("([^"]+)"\)/)?.[1];
      selectorIndex = styles.indexOf(selector, blockEnd + 1);
    }
    assert.equal(cssPath, assetPath, `${profileId} preloading must match its live CSS image`);
  }
});

test("AdventureGame warms interior destinations and reuses the cached promise with the transition fallback", () => {
  const component = readFileSync(new URL("./AdventureGame.jsx", import.meta.url), "utf8");
  assert.match(component, /createAdventureSceneAssetPreloader/);
  assert.match(component, /scene\.kind !== "interior"/);
  assert.match(component, /getAdventureInteriorDestinationSceneIds\(scene\)/);
  assert.match(component, /await preloadAdventureSceneAssets\(scene\)/);
  assert.match(component, /connection\?\.saveData === true/);
  assert.match(component, /connection\?\.effectiveType === "2g"/);
  assert.match(component, /preloadAdventureSceneAssets\(SCENES\[destinationSceneId\]\)/);
  assert.match(component, /const artworkReady = preloadAdventureSceneAssets\(SCENES\[candidate\.targetScene\]\)/);
  assert.match(component, /Promise\.race\(\[[\s\S]*?pending\.artworkReady[\s\S]*?window\.setTimeout\(resolve, 600\)/);
});

test("the full simulator is deferred until the player launches a duel", () => {
  const component = readFileSync(new URL("./AdventureGame.jsx", import.meta.url), "utf8");
  assert.match(component, /dynamic\(\(\) => import\("@\/app\/simulator\/Simulator"\)/);
  assert.doesNotMatch(component, /import Simulator from "@\/app\/simulator\/Simulator"/);
});
