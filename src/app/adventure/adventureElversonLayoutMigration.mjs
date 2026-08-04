import {
  ELVERSON_TOWN_LAYOUT_VERSION,
  ELVERSON_TOWN_LAYOUT_VERSION_LEGACY,
  ELVERSON_TOWN_SAFE_POSITIONS,
} from "./adventureElversonTownLayout.mjs";

const POSITION_TOLERANCE = 0.21;

function copyPoint(position) {
  return { x: position.x, y: position.y };
}

function near(position, target) {
  return Math.hypot(position.x - target.x, position.y - target.y) <= POSITION_TOLERANCE;
}

const LEGACY_TOWN_LANDMARKS = Object.freeze([
  Object.freeze({
    positions: Object.freeze([{ x: 16, y: 17 }, { x: 16, y: 15.85 }]),
    destination: ELVERSON_TOWN_SAFE_POSITIONS.aquariumExterior,
    reason: "aquarium-exterior",
  }),
  Object.freeze({
    positions: Object.freeze([{ x: 7, y: 7 }]),
    destination: ELVERSON_TOWN_SAFE_POSITIONS.reefHouseExterior,
    reason: "reef-house-exterior",
  }),
  Object.freeze({
    positions: Object.freeze([{ x: 18, y: 4 }]),
    destination: ELVERSON_TOWN_SAFE_POSITIONS.deepHouseExterior,
    reason: "deep-house-exterior",
  }),
  Object.freeze({
    positions: Object.freeze([{ x: 14, y: 10 }]),
    destination: ELVERSON_TOWN_SAFE_POSITIONS.shellshoreDock,
    reason: "town-start",
  }),
]);

export function mapLegacyElversonTownPosition(position) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    throw new TypeError("Legacy Elverson migration requires a finite position.");
  }
  const landmark = LEGACY_TOWN_LANDMARKS.find(({ positions }) => (
    positions.some((candidate) => near(position, candidate))
  ));
  return Object.freeze({
    position: copyPoint(landmark?.destination ?? ELVERSON_TOWN_SAFE_POSITIONS.legacyTownResume),
    reason: landmark?.reason ?? "neutral-town-resume",
  });
}

/**
 * Upgrades the global Elverson coordinate epoch without changing any gameplay
 * domain. Interior coordinates are unchanged; legacy exterior coordinates map
 * to authored semantic landmarks instead of being proportionally stretched.
 */
export function migrateElversonLayout(saveValue) {
  if (!saveValue || typeof saveValue !== "object" || Array.isArray(saveValue)) {
    throw new TypeError("Elverson layout migration requires a save object.");
  }
  if (!saveValue.world || typeof saveValue.world !== "object" || Array.isArray(saveValue.world)) {
    throw new TypeError("Elverson layout migration requires world state.");
  }
  const { world } = saveValue;
  if (world.layoutVersion === ELVERSON_TOWN_LAYOUT_VERSION) {
    return Object.freeze({ save: saveValue, migrated: false, reason: null });
  }
  if (world.layoutVersion !== ELVERSON_TOWN_LAYOUT_VERSION_LEGACY) {
    throw new RangeError(`Unsupported Elverson layout version: ${String(world.layoutVersion)}.`);
  }

  const mapped = world.townId === "shellshore-village" && world.sceneId === "town"
    ? mapLegacyElversonTownPosition(world.position)
    : null;
  return Object.freeze({
    save: {
      ...saveValue,
      world: {
        ...world,
        layoutVersion: ELVERSON_TOWN_LAYOUT_VERSION,
        ...(mapped ? { position: mapped.position } : {}),
      },
    },
    migrated: true,
    reason: mapped?.reason ?? "coordinate-epoch-updated",
  });
}
