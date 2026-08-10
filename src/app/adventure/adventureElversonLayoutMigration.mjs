import {
  ELVERSON_TOWN_AQUARIUM_DECK,
  ELVERSON_TOWN_LAYOUT_VERSION,
  ELVERSON_TOWN_LAYOUT_VERSION_EXPANDED_WATERFRONT,
  ELVERSON_TOWN_LAYOUT_VERSION_LEGACY,
  ELVERSON_TOWN_LAYOUT_VERSION_WIDE_SEAWALL,
  ELVERSON_TOWN_PIER_END_Y,
  ELVERSON_TOWN_SAFE_POSITIONS,
  ELVERSON_TOWN_SAFE_PROMENADE_Y,
  ELVERSON_TOWN_WHARF_DECK,
  ELVERSON_TOWN_WEST_COVE,
} from "./adventureElversonTownLayout.mjs";

const POSITION_TOLERANCE = 0.21;
const RELEASED_PLAYER_RADIUS = 0.22;
const WALKABLE_REGION_EDGE_SAMPLES = 16;
const GEOMETRY_EPSILON = 1e-9;

const WIDE_SEAWALL_MAINLAND = Object.freeze({
  left: -0.5,
  top: -0.5,
  right: 41.5,
  bottom: 17.55,
});
const EXPANDED_WATERFRONT_REGIONS = Object.freeze([
  Object.freeze({ left: -0.5, top: -0.5, right: 41.5, bottom: 16.85 }),
  Object.freeze({ left: 19.05, top: 16.25, right: 21.95, bottom: 27.25 }),
  Object.freeze({ left: 10.9, top: 17.35, right: 19.35, bottom: 22.55 }),
  Object.freeze({ left: 21.65, top: 17.35, right: 24.65, bottom: 24.1 }),
  Object.freeze({ left: 24.05, top: 17.35, right: 31.2, bottom: 24.1 }),
]);
const CURRENT_WATERFRONT_REGIONS = Object.freeze([
  Object.freeze({ left: -0.5, top: -0.5, right: 41.5, bottom: 16.85 }),
  ELVERSON_TOWN_WEST_COVE.stairs,
  ELVERSON_TOWN_WEST_COVE.sand,
  ELVERSON_TOWN_WEST_COVE.shallows,
  Object.freeze({ left: 19.05, top: 16.25, right: 21.95, bottom: ELVERSON_TOWN_PIER_END_Y }),
  ELVERSON_TOWN_WHARF_DECK,
  ELVERSON_TOWN_AQUARIUM_DECK,
]);

function copyPoint(position) {
  return { x: position.x, y: position.y };
}

function near(position, target) {
  return Math.hypot(position.x - target.x, position.y - target.y) <= POSITION_TOLERANCE;
}

function isFinitePosition(position) {
  return Boolean(position)
    && Number.isFinite(position.x)
    && Number.isFinite(position.y);
}

function circleFitsRegionUnion(position, radius, regions) {
  const samples = [position];
  for (let index = 0; index < WALKABLE_REGION_EDGE_SAMPLES; index += 1) {
    const angle = (index / WALKABLE_REGION_EDGE_SAMPLES) * Math.PI * 2;
    samples.push({
      x: position.x + Math.cos(angle) * radius,
      y: position.y + Math.sin(angle) * radius,
    });
  }
  return samples.every((sample) => regions.some((region) => (
    sample.x >= region.left - GEOMETRY_EPSILON
    && sample.x <= region.right + GEOMETRY_EPSILON
    && sample.y >= region.top - GEOMETRY_EPSILON
    && sample.y <= region.bottom + GEOMETRY_EPSILON
  )));
}

function mapWideSeawallTownPosition(position) {
  if (!isFinitePosition(position)) {
    throw new TypeError("Wide-seawall Elverson migration requires a finite position.");
  }
  const occupiedRetiredMainland = circleFitsRegionUnion(
    position,
    RELEASED_PLAYER_RADIUS,
    [WIDE_SEAWALL_MAINLAND],
  );
  const occupiesCurrentWaterfront = circleFitsRegionUnion(
    position,
    RELEASED_PLAYER_RADIUS,
    CURRENT_WATERFRONT_REGIONS,
  );
  if (!occupiedRetiredMainland || occupiesCurrentWaterfront) return null;
  return Object.freeze({
    position: { x: position.x, y: ELVERSON_TOWN_SAFE_PROMENADE_Y },
    reason: "seawall-promenade",
  });
}

function mapExpandedWaterfrontTownPosition(position) {
  if (!isFinitePosition(position)) {
    throw new TypeError("Expanded-waterfront Elverson migration requires a finite position.");
  }
  const occupiedReleasedWaterfront = circleFitsRegionUnion(
    position,
    RELEASED_PLAYER_RADIUS,
    EXPANDED_WATERFRONT_REGIONS,
  );
  const occupiesCurrentWaterfront = circleFitsRegionUnion(
    position,
    RELEASED_PLAYER_RADIUS,
    CURRENT_WATERFRONT_REGIONS,
  );
  if (!occupiedReleasedWaterfront || occupiesCurrentWaterfront) return null;
  const retiredPierEnd = position.x <= 21.95 && position.y >= ELVERSON_TOWN_PIER_END_Y - RELEASED_PLAYER_RADIUS;
  return Object.freeze({
    position: copyPoint(
      retiredPierEnd
        ? ELVERSON_TOWN_SAFE_POSITIONS.pierEnd
        : ELVERSON_TOWN_SAFE_POSITIONS.aquariumExterior,
    ),
    reason: retiredPierEnd ? "pier-end" : "aquarium-front-apron",
  });
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
  if (!isFinitePosition(position)) {
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
  if (![
    ELVERSON_TOWN_LAYOUT_VERSION_LEGACY,
    ELVERSON_TOWN_LAYOUT_VERSION_WIDE_SEAWALL,
    ELVERSON_TOWN_LAYOUT_VERSION_EXPANDED_WATERFRONT,
  ].includes(world.layoutVersion)) {
    throw new RangeError(`Unsupported Elverson layout version: ${String(world.layoutVersion)}.`);
  }

  const isElversonTown = world.townId === "shellshore-village" && world.sceneId === "town";
  const mapped = isElversonTown
    ? (
      world.layoutVersion === ELVERSON_TOWN_LAYOUT_VERSION_LEGACY
        ? mapLegacyElversonTownPosition(world.position)
        : world.layoutVersion === ELVERSON_TOWN_LAYOUT_VERSION_WIDE_SEAWALL
          ? mapWideSeawallTownPosition(world.position)
          : mapExpandedWaterfrontTownPosition(world.position)
    )
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
