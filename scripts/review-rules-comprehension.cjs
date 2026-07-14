const path = require("node:path");
const { createJiti } = require("jiti");

function numberFlag(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  return value === undefined ? fallback : Number(value);
}

async function main() {
  const start = numberFlag("start", 0);
  const limit = numberFlag("limit", 50);
  const [{ COMPREHENSION_BENCHMARK }, { CORE_RULES }, { answerRulesQuestion }, { buildRulesKnowledgeBank }, { SIMULATOR_RULES }] = await Promise.all([
    import("../src/data/rules/comprehensionBenchmark.mjs"),
    import("../src/lib/rulesAssistant.mjs"),
    import("../src/lib/rulesEngine.mjs"),
    import("../src/lib/rulesKnowledgeBank.mjs"),
    import("../src/lib/seapalsRulesKnowledge.mjs"),
  ]);
  const jiti = createJiti(__filename, { fsCache: false });
  const { allCards } = jiti(path.resolve(__dirname, "../src/data/cards/index.js"));
  const rules = buildRulesKnowledgeBank({ cards: allCards, coreRules: CORE_RULES, simulatorRules: SIMULATOR_RULES });
  const contexts = new Map();

  COMPREHENSION_BENCHMARK.forEach((question, index) => {
    const context = question.conversationId ? contexts.get(question.conversationId) ?? {} : {};
    const answer = answerRulesQuestion(question.question, rules, context);
    if (question.conversationId) contexts.set(question.conversationId, answer?.context ?? context);
    if (index < start || index >= start + limit) return;
    const sources = (answer?.sources ?? []).map((source) => source.id).join(", ") || "none";
    const text = String(answer?.text ?? "").replace(/\s+/g, " ").trim();
    console.log(`${String(index + 1).padStart(3, "0")} ${question.id} [${answer?.kind ?? "none"}] ${answer?.title ?? "Untitled"}`);
    console.log(`Q: ${question.question}`);
    console.log(`A: ${text}`);
    console.log(`S: ${sources}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
