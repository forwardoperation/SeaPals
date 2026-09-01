import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("V2 Support completion returns to the reef while legacy Simulator may return to its hand sheet", () => {
  const returnToBoard = sourceSection(
    simulatorSource,
    "function returnFromSupportFlowToBoard(selectedCardId = null)",
    "function playCardFromHand(cardId)",
  );

  assert.match(returnToBoard, /setModal\(previewExperience \? null : "hand"\)/);
  assert.match(returnToBoard, /setSelectedHandCard\(previewExperience \? null : selectedCardId\)/);
  assert.doesNotMatch(returnToBoard, /setHandPopoverCardId/);
});

test("every Support path that formerly reopened the legacy hand sheet uses the V2-aware reef return", () => {
  const playCard = sourceSection(
    simulatorSource,
    "function playCardFromHand(cardId)",
    "function completeInvasivePlacement",
  );
  const recovery = sourceSection(
    playCard,
    'if (card.id === "recovery")',
    'if (card.id === "scientist-jes")',
  );
  const singleSearch = sourceSection(
    simulatorSource,
    "function completeSupportSearch(cardId)",
    "function toggleSupportSearchCard(cardId)",
  );
  const multipleSearch = sourceSection(
    simulatorSource,
    "function completeMultipleSupportSearch()",
    "function cancelSupportSearch()",
  );
  const cancelSearch = sourceSection(
    simulatorSource,
    "function cancelSupportSearch()",
    "function completeOceanJakeRecovery(cardId)",
  );
  const coralHeal = sourceSection(
    simulatorSource,
    "function completeCoralHeal(coralId)",
    "function completeOnPlayCoralHeal(coralId)",
  );

  for (const [name, section] of [
    ["Recovery tails", recovery],
    ["single-card search", singleSearch],
    ["multi-card search", multipleSearch],
    ["Support cancellation", cancelSearch],
    ["Coral Heal", coralHeal],
  ]) {
    assert.match(section, /returnFromSupportFlowToBoard\(/, `${name} should return through the V2-aware helper`);
    assert.doesNotMatch(section, /setModal\("hand"\)/, `${name} must not directly reopen the legacy hand sheet`);
  }
});

test("Support targeting and mandatory choice surfaces remain intact", () => {
  const playCard = sourceSection(
    simulatorSource,
    "function playCardFromHand(cardId)",
    "function completeInvasivePlacement",
  );

  assert.match(playCard, /setModal\("lost-recover"\)/, "Ocean Jake still needs its recovery picker");
  assert.match(playCard, /setModal\("support-draw"\)/, "Dr. Evans still needs its draw allocation picker");
  assert.match(playCard, /setModal\("coral-target"\)/, "Coral Cement still needs its coral picker");
  assert.match(playCard, /setModal\("restock"\)/, "Restocking still needs its multi-card picker");
  assert.match(playCard, /setModal\("recover"\)/, "successful Recovery still needs its discard picker");
  assert.match(playCard, /setModal\("search"\)/, "deck-search Supports still need their search picker");
  assert.match(playCard, /type: "choose-spearfishing-target"/);
  assert.match(playCard, /type: "choose-whirlpool-target"/);
  assert.match(playCard, /type: "choose-clear-status-target"/);
  assert.match(playCard, /type: "choose-scientist-jes"/);
});

test("canceling an in-board Support target also stays on the V2 reef", () => {
  const supportTargetReaders = sourceSection(
    simulatorSource,
    'eventOverlay.type === "choose-inspection-deck"',
    'eventOverlay.type === "choose-friendly-creature"',
  );

  const returnCalls = supportTargetReaders.match(/returnFromSupportFlowToBoard\(\)/g) ?? [];
  assert.ok(returnCalls.length >= 6, "every Support target cancellation should use the V2-aware reef return");
  assert.doesNotMatch(supportTargetReaders, /setModal\("hand"\)/);
  assert.match(supportTargetReaders, /Cancel Inspection/);
  assert.match(supportTargetReaders, /Cancel Support/);
  assert.match(supportTargetReaders, /Cancel Effect/);
  assert.match(supportTargetReaders, /Cancel Spearfishing/);
});

test("opponent RP collection snapshots sources before any Support or permanent can be played", () => {
  const opponentTurn = sourceSection(
    simulatorSource,
    "function runOpponentTurn(current,",
    "function cancelOpeningCoinFlip()",
  );

  assert.match(opponentTurn, /const startTurnCorals = current\.corals\.map/);
  assert.match(opponentTurn, /const income = 1 \+ getEcosystemStartTurnRp\(startTurnCorals, activeCondition\)/);
  assert.match(opponentTurn, /const rpSources = getEcosystemStartTurnRpSources\(startTurnCorals, activeCondition\)\.map/);
  assert.match(opponentTurn, /const startOfTurnCollection = \{[\s\S]*?rpSources,[\s\S]*?requestedDraws,/);

  const sourceSnapshotIndex = opponentTurn.indexOf("const rpSources = getEcosystemStartTurnRpSources(startTurnCorals, activeCondition)");
  const startStateIndex = opponentTurn.indexOf("const startOfTurnState = reconcileOpponentInstances(current, next)");
  const supportPlayIndex = opponentTurn.indexOf("const supportResult = runOpponentSupports(next)");
  const permanentPlayIndex = opponentTurn.indexOf("const permanentPlays = [{");

  assert.ok(sourceSnapshotIndex >= 0 && sourceSnapshotIndex < startStateIndex);
  assert.ok(startStateIndex < supportPlayIndex, "the immutable start state must precede opponent Support plays");
  assert.ok(supportPlayIndex < permanentPlayIndex, "permanents selected later in the turn cannot enter the RP source snapshot");
});

test("compact opponent RP playback commits the start-of-turn board and uses that event's source snapshot", () => {
  const resolveOpponentTurn = sourceSection(
    simulatorSource,
    "function resolveOpponentTurn({",
    "function cancelOpeningCoinFlip()",
  );
  const compactOpponentStatus = sourceSection(
    simulatorSource,
    'if (compactTurnPresentationEnabled && event.type === "opponent-status")',
    'if (compactTurnPresentationEnabled && event.type === "turn-transition")',
  );

  assert.match(resolveOpponentTurn, /type: "opponent-status"[\s\S]*?turnCollection: opponentResult\.startOfTurnDetails[\s\S]*?opponentStateAfter: opponentResult\.startOfTurnState/);
  assert.ok(
    compactOpponentStatus.indexOf("commitEventState(event)") < compactOpponentStatus.indexOf("beginCompactTurnSequence({"),
    "the pre-play opponent board must render before RP coins resolve their source elements",
  );
  assert.match(compactOpponentStatus, /rpSources: event\.turnCollection\?\.rpSources \?\? \[\]/);
  assert.doesNotMatch(compactOpponentStatus, /getEcosystemStartTurnRpSources\(opponent\.corals/);
});
