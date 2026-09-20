import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [simulatorSource, sequenceSource] = await Promise.all([
  readFile(new URL("./Simulator.jsx", import.meta.url), "utf8"),
  readFile(new URL("./compactTurnSequence.mjs", import.meta.url), "utf8"),
]);

function sourceSection(source, startMarker, endMarker) {
  source = source.replaceAll("\r\n", "\n");
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("compact turn presentation is limited to the V2 board without replacing scripted tutorial coaching", () => {
  assert.match(
    simulatorSource,
    /const compactTurnPresentationEnabled = previewExperience && !tutorialUsesScriptedScenario;/,
  );
  assert.match(
    simulatorSource,
    /import \{[\s\S]*?CompactTurnStage,[\s\S]*?allocateCollectedRpSources,[\s\S]*?createCompactTurnStages,[\s\S]*?\} from "\.\/compactTurnSequence\.mjs";/,
  );
  assert.match(
    simulatorSource,
    /import \{[\s\S]*?SIMULATOR_V2_LESSON_CONCEPTS,[\s\S]*?\} from "\.\/simulatorV2Lessons\.mjs";/,
  );
});

test("turn notices stay transient while nonlesson conditions use the compact board reader", () => {
  const compactOverlay = sourceSection(
    simulatorSource,
    "{compactTurnSequence ? <div className=\"seapals-compact-turn-guard",
    "{compactOpponentCardReader ? (",
  );

  assert.match(compactOverlay, /data-compact-turn-banner=\{compactTurnStage\.kind\}/);
  assert.match(
    compactOverlay,
    /compactTurnStage\?\.kind === CompactTurnStage\.CONDITION && !embeddedCompactConditionHelp/,
  );
  assert.match(compactOverlay, /aria-hidden="true"/);
  assert.match(compactOverlay, /<strong>\{compactTurnSequence\.turnLabel\}<\/strong>/);
  assert.match(compactOverlay, /Round \{compactTurnSequence\.roundNumber\} condition/);
  assert.match(compactOverlay, /compactTurnSequence\.condition\?\.text/);
  assert.match(compactOverlay, /role="dialog"/);
  assert.match(compactOverlay, /aria-modal="false"/);
  assert.match(compactOverlay, /data-compact-condition-continue/);
  assert.match(compactOverlay, /onClick=\{continueCompactCondition\}/);
  assert.match(simulatorSource, /className="sr-only" role="status" aria-live="polite" aria-atomic="true"/);
  assert.doesNotMatch(compactOverlay, /aria-modal="true"|bg-slate-950\/80|backdrop-blur-sm/);

  assert.match(simulatorSource, /\.seapals-compact-turn-banner \{[\s\S]*?left: 50vw;[\s\S]*?top: 50dvh;[\s\S]*?width: min\(calc\(100vw - 2rem\), 34rem\);/);
  assert.match(simulatorSource, /translate: none;[\s\S]*?transform: translate\(-50%, -50%\);/);
  assert.doesNotMatch(compactOverlay, /left-1\/2|top-1\/2|-translate-x-1\/2|-translate-y-1\/2/);
  assert.match(simulatorSource, /animation: seapalsCompactTurnBannerIn 920ms ease-in-out both;/);
  assert.match(simulatorSource, /\.seapals-compact-turn-banner\.is-condition \{[\s\S]*?animation: seapalsCompactConditionBannerIn 280ms/);
  assert.match(simulatorSource, /\.seapals-compact-turn-banner\.is-condition[\s\S]*?pointer-events: auto;/);
});

test("Condition and RP-source teaching use the embedded coach only when needed", () => {
  const conditionHelp = sourceSection(
    simulatorSource,
    "const compactTurnStage = compactTurnSequence?.stages?.[compactTurnSequence.stageIndex] ?? null;",
    "const tutorialFaceoffHelp =",
  );
  const embeddedCompactCoach = sourceSection(
    simulatorSource,
    ") : embeddedCompactCoachOpen ? (",
    ") : embeddedLessonCoachOpen ? (",
  );

  assert.match(conditionHelp, /compactTurnStage\?\.kind === CompactTurnStage\.CONDITION/);
  assert.match(
    conditionHelp,
    /compactTutorialConditionActive[\s\S]*?compactTurnSequence\?\.condition/,
  );
  assert.match(
    conditionHelp,
    /embeddedLesson[\s\S]*?!tutorialPreviouslyTaughtConcepts\.includes\(SIMULATOR_V2_LESSON_CONCEPTS\.ROUND_CONDITIONS\)[\s\S]*?compactTutorialConditionActive/,
  );
  assert.match(
    conditionHelp,
    /A Condition changes the rules for both reefs each round\.[\s\S]*?tutorialConditionCard\.name/,
  );
  assert.match(
    conditionHelp,
    /Clear Water makes Predator and Apex cards cost 1 more RP\./,
  );
  assert.match(
    conditionHelp,
    /Every round begins with one card from the shared Condition Deck\.[\s\S]*?both ecosystems[\s\S]*?Tap Clear Water in the middle bar/,
  );
  assert.match(
    conditionHelp,
    /This round's Condition is Coral Disease\. It blocks RP from Corals with the Disease weakness\. Brain Coral is vulnerable, while Mustard Hill Coral is not\./,
  );
  assert.match(conditionHelp, /target:\s*"condition-panel"/);
  assert.match(conditionHelp, /targetLabel:\s*"the active Condition name in the middle bar"/);
  assert.match(conditionHelp, /Tap \$\{tutorialConditionCard\.name\} for its details, then continue\./);
  assert.match(
    conditionHelp,
    /const embeddedCompactRpSourceHelp = compactRpSourceZoomActive[\s\S]*?Every round gives you 1 RP\.[\s\S]*?Photosynthesis[\s\S]*?collect 2 RP this round/,
  );
  assert.match(
    conditionHelp,
    /Your bank increased from \$\{compactTurnSequence\.rpBefore\} RP to \$\{compactTurnSequence\.rpAfter\} RP\.[\s\S]*?Unspent RP stays in your bank/,
  );
  assert.match(
    conditionHelp,
    /Coral Disease blocked Brain Coral's 1 RP\.[\s\S]*?Mustard Hill still produced 2 RP[\s\S]*?varied ecosystem/,
  );
  assert.match(conditionHelp, /const embeddedCompactCoachHelp = embeddedCompactConditionHelp \?\? embeddedCompactRpSourceHelp \?\? embeddedCompactRpHelp/);
  assert.match(
    conditionHelp,
    /const embeddedCompactCoachOpen = Boolean\([\s\S]*?embeddedCompactCoachHelp[\s\S]*?!simulatorExitConfirmationOpen[\s\S]*?!tutorialExitConfirmationOpen[\s\S]*?!gameResult/,
  );
  assert.match(
    embeddedCompactCoach,
    /<ProfessorCoachOverlay placementMode="reef-divider" measureKey=\{`\$\{mobileReefSplit\}:\$\{compactTurnSequence\.stageIndex\}`\}>[\s\S]*?<ProfessorGuideCard[\s\S]*?help=\{embeddedCompactCoachHelp\}/,
  );
  assert.match(
    embeddedCompactCoach,
    /onAdvance=\{compactTurnStage\?\.kind === CompactTurnStage\.CONDITION[\s\S]*?\? null[\s\S]*?: compactTurnStage\?\.kind === CompactTurnStage\.RP_SOURCE_FOCUS[\s\S]*?\? continueCompactRpSourceFocus[\s\S]*?: continueCompactRpSummary\}/,
  );
  assert.match(
    embeddedCompactCoach,
    /advanceLabel=\{compactTurnStage\?\.kind === CompactTurnStage\.RP_SOURCE_FOCUS[\s\S]*?\? "Collect 2 RP"[\s\S]*?: "Continue to draw"\}/,
  );
  assert.equal((embeddedCompactCoach.match(/\bonAdvance=/g) ?? []).length, 1);
  assert.doesNotMatch(embeddedCompactCoach, /data-compact-condition-continue|seapals-compact-turn-banner/);
  assert.match(
    simulatorSource,
    /<EmbeddedLessonActionCue[\s\S]*?help=\{embeddedCompactConditionHelp\}[\s\S]*?active=\{Boolean\(embeddedCompactConditionHelp && embeddedCompactCoachOpen\)\}[\s\S]*?measureKey=\{`embedded-condition:/,
  );
  assert.match(
    simulatorSource,
    /embeddedCompactConditionHelp && embeddedCompactCoachOpen \? " seapals-condition-teaching" : ""/,
  );
  assert.match(
    simulatorSource,
    /\.seapals-game-shell\.seapals-condition-teaching \.seapals-reef-divider \{[\s\S]*?z-index: 76;[\s\S]*?pointer-events: none;[\s\S]*?\.seapals-game-shell\.seapals-condition-teaching \.seapals-reef-divider-condition \{[\s\S]*?pointer-events: auto;/,
  );
  assert.match(
    simulatorSource,
    /const tutorialAnnouncementHelp = embeddedCompactCoachOpen[\s\S]*?\? embeddedCompactCoachHelp[\s\S]*?: tutorialTargetBeaconHelp;[\s\S]*?help: tutorialAnnouncementHelp/,
  );
  assert.match(simulatorSource, /\) : embeddedCompactCoachOpen \? \(/);
});

test("reviewing the highlighted Condition continues its embedded lesson after the rule closes", () => {
  const openDetails = sourceSection(
    simulatorSource,
    "function openActiveConditionDetails()",
    "function closeConditionDetails()",
  );
  const closeDetails = sourceSection(
    simulatorSource,
    "function closeConditionDetails()",
    "function getMobileDrawFlightGeometry(",
  );

  assert.match(openDetails, /if \(!activeCondition\) return/);
  assert.match(
    openDetails,
    /const continueCompactConditionOnClose = Boolean\([\s\S]*?embeddedLessonPresentationStarted[\s\S]*?embeddedCompactConditionHelp[\s\S]*?compactTurnStage\?\.kind === CompactTurnStage\.CONDITION/,
    "only the live embedded Condition teaching step should advance",
  );
  assert.match(openDetails, /type: "condition-detail"/);
  assert.match(openDetails, /continueCompactConditionOnClose,/);
  assert.match(openDetails, /continueLabel: continueCompactConditionOnClose \? "Continue" : undefined/);

  assert.match(closeDetails, /Boolean\(eventOverlay\?\.continueCompactConditionOnClose\)/);
  assert.ok(
    closeDetails.indexOf("setEventOverlay(null)") < closeDetails.indexOf("continueCompactCondition()"),
    "the rule dialog closes before the next compact stage starts",
  );
  assert.match(closeDetails, /if \(continueCompactConditionOnClose\) continueCompactCondition\(\)/);
  assert.match(
    simulatorSource,
    /onClick=\{openActiveConditionDetails\}/,
    "the active Condition pill owns the guided interaction",
  );
});

test("new-round sequencing can teach an RP source before collection and its summary", () => {
  assert.match(
    sequenceSource,
    /return \[[\s\S]*?turnLabel \? \{ kind: CompactTurnStage\.TURN \}[\s\S]*?includeCondition && condition \? \{ kind: CompactTurnStage\.CONDITION \}[\s\S]*?includeRp && includeRpSourceFocus \? \{ kind: CompactTurnStage\.RP_SOURCE_FOCUS \}[\s\S]*?includeRp \? \{ kind: CompactTurnStage\.RP \}[\s\S]*?includeRp && includeRpSummary \? \{ kind: CompactTurnStage\.RP_SUMMARY \}/,
  );

  const startRound = sourceSection(
    simulatorSource,
    "function startRound(nextRound,",
    "function beginOpeningOpponentTurn()",
  );
  assert.match(startRound, /turnLabel: skipTurnBanner \? null : "Your Turn"/);
  assert.match(startRound, /includeCondition: Boolean\(condition && !reuseConditionId\)/);
  assert.match(startRound, /includeRpSourceFocus: explainTutorialBrainCoralRpSource/);
  assert.match(startRound, /includeRp: true/);
  assert.match(startRound, /includeRpSummary: explainTutorialRpCollection/);

  const continuation = sourceSection(
    simulatorSource,
    "function continueAfterPresentedEvent(event, remainingEvents = [])",
    "function presentQueuedEvent(event, remainingEvents = [],",
  );
  assert.match(continuation, /if \(event\?\.beginOpponentAfterClose\)/);
  assert.match(continuation, /if \(event\?\.advanceRoundAfterClose\)/);
  assert.match(continuation, /if \(event\?\.startOpeningPlayerTurnAfterClose\)/);
  assert.match(continuation, /skipTurnBanner: compactTurnPresentationEnabled/);
  assert.match(continuation, /opponentStateOverride: event\.opponentStateAfter \?\? null/);
});

test("RP defers progress for a teacher summary only when earlier lessons have not taught it", () => {
  const startRound = sourceSection(
    simulatorSource,
    "function startRound(nextRound,",
    "function beginOpeningOpponentTurn()",
  );
  const rpSummaryContinue = sourceSection(
    simulatorSource,
    "function continueCompactRpSummary()",
    "function beginCompactTurnSequence({",
  );

  assert.match(startRound, /const tutorialRpEvent = \{[\s\S]*?details:[\s\S]*?context:/);
  assert.match(
    startRound,
    /!tutorialPreviouslyTaughtConcepts\.includes\(SIMULATOR_V2_LESSON_CONCEPTS\.RESOURCE_POINTS\)[\s\S]*?tutorialCheckpointBeforeCollection\?\.actionType === SIMULATOR_TUTORIAL_ACTION_TYPES\.RP_COLLECTED/,
  );
  assert.match(
    startRound,
    /if \(!explainTutorialRpCollection\) \{[\s\S]*?emitTutorialEvent\([\s\S]*?SIMULATOR_TUTORIAL_ACTION_TYPES\.RP_COLLECTED/,
  );
  assert.match(startRound, /includeRpSummary: explainTutorialRpCollection/);
  assert.match(startRound, /tutorialRpEvent: explainTutorialRpCollection \? tutorialRpEvent : null/);
  assert.match(startRound, /conditionId:\s*condition\?\.id \?\? null/);
  assert.match(startRound, /blockedFoundationCount/);
  assert.match(startRound, /producingFoundationCount/);

  const conditionCopy = sourceSection(
    simulatorSource,
    "const embeddedCompactConditionHelp = embeddedLesson",
    "const tutorialFaceoffHelp =",
  );
  assert.match(
    conditionCopy,
    /Coral Disease blocked Brain Coral's 1 RP\. Mustard Hill still produced 2 RP, and the round added 1, so you collected 3 RP\.[\s\S]*?varied ecosystem/,
  );

  assert.match(rpSummaryContinue, /stage\?\.kind !== CompactTurnStage\.RP_SUMMARY/);
  assert.match(rpSummaryContinue, /!sequence \|\| sequence\.finishing/);
  assert.match(
    rpSummaryContinue,
    /const lockedSequence = \{[\s\S]*?finishing: true,[\s\S]*?tutorialRpEvent: null,[\s\S]*?compactTurnSequenceRef\.current = lockedSequence;[\s\S]*?setCompactTurnSequence\(lockedSequence\);/,
  );
  assert.match(
    rpSummaryContinue,
    /emitTutorialEvent\([\s\S]*?SIMULATOR_TUTORIAL_ACTION_TYPES\.RP_COLLECTED,[\s\S]*?tutorialRpEvent\.details,[\s\S]*?tutorialRpEvent\.context/,
  );
  assert.ok(
    rpSummaryContinue.indexOf("emitTutorialEvent(") < rpSummaryContinue.indexOf("advanceCompactTurnSequence(sequence.id)"),
    "RP progress must be emitted before the teacher advances past the summary.",
  );
});

test("the first RP lesson focuses Photosynthesis, restores the camera, then starts collection", () => {
  const startRound = sourceSection(
    simulatorSource,
    "function startRound(nextRound,",
    "function beginOpeningOpponentTurn()",
  );
  const sourceContinue = sourceSection(
    simulatorSource,
    "function continueCompactRpSourceFocus()",
    "function continueCompactRpSummary()",
  );
  const sourceCamera = sourceSection(
    simulatorSource,
    "if (!compactRpSourceZoomActive) return undefined;",
    "if (!playerLayoutSignature || playerViewportTouched || tutorialBoardCardFocusActive) return undefined;",
  );

  assert.match(
    startRound,
    /embeddedLesson\.id === "first-reef"[\s\S]*?tutorialCheckpointBeforeCollection\?\.id === "tutorial-collect-rp"[\s\S]*?condition\?\.id === "clear-water"[\s\S]*?actualCollectedRp === 2/,
  );
  assert.match(startRound, /rpSources\.find\(\(source\) => source\.key === `foundation:\$\{brainCoralRpFoundation\.id\}` && source\.amount > 0\)/);
  assert.match(startRound, /rpSourceFocus: explainTutorialBrainCoralRpSource \? \{[\s\S]*?abilityName: "Photosynthesis"/);

  assert.match(sourceContinue, /stage\?\.kind !== CompactTurnStage\.RP_SOURCE_FOCUS/);
  assert.match(sourceContinue, /rpSourceReturning: true/);
  assert.match(sourceContinue, /accessibilityReducedMotion \|\| systemReducedMotion \? 80 : 520/);
  assert.ok(
    sourceContinue.indexOf("rpSourceReturning: true") < sourceContinue.indexOf("advanceCompactTurnSequence(sequence.id)"),
    "the camera return state must render before collection advances",
  );

  assert.match(sourceCamera, /rpSourceCameraBeforeRef\.current = playerCameraRef\.current/);
  assert.match(sourceCamera, /Math\.min\(2\.15/);
  assert.match(sourceCamera, /commitBoardCamera\("player", rpSourceCameraBeforeRef\.current\)/);
  assert.match(simulatorSource, /const tutorialBoardCardFocusActive = weaknessFocusActive \|\| compactRpSourcePresentationActive/);
  assert.match(simulatorSource, /data-v2-coral-rp-source-arrow="true"/);
  assert.match(simulatorSource, /Brain Coral Photosynthesis: collect 1 RP at the start of your turn\./);
  assert.match(simulatorSource, /Photosynthesis · \+1 RP/);

  const stageEffect = sourceSection(
    simulatorSource,
    "useEffect(() => {\n    const sequence = compactTurnSequence;",
    "useEffect(() => () => {\n    clearCompactTurnAsyncHandles();",
  );
  assert.ok(
    stageEffect.indexOf("CompactTurnStage.RP_SOURCE_FOCUS") < stageEffect.indexOf("stage.kind !== CompactTurnStage.RP"),
    "source teaching must finish before the RP flight stage",
  );
  assert.match(stageEffect, /stage\.kind !== CompactTurnStage\.RP[\s\S]*?launchCompactRpFlights\(sequence\)/);
});

test("both controllers collect RP from stable board sources into a counting RP bank", () => {
  const sourcePlan = sourceSection(
    simulatorSource,
    "function getEcosystemStartTurnRpSources(playerCorals, activeCondition = null)",
    "function getEcosystemCreatureCardIds(",
  );
  assert.match(sourcePlan, /\{ key: "round-supply", amount: 1 \}/);
  assert.match(sourcePlan, /`foundation:\$\{coral\.id\}`/);
  assert.match(sourcePlan, /`slot:\$\{slot\.id\}`/);
  assert.match(sourcePlan, /if \(slot\.invasiveOwner\) return;/);

  const flightLogic = sourceSection(
    simulatorSource,
    "function launchCompactRpFlights(sequence)",
    "useEffect(() => {\n    const sequence = compactTurnSequence;",
  );
  assert.match(flightLogic, /allocateCollectedRpSources\(sequence\.rpSources, sequence\.collectedRp\)/);
  assert.match(flightLogic, /\[data-rp-bank-target="\$\{sequence\.owner\}"\]/);
  assert.match(flightLogic, /\[data-board-owner="\$\{sequence\.owner\}"\] \[data-rp-source-key="\$\{coin\.sourceKey\}"\]/);
  assert.match(flightLogic, /const neutralSourceRect = document\.querySelector\('\[data-rp-source-key="round-supply"\]'\)/);
  assert.match(flightLogic, /const resolvedSourceRect = sourceRect\?\.width \? sourceRect : neutralSourceRect\?\.width \? neutralSourceRect : null/);
  assert.match(flightLogic, /Math\.min\([\s\S]*?sequence\.rpAfter,[\s\S]*?Number\(current\[sequence\.owner\] \?\? sequence\.rpBefore\) \+ 1/);

  assert.match(simulatorSource, /data-rp-bank-target="opponent"[\s\S]*?<strong>\{presentedOpponentRp\}<\/strong>/);
  assert.match(simulatorSource, /data-rp-bank-target="player"[\s\S]*?<strong>\{presentedPlayerRp\}<\/strong>/);
  assert.match(simulatorSource, /data-rp-source-key=\{`foundation:\$\{coral\.id\}`\}/);
  assert.match(simulatorSource, /data-rp-source-key=\{slotCard && !slot\.invasiveOwner \? `slot:\$\{slot\.id\}` : undefined\}/);
  assert.match(simulatorSource, /data-rp-source-key="round-supply"/);
  assert.match(simulatorSource, /data-compact-rp-flight-layer/);
  assert.match(simulatorSource, /data-rp-source=\{flight\.sourceKey\}/);

  const opponentTurn = sourceSection(
    simulatorSource,
    "function runOpponentTurn(current,",
    "function cancelOpeningCoinFlip()",
  );
  assert.match(opponentTurn, /const startTurnCorals = current\.corals\.map/);
  assert.match(opponentTurn, /const rpSources = getEcosystemStartTurnRpSources\(startTurnCorals, activeCondition\)\.map/);
  assert.match(opponentTurn, /bankBefore: rpBeforeCollection/);
  assert.match(opponentTurn, /rpSources,/);
});

test("mandatory draw UI stays closed until the compact sequence completes", () => {
  const drawGate = sourceSection(
    simulatorSource,
    "if (!previewDrawTrayEnabled) {",
    "if (compactDrawViewport || !mobileDrawSequenceActiveRef.current) return;",
  );
  assert.match(drawGate, /if \(compactTurnSequence \|\| eventOverlay\) \{[\s\S]*?setMobileDrawTrayOpen\(false\);[\s\S]*?return;/);
  assert.match(drawGate, /\}, \[compactTurnSequence, eventOverlay,/);
  assert.match(
    simulatorSource,
    /open=\{mobileDrawTrayOpen && modal === "turn-draw" && !eventOverlay && !compactTurnSequence\}/,
  );
  assert.match(
    simulatorSource,
    /const fullPageModalOpen = Boolean\(modal && !compactTurnSequence/,
  );

  const finishSequence = sourceSection(
    simulatorSource,
    "function finishCompactTurnSequence(sequenceId)",
    "function advanceCompactTurnSequence(sequenceId)",
  );
  assert.ok(
    finishSequence.indexOf("setCompactTurnSequence(null)") < finishSequence.indexOf("completion?.()"),
    "The compact sequence must clear before its draw/continuation callback runs.",
  );
});

test("legacy boards retain the full-page event path", () => {
  const startRound = sourceSection(
    simulatorSource,
    "function startRound(nextRound,",
    "function beginOpeningOpponentTurn()",
  );
  assert.match(startRound, /if \(condition && !compactTurnPresentationEnabled\) \{[\s\S]*?type: "condition-reveal"/);
  assert.match(startRound, /if \(compactTurnPresentationEnabled\) \{[\s\S]*?beginCompactTurnSequence\([\s\S]*?\} else \{[\s\S]*?setPendingEvents\(startTurnEvents\)/);

  const legacyOverlay = sourceSection(
    simulatorSource,
    "{eventOverlay && boardTargetingPresentationActive && !openingCoinBoardActive ? (",
    "{fullPageModalOpen ? (",
  );
  assert.match(legacyOverlay, /role="dialog"/);
  assert.match(legacyOverlay, /aria-modal="true"/);
  assert.match(legacyOverlay, /eventOverlay\.type === "condition-reveal"/);
  assert.match(legacyOverlay, /eventOverlay\.type === "opponent-status"/);
  assert.match(legacyOverlay, /eventOverlay\.type === "turn-transition"/);
});
