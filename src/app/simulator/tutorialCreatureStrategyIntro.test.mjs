import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createGuidedAcademyCardLesson,
  getCreatureGameplayIntroduction,
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
const creatures = allCards.filter((card) => String(card.kind).toLowerCase() === "creature");
const QUANTITY_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "once",
  "twice",
  "thrice",
];

function comparableText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getExactSpecPatterns(card) {
  const patterns = [];
  const cost = Number(card.cost?.rp ?? 0);
  const victoryPoints = Number(card.victoryPoints ?? 0);
  const defense = String(card.defense?.dice ?? "").trim();
  const schoolDensity = Number(card.schoolDensity ?? card.schoolDensityRequirement ?? 0);
  if (cost > 0) patterns.push(new RegExp(`\\b${cost}\\s*RP\\b`, "i"));
  if (victoryPoints > 0) patterns.push(new RegExp(`\\b${victoryPoints}\\s*VP\\b`, "i"));
  if (defense) patterns.push(new RegExp(`\\b${escapeRegExp(defense)}\\b`, "i"));
  if (schoolDensity > 0) {
    patterns.push(new RegExp(`\\b${schoolDensity}\\b[^.!?]{0,24}\\bSchool Density\\b`, "i"));
  }
  return patterns;
}

test("every creature opens with strategy instead of repeating exact printed specs", () => {
  assert.ok(creatures.length > 0, "the production catalog should include creatures");

  for (const card of creatures) {
    const introduction = getCreatureGameplayIntroduction(card);
    const lesson = createGuidedAcademyCardLesson(card);
    assert.ok(lesson, `${card.id} should create a card lesson`);
    assert.equal(
      lesson.segments[0].message,
      introduction,
      `${card.id} should keep its strategic pitch in the opening segment`,
    );
    assert.equal(lesson.segments[0].focus, "name", `${card.id} should begin at its printed name`);
    assert.match(
      introduction,
      /(?:choose|play|use) (?:it|this creature) when\b/i,
      `${card.id} should tell the player when the card supports their game plan`,
    );
    assert.doesNotMatch(
      introduction,
      /\d/,
      `${card.id} should leave all numeric mechanics for the later walkthrough`,
    );

    for (const pattern of getExactSpecPatterns(card)) {
      assert.doesNotMatch(
        introduction,
        pattern,
        `${card.id} should save exact cost, VP, die, and density values for later detail steps`,
      );
    }

    const comparableIntroduction = comparableText(introduction);
    const referenceRules = getTutorialCardReferenceRules(card);
    const printedRuleCopy = referenceRules.map((rule) => rule.text).join(" ");
    for (const quantity of QUANTITY_WORDS) {
      if (!new RegExp(`\\b${quantity}\\b`, "i").test(printedRuleCopy)) continue;
      assert.doesNotMatch(
        introduction,
        new RegExp(`\\b${quantity}\\b`, "i"),
        `${card.id} should leave the printed ${quantity}-item or ${quantity}-attack count for its rule step`,
      );
    }
    for (const rule of referenceRules) {
      const comparableRule = comparableText(rule.text);
      if (comparableRule.length < 24) continue;
      assert.equal(
        comparableIntroduction.includes(comparableRule),
        false,
        `${card.id} should explain the strategic value of ${rule.name || rule.label} instead of copying its full rules text`,
      );
    }
  }
});

test("every creature saves printed mechanics for discrete follow-up steps", () => {
  for (const card of creatures) {
    const lesson = createGuidedAcademyCardLesson(card);
    const cost = Number(card.cost?.rp ?? 0);
    const victoryPoints = Number(card.victoryPoints ?? 0);
    const defense = String(card.defense?.dice ?? "").trim();
    const schoolDensity = Number(card.schoolDensity ?? card.schoolDensityRequirement ?? 0);
    const costSegment = lesson.segments.find((segment) => segment.id === `card:${card.id}:cost`);
    assert.ok(costSegment, `${card.id} should have a dedicated play-cost step`);
    assert.match(
      `${costSegment.title} ${costSegment.message}`,
      new RegExp(`\\b${cost}\\s*RP\\b`, "i"),
      `${card.id} should state its exact RP cost in that step`,
    );

    if (defense) {
      const defenseSegment = lesson.segments.find((segment) => segment.id === `card:${card.id}:defense`);
      assert.ok(defenseSegment, `${card.id} should have a dedicated defense step`);
      assert.match(defenseSegment.message, new RegExp(`\\b${escapeRegExp(defense)}\\b`, "i"));
    }
    if (victoryPoints > 0) {
      const victorySegment = lesson.segments.find((segment) => segment.id === `card:${card.id}:victory-points`);
      assert.ok(victorySegment, `${card.id} should have a dedicated VP step`);
      assert.match(victorySegment.message, new RegExp(`\\b${victoryPoints}\\s*VP\\b`, "i"));
    }
    if (schoolDensity > 0) {
      const densitySegment = lesson.segments.find((segment) => segment.id === `card:${card.id}:school-density`);
      assert.ok(densitySegment, `${card.id} should have a dedicated School Density step`);
      assert.match(
        densitySegment.message,
        new RegExp(`\\b${schoolDensity}\\b[^.!?]{0,24}\\bSchool Density\\b`, "i"),
      );
    }

    const referenceRules = getTutorialCardReferenceRules(card);
    const costIndex = lesson.segments.indexOf(costSegment);
    const ruleSegments = lesson.segments.slice(costIndex + 1, costIndex + 1 + referenceRules.length);
    assert.equal(
      ruleSegments.length,
      referenceRules.length,
      `${card.id} should give every printed rule its own follow-up step`,
    );
    for (const rule of referenceRules) {
      if (rule.label === "Upgrade") continue;
      const comparableRule = comparableText(rule.text);
      assert.ok(
        ruleSegments.some((segment) => comparableText(segment.message).includes(comparableRule)),
        `${card.id} should preserve the exact ${rule.name || rule.label} mechanics in its rule tour`,
      );
    }
  }
});

test("the porcupine fish pitch explains its control role before Crunch and Toxic mechanics", () => {
  const card = creatures.find((candidate) => candidate.id === "porcupine-fish");
  assert.ok(card, "the porcupine fish should exist in the production catalog");
  const lesson = createGuidedAcademyCardLesson(card, { cardClassLabel: "Reef Fish" });
  const introduction = lesson.segments[0].message;

  assert.match(introduction, /Crunch.*Invertebrate/i);
  assert.match(introduction, /search/i, "the pitch should connect Invertebrates to their deck-search role");
  assert.match(introduction, /Toxic.*(?:remove|removal|eat|eaten|consume)/i);
  assert.doesNotMatch(introduction, /\bD4\b|\b1\s*RP\b|\b2\s*(?:RP|VP)\b/i);

  const toxic = lesson.segments.find((segment) => segment.title === "Passive: Toxic");
  const crunch = lesson.segments.find((segment) => segment.title === "Action: Crunch");
  assert.ok(toxic, "Toxic should retain its own rules step");
  assert.ok(crunch, "Crunch should retain its own rules step");
  assert.match(toxic.message, /coin.*tails.*discard the consuming card/i);
  assert.match(crunch.message, /costs 1 RP.*D4.*Invertebrate/i);
});
