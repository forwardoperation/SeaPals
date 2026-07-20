import assert from "node:assert/strict";
import test from "node:test";
import {
  ADVENTURE_ACTOR_DEFAULTS,
  createAdventureActorStates,
  getAdventureActorBlockers,
  getAdventureActorPositionOverrides,
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
  scale = 4,
} = {}) {
  const scene = SCENES[sceneId];
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

/**
 * Floods the scene with the same cardinal, sub-stepped movement calls used by
 * live play. This deliberately does not infer connectivity from occupancy:
 * every graph edge must be traversable by movePlayerContinuous itself.
 */
function reachableLiveContinuousPositions(sceneId, {
  dynamicBlockers = [],
  ignoreActorTiles = true,
  radius = 0.26,
  scale = 4,
} = {}) {
  const scene = SCENES[sceneId];
  const speed = 4;
  const stepDistance = 1 / scale;
  const elapsedMs = (stepDistance / speed) * 1000;
  const start = {
    x: Math.round(scene.spawn.x * scale),
    y: Math.round(scene.spawn.y * scale),
  };
  const queue = [start];
  const visited = new Set([`${start.x}:${start.y}`]);
  const reachable = [];

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const point = queue[cursor];
    const position = { x: point.x / scale, y: point.y / scale };
    reachable.push(position);

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const targetPoint = { x: point.x + dx, y: point.y + dy };
      const key = `${targetPoint.x}:${targetPoint.y}`;
      if (visited.has(key)) continue;
      const target = { x: targetPoint.x / scale, y: targetPoint.y / scale };
      if (
        target.x < 0
        || target.y < 0
        || target.x > scene.width - 1
        || target.y > scene.height - 1
      ) continue;

      const moved = movePlayerContinuous(
        sceneId,
        position,
        { x: dx, y: dy },
        elapsedMs,
        {
          dynamicBlockers,
          ignoreActorTiles,
          radius,
          speed,
          maxStepDistance: 0.04,
        },
      );
      if (Math.hypot(moved.x - target.x, moved.y - target.y) > POSITION_EPSILON) continue;
      visited.add(key);
      queue.push(targetPoint);
    }
  }

  return reachable;
}

const CARDINAL_FACINGS = Object.freeze(["up", "down", "left", "right"]);
const TOWN_PORTALS = Object.freeze([
  "interaction-elverson-enter-park-home",
  "interaction-elverson-enter-chestnut-home",
  "interaction-elverson-enter-aquarium",
]);
const BUILDING_ARCHETYPES = new Set([
  "blue-home",
  "tan-home",
  "green-home-door",
  "brick-school-door",
  "brick-civic-hall",
  "yellow-storefront",
  "green-awning-shop",
  "aquarium-door",
]);

function canReachPosition(reachable, target, tolerance = 0.15) {
  return reachable.some((position) => Math.hypot(
    position.x - target.x,
    position.y - target.y,
  ) <= tolerance);
}

function canReachPortal(reachable, interactionId) {
  return reachable.some((position) => CARDINAL_FACINGS.some((facing) => (
    getDoorwayTransition("town", position, facing)?.interactionId === interactionId
  )));
}

function hasOppositeLiveApproaches(reachable, residentPosition) {
  const minimumSeparation = 0.52;
  const maximumSeparation = 1.05;
  const lateralTolerance = 0.35;
  const sideIsReachable = (side) => reachable.some((position) => {
    const offsetX = position.x - residentPosition.x;
    const offsetY = position.y - residentPosition.y;
    if (side === "left" || side === "right") {
      const forward = side === "left" ? -offsetX : offsetX;
      return forward >= minimumSeparation
        && forward <= maximumSeparation
        && Math.abs(offsetY) <= lateralTolerance;
    }
    const forward = side === "up" ? -offsetY : offsetY;
    return forward >= minimumSeparation
      && forward <= maximumSeparation
      && Math.abs(offsetX) <= lateralTolerance;
  });

  return (
    sideIsReachable("left") && sideIsReachable("right")
  ) || (
    sideIsReachable("up") && sideIsReachable("down")
  );
}

function isHiddenBehindBuilding(position) {
  return SCENES.town.layeredObjects.some((object) => (
    BUILDING_ARCHETYPES.has(object.archetype)
    && position.x >= object.visualBounds.left
    && position.x <= object.visualBounds.right
    && position.y >= object.visualBounds.top
    && position.y <= object.visualBounds.bottom
    && position.y <= object.depthY + POSITION_EPSILON
  ));
}

test("continuous Elverson routes connect the crossroads start to all three doorways", () => {
  const routes = [
    {
      waypoints: [
        START_STATE.position,
        { x: 14, y: 7.4 },
        { x: 7, y: 7.4 },
        { x: 7, y: 6.8 },
      ],
      interactionId: "interaction-elverson-enter-park-home",
    },
    {
      waypoints: [
        START_STATE.position,
        { x: 14, y: 7.4 },
        { x: 17.6, y: 7.4 },
        { x: 17.6, y: 4.1 },
        { x: 18, y: 4.1 },
        { x: 18, y: 3.8 },
      ],
      interactionId: "interaction-elverson-enter-chestnut-home",
    },
    {
      waypoints: [
        START_STATE.position,
        { x: 14, y: 15.85 },
        { x: 16, y: 15.85 },
      ],
      interactionId: "interaction-elverson-enter-aquarium",
    },
  ];

  for (const { waypoints, interactionId } of routes) {
    const doorwayApproach = walkAxisRoute(waypoints);
    assert.equal(getDoorwayTransition("town", doorwayApproach, "up")?.interactionId, interactionId);
  }
});

test("the aquarium exit returns to the visible deck with a clear route into town", () => {
  const aquariumExit = SCENES["academy-lab"].interactions.find(
    ({ id }) => id === "interaction-academy-exit",
  );

  assert.deepEqual(aquariumExit.spawn, { x: 16, y: 15.85 });
  assert.equal(canOccupyContinuousPosition("town", aquariumExit.spawn), true);
  assert.equal(getDoorwayTransition("town", aquariumExit.spawn, "down"), null);
  const mainStreet = walkAxisRoute([
    aquariumExit.spawn,
    { x: 14, y: 15.85 },
    { x: 14, y: 10 },
  ]);
  assert.ok(
    Math.hypot(mainStreet.x - 14, mainStreet.y - 10) < POSITION_EPSILON,
    "the aquarium return route should reach Main Street",
  );
});

test("Main Street and Chestnut Street retain clear layered-object walking lanes", () => {
  const parallelLanes = [
    [{ x: 1, y: 7.4 }, { x: 28, y: 7.4 }],
    [{ x: 13.6, y: 1 }, { x: 13.6, y: 17.8 }],
    [{ x: 14.35, y: 1 }, { x: 14.35, y: 11 }, { x: 14.2, y: 11 }, { x: 14.2, y: 17.8 }],
  ];

  for (const lane of parallelLanes) walkAxisRoute(lane);
});

test("Elverson traversal treats reusable object bases and shoreline water as solid", () => {
  const solidArtwork = [
    ["west residence foundation", { x: 3, y: 5.2 }],
    ["park school foundation", { x: 8, y: 6.4 }],
    ["Chestnut residence foundation", { x: 17.2, y: 3.55 }],
    ["town hall foundation", { x: 23, y: 6.5 }],
    ["Main Street shop foundation", { x: 6, y: 10.1 }],
    ["west shallow water", { x: 3, y: 13 }],
    ["west deep water", { x: 8, y: 18 }],
    ["east shallow water", { x: 25, y: 13 }],
    ["east deep water", { x: 27, y: 18 }],
    ["fishing boat", { x: 11, y: 14.2 }],
    ["water south of the fishing platform", { x: 11, y: 18.1 }],
    ["aquarium wall", { x: 19, y: 15.15 }],
    ["water south of the aquarium deck", { x: 17, y: 16.8 }],
    ["park fountain basin", { x: 16.5, y: 5.45 }],
    ["park north bench feet", { x: 16.3, y: 4.1 }],
    ["park south bench feet", { x: 16.2, y: 6.4 }],
    ["park tree trunk", { x: 12, y: 5.5 }],
    ["east promenade bench feet", { x: 21, y: 11.5 }],
    ["Main Street west lamppost base", { x: 11.2, y: 7.8 }],
    ["far-east promenade lamppost base", { x: 26, y: 11.5 }],
    ["west Main Street planter box", { x: 12.3, y: 9.65 }],
    ["east Main Street planter box", { x: 15.5, y: 9.65 }],
    ["water west of the aquarium deck", { x: 15.1, y: 14.8 }],
    ["water east of the aquarium", { x: 21.2, y: 16 }],
    ["water behind the aquarium deck", { x: 15.2, y: 17 }],
  ];

  for (const [label, position] of solidArtwork) {
    assert.equal(canOccupyContinuousPosition("town", position), false, `${label} should be solid`);
  }

  walkAxisRoute([{ x: 14, y: 12 }, { x: 14, y: 15.85 }, { x: 16, y: 15.85 }]);
  walkAxisRoute([{ x: 14, y: 17.7 }, { x: 13.6, y: 17.7 }]);
});

test("Elverson's positive walkable regions reject sea beside every dock", () => {
  const dryDeck = [
    ["central pier", { x: 14, y: 13 }],
    ["central pier end", { x: 14, y: 17.8 }],
    ["fishing connector", { x: 13.1, y: 15 }],
    ["fishing platform", { x: 10.5, y: 16.8 }],
    ["aquarium apron", { x: 16, y: 15.85 }],
  ];
  const sea = [
    ["west of the central pier", { x: 13.05, y: 13 }],
    ["east of the central pier", { x: 14.95, y: 13 }],
    ["past the central pier end", { x: 14, y: 18.2 }],
    ["west of the fishing platform", { x: 9.3, y: 16.8 }],
    ["north of the fishing platform", { x: 10.5, y: 15.6 }],
    ["south of the fishing platform", { x: 10.5, y: 18.1 }],
    ["west of the fishing connector", { x: 12.4, y: 15 }],
    ["east of the aquarium apron", { x: 21.2, y: 16 }],
    ["south of the aquarium apron", { x: 17, y: 16.8 }],
  ];

  for (const [label, position] of dryDeck) {
    assert.equal(canOccupyContinuousPosition("town", position), true, `${label} should be dry`);
  }
  for (const [label, position] of sea) {
    assert.equal(canOccupyContinuousPosition("town", position), false, `${label} should be water`);
  }
});

test("Elverson landmarks leave intentional footpaths around their precise hitboxes", () => {
  const openArtwork = [
    ["Main and Chestnut crossroads", { x: 14, y: 10 }],
    ["Main Street lane", { x: 14, y: 7 }],
    ["west park passage", { x: 10.6, y: 5 }],
    ["east park passage", { x: 20, y: 4 }],
    ["promenade beside the west planter", { x: 12, y: 10.65 }],
    ["paved pocket beside the gold shop", { x: 19.75, y: 10.5 }],
    ["space visually behind the park tree", { x: 12, y: 4.5 }],
    ["aquarium doorway deck", { x: 16, y: 15.85 }],
    ["central pier", { x: 14, y: 17.7 }],
  ];

  for (const [label, position] of openArtwork) {
    assert.equal(canOccupyContinuousPosition("town", position), true, `${label} should stay open`);
  }
});

test("every Elverson resident anchor fits on visible walkable ground", () => {
  const characters = SCENES.town.interactions.filter(({ type }) => type === "npc" || type === "trainer");
  for (const character of characters) {
    assert.equal(
      canOccupyContinuousPosition(
        "town",
        character.at,
        ADVENTURE_ACTOR_DEFAULTS.radius,
        { ignoreActorTiles: true },
      ),
      true,
      `${character.id} must stand clear of scenery`,
    );
    for (const waypoint of character.patrol?.waypoints ?? []) {
      assert.equal(
        canOccupyContinuousPosition(
          "town",
          waypoint,
          ADVENTURE_ACTOR_DEFAULTS.radius,
          { ignoreActorTiles: true },
        ),
        true,
        `${character.id} patrol waypoint (${waypoint.x}, ${waypoint.y}) must stand clear of scenery`,
      );
    }
  }
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
    scale: 5,
  });
  const positionOverrides = getAdventureActorPositionOverrides(actorStates);

  const characters = interactions.filter(({ type }) => type === "npc" || type === "trainer");
  for (const character of characters) {
    const canTalk = reachable.some((position) => (
      CARDINAL_FACINGS.some((facing) => (
        getContinuousInteraction("town", position, facing, {
          positionOverrides,
        })?.interactionId === character.id
      ))
    ));
    assert.equal(canTalk, true, `${character.id} must stay reachable around the other residents`);
  }
});

test("all Elverson portals and street branches stay reachable at resident anchors and patrol ends", () => {
  const interactions = SCENES.town.interactions;
  const anchorStates = createAdventureActorStates(interactions);
  const residentConfigurations = [{ label: "resident anchors", states: anchorStates }];

  for (const interaction of interactions) {
    for (const waypoint of interaction.patrol?.waypoints ?? []) {
      const anchor = anchorStates[interaction.id]?.position;
      if (!anchor || Math.hypot(anchor.x - waypoint.x, anchor.y - waypoint.y) < POSITION_EPSILON) {
        continue;
      }
      residentConfigurations.push({
        label: `${interaction.id} at patrol endpoint (${waypoint.x}, ${waypoint.y})`,
        states: {
          ...anchorStates,
          [interaction.id]: {
            ...anchorStates[interaction.id],
            position: { ...waypoint },
          },
        },
      });
    }
  }

  const publicBranches = [
    ["west Main Street", { x: 1.4, y: 7.4 }],
    ["east Main Street", { x: 28, y: 7.4 }],
    ["central pier end", { x: 14, y: 17.6 }],
    ["fishing platform", { x: 11, y: 17.2 }],
    ["aquarium apron", { x: 19, y: 15.8 }],
  ];

  for (const { label, states } of residentConfigurations) {
    const reachable = reachableQuarterTilePositions("town", {
      dynamicBlockers: getAdventureActorBlockers(states),
      ignoreActorTiles: true,
      scale: 5,
    });

    for (const portalId of TOWN_PORTALS) {
      assert.equal(canReachPortal(reachable, portalId), true, `${portalId} must be reachable with ${label}`);
    }
    for (const [branchName, position] of publicBranches) {
      assert.equal(
        canReachPosition(reachable, position),
        true,
        `${branchName} must be reachable with ${label}`,
      );
    }
  }
});

test("live cardinal movement clears the waterfront furniture cluster without crossing residents", () => {
  const actorStates = createAdventureActorStates(SCENES.town.interactions);
  const dynamicBlockers = getAdventureActorBlockers(actorStates);
  const movementOptions = {
    dynamicBlockers,
    ignoreActorTiles: true,
    // A small comfort margin beyond the live 0.22 player radius ensures this
    // is a readable lane, not a sub-pixel squeeze that only the test can find.
    radius: 0.26,
    speed: 4,
    maxStepDistance: 0.03,
  };
  const west = { x: 1.8, y: 10.95 };
  const east = { x: 27.7, y: 10.95 };
  const eastbound = movePlayerContinuous(
    "town",
    west,
    { x: 1, y: 0 },
    ((east.x - west.x) / movementOptions.speed) * 1000,
    movementOptions,
  );
  const westbound = movePlayerContinuous(
    "town",
    east,
    { x: -1, y: 0 },
    ((east.x - west.x) / movementOptions.speed) * 1000,
    movementOptions,
  );

  assert.ok(
    Math.hypot(eastbound.x - east.x, eastbound.y - east.y) < POSITION_EPSILON,
    `eastbound waterfront walk stopped at (${eastbound.x}, ${eastbound.y})`,
  );
  assert.ok(
    Math.hypot(westbound.x - west.x, westbound.y - west.y) < POSITION_EPSILON,
    `westbound waterfront walk stopped at (${westbound.x}, ${westbound.y})`,
  );
  for (const blocker of dynamicBlockers) {
    assert.equal(
      canOccupyContinuousPosition("town", blocker.position, movementOptions.radius, {
        dynamicBlockers,
        ignoreActorTiles: true,
      }),
      false,
      `${blocker.id} must remain a solid body`,
    );
  }
});

test("live cardinal routes pass every resident at anchors and every patrol endpoint", () => {
  const interactions = SCENES.town.interactions;
  const anchorStates = createAdventureActorStates(interactions);
  const anchorPositionOverrides = getAdventureActorPositionOverrides(anchorStates);
  const anchorReachable = reachableLiveContinuousPositions("town", {
    dynamicBlockers: getAdventureActorBlockers(anchorStates),
  });

  for (const [interactionId, actor] of Object.entries(anchorStates)) {
    assert.equal(
      isHiddenBehindBuilding(actor.position),
      false,
      `${interactionId} must not be depth-sorted behind a building at its anchor`,
    );
    assert.equal(
      hasOppositeLiveApproaches(anchorReachable, actor.position),
      true,
      `${interactionId} must have a live cardinal route past both sides of its anchor`,
    );
    assert.equal(
      anchorReachable.some((position) => (
        !isHiddenBehindBuilding(position)
        && CARDINAL_FACINGS.some((facing) => (
          getContinuousInteraction("town", position, facing, {
            positionOverrides: anchorPositionOverrides,
          })?.interactionId === interactionId
        ))
      )),
      true,
      `${interactionId} must have a visible, live-reachable conversation approach`,
    );
  }

  for (const interaction of interactions.filter(({ patrol }) => patrol)) {
    for (const waypoint of interaction.patrol.waypoints) {
      const anchor = anchorStates[interaction.id].position;
      if (Math.hypot(anchor.x - waypoint.x, anchor.y - waypoint.y) < POSITION_EPSILON) continue;
      const endpointStates = {
        ...anchorStates,
        [interaction.id]: {
          ...anchorStates[interaction.id],
          position: { ...waypoint },
        },
      };
      const endpointReachable = reachableLiveContinuousPositions("town", {
        dynamicBlockers: getAdventureActorBlockers(endpointStates),
      });
      assert.equal(
        isHiddenBehindBuilding(waypoint),
        false,
        `${interaction.id} endpoint (${waypoint.x}, ${waypoint.y}) must not hide behind a building`,
      );
      assert.equal(
        hasOppositeLiveApproaches(endpointReachable, waypoint),
        true,
        `${interaction.id} must have a live cardinal route past endpoint (${waypoint.x}, ${waypoint.y})`,
      );
    }
  }
});
