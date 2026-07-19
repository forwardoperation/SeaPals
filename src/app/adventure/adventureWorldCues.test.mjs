import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("./AdventureGame.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./adventure.module.css", import.meta.url), "utf8");

function cssRule(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

test("world-space cues cover travel and the current ecosystem work without intercepting input", () => {
  for (const type of ["board", "dock", "observation", "interpretation", "response"]) {
    assert.match(component, new RegExp(`${type}: Object\\.freeze`));
  }
  assert.match(component, /candidate\.type === "board"[\s\S]*candidate\.type === "dock"/);
  assert.match(component, /ecosystemChapter\?\.questId === candidate\.questId/);
  assert.match(component, /style=\{\{ \.\.\.actorPosition\(interaction\.at, scene\)/);
  assert.match(component, /aria-hidden="true"/);
  assert.match(cssRule(".worldCue"), /pointer-events:\s*none/);
  assert.match(cssRule(".worldCue"), /opacity:\s*0\.4/);
});

test("nearby and next-step targets gain an arrow while completed work quiets down", () => {
  assert.match(component, /active=\{interaction\?\.interactionId === candidate\.id\}/);
  assert.match(component, /nextStep\.kind === "observation" && nextStep\.id === interaction\.observationId/);
  assert.match(component, /return nextStep\.id === interaction\.type/);
  assert.match(component, /observedObservationIds\?\.includes\(interaction\.observationId\)/);
  assert.match(component, /ecosystemProgress\?\.interpretation\?\.correct/);
  assert.match(component, /ecosystemProgress\?\.response\?\.correct/);
  assert.match(styles, /\.worldCueRecommended \.worldCueArrow,[\s\S]*\.worldCueActive \.worldCueArrow[\s\S]*opacity:\s*1/);
  assert.match(cssRule(".worldCueComplete:not(.worldCueActive)"), /opacity:\s*0\.25/);
});

test("cue guidance is motion-safe and remains legible in high contrast", () => {
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.worldCueArrow,[\s\S]*animation:\s*none\s*!important/);
  assert.match(styles, /\.reducedMotionMode \*[\s\S]*animation:\s*none\s*!important/);
  assert.match(cssRule(".highContrastMode .worldCueBadge"), /border:\s*2px solid #fff/);
});
