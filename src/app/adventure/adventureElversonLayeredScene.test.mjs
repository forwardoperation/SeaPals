import assert from "node:assert/strict";
import test from "node:test";

import { ELVERSON_LAYERED_SCENE } from "./adventureElversonLayeredScene.mjs";
import {
  ELVERSON_TOWN_DIMENSIONS,
  ELVERSON_TOWN_PORTALS,
} from "./adventureElversonTownLayout.mjs";
import { canOccupyLayeredScenePosition } from "./adventureLayeredScene.mjs";

test("Elverson v3 compiles the expanded ground and exactly nine public facades", () => {
  assert.equal(ELVERSON_LAYERED_SCENE.id, "elverson-town-layered-v3");
  assert.equal(ELVERSON_LAYERED_SCENE.groundPath, "/images/adventure/elverson-ground-v3.webp");
  assert.equal(ELVERSON_LAYERED_SCENE.width, ELVERSON_TOWN_DIMENSIONS.width);
  assert.equal(ELVERSON_LAYERED_SCENE.height, ELVERSON_TOWN_DIMENSIONS.height);
  assert.equal(ELVERSON_LAYERED_SCENE.objects.length, 9);
  assert.equal(ELVERSON_LAYERED_SCENE.collisionRects.length, 9);
  assert.ok(ELVERSON_LAYERED_SCENE.objects.every(({ interactionId }) => interactionId));
});

test("all authored facade links match the town portal contract", () => {
  assert.deepEqual(
    ELVERSON_LAYERED_SCENE.objects.map(({ id, interactionId }) => ({ id, interactionId })),
    ELVERSON_TOWN_PORTALS.map(({ objectId, id }) => ({ id: objectId, interactionId: id })),
  );
});

test("the aquarium facade centers on its deck while its visible door meets the connector", () => {
  const portal = ELVERSON_TOWN_PORTALS.find(({ objectId }) => objectId === "aquarium-workshop");
  const object = ELVERSON_LAYERED_SCENE.objects.find(({ id }) => id === "aquarium-workshop");
  const platform = ELVERSON_LAYERED_SCENE.walkableRegions.find(({ id }) => id === "aquarium-platform");
  const connector = ELVERSON_LAYERED_SCENE.walkableRegions.find(({ id }) => id === "aquarium-connector");

  assert.ok(portal);
  assert.ok(object);
  assert.ok(platform);
  assert.ok(connector);

  const facadeCenterX = (object.visualBounds.left + object.visualBounds.right) / 2;
  const platformCenterX = (platform.left + platform.right) / 2;
  assert.ok(
    Math.abs(facadeCenterX - platformCenterX) <= 0.5,
    `aquarium facade center ${facadeCenterX} must stay over deck center ${platformCenterX}`,
  );
  assert.ok(
    portal.doorway.x >= Math.max(platform.left, connector.left)
      && portal.doorway.x <= Math.min(platform.right, connector.right),
    "the aquarium's visible left-hand door must remain over the deck/connector overlap",
  );
  assert.equal(portal.at.x, 26);
  assert.equal(portal.doorway.x, 24.22);
});

test("full-facade collision removes every walkable sample hidden behind a building", () => {
  const radius = 0.12;
  for (const object of ELVERSON_LAYERED_SCENE.objects) {
    for (const collider of object.collisionRects) {
      const { left, top, right, bottom } = collider;
      for (let x = left + 0.2; x <= right - 0.2; x += 0.25) {
        for (let y = top + 0.2; y <= bottom - 0.2; y += 0.25) {
          assert.equal(
            canOccupyLayeredScenePosition(ELVERSON_LAYERED_SCENE, { x, y }, radius),
            false,
            `${object.id} must not hide a walkable pocket at (${x}, ${y})`,
          );
        }
      }
    }
  }
});

test("the mainland, central pier, wharf, and aquarium platform are the only dry regions", () => {
  const radius = 0.22;
  const insideAllowlist = (position) => {
    const samples = [position];
    for (let index = 0; index < 24; index += 1) {
      const angle = (index / 24) * Math.PI * 2;
      samples.push({
        x: position.x + Math.cos(angle) * radius,
        y: position.y + Math.sin(angle) * radius,
      });
    }
    return samples.every((sample) => ELVERSON_LAYERED_SCENE.walkableRegions.some((region) => (
      sample.x >= region.left
      && sample.x <= region.right
      && sample.y >= region.top
      && sample.y <= region.bottom
    )));
  };

  for (const position of [
    { x: 2, y: 16.8 },
    { x: 20, y: 26.8 },
    { x: 15.3, y: 21.4 },
    { x: 24.5, y: 21.7 },
  ]) assert.equal(insideAllowlist(position), true);

  for (const position of [
    { x: 2, y: 19 },
    { x: 18, y: 24 },
    { x: 23, y: 19 },
    { x: 30, y: 23 },
  ]) assert.equal(insideAllowlist(position), false);
});
