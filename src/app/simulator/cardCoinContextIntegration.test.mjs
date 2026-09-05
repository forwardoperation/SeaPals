import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
const presentationSource = await readFile(new URL("./CardCoinBoardPresentation.jsx", import.meta.url), "utf8");
const coinStateSource = await readFile(new URL("./cardCoinFlip.mjs", import.meta.url), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = simulatorSource.indexOf(startMarker);
  const end = simulatorSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return simulatorSource.slice(start, end);
}

test("the shared card coin state keeps explicit card and action context", () => {
  assert.match(coinStateSource, /sourceCardName = "Card effect",[\s\S]*actionName = "Coin Flip"/);
  assert.match(coinStateSource, /sourceCardName,[\s\S]*actionName,[\s\S]*successResult/);
});

test("card and action context remains visible during ready, landing, and result", () => {
  const context = presentationSource.indexOf('data-card-coin-context');
  const waiting = presentationSource.indexOf("{isWaiting ? (");
  const landing = presentationSource.indexOf("{isLanding ? (");
  const result = presentationSource.indexOf("{isResult ? (");

  assert.ok(context >= 0 && context < waiting && waiting < landing && landing < result);
  assert.match(presentationSource, /data-card-coin-source>\{sourceCardName\}/);
  assert.match(presentationSource, /data-card-coin-action>\{actionName\}/);
  assert.match(presentationSource, /aria-labelledby="card-coin-board-context card-coin-board-title"/);
  assert.match(presentationSource, /\{sourceCardName\}, \{actionName\}\.[\s\S]*The coin landed/);
});

test("every current board-card coin entry point supplies an action name", () => {
  const callCount = simulatorSource.match(/beginCardCoinFlipPresentation\(\{/g)?.length ?? 0;
  const actionContextCount = simulatorSource.match(/^\s+actionName(?:,|:)/gm)?.length ?? 0;

  assert.equal(callCount, 5, "Recovery, targeted actions, opponent cards, Toxic, and Lionfish share the presenter");
  assert.ok(actionContextCount >= callCount);
  assert.match(simulatorSource, /sourceCardName: card\.name,[\s\S]{0,120}?actionName: "Recover from Discard"/);
  assert.match(simulatorSource, /sourceCardName: sourceCard\.name,[\s\S]{0,120}?actionName,/);
  assert.match(simulatorSource, /sourceCardName: toxicSourceName,[\s\S]{0,120}?actionName: "Toxic"/);
  const opponentPresenter = sourceBetween(
    "  function beginQueuedOpponentCoinPresentation(",
    "  function beginLiveLionfishCoinPresentation(",
  );
  const lionfishPresenter = sourceBetween(
    "  function beginLiveLionfishCoinPresentation(",
    "  function beginDeferredOpponentToxicCoinPresentation(",
  );
  assert.match(opponentPresenter, /sourceCardName,[\s\S]*actionName,[\s\S]*automatic: true/);
  assert.match(lionfishPresenter, /sourceCardName,[\s\S]*actionName,[\s\S]*neutral: true/);
});
