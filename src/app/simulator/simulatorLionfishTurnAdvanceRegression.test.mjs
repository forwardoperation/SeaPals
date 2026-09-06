import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = simulatorSource.indexOf(startMarker);
  const end = simulatorSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return simulatorSource.slice(start, end);
}

function occurrenceCount(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

test("round boundaries skip the live Lionfish lane when no legal Fish can be attacked", () => {
  const startRound = sourceBetween("  function startRound(", "  function beginOpeningOpponentTurn");
  const opponentTurn = sourceBetween("  function resolveOpponentTurn({", "  function flipForOpeningTurn");

  assert.match(
    startRound,
    /const player\w*Invaders = skipLionfish \? \[\] : collectTriggerableHostTurnLionfishInvaders\(/,
    "the player round boundary must preflight legal targets before entering an async Lionfish sequence",
  );
  assert.doesNotMatch(
    startRound,
    /const player\w*Invaders = skipLionfish \? \[\] : collectHostTurnLionfishInvaders\(/,
  );
  assert.match(
    opponentTurn,
    /const opponent\w*Invaders = skipLionfish \? \[\] : collectTriggerableHostTurnLionfishInvaders\(/,
    "the opponent round boundary must preflight legal targets before entering an async Lionfish sequence",
  );
  assert.doesNotMatch(
    opponentTurn,
    /const opponent\w*Invaders = skipLionfish \? \[\] : collectHostTurnLionfishInvaders\(/,
  );
});

test("a completed round start explicitly releases the one-click turn-advance claim", () => {
  const startRound = sourceBetween("  function startRound(", "  function beginOpeningOpponentTurn");
  const liveLionfishReturn = startRound.indexOf("presentQueuedEvent(firstLionfishEvent, remainingLionfishEvents");
  const release = startRound.indexOf("turnAdvanceRequestedRef.current = false;");
  const drawPhase = startRound.indexOf('setGamePhase("draw")');

  assert.ok(liveLionfishReturn >= 0, "the live Lionfish boundary should remain ahead of normal round setup");
  assert.ok(
    drawPhase > liveLionfishReturn && release > drawPhase,
    "normal round setup must release the guard with the committed draw phase; a phase effect alone can miss a batched transition",
  );
});

test("resume and restart cannot inherit a stale turn-advance claim", () => {
  const restore = sourceBetween(
    "  function restoreSimulatorResumeCheckpoint(",
    "  function restartGame(",
  );
  const restart = sourceBetween(
    "  function restartGame(",
    "  function restartStoryGame(",
  );

  assert.match(restore, /turnAdvanceRequestedRef\.current = false;/);
  assert.match(restart, /turnAdvanceRequestedRef\.current = false;/);
});

test("player- and opponent-hosted Lionfish coin paths each resume their turn pipeline once", () => {
  const startRound = sourceBetween("  function startRound(", "  function beginOpeningOpponentTurn");
  const opponentTurn = sourceBetween("  function resolveOpponentTurn({", "  function flipForOpeningTurn");
  const liveLionfish = sourceBetween(
    "  function createLiveLionfishTurnEvents({",
    "  function createLiveOpponentAttackStepEvents({",
  );
  const coinContinuation = sourceBetween(
    'continuation?.type === "resolve-live-lionfish-coin"',
    'continuation?.type === "resolve-opponent-toxic"',
  );

  assert.equal(
    occurrenceCount(startRound, /startRoundRef\.current\?\.\(nextRound,/g),
    1,
    "the player-hosted completion must re-enter startRound once",
  );
  assert.equal(
    occurrenceCount(opponentTurn, /resolveOpponentTurnRef\.current\?\.\(\{/g),
    1,
    "the opponent-hosted completion must re-enter resolveOpponentTurn once",
  );
  assert.equal(
    occurrenceCount(liveLionfish, /type: "live-lionfish-continuation"/g),
    occurrenceCount(liveLionfish, /if \(continuationConsumed\) return;/g),
    "every terminal continuation must be protected against duplicate delivery",
  );
  assert.equal(
    occurrenceCount(liveLionfish, /continuationConsumed = true;/g),
    occurrenceCount(liveLionfish, /type: "live-lionfish-continuation"/g),
  );
  assert.equal(
    occurrenceCount(coinContinuation, /continuation\.resolve\(outcome\.result\)/g),
    1,
    "one completed coin must resolve one Lionfish step",
  );
  assert.equal(
    occurrenceCount(coinContinuation, /presentQueuedEvent\(nextEvent \?\? null, remainingEvents, \{ delayForOpponent: false \}\)/g),
    1,
    "the resolved Lionfish step must be presented once",
  );
});

test("a Lionfish heads result promotes its resolved attack checkpoint without an async queue gap", () => {
  const coinContinuation = sourceBetween(
    'continuation?.type === "resolve-live-lionfish-coin"',
    'continuation?.type === "resolve-opponent-toxic"',
  );

  const tailSnapshot = coinContinuation.indexOf("const existingTail = [...pendingEventsRef.current];");
  const resolveFromLandedSide = coinContinuation.indexOf("continuation.resolve(outcome.result)");
  const atomicPresentation = coinContinuation.indexOf(
    "presentQueuedEvent(nextEvent ?? null, remainingEvents, { delayForOpponent: false });",
  );

  assert.ok(
    tailSnapshot >= 0 && tailSnapshot < resolveFromLandedSide && resolveFromLandedSide < atomicPresentation,
    "the landed side and existing queue tail must be captured before the next Lionfish event is presented",
  );
  assert.doesNotMatch(
    coinContinuation,
    /setPendingEvents\(queuedEvents\)|window\.setTimeout/,
    "the resolved heads branch must not be parked in shared state or a timer before presentation",
  );
  assert.doesNotMatch(
    coinContinuation,
    /continuation\.resolve\(outcome\.success\)/,
    "heads is a routing result, not a failed-effect boolean",
  );
});
