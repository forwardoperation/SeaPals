import { compileLayeredScene } from "./adventureLayeredScene.mjs";
import {
  ELVERSON_TOWN_AQUARIUM_DECK,
  ELVERSON_TOWN_DIMENSIONS,
  ELVERSON_TOWN_PIER_END_Y,
  ELVERSON_TOWN_PORTALS,
  ELVERSON_TOWN_WHARF_DECK,
  ELVERSON_TOWN_WEST_COVE,
} from "./adventureElversonTownLayout.mjs";

const OBJECT_ROOT = "/images/adventure/elverson-objects-v2";

function sprite(name, width, height, anchorX = 0.5, anchorY = 1) {
  return {
    src: `${OBJECT_ROOT}/${name}.webp`,
    width,
    height,
    anchorX,
    anchorY,
  };
}

function facade(width, height, { bottom = 0.05 } = {}) {
  return [{
    id: "facade",
    left: -width / 2,
    top: -height,
    right: width / 2,
    bottom,
  }];
}

function building(spriteName, width, height, options = {}) {
  return {
    sprite: sprite(spriteName, width, height),
    colliders: facade(width, height, options),
    ...(options.depthOffsetY === undefined ? {} : { depthOffsetY: options.depthOffsetY }),
  };
}

function terrainRow(...walkableSpans) {
  return Array.from({ length: ELVERSON_TOWN_DIMENSIONS.width }, (_, x) => (
    walkableSpans.some(([left, right]) => x >= left && x <= right) ? "g" : "w"
  )).join("");
}

const TERRAIN_ROWS = Object.freeze([
  ...Array.from({ length: 18 }, () => "g".repeat(ELVERSON_TOWN_DIMENSIONS.width)),
  ...Array.from({ length: 3 }, () => terrainRow([7, 31])),
  ...Array.from({ length: 2 }, () => terrainRow([11, 31])),
  ...Array.from({ length: 2 }, () => terrainRow([19, 31])),
  ...Array.from({ length: 2 }, () => terrainRow([19, 22])),
  terrainRow(),
]);

const ARCHETYPES = {
  "blue-home-left-door": building("blue-home", 4.1, 3.95),
  "tan-home-door": building("tan-home", 3.5, 3.98),
  "green-home-door": building("green-home", 3.4, 4.27),
  "brick-school-door": building("brick-school", 4, 4.82),
  "brick-civic-hall-door": building("brick-civic-hall", 4.8, 4.65),
  "green-awning-shop-door": building("green-awning-shop", 3, 3.92),
  "aquarium-door": building("aquarium-grand-exterior-v1", 6.8, 7.38, {
    bottom: -0.82,
    depthOffsetY: -0.82,
  }),
};

const OBJECTS = ELVERSON_TOWN_PORTALS.map((portal) => ({
  id: portal.objectId,
  archetype: portal.archetype,
  at: portal.at,
  ...(portal.scale === undefined ? {} : { scale: portal.scale }),
  interactionId: portal.id,
}));

export const ELVERSON_LAYERED_SCENE = compileLayeredScene({
  id: "elverson-town-layered-v5",
  width: ELVERSON_TOWN_DIMENSIONS.width,
  height: ELVERSON_TOWN_DIMENSIONS.height,
  groundPath: "/images/adventure/elverson-ground-v5.webp",
  terrainRows: TERRAIN_ROWS,
  terrainLegend: {
    g: { walkable: true },
    w: { walkable: false },
  },
  walkableRegions: [
    { id: "mainland", left: -0.5, top: -0.5, right: 41.5, bottom: 16.85 },
    { id: "west-cove-stairs", ...ELVERSON_TOWN_WEST_COVE.stairs },
    { id: "west-cove-sand", ...ELVERSON_TOWN_WEST_COVE.sand },
    { id: "west-cove-shallows", ...ELVERSON_TOWN_WEST_COVE.shallows },
    { id: "central-pier", left: 19.05, top: 16.25, right: 21.95, bottom: ELVERSON_TOWN_PIER_END_Y },
    { id: "wharf-platform", ...ELVERSON_TOWN_WHARF_DECK },
    { id: "aquarium-deck", ...ELVERSON_TOWN_AQUARIUM_DECK },
  ],
  archetypes: ARCHETYPES,
  objects: OBJECTS,
});
