import assert from "node:assert/strict";
import test from "node:test";

import {
  createAdventureActorStates,
  getAdventureActorBlockers,
} from "./adventureActors.mjs";
import {
  ELVERSON_TOWN_PORTALS,
  ELVERSON_TOWN_ROADS,
  ELVERSON_TOWN_SAFE_POSITIONS,
  ELVERSON_WYETH_HAND_NET_PATH,
} from "./adventureElversonTownLayout.mjs";
import {
  SCENES,
  canOccupyContinuousPosition,
  getDoorwayTransition,
  movePlayerContinuous,
} from "./adventureWorld.mjs";

const EPSILON = 1e-8;
const CARDINAL_FACINGS = Object.freeze(["up", "down", "left", "right"]);

function walkAxisRoute(points, options = {}) {
  return points.slice(1).reduce((position, target) => {
    const rawDelta = { x: target.x - position.x, y: target.y - position.y };
    const delta = {
      x: Math.abs(rawDelta.x) < EPSILON ? 0 : rawDelta.x,
      y: Math.abs(rawDelta.y) < EPSILON ? 0 : rawDelta.y,
    };
    assert.ok(Math.abs(delta.x) < EPSILON || Math.abs(delta.y) < EPSILON);
    const distance = Math.hypot(delta.x, delta.y);
    const movement = { x: Math.sign(delta.x), y: Math.sign(delta.y) };
    const next = movePlayerContinuous(
      "town",
      position,
      movement,
      (distance / 4) * 1000,
      { ignoreActorTiles: true, ...options },
    );
    assert.ok(
      Math.hypot(next.x - target.x, next.y - target.y) < EPSILON,
      `route stopped at (${next.x}, ${next.y}) before (${target.x}, ${target.y})`,
    );
    return next;
  }, points[0]);
}

function reachableQuarterTilePositions({ dynamicBlockers = [] } = {}) {
  const scale = 4;
  const start = {
    x: Math.round(SCENES.town.spawn.x * scale),
    y: Math.round(SCENES.town.spawn.y * scale),
  };
  const queue = [start];
  const visited = new Set([`${start.x}:${start.y}`]);
  const reachable = [];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const point = queue[cursor];
    const position = { x: point.x / scale, y: point.y / scale };
    reachable.push(position);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: point.x + dx, y: point.y + dy };
      const nextPosition = { x: next.x / scale, y: next.y / scale };
      const key = `${next.x}:${next.y}`;
      if (
        visited.has(key)
        || nextPosition.x < 0
        || nextPosition.y < 0
        || nextPosition.x > SCENES.town.width - 1
        || nextPosition.y > SCENES.town.height - 1
        || !canOccupyContinuousPosition("town", nextPosition, undefined, {
          dynamicBlockers,
          ignoreActorTiles: true,
        })
      ) continue;
      visited.add(key);
      queue.push(next);
    }
  }
  return reachable;
}

function canReachPortal(reachable, portalId) {
  return reachable.some((position) => CARDINAL_FACINGS.some((facing) => (
    getDoorwayTransition("town", position, facing)?.interactionId === portalId
  )));
}

test("two full-width lanes remain clear on every named Elverson road", () => {
  for (const road of Object.values(ELVERSON_TOWN_ROADS)) {
    const margin = 0.35;
    for (const lane of road.lanes) {
      if (road.axis === "horizontal") {
        const west = { x: road.bounds.left + margin, y: lane.y };
        const east = { x: road.bounds.right - margin, y: lane.y };
        walkAxisRoute([west, east]);
        walkAxisRoute([east, west]);
      } else {
        const north = { x: lane.x, y: road.bounds.top + margin };
        const south = { x: lane.x, y: road.bounds.bottom - margin };
        walkAxisRoute([north, south]);
        walkAxisRoute([south, north]);
      }
    }
  }
});

test("Wyeth's predetermined hand-net escort path stays entirely on the wharf", () => {
  for (const path of Object.values(ELVERSON_WYETH_HAND_NET_PATH)) {
    for (let index = 0; index < path.length - 1; index += 1) {
      const start = path[index];
      const end = path[index + 1];
      const distance = Math.hypot(end.x - start.x, end.y - start.y);
      const sampleCount = Math.max(1, Math.ceil(distance / 0.04));
      for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
        const progress = sampleIndex / sampleCount;
        const position = {
          x: start.x + (end.x - start.x) * progress,
          y: start.y + (end.y - start.y) * progress,
        };
        assert.equal(
          canOccupyContinuousPosition("town", position, undefined, { ignoreActorTiles: true }),
          true,
          `escort path ${index} left walkable ground at ${position.x},${position.y}`,
        );
      }
    }
  }
});

test("every named town spawn sits on visible, collision-clear ground", () => {
  for (const [name, position] of Object.entries(ELVERSON_TOWN_SAFE_POSITIONS)) {
    assert.equal(
      canOccupyContinuousPosition("town", position),
      true,
      `${name} must be safe`,
    );
  }
});

test("all nine public portals remain reachable with every town resident present", () => {
  const actorStates = createAdventureActorStates(SCENES.town.interactions);
  const reachable = reachableQuarterTilePositions({
    dynamicBlockers: getAdventureActorBlockers(actorStates),
  });
  for (const portal of ELVERSON_TOWN_PORTALS) {
    assert.equal(canReachPortal(reachable, portal.id), true, `${portal.id} must be reachable`);
  }
});

test("all nine portal pairs return to their matching exterior facade", () => {
  for (const portal of ELVERSON_TOWN_PORTALS) {
    const entrance = SCENES.town.interactions.find(({ id }) => id === portal.id);
    const destination = SCENES[portal.targetScene];
    const exit = destination.interactions.find((interaction) => (
      interaction.type === "exit" && interaction.targetScene === "town"
    ));
    assert.ok(entrance, `${portal.id} entrance must exist`);
    assert.ok(exit, `${portal.targetScene} exit must exist`);
    assert.deepEqual(entrance.spawn, portal.interiorSpawn);
    assert.deepEqual(exit.spawn, portal.exteriorSpawn);
    assert.equal(canOccupyContinuousPosition("town", exit.spawn), true);
  }
});

test("full facade footprints are solid while each front approach remains open", () => {
  for (const portal of ELVERSON_TOWN_PORTALS) {
    const object = SCENES.town.layeredObjects.find(({ id }) => id === portal.objectId);
    assert.ok(object, `${portal.objectId} facade must exist`);
    const collider = object.collisionRects[0];
    assert.equal(canOccupyContinuousPosition("town", {
      x: (collider.left + collider.right) / 2,
      y: (collider.top + collider.bottom) / 2,
    }), false, `${portal.objectId} interior footprint must be solid`);
    assert.equal(
      canOccupyContinuousPosition("town", portal.exteriorSpawn),
      true,
      `${portal.objectId} exterior approach must stay open`,
    );
  }
});

test("the aquarium's visible door remains reachable from the public pier", () => {
  const portal = ELVERSON_TOWN_PORTALS.find(({ objectId }) => objectId === "aquarium-workshop");
  assert.ok(portal);
  assert.deepEqual(portal.at, { x: 27.6, y: 23.75 });
  assert.equal(portal.scale, 0.8);
  assert.deepEqual(portal.doorway, { x: 27.6, y: 23.3 });

  walkAxisRoute([
    { x: 20, y: 21.45 },
    { x: 20, y: 23.72 },
    { x: portal.exteriorSpawn.x, y: 23.72 },
    portal.exteriorSpawn,
  ]);

  const doorwayApproach = portal.exteriorSpawn;
  assert.equal(canOccupyContinuousPosition("town", doorwayApproach), true);
  assert.equal(
    getDoorwayTransition("town", doorwayApproach, "up")?.interactionId,
    portal.id,
  );
});

test("the wharf and aquarium platforms connect to town without opening the surrounding sea", () => {
  walkAxisRoute([
    ELVERSON_TOWN_SAFE_POSITIONS.townStart,
    { x: 20, y: 17 },
    { x: 20, y: 21.45 },
    { x: 14.55, y: 21.45 },
  ]);
  walkAxisRoute([
    { x: 20, y: 21.45 },
    { x: 20, y: 23.72 },
    ELVERSON_TOWN_SAFE_POSITIONS.aquariumExterior,
  ]);

  for (const [label, position] of [
    ["expanded wharf", { x: 12, y: 20 }],
    ["expanded aquarium apron", { x: 29, y: 23.72 }],
  ]) assert.equal(canOccupyContinuousPosition("town", position), true, `${label} must be walkable`);

  for (const [label, position] of [
    ["west open water", { x: 8, y: 22 }],
    ["southwest open water", { x: 10, y: 23 }],
    ["east open water", { x: 32, y: 22 }],
    ["beyond the pier", { x: 20, y: 27.4 }],
  ]) assert.equal(canOccupyContinuousPosition("town", position), false, `${label} must stay solid`);
});

test("every staged resident anchor is walkable in its authored scene", () => {
  for (const [sceneId, scene] of Object.entries(SCENES)) {
    if (
      sceneId === "player-home"
      || !["town", ...ELVERSON_TOWN_PORTALS.map(({ targetScene }) => targetScene)].includes(sceneId)
    ) continue;
    for (const interaction of scene.interactions.filter(({ type }) => ["npc", "trainer"].includes(type))) {
      assert.equal(
        canOccupyContinuousPosition(sceneId, interaction.at, undefined, { ignoreActorTiles: true }),
        true,
        `${interaction.id} must stand on open floor in ${sceneId}`,
      );
    }
  }
});
