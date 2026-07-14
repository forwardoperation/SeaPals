import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { ADVERSARIAL_SCENARIOS } from "../data/rules/adversarialScenarios.mjs";
import { CORE_RULES } from "./rulesAssistant.mjs";
import { answerRulesQuestion } from "./rulesEngine.mjs";
import { buildRulesKnowledgeBank } from "./rulesKnowledgeBank.mjs";
import { SIMULATOR_RULES } from "./seapalsRulesKnowledge.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const jiti = createJiti(filename, { fsCache: false });
const { allCards } = jiti(path.resolve(path.dirname(filename), "../data/cards/index.js"));

function gradeScenario(scenario, answer) {
  const sourceIds = (answer?.sources ?? []).map((source) => source.id);
  const expectedKind = scenario.expectedKind ?? "answer";
  const text = String(answer?.text ?? "").toLowerCase();
  const failures = [];
  if (answer?.kind !== expectedKind) failures.push(`kind ${answer?.kind ?? "none"} != ${expectedKind}`);
  for (const sourceId of scenario.expectedSourceIds ?? []) {
    if (!sourceIds.includes(sourceId)) failures.push(`missing source ${sourceId}`);
  }
  for (const fragment of scenario.textIncludes ?? []) {
    if (!text.includes(String(fragment).toLowerCase())) failures.push(`missing text ${fragment}`);
  }
  if (sourceIds.length < Number(scenario.minSources ?? 0)) failures.push(`only ${sourceIds.length} sources`);
  if (answer?.kind === "answer" && sourceIds.length === 0) failures.push("uncited substantive answer");
  for (const source of answer?.sources ?? []) {
    if (source.id?.startsWith("card:") && source.href !== `/gallery#card-${source.id.slice(5)}`) {
      failures.push(`imprecise card link ${source.href}`);
    }
  }
  return { passed: failures.length === 0, failures, sourceIds };
}

test("Finn earns at least 90% on 150 maintained adversarial scenarios", (t) => {
  const rules = buildRulesKnowledgeBank({ cards: allCards, coreRules: CORE_RULES, simulatorRules: SIMULATOR_RULES });
  const contexts = new Map();
  const results = ADVERSARIAL_SCENARIOS.map((scenario) => {
    const context = scenario.conversationId ? contexts.get(scenario.conversationId) ?? {} : {};
    const answer = answerRulesQuestion(scenario.question, rules, context);
    if (scenario.conversationId) contexts.set(scenario.conversationId, answer?.context ?? context);
    return { scenario, answer, ...gradeScenario(scenario, answer) };
  });
  const failures = results.filter((result) => !result.passed);
  const passed = results.length - failures.length;
  const accuracy = passed / results.length;
  const multiRule = ADVERSARIAL_SCENARIOS.filter((scenario) => scenario.tags?.includes("multi-rule"));
  const conversation = ADVERSARIAL_SCENARIOS.filter((scenario) => scenario.tags?.includes("conversation"));
  const conversations = Map.groupBy(conversation, (scenario) => scenario.conversationId);

  t.diagnostic(`${passed}/${results.length} passed (${(accuracy * 100).toFixed(1)}%)`);
  if (failures.length) {
    t.diagnostic(JSON.stringify(failures.slice(0, 20).map(({ scenario, answer, failures: reasons, sourceIds }) => ({
      id: scenario.id,
      question: scenario.question,
      kind: answer?.kind,
      sources: sourceIds,
      reasons,
    })), null, 2));
  }

  assert.equal(ADVERSARIAL_SCENARIOS.length, 150);
  assert.equal(new Set(ADVERSARIAL_SCENARIOS.map((scenario) => scenario.id)).size, 150, "Scenario IDs must be explicit and unique.");
  assert.ok(multiRule.length >= 40, `Expected at least 40 multi-rule interactions; found ${multiRule.length}.`);
  assert.ok(conversation.length >= 30, `Expected at least 30 conversation questions; found ${conversation.length}.`);
  for (const [conversationId, turns] of conversations) {
    assert.ok(turns.length >= 6, `${conversationId} must contain at least six turns.`);
    assert.deepEqual(turns.map((scenario) => scenario.turn), [1, 2, 3, 4, 5, 6]);
  }
  assert.ok(accuracy >= 0.9, `Expected at least 90%; received ${(accuracy * 100).toFixed(1)}%.`);
});
