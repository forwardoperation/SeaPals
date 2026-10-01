import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { SIMULATOR_V2_LESSONS } from "./simulatorV2Lessons.mjs";

const source = await readFile(new URL("./SimulatorV2KnowledgeCheck.jsx", import.meta.url), "utf8");
const styles = await readFile(new URL("./SimulatorV2KnowledgeCheck.module.css", import.meta.url), "utf8");
const start = source.indexOf("export function evaluateLessonKnowledgeAnswer(");
const end = source.indexOf("\nexport default function", start);
assert.ok(start >= 0 && end > start);
const evaluate = vm.runInNewContext(source.slice(start, end).replace("export function", "function") + "\nevaluateLessonKnowledgeAnswer;");

const check = {
  prompt: "Both dice finish on 4. What happens?",
  correctChoiceId: "defender",
  choices: [
    { id: "attacker", text: "The attack succeeds.", feedback: "The attacker must finish higher than the defender." },
    { id: "defender", text: "The defender stays in play.", feedback: "A tie belongs to the defender." },
  ],
};

test("a wrong answer gives its explanation and a later correct answer succeeds without a penalty", () => {
  const wrong = evaluate(check, "attacker");
  assert.equal(wrong.correct, false);
  assert.equal(wrong.feedback, "The attacker must finish higher than the defender.");
  const retry = evaluate(check, "defender");
  assert.equal(retry.correct, true);
  assert.equal(retry.feedback, "A tie belongs to the defender.");
  assert.equal(retry.choiceId, "defender");
});

test("unknown choices and missing questions never count as a correct answer", () => {
  assert.equal(evaluate(check, "missing"), null);
  assert.equal(evaluate(null, "defender"), null);
});

test("every lesson has an answerable applied question with helpful retry feedback", () => {
  for (const lesson of SIMULATOR_V2_LESSONS) {
    assert.ok(lesson.preVictoryMessage, `${lesson.id} has an exit dialogue before its check`);
    const check = lesson.knowledgeCheck;
    assert.ok(check?.prompt, `${lesson.id} teaches before checking understanding`);
    assert.equal(new Set(check.choices.map(({ id }) => id)).size, check.choices.length);
    assert.equal(check.choices.filter(({ id }) => evaluate(check, id)?.correct).length, 1);
    for (const choice of check.choices) {
      assert.ok(choice.text.trim());
      assert.ok(evaluate(check, choice.id).feedback.length > 30, `${lesson.id}/${choice.id} explains why`);
    }
  }
});

test("answering cannot finish the lesson until the player acknowledges correct feedback", () => {
  const choiceHandler = source.slice(source.indexOf("function chooseAnswer("), source.indexOf("function finishCheck("));
  assert.doesNotMatch(choiceHandler, /onComplete/);
  assert.match(choiceHandler, /current\?\.correct\s*\? current/);
  assert.match(source, /if \(!answer\?\.correct \|\| completedRef\.current\) return;[\s\S]*?completedRef\.current = true;[\s\S]*?onComplete\?\.\(\)/);
  assert.match(source, /answer\?\.correct \? \([\s\S]*?onClick=\{finishCheck\}[\s\S]*?data-v2-knowledge-continue/);
});

test("the question and retry feedback are accessible, and the dialog keeps game shortcuts out", () => {
  assert.match(source, /dialog\.showModal\(\)/);
  assert.match(source, /aria-labelledby=\{titleId\}[\s\S]*?aria-describedby=\{promptId\}/);
  assert.match(source, /role="group" aria-labelledby=\{promptId\}/);
  assert.match(source, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(source, /Try another answer/);
  assert.match(source, /onKeyDown=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(source, /<LessonDialogueMessage[\s\S]*?message=\{check\.prompt\}/);
  assert.match(source, /continueRef\.current\?\.focus/);
  assert.match(source, /previousFocus\.focus/);
});

test("choices and feedback fit small viewports without a fixed overlay footer", () => {
  assert.match(styles, /max-height:\s*calc\(100dvh/);
  assert.match(styles, /overflow-y:\s*auto/);
  assert.match(styles, /\.choices\s*\{[^}]*display:\s*grid/);
  assert.match(styles, /min-height:\s*3rem/);
  assert.doesNotMatch(styles.match(/\.actions\s*\{([^}]*)\}/)?.[1] ?? "", /position:\s*(?:fixed|absolute)/);
});
