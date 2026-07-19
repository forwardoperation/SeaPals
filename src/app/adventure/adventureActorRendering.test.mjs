import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("./AdventureGame.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./adventure.module.css", import.meta.url), "utf8");

test("live actor state drives rendering, interaction targeting, and player collision", () => {
  assert.match(component, /advanceAdventureActorStates\(/);
  assert.match(component, /positionOverrides:\s*actorPositionOverrides/);
  assert.match(component, /dynamicBlockers:\s*getAdventureActorBlockers\(/);
  assert.match(component, /ignoreActorTiles:\s*true/);
  assert.match(component, /position=\{runtimeActor\?\.position \?\? characterInteraction\.at\}/);
  assert.match(component, /facing=\{runtimeActor\?\.facing \?\? "down"\}/);
  assert.match(component, /moving=\{runtimeActor\?\.moving === true\}/);
});

test("patrol animation pauses with gameplay and honors reduced motion", () => {
  assert.match(component, /!movementPausedRef\.current/);
  assert.match(component, /pageVisibleRef\.current/);
  assert.match(component, /const effectiveReducedMotion = gameSave\?\.settings\?\.reducedMotion === true \|\| systemReducedMotion/);
  assert.match(component, /window\.matchMedia\?\.\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(component, /if \(effectiveReducedMotion\) \{[\s\S]*return undefined;/);
  assert.match(component, /if \(screen !== "playing" \|\| movementPaused \|\| !pageVisible\) \{[\s\S]*return undefined;/);
  assert.match(component, /actorVisualStateChanged\(currentRuntime\.actors, nextRuntime\.actors\)/);
  assert.match(styles, /\.npcCell\s*\{[\s\S]*transition:\s*left \d+ms linear, top \d+ms linear/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.npcCell,[\s\S]*transition:\s*none\s*!important/);
});
