import { normalizeAdventureSave } from "./adventureProgression.mjs";
import { ELVERSON_REEF_CATCHES } from "./adventureFishing.mjs";

export const ELVERSON_AQUARIUM_SCENE_ID = "academy-lab";
export const ELVERSON_REEF_CREATURE_ATLAS_PATH = "/images/adventure/elverson-reef-creature-atlas-v1.webp";

export const AQUARIUM_ECOSYSTEM_IDS = Object.freeze(["reef", "oceanic", "deep"]);
export const AQUARIUM_TANK_KINDS = Object.freeze(["community", "apex"]);
export const AQUARIUM_MOVEMENT_KINDS = Object.freeze([
  "school",
  "coral-home",
  "localized-benthic",
  "anchored",
  "cruiser",
]);

function aquariumBehaviorClassification(movementKind, habitatFeatures, description) {
  return Object.freeze({
    movementKind,
    habitatFeatures: Object.freeze([...habitatFeatures]),
    description,
  });
}

/**
 * Biological behavior is deliberately separate from the five low-level
 * movement primitives above. Renderers can share a primitive while giving a
 * sheltering school, a contour-following school, and a cover-seeking ball
 * visibly different decisions and timing.
 */
export const AQUARIUM_BEHAVIOR_CLASSIFICATIONS = Object.freeze({
  "shelter-school": aquariumBehaviorClassification(
    "school",
    ["coverPoints", "contourPath", "openWaterLane"],
    "A loose local school that repeatedly circles a nearby shelter.",
  ),
  "cleaning-station": aquariumBehaviorClassification(
    "coral-home",
    ["station"],
    "A solitary cleaner making short sorties from a fixed cleaning station.",
  ),
  "host-bound-pair": aquariumBehaviorClassification(
    "coral-home",
    ["station"],
    "A bonded pair that remains close to its host coral or anemone.",
  ),
  "cryptic-grazer": aquariumBehaviorClassification(
    "localized-benthic",
    ["coverPoints", "contourPath"],
    "A cautious grazer that creeps between nearby rock cover and pauses often.",
  ),
  "contour-school": aquariumBehaviorClassification(
    "school",
    ["contourPath"],
    "A cohesive school that follows the edges and elevation of the reef.",
  ),
  "substrate-grazer": aquariumBehaviorClassification(
    "anchored",
    ["station"],
    "A nearly stationary grazer attached to rock or substrate.",
  ),
  "reef-grazer-solo": aquariumBehaviorClassification(
    "cruiser",
    ["contourPath"],
    "A broad-ranging solitary grazer that tracks the reef face.",
  ),
  "bottom-scuttler": aquariumBehaviorClassification(
    "localized-benthic",
    ["contourPath"],
    "A bottom walker that alternates quick scuttles with long pauses.",
  ),
  "crevice-hunter": aquariumBehaviorClassification(
    "cruiser",
    ["coverPoints", "contourPath"],
    "A deliberate hunter that patrols and inspects reef crevices.",
  ),
  "territorial-pair": aquariumBehaviorClassification(
    "cruiser",
    ["station", "contourPath"],
    "A pair that loops through and returns to a defended reef territory.",
  ),
  "cover-school-ball": aquariumBehaviorClassification(
    "school",
    ["coverPoints", "contourPath"],
    "A compact bait ball that periodically darts into coral cover.",
  ),
  "pelagic-apex-glide": aquariumBehaviorClassification(
    "cruiser",
    ["openWaterLane"],
    "A large pelagic predator gliding through long open-water circuits.",
  ),
  "reef-ambush-patrol": aquariumBehaviorClassification(
    "cruiser",
    ["coverPoints", "contourPath"],
    "A large reef predator alternating slow patrols with cover-side holds.",
  ),
  "benthic-predator": aquariumBehaviorClassification(
    "localized-benthic",
    ["contourPath"],
    "A large predator following the seafloor with intermittent rests.",
  ),
  "filter-feeder-glide": aquariumBehaviorClassification(
    "cruiser",
    ["openWaterLane"],
    "A very large filter feeder maintaining a smooth, unhurried circuit.",
  ),
});

export const AQUARIUM_BEHAVIOR_KINDS = Object.freeze(
  Object.keys(AQUARIUM_BEHAVIOR_CLASSIFICATIONS),
);

export const AQUARIUM_SOCIAL_FORMATIONS = Object.freeze([
  "solitary",
  "pair",
  "loose-school",
  "staggered-school",
  "compact-ball",
]);

const ATLAS_COLUMNS = 5;
const ATLAS_ROWS = 2;
const HASH_RANGE = 0x100000000;
const MIN_OCCUPANT_DEPTH = 0.14;
const MAX_OCCUPANT_DEPTH = 0.86;

const TANK_CATEGORIES = Object.freeze({
  community: Object.freeze(["fish", "invertebrate", "coral"]),
  apex: Object.freeze(["predator", "apex", "filter-feeder"]),
});

function habitatCoordinate(value, fieldName, featureId) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`Aquarium habitat feature ${featureId} needs a valid ${fieldName}.`);
  }
  return value;
}

function habitatPoint(value, featureId) {
  return Object.freeze({
    xPercent: habitatCoordinate(value?.xPercent, "xPercent", featureId),
    yPercent: habitatCoordinate(value?.yPercent, "yPercent", featureId),
  });
}

function habitatCoverPoint(value, tankId) {
  if (typeof value?.id !== "string" || value.id.length === 0) {
    throw new Error(`Aquarium tank ${tankId} has a cover point without an id.`);
  }
  if (!Number.isFinite(value.radiusPercent) || value.radiusPercent <= 0 || value.radiusPercent > 50) {
    throw new Error(`Aquarium cover point ${value.id} needs a valid radiusPercent.`);
  }
  return Object.freeze({
    id: value.id,
    ...habitatPoint(value, value.id),
    radiusPercent: value.radiusPercent,
  });
}

function habitatContourPath(value, tankId) {
  if (
    typeof value?.id !== "string"
    || value.id.length === 0
    || !Array.isArray(value.points)
    || value.points.length < 2
  ) {
    throw new Error(`Aquarium tank ${tankId} has an invalid contour path.`);
  }
  return Object.freeze({
    id: value.id,
    points: Object.freeze(value.points.map((point) => habitatPoint(point, value.id))),
  });
}

function habitatStation(value, tankId) {
  if (
    typeof value?.id !== "string"
    || value.id.length === 0
    || typeof value.kind !== "string"
    || value.kind.length === 0
    || !Number.isFinite(value.radiusPercent)
    || value.radiusPercent <= 0
    || value.radiusPercent > 50
  ) {
    throw new Error(`Aquarium tank ${tankId} has an invalid habitat station.`);
  }
  return Object.freeze({
    id: value.id,
    kind: value.kind,
    ...habitatPoint(value, value.id),
    radiusPercent: value.radiusPercent,
  });
}

function habitatOpenWaterLane(value, tankId) {
  if (
    typeof value?.id !== "string"
    || value.id.length === 0
    || !Number.isFinite(value.verticalRangePercent)
    || value.verticalRangePercent <= 0
    || value.verticalRangePercent > 100
  ) {
    throw new Error(`Aquarium tank ${tankId} has an invalid open-water lane.`);
  }
  return Object.freeze({
    id: value.id,
    yPercent: habitatCoordinate(value.yPercent, "yPercent", value.id),
    verticalRangePercent: value.verticalRangePercent,
  });
}

function aquariumTankHabitat(tankId, value) {
  const habitat = Object.freeze({
    tankId,
    coverPoints: Object.freeze((value.coverPoints ?? []).map((point) => (
      habitatCoverPoint(point, tankId)
    ))),
    contourPaths: Object.freeze((value.contourPaths ?? []).map((path) => (
      habitatContourPath(path, tankId)
    ))),
    stations: Object.freeze((value.stations ?? []).map((station) => (
      habitatStation(station, tankId)
    ))),
    openWaterLanes: Object.freeze((value.openWaterLanes ?? []).map((lane) => (
      habitatOpenWaterLane(lane, tankId)
    ))),
  });
  const featureIds = [
    ...habitat.coverPoints,
    ...habitat.contourPaths,
    ...habitat.stations,
    ...habitat.openWaterLanes,
  ].map((feature) => feature.id);
  if (new Set(featureIds).size !== featureIds.length) {
    throw new Error(`Aquarium tank ${tankId} has duplicate habitat feature ids.`);
  }
  return habitat;
}

/** Authored landmarks and traversable geometry for every scenic tank. */
export const ELVERSON_AQUARIUM_TANK_HABITATS = Object.freeze({
  "reef-community": aquariumTankHabitat("reef-community", {
    coverPoints: [
      { id: "reef-community-host-cover", xPercent: 18, yPercent: 62, radiusPercent: 9 },
      { id: "reef-community-central-shelter", xPercent: 47, yPercent: 56, radiusPercent: 8 },
      { id: "reef-community-right-crevice", xPercent: 78, yPercent: 51, radiusPercent: 8 },
      { id: "reef-community-left-bottom-rock", xPercent: 28, yPercent: 84, radiusPercent: 6 },
      { id: "reef-community-bottom-rock", xPercent: 68, yPercent: 86, radiusPercent: 7 },
    ],
    contourPaths: [
      {
        id: "reef-community-shelter-loop",
        points: [
          { xPercent: 34, yPercent: 55 },
          { xPercent: 42, yPercent: 49 },
          { xPercent: 53, yPercent: 50 },
          { xPercent: 61, yPercent: 57 },
          { xPercent: 52, yPercent: 63 },
          { xPercent: 40, yPercent: 62 },
        ],
      },
      {
        id: "reef-community-upper-contour",
        points: [
          { xPercent: 4, yPercent: 54 },
          { xPercent: 17, yPercent: 45 },
          { xPercent: 31, yPercent: 52 },
          { xPercent: 46, yPercent: 46 },
          { xPercent: 61, yPercent: 55 },
          { xPercent: 77, yPercent: 42 },
          { xPercent: 96, yPercent: 51 },
        ],
      },
      {
        id: "reef-community-grazer-contour",
        points: [
          { xPercent: 3, yPercent: 73 },
          { xPercent: 18, yPercent: 64 },
          { xPercent: 33, yPercent: 71 },
          { xPercent: 48, yPercent: 61 },
          { xPercent: 63, yPercent: 69 },
          { xPercent: 79, yPercent: 58 },
          { xPercent: 97, yPercent: 67 },
        ],
      },
      {
        id: "reef-community-seafloor-contour",
        points: [
          { xPercent: 9, yPercent: 86 },
          { xPercent: 28, yPercent: 84 },
          { xPercent: 45, yPercent: 89 },
          { xPercent: 68, yPercent: 87 },
          { xPercent: 87, yPercent: 83 },
        ],
      },
      {
        id: "reef-community-left-rock-crawl",
        points: [
          { xPercent: 25, yPercent: 85 },
          { xPercent: 28, yPercent: 83.5 },
          { xPercent: 31, yPercent: 85.5 },
          { xPercent: 29, yPercent: 87 },
        ],
      },
      {
        id: "reef-community-right-rock-crawl",
        points: [
          { xPercent: 64, yPercent: 87 },
          { xPercent: 68, yPercent: 85.5 },
          { xPercent: 72, yPercent: 87.5 },
          { xPercent: 69, yPercent: 89 },
        ],
      },
      {
        id: "reef-community-crevice-patrol",
        points: [
          { xPercent: 30, yPercent: 67 },
          { xPercent: 45, yPercent: 57 },
          { xPercent: 61, yPercent: 65 },
          { xPercent: 78, yPercent: 51 },
          { xPercent: 91, yPercent: 60 },
          { xPercent: 75, yPercent: 72 },
          { xPercent: 54, yPercent: 70 },
        ],
      },
      {
        id: "reef-community-territory-loop",
        points: [
          { xPercent: 56, yPercent: 50 },
          { xPercent: 70, yPercent: 43 },
          { xPercent: 84, yPercent: 50 },
          { xPercent: 88, yPercent: 64 },
          { xPercent: 73, yPercent: 70 },
          { xPercent: 59, yPercent: 63 },
        ],
      },
    ],
    stations: [
      {
        id: "reef-community-coral-home",
        kind: "host-coral",
        xPercent: 18,
        yPercent: 62,
        radiusPercent: 9,
      },
      {
        id: "reef-community-cleaning-station",
        kind: "cleaning-coral",
        xPercent: 48,
        yPercent: 56,
        radiusPercent: 7,
      },
      {
        id: "reef-community-urchin-rock",
        kind: "substrate-rock",
        xPercent: 78,
        yPercent: 84,
        radiusPercent: 3,
      },
      {
        id: "reef-community-angel-territory",
        kind: "territory-center",
        xPercent: 73,
        yPercent: 57,
        radiusPercent: 17,
      },
    ],
    openWaterLanes: [
      { id: "reef-community-central-lane", yPercent: 54, verticalRangePercent: 20 },
      { id: "reef-community-upper-lane", yPercent: 39, verticalRangePercent: 18 },
    ],
  }),
  "reef-apex": aquariumTankHabitat("reef-apex", {
    coverPoints: [
      { id: "reef-apex-left-buttress", xPercent: 18, yPercent: 62, radiusPercent: 12 },
      { id: "reef-apex-right-buttress", xPercent: 82, yPercent: 58, radiusPercent: 12 },
    ],
    contourPaths: [{
      id: "reef-apex-reef-edge",
      points: [
        { xPercent: 4, yPercent: 67 },
        { xPercent: 23, yPercent: 54 },
        { xPercent: 45, yPercent: 63 },
        { xPercent: 67, yPercent: 49 },
        { xPercent: 96, yPercent: 62 },
      ],
    }],
    stations: [
      {
        id: "reef-apex-ambush-station",
        kind: "ambush-cover",
        xPercent: 79,
        yPercent: 58,
        radiusPercent: 14,
      },
    ],
    openWaterLanes: [
      { id: "reef-apex-main-lane", yPercent: 43, verticalRangePercent: 38 },
    ],
  }),
  "oceanic-community": aquariumTankHabitat("oceanic-community", {
    coverPoints: [],
    contourPaths: [],
    stations: [],
    openWaterLanes: [
      { id: "oceanic-community-upper-current", yPercent: 32, verticalRangePercent: 24 },
      { id: "oceanic-community-main-current", yPercent: 55, verticalRangePercent: 34 },
      { id: "oceanic-community-lower-current", yPercent: 75, verticalRangePercent: 20 },
    ],
  }),
  "oceanic-apex": aquariumTankHabitat("oceanic-apex", {
    coverPoints: [],
    contourPaths: [],
    stations: [],
    openWaterLanes: [
      { id: "oceanic-apex-migration-lane", yPercent: 44, verticalRangePercent: 48 },
      { id: "oceanic-apex-deep-lane", yPercent: 68, verticalRangePercent: 28 },
    ],
  }),
  "deep-community": aquariumTankHabitat("deep-community", {
    coverPoints: [
      { id: "deep-community-left-overhang", xPercent: 22, yPercent: 70, radiusPercent: 12 },
      { id: "deep-community-vent-cover", xPercent: 72, yPercent: 76, radiusPercent: 11 },
    ],
    contourPaths: [{
      id: "deep-community-seafloor",
      points: [
        { xPercent: 4, yPercent: 79 },
        { xPercent: 24, yPercent: 72 },
        { xPercent: 47, yPercent: 84 },
        { xPercent: 72, yPercent: 76 },
        { xPercent: 96, yPercent: 82 },
      ],
    }],
    stations: [
      {
        id: "deep-community-vent-station",
        kind: "vent-substrate",
        xPercent: 72,
        yPercent: 76,
        radiusPercent: 10,
      },
    ],
    openWaterLanes: [
      { id: "deep-community-twilight-lane", yPercent: 45, verticalRangePercent: 34 },
    ],
  }),
  "deep-apex": aquariumTankHabitat("deep-apex", {
    coverPoints: [
      { id: "deep-apex-canyon-shadow", xPercent: 24, yPercent: 69, radiusPercent: 15 },
    ],
    contourPaths: [{
      id: "deep-apex-canyon-floor",
      points: [
        { xPercent: 3, yPercent: 77 },
        { xPercent: 25, yPercent: 69 },
        { xPercent: 48, yPercent: 82 },
        { xPercent: 73, yPercent: 74 },
        { xPercent: 97, yPercent: 80 },
      ],
    }],
    stations: [],
    openWaterLanes: [
      { id: "deep-apex-midwater-lane", yPercent: 48, verticalRangePercent: 42 },
    ],
  }),
});

function atlasPosition(cell) {
  return Object.freeze({
    x: ATLAS_COLUMNS === 1 ? 0 : (cell.column / (ATLAS_COLUMNS - 1)) * 100,
    y: ATLAS_ROWS === 1 ? 0 : (cell.row / (ATLAS_ROWS - 1)) * 100,
  });
}

function authoredDisplaySize(value, speciesId) {
  if (
    !Number.isFinite(value?.referenceInches)
    || value.referenceInches <= 0
    || typeof value.measurement !== "string"
    || value.measurement.length === 0
    || !Number.isFinite(value.biologicalScale)
    || value.biologicalScale <= 0
  ) {
    throw new Error(`Aquarium species ${speciesId} needs valid display-size metadata.`);
  }
  return Object.freeze({ ...value });
}

function authoredMovementVector(value, fieldName, speciesId) {
  if (
    !Number.isFinite(value?.xPercent)
    || value.xPercent < 0
    || !Number.isFinite(value?.yPercent)
    || value.yPercent < 0
  ) {
    throw new Error(`Aquarium species ${speciesId} needs a valid ${fieldName} vector.`);
  }
  return Object.freeze({ ...value });
}

function authoredMovementAnchor(value, speciesId) {
  if (value === null) return null;
  if (
    typeof value?.id !== "string"
    || value.id.length === 0
    || !Number.isFinite(value.xPercent)
    || value.xPercent < 0
    || value.xPercent > 100
    || !Number.isFinite(value.yPercent)
    || value.yPercent < 0
    || value.yPercent > 100
  ) {
    throw new Error(`Aquarium species ${speciesId} needs a valid movement anchor.`);
  }
  // Shared habitat anchors intentionally retain object identity so species
  // such as clownfish and cleaner wrasses gather around the same coral head.
  return Object.isFrozen(value) ? value : Object.freeze({ ...value });
}

function authoredSecondsRange(value, fieldName, speciesId, nullable = false) {
  if (nullable && value === null) return null;
  if (
    !Number.isFinite(value?.min)
    || value.min < 0
    || !Number.isFinite(value?.max)
    || value.max < value.min
  ) {
    throw new Error(`Aquarium species ${speciesId} needs a valid ${fieldName} range.`);
  }
  return Object.freeze({ min: value.min, max: value.max });
}

function authoredSocialBehavior(value, groupSize, speciesId) {
  if (
    !AQUARIUM_SOCIAL_FORMATIONS.includes(value?.formation)
    || !Number.isSafeInteger(value.visualCount)
    || value.visualCount < 1
    || value.visualCount > 12
    || value.visualCount !== groupSize
    || !Number.isFinite(value.cohesion)
    || value.cohesion < 0
    || value.cohesion > 1
    || !Number.isFinite(value.spacingPercent)
    || value.spacingPercent < 0
    || value.spacingPercent > 30
  ) {
    throw new Error(`Aquarium species ${speciesId} needs valid social behavior metadata.`);
  }
  if (value.formation === "solitary" && value.visualCount !== 1) {
    throw new Error(`Aquarium solitary species ${speciesId} must render one animal.`);
  }
  if (value.formation === "pair" && value.visualCount !== 2) {
    throw new Error(`Aquarium paired species ${speciesId} must render two animals.`);
  }
  return Object.freeze({
    formation: value.formation,
    visualCount: value.visualCount,
    cohesion: value.cohesion,
    spacingPercent: value.spacingPercent,
  });
}

function authoredBehaviorTiming(value, speciesId) {
  return Object.freeze({
    pauseSeconds: authoredSecondsRange(value?.pauseSeconds, "pauseSeconds", speciesId),
    refugeCadenceSeconds: authoredSecondsRange(
      value?.refugeCadenceSeconds,
      "refugeCadenceSeconds",
      speciesId,
      true,
    ),
    burstSeconds: authoredSecondsRange(
      value?.burstSeconds,
      "burstSeconds",
      speciesId,
      true,
    ),
  });
}

function findHabitatFeature(features, id, fieldName, tankId, speciesId) {
  if (id === null) return null;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error(`Aquarium species ${speciesId} needs a valid ${fieldName} reference.`);
  }
  const feature = features.find((candidate) => candidate.id === id);
  if (!feature) {
    throw new Error(`Aquarium species ${speciesId} references ${id} outside ${tankId}.`);
  }
  return feature;
}

function authoredMovementHabitat(value, behaviorKind, tankId, speciesId) {
  const tankHabitat = ELVERSON_AQUARIUM_TANK_HABITATS[tankId];
  if (!tankHabitat) {
    throw new Error(`Aquarium species ${speciesId} needs habitat geometry for ${tankId}.`);
  }
  const coverPointIds = value?.coverPointIds ?? [];
  if (
    !Array.isArray(coverPointIds)
    || coverPointIds.some((id) => typeof id !== "string" || id.length === 0)
    || new Set(coverPointIds).size !== coverPointIds.length
  ) {
    throw new Error(`Aquarium species ${speciesId} needs valid coverPointIds.`);
  }
  const habitat = Object.freeze({
    tankId,
    coverPoints: Object.freeze(coverPointIds.map((id) => (
      findHabitatFeature(tankHabitat.coverPoints, id, "cover point", tankId, speciesId)
    ))),
    contourPath: findHabitatFeature(
      tankHabitat.contourPaths,
      value?.contourPathId ?? null,
      "contour path",
      tankId,
      speciesId,
    ),
    station: findHabitatFeature(
      tankHabitat.stations,
      value?.stationId ?? null,
      "station",
      tankId,
      speciesId,
    ),
    openWaterLane: findHabitatFeature(
      tankHabitat.openWaterLanes,
      value?.openWaterLaneId ?? null,
      "open-water lane",
      tankId,
      speciesId,
    ),
  });
  const featureRequirements = AQUARIUM_BEHAVIOR_CLASSIFICATIONS[behaviorKind].habitatFeatures;
  for (const featureName of featureRequirements) {
    const assigned = featureName === "coverPoints"
      ? habitat.coverPoints.length > 0
      : habitat[featureName] !== null;
    if (!assigned) {
      throw new Error(`Aquarium species ${speciesId} needs ${featureName} for ${behaviorKind}.`);
    }
  }
  return habitat;
}

function authoredMovementProfile(value, speciesId, tankId) {
  if (
    !AQUARIUM_MOVEMENT_KINDS.includes(value?.kind)
    || !AQUARIUM_BEHAVIOR_KINDS.includes(value?.behaviorKind)
    || !Number.isSafeInteger(value.groupSize)
    || value.groupSize < 1
    || value.groupSize > 12
    || !Number.isFinite(value.speed)
    || value.speed < 0
  ) {
    throw new Error(`Aquarium species ${speciesId} needs a valid movement profile.`);
  }
  if (value.kind === "school" && value.groupSize < 2) {
    throw new Error(`Aquarium schooling species ${speciesId} needs more than one group member.`);
  }
  if (AQUARIUM_BEHAVIOR_CLASSIFICATIONS[value.behaviorKind].movementKind !== value.kind) {
    throw new Error(`Aquarium species ${speciesId} has incompatible behavior and movement kinds.`);
  }
  return Object.freeze({
    kind: value.kind,
    behaviorKind: value.behaviorKind,
    anchor: authoredMovementAnchor(value.anchor, speciesId),
    roam: authoredMovementVector(value.roam, "roam", speciesId),
    groupSize: value.groupSize,
    speed: value.speed,
    amplitude: authoredMovementVector(value.amplitude, "amplitude", speciesId),
    social: authoredSocialBehavior(value.social, value.groupSize, speciesId),
    timing: authoredBehaviorTiming(value.timing, speciesId),
    habitat: authoredMovementHabitat(value.habitatRefs, value.behaviorKind, tankId, speciesId),
  });
}

const REEF_COMMUNITY_CORAL_HOME_ANCHOR = Object.freeze({
  id: "reef-community-coral-home",
  xPercent: 18,
  yPercent: 62,
});

const REEF_COMMUNITY_CLEANING_STATION_ANCHOR = Object.freeze({
  id: "reef-community-cleaning-station",
  xPercent: 48,
  yPercent: 56,
});

function aquariumBehaviorPreset(value, presetId) {
  const groupSize = value.groupSize;
  const habitatRefs = value.habitatRefs === null
    ? null
    : Object.freeze({
      coverPointIds: Object.freeze([...(value.habitatRefs?.coverPointIds ?? [])]),
      contourPathId: value.habitatRefs?.contourPathId ?? null,
      stationId: value.habitatRefs?.stationId ?? null,
      openWaterLaneId: value.habitatRefs?.openWaterLaneId ?? null,
    });
  if (
    !AQUARIUM_MOVEMENT_KINDS.includes(value.kind)
    || !AQUARIUM_BEHAVIOR_KINDS.includes(value.behaviorKind)
    || AQUARIUM_BEHAVIOR_CLASSIFICATIONS[value.behaviorKind].movementKind !== value.kind
    || !Number.isSafeInteger(groupSize)
    || groupSize < 1
    || groupSize > 12
    || !Number.isFinite(value.speed)
    || value.speed < 0
  ) {
    throw new Error(`Aquarium behavior preset ${presetId} is invalid.`);
  }
  return Object.freeze({
    kind: value.kind,
    behaviorKind: value.behaviorKind,
    anchor: value.anchor === null ? null : Object.freeze({ ...value.anchor }),
    roam: authoredMovementVector(value.roam, "roam", presetId),
    groupSize,
    speed: value.speed,
    amplitude: authoredMovementVector(value.amplitude, "amplitude", presetId),
    social: authoredSocialBehavior(value.social, groupSize, presetId),
    timing: authoredBehaviorTiming(value.timing, presetId),
    habitatRefs,
  });
}

/**
 * Drop-in authoring presets for future residents. Generic large-tank presets
 * intentionally leave habitatRefs null: a species must bind them to geometry
 * from its own assigned tank rather than accidentally borrowing another tank.
 */
export const AQUARIUM_BEHAVIOR_PRESETS = Object.freeze({
  chromisCoverSchoolBall: aquariumBehaviorPreset({
    kind: "school",
    behaviorKind: "cover-school-ball",
    anchor: null,
    roam: { xPercent: 34, yPercent: 22 },
    groupSize: 5,
    speed: 0.82,
    amplitude: { xPercent: 2.5, yPercent: 3 },
    social: {
      formation: "compact-ball",
      visualCount: 5,
      cohesion: 0.94,
      spacingPercent: 3.2,
    },
    timing: {
      pauseSeconds: { min: 1.5, max: 3 },
      refugeCadenceSeconds: { min: 24, max: 45 },
      burstSeconds: { min: 0.6, max: 1 },
    },
    habitatRefs: {
      coverPointIds: [
        "reef-community-central-shelter",
        "reef-community-right-crevice",
      ],
      contourPathId: "reef-community-shelter-loop",
      stationId: null,
      openWaterLaneId: null,
    },
  }, "chromisCoverSchoolBall"),
  pelagicApexGlide: aquariumBehaviorPreset({
    kind: "cruiser",
    behaviorKind: "pelagic-apex-glide",
    anchor: null,
    roam: { xPercent: 116, yPercent: 44 },
    groupSize: 1,
    speed: 0.48,
    amplitude: { xPercent: 0, yPercent: 2.5 },
    social: { formation: "solitary", visualCount: 1, cohesion: 1, spacingPercent: 0 },
    timing: {
      pauseSeconds: { min: 0, max: 0.5 },
      refugeCadenceSeconds: null,
      burstSeconds: { min: 1.5, max: 3 },
    },
    habitatRefs: null,
  }, "pelagicApexGlide"),
  reefAmbushPatrol: aquariumBehaviorPreset({
    kind: "cruiser",
    behaviorKind: "reef-ambush-patrol",
    anchor: null,
    roam: { xPercent: 76, yPercent: 34 },
    groupSize: 1,
    speed: 0.38,
    amplitude: { xPercent: 1, yPercent: 3 },
    social: { formation: "solitary", visualCount: 1, cohesion: 1, spacingPercent: 0 },
    timing: {
      pauseSeconds: { min: 3, max: 7 },
      refugeCadenceSeconds: { min: 12, max: 22 },
      burstSeconds: { min: 1, max: 2.5 },
    },
    habitatRefs: null,
  }, "reefAmbushPatrol"),
  benthicPredator: aquariumBehaviorPreset({
    kind: "localized-benthic",
    behaviorKind: "benthic-predator",
    anchor: null,
    roam: { xPercent: 82, yPercent: 10 },
    groupSize: 1,
    speed: 0.24,
    amplitude: { xPercent: 3, yPercent: 0.8 },
    social: { formation: "solitary", visualCount: 1, cohesion: 1, spacingPercent: 0 },
    timing: {
      pauseSeconds: { min: 4, max: 10 },
      refugeCadenceSeconds: null,
      burstSeconds: { min: 1.5, max: 3.5 },
    },
    habitatRefs: null,
  }, "benthicPredator"),
  filterFeederGlide: aquariumBehaviorPreset({
    kind: "cruiser",
    behaviorKind: "filter-feeder-glide",
    anchor: null,
    roam: { xPercent: 118, yPercent: 38 },
    groupSize: 1,
    speed: 0.3,
    amplitude: { xPercent: 0, yPercent: 1.5 },
    social: { formation: "solitary", visualCount: 1, cohesion: 1, spacingPercent: 0 },
    timing: {
      pauseSeconds: { min: 0, max: 0 },
      refugeCadenceSeconds: null,
      burstSeconds: null,
    },
    habitatRefs: null,
  }, "filterFeederGlide"),
});

export const AQUARIUM_CHROMIS_BEHAVIOR_PRESET = AQUARIUM_BEHAVIOR_PRESETS.chromisCoverSchoolBall;

function aquariumSpecies(definition) {
  const cell = Object.freeze({ ...definition.spriteCell });
  const position = atlasPosition(cell);
  const displaySize = authoredDisplaySize(definition.displaySize, definition.id);
  const tankId = `${definition.ecosystemId}-${definition.tankKind}`;
  const movementProfile = authoredMovementProfile(definition.movementProfile, definition.id, tankId);
  return Object.freeze({
    id: definition.id,
    cardId: definition.cardId,
    category: definition.category,
    ecosystemId: definition.ecosystemId,
    tankKind: definition.tankKind,
    tankId,
    aquariumItemId: definition.aquariumItemId,
    requested: definition.requested !== false,
    source: definition.source ?? "elverson-hand-net",
    displaySize,
    movementProfile,
    sprite: Object.freeze({
      type: "atlas",
      path: ELVERSON_REEF_CREATURE_ATLAS_PATH,
      columns: ATLAS_COLUMNS,
      rows: ATLAS_ROWS,
      cell,
      position,
    }),
  });
}

/**
 * Aquarium species are authored independently from card ownership. A card in
 * a starter deck or booster pack is not a live resident; only the matching
 * delivered story-item quantity can populate a tank.
 *
 * Movement-profile coordinates are percentages of the tank's resident stage.
 * `anchor` is a habitat landmark, `roam` is the permitted travel envelope,
 * and `amplitude` controls small-scale weaving within that larger behavior.
 * `speed` is a relative multiplier rather than a duration in seconds.
 *
 * Future collection loops can append species from any ecosystem and choose a
 * care-appropriate tank without changing the exhibit-model algorithm.
 */
export const ELVERSON_AQUARIUM_SPECIES = Object.freeze([
  aquariumSpecies({
    id: "white-grunt",
    cardId: "white-grunt",
    category: "fish",
    ecosystemId: "reef",
    tankKind: "community",
    aquariumItemId: "aquarium-white-grunt",
    displaySize: { referenceInches: 17, measurement: "length", biologicalScale: 0.88 },
    movementProfile: {
      kind: "school",
      behaviorKind: "shelter-school",
      anchor: null,
      roam: { xPercent: 34, yPercent: 22 },
      groupSize: 5,
      speed: 0.72,
      amplitude: { xPercent: 3, yPercent: 4.5 },
      social: {
        formation: "loose-school",
        visualCount: 5,
        cohesion: 0.78,
        spacingPercent: 5,
      },
      timing: {
        pauseSeconds: { min: 0.8, max: 1.8 },
        refugeCadenceSeconds: { min: 10, max: 18 },
        burstSeconds: { min: 1, max: 2 },
      },
      habitatRefs: {
        coverPointIds: ["reef-community-central-shelter"],
        contourPathId: "reef-community-shelter-loop",
        stationId: null,
        openWaterLaneId: "reef-community-central-lane",
      },
    },
    spriteCell: { column: 0, row: 0 },
  }),
  aquariumSpecies({
    id: "cleaner-wrasse",
    cardId: "cleaner-wrasse",
    category: "fish",
    ecosystemId: "reef",
    tankKind: "community",
    aquariumItemId: "aquarium-cleaner-wrasse",
    displaySize: { referenceInches: 2, measurement: "length", biologicalScale: 0.24 },
    movementProfile: {
      kind: "coral-home",
      behaviorKind: "cleaning-station",
      anchor: REEF_COMMUNITY_CLEANING_STATION_ANCHOR,
      roam: { xPercent: 10, yPercent: 8 },
      groupSize: 1,
      speed: 0.42,
      amplitude: { xPercent: 3.5, yPercent: 2.5 },
      social: { formation: "solitary", visualCount: 1, cohesion: 1, spacingPercent: 0 },
      timing: {
        pauseSeconds: { min: 2, max: 4 },
        refugeCadenceSeconds: { min: 8, max: 14 },
        burstSeconds: { min: 1, max: 2 },
      },
      habitatRefs: {
        coverPointIds: [],
        contourPathId: null,
        stationId: "reef-community-cleaning-station",
        openWaterLaneId: null,
      },
    },
    spriteCell: { column: 1, row: 0 },
  }),
  aquariumSpecies({
    id: "clownfish",
    cardId: "clownfish",
    category: "fish",
    ecosystemId: "reef",
    tankKind: "community",
    aquariumItemId: "aquarium-clownfish",
    displaySize: { referenceInches: 4, measurement: "length", biologicalScale: 0.34 },
    movementProfile: {
      kind: "coral-home",
      behaviorKind: "host-bound-pair",
      anchor: REEF_COMMUNITY_CORAL_HOME_ANCHOR,
      roam: { xPercent: 12, yPercent: 9 },
      groupSize: 2,
      speed: 0.36,
      amplitude: { xPercent: 3, yPercent: 2 },
      social: { formation: "pair", visualCount: 2, cohesion: 0.9, spacingPercent: 4 },
      timing: {
        pauseSeconds: { min: 0.6, max: 1.8 },
        refugeCadenceSeconds: { min: 6, max: 10 },
        burstSeconds: { min: 0.5, max: 1.1 },
      },
      habitatRefs: {
        coverPointIds: [],
        contourPathId: null,
        stationId: "reef-community-coral-home",
        openWaterLaneId: null,
      },
    },
    spriteCell: { column: 2, row: 0 },
  }),
  aquariumSpecies({
    id: "emerald-crab",
    cardId: "emerald-crab",
    category: "invertebrate",
    ecosystemId: "reef",
    tankKind: "community",
    aquariumItemId: "aquarium-emerald-crab",
    displaySize: { referenceInches: 1.5, measurement: "carapace-width", biologicalScale: 0.22 },
    movementProfile: {
      kind: "localized-benthic",
      behaviorKind: "cryptic-grazer",
      anchor: { id: "reef-community-left-rock", xPercent: 28, yPercent: 86 },
      roam: { xPercent: 6, yPercent: 1.5 },
      groupSize: 1,
      speed: 0.12,
      amplitude: { xPercent: 2.5, yPercent: 0.4 },
      social: { formation: "solitary", visualCount: 1, cohesion: 1, spacingPercent: 0 },
      timing: {
        pauseSeconds: { min: 6, max: 14 },
        refugeCadenceSeconds: { min: 10, max: 18 },
        burstSeconds: { min: 1, max: 2.5 },
      },
      habitatRefs: {
        coverPointIds: ["reef-community-left-bottom-rock"],
        contourPathId: "reef-community-left-rock-crawl",
        stationId: null,
        openWaterLaneId: null,
      },
    },
    spriteCell: { column: 3, row: 0 },
  }),
  aquariumSpecies({
    id: "blue-tang",
    cardId: "blue-tang",
    category: "fish",
    ecosystemId: "reef",
    tankKind: "community",
    aquariumItemId: "aquarium-blue-tang",
    displaySize: { referenceInches: 15, measurement: "length", biologicalScale: 0.82 },
    movementProfile: {
      kind: "school",
      behaviorKind: "contour-school",
      anchor: null,
      roam: { xPercent: 106, yPercent: 30 },
      groupSize: 4,
      speed: 0.9,
      amplitude: { xPercent: 3.5, yPercent: 5 },
      social: {
        formation: "staggered-school",
        visualCount: 4,
        cohesion: 0.82,
        spacingPercent: 6,
      },
      timing: {
        pauseSeconds: { min: 0.2, max: 0.8 },
        refugeCadenceSeconds: null,
        burstSeconds: { min: 1.5, max: 3 },
      },
      habitatRefs: {
        coverPointIds: [],
        contourPathId: "reef-community-upper-contour",
        stationId: null,
        openWaterLaneId: null,
      },
    },
    spriteCell: { column: 4, row: 0 },
  }),
  aquariumSpecies({
    id: "sea-urchin",
    cardId: "sea-urchin",
    category: "invertebrate",
    ecosystemId: "reef",
    tankKind: "community",
    aquariumItemId: "aquarium-sea-urchin",
    displaySize: { referenceInches: 12, measurement: "spine-diameter", biologicalScale: 0.68 },
    movementProfile: {
      kind: "anchored",
      behaviorKind: "substrate-grazer",
      anchor: { id: "reef-community-right-rock", xPercent: 78, yPercent: 84 },
      roam: { xPercent: 0.8, yPercent: 0.4 },
      groupSize: 1,
      speed: 0.03,
      amplitude: { xPercent: 0.3, yPercent: 0.2 },
      social: { formation: "solitary", visualCount: 1, cohesion: 1, spacingPercent: 0 },
      timing: {
        pauseSeconds: { min: 18, max: 40 },
        refugeCadenceSeconds: null,
        burstSeconds: null,
      },
      habitatRefs: {
        coverPointIds: [],
        contourPathId: null,
        stationId: "reef-community-urchin-rock",
        openWaterLaneId: null,
      },
    },
    spriteCell: { column: 0, row: 1 },
  }),
  aquariumSpecies({
    id: "fairy-parrotfish",
    cardId: "fairy-parrotfish",
    category: "fish",
    ecosystemId: "reef",
    tankKind: "community",
    aquariumItemId: "aquarium-fairy-parrotfish",
    displaySize: { referenceInches: 30, measurement: "length", biologicalScale: 1.35 },
    movementProfile: {
      kind: "cruiser",
      behaviorKind: "reef-grazer-solo",
      anchor: null,
      roam: { xPercent: 112, yPercent: 24 },
      groupSize: 1,
      speed: 0.68,
      amplitude: { xPercent: 0, yPercent: 4 },
      social: { formation: "solitary", visualCount: 1, cohesion: 1, spacingPercent: 0 },
      timing: {
        pauseSeconds: { min: 1, max: 3 },
        refugeCadenceSeconds: null,
        burstSeconds: { min: 2, max: 4 },
      },
      habitatRefs: {
        coverPointIds: [],
        contourPathId: "reef-community-grazer-contour",
        stationId: null,
        openWaterLaneId: null,
      },
    },
    spriteCell: { column: 1, row: 1 },
  }),
  aquariumSpecies({
    id: "blue-crab",
    cardId: "blue-crab",
    category: "invertebrate",
    ecosystemId: "reef",
    tankKind: "community",
    aquariumItemId: "aquarium-blue-crab",
    displaySize: { referenceInches: 9, measurement: "carapace-width", biologicalScale: 0.58 },
    movementProfile: {
      kind: "localized-benthic",
      behaviorKind: "bottom-scuttler",
      anchor: { id: "reef-community-center-right-rock", xPercent: 68, yPercent: 88 },
      roam: { xPercent: 8, yPercent: 1.5 },
      groupSize: 1,
      speed: 0.14,
      amplitude: { xPercent: 3.5, yPercent: 0.4 },
      social: { formation: "solitary", visualCount: 1, cohesion: 1, spacingPercent: 0 },
      timing: {
        pauseSeconds: { min: 4, max: 10 },
        refugeCadenceSeconds: null,
        burstSeconds: { min: 0.7, max: 1.2 },
      },
      habitatRefs: {
        coverPointIds: [],
        contourPathId: "reef-community-right-rock-crawl",
        stationId: null,
        openWaterLaneId: null,
      },
    },
    spriteCell: { column: 2, row: 1 },
  }),
  aquariumSpecies({
    id: "spanish-hogfish",
    cardId: "spanish-hogfish",
    category: "fish",
    ecosystemId: "reef",
    tankKind: "community",
    aquariumItemId: "aquarium-spanish-hogfish",
    displaySize: { referenceInches: 16, measurement: "length", biologicalScale: 0.86 },
    movementProfile: {
      kind: "cruiser",
      behaviorKind: "crevice-hunter",
      anchor: null,
      roam: { xPercent: 108, yPercent: 28 },
      groupSize: 1,
      speed: 0.82,
      amplitude: { xPercent: 0, yPercent: 4.5 },
      social: { formation: "solitary", visualCount: 1, cohesion: 1, spacingPercent: 0 },
      timing: {
        pauseSeconds: { min: 1.5, max: 4 },
        refugeCadenceSeconds: { min: 12, max: 20 },
        burstSeconds: { min: 1.5, max: 3 },
      },
      habitatRefs: {
        coverPointIds: [
          "reef-community-central-shelter",
          "reef-community-right-crevice",
        ],
        contourPathId: "reef-community-crevice-patrol",
        stationId: null,
        openWaterLaneId: null,
      },
    },
    spriteCell: { column: 3, row: 1 },
  }),
  aquariumSpecies({
    id: "french-angelfish",
    cardId: "french-angelfish",
    category: "fish",
    ecosystemId: "reef",
    tankKind: "community",
    aquariumItemId: "aquarium-french-angelfish",
    displaySize: { referenceInches: 24, measurement: "length", biologicalScale: 1.1 },
    movementProfile: {
      kind: "cruiser",
      behaviorKind: "territorial-pair",
      anchor: null,
      roam: { xPercent: 110, yPercent: 26 },
      groupSize: 2,
      speed: 0.6,
      amplitude: { xPercent: 0, yPercent: 4 },
      social: { formation: "pair", visualCount: 2, cohesion: 0.76, spacingPercent: 8 },
      timing: {
        pauseSeconds: { min: 1, max: 3 },
        refugeCadenceSeconds: { min: 14, max: 22 },
        burstSeconds: { min: 1.2, max: 2.8 },
      },
      habitatRefs: {
        coverPointIds: [],
        contourPathId: "reef-community-territory-loop",
        stationId: "reef-community-angel-territory",
        openWaterLaneId: null,
      },
    },
    spriteCell: { column: 4, row: 1 },
  }),
]);

export const ELVERSON_AQUARIUM_SPECIES_BY_ID = Object.freeze(Object.fromEntries(
  ELVERSON_AQUARIUM_SPECIES.map((species) => [species.id, species]),
));

// Keep the shipped catch table and the aquarium registry in lockstep. This is
// intentionally a development-time invariant, not a card-catalog inference.
const catchById = Object.fromEntries(ELVERSON_REEF_CATCHES.map((creature) => [creature.id, creature]));
for (const creature of ELVERSON_REEF_CATCHES) {
  const species = ELVERSON_AQUARIUM_SPECIES_BY_ID[creature.id];
  if (
    !species
    || species.cardId !== creature.cardId
    || species.category !== creature.category
    || species.aquariumItemId !== creature.aquariumItemId
  ) {
    throw new Error(`Aquarium species registry is out of sync for ${creature.id}.`);
  }
}
for (const species of ELVERSON_AQUARIUM_SPECIES) {
  if (species.source === "elverson-hand-net" && !catchById[species.id]) {
    throw new Error(`Aquarium species ${species.id} is missing from the Elverson catch table.`);
  }
}

const ECOSYSTEM_BLUEPRINTS = Object.freeze([
  Object.freeze({
    id: "reef",
    name: "Reef",
    subtitle: "A sunlit city of coral, cleaners, grazers, and reef hunters.",
    doorway: Object.freeze({ left: 6, top: 24, width: 26, height: 58 }),
    tanks: Object.freeze({
      community: Object.freeze({
        name: "Reef Community",
        subtitle: "Coral gardens, reef fish, and invertebrates",
        emptyMessage: "Deliver a Reef fish or invertebrate to welcome the first resident.",
      }),
      apex: Object.freeze({
        name: "Reef Giants",
        subtitle: "Predators, apex hunters, and roaming filter feeders",
        emptyMessage: "No large Reef residents have been delivered yet.",
      }),
    }),
  }),
  Object.freeze({
    id: "oceanic",
    name: "Oceanic",
    subtitle: "Open blue water shaped by schools, currents, and long migrations.",
    doorway: Object.freeze({ left: 37, top: 19, width: 26, height: 63 }),
    tanks: Object.freeze({
      community: Object.freeze({
        name: "Oceanic Community",
        subtitle: "Pelagic schools and drifting invertebrates",
        emptyMessage: "No Oceanic community residents have been delivered yet.",
      }),
      apex: Object.freeze({
        name: "Oceanic Giants",
        subtitle: "Fast hunters, ocean wanderers, and great filter feeders",
        emptyMessage: "No large Oceanic residents have been delivered yet.",
      }),
    }),
  }),
  Object.freeze({
    id: "deep",
    name: "Deep",
    subtitle: "A twilight-to-abyss journey lit by living constellations.",
    doorway: Object.freeze({ left: 68, top: 24, width: 26, height: 58 }),
    tanks: Object.freeze({
      community: Object.freeze({
        name: "Deep Community",
        subtitle: "Twilight fish, benthic invertebrates, and vent life",
        emptyMessage: "No Deep community residents have been delivered yet.",
      }),
      apex: Object.freeze({
        name: "Deep Giants",
        subtitle: "Abyssal predators and immense deep-water animals",
        emptyMessage: "No large Deep residents have been delivered yet.",
      }),
    }),
  }),
]);

function aquariumTank(ecosystem, tankKind) {
  const details = ecosystem.tanks[tankKind];
  const id = `${ecosystem.id}-${tankKind}`;
  const backgroundPath = `/images/adventure/aquarium-${id}-v1.webp`;
  const habitat = ELVERSON_AQUARIUM_TANK_HABITATS[id];
  if (!habitat) throw new Error(`Aquarium tank ${id} is missing authored habitat geometry.`);
  const creatureIds = ELVERSON_AQUARIUM_SPECIES
    .filter((species) => species.ecosystemId === ecosystem.id && species.tankKind === tankKind)
    .map((species) => species.id);
  return Object.freeze({
    id,
    ecosystemId: ecosystem.id,
    ecosystemName: ecosystem.name,
    tankKind,
    name: details.name,
    subtitle: details.subtitle,
    emptyMessage: details.emptyMessage,
    backgroundPath,
    habitat,
    acceptedCategories: TANK_CATEGORIES[tankKind],
    creatureIds: Object.freeze(creatureIds),
    spectatorView: Object.freeze({
      id: `${id}-spectator`,
      title: details.name,
      subtitle: details.subtitle,
      backgroundPath,
      ariaLabel: `${ecosystem.name} ${tankKind === "apex" ? "large-animal" : "community"} aquarium tank`,
    }),
  });
}

export const ELVERSON_AQUARIUM_TANKS = Object.freeze(ECOSYSTEM_BLUEPRINTS.flatMap(
  (ecosystem) => AQUARIUM_TANK_KINDS.map((tankKind) => aquariumTank(ecosystem, tankKind)),
));

const TANK_BY_ID = Object.freeze(Object.fromEntries(
  ELVERSON_AQUARIUM_TANKS.map((tank) => [tank.id, tank]),
));

function aquariumExhibit(ecosystem) {
  const tanks = AQUARIUM_TANK_KINDS.map((tankKind) => TANK_BY_ID[`${ecosystem.id}-${tankKind}`]);
  const creatureIds = tanks.flatMap((tank) => tank.creatureIds);
  return Object.freeze({
    id: ecosystem.id,
    ecosystemId: ecosystem.id,
    ecosystem: ecosystem.name,
    name: ecosystem.name,
    subtitle: ecosystem.subtitle,
    emptyMessage: ecosystem.tanks.community.emptyMessage,
    doorway: ecosystem.doorway,
    // `bounds` retains the old entrance-layout field name for callers that
    // position exhibit entry points rather than reading `doorway` directly.
    bounds: ecosystem.doorway,
    tanks: Object.freeze(tanks),
    creatureIds: Object.freeze(creatureIds),
  });
}

/** The three grand-hall doorways, each leading to community and giant tanks. */
export const ELVERSON_AQUARIUM_EXHIBITS = Object.freeze(
  ECOSYSTEM_BLUEPRINTS.map(aquariumExhibit),
);
export const ELVERSON_AQUARIUM_ECOSYSTEMS = ELVERSON_AQUARIUM_EXHIBITS;

const EXHIBIT_BY_CREATURE_ID = Object.freeze(Object.fromEntries(
  ELVERSON_AQUARIUM_SPECIES.map((species) => [species.id, species.ecosystemId]),
));
const TANK_ID_BY_CREATURE_ID = Object.freeze(Object.fromEntries(
  ELVERSON_AQUARIUM_SPECIES.map((species) => [species.id, species.tankId]),
));

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableUnit(key, salt) {
  return stableHash(`${key}:${salt}`) / HASH_RANGE;
}

function round(value, places = 3) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function aquariumOccupant(species, quantity, depth) {
  const key = `${species.tankId}:${species.id}`;
  const biologicalScale = species.displaySize.biologicalScale;
  const depthScale = round(1.1 - depth * 0.64);
  const scale = round(biologicalScale * depthScale);
  const opacity = round(0.98 - depth * 0.2);
  const brightness = round(1.04 - depth * 0.31);
  const saturation = round(1.05 - depth * 0.48);
  const hueRotate = round(depth * 13, 2);
  const blur = round(depth * 0.7, 2);
  const zIndex = 20 + Math.round((1 - depth) * 60);
  const direction = stableUnit(key, "direction") < 0.5 ? -1 : 1;
  const startX = round(8 + stableUnit(key, "start-x") * 84, 2);
  const startY = round(14 + stableUnit(key, "start-y") * 68, 2);
  const visual = Object.freeze({
    biologicalScale,
    depthScale,
    scale,
    opacity,
    brightness,
    saturation,
    hueRotate,
    blur,
    zIndex,
  });
  const color = Object.freeze({
    brightness,
    saturation,
    hueRotate,
    cyanTint: round(0.05 + depth * 0.38),
    opacity,
  });
  const animation = Object.freeze({
    lane: Math.floor(stableUnit(key, "lane") * 3),
    direction,
    delaySeconds: -round(stableUnit(key, "delay") * 12, 2),
    durationSeconds: round(9 + stableUnit(key, "duration") * 8 + depth * 3, 2),
    startX,
    startY,
    verticalDriftPercent: round((stableUnit(key, "drift") - 0.5) * 8, 2),
  });
  return Object.freeze({
    id: species.id,
    speciesId: species.id,
    cardId: species.cardId,
    quantity,
    category: species.category,
    ecosystemId: species.ecosystemId,
    tankId: species.tankId,
    tankKind: species.tankKind,
    displaySize: species.displaySize,
    movementProfile: species.movementProfile,
    sprite: species.sprite,
    // Flat atlas and visual fields preserve the existing renderer contract.
    atlasCell: species.sprite.cell,
    atlasPosition: species.sprite.position,
    depth,
    biologicalScale,
    depthScale,
    scale,
    opacity,
    brightness,
    saturation,
    hueRotate,
    blur,
    zIndex,
    visual,
    color,
    animation,
  });
}

function aquariumOccupants(deliveredResidents) {
  if (deliveredResidents.length === 0) return Object.freeze([]);

  const rankedSpeciesIds = deliveredResidents
    .map(({ species }) => species.id)
    .sort((leftId, rightId) => {
      const leftRank = stableUnit(leftId, "aquarium-depth-rank");
      const rightRank = stableUnit(rightId, "aquarium-depth-rank");
      return leftRank - rightRank || leftId.localeCompare(rightId);
    });
  const depthBySpeciesId = new Map(rankedSpeciesIds.map((speciesId, index) => {
    const unit = rankedSpeciesIds.length === 1
      ? stableUnit(speciesId, "aquarium-solo-depth")
      : index / (rankedSpeciesIds.length - 1);
    return [speciesId, round(MIN_OCCUPANT_DEPTH + unit * (
      MAX_OCCUPANT_DEPTH - MIN_OCCUPANT_DEPTH
    ), 4)];
  }));

  return Object.freeze(deliveredResidents.map(({ species, quantity }) => aquariumOccupant(
    species,
    quantity,
    depthBySpeciesId.get(species.id),
  )));
}

function deliveredQuantity(storyItems, species) {
  const quantity = storyItems[species.aquariumItemId];
  return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 0;
}

function modeledTank(tank, occupants) {
  const requestedSpeciesCount = tank.creatureIds.length;
  const representedSpeciesCount = occupants.length;
  return Object.freeze({
    ...tank,
    occupants: Object.freeze(occupants),
    populated: representedSpeciesCount > 0,
    representedSpeciesCount,
    requestedSpeciesCount,
    deliveredCreatureCount: occupants.reduce((total, occupant) => total + occupant.quantity, 0),
    collectionActive: requestedSpeciesCount > 0,
    complete: requestedSpeciesCount > 0 && representedSpeciesCount === requestedSpeciesCount,
  });
}

/**
 * Builds an immutable, render-safe view of the grand Aquarium from delivered
 * specimens. Held catches and owned cards never appear in a tank.
 */
export function getElversonAquariumExhibitModel(saveValue) {
  const save = normalizeAdventureSave(saveValue);
  const deliveredResidentsByTankId = Object.fromEntries(
    ELVERSON_AQUARIUM_TANKS.map((tank) => [tank.id, []]),
  );

  for (const species of ELVERSON_AQUARIUM_SPECIES) {
    const quantity = deliveredQuantity(save.inventory.storyItems, species);
    if (quantity > 0) deliveredResidentsByTankId[species.tankId].push({ species, quantity });
  }

  const occupantsByTankId = Object.fromEntries(ELVERSON_AQUARIUM_TANKS.map((tank) => [
    tank.id,
    aquariumOccupants(deliveredResidentsByTankId[tank.id]),
  ]));

  const tanks = ELVERSON_AQUARIUM_TANKS.map((tank) => (
    modeledTank(tank, occupantsByTankId[tank.id])
  ));
  const tankById = Object.fromEntries(tanks.map((tank) => [tank.id, tank]));
  const exhibits = ELVERSON_AQUARIUM_EXHIBITS.map((exhibit) => {
    const exhibitTanks = exhibit.tanks.map((tank) => tankById[tank.id]);
    const occupants = exhibitTanks.flatMap((tank) => tank.occupants);
    const requestedSpeciesCount = exhibitTanks.reduce(
      (total, tank) => total + tank.requestedSpeciesCount,
      0,
    );
    const representedSpeciesCount = occupants.length;
    return Object.freeze({
      ...exhibit,
      tanks: Object.freeze(exhibitTanks),
      occupants: Object.freeze(occupants),
      populated: representedSpeciesCount > 0,
      populatedTankCount: exhibitTanks.filter((tank) => tank.populated).length,
      representedSpeciesCount,
      requestedSpeciesCount,
      deliveredCreatureCount: occupants.reduce((total, occupant) => total + occupant.quantity, 0),
      collectionActive: requestedSpeciesCount > 0,
      complete: requestedSpeciesCount > 0 && representedSpeciesCount === requestedSpeciesCount,
    });
  });
  const representedSpeciesCount = tanks.reduce(
    (total, tank) => total + tank.representedSpeciesCount,
    0,
  );
  const requestedSpeciesCount = ELVERSON_AQUARIUM_SPECIES.filter(
    (species) => species.requested,
  ).length;
  const deliveredCreatureCount = tanks.reduce(
    (total, tank) => total + tank.deliveredCreatureCount,
    0,
  );

  return Object.freeze({
    sceneId: ELVERSON_AQUARIUM_SCENE_ID,
    atlasPath: ELVERSON_REEF_CREATURE_ATLAS_PATH,
    exhibits: Object.freeze(exhibits),
    ecosystems: Object.freeze(exhibits),
    tanks: Object.freeze(tanks),
    exhibitCount: exhibits.length,
    tankCount: tanks.length,
    populatedExhibitCount: exhibits.filter((exhibit) => exhibit.populated).length,
    populatedTankCount: tanks.filter((tank) => tank.populated).length,
    representedSpeciesCount,
    requestedSpeciesCount,
    deliveredCreatureCount,
    complete: requestedSpeciesCount > 0 && representedSpeciesCount === requestedSpeciesCount,
  });
}

export function getElversonAquariumExhibitIdForCreature(creatureId) {
  return EXHIBIT_BY_CREATURE_ID[creatureId] ?? null;
}

export function getElversonAquariumTankIdForCreature(creatureId) {
  return TANK_ID_BY_CREATURE_ID[creatureId] ?? null;
}
