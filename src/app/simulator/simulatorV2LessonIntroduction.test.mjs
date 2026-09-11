import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { SIMULATOR_V2_LESSONS } from "./simulatorV2Lessons.mjs";

const experienceSource = await readFile(new URL("./SimulatorV2Experience.jsx", import.meta.url), "utf8");
const panelSource = await readFile(new URL("./SimulatorV2LessonPanel.jsx", import.meta.url), "utf8");

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

test("every lesson opens with a short, authored Mr. Easterling learning promise", () => {
  for (const lesson of SIMULATOR_V2_LESSONS) {
    assert.match(lesson.introduction, /^In this lesson, you(?:'|’|â€™)ll learn\b/);
    assert.ok(lesson.introduction.length <= 210, `${lesson.id} intro should stay brief`);
    assert.ok(Array.isArray(lesson.skills) && lesson.skills.length > 0, `${lesson.id} should preview its skills`);
  }
});
