import assert from "node:assert/strict";
import test from "node:test";
import { ADVENTURE_CONTENT } from "./adventureContent.mjs";
import {
  createInitialAdventureSave,
  normalizeAdventureSave,
} from "./adventureProgression.mjs";
import {
  autoSteerAdventureRoute,
  boardAdventureRoute,
  buildAdventureWorldMapModel,
  dockAdventureRoute,
  getRouteTravelState,
} from "./adventureTravel.mjs";

const ROUTE_ID = "route-shellshore-sunpatch";
const SHELLSHORE_DOCK_ID = "shellshore-dock";
const SUNPATCH_DOCK_ID = "sunpatch-dock";

const TEST_CONTENT = Object.freeze({
  towns: Object.freeze([
    Object.freeze({
      id: "shellshore-village",
      name: "Shellshore Academy",
      settlementType: "island",
      habitatId: "harbor-lagoon",
      dockId: SHELLSHORE_DOCK_ID,
      arrivalRouteId: null,
    }),
    Object.freeze({
      id: "sunpatch-cay",
      name: "Sunpatch Cay",
      settlementType: "island",
      habitatId: "coral-reef",
      dockId: SUNPATCH_DOCK_ID,
      arrivalRouteId: ROUTE_ID,
      encounterIds: Object.freeze(["encounter-sunpatch-qualifier"]),
    }),
    Object.freeze({
      id: "brackwater-landing",
      name: "Brackwater Landing",
      settlementType: "floating",
      habitatId: "estuary-mangrove",
      dockId: "brackwater-dock",
      arrivalRouteId: "route-sunpatch-brackwater",
    }),
  ]),
  scenes: Object.freeze([
    Object.freeze({
      id: "town",
      townId: "shellshore-village",
      status: "prototype",
      world: Object.freeze({ spawn: Object.freeze({ x: 7, y: 8 }), startFacing: "up" }),
    }),
    Object.freeze({
      id: "shellshore-sunpatch-sea",
      townId: "shellshore-village",
      routeId: ROUTE_ID,
      status: "prototype",
      world: Object.freeze({ spawn: Object.freeze({ x: 1, y: 4 }), startFacing: "right" }),
    }),
    Object.freeze({
      id: "sunpatch-cay-town",
      townId: "sunpatch-cay",
      status: "prototype",
      world: Object.freeze({ spawn: Object.freeze({ x: 2, y: 7 }), startFacing: "up" }),
    }),
    Object.freeze({
      id: "brackwater-landing-town",
      townId: "brackwater-landing",
      status: "planned",
    }),
  ]),
  docks: Object.freeze([
    Object.freeze({
      id: SHELLSHORE_DOCK_ID,
      townId: "shellshore-village",
      sceneId: "town",
      status: "prototype",
      position: Object.freeze({ x: 7, y: 8 }),
      facing: "up",
    }),
    Object.freeze({
      id: SUNPATCH_DOCK_ID,
      townId: "sunpatch-cay",
      sceneId: "sunpatch-cay-town",
      status: "prototype",
      position: Object.freeze({ x: 2, y: 7 }),
      facing: "up",
    }),
    Object.freeze({
      id: "brackwater-dock",
      townId: "brackwater-landing",
      sceneId: "brackwater-landing-town",
      status: "planned",
    }),
  ]),
  routes: Object.freeze([
    Object.freeze({
      id: ROUTE_ID,
      fromTownId: "shellshore-village",
      toTownId: "sunpatch-cay",
      sceneId: "shellshore-sunpatch-sea",
      fromDockId: SHELLSHORE_DOCK_ID,
      toDockId: SUNPATCH_DOCK_ID,
      fromSpawn: Object.freeze({ x: 1, y: 4, facing: "right" }),
      toSpawn: Object.freeze({
        position: Object.freeze({ x: 8, y: 4 }),
        facing: "left",
      }),
      manualPilotRequiredFirstTime: true,
      autoSteerAfterFirstCompletion: true,
    }),
    Object.freeze({
      id: "route-sunpatch-brackwater",
      fromTownId: "sunpatch-cay",
      toTownId: "brackwater-landing",
      fromDockId: SUNPATCH_DOCK_ID,
      toDockId: "brackwater-dock",
      manualPilotRequiredFirstTime: true,
      autoSteerAfterFirstCompletion: true,
    }),
  ]),
  encounters: Object.freeze([
    Object.freeze({
      id: "encounter-sunpatch-qualifier",
      townId: "sunpatch-cay",
      rewardId: "reward-sunpatch-qualifier",
    }),
  ]),
  rewards: Object.freeze([
    Object.freeze({
      id: "reward-sunpatch-qualifier",
      tideMarkIds: Object.freeze(["tide-mark-sunpatch"]),
    }),
  ]),
});

function readyFirstVoyage() {
  const save = createInitialAdventureSave("profile-1");
  save.world.unlockedRouteIds = [ROUTE_ID];
  save.progression.quests["quest-shellshore-first-voyage"] = {
    status: "complete",
    flags: { "boat-safety-reviewed": true },
  };
  return normalizeAdventureSave(save);
}

function atSunpatch(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  return normalizeAdventureSave({
    ...save,
    world: {
      ...save.world,
      townId: "sunpatch-cay",
      sceneId: "sunpatch-cay-town",
      position: { x: 2, y: 7 },
      facing: "up",
      lastSafeDockId: SUNPATCH_DOCK_ID,
    },
  });
}

function atRouteSide(saveValue, side) {
  const save = normalizeAdventureSave(saveValue);
  return normalizeAdventureSave({
    ...save,
    world: {
      ...save.world,
      position: side === "from" ? { x: 1, y: 4 } : { x: 8, y: 4 },
      facing: side === "from" ? "right" : "left",
    },
  });
}

test("route state distinguishes unlock, manual completion, runtime readiness, and available modes", () => {
  const locked = getRouteTravelState(createInitialAdventureSave("profile-1"), ROUTE_ID, TEST_CONTENT);
  assert.deepEqual(locked.availableModes, []);
  assert.equal(locked.blockedReason, "route-locked");
  assert.equal(locked.runtimeReady, true);

  const ready = getRouteTravelState(readyFirstVoyage(), ROUTE_ID, TEST_CONTENT);
  assert.equal(ready.unlocked, true);
  assert.equal(ready.completed, false);
  assert.equal(ready.endpointSide, "from");
  assert.equal(ready.originDockId, SHELLSHORE_DOCK_ID);
  assert.equal(ready.destinationDockId, SUNPATCH_DOCK_ID);
  assert.equal(ready.canBoardManual, true);
  assert.equal(ready.canAutoSteer, false);
  assert.deepEqual(ready.availableModes, ["manual"]);

  const completed = readyFirstVoyage();
  completed.world.completedRouteIds = [ROUTE_ID];
  const repeat = getRouteTravelState(completed, ROUTE_ID, TEST_CONTENT);
  assert.equal(repeat.canBoardManual, true);
  assert.equal(repeat.canAutoSteer, true);
  assert.deepEqual(repeat.availableModes, ["manual", "auto"]);
});

test("first voyage waits for both quest completion and explicit boat-safety review", () => {
  const save = createInitialAdventureSave("profile-1");
  save.world.unlockedRouteIds = [ROUTE_ID];
  save.progression.quests["quest-shellshore-first-voyage"] = {
    status: "readyToTurnIn",
    flags: { "boat-safety-reviewed": true },
  };
  let state = getRouteTravelState(save, ROUTE_ID, TEST_CONTENT);
  assert.equal(state.blockedReason, "first-voyage-quest-incomplete");
  assert.equal(state.prerequisites.questComplete, false);

  save.progression.quests["quest-shellshore-first-voyage"].status = "complete";
  save.progression.quests["quest-shellshore-first-voyage"].flags = {};
  state = getRouteTravelState(save, ROUTE_ID, TEST_CONTENT);
  assert.equal(state.blockedReason, "boat-safety-review-required");
  assert.equal(state.prerequisites.boatSafetyReviewed, false);

  assert.throws(
    () => boardAdventureRoute(save, {
      routeId: ROUTE_ID,
      originDockId: SHELLSHORE_DOCK_ID,
    }, TEST_CONTENT),
    /boat-safety-review-required/,
  );
});

test("boarding preserves the safe origin while entering the authored route spawn", () => {
  const initial = readyFirstVoyage();
  const boarded = boardAdventureRoute(initial, {
    routeId: ROUTE_ID,
    originDockId: SHELLSHORE_DOCK_ID,
  }, TEST_CONTENT);

  assert.equal(boarded.world.townId, "shellshore-village");
  assert.equal(boarded.world.sceneId, "shellshore-sunpatch-sea");
  assert.deepEqual(boarded.world.position, { x: 1, y: 4 });
  assert.equal(boarded.world.facing, "right");
  assert.equal(boarded.world.lastSafeDockId, SHELLSHORE_DOCK_ID);
  assert.deepEqual(boarded.world.completedRouteIds, []);
  assert.deepEqual(initial.world.position, { x: 7, y: 8 });
});

test("route scene spawn is a safe metadata fallback when endpoint spawn is omitted", () => {
  const content = structuredClone(TEST_CONTENT);
  delete content.routes[0].fromSpawn;
  delete content.routes[0].toSpawn;
  const boarded = boardAdventureRoute(readyFirstVoyage(), {
    routeId: ROUTE_ID,
    originDockId: SHELLSHORE_DOCK_ID,
  }, content);

  assert.deepEqual(boarded.world.position, { x: 1, y: 4 });
  assert.equal(boarded.world.facing, "right");
});

test("an incomplete route is manual-only and can only begin at its authored origin", () => {
  const ready = readyFirstVoyage();
  assert.throws(
    () => boardAdventureRoute(ready, {
      routeId: ROUTE_ID,
      originDockId: SHELLSHORE_DOCK_ID,
      mode: "auto",
    }, TEST_CONTENT),
    /requires one completed manual voyage/,
  );

  const wrongDirection = atSunpatch(ready);
  const state = getRouteTravelState(wrongDirection, ROUTE_ID, TEST_CONTENT);
  assert.equal(state.blockedReason, "first-voyage-wrong-direction");
  assert.throws(
    () => boardAdventureRoute(wrongDirection, {
      routeId: ROUTE_ID,
      originDockId: SUNPATCH_DOCK_ID,
    }, TEST_CONTENT),
    /first-voyage-wrong-direction/,
  );
});

test("boarding rejects non-endpoint docks, the wrong current town, and unavailable runtime content", () => {
  const ready = readyFirstVoyage();
  assert.throws(
    () => boardAdventureRoute(ready, {
      routeId: ROUTE_ID,
      originDockId: "research-pier",
    }, TEST_CONTENT),
    /not an endpoint/,
  );

  const wrongTown = atSunpatch(ready);
  assert.throws(
    () => boardAdventureRoute(wrongTown, {
      routeId: ROUTE_ID,
      originDockId: SHELLSHORE_DOCK_ID,
    }, TEST_CONTENT),
    /outside the current town/,
  );

  const planned = normalizeAdventureSave({
    ...wrongTown,
    world: {
      ...wrongTown.world,
      unlockedRouteIds: [...wrongTown.world.unlockedRouteIds, "route-sunpatch-brackwater"],
    },
  });
  assert.equal(
    getRouteTravelState(planned, "route-sunpatch-brackwater", TEST_CONTENT).runtimeReady,
    false,
  );
  assert.throws(
    () => boardAdventureRoute(planned, {
      routeId: "route-sunpatch-brackwater",
      originDockId: SUNPATCH_DOCK_ID,
    }, TEST_CONTENT),
    /requires a prototype route scene/,
  );
});

test("manual destination docking atomically records first completion and safe Sunpatch arrival", () => {
  const boarded = boardAdventureRoute(readyFirstVoyage(), {
    routeId: ROUTE_ID,
    originDockId: SHELLSHORE_DOCK_ID,
  }, TEST_CONTENT);
  const docked = dockAdventureRoute(atRouteSide(boarded, "to"), {
    routeId: ROUTE_ID,
    destinationDockId: SUNPATCH_DOCK_ID,
  }, TEST_CONTENT);

  assert.deepEqual(docked.world, {
    townId: "sunpatch-cay",
    sceneId: "sunpatch-cay-town",
    position: { x: 2, y: 7 },
    facing: "up",
    lastSafeDockId: SUNPATCH_DOCK_ID,
    unlockedRouteIds: [ROUTE_ID],
    completedRouteIds: [ROUTE_ID],
  });
  assert.deepEqual(boarded.world.completedRouteIds, []);
});

test("returning to the origin does not complete an unfinished route", () => {
  const boarded = boardAdventureRoute(readyFirstVoyage(), {
    routeId: ROUTE_ID,
    originDockId: SHELLSHORE_DOCK_ID,
  }, TEST_CONTENT);
  const returned = dockAdventureRoute(boarded, {
    routeId: ROUTE_ID,
    destinationDockId: SHELLSHORE_DOCK_ID,
  }, TEST_CONTENT);

  assert.equal(returned.world.townId, "shellshore-village");
  assert.equal(returned.world.sceneId, "town");
  assert.deepEqual(returned.world.completedRouteIds, []);
});

test("duplicate docking callbacks are idempotent and never duplicate completion evidence", () => {
  const boarded = boardAdventureRoute(readyFirstVoyage(), {
    routeId: ROUTE_ID,
    originDockId: SHELLSHORE_DOCK_ID,
  }, TEST_CONTENT);
  const first = dockAdventureRoute(atRouteSide(boarded, "to"), {
    routeId: ROUTE_ID,
    destinationDockId: SUNPATCH_DOCK_ID,
  }, TEST_CONTENT);
  const retry = dockAdventureRoute(first, {
    routeId: ROUTE_ID,
    destinationDockId: SUNPATCH_DOCK_ID,
  }, TEST_CONTENT);

  assert.deepEqual(retry, first);
  assert.deepEqual(retry.world.completedRouteIds, [ROUTE_ID]);
});

test("docking cannot teleport a boat from land, a locked route, or an invalid origin", () => {
  const ready = readyFirstVoyage();
  assert.throws(
    () => dockAdventureRoute(ready, {
      routeId: ROUTE_ID,
      destinationDockId: SUNPATCH_DOCK_ID,
    }, TEST_CONTENT),
    /outside its route scene/,
  );

  const aboardLocked = boardAdventureRoute(ready, {
    routeId: ROUTE_ID,
    originDockId: SHELLSHORE_DOCK_ID,
  }, TEST_CONTENT);
  assert.throws(
    () => dockAdventureRoute(aboardLocked, {
      routeId: ROUTE_ID,
      destinationDockId: SUNPATCH_DOCK_ID,
    }, TEST_CONTENT),
    /destination dock zone/,
  );
  aboardLocked.world.unlockedRouteIds = [];
  assert.throws(
    () => dockAdventureRoute(aboardLocked, {
      routeId: ROUTE_ID,
      destinationDockId: SUNPATCH_DOCK_ID,
    }, TEST_CONTENT),
    /is locked/,
  );

  aboardLocked.world.unlockedRouteIds = [ROUTE_ID];
  aboardLocked.world.townId = "brackwater-landing";
  assert.throws(
    () => dockAdventureRoute(aboardLocked, {
      routeId: ROUTE_ID,
      destinationDockId: SUNPATCH_DOCK_ID,
    }, TEST_CONTENT),
    /not one of its endpoint towns/,
  );
});

test("completed routes support manual reverse boarding with the to-side spawn", () => {
  const completedAtSunpatch = atSunpatch(readyFirstVoyage());
  completedAtSunpatch.world.completedRouteIds = [ROUTE_ID];
  const boarded = boardAdventureRoute(completedAtSunpatch, {
    routeId: ROUTE_ID,
    originDockId: SUNPATCH_DOCK_ID,
  }, TEST_CONTENT);

  assert.equal(boarded.world.townId, "sunpatch-cay");
  assert.deepEqual(boarded.world.position, { x: 8, y: 4 });
  assert.equal(boarded.world.facing, "left");
  assert.equal(boarded.world.lastSafeDockId, SUNPATCH_DOCK_ID);
});

test("auto-steer is locked before manual completion and then travels either direction", () => {
  const ready = readyFirstVoyage();
  assert.throws(
    () => autoSteerAdventureRoute(ready, {
      routeId: ROUTE_ID,
      destinationDockId: SUNPATCH_DOCK_ID,
    }, TEST_CONTENT),
    /requires one completed manual voyage/,
  );

  const boarded = boardAdventureRoute(ready, {
    routeId: ROUTE_ID,
    originDockId: SHELLSHORE_DOCK_ID,
  }, TEST_CONTENT);
  const firstArrival = dockAdventureRoute(atRouteSide(boarded, "to"), {
    routeId: ROUTE_ID,
    destinationDockId: SUNPATCH_DOCK_ID,
  }, TEST_CONTENT);
  const shellshore = autoSteerAdventureRoute(firstArrival, {
    routeId: ROUTE_ID,
    destinationDockId: SHELLSHORE_DOCK_ID,
  }, TEST_CONTENT);
  assert.equal(shellshore.world.townId, "shellshore-village");
  assert.equal(shellshore.world.lastSafeDockId, SHELLSHORE_DOCK_ID);
  assert.deepEqual(shellshore.world.completedRouteIds, [ROUTE_ID]);

  const sunpatch = autoSteerAdventureRoute(shellshore, {
    routeId: ROUTE_ID,
    destinationDockId: SUNPATCH_DOCK_ID,
  }, TEST_CONTENT);
  assert.equal(sunpatch.world.townId, "sunpatch-cay");
  assert.deepEqual(sunpatch.world.completedRouteIds, [ROUTE_ID]);
});

test("boarding and auto-steer require the player to return to the dock zone", () => {
  const completedAtSunpatch = atSunpatch(readyFirstVoyage());
  completedAtSunpatch.world.completedRouteIds = [ROUTE_ID];

  const nearDock = normalizeAdventureSave({
    ...completedAtSunpatch,
    world: {
      ...completedAtSunpatch.world,
      position: { x: 2.08, y: 7.18 },
      facing: "down",
    },
  });
  const nearState = getRouteTravelState(nearDock, ROUTE_ID, TEST_CONTENT);
  assert.equal(nearState.canBoardManual, true);
  assert.equal(nearState.canAutoSteer, true);
  assert.equal(
    autoSteerAdventureRoute(nearDock, {
      routeId: ROUTE_ID,
      destinationDockId: SHELLSHORE_DOCK_ID,
    }, TEST_CONTENT).world.townId,
    "shellshore-village",
  );

  const awayFromDock = normalizeAdventureSave({
    ...completedAtSunpatch,
    world: { ...completedAtSunpatch.world, position: { x: 5, y: 5 } },
  });
  const awayState = getRouteTravelState(awayFromDock, ROUTE_ID, TEST_CONTENT);
  assert.equal(awayState.canAutoSteer, false);
  assert.equal(awayState.blockedReason, "not-at-endpoint-dock");
  assert.throws(
    () => autoSteerAdventureRoute(awayFromDock, {
      routeId: ROUTE_ID,
      destinationDockId: SHELLSHORE_DOCK_ID,
    }, TEST_CONTENT),
    /not-at-endpoint-dock/,
  );
});

test("auto-steer honors route policy and does not relocate within the current endpoint town", () => {
  const content = structuredClone(TEST_CONTENT);
  content.routes[0].autoSteerAfterFirstCompletion = false;
  const completed = readyFirstVoyage();
  completed.world.completedRouteIds = [ROUTE_ID];
  assert.throws(
    () => autoSteerAdventureRoute(completed, {
      routeId: ROUTE_ID,
      destinationDockId: SUNPATCH_DOCK_ID,
    }, content),
    /requires one completed manual voyage/,
  );

  const movedInsideSunpatch = atSunpatch(completed);
  movedInsideSunpatch.world.position = { x: 5, y: 5 };
  assert.throws(
    () => autoSteerAdventureRoute(movedInsideSunpatch, {
      routeId: ROUTE_ID,
      destinationDockId: SUNPATCH_DOCK_ID,
    }, TEST_CONTENT),
    /opposite the current endpoint/,
  );
});

test("the canonical Sunpatch-Brackwater route boards, pilots, docks, and then auto-steers both ways", () => {
  const routeId = "route-sunpatch-brackwater";
  const fromDockId = "sunpatch-brackwater-dock";
  const toDockId = "brackwater-dock";
  const initial = createInitialAdventureSave("profile-brackwater-route");
  const atSunpatchDeparture = normalizeAdventureSave({
    ...initial,
    world: {
      ...initial.world,
      townId: "sunpatch-cay",
      sceneId: "sunpatch-cay-town",
      position: { x: 8, y: 8 },
      facing: "up",
      lastSafeDockId: fromDockId,
      unlockedRouteIds: [routeId],
    },
  });

  const travelState = getRouteTravelState(atSunpatchDeparture, routeId, ADVENTURE_CONTENT);
  assert.equal(travelState.runtimeReady, true);
  assert.equal(travelState.canBoardManual, true);
  assert.equal(travelState.canAutoSteer, false);

  const boarded = boardAdventureRoute(atSunpatchDeparture, {
    routeId,
    originDockId: fromDockId,
  }, ADVENTURE_CONTENT);
  assert.equal(boarded.world.sceneId, "sunpatch-brackwater-sea");
  assert.deepEqual(boarded.world.position, { x: 1, y: 5 });

  const atBrackwaterSide = normalizeAdventureSave({
    ...boarded,
    world: {
      ...boarded.world,
      position: { x: 14, y: 5 },
      facing: "right",
    },
  });
  const arrived = dockAdventureRoute(atBrackwaterSide, {
    routeId,
    destinationDockId: toDockId,
  }, ADVENTURE_CONTENT);
  assert.equal(arrived.world.townId, "brackwater-landing");
  assert.equal(arrived.world.sceneId, "brackwater-landing-town");
  assert.deepEqual(arrived.world.position, { x: 7, y: 8 });
  assert.deepEqual(arrived.world.completedRouteIds, [routeId]);

  const returned = autoSteerAdventureRoute(arrived, {
    routeId,
    destinationDockId: fromDockId,
  }, ADVENTURE_CONTENT);
  assert.equal(returned.world.townId, "sunpatch-cay");
  assert.equal(returned.world.lastSafeDockId, fromDockId);

  const revisited = autoSteerAdventureRoute(returned, {
    routeId,
    destinationDockId: toDockId,
  }, ADVENTURE_CONTENT);
  assert.equal(revisited.world.townId, "brackwater-landing");
  assert.deepEqual(revisited.world.completedRouteIds, [routeId]);
});

test("the canonical Brackwater-Current route boards from its separate dock and supports repeat auto-steer", () => {
  const routeId = "route-brackwater-current";
  const fromDockId = "brackwater-current-dock";
  const toDockId = "current-commons-dock";
  const initial = createInitialAdventureSave("profile-current-route");
  const atBrackwaterDeparture = normalizeAdventureSave({
    ...initial,
    world: {
      ...initial.world,
      townId: "brackwater-landing",
      sceneId: "brackwater-landing-town",
      position: { x: 8, y: 8 },
      facing: "up",
      lastSafeDockId: fromDockId,
      unlockedRouteIds: [routeId],
    },
  });

  const travelState = getRouteTravelState(atBrackwaterDeparture, routeId, ADVENTURE_CONTENT);
  assert.equal(travelState.runtimeReady, true);
  assert.equal(travelState.canBoardManual, true);
  assert.equal(travelState.canAutoSteer, false);

  const boarded = boardAdventureRoute(atBrackwaterDeparture, {
    routeId,
    originDockId: fromDockId,
  }, ADVENTURE_CONTENT);
  assert.equal(boarded.world.sceneId, "brackwater-current-sea");
  assert.deepEqual(boarded.world.position, { x: 1, y: 5 });

  const atCurrentSide = normalizeAdventureSave({
    ...boarded,
    world: {
      ...boarded.world,
      position: { x: 14, y: 5 },
      facing: "right",
    },
  });
  const arrived = dockAdventureRoute(atCurrentSide, {
    routeId,
    destinationDockId: toDockId,
  }, ADVENTURE_CONTENT);
  assert.equal(arrived.world.townId, "current-commons");
  assert.equal(arrived.world.sceneId, "current-commons-town");
  assert.deepEqual(arrived.world.position, { x: 7, y: 8 });
  assert.deepEqual(arrived.world.completedRouteIds, [routeId]);

  const returned = autoSteerAdventureRoute(arrived, {
    routeId,
    destinationDockId: fromDockId,
  }, ADVENTURE_CONTENT);
  assert.equal(returned.world.townId, "brackwater-landing");
  assert.equal(returned.world.lastSafeDockId, fromDockId);

  const revisited = autoSteerAdventureRoute(returned, {
    routeId,
    destinationDockId: toDockId,
  }, ADVENTURE_CONTENT);
  assert.equal(revisited.world.townId, "current-commons");
  assert.deepEqual(revisited.world.completedRouteIds, [routeId]);
});

test("world map conceals locked towns and derives available, active, completed, and Tide Mark states", () => {
  const initial = createInitialAdventureSave("profile-1");
  let model = buildAdventureWorldMapModel(initial, TEST_CONTENT);
  assert.deepEqual(model.currentLocation, { type: "town", townId: "shellshore-village" });
  assert.equal(model.towns.find((town) => town.townId === "shellshore-village").status, "current");
  const lockedSunpatch = model.towns.find((town) => town.townId === "sunpatch-cay");
  assert.equal(lockedSunpatch.status, "locked");
  assert.equal(lockedSunpatch.name, null);
  assert.equal(model.routes[0].status, "locked");

  const ready = readyFirstVoyage();
  model = buildAdventureWorldMapModel(ready, TEST_CONTENT);
  const availableSunpatch = model.towns.find((town) => town.townId === "sunpatch-cay");
  assert.equal(availableSunpatch.status, "available");
  assert.equal(availableSunpatch.name, "Sunpatch Cay");
  assert.equal(model.routes[0].status, "available");
  assert.equal(model.routes[0].canBoardManualNow, true);
  assert.equal(model.routes[0].canAutoSteerNow, false);

  const aboard = boardAdventureRoute(ready, {
    routeId: ROUTE_ID,
    originDockId: SHELLSHORE_DOCK_ID,
  }, TEST_CONTENT);
  model = buildAdventureWorldMapModel(aboard, TEST_CONTENT);
  assert.deepEqual(model.currentLocation, {
    type: "route",
    routeId: ROUTE_ID,
    originTownId: "shellshore-village",
  });
  assert.equal(model.routes[0].status, "active");

  const completed = dockAdventureRoute(atRouteSide(aboard, "to"), {
    routeId: ROUTE_ID,
    destinationDockId: SUNPATCH_DOCK_ID,
  }, TEST_CONTENT);
  completed.progression.tideMarkIds = ["tide-mark-sunpatch"];
  model = buildAdventureWorldMapModel(completed, TEST_CONTENT);
  const visitedSunpatch = model.towns.find((town) => town.townId === "sunpatch-cay");
  assert.equal(visitedSunpatch.status, "current");
  assert.equal(visitedSunpatch.visited, true);
  assert.equal(visitedSunpatch.tideMarkEarned, true);
  assert.equal(model.routes[0].status, "completed");
  assert.equal(model.routes[0].autoSteerUnlocked, true);
  assert.equal(model.towns.find((town) => town.townId === "brackwater-landing").name, null);
});

test("travel APIs reject unknown routes and unsupported modes without mutating the save", () => {
  const save = readyFirstVoyage();
  const before = structuredClone(save);
  assert.throws(
    () => getRouteTravelState(save, "route-missing", TEST_CONTENT),
    /Unknown adventure route/,
  );
  assert.throws(
    () => boardAdventureRoute(save, {
      routeId: ROUTE_ID,
      originDockId: SHELLSHORE_DOCK_ID,
      mode: "teleport",
    }, TEST_CONTENT),
    /must be manual or auto/,
  );
  assert.deepEqual(save, before);
});
