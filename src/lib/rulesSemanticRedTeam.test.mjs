import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { CORE_RULES } from "./rulesAssistant.mjs";
import { answerRulesQuestion } from "./rulesEngine.mjs";
import { buildRulesKnowledgeBank } from "./rulesKnowledgeBank.mjs";
import { SIMULATOR_RULES } from "./seapalsRulesKnowledge.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const jiti = createJiti(filename, { fsCache: false });
const { allCards } = jiti(path.resolve(path.dirname(filename), "../data/cards/index.js"));

const rules = buildRulesKnowledgeBank({ cards: allCards, coreRules: CORE_RULES, simulatorRules: SIMULATOR_RULES });
const cardRules = rules.filter((rule) => rule.entity?.type === "card");

function normalize(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function familyName(rule) {
  return rule.title.replace(/\s+(?:—|â€”)\s+(?:Base|Stage \d+)$/i, "");
}

function includesEvery(text, fragments) {
  const normalized = normalize(text);
  return fragments.every((fragment) => normalized.includes(normalize(fragment)));
}

function grade(question, expected) {
  const answer = answerRulesQuestion(question, rules);
  const sourceIds = (answer?.sources ?? []).map((source) => source.id);
  const failures = [];
  if (answer?.kind !== (expected.kind ?? "answer")) failures.push(`kind=${answer?.kind}`);
  if (expected.title && !expected.title.test(answer?.title ?? "")) failures.push(`title=${answer?.title}`);
  if (expected.starts && !new RegExp(`^${expected.starts}\\b`, "i").test(answer?.text ?? "")) failures.push(`does not start ${expected.starts}`);
  if (expected.includes && !includesEvery(answer?.text, expected.includes)) failures.push(`missing ${expected.includes.join(" | ")}`);
  if (expected.sourceIds && !expected.sourceIds.every((id) => sourceIds.includes(id))) failures.push(`sources=${sourceIds.join(",")}`);
  if ((expected.kind ?? "answer") === "answer" && sourceIds.length === 0) failures.push("uncited");
  return { answer, failures, passed: failures.length === 0, question };
}

test("Finn survives a broad semantic red-team interrogation", (t) => {
  const cases = [];
  const add = (question, expected) => cases.push({ question, expected });

  add("what does sd mean?", { includes: ["School Density", "capacity", "commits"], sourceIds: ["glossary:school-density"] });
  add("What if destroying my Creature School leaves me over School Density capacity?", { includes: ["existing creatures stay in play", "cannot play another creature", "restore enough capacity"], sourceIds: ["knowledge:school-density-requirements"] });
  add("what is the difference between rp and vp?", { includes: ["spendable resource", "score toward winning"], sourceIds: ["glossary:rp", "glossary:victory-points"] });
  add("Is there a stage 2 clubfinger coral?", { starts: "No", includes: ["Base", "Stage 1", "Stage 2"], sourceIds: ["card:clubfinger-coral-base", "card:clubfinger-coral-stage-1"] });
  add("do creature schools and corals both go in the foundations deck?", { starts: "Yes", includes: ["Corals", "Creature Schools", "Foundation Deck"], sourceIds: ["knowledge:foundation-and-pals-deck-routing"] });

  const acronymSets = [
    { acronym: "SD", expansion: "School Density", source: "glossary:school-density", extra: "capacity" },
    { acronym: "RP", expansion: "Resource Points", source: "glossary:rp", extra: "cost" },
    { acronym: "VP", expansion: "Victory Points", source: "glossary:victory-points", extra: "winning" },
    { acronym: "HP", expansion: "health", source: "glossary:health", extra: "damage" },
  ];
  const acronymPhrasings = [
    (a) => `What does ${a} mean?`,
    (a) => `What is ${a} short for?`,
    (a) => `Explain ${a} to a new player.`,
    (a) => `I see ${a} on a card—what is it?`,
    (a) => `Define ${a}.`,
    (a) => `${a} means what exactly?`,
  ];
  for (const set of acronymSets) {
    for (const phrase of acronymPhrasings) {
      add(phrase(set.acronym), { includes: [set.expansion, set.extra], sourceIds: [set.source] });
    }
  }

  const comparisons = [
    { left: "RP", right: "VP", includes: ["spendable resource", "score toward winning"], sources: ["glossary:rp", "glossary:victory-points"] },
    { left: "a play cost", right: "a play requirement", includes: ["paid", "satisfied"], sources: ["glossary:cost", "glossary:play-requirements"] },
    { left: "creature class", right: "habitat zone", includes: ["what kind", "which", "zone"], sources: ["glossary:creature-class", "glossary:creature-habitat"] },
    { left: "a Passive ability", right: "an On Play ability", includes: ["enters play", "remains active"], sources: ["glossary:passive-abilities", "glossary:on-play-abilities"] },
    { left: "a round", right: "a turn", includes: ["every player's turn", "part of that round"], sources: ["glossary:round", "glossary:turn"] },
    { left: "the Foundation Deck", right: "the Pals Deck", includes: ["Corals", "Creature Schools", "Support cards"], sources: ["glossary:foundation-deck", "glossary:pals-deck"] },
  ];
  const comparisonPhrasings = [
    (a, b) => `What's the difference between ${a} and ${b}?`,
    (a, b) => `Compare ${a} versus ${b}.`,
    (a, b) => `Are ${a} and ${b} the same thing?`,
    (a, b) => `${a} vs ${b}: explain the distinction.`,
    (a, b) => `How is ${a} different from ${b}?`,
    (a, b) => `New player question: ${a} compared with ${b}?`,
  ];
  for (const pair of comparisons) {
    for (const phrase of comparisonPhrasings) {
      add(phrase(pair.left, pair.right), { includes: pair.includes, sourceIds: pair.sources });
    }
  }

  const stagedFamilies = new Map();
  for (const rule of cardRules.filter((candidate) => candidate.facts?.stageLabel)) {
    const family = familyName(rule);
    const entries = stagedFamilies.get(family) ?? [];
    entries.push(rule);
    stagedFamilies.set(family, entries);
  }
  let familyIndex = 0;
  for (const [family, versions] of [...stagedFamilies.entries()].slice(0, 18)) {
    const labels = versions.map((version) => version.facts.stageLabel);
    const existing = labels.at(-1);
    const missing = ["Stage 3", "Stage 2", "Stage 1"].find((label) => !labels.includes(label));
    const existingQuestion = familyIndex % 2 ? `Was a ${existing} ${family} made?` : `Is there a ${existing} ${family}?`;
    add(existingQuestion, { starts: "Yes", includes: [existing], sourceIds: [versions.at(-1).id] });
    if (missing) {
      const missingQuestion = familyIndex % 2 ? `Does ${family} have a ${missing} card?` : `Is a ${missing} ${family} available?`;
      add(missingQuestion, { starts: "No", includes: [missing], sourceIds: versions.map((version) => version.id) });
    }
    familyIndex += 1;
  }

  const deckCases = [
    { pair: "Corals and Creature Schools", deck: "Foundation Deck", starts: "Yes", includes: ["Corals", "Foundation Deck", "Creature Schools"] },
    { pair: "Support cards and Habitat cards", deck: "Pals Deck", starts: "Yes", includes: ["Support cards", "Habitat cards", "Pals Deck"] },
    { pair: "Corals and Support cards", deck: "Foundation Deck", starts: "No", includes: ["Corals", "Foundation Deck", "Support cards", "Pals Deck"] },
    { pair: "Creature Schools and regular creatures", deck: "Pals Deck", starts: "No", includes: ["Creature Schools", "Foundation Deck", "regular creatures"] },
    { pair: "Conditions and Support cards", deck: "Conditions Deck", starts: "No", includes: ["Conditions", "Conditions Deck", "Support cards", "Pals Deck"] },
    { pair: "Corals and Conditions", deck: "Foundation Deck", starts: "No", includes: ["Corals", "Foundation Deck", "Conditions", "Conditions Deck"] },
  ];
  const deckPhrasings = [
    (pair, deck) => `Do ${pair} both go in the ${deck}?`,
    (pair, deck) => `Are ${pair} each kept in the ${deck}?`,
    (pair, deck) => `Would I put both ${pair} into my ${deck}?`,
    (pair, deck) => `${pair}: do both belong to the ${deck}?`,
    (pair, deck) => `For deck sorting, are ${pair} both ${deck} cards?`,
  ];
  for (const entry of deckCases) {
    for (const phrase of deckPhrasings) {
      add(phrase(entry.pair, entry.deck), { starts: entry.starts, includes: entry.includes, sourceIds: ["knowledge:foundation-and-pals-deck-routing"] });
    }
  }

  const multiFactCards = cardRules
    .filter((rule) => rule.facts.cost !== null && rule.facts.victoryPoints !== null && rule.facts.defense)
    .slice(0, 20);
  for (const [index, rule] of multiFactCards.entries()) {
    add(index % 2
      ? `For ${rule.title}, tell me both its RP cost and VP value.`
      : `How much RP does ${rule.title} cost, and how many VP is it worth?`, {
      includes: [String(rule.facts.cost), "RP", String(rule.facts.victoryPoints), "VP"],
      sourceIds: [rule.id],
    });
    add(index % 2
      ? `What habitat, class, and defense die does ${rule.title} have?`
      : `Give me ${rule.title}'s type and defense in one answer.`, {
      includes: [rule.facts.defense, rule.facts.class || rule.facts.category],
      sourceIds: [rule.id],
    });
  }

  const notationCases = [
    ["What does 1D4 * 10 mean?", ["4-sided", "multiply", "10 through 40"]],
    ["Explain 1 d6 x 10.", ["6-sided", "multiply", "10 through 60"]],
    ["How does 2D6 work?", ["2", "6-sided", "add them together", "2 through 12"]],
    ["What is D8-2 on a card?", ["8-sided", "subtract 2"]],
    ["D10+3 means what?", ["10-sided", "add 3"]],
  ];
  for (const [question, fragments] of notationCases) add(question, { includes: fragments, sourceIds: ["how-to:dice-reference"] });

  const mixedCreatureComparisons = [
    {
      subjects: "a Deep Invertebrate, a Reef Fish, and an Oceanic Apex Predator",
      includes: ["Deep Invertebrate", "Reef Fish", "Oceanic Apex", "habitat", "class"],
    },
    {
      subjects: "a Reef Predator, an Oceanic Fish, and a Deep Filter Feeder",
      includes: ["Reef Predator", "Oceanic Fish", "Deep Filter Feeder", "habitat", "class"],
    },
    {
      subjects: "an Oceanic Invertebrate, a Deep Apex, and a Reef Predator",
      includes: ["Oceanic Invertebrate", "Deep Apex", "Reef Predator", "habitat", "class"],
    },
    {
      subjects: "a Deep Fish, a Reef Invertebrate, and an Oceanic Predator",
      includes: ["Deep Fish", "Reef Invertebrate", "Oceanic Predator", "habitat", "class"],
    },
  ];
  const mixedComparisonPhrasings = [
    (subjects) => `What is the difference between ${subjects}?`,
    (subjects) => `Compare ${subjects}.`,
    (subjects) => `How are ${subjects} different?`,
    (subjects) => `Explain ${subjects} to a new player.`,
    (subjects) => `Do ${subjects} use the same slots and targets?`,
  ];
  for (const comparison of mixedCreatureComparisons) {
    for (const phrase of mixedComparisonPhrasings) {
      add(phrase(comparison.subjects), {
        includes: comparison.includes,
        sourceIds: ["knowledge:comparing-reef-oceanic-and-deep-creatures"],
      });
    }
  }

  const quantityCases = [
    ["How many cards can be in my hand?", ["no fixed hand limit", "Condition"]],
    ["What is the normal maximum hand size?", ["no fixed hand limit", "Condition"]],
    ["Is there a default hand limit?", ["no fixed hand limit", "Condition"]],
    ["Can I hold more than seven cards?", ["Yes", "no fixed hand limit"]],
    ["How many cards am I allowed to keep in hand?", ["no fixed hand limit", "Condition"]],
    ["What happens if Algae Bloom puts me over seven cards?", ["choose", "entire hand", "discard"]],
    ["What is my max RP I can collect?", ["default RP bank cap is 8", "card or Condition"]],
    ["How much RP can I hold at once?", ["default RP bank cap is 8", "above"]],
    ["What is the normal RP cap?", ["default RP bank cap is 8"]],
    ["Can my RP bank go over 8?", ["card or Condition", "above the active cap"]],
    ["How many RP can I collect on my turn?", ["1 RP", "active Foundations", "no single fixed amount", "cap"]],
    ["How much RP do I gain in Collect?", ["1 RP", "active Foundations", "no single fixed amount"]],
    ["Do I always collect the same amount of RP?", ["No", "1 RP", "active Foundations", "cap"]],
    ["Work out my normal RP income for me.", ["1 RP", "active Foundations", "add"]],
  ];
  for (const [question, fragments] of quantityCases) add(question, { includes: fragments });

  const ecoBoostCases = [
    ["Does EcoBoost increase your RP bank max?", "ability:ecoboost"],
    ["Does EcoBoost give me more room for RP?", "ability:ecoboost"],
    ["Is EcoBoost raising the bank cap or giving me RP immediately?", "ability:ecoboost"],
    ["How much can the EcoBoost passive increase my maximum resources?", "ability:ecoboost"],
    ["Does the Eco Boost passive raise max RP?", "ability:eco-boost"],
    ["Explain what Eco Boost changes about my resource bank.", "ability:eco-boost"],
  ];
  for (const [question, sourceId] of ecoBoostCases) {
    add(question, {
      starts: "Yes",
      includes: ["RP bank cap", "+1", "+3", "does not give you RP immediately"],
      sourceIds: [sourceId, "glossary:rp-bank"],
    });
  }

  const coralPlacementPhrasings = [
    "How do I know if a card can be played on a Coral?",
    "Can I place any creature onto a Coral?",
    "What tells me whether a creature fits on my Coral?",
    "How do the slot icons on Coral determine which card I can play?",
    "Does matching the Coral's habitat alone make a creature legal?",
    "When can a card be attached to a Coral?",
    "How can I tell what goes in a Coral creature slot?",
    "What checks decide whether my Fish can go on this Coral?",
    "Can a Predator use any open slot on a Coral?",
    "What is the difference between playing into a Coral slot and upgrading the Coral?",
  ];
  for (const question of coralPlacementPhrasings) {
    add(question, {
      includes: ["open creature slot", "habitat zone", "accepted class", "next stage", "printed text"],
      sourceIds: ["knowledge:habitat-and-class-matching-for-reef-fish-and-deep-slots", "glossary:slots", "glossary:upgrade", "glossary:hosted-cards"],
    });
  }
  add("Can a Reef Shark be played on a Clubfinger Stage 1 Coral?", {
    starts: "No",
    includes: ["Reef Predator", "3 Reef Fish slots", "do not accept", "Reef Predator", "Reef Apex"],
    sourceIds: ["card:reef-shark", "card:clubfinger-coral-stage-1", "knowledge:habitat-and-class-matching-for-reef-fish-and-deep-slots"],
  });

  const speedstrikePhrasings = [
    "What does Speedstrike target?",
    "Who can Speedstrike hit?",
    "Explain every legal target for Speedstrike.",
    "Does Speedstrike target Predators?",
    "Can Speedstrike attack a baitball?",
    "What die and targets does the Speedstrike On Play ability use?",
  ];
  for (const question of speedstrikePhrasings) {
    add(question, {
      includes: ["D6", "Predator", "Creature School", "+2"],
      sourceIds: ["ability:speedstrike", "card:sailfish"],
    });
  }

  const schoolProtectionPhrasings = [
    "How can I better protect my Creature Schools from attacks?",
    "What can I do to keep a baitball alive?",
    "How do I defend my Creature School?",
    "Which current card helps a Creature School survive attacks?",
    "Give me a grounded Creature School protection strategy.",
    "My opponent keeps attacking my baitballs. What can I do?",
  ];
  for (const question of schoolProtectionPhrasings) {
    add(question, {
      includes: ["Ocean Triggerfish", "+30 HP", "does not roll defense"],
      sourceIds: ["card:ocean-triggerfish", "knowledge:creature-schools-and-bait-balls"],
    });
  }

  const attackProcedurePhrasings = [
    "How do I attack my opponent?",
    "Can you walk me through attacking?",
    "What are the steps to make an attack?",
    "How do I resolve an attack from start to finish?",
    "I reached the Attack step. What do I do now?",
    "Explain the normal attack procedure.",
    "How do attacks work in SeaPals?",
    "Tell a new player how to attack.",
  ];
  for (const question of attackProcedurePhrasings) {
    add(question, {
      includes: ["choose a legal target", "attack die", "defense die", "higher", "tie"],
      sourceIds: ["knowledge:how-normal-attacks-resolve"],
    });
  }

  const genericAttackCounts = [2, 3, 4];
  const attackCountPhrasings = [
    (count) => `What does the x${count} mean for an On Play attack?`,
    (count) => `An attack icon says x${count}. What do I do?`,
    (count) => `Does x${count} multiply one roll or make separate attacks?`,
    (count) => `Explain the x${count} beside an attack.` ,
  ];
  for (const count of genericAttackCounts) {
    for (const phrase of attackCountPhrasings) {
      add(phrase(count), {
        includes: [`${["zero", "one", "two", "three", "four"][count]} separate attacks`, "own legal target", "same physical target"],
        sourceIds: ["glossary:attack-count", "knowledge:repeated-attacks"],
      });
    }
  }

  const coralDamagePhrasings = [
    "What card can do the most damage to Coral?",
    "Which card has the highest direct Coral damage?",
    "What is the biggest single printed hit against Coral?",
    "Name the strongest Coral-damaging card in the current card data.",
    "Which SeaPals card hurts an opponent's Coral the most at once?",
    "What is the maximum direct Coral damage printed on one card?",
  ];
  for (const question of coralDamagePhrasings) {
    add(question, {
      includes: ["Great White", "Crushing Jaws", "60 HP"],
      sourceIds: ["card:great-white"],
    });
  }
  add("I upgrade damaged Coral from 10 max HP to 20 max HP. Is its old damage erased?", {
    includes: ["Existing damage", "preserved"],
    sourceIds: ["knowledge:coral-upgrades"],
  });

  const results = cases.map(({ question, expected }) => grade(question, expected));
  const failures = results.filter((result) => !result.passed);
  const passed = results.length - failures.length;
  const accuracy = passed / results.length;
  t.diagnostic(`Semantic red team: ${passed}/${results.length} (${(accuracy * 100).toFixed(1)}%)`);
  for (const failure of failures.slice(0, 30)) {
    t.diagnostic(`${failure.question} -> ${failure.failures.join("; ")} | ${failure.answer?.title}: ${failure.answer?.text}`);
  }

  assert.ok(cases.length >= 150, `Expected at least 150 adversarial questions, got ${cases.length}`);
  assert.ok(accuracy >= 0.95, `Semantic red-team accuracy ${(accuracy * 100).toFixed(1)}% is below A-level`);
});

test("Finn preserves meaning across adversarial follow-up conversations", (t) => {
  const conversations = [
    {
      questions: ["What does RP mean?", "How is that different from VP?"],
      expected: { includes: ["spendable resource", "score toward winning"], sourceIds: ["glossary:rp", "glossary:victory-points"] },
    },
    {
      questions: ["Explain School Density.", "Is that the same as RP?"],
      expected: { includes: ["RP is spent", "commits", "released"], sourceIds: ["glossary:school-density", "glossary:rp"] },
    },
    {
      questions: ["What is a Passive ability?", "How is that different from On Play?"],
      expected: { includes: ["enters play", "remains active"], sourceIds: ["glossary:passive-abilities", "glossary:on-play-abilities"] },
    },
    {
      questions: ["What is a round?", "How is that different from a turn?"],
      expected: { includes: ["every player's turn", "part of that round"], sourceIds: ["glossary:round", "glossary:turn"] },
    },
    {
      questions: ["What is the Foundation Deck?", "How is that different from the Pals Deck?"],
      expected: { includes: ["Corals", "Creature Schools", "Support cards"], sourceIds: ["glossary:foundation-deck", "glossary:pals-deck"] },
    },
    {
      questions: ["Give me the rundown on Great White.", "What are its RP cost and VP value?"],
      expected: { includes: ["8 RP", "8 VP"], sourceIds: ["card:great-white"] },
    },
    {
      questions: ["Tell me about Clubfinger Coral Base.", "Does it have a Stage 2?"],
      expected: { starts: "No", includes: ["Base", "Stage 1", "Stage 2"], sourceIds: ["card:clubfinger-coral-base", "card:clubfinger-coral-stage-1"] },
    },
    {
      questions: ["Tell me about Elkhorn Coral Base.", "Does it have a Stage 2?"],
      expected: { starts: "Yes", includes: ["Stage 2"], sourceIds: ["card:elkhorn-coral-stage-2"] },
    },
    {
      questions: ["Which deck contains Corals?", "Do Creature Schools go there too?"],
      expected: { starts: "Yes", includes: ["Corals", "Creature Schools", "Foundation Deck"], sourceIds: ["knowledge:foundation-and-pals-deck-routing"] },
    },
    {
      questions: ["Which deck contains Corals?", "Do Support cards go there too?"],
      expected: { starts: "No", includes: ["Foundation Deck", "Pals Deck"], sourceIds: ["knowledge:foundation-and-pals-deck-routing"] },
    },
    {
      questions: ["What does 170 SD on Manta Ray mean?", "Do I lose that 170 after I play it?"],
      expected: { starts: "No", includes: ["commits", "available again"], sourceIds: ["glossary:school-density"] },
    },
    {
      questions: ["Explain 1D4 × 10.", "So what is the highest possible result?"],
      expected: { includes: ["40"], sourceIds: ["how-to:dice-reference"] },
    },
  ];

  const failures = [];
  for (const conversation of conversations) {
    let context = {};
    let answer;
    for (const question of conversation.questions) {
      answer = answerRulesQuestion(question, rules, context);
      context = answer?.context ?? context;
    }
    const finalQuestion = conversation.questions.at(-1);
    const expected = conversation.expected;
    const sourceIds = (answer?.sources ?? []).map((source) => source.id);
    const issues = [];
    if (answer?.kind !== "answer") issues.push(`kind=${answer?.kind}`);
    if (expected.starts && !new RegExp(`^${expected.starts}\\b`, "i").test(answer?.text ?? "")) issues.push(`does not start ${expected.starts}`);
    if (!includesEvery(answer?.text, expected.includes)) issues.push(`missing ${expected.includes.join(" | ")}`);
    if (!expected.sourceIds.every((id) => sourceIds.includes(id))) issues.push(`sources=${sourceIds.join(",")}`);
    if (issues.length) failures.push(`${conversation.questions.join(" -> ")} => ${issues.join("; ")} | ${answer?.title}: ${answer?.text}`);
  }

  t.diagnostic(`Follow-up red team: ${conversations.length - failures.length}/${conversations.length}`);
  failures.forEach((failure) => t.diagnostic(failure));
  assert.deepEqual(failures, []);
});
