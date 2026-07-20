import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("./AdventureGame.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./adventure.module.css", import.meta.url), "utf8");

test("every authored sprite-sheet profile calibrates its shadow for all four facing rows", () => {
  const profileBlock = component.match(
    /const SPRITE_FEET_Y_BY_PROFILE = Object\.freeze\(\{([\s\S]*?)\n\}\);/,
  )?.[1] ?? "";
  const profileIds = [
    "player",
    "marina",
    "dorian",
    "fisherman-wyeth",
    "teacher-caroline",
    "ivy",
    "explorer-jordan",
    "marine-biologist-jonah",
    "programmer-harlan",
    "town-adult",
    "town-elder",
    "academy-mentor",
  ];

  for (const profileId of profileIds) {
    const escaped = profileId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(
      profileBlock,
      new RegExp(`(?:"${escaped}"|${escaped}): Object\\.freeze\\(\\{ down: [\\d.]+, left: [\\d.]+, right: [\\d.]+, up: [\\d.]+ \\}\\)`),
      `${profileId} needs a feet line for every facing`,
    );
  }
});

test("player and NPC shadows use the same character and facing as their visible sprite", () => {
  assert.match(component, /function CharacterGroundShadow\(\{ character = "player", facing = "down" \}\)/);
  assert.match(component, /"--character-feet-y": spriteFeetY\(character, facing\)/);
  assert.match(component, /<CharacterGroundShadow character=\{trainer\.id\} facing=\{facing\} \/>[\s\S]*?<SpriteArtwork character=\{trainer\.id\} facing=\{facing\}/);
  assert.match(component, /<CharacterGroundShadow facing=\{facing\} \/>[\s\S]*?<SpriteArtwork facing=\{facing\}/);

  const finalShadowRule = styles.slice(styles.lastIndexOf(".characterShadow"));
  assert.match(finalShadowRule, /top:\s*var\(--character-feet-y, 53\.5%\)/);
  assert.match(finalShadowRule, /bottom:\s*auto/);
  assert.match(finalShadowRule, /transform:\s*translate\(-50%, -50%\)/);
});

test("shadow calibration stays out of portraits and boats", () => {
  const boatComponent = component.match(
    /function AdventureBoatSprite[\s\S]*?\n\}/,
  )?.[0] ?? "";
  const artworkComponent = component.match(
    /function SpriteArtwork[\s\S]*?\n\}/,
  )?.[0] ?? "";

  assert.doesNotMatch(boatComponent, /CharacterGroundShadow/);
  assert.doesNotMatch(artworkComponent, /CharacterGroundShadow/);
  assert.match(component, /portrait \? styles\.spritePortrait : ""/);
});

test("held walking intent animates through collision while every inactive state stops", () => {
  assert.match(component, /if \(vector\.x === 0 && vector\.y === 0\) \{[\s\S]*?setPlayerWalking\(false\);[\s\S]*?return;/);
  assert.match(component, /setPlayerWalking\(true\);\s*nextFacing = movementInput\.direction;\s*next = movePlayerContinuous/);
  assert.match(component, /if \(boatMode \|\| movementPaused \|\| !isMoving\) setPlayerWalking\(false\)/);
  assert.match(component, /function clearMovement|const clearMovement/);
  assert.match(component, /setPlayerWalking\(false\);[\s\S]*?setMovementActive\(false\)/);
  assert.match(component, /moving=\{playerWalking\}/);
  assert.doesNotMatch(component, /moving=\{playerWalking \|\| Boolean\(sceneTransition\)\}/);
  assert.match(component, /getAdventureWalkCycleDurationMs\(walkSpeed\)/);
});
