import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { COMPREHENSION_BENCHMARK } from "../data/rules/comprehensionBenchmark.mjs";
import { CORE_RULES } from "./rulesAssistant.mjs";
import { answerRulesQuestion } from "./rulesEngine.mjs";
import { buildRulesKnowledgeBank } from "./rulesKnowledgeBank.mjs";
import { SIMULATOR_RULES } from "./seapalsRulesKnowledge.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const jiti = createJiti(filename, { fsCache: false });
const { allCards } = jiti(path.resolve(path.dirname(filename), "../data/cards/index.js"));

function gradeQuestion(question, answer) {
  const sourceIds = (answer?.sources ?? []).map((source) => source.id);
  const text = String(answer?.text ?? "").toLowerCase();
  const failures = [];

  if (answer?.kind !== question.expectedKind) {
    failures.push(`kind ${answer?.kind ?? "none"} != ${question.expectedKind}`);
  }

  if (question.expectedKind === "answer") {
    if (sourceIds.length === 0) failures.push("uncited substantive answer");
    if (!(question.expectedSourceAny ?? []).some((sourceId) => sourceIds.includes(sourceId))) {
      failures.push(`unrelated sources; expected one of ${(question.expectedSourceAny ?? []).join(", ")}`);
    }
  }

  for (const fragment of question.textIncludes ?? []) {
    if (!text.includes(String(fragment).toLowerCase())) failures.push(`missing text ${fragment}`);
  }

  for (const source of answer?.sources ?? []) {
    if (source.id?.startsWith("card:") && source.href !== `/gallery#card-${source.id.slice(5)}`) {
      failures.push(`imprecise card link ${source.href}`);
    }
  }

  return { passed: failures.length === 0, failures, sourceIds };
}

test("Finn comprehends 400 independently authored player questions", (t) => {
  const rules = buildRulesKnowledgeBank({
    cards: allCards,
    coreRules: CORE_RULES,
    simulatorRules: SIMULATOR_RULES,
  });
  const contexts = new Map();
  const results = COMPREHENSION_BENCHMARK.map((question) => {
    const context = question.conversationId ? contexts.get(question.conversationId) ?? {} : {};
    const answer = answerRulesQuestion(question.question, rules, context);
    if (question.conversationId) contexts.set(question.conversationId, answer?.context ?? context);
    return { question, answer, ...gradeQuestion(question, answer) };
  });
  const failures = results.filter((result) => !result.passed);
  const basicResults = results.filter((result) => result.question.category === "basic");
  const screenshotRegression = results.find((result) => result.question.id === "basic-001");
  const substantiveAnswers = results.filter((result) => result.question.expectedKind === "answer");
  const uncitedAnswers = substantiveAnswers.filter((result) => !(result.answer?.sources?.length > 0));
  const unrelatedSourceAnswers = substantiveAnswers.filter((result) => {
    const sourceIds = new Set(result.answer?.sources?.map((source) => source.id) ?? []);
    return !result.question.expectedSourceAny.some((sourceId) => sourceIds.has(sourceId));
  });
  const categoryCounts = Object.fromEntries(
    ["basic", "ability", "ambiguity", "distractor", "follow-up"].map((category) => [
      category,
      COMPREHENSION_BENCHMARK.filter((question) => question.category === category).length,
    ]),
  );
  const conversations = Map.groupBy(
    COMPREHENSION_BENCHMARK.filter((question) => question.category === "follow-up"),
    (question) => question.conversationId,
  );
  const passed = results.length - failures.length;
  const accuracy = passed / results.length;
  const categoryResults = Object.fromEntries(Object.keys(categoryCounts).map((category) => {
    const categoryQuestions = results.filter((result) => result.question.category === category);
    return [category, `${categoryQuestions.filter((result) => result.passed).length}/${categoryQuestions.length}`];
  }));

  t.diagnostic(`${passed}/${results.length} passed (${(accuracy * 100).toFixed(1)}%)`);
  t.diagnostic(`categories ${JSON.stringify(categoryResults)}`);
  if (failures.length) {
    t.diagnostic(JSON.stringify(failures.slice(0, 100).map(({ question, answer, failures: reasons, sourceIds }) => ({
      id: question.id,
      question: question.question,
      kind: answer?.kind,
      title: answer?.title,
      sources: sourceIds,
      reasons,
    })), null, 2));
  }

  assert.equal(COMPREHENSION_BENCHMARK.length, 400);
  assert.equal(new Set(COMPREHENSION_BENCHMARK.map((question) => question.id)).size, 400);
  assert.deepEqual(categoryCounts, {
    basic: 200,
    ability: 80,
    ambiguity: 50,
    distractor: 40,
    "follow-up": 30,
  });
  assert.equal(conversations.size, 5);
  for (const [conversationId, turns] of conversations) {
    assert.deepEqual(turns.map((question) => question.turn), [1, 2, 3, 4, 5, 6], `${conversationId} must have six ordered turns.`);
  }
  assert.ok(screenshotRegression?.passed, "The reported Special Rules screenshot regression must pass.");
  assert.equal(basicResults.filter((result) => result.passed).length, 200, "Basic questions require 100% accuracy.");
  assert.deepEqual(uncitedAnswers, [], "Every substantive answer must cite current rules or card data.");
  assert.deepEqual(unrelatedSourceAnswers, [], "Every answer must cite the concept or card actually requested.");
  assert.ok(accuracy >= 0.98, `Expected at least 98%; received ${(accuracy * 100).toFixed(1)}%.`);
});
