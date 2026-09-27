import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createGuidedAcademyCardLesson,
  getTutorialCardFocusRegion,
  getTutorialCardReferenceRules,
} from "./tutorialCardLessons.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(filename), "../../..");
const jiti = createJiti(filename, {
  fsCache: false,
  alias: { "@": path.join(projectRoot, "src") },
});

const { allCards } = jiti(path.join(projectRoot, "src/data/cards/index.js"));
const cardById = new Map(allCards.map((card) => [card.id, card]));

const EXPECTED_MULTI_RULE_CARD_IDS = [
  "anchovy-ball-stage1",
  "black-marlin",
  "blue-sea-dragon",
  "blue-whale",
  "bluefin-tuna",
  "bottlenose-dolphin",
  "bull-shark",
  "colossal-squid",
  "giant-phantom-jelly",
  "giant-squid",
  "great-white",
  "halfbeak",
  "hammerhead",
  "herring-ball-stage1",
  "humpback-whale",
  "krill-bloom-base",
  "krill-bloom-stage1",
  "lionfish",
  "pilot-whale-oceanic",
  "sardine-ball-stage1",
  "shortfin-mako-shark",
  "silverside-ball-stage1",
  "sperm-whale",
  "swordfish",
  "tiger-shark",
];

function requireCard(cardId) {
  const card = cardById.get(cardId);
  assert.ok(card, `${cardId} should exist in the production catalog`);
  return card;
}

function getRuleTour(card) {
  const referenceRules = getTutorialCardReferenceRules(card);
  const lesson = createGuidedAcademyCardLesson(card);
  assert.ok(lesson, `${card.id} should create a card lesson`);
  const segments = lesson.segments.slice(3, 3 + referenceRules.length);
  assert.equal(
    segments.length,
    referenceRules.length,
    `${card.id} should tour every reference rule`,
  );
  return segments;
}

function getTipPositions(card, segments) {
  return segments.map((segment) => {
    const region = getTutorialCardFocusRegion(segment.focus, card);
    assert.ok(region, `${card.id} ${segment.title} should resolve to a printed arrow region`);
    return [region.tipX, region.tipY];
  });
}

test("every production card with four or more rules keeps every rule cue on the printed card", () => {
  const multiRuleCards = allCards.filter((card) => getTutorialCardReferenceRules(card).length >= 4);
  assert.deepEqual(
    multiRuleCards.map((card) => card.id).sort(),
    EXPECTED_MULTI_RULE_CARD_IDS,
    "the catalog-wide regression should be reviewed when another multi-rule card is added",
  );

  for (const card of multiRuleCards) {
    const segments = getRuleTour(card);
    getTipPositions(card, segments);

    const abilitySegments = segments.filter((segment) => /^(?:Passive|On Play|Action):/.test(segment.title));
    if (abilitySegments.length < 2) continue;
    const abilityTipYs = getTipPositions(card, abilitySegments).map(([, tipY]) => tipY);
    assert.equal(
      new Set(abilityTipYs).size,
      abilityTipYs.length,
      `${card.id} should give each printed ability row its own arrow landing point`,
    );
    assert.ok(
      abilityTipYs.every((tipY, index) => index === 0 || tipY > abilityTipYs[index - 1]),
      `${card.id} should move the arrow down its printed ability list in order`,
    );
  }
});

test("Reef Apex tours share the Special Rules row before stepping through each ability", () => {
  const reefApexIds = [
    "great-white",
    "tiger-shark",
    "hammerhead",
    "bull-shark",
    "bottlenose-dolphin",
  ];

  for (const cardId of reefApexIds) {
    const card = requireCard(cardId);
    const segments = getRuleTour(card);
    assert.deepEqual(
      segments.map((segment) => segment.focus),
      ["rules", "rules", "rules-secondary", "rules-tertiary"],
      `${cardId} should reuse its Special Rules block, then visit both ability rows`,
    );
    assert.deepEqual(
      getTipPositions(card, segments).map(([, tipY]) => tipY),
      [271, 271, 338, 386],
      `${cardId} should follow the printed Reef Apex row spacing`,
    );
  }
});

test("full-art Filter Feeders move from their shared rule block to the lower Passive", () => {
  for (const cardId of ["humpback-whale", "blue-whale"]) {
    const card = requireCard(cardId);
    const segments = getRuleTour(card);
    assert.deepEqual(
      segments.map((segment) => segment.focus),
      ["density-requirement", "rules", "rules", "rules-secondary"],
    );
    assert.deepEqual(
      getTipPositions(card, segments),
      [[324, 45], [55, 65], [55, 65], [14, 152]],
      `${cardId} should point at Massive below its Special Rules block`,
    );
  }
});

test("card-specific tours follow the order printed on Blue Sea Dragon and Giant Phantom Jelly", () => {
  const blueSeaDragon = requireCard("blue-sea-dragon");
  const blueSeaDragonSegments = getRuleTour(blueSeaDragon);
  assert.deepEqual(
    blueSeaDragonSegments.map((segment) => segment.title),
    ["Requirement", "Passive: EcoBoost", "Passive: Toxic", "Action: Munch"],
  );
  assert.deepEqual(
    blueSeaDragonSegments.map((segment) => segment.focus),
    ["density-requirement", "rules", "rules-secondary", "rules-tertiary"],
  );

  const giantPhantomJelly = requireCard("giant-phantom-jelly");
  const giantPhantomJellySegments = getRuleTour(giantPhantomJelly);
  assert.deepEqual(
    giantPhantomJellySegments.map((segment) => segment.title),
    ["Special Rule", "Special Rule", "Action: Cloak in Darkness", "Passive: Phantom Boost"],
  );
  assert.deepEqual(
    giantPhantomJellySegments.map((segment) => segment.focus),
    ["rules", "rules", "rules-secondary", "rules-tertiary"],
  );
});

test("Creature School tours teach the upgrade header before walking down the rule rows", () => {
  const creatureSchoolIds = [
    "sardine-ball-stage1",
    "anchovy-ball-stage1",
    "silverside-ball-stage1",
    "herring-ball-stage1",
    "krill-bloom-base",
    "krill-bloom-stage1",
  ];

  for (const cardId of creatureSchoolIds) {
    const card = requireCard(cardId);
    const segments = getRuleTour(card);
    assert.match(segments[0].title, /^Current stage:/);
    assert.deepEqual(
      segments.map((segment) => segment.focus),
      ["identity", "rules", "rules-secondary", "rules-tertiary"],
      `${cardId} should start at its upgrade header, then move down through every rule row`,
    );
    const tipYs = getTipPositions(card, segments).map(([, tipY]) => tipY);
    assert.ok(
      tipYs.every((tipY, index) => index === 0 || tipY > tipYs[index - 1]),
      `${cardId} should move from the header down the card without jumping back up`,
    );
  }
});
