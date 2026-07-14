import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { CORE_RULES } from "./rulesAssistant.mjs";
import { createRulesExam, runRulesExam } from "./rulesExam.mjs";
import { buildRulesKnowledgeBank } from "./rulesKnowledgeBank.mjs";
import { SIMULATOR_RULES } from "./seapalsRulesKnowledge.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const jiti = createJiti(filename, { fsCache: false });
const { allCards } = jiti(path.resolve(path.dirname(filename), "../data/cards/index.js"));

test("Finn passes at least 95% of the generated 500-question rules exam", (t) => {
  const rules = buildRulesKnowledgeBank({
    cards: allCards,
    coreRules: CORE_RULES,
    simulatorRules: SIMULATOR_RULES,
  });
  const exam = createRulesExam(rules, 500);
  const report = runRulesExam(exam, rules);
  const coveredSourceIds = new Set(exam.map((question) => question.expectedSourceId).filter(Boolean));
  const missingCardSources = rules
    .filter((rule) => rule.source === "card")
    .map((rule) => rule.id)
    .filter((id) => !coveredSourceIds.has(id));
  const uncitedAnswers = report.results.filter((result) => result.actualKind === "answer" && !result.actualSourceIds.length);

  t.diagnostic(`${report.passed}/${report.total} passed (${(report.accuracy * 100).toFixed(1)}%)`);
  if (report.failed.length) {
    t.diagnostic(JSON.stringify(report.failed.slice(0, 12).map((failure) => ({
      actualKind: failure.actualKind,
      actualSources: failure.actualSourceIds,
      expectedKind: failure.expectedKind,
      expectedSource: failure.expectedSourceId,
      question: failure.question,
    })), null, 2));
  }

  assert.equal(exam.length, 500);
  assert.deepEqual(missingCardSources, [], "Every structured card must appear in the rules exam.");
  assert.deepEqual(uncitedAnswers, [], "Every substantive exam answer must cite a supporting source.");
  assert.ok(report.accuracy >= 0.95, `Expected at least 95% accuracy; received ${(report.accuracy * 100).toFixed(1)}%.`);
});
