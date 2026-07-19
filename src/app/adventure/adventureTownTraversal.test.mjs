import assert from "node:assert/strict";
import test from "node:test";
import {
  createAdventureActorStates,
  getAdventureActorBlockers,
} from "./adventureActors.mjs";
import {
  SCENES,
  START_STATE,
  canOccupyContinuousPosition,
  getContinuousInteraction,
  getDoorwayTransition,
  movePlayerContinuous,
} from "./adventureWorld.mjs";

const POSITION_EPSILON = 1e-8;

function walkAxisRoute(points) {
  return points.slice(1).reduce((position, target) => {
    const rawDelta = { x: target.x - position.x, y: target.y - position.y };
    const delta = {
      x: Math.abs(rawDelta.x) < POSITION_EPSILON ? 0 : rawDelta.x,
      y: Math.abs(rawDelta.y) < POSITION_EPSILON ? 0 : rawDelta.y,
    };
    assert.ok(delta.x === 0 || delta.y === 0, "town regression routes must stay axis-aligned");
    const distance = Math.hypot(delta.x, delta.y);
    const movement = { x: Math.sign(delta.x), y: Math.sign(delta.y) };
    const next = movePlayerContinuous("town", position, movement, (distance / 4) * 1000);

    assert.ok(
      Math.hypot(next.x - target.x, next.y - target.y) < POSITION_EPSILON,
      `expected continuous movement to reach (${target.x}, ${target.y}), stopped at (${next.x}, ${next.y})`,
    );
    assert.equal(canOccupyContinuousPosition("town", next), true);
    return next;
  }, points[0]);
}

function reachableQuarterTilePositions(sceneId, {
  dynamicBlockers = [],
  ignoreActorTiles = true,
} = {}) {
  const scene = SCENES[sceneId];
  const scale = 4;
  const start = {
    x: Math.round(scene.spawn.x * scale),
    y: Math.round(scene.spawn.y * scale),
  };
  const queue = [start];
  const visited = new Set([`${start.x}:${start.y}`]);
  const reachable = [];

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const point = queue[cursor];
    reachable.push({ x: point.x / scale, y: point.y / scale });
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: point.x + dx, y: point.y + dy };
      const position = { x: next.x / scale, y: next.y / scale };
      const key = `${next.x}:${next.y}`;
      if (
        visited.has(key)
        || position.x < 0
        || position.y < 0
        || position.x > scene.width - 1
        || position.y > scene.height - 1
        || !canOccupyContinuousPosition(sceneId, position, undefined, {
          dynamicBlockers,
          ignoreActorTiles,
        })
      ) continue;
      visited.add(key);
      queue.push(next);
    }
  }
  return reachable;
}

test("continuous Elverson routes connect the crossroads start to all three doorways", () => {
  const routes = [
    {
      waypoints: [
        START_STATE.position,
        { x: 14, y: 7 },
        { x: 7, y: 7 },
        { x: 7, y: 6.8 },
      ],
      interactionId: "interaction-elverson-enter-park-home",
    },
    {
      waypoints: [
        START_STATE.position,
        { x: 14, y: 7 },
        { x: 19.75, y: 7 },
        { x: 19.75, y: 4 },
        { x: 18, y: 4 },
        { x: 18, y: 3.8 },
      ],
      interactionId: "interaction-elverson-enter-chestnut-home",
    },
    {
      waypoints: [
        START_STATE.position,
        { x: 14, y: 17.4 },
        { x: 16, y: 17.4 },
      ],
      interactionId: "interaction-elverson-enter-aquarium",
    },
  ];

  for (const { waypoints, interactionId } of routes) {
    const doorwayApproach = walkAxisRoute(waypoints);
    assert.equal(getDoorwayTransition("town", doorwayApproach, "up")?.interactionId, interactionId);
  }
});

test("the aquarium exit returns to the central pier with a clear route into town", () => {
  const aquariumExit = SCENES["academy-lab"].interactions.find(
    ({ id }) => id === "interaction-academy-exit",
  );

  assert.deepEqual(aquariumExit.spawn, { x: 14, y: 17 });
  assert.equal(canOccupyContinuousPosition("town", aquariumExit.spawn), true);
  assert.equal(getDoorwayTransition("town", aquariumExit.spawn, "up"), null);
  const mainStreet = walkAxisRoute([
    aquariumExit.spawn,
    { x: 14, y: 12 },
    { x: 14, y: 10 },
  ]);
  assert.ok(
    Math.hypot(mainStreet.x - 14, mainStreet.y - 10) < POSITION_EPSILON,
    "the aquarium return route should reach Main Street",
  );
});

test("Main Street and Chestnut Street retain clear walking lanes", () => {
  const parallelLanes = [
    [{ x: 1, y: 7 }, { x: 28, y: 7 }],
    [{ x: 13.8, y: 1 }, { x: 13.8, y: 18 }],
    [{ x: 14.2, y: 1 }, { x: 14.2, y: 18 }],
  ];

  for (const lane of parallelLanes) walkAxisRoute(lane);
});

test("Elverson traversal treats buildings and shoreline water as solid", () => {
  const solidArtwork = [
    ["west residence", { x: 3, y: 3 }],
    ["park school", { x: 8, y: 5 }],
    ["Chestnut residence", { x: 16, y: 2 }],
    ["town hall", { x: 23, y: 5 }],
    ["Main Street shop", { x: 6, y: 9 }],
    ["west shallow water", { x: 3, y: 13 }],
    ["west deep water", { x: 8, y: 18 }],
    ["east shallow water", { x: 25, y: 13 }],
    ["east deep water", { x: 27, y: 18 }],
    ["fishing boat", { x: 11, y: 17 }],
    ["aquarium", { x: 19, y: 15 }],
    ["water south of the aquarium deck", { x: 17, y: 18 }],
    ["park fountain", { x: 16.6, y: 5.2 }],
    ["park north bench", { x: 16, y: 3.9 }],
    ["park west bench", { x: 13, y: 6.2 }],
    ["northwest tree canopy", { x: 1, y: 1 }],
    ["northeast tree canopy", { x: 27, y: 1 }],
    ["west wooded hillside", { x: 1, y: 5.8 }],
    ["east wooded hillside", { x: 27.5, y: 4.5 }],
    ["east promenade bench", { x: 17.1, y: 11.1 }],
    ["east seawall rail", { x: 18, y: 11.7 }],
    ["Main Street west lamppost", { x: 11.6, y: 7.8 }],
    ["far-east promenade lamppost", { x: 26.4, y: 10.6 }],
  ];

  for (const [label, position] of solidArtwork) {
    assert.equal(canOccupyContinuousPosition("town", position), false, `${label} should be solid`);
  }

  walkAxisRoute([{ x: 14, y: 12 }, { x: 14, y: 17.4 }, { x: 16, y: 17.4 }]);
  walkAxisRoute([{ x: 14, y: 17.7 }, { x: 11.5, y: 17.7 }]);
});

test("every active Elverson character remains reachable from its scene spawn", () => {
  for (const sceneId of ["town", "academy-lab", "coral-home", "deep-home"]) {
    const reachable = reachableQuarterTilePositions(sceneId);
    const characters = SCENES[sceneId].interactions.filter(({ type }) => type === "npc" || type === "trainer");
    for (const character of characters) {
      const canTalk = reachable.some((position) => (
        ["up", "down", "left", "right"].some((facing) => (
          getContinuousInteraction(sceneId, position, facing)?.interactionId === character.id
        ))
      ));
      assert.equal(canTalk, true, `${character.id} must have a reachable conversation approach`);
    }
  }
});

test("Elverson residents never form an impassable crowd on the town paths", () => {
  const interactions = SCENES.town.interactions;
  const actorStates = createAdventureActorStates(interactions);
  const reachable = reachableQuarterTilePositions("town", {
    dynamicBlockers: getAdventureActorBlockers(actorStates),
    ignoreActorTiles: true,
  });

  const characters = interactions.filter(({ type }) => type === "npc" || type === "trainer");
  for (const character of characters) {
    const canTalk = reachable.some((position) => (
      ["up", "down", "left", "right"].some((facing) => (
        getContinuousInteraction("town", position, facing)?.interactionId === character.id
      ))
    ));
    assert.equal(canTalk, true, `${character.id} must stay reachable around the other residents`);
  }
});
