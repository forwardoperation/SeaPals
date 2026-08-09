function point(x, y) {
  return Object.freeze({ x, y });
}

function bounds(left, top, right, bottom) {
  return Object.freeze({ left, top, right, bottom });
}

export const ELVERSON_TOWN_LAYOUT_VERSION_LEGACY = 1;
export const ELVERSON_TOWN_LAYOUT_VERSION_WIDE_SEAWALL = 2;
export const ELVERSON_TOWN_LAYOUT_VERSION_EXPANDED_WATERFRONT = 3;
export const ELVERSON_TOWN_LAYOUT_VERSION = 4;
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
  handNetCove: point(9.4, 19.35),
  pierEnd: point(20.5, 25.9),
  aquariumExterior: point(27.6, 23.72),
});

export const ELVERSON_TOWN_WEST_COVE = Object.freeze({
  stairs: bounds(9, 16.35, 10.05, 18.25),
  sand: bounds(7.4, 17.75, 10.85, 19.2),
  shallows: bounds(7.65, 18.85, 10.65, 20.35),
  wyeth: point(8.35, 18.2),
});

export const ELVERSON_TOWN_PIER_END_Y = 26.35;
export const ELVERSON_TOWN_AQUARIUM_APRON = bounds(21.65, 22.65, 31.2, 24.1);

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
    // The grand facade spans most of the aquarium deck while leaving the old
    // workshop return point unobstructed for in-progress saves.
    at: point(27.6, 23.75),
    scale: 0.8,
    doorway: point(27.6, 23.3),
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
    ELVERSON_TOWN_WEST_COVE.wyeth,
    point(8.45, 18.55),
    point(8.55, 18.9),
  ]),
  follower: Object.freeze([
    point(8.85, 18.15),
    point(9.05, 18.65),
    ELVERSON_TOWN_SAFE_POSITIONS.handNetCove,
  ]),
});
