"use client";

import { useCallback, useEffect, useState } from "react";
import Simulator from "./Simulator";
import SimulatorV2LessonPanel from "./SimulatorV2LessonPanel";
import * as lessonCurriculum from "./simulatorV2Lessons.mjs";

const {
  SIMULATOR_V2_LESSONS,
  SIMULATOR_V2_LESSON_PROGRESS_KEY,
  createSimulatorV2LessonRuntime,
  getSimulatorV2Lesson,
  parseSimulatorV2LessonProgress,
  recordSimulatorV2LessonCompletion,
} = lessonCurriculum;
const SIMULATOR_V2_LESSON_MODULES = lessonCurriculum.SIMULATOR_V2_LESSON_MODULES ?? [];

export default function SimulatorV2Experience({ initialDeckId, initialTutorial = false }) {
  const [lessonId, setLessonId] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [panel, setPanel] = useState(initialTutorial ? "chooser" : null);
  const [completedLessonIds, setCompletedLessonIds] = useState([]);
  const [returnDeckId, setReturnDeckId] = useState(initialDeckId);
  const lesson = getSimulatorV2Lesson(lessonId);

  useEffect(() => {
    try {
      const saved = parseSimulatorV2LessonProgress(window.localStorage.getItem(SIMULATOR_V2_LESSON_PROGRESS_KEY));
      setCompletedLessonIds(saved.completedLessonIds);
    } catch { /* Lessons also work when browser storage is unavailable. */ }
  }, []);

  const selectLesson = useCallback((id) => {
    if (!getSimulatorV2Lesson(id)) return;
    setLessonId(id);
    setAttempt((current) => current + 1);
    setPanel("intro");
  }, []);

  const completeLesson = useCallback(() => {
    if (!lessonId) return;
    setCompletedLessonIds((current) => {
      const next = recordSimulatorV2LessonCompletion({ version: 1, completedLessonIds: current }, lessonId);
      try { window.localStorage.setItem(SIMULATOR_V2_LESSON_PROGRESS_KEY, JSON.stringify(next)); } catch { /* Optional persistence. */ }
      return next.completedLessonIds;
    });
  }, [lessonId]);

  const beginLesson = useCallback(() => {
    setAttempt((current) => current + 1);
    setPanel(null);
  }, []);

  function returnToSimulator() {
    setLessonId(null);
    setPanel(null);
  }

  const runtime = lesson ? {
    ...createSimulatorV2LessonRuntime(lesson.id),
    onComplete: completeLesson,
    onReplay: () => selectLesson(lesson.id),
  } : null;
  const nextLesson = lesson ? SIMULATOR_V2_LESSONS[SIMULATOR_V2_LESSONS.findIndex((entry) => entry.id === lesson.id) + 1] : null;

  return (
    <>
      <div inert={panel ? true : undefined} aria-hidden={panel ? true : undefined}>
        <Simulator
          key={lesson ? `${lesson.id}:${attempt}` : `match:${returnDeckId ?? "default"}`}
          initialDeckId={returnDeckId}
          previewExperience
          onStartTutorial={(deckId) => { setReturnDeckId(deckId); setPanel("chooser"); }}
          storyMode={lesson ? {
            playerDeckId: "coral-garden",
            opponentDeckId: "coral-garden",
            opponentName: "Mr. Easterling",
            victoryTarget: lesson.victoryTarget,
            difficulty: "easy",
            returnLabel: "Lessons",
            onExit: () => setPanel("chooser"),
            tutorial: runtime,
          } : null}
        />
      </div>
      {panel ? (
        <SimulatorV2LessonPanel
          mode={panel}
          lessons={SIMULATOR_V2_LESSONS}
          lessonModules={SIMULATOR_V2_LESSON_MODULES}
          activeLesson={lesson}
          feedback={lesson?.completion}
          progress={{ completedLessonIds }}
          onSelect={selectLesson}
          onExit={panel === "intro" ? () => setPanel("chooser") : returnToSimulator}
          onReplay={lesson ? () => selectLesson(lesson.id) : null}
          onNext={panel === "intro"
            ? beginLesson
            : nextLesson
              ? () => selectLesson(nextLesson.id)
              : returnToSimulator}
          nextLabel={panel === "intro" ? "Start lesson" : nextLesson ? "Next lesson" : "Start a match"}
        />
      ) : null}
    </>
  );
}
