import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentSource = await readFile(new URL("./DefeatPresentation.jsx", import.meta.url), "utf8");
const styleSource = await readFile(new URL("./DefeatPresentation.module.css", import.meta.url), "utf8");
const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

test("defeat presentation is a focused accessible dialog with reusable actions", () => {
  assert.match(componentSource, /data-defeat-presentation/);
  assert.match(componentSource, /role="dialog"/);
  assert.match(componentSource, /aria-modal="true"/);
  assert.match(componentSource, /aria-labelledby=\{titleId\}/);
  assert.match(componentSource, /aria-describedby=\{descriptionId\}/);
  assert.match(componentSource, /data-defeat-primary-action/);
  assert.match(componentSource, /actions\s*\?\?\s*children/);
  assert.match(componentSource, /data-defeat-actions/);
  assert.match(componentSource, /keepFocusInDialog/);
  assert.match(componentSource, /previouslyFocused/);
  assert.match(componentSource, /const primaryAction = [^;]*querySelector\("\[data-defeat-primary-action\]"\)/);
  assert.match(componentSource, /const firstAction = primaryAction \?\?/);
});

test("defeat copy states the result once and retains a safe fallback", () => {
  assert.match(componentSource, /replace\(\/\^defeat\\s\*:\\s\*\/i,\s*""\)/);
  assert.match(componentSource, /DEFEAT/);
  assert.match(componentSource, /data-defeat-reason/);
  assert.match(componentSource, /return normalized \|\| "Your ecosystem fell short this time\.";/);
});

test("defeat appears over the board instead of replacing its context", () => {
  assert.match(styleSource, /\.layer\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?z-index:\s*190;/);
  assert.match(styleSource, /\.backdrop\s*\{[\s\S]*?rgb\([^)]*\/\s*(?:0?\.)?\d+%?\)/);
  assert.match(styleSource, /backdrop-filter:\s*blur\(/);
  assert.match(styleSource, /min-height:\s*100dvh/);
  assert.match(styleSource, /env\(safe-area-inset-top\)/);
  assert.match(styleSource, /@media\s*\(max-width:\s*520px\)/);

  const boardIndex = simulatorSource.indexOf("seapals-board-stack");
  const defeatOverlayIndex = simulatorSource.lastIndexOf("<DefeatPresentation");
  assert.ok(boardIndex >= 0, "the gameplay board should remain mounted");
  assert.ok(defeatOverlayIndex > boardIndex, "the defeat dialog should layer over the existing board");
});

test("defeat presentation honors app and operating-system reduced-motion preferences", () => {
  assert.match(componentSource, /data-reduced-motion=\{reducedMotion \? "true" : undefined\}/);
  assert.match(styleSource, /\.reducedMotion[\s\S]*?animation:\s*none\s*!important/);
  assert.match(styleSource, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation:\s*none\s*!important/);
});

test("the simulator routes both VP and deck-depletion losses to the defeat dialog", () => {
  assert.match(simulatorSource, /import DefeatPresentation from "\.\/DefeatPresentation";/);
  assert.match(
    simulatorSource,
    /gameResult && !tutorialLessonWon && \/\^Defeat\\b\/i\.test\(gameResult\)[\s\S]*?<DefeatPresentation/,
  );
  assert.match(simulatorSource, /<DefeatPresentation[\s\S]*?message=\{gameResult\}/);
  assert.match(simulatorSource, /Defeat:[^\n]*(?:opponent[^\n]*VP|VP[^\n]*opponent)/i);
  assert.match(simulatorSource, /Defeat:[^\n]*(?:required[^\n]*draw|personal decks)/i);
});

test("defeat offers the same useful post-match paths as victory", () => {
  const defeatStart = simulatorSource.indexOf("{gameResult && !tutorialLessonWon && /^Defeat\\b/i.test(gameResult)");
  const defeatEnd = simulatorSource.indexOf("{tutorialCompletionDialogOpen", defeatStart);
  const defeatBlock = defeatStart >= 0 && defeatEnd > defeatStart
    ? simulatorSource.slice(defeatStart, defeatEnd)
    : "";

  assert.match(defeatBlock, /Retry Practice Duel/);
  assert.match(defeatBlock, /Return to \{storyReturnLabel\}/);
  assert.match(defeatBlock, /Shop \{selectedPlayerDeck\.name\}/);
  assert.match(defeatBlock, /data-defeat-primary-action/);
  assert.match(defeatBlock, /Play Again/);
  assert.match(defeatBlock, /restartGame\(selectedDeckId, selectedOpponentDeckId, victoryTarget, opponentDifficulty\)/);
});

test("unknown result types retain a compact fallback alert", () => {
  assert.match(
    simulatorSource,
    /gameResult && !tutorialLessonWon && !\/\^Victory\\b\/i\.test\(gameResult\) && !\/\^Defeat\\b\/i\.test\(gameResult\)[\s\S]*?role="alert"/,
  );
});
