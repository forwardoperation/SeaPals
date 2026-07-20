import assert from "node:assert/strict";
import test from "node:test";

import {
  canOccupyLayeredScenePosition,
  compileLayeredScene,
  createLayeredActorRenderable,
  getLayeredSceneObjectStyle,
  getLayeredSceneZIndex,
  sortLayeredSceneRenderables,
} from "./adventureLayeredScene.mjs";

const TERRAIN = [
  "wwwwwwwwww",
  "wggggggggw",
  "wggggggggw",
  "wggggggggw",
  "wggggggggw",
  "wggggggggw",
  "wggggggggw",
  "wwwwwwwwww",
];

const ARCHETYPES = {
  tree: {
    sprite: {
      src: "/images/adventure/objects/tree.png",
      width: 2,
      height: 3,
      anchorX: 0.5,
      anchorY: 1,
    },
    colliders: [
      { id: "trunk-base", left: -0.22, top: -0.28, right: 0.22, bottom: 0.1 },
    ],
  },
  lamppost: {
    sprite: {
      src: "/images/adventure/objects/lamppost.png",
      width: 0.8,
      height: 2.2,
      anchorX: 0.5,
      anchorY: 1,
    },
    colliders: [
      { id: "post-base", left: -0.12, top: -0.16, right: 0.12, bottom: 0.08 },
    ],
  },
  flowerPatch: {
    layer: "ground",
    sprite: {
      src: "/images/adventure/objects/flowers.png",
      width: 1,
      height: 1,
      anchorX: 0.5,
      anchorY: 0.5,
    },
  },
  canopy: {
    layer: "overhead",
    depthBias: 2,
    sprite: {
      src: "/images/adventure/objects/canopy.png",
      width: 3,
      height: 2,
      anchorX: 0.5,
      anchorY: 1,
    },
  },
};

function makeScene(overrides = {}) {
  return compileLayeredScene({
    id: "layered-test-town",
    width: 10,
    height: 8,
    groundPath: "/images/adventure/ground.png",
    terrainRows: TERRAIN,
    terrainLegend: {
      g: { walkable: true },
      w: { walkable: false },
    },
    walkableRegions: [
      { id: "mainland", left: 0.5, top: 0.5, right: 8.5, bottom: 6.5 },
    ],
    archetypes: ARCHETYPES,
    objects: [
      { id: "oak-1", archetype: "tree", at: { x: 4, y: 4 } },
      { id: "lamp-1", archetype: "lamppost", at: { x: 2, y: 3 } },
      { id: "lamp-2", archetype: "lamppost", at: { x: 7, y: 3 } },
    ],
    ...overrides,
  });
}

test("layered objects compile reusable sprite, base-collision, and depth geometry", () => {
  const scene = makeScene();
  const tree = scene.objects.find(({ id }) => id === "oak-1");

  assert.deepEqual(tree.visualBounds, {
    left: 3,
    top: 1,
    right: 5,
    bottom: 4,
  });
  assert.equal(tree.depthY, 4);
  assert.equal(tree.collisionRects[0].id, "oak-1:trunk-base");
  assert.ok(Math.abs(tree.collisionRects[0].left - 3.78) < 1e-9);
  assert.ok(Math.abs(tree.collisionRects[0].top - 3.72) < 1e-9);
  assert.ok(Math.abs(tree.collisionRects[0].right - 4.22) < 1e-9);
  assert.ok(Math.abs(tree.collisionRects[0].bottom - 4.1) < 1e-9);
  assert.deepEqual(
    scene.objects.filter(({ archetype }) => archetype === "lamppost").map(({ collisionRects }) => ({
      width: collisionRects[0].right - collisionRects[0].left,
      height: collisionRects[0].bottom - collisionRects[0].top,
    })),
    [
      { width: 0.2400000000000002, height: 0.2400000000000002 },
      { width: 0.2400000000000002, height: 0.2400000000000002 },
    ],
  );
  assert.equal(Object.isFrozen(scene), true);
  assert.equal(Object.isFrozen(tree), true);
  assert.equal(Object.isFrozen(tree.collisionRects), true);
  assert.equal(scene.groundPath, "/images/adventure/ground.png");
  assert.equal(Object.isFrozen(scene.walkableRegions), true);
});

test("only an object's base blocks movement while its upper sprite can occlude a player", () => {
  const scene = makeScene();

  assert.equal(canOccupyLayeredScenePosition(scene, { x: 4, y: 2 }, 0.22), true);
  assert.equal(canOccupyLayeredScenePosition(scene, { x: 4, y: 4 }, 0.22), false);
  assert.equal(canOccupyLayeredScenePosition(scene, { x: 4, y: 4.5 }, 0.22), true);
});

test("terrain owns shoreline navigation instead of water-shaped prop rectangles", () => {
  const scene = makeScene();

  assert.equal(canOccupyLayeredScenePosition(scene, { x: 5, y: 0 }, 0.22), false);
  assert.equal(canOccupyLayeredScenePosition(scene, { x: 1, y: 1 }, 0.22), true);
  assert.equal(canOccupyLayeredScenePosition(scene, { x: 0.6, y: 1 }, 0.22), false);
});

test("live actor circles participate without becoming authored scene objects", () => {
  const scene = makeScene();
  const options = {
    dynamicBlockers: [{ id: "resident", position: { x: 6, y: 5 }, radius: 0.33 }],
  };

  assert.equal(canOccupyLayeredScenePosition(scene, { x: 6, y: 5 }, 0.22, options), false);
  assert.equal(canOccupyLayeredScenePosition(scene, { x: 5, y: 5 }, 0.22, options), true);
});

test("depth sorting puts north actors behind an object and south actors in front", () => {
  const scene = makeScene();
  const tree = scene.objects.find(({ id }) => id === "oak-1");
  const behind = createLayeredActorRenderable({ id: "behind", position: { x: 4, y: 2.5 } });
  const inFront = createLayeredActorRenderable({ id: "front", position: { x: 4, y: 5 } });

  const stack = sortLayeredSceneRenderables([tree, inFront, behind]);
  assert.deepEqual(stack.map(({ renderId }) => renderId), [
    "actor:behind",
    "object:oak-1",
    "actor:front",
  ]);
  assert.ok(getLayeredSceneZIndex(behind) < getLayeredSceneZIndex(tree));
  assert.ok(getLayeredSceneZIndex(tree) < getLayeredSceneZIndex(inFront));
});

test("ground, feet-sorted, and overhead bands remain deterministic", () => {
  const scene = makeScene({
    objects: [
      { id: "flowers", archetype: "flowerPatch", at: { x: 4, y: 4 } },
      { id: "tree", archetype: "tree", at: { x: 4, y: 4 } },
      { id: "canopy", archetype: "canopy", at: { x: 4, y: 4 } },
    ],
  });
  const actor = createLayeredActorRenderable({ id: "player", position: { x: 4, y: 4.5 } });

  assert.deepEqual(
    sortLayeredSceneRenderables([...scene.objects, actor]).map(({ renderId }) => renderId),
    ["object:flowers", "object:tree", "actor:player", "object:canopy"],
  );
});

test("object styles use the same half-tile world origin as current actors", () => {
  const scene = makeScene();
  const tree = scene.objects.find(({ id }) => id === "oak-1");

  assert.deepEqual(getLayeredSceneObjectStyle(tree, scene), {
    left: "35%",
    top: "18.75%",
    width: "20%",
    height: "37.5%",
    zIndex: 5500,
  });
});

test("scaled instances keep their visuals and base hitboxes aligned", () => {
  const scene = makeScene({
    objects: [{ id: "large-oak", archetype: "tree", at: { x: 5, y: 5 }, scale: 1.5 }],
  });
  const tree = scene.objects[0];

  assert.deepEqual(tree.visualBounds, {
    left: 3.5,
    top: 0.5,
    right: 6.5,
    bottom: 5,
  });
  assert.deepEqual(tree.collisionRects[0], {
    id: "large-oak:trunk-base",
    left: 4.67,
    top: 4.58,
    right: 5.33,
    bottom: 5.15,
  });
});

test("invalid terrain and object geometry fail during compilation", () => {
  assert.throws(
    () => makeScene({ terrainRows: [...TERRAIN.slice(0, 7), "wwwwxwwwww"] }),
    /unknown symbol x/,
  );
  assert.throws(
    () => makeScene({
      objects: [
        { id: "same", archetype: "tree", at: { x: 3, y: 3 } },
        { id: "same", archetype: "tree", at: { x: 6, y: 3 } },
      ],
    }),
    /duplicate object id same/,
  );
  assert.throws(
    () => makeScene({ objects: [{ id: "edge-tree", archetype: "tree", at: { x: -0.4, y: 0 } }] }),
    /collider trunk-base extends outside the scene/,
  );
  assert.throws(
    () => makeScene({ objects: [{ id: "mystery", archetype: "boulder", at: { x: 3, y: 3 } }] }),
    /unknown archetype boulder/,
  );
  assert.throws(
    () => sortLayeredSceneRenderables([{ renderId: "bad", layer: "depth", depthY: Number.NaN, depthBias: 0 }]),
    /depthY must be finite/,
  );
});
