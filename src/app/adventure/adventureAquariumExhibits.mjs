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

const ATLAS_COLUMNS = 5;
const ATLAS_ROWS = 2;
const HASH_RANGE = 0x100000000;
const MIN_OCCUPANT_DEPTH = 0.14;
const MAX_OCCUPANT_DEPTH = 0.86;

const TANK_CATEGORIES = Object.freeze({
  community: Object.freeze(["fish", "invertebrate", "coral"]),
  apex: Object.freeze(["predator", "apex", "filter-feeder"]),
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

function authoredMovementProfile(value, speciesId) {
  if (
    !AQUARIUM_MOVEMENT_KINDS.includes(value?.kind)
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
  return Object.freeze({
    kind: value.kind,
    anchor: authoredMovementAnchor(value.anchor, speciesId),
    roam: authoredMovementVector(value.roam, "roam", speciesId),
    groupSize: value.groupSize,
    speed: value.speed,
    amplitude: authoredMovementVector(value.amplitude, "amplitude", speciesId),
  });
}

const REEF_COMMUNITY_CORAL_HOME_ANCHOR = Object.freeze({
  id: "reef-community-coral-home",
  xPercent: 18,
  yPercent: 62,
});

function aquariumSpecies(definition) {
  const cell = Object.freeze({ ...definition.spriteCell });
  const position = atlasPosition(cell);
  const displaySize = authoredDisplaySize(definition.displaySize, definition.id);
  const movementProfile = authoredMovementProfile(definition.movementProfile, definition.id);
  return Object.freeze({
    id: definition.id,
    cardId: definition.cardId,
    category: definition.category,
    ecosystemId: definition.ecosystemId,
    tankKind: definition.tankKind,
    tankId: `${definition.ecosystemId}-${definition.tankKind}`,
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
      anchor: null,
      roam: { xPercent: 104, yPercent: 32 },
      groupSize: 5,
      speed: 0.78,
      amplitude: { xPercent: 3, yPercent: 4.5 },
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
      anchor: REEF_COMMUNITY_CORAL_HOME_ANCHOR,
      roam: { xPercent: 11, yPercent: 9 },
      groupSize: 1,
      speed: 0.42,
      amplitude: { xPercent: 3.5, yPercent: 2.5 },
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
      anchor: REEF_COMMUNITY_CORAL_HOME_ANCHOR,
      roam: { xPercent: 9, yPercent: 7 },
      groupSize: 1,
      speed: 0.36,
      amplitude: { xPercent: 3, yPercent: 2 },
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
      anchor: { id: "reef-community-left-rock", xPercent: 28, yPercent: 86 },
      roam: { xPercent: 6, yPercent: 1.5 },
      groupSize: 1,
      speed: 0.12,
      amplitude: { xPercent: 2.5, yPercent: 0.4 },
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
      anchor: null,
      roam: { xPercent: 106, yPercent: 30 },
      groupSize: 4,
      speed: 0.9,
      amplitude: { xPercent: 3.5, yPercent: 5 },
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
      anchor: { id: "reef-community-right-rock", xPercent: 78, yPercent: 84 },
      roam: { xPercent: 0.8, yPercent: 0.4 },
      groupSize: 1,
      speed: 0.03,
      amplitude: { xPercent: 0.3, yPercent: 0.2 },
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
      anchor: null,
      roam: { xPercent: 112, yPercent: 24 },
      groupSize: 1,
      speed: 0.68,
      amplitude: { xPercent: 0, yPercent: 4 },
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
      anchor: { id: "reef-community-center-right-rock", xPercent: 68, yPercent: 88 },
      roam: { xPercent: 8, yPercent: 1.5 },
      groupSize: 1,
      speed: 0.14,
      amplitude: { xPercent: 3.5, yPercent: 0.4 },
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
      anchor: null,
      roam: { xPercent: 108, yPercent: 28 },
      groupSize: 1,
      speed: 0.82,
      amplitude: { xPercent: 0, yPercent: 4.5 },
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
      anchor: null,
      roam: { xPercent: 110, yPercent: 26 },
      groupSize: 1,
      speed: 0.6,
      amplitude: { xPercent: 0, yPercent: 4 },
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
