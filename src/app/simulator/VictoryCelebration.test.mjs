import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentSource = await readFile(new URL("./VictoryCelebration.jsx", import.meta.url), "utf8");
const styleSource = await readFile(new URL("./VictoryCelebration.module.css", import.meta.url), "utf8");
const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
const experienceSource = await readFile(new URL("./SimulatorV2Experience.jsx", import.meta.url), "utf8");
const lessonPanelSource = await readFile(new URL("./SimulatorV2LessonPanel.jsx", import.meta.url), "utf8");
const lessonsSource = await readFile(new URL("./simulatorV2Lessons.mjs", import.meta.url), "utf8");

test("victory celebration is a focused accessible dialog with an action slot", () => {
  assert.match(componentSource, /data-victory-celebration/);
  assert.match(componentSource, /role="dialog"/);
  assert.match(componentSource, /aria-modal="true"/);
  assert.match(componentSource, /aria-labelledby=\{titleId\}/);
  assert.match(componentSource, /aria-describedby=\{descriptionId\}/);
  assert.match(componentSource, /data-victory-primary-action/);
  assert.match(componentSource, /actions\s*\?\?\s*children/);
  assert.match(componentSource, /data-victory-actions/);
  assert.match(componentSource, /keepFocusInDialog/);
  assert.match(componentSource, /const primaryAction = [^;]*querySelector\("\[data-victory-primary-action\]"\)/);
  assert.match(componentSource, /const firstAction = primaryAction \?\?/);
});

test("victory presentation uses a native SeaPals reef crest without borrowed image assets", () => {
  assert.match(componentSource, /function ReefVictoryCrest/);
  assert.match(componentSource, /data-victory-crest-graphic/);
  assert.match(componentSource, /<svg/);
  assert.match(componentSource, /crestWave/);
  assert.match(componentSource, /data-victory-emblem/);
  assert.doesNotMatch(componentSource, /<img|pok[eé]mon|pokeball|prize cards/i);
});

test("victory reason removes the duplicated result prefix and retains a safe fallback", () => {
  assert.match(componentSource, /replace\(\/\^victory\\s\*:\\s\*\/i,\s*""\)/);
  assert.match(componentSource, /Your ecosystem reached the victory target\./);
  assert.match(componentSource, /data-victory-reason/);
});

test("victory layer preserves board context while delivering rays, rings, sparkles, and a title sweep", () => {
  assert.match(styleSource, /\.layer\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?z-index:\s*190;/);
  assert.match(styleSource, /\.backdrop\s*\{[\s\S]*?rgb\(1 10 22 \/ 74%\);[\s\S]*?backdrop-filter:\s*blur\(3px\)/);
  assert.match(styleSource, /\.rays\s*\{[\s\S]*?repeating-conic-gradient/);
  assert.match(styleSource, /\.ring\s*\{/);
  assert.match(styleSource, /\.sparkle\s*\{/);
  assert.match(styleSource, /\.title::after\s*\{[\s\S]*?victoryTitleSweep/);
  assert.match(styleSource, /@keyframes\s+victoryEmblemArrive/);
  assert.match(styleSource, /@keyframes\s+victoryTitleArrive/);
});

test("victory celebration fits mobile safe areas and honors both motion controls", () => {
  assert.match(styleSource, /min-height:\s*100dvh/);
  assert.match(styleSource, /env\(safe-area-inset-top\)/);
  assert.match(styleSource, /@media\s*\(max-width:\s*520px\)/);
  assert.match(styleSource, /@media\s*\(max-height:\s*620px\)/);
  assert.match(componentSource, /data-reduced-motion=\{reducedMotion \? "true" : undefined\}/);
  assert.match(styleSource, /\.reducedMotion[\s\S]*?animation:\s*none\s*!important/);
  assert.match(styleSource, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation:\s*none\s*!important/);
});

test("the simulator celebrates both match wins and completed embedded VP lessons while routing defeats separately", () => {
  assert.match(simulatorSource, /import VictoryCelebration from "\.\/VictoryCelebration";/);
  assert.match(
    simulatorSource,
    /gameResult && \(!tutorialLessonWon \|\| \(embeddedLesson && tutorialProgress\?\.status === "complete"\)\) && \/\^Victory\\b\/i\.test\(gameResult\)[\s\S]*?<VictoryCelebration/,
  );
  assert.match(simulatorSource, /<VictoryCelebration[\s\S]*?embeddedLesson\.celebration[\s\S]*?VP goal reached/);
  assert.match(simulatorSource, /embeddedLesson \? "Replay Lesson" : "Retry Practice Duel"/);
  assert.match(simulatorSource, /embeddedLesson \? "Continue to Lessons" : `Return to \$\{storyReturnLabel\}`/);
  assert.match(simulatorSource, /data-victory-primary-action[\s\S]*?Play Again/);
  assert.doesNotMatch(
    simulatorSource,
    /gameResult && !tutorialLessonWon && !\/\^Victory\\b\/i\.test\(gameResult\)\s*\?\s*\(/,
    "Defeats should no longer use the compact non-victory alert",
  );
  assert.match(
    simulatorSource,
    /gameResult && !tutorialLessonWon && \/\^Defeat\\b\/i\.test\(gameResult\)[\s\S]*?<DefeatPresentation/,
  );
});

test("Lesson 1 pauses on Mr. Easterling's exact momentum line before opening its victory celebration", () => {
  assert.ok(
    lessonsSource.includes('preVictoryMessage: "Excellent! Your ecosystem is really starting to build momentum."'),
  );
  assert.match(
    simulatorSource,
    /const \[embeddedLessonPreVictoryAcknowledged, setEmbeddedLessonPreVictoryAcknowledged\] = useState\(false\);/,
  );
  assert.match(
    simulatorSource,
    /const embeddedLessonVictoryGateOpen = Boolean\([\s\S]*?!embeddedLesson[\s\S]*?tutorialProgress\?\.status === "complete"[\s\S]*?!embeddedLesson\.preVictoryMessage \|\| embeddedLessonPreVictoryAcknowledged[\s\S]*?\);/,
  );
  assert.match(
    simulatorSource,
    /const getResolvedVictoryResult = \(nextPlayerVp, nextOpponentVp\) => \([\s\S]*?embeddedLessonVictoryGateOpen[\s\S]*?determineVictoryResult\(nextPlayerVp, nextOpponentVp, victoryTarget\)[\s\S]*?: null/,
  );
  assert.equal(
    [...simulatorSource.matchAll(/determineVictoryResult\(/g)].length,
    1,
    "every live victory path should pass through the embedded lesson acknowledgement gate",
  );
  assert.ok(
    [...simulatorSource.matchAll(/getResolvedVictoryResult\(/g)].length >= 5,
    "the regular effect and projected combat paths should all use the gated resolver",
  );
  assert.match(
    simulatorSource,
    /const tutorialNeedsExistingVpCredit = Boolean\([\s\S]*?tutorialCurrentCheckpoint\?\.actionType === SIMULATOR_TUTORIAL_ACTION_TYPES\.VP_EARNED[\s\S]*?playerVp >= victoryTarget[\s\S]*?playerVpDelta <= 0[\s\S]*?creditedExistingTotal: tutorialNeedsExistingVpCredit/,
    "a lesson that reaches its VP goal before its final authored step must credit that existing total when the victory checkpoint becomes active",
  );
  assert.match(
    simulatorSource,
    /\[playerVp, opponentVp, tutorialContract, tutorialCurrentCheckpoint\?\.id, victoryTarget\]/,
    "the VP observer must rerun when a deferred victory checkpoint becomes active",
  );

  const preVictoryBranch = simulatorSource.slice(
    simulatorSource.indexOf("{embeddedLessonPreVictoryOpen ? ("),
    simulatorSource.indexOf(") : embeddedLessonCoachOpen ? ("),
  );
  assert.match(preVictoryBranch, /<ProfessorGuideCard/);
  assert.match(preVictoryBranch, /help=\{embeddedLessonPreVictoryHelp\}/);
  assert.match(preVictoryBranch, /onAdvance=\{\(\) => setEmbeddedLessonPreVictoryAcknowledged\(true\)\}/);
  assert.match(preVictoryBranch, /advanceLabel="Celebrate"/);
});

test("embedded lesson progress is saved at the real VP victory and the chooser exposes every goal", () => {
  assert.match(
    simulatorSource,
    /const embeddedLessonReadyToComplete = Boolean\([\s\S]*?tutorialProgress\?\.status === "complete"[\s\S]*?playerVp >= victoryTarget[\s\S]*?\^Victory\\b[\s\S]*?\);/,
  );
  assert.match(
    simulatorSource,
    /if \(!embeddedLessonReadyToComplete \|\| embeddedLessonCompletedRef\.current\) return;[\s\S]*?notifyTutorialCallback\("onComplete"\)/,
  );
  const completionCallback = experienceSource.match(/const completeLesson = useCallback\(\(\) => \{[\s\S]*?\n  \}, \[lessonId\]\);/)?.[0] ?? "";
  assert.match(completionCallback, /recordSimulatorV2LessonCompletion/);
  assert.doesNotMatch(completionCallback, /setPanel\("complete"\)/, "saving progress must leave the victory celebration visible");
  assert.match(lessonPanelSource, /data-v2-lesson-goal=\{lesson\.victoryTarget\}/);
  assert.match(lessonPanelSource, /Goal \{lesson\.victoryTarget\} VP/);
  assert.match(lessonPanelSource, /data-v2-lesson-vp-target=\{activeLesson\?\.victoryTarget \|\| undefined\}/);
});
