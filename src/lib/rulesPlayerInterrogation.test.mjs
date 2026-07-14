import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PLAYER_INTERROGATION } from "../data/rules/playerInterrogation.mjs";
import { CORE_RULES } from "./rulesAssistant.mjs";
import { answerRulesQuestion, inferQuestionTypes, validateAnswerSufficiency } from "./rulesEngine.mjs";
import { buildRulesKnowledgeBank } from "./rulesKnowledgeBank.mjs";
import { SIMULATOR_RULES } from "./seapalsRulesKnowledge.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const jiti = createJiti(filename, { fsCache: false });
const { allCards } = jiti(path.resolve(path.dirname(filename), "../data/cards/index.js"));

function grade(question, answer) {
  const failures = [];
  const text = String(answer?.text ?? "").toLowerCase();
  const sourceIds = (answer?.sources ?? []).map((source) => source.id);
  const inferredType = inferQuestionTypes(question.question)[0];

  if (answer?.kind !== question.expectedKind) failures.push(`kind ${answer?.kind ?? "none"} != ${question.expectedKind}`);
  if (question.expectedKind === "answer") {
    if (!sourceIds.length) failures.push("substantive answer has no citation");
    if (!question.expectedSourceAny.some((sourceId) => sourceIds.includes(sourceId))) {
      failures.push(`source is unrelated; expected one of ${question.expectedSourceAny.join(", ")}`);
    }
    for (const alternatives of question.requiredGroups) {
      if (!alternatives.some((fragment) => text.includes(fragment.toLowerCase()))) {
        failures.push(`missing required idea (${alternatives.join(" OR ")})`);
      }
    }
    const sufficiency = validateAnswerSufficiency(question.question, answer);
    if (!sufficiency.valid) failures.push(`answer contract failed: ${sufficiency.reason}`);
  }
  if (question.expectedKind === "answer" && question.expectedType && inferredType !== question.expectedType) {
    failures.push(`intent ${inferredType} != ${question.expectedType}`);
  }
  for (const source of answer?.sources ?? []) {
    if (source.id?.startsWith("card:") && source.href !== `/gallery#card-${source.id.slice(5)}`) {
      failures.push(`card citation does not link to its exact gallery entry: ${source.href}`);
    }
  }

  return { failures, inferredType, passed: failures.length === 0, sourceIds };
}

test("Finn answers 100 screenshot-style player questions with A-level comprehension", (t) => {
  const rules = buildRulesKnowledgeBank({
    cards: allCards,
    coreRules: CORE_RULES,
    simulatorRules: SIMULATOR_RULES,
  });
  const contexts = new Map();
  const results = PLAYER_INTERROGATION.map((question) => {
    const context = question.conversationId ? contexts.get(question.conversationId) ?? {} : {};
    const response = answerRulesQuestion(question.question, rules, context);
    if (question.conversationId) contexts.set(question.conversationId, response?.context ?? context);
    return { answer: response, question, ...grade(question, response) };
  });
  const failures = results.filter((result) => !result.passed);
  const difficulties = ["basic", "medium", "hard", "safe"];
  const categoryScores = Object.fromEntries(difficulties.map((difficulty) => {
    const group = results.filter((result) => result.question.difficulty === difficulty);
    return [difficulty, { passed: group.filter((result) => result.passed).length, total: group.length }];
  }));
  const passed = results.length - failures.length;
  const percentage = passed / results.length * 100;
  const letter = percentage >= 93 ? "A" : percentage >= 85 ? "B" : percentage >= 75 ? "C" : percentage >= 65 ? "D" : "F";

  t.diagnostic(`Player interrogation: ${passed}/100 (${percentage.toFixed(1)}%), grade ${letter}`);
  t.diagnostic(`Difficulty scores: ${JSON.stringify(categoryScores)}`);
  if (failures.length) {
    t.diagnostic(JSON.stringify(failures.map(({ answer, failures: reasons, inferredType, question, sourceIds }) => ({
      id: question.id,
      difficulty: question.difficulty,
      question: question.question,
      inferredType,
      kind: answer?.kind,
      title: answer?.title,
      sources: sourceIds,
      reasons,
    })), null, 2));
  }

  assert.equal(PLAYER_INTERROGATION.length, 100);
  assert.equal(new Set(PLAYER_INTERROGATION.map((question) => question.id)).size, 100);
  assert.deepEqual(Object.fromEntries(difficulties.map((difficulty) => [
    difficulty,
    PLAYER_INTERROGATION.filter((question) => question.difficulty === difficulty).length,
  ])), { basic: 50, medium: 30, hard: 15, safe: 5 });
  assert.equal(categoryScores.basic.passed, 50, "Basic player questions must be perfect.");
  assert.ok(categoryScores.medium.passed >= 28, "Medium player questions must score at least 93%. ");
  assert.ok(categoryScores.hard.passed >= 14, "Hard player questions must score at least 93%.");
  assert.equal(categoryScores.safe.passed, 5, "Undocumented mechanics must fail safely.");
  assert.ok(percentage >= 93, `Expected an A (93%); received ${percentage.toFixed(1)}%.`);
});
