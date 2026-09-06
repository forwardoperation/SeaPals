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

function namedFunctionSection(source, functionName) {
  const marker = `function ${functionName}(`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `Missing source marker: ${marker}`);
  const end = source.indexOf("\n  function ", start + marker.length);
  assert.ok(end > start, `Could not find the end of ${functionName}`);
  return source.slice(start, end);
}

test("combat results use a compact, explicit checkpoint instead of immediately discarding", () => {
  assert.match(
    simulatorSource,
    /const \[combatResultCheckpoint, setCombatResultCheckpoint\] = useState\(null\)/,
    "Combat results need their own held state so the board remains paused until the player continues",
  );

  const checkpointMarkup = sourceSection(
    simulatorSource,
    "{combatResultCheckpoint ? (",
    "{opponentPlacementFlight ? (",
  );
  assert.match(checkpointMarkup, /data-combat-result-checkpoint/);
  assert.match(checkpointMarkup, /data-combat-outcome=\{combatResultCheckpoint\.outcome\}/);
  assert.match(checkpointMarkup, /data-player-role=\{combatResultCheckpoint\.playerRole\}/);
  assert.match(checkpointMarkup, /role="dialog"/);
  assert.match(checkpointMarkup, /aria-modal="true"/);
  assert.match(checkpointMarkup, /combatResultCheckpoint\.event\.title/);
  assert.match(checkpointMarkup, /combatCheckpointBreakdown/);
  assert.match(checkpointMarkup, /data-combat-breakdown-side="attack"/);
  assert.match(checkpointMarkup, /data-combat-breakdown-side="defense"/);
  assert.match(
    checkpointMarkup,
    /Number\(combatResultCheckpoint\.event\.attackCount\) > 1[\s\S]*?Attack \$\{combatResultCheckpoint\.event\.attackNumber\} of \$\{combatResultCheckpoint\.event\.attackCount\}/,
    "Repeat attacks need a glanceable ordinal after the detailed sentence is removed",
  );
  assert.match(
    checkpointMarkup,
    /combatCheckpointBreakdown\.attack\.actionName[\s\S]*?<span>\{combatCheckpointBreakdown\.attack\.actionName\}<\/span>/,
    "The attack action must remain visible after the prose sentence is removed",
  );
  assert.equal(
    (checkpointMarkup.match(/data-combat-breakdown-side=/g) ?? []).length,
    2,
    "Opposed results should present one attack column and one defense column",
  );
  assert.equal(
    (checkpointMarkup.match(/data-combat-contributor/g) ?? []).length,
    2,
    "Each side should render its structured contributor rows",
  );
  assert.equal(
    (checkpointMarkup.match(/data-combat-total/g) ?? []).length,
    2,
    "Each side should end with its explicit total",
  );
  assert.match(
    checkpointMarkup,
    /data-combat-breakdown-side="attack"[\s\S]*?data-combat-contributor[\s\S]*?data-combat-total[\s\S]*?data-combat-breakdown-side="defense"[\s\S]*?data-combat-contributor[\s\S]*?data-combat-total/,
    "Contributor rows must precede the total at the bottom of each column",
  );
  assert.match(checkpointMarkup, /formatCombatContributorValue\(contributor\)/);
  assert.doesNotMatch(
    checkpointMarkup,
    /checkpointMessage|combatResultCheckpoint\.event\.message|seapals-combat-result-copy/,
    "The glanceable checkpoint should not render the explanatory result paragraph",
  );
  assert.match(
    checkpointMarkup,
    /className="sr-only"[\s\S]*?combatCheckpointAccessibleSummary/,
    "Assistive technology should receive a concise summary derived from the structured rows",
  );
  const checkpointStyles = sourceSection(
    simulatorSource,
    ".seapals-combat-result-breakdown {",
    ".seapals-opponent-placement-layer {",
  );
  assert.match(
    checkpointStyles,
    /\.seapals-combat-result-breakdown \{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    "Attack and defense should remain two side-by-side columns",
  );
  assert.match(
    checkpointStyles,
    /\.seapals-combat-result-side \{[\s\S]*?grid-template-rows:\s*auto 1fr auto/,
    "Each column should hold its total at the bottom after all contributors",
  );
  const continueButton = checkpointMarkup.match(/<button[\s\S]*?>\s*Continue\s*<\/button>/)?.[0] ?? "";
  assert.match(continueButton, /data-combat-result-continue/);
  assert.match(continueButton, /onClick=\{continueCombatResultCheckpoint\}/);
  assert.match(continueButton, /autoFocus/);

  const boardInteractionGate = sourceSection(
    simulatorSource,
    "const boardInteractionOverlayActive =",
    "const v2TopChromeHidden =",
  );
  assert.match(
    boardInteractionGate,
    /combatResultCheckpoint/,
    "Repeat targets and board controls must remain inert while the result awaits Continue",
  );
});

test("Continue is the only gateway from a result into state mutation and discard travel", () => {
  const beginCheckpoint = namedFunctionSection(simulatorSource, "beginCombatResultCheckpoint");
  const continueCheckpoint = namedFunctionSection(simulatorSource, "continueCombatResultCheckpoint");

  assert.match(beginCheckpoint, /setCombatResultCheckpoint\(/);
  assert.doesNotMatch(
    beginCheckpoint,
    /queueConsumedAttackFlight\(/,
    "Showing the result must not start the discard animation",
  );

  assert.match(continueCheckpoint, /setCombatResultCheckpoint\(null\)/);
  assert.match(continueCheckpoint, /queueConsumedAttackFlight\(/);
  assert.match(continueCheckpoint, /checkpoint\.commit\?\.\(\)/);
  assert.ok(
    continueCheckpoint.indexOf("queueConsumedAttackFlight(")
      < continueCheckpoint.indexOf("checkpoint.commit?.()"),
    "Continue must capture the defeated card's geometry before committing the board removal",
  );
});

test("checkpoint identity and accessible copy come from the normalized breakdown", () => {
  const presentationModel = sourceSection(
    simulatorSource,
    "const combatCheckpointBreakdown =",
    "const selectedHandPlayError =",
  );

  assert.match(
    presentationModel,
    /buildCombatResultBreakdown\(combatResultCheckpoint\.event\)/,
  );
  assert.match(
    presentationModel,
    /cardsById\[combatCheckpointBreakdown\.attack\?\.cardId \?\? combatResultCheckpoint\.event\.sourceCardId\]/,
    "Structured attack identity must win over legacy event identity",
  );
  assert.match(
    presentationModel,
    /cardsById\[combatCheckpointBreakdown\.defense\?\.cardId \?\? combatResultCheckpoint\.event\.defenderCardId\]/,
    "Structured defense identity must win over legacy event identity",
  );
  assert.match(presentationModel, /combatCheckpointSourceName = combatCheckpointBreakdown\.attack\?\.name \|\| combatCheckpointSourceCard\?\.name/);
  assert.match(presentationModel, /combatCheckpointDefenderName = combatCheckpointBreakdown\.defense\?\.name \|\| combatCheckpointDefenderCard\?\.name/);
  assert.match(presentationModel, /combatCheckpointBreakdown\.attack\.actionName/);
  assert.match(presentationModel, /combatCheckpointBreakdown\.attack\.contributors\.map/);
  assert.match(presentationModel, /combatCheckpointBreakdown\.defense\.contributors\.map/);
  assert.doesNotMatch(
    presentationModel,
    /event\.checkpointMessage|event\.message/,
    "The accessible summary should describe the same structured rows instead of reviving the long paragraph",
  );
});

test("Continue is claimed once before it can commit or advance combat", () => {
  assert.match(
    simulatorSource,
    /const combatResultCheckpointRef = useRef\(null\)/,
    "The delayed checkpoint needs a synchronous one-shot guard, not only an asynchronous state update",
  );
  const beginCheckpoint = namedFunctionSection(simulatorSource, "beginCombatResultCheckpoint");
  const continueCheckpoint = namedFunctionSection(simulatorSource, "continueCombatResultCheckpoint");

  assert.match(beginCheckpoint, /combatResultCheckpointRef\.current\s*=/);
  assert.match(continueCheckpoint, /const checkpoint = combatResultCheckpointRef\.current/);
  assert.match(continueCheckpoint, /if \(!checkpoint\) return/);
  assert.match(continueCheckpoint, /combatResultCheckpointRef\.current\s*=\s*null/);
  assert.ok(
    continueCheckpoint.indexOf("combatResultCheckpointRef.current = null")
      < continueCheckpoint.indexOf("queueConsumedAttackFlight("),
    "Continue must be claimed before discard, commit, or queue side effects can run",
  );
});

test("delayed Continue retains exact-instance geometry when duplicate cards are in play", () => {
  const beginCheckpoint = namedFunctionSection(simulatorSource, "beginCombatResultCheckpoint");
  const discardFlight = namedFunctionSection(simulatorSource, "queueConsumedAttackFlight");
  const attackResolution = sourceSection(
    simulatorSource,
    "function resolvePlayerAttack(",
    "function applyPlayerOnPlayDeckDiscard(",
  );
  const checkpointPlumbing = `${beginCheckpoint}\n${attackResolution}`;
  const premeasuresSource = Boolean(
    (
      /(?:sourceRect|sourceGeometry|startRect)\s*:/.test(checkpointPlumbing)
      && /sourceRect|sourceGeometry|startRect/.test(discardFlight)
    )
    || (
      /discardFlightPlan:\s*discardCue\s*\?\s*createConsumedAttackFlightPlan\(discardCue\)/.test(beginCheckpoint)
      && /flightPlan\s*\?\?\s*createConsumedAttackFlightPlan\(/.test(discardFlight)
    )
    || (
      /sourceGeometry:\s*discardCue\s*\?\s*createConsumedAttackFlightPlan\(discardCue\)/.test(beginCheckpoint)
      && /sourceGeometry\s*\?\?\s*createConsumedAttackFlightPlan\(/.test(discardFlight)
    ),
  );
  const usesStableInstanceMarker = Boolean(
    /data-(?:card-)?instance[^\n]*targetInstanceId/.test(discardFlight)
    && /data-(?:card-)?instance/.test(simulatorSource),
  );

  assert.ok(
    premeasuresSource || usesStableInstanceMarker,
    "The checkpoint must premeasure its consumed card or resolve a stable instance marker; cardId fallback is ambiguous after a delayed Continue",
  );
});

test("reef, orphan, and slot cards expose stable physical instance geometry on both boards", () => {
  const discardFlightPlan = namedFunctionSection(simulatorSource, "createConsumedAttackFlightPlan");
  assert.match(
    discardFlightPlan,
    /sourceBoard\?\.querySelectorAll\("\[data-card-instance-id\], \[data-combat-target-id\]"\)[\s\S]*?node\.dataset\.cardInstanceId === targetInstanceId[\s\S]*?node\.dataset\.combatTargetId === targetInstanceId/,
    "Discard geometry should resolve the exact physical instance before falling back to a duplicate card ID",
  );
  assert.ok(
    discardFlightPlan.indexOf("sourceInstanceNode")
      < discardFlightPlan.indexOf('querySelectorAll("[data-card-id]")'),
    "Exact instance geometry must win over the ambiguous card-ID fallback",
  );

  const opponentBoard = sourceSection(
    simulatorSource,
    '<div id="simulator-opponent-reef"',
    '<div id="simulator-player-reef"',
  );
  assert.match(
    opponentBoard,
    /data-card-instance-id=\{opponent\.reefCreatureInstances\?\.\[index\]\?\.instanceId\}/,
    "Opponent open-water cards need their persistent reef occurrence ID",
  );
  assert.match(
    opponentBoard,
    /opponent\.orphanCreatures\.map\([\s\S]*?data-card-instance-id=\{entry\.instanceId\}/,
    "Opponent orphan cards need their persistent orphan occurrence ID",
  );
  assert.match(
    opponentBoard,
    /opponentCorals\.map\([\s\S]*?data-card-instance-id=\{slotCard \? getLionfishSlotInstanceId\(coral, slot\) : undefined\}/,
    "Opponent slotted cards need the same instance ID used by Lionfish targeting",
  );
  assert.match(
    opponentBoard,
    /data-combat-target-id=\{slotCard \? getSlotTargetInstanceId\(slot\) : undefined\}/,
    "Opponent slotted cards need their normal-combat target alias",
  );

  const playerBoard = sourceSection(
    simulatorSource,
    '<div id="simulator-player-reef"',
    "{combatResultCheckpoint ? (",
  );
  assert.match(
    playerBoard,
    /playerReefCreatures\.map\([\s\S]*?data-card-instance-id=\{playerReefCreatureInstances\[index\]\?\.instanceId\}/,
    "Player open-water cards need their persistent reef occurrence ID",
  );
  assert.match(
    playerBoard,
    /playerOrphanCreatures\.map\([\s\S]*?data-card-instance-id=\{entry\.instanceId\}/,
    "Player orphan cards need their persistent orphan occurrence ID",
  );
  assert.match(
    playerBoard,
    /playerCorals\.map\([\s\S]*?data-card-instance-id=\{getLionfishSlotInstanceId\(coral, slot\)\}/,
    "Player slotted cards need the same instance ID used by Lionfish targeting",
  );
  assert.match(
    playerBoard,
    /data-combat-target-id=\{getSlotTargetInstanceId\(slot\)\}/,
    "Player slotted cards need their normal-combat target alias",
  );
});

test("player attacks checkpoint both the success and defense result before any removal", () => {
  const attackResolution = sourceSection(
    simulatorSource,
    "function resolvePlayerAttack(",
    "function applyPlayerOnPlayDeckDiscard(",
  );
  const ordinarySuccess = sourceSection(
    attackResolution,
    "let nextOpponentState = nextOpponentProjection.state;",
    "} else {\n      const biteBack",
  );
  const defendedResult = attackResolution.slice(
    attackResolution.indexOf("} else {\n      const biteBack"),
  );

  assert.match(
    ordinarySuccess,
    /beginCombatResultCheckpoint\(resultOverlay,\s*\{[\s\S]*?playerRole:\s*"attacker"[\s\S]*?discardCue:/,
    "A successful player attack should stage the result and its optional consumed-card cue together",
  );
  const successCheckpointIndex = ordinarySuccess.indexOf("beginCombatResultCheckpoint(");
  const eagerOpponentCommitIndex = ordinarySuccess.indexOf("setOpponent(nextOpponentState)");
  assert.ok(
    eagerOpponentCommitIndex < 0 || eagerOpponentCommitIndex > successCheckpointIndex,
    "The defeated opponent card must remain on the board while the success checkpoint is visible",
  );
  assert.doesNotMatch(
    ordinarySuccess.slice(0, successCheckpointIndex),
    /setDiscardPile\(|setLostZone\(/,
    "No consumed player card may enter a pile before the success checkpoint",
  );
  assert.doesNotMatch(
    ordinarySuccess,
    /queueConsumedAttackFlight\(/,
    "Player attack resolution should defer discard travel to the checkpoint's Continue handler",
  );
  assert.match(
    ordinarySuccess,
    /const message = `\$\{matchupSentence\} The attack succeeded\.\$\{ensnareSummary\}\$\{survivalMessage\}/,
    "The detailed activity log should retain the complete resolution",
  );
  assert.match(ordinarySuccess, /pushLog\(message\)/);
  assert.match(
    ordinarySuccess,
    /resultOverlay = \{[\s\S]*?message,[\s\S]*?combatBreakdown,/,
    "The held result should carry structured arithmetic while the activity log keeps its detailed sentence",
  );

  assert.match(
    defendedResult,
    /beginCombatResultCheckpoint\(resultOverlay,\s*\{[\s\S]*?playerRole:\s*"attacker"[\s\S]*?discardCue:\s*counterSucceeded\s*\?[\s\S]*?commit:\s*commitResolution/,
    "A failed player attack needs the same checkpoint, with any Bite Back removal deferred behind Continue",
  );
});

test("player combat exposes every applied contributor and rebuilds attack arithmetic after Scatter", () => {
  const attackResolution = sourceSection(
    simulatorSource,
    "function resolvePlayerAttack(",
    "function applyPlayerOnPlayDeckDiscard(",
  );
  const schoolBranch = sourceSection(
    attackResolution,
    'if (targetSlotId === "__foundation__" && isCreatureSchool(targetEntry.card))',
    "const defenseDice = targetEntry.card.defense?.dice ?? targetEntry.card.defense;",
  );
  assert.match(
    schoolBranch,
    /contributors:\s*\[[\s\S]*?id:\s*"attack-roll"[\s\S]*?combatContributorsFromDetails\([\s\S]*?total:\s*attackRolls\.reduce\([\s\S]*?defense:\s*null/,
    "Creature School results should retain the roll and each attack modifier without inventing defense",
  );

  const opposedBranch = attackResolution.slice(
    attackResolution.indexOf("const defenseDice = targetEntry.card.defense?.dice ?? targetEntry.card.defense;"),
  );
  assert.match(opposedBranch, /let appliedAttackRoll = chosenAttackRoll/);
  assert.match(opposedBranch, /let appliedAttackDetails = \[\.\.\.modifier\.details, rolledBonus\.detail\]\.filter\(Boolean\)/);
  assert.match(
    opposedBranch,
    /if \(attackTotal > defenseTotal && cardHasScatter\(targetEntry\.card\)\)[\s\S]*?attackTotal = scatterBase \+ scatterModifier\.flat \+ scatterRolledBonus\.flat \+ rovLightsBonus \+ flashingAlarmBonus;[\s\S]*?appliedAttackRoll = scatterBase;[\s\S]*?appliedAttackDetails = \[\.\.\.scatterModifier\.details, scatterRolledBonus\.detail\]\.filter\(Boolean\)/,
    "A Scatter reroll must replace the original roll and modifier rows rather than showing stale arithmetic",
  );
  const combatBreakdown = sourceSection(opposedBranch, "const combatBreakdown = {", "const rolls = [");
  assert.match(combatBreakdown, /attack:\s*\{[\s\S]*?cardId:\s*attacker\.id[\s\S]*?actionName:\s*attack\.actionName/);
  assert.match(combatBreakdown, /id:\s*"attack-roll"/);
  assert.match(combatBreakdown, /combatContributorsFromDetails\(/);
  assert.match(combatBreakdown, /ROV Lights/);
  assert.match(combatBreakdown, /Flashing Alarm/);
  assert.match(combatBreakdown, /total:\s*attackTotal/);
  assert.match(combatBreakdown, /defense:\s*\{[\s\S]*?cardId:\s*targetEntry\.card\.id/);
  assert.match(combatBreakdown, /\.\.\.\(defenseAdjustment\.contributors \?\? \[\]\)/);
  for (const contributor of [
    "defense-roll",
    "Cloak",
    "Darkness Shroud",
    "Shelter",
    "Stinging Fortress",
  ]) {
    assert.match(combatBreakdown, new RegExp(contributor), `Missing player-combat contributor: ${contributor}`);
  }
  assert.match(combatBreakdown, /statusDefenseRolls\.map/);
  assert.match(combatBreakdown, /total:\s*defenseTotal/);
  assert.equal(
    (opposedBranch.match(/\bcombatBreakdown,\s*attackNumber:\s*sequenceResult\.resolvedCount,\s*attackCount:\s*sequenceResult\.requiredCount/g) ?? []).length,
    3,
    "Own-invader removal, ordinary success, and defended/Bite Back results must share the final breakdown and attack ordinal",
  );
});

test("opponent combat carries its structured breakdown through Regenerate and ordinary result events", () => {
  const resolver = sourceSection(
    simulatorSource,
    "function runOpponentAttackStep(",
    "function runOpponentAttack(",
  );
  const defenseContributors = sourceSection(
    resolver,
    "const defenseContributors = [{",
    "const advantageRoll =",
  );
  for (const contributor of [
    "defense-roll",
    "Cloak",
    "Darkness Shroud",
    "Shelter",
    "Stinging Fortress",
    "defense-action-",
  ]) {
    assert.match(defenseContributors, new RegExp(contributor), `Missing opponent-combat contributor: ${contributor}`);
  }
  assert.match(defenseContributors, /defenseAdjustment\.contributors/);
  assert.match(
    defenseContributors,
    /\.forEach\(\(status, statusIndex\)[\s\S]*?id:\s*`defense-action-\$\{status\.sourceCardId \?\? status\.dice\}-\$\{statusIndex\}`/,
    "Repeated defense statuses need unique row keys",
  );
  const defenseAdjustment = sourceSection(
    simulatorSource,
    "function getDefenseAdjustment(",
    "function getRolledAttackBonus(",
  );
  for (const contributor of ["Fish penalty", "Ensnare", "Attack effect"]) {
    assert.match(defenseAdjustment, new RegExp(contributor), `Missing defense-penalty contributor: ${contributor}`);
  }
  assert.match(
    resolver,
    /if \(attackTotal > defenseTotal && cardHasScatter\(targetEntry\.card\)\)[\s\S]*?appliedAttackRoll = scatterBase;[\s\S]*?appliedAttackDetails = \[\.\.\.scatterModifier\.details, scatterRolledBonus\.detail\]\.filter\(Boolean\)/,
  );
  assert.match(
    resolver,
    /combatRollSummary = \{[\s\S]*?combatBreakdown:\s*\{[\s\S]*?cardId:\s*attackerEntry\.card\.id[\s\S]*?actionName:\s*attackerEntry\.attack\.actionName[\s\S]*?contributors:\s*attackContributors[\s\S]*?cardId:\s*targetEntry\.card\.id[\s\S]*?contributors:\s*defenseContributors/,
    "The opponent resolver should return structured arithmetic with the projected combat result",
  );

  const eventBuilder = sourceSection(
    simulatorSource,
    "function buildOpponentAttackEventSequence(",
    "function preserveOpponentNormalActionsAfterOnPlay(",
  );
  assert.equal(
    (eventBuilder.match(/combatBreakdown:\s*step\.combatBreakdown \?\? null/g) ?? []).length,
    2,
    "Both choose-Regenerate and faceoff-result events must retain the same breakdown",
  );
  assert.match(eventBuilder, /type:\s*"choose-regenerate"[\s\S]*?combatBreakdown:\s*step\.combatBreakdown \?\? null/);
  assert.match(eventBuilder, /type:\s*step\.noLegalTarget \? "opponent-impact" : "faceoff-result"[\s\S]*?combatBreakdown:\s*step\.combatBreakdown \?\? null/);
});

test("queued combat consumes explicit player role and outcome before committing projected state", () => {
  const presenter = sourceSection(
    simulatorSource,
    "function presentQueuedEvent(event, remainingEvents = [],",
    "function closeEventOverlay()",
  );
  const opponentCombatBranch = sourceSection(
    presenter,
    "&& event.type === \"faceoff-result\"",
    "if (compactTurnPresentationEnabled && shouldShowCompactOpponentCardReader(event))",
  );

  assert.doesNotMatch(
    opponentCombatBranch.split("beginCombatResultCheckpoint(")[0],
    /combatDiscardCue/,
    "The checkpoint gate must include defended/failed opponent attacks that have no discard cue",
  );
  assert.match(
    opponentCombatBranch,
    /beginCombatResultCheckpoint\(event,\s*\{[\s\S]*?playerRole:\s*event\.combatPlayerRole\s*\?\?\s*\(event\.combatAttackerOwner === "player" \? "attacker" : "defender"\)[\s\S]*?outcome:\s*event\.combatOutcome\s*\?\?[\s\S]*?discardCue:\s*event\.combatDiscardCue\s*\?\?\s*null/,
    "The presenter must prefer the resolver's explicit perspective and outcome over opponent-only inference",
  );
  assert.match(
    opponentCombatBranch,
    /commit:\s*\(\)\s*=>\s*commitEventState\(event\)/,
    "The post-combat player snapshot must be deferred until Continue",
  );
  assert.doesNotMatch(
    opponentCombatBranch,
    /queueConsumedAttackFlight\(/,
    "Queued opponent attacks must not launch a discard before the shared Continue handler",
  );
  assert.ok(
    opponentCombatBranch.indexOf("beginCombatResultCheckpoint(")
      < opponentCombatBranch.indexOf("commitEventState(event)"),
    "The opponent result checkpoint must be staged before its board mutation callback",
  );
});

test("Lionfish result events expose perspective, final totals, and an exact discard cue", () => {
  const resolver = sourceSection(
    simulatorSource,
    "function resolveHostTurnLionfishInvaders({",
    "function createDeck(",
  );
  assert.match(
    resolver,
    /const combatPlayerRole = invader\.controller === "player"\s*\? "attacker"\s*:\s*targetController === "player"\s*\? "defender"\s*:\s*"observer"/,
    "Lionfish combat must describe the player's actual role even when the invader is player-controlled",
  );
  assert.match(
    resolver,
    /const getCombatOutcome = \(attackerWins\) => combatPlayerRole === "defender"[\s\S]*?"defense-broken"[\s\S]*?"defense-held"[\s\S]*?"attack-succeeded"[\s\S]*?"attack-blocked"/,
  );

  const resultEvents = [...resolver.matchAll(
    /events\.push\(\{\n\s*type:\s*"faceoff-result",[\s\S]*?^\s+\}\);/gm,
  )].map((match) => match[0]);
  assert.equal(resultEvents.length, 6, "Every Lionfish result branch should remain covered");
  for (const resultEvent of resultEvents) {
    assert.match(resultEvent, /\bcombatPlayerRole(?:\s*,|\s*:)/);
    assert.match(resultEvent, /\bcombatOutcome(?:\s*,|\s*:)/);
  }

  const schoolResult = resultEvents.find((event) => event.includes("primaryAttackRoll: attackRoll.total"));
  assert.ok(schoolResult, "Expected the resolved Creature School result event");
  assert.match(
    schoolResult,
    /primaryAttackRoll:\s*attackRoll\.total[\s\S]*?primaryDefenseRoll:\s*null[\s\S]*?attackTotal:\s*attackRoll\.total[\s\S]*?defenseTotal:\s*null/,
    "Creature School results should expose their final damage roll rather than omit combat totals",
  );
  assert.match(
    schoolResult,
    /combatBreakdown:\s*\{[\s\S]*?attack:\s*\{[\s\S]*?cardId:\s*"lionfish"[\s\S]*?actionName:\s*"Invader"[\s\S]*?contributors:\s*\[[\s\S]*?value:\s*attackRoll\.total[\s\S]*?total:\s*attackRoll\.total[\s\S]*?defense:\s*null/,
    "Creature School invader results should show a single attack column",
  );
  assert.match(
    schoolResult,
    /combatDiscardCue:\s*schoolRemoved \? \{[\s\S]*?cardId:\s*target\.cardId[\s\S]*?targetInstanceId:\s*target\.instanceId[\s\S]*?sourceOwner:\s*target\.physicalController[\s\S]*?destinationOwner:\s*target\.controller[\s\S]*?destinationZone:\s*destroyedCardGoesToLostZone\(target\.card\) \? "lost" : "discard"[\s\S]*?\}\s*:\s*null/,
  );

  const opposedResult = resultEvents.find((event) => event.includes("primaryAttackRoll: opposed.attack.total"));
  assert.ok(opposedResult, "Expected the resolved opposed-roll result event");
  assert.match(
    opposedResult,
    /primaryAttackRoll:\s*opposed\.attack\.total[\s\S]*?primaryDefenseRoll:\s*opposed\.defense\.total[\s\S]*?attackTotal,[\s\S]*?defenseTotal,/,
    "The banner must receive the modified final totals, not just the primary dice",
  );
  assert.match(
    opposedResult,
    /combatBreakdown:\s*\{[\s\S]*?attack:\s*\{[\s\S]*?cardId:\s*"lionfish"[\s\S]*?value:\s*attackTotal[\s\S]*?total:\s*attackTotal[\s\S]*?defense:\s*\{[\s\S]*?cardId:\s*target\.cardId[\s\S]*?value:\s*baseDefenseTotal[\s\S]*?Shelter[\s\S]*?Stinging Fortress[\s\S]*?statusDefenseRolls\.map[\s\S]*?Cloak[\s\S]*?Darkness Shroud[\s\S]*?total:\s*defenseTotal/,
    "Lionfish opposed results should identify both sides and every applied defense source",
  );
  assert.match(opposedResult, /combatOutcome:\s*getCombatOutcome\(attackerWins\)[\s\S]*?combatDiscardCue,/);

  const ordinaryRemoval = sourceSection(
    resolver,
    "let combatDiscardCue = null;",
    "const targetDestination =",
  );
  assert.match(
    ordinaryRemoval,
    /if \(!defenderKept && removal\.removed\)[\s\S]*?combatDiscardCue = \{[\s\S]*?cardId:\s*target\.cardId[\s\S]*?targetInstanceId:\s*target\.instanceId[\s\S]*?sourceOwner:\s*target\.physicalController[\s\S]*?destinationOwner:\s*target\.controller[\s\S]*?destinationZone:\s*destroyedCardGoesToLostZone\(target\.card\) \? "lost" : "discard"/,
    "The cue must follow the exact target from its physical board to its logical owner's pile",
  );
});

test("both Regenerate choices checkpoint before an exact declined removal and a current pending queue", () => {
  const regenerateChoice = sourceSection(
    simulatorSource,
    "function resolvePlayerRegenerateChoice(choice)",
    "function endTurn()",
  );

  assert.match(
    regenerateChoice,
    /const regenerateResultEvent = \{[\s\S]*?type:\s*"faceoff-result"[\s\S]*?title:\s*resolution\.keepDefender \? "Regenerate Chosen" : "Regenerate Declined"[\s\S]*?combatOutcome:\s*resolution\.keepDefender \? "defense-held" : "defense-broken"/,
    "Choosing or declining Regenerate should produce one explicit combat result event",
  );
  assert.match(
    regenerateChoice,
    /const regenerateDiscardCue = resolution\.keepDefender \? null : \{[\s\S]*?cardId:\s*defender\.id[\s\S]*?targetInstanceId:\s*pending\.targetInstanceId[\s\S]*?\?\? targetLocation\.reefInstanceId[\s\S]*?\?\? targetLocation\.orphanInstanceId[\s\S]*?sourceSlotId:\s*targetLocation\.slotId \?\? null[\s\S]*?sourceOwner:\s*"player"[\s\S]*?destinationOwner:\s*"player"[\s\S]*?destinationZone:\s*destroyedCardGoesToLostZone\(defender\) \? "lost" : "discard"/,
    "Declining must retain the exact physical defender and its rules-correct destination",
  );

  const checkpointCalls = regenerateChoice.match(
    /beginCombatResultCheckpoint\(regenerateResultEvent,\s*\{[\s\S]*?playerRole:\s*"defender"[\s\S]*?outcome:\s*regenerateResultEvent\.combatOutcome[\s\S]*?discardCue:\s*regenerateDiscardCue[\s\S]*?commit:\s*\(\)\s*=>\s*commitEventState\(regenerateResultEvent\)[\s\S]*?remainingEvents:\s*nextEvents[\s\S]*?\}\);/g,
  ) ?? [];
  assert.equal(
    checkpointCalls.length,
    2,
    "Live and projected Regenerate continuations must both pause on the shared checkpoint",
  );
  assert.doesNotMatch(
    regenerateChoice,
    /(?:setPlayerCorals|setPlayerReefCreatureInstances|setPlayerOrphanCreatureInstances|setDiscardPile|setLostZone|setOpponent)\(/,
    "Declined removal state must not reach the board or piles until Continue invokes commitEventState",
  );

  const liveBranch = sourceSection(
    regenerateChoice,
    "if (liveCombatResume)",
    "const postChoicePlayerState",
  );
  const projectedBranch = regenerateChoice.slice(regenerateChoice.indexOf("const updatedEvents"));
  for (const [label, branch] of [
    ["live Regenerate continuation", liveBranch],
    ["projected Regenerate continuation", projectedBranch],
  ]) {
    const refIndex = branch.indexOf("pendingEventsRef.current = nextEvents");
    const stateIndex = branch.indexOf("setPendingEvents(nextEvents)");
    const checkpointIndex = branch.indexOf("beginCombatResultCheckpoint(regenerateResultEvent");
    assert.ok(refIndex >= 0, `${label} must synchronously publish its next queue to the ref`);
    assert.ok(
      refIndex < stateIndex && stateIndex < checkpointIndex,
      `${label} must update pendingEventsRef before React state and checkpoint presentation`,
    );
  }
});

test("reduced motion keeps the result checkpoint and only shortens the later discard travel", () => {
  const beginCheckpoint = namedFunctionSection(simulatorSource, "beginCombatResultCheckpoint");
  const discardFlightPlan = namedFunctionSection(simulatorSource, "createConsumedAttackFlightPlan");
  const discardFlight = namedFunctionSection(simulatorSource, "queueConsumedAttackFlight");
  const discardMotion = `${discardFlightPlan}\n${discardFlight}`;

  assert.doesNotMatch(beginCheckpoint, /accessibilityReducedMotion|prefers-reduced-motion|matchMedia/);
  assert.match(beginCheckpoint, /setCombatResultCheckpoint\(/);
  assert.match(discardMotion, /const reducedMotion = accessibilityReducedMotion[\s\S]*?prefers-reduced-motion: reduce/);
  assert.match(discardMotion, /const duration = reducedMotion \? 140 : 920/);
  assert.match(discardFlight, /(?:flightPlan|sourceGeometry) \?\? createConsumedAttackFlightPlan\(/);
});

test("Continue serializes repeat attacks and queued opponent attacks after discard completion", () => {
  const continueCheckpoint = namedFunctionSection(simulatorSource, "continueCombatResultCheckpoint");
  const finishMatch = continueCheckpoint.match(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*\(\)\s*=>\s*\{[\s\S]*?continueAfterPresentedEvent\(checkpoint\.event,\s*pendingEventsRef\.current\)/,
  );
  assert.ok(finishMatch, "Continue should preserve the exact result event and read the current queue");
  const finishName = finishMatch[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  assert.match(
    continueCheckpoint,
    new RegExp(`onComplete:\\s*${finishName}`),
    "A consumed card must finish travelling before the repeat/queue advances",
  );
  assert.match(
    continueCheckpoint,
    new RegExp(`if\\s*\\(\\s*!flightQueued\\s*\\)\\s*${finishName}\\(\\)`),
    "Success-with-survival and failed attacks should advance immediately after Continue",
  );
  assert.ok(
    continueCheckpoint.indexOf("queueConsumedAttackFlight(")
      < continueCheckpoint.search(new RegExp(`if\\s*\\(\\s*!flightQueued`)),
    "The no-flight continuation must be chosen only after discard travel was attempted",
  );
});

test("events appended while a checkpoint is open survive completion through the synchronous queue ref", () => {
  const queueEvents = namedFunctionSection(simulatorSource, "queueEvents");
  const continueCheckpoint = namedFunctionSection(simulatorSource, "continueCombatResultCheckpoint");

  assert.match(
    queueEvents,
    /eventOverlay \|\| cardCoinFlip \|\| combatResultCheckpointRef\.current \|\| compactTurnSequenceRef\.current \|\| compactOpponentPresentationRef\.current/,
    "An open combat checkpoint must append rather than present over the held result",
  );
  assert.match(
    queueEvents,
    /setPendingEvents\(\(events\) => \{[\s\S]*?const nextEvents = \[\.\.\.events, \.\.\.eventsToAdd\][\s\S]*?pendingEventsRef\.current = nextEvents[\s\S]*?return nextEvents/,
    "Queue appends must publish synchronously so Continue cannot observe a stale React render",
  );
  assert.match(
    continueCheckpoint,
    /continueAfterPresentedEvent\(checkpoint\.event, pendingEventsRef\.current\)/,
    "Checkpoint completion must read events added after the checkpoint was created",
  );
  assert.doesNotMatch(
    continueCheckpoint,
    /checkpoint\.remainingEvents/,
    "A snapshotted queue tail would drop events appended while the banner was open",
  );
});

test("focus restoration runs only from finishCombatResult after discard travel", () => {
  const continueCheckpoint = namedFunctionSection(simulatorSource, "continueCombatResultCheckpoint");
  const finishCombatResult = sourceSection(
    continueCheckpoint,
    "const finishCombatResult = () => {",
    "    const flightQueued =",
  );
  const outsideFinish = continueCheckpoint.replace(finishCombatResult, "");

  assert.match(
    finishCombatResult,
    /continueAfterPresentedEvent\(checkpoint\.event, pendingEventsRef\.current\)[\s\S]*?window\.requestAnimationFrame\(\(\) => \{[\s\S]*?\.focus\(\)[\s\S]*?combatResultReturnFocusRef\.current = null/,
    "Focus should be restored only after the next combat/queue state has been presented",
  );
  assert.doesNotMatch(outsideFinish, /\.focus\(\)|combatResultReturnFocusRef\.current = null/);
  assert.match(
    continueCheckpoint,
    /queueConsumedAttackFlight\(\{[\s\S]*?onComplete:\s*finishCombatResult/,
    "A discard flight must own the finish callback",
  );
  assert.match(
    continueCheckpoint,
    /if \(!flightQueued\) finishCombatResult\(\)/,
    "Only no-flight results may finish synchronously after Continue",
  );
});
