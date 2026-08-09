import assert from "node:assert/strict";
import test from "node:test";
import {
  AQUARIUM_ECOSYSTEM_IDS,
  AQUARIUM_TANK_KINDS,
  ELVERSON_AQUARIUM_ECOSYSTEMS,
  ELVERSON_AQUARIUM_EXHIBITS,
  ELVERSON_AQUARIUM_SCENE_ID,
  ELVERSON_AQUARIUM_SPECIES,
  ELVERSON_AQUARIUM_SPECIES_BY_ID,
  ELVERSON_AQUARIUM_TANKS,
  ELVERSON_REEF_CREATURE_ATLAS_PATH,
  getElversonAquariumExhibitIdForCreature,
  getElversonAquariumExhibitModel,
  getElversonAquariumTankIdForCreature,
} from "./adventureAquariumExhibits.mjs";
import { ELVERSON_REEF_CATCHES } from "./adventureFishing.mjs";
import { createInitialAdventureSave } from "./adventureProgression.mjs";

function withInventory({ storyItems = {}, cards = {} } = {}) {
  const save = createInitialAdventureSave("aquarium-model");
  return {
    ...save,
    inventory: { ...save.inventory, storyItems, cards },
  };
}

test("grand aquarium layout exposes three ecosystems with two scenic tanks each", () => {
  assert.deepEqual(AQUARIUM_ECOSYSTEM_IDS, ["reef", "oceanic", "deep"]);
  assert.deepEqual(AQUARIUM_TANK_KINDS, ["community", "apex"]);
  assert.equal(ELVERSON_AQUARIUM_ECOSYSTEMS, ELVERSON_AQUARIUM_EXHIBITS);
  assert.equal(ELVERSON_AQUARIUM_EXHIBITS.length, 3);
  assert.equal(ELVERSON_AQUARIUM_TANKS.length, 6);

  const tankIds = ELVERSON_AQUARIUM_EXHIBITS.flatMap((exhibit) => {
    assert.equal(exhibit.tanks.length, 2);
    assert.deepEqual(exhibit.tanks.map((tank) => tank.tankKind), ["community", "apex"]);
    assert.ok(exhibit.bounds.width > 0 && exhibit.bounds.height > 0);
    return exhibit.tanks.map((tank) => tank.id);
  });
  assert.deepEqual(tankIds, [
    "reef-community",
    "reef-apex",
    "oceanic-community",
    "oceanic-apex",
    "deep-community",
    "deep-apex",
  ]);
  assert.equal(new Set(tankIds).size, 6);

  for (const tank of ELVERSON_AQUARIUM_TANKS) {
    const expectedPath = `/images/adventure/aquarium-${tank.id}-v1.webp`;
    assert.equal(tank.backgroundPath, expectedPath);
    assert.equal(tank.spectatorView.backgroundPath, expectedPath);
    assert.equal(tank.spectatorView.title, tank.name);
    assert.equal(tank.spectatorView.subtitle, tank.subtitle);
    assert.ok(tank.emptyMessage.length > 0);
    assert.ok(tank.ecosystemName.length > 0);
  }
});

test("explicit species registry assigns every current catch to Reef community exactly once", () => {
  assert.equal(ELVERSON_AQUARIUM_SPECIES.length, ELVERSON_REEF_CATCHES.length);
  assert.equal(Object.keys(ELVERSON_AQUARIUM_SPECIES_BY_ID).length, ELVERSON_REEF_CATCHES.length);
  assert.deepEqual(
    new Set(ELVERSON_AQUARIUM_SPECIES.map((species) => species.id)),
    new Set(ELVERSON_REEF_CATCHES.map((creature) => creature.id)),
  );

  for (const creature of ELVERSON_REEF_CATCHES) {
    const species = ELVERSON_AQUARIUM_SPECIES_BY_ID[creature.id];
    assert.equal(species.cardId, creature.cardId);
    assert.equal(species.category, creature.category);
    assert.equal(species.aquariumItemId, creature.aquariumItemId);
    assert.equal(species.ecosystemId, "reef");
    assert.equal(species.tankKind, "community");
    assert.equal(species.tankId, "reef-community");
    assert.equal(species.sprite.path, ELVERSON_REEF_CREATURE_ATLAS_PATH);
    assert.ok(Number.isInteger(species.sprite.cell.column));
    assert.ok(Number.isInteger(species.sprite.cell.row));
    assert.equal(getElversonAquariumExhibitIdForCreature(creature.id), "reef");
    assert.equal(getElversonAquariumTankIdForCreature(creature.id), "reef-community");
  }
  assert.equal(getElversonAquariumExhibitIdForCreature("unknown"), null);
  assert.equal(getElversonAquariumTankIdForCreature("unknown"), null);
});

test("species registry authors biologically distinct aquarium display sizes", () => {
  assert.deepEqual(
    Object.fromEntries(ELVERSON_AQUARIUM_SPECIES.map((species) => [
      species.id,
      species.displaySize,
    ])),
    {
      "white-grunt": { referenceInches: 17, measurement: "length", biologicalScale: 0.88 },
      "cleaner-wrasse": { referenceInches: 2, measurement: "length", biologicalScale: 0.24 },
      clownfish: { referenceInches: 4, measurement: "length", biologicalScale: 0.34 },
      "emerald-crab": {
        referenceInches: 1.5,
        measurement: "carapace-width",
        biologicalScale: 0.22,
      },
      "blue-tang": { referenceInches: 15, measurement: "length", biologicalScale: 0.82 },
      "sea-urchin": {
        referenceInches: 12,
        measurement: "spine-diameter",
        biologicalScale: 0.68,
      },
      "fairy-parrotfish": { referenceInches: 30, measurement: "length", biologicalScale: 1.35 },
      "blue-crab": {
        referenceInches: 9,
        measurement: "carapace-width",
        biologicalScale: 0.58,
      },
      "spanish-hogfish": { referenceInches: 16, measurement: "length", biologicalScale: 0.86 },
      "french-angelfish": { referenceInches: 24, measurement: "length", biologicalScale: 1.1 },
    },
  );
  assert.ok(ELVERSON_AQUARIUM_SPECIES.every((species) => Object.isFrozen(species.displaySize)));
});

test("empty aquarium exposes all six tanks without inventing residents or completion", () => {
  const model = getElversonAquariumExhibitModel(withInventory());
  assert.equal(model.sceneId, ELVERSON_AQUARIUM_SCENE_ID);
  assert.equal(model.atlasPath, ELVERSON_REEF_CREATURE_ATLAS_PATH);
  assert.equal(model.exhibitCount, 3);
  assert.equal(model.tankCount, 6);
  assert.equal(model.exhibits.length, 3);
  assert.equal(model.tanks.length, 6);
  assert.equal(model.representedSpeciesCount, 0);
  assert.equal(model.deliveredCreatureCount, 0);
  assert.equal(model.populatedExhibitCount, 0);
  assert.equal(model.populatedTankCount, 0);
  assert.equal(model.complete, false);
  assert.ok(model.tanks.every((tank) => (
    tank.populated === false
    && tank.occupants.length === 0
    && tank.deliveredCreatureCount === 0
    && tank.backgroundPath === tank.spectatorView.backgroundPath
  )));
});

test("only positive delivered story-item quantities populate residents", () => {
  const model = getElversonAquariumExhibitModel(withInventory({
    storyItems: {
      "caught-white-grunt": 4,
      "aquarium-cleaner-wrasse": 2,
      "aquarium-emerald-crab": 1,
      "aquarium-not-a-registered-species": 9,
    },
    // Owning a creature card is intentionally unrelated to aquarium care.
    cards: { "white-grunt": 99, "great-white": 1 },
  }));

  assert.equal(model.representedSpeciesCount, 2);
  assert.equal(model.deliveredCreatureCount, 3);
  assert.equal(model.populatedExhibitCount, 1);
  assert.equal(model.populatedTankCount, 1);
  const reefCommunity = model.tanks.find((tank) => tank.id === "reef-community");
  assert.deepEqual(
    reefCommunity.occupants.map((occupant) => occupant.id),
    ["cleaner-wrasse", "emerald-crab"],
  );
  assert.deepEqual(reefCommunity.occupants.map((occupant) => occupant.quantity), [2, 1]);
  assert.ok(model.tanks.filter((tank) => tank.id !== "reef-community").every((tank) => (
    tank.populated === false && tank.occupants.length === 0
  )));
});

test("resident size, motion, position, and depth coloration are deterministic and bounded", () => {
  const save = withInventory({
    storyItems: {
      "aquarium-white-grunt": 1,
      "aquarium-cleaner-wrasse": 2,
      "aquarium-blue-tang": 1,
      "aquarium-blue-crab": 1,
    },
  });
  const first = getElversonAquariumExhibitModel(save);
  const second = getElversonAquariumExhibitModel(save);
  assert.deepEqual(first, second);

  const occupants = first.tanks.flatMap((tank) => tank.occupants);
  const depths = occupants.map((occupant) => occupant.depth);
  assert.equal(Math.max(...depths) - Math.min(...depths), 0.72);
  assert.equal(new Set(depths).size, occupants.length);

  for (const occupant of occupants) {
    assert.ok(occupant.depth >= 0.14 && occupant.depth <= 0.86);
    assert.ok(occupant.visual.biologicalScale >= 0.22 && occupant.visual.biologicalScale <= 1.35);
    assert.ok(occupant.visual.depthScale >= 0.55 && occupant.visual.depthScale <= 1.01);
    assert.ok(occupant.visual.scale >= 0.12 && occupant.visual.scale <= 1.37);
    assert.ok(occupant.visual.opacity >= 0.8 && occupant.visual.opacity <= 1);
    assert.ok(occupant.visual.brightness >= 0.7 && occupant.visual.brightness <= 1.1);
    assert.ok(occupant.visual.saturation >= 0.6 && occupant.visual.saturation <= 1.1);
    assert.ok(occupant.visual.hueRotate >= 0 && occupant.visual.hueRotate <= 13);
    assert.ok(occupant.visual.blur >= 0 && occupant.visual.blur <= 0.7);
    assert.ok(Number.isInteger(occupant.visual.zIndex));
    assert.ok(occupant.visual.zIndex >= 20 && occupant.visual.zIndex <= 80);
    assert.equal(occupant.displaySize, ELVERSON_AQUARIUM_SPECIES_BY_ID[occupant.id].displaySize);
    assert.equal(occupant.biologicalScale, occupant.displaySize.biologicalScale);
    assert.equal(occupant.biologicalScale, occupant.visual.biologicalScale);
    assert.equal(occupant.depthScale, occupant.visual.depthScale);
    assert.equal(
      occupant.scale,
      Math.round(occupant.biologicalScale * occupant.depthScale * 1000) / 1000,
    );
    assert.equal(occupant.scale, occupant.visual.scale);
    assert.equal(occupant.opacity, occupant.visual.opacity);
    assert.equal(occupant.color.brightness, occupant.visual.brightness);
    assert.equal(occupant.color.saturation, occupant.visual.saturation);
    assert.ok(occupant.color.cyanTint >= 0 && occupant.color.cyanTint <= 0.4);
    assert.ok([0, 1, 2].includes(occupant.animation.lane));
    assert.ok([-1, 1].includes(occupant.animation.direction));
    assert.ok(occupant.animation.delaySeconds >= -12 && occupant.animation.delaySeconds <= 0);
    assert.ok(occupant.animation.durationSeconds >= 9 && occupant.animation.durationSeconds <= 20);
    assert.ok(occupant.animation.startX >= 8 && occupant.animation.startX <= 92);
    assert.ok(occupant.animation.startY >= 14 && occupant.animation.startY <= 82);
  }

  const nearest = occupants.toSorted((left, right) => left.depth - right.depth)[0];
  const farthest = occupants.toSorted((left, right) => right.depth - left.depth)[0];
  assert.ok(nearest.visual.opacity > farthest.visual.opacity);
  assert.ok(nearest.visual.brightness > farthest.visual.brightness);
  assert.ok(nearest.visual.saturation > farthest.visual.saturation);
  assert.ok(nearest.visual.hueRotate < farthest.visual.hueRotate);
  assert.ok(nearest.visual.blur < farthest.visual.blur);
  assert.ok(nearest.visual.zIndex > farthest.visual.zIndex);
});

test("completion follows the requested species set, not inactive future tanks or quantities", () => {
  const allDelivered = Object.fromEntries(
    ELVERSON_AQUARIUM_SPECIES.map((species, index) => [
      species.aquariumItemId,
      index === 0 ? 3 : 1,
    ]),
  );
  const incompleteItems = { ...allDelivered };
  delete incompleteItems[ELVERSON_AQUARIUM_SPECIES.at(-1).aquariumItemId];

  const incomplete = getElversonAquariumExhibitModel(withInventory({ storyItems: incompleteItems }));
  assert.equal(incomplete.representedSpeciesCount, ELVERSON_AQUARIUM_SPECIES.length - 1);
  assert.equal(incomplete.complete, false);

  const complete = getElversonAquariumExhibitModel(withInventory({ storyItems: allDelivered }));
  assert.equal(complete.representedSpeciesCount, ELVERSON_AQUARIUM_SPECIES.length);
  assert.equal(complete.requestedSpeciesCount, ELVERSON_AQUARIUM_SPECIES.length);
  assert.equal(complete.deliveredCreatureCount, ELVERSON_AQUARIUM_SPECIES.length + 2);
  assert.equal(complete.complete, true);

  const reefCommunity = complete.tanks.find((tank) => tank.id === "reef-community");
  const reefApex = complete.tanks.find((tank) => tank.id === "reef-apex");
  assert.equal(reefCommunity.complete, true);
  assert.equal(reefCommunity.collectionActive, true);
  assert.equal(reefApex.complete, false);
  assert.equal(reefApex.collectionActive, false);
  assert.equal(complete.exhibits.find((exhibit) => exhibit.id === "reef").complete, true);
  assert.ok(complete.exhibits.filter((exhibit) => exhibit.id !== "reef").every((exhibit) => (
    exhibit.complete === false && exhibit.collectionActive === false
  )));
});
