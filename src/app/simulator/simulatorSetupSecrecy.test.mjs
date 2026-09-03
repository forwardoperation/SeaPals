import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = (await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8"))
  .replaceAll("\r\n", "\n");
const tutorialV2PageSource = (await readFile(new URL("../instructions/tutorial-v2/page.jsx", import.meta.url), "utf8"))
  .replaceAll("\r\n", "\n");
const standaloneTutorialConfigSource = (await readFile(new URL("../instructions/tutorial/standaloneTutorialConfig.mjs", import.meta.url), "utf8"))
  .replaceAll("\r\n", "\n");

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("every V2 match conceals the rival setup card for the entire setup phase", () => {
  assert.match(
    simulatorSource,
    /const opponentSetupConcealed = previewExperience && isSetup;/,
    "secrecy should follow the setup phase, including the opening toss, rather than a transient coin-overlay state",
  );
  assert.doesNotMatch(
    simulatorSource,
    /const opponentSetupConcealed\s*=\s*[^;]*(?:!tutorialUsesScriptedScenario|!tutorialRuntime)/,
    "tutorial/story flags must not expose the rival setup play in the V2 board",
  );
});

test("the scripted V2 tutorial opening toss cannot bypass setup secrecy", () => {
  assert.match(
    tutorialV2PageSource,
    /<StandaloneTutorial[\s\S]*?previewExperience[\s\S]*?\/>/,
    "the tutorial-v2 route should be covered because it mounts the preview board",
  );
  assert.match(
    standaloneTutorialConfigSource,
    /tutorial:\s*\{[\s\S]*?scriptedDecks:\s*true/,
    "the regression fixture should continue to model the scripted tutorial that exposed its rival foundation",
  );

  const scriptedTutorialOpeningToss = {
    previewExperience: true,
    isSetup: true,
    tutorialUsesScriptedScenario: true,
  };
  assert.equal(
    scriptedTutorialOpeningToss.previewExperience && scriptedTutorialOpeningToss.isSetup,
    true,
    "a scripted V2 tutorial must render the concealed setup presentation during its opening toss",
  );
});

test("the concealed rival foundation is an identity-free, non-interactive card back", () => {
  const opponentFoundationBoard = sourceSection(
    simulatorSource,
    "{opponentCorals.length ? opponentCorals.map((coral, coralIndex) => {",
    ") : <div className=\"absolute inset-0 flex items-center justify-center\">",
  );
  const concealedBranch = sourceSection(
    opponentFoundationBoard,
    "opponentSetupConcealed ? (",
    ") : (",
  );

  assert.match(concealedBranch, /data-opponent-setup-concealed/);
  assert.match(concealedBranch, /src=\{CARD_ART_FALLBACK\}|src=\"\/images\/brand\/SeaPalsTCGLogoWhite\.svg\"/);
  assert.match(simulatorSource, /const CARD_ART_FALLBACK = \"\/images\/brand\/SeaPalsTCGLogoWhite\.svg\";/);
  assert.match(concealedBranch, /aria-label=\"[^\"]*(?:face[- ]down|hidden)[^\"]*\"/i);
  assert.doesNotMatch(concealedBranch, /<button|onClick=|setInspectedCard/);
  assert.doesNotMatch(concealedBranch, /data-card-id|data-card-instance-id|data-rp-source-key|data-attack-target/);
  assert.doesNotMatch(concealedBranch, /card\?*\.(?:image|name)|FoundationVitals/);

  assert.match(
    opponentFoundationBoard,
    /(?:opponentSetupConcealed\s*\?\s*null\s*:\s*|!opponentSetupConcealed\s*&&\s*)coral\.slots\.map/,
    "slot count and slot types must not reveal which setup foundation is face down",
  );
  assert.match(opponentFoundationBoard, /data-card-id=\{coral\.cardId\}/);
  assert.match(opponentFoundationBoard, /setInspectedCard\(\{ owner: "opponent"/);
});

function assertConcealedOpponentScoreSurface(surfaceSource, surfaceName) {
  assert.match(
    surfaceSource,
    /\{opponentSetupConcealed \? \(/,
    `${surfaceName} should replace the rival totals with a dedicated setup mask`,
  );

  const concealedBranch = sourceSection(
    surfaceSource,
    "{opponentSetupConcealed ? (",
    ") : (",
  );

  for (const abbreviation of ["SD", "VP", "RP"]) {
    assert.match(
      concealedBranch,
      new RegExp(`\\b${abbreviation}\\b`),
      `${surfaceName} should retain the ${abbreviation} heading while masking its value`,
    );
  }
  assert.match(
    `${surfaceSource}\n${concealedBranch}`,
    /(?:aria-label|title)=\{?[^\n>]*"[^"]*(?:hidden|reveal)[^"]*"/i,
    `${surfaceName} should explain the generic setup mask to assistive technology and pointer users`,
  );
  assert.match(
    concealedBranch,
    /(?:>|\{\s*")(?:—|Hidden|\?)(?:<|"\s*\})/i,
    `${surfaceName} should show a non-numeric placeholder instead of rival totals`,
  );
  assert.doesNotMatch(concealedBranch, /opponentVp|presentedOpponentRp|opponent\.rp|opponentRpCap/);
  assert.doesNotMatch(concealedBranch, /opponentSchoolDensity|School Density available|SD used/);
  assert.doesNotMatch(
    concealedBranch,
    /<AnimatedVpBadge/,
    `${surfaceName} must not mount the animated VP value while setup totals are concealed`,
  );

  assert.match(surfaceSource, /<AnimatedVpBadge\s+value=\{opponentVp\}/);
  assert.match(surfaceSource, /presentedOpponentRp|opponent\.rp/);
  assert.match(surfaceSource, /opponentSchoolDensity/);
}

test("standalone V2 masks rival setup SD, VP, and RP in the compact reef score", () => {
  const compactOpponentScore = sourceSection(
    simulatorSource,
    'className="seapals-reef-score seapals-reef-score-opponent"',
    "{previewExperience && mobileHandDockVisible ? (",
  );

  assertConcealedOpponentScoreSurface(compactOpponentScore, "compact rival reef score");
});

test("standalone V2 masks rival setup SD, VP, and RP in the XL HUD", () => {
  const xlScoreboard = sourceSection(
    simulatorSource,
    '<div className={`grid grid-cols-2 overflow-hidden rounded-xl border border-white/10 bg-slate-950/45${tutorialTargetClass("vp-score")}`}',
    '<button type="button" disabled={!activeCondition}',
  );

  assertConcealedOpponentScoreSurface(xlScoreboard, "XL rival HUD score");
});

test("concealment is presentation-only and does not move or refund the rival setup card", () => {
  const initialState = sourceSection(
    simulatorSource,
    "function createInitialGameState(",
    "function createOpponentStartingCorals(",
  );

  assert.match(initialState, /const opponentSetupCost = Number\(cardsById\[opponentBaseCoralId\]\?\.cost\?\.rp \?\? 0\);/);
  assert.match(initialState, /hand: removeOneCard\(opponentOpeningHand, opponentBaseCoralId\)/);
  assert.match(initialState, /corals: opponentCorals/);
  assert.match(initialState, /rp: Math\.max\(0, 3 - opponentSetupCost\)/);
  assert.doesNotMatch(initialState, /opponentSetupConcealed/);
});

test("Begin Round reveals by leaving setup while preserving both opening-player paths", () => {
  const startRound = sourceSection(
    simulatorSource,
    "function startRound(nextRound, {",
    "function beginOpeningOpponentTurn()",
  );
  const openingOpponentTurn = sourceSection(
    simulatorSource,
    "function beginOpeningOpponentTurn()",
    "function beginFirstRound()",
  );
  const beginFirstRound = sourceSection(
    simulatorSource,
    "function beginFirstRound()",
    "function adjustTurnDraw(",
  );

  assert.match(beginFirstRound, /if \(startingPlayer === OpeningPlayer\.OPPONENT\) \{\n\s*beginOpeningOpponentTurn\(\);/);
  assert.match(beginFirstRound, /startRound\(1\);/);
  assert.match(openingOpponentTurn, /setGamePhase\("transition"\);/);
  assert.match(startRound, /setGamePhase\("draw"\);/);
  assert.doesNotMatch(beginFirstRound, /setOpponent|opponentSetupConcealed/);
});
