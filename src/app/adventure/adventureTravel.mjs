import { ADVENTURE_CONTENT } from "./adventureContent.mjs";
import { normalizeAdventureSave } from "./adventureProgression.mjs";

const TRAVEL_MODES = new Set(["manual", "auto"]);
const FACING_DIRECTIONS = new Set(["up", "down", "left", "right"]);
const FIRST_VOYAGE_ROUTE_ID = "route-shellshore-sunpatch";
const FIRST_VOYAGE_QUEST_ID = "quest-shellshore-first-voyage";
const BOAT_SAFETY_FLAG_ID = "boat-safety-reviewed";
const DOCK_BOARDING_RADIUS = 0.75;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function requireTravelMode(mode) {
  if (!TRAVEL_MODES.has(mode)) {
    throw new RangeError(`Adventure travel mode must be manual or auto, received ${String(mode)}.`);
  }
  return mode;
}

function requireIdentifier(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${label} must be a non-empty string identifier.`);
  }
  return value.trim();
}

function findById(collection, id) {
  return asArray(collection).find((item) => item?.id === id) ?? null;
}

function requireRoute(routeIdValue, content) {
  const routeId = requireIdentifier(routeIdValue, "Route ID");
  const route = findById(content?.routes, routeId);
  if (!route) throw new RangeError(`Unknown adventure route: ${routeId}`);
  return route;
}

function routeSideForTown(route, townId) {
  if (townId === route.fromTownId) return "from";
  if (townId === route.toTownId) return "to";
  return null;
}

function routeSideForDock(route, dockId) {
  if (dockId === route.fromDockId) return "from";
  if (dockId === route.toDockId) return "to";
  return null;
}

function dockIdForSide(route, side) {
  return side === "from" ? route.fromDockId : route.toDockId;
}

function otherRouteSide(side) {
  return side === "from" ? "to" : "from";
}

function isFinitePosition(position) {
  return Number.isFinite(position?.x) && Number.isFinite(position?.y);
}

function isPrototypeRuntimeScene(scene) {
  return Boolean(
    scene
    && scene.status === "prototype"
    && scene.world
    && isFinitePosition(scene.world.spawn),
  );
}

function isPrototypeRuntimeDock(dock, expectedTownId, content) {
  if (
    !dock
    || dock.status !== "prototype"
    || dock.townId !== expectedTownId
    || typeof dock.sceneId !== "string"
    || !isFinitePosition(dock.position)
    || !FACING_DIRECTIONS.has(dock.facing)
  ) {
    return false;
  }
  return isPrototypeRuntimeScene(findById(content?.scenes, dock.sceneId));
}

function inspectRouteRuntime(route, content) {
  const routeScene = findById(content?.scenes, route.sceneId);
  const fromDock = findById(content?.docks, route.fromDockId);
  const toDock = findById(content?.docks, route.toDockId);
  const routeSceneMatches = !routeScene?.routeId || routeScene.routeId === route.id;
  const ready = Boolean(
    typeof route.sceneId === "string"
    && typeof route.fromDockId === "string"
    && typeof route.toDockId === "string"
    && isPrototypeRuntimeScene(routeScene)
    && routeSceneMatches
    && isPrototypeRuntimeDock(fromDock, route.fromTownId, content)
    && isPrototypeRuntimeDock(toDock, route.toTownId, content),
  );
  return { ready, routeScene, fromDock, toDock };
}

function requireRouteRuntime(route, content) {
  const runtime = inspectRouteRuntime(route, content);
  if (!runtime.ready) {
    throw new RangeError(
      `Adventure route ${route.id} requires a prototype route scene and prototype docks for both endpoint towns.`,
    );
  }
  return runtime;
}

function firstVoyagePrerequisites(save, route, completed) {
  if (route.id !== FIRST_VOYAGE_ROUTE_ID || completed) {
    return {
      required: false,
      questComplete: true,
      boatSafetyReviewed: true,
      met: true,
    };
  }
  const quest = save.progression.quests[FIRST_VOYAGE_QUEST_ID];
  const questComplete = quest?.status === "complete";
  const boatSafetyReviewed = quest?.flags?.[BOAT_SAFETY_FLAG_ID] === true;
  return {
    required: true,
    questComplete,
    boatSafetyReviewed,
    met: questComplete && boatSafetyReviewed,
  };
}

function routeSpawn(route, routeScene, side, originDock) {
  const authored = side === "from" ? route.fromSpawn : route.toSpawn;
  const position = authored?.position ?? authored ?? routeScene.world.spawn;
  if (!isFinitePosition(position)) {
    throw new RangeError(`Adventure route ${route.id} ${side} spawn requires finite x and y coordinates.`);
  }
  const authoredFacing = authored?.facing
    ?? (side === "from" ? route.fromFacing : route.toFacing)
    ?? routeScene.world.startFacing
    ?? originDock.facing;
  if (!FACING_DIRECTIONS.has(authoredFacing)) {
    throw new RangeError(`Adventure route ${route.id} ${side} spawn requires a valid facing direction.`);
  }
  return {
    position: { x: position.x, y: position.y },
    facing: authoredFacing,
  };
}

function isAtDock(save, dock) {
  return save.world.townId === dock.townId
    && save.world.sceneId === dock.sceneId
    && save.world.lastSafeDockId === dock.id
    && save.world.position.x === dock.position.x
    && save.world.position.y === dock.position.y
    && save.world.facing === dock.facing;
}

function isAtDockPosition(save, dock) {
  return save.world.townId === dock.townId
    && save.world.sceneId === dock.sceneId
    && Math.hypot(
      save.world.position.x - dock.position.x,
      save.world.position.y - dock.position.y,
    ) <= DOCK_BOARDING_RADIUS;
}

function appendUnique(values, value) {
  return values.includes(value) ? values : [...values, value];
}

function tideMarkIdsForTown(town, content) {
  const tideMarkIds = new Set([
    ...asArray(town.tideMarkIds),
    ...(typeof town.tideMarkId === "string" ? [town.tideMarkId] : []),
  ]);
  const encounters = asArray(content?.encounters).filter((encounter) => (
    encounter?.townId === town.id || asArray(town.encounterIds).includes(encounter?.id)
  ));
  for (const encounter of encounters) {
    const reward = findById(content?.rewards, encounter.rewardId);
    for (const tideMarkId of asArray(reward?.tideMarkIds)) tideMarkIds.add(tideMarkId);
  }
  return [...tideMarkIds];
}

function boardBlockReason({
  unlocked,
  active,
  runtimeReady,
  endpointSide,
  atEndpointDock,
  prerequisites,
  completed,
}) {
  if (!unlocked) return "route-locked";
  if (active) return "already-aboard";
  if (!runtimeReady) return "route-runtime-unavailable";
  if (!endpointSide) return "not-at-route-endpoint";
  if (!atEndpointDock) return "not-at-endpoint-dock";
  if (!prerequisites.met) return prerequisites.questComplete
    ? "boat-safety-review-required"
    : "first-voyage-quest-incomplete";
  if (!completed && endpointSide !== "from") return "first-voyage-wrong-direction";
  return null;
}

/**
 * Returns the route's canonical unlock/completion/runtime state without
 * mutating the save. Planned routes remain inspectable but cannot be boarded.
 */
export function getRouteTravelState(
  saveValue,
  routeIdValue,
  content = ADVENTURE_CONTENT,
) {
  const save = normalizeAdventureSave(saveValue);
  const route = requireRoute(routeIdValue, content);
  const runtime = inspectRouteRuntime(route, content);
  const unlocked = save.world.unlockedRouteIds.includes(route.id);
  const completed = save.world.completedRouteIds.includes(route.id);
  const active = Boolean(route.sceneId && save.world.sceneId === route.sceneId);
  const endpointSide = active ? null : routeSideForTown(route, save.world.townId);
  const originDockId = endpointSide ? (dockIdForSide(route, endpointSide) ?? null) : null;
  const destinationDockId = endpointSide
    ? (dockIdForSide(route, otherRouteSide(endpointSide)) ?? null)
    : null;
  const originDock = originDockId === route.fromDockId ? runtime.fromDock : runtime.toDock;
  const atEndpointDock = Boolean(
    endpointSide
    && originDock
    && isAtDockPosition(save, originDock),
  );
  const prerequisites = firstVoyagePrerequisites(save, route, completed);
  const blockedReason = boardBlockReason({
    unlocked,
    active,
    runtimeReady: runtime.ready,
    endpointSide,
    atEndpointDock,
    prerequisites,
    completed,
  });
  const canBoardManual = blockedReason === null;
  const canAutoSteer = canBoardManual
    && completed
    && route.autoSteerAfterFirstCompletion === true;

  return {
    routeId: route.id,
    unlocked,
    completed,
    active,
    runtimeReady: runtime.ready,
    endpointSide,
    originDockId,
    destinationDockId,
    prerequisites,
    blockedReason,
    canBoardManual,
    canAutoSteer,
    availableModes: [
      ...(canBoardManual ? ["manual"] : []),
      ...(canAutoSteer ? ["auto"] : []),
    ],
  };
}

/** Boards a route while keeping townId and lastSafeDockId at the safe origin. */
export function boardAdventureRoute(
  saveValue,
  { routeId, originDockId, mode = "manual" },
  content = ADVENTURE_CONTENT,
) {
  const travelMode = requireTravelMode(mode);
  const save = normalizeAdventureSave(saveValue);
  const route = requireRoute(routeId, content);
  const originId = requireIdentifier(originDockId, "Origin dock ID");
  const originSide = routeSideForDock(route, originId);
  if (!originSide) {
    throw new RangeError(`Dock ${originId} is not an endpoint of adventure route ${route.id}.`);
  }
  const runtime = requireRouteRuntime(route, content);
  const originDock = originSide === "from" ? runtime.fromDock : runtime.toDock;
  if (originDock.townId !== save.world.townId) {
    throw new RangeError(`Adventure route ${route.id} cannot board from a dock outside the current town.`);
  }

  if (save.world.sceneId === route.sceneId) {
    const completed = save.world.completedRouteIds.includes(route.id);
    const prerequisites = firstVoyagePrerequisites(save, route, completed);
    if (!save.world.unlockedRouteIds.includes(route.id)) {
      throw new RangeError(`Adventure route ${route.id} is locked.`);
    }
    if (routeSideForTown(route, save.world.townId) !== originSide) {
      throw new RangeError(`Adventure route ${route.id} active origin does not match ${originId}.`);
    }
    if (!prerequisites.met) {
      throw new RangeError(`Adventure route ${route.id} has not met its first-voyage prerequisites.`);
    }
    if (!completed && originSide !== "from") {
      throw new RangeError(`Adventure route ${route.id} requires a first manual voyage from its authored origin.`);
    }
    if (
      travelMode === "auto"
      && (!completed || route.autoSteerAfterFirstCompletion !== true)
    ) {
      throw new RangeError(`Adventure route ${route.id} requires one completed manual voyage before auto-steer.`);
    }
    return save;
  }

  const state = getRouteTravelState(save, route.id, content);
  if (state.originDockId !== originId) {
    throw new RangeError(`Adventure route ${route.id} must board from ${state.originDockId ?? "a route endpoint"}.`);
  }
  if (!state.canBoardManual) {
    throw new RangeError(`Adventure route ${route.id} cannot board: ${state.blockedReason}.`);
  }
  if (travelMode === "auto" && !state.canAutoSteer) {
    throw new RangeError(`Adventure route ${route.id} requires one completed manual voyage before auto-steer.`);
  }

  const spawn = routeSpawn(route, runtime.routeScene, originSide, originDock);
  return normalizeAdventureSave({
    ...save,
    world: {
      ...save.world,
      sceneId: route.sceneId,
      position: spawn.position,
      facing: spawn.facing,
    },
  });
}

/**
 * Docks an active route in one atomic save update. Only a first manual
 * fromTown -> toTown arrival records manual route completion.
 */
export function dockAdventureRoute(
  saveValue,
  { routeId, destinationDockId, mode = "manual" },
  content = ADVENTURE_CONTENT,
) {
  const travelMode = requireTravelMode(mode);
  const save = normalizeAdventureSave(saveValue);
  const route = requireRoute(routeId, content);
  const destinationId = requireIdentifier(destinationDockId, "Destination dock ID");
  const destinationSide = routeSideForDock(route, destinationId);
  if (!destinationSide) {
    throw new RangeError(`Dock ${destinationId} is not an endpoint of adventure route ${route.id}.`);
  }
  const runtime = requireRouteRuntime(route, content);
  const destinationDock = destinationSide === "from" ? runtime.fromDock : runtime.toDock;

  if (!save.world.unlockedRouteIds.includes(route.id)) {
    throw new RangeError(`Adventure route ${route.id} is locked.`);
  }
  const originSide = routeSideForTown(route, save.world.townId);
  if (!originSide) {
    throw new RangeError(`Adventure route ${route.id} active origin is not one of its endpoint towns.`);
  }
  const completed = save.world.completedRouteIds.includes(route.id);
  if (!completed && (travelMode !== "manual" || originSide !== "from")) {
    throw new RangeError(`Adventure route ${route.id} requires a first manual voyage from its authored origin.`);
  }
  if (
    travelMode === "auto"
    && (!completed || route.autoSteerAfterFirstCompletion !== true)
  ) {
    throw new RangeError(`Adventure route ${route.id} has not unlocked auto-steer.`);
  }
  // React retries or repeated collision callbacks after the atomic write are harmless.
  if (isAtDock(save, destinationDock)) return save;
  if (save.world.sceneId !== route.sceneId) {
    throw new RangeError(`Adventure route ${route.id} cannot dock while the boat is outside its route scene.`);
  }
  if (travelMode === "manual") {
    const arrival = routeSpawn(route, runtime.routeScene, destinationSide, destinationDock);
    const distanceToDock = Math.hypot(
      save.world.position.x - arrival.position.x,
      save.world.position.y - arrival.position.y,
    );
    if (distanceToDock > DOCK_BOARDING_RADIUS) {
      throw new RangeError(`Adventure route ${route.id} cannot dock until the boat reaches the destination dock zone.`);
    }
  }

  const firstManualCompletion = !completed
    && travelMode === "manual"
    && originSide === "from"
    && destinationSide === "to";

  return normalizeAdventureSave({
    ...save,
    world: {
      ...save.world,
      townId: destinationDock.townId,
      sceneId: destinationDock.sceneId,
      position: { x: destinationDock.position.x, y: destinationDock.position.y },
      facing: destinationDock.facing,
      lastSafeDockId: destinationDock.id,
      completedRouteIds: firstManualCompletion
        ? appendUnique(save.world.completedRouteIds, route.id)
        : save.world.completedRouteIds,
    },
  });
}

/**
 * Provides an atomic completed-route fast-travel path. Animated auto-steer can
 * call boardAdventureRoute first and dockAdventureRoute after its visual path.
 */
export function autoSteerAdventureRoute(
  saveValue,
  { routeId, destinationDockId },
  content = ADVENTURE_CONTENT,
) {
  const save = normalizeAdventureSave(saveValue);
  const route = requireRoute(routeId, content);
  const destinationId = requireIdentifier(destinationDockId, "Destination dock ID");
  const destinationSide = routeSideForDock(route, destinationId);
  if (!destinationSide) {
    throw new RangeError(`Dock ${destinationId} is not an endpoint of adventure route ${route.id}.`);
  }
  const runtime = requireRouteRuntime(route, content);
  const destinationDock = destinationSide === "from" ? runtime.fromDock : runtime.toDock;
  if (
    !save.world.unlockedRouteIds.includes(route.id)
    || !save.world.completedRouteIds.includes(route.id)
    || route.autoSteerAfterFirstCompletion !== true
  ) {
    throw new RangeError(`Adventure route ${route.id} requires one completed manual voyage before auto-steer.`);
  }
  if (isAtDock(save, destinationDock)) return save;

  const originSide = otherRouteSide(destinationSide);
  const expectedOriginTownId = originSide === "from" ? route.fromTownId : route.toTownId;
  if (save.world.townId !== expectedOriginTownId) {
    throw new RangeError(`Adventure route ${route.id} auto-steer destination must be opposite the current endpoint.`);
  }

  const aboard = save.world.sceneId === route.sceneId
    ? save
    : boardAdventureRoute(save, {
      routeId: route.id,
      originDockId: dockIdForSide(route, originSide),
      mode: "auto",
    }, content);
  return dockAdventureRoute(aboard, {
    routeId: route.id,
    destinationDockId: destinationId,
    mode: "auto",
  }, content);
}

/** Builds a UI-ready, non-mutating regional map model without exposing locked names. */
export function buildAdventureWorldMapModel(
  saveValue,
  content = ADVENTURE_CONTENT,
) {
  const save = normalizeAdventureSave(saveValue);
  const routes = asArray(content?.routes);
  const towns = asArray(content?.towns);
  const unlockedRouteIds = new Set(save.world.unlockedRouteIds);
  const completedRouteIds = new Set(save.world.completedRouteIds);
  const activeRoute = routes.find((route) => route.sceneId === save.world.sceneId) ?? null;
  const visitedTownIds = new Set(
    towns
      .filter((town) => town.arrivalRouteId === null)
      .map((town) => town.id),
  );
  visitedTownIds.add(save.world.townId);
  for (const route of routes) {
    if (!completedRouteIds.has(route.id)) continue;
    visitedTownIds.add(route.fromTownId);
    visitedTownIds.add(route.toTownId);
  }

  const availableTownIds = new Set();
  for (const route of routes) {
    if (unlockedRouteIds.has(route.id)) availableTownIds.add(route.toTownId);
  }
  const atSea = Boolean(activeRoute);
  const townModels = towns.map((town) => {
    const visited = visitedTownIds.has(town.id);
    const available = !visited && availableTownIds.has(town.id);
    const current = !atSea && save.world.townId === town.id;
    const discovered = visited || available || current;
    const status = current ? "current" : visited ? "visited" : available ? "available" : "locked";
    const townTideMarkIds = discovered ? tideMarkIdsForTown(town, content) : [];
    return {
      townId: town.id,
      name: discovered ? town.name : null,
      displayName: discovered ? town.name : "Undiscovered waters",
      settlementType: discovered ? town.settlementType : null,
      habitatId: discovered ? town.habitatId : null,
      status,
      discovered,
      visited,
      available,
      current,
      tideMarkId: townTideMarkIds[0] ?? null,
      tideMarkIds: townTideMarkIds,
      tideMarkEarned: townTideMarkIds.some((tideMarkId) => (
        save.progression.tideMarkIds.includes(tideMarkId)
      )),
    };
  });
  const townsById = new Map(townModels.map((town) => [town.townId, town]));
  const routeModels = routes.map((route) => {
    const unlocked = unlockedRouteIds.has(route.id);
    const completed = completedRouteIds.has(route.id);
    const active = activeRoute?.id === route.id;
    const discovered = unlocked || completed || active;
    const runtimeReady = inspectRouteRuntime(route, content).ready;
    const state = getRouteTravelState(save, route.id, content);
    return {
      routeId: route.id,
      fromTownId: route.fromTownId,
      toTownId: route.toTownId,
      fromTownName: townsById.get(route.fromTownId)?.name ?? null,
      toTownName: townsById.get(route.toTownId)?.name ?? null,
      status: active ? "active" : completed ? "completed" : unlocked ? "available" : "locked",
      discovered,
      unlocked,
      completed,
      active,
      runtimeReady,
      manualPilotRequired: !completed && route.manualPilotRequiredFirstTime !== false,
      autoSteerUnlocked: completed && route.autoSteerAfterFirstCompletion === true,
      canBoardManualNow: state.canBoardManual,
      canAutoSteerNow: state.canAutoSteer,
      originDockId: state.originDockId,
      destinationDockId: state.destinationDockId,
    };
  });

  return {
    currentLocation: activeRoute
      ? {
          type: "route",
          routeId: activeRoute.id,
          originTownId: save.world.townId,
        }
      : {
          type: "town",
          townId: save.world.townId,
        },
    towns: townModels,
    routes: routeModels,
    tideMarkIds: [...save.progression.tideMarkIds],
  };
}
