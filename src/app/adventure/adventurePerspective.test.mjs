import assert from "node:assert/strict";
import test from "node:test";
import { SCENES, movePlayerContinuous } from "./adventureWorld.mjs";
import {
  createAdventureFrameGate, createAdventurePerspective, getPerspectiveActorStyle,
  getPerspectiveGroundStyle, getPerspectiveObjectRect, isPerspectiveActorVisible,
  isPerspectiveRectVisible, projectAdventurePoint, unprojectAdventurePoint,
} from "./adventurePerspective.mjs";
import { createInitialAdventureSave, normalizeAdventureSave } from "./adventureProgression.mjs";
import { normalizeAdventureSettings, updateAdventureSettings } from "./adventureSettings.mjs";
import { recoverAdventureResume } from "./adventureSession.mjs";
import { canOccupyContinuousPosition } from "./adventureWorld.mjs";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const desktop = { width: 900, height: 562.5 };

test("projection and its inverse agree at every viewport corner across scenes and phone orientations", () => {
  for (const scene of Object.values(SCENES)) {
    for (const viewport of [desktop, { width: 384, height: 366 }, { width: 540, height: 304 }]) {
      for (const target of [{ x: 0, y: 0 }, { x: scene.width / 2, y: scene.height / 2 }, { x: scene.width, y: scene.height }]) {
        const camera = createAdventurePerspective(scene, target, viewport);
        for (const x of [0, viewport.width / 2, viewport.width]) {
          for (const y of [0, viewport.height / 2, viewport.height]) {
            const world = unprojectAdventurePoint(camera, { x, y });
            assert.ok(world.x >= -1e-7 && world.x <= scene.width + 1e-7, scene.id);
            assert.ok(world.y >= -1e-7 && world.y <= scene.height + 1e-7, scene.id);
            const projected = projectAdventurePoint(camera, world);
            near(projected.x, x);
            near(projected.y, y);
          }
        }
      }
    }
  }
});

test("the cropped CSS ground matrix matches billboard foot positions", () => {
  const scene = SCENES.town;
  for (const target of [{ x: 4.7, y: 5.55 }, { x: 20.5, y: 16.95 }, { x: 40, y: 27 }]) {
    const camera = createAdventurePerspective(scene, target, desktop);
    const ground = getPerspectiveGroundStyle(scene, camera);
    const matrix = ground.transform.slice(9, -1).split(",").map(Number);
    const [offsetX, offsetY] = ground.backgroundPosition.split(" ").map(parseFloat);
    for (const point of [target, { x: camera.centerX - 2, y: camera.centerY - 2 }, { x: camera.centerX + 1, y: camera.centerY + 1 }]) {
      const px = point.x * camera.unit + offsetX;
      const py = point.y * camera.unit + offsetY;
      const w = matrix[3] * px + matrix[7] * py + matrix[15];
      const expected = projectAdventurePoint(camera, point);
      near((matrix[0] * px + matrix[4] * py + matrix[12]) / w, expected.x);
      near((matrix[1] * px + matrix[5] * py + matrix[13]) / w, expected.y);
    }
    assert.ok(ground.width < scene.width * camera.unit);
    assert.ok(ground.height < scene.height * camera.unit);
  }
});

test("upright sprites get smaller with distance and keep buildings attached to their authored anchors", () => {
  const camera = createAdventurePerspective(SCENES.town, { x: 20, y: 16 }, desktop);
  const far = getPerspectiveActorStyle({ x: 20, y: 12 }, camera);
  const close = getPerspectiveActorStyle({ x: 20, y: 17 }, camera);
  assert.ok(far.width < close.width);
  near(far.width, far.height);
  for (const object of SCENES.town.layeredObjects) {
    const rect = getPerspectiveObjectRect(object, camera);
    const point = projectAdventurePoint(camera, { x: object.at.x + 0.5, y: object.at.y + 0.5 });
    if (!point) { assert.equal(rect, null); continue; }
    near(rect.left + rect.width * object.sprite.anchorX, point.x);
    near(rect.top + rect.height * object.sprite.anchorY, point.y);
  }
});

test("culling retains roof tops even when the building base is below the viewport", () => {
  const camera = createAdventurePerspective(SCENES.town, { x: 27.6, y: 18 }, desktop);
  const aquarium = SCENES.town.layeredObjects.find(({ id }) => id === "aquarium-workshop");
  const rect = getPerspectiveObjectRect(aquarium, camera);
  assert.ok(rect.top < camera.height);
  assert.ok(rect.top + rect.height > camera.height);
  assert.equal(isPerspectiveRectVisible(rect, camera), true);
  assert.equal(isPerspectiveActorVisible({ x: -100, y: 12 }, camera), false);
  assert.equal(isPerspectiveActorVisible({ x: 20, y: 100 }, camera), false);
  assert.equal(isPerspectiveRectVisible(null, camera), false);
});

test("battery saver and high refresh displays advance real movement at the same speed", () => {
  const distanceAfterSecond = (fps, refreshRate) => {
    const gate = createAdventureFrameGate(fps);
    let position = { x: 20, y: 6 };
    let frames = 0;
    for (let index = 0; index <= refreshRate; index++) {
      const elapsed = gate(index * 1000 / refreshRate);
      if (elapsed) {
        frames++;
        position = movePlayerContinuous("town", position, { x: 1, y: 0 }, elapsed, { ignoreActorTiles: true });
      }
    }
    return { position, frames };
  };
  const standard = distanceAfterSecond(60, 120);
  const battery = distanceAfterSecond(30, 120);
  near(standard.position.x, battery.position.x);
  assert.equal(standard.frames, 60);
  assert.equal(battery.frames, 30);
  const gate = createAdventureFrameGate(60);
  gate(0);
  assert.equal(gate(60000), 80);
});

test("legacy saves gain automatic perspective without losing progress, and every graphics choice survives reload", () => {
  const save = createInitialAdventureSave("graphics-test");
  const legacy = structuredClone(save);
  delete legacy.settings.graphicsMode;
  const migrated = normalizeAdventureSave(legacy);
  assert.equal(migrated.settings.graphicsMode, "auto");
  assert.deepEqual(migrated.world, legacy.world);
  assert.deepEqual(migrated.progression, legacy.progression);
  for (const graphicsMode of ["auto", "perspective", "battery", "classic"]) {
    const updated = updateAdventureSettings(save, { graphicsMode }).save;
    assert.equal(normalizeAdventureSave(JSON.parse(JSON.stringify(updated))).settings.graphicsMode, graphicsMode);
  }
  assert.equal(normalizeAdventureSettings({ graphicsMode: "invalid" }).graphicsMode, "auto");
  assert.throws(() => updateAdventureSettings(save, { graphicsMode: "invalid" }), /graphics mode/);
});

test("normal display jitter does not halve the selected frame rate", () => {
  for (const fps of [30, 60]) {
    const gate = createAdventureFrameGate(fps);
    let count = 0;
    for (let index = 0; index <= 600; index++) {
      if (gate(index * 1000 / 60 + (index % 3) * 0.8)) count++;
    }
    assert.ok(count >= fps * 10 - 1 && count <= fps * 10 + 1, `${fps} fps yielded ${count} updates`);
  }
});

test("viewer decorations do not relocate an existing save or block its position", () => {
  const save = createInitialAdventureSave("tree-resume");
  save.opening.status = "legacySkipped";
  save.world.sceneId = "town";
  save.world.position = { x: 8.1, y: 4.35 };
  const resumed = recoverAdventureResume(save);
  assert.equal(resumed.save.world.sceneId, "town");
  assert.equal(canOccupyContinuousPosition("town", resumed.save.world.position), true);
  assert.deepEqual(resumed.save.world.position, save.world.position);
  assert.deepEqual(resumed.save.inventory, save.inventory);
});

test("invalid camera sizes fail explicitly instead of creating NaN CSS", () => {
  assert.throws(() => createAdventurePerspective(SCENES.town, { x: 0, y: 0 }, { width: 0, height: 100 }), /positive/);
  assert.throws(() => createAdventurePerspective(SCENES.town, { x: NaN, y: 0 }, desktop), /finite/);
});
