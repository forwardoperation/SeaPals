import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("./adventure.module.css", import.meta.url), "utf8");
const component = readFileSync(new URL("./AdventureGame.jsx", import.meta.url), "utf8");

function cssRule(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

test("boat direction changes rotate its artwork without rotating its world-position anchor", () => {
  const boatCellRule = cssRule(".boatCell");
  const boatActorRule = cssRule(".boatActor");

  assert.doesNotMatch(
    boatCellRule,
    /(?:^|;)\s*(?:rotate|transform)\s*:/,
    "the continuously positioned boat cell must not rotate its translate(-50%, -50%) anchor",
  );
  assert.match(boatActorRule, /transform:\s*rotate\(var\(--boat-heading\)\)/);
  assert.match(component, /className=\{styles\.boatActor\}[\s\S]*className=\{styles\.boatWake\}/);

  for (const direction of ["left", "right", "up", "down"]) {
    const facingRule = cssRule(`.boatFacing${direction}`);
    assert.match(facingRule, /--boat-heading:\s*-?\d+deg/);
    assert.doesNotMatch(facingRule, /(?:^|;)\s*(?:rotate|transform)\s*:/);
  }
});
