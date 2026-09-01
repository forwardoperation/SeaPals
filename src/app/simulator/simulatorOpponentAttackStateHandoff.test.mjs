import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
const invertebrateSource = await readFile(
  new URL("../../data/cards/creatures/invertebrates.js", import.meta.url),
  "utf8",
);

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("a successful opponent Mantis Shrimp Shatter defeats Blue Crab and projects it into the player discard pile", () => {
  const blueCrab = sourceSection(
    invertebrateSource,
    'id: "blue-crab"',
    'id: "arrow-crab"',
  );
  const mantisShrimp = sourceSection(
    invertebrateSource,
    'id: "mantis-shrimp"',
    'id: "leather-starfish"',
  );
  const opponentAttackStep = sourceSection(
    simulatorSource,
    "function runOpponentAttackStep(",
    "function runOpponentAttack(",
  );
  const attackProjection = sourceSection(
    simulatorSource,
    "function buildOpponentAttackEventSequence(",
    "function preserveOpponentNormalActionsAfterOnPlay(",
  );

  assert.match(blueCrab, /category:\s*CardCategory\.INVERTEBRATE/);
  assert.match(mantisShrimp, /name:\s*"Mantis Shrimp"/);
  assert.match(mantisShrimp, /name:\s*"Shatter"[\s\S]*?dice:\s*"D6"[\s\S]*?categories:\s*\[CardCategory\.INVERTEBRATE\]/);

  assert.match(
    opponentAttackStep,
    /attackerWins:\s*true[\s\S]*?discardedCardId:\s*targetEntry\.card\.id[\s\S]*?discardedCardIds:\s*defeatedDiscardIds/,
    "A successful opposed roll must identify the exact defeated defender",
  );
  assert.match(
    attackProjection,
    /const discardedIds = step\.discardedCardIds \?\? \(step\.discardedCardId \? \[step\.discardedCardId\] : \[\]\)/,
  );
  assert.match(
    attackProjection,
    /nextDiscardPile = \[\.\.\.discardedIds, \.\.\.nextDiscardPile\]/,
    "Ordinary defeated creatures such as Blue Crab must be added to the player's discard projection",
  );
  assert.match(
    attackProjection,
    /type:\s*step\.noLegalTarget \? "opponent-impact" : "faceoff-result"[\s\S]*?playerStateAfter:\s*nextPlayer/,
    "The successful attack event must carry the post-discard player snapshot",
  );
});

test("the opponent turn boundary hands the final player snapshot into startRound instead of rereading stale React state", () => {
  const continuation = sourceSection(
    simulatorSource,
    "function continueAfterPresentedEvent(event, remainingEvents = [])",
    "function presentQueuedEvent(event, remainingEvents = [],",
  );
  const startRound = sourceSection(
    simulatorSource,
    "function startRound(nextRound,",
    "function beginOpeningOpponentTurn",
  );
  const resolveOpponentTurn = sourceSection(
    simulatorSource,
    "function resolveOpponentTurn({",
    "function cancelOpeningCoinFlip()",
  );
  const finalTransition = resolveOpponentTurn.slice(
    resolveOpponentTurn.lastIndexOf('type: "turn-transition"'),
  );
  const liveCompletion = sourceSection(
    simulatorSource,
    "function buildLiveOpponentTurnCompletionEvents(",
    "function createLiveOpponentAttackStepEvents(",
  );

  assert.match(
    finalTransition,
    /playerStateAfter:\s*normalizedFinalPlayerState/,
    "The terminal opponent event must retain the same snapshot that no longer contains the defeated Blue Crab",
  );
  assert.match(
    liveCompletion,
    /type: "turn-transition"[\s\S]*?playerStateAfter: finalPlayerState,[\s\S]*?opponentStateAfter: finalOpponentState,/,
    "The live V2 transition must carry both authoritative post-combat snapshots",
  );

  const advanceRound = sourceSection(
    continuation,
    "if (event?.advanceRoundAfterClose)",
    "if (event?.startOpeningPlayerTurnAfterClose)",
  );
  const openingHandoff = sourceSection(
    continuation,
    "if (event?.startOpeningPlayerTurnAfterClose)",
    "const [nextEvent, ...remaining]",
  );
  for (const [label, branch] of [
    ["ordinary next-round handoff", advanceRound],
    ["opening opponent-turn handoff", openingHandoff],
  ]) {
    assert.match(
      branch,
      /playerStateOverride:\s*event\.playerStateAfter \?\? null/,
      `${label} must forward the resolved player snapshot`,
    );
  }

  assert.match(startRound, /playerStateOverride\s*=\s*null/);
  assert.match(
    startRound,
    /const playerAtBoundary = normalizeProjectedPlayerState\(\{[\s\S]*?\.\.\.\(playerStateOverride \?\? \{\}\)[\s\S]*?\}\)/,
    "startRound must merge the explicit opponent-turn result over values captured by an older render",
  );
  assert.match(
    startRound,
    /const playerAtLionfishBoundary = skipLionfish[\s\S]*?playerAtBoundary[\s\S]*?resolveHostTurnLionfishInvaders\(\{[\s\S]*?playerState:\s*playerAtLionfishBoundary/,
    "all player zones entering the new round must originate from the boundary snapshot",
  );
  assert.match(
    startRound,
    /const excessCards = Number\.isFinite\(handLimit\) && playerAtTurnStart\.hand\.length > handLimit[\s\S]*?playerAtTurnStart\.hand\.slice\(handLimit\)/,
    "the next-round hand-limit calculation must not fall back to stale hand state",
  );
  assert.match(
    startRound,
    /const availableDraws = Math\.min\(requestedDraws, playerAtTurnStart\.foundationDeck\.length \+ playerAtTurnStart\.palsDeck\.length\)/,
    "the next-round draw boundary must use the same authoritative player snapshot",
  );
});
