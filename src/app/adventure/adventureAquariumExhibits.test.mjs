import assert from "node:assert/strict";
import test from "node:test";
import {
  ELVERSON_AQUARIUM_EXHIBITS,
  ELVERSON_AQUARIUM_SCENE_ID,
  ELVERSON_REEF_CREATURE_ATLAS_PATH,
  getElversonAquariumExhibitIdForCreature,
  getElversonAquariumExhibitModel,
} from "./adventureAquariumExhibits.mjs";
import { ELVERSON_REEF_CATCHES } from "./adventureFishing.mjs";
import { createInitialAdventureSave } from "./adventureProgression.mjs";

function withStoryItems(storyItems) {
  const save = createInitialAdventureSave("aquarium-model");
  return {
    ...save,
    inventory: { ...save.inventory, storyItems },
  };
}

test("every Elverson reef species belongs to exactly one care-first exhibit", () => {
  const assigned = ELVERSON_AQUARIUM_EXHIBITS.flatMap((entry) => entry.creatureIds);
  assert.equal(new Set(assigned).size, ELVERSON_REEF_CATCHES.length);
  assert.deepEqual(
    new Set(assigned),
    new Set(ELVERSON_REEF_CATCHES.map((creature) => creature.id)),
  );
  for (const creature of ELVERSON_REEF_CATCHES) {
    assert.ok(getElversonAquariumExhibitIdForCreature(creature.id));
  }
  assert.equal(getElversonAquariumExhibitIdForCreature("unknown"), null);
});

test("empty aquarium exposes stable exhibit geometry without inventing occupants", () => {
  const model = getElversonAquariumExhibitModel(withStoryItems({}));
  assert.equal(model.sceneId, ELVERSON_AQUARIUM_SCENE_ID);
  assert.equal(model.atlasPath, ELVERSON_REEF_CREATURE_ATLAS_PATH);
  assert.equal(model.representedSpeciesCount, 0);
  assert.equal(model.complete, false);
  assert.equal(model.exhibits.length, 3);
  assert.ok(model.exhibits.every((entry) => entry.populated === false && entry.occupants.length === 0));
  assert.ok(model.exhibits.every((entry) => (
    entry.bounds.width > 0 && entry.bounds.height > 0 && entry.emptyMessage.length > 0
  )));
});

test("only delivered aquarium creatures populate animated tank residents", () => {
  const model = getElversonAquariumExhibitModel(withStoryItems({
    "caught-white-grunt": 4,
    "aquarium-cleaner-wrasse": 2,
    "aquarium-emerald-crab": 1,
  }));
  assert.equal(model.representedSpeciesCount, 2);
  const occupants = model.exhibits.flatMap((entry) => entry.occupants);
  assert.deepEqual(occupants.map((entry) => entry.id).sort(), ["cleaner-wrasse", "emerald-crab"]);
  assert.deepEqual(occupants.map((entry) => entry.quantity).sort(), [1, 2]);
  for (const occupant of occupants) {
    assert.ok(Number.isInteger(occupant.atlasCell.column));
    assert.ok(Number.isInteger(occupant.atlasCell.row));
    assert.ok(Number.isFinite(occupant.animation.durationSeconds));
  }
});

test("one delivery of every requested species completes the visible Aquarium set", () => {
  const storyItems = Object.fromEntries(
    ELVERSON_REEF_CATCHES.map((creature) => [creature.aquariumItemId, 1]),
  );
  const model = getElversonAquariumExhibitModel(withStoryItems(storyItems));
  assert.equal(model.representedSpeciesCount, ELVERSON_REEF_CATCHES.length);
  assert.equal(model.requestedSpeciesCount, ELVERSON_REEF_CATCHES.length);
  assert.equal(model.complete, true);
  assert.ok(model.exhibits.every((entry) => entry.populated));
});
