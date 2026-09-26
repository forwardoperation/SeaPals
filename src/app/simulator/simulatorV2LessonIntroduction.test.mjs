import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { SIMULATOR_V2_LESSONS } from "./simulatorV2Lessons.mjs";

const experienceSource = await readFile(new URL("./SimulatorV2Experience.jsx", import.meta.url), "utf8");
const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
const panelSource = await readFile(new URL("./SimulatorV2LessonPanel.jsx", import.meta.url), "utf8");
const panelStyleSource = await readFile(new URL("./SimulatorV2LessonPanel.module.css", import.meta.url), "utf8");

function sourceSection(source, startMarker, endMarker) {
  source = source.replaceAll("\r\n", "\n");
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("selecting any lesson opens its teacher introduction before the board becomes interactive", () => {
  assert.match(
    experienceSource,
    /const selectLesson = useCallback\([\s\S]*?setLessonId\(id\);[\s\S]*?setPanel\("intro"\)/,
  );
  assert.match(experienceSource, /inert=\{panel \? true : undefined\}/);
  assert.match(
    experienceSource,
    /const beginLesson = useCallback\(\(\) => \{[\s\S]*?setAttempt[\s\S]*?setPanel\(null\)/,
  );
  assert.match(experienceSource, /panel === "intro"[\s\S]*?\? beginLesson/);
  assert.match(panelSource, /if \(mode === "intro"\)/);
  assert.match(panelSource, /data-v2-lesson-introduction=\{activeLesson\?\.id \|\| undefined\}/);
  assert.match(panelSource, /<LessonDialogueMessage[\s\S]*?message=\{introduction\}/);
  assert.match(panelSource, /data-v2-start-lesson/);
  assert.match(
    experienceSource,
    /createSimulatorV2LessonRuntime\(lesson\.id, \{ completedLessonIds \}\)/,
    "the board receives concepts taught by completed earlier lessons",
  );
  assert.match(
    experienceSource,
    /lessonStarted:\s*panel === null/,
    "the embedded runtime distinguishes the visible introduction from a started lesson",
  );
});

test("the board teacher stays unmounted until Start Lesson is pressed", () => {
  assert.match(
    simulatorSource,
    /const embeddedLessonPresentationStarted = !embeddedLesson \|\| tutorialRuntime\?\.lessonStarted === true;/,
  );
  assert.match(
    simulatorSource,
    /const checkpointTutorialHelp = tutorialContract && embeddedLessonPresentationStarted/,
    "the background coach must not create a message before the lesson starts",
  );
  assert.match(
    simulatorSource,
    /const embeddedCompactCoachOpen = Boolean\([\s\S]*?embeddedLessonPresentationStarted[\s\S]*?&& !eventOverlay/,
    "round and Condition coaching must wait too",
  );
  assert.match(
    simulatorSource,
    /const embeddedLessonPresentationBlocked = Boolean\([\s\S]*?!embeddedLessonPresentationStarted/,
  );
  assert.match(
    simulatorSource,
    /const embeddedLessonActionReady = Boolean\([\s\S]*?embeddedLessonPresentationStarted[\s\S]*?&& embeddedLesson/,
    "the coach, its pointer, and its live announcement share the start gate",
  );
});

test("Start Lesson remounts the prepared board before its seeded hand deal begins", () => {
  assert.match(
    experienceSource,
    /const beginLesson = useCallback\(\(\) => \{[\s\S]*?setAttempt\(\(current\) => current \+ 1\);[\s\S]*?setPanel\(null\)/,
  );
  assert.match(
    experienceSource,
    /key=\{lesson \? `\$\{lesson\.id\}:\$\{attempt\}` : `match:\$\{returnDeckId \?\? "default"\}`\}/,
    "pressing Start Lesson must create a fresh simulator instance for the authored opening deal",
  );
  assert.match(experienceSource, /lessonStarted: panel === null/);
});

test("a prepared lesson hand is concealed until its one-shot deck deal reveals it", () => {
  const lessonDealEffect = sourceSection(
    simulatorSource,
    "useLayoutEffect(() => {\n    const openingHand = initialGame.hand ?? [];",
    "function scheduleCompactOpponentTimer",
  );

  assert.match(
    simulatorSource,
    /const \[setupOpeningHandVisibleCount, setSetupOpeningHandVisibleCount\] = useState\(\(\) => \([\s\S]*?initialGame\.hand\.length[\s\S]*?\? 0[\s\S]*?: null[\s\S]*?\)\)/,
    "authored hand cards must reserve their hand slots without painting before the lesson deal",
  );
  assert.match(simulatorSource, /const lessonOpeningHandSequenceStartedRef = useRef\(false\)/);
  assert.match(
    lessonDealEffect,
    /const openingHand = initialGame\.hand \?\? \[\];[\s\S]*?if \([\s\S]*?!tutorialContract[\s\S]*?\|\| !embeddedLessonPresentationStarted[\s\S]*?\|\| !openingHand\.length[\s\S]*?\|\| lessonOpeningHandSequenceStartedRef\.current[\s\S]*?\) return/,
    "the lesson deal must wait for Start Lesson, require cards, and run once per mounted attempt",
  );
  assert.match(
    lessonDealEffect,
    /lessonOpeningHandSequenceStartedRef\.current = true;[\s\S]*?setSetupOpeningHandVisibleCount\(0\);[\s\S]*?beginCompactTurnSequence\(\{[\s\S]*?includeOpeningHand: true,[\s\S]*?openingHandKind: "lesson-opening-hand",[\s\S]*?openingHand: \[\.\.\.openingHand\]/,
  );
  assert.match(
    lessonDealEffect,
    /return \(\) => \{[\s\S]*?lessonOpeningHandSequenceStartedRef\.current = false;[\s\S]*?\};/,
    "effect cleanup must release the one-shot guard so React Strict Mode can run the real mount",
  );
});

test("the lesson deal reveals reserved slots on landing and fully cleans up on completion or fallback", () => {
  const openingHandLauncher = sourceSection(
    simulatorSource,
    "function launchCompactOpeningHandDeal(sequence)",
    "useLayoutEffect(() => {\n    const sequence = compactTurnSequence;",
  );
  const lessonStageLauncher = sourceSection(
    simulatorSource,
    "useLayoutEffect(() => {\n    const sequence = compactTurnSequence;",
    "useEffect(() => {\n    const sequence = compactTurnSequence;",
  );
  const lessonDealEffect = sourceSection(
    simulatorSource,
    "useLayoutEffect(() => {\n    const openingHand = initialGame.hand ?? [];",
    "function scheduleCompactOpponentTimer",
  );

  assert.match(openingHandLauncher, /const landedIndexes = new Set\(\)/);
  assert.match(openingHandLauncher, /onCardLanded: \(flight\) => \{[\s\S]*?landedIndexes\.add\(flight\.handIndex\)/);
  assert.match(openingHandLauncher, /while \(landedIndexes\.has\(next\)\) next \+= 1/);
  assert.match(openingHandLauncher, /return Math\.min\(next, openingCards\.length\)/);
  assert.match(openingHandLauncher, /const completeOpeningDeal = \(\) => \{[\s\S]*?setSetupOpeningHandVisibleCount\(openingCards\.length\);[\s\S]*?advanceCompactTurnSequence\(sequence\.id\)/);
  assert.match(openingHandLauncher, /if \(!started\) \{[\s\S]*?setSetupOpeningHandVisibleCount\(openingCards\.length\);[\s\S]*?scheduleCompactTurnTimer/);
  assert.match(openingHandLauncher, /onComplete: completeOpeningDeal/);
  assert.match(openingHandLauncher, /onCancel: completeOpeningDeal/);
  assert.match(
    lessonStageLauncher,
    /stage\?\.kind !== CompactTurnStage\.OPENING_HAND[\s\S]*?sequence\.openingHandKind !== "lesson-opening-hand"[\s\S]*?launchCompactOpeningHandDeal\(sequence\)/,
    "the lesson-specific layout effect launches as soon as its reserved slots are committed",
  );
  assert.match(
    lessonDealEffect,
    /beginCompactTurnSequence\(\{[\s\S]*?openingHandKind: "lesson-opening-hand"[\s\S]*?\}, \(\) => \{[\s\S]*?setSetupOpeningHandVisibleCount\(null\)/,
    "after the sequence, the ordinary hand renderer must own all seeded cards again",
  );
});

test("the lesson start overlay keeps only the guide, title, short dialogue, and its two actions", () => {
  const lessonModal = sourceSection(panelSource, "function LessonModal(", "/**\n * Presentation for the real simulator board.");
  const intro = sourceSection(panelSource, 'if (mode === "intro") {', 'if (mode === "complete") {');

  assert.match(lessonModal, /<TeacherPortrait large \/>/);
  assert.match(lessonModal, /<span className=\{styles\.kicker\}>Mr\. Easterling<\/span>/);
  assert.doesNotMatch(lessonModal, /Your guide/i);
  assert.match(lessonModal, /<h2 ref=\{headingRef\} tabIndex=\{-1\} id=\{titleId\}>\{title\}<\/h2>/);
  assert.match(lessonModal, /className=\{styles\.closeButton\}[\s\S]*?aria-label=\{mode === "intro" \? "Return to the lesson list"/);

  assert.match(intro, /title=\{activeLesson\?\.title \|\| "Your next lesson"\}/);
  assert.match(intro, /data-v2-lesson-introduction=\{activeLesson\?\.id \|\| undefined\}/);
  assert.match(intro, /className=\{styles\.introDialogue\}[\s\S]*?<LessonDialogueMessage[\s\S]*?message=\{introduction\}/);
  assert.match(intro, /data-v2-start-lesson>[\s\S]*?Start Lesson/);
  assert.match(intro, /onClick=\{onExit\}>Choose Another Lesson<\/button>/);
  assert.equal((intro.match(/<button\b/g) ?? []).length, 2);

  assert.doesNotMatch(intro, /\bdescription=|introLessonNumber|activeLesson\?\.duration/);
  assert.doesNotMatch(intro, /introSpeaker|Mr\. Easterling says/);
  assert.doesNotMatch(intro, /introGoalRow|lessonGoal\(activeLesson\)|data-v2-lesson-vp-target/);
  assert.doesNotMatch(intro, /introSkills|Skills in this lesson|activeLesson\?\.skills|skills\.map/);
  assert.doesNotMatch(panelStyleSource, /\.introSpeaker\b|\.introGoalRow\b|\.introSkills\b/);
});

test("every lesson opens with an authored Mr. Easterling learning promise", () => {
  for (const lesson of SIMULATOR_V2_LESSONS) {
    assert.match(lesson.introduction, /^In (?:this|our next) lesson, (?:you|we)(?:(?:'|’|â€™)ll| will) learn\b/);
    assert.match(lesson.introduction, /!/, `${lesson.id} intro should include one upbeat beat`);
    assert.ok((lesson.introduction.match(/!/g) ?? []).length <= 2, `${lesson.id} intro should stay enthusiastic without shouting`);
    assert.ok(lesson.introduction.length <= 340, `${lesson.id} intro should stay focused`);
  }
});

test("the first lesson uses the requested concise setup promise", () => {
  assert.equal(
    SIMULATOR_V2_LESSONS[0].introduction,
    "In this lesson, you will learn the basics of setting up your ecosystem. Let’s get started!",
  );
});

test("the second lesson introduces creature interactions and food webs", () => {
  assert.equal(SIMULATOR_V2_LESSONS[1].title, "Interactions");
  assert.equal(
    SIMULATOR_V2_LESSONS[1].introduction,
    "In our next lesson, we will learn about the relationships between different sea creatures. In each ecosystem, there is a well defined food web which tells what creatures prey on other creatures. Certain fish may hunt invertebrates, while predators may consume both. Beware, there’s always a bigger fish! Let’s get started!",
  );
});
