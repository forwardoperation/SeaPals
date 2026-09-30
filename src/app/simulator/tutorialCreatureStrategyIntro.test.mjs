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
const creatureById = new Map(creatures.map((card) => [card.id, card]));
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

function getProductionCreatureIntroduction(id) {
  const card = creatureById.get(id);
  assert.ok(card, `${id} should exist in the production creature catalog`);
  return getCreatureGameplayIntroduction(card);
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

test("defensive reactions and Toxic Immunity are pitched as survival tools", () => {
  const expectations = [
    ["flying-fish", /Take to the Skies.*incoming attack miss/i],
    ["bluefin-tuna", /Agility.*stop an incoming attack/i],
    ["african-pompano", /Fierce Fighter.*reroll.*successful attack/i],
    ["peacock-squid", /Transparency.*screens out attacks/i],
    ["frogfish", /Toxic Immunity.*hunt Toxic prey.*retaliation/i],
  ];

  for (const [id, pattern] of expectations) {
    const introduction = getCreatureGameplayIntroduction(creatureById.get(id));
    assert.match(introduction, pattern, `${id} should explain its actual defensive strategy`);
    assert.doesNotMatch(
      introduction,
      /(?:Take to the Skies|Agility|Fierce Fighter|Transparency|Toxic Immunity).*proactive way to pressure/i,
      `${id} should not present a defensive rule as an attack`,
    );
  }
});

test("card disruption, Coral pressure, and hand shaping receive distinct strategic pitches", () => {
  assert.match(
    getCreatureGameplayIntroduction(creatureById.get("picasso-triggerfish")),
    /Target.*strips an option.*opponent's hand/i,
  );
  const arrowCrab = getCreatureGameplayIntroduction(creatureById.get("arrow-crab"));
  assert.match(arrowCrab, /Scavenge.*trades spare cards.*specific card/i);
  assert.doesNotMatch(arrowCrab, /Scavenge.*recovers.*spent/i);
  assert.match(
    getCreatureGameplayIntroduction(creatureById.get("fairy-parrotfish")),
    /foundation saboteur.*Eat.*Coral foundations/i,
  );
  assert.match(
    getCreatureGameplayIntroduction(creatureById.get("bottlenose-dolphin")),
    /refills your hand.*targeted pressure.*Echo Locate.*refills your hand/i,
  );
  assert.match(
    getCreatureGameplayIntroduction(creatureById.get("cookie-cutter-shark")),
    /resource thief.*Parasite.*siphons RP/i,
  );
});

test("plural creatures and Coral Reef payoff cards read naturally", () => {
  assert.match(getCreatureGameplayIntroduction(creatureById.get("oysters")), /^The oysters are\b/i);
  assert.match(getCreatureGameplayIntroduction(creatureById.get("spinner-dolphins")), /^The spinner dolphins are\b/i);
  assert.match(
    getCreatureGameplayIntroduction(creatureById.get("french-angelfish")),
    /scoring specialist.*Coral Reef.*extra scoring value/i,
  );
  assert.match(
    getCreatureGameplayIntroduction(creatureById.get("blue-tang")),
    /Habitat-gated scoring.*Coral Reef.*immediate scoring value/i,
  );
});

test("Scavenge pitches preserve each card's actual card-flow role", async (t) => {
  const drawScavengers = ["emerald-crab", "bonito-tuna", "deep-cucumber"];
  for (const id of drawScavengers) {
    await t.test(`${id} draws fresh cards`, () => {
      const introduction = getProductionCreatureIntroduction(id);
      assert.match(introduction, /Scavenge(?=[^.]*\b(?:draw|fresh|new)\w*\b)(?=[^.]*\b(?:cards?|options)\b)/i);
      assert.doesNotMatch(introduction, /Scavenge[^.]*\b(?:recover|return|recycle|specific card)\b/i);
    });
  }

  for (const id of ["blue-crab", "market-squid"]) {
    await t.test(`${id} recovers a discard into hand`, () => {
      const introduction = getProductionCreatureIntroduction(id);
      assert.match(
        introduction,
        /Scavenge(?=[^.]*\b(?:recover|return|move)\w*\b)(?=[^.]*\b(?:discard|spent)\b)(?=[^.]*\bhand\b)/i,
      );
      assert.doesNotMatch(introduction, /Scavenge[^.]*\bdeck\b/i);
    });
  }

  await t.test("arrow-crab trades hand cards for a chosen deck card", () => {
    const introduction = getProductionCreatureIntroduction("arrow-crab");
    assert.match(
      introduction,
      /Scavenge(?=[^.]*\b(?:discard|spare|expendable|trade)\w*\b)(?=[^.]*\b(?:search|specific|needed?)\b)(?=[^.]*\b(?:deck|card)\b)/i,
    );
  });

  await t.test("giant-isopod returns a discard to the deck", () => {
    const introduction = getProductionCreatureIntroduction("giant-isopod");
    assert.match(
      introduction,
      /Scavenge(?=[^.]*\b(?:recover|return|recycle)\w*\b)(?=[^.]*\b(?:discard|spent)\b)(?=[^.]*\bdeck\b)/i,
    );
    assert.doesNotMatch(introduction, /Scavenge[^.]*\bhand\b/i);
  });
});

test("Blue Sea Dragon describes its own Munch attack and defensive Toxic rule", () => {
  const introduction = getProductionCreatureIntroduction("blue-sea-dragon");

  assert.match(introduction, /Munch(?=[^.]*\bInvertebrates?\b)(?=[^.]*\bMan O['’] War\b)/i);
  assert.match(introduction, /Toxic[^.]*(?:incoming attack|targeted|attack fail|deter)/i);
  assert.doesNotMatch(introduction, /Munch[^.]*(?:Coral|RP production)/i);
  assert.doesNotMatch(introduction, /Toxic[^.]*(?:consum|eaten|usual retaliation)/i);
});

test("attached-Coral protection and source-specific Toxic Immunity stay precise", () => {
  const sargeantMajor = getProductionCreatureIntroduction("sargeant-major");
  assert.match(
    sargeantMajor,
    /Coral Protector(?=[^.]*\bCoral\b)(?=[^.]*\b(?:host|attach)\w*\b)(?=[^.]*\b(?:durab|protect|reinforc|harder to destroy)\w*\b)/i,
  );
  assert.doesNotMatch(sargeantMajor, /Coral Protector[^.]*flexible placement/i);

  const giantTriton = getProductionCreatureIntroduction("giant-triton");
  assert.match(giantTriton, /Toxic Immunity[^.]*Crown of Thorns/i);
  assert.doesNotMatch(giantTriton, /Toxic Immunity[^.]*Toxic prey/i);
  assert.doesNotMatch(giantTriton, /Starfish Hunt[^,.]*Starfish[^,.]*(?:Toxic|retaliation)/i);
});

test("one-time and triggered economy effects are not pitched as generic long-term engines", async (t) => {
  await t.test("Crevalle Jack presents Nutrient Rich as an immediate play-time boost", () => {
    const introduction = getProductionCreatureIntroduction("crevalle-jack");
    assert.match(introduction, /Nutrient Rich[^.]*\b(?:immediate|on play|enters play|one-time|burst)\b/i);
    assert.match(introduction, /Nutrient Rich[^.]*\b(?:RP|resource)\b/i);
    assert.doesNotMatch(introduction, /\b(?:long-term|investing early|economy engine)\b/i);
  });

  for (const id of ["krill-bloom-base", "krill-bloom-stage1", "krill-bloom-stage2"]) {
    await t.test(`${id} keeps Plenteous tied to Krill Bloom's destruction recovery`, () => {
      const introduction = getProductionCreatureIntroduction(id);
      const plenteousIndex = introduction.indexOf("Plenteous");
      assert.notEqual(plenteousIndex, -1, "the introduction should explain Plenteous");
      const plenteousPitch = introduction.slice(plenteousIndex);
      assert.match(plenteousPitch, /\b(?:destroyed|falls|removed)\b/i);
      assert.match(plenteousPitch, /\bKrill Bloom\b/i);
      assert.match(plenteousPitch, /\bdiscard\b[^.]*\bdeck\b|\bdeck\b[^.]*\bdiscard\b/i);
      assert.doesNotMatch(plenteousPitch, /recovers value from cards? that (?:has|have) already been spent/i);
    });
  }
});

test("Deep-only attacks retain their zone restriction in the strategic pitch", () => {
  assert.match(
    getProductionCreatureIntroduction("dumbo-octopus"),
    /Hover Strike(?=[^.]*\bDeep Fish\b)(?=[^.]*\bDeep Invertebrates?\b)/i,
  );
  assert.match(
    getProductionCreatureIntroduction("peacock-squid"),
    /Quick Grab[^.]*\bDeep Invertebrates?\b/i,
  );
});

test("conditional attack bonuses name the Habitat that actually enables them", async (t) => {
  const expectations = [
    ["great-barracuda", "Quick Strike", "Coral Reef"],
    ["goliath-grouper", "Ambush Hunt", "Coral Reef"],
    ["blue-shark-oceanic", "Tireless Pursuit", "Open Ocean"],
    ["galapagos-shark", "Frenzied Attack", "Open Ocean"],
    ["pacific-grenadier", "Bite", "Abyss"],
    ["humpback-anglerfish", "Lure", "Abyss"],
    ["chimera", "Bite", "Abyss"],
    ["deep-sea-skate", "Crunch", "Abyss"],
    ["goblin-shark", "Terror Strike", "Abyss"],
  ];

  for (const [id, ability, habitat] of expectations) {
    await t.test(`${id} names ${habitat}`, () => {
      const introduction = getProductionCreatureIntroduction(id);
      assert.match(
        introduction,
        new RegExp(`${escapeRegExp(ability)}[^.]*\\b${escapeRegExp(habitat)}\\b`, "i"),
      );
    });
  }
});

test("ordinary attacks do not make false tempo claims", async (t) => {
  const expectations = [
    ["spanish-hogfish", /Crunch[^.]*\bInvertebrates?\b/i],
    ["mantis-shrimp", /Shatter[^.]*\bInvertebrates?\b/i],
    ["thresher-shark", /Stun Strike[^.]*(?:Apex|Predator|Fish)/i],
    ["loggerhead-sea-turtle", /Ram(?=[^.]*\b(?:creatures?|Invertebrates?)\b)(?=[^.]*\b(?:Coral|foundation)\w*\b)/i],
  ];

  for (const [id, rolePattern] of expectations) {
    await t.test(id, () => {
      const introduction = getProductionCreatureIntroduction(id);
      assert.match(introduction, rolePattern);
      assert.doesNotMatch(
        introduction,
        /tempo attacker|limit(?:s|ing)? (?:the )?opponent['’]s response|constrain(?:s|ing)? (?:the )?opponent/i,
      );
    });
  }
});

test("Giant Tube Worm is pitched as simple board development rather than invented utility", () => {
  const introduction = getProductionCreatureIntroduction("giant-tube-worm");
  assert.match(introduction, /(?:board (?:piece|presence|development)[^.]*scor|scor[^.]*board (?:piece|presence|development))/i);
  assert.doesNotMatch(introduction, /\b(?:utility|flexible)\b/i);
});
