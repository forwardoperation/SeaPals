"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  createProfessorSpeechKey,
  getProfessorSpeechDuration,
  getProfessorVisibleGraphemeCount,
  segmentProfessorMessage,
} from "./tutorialDialogue.mjs";
import styles from "./SimulatorV2LessonPanel.module.css";

const PORTRAIT = "/images/adventure/mr-easterling-portrait-v2.webp";

function TeacherPortrait({ large = false }) {
  return (
    <img
      src={PORTRAIT}
      alt=""
      width="48"
      height="48"
      className={`${styles.portrait}${large ? ` ${styles.largePortrait}` : ""}`}
    />
  );
}

const TEXT_SPEED_MULTIPLIER = Object.freeze({
  slow: 1.5,
  normal: 1,
  fast: 0.55,
  instant: 0,
});

function LessonDialogueMessage({ message, textSpeed = "normal", reducedMotion = false }) {
  const graphemes = useMemo(() => segmentProfessorMessage(message), [message]);
  const speedMultiplier = TEXT_SPEED_MULTIPLIER[textSpeed] ?? 1;
  const duration = useMemo(
    () => getProfessorSpeechDuration(graphemes.length) * speedMultiplier,
    [graphemes.length, speedMultiplier],
  );
  const [visibleCount, setVisibleCount] = useState(0);
  const animationRef = useRef({ frameId: null, generation: 0 });
  const visibleMessage = graphemes.slice(0, visibleCount).join("");
  const pendingMessage = graphemes.slice(visibleCount).join("");
  const isComplete = visibleCount >= graphemes.length;

  useEffect(() => {
    const animation = animationRef.current;
    const generation = animation.generation + 1;
    animation.generation = generation;
    if (animation.frameId != null) window.cancelAnimationFrame(animation.frameId);
    animation.frameId = null;

    const motionPreference = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    const finish = () => {
      if (animationRef.current.generation !== generation) return;
      if (animationRef.current.frameId != null) window.cancelAnimationFrame(animationRef.current.frameId);
      animationRef.current.frameId = null;
      setVisibleCount(graphemes.length);
    };
    const handleMotionPreference = (event) => {
      if (event.matches) finish();
    };

    if (!graphemes.length || reducedMotion || textSpeed === "instant" || motionPreference?.matches) {
      setVisibleCount(graphemes.length);
    } else {
      setVisibleCount(0);
      const startsAt = window.performance.now() + 120;
      const tick = (now) => {
        if (animationRef.current.generation !== generation) return;
        const nextCount = getProfessorVisibleGraphemeCount({
          graphemeCount: graphemes.length,
          elapsedMs: Math.max(0, now - startsAt),
          durationMs: duration,
        });
        setVisibleCount(nextCount);
        if (nextCount >= graphemes.length) {
          animationRef.current.frameId = null;
          return;
        }
        animationRef.current.frameId = window.requestAnimationFrame(tick);
      };
      animation.frameId = window.requestAnimationFrame(tick);
    }

    if (motionPreference?.addEventListener) motionPreference.addEventListener("change", handleMotionPreference);
    else motionPreference?.addListener?.(handleMotionPreference);
    return () => {
      if (animationRef.current.generation === generation) animationRef.current.generation += 1;
      if (animationRef.current.frameId != null) window.cancelAnimationFrame(animationRef.current.frameId);
      animationRef.current.frameId = null;
      if (motionPreference?.removeEventListener) motionPreference.removeEventListener("change", handleMotionPreference);
      else motionPreference?.removeListener?.(handleMotionPreference);
    };
  }, [duration, graphemes.length, message, reducedMotion, textSpeed]);

  return (
    <p className={styles.instruction} data-v2-lesson-instruction>
      <span className={styles.typewriterFrame} aria-hidden="true">
        {visibleMessage}
        {!isComplete ? <span className={styles.typewriterCursor} /> : null}
        <span className={styles.typewriterPending}>{pendingMessage}</span>
      </span>
      <span className={styles.srOnly}>{message}</span>
    </p>
  );
}

function readableModuleTitle(moduleId) {
  if (!moduleId || moduleId === "core") return "Core lessons";
  return String(moduleId)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function groupLessonsByModule(lessons, moduleDefinitions = []) {
  const definitions = Array.isArray(moduleDefinitions) ? moduleDefinitions : [];
  const lessonModuleIds = new Map();
  definitions.forEach((module) => {
    (module.lessonIds ?? []).forEach((lessonId) => lessonModuleIds.set(lessonId, module.id));
  });

  const groups = new Map();
  definitions.forEach((module) => groups.set(module.id, { ...module, lessons: [] }));
  lessons.forEach((lesson) => {
    const moduleId = lesson.moduleId ?? lessonModuleIds.get(lesson.id) ?? "core";
    if (!groups.has(moduleId)) {
      groups.set(moduleId, {
        id: moduleId,
        title: lesson.moduleTitle ?? readableModuleTitle(moduleId),
        description: lesson.moduleDescription ?? "",
        lessons: [],
      });
    }
    groups.get(moduleId).lessons.push(lesson);
  });

  return [...groups.values()]
    .filter((module) => module.lessons.length)
    .map((module) => ({
      ...module,
      title: module.title ?? readableModuleTitle(module.id),
      description: module.description ?? module.summary ?? "",
    }));
}

function lessonGoal(lesson) {
  return String(lesson?.goalLabel ?? "").trim()
    || (lesson?.victoryTarget ? `Reach ${lesson.victoryTarget} VP` : "Complete the lesson");
}

function LessonModal({ mode, title, description, children, onExit, className }) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus({ preventScroll: true });
    return () => {
      if (dialog.open) dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [mode]);

  return (
    <dialog
      ref={dialogRef}
      className={`${styles.modal} ${className}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      data-v2-lesson-panel={mode}
      onKeyDown={(event) => event.stopPropagation()}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onExit?.();
      }}
    >
      <div className={styles.modalHeader}>
        <TeacherPortrait large />
        <div>
          <span className={styles.kicker}>Mr. Easterling · Your guide</span>
          <h2 ref={headingRef} tabIndex={-1} id={titleId}>{title}</h2>
        </div>
        {onExit ? <button type="button" className={styles.closeButton} onClick={onExit} aria-label={mode === "intro" ? "Return to the lesson list" : "Close lessons and return to game"}>×</button> : null}
      </div>
      {description ? <p id={descriptionId} className={styles.modalDescription}>{description}</p> : null}
      {children}
    </dialog>
  );
}

/**
 * Presentation for the real simulator board. stepIndex is zero-based.
 * interaction="drag" lets the board present its gesture cue beside this compact guidance.
 * The caller owns lesson state, game actions, and panel placement.
 */
export default function SimulatorV2LessonPanel({
  mode = "coach",
  lessons = [],
  lessonModules = [],
  activeLesson = null,
  progress = {},
  instruction = "",
  interaction = null,
  explanation = "",
  hint = "",
  feedback = "",
  onSelect,
  onExit,
  onAdvance,
  advanceLabel = "Continue",
  onNext,
  nextLabel,
  onReplay,
  initialCollapsed = false,
  className = "",
  dragPassive = false,
  messageKey = "",
  textSpeed = "normal",
  reducedMotion = false,
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const advanceRef = useRef(null);
  const bodyId = useId();
  const teacherTitleId = useId();
  const completed = Array.isArray(progress?.completedLessonIds) ? progress.completedLessonIds : [];
  const completedSet = new Set(completed);
  const completedCount = lessons.filter((lesson) => completedSet.has(lesson.id)).length;
  const lessonGroups = groupLessonsByModule(lessons, lessonModules);
  const lessonIndex = lessons.findIndex((lesson) => lesson.id === activeLesson?.id);
  const activeModule = lessonGroups.find((module) => module.lessons.some((lesson) => lesson.id === activeLesson?.id));
  const stepCount = Number.isFinite(progress?.stepCount) ? Math.max(0, progress.stepCount) : 0;
  const stepNumber = stepCount ? Math.min(stepCount, Math.max(1, (progress?.stepIndex ?? 0) + 1)) : 0;
  const message = typeof feedback === "string" ? feedback : feedback?.message;
  const currentInstruction = instruction || (interaction === "drag"
    ? "Drag the highlighted card into your ecosystem."
    : activeLesson?.description || activeLesson?.summary || "Follow the highlighted move on the board.");
  const dialogueMessage = onAdvance ? explanation || currentInstruction : currentInstruction;
  const dialogueKey = createProfessorSpeechKey(
    messageKey || `${activeLesson?.id ?? "lesson"}:${progress?.stepIndex ?? 0}`,
    dialogueMessage,
  );

  if (mode === "chooser") {
    const firstIncompleteModule = lessonGroups.find((module) => (
      module.lessons.some((lesson) => !completedSet.has(lesson.id))
    ));
    const openModuleId = activeModule?.id ?? firstIncompleteModule?.id ?? lessonGroups[0]?.id;
    const progressPercent = lessons.length ? (completedCount / lessons.length) * 100 : 0;

    return (
      <LessonModal
        mode={mode}
        title="Learn by playing"
        description={`${lessons.length} short lesson${lessons.length === 1 ? "" : "s"} on the game board. I’ll guide you through each move.`}
        onExit={onExit}
        className={className}
      >
        <div className={styles.curriculumProgress} data-v2-curriculum-progress>
          <div className={styles.progressCopy}>
            <strong>{completedCount} of {lessons.length} complete</strong>
            <span>{completedCount === lessons.length && lessons.length ? "All lessons complete" : "Continue at your own pace"}</span>
          </div>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="Overall tutorial progress"
            aria-valuemin="0"
            aria-valuemax={Math.max(1, lessons.length)}
            aria-valuenow={completedCount}
            aria-valuetext={`${completedCount} of ${lessons.length} lessons complete`}
          >
            <span className={styles.progressFill} style={{ "--lesson-progress": `${progressPercent}%` }} />
          </div>
        </div>
        <div className={styles.moduleList} data-v2-lesson-modules>
          {lessonGroups.map((module) => {
            const moduleCompleted = module.lessons.filter((lesson) => completedSet.has(lesson.id)).length;
            return (
              <details
                key={module.id}
                className={styles.moduleGroup}
                open={module.id === openModuleId || undefined}
                data-v2-lesson-module={module.id}
              >
                <summary className={styles.moduleSummary}>
                  <span className={styles.moduleHeading}>
                    <strong>{module.title}</strong>
                    {module.description ? <span>{module.description}</span> : null}
                  </span>
                  <span className={styles.moduleProgress}>{moduleCompleted}/{module.lessons.length} complete</span>
                  <span className={styles.moduleChevron} aria-hidden="true" />
                </summary>
                <ol
                  className={styles.lessonList}
                  aria-label={`${module.title} lessons`}
                  start={Math.max(1, lessons.findIndex((lesson) => lesson.id === module.lessons[0]?.id) + 1)}
                >
                  {module.lessons.map((lesson) => {
                    const index = lessons.findIndex((entry) => entry.id === lesson.id);
                    const done = completedSet.has(lesson.id);
                    const active = activeLesson?.id === lesson.id;
                    const goal = lessonGoal(lesson);
                    return (
                      <li key={lesson.id}>
                        <button
                          type="button"
                          className={`${styles.lessonButton}${active ? ` ${styles.activeLesson}` : ""}`}
                          onClick={() => onSelect?.(lesson.id)}
                          aria-label={`${done ? "Replay" : active ? "Restart" : "Start"} lesson ${index + 1}: ${lesson.title}. ${goal}.${lesson.duration ? ` ${lesson.duration}.` : ""}`}
                          aria-current={active ? "step" : undefined}
                          data-v2-select-lesson={lesson.id}
                        >
                          <span className={`${styles.lessonNumber}${done ? ` ${styles.doneNumber}` : ""}`} aria-hidden="true">{done ? "✓" : index + 1}</span>
                          <span className={styles.lessonCopy}>
                            <strong>{lesson.title}</strong>
                            <span className={styles.lessonSummary}>{lesson.description || lesson.summary}</span>
                            <span className={styles.lessonMeta}>
                              <span className={styles.lessonGoal} data-v2-lesson-goal={lesson.victoryTarget}>
                                {lesson.goalLabel || <>Goal {lesson.victoryTarget} VP</>}
                              </span>
                              {lesson.duration ? <span>{lesson.duration}</span> : null}
                              <small>{done ? "Complete · Play again" : active ? "In progress · Restart" : "Start lesson"}</small>
                            </span>
                          </span>
                          <span className={styles.lessonArrow} aria-hidden="true">→</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </details>
            );
          })}
        </div>
        <div className={styles.modalFooter}>
          <span>{completedCount === lessons.length && lessons.length ? "You can replay any lesson." : "One idea at a time. Your progress is saved."}</span>
          {onExit ? <button type="button" className={styles.textButton} onClick={onExit}>Back to game</button> : null}
        </div>
      </LessonModal>
    );
  }

  if (mode === "intro") {
    const introduction = activeLesson?.introduction
      || `In this lesson, you'll learn ${activeLesson?.description || activeLesson?.summary || "your next Reefkeeper skill"}.`;

    return (
      <LessonModal
        mode={mode}
        title={activeLesson?.title || "Your next lesson"}
        onExit={onExit}
        className={className}
      >
        <div
          className={styles.lessonIntro}
          data-v2-lesson-introduction={activeLesson?.id || undefined}
        >
          <div className={styles.introDialogue}>
            <LessonDialogueMessage
              key={createProfessorSpeechKey(`${activeLesson?.id ?? "lesson"}:intro`, introduction)}
              message={introduction}
              textSpeed={textSpeed}
              reducedMotion={reducedMotion}
            />
          </div>
        </div>
        <div className={styles.introActions}>
          <button type="button" className={styles.primaryButton} onClick={onNext} data-v2-start-lesson>
            Start Lesson<span aria-hidden="true">→</span>
          </button>
          {onExit ? <button type="button" className={styles.textButton} onClick={onExit}>Choose Another Lesson</button> : null}
        </div>
      </LessonModal>
    );
  }

  if (mode === "complete") {
    const completionSet = new Set(completed);
    if (activeLesson?.id) completionSet.add(activeLesson.id);
    const completionCount = lessons.filter((lesson) => completionSet.has(lesson.id)).length;
    const allDone = lessons.length > 0 && completionCount === lessons.length;
    const moduleCompletionCount = activeModule?.lessons.filter((lesson) => completionSet.has(lesson.id)).length ?? 0;
    const completionPercent = lessons.length ? (completionCount / lessons.length) * 100 : 0;
    return (
      <LessonModal
        mode={mode}
        title={allDone ? "You’re ready to play." : activeLesson?.celebration || "Lesson complete!"}
        description={allDone ? "You’ve practiced the basics on the real board. Your next reef is up to you." : activeLesson?.title}
        onExit={onExit}
        className={className}
      >
        {activeLesson?.goalLabel || activeLesson?.victoryTarget ? (
          <div
            className={styles.completionGoal}
            data-v2-completion-goal={activeLesson.victoryTarget}
            data-v2-completion-goal-label={lessonGoal(activeLesson)}
          >
            {activeLesson.goalLabel || <>Goal reached · {activeLesson.victoryTarget} VP</>}
          </div>
        ) : null}
        <div className={styles.completionMessage}>
          <span className={styles.completionCheck} aria-hidden="true">✓</span>
          <p>{message || activeLesson?.summary || "You made the moves. That’s how a Reefkeeper learns."}</p>
        </div>
        <div className={styles.completionProgress} data-v2-completion-progress>
          <div className={styles.progressCopy}>
            <strong>{completionCount} of {lessons.length} lessons complete</strong>
            {activeModule ? <span>{activeModule.title} · {moduleCompletionCount}/{activeModule.lessons.length}</span> : null}
          </div>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="Overall tutorial progress"
            aria-valuemin="0"
            aria-valuemax={Math.max(1, lessons.length)}
            aria-valuenow={completionCount}
            aria-valuetext={`${completionCount} of ${lessons.length} lessons complete`}
          >
            <span className={styles.progressFill} style={{ "--lesson-progress": `${completionPercent}%` }} />
          </div>
        </div>
        <div className={styles.completionActions}>
          {onNext ? <button type="button" className={styles.primaryButton} onClick={onNext} data-v2-next-lesson>{nextLabel || (allDone ? "Start a match" : "Next lesson")}<span aria-hidden="true">→</span></button> : onExit ? <button type="button" className={styles.primaryButton} onClick={onExit}>Back to game <span aria-hidden="true">→</span></button> : null}
          {onReplay ? <button type="button" className={styles.secondaryButton} onClick={onReplay}>Replay lesson</button> : null}
        </div>
      </LessonModal>
    );
  }

  return (
    <aside
      className={`${styles.coach}${collapsed ? ` ${styles.collapsed}` : ""}${dragPassive ? ` ${styles.dragPassive}` : ""} ${className}`}
      aria-labelledby={teacherTitleId}
      onKeyDown={onAdvance ? (event) => {
        if (event.key !== "Tab") return;
        event.preventDefault();
        advanceRef.current?.focus();
      } : undefined}
      data-v2-lesson-panel="coach"
      data-v2-lesson-interaction={interaction || undefined}
      data-v2-lesson-vp-target={activeLesson?.victoryTarget || undefined}
      data-v2-lesson-drag-passive={dragPassive ? "true" : undefined}
    >
      <div className={styles.coachPortrait} aria-hidden="true">
        <TeacherPortrait />
      </div>
      <div className={styles.coachBubble}>
        <div className={styles.coachHeader}>
          <div className={styles.coachIdentity}>
            <strong id={teacherTitleId}>Mr. Easterling</strong>
            <span>{lessonIndex >= 0 ? `Lesson ${lessonIndex + 1} of ${lessons.length}` : activeLesson?.title || "Your reef guide"}{stepCount ? ` · Step ${stepNumber} of ${stepCount}` : ""}{activeLesson?.victoryTarget ? ` · Goal ${activeLesson.victoryTarget} VP` : ""}</span>
          </div>
          {!onAdvance ? (
            <button
              type="button"
              className={styles.collapseButton}
              onClick={() => setCollapsed((value) => !value)}
              aria-expanded={!collapsed}
              aria-controls={bodyId}
              aria-label={collapsed ? "Show teacher guidance" : "Minimize teacher guidance"}
            >
              <span aria-hidden="true">{collapsed ? "+" : "−"}</span>
            </button>
          ) : null}
        </div>
        <div id={bodyId} className={styles.coachBody} hidden={collapsed}>
          <div className={styles.currentMove}>
            <LessonDialogueMessage
              key={dialogueKey}
              message={dialogueMessage}
              textSpeed={textSpeed}
              reducedMotion={reducedMotion}
            />
            {message ? <p className={styles.feedback} data-tone={feedback?.tone || "success"} role="status" aria-live="polite" aria-atomic="true">{message}</p> : null}
          </div>
          {!onAdvance && (explanation || hint) ? (
            <div className={styles.helpOptions} key={`${activeLesson?.id}-${progress?.stepIndex}-${currentInstruction}`}>
              {explanation ? <details className={styles.helpDetail}><summary>Why?</summary><p>{explanation}</p></details> : null}
              {hint ? <details className={styles.helpDetail}><summary>Hint</summary><p>{hint}</p></details> : null}
            </div>
          ) : null}
          {onAdvance ? (
            <button
              ref={advanceRef}
              type="button"
              autoFocus
              className={styles.advanceButton}
              onClick={onAdvance}
              aria-label={`${advanceLabel}: ${currentInstruction}`}
              data-v2-lesson-advance
            >
              <span className={styles.advanceLabel}>{advanceLabel}</span>
              <span className={styles.actionMarker} aria-hidden="true">{"\u25B6"}</span>
            </button>
          ) : (
            <span className={styles.passiveAdvance} aria-hidden="true">
              <span className={styles.actionMarker}>{"\u25B6"}</span>
            </span>
          )}
        </div>
      </div>
      {collapsed ? <span className={styles.srOnly} aria-live="polite">{currentInstruction}</span> : null}
    </aside>
  );
}
