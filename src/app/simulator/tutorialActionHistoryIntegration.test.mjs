import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
const tutorialHelpSource = await readFile(new URL("./tutorialHelp.mjs", import.meta.url), "utf8");

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("tutorial action options preserve canonical usage history during another interaction", () => {
  const attacks = sourceBetween(
    simulatorSource,
    "const playerAttackOptions",
    "const readyAttack",
  );
  assert.match(attacks, /const usedThisTurn = usedAttackers\.includes\(entry\.actionKey\)/);
  assert.match(attacks, /targetCount,[\s\S]*usedThisTurn,[\s\S]*blockType/);

  const utilities = sourceBetween(
    simulatorSource,
    "const playerUtilityActionOptions",
    "const readyUtilityAction",
  );
  assert.match(utilities, /const usedThisTurn = usedCreatureActions\.includes\(utilityActionKey\)/);
  assert.match(utilities, /utilityActionKey,[\s\S]*usedThisTurn,[\s\S]*effectType/);
});

test("Academy progression reads stable history instead of a temporary blocker label", () => {
  const curriculum = sourceBetween(
    tutorialHelpSource,
    "function getAcademyCurriculumHelp",
    "function getFinishDuelHelp",
  );
  assert.match(curriculum, /action\.usedThisTurn \|\| \["used", "cooldown"\]\.includes\(action\.blockType\)/);
  assert.match(tutorialHelpSource, /if \(uiState\.playingCardId && uiState\.playingCardId !== card\.cardId\) return null/);
});
