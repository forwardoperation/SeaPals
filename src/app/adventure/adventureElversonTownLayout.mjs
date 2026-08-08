function point(x, y) {
  return Object.freeze({ x, y });
}

function bounds(left, top, right, bottom) {
  return Object.freeze({ left, top, right, bottom });
}

export const ELVERSON_TOWN_LAYOUT_VERSION_LEGACY = 1;
export const ELVERSON_TOWN_LAYOUT_VERSION_WIDE_SEAWALL = 2;
export const ELVERSON_TOWN_LAYOUT_VERSION = 3;
export const ELVERSON_TOWN_SAFE_PROMENADE_Y = 16.45;

export const ELVERSON_TOWN_DIMENSIONS = Object.freeze({ width: 42, height: 28 });

export const ELVERSON_TOWN_SAFE_POSITIONS = Object.freeze({
  townStart: point(20, 6),
  legacyTownResume: point(20, 6),
  shellshoreDock: point(20, 17),
  playerHomeExterior: point(3.55, 5.05),
  reefHouseExterior: point(13.8, 5.05),
  deepHouseExterior: point(28.2, 5.05),
  oceanicHouseExterior: point(36.8, 5.05),
  schoolhouseExterior: point(4.3, ELVERSON_TOWN_SAFE_PROMENADE_Y),
  hybridHouseExterior: point(13.8, ELVERSON_TOWN_SAFE_PROMENADE_Y),
  researchLabExterior: point(30.7, ELVERSON_TOWN_SAFE_PROMENADE_Y),
  supplyCompanyExterior: point(37.5, ELVERSON_TOWN_SAFE_PROMENADE_Y),
  wharfApproach: point(14.55, 21.45),
  handNetCove: point(15.15, 21.65),
  aquariumExterior: point(24.54, 22.25),
});

export const ELVERSON_TOWN_PORTALS = Object.freeze([
  Object.freeze({
    id: "interaction-elverson-enter-player-home",
    objectId: "player-home",
    archetype: "blue-home-left-door",
    at: point(4.2, 4.45),
    doorway: point(3.55, 4.1),
    targetScene: "player-home",
    interiorSpawn: point(7, 4),
    exteriorSpawn: ELVERSON_TOWN_SAFE_POSITIONS.playerHomeExterior,
  }),
  Object.freeze({
    id: "interaction-elverson-enter-reef-house",
    objectId: "reef-house",
    archetype: "green-home-door",
    at: point(13.8, 4.45),
    doorway: point(13.8, 4.1),
    targetScene: "coral-home",
    interiorSpawn: point(5, 6),
    exteriorSpawn: ELVERSON_TOWN_SAFE_POSITIONS.reefHouseExterior,
  }),
  Object.freeze({
    id: "interaction-elverson-enter-deep-house",
    objectId: "deep-house",
    archetype: "tan-home-door",
    at: point(28.2, 4.45),
    doorway: point(28.2, 4.1),
    targetScene: "deep-home",
    interiorSpawn: point(5, 6),
    exteriorSpawn: ELVERSON_TOWN_SAFE_POSITIONS.deepHouseExterior,
  }),
  Object.freeze({
    id: "interaction-elverson-enter-oceanic-house",
    objectId: "oceanic-house",
    archetype: "blue-home-left-door",
    at: point(37.45, 4.45),
    doorway: point(36.8, 4.1),
    targetScene: "elverson-oceanic-home",
    interiorSpawn: point(5, 6),
    exteriorSpawn: ELVERSON_TOWN_SAFE_POSITIONS.oceanicHouseExterior,
  }),
  Object.freeze({
    id: "interaction-elverson-enter-schoolhouse",
    objectId: "red-schoolhouse",
    archetype: "brick-school-door",
    at: point(4.3, 15.85),
    doorway: point(4.3, 15.5),
    targetScene: "elverson-red-schoolhouse",
    interiorSpawn: point(6, 7),
    exteriorSpawn: ELVERSON_TOWN_SAFE_POSITIONS.schoolhouseExterior,
  }),
  Object.freeze({
    id: "interaction-elverson-enter-hybrid-house",
    objectId: "hybrid-house",
    archetype: "green-home-door",
    at: point(13.8, 15.85),
    doorway: point(13.8, 15.5),
    targetScene: "elverson-hybrid-home",
    interiorSpawn: point(5, 6),
    exteriorSpawn: ELVERSON_TOWN_SAFE_POSITIONS.hybridHouseExterior,
  }),
  Object.freeze({
    id: "interaction-elverson-enter-research-lab",
    objectId: "marine-research-lab",
    archetype: "brick-civic-hall-door",
    at: point(30.7, 15.85),
    doorway: point(30.7, 15.5),
    targetScene: "elverson-marine-research-lab",
    interiorSpawn: point(6, 7),
    exteriorSpawn: ELVERSON_TOWN_SAFE_POSITIONS.researchLabExterior,
  }),
  Object.freeze({
    id: "interaction-elverson-enter-supply-company",
    objectId: "elverson-supply-company",
    archetype: "green-awning-shop-door",
    at: point(37.5, 15.85),
    doorway: point(37.5, 15.5),
    targetScene: "elverson-supply-company",
    interiorSpawn: point(6, 7),
    exteriorSpawn: ELVERSON_TOWN_SAFE_POSITIONS.supplyCompanyExterior,
  }),
  Object.freeze({
    id: "interaction-elverson-enter-aquarium",
    objectId: "aquarium-workshop",
    archetype: "aquarium-door",
    // The source facade is wider than the waterfront platform. Scale it to
    // the deck, then keep its authored left-hand door over solid planks.
    at: point(25.575, 22.55),
    scale: 0.58,
    doorway: point(24.54, 21.85),
    targetScene: "academy-lab",
    interiorSpawn: point(7, 7),
    exteriorSpawn: ELVERSON_TOWN_SAFE_POSITIONS.aquariumExterior,
  }),
]);

export const ELVERSON_TOWN_PORTAL_BY_SCENE = Object.freeze(Object.fromEntries(
  ELVERSON_TOWN_PORTALS.map((portal) => [portal.targetScene, portal]),
));

export const ELVERSON_TOWN_ROADS = Object.freeze({
  mainStreet: Object.freeze({
    bounds: bounds(0.5, 5, 41, 6.65),
    lanes: Object.freeze([point(1, 5.45), point(1, 6.2)]),
    axis: "horizontal",
  }),
  chestnutAvenue: Object.freeze({
    bounds: bounds(19.25, -0.2, 21.75, 17.35),
    lanes: Object.freeze([point(19.8, 0.5), point(21.15, 0.5)]),
    axis: "vertical",
  }),
  neighborhoodLane: Object.freeze({
    bounds: bounds(0.5, 9.95, 41, 11.05),
    lanes: Object.freeze([point(1, 10.2), point(1, 10.75)]),
    axis: "horizontal",
  }),
  waterfrontPromenade: Object.freeze({
    bounds: bounds(0.5, 16.12, 41, 16.8),
    lanes: Object.freeze([point(1, 16.25), point(1, 16.55)]),
    axis: "horizontal",
  }),
});

export const ELVERSON_BIRTHDAY_RACE_PATH = Object.freeze([
  ELVERSON_TOWN_SAFE_POSITIONS.playerHomeExterior,
  point(8, 5.8),
  point(20.5, 5.8),
  point(20.5, 16.8),
  point(20.5, 21.75),
  ELVERSON_TOWN_SAFE_POSITIONS.aquariumExterior,
]);

export const ELVERSON_WYETH_HAND_NET_PATH = Object.freeze({
  leader: Object.freeze([
    point(18.05, 20.85),
    point(17.15, 20.85),
    point(16.35, 20.85),
    point(15.65, 21.2),
    ELVERSON_TOWN_SAFE_POSITIONS.handNetCove,
  ]),
  follower: Object.freeze([
    point(17.55, 21.35),
    point(16.8, 21.35),
    point(16.1, 21.35),
    ELVERSON_TOWN_SAFE_POSITIONS.handNetCove,
  ]),
});
