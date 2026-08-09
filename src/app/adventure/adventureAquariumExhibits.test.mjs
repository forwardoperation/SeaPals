import assert from "node:assert/strict";
import test from "node:test";
import {
  AQUARIUM_BEHAVIOR_CLASSIFICATIONS,
  AQUARIUM_BEHAVIOR_KINDS,
  AQUARIUM_BEHAVIOR_PRESETS,
  AQUARIUM_CHROMIS_BEHAVIOR_PRESET,
  AQUARIUM_ECOSYSTEM_IDS,
  AQUARIUM_MOVEMENT_KINDS,
  AQUARIUM_SOCIAL_FORMATIONS,
  AQUARIUM_TANK_KINDS,
  ELVERSON_AQUARIUM_ECOSYSTEMS,
  ELVERSON_AQUARIUM_EXHIBITS,
  ELVERSON_AQUARIUM_SCENE_ID,
  ELVERSON_AQUARIUM_SPECIES,
  ELVERSON_AQUARIUM_SPECIES_BY_ID,
  ELVERSON_AQUARIUM_TANK_HABITATS,
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
    assert.equal(tank.habitat, ELVERSON_AQUARIUM_TANK_HABITATS[tank.id]);
    assert.equal(tank.habitat.tankId, tank.id);
    assert.ok(Object.isFrozen(tank.habitat));
    assert.ok(Object.isFrozen(tank.habitat.coverPoints));
    assert.ok(Object.isFrozen(tank.habitat.contourPaths));
    assert.ok(Object.isFrozen(tank.habitat.stations));
    assert.ok(Object.isFrozen(tank.habitat.openWaterLanes));
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

test("species registry authors habitat-specific movement profiles", () => {
  assert.deepEqual(AQUARIUM_MOVEMENT_KINDS, [
    "school",
    "coral-home",
    "localized-benthic",
    "anchored",
    "cruiser",
  ]);
  assert.deepEqual(
    Object.fromEntries(ELVERSON_AQUARIUM_SPECIES.map((species) => [
      species.id,
      [
        species.movementProfile.kind,
        species.movementProfile.behaviorKind,
        species.movementProfile.social.formation,
        species.movementProfile.social.visualCount,
        species.movementProfile.habitat.contourPath?.id ?? null,
        species.movementProfile.habitat.station?.id ?? null,
        species.movementProfile.habitat.openWaterLane?.id ?? null,
        species.movementProfile.habitat.coverPoints.map((point) => point.id),
      ],
    ])),
    {
      "white-grunt": [
        "school",
        "shelter-school",
        "loose-school",
        5,
        "reef-community-shelter-loop",
        null,
        "reef-community-central-lane",
        ["reef-community-central-shelter"],
      ],
      "cleaner-wrasse": [
        "coral-home",
        "cleaning-station",
        "solitary",
        1,
        null,
        "reef-community-cleaning-station",
        null,
        [],
      ],
      clownfish: [
        "coral-home",
        "host-bound-pair",
        "pair",
        2,
        null,
        "reef-community-coral-home",
        null,
        [],
      ],
      "emerald-crab": [
        "localized-benthic",
        "cryptic-grazer",
        "solitary",
        1,
        "reef-community-left-rock-crawl",
        null,
        null,
        ["reef-community-left-bottom-rock"],
      ],
      "blue-tang": [
        "school",
        "contour-school",
        "staggered-school",
        4,
        "reef-community-upper-contour",
        null,
        null,
        [],
      ],
      "sea-urchin": [
        "anchored",
        "substrate-grazer",
        "solitary",
        1,
        null,
        "reef-community-urchin-rock",
        null,
        [],
      ],
      "fairy-parrotfish": [
        "cruiser",
        "reef-grazer-solo",
        "solitary",
        1,
        "reef-community-grazer-contour",
        null,
        null,
        [],
      ],
      "blue-crab": [
        "localized-benthic",
        "bottom-scuttler",
        "solitary",
        1,
        "reef-community-right-rock-crawl",
        null,
        null,
        [],
      ],
      "spanish-hogfish": [
        "cruiser",
        "crevice-hunter",
        "solitary",
        1,
        "reef-community-crevice-patrol",
        null,
        null,
        ["reef-community-central-shelter", "reef-community-right-crevice"],
      ],
      "french-angelfish": [
        "cruiser",
        "territorial-pair",
        "pair",
        2,
        "reef-community-territory-loop",
        "reef-community-angel-territory",
        null,
        [],
      ],
    },
  );

  for (const species of ELVERSON_AQUARIUM_SPECIES) {
    const profile = species.movementProfile;
    assert.ok(Object.isFrozen(profile));
    assert.ok(Object.isFrozen(profile.roam));
    assert.ok(Object.isFrozen(profile.amplitude));
    assert.ok(Object.isFrozen(profile.social));
    assert.ok(Object.isFrozen(profile.timing));
    assert.ok(Object.isFrozen(profile.timing.pauseSeconds));
    assert.equal(
      profile.timing.refugeCadenceSeconds === null
        || Object.isFrozen(profile.timing.refugeCadenceSeconds),
      true,
    );
    assert.equal(profile.timing.burstSeconds === null || Object.isFrozen(profile.timing.burstSeconds), true);
    assert.ok(Object.isFrozen(profile.habitat));
    assert.ok(Object.isFrozen(profile.habitat.coverPoints));
    assert.equal(profile.anchor === null || Object.isFrozen(profile.anchor), true);
    assert.ok(Number.isSafeInteger(profile.groupSize) && profile.groupSize >= 1);
    assert.equal(profile.social.visualCount, profile.groupSize);
    assert.ok(AQUARIUM_SOCIAL_FORMATIONS.includes(profile.social.formation));
    assert.equal(AQUARIUM_BEHAVIOR_CLASSIFICATIONS[profile.behaviorKind].movementKind, profile.kind);
    assert.ok(Number.isFinite(profile.speed) && profile.speed >= 0);
    assert.ok(profile.roam.xPercent >= 0 && profile.roam.yPercent >= 0);
    assert.ok(profile.amplitude.xPercent >= 0 && profile.amplitude.yPercent >= 0);
    assert.equal(profile.habitat.tankId, species.tankId);

    const tankHabitat = ELVERSON_AQUARIUM_TANK_HABITATS[species.tankId];
    for (const coverPoint of profile.habitat.coverPoints) {
      assert.ok(tankHabitat.coverPoints.includes(coverPoint));
    }
    if (profile.habitat.contourPath) {
      assert.ok(tankHabitat.contourPaths.includes(profile.habitat.contourPath));
    }
    if (profile.habitat.station) assert.ok(tankHabitat.stations.includes(profile.habitat.station));
    if (profile.habitat.openWaterLane) {
      assert.ok(tankHabitat.openWaterLanes.includes(profile.habitat.openWaterLane));
    }
  }

  const whiteGrunt = ELVERSON_AQUARIUM_SPECIES_BY_ID["white-grunt"].movementProfile;
  const blueTang = ELVERSON_AQUARIUM_SPECIES_BY_ID["blue-tang"].movementProfile;
  assert.ok(whiteGrunt.groupSize >= 3 && whiteGrunt.roam.xPercent < 50);
  assert.ok(whiteGrunt.timing.refugeCadenceSeconds.min >= 10);
  assert.ok(blueTang.groupSize >= 3 && blueTang.roam.xPercent >= 100);
  assert.ok(new Set(blueTang.habitat.contourPath.points.map((point) => point.yPercent)).size > 3);

  const cleanerWrasse = ELVERSON_AQUARIUM_SPECIES_BY_ID["cleaner-wrasse"].movementProfile;
  const clownfish = ELVERSON_AQUARIUM_SPECIES_BY_ID.clownfish.movementProfile;
  assert.notEqual(cleanerWrasse.anchor, clownfish.anchor);
  assert.deepEqual(cleanerWrasse.anchor, {
    id: "reef-community-cleaning-station",
    xPercent: 48,
    yPercent: 56,
  });
  assert.deepEqual(cleanerWrasse.timing.pauseSeconds, { min: 2, max: 4 });
  assert.deepEqual(clownfish.anchor, {
    id: "reef-community-coral-home",
    xPercent: 18,
    yPercent: 62,
  });

  const seaUrchin = ELVERSON_AQUARIUM_SPECIES_BY_ID["sea-urchin"].movementProfile;
  assert.ok(seaUrchin.roam.xPercent <= 1 && seaUrchin.roam.yPercent <= 1);
  assert.ok(seaUrchin.speed < 0.1);
  assert.deepEqual(
    ELVERSON_AQUARIUM_SPECIES_BY_ID["fairy-parrotfish"].movementProfile.timing.pauseSeconds,
    { min: 1, max: 3 },
  );
  assert.deepEqual(
    ELVERSON_AQUARIUM_SPECIES_BY_ID["blue-crab"].movementProfile.timing.burstSeconds,
    { min: 0.7, max: 1.2 },
  );
  for (const crabId of ["emerald-crab", "blue-crab"]) {
    const crabPath = ELVERSON_AQUARIUM_SPECIES_BY_ID[crabId].movementProfile.habitat.contourPath;
    const crabXCoordinates = crabPath.points.map((point) => point.xPercent);
    assert.ok(Math.max(...crabXCoordinates) - Math.min(...crabXCoordinates) <= 8);
  }
});

test("behavior catalog includes reusable future chromis and large-tank presets", () => {
  assert.deepEqual(AQUARIUM_BEHAVIOR_KINDS, Object.keys(AQUARIUM_BEHAVIOR_CLASSIFICATIONS));
  assert.ok(AQUARIUM_BEHAVIOR_KINDS.includes("cover-school-ball"));
  assert.ok(AQUARIUM_BEHAVIOR_KINDS.includes("pelagic-apex-glide"));
  assert.ok(AQUARIUM_BEHAVIOR_KINDS.includes("reef-ambush-patrol"));
  assert.ok(AQUARIUM_BEHAVIOR_KINDS.includes("benthic-predator"));
  assert.ok(AQUARIUM_BEHAVIOR_KINDS.includes("filter-feeder-glide"));
  assert.equal(AQUARIUM_CHROMIS_BEHAVIOR_PRESET, AQUARIUM_BEHAVIOR_PRESETS.chromisCoverSchoolBall);
  assert.equal(AQUARIUM_CHROMIS_BEHAVIOR_PRESET.behaviorKind, "cover-school-ball");
  assert.equal(AQUARIUM_CHROMIS_BEHAVIOR_PRESET.social.formation, "compact-ball");
  assert.equal(AQUARIUM_CHROMIS_BEHAVIOR_PRESET.social.visualCount, 5);
  assert.deepEqual(AQUARIUM_CHROMIS_BEHAVIOR_PRESET.timing.refugeCadenceSeconds, {
    min: 24,
    max: 45,
  });
  assert.deepEqual(AQUARIUM_CHROMIS_BEHAVIOR_PRESET.timing.burstSeconds, {
    min: 0.6,
    max: 1,
  });
  assert.deepEqual(AQUARIUM_CHROMIS_BEHAVIOR_PRESET.habitatRefs.coverPointIds, [
    "reef-community-central-shelter",
    "reef-community-right-crevice",
  ]);

  for (const [presetId, preset] of Object.entries(AQUARIUM_BEHAVIOR_PRESETS)) {
    assert.ok(Object.isFrozen(preset), presetId);
    assert.ok(Object.isFrozen(preset.social), presetId);
    assert.ok(Object.isFrozen(preset.timing), presetId);
    assert.equal(
      AQUARIUM_BEHAVIOR_CLASSIFICATIONS[preset.behaviorKind].movementKind,
      preset.kind,
      presetId,
    );
  }

  // A preset is authoring support, not an invented live resident.
  assert.equal(ELVERSON_AQUARIUM_SPECIES_BY_ID.chromis, undefined);
  assert.equal(ELVERSON_AQUARIUM_SPECIES.length, ELVERSON_REEF_CATCHES.length);
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
    assert.equal(
      occupant.movementProfile,
      ELVERSON_AQUARIUM_SPECIES_BY_ID[occupant.id].movementProfile,
    );
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
