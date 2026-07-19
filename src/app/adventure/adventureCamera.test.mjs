import assert from "node:assert/strict";
import test from "node:test";

import {
  ADVENTURE_CAMERA_DEFAULTS,
  getAdventureCameraLayout,
} from "./adventureCamera.mjs";

function assertNear(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: expected ${expected}, received ${actual}`);
}

test("camera defaults describe the intended 16:9 handheld-style crop", () => {
  assert.deepEqual(ADVENTURE_CAMERA_DEFAULTS, {
    viewportAspect: 16 / 9,
    tilesAcross: 11,
    playerAnchorX: 0.5,
    playerAnchorY: 0.58,
  });
  assert.equal(Object.isFrozen(ADVENTURE_CAMERA_DEFAULTS), true);
});

test("camera uses square tiles and anchors the player below center away from world edges", () => {
  const camera = getAdventureCameraLayout({
    worldWidth: 30,
    worldHeight: 20,
    playerX: 15,
    playerY: 10,
  });

  assert.equal(camera.viewWidth, 11);
  assert.equal(camera.viewHeight, 6.1875);
  assert.equal(camera.originX, 9.5);
  assert.equal(camera.originY, 6.41125);
  assertNear(camera.viewWidth / camera.viewHeight, 16 / 9, "viewport aspect");
  assertNear(15 - camera.originX, camera.viewWidth * 0.5, "horizontal player anchor");
  assertNear(10 - camera.originY, camera.viewHeight * 0.58, "vertical player anchor");
  assertNear(camera.worldWidthPercent, (30 / 11) * 100, "world layer width");
  assertNear(camera.worldHeightPercent, (20 / 6.1875) * 100, "world layer height");
  assertNear(camera.leftPercent, -(9.5 / 11) * 100, "world layer left offset");
  assertNear(camera.topPercent, -(6.41125 / 6.1875) * 100, "world layer top offset");
  assertNear(camera.viewportAspect, 16 / 9, "reported viewport aspect");
  assert.equal(Object.isFrozen(camera), true);
});

test("camera clamps cleanly at every world edge", () => {
  const northwest = getAdventureCameraLayout({
    worldWidth: 30,
    worldHeight: 20,
    playerX: 0,
    playerY: 0,
  });
  assert.equal(northwest.originX, 0);
  assert.equal(northwest.originY, 0);
  assert.equal(northwest.leftPercent, 0);
  assert.equal(northwest.topPercent, 0);
  assert.equal(Object.is(northwest.leftPercent, -0), false);
  assert.equal(Object.is(northwest.topPercent, -0), false);

  const southeast = getAdventureCameraLayout({
    worldWidth: 30,
    worldHeight: 20,
    playerX: 30,
    playerY: 20,
  });
  assert.equal(southeast.originX, 19);
  assert.equal(southeast.originY, 13.8125);
  assertNear(southeast.leftPercent, -(19 / 11) * 100, "right-edge offset");
  assertNear(southeast.topPercent, -(13.8125 / 6.1875) * 100, "bottom-edge offset");
});

test("camera shows an entire scene when it is narrower than 11 tiles", () => {
  const camera = getAdventureCameraLayout({
    worldWidth: 8,
    worldHeight: 6,
    playerX: 4,
    playerY: 3,
  });

  assert.equal(camera.viewWidth, 8);
  assert.equal(camera.viewHeight, 4.5);
  assert.equal(camera.originX, 0);
  assert.equal(camera.leftPercent, 0);
  assert.equal(camera.worldWidthPercent, 100);
  assertNear(camera.viewWidth / camera.viewHeight, 16 / 9, "small-scene viewport aspect");
});

test("camera fits a short wide scene without revealing space beyond the world", () => {
  const camera = getAdventureCameraLayout({
    worldWidth: 20,
    worldHeight: 3,
    playerX: 10,
    playerY: 1.5,
  });

  assertNear(camera.viewWidth, 3 * (16 / 9), "height-limited view width");
  assert.equal(camera.viewHeight, 3);
  assert.equal(camera.originY, 0);
  assert.equal(camera.topPercent, 0);
  assert.equal(camera.worldHeightPercent, 100);
  assert.ok(camera.worldWidthPercent >= 100);
});

test("camera accepts validated zoom, aspect, and anchor overrides", () => {
  const camera = getAdventureCameraLayout(
    { worldWidth: 20, worldHeight: 20, playerX: 10, playerY: 10 },
    { viewportAspect: 2, tilesAcross: 10, playerAnchorX: 0.4, playerAnchorY: 0.6 },
  );

  assert.deepEqual(camera, {
    viewWidth: 10,
    viewHeight: 5,
    originX: 6,
    originY: 7,
    worldWidthPercent: 200,
    worldHeightPercent: 400,
    leftPercent: -60,
    topPercent: -140,
    viewportAspect: 2,
  });
});

test("camera rejects malformed world, player, and option inputs", () => {
  assert.throws(() => getAdventureCameraLayout(), /worldWidth must be a finite number/);
  assert.throws(
    () => getAdventureCameraLayout({ worldWidth: 0, worldHeight: 20, playerX: 0, playerY: 0 }),
    /worldWidth must be greater than zero/,
  );
  assert.throws(
    () => getAdventureCameraLayout({ worldWidth: 20, worldHeight: Number.NaN, playerX: 0, playerY: 0 }),
    /worldHeight must be a finite number/,
  );
  assert.throws(
    () => getAdventureCameraLayout({ worldWidth: 20, worldHeight: 20, playerX: -1, playerY: 0 }),
    /playerX must be within the world bounds/,
  );
  assert.throws(
    () => getAdventureCameraLayout({ worldWidth: 20, worldHeight: 20, playerX: 0, playerY: 21 }),
    /playerY must be within the world bounds/,
  );
  assert.throws(
    () => getAdventureCameraLayout(
      { worldWidth: 20, worldHeight: 20, playerX: 0, playerY: 0 },
      null,
    ),
    /Camera options must be an object/,
  );
  assert.throws(
    () => getAdventureCameraLayout(
      { worldWidth: 20, worldHeight: 20, playerX: 0, playerY: 0 },
      { tilesAcross: -1 },
    ),
    /tilesAcross must be greater than zero/,
  );
  assert.throws(
    () => getAdventureCameraLayout(
      { worldWidth: 20, worldHeight: 20, playerX: 0, playerY: 0 },
      { playerAnchorY: 1.1 },
    ),
    /playerAnchorY must be between zero and one/,
  );
  assert.throws(
    () => getAdventureCameraLayout(
      { worldWidth: 20, worldHeight: 20, playerX: 0, playerY: 0 },
      { zoom: 2 },
    ),
    /Unknown camera option: zoom/,
  );
});
