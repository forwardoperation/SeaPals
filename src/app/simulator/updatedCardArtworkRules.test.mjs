import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { getDarknessShroudDefenseBonus, getNightVisionAttackBonus } from "./combatRules.mjs";
import { parseLegacyAttackText } from "./gameRules.mjs";
import { getHabitatRequirementError } from "./habitatRules.mjs";
import { getEcosystemSchoolDensityCommitted } from "./schoolDensityRules.mjs";
import { getRequiredOceanicPredatorCount } from "./zoneRules.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(filename), "../../..");
const jiti = createJiti(filename, {
  fsCache: false,
  alias: { "@": path.join(projectRoot, "src") },
});
const { cardsById } = jiti(path.join(projectRoot, "src/data/cards/index.js"));
const { getGalleryData } = jiti(path.join(projectRoot, "src/lib/gallery.js"));

const updatedCardIds = [
  "cleaner-shrimp",
  "frogfish",
  "porcupine-fish",
  "lionfish",
  "goliath-grouper",
  "thresher-shark",
  "sperm-whale",
  "killer-whale-oceanic",
  "shortfin-mako-shark",
  "pilot-whale-oceanic",
  "owlfish",
  "fangtooth-fish",
  "humpback-anglerfish",
  "gulper-eel",
  "barrel-eye-fish",
  "pacific-grenadier",
  "viperfish",
  "bristlemouth",
  "swordfish",
];

function parsedAttack(cardId, abilityName = null) {
  const attack = (cardsById[cardId]?.onPlay ?? [])
    .map((ability) => parseLegacyAttackText(ability))
    .find((candidate) => candidate && (!abilityName || candidate.actionName === abilityName));
  assert.ok(attack, `${cardId} should have a parsed ${abilityName ?? "On Play"} attack`);
  return attack;
}

test("all 19 updated cards render their authored artwork in the gallery", async () => {
  const galleryCards = new Map(
    (await getGalleryData()).flatMap((zone) => zone.images).map((entry) => [entry.cardId, entry]),
  );

  for (const cardId of updatedCardIds) {
    const entry = galleryCards.get(cardId);
    assert.ok(entry, `${cardId} should be present in the gallery`);
    assert.equal(entry.hasImage, true, `${cardId} should not render Coming Soon`);
  }

  const expectedArtworkPaths = {
    "cleaner-shrimp": "/images/cards/invertebrates/Reef/Cleaner Shrimp.png",
    "frogfish": "/images/cards/fish/Reef/Frogfish.png",
    "porcupine-fish": "/images/cards/fish/Reef/Porcupinefish.png",
    "gulper-eel": "/images/cards/predator/Deep/gulper-eel.png",
  };
  for (const [cardId, expectedPath] of Object.entries(expectedArtworkPaths)) {
    // Artwork identity is the path; its cache version changes when the image does.
    const artworkUrl = new URL(galleryCards.get(cardId).src, "https://searealm.test");
    assert.equal(decodeURIComponent(artworkUrl.pathname), expectedPath, `${cardId} should use its authored artwork`);
  }
});

test("updated Reef cards preserve their printed targets, immunity, and destinations", () => {
  const { commonName, role, region, length, weight } = cardsById["cleaner-shrimp"].bio;
  assert.deepEqual({ commonName, role, region, length, weight }, {
    commonName: "Cleaner Shrimp",
    role: "Invertebrate",
    region: "Indo-Pacific",
    length: "1.7”",
    weight: "~2.2g",
  });

  const frogfish = cardsById.frogfish;
  assert.equal(frogfish.passives[0].effect.ignoredEffectType, "toxicWhenEaten");
  assert.deepEqual(frogfish.onPlay[0].effects[0].target.categories, ["fish", "invertebrate"]);

  const porcupine = cardsById["porcupine-fish"];
  assert.deepEqual(porcupine.actions[0].effect.target.categories, ["invertebrate"]);
  assert.equal(porcupine.actions[0].cooldown.duration, "yourNextTurn");

  const goliath = cardsById["goliath-grouper"];
  assert.equal(goliath.bio.region, "Atlantic");
  assert.deepEqual(goliath.playRequirements, []);
  assert.equal(goliath.passives[0].effect.ignoredEffectType, "toxicWhenEaten");
  assert.equal(goliath.onPlay[0].name, "Ambush Hunt");
  assert.deepEqual(goliath.onPlay[0].effects[0].target.categories, ["fish", "invertebrate"]);

  const lionfish = cardsById.lionfish;
  assert.equal(lionfish.destroyedDestination, "lost-zone");
  assert.match(lionfish.passives.find((passive) => passive.id === "invader")?.text ?? "", /D4 attack/);
  assert.match(lionfish.specialRules.join(" "), /Lost Zone/i);
});

test("updated Oceanic Apex requirements and attacks match the printed icons", () => {
  for (const cardId of ["shortfin-mako-shark", "killer-whale-oceanic"]) {
    const card = cardsById[cardId];
    assert.equal(getRequiredOceanicPredatorCount(card), 2);
    assert.match(card.playRequirements.join(" "), /Open Ocean/i);
    assert.doesNotMatch(card.specialRules.join(" "), /discard one Oceanic Predator/i);
    assert.equal(card.destroyedDestination, "lost-zone");
  }

  const shortfin = parsedAttack("shortfin-mako-shark", "Breach Strike");
  assert.equal(cardsById["shortfin-mako-shark"].name, "Shortfin Mako");
  assert.equal(shortfin.attackDice, "D8+5");
  assert.equal(shortfin.repeat, 2);
  assert.deepEqual(shortfin.target.categories, ["apex", "predator", "fish"]);

  for (const cardId of ["sperm-whale", "pilot-whale-oceanic"]) {
    assert.deepEqual(
      [...parsedAttack(cardId, "Deep Hunt").target.categories].sort(),
      ["apex", "filter-feeder", "fish", "predator"],
    );
  }

  assert.deepEqual(
    [...parsedAttack("killer-whale-oceanic", "Apex Hunter").target.categories].sort(),
    ["apex", "filter-feeder", "predator"],
  );

  const swordfish = cardsById.swordfish;
  assert.equal(swordfish.destroyedDestination, "lost-zone");
  assert.equal(getNightVisionAttackBonus(swordfish, { name: "Deep Sea Skate" }), 3);
  assert.equal(getNightVisionAttackBonus(swordfish, { name: "Fangtooth Fish", zone: "deep" }), 0);

  assert.equal(cardsById["pilot-whale-oceanic"].prerelease, false);
  assert.equal(cardsById["killer-whale-oceanic"].prerelease, true);
  assert.equal(cardsById["thresher-shark"].prerelease, false);
});

test("Deep whale artwork controls simulator classification, stats, and Abyss entry requirements", () => {
  for (const cardId of ["sperm-whale", "pilot-whale-oceanic"]) {
    const card = cardsById[cardId];
    assert.equal(card.zone, "deep");
    assert.equal(card.subtype, null);
    assert.ok(card.tags.includes("deep"));
    assert.ok(!card.tags.includes("oceanic"));
    assert.equal(card.set.id, "deep");
    assert.equal(card.cost.rp, 9);
    assert.equal(card.victoryPoints, 9);
    assert.equal(card.defense.dice, "D20");
    assert.equal(card.destroyedDestination, "lost-zone");
    assert.equal(getRequiredOceanicPredatorCount(card), 0);
    assert.equal(getHabitatRequirementError(card, ["abyss"]), "");
    assert.match(getHabitatRequirementError(card, []), /requires Abyss/);
    assert.match(getHabitatRequirementError(card, ["open-ocean"]), /requires Abyss/);
    assert.equal(parsedAttack(cardId, "Deep Hunt").attackDice, "D12");
    assert.equal(parsedAttack(cardId, "Deep Hunt").repeat, 2);
  }
});

test("updated Deep Fish attacks use the generic family icons", () => {
  for (const cardId of ["owlfish", "fangtooth-fish", "humpback-anglerfish", "viperfish"]) {
    const attack = parsedAttack(cardId);
    assert.equal(attack.targetZone, null);
    assert.deepEqual(attack.target.categories, ["fish"]);
  }

  const pacific = cardsById["pacific-grenadier"];
  assert.equal(pacific.defense.dice, "D6-2");
  assert.match(pacific.passives.join(" "), /Darkness Shroud.*\+2 Defense/i);
  assert.deepEqual(parsedAttack("pacific-grenadier").target.categories, ["fish", "invertebrate"]);
});

test("Owlfish matches its revised Darkness Shroud and Snap rules", () => {
  const card = cardsById.owlfish;
  assert.deepEqual(card.passives, ["Darkness Shroud: If Abyss is in play, gain +2 Defense."]);
  assert.equal(getDarknessShroudDefenseBonus(card, []), 0);
  assert.equal(getDarknessShroudDefenseBonus(card, ["abyss"]), 2);
  assert.equal(parsedAttack("owlfish", "Snap").attackDice, "D4");
  assert.deepEqual(parsedAttack("owlfish", "Snap").target.categories, ["fish"]);
  assert.deepEqual(card.actions, []);
});

test("Oceanic Manta Ray is playable with its printed Habitat, density, and loss rules", () => {
  const card = cardsById["oceanic-manta-ray"];
  assert.equal(card.category, "filter-feeder");
  assert.equal(card.zone, "ocean");
  assert.equal(card.cost.rp, 8);
  assert.equal(card.victoryPoints, 10);
  assert.equal(card.defense.dice, "D10");
  assert.equal(card.schoolDensityRequirement, 170);
  assert.equal(getEcosystemSchoolDensityCommitted({
    reefCreatureInstances: [{ instanceId: "manta-1", cardId: card.id }],
  }, cardsById), 170);
  assert.match(card.playRequirements.join(" "), /Requires 170 School Density/);
  assert.equal(getHabitatRequirementError(card, ["open-ocean"]), "");
  assert.match(getHabitatRequirementError(card, ["abyss"]), /requires Open Ocean/);
  assert.equal(card.destroyedDestination, "lost-zone");
  assert.equal(card.prerelease, false);
  assert.match(card.image, /oceanic-manta-ray\.png\?v=[a-f0-9]{12}$/);
});
