import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("./adventure.module.css", import.meta.url), "utf8");
const component = readFileSync(new URL("./AdventureGame.jsx", import.meta.url), "utf8");

function cssRule(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

test("continuous boat headings rotate artwork without rotating its world-position anchor", () => {
  const boatCellRule = cssRule(".boatCell");
  const boatActorRule = cssRule(".boatActor");

  assert.doesNotMatch(
    boatCellRule,
    /(?:^|;)\s*(?:rotate|transform)\s*:/,
    "the continuously positioned boat cell must not rotate its translate(-50%, -50%) anchor",
  );
  assert.match(boatActorRule, /transform:\s*rotate\(var\(--boat-heading\)\)/);
  assert.match(
    boatActorRule,
    /transition:\s*transform\s+\d+ms/,
    "small physics heading changes should receive a short visual interpolation",
  );
  assert.match(component, /"--boat-heading": `\$\{heading\}deg`/);
  assert.match(component, /"--boat-wake-strength": speedRatio/);
  assert.match(component, /stepBoatMotion\(/);
  assert.match(component, /heading=\{displayedBoatMotion\.heading\}/);
  assert.match(component, /className=\{styles\.boatActor\}[\s\S]*className=\{styles\.boatWake\}/);

  for (const direction of ["left", "right", "up", "down"]) {
    const facingRule = cssRule(`.boatFacing${direction}`);
    assert.match(facingRule, /--boat-heading:\s*-?\d+deg/);
    assert.doesNotMatch(facingRule, /(?:^|;)\s*(?:rotate|transform)\s*:/);
  }
});

test("boat controls explain throttle, rudder, reverse, and docking for keyboard and touch", () => {
  assert.match(component, /W \/ S[\s\S]*Throttle \/ brake \+ reverse/);
  assert.match(component, /A \/ D[\s\S]*Rudder left \/ right/);
  assert.match(component, /ariaLabel=\{boatMode \? "Increase boat throttle"/);
  assert.match(component, /ariaLabel=\{boatMode \? "Brake or reverse boat"/);
  assert.match(component, /ariaLabel=\{boatMode \? "Turn rudder port, left"/);
  assert.match(component, /ariaLabel=\{boatMode \? "Turn rudder starboard, right"/);
  assert.match(component, /<BoatHelmReadout/);
  assert.match(component, /Destination dock is/);
  assert.match(component, /press Enter or the on-screen A button/);
  assert.doesNotMatch(component, /press (?:Enter or )?A to dock/i);
});

test("reduced-motion modes remove hull interpolation and wake animation", () => {
  assert.match(styles, /\.reducedMotionMode[\s\S]*\.boatActor[\s\S]*transition:\s*none\s*!important/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.boatWake[\s\S]*animation:\s*none\s*!important/);
});

test("boat guidance keeps changing telemetry out of its live region", () => {
  assert.match(component, /className=\{styles\.interactionBar\} aria-live=\{boatMode \? undefined : "polite"\}/);
  assert.match(component, /className=\{styles\.srOnly\} aria-live="polite" aria-atomic="true"/);
  assert.match(component, /const boatAnnouncement = dockReady[\s\S]*displayedBoatMotion\.collided[\s\S]*: "";/);
});

test("boat wake opacity remains proportional to speed while its pulse only changes scale", () => {
  const wakeRule = styles.match(/\.boatWake\s*\{(?=[^}]*--boat-wake-strength)([^}]*)\}/)?.[1] ?? "";
  const wakeKeyframes = styles.match(/@keyframes boatWakePulse\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(wakeRule, /opacity:\s*calc\(var\(--boat-wake-strength, 0\) \* 0\.8\)/);
  assert.match(wakeKeyframes, /scale:/);
  assert.doesNotMatch(wakeKeyframes, /opacity:/);
});
