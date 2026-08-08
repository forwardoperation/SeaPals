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
import {
  ELVERSON_TOWN_DIMENSIONS,
  ELVERSON_TOWN_PORTALS,
  ELVERSON_TOWN_SAFE_POSITIONS,
} from "./adventureElversonTownLayout.mjs";
import { ELVERSON_RELEASE_SCOPE } from "./adventureReleaseScope.mjs";

const ELVERSON_PORTAL_EXPECTATIONS = Object.freeze([
  Object.freeze({
    id: "interaction-elverson-enter-player-home",
    targetScene: "player-home",
    interiorSpawn: Object.freeze({ x: 7, y: 4 }),
    exitId: "interaction-player-home-exit",
  }),
  Object.freeze({
    id: "interaction-elverson-enter-reef-house",
    targetScene: "coral-home",
    interiorSpawn: Object.freeze({ x: 5, y: 6 }),
    exitId: "interaction-coral-home-exit",
  }),
  Object.freeze({
    id: "interaction-elverson-enter-deep-house",
    targetScene: "deep-home",
    interiorSpawn: Object.freeze({ x: 5, y: 6 }),
    exitId: "interaction-deep-home-exit",
  }),
  Object.freeze({
    id: "interaction-elverson-enter-oceanic-house",
    targetScene: "elverson-oceanic-home",
    interiorSpawn: Object.freeze({ x: 5, y: 6 }),
    exitId: "interaction-elverson-oceanic-home-exit",
  }),
  Object.freeze({
    id: "interaction-elverson-enter-schoolhouse",
    targetScene: "elverson-red-schoolhouse",
    interiorSpawn: Object.freeze({ x: 6, y: 7 }),
    exitId: "interaction-elverson-red-schoolhouse-exit",
  }),
  Object.freeze({
    id: "interaction-elverson-enter-hybrid-house",
    targetScene: "elverson-hybrid-home",
    interiorSpawn: Object.freeze({ x: 5, y: 6 }),
    exitId: "interaction-elverson-hybrid-home-exit",
  }),
  Object.freeze({
    id: "interaction-elverson-enter-research-lab",
    targetScene: "elverson-marine-research-lab",
    interiorSpawn: Object.freeze({ x: 6, y: 7 }),
    exitId: "interaction-elverson-marine-research-lab-exit",
  }),
  Object.freeze({
    id: "interaction-elverson-enter-supply-company",
    targetScene: "elverson-supply-company",
    interiorSpawn: Object.freeze({ x: 6, y: 7 }),
    exitId: "interaction-elverson-supply-company-exit",
  }),
  Object.freeze({
    id: "interaction-elverson-enter-aquarium",
    targetScene: "academy-lab",
    interiorSpawn: Object.freeze({ x: 7, y: 7 }),
    exitId: "interaction-academy-exit",
  }),
]);

const ELVERSON_AQUARIUM_PORTAL_ID = "interaction-elverson-enter-aquarium";

function getElversonPortal(portalId) {
  return ELVERSON_TOWN_PORTALS.find(({ id }) => id === portalId);
}

function getElversonExteriorApproach(portal) {
  return portal.id === ELVERSON_AQUARIUM_PORTAL_ID
    ? portal.exteriorSpawn
    : { x: portal.doorway.x, y: portal.doorway.y + 0.73 };
}

function assertWalkablePolyline(sceneId, points, label) {
  for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
    const start = points[pointIndex - 1];
    const end = points[pointIndex];
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const steps = Math.max(1, Math.ceil(distance / 0.05));
    for (let step = 0; step <= steps; step += 1) {
      const ratio = step / steps;
      const position = {
        x: start.x + ((end.x - start.x) * ratio),
        y: start.y + ((end.y - start.y) * ratio),
      };
      assert.equal(
        canOccupyContinuousPosition(sceneId, position),
        true,
        `${label} must remain open near ${position.x.toFixed(2)},${position.y.toFixed(2)}`,
      );
    }
  }
}

test("world exposes the 42-by-28 Elverson v3 town, nine public interiors, and the upstairs bedroom", () => {
  for (const sceneId of ELVERSON_RELEASE_SCOPE.sceneIds) {
    assert.ok(SCENES[sceneId], `${sceneId} should remain available`);
  }
  assert.equal(SCENES.town.name, "Elverson");
  assert.deepEqual(ELVERSON_TOWN_DIMENSIONS, { width: 42, height: 28 });
  assert.equal(SCENES.town.width, ELVERSON_TOWN_DIMENSIONS.width);
  assert.equal(SCENES.town.height, ELVERSON_TOWN_DIMENSIONS.height);
  assert.equal(SCENES.town.artPath, "/images/adventure/elverson-ground-v3.webp");
  assert.equal(SCENES.town.layeredObjects.length, 9);
  assert.ok(SCENES.town.walkableRegions.some(({ id }) => id === "central-pier"));
  assert.ok(SCENES.town.walkableRegions.some(({ id }) => id === "wharf-platform"));
  assert.ok(SCENES.town.walkableRegions.some(({ id }) => id === "aquarium-platform"));
  assert.equal(SCENES["player-bedroom"].width, 15);
  assert.equal(SCENES["player-bedroom"].height, 10);
  assert.equal(SCENES["player-home"].width, 15);
  assert.equal(SCENES["player-home"].height, 10);
  assert.equal(SCENES["coral-home"].width, 12);
  assert.equal(SCENES["coral-home"].height, 8);
  assert.equal(SCENES["deep-home"].width, 12);
  assert.equal(SCENES["deep-home"].height, 8);
  assert.equal(SCENES["elverson-oceanic-home"].width, 12);
  assert.equal(SCENES["elverson-oceanic-home"].height, 8);
  assert.equal(SCENES["elverson-hybrid-home"].width, 12);
  assert.equal(SCENES["elverson-hybrid-home"].height, 8);
  for (const sceneId of [
    "elverson-red-schoolhouse",
    "elverson-marine-research-lab",
    "elverson-supply-company",
  ]) {
    assert.equal(SCENES[sceneId].width, 14);
    assert.equal(SCENES[sceneId].height, 9);
  }
  assert.equal(SCENES["academy-lab"].width, 14);
  assert.equal(SCENES["academy-lab"].height, 9);
  assert.ok(Object.values(SCENES).every((scene) => scene.tiles.every((row) => row.length === scene.width)));
});

test("Elverson inherits a frozen continuous walking profile", () => {
  const profile = getSceneMovementProfile("town");
  assert.deepEqual(profile, CONTINUOUS_MOVEMENT_DEFAULTS);
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(SCENES.town.routeId, null);
  assert.equal(canOccupyScenePosition("town", START_STATE.position), true);
  assert.equal(canOccupyScenePosition("town", { x: 4, y: 3 }), false);
  assert.equal(canOccupyScenePosition("town", ELVERSON_TOWN_SAFE_POSITIONS.playerHomeExterior), true);
  assert.throws(() => getSceneMovementProfile("missing"), /Unknown adventure scene/);
});

test("town shorelines keep walkers on the visible central piers", () => {
  const shorelineCases = [
    "sunpatch-cay-town",
    "brackwater-landing-town",
    "current-commons-town",
    "kelpwatch-island-town",
    "trenchlight-station-town",
    "champions-wake-town",
  ];

  for (const sceneId of shorelineCases) {
    const scene = SCENES[sceneId];
    for (const position of [{ x: 3, y: 8 }, { x: 12, y: 8 }]) {
      assert.equal(
        canOccupyContinuousPosition(sceneId, position),
        false,
        `${sceneId} water at ${position.x},${position.y} must stay solid`,
      );
    }
    assert.equal(canOccupyScenePosition(sceneId, scene.spawn), true, `${sceneId} spawn must stay safe`);
    assertWalkablePolyline(
      sceneId,
      [scene.spawn, { x: 7, y: 7 }],
      `${sceneId} central pier approach`,
    );
  }
});

test("Elverson's authored shoreline is solid outside the public pier corridor", () => {
  const water = [
    { x: 2, y: 19 },
    { x: 8, y: 23 },
    { x: 34, y: 19 },
    { x: 38, y: 23 },
  ];
  for (const position of water) {
    assert.equal(
      canOccupyContinuousPosition("town", position),
      false,
      `shore water at ${position.x},${position.y} must block walkers`,
    );
  }

  assertWalkablePolyline(
    "town",
    [
      ELVERSON_TOWN_SAFE_POSITIONS.shellshoreDock,
      { x: 20, y: 22.22 },
      { x: 24.54, y: 22.22 },
      ELVERSON_TOWN_SAFE_POSITIONS.aquariumExterior,
    ],
    "Elverson public pier and aquarium approach",
  );
  assert.equal(canOccupyContinuousPosition("town", { x: 28, y: 22 }), false);
});

test("every authored character anchor stays inside its scene grid", () => {
  const characterInteractions = Object.values(SCENES).flatMap((scene) => (
    scene.interactions
      .filter(({ type }) => type === "npc" || type === "trainer")
      .map((interaction) => ({ scene, interaction }))
  ));

  assert.ok(characterInteractions.length > 30);
  for (const { scene, interaction } of characterInteractions) {
    assert.equal(
      Number.isFinite(interaction.at.x)
        && Number.isFinite(interaction.at.y)
        && interaction.at.x >= -0.5
        && interaction.at.x <= scene.width - 0.5
        && interaction.at.y >= -0.5
        && interaction.at.y <= scene.height - 0.5,
      true,
      `${interaction.id} must stay in bounds`,
    );
    assert.ok(Number.isFinite(interaction.at.x) && Number.isFinite(interaction.at.y));
  }
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

test("dormant sea routes and archived towns remain structurally available to the world engine", () => {
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
    "sunpatch-brackwater-sea",
    "brackwater-landing-town",
    "brackwater-water-lab",
    "brackwater-mangrove-home",
    "brackwater-tide-hall",
    "brackwater-current-sea",
    "current-commons-town",
    "current-navigation-lab",
    "current-navigator-home",
    "current-tide-hall",
    "current-kelpwatch-sea",
    "kelpwatch-island-town",
    "kelpwatch-ecology-lab",
    "kelpwatch-diver-home",
    "kelpwatch-tide-hall",
  ]) {
    assert.ok(SCENES[sceneId], `${sceneId} should be available to the world engine`);
    assert.equal(canOccupyScenePosition(sceneId, SCENES[sceneId].spawn), true, `${sceneId} requires a safe spawn`);
  }

  const brackwaterRoute = SCENES["sunpatch-brackwater-sea"];
  assert.equal(brackwaterRoute.routeId, "route-sunpatch-brackwater");
  assert.equal(brackwaterRoute.kind, "route");
  assert.equal(brackwaterRoute.theme, "sunpatch-brackwater-route");
  assert.equal(brackwaterRoute.artPath, "/images/adventure/sunpatch-brackwater-route.png");
  assert.equal(brackwaterRoute.width, 16);
  assert.equal(brackwaterRoute.height, 10);
  assert.equal(SCENES["brackwater-landing-town"].artPath, "/images/adventure/brackwater-landing.png");

  const currentRoute = SCENES["brackwater-current-sea"];
  assert.equal(currentRoute.routeId, "route-brackwater-current");
  assert.equal(currentRoute.kind, "route");
  assert.equal(currentRoute.theme, "brackwater-current-route");
  assert.equal(currentRoute.artPath, "/images/adventure/brackwater-current-route.png");
  assert.equal(currentRoute.width, 16);
  assert.equal(currentRoute.height, 10);
  assert.equal(SCENES["current-commons-town"].artPath, "/images/adventure/current-commons.png");

  const kelpwatchRoute = SCENES["current-kelpwatch-sea"];
  assert.equal(kelpwatchRoute.routeId, "route-current-kelpwatch");
  assert.equal(kelpwatchRoute.kind, "route");
  assert.equal(kelpwatchRoute.theme, "current-kelpwatch-route");
  assert.equal(kelpwatchRoute.artPath, "/images/adventure/current-kelpwatch-route.png");
  assert.equal(kelpwatchRoute.width, 16);
  assert.equal(kelpwatchRoute.height, 10);
  assert.equal(SCENES["kelpwatch-island-town"].artPath, "/images/adventure/kelpwatch-island.png");
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

test("Elverson offers no board prompt while dormant route docks retain their metadata", () => {
  const townTransitions = SCENES.town.interactions.filter(({ type }) => (
    ["board", "dock"].includes(type)
  ));
  assert.deepEqual(townTransitions, []);
  assert.equal(getInteraction("town", { x: 20, y: 27 }, "down"), null);
  assert.equal(getDoorwayTransition("town", { x: 20, y: 27 }, "down"), null);

  const fromDock = getInteraction("shellshore-sunpatch-sea", { x: 1, y: 5 }, "left");
  assert.deepEqual(fromDock, {
    type: "dock",
    interactionId: "interaction-route-dock-shellshore",
    routeId: "route-shellshore-sunpatch",
    dockId: "shellshore-dock",
    endpoint: "from",
    targetScene: "town",
    spawn: { x: 20, y: 17 },
    facing: "down",
  });
  assert.equal(getDoorwayTransition("shellshore-sunpatch-sea", { x: 1, y: 5 }, "left"), null);

  const toDock = getInteraction("shellshore-sunpatch-sea", { x: 14, y: 5 }, "right");
  assert.equal(toDock.type, "dock");
  assert.equal(toDock.endpoint, "to");
  assert.equal(toDock.dockId, "sunpatch-dock");
  assert.equal(toDock.targetScene, "sunpatch-cay-town");
  assert.equal(getDoorwayTransition("shellshore-sunpatch-sea", { x: 14, y: 5 }, "right"), null);

  assert.equal(canOccupyScenePosition("shellshore-sunpatch-sea", SCENES["shellshore-sunpatch-sea"].spawn), true);
  assert.deepEqual(ELVERSON_RELEASE_SCOPE.routeIds, []);
});

test("Sunpatch exposes two distinct departure docks and the Brackwater route docks safely", () => {
  const shellshoreBoard = getInteraction("sunpatch-cay-town", { x: 7, y: 8 }, "down");
  const brackwaterBoard = getInteraction("sunpatch-cay-town", { x: 8, y: 8 }, "down");
  assert.equal(shellshoreBoard.routeId, "route-shellshore-sunpatch");
  assert.equal(shellshoreBoard.dockId, "sunpatch-dock");
  assert.equal(brackwaterBoard.routeId, "route-sunpatch-brackwater");
  assert.equal(brackwaterBoard.dockId, "sunpatch-brackwater-dock");
  assert.equal(brackwaterBoard.targetScene, "sunpatch-brackwater-sea");
  assert.deepEqual(brackwaterBoard.spawn, { x: 1, y: 5 });

  const fromDock = getInteraction("sunpatch-brackwater-sea", { x: 1, y: 5 }, "left");
  const toDock = getInteraction("sunpatch-brackwater-sea", { x: 14, y: 5 }, "right");
  assert.equal(fromDock.endpoint, "from");
  assert.equal(fromDock.targetScene, "sunpatch-cay-town");
  assert.equal(toDock.endpoint, "to");
  assert.equal(toDock.targetScene, "brackwater-landing-town");
  assert.equal(getDoorwayTransition("sunpatch-brackwater-sea", { x: 14, y: 5 }, "right"), null);

  for (const interaction of [shellshoreBoard, brackwaterBoard, fromDock, toDock]) {
    assert.equal(canOccupyScenePosition(interaction.targetScene, interaction.spawn), true);
  }
});

test("Brackwater exposes two distinct docks and the Current Commons route docks safely", () => {
  const sunpatchBoard = getInteraction("brackwater-landing-town", { x: 7, y: 8 }, "down");
  const currentBoard = getInteraction("brackwater-landing-town", { x: 8, y: 8 }, "down");
  assert.equal(sunpatchBoard.routeId, "route-sunpatch-brackwater");
  assert.equal(sunpatchBoard.dockId, "brackwater-dock");
  assert.equal(currentBoard.routeId, "route-brackwater-current");
  assert.equal(currentBoard.dockId, "brackwater-current-dock");
  assert.equal(currentBoard.targetScene, "brackwater-current-sea");
  assert.deepEqual(currentBoard.spawn, { x: 1, y: 5 });

  const fromDock = getInteraction("brackwater-current-sea", { x: 1, y: 5 }, "left");
  const toDock = getInteraction("brackwater-current-sea", { x: 14, y: 5 }, "right");
  assert.equal(fromDock.endpoint, "from");
  assert.equal(fromDock.targetScene, "brackwater-landing-town");
  assert.equal(toDock.endpoint, "to");
  assert.equal(toDock.targetScene, "current-commons-town");
  assert.equal(getDoorwayTransition("brackwater-current-sea", { x: 14, y: 5 }, "right"), null);

  for (const interaction of [sunpatchBoard, currentBoard, fromDock, toDock]) {
    assert.equal(canOccupyScenePosition(interaction.targetScene, interaction.spawn), true);
  }
});

test("Current Commons exposes a separate Kelpwatch dock and the Kelpwatch route docks safely", () => {
  const brackwaterBoard = getInteraction("current-commons-town", { x: 7, y: 8 }, "down");
  const kelpwatchBoard = getInteraction("current-commons-town", { x: 8, y: 8 }, "down");
  assert.equal(brackwaterBoard.routeId, "route-brackwater-current");
  assert.equal(brackwaterBoard.dockId, "current-commons-dock");
  assert.equal(kelpwatchBoard.routeId, "route-current-kelpwatch");
  assert.equal(kelpwatchBoard.dockId, "current-kelpwatch-dock");
  assert.equal(kelpwatchBoard.targetScene, "current-kelpwatch-sea");
  assert.deepEqual(kelpwatchBoard.spawn, { x: 1, y: 5 });

  const fromDock = getInteraction("current-kelpwatch-sea", { x: 1, y: 5 }, "left");
  const toDock = getInteraction("current-kelpwatch-sea", { x: 14, y: 5 }, "right");
  assert.equal(fromDock.endpoint, "from");
  assert.equal(fromDock.targetScene, "current-commons-town");
  assert.equal(toDock.endpoint, "to");
  assert.equal(toDock.targetScene, "kelpwatch-island-town");
  assert.equal(getDoorwayTransition("current-kelpwatch-sea", { x: 14, y: 5 }, "right"), null);

  const returnBoard = getInteraction("kelpwatch-island-town", { x: 7, y: 8 }, "down");
  assert.equal(returnBoard.routeId, "route-current-kelpwatch");
  assert.equal(returnBoard.dockId, "kelpwatch-dock");
  assert.equal(returnBoard.targetScene, "current-kelpwatch-sea");
  assert.deepEqual(returnBoard.spawn, { x: 14, y: 5 });
  assert.equal(returnBoard.facing, "left");

  for (const interaction of [brackwaterBoard, kelpwatchBoard, fromDock, toDock, returnBoard]) {
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

test("Brackwater exposes NPC, water-evidence, interpretation, and response interactions", () => {
  const interactions = [
    ...getSceneInteractions("brackwater-landing-town"),
    ...getSceneInteractions("brackwater-water-lab"),
    ...getSceneInteractions("brackwater-mangrove-home"),
    ...getSceneInteractions("brackwater-tide-hall"),
  ];
  for (const type of ["npc", "trainer", "observation", "interpretation", "response"]) {
    assert.ok(interactions.some((interaction) => interaction.type === type), `Brackwater requires ${type}`);
  }
  assert.deepEqual(
    interactions
      .filter((interaction) => interaction.type === "observation")
      .map((interaction) => interaction.observationId),
    [
      "incoming-tide-channel",
      "rain-fed-creek-mouth",
      "mangrove-low-tide",
      "repeat-runoff-low-oxygen",
    ],
  );
  const interpretation = interactions.find((interaction) => interaction.type === "interpretation");
  const response = interactions.find((interaction) => interaction.type === "response");
  assert.equal(interpretation.questId, "quest-brackwater-water-clues");
  assert.equal(interpretation.choiceSetId, "brackwater-water-interpretation");
  assert.equal(response.choiceSetId, "brackwater-runoff-response");
});

test("Current Commons exposes NPC, current-evidence, interpretation, and response interactions", () => {
  const interactions = [
    ...getSceneInteractions("current-commons-town"),
    ...getSceneInteractions("current-navigation-lab"),
    ...getSceneInteractions("current-navigator-home"),
    ...getSceneInteractions("current-tide-hall"),
  ];
  for (const type of ["npc", "trainer", "observation", "interpretation", "response"]) {
    assert.ok(interactions.some((interaction) => interaction.type === type), `Current Commons requires ${type}`);
  }
  assert.deepEqual(
    interactions
      .filter((interaction) => interaction.type === "observation")
      .map((interaction) => interaction.observationId),
    [
      "source-port-loss-report",
      "surface-drifter-track",
      "wildlife-overlap-zone",
      "downstream-gear-accumulation",
    ],
  );
  const interpretation = interactions.find((interaction) => interaction.type === "interpretation");
  const response = interactions.find((interaction) => interaction.type === "response");
  assert.equal(interpretation.questId, "quest-current-ghost-gear");
  assert.equal(interpretation.choiceSetId, "current-connection-interpretation");
  assert.equal(response.choiceSetId, "current-gear-response");
});

test("Kelpwatch exposes NPC, food-web evidence, interpretation, and response interactions", () => {
  const interactions = [
    ...getSceneInteractions("kelpwatch-island-town"),
    ...getSceneInteractions("kelpwatch-ecology-lab"),
    ...getSceneInteractions("kelpwatch-diver-home"),
    ...getSceneInteractions("kelpwatch-tide-hall"),
  ];
  for (const type of ["npc", "trainer", "observation", "interpretation", "response"]) {
    assert.ok(interactions.some((interaction) => interaction.type === type), `Kelpwatch requires ${type}`);
  }
  assert.deepEqual(
    interactions
      .filter((interaction) => interaction.type === "observation")
      .map((interaction) => interaction.observationId),
    [
      "kelp-cover-transect",
      "grazer-abundance-count",
      "predator-evidence-survey",
      "repeat-comparison-site",
    ],
  );
  const interpretation = interactions.find((interaction) => interaction.type === "interpretation");
  const response = interactions.find((interaction) => interaction.type === "response");
  assert.equal(interpretation.questId, "quest-kelpwatch-balance");
  assert.equal(interpretation.choiceSetId, "kelpwatch-food-web-interpretation");
  assert.equal(response.questId, "quest-kelpwatch-balance");
  assert.equal(response.choiceSetId, "kelpwatch-restoration-response");
});

test("evidence, interpretation, and response stations remain manual interactions", () => {
  const cases = [
    ["sunpatch-cay-town", { x: 4, y: 4 }, "left", "observation"],
    ["sunpatch-field-station", { x: 3, y: 3 }, "up", "interpretation"],
    ["sunpatch-field-station", { x: 8, y: 3 }, "up", "response"],
    ["current-commons-town", { x: 4, y: 3 }, "down", "observation"],
    ["current-navigation-lab", { x: 3.4, y: 3 }, "up", "interpretation"],
    ["current-navigation-lab", { x: 7.5, y: 3 }, "up", "response"],
    ["kelpwatch-island-town", { x: 4, y: 4.68 }, "up", "observation"],
    ["kelpwatch-ecology-lab", { x: 3.5, y: 4 }, "left", "interpretation"],
    ["kelpwatch-ecology-lab", { x: 7, y: 4 }, "right", "response"],
  ];
  for (const [sceneId, position, facing, type] of cases) {
    assert.equal(canOccupyScenePosition(sceneId, position), true);
    assert.equal(getContinuousInteraction(sceneId, position, facing)?.type, type);
    assert.equal(getDoorwayTransition(sceneId, position, facing), null);
  }
});

test("every active Elverson portal stays inside the release and arrives on a safe corridor", () => {
  const transitionTypes = new Set(["enter", "exit"]);

  for (const sceneId of ELVERSON_RELEASE_SCOPE.sceneIds) {
    assert.equal(canOccupyScenePosition(sceneId, SCENES[sceneId].spawn), true, `${sceneId} spawn must stay safe`);
    for (const interaction of getSceneInteractions(sceneId)) {
      if (!transitionTypes.has(interaction.type)) continue;
      assert.ok(
        ELVERSON_RELEASE_SCOPE.sceneIds.includes(interaction.targetScene),
        `${interaction.interactionId} must not leave the active Elverson release`,
      );
      assert.ok(SCENES[interaction.targetScene], `${interaction.interactionId} target scene must be live`);
      assert.equal(
        canOccupyScenePosition(interaction.targetScene, interaction.spawn),
        true,
        `${interaction.interactionId} must arrive on an open corridor`,
      );
    }
  }

  assert.equal(
    ELVERSON_RELEASE_SCOPE.sceneIds.some((sceneId) => SCENES[sceneId].kind === "route"),
    false,
  );
});

test("every Sunpatch, Brackwater, Current, and Kelpwatch exterior doorway auto-triggers from a safe approach", () => {
  for (const sceneId of ["sunpatch-cay-town", "brackwater-landing-town", "current-commons-town", "kelpwatch-island-town"]) {
    const entrances = SCENES[sceneId].interactions.filter(({ type }) => type === "enter");
    assert.equal(entrances.length, 3, `${sceneId} should expose all three building entrances`);

    for (const entrance of entrances) {
      const approach = { x: entrance.at.x, y: entrance.at.y + 0.73 };
      assert.equal(
        canOccupyScenePosition(sceneId, approach),
        true,
        `${entrance.id} needs a safe exterior approach`,
      );
      assert.equal(
        getDoorwayTransition(sceneId, approach, "up")?.interactionId,
        entrance.id,
        `${entrance.id} should auto-trigger while walking into its facade`,
      );
    }
  }
});

test("Elverson exposes the v3 town start, route dock, and every semantic safe position", () => {
  assert.deepEqual(ELVERSON_TOWN_SAFE_POSITIONS, {
    townStart: { x: 20, y: 6 },
    legacyTownResume: { x: 20, y: 6 },
    shellshoreDock: { x: 20, y: 17 },
    playerHomeExterior: { x: 3.55, y: 5.05 },
    reefHouseExterior: { x: 13.8, y: 5.05 },
    deepHouseExterior: { x: 28.2, y: 5.05 },
    oceanicHouseExterior: { x: 36.8, y: 5.05 },
    schoolhouseExterior: { x: 4.3, y: 16.45 },
    hybridHouseExterior: { x: 13.8, y: 16.45 },
    researchLabExterior: { x: 30.7, y: 16.45 },
    supplyCompanyExterior: { x: 37.5, y: 16.45 },
    wharfApproach: { x: 14.55, y: 21.45 },
    handNetCove: { x: 15.15, y: 21.65 },
    aquariumExterior: { x: 24.54, y: 22.25 },
  });
  assert.deepEqual(SCENES.town.spawn, ELVERSON_TOWN_SAFE_POSITIONS.townStart);
  assert.deepEqual(START_STATE, {
    sceneId: "town",
    position: { x: 20, y: 17 },
    facing: "down",
  });
  assert.deepEqual(START_STATE.position, ELVERSON_TOWN_SAFE_POSITIONS.shellshoreDock);
  assert.equal(isWalkable(START_STATE.sceneId, START_STATE.position), true);
  assert.equal(canOccupyScenePosition(START_STATE.sceneId, START_STATE.position), true);
  for (const [label, position] of Object.entries(ELVERSON_TOWN_SAFE_POSITIONS)) {
    assert.equal(
      canOccupyContinuousPosition("town", position),
      true,
      `${label} must remain a safe v3 position`,
    );
  }
});

test("movement advances over walkable tiles and respects map bounds", () => {
  assert.deepEqual(movePlayer("town", START_STATE.position, "up"), { x: 20, y: 16 });
  assert.deepEqual(movePlayer("town", START_STATE.position, "down"), { x: 20, y: 18 });
  assert.equal(isInBounds("town", { x: 41, y: 27 }), true);
  assert.equal(isInBounds("town", { x: 42, y: 27 }), false);
  assert.equal(getTile("town", { x: -1, y: 0 }), null);
});

test("continuous movement cannot cross Elverson v3 facades, water, furniture, exits, or trainers", () => {
  for (const position of [
    { x: 4.2, y: 3 },
    { x: 13.8, y: 3 },
    { x: 28.2, y: 3 },
    { x: 36.8, y: 3 },
    { x: 4.3, y: 14 },
    { x: 13.8, y: 14 },
    { x: 30.7, y: 14 },
    { x: 37.5, y: 14 },
    { x: 26, y: 20 },
    { x: 2, y: 19 },
    { x: 30, y: 20 },
  ]) {
    assert.equal(canOccupyContinuousPosition("town", position), false);
  }
  assert.deepEqual(movePlayer("coral-home", { x: 4, y: 5 }, "left"), { x: 4, y: 5 });
  assert.deepEqual(movePlayer("coral-home", { x: 5, y: 6 }, "down"), { x: 5, y: 6 });
  assert.deepEqual(movePlayer("coral-home", { x: 5, y: 3 }, "up"), { x: 5, y: 3 });
  assert.equal(isWalkable("coral-home", { x: 6, y: 1 }), false);
  assert.equal(isWalkable("deep-home", { x: 6, y: 1 }), false);
  assert.equal(getTile("academy-lab", { x: 7, y: 2 }).id, "furniture");
  assert.equal(getTile("academy-lab", { x: 7, y: 3 }).id, "trainer");
  assert.equal(isWalkable("academy-lab", { x: 7, y: 3 }), false);
});

test("Elverson exposes exactly nine semantic entrance portals with safe approaches", () => {
  const entrances = SCENES.town.interactions.filter(({ type }) => type === "enter");
  assert.equal(entrances.length, ELVERSON_PORTAL_EXPECTATIONS.length);
  assert.deepEqual(
    entrances.map(({ id }) => id),
    ELVERSON_PORTAL_EXPECTATIONS.map(({ id }) => id),
  );

  for (const expected of ELVERSON_PORTAL_EXPECTATIONS) {
    const portal = getElversonPortal(expected.id);
    assert.ok(portal, `${expected.id} must resolve through the semantic portal registry`);
    assert.equal(portal.targetScene, expected.targetScene);
    assert.deepEqual(portal.interiorSpawn, expected.interiorSpawn);

    const approach = getElversonExteriorApproach(portal);
    assert.equal(canOccupyContinuousPosition("town", approach), true, `${expected.id} approach must be safe`);
    assert.deepEqual(getContinuousInteraction("town", approach, "up"), {
      type: "enter",
      interactionId: expected.id,
      targetScene: expected.targetScene,
      spawn: expected.interiorSpawn,
      facing: "up",
    });
    assert.equal(getContinuousInteraction("town", approach, "down"), null);
  }
});

test("all nine semantic interiors return to their matching safe town positions", () => {
  for (const expected of ELVERSON_PORTAL_EXPECTATIONS) {
    const portal = getElversonPortal(expected.id);
    const scene = SCENES[expected.targetScene];
    const exit = scene.interactions.find(({ type }) => type === "exit");
    assert.equal(exit?.id, expected.exitId);
    const approach = { x: Math.round(exit.at.x), y: Math.round(exit.at.y - 1) };
    assert.deepEqual(getInteraction(expected.targetScene, approach, "down"), {
      type: "exit",
      interactionId: expected.exitId,
      targetScene: "town",
      spawn: portal.exteriorSpawn,
      facing: "down",
    });
    assert.equal(canOccupyContinuousPosition("town", portal.exteriorSpawn), true);
  }
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

test("the legacy grid API resolves residents at their relocated v3 scenes", () => {
  assert.equal(
    getInteraction("elverson-marine-research-lab", { x: 10, y: 5 }, "right")?.interactionId,
    "interaction-elverson-explorer-jordan",
  );
  assert.equal(getInteraction("town", { x: 20, y: 10 }, "right"), null);
  assert.equal(
    getInteraction("town", { x: 7, y: 9 }, "up")?.interactionId,
    "interaction-elverson-town-theo",
  );
});

test("invalid scene, position, and direction inputs fail clearly", () => {
  assert.throws(() => movePlayer("missing", { x: 0, y: 0 }, "up"), /Unknown adventure scene/);
  assert.throws(() => movePlayer("town", { x: 1.5, y: 2 }, "up"), /integer x and y/);
  assert.throws(() => movePlayer("town", START_STATE.position, "north"), /Unknown movement direction/);
});

test("fractional player positions use a circular collision radius", () => {
  assert.equal(canOccupyContinuousPosition("town", { x: 20.35, y: 6.2 }), true);
  assert.equal(canOccupyContinuousPosition("town", { x: 4.2, y: 3 }), false);
  assert.equal(canOccupyContinuousPosition("town", { x: 4.2, y: 4.7 }), false);
  assert.equal(canOccupyContinuousPosition("town", { x: 4.2, y: 4.73 }), true);
  assert.equal(canOccupyContinuousPosition("town", { x: -0.4, y: 7 }), false);
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

test("the Current sea lane follows visible shoals while preserving an open dock-to-dock channel", () => {
  const blockedArtPoints = [
    { x: 1, y: 1 },
    { x: 4, y: 1 },
    { x: 10, y: 1 },
    { x: 4, y: 2 },
    { x: 9, y: 3 },
    { x: 14, y: 4 },
    { x: 3, y: 6 },
    { x: 5, y: 7 },
    { x: 12, y: 7 },
    { x: 7, y: 8 },
  ];
  for (const position of blockedArtPoints) {
    assert.equal(
      canOccupyContinuousPosition("brackwater-current-sea", position),
      false,
      `visible route obstacle at ${position.x},${position.y} must stay solid`,
    );
  }

  for (const position of [{ x: 3, y: 3 }, { x: 8, y: 3 }, { x: 8, y: 5 }, { x: 10, y: 6 }]) {
    assert.equal(
      canOccupyContinuousPosition("brackwater-current-sea", position),
      true,
      `open route water at ${position.x},${position.y} must stay navigable`,
    );
  }
  assertWalkablePolyline(
    "brackwater-current-sea",
    [{ x: 1, y: 5 }, { x: 14, y: 5 }],
    "Brackwater-to-Current center channel",
  );
});

test("the Kelpwatch sea lane keeps every visible hazard solid and its center channel continuous", () => {
  const sceneId = "current-kelpwatch-sea";
  assert.deepEqual(getSceneMovementProfile(sceneId), {
    ...CONTINUOUS_MOVEMENT_DEFAULTS,
    mode: "boat",
    speed: 3.2,
    radius: 0.28,
    maxStepDistance: 0.08,
  });
  for (const symbol of ["k", "b"]) {
    const blockedPositions = [];
    SCENES[sceneId].tiles.forEach((row, y) => {
      [...row].forEach((candidate, x) => {
        if (candidate === symbol) blockedPositions.push({ x, y });
      });
    });
    assert.ok(blockedPositions.length > 0, `Kelpwatch route requires ${symbol} hazards`);
    for (const position of blockedPositions) {
      assert.equal(
        canOccupyContinuousPosition(sceneId, position),
        false,
        `${symbol} at ${position.x},${position.y} must stay solid`,
      );
    }
  }
  assertWalkablePolyline(
    sceneId,
    [{ x: 1, y: 5 }, { x: 14, y: 5 }],
    "Current-to-Kelpwatch center channel",
  );
});

test("Kelpwatch furniture stays solid while every required interaction retains an open path", () => {
  const blockedArtPoints = [
    ["kelpwatch-island-town", "kelpwatch-canopy-station", { x: 4.5, y: 3.5 }],
    ["kelpwatch-island-town", "kelpwatch-grazer-station", { x: 10, y: 3.5 }],
    ["kelpwatch-island-town", "kelpwatch-predator-station", { x: 4, y: 5.5 }],
    ["kelpwatch-island-town", "kelpwatch-repeat-station", { x: 10, y: 5.5 }],
    ["kelpwatch-ecology-lab", "kelpwatch-lab-upper-left", { x: 2, y: 2 }],
    ["kelpwatch-ecology-lab", "kelpwatch-lab-rear-stage", { x: 5, y: 2 }],
    ["kelpwatch-ecology-lab", "kelpwatch-lab-upper-right", { x: 9, y: 2 }],
    ["kelpwatch-ecology-lab", "kelpwatch-lab-lower-left", { x: 2, y: 4 }],
    ["kelpwatch-ecology-lab", "kelpwatch-lab-lower-right", { x: 9, y: 4 }],
    ["kelpwatch-diver-home", "kelpwatch-home-rear-seating", { x: 5, y: 2 }],
    ["kelpwatch-diver-home", "kelpwatch-home-lower-left-desk", { x: 2, y: 5 }],
    ["kelpwatch-diver-home", "kelpwatch-home-lower-right-table", { x: 9, y: 5 }],
    ["kelpwatch-tide-hall", "kelpwatch-hall-rear-stage", { x: 5, y: 2 }],
    ["kelpwatch-tide-hall", "kelpwatch-hall-lower-left", { x: 2, y: 6 }],
    ["kelpwatch-tide-hall", "kelpwatch-hall-lower-right", { x: 9, y: 6 }],
  ];
  for (const [sceneId, rectangleId, position] of blockedArtPoints) {
    assert.ok(SCENES[sceneId].collisionRects.some(({ id }) => id === rectangleId));
    assert.equal(canOccupyContinuousPosition(sceneId, position), false, `${rectangleId} must stay solid`);
  }

  const interactionApproaches = [
    ["kelpwatch-ecology-lab", [{ x: 5, y: 6 }, { x: 5, y: 3.33 }], "up", "interaction-kelpwatch-ecologist"],
    ["kelpwatch-ecology-lab", [{ x: 5, y: 6 }, { x: 5, y: 4 }, { x: 3.5, y: 4 }], "left", "interaction-kelpwatch-interpret-evidence"],
    ["kelpwatch-ecology-lab", [{ x: 5, y: 6 }, { x: 5, y: 4 }, { x: 7, y: 4 }], "right", "interaction-kelpwatch-choose-response"],
    ["kelpwatch-diver-home", [{ x: 5, y: 6 }, { x: 5, y: 4.73 }], "up", "interaction-kelpwatch-diver"],
    ["kelpwatch-tide-hall", [{ x: 5, y: 6 }, { x: 5, y: 3.3 }], "up", "interaction-kelpwatch-leader"],
  ];
  for (const [sceneId, points, facing, interactionId] of interactionApproaches) {
    assertWalkablePolyline(sceneId, points, interactionId);
    const position = points.at(-1);
    assert.equal(getContinuousInteraction(sceneId, position, facing)?.interactionId, interactionId);
  }

  for (const [sceneId, exitId] of [
    ["kelpwatch-ecology-lab", "interaction-kelpwatch-lab-exit"],
    ["kelpwatch-diver-home", "interaction-kelpwatch-home-exit"],
    ["kelpwatch-tide-hall", "interaction-kelpwatch-hall-exit"],
  ]) {
    const doorwayApproach = { x: 5, y: 6.27 };
    assertWalkablePolyline(sceneId, [SCENES[sceneId].spawn, doorwayApproach], `${sceneId} exit corridor`);
    assert.equal(getDoorwayTransition(sceneId, doorwayApproach, "down")?.interactionId, exitId);
  }
});

test("Current interiors match visible furniture without cutting off required interactions", () => {
  const blockedArtPoints = [
    ["current-navigation-lab", "current-lab-left-console", { x: 2, y: 4 }],
    ["current-navigation-lab", "current-lab-rear-stage", { x: 5, y: 2.4 }],
    ["current-navigation-lab", "current-lab-right-console", { x: 9, y: 4 }],
    ["current-navigator-home", "current-home-left-chart-table", { x: 2, y: 3 }],
    ["current-navigator-home", "current-home-upper-right-plant", { x: 7.4, y: 2.5 }],
    ["current-navigator-home", "current-home-upper-right-gear", { x: 9, y: 3 }],
    ["current-navigator-home", "current-home-lower-left-berth", { x: 1.5, y: 5 }],
    ["current-navigator-home", "current-home-lower-right-crate", { x: 10.1, y: 4.5 }],
    ["current-tide-hall", "current-hall-left-display", { x: 2, y: 2.4 }],
    ["current-tide-hall", "current-hall-rear-stage", { x: 5, y: 2.5 }],
    ["current-tide-hall", "current-hall-right-display", { x: 9, y: 2.4 }],
    ["current-tide-hall", "current-hall-left-bench", { x: 1, y: 3.5 }],
    ["current-tide-hall", "current-hall-right-bench", { x: 10.1, y: 3.5 }],
    ["current-tide-hall", "current-hall-lower-left-cabinet", { x: 1.5, y: 5.5 }],
    ["current-tide-hall", "current-hall-lower-left-planter", { x: 3.5, y: 6.1 }],
    ["current-tide-hall", "current-hall-lower-right-planter", { x: 7.5, y: 6.1 }],
    ["current-tide-hall", "current-hall-lower-right-cabinet", { x: 9.5, y: 5.5 }],
  ];
  for (const [sceneId, rectangleId, position] of blockedArtPoints) {
    assert.ok(SCENES[sceneId].collisionRects.some(({ id }) => id === rectangleId));
    assert.equal(canOccupyContinuousPosition(sceneId, position), false, `${rectangleId} must stay solid`);
  }

  const interactionApproaches = [
    ["current-navigation-lab", { x: 5, y: 3 }, "up", "interaction-current-analyst"],
    ["current-navigation-lab", { x: 3.4, y: 3 }, "up", "interaction-current-interpret-evidence"],
    ["current-navigation-lab", { x: 7.5, y: 3 }, "up", "interaction-current-choose-response"],
    ["current-navigator-home", { x: 5, y: 2.8 }, "up", "interaction-current-navigator"],
    ["current-tide-hall", { x: 5, y: 3.1 }, "up", "interaction-current-leader"],
  ];
  for (const [sceneId, position, facing, interactionId] of interactionApproaches) {
    assert.equal(canOccupyContinuousPosition(sceneId, position), true, `${interactionId} needs an open approach`);
    assert.equal(getContinuousInteraction(sceneId, position, facing)?.interactionId, interactionId);
    assertWalkablePolyline(sceneId, [SCENES[sceneId].spawn, position], interactionId);
  }

  for (const [sceneId, exitId] of [
    ["current-navigation-lab", "interaction-current-lab-exit"],
    ["current-navigator-home", "interaction-current-home-exit"],
    ["current-tide-hall", "interaction-current-hall-exit"],
  ]) {
    const doorwayApproach = { x: 5, y: 6.27 };
    assertWalkablePolyline(sceneId, [SCENES[sceneId].spawn, doorwayApproach], `${sceneId} exit corridor`);
    assert.equal(getDoorwayTransition(sceneId, doorwayApproach, "down")?.interactionId, exitId);
  }
});

test("continuous movement scales with elapsed milliseconds and normalizes diagonals", () => {
  const straight = movePlayerContinuous("town", START_STATE.position, { x: 0, y: -1 }, 125);
  assert.equal(straight.x, 20);
  assert.ok(Math.abs(straight.y - 16.5) < 1e-9);

  const start = { x: 6, y: 6 };
  const diagonal = movePlayerContinuous("coral-home", start, { x: 1, y: -1 }, 100);
  assert.ok(Math.abs(Math.hypot(diagonal.x - start.x, diagonal.y - start.y) - 0.4) < 1e-9);
});

test("the upstairs bedroom keeps the player below the painted rear wall", () => {
  assert.ok(
    SCENES["player-bedroom"].collisionRects.some(
      ({ id }) => id === "player-bedroom-rear-wall",
    ),
  );
  assert.equal(canOccupyContinuousPosition("player-bedroom", { x: 7, y: 2.4 }), false);
  assert.equal(canOccupyContinuousPosition("player-bedroom", { x: 7, y: 2.7 }), true);

  const stopped = movePlayerContinuous(
    "player-bedroom",
    SCENES["player-bedroom"].spawn,
    { x: 0, y: -1 },
    3_000,
  );
  assert.ok(
    stopped.y >= 2.67 && stopped.y <= 2.75,
    `expected the rear wall to stop upward travel, received y=${stopped.y}`,
  );
  assert.equal(canOccupyContinuousPosition("player-bedroom", stopped), true);
  assertWalkablePolyline(
    "player-bedroom",
    [SCENES["player-bedroom"].spawn, { x: 7, y: 8.05 }],
    "bedroom stair corridor",
  );
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

test("dynamic circular blockers participate in occupancy and continuous movement", () => {
  const dynamicBlockers = [{
    id: "moving-reefkeeper",
    position: { x: 14, y: 7 },
    radius: 0.3,
  }];

  assert.equal(canOccupyContinuousPosition("town", { x: 13.5, y: 7 }), true);
  assert.equal(
    canOccupyContinuousPosition("town", { x: 13.5, y: 7 }, 0.22, { dynamicBlockers }),
    false,
  );
  assert.equal(
    canOccupyScenePosition("town", { x: 14, y: 7 }, { dynamicBlockers }),
    false,
  );

  const moved = movePlayerContinuous(
    "town",
    { x: 13, y: 7 },
    { x: 1, y: 0 },
    250,
    { dynamicBlockers },
  );
  assert.ok(moved.x >= 13.3 && moved.x < 13.5, `expected actor blocker to stop movement, received ${moved.x}`);
  assert.equal(
    canOccupyContinuousPosition("town", moved, 0.22, { dynamicBlockers }),
    true,
  );

  assert.throws(
    () => canOccupyContinuousPosition("town", { x: 13, y: 7 }, 0.22, { dynamicBlockers: {} }),
    /blockers must be an array/,
  );
  assert.throws(
    () => canOccupyContinuousPosition("town", { x: 13, y: 7 }, 0.22, {
      dynamicBlockers: [{ position: { x: 14, y: 7 }, radius: 0 }],
    }),
    /blocker 0 radius must be a positive finite number/,
  );
});

test("runtime actors replace their authored n tiles without weakening other geometry", () => {
  const sceneId = "sunpatch-cay-town";
  const authoredAnchor = { x: 11, y: 5 };
  const movedActor = {
    id: "interaction-sunpatch-bo",
    position: { x: 8, y: 5 },
    radius: 0.3,
  };

  assert.equal(getTile(sceneId, authoredAnchor).symbol, "n");
  assert.equal(canOccupyContinuousPosition(sceneId, authoredAnchor), false);
  assert.equal(
    canOccupyContinuousPosition(sceneId, authoredAnchor, 0.22, {
      dynamicBlockers: [movedActor],
      ignoreActorTiles: true,
    }),
    true,
  );
  assert.equal(
    canOccupyContinuousPosition(sceneId, movedActor.position, 0.22, {
      dynamicBlockers: [movedActor],
      ignoreActorTiles: true,
    }),
    false,
  );

  const blockedByAuthoredAnchor = movePlayerContinuous(
    sceneId,
    { x: 10, y: 5 },
    { x: 1, y: 0 },
    500,
    { dynamicBlockers: [movedActor] },
  );
  const passedAuthoredAnchor = movePlayerContinuous(
    sceneId,
    { x: 10, y: 5 },
    { x: 1, y: 0 },
    500,
    { dynamicBlockers: [movedActor], ignoreActorTiles: true },
  );
  assert.ok(blockedByAuthoredAnchor.x < 10.5);
  assert.ok(passedAuthoredAnchor.x > 11.5);

  assert.throws(
    () => canOccupyContinuousPosition(sceneId, authoredAnchor, 0.22, { ignoreActorTiles: "yes" }),
    /ignoreActorTiles must be a boolean/,
  );
});

test("continuous interactions require immediate, forward-facing alignment", () => {
  assert.deepEqual(getContinuousInteraction("academy-lab", { x: 7.2, y: 3.8 }, "up"), {
    type: "trainer",
    interactionId: "interaction-academy-mentor",
    trainerId: "academy-mentor",
    npcId: "academy-mentor",
    conversationId: "conversation-shellshore-academy-mentor",
    encounterId: "encounter-shellshore-mentor-practice",
  });
  assert.deepEqual(getContinuousInteraction("town", { x: 13.8, y: 4.83 }, "up"), {
    type: "enter",
    interactionId: "interaction-elverson-enter-reef-house",
    targetScene: "coral-home",
    spawn: { x: 5, y: 6 },
    facing: "up",
  });
  assert.equal(getContinuousInteraction("town", { x: 13.8, y: 4.83 }, "right"), null);
  assert.equal(getContinuousInteraction("academy-lab", { x: 7, y: 3.9 }, "up"), null);
  assert.equal(getContinuousInteraction("academy-lab", { x: 7.26, y: 3.8 }, "up"), null);
  assert.equal(getContinuousInteraction("academy-lab", { x: 7.2, y: 3.8 }, "down"), null);
  assert.equal(getContinuousInteraction("town", { x: 13.8, y: 5 }, "up"), null);
  assert.deepEqual(getContinuousInteraction("deep-home", { x: 5.2, y: 2.8 }, "up"), {
    type: "trainer",
    interactionId: "interaction-deep-home-dorian",
    trainerId: "dorian",
    npcId: "dorian",
    conversationId: "conversation-shellshore-dorian",
    encounterId: "encounter-shellshore-dorian",
  });
});

test("an open-floor town resident only prompts from directly in front", () => {
  const interactionId = "interaction-elverson-town-theo";
  assert.equal(
    getContinuousInteraction("town", { x: 6.2, y: 8.35 }, "right")?.interactionId,
    interactionId,
  );
  assert.equal(getContinuousInteraction("town", { x: 6, y: 8.35 }, "right"), null);
  assert.equal(getContinuousInteraction("town", { x: 6.2, y: 8.61 }, "right"), null);
  assert.equal(getContinuousInteraction("town", { x: 6.2, y: 8.35 }, "down"), null);
});

test("full-tile stations stay reachable only across their visible front edge", () => {
  assert.equal(
    getContinuousInteraction("current-navigation-lab", { x: 3.4, y: 3 }, "up")?.interactionId,
    "interaction-current-interpret-evidence",
  );
  assert.equal(getContinuousInteraction("current-navigation-lab", { x: 3.51, y: 3 }, "up"), null);
  assert.equal(getContinuousInteraction("current-navigation-lab", { x: 3.4, y: 3 }, "down"), null);
});

test("interaction rays cannot reach a character through unrelated furniture", () => {
  const blockedTarget = "interaction-academy-mentor";
  const playerPosition = { x: 6, y: 4.5 };
  assert.equal(canOccupyContinuousPosition("academy-lab", playerPosition), true);
  assert.equal(
    getContinuousInteraction("academy-lab", playerPosition, "left", {
      range: 5,
      lateralTolerance: 0.1,
      positionOverrides: { [blockedTarget]: { x: 2, y: 4.5 } },
    }),
    null,
  );
});

test("interaction position overrides keep moving characters targetable", () => {
  const interactionId = "interaction-sunpatch-bo";
  const movedPosition = { x: 8, y: 5 };
  const objectOverrides = { [interactionId]: movedPosition };
  const mapOverrides = new Map([[interactionId, movedPosition]]);

  assert.equal(getContinuousInteraction("sunpatch-cay-town", { x: 7, y: 5 }, "right"), null);
  assert.equal(
    getContinuousInteraction("sunpatch-cay-town", { x: 7.2, y: 5 }, "right", {
      positionOverrides: objectOverrides,
    })?.interactionId,
    interactionId,
  );
  assert.equal(
    getInteraction("sunpatch-cay-town", { x: 7, y: 5 }, "right", {
      positionOverrides: mapOverrides,
    })?.interactionId,
    interactionId,
  );

  assert.throws(
    () => getContinuousInteraction("sunpatch-cay-town", { x: 7, y: 5 }, "right", {
      positionOverrides: [],
    }),
    /positionOverrides must be an object or Map/,
  );
  assert.throws(
    () => getContinuousInteraction("sunpatch-cay-town", { x: 7, y: 5 }, "right", {
      positionOverrides: { [interactionId]: { x: Number.NaN, y: 5 } },
    }),
    /finite x and y/,
  );
});

test("automatic doorway transitions recognize all nine semantic portal pairs only at contact", () => {
  for (const expected of ELVERSON_PORTAL_EXPECTATIONS) {
    const portal = getElversonPortal(expected.id);
    const exteriorApproach = getElversonExteriorApproach(portal);
    assert.deepEqual(getDoorwayTransition("town", exteriorApproach, "up"), {
      type: "enter",
      interactionId: expected.id,
      targetScene: expected.targetScene,
      spawn: expected.interiorSpawn,
      facing: "up",
    });

    const exit = SCENES[expected.targetScene].interactions.find(({ id }) => id === expected.exitId);
    const interiorApproach = { x: exit.at.x, y: exit.at.y - 0.73 };
    assert.deepEqual(getDoorwayTransition(expected.targetScene, interiorApproach, "down"), {
      type: "exit",
      interactionId: expected.exitId,
      targetScene: "town",
      spawn: portal.exteriorSpawn,
      facing: "down",
    });
  }
});

test("the aquarium's full visible exit opening lets an off-centre player walk out", () => {
  for (const x of [5.5, 6, 6.5]) {
    let position = { x, y: 7 };
    for (let frame = 0; frame < 30; frame += 1) {
      position = movePlayerContinuous("academy-lab", position, { x: 0, y: 1 }, 16);
    }

    assert.ok(position.y > 7.2, `the player at x=${x} should reach the exit threshold`);
    assert.equal(
      getDoorwayTransition("academy-lab", position, "down")?.interactionId,
      "interaction-academy-exit",
      `the player at x=${x} should leave through the visible aquarium doorway`,
    );
  }

  assert.equal(
    getDoorwayTransition("academy-lab", { x: 6.76, y: 7.27 }, "down"),
    null,
    "the wider trigger must not extend past the doorway's contact tolerance",
  );
});

test("automatic doorway transitions stay tight, directional, and portal-only", () => {
  assert.equal(getDoorwayTransition("town", { x: 13.8, y: 4.93 }, "up"), null);
  assert.equal(
    getDoorwayTransition("town", { x: 14.04, y: 4.83 }, "up")?.interactionId,
    "interaction-elverson-enter-reef-house",
  );
  assert.equal(getDoorwayTransition("town", { x: 14.06, y: 4.83 }, "up"), null);
  assert.equal(getDoorwayTransition("town", { x: 13.8, y: 4.83 }, "down"), null);

  const nearest = getDoorwayTransition(
    "town",
    { x: 15.45, y: 19 },
    "down",
    { range: 4, lateralTolerance: 1 },
  );
  assert.equal(nearest, null);

  // Marina is within the same contact distance, but trainers remain manual interactions.
  assert.equal(getDoorwayTransition("coral-home", { x: 5, y: 2.73 }, "up"), null);
  assert.ok(getContinuousInteraction("coral-home", { x: 5, y: 2.73 }, "up"));
});

test("continuous helpers reject invalid numeric inputs without changing grid APIs", () => {
  assert.deepEqual(movePlayer("town", { x: 20, y: 6 }, "up"), { x: 20, y: 5 });
  assert.deepEqual(movePlayerContinuous("town", { x: 20.25, y: 6 }, { x: 0, y: 0 }, 16), { x: 20.25, y: 6 });
  assert.throws(
    () => movePlayerContinuous("town", { x: 20, y: 6 }, { x: 0, y: -1 }, -1),
    /Elapsed time must be a non-negative finite number/,
  );
  assert.throws(
    () => canOccupyContinuousPosition("town", { x: Number.NaN, y: 10 }),
    /finite x and y/,
  );
  assert.throws(
    () => getDoorwayTransition("town", { x: 13.8, y: 4.83 }, "north"),
    /Unknown facing direction/,
  );
  assert.throws(
    () => getDoorwayTransition("town", { x: 7, y: 6.8 }, "up", { range: 0 }),
    /Doorway range must be a positive finite number/,
  );
});
