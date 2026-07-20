import assert from "node:assert/strict";
import test from "node:test";

import { ELVERSON_LAYERED_SCENE } from "./adventureElversonLayeredScene.mjs";
import { canOccupyLayeredScenePosition } from "./adventureLayeredScene.mjs";

test("Elverson compiles a ground layer, reusable object sprites, and base-only collision", () => {
  assert.equal(ELVERSON_LAYERED_SCENE.groundPath, "/images/adventure/elverson-ground-v2.png");
  assert.ok(ELVERSON_LAYERED_SCENE.objects.length >= 40);
  assert.ok(ELVERSON_LAYERED_SCENE.objects.some(({ archetype }) => archetype === "tree"));
  assert.ok(ELVERSON_LAYERED_SCENE.objects.some(({ archetype }) => archetype === "lamppost"));
  assert.ok(ELVERSON_LAYERED_SCENE.objects.every(({ collisionRects }) => collisionRects.length > 0));
});

test("Elverson water is denied by a positive walkable-surface allowlist", () => {
  const radius = 0.22;
  const isInsideWalkableRegion = (position) => ELVERSON_LAYERED_SCENE.walkableRegions.some((region) => (
    position.x - radius >= region.left
    && position.x + radius <= region.right
    && position.y - radius >= region.top
    && position.y + radius <= region.bottom
  ));

  assert.equal(isInsideWalkableRegion({ x: 14, y: 17.7 }), true);
  assert.equal(isInsideWalkableRegion({ x: 14, y: 18.35 }), false);
  assert.equal(isInsideWalkableRegion({ x: 9.4, y: 14.8 }), false);
  assert.equal(isInsideWalkableRegion({ x: 11, y: 16.5 }), true);
});

test("tree canopy is walk-through while its trunk remains solid", () => {
  const tree = ELVERSON_LAYERED_SCENE.objects.find(({ archetype }) => archetype === "tree");
  const behindCanopy = { x: tree.at.x, y: tree.at.y - 1.4 };

  assert.equal(canOccupyLayeredScenePosition(ELVERSON_LAYERED_SCENE, behindCanopy, 0.22), true);
  assert.equal(canOccupyLayeredScenePosition(ELVERSON_LAYERED_SCENE, tree.at, 0.22), false);
});

test("only the three active Elverson buildings expose doorway object links", () => {
  assert.deepEqual(
    ELVERSON_LAYERED_SCENE.objects.filter(({ interactionId }) => interactionId).map(({ interactionId }) => interactionId).sort(),
    [
      "interaction-elverson-enter-aquarium",
      "interaction-elverson-enter-chestnut-home",
      "interaction-elverson-enter-park-home",
    ],
  );
});
