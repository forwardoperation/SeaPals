import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ADVENTURE_CONTENT,
  getAdventureScene,
} from "./adventureContent.mjs";
import { validateAdventureContent } from "./adventureContentValidation.mjs";
import {
  getContinuousInteraction,
  isWalkable,
} from "./adventureWorld.mjs";

const component = readFileSync(new URL("./AdventureGame.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./adventure.module.css", import.meta.url), "utf8");

test("Mission Control exposes a reachable, validated vehicle launch interaction", () => {
  const missionControl = getAdventureScene("trenchlight-mission-control").world;
  const launch = missionControl.interactions.find(({ type }) => type === "sub-launch");

  assert.deepEqual(launch, {
    id: "interaction-trenchlight-launch-sub",
    type: "sub-launch",
    at: { x: 6, y: 5 },
    questId: "quest-trenchlight-sensor",
    targetScene: "trenchlight-sub-descent",
    spawn: { x: 7, y: 8 },
    facing: "up",
    label: "Launch the guided research sub",
  });
  assert.equal(isWalkable("trenchlight-mission-control", { x: 6, y: 6 }), true);
  assert.equal(
    getContinuousInteraction(
      "trenchlight-mission-control",
      { x: 6, y: 6 },
      "up",
    )?.interactionId,
    launch.id,
  );
  assert.equal(validateAdventureContent(ADVENTURE_CONTENT).valid, true);
});

test("sub-launch validation requires a same-town vehicle target", () => {
  const invalid = structuredClone(ADVENTURE_CONTENT);
  const missionControl = invalid.scenes.find(({ id }) => id === "trenchlight-mission-control");
  const launch = missionControl.world.interactions.find(({ type }) => type === "sub-launch");
  launch.targetScene = "trenchlight-mission-control";

  const result = validateAdventureContent(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("targetScene must be a vehicle scene")));
});

test("the live vehicle scene replaces walking controls with the accessible guided console", () => {
  assert.match(component, /const vehicleMode = scene\?\.kind === "vehicle"/);
  assert.match(component, /const movementPaused = screen !== "playing"[\s\S]*\|\| vehicleMode/);
  assert.match(component, /\{vehicleMode \? \([\s\S]*<TrenchlightSubExpedition[\s\S]*\) : \([\s\S]*className=\{`\$\{styles\.controlDock\}/);
  assert.match(component, /TRENCHLIGHT_RESPONSE_CHOICES\.map/);
  assert.match(component, /aria-pressed=\{assistedMode\}/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, />Return to Station</);
  assert.match(component, /The highlighted control still requires your confirmation/);
  assert.match(component, /returnTrenchlightExpeditionToStation\(result\.save\)/);
  assert.match(component, /!trenchlightGuideComplete[\s\S]*!trenchlightBriefingComplete/);
});

test("sub controls meet touch sizing and reduced-motion requirements", () => {
  assert.match(styles, /\.subSafetyBar button\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /\.subInstrumentButton,[\s\S]*?\.subRecoveryChoice\s*\{[\s\S]*?min-height:\s*50px/);
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.subMarineSnow,[\s\S]*?\.subActionAssisted[\s\S]*?animation:\s*none\s*!important/,
  );
  assert.match(
    styles,
    /@media \(max-height:\s*620px\) and \(orientation:\s*landscape\)[\s\S]*?\.subExpeditionPanel\s*\{[\s\S]*?overflow-y:\s*auto/,
  );
  assert.match(
    styles,
    /@media \(max-width:\s*700px\) and \(max-height:\s*620px\) and \(orientation:\s*landscape\)[\s\S]*?\.subViewport\s*\{\s*display:\s*none[\s\S]*?\.subConsole\s*\{[\s\S]*?overflow-y:\s*auto/,
  );
});
