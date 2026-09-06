import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = (await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8"))
  .replaceAll("\r\n", "\n");

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("the simulator persists a coherent gameplay random-stream checkpoint", () => {
  const currentState = sourceSection(
    simulatorSource,
    "function getCurrentSimulatorResumeState()",
    "function resolveResumeDecision()",
  );
  assert.match(currentState, /gameplayRandomState,/);
  assert.doesNotMatch(
    currentState,
    /gameplayRandomStateRef\.current/,
    "A pagehide save must not pair an older rendered board with a newer in-flight cursor",
  );

  const restore = sourceSection(
    simulatorSource,
    "function restoreSimulatorResumeCheckpoint(",
    "function restartGame(",
  );
  assert.match(restore, /replaceGameplayRandomState\(saved\.gameplayRandomState/);
  assert.match(restore, /checkpoint\?\.savedAt[\s\S]{0,120}?0xA511E9B3/);
  assert.match(restore, /faceoffCommittedPacketRef\.current = null/);
  assert.match(restore, /effectRollCommittedPacketRef\.current = null/);

  const restart = sourceSection(simulatorSource, "function restartGame(", "function restartStoryGame(");
  assert.match(restart, /beginGameplayRandomStream\(\)[\s\S]{0,180}?createInitialGameState/);
  assert.match(restart, /createInitialGameState\([\s\S]{0,220}?nextGameplayRandom/);
});

test("cosmetic dice cycling cannot choose the committed gameplay packet", () => {
  const faceoffReady = sourceSection(
    simulatorSource,
    "const boardFaceoffReady = previewExperience",
    "useEffect(() => {\n    if (!effectRollRolling",
  );
  assert.match(faceoffReady, /faceoffCommittedPacketRef\.current\?\.key !== presentationKey/);
  assert.match(faceoffReady, /createCombatRollPacket\([\s\S]{0,180}?nextGameplayRandom/);

  const faceoffStop = sourceSection(simulatorSource, "function stopBoardFaceoff()", "  return (");
  assert.match(faceoffStop, /const committedRoll = faceoffCommittedPacketRef\.current/);
  assert.match(faceoffStop, /const stoppedPacket = \{ \.\.\.committedRoll\.packet \}/);
  assert.match(faceoffStop, /setFaceoffPreview\(stoppedPacket\)/);
  assert.doesNotMatch(faceoffStop, /stoppedPacket = \{ \.\.\.faceoffPreview \}/);

  const effectStop = sourceSection(
    simulatorSource,
    "function stopBoardEffectRoll()",
    "function completeBoardAttackIntent(",
  );
  assert.match(effectStop, /const committedRoll = effectRollCommittedPacketRef\.current/);
  assert.match(effectStop, /const stoppedPacket = \{ \.\.\.committedRoll\.packet \}/);
  assert.doesNotMatch(effectStop, /stoppedPacket = \{ \.\.\.effectRollPreview \}/);
});

test("gameplay actions do not fall back to Math.random inside the Simulator component", () => {
  const componentSource = simulatorSource.slice(simulatorSource.indexOf("export default function Simulator("));
  assert.doesNotMatch(
    componentSource,
    /Math\.random/,
    "Coins, dice, AI branches, discards, and reshuffles must use the resumable gameplay stream",
  );
  assert.match(componentSource, /startCardCoinFlip\([\s\S]{0,180}?random: nextGameplayRandom/);
  assert.match(componentSource, /resolveOpeningCoinFlip\([\s\S]{0,140}?random: nextGameplayRandom/);
  assert.match(componentSource, /resolveTargetedCoinFlip\([\s\S]{0,180}?random: nextGameplayRandom/);
  assert.match(componentSource, /resolveHostTurnLionfishInvaders\([\s\S]{0,260}?random: nextGameplayRandom/);
});
