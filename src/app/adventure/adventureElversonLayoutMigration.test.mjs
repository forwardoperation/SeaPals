import assert from "node:assert/strict";
import test from "node:test";

import {
  mapLegacyElversonTownPosition,
  migrateElversonLayout,
} from "./adventureElversonLayoutMigration.mjs";
import {
  ELVERSON_TOWN_LAYOUT_VERSION,
  ELVERSON_TOWN_LAYOUT_VERSION_EXPANDED_WATERFRONT,
  ELVERSON_TOWN_LAYOUT_VERSION_LEGACY,
  ELVERSON_TOWN_LAYOUT_VERSION_WIDE_SEAWALL,
  ELVERSON_TOWN_SAFE_POSITIONS,
  ELVERSON_TOWN_SAFE_PROMENADE_Y,
} from "./adventureElversonTownLayout.mjs";
import {
  createInitialAdventureSave,
} from "./adventureProgression.mjs";
import {
  ELVERSON_PROLOGUE_BEAT_IDS,
} from "./adventureOpeningContract.mjs";

function legacySaveAt(position, {
  townId = "shellshore-village",
  sceneId = "town",
} = {}) {
  const initial = createInitialAdventureSave("profile-1");
  return {
    ...initial,
    opening: {
      ...initial.opening,
      status: "active",
      completedBeatIds: [...ELVERSON_PROLOGUE_BEAT_IDS.slice(0, 2)],
    },
    player: {
      starterDeckId: "coral-garden",
      activeDeckId: "starter-coral-garden",
    },
    world: {
      ...initial.world,
      townId,
      sceneId,
      position: { ...position },
      facing: "left",
      lastSafeDockId: "shellshore-dock",
      layoutVersion: ELVERSON_TOWN_LAYOUT_VERSION_LEGACY,
      unlockedRouteIds: ["route-shellshore-sunpatch"],
    },
    progression: {
      ...initial.progression,
      quests: {
        "quest-shellshore-first-voyage": {
          status: "active",
          flags: { "world-introduction-complete": true },
        },
      },
      completedEncounterIds: ["encounter-shellshore-marina"],
      tideMarkIds: ["tide-mark-sunpatch"],
    },
    inventory: {
      ...initial.inventory,
      cards: { "blue-tang": 2 },
      storyItems: { "fishing-rod": 1 },
    },
    playtimeSeconds: 937,
    rewardLedger: ["reward-shellshore-marina"],
  };
}

function withoutWorld(save) {
  const { world: _world, ...rest } = save;
  return rest;
}

function wideSeawallSaveAt(position, options) {
  const save = legacySaveAt(position, options);
  return {
    ...save,
    world: {
      ...save.world,
      layoutVersion: ELVERSON_TOWN_LAYOUT_VERSION_WIDE_SEAWALL,
    },
  };
}

function expandedWaterfrontSaveAt(position, options) {
  const save = legacySaveAt(position, options);
  return {
    ...save,
    world: {
      ...save.world,
      layoutVersion: ELVERSON_TOWN_LAYOUT_VERSION_EXPANDED_WATERFRONT,
    },
  };
}

test("layout epoch 1 maps released Elverson landmarks to authored current safe positions", () => {
  const cases = [
    {
      label: "old aquarium exit",
      position: { x: 16, y: 17 },
      expected: ELVERSON_TOWN_SAFE_POSITIONS.aquariumExterior,
      reason: "aquarium-exterior",
    },
    {
      label: "old aquarium doorway return",
      position: { x: 16, y: 15.85 },
      expected: ELVERSON_TOWN_SAFE_POSITIONS.aquariumExterior,
      reason: "aquarium-exterior",
    },
    {
      label: "old reef-house return",
      position: { x: 7, y: 7 },
      expected: ELVERSON_TOWN_SAFE_POSITIONS.reefHouseExterior,
      reason: "reef-house-exterior",
    },
    {
      label: "old deep-house return",
      position: { x: 18, y: 4 },
      expected: ELVERSON_TOWN_SAFE_POSITIONS.deepHouseExterior,
      reason: "deep-house-exterior",
    },
    {
      label: "old town start",
      position: { x: 14, y: 10 },
      expected: ELVERSON_TOWN_SAFE_POSITIONS.shellshoreDock,
      reason: "town-start",
    },
    {
      label: "slightly imprecise released landmark",
      position: { x: 16.12, y: 16.9 },
      expected: ELVERSON_TOWN_SAFE_POSITIONS.aquariumExterior,
      reason: "aquarium-exterior",
    },
    {
      label: "unrecognized town coordinate",
      position: { x: 5.25, y: 8.5 },
      expected: ELVERSON_TOWN_SAFE_POSITIONS.legacyTownResume,
      reason: "neutral-town-resume",
    },
  ];

  for (const { label, position, expected, reason } of cases) {
    const save = legacySaveAt(position);
    const before = structuredClone(save);
    const result = migrateElversonLayout(save);

    assert.equal(result.migrated, true, label);
    assert.equal(result.reason, reason, label);
    assert.equal(result.save.world.layoutVersion, ELVERSON_TOWN_LAYOUT_VERSION, label);
    assert.deepEqual(result.save.world.position, expected, label);
    assert.deepEqual(withoutWorld(result.save), withoutWorld(save), `${label} must preserve gameplay state`);
    assert.deepEqual(save, before, `${label} must not mutate the source save`);
    assert.notStrictEqual(result.save, save, label);
    assert.notStrictEqual(result.save.world, save.world, label);
  }
});

test("semantic position mapping is deterministic and does not expose shared safe-position objects", () => {
  const first = mapLegacyElversonTownPosition({ x: 7, y: 7 });
  const second = mapLegacyElversonTownPosition({ x: 7, y: 7 });

  assert.deepEqual(first, {
    position: ELVERSON_TOWN_SAFE_POSITIONS.reefHouseExterior,
    reason: "reef-house-exterior",
  });
  assert.deepEqual(second, first);
  assert.notStrictEqual(first.position, ELVERSON_TOWN_SAFE_POSITIONS.reefHouseExterior);
  assert.notStrictEqual(second.position, first.position);
});

test("epoch upgrade preserves Elverson interior and non-Elverson coordinates exactly", () => {
  const locations = [
    {
      label: "player home",
      townId: "shellshore-village",
      sceneId: "player-home",
      position: { x: 7, y: 4 },
    },
    {
      label: "aquarium interior",
      townId: "shellshore-village",
      sceneId: "academy-lab",
      position: { x: 6, y: 7 },
    },
    {
      label: "later-town exterior",
      townId: "sunpatch-cay",
      sceneId: "sunpatch-cay-town",
      position: { x: 9.25, y: 5.5 },
    },
  ];

  for (const location of locations) {
    const save = legacySaveAt(location.position, location);
    const result = migrateElversonLayout(save);

    assert.equal(result.migrated, true, location.label);
    assert.equal(result.reason, "coordinate-epoch-updated", location.label);
    assert.equal(result.save.world.layoutVersion, ELVERSON_TOWN_LAYOUT_VERSION, location.label);
    assert.deepEqual(result.save.world.position, location.position, location.label);
    assert.deepEqual(
      { ...result.save.world, layoutVersion: ELVERSON_TOWN_LAYOUT_VERSION_LEGACY },
      save.world,
      `${location.label} must change only the coordinate epoch`,
    );
    assert.deepEqual(withoutWorld(result.save), withoutWorld(save), location.label);
  }
});

test("epoch-2 positions stranded on the retired seawall move straight north to the promenade", () => {
  const positions = [
    { x: 0, y: 17.2 },
    { x: 15, y: 17.15 },
    { x: 19.2, y: 17.15 },
    { x: 22, y: 16.8 },
    { x: 41, y: 17.3 },
  ];

  for (const position of positions) {
    const save = wideSeawallSaveAt(position);
    const before = structuredClone(save);
    const result = migrateElversonLayout(save);

    assert.equal(result.migrated, true);
    assert.equal(result.reason, "seawall-promenade");
    assert.equal(result.save.world.layoutVersion, ELVERSON_TOWN_LAYOUT_VERSION);
    assert.deepEqual(result.save.world.position, {
      x: position.x,
      y: ELVERSON_TOWN_SAFE_PROMENADE_Y,
    });
    assert.equal(result.save.world.facing, save.world.facing);
    assert.deepEqual(withoutWorld(result.save), withoutWorld(save));
    assert.deepEqual(save, before, "migration must not mutate an epoch-2 source save");
  }
});

test("epoch-2 migration preserves every coordinate not stranded on the retired seawall", () => {
  const locations = [
    {
      label: "current mainland edge",
      townId: "shellshore-village",
      sceneId: "town",
      position: { x: 15, y: 16.63 },
    },
    {
      label: "mainland-to-pier seam",
      townId: "shellshore-village",
      sceneId: "town",
      position: { x: 19.1, y: 16.64 },
    },
    {
      label: "central pier",
      townId: "shellshore-village",
      sceneId: "town",
      position: { x: 20, y: 17.15 },
    },
    {
      label: "coordinate outside the released seawall",
      townId: "shellshore-village",
      sceneId: "town",
      position: { x: 12, y: 17.34 },
    },
    {
      label: "player home",
      townId: "shellshore-village",
      sceneId: "player-home",
      position: { x: 7, y: 4 },
    },
    {
      label: "non-Elverson town",
      townId: "sunpatch-cay",
      sceneId: "sunpatch-cay-town",
      position: { x: 9.25, y: 5.5 },
    },
  ];

  for (const location of locations) {
    const save = wideSeawallSaveAt(location.position, location);
    const positionReference = save.world.position;
    const result = migrateElversonLayout(save);

    assert.equal(result.migrated, true, location.label);
    assert.equal(result.reason, "coordinate-epoch-updated", location.label);
    assert.equal(result.save.world.layoutVersion, ELVERSON_TOWN_LAYOUT_VERSION, location.label);
    assert.strictEqual(result.save.world.position, positionReference, location.label);
    assert.deepEqual(result.save.world.position, location.position, location.label);
    assert.deepEqual(withoutWorld(result.save), withoutWorld(save), location.label);
  }
});

test("epoch-3 positions on retired pier water and aquarium side pockets move to safe ground", () => {
  const cases = [
    {
      label: "retired pier end",
      position: { x: 20.5, y: 26.8 },
      expected: ELVERSON_TOWN_SAFE_POSITIONS.pierEnd,
      reason: "pier-end",
    },
    {
      label: "aquarium west side pocket",
      position: { x: 23, y: 20 },
      expected: ELVERSON_TOWN_SAFE_POSITIONS.aquariumExterior,
      reason: "aquarium-front-apron",
    },
    {
      label: "aquarium east side pocket",
      position: { x: 30, y: 20 },
      expected: ELVERSON_TOWN_SAFE_POSITIONS.aquariumExterior,
      reason: "aquarium-front-apron",
    },
  ];

  for (const { label, position, expected, reason } of cases) {
    const save = expandedWaterfrontSaveAt(position);
    const before = structuredClone(save);
    const result = migrateElversonLayout(save);

    assert.equal(result.migrated, true, label);
    assert.equal(result.reason, reason, label);
    assert.equal(result.save.world.layoutVersion, ELVERSON_TOWN_LAYOUT_VERSION, label);
    assert.deepEqual(result.save.world.position, expected, label);
    assert.deepEqual(withoutWorld(result.save), withoutWorld(save), label);
    assert.deepEqual(save, before, `${label} must not mutate the epoch-3 save`);
  }
});

test("epoch-3 migration preserves coordinates that remain on current walkable ground", () => {
  const positions = [
    { x: 5, y: 5 },
    { x: 15, y: 20 },
    { x: 20.5, y: 25 },
    { x: 27, y: 23.2 },
  ];

  for (const position of positions) {
    const save = expandedWaterfrontSaveAt(position);
    const positionReference = save.world.position;
    const result = migrateElversonLayout(save);

    assert.equal(result.migrated, true);
    assert.equal(result.reason, "coordinate-epoch-updated");
    assert.equal(result.save.world.layoutVersion, ELVERSON_TOWN_LAYOUT_VERSION);
    assert.strictEqual(result.save.world.position, positionReference);
    assert.deepEqual(result.save.world.position, position);
  }
});

test("a current save is an identity-preserving no-op and repeated migration is idempotent", () => {
  const legacy = legacySaveAt({ x: 14, y: 10 });
  const migrated = migrateElversonLayout(legacy);
  const repeated = migrateElversonLayout(migrated.save);

  assert.equal(repeated.migrated, false);
  assert.equal(repeated.reason, null);
  assert.strictEqual(repeated.save, migrated.save);

  const current = legacySaveAt(ELVERSON_TOWN_SAFE_POSITIONS.townStart);
  current.world.layoutVersion = ELVERSON_TOWN_LAYOUT_VERSION;
  const noOp = migrateElversonLayout(current);
  assert.deepEqual(noOp, { save: current, migrated: false, reason: null });
  assert.strictEqual(noOp.save, current);
});

test("layout migration rejects invalid saves, world state, epochs, and exterior coordinates", () => {
  for (const value of [null, undefined, "save", 3, []]) {
    assert.throws(
      () => migrateElversonLayout(value),
      { name: "TypeError", message: "Elverson layout migration requires a save object." },
    );
  }

  for (const value of [{}, { world: null }, { world: [] }, { world: "town" }]) {
    assert.throws(
      () => migrateElversonLayout(value),
      { name: "TypeError", message: "Elverson layout migration requires world state." },
    );
  }

  for (const layoutVersion of [undefined, null, 0, -1, ELVERSON_TOWN_LAYOUT_VERSION + 1, "1"] ) {
    assert.throws(
      () => migrateElversonLayout({ world: { layoutVersion } }),
      { name: "RangeError", message: `Unsupported Elverson layout version: ${String(layoutVersion)}.` },
    );
  }

  for (const position of [null, {}, { x: 1 }, { x: 1, y: Number.NaN }, { x: Infinity, y: 2 }]) {
    assert.throws(
      () => mapLegacyElversonTownPosition(position),
      { name: "TypeError", message: "Legacy Elverson migration requires a finite position." },
    );
  }

  const invalidTownSave = legacySaveAt({ x: 1, y: 2 });
  invalidTownSave.world.position = { x: Number.NaN, y: 2 };
  assert.throws(
    () => migrateElversonLayout(invalidTownSave),
    { name: "TypeError", message: "Legacy Elverson migration requires a finite position." },
  );

  const invalidWideSeawallSave = wideSeawallSaveAt({ x: 1, y: 2 });
  invalidWideSeawallSave.world.position = { x: 1, y: Number.NaN };
  assert.throws(
    () => migrateElversonLayout(invalidWideSeawallSave),
    { name: "TypeError", message: "Wide-seawall Elverson migration requires a finite position." },
  );

  const invalidExpandedWaterfrontSave = expandedWaterfrontSaveAt({ x: 1, y: 2 });
  invalidExpandedWaterfrontSave.world.position = { x: Infinity, y: 2 };
  assert.throws(
    () => migrateElversonLayout(invalidExpandedWaterfrontSave),
    { name: "TypeError", message: "Expanded-waterfront Elverson migration requires a finite position." },
  );
});
