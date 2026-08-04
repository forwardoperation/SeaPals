import {
  ELVERSON_REEF_CATCHES,
  getElversonFishingProgress,
} from "./adventureFishing.mjs";

export const ELVERSON_AQUARIUM_SCENE_ID = "academy-lab";
export const ELVERSON_REEF_CREATURE_ATLAS_PATH = "/images/adventure/elverson-reef-creature-atlas-v1.png";

const ATLAS_COLUMNS = 5;
const ATLAS_ROWS = 2;

const SPRITE_CELL_BY_ID = Object.freeze(Object.fromEntries(
  ELVERSON_REEF_CATCHES.map((creature, index) => [
    creature.id,
    Object.freeze({
      column: index % ATLAS_COLUMNS,
      row: Math.floor(index / ATLAS_COLUMNS),
    }),
  ]),
));

function exhibit(definition) {
  return Object.freeze({
    ...definition,
    bounds: Object.freeze({ ...definition.bounds }),
    creatureIds: Object.freeze([...definition.creatureIds]),
  });
}

/**
 * The workshop is the first aquarium room. These three care-first exhibits
 * intentionally group animals by the habitat features the player has learned
 * to provide, rather than presenting one undifferentiated collection tank.
 */
export const ELVERSON_AQUARIUM_EXHIBITS = Object.freeze([
  exhibit({
    id: "reef-cleaning-station",
    name: "Reef Cleaning Station",
    ecosystem: "Shallow coral reef",
    emptyMessage: "Awaiting a small reef fish",
    bounds: { left: 35.4, top: 17.2, width: 21.5, height: 15.4 },
    creatureIds: ["white-grunt", "cleaner-wrasse", "blue-tang", "spanish-hogfish"],
  }),
  exhibit({
    id: "sheltered-coral-garden",
    name: "Sheltered Coral Garden",
    ecosystem: "Protected reef ledge",
    emptyMessage: "Awaiting a shelter-seeking reef fish",
    bounds: { left: 18.1, top: 48.4, width: 18.1, height: 24.2 },
    creatureIds: ["clownfish", "fairy-parrotfish", "french-angelfish"],
  }),
  exhibit({
    id: "rocky-invertebrate-nursery",
    name: "Rocky Invertebrate Nursery",
    ecosystem: "Reef rubble and tide pools",
    emptyMessage: "Awaiting a small invertebrate",
    bounds: { left: 56.2, top: 48.4, width: 18.8, height: 24.2 },
    creatureIds: ["emerald-crab", "sea-urchin", "blue-crab"],
  }),
]);

const EXHIBIT_BY_CREATURE_ID = Object.freeze(Object.fromEntries(
  ELVERSON_AQUARIUM_EXHIBITS.flatMap((entry) => (
    entry.creatureIds.map((creatureId) => [creatureId, entry.id])
  )),
));

function atlasPosition(cell) {
  return Object.freeze({
    x: ATLAS_COLUMNS === 1 ? 0 : (cell.column / (ATLAS_COLUMNS - 1)) * 100,
    y: ATLAS_ROWS === 1 ? 0 : (cell.row / (ATLAS_ROWS - 1)) * 100,
  });
}

function aquariumOccupant(creature, exhibitIndex, occupantIndex) {
  const cell = SPRITE_CELL_BY_ID[creature.id];
  const lane = occupantIndex % 3;
  const direction = (exhibitIndex + occupantIndex) % 2 === 0 ? 1 : -1;
  return Object.freeze({
    id: creature.id,
    cardId: creature.cardId,
    quantity: creature.aquarium,
    category: creature.category,
    atlasCell: cell,
    atlasPosition: atlasPosition(cell),
    animation: Object.freeze({
      lane,
      direction,
      delaySeconds: -((exhibitIndex * 1.7) + (occupantIndex * 1.15)),
      durationSeconds: 8 + ((exhibitIndex + occupantIndex) % 4) * 1.35,
    }),
  });
}

/**
 * Builds a render-safe, immutable view of the Aquarium from delivered
 * creatures. Held catches never appear until Mr. Easterling records them.
 */
export function getElversonAquariumExhibitModel(saveValue) {
  const progress = getElversonFishingProgress(saveValue);
  const creatureById = Object.fromEntries(
    progress.creatures.map((creature) => [creature.id, creature]),
  );
  const exhibits = ELVERSON_AQUARIUM_EXHIBITS.map((entry, exhibitIndex) => {
    const occupants = entry.creatureIds
      .map((creatureId) => creatureById[creatureId])
      .filter((creature) => creature?.aquarium > 0)
      .map((creature, occupantIndex) => aquariumOccupant(creature, exhibitIndex, occupantIndex));
    return Object.freeze({
      ...entry,
      occupants: Object.freeze(occupants),
      populated: occupants.length > 0,
      representedSpeciesCount: occupants.length,
      deliveredCreatureCount: occupants.reduce((total, occupant) => total + occupant.quantity, 0),
    });
  });
  const representedSpeciesCount = exhibits.reduce(
    (total, entry) => total + entry.representedSpeciesCount,
    0,
  );
  return Object.freeze({
    sceneId: ELVERSON_AQUARIUM_SCENE_ID,
    atlasPath: ELVERSON_REEF_CREATURE_ATLAS_PATH,
    exhibits: Object.freeze(exhibits),
    representedSpeciesCount,
    requestedSpeciesCount: ELVERSON_REEF_CATCHES.length,
    complete: representedSpeciesCount === ELVERSON_REEF_CATCHES.length,
  });
}

export function getElversonAquariumExhibitIdForCreature(creatureId) {
  return EXHIBIT_BY_CREATURE_ID[creatureId] ?? null;
}
