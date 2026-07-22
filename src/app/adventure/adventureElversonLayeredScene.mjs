import { compileLayeredScene } from "./adventureLayeredScene.mjs";

const OBJECT_ROOT = "/images/adventure/elverson-objects-v2";

function sprite(name, width, height, anchorX = 0.5, anchorY = 1) {
  return {
    src: `${OBJECT_ROOT}/${name}.png`,
    width,
    height,
    anchorX,
    anchorY,
  };
}

function buildingBase(width, {
  doorCenter = null,
  doorWidth = 0.8,
  depth = 0.7,
  bottom = 0.05,
  widthRatio = 0.4,
} = {}) {
  // Foundations are narrower than roofs and awnings. Besides matching the
  // classic top-down visual language, this preserves real alleys between
  // neighboring buildings instead of joining their invisible rectangles.
  const halfWidth = width * widthRatio;
  if (doorCenter === null) {
    return [{ id: "foundation", left: -halfWidth, top: bottom - depth, right: halfWidth, bottom }];
  }
  const doorLeft = doorCenter - doorWidth / 2;
  const doorRight = doorCenter + doorWidth / 2;
  return [
    { id: "foundation-left", left: -halfWidth, top: bottom - depth, right: doorLeft, bottom },
    { id: "foundation-right", left: doorRight, top: bottom - depth, right: halfWidth, bottom },
  ];
}

function building(spriteName, width, height, options = {}) {
  return {
    sprite: sprite(spriteName, width, height),
    colliders: buildingBase(width, options),
  };
}

function terrainRow(...walkableSpans) {
  return Array.from({ length: 30 }, (_, x) => (
    walkableSpans.some(([left, right]) => x >= left && x <= right) ? "g" : "w"
  )).join("");
}

const TERRAIN_ROWS = Object.freeze([
  ...Array.from({ length: 12 }, () => "g".repeat(30)),
  terrainRow([13, 14]),
  terrainRow([13, 14]),
  terrainRow([13, 14]),
  terrainRow([9, 20]),
  terrainRow([9, 20]),
  terrainRow([9, 14]),
  terrainRow([13, 14]),
  "w".repeat(30),
]);

const ARCHETYPES = {
  "blue-home": building("blue-home", 4.1, 3.95),
  "tan-home": building("tan-home", 3.5, 3.98),
  "green-home": building("green-home", 3.4, 4.27),
  "green-home-door": building("green-home", 3.4, 4.27, { doorWidth: 0.82, doorCenter: 0 }),
  "brick-school-door": building("brick-school", 4, 4.82, { doorWidth: 0.86, doorCenter: 0 }),
  "brick-civic-hall": building("brick-civic-hall", 4.8, 4.65),
  "yellow-storefront": building("yellow-storefront", 3.5, 3.65),
  "green-awning-shop": building("green-awning-shop", 3, 3.92),
  "aquarium-door": {
    sprite: sprite("aquarium-workshop", 5.2, 5.72),
    // The source sprite includes its front deck. Keep the visual anchor at the
    // bottom of the crop, but sort and collide at the actual wall/foundation
    // one tile higher so the apron remains a continuous walking surface.
    colliders: buildingBase(5.2, {
      doorCenter: -1.78,
      doorWidth: 0.78,
      depth: 0.78,
      bottom: -0.95,
      widthRatio: 0.45,
    }),
    depthOffsetY: -0.95,
  },
  tree: {
    sprite: sprite("street-tree", 2.6, 3.4),
    colliders: [{ id: "trunk", left: -0.23, top: -0.28, right: 0.23, bottom: 0.12 }],
  },
  lamppost: {
    sprite: sprite("lamppost", 0.72, 1.8),
    colliders: [{ id: "base", left: -0.1, top: -0.12, right: 0.1, bottom: 0.1 }],
  },
  bench: {
    sprite: sprite("park-bench", 1.55, 1.35),
    colliders: [{ id: "feet", left: -0.72, top: -0.28, right: 0.72, bottom: 0.08 }],
  },
  fountain: {
    sprite: sprite("fountain", 2, 2.33),
    colliders: [{ id: "basin", left: -0.82, top: -0.55, right: 0.82, bottom: 0.15 }],
  },
  planter: {
    sprite: sprite("hedge-planter", 2, 1.43),
    colliders: [{ id: "box", left: -0.92, top: -0.42, right: 0.92, bottom: 0.08 }],
  },
  barrels: {
    sprite: sprite("barrels", 1.35, 1.11),
    colliders: [{ id: "base", left: -0.58, top: -0.42, right: 0.58, bottom: 0.08 }],
  },
  signpost: {
    sprite: sprite("signpost", 0.95, 1.41),
    colliders: [{ id: "base", left: -0.13, top: -0.14, right: 0.13, bottom: 0.1 }],
  },
  shrub: {
    sprite: sprite("flowering-shrub", 1.25, 1.1),
    colliders: [{ id: "base", left: -0.5, top: -0.33, right: 0.5, bottom: 0.08 }],
  },
};

const OBJECTS = [
  { id: "west-blue-home", archetype: "blue-home", at: { x: 3.2, y: 5.5 } },
  { id: "northwest-tan-home", archetype: "tan-home", at: { x: 10, y: 3.7 } },
  {
    id: "chestnut-green-home",
    archetype: "green-home-door",
    at: { x: 18, y: 3.75 },
    interactionId: "interaction-elverson-enter-chestnut-home",
  },
  { id: "northeast-tan-home", archetype: "tan-home", at: { x: 22.6, y: 3.8 } },
  {
    id: "park-brick-school",
    archetype: "brick-school-door",
    at: { x: 7, y: 6.7 },
    interactionId: "interaction-elverson-enter-park-home",
  },
  { id: "east-civic-hall", archetype: "brick-civic-hall", at: { x: 23.1, y: 6.85 } },
  // Pull the waterfront row half a tile inland. This matches the visible
  // building fronts while turning the old shoulder-width strip between their
  // foundations and the seawall into a real two-body promenade.
  { id: "west-yellow-shop", archetype: "yellow-storefront", at: { x: 2.35, y: 9.9 } },
  { id: "main-yellow-shop", archetype: "yellow-storefront", at: { x: 5.9, y: 9.9 } },
  { id: "main-green-shop", archetype: "green-awning-shop", at: { x: 9, y: 9.9 } },
  { id: "east-yellow-shop", archetype: "yellow-storefront", at: { x: 18, y: 9.9 } },
  { id: "east-green-home", archetype: "green-home", at: { x: 21.7, y: 9.9 } },
  { id: "far-east-tan-home", archetype: "tan-home", at: { x: 25, y: 9.9 } },
  {
    id: "aquarium-workshop",
    archetype: "aquarium-door",
    at: { x: 17.8, y: 16.35 },
    interactionId: "interaction-elverson-enter-aquarium",
  },

  ...[
    ["northwest", 1, 1.2], ["north-midwest", 5.8, 1.1], ["north-central", 13, 1.05],
    ["north-mideast", 25.8, 1.15], ["northeast", 28.6, 1.4], ["west-upper", 0.2, 4.3],
    ["west-lower", 0.25, 8.7], ["east-upper", 29, 4.5], ["east-lower", 28.9, 8.8],
    ["park-west", 12, 5.5], ["park-east", 19, 5.5], ["shore-west", 1.2, 11.1],
    ["shore-east", 28.3, 11.05],
  ].map(([id, x, y]) => ({ id: `tree-${id}`, archetype: "tree", at: { x, y } })),

  ...[
    ["north-crossing", 14, 2.2], ["park-south", 12.8, 6.7], ["main-west", 11.2, 7.8],
    ["main-east", 15.8, 7.8], ["promenade-west", 5, 11.5], ["promenade-east", 18.5, 11.5],
    ["promenade-far-east", 26, 11.5],
  ].map(([id, x, y]) => ({ id: `lamp-${id}`, archetype: "lamppost", at: { x, y } })),

  { id: "park-bench-north", archetype: "bench", at: { x: 16.3, y: 4.1 } },
  { id: "park-bench-south", archetype: "bench", at: { x: 16.2, y: 6.4 } },
  // Waterfront furniture sits against the seawall instead of spanning the
  // narrow sidewalk. Its visible upper sprite still overhangs the walk, while
  // the feet collider leaves a comfortable east-west lane on the shop side.
  { id: "promenade-bench-west", archetype: "bench", at: { x: 7, y: 11.6 } },
  { id: "promenade-bench-east", archetype: "bench", at: { x: 21, y: 11.6 } },
  { id: "park-fountain", archetype: "fountain", at: { x: 16.5, y: 5.45 } },
  { id: "main-planter-west", archetype: "planter", at: { x: 12.3, y: 9.65 } },
  { id: "main-planter-east", archetype: "planter", at: { x: 15.5, y: 9.65 } },
  { id: "aquarium-barrels", archetype: "barrels", at: { x: 20.2, y: 16.2 } },
  { id: "pier-sign", archetype: "signpost", at: { x: 13.2, y: 12.2 } },
  { id: "park-shrub", archetype: "shrub", at: { x: 18.5, y: 4.8 } },
];

export const ELVERSON_LAYERED_SCENE = compileLayeredScene({
  id: "elverson-town-layered-v2",
  width: 30,
  height: 20,
  groundPath: "/images/adventure/elverson-ground-v2.png",
  terrainRows: TERRAIN_ROWS,
  terrainLegend: {
    g: { walkable: true },
    w: { walkable: false },
  },
  walkableRegions: [
    { id: "mainland", left: -0.5, top: -0.5, right: 29.5, bottom: 11.6 },
    { id: "central-pier", left: 13.3, top: 11.2, right: 14.7, bottom: 18.1 },
    { id: "fishing-connector", left: 12.7, top: 14.35, right: 13.55, bottom: 16 },
    { id: "fishing-platform", left: 9.6, top: 15.95, right: 13.35, bottom: 17.9 },
    { id: "aquarium-apron", left: 14.55, top: 15.25, right: 20.85, bottom: 16.55 },
  ],
  archetypes: ARCHETYPES,
  objects: OBJECTS,
});
