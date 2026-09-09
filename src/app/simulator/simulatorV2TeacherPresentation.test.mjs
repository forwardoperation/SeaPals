import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panelSource = await readFile(new URL("./SimulatorV2LessonPanel.jsx", import.meta.url), "utf8");
const styleSource = await readFile(new URL("./SimulatorV2LessonPanel.module.css", import.meta.url), "utf8");

function cssRules(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...styleSource.matchAll(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`, "g"))];
  assert.ok(matches.length, `Missing CSS rule for ${selector}`);
  return matches.map((match) => match[1]);
}

test("Mr. Easterling uses his transparent portrait without a decorative backing plate", () => {
  assert.match(
    panelSource,
    /<div className=\{styles\.coachPortrait\} aria-hidden="true">\s*<TeacherPortrait \/>\s*<\/div>/,
  );
  assert.doesNotMatch(styleSource, /\.coachPortrait::before/);
  assert.doesNotMatch(cssRules(".coachPortrait").join("\n"), /background|clip-path/);
  assert.match(cssRules(".coachPortrait .portrait").join("\n"), /background:\s*transparent/);
});

test("the teacher card stays compact and positionable beside the current board target", () => {
  const coachRule = cssRules(".coach").find((rule) => /position:\s*relative/.test(rule));
  const portraitRule = cssRules(".coachPortrait").find((rule) => /position:\s*absolute/.test(rule));

  assert.ok(coachRule);
  assert.ok(portraitRule);
  assert.match(coachRule, /position:\s*relative/);
  assert.doesNotMatch(coachRule, /position:\s*(?:fixed|absolute)/);
  assert.match(coachRule, /max-width:\s*32rem/);
  assert.match(coachRule, /padding:\s*0 0 1\.2rem 3\.7rem/);
  assert.match(portraitRule, /width:\s*4\.25rem/);
  assert.match(portraitRule, /height:\s*4\.9rem/);
  assert.match(styleSource, /\.coachBubble::before,\s*\.coachBubble::after/);
  assert.match(styleSource, /@media \(max-width: 600px\)[\s\S]*?\.coach \{ max-width: 100%; padding: 0 0 0\.9rem 3rem; \}/);
});
