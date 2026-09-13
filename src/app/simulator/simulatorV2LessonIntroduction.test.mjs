import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { SIMULATOR_V2_LESSONS } from "./simulatorV2Lessons.mjs";

const experienceSource = await readFile(new URL("./SimulatorV2Experience.jsx", import.meta.url), "utf8");
const panelSource = await readFile(new URL("./SimulatorV2LessonPanel.jsx", import.meta.url), "utf8");
const panelStyleSource = await readFile(new URL("./SimulatorV2LessonPanel.module.css", import.meta.url), "utf8");

function sourceSection(source, startMarker, endMarker) {
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
});

test("the lesson start overlay keeps only the guide, title, short dialogue, and its two actions", () => {
  const lessonModal = sourceSection(panelSource, "function LessonModal(", "/**\n * Presentation for the real simulator board.");
  const intro = sourceSection(panelSource, 'if (mode === "intro") {', 'if (mode === "complete") {');

  assert.match(lessonModal, /<TeacherPortrait large \/>/);
  assert.match(lessonModal, /Mr\. Easterling[^<]*Your guide/);
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

test("every lesson opens with a short, authored Mr. Easterling learning promise", () => {
  for (const lesson of SIMULATOR_V2_LESSONS) {
    assert.match(lesson.introduction, /^In this lesson, you(?:(?:'|’|â€™)ll| will) learn\b/);
    assert.ok(lesson.introduction.length <= 210, `${lesson.id} intro should stay brief`);
  }
});

test("the first lesson uses the requested concise setup promise", () => {
  assert.equal(
    SIMULATOR_V2_LESSONS[0].introduction,
    "In this lesson, you will learn the basics of setting up your ecosystem. Let’s get started!",
  );
});
