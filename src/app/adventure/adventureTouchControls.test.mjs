import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("./AdventureGame.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./adventure.module.css", import.meta.url), "utf8");

function cssRule(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

test("the D-pad suppresses iPhone long-press selection and touch callouts", () => {
  const dpadRule = cssRule(".dpad");
  const buttonRule = cssRule(".directionButton");
  const sharedControlRule = cssRule(".directionButton,\n.dpadCenter");

  assert.match(dpadRule, /touch-action:\s*none/);
  assert.match(dpadRule, /-webkit-touch-callout:\s*none/);
  assert.match(dpadRule, /-webkit-user-select:\s*none/);
  assert.match(dpadRule, /user-select:\s*none/);
  assert.match(sharedControlRule, /-webkit-touch-callout:\s*none/);
  assert.match(sharedControlRule, /-webkit-user-select:\s*none/);
  assert.match(sharedControlRule, /user-select:\s*none/);
  assert.match(buttonRule, /-webkit-tap-highlight-color:\s*transparent/);
  assert.match(component, /onContextMenu=\{\(event\) => event\.preventDefault\(\)\}/);
});

test("the D-pad buttons contain no selectable direction glyphs", () => {
  for (const direction of ["up", "left", "right", "down"]) {
    assert.doesNotMatch(
      component,
      new RegExp(`<DirectionButton direction="${direction}"[^>]*\\slabel=`),
    );
  }

  assert.doesNotMatch(component, /label="[▲◀▶▼]"/);
  assert.doesNotMatch(component, /function DirectionButton\([^)]*\blabel\b/);
});
