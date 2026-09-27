import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

test("legacy tutorial keeps its introduction while V2 hands off directly to the decisionless coin toss", () => {
  assert.match(simulatorSource, /setTutorialIntroductionStep\(tutorialContract && tutorialUsesScriptedScenario && !previewExperience \? 0 : null\)/);
  assert.match(simulatorSource, /previewExperience[\s\S]*?createOpeningCoinReadyOverlay\(\)/);
  assert.match(simulatorSource, /setTutorialBoardTourStep\(null\)/);
  assert.match(simulatorSource, /function finishTutorialIntroduction\(\)[\s\S]*setTutorialIntroductionStep\(null\)[\s\S]*setTutorialBoardTourStep\(0\)/);
  assert.match(simulatorSource, /function finishTutorialBoardTour\(\)[\s\S]*openOpeningCoinFlip\(\)/);
});

test("new hand cards wait for a click, keep draw order, and cannot be played before their tour", () => {
  assert.match(simulatorSource, /getNewTutorialHandCardIds\(previousHand, hand, \{[\s\S]*seenCardIds: tutorialSeenCardIds[\s\S]*pendingCardIds: retained/);
  assert.match(simulatorSource, /pendingTutorialCardReviewId = tutorialPendingCardIds\.find/);
  assert.match(simulatorSource, /tutorialRequiredCardReviewId = pendingTutorialCardReviewId \?\? authoredTutorialCardReviewId/);
  assert.match(simulatorSource, /tutorialRequiredCardReviewSubject = tutorialRequiredCardReview[\s\S]*getTutorialCardLessonSubject\(tutorialRequiredCardReview\)/);
  assert.match(simulatorSource, /title: `Meet \$\{tutorialRequiredCardReviewSubject\}`/);
  assert.match(simulatorSource, /action: `Tap on your \$\{tutorialRequiredCardReview\.name\}\.`/);
  assert.match(simulatorSource, /pointerPrompt: `Tap on your \$\{tutorialRequiredCardReview\.name\}\.`/);
  assert.doesNotMatch(simulatorSource, /in your hand to begin its card tour/);
  const handClick = simulatorSource.slice(
    simulatorSource.indexOf("function openHandCardPopover"),
    simulatorSource.indexOf("function closeHandCardPopover"),
  );
  assert.match(handClick, /!tutorialSeenCardIds\.includes\(cardId\)[\s\S]*createGuidedAcademyCardLesson\(card, \{[\s\S]*setTutorialCardLesson\(\{ \.\.\.lesson, requiredReview: true \}\)/);
  assert.doesNotMatch(simulatorSource, /tutorialHelp\?\.target !== "hand"/);
  assert.match(simulatorSource, /function getEmbeddedLessonBlock\(action, details = \{\}\) \{[\s\S]*tutorialRequiredCardReviewId[\s\S]*Tap on your \$\{cardName\} and finish its card tour before continuing/);
  assert.match(simulatorSource, /function finishTutorialCardLesson\(\)[\s\S]*mergeTutorialSeenCardIds[\s\S]*setTutorialPendingCardIds[\s\S]*setTutorialCardLesson\(null\)/);
});

test("hand-limit choices wait until every newly drawn tutorial card has been reviewed", () => {
  assert.match(
    simulatorSource,
    /tutorialContract[\s\S]*?embeddedLessonPresentationStarted[\s\S]*?hand\.some\(\(cardId\) => !tutorialSeenCardIds\.includes\(cardId\)\)[\s\S]*?return;[\s\S]*?createHandLimitChoice/,
  );
});

test("Lesson 1 opens its authored Foundation card tour only after Start Lesson", () => {
  assert.match(
    simulatorSource,
    /const \[tutorialCardLesson, setTutorialCardLesson\] = useState\(\(\) => \{[\s\S]*?embeddedLessonPresentationStarted[\s\S]*?embeddedLesson\?\.openingCardTourId[\s\S]*?createGuidedFoundationCardLesson\(cardsById\[openingCardTourId\]\)/,
  );
  assert.match(
    simulatorSource,
    /tutorialCardLessonOpen \? \([\s\S]*?<TutorialCardLessonOverlay[\s\S]*?lesson=\{tutorialCardLesson\}[\s\S]*?card=\{tutorialCardLessonCard\}/,
  );
  assert.match(
    simulatorSource,
    /embeddedLessonPresentationBlocked = Boolean\([\s\S]*?\|\| tutorialCardLesson/,
    "the board coach waits until the full-screen card tour ends",
  );
});

test("fullscreen lesson keeps the card clear and docks the coach and navigation below it", () => {
  const overlaySource = simulatorSource.slice(
    simulatorSource.indexOf("function TutorialCardLessonOverlay"),
    simulatorSource.indexOf("function BoardBubbleBursts"),
  );
  assert.match(simulatorSource, /className="fixed inset-0 z-\[180\] flex min-h-0 flex-col overflow-hidden/);
  assert.match(simulatorSource, /data-card-lesson-stage[\s\S]*data-card-lesson-coach/);
  assert.match(simulatorSource, /className="flex h-\[clamp\(12rem,34dvh,22rem\)\] min-h-0 shrink-0 flex-col[^"]*" data-card-lesson-coach/);
  assert.match(overlaySource, /ref=\{coachScrollRef\}[\s\S]*className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-3 sm:px-6 sm:py-4"[\s\S]*role="region"[\s\S]*aria-label="Lesson narration"[\s\S]*tabIndex=\{0\}/);
  assert.match(
    overlaySource,
    /className="mx-auto my-auto flex w-full max-w-6xl shrink-0 items-start gap-3 sm:gap-4"/,
    "short narration should sit lower in the reserved panel while tall content keeps a top scroll origin",
  );
  assert.match(overlaySource, /if \(coachScrollRef\.current\) coachScrollRef\.current\.scrollTop = 0/);
  assert.match(simulatorSource, /data-card-lesson-coach[\s\S]*<footer className="shrink-0/);
  assert.match(overlaySource, /ProfessorGuidePortrait guide=\{guide\} compact[\s\S]*<h2 id="seapals-card-lesson-title" className="sr-only">\{activeTitle\}<\/h2>[\s\S]*<LessonDialogueMessage[\s\S]*message=\{activeMessage\}/);
  assert.match(overlaySource, /const activeTitle = activeSegment\?\.title \?\? lesson\.title \?\? "Card lesson"/);
  assert.match(overlaySource, /aria-labelledby="seapals-card-lesson-title"/);
  assert.doesNotMatch(overlaySource, /className="text-lg font-black leading-tight text-slate-950 sm:text-2xl"/);
  assert.equal((overlaySource.match(/<h[1-6]\b/g) ?? []).length, 1, "the ribbon should have no visible duplicate heading");
  assert.equal((overlaySource.match(/\{activeTitle\}/g) ?? []).length, 1, "the title should appear only in the screen-reader heading");
  assert.doesNotMatch(overlaySource, /\bhideTitle\b/, "all card-tour ribbons should use the same title-free presentation");
  assert.match(overlaySource, /className="seapals-card-lesson-narration"[\s\S]*marginTop: 0/);
  assert.doesNotMatch(overlaySource, /<header\b|segmentProgressLabel|\{guide\.name\}/);
  assert.match(overlaySource, /\{onSkip \? <button[^>]*onClick=\{onSkip\}[\s\S]*aria-label=\{introduction \? "Skip introduction" : "Skip card lesson"\}>Skip<\/button> : null\}/);
  assert.match(overlaySource, /if \(event\.key === "Escape"\)[\s\S]*onSkip\?\.\(\)/);
  assert.match(simulatorSource, /onSkip=\{tutorialCardLesson\.requiredReview \? null : finishTutorialCardLesson\}/);
  assert.match(simulatorSource, /role="dialog"[\s\S]*aria-modal="true"/);
  assert.match(simulatorSource, /env\(safe-area-inset-bottom\)/);
  assert.match(simulatorSource, /event\.key !== "Tab"[\s\S]*button:not\(\[disabled\]\)[\s\S]*last\.focus\(\)/);
  assert.match(simulatorSource, /isolatedElements[\s\S]*sibling\.inert = true[\s\S]*element\.inert = inert/);
});

test("card cues use an animated outlined arrow without drawing a box over the card", () => {
  const cueSource = simulatorSource.slice(
    simulatorSource.indexOf("function TutorialCardCueOverlay"),
    simulatorSource.indexOf("function TutorialCardReference"),
  );
  assert.match(simulatorSource, /viewBox="0 0 375 525"/);
  assert.match(simulatorSource, /data-card-cue-region=\{focus\}/);
  assert.match(simulatorSource, /className="pointer-events-none absolute inset-0[^"]*overflow-visible"/);
  assert.doesNotMatch(cueSource, /<rect\b|seapals-card-cue-region/);
  assert.match(simulatorSource, /const shaftPath = `M\$\{region\.tailX\}[\s\S]*L\$\{region\.tipX\}/);
  assert.match(simulatorSource, /const chevronPath = region\.direction === "up"[\s\S]*region\.direction === "left"/);
  assert.match(simulatorSource, /strokeLinecap="round" strokeLinejoin="round"/);
  assert.match(simulatorSource, /d=\{shaftPath\} stroke="#071827" strokeWidth="9"/);
  assert.match(simulatorSource, /d=\{shaftPath\} stroke="#fbbf24" strokeWidth="4"/);
  assert.match(simulatorSource, /d=\{chevronPath\} stroke="#071827" strokeWidth="9"/);
  assert.match(simulatorSource, /d=\{chevronPath\} stroke="#fbbf24" strokeWidth="4"/);
  assert.match(cueSource, /className="seapals-card-cue-arrow"/);
  assert.match(simulatorSource, /@keyframes seapals-card-cue-bob[\s\S]*translateY\(-4px\)/);
  assert.match(simulatorSource, /prefers-reduced-motion: reduce[\s\S]*\.seapals-card-cue-arrow \{ animation: none; \}/);
  assert.match(simulatorSource, /\.seapals-reduced-motion \.seapals-card-cue-arrow \{ animation: none; \}/);
  assert.doesNotMatch(cueSource, /<marker|markerEnd=|seapals-card-cue-arrowhead/);
  assert.doesNotMatch(simulatorSource, /seapals-card-cue-pulse|seapalsCardCuePulse/);
  assert.doesNotMatch(simulatorSource, /focusLabel|top-3 h-\[18%\]|top-\[45%\] h-\[28%\]/);
  assert.match(cueSource, /function TutorialCardCueOverlay\(\{ (?:focus, card|card, focus) \}\)/);
  assert.match(cueSource, /getTutorialCardFocusRegion\(focus, card\)/);
});

test("every card tour layers its cue over one complete printed card in the same 5:7 frame", () => {
  const referenceSource = simulatorSource.slice(
    simulatorSource.indexOf("function TutorialCardReference"),
    simulatorSource.indexOf("function TutorialCardLessonOverlay"),
  );
  assert.match(
    referenceSource,
    /className="[^"]*relative[^\"]*aspect-\[5\/7\][^"]*"[\s\S]*?<img[\s\S]*?src=\{card\.image \|\| CARD_ART_FALLBACK\}[\s\S]*?alt=\{`\$\{card\.name\} card`\}[\s\S]*?className="[^"]*h-full[^"]*w-full[^"]*object-contain[^"]*"[\s\S]*?<TutorialCardCueOverlay (?=[^>]*focus=\{focus\})(?=[^>]*card=\{card\})[^>]*\/>[\s\S]*?<\/div>/,
  );
  assert.equal((referenceSource.match(/<img\b/g) ?? []).length, 1, "the tour should render exactly one card image");
  assert.equal((referenceSource.match(/<TutorialCardCueOverlay\b/g) ?? []).length, 1, "the card frame should contain exactly one cue overlay");
});

test("card tours do not reconstruct normalized card panels from gameplay metadata", () => {
  const referenceSource = simulatorSource.slice(
    simulatorSource.indexOf("function TutorialCardReference"),
    simulatorSource.indexOf("function TutorialCardLessonOverlay"),
  );
  assert.doesNotMatch(
    referenceSource,
    /effectiveReferenceMode|placeholderArt|normalizedFacts|fallbackFacts|visibleFacts|referenceRules|seapals-normalized-card-|Card type|Play cost|Board role/,
  );
});

test("multi-concept cards advance one arrow and one coach explanation at a time", () => {
  const overlaySource = simulatorSource.slice(
    simulatorSource.indexOf("function TutorialCardLessonOverlay"),
    simulatorSource.indexOf("function BoardBubbleBursts"),
  );
  assert.match(simulatorSource, /const \[segmentIndex, setSegmentIndex\] = useState\(0\)/);
  assert.match(simulatorSource, /activeSegment\?\.focus \?\? lesson\.focus/);
  assert.match(simulatorSource, /if \(hasNextSegment\)[\s\S]*setSegmentIndex/);
  assert.match(simulatorSource, /data-card-cue-region=\{activeFocus \?\? undefined\}/);
  assert.match(simulatorSource, /aria-live="polite"/);
  assert.match(simulatorSource, /<TutorialCardCueOverlay key=\{`\$\{card\.id\}:\$\{focus \?\? "none"\}`\} focus=\{focus\} card=\{card\} \/>/);
  assert.match(overlaySource, /key=\{createProfessorSpeechKey\(`\$\{lesson\.cueId\}:\$\{activeSegment\?\.id \?\? safeSegmentIndex\}`,[\s\S]*?activeMessage\)\}/);
});

test("card-tour narration uses the shared typewriter speed and scroll behavior", () => {
  const overlaySource = simulatorSource.slice(
    simulatorSource.indexOf("function TutorialCardLessonOverlay"),
    simulatorSource.indexOf("function BoardBubbleBursts"),
  );

  assert.match(simulatorSource, /import SimulatorV2LessonPanel, \{ LessonDialogueMessage \} from "\.\/SimulatorV2LessonPanel"/);
  assert.match(
    overlaySource,
    /<LessonDialogueMessage[\s\S]*?id="seapals-card-lesson-description"[\s\S]*?message=\{activeMessage\}[\s\S]*?textSpeed=\{guide\.textSpeed\}[\s\S]*?reducedMotion=\{guide\.reducedMotion\}[\s\S]*?scrollable\s*\/>/,
  );
  assert.doesNotMatch(overlaySource, /<p[^>]*>\{activeMessage\}<\/p>/);
});

test("the full-screen lesson suppresses competing coach and target surfaces", () => {
  assert.match(simulatorSource, /tutorialHelpFloating = Boolean\([\s\S]*!tutorialIntroductionOpen[\s\S]*!tutorialCardLessonOpen/);
  assert.match(simulatorSource, /tutorialTargetBeaconOpen = Boolean\([\s\S]*!tutorialIntroductionOpen[\s\S]*!tutorialCardLessonOpen/);
});
