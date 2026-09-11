import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panelSource = await readFile(new URL("./SimulatorV2LessonPanel.jsx", import.meta.url), "utf8");
const styleSource = await readFile(new URL("./SimulatorV2LessonPanel.module.css", import.meta.url), "utf8");
const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

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
  assert.match(coachRule, /pointer-events:\s*none/);
  assert.match(cssRules(".coachBubble").join("\n"), /pointer-events:\s*auto/);
  assert.match(cssRules(".dragPassive .coachBubble").join("\n"), /pointer-events:\s*none/);
  assert.match(
    simulatorSource,
    /function ProfessorGuideCard\(\{[\s\S]*?dragPassive = false,[\s\S]*?<SimulatorV2LessonPanel[\s\S]*?dragPassive=\{dragPassive\}/,
  );
  assert.match(
    panelSource,
    /className=\{`\$\{styles\.coach\}[\s\S]*?\$\{dragPassive \? ` \$\{styles\.dragPassive\}` : ""\}/,
  );
  assert.match(portraitRule, /width:\s*4\.25rem/);
  assert.match(portraitRule, /height:\s*4\.9rem/);
  assert.match(styleSource, /\.coachBubble::before,\s*\.coachBubble::after/);
  assert.match(styleSource, /@media \(max-width: 600px\)[\s\S]*?\.coach \{ max-width: 100%; padding: 0 0 0\.9rem 3rem; \}/);
});

test("drag steps keep the teacher card concise and leave the gesture to the board", () => {
  assert.match(panelSource, /data-v2-lesson-interaction=\{interaction \|\| undefined\}/);
  assert.match(panelSource, /\{explanation \? <details[\s\S]*?<summary>Why\?<\/summary>/);
  assert.match(panelSource, /\{hint \? <details[\s\S]*?<summary>Hint<\/summary>/);
  assert.doesNotMatch(panelSource, /DragInstruction|data-v2-drag-(?:instruction|source|path|destination)/);
  assert.doesNotMatch(styleSource, /\.drag(?:Diagram|Source|Destination|CardStack|CardMotion|Pointer|Slots|Trail|Arrow)\b|@keyframes tutorialCardDrag/);
});

test("Mr. Easterling's message reads like left-to-right dialogue", () => {
  const instructionRule = cssRules(".instruction").join("\n");
  const feedbackRule = cssRules(".feedback").join("\n");

  assert.match(instructionRule, /width:\s*100%/);
  assert.match(instructionRule, /text-align:\s*left/);
  assert.match(instructionRule, /text-wrap:\s*wrap/);
  assert.doesNotMatch(instructionRule, /text-wrap:\s*(?:pretty|balance)/);
  assert.match(feedbackRule, /text-align:\s*left/);
  assert.match(cssRules(".currentMove").join("\n"), /width:\s*100%/);
  assert.match(cssRules(".coachBody").join("\n"), /padding:\s*0\.05rem 0\.9rem 0\.55rem/);
  assert.match(panelSource, /className=\{styles\.advanceButton\}[\s\S]*?<span className=\{styles\.advanceLabel\}>\{advanceLabel\}<\/span>/);
  assert.match(cssRules(".advanceButton").join("\n"), /margin:\s*0\.35rem 0 -0\.18rem auto/);
  assert.match(panelSource, /className=\{styles\.passiveAdvance\}[\s\S]*?className=\{styles\.actionMarker\}/);
  assert.match(cssRules(".passiveAdvance").join("\n"), /justify-content:\s*flex-end/);
});

test("Mr. Easterling's lesson dialogue uses a stable accessible typewriter reveal", () => {
  assert.match(panelSource, /segmentProfessorMessage\(message\)/);
  assert.match(panelSource, /getProfessorSpeechDuration\(graphemes\.length\)/);
  assert.match(panelSource, /getProfessorVisibleGraphemeCount\(\{/);
  assert.match(panelSource, /key=\{dialogueKey\}[\s\S]*?message=\{dialogueMessage\}/);
  assert.match(panelSource, /className=\{styles\.typewriterFrame\} aria-hidden="true"/);
  assert.match(panelSource, /const pendingMessage = graphemes\.slice\(visibleCount\)\.join\(""\)/);
  assert.match(
    panelSource,
    /\{visibleMessage\}[\s\S]*?className=\{styles\.typewriterCursor\}[\s\S]*?className=\{styles\.typewriterPending\}>\{pendingMessage\}/,
  );
  assert.match(panelSource, /className=\{styles\.srOnly\}>\{message\}<\/span>/);
  assert.doesNotMatch(panelSource, /className=\{styles\.currentMove\} aria-live/);
  assert.doesNotMatch(panelSource, /className=\{styles\.srOnly\} role="status"/);
  assert.match(
    simulatorSource,
    /<p className="sr-only" role="status" aria-live="polite" aria-atomic="true">\s*\{tutorialAnnouncement\}/,
  );

  const frameRule = cssRules(".typewriterFrame").join("\n");
  assert.match(frameRule, /display:\s*block/);
  assert.match(frameRule, /white-space:\s*pre-wrap/);
  assert.match(frameRule, /pointer-events:\s*none/);
  const pendingRule = cssRules(".typewriterPending").join("\n");
  const cursorRule = cssRules(".typewriterCursor").join("\n");
  assert.match(pendingRule, /visibility:\s*hidden/);
  assert.doesNotMatch(pendingRule, /display:\s*none/);
  assert.match(cursorRule, /position:\s*absolute/);
  assert.doesNotMatch(styleSource, /\.typewriterMeasure|\.typewriterVisible/);
});

test("lesson dialogue honors motion settings without delaying board actions", () => {
  assert.match(panelSource, /reducedMotion \|\| textSpeed === "instant" \|\| motionPreference\?\.matches/);
  assert.match(panelSource, /window\.matchMedia\?\.\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(panelSource, /window\.requestAnimationFrame\(tick\)/);
  assert.match(panelSource, /window\.cancelAnimationFrame\(animationRef\.current\.frameId\)/);
  assert.match(
    simulatorSource,
    /<SimulatorV2LessonPanel[\s\S]*?messageKey=\{help\.cueId \?\? help\.id\}[\s\S]*?textSpeed=\{guide\.textSpeed\}[\s\S]*?reducedMotion=\{guide\.reducedMotion\}/,
  );
  assert.doesNotMatch(panelSource, /disabled=\{!?isComplete\}|disabled=\{visibleCount/);
  assert.match(cssRules(".dragPassive .coachBubble").join("\n"), /pointer-events:\s*none/);
});

test("blocking teacher checkpoints receive focus and keep keyboard navigation on Continue", () => {
  assert.match(panelSource, /const advanceRef = useRef\(null\)/);
  assert.match(
    panelSource,
    /onKeyDown=\{onAdvance \? \(event\) => \{[\s\S]*?event\.key !== "Tab"[\s\S]*?event\.preventDefault\(\);[\s\S]*?advanceRef\.current\?\.focus\(\)/,
  );
  assert.match(
    panelSource,
    /<button\s+ref=\{advanceRef\}[\s\S]*?autoFocus[\s\S]*?data-v2-lesson-advance/,
  );
});
