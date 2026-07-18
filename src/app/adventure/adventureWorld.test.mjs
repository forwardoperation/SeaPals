import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTINUOUS_MOVEMENT_DEFAULTS,
  SCENES,
  START_STATE,
  TILE_LEGEND,
  canOccupyContinuousPosition,
  canOccupyScenePosition,
  getContinuousInteraction,
  getDoorwayTransition,
  getInteraction,
  getSceneInteractions,
  getSceneMovementProfile,
  getTile,
  isInBounds,
  isWalkable,
  movePlayer,
  movePlayerContinuous,
} from "./adventureWorld.mjs";

test("world exposes the requested town and interior dimensions", () => {
  for (const sceneId of ["town", "coral-home", "deep-home", "academy-lab"]) {
    assert.ok(SCENES[sceneId], `${sceneId} should remain available`);
  }
  assert.equal(SCENES.town.width, 16);
  assert.equal(SCENES.town.height, 10);
  assert.equal(SCENES["coral-home"].width, 12);
  assert.equal(SCENES["coral-home"].height, 8);
  assert.equal(SCENES["deep-home"].width, 12);
  assert.equal(SCENES["deep-home"].height, 8);
  assert.equal(SCENES["academy-lab"].width, 14);
  assert.equal(SCENES["academy-lab"].height, 9);
  assert.ok(Object.values(SCENES).every((scene) => scene.tiles.every((row) => row.length === scene.width)));
});

test("legacy scenes inherit a frozen default movement profile", () => {
  const profile = getSceneMovementProfile("town");
  assert.deepEqual(profile, CONTINUOUS_MOVEMENT_DEFAULTS);
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(SCENES.town.routeId, null);
  assert.equal(canOccupyScenePosition("town", START_STATE.position), true);
  assert.equal(canOccupyScenePosition("town", { x: 5, y: 3 }), false);
  assert.throws(() => getSceneMovementProfile("missing"), /Unknown adventure scene/);
});

test("route tile symbols distinguish open water from navigation obstacles", () => {
  assert.deepEqual(TILE_LEGEND.o, { id: "water", walkable: true });
  assert.deepEqual(TILE_LEGEND.k, { id: "rock-shoal", walkable: false });
  assert.deepEqual(TILE_LEGEND.b, { id: "buoy", walkable: false });
  assert.deepEqual(TILE_LEGEND.H, { id: "dock-portal", walkable: false });
});

test("scene interaction snapshots are public, frozen, and omit authored coordinates", () => {
  const interactions = getSceneInteractions("academy-lab");
  const mentor = interactions.find(({ interactionId }) => interactionId === "interaction-academy-mentor");
  assert.deepEqual(mentor, {
    type: "trainer",
    interactionId: "interaction-academy-mentor",
    trainerId: "academy-mentor",
    npcId: "academy-mentor",
    conversationId: "conversation-shellshore-academy-mentor",
    encounterId: "encounter-shellshore-mentor-practice",
  });
  assert.equal(Object.hasOwn(mentor, "at"), false);
  assert.equal(Object.isFrozen(mentor), true);
  assert.equal(Object.isFrozen(interactions), true);
});

test("the first sea route and Sunpatch scenes are live world-engine scenes", () => {
  const route = SCENES["shellshore-sunpatch-sea"];
  assert.ok(route);
  assert.equal(route.routeId, "route-shellshore-sunpatch");
  assert.equal(route.kind, "route");
  assert.equal(route.theme, "shellshore-sunpatch-route");
  assert.equal(route.width, 16);
  assert.equal(route.height, 10);
  assert.deepEqual(route.spawn, { x: 1, y: 5 });

  for (const sceneId of [
    "sunpatch-cay-town",
    "sunpatch-field-station",
    "sunpatch-garden-home",
    "sunpatch-tide-hall",
  ]) {
    assert.ok(SCENES[sceneId], `${sceneId} should be available to the world engine`);
    assert.equal(canOccupyScenePosition(sceneId, SCENES[sceneId].spawn), true, `${sceneId} requires a safe spawn`);
  }
});

test("route movement uses its authored profile and navigation obstacles stay solid", () => {
  const routeId = "shellshore-sunpatch-sea";
  const scene = SCENES[routeId];
  const profile = getSceneMovementProfile(routeId);
  assert.equal(Object.isFrozen(profile), true);
  assert.deepEqual(profile, {
    ...CONTINUOUS_MOVEMENT_DEFAULTS,
    mode: "boat",
    speed: 3.2,
    radius: 0.28,
    maxStepDistance: 0.08,
  });
  assert.deepEqual(profile, scene.movement);
  assert.equal(canOccupyScenePosition(routeId, scene.spawn), true);
  assert.equal(
    canOccupyScenePosition(routeId, scene.spawn),
    canOccupyContinuousPosition(routeId, scene.spawn, profile.radius),
  );

  const positionsBySymbol = new Map();
  scene.tiles.forEach((row, y) => {
    [...row].forEach((symbol, x) => {
      if (!positionsBySymbol.has(symbol)) positionsBySymbol.set(symbol, { x, y });
    });
  });
  for (const symbol of ["o", "k", "b", "H"]) {
    assert.ok(positionsBySymbol.has(symbol), `route requires at least one ${symbol} tile`);
  }
  assert.equal(isWalkable(routeId, positionsBySymbol.get("o")), true);
  assert.equal(isWalkable(routeId, positionsBySymbol.get("k")), false);
  assert.equal(isWalkable(routeId, positionsBySymbol.get("b")), false);
  assert.equal(isWalkable(routeId, positionsBySymbol.get("H")), false);
  assert.equal(canOccupyScenePosition(routeId, positionsBySymbol.get("k")), false);
  assert.equal(canOccupyScenePosition(routeId, positionsBySymbol.get("b")), false);
  assert.equal(canOccupyScenePosition(routeId, positionsBySymbol.get("H")), false);

  const moved = movePlayerContinuous(routeId, scene.spawn, { x: 1, y: 0 }, 100);
  assert.ok(moved.x > scene.spawn.x);
  assert.ok(Math.abs(moved.x - scene.spawn.x - profile.speed * 0.1) < 1e-9);
  assert.equal(canOccupyScenePosition(routeId, moved), true);

  const buoy = positionsBySymbol.get("b");
  const approaches = [
    { start: { x: buoy.x - 1, y: buoy.y }, vector: { x: 1, y: 0 } },
    { start: { x: buoy.x + 1, y: buoy.y }, vector: { x: -1, y: 0 } },
    { start: { x: buoy.x, y: buoy.y - 1 }, vector: { x: 0, y: 1 } },
    { start: { x: buoy.x, y: buoy.y + 1 }, vector: { x: 0, y: -1 } },
  ];
  const approach = approaches.find(({ start }) => isWalkable(routeId, start));
  assert.ok(approach, "a buoy requires an open-water approach for collision testing");
  const stopped = movePlayerContinuous(routeId, approach.start, approach.vector, 1000);
  assert.equal(canOccupyScenePosition(routeId, stopped), true);
  assert.ok(
    Math.hypot(stopped.x - buoy.x, stopped.y - buoy.y) >= 0.5 + profile.radius - 1e-6,
    "boat collision must stop outside the buoy tile",
  );
});

test("board and dock interactions expose safe metadata but never auto-transition", () => {
  const shellshoreBoard = getInteraction("town", { x: 7, y: 8 }, "down");
  assert.deepEqual(shellshoreBoard, {
    type: "board",
    interactionId: "interaction-shellshore-board-boat",
    routeId: "route-shellshore-sunpatch",
    dockId: "shellshore-dock",
    targetScene: "shellshore-sunpatch-sea",
    spawn: { x: 1, y: 5 },
    facing: "right",
  });
  assert.equal(getDoorwayTransition("town", { x: 7, y: 8 }, "down"), null);

  const fromDock = getInteraction("shellshore-sunpatch-sea", { x: 1, y: 5 }, "left");
  assert.deepEqual(fromDock, {
    type: "dock",
    interactionId: "interaction-route-dock-shellshore",
    routeId: "route-shellshore-sunpatch",
    dockId: "shellshore-dock",
    endpoint: "from",
    targetScene: "town",
    spawn: { x: 7, y: 8 },
    facing: "up",
  });
  assert.equal(getDoorwayTransition("shellshore-sunpatch-sea", { x: 1, y: 5 }, "left"), null);

  const toDock = getInteraction("shellshore-sunpatch-sea", { x: 14, y: 5 }, "right");
  assert.equal(toDock.type, "dock");
  assert.equal(toDock.endpoint, "to");
  assert.equal(toDock.dockId, "sunpatch-dock");
  assert.equal(toDock.targetScene, "sunpatch-cay-town");
  assert.equal(getDoorwayTransition("shellshore-sunpatch-sea", { x: 14, y: 5 }, "right"), null);

  for (const interaction of [shellshoreBoard, fromDock, toDock]) {
    assert.equal(canOccupyScenePosition(interaction.targetScene, interaction.spawn), true);
  }
});

test("Sunpatch generic interactions expose only their authored public metadata", () => {
  const interactions = [
    ...getSceneInteractions("sunpatch-cay-town"),
    ...getSceneInteractions("sunpatch-field-station"),
    ...getSceneInteractions("sunpatch-garden-home"),
    ...getSceneInteractions("sunpatch-tide-hall"),
  ];

  for (const type of ["npc", "observation", "interpretation", "response"]) {
    assert.ok(interactions.some((interaction) => interaction.type === type), `Sunpatch requires a ${type} interaction`);
  }

  const npc = interactions.find((interaction) => interaction.type === "npc");
  assert.ok(npc.npcId);
  assert.ok(npc.conversationId);
  assert.equal(Object.hasOwn(npc, "at"), false);
  assert.equal(Object.hasOwn(npc, "spawn"), false);

  const observation = interactions.find((interaction) => interaction.type === "observation");
  assert.equal(observation.questId, "quest-sunpatch-reef-response");
  assert.ok(observation.observationId);
  assert.equal(Object.hasOwn(observation, "targetScene"), false);
  assert.equal(Object.hasOwn(observation, "spawn"), false);

  for (const type of ["interpretation", "response"]) {
    const interaction = interactions.find((candidate) => candidate.type === type);
    assert.equal(interaction.questId, "quest-sunpatch-reef-response");
    assert.ok(interaction.choiceSetId);
    assert.equal(Object.hasOwn(interaction, "targetScene"), false);
    assert.equal(Object.hasOwn(interaction, "spawn"), false);
  }
});

test("evidence, interpretation, and response stations remain manual interactions", () => {
  const cases = [
    ["sunpatch-cay-town", { x: 4, y: 4 }, "left", "observation"],
    ["sunpatch-field-station", { x: 3, y: 3 }, "up", "interpretation"],
    ["sunpatch-field-station", { x: 8, y: 3 }, "up", "response"],
  ];
  for (const [sceneId, position, facing, type] of cases) {
    assert.equal(canOccupyScenePosition(sceneId, position), true);
    assert.equal(getContinuousInteraction(sceneId, position, facing)?.type, type);
    assert.equal(getDoorwayTransition(sceneId, position, facing), null);
  }
});

test("every authored route, dock, and Sunpatch portal points to a safe arrival corridor", () => {
  const phaseFourSceneIds = [
    "town",
    "shellshore-sunpatch-sea",
    "sunpatch-cay-town",
    "sunpatch-field-station",
    "sunpatch-garden-home",
    "sunpatch-tide-hall",
  ];
  const transitionTypes = new Set(["enter", "exit", "board", "dock"]);

  for (const sceneId of phaseFourSceneIds) {
    assert.equal(canOccupyScenePosition(sceneId, SCENES[sceneId].spawn), true, `${sceneId} spawn must stay safe`);
    for (const interaction of getSceneInteractions(sceneId)) {
      if (!transitionTypes.has(interaction.type)) continue;
      assert.ok(SCENES[interaction.targetScene], `${interaction.interactionId} target scene must be live`);
      assert.equal(
        canOccupyScenePosition(interaction.targetScene, interaction.spawn),
        true,
        `${interaction.interactionId} must arrive on an open corridor`,
      );
    }
  }
});

test("start state places the player near the bottom-center town path", () => {
  assert.deepEqual(START_STATE, {
    sceneId: "town",
    position: { x: 7, y: 8 },
    facing: "up",
  });
  assert.equal(isWalkable(START_STATE.sceneId, START_STATE.position), true);
});

test("movement advances over walkable tiles and respects map bounds", () => {
  assert.deepEqual(movePlayer("town", { x: 7, y: 8 }, "up"), { x: 7, y: 7 });
  assert.deepEqual(movePlayer("town", { x: 7, y: 8 }, "down"), { x: 7, y: 8 });
  assert.equal(isInBounds("town", { x: 15, y: 9 }), true);
  assert.equal(isInBounds("town", { x: 16, y: 9 }), false);
  assert.equal(getTile("town", { x: -1, y: 0 }), null);
});

test("movement cannot cross buildings, doors, furniture, exits, or trainers", () => {
  assert.deepEqual(movePlayer("town", { x: 5, y: 4 }, "up"), { x: 5, y: 4 });
  assert.deepEqual(movePlayer("town", { x: 6, y: 4 }, "up"), { x: 6, y: 4 });
  assert.deepEqual(movePlayer("coral-home", { x: 4, y: 5 }, "left"), { x: 4, y: 5 });
  assert.deepEqual(movePlayer("coral-home", { x: 5, y: 6 }, "down"), { x: 5, y: 6 });
  assert.deepEqual(movePlayer("coral-home", { x: 5, y: 3 }, "up"), { x: 5, y: 3 });
  assert.equal(isWalkable("coral-home", { x: 6, y: 1 }), false);
  assert.equal(isWalkable("deep-home", { x: 6, y: 1 }), false);
  assert.equal(getTile("academy-lab", { x: 7, y: 2 }).id, "furniture");
  assert.equal(getTile("academy-lab", { x: 7, y: 3 }).id, "trainer");
  assert.equal(isWalkable("academy-lab", { x: 7, y: 3 }), false);
});

test("town doors enter the academy and two homes only when the player faces them", () => {
  assert.deepEqual(getInteraction("town", { x: 8, y: 2 }, "up"), {
    type: "enter",
    interactionId: "interaction-town-enter-academy",
    targetScene: "academy-lab",
    spawn: { x: 6, y: 7 },
    facing: "up",
  });
  assert.deepEqual(getInteraction("town", { x: 5, y: 4 }, "up"), {
    type: "enter",
    interactionId: "interaction-town-enter-coral-home",
    targetScene: "coral-home",
    spawn: { x: 5, y: 6 },
    facing: "up",
  });
  assert.deepEqual(getInteraction("town", { x: 11, y: 4 }, "up"), {
    type: "enter",
    interactionId: "interaction-town-enter-deep-home",
    targetScene: "deep-home",
    spawn: { x: 5, y: 6 },
    facing: "up",
  });
  assert.equal(getInteraction("town", { x: 5, y: 4 }, "left"), null);
  assert.equal(getInteraction("town", { x: 5, y: 5 }, "up"), null);
});

test("interior exits return the player outside the matching town door", () => {
  assert.deepEqual(getInteraction("academy-lab", { x: 6, y: 7 }, "down"), {
    type: "exit",
    interactionId: "interaction-academy-exit",
    targetScene: "town",
    spawn: { x: 8, y: 2 },
    facing: "down",
  });
  assert.deepEqual(getInteraction("coral-home", { x: 5, y: 6 }, "down"), {
    type: "exit",
    interactionId: "interaction-coral-home-exit",
    targetScene: "town",
    spawn: { x: 5, y: 4 },
    facing: "down",
  });
  assert.deepEqual(getInteraction("deep-home", { x: 5, y: 6 }, "down"), {
    type: "exit",
    interactionId: "interaction-deep-home-exit",
    targetScene: "town",
    spawn: { x: 11, y: 4 },
    facing: "down",
  });
});

test("facing an adjacent trainer yields the matching trainer interaction", () => {
  assert.deepEqual(getInteraction("academy-lab", { x: 7, y: 4 }, "up"), {
    type: "trainer",
    interactionId: "interaction-academy-mentor",
    trainerId: "academy-mentor",
    npcId: "academy-mentor",
    conversationId: "conversation-shellshore-academy-mentor",
    encounterId: "encounter-shellshore-mentor-practice",
  });
  assert.deepEqual(getInteraction("coral-home", { x: 5, y: 3 }, "up"), {
    type: "trainer",
    interactionId: "interaction-coral-home-marina",
    trainerId: "marina",
    npcId: "marina",
    conversationId: "conversation-shellshore-marina",
    encounterId: "encounter-shellshore-marina",
  });
  assert.deepEqual(getInteraction("deep-home", { x: 4, y: 2 }, "right"), {
    type: "trainer",
    interactionId: "interaction-deep-home-dorian",
    trainerId: "dorian",
    npcId: "dorian",
    conversationId: "conversation-shellshore-dorian",
    encounterId: "encounter-shellshore-dorian",
  });
  assert.equal(getInteraction("deep-home", { x: 5, y: 4 }, "up"), null);
});

test("invalid scene, position, and direction inputs fail clearly", () => {
  assert.throws(() => movePlayer("missing", { x: 0, y: 0 }, "up"), /Unknown adventure scene/);
  assert.throws(() => movePlayer("town", { x: 1.5, y: 2 }, "up"), /integer x and y/);
  assert.throws(() => movePlayer("town", { x: 7, y: 8 }, "north"), /Unknown movement direction/);
});

test("fractional player positions use a circular collision radius", () => {
  assert.equal(canOccupyContinuousPosition("town", { x: 7.35, y: 7.6 }), true);
  assert.equal(canOccupyContinuousPosition("town", { x: 5, y: 3 }), false);
  assert.equal(canOccupyContinuousPosition("town", { x: 5, y: 3.7 }), false);
  assert.equal(canOccupyContinuousPosition("town", { x: 5, y: 3.73 }), true);
  assert.equal(canOccupyContinuousPosition("town", { x: -0.4, y: 5 }), false);
  assert.equal(CONTINUOUS_MOVEMENT_DEFAULTS.radius, 0.22);
});

test("authored furniture rectangles block artwork while preserving real floor space", () => {
  const furnitureRegressionPoints = [
    ["coral-home", "coral-lower-right-display", { x: 8, y: 5 }],
    ["coral-home", "coral-lower-right-display", { x: 9, y: 5 }],
    ["deep-home", "deep-left-habitat-tank", { x: 1.675, y: 3.15 }],
    ["deep-home", "deep-lower-right-equipment", { x: 7, y: 6 }],
    ["academy-lab", "academy-top-left-cabinetry", { x: 3, y: 2 }],
    ["academy-lab", "academy-rear-bench", { x: 6, y: 2 }],
    ["academy-lab", "academy-left-aquarium-workstation", { x: 3, y: 5 }],
    ["academy-lab", "academy-right-aquarium-workstation", { x: 10, y: 5 }],
    ["academy-lab", "academy-lower-left-storage", { x: 1, y: 6.5 }],
  ];

  for (const [sceneId, rectangleId, position] of furnitureRegressionPoints) {
    const rectangle = SCENES[sceneId].collisionRects.find(({ id }) => id === rectangleId);
    assert.ok(rectangle, `expected ${sceneId} to expose ${rectangleId}`);
    assert.equal(canOccupyContinuousPosition(sceneId, position), false, `${rectangleId} should be solid`);
    assert.equal(Object.isFrozen(rectangle), true);
  }

  // This point is on a coarse `a` tile but lies outside the tank artwork.
  // Authored rectangles make the newly visible walking lane usable.
  assert.equal(getTile("deep-home", { x: 3, y: 4 }).symbol, "a");
  assert.equal(canOccupyContinuousPosition("deep-home", { x: 3.4, y: 3.5 }), true);

  const safeFloorAndSpawnPoints = [
    ["town", START_STATE.position],
    ["coral-home", SCENES["coral-home"].spawn],
    ["coral-home", { x: 5, y: 4 }],
    ["deep-home", SCENES["deep-home"].spawn],
    ["deep-home", { x: 5, y: 4 }],
    ["academy-lab", SCENES["academy-lab"].spawn],
    ["academy-lab", { x: 6, y: 5 }],
  ];
  for (const [sceneId, position] of safeFloorAndSpawnPoints) {
    assert.equal(canOccupyContinuousPosition(sceneId, position), true, `${sceneId} floor should stay open`);
  }
});

test("continuous movement scales with elapsed milliseconds and normalizes diagonals", () => {
  const straight = movePlayerContinuous("town", { x: 7, y: 8 }, { x: 0, y: -1 }, 125);
  assert.equal(straight.x, 7);
  assert.ok(Math.abs(straight.y - 7.5) < 1e-9);

  const start = { x: 6, y: 6 };
  const diagonal = movePlayerContinuous("coral-home", start, { x: 1, y: -1 }, 100);
  assert.ok(Math.abs(Math.hypot(diagonal.x - start.x, diagonal.y - start.y) - 0.4) < 1e-9);
});

test("continuous movement substeps prevent tunneling through a blocked exit", () => {
  const result = movePlayerContinuous("coral-home", { x: 5, y: 6 }, { x: 0, y: 1 }, 1000);
  assert.ok(result.y >= 6.19 && result.y <= 6.3, `expected to stop before exit, received y=${result.y}`);
  assert.equal(canOccupyContinuousPosition("coral-home", result), true);
});

test("axis-separated collision slides along authored furniture without tunneling", () => {
  const start = { x: 3.4, y: 3.5 };
  const result = movePlayerContinuous("deep-home", start, { x: -1, y: -1 }, 250);
  assert.ok(Math.abs(result.x - start.x) < 1e-9, `expected tank to block leftward travel, received x=${result.x}`);
  assert.ok(result.y < 2.9, `expected vertical slide, received y=${result.y}`);
  assert.equal(canOccupyContinuousPosition("deep-home", result), true);

  const longStep = movePlayerContinuous("deep-home", start, { x: -1, y: 0 }, 1000);
  assert.ok(longStep.x >= 3.31, `expected to stop before the tank, received x=${longStep.x}`);
  assert.equal(canOccupyContinuousPosition("deep-home", longStep), true);
});

test("continuous interactions allow small offsets but enforce facing and range", () => {
  assert.deepEqual(getContinuousInteraction("academy-lab", { x: 7.25, y: 4.1 }, "up"), {
    type: "trainer",
    interactionId: "interaction-academy-mentor",
    trainerId: "academy-mentor",
    npcId: "academy-mentor",
    conversationId: "conversation-shellshore-academy-mentor",
    encounterId: "encounter-shellshore-mentor-practice",
  });
  assert.deepEqual(getContinuousInteraction("town", { x: 5.3, y: 4.15 }, "up"), {
    type: "enter",
    interactionId: "interaction-town-enter-coral-home",
    targetScene: "coral-home",
    spawn: { x: 5, y: 6 },
    facing: "up",
  });
  assert.equal(getContinuousInteraction("town", { x: 5.3, y: 4.15 }, "right"), null);
  assert.equal(getContinuousInteraction("town", { x: 5, y: 4.5 }, "up"), null);
  assert.deepEqual(getContinuousInteraction("deep-home", { x: 5.4, y: 3.1 }, "up"), {
    type: "trainer",
    interactionId: "interaction-deep-home-dorian",
    trainerId: "dorian",
    npcId: "dorian",
    conversationId: "conversation-shellshore-dorian",
    encounterId: "encounter-shellshore-dorian",
  });
});

test("automatic doorway transitions recognize all six portals only at contact", () => {
  const doorwayCases = [
    ["town", { x: 8, y: 1.73 }, "up", {
      type: "enter",
      interactionId: "interaction-town-enter-academy",
      targetScene: "academy-lab",
      spawn: { x: 6, y: 7 },
      facing: "up",
    }],
    ["town", { x: 5, y: 3.73 }, "up", {
      type: "enter",
      interactionId: "interaction-town-enter-coral-home",
      targetScene: "coral-home",
      spawn: { x: 5, y: 6 },
      facing: "up",
    }],
    ["town", { x: 11, y: 3.73 }, "up", {
      type: "enter",
      interactionId: "interaction-town-enter-deep-home",
      targetScene: "deep-home",
      spawn: { x: 5, y: 6 },
      facing: "up",
    }],
    ["academy-lab", { x: 6, y: 7.27 }, "down", {
      type: "exit",
      interactionId: "interaction-academy-exit",
      targetScene: "town",
      spawn: { x: 8, y: 2 },
      facing: "down",
    }],
    ["coral-home", { x: 5, y: 6.27 }, "down", {
      type: "exit",
      interactionId: "interaction-coral-home-exit",
      targetScene: "town",
      spawn: { x: 5, y: 4 },
      facing: "down",
    }],
    ["deep-home", { x: 5, y: 6.27 }, "down", {
      type: "exit",
      interactionId: "interaction-deep-home-exit",
      targetScene: "town",
      spawn: { x: 11, y: 4 },
      facing: "down",
    }],
  ];

  for (const [sceneId, position, facing, expected] of doorwayCases) {
    assert.deepEqual(getDoorwayTransition(sceneId, position, facing), expected);
  }
});

test("automatic doorway transitions stay tight, directional, and portal-only", () => {
  assert.equal(getDoorwayTransition("town", { x: 5, y: 3.91 }, "up"), null);
  assert.equal(
    getDoorwayTransition("town", { x: 5.55, y: 3.73 }, "up")?.interactionId,
    "interaction-town-enter-coral-home",
  );
  assert.equal(getDoorwayTransition("town", { x: 5.66, y: 3.73 }, "up"), null);
  assert.equal(getDoorwayTransition("town", { x: 5, y: 3.73 }, "down"), null);

  const nearest = getDoorwayTransition(
    "town",
    { x: 8, y: 4 },
    "up",
    { range: 4, lateralTolerance: 4 },
  );
  assert.equal(nearest?.interactionId, "interaction-town-enter-academy");

  // Marina is within the same contact distance, but trainers remain manual interactions.
  assert.equal(getDoorwayTransition("coral-home", { x: 5, y: 2.73 }, "up"), null);
  assert.ok(getContinuousInteraction("coral-home", { x: 5, y: 2.73 }, "up"));
});

test("continuous helpers reject invalid numeric inputs without changing grid APIs", () => {
  assert.deepEqual(movePlayer("town", { x: 7, y: 8 }, "up"), { x: 7, y: 7 });
  assert.deepEqual(movePlayerContinuous("town", { x: 7.25, y: 8 }, { x: 0, y: 0 }, 16), { x: 7.25, y: 8 });
  assert.throws(
    () => movePlayerContinuous("town", { x: 7, y: 8 }, { x: 0, y: -1 }, -1),
    /Elapsed time must be a non-negative finite number/,
  );
  assert.throws(
    () => canOccupyContinuousPosition("town", { x: Number.NaN, y: 8 }),
    /finite x and y/,
  );
  assert.throws(
    () => getDoorwayTransition("town", { x: 5, y: 3.73 }, "north"),
    /Unknown facing direction/,
  );
  assert.throws(
    () => getDoorwayTransition("town", { x: 5, y: 3.73 }, "up", { range: 0 }),
    /Doorway range must be a positive finite number/,
  );
});
