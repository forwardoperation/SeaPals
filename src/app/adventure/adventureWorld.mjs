const DIRECTION_DELTAS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});

export const DIRECTIONS = Object.freeze(Object.keys(DIRECTION_DELTAS));

export const TILE_LEGEND = Object.freeze({
  t: Object.freeze({ id: "tree", walkable: false }),
  g: Object.freeze({ id: "grass", walkable: true }),
  p: Object.freeze({ id: "path", walkable: true }),
  c: Object.freeze({ id: "coral-home-wall", walkable: false }),
  C: Object.freeze({ id: "coral-home-door", walkable: false }),
  d: Object.freeze({ id: "deep-home-wall", walkable: false }),
  D: Object.freeze({ id: "deep-home-door", walkable: false }),
  w: Object.freeze({ id: "interior-wall", walkable: false }),
  f: Object.freeze({ id: "interior-floor", walkable: true }),
  r: Object.freeze({ id: "rug", walkable: true }),
  a: Object.freeze({ id: "furniture", walkable: false }),
  n: Object.freeze({ id: "trainer", walkable: false }),
  E: Object.freeze({ id: "exit-door", walkable: false }),
});

function freezePosition(position) {
  return Object.freeze({ x: position.x, y: position.y });
}

function freezeInteraction(interaction) {
  return Object.freeze({
    ...interaction,
    at: freezePosition(interaction.at),
    ...(interaction.spawn ? { spawn: freezePosition(interaction.spawn) } : {}),
  });
}

function defineScene({ id, name, kind, theme, tiles, spawn, interactions }) {
  const height = tiles.length;
  const width = tiles[0]?.length ?? 0;

  if (!width || tiles.some((row) => row.length !== width)) {
    throw new Error(`Scene ${id} must use a non-empty rectangular tile map.`);
  }
  for (const row of tiles) {
    for (const tile of row) {
      if (!TILE_LEGEND[tile]) throw new Error(`Scene ${id} uses unknown tile symbol ${tile}.`);
    }
  }

  return Object.freeze({
    id,
    name,
    kind,
    theme,
    width,
    height,
    tiles: Object.freeze([...tiles]),
    spawn: freezePosition(spawn),
    interactions: Object.freeze(interactions.map(freezeInteraction)),
  });
}

const TOWN_TILES = [
  "tttttttttttttttt",
  "tccccctggtdddddt",
  "tccccctggtdddddt",
  "tccccctggtdddddt",
  "tccCccggggddDddt",
  "tggpgggppgggpggt",
  "tggpgggppgggpggt",
  "tggppppppppppggt",
  "tggggggppggggggt",
  "tttttttttttttttt",
];

const CORAL_HOME_TILES = [
  "wwwwwwwwwwww",
  "wffffffffffw",
  "wffffnfffffw",
  "wffffrfffffw",
  "wffaaffffaaw",
  "wffffrfffffw",
  "wffffrfffffw",
  "wwwwwEwwwwww",
];

const DEEP_HOME_TILES = [
  "wwwwwwwwwwww",
  "wffffffffffw",
  "wffffnfffffw",
  "wffffrfffffw",
  "wfaaffffaafw",
  "wffffrfffffw",
  "wffffrfffffw",
  "wwwwwEwwwwww",
];

export const SCENES = Object.freeze({
  town: defineScene({
    id: "town",
    name: "Tidepool Town",
    kind: "town",
    theme: "sunlit-reef",
    tiles: TOWN_TILES,
    spawn: { x: 7, y: 8 },
    interactions: [
      {
        type: "enter",
        at: { x: 3, y: 4 },
        targetScene: "coral-home",
        spawn: { x: 5, y: 6 },
      },
      {
        type: "enter",
        at: { x: 12, y: 4 },
        targetScene: "deep-home",
        spawn: { x: 5, y: 6 },
      },
    ],
  }),
  "coral-home": defineScene({
    id: "coral-home",
    name: "Marina's Coral Cottage",
    kind: "interior",
    theme: "coral-cottage",
    tiles: CORAL_HOME_TILES,
    spawn: { x: 5, y: 6 },
    interactions: [
      {
        type: "trainer",
        at: { x: 5, y: 2 },
        trainerId: "marina",
      },
      {
        type: "exit",
        at: { x: 5, y: 7 },
        targetScene: "town",
        spawn: { x: 3, y: 5 },
      },
    ],
  }),
  "deep-home": defineScene({
    id: "deep-home",
    name: "Dorian's Deep-Sea Den",
    kind: "interior",
    theme: "deep-sea-den",
    tiles: DEEP_HOME_TILES,
    spawn: { x: 5, y: 6 },
    interactions: [
      {
        type: "trainer",
        at: { x: 5, y: 2 },
        trainerId: "dorian",
      },
      {
        type: "exit",
        at: { x: 5, y: 7 },
        targetScene: "town",
        spawn: { x: 12, y: 5 },
      },
    ],
  }),
});

export const START_STATE = Object.freeze({
  sceneId: "town",
  position: freezePosition(SCENES.town.spawn),
  facing: "up",
});

function requireScene(sceneId) {
  const scene = SCENES[sceneId];
  if (!scene) throw new RangeError(`Unknown adventure scene: ${sceneId}`);
  return scene;
}

function requirePosition(position) {
  if (!Number.isInteger(position?.x) || !Number.isInteger(position?.y)) {
    throw new TypeError("Adventure positions require integer x and y coordinates.");
  }
  return position;
}

export function isInBounds(sceneId, position) {
  const scene = requireScene(sceneId);
  requirePosition(position);
  return position.x >= 0 && position.x < scene.width && position.y >= 0 && position.y < scene.height;
}

export function getTile(sceneId, position) {
  const scene = requireScene(sceneId);
  requirePosition(position);
  if (!isInBounds(sceneId, position)) return null;
  const symbol = scene.tiles[position.y][position.x];
  return Object.freeze({ symbol, ...TILE_LEGEND[symbol] });
}

export function isWalkable(sceneId, position) {
  return getTile(sceneId, position)?.walkable === true;
}

export function movePlayer(sceneId, position, direction) {
  requireScene(sceneId);
  requirePosition(position);
  const delta = DIRECTION_DELTAS[direction];
  if (!delta) throw new RangeError(`Unknown movement direction: ${direction}`);

  const destination = {
    x: position.x + delta.x,
    y: position.y + delta.y,
  };

  return isWalkable(sceneId, destination)
    ? destination
    : { x: position.x, y: position.y };
}

export function getInteraction(sceneId, position, facing) {
  const scene = requireScene(sceneId);
  requirePosition(position);
  const delta = DIRECTION_DELTAS[facing];
  if (!delta) throw new RangeError(`Unknown facing direction: ${facing}`);

  const target = {
    x: position.x + delta.x,
    y: position.y + delta.y,
  };
  const interaction = scene.interactions.find(
    (candidate) => candidate.at.x === target.x && candidate.at.y === target.y,
  );

  if (!interaction) return null;
  if (interaction.type === "trainer") {
    return { type: "trainer", trainerId: interaction.trainerId };
  }
  return {
    type: interaction.type,
    targetScene: interaction.targetScene,
    spawn: { x: interaction.spawn.x, y: interaction.spawn.y },
  };
}
