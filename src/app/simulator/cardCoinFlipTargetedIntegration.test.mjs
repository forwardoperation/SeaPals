import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseLegacyUtilityText } from "./gameRules.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(filename), "../../..");
const jiti = createJiti(filename, {
  fsCache: false,
  alias: { "@": path.join(projectRoot, "src") },
});
const { cardsById } = jiti(path.join(projectRoot, "src/data/cards/index.js"));

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = simulatorSource.indexOf(startMarker);
  const end = simulatorSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return simulatorSource.slice(start, end);
}

function utilityEffect(action) {
  return typeof action === "string" ? parseLegacyUtilityText(action) : action.effect;
}

function actionName(action) {
  return typeof action === "string" ? action.split(":", 1)[0] : action.name;
}

test("every targeted Coral coin action, including Nerve Agent, shares the generic flipCoin path", () => {
  const targetedCoinActions = ["crown-of-thorns", "man-o-war", "nudibranch"]
    .flatMap((cardId) => (cardsById[cardId]?.actions ?? []).map((action) => ({
      cardId,
      action,
      effect: utilityEffect(action),
    })))
    .filter(({ effect }) => effect?.type === "flipCoin")
    .map(({ cardId, action, effect }) => ({
      key: `${cardId}:${actionName(action)}`,
      successResult: effect.successResult,
      onSuccessType: effect.onSuccess?.type,
    }))
    .sort((left, right) => left.key.localeCompare(right.key));

  assert.deepEqual(targetedCoinActions, [
    { key: "crown-of-thorns:Stun", successResult: "heads", onSuccessType: "stunCoral" },
    { key: "crown-of-thorns:Venom Spines", successResult: "heads", onSuccessType: "damage" },
    { key: "man-o-war:Nerve Agent", successResult: "heads", onSuccessType: "stunCoral" },
    { key: "nudibranch:Munch", successResult: "heads", onSuccessType: "modifyRpGeneration" },
  ]);
});

test("V2 validates a chosen Coral, commits once, and enters the board-native tap flip before resolving", () => {
  const beginAction = sourceBetween(
    "function beginCreatureUtilityAction(action)",
    "function completeActionDeckSearch",
  );
  const coinChoiceStart = beginAction.indexOf("if (effect.type === EffectType.FLIP_COIN)");
  const coinChoiceEnd = beginAction.indexOf('if (effect.type === "rollDiceForResource")', coinChoiceStart);
  assert.ok(coinChoiceStart >= 0 && coinChoiceEnd > coinChoiceStart, "missing targeted coin-action chooser");
  const coinChoice = beginAction.slice(coinChoiceStart, coinChoiceEnd);

  assert.match(coinChoice, /type:\s*"choose-coin-coral-target"/);
  assert.match(coinChoice, /costCommitted:\s*false/);
  assert.match(coinChoice, /candidates:\s*opponentCoralCards\.map/);
  assert.doesNotMatch(coinChoice, /beginCardCoinFlipPresentation|resolveTargetedCoinFlip|Math\.random/);

  const completeAction = sourceBetween(
    "function completeCoinCoralEffect",
    "function completeSymbiosis",
  );
  const candidateGuard = completeAction.indexOf("pendingCreatureAction?.candidates?.includes(coralId)");
  const targetLookup = completeAction.indexOf("opponentCorals.find");
  const previewStart = completeAction.indexOf("if (isTargetedCoinAction && previewExperience && !presentedOutcome)");
  const previewEnd = completeAction.indexOf("const coinResolution", previewStart);
  assert.ok(candidateGuard >= 0 && targetLookup > candidateGuard && previewStart > targetLookup && previewEnd > previewStart);
  const previewBranch = completeAction.slice(previewStart, previewEnd);

  assert.match(previewBranch, /commitCostAndActionUse\(\)/);
  assert.match(previewBranch, /costCommitted:\s*true,\s*selectedCoralId:\s*coralId/);
  assert.match(
    previewBranch,
    /beginCardCoinFlipPresentation\(\{[\s\S]*?owner:\s*"player"[\s\S]*?sourceCardId:\s*sourceCard\.id[\s\S]*?successResult[\s\S]*?continuation:\s*\{[\s\S]*?type:\s*"targeted-coral-action"[\s\S]*?coralId[\s\S]*?sourceCardId:\s*sourceCard\.id[\s\S]*?actionKey:\s*pendingAction\.actionKey[\s\S]*?\}[\s\S]*?\}\);\s*return;/,
  );
  assert.doesNotMatch(
    previewBranch,
    /resolveTargetedCoinFlip|Math\.random|setEventOverlay|type:\s*"(?:utility-result|impact-result)"/,
    "target selection must not pre-roll or open the legacy result page",
  );

  const legacyResolver = completeAction.indexOf("resolveTargetedCoinFlip({", previewEnd);
  assert.ok(legacyResolver > previewEnd, "the immediate resolver should remain only after the V2 early return");
});

test("Continue consumes the sampled outcome once and V2 returns directly to the board", () => {
  const continuation = sourceBetween("function continueCardCoinFlip", "function cancelOpeningCoinFlip");
  assert.match(
    continuation,
    /continuation(?:\?)?\.type === "targeted-coral-action"[\s\S]*?continuation\.sourceCardId === outcome\.sourceCardId[\s\S]*?pendingCreatureAction\?\.actionKey === continuation\.actionKey[\s\S]*?pendingCreatureAction\?\.selectedCoralId === continuation\.coralId[\s\S]*?completeCoinCoralEffect\(continuation\.coralId, outcome\)/,
  );
  assert.doesNotMatch(continuation, /Math\.random|resolveTargetedCoinFlip|setRp\(/);

  const completeAction = sourceBetween(
    "function completeCoinCoralEffect",
    "function completeSymbiosis",
  );
  assert.match(
    completeAction,
    /presentedOutcome\s*\?\s*\{[\s\S]*?coinResult:\s*presentedOutcome\.result[\s\S]*?success:\s*presentedOutcome\.success[\s\S]*?\}\s*:\s*resolveTargetedCoinFlip/,
    "resolution must reuse the board presentation's outcome instead of sampling again",
  );
  assert.match(
    completeAction,
    /if \(coinResolution && !coinResolution\.success\)[\s\S]*?if \(previewExperience\) \{\s*setEventOverlay\(null\);\s*focusBoardAfterCardCoinResult\(\);\s*\} else \{\s*setEventOverlay\(\{ type: "utility-result"/,
    "a failed V2 flip should return to the reef while legacy retains its result page",
  );
  assert.match(
    completeAction,
    /setPendingCreatureAction\(null\);\s*if \(previewExperience\) \{\s*setEventOverlay\(null\);\s*focusBoardAfterCardCoinResult\(\);\s*\} else \{\s*setEventOverlay\(\{ type: "impact-result"/,
    "a successful V2 flip should return to the reef while legacy retains its result page",
  );
});
