import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createTutorialFinalRoundMilestone,
  isTutorialLessonVictory,
  shouldConfirmTutorialExit,
} from "./tutorialLessonUx.mjs";

const FINISH_PLAN = Object.freeze({
  finishRound: 7,
  victoryTarget: 26,
  preApexVp: 20,
  filterFeederCardId: "whale-shark",
});

test("the scripted Whale Shark play becomes an explicit 20/26 final-round milestone", () => {
  const milestone = createTutorialFinalRoundMilestone({
    tutorialActive: true,
    scriptedLesson: true,
    round: 6,
    cardId: "whale-shark",
    finishPlan: FINISH_PLAN,
  });

  assert.equal(milestone.title, "20 / 26 VP — One Final Round Remains");
  assert.equal(milestone.continueLabel, "Continue to Final Round");
  assert.equal(milestone.continueToEndTurn, true);
  assert.match(milestone.message, /milestone, not the end/i);
  assert.match(milestone.message, /Deep Sea Fishing.*Hammerhead.*26 VP/i);
});

test("the final-round milestone never changes ordinary or out-of-order plays", () => {
  const baseline = {
    tutorialActive: true,
    scriptedLesson: true,
    round: 6,
    cardId: "whale-shark",
    finishPlan: FINISH_PLAN,
  };
  assert.equal(createTutorialFinalRoundMilestone({ ...baseline, tutorialActive: false }), null);
  assert.equal(createTutorialFinalRoundMilestone({ ...baseline, scriptedLesson: false }), null);
  assert.equal(createTutorialFinalRoundMilestone({ ...baseline, round: 5 }), null);
  assert.equal(createTutorialFinalRoundMilestone({ ...baseline, cardId: "hammerhead" }), null);
});

test("only a live unfinished tutorial board asks before leaving", () => {
  const active = { isStoryMode: true, tutorialActive: true, gameResult: null, initialOverlay: false };
  assert.equal(shouldConfirmTutorialExit(active), true);
  assert.equal(shouldConfirmTutorialExit({ ...active, initialOverlay: true }), false);
  assert.equal(shouldConfirmTutorialExit({ ...active, gameResult: "Victory: complete." }), false);
  assert.equal(shouldConfirmTutorialExit({ ...active, tutorialActive: false }), false);
});

test("lesson completion requires a tutorial victory at its VP target", () => {
  const victory = {
    tutorialActive: true,
    gameResult: "Victory: you reached the 26 VP target.",
    playerVp: 26,
    victoryTarget: 26,
  };
  assert.equal(isTutorialLessonVictory(victory), true);
  assert.equal(isTutorialLessonVictory({ ...victory, playerVp: 20 }), false);
  assert.equal(isTutorialLessonVictory({ ...victory, gameResult: "Defeat: the opponent won." }), false);
  assert.equal(isTutorialLessonVictory({ ...victory, tutorialActive: false }), false);
});

test("Simulator wires the milestone through normal end-turn mechanics and renders focused completion and exit dialogs", async () => {
  const source = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
  assert.match(source, /createTutorialFinalRoundMilestone\(\{/);
  assert.match(source, /eventOverlay\?\.continueToEndTurn[\s\S]*setEventOverlay\(null\);[\s\S]*endTurn\(\);/);
  assert.match(source, /eventOverlay\.continueLabel \?\? "Continue"/);
  assert.match(source, /Aquarium Lesson Complete/);
  assert.match(source, /\{playerVp\} of \{victoryTarget\} VP/);
  assert.match(source, /Finish Lesson &amp; Return/);
  assert.match(source, /Your completed lesson skills are saved/);
  assert.match(source, /current practice reef and board will restart/i);
  assert.match(source, /Keep Playing/);
  assert.match(source, /Leave &amp; Restart Later/);
  assert.match(source, /tutorialActive: Boolean\(tutorialContract && scriptedTutorialScenario\)/);
  assert.match(source, /window\.addEventListener\("beforeunload", warnBeforeLeaving\)/);
  assert.match(source, /window\.addEventListener\("popstate", historyGuard\.handlePopState\)/);
  assert.match(source, /historyGuard\.handlePopState = \(\) => \{[\s\S]*setTutorialExitConfirmationOpen\(true\)/);
  assert.match(source, /function confirmTutorialExit\(\) \{[\s\S]*window\.history\.back\(\)/);
});
