"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  createProfessorSpeechKey,
  getProfessorSpeechDuration,
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

const NORMAL_TEXT_SPEED_MULTIPLIER = 25 / 12;

const TEXT_SPEED_MULTIPLIER = Object.freeze({
  slow: 4,
  normal: NORMAL_TEXT_SPEED_MULTIPLIER,
  fast: 1.5,
  instant: 0,
});

function LessonDialogueMessage({
  message,
  textSpeed = "normal",
  reducedMotion = false,
  scrollable = false,
}) {
  const graphemes = useMemo(() => segmentProfessorMessage(message), [message]);
  const speedMultiplier = TEXT_SPEED_MULTIPLIER[textSpeed] ?? NORMAL_TEXT_SPEED_MULTIPLIER;
  const duration = useMemo(
    () => getProfessorSpeechDuration(graphemes.length) * speedMultiplier,
    [graphemes.length, speedMultiplier],
  );
  const [visibleCount, setVisibleCount] = useState(0);
  const [scrollState, setScrollState] = useState({ canScroll: false, atEnd: true });
  const animationRef = useRef({ frameId: null, generation: 0 });
  const scrollRef = useRef(null);
  const cursorRef = useRef(null);
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
      const msPerGrapheme = duration / graphemes.length;
      let nextVisibleCount = 0;
      let nextRevealAt = window.performance.now() + 120 + msPerGrapheme;
      const tick = (now) => {
        if (animationRef.current.generation !== generation) return;
        if (now >= nextRevealAt) {
          nextVisibleCount = Math.min(graphemes.length, nextVisibleCount + 1);
          setVisibleCount(nextVisibleCount);
          nextRevealAt = now + msPerGrapheme;
        }
        if (nextVisibleCount >= graphemes.length) {
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

  useEffect(() => {
    if (!scrollable) return undefined;
    const viewport = scrollRef.current;
    if (!viewport) return undefined;

    viewport.scrollTop = 0;
    const updateScrollState = () => {
      const canScroll = viewport.scrollHeight > viewport.clientHeight + 1;
      const atEnd = !canScroll
        || viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 2;
      setScrollState((current) => (
        current.canScroll === canScroll && current.atEnd === atEnd
          ? current
          : { canScroll, atEnd }
      ));
    };
    const frameId = window.requestAnimationFrame(updateScrollState);
    const resizeObserver = typeof window.ResizeObserver === "function"
      ? new window.ResizeObserver(updateScrollState)
      : null;
    resizeObserver?.observe(viewport);
    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
    };
  }, [message, scrollable]);

  useLayoutEffect(() => {
    if (!scrollable) return;
    const viewport = scrollRef.current;
    if (!viewport) return;

    if (isComplete) {
      viewport.scrollTop = viewport.scrollHeight - viewport.clientHeight;
    } else {
      const cursor = cursorRef.current;
      if (!cursor) return;
      const overflow = cursor.getBoundingClientRect().bottom - viewport.getBoundingClientRect().bottom;
      if (overflow > 0) viewport.scrollTop += Math.ceil(overflow);
    }

    const canScroll = viewport.scrollHeight > viewport.clientHeight + 1;
    const atEnd = !canScroll
      || viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 2;
    setScrollState((current) => (
      current.canScroll === canScroll && current.atEnd === atEnd
        ? current
        : { canScroll, atEnd }
    ));
  }, [isComplete, scrollable, visibleCount]);

  const messageContent = (
    <p
      ref={scrollable ? scrollRef : undefined}
      className={`${styles.instruction}${scrollable ? ` ${styles.messageViewport}` : ""}`}
      tabIndex={scrollable && scrollState.canScroll ? 0 : undefined}
      role={scrollable && scrollState.canScroll ? "region" : undefined}
      aria-label={scrollable && scrollState.canScroll ? "Scrollable message from Mr. Easterling" : undefined}
      data-v2-lesson-instruction
      data-v2-lesson-message-scroll={scrollable && scrollState.canScroll ? "true" : undefined}
      onScroll={scrollable ? () => {
        const viewport = scrollRef.current;
        if (!viewport) return;
        const atEnd = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 2;
        setScrollState((current) => (
          current.atEnd === atEnd ? current : { ...current, atEnd }
        ));
      } : undefined}
    >
      <span className={styles.typewriterFrame} aria-hidden="true">
        {visibleMessage}
        {!isComplete ? <span ref={cursorRef} className={styles.typewriterCursor} /> : null}
        <span className={styles.typewriterPending}>{pendingMessage}</span>
      </span>
      <span className={styles.srOnly}>{message}</span>
    </p>
  );

  if (!scrollable) return messageContent;

  return (
    <div className={styles.messageViewportFrame}>
      {messageContent}
      {scrollState.canScroll && isComplete && !scrollState.atEnd ? (
        <span className={styles.scrollHint} aria-hidden="true">
          Scroll <span>↓</span>
        </span>
      ) : null}
    </div>
  );
}

const FACE_OFF_DICE = Object.freeze([
  { label: "D4", sides: 4, points: "22,3 41,39 3,39" },
  { label: "D6", sides: 6, points: "5,5 39,5 39,39 5,39" },
  { label: "D8", sides: 8, points: "22,2 41,22 22,42 3,22" },
  { label: "D10", sides: 10, points: "22,2 34.3,6.2 41.8,19.8 37,34.8 22,42.2 7,34.8 2.2,19.8 9.7,6.2" },
  { label: "D12", sides: 12, points: "22,2 32,4 40,12 42,22 40,32 32,40 22,42 12,40 4,32 2,22 4,12 12,4" },
  { label: "D20", sides: 20, points: "22,1.5 38.3,8.8 42.7,25.5 31.7,40.5 12.3,40.5 1.3,25.5 5.7,8.8" },
]);

function DiceLadderVisualAid({ visualAid }) {
  if (visualAid?.kind !== "dice-ladder") return null;

  const requestedDice = Array.isArray(visualAid.dice) ? new Set(visualAid.dice) : null;
  const dice = requestedDice?.size
    ? FACE_OFF_DICE.filter((die) => requestedDice.has(die.label))
    : FACE_OFF_DICE;

  return (
    <div
      className={styles.diceLadder}
      role="group"
      aria-label="Faceoff dice and their roll ranges"
      data-v2-dice-primer
    >
      {dice.map((die) => (
        <div
          key={die.label}
          className={styles.dieReference}
          role="img"
          aria-label={`${die.label} rolls from 1 to ${die.sides}`}
          data-v2-die={die.label}
        >
          <svg className={styles.dieShape} viewBox="0 0 44 44" aria-hidden="true" focusable="false">
            <polygon points={die.points} />
          </svg>
          <strong>{die.label}</strong>
          <span>{`1–${die.sides}`}</span>
        </div>
      ))}
    </div>
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
  visualAid = null,
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const advanceRef = useRef(null);
  const bodyId = useId();
  const teacherTitleId = useId();
  const completed = Array.isArray(progress?.completedLessonIds) ? progress.completedLessonIds : [];
  const completedSet = new Set(completed);
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
    return (
      <LessonModal
        mode={mode}
        title="Learn by playing"
        onExit={onExit}
        className={`${styles.chooserModal} ${className}`.trim()}
      >
        <ol className={styles.lessonList} aria-label="Tutorial lessons" data-v2-lesson-list>
          {lessons.map((lesson, index) => {
            const done = completedSet.has(lesson.id);
            const active = activeLesson?.id === lesson.id;
            return (
              <li key={lesson.id}>
                <button
                  type="button"
                  className={`${styles.lessonButton}${done ? ` ${styles.completedLesson}` : ""}${active ? ` ${styles.activeLesson}` : ""}`}
                  onClick={() => onSelect?.(lesson.id)}
                  aria-label={`${done ? "Replay completed" : active ? "Restart" : "Start"} lesson ${index + 1}: ${lesson.title}`}
                  aria-current={active ? "step" : undefined}
                  data-completed={done || undefined}
                  data-v2-select-lesson={lesson.id}
                >
                  <span className={styles.lessonNumber} aria-hidden="true">{index + 1}</span>
                  <strong>{lesson.title}</strong>
                </button>
              </li>
            );
          })}
        </ol>
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
        const messageViewport = event.currentTarget.querySelector('[data-v2-lesson-message-scroll="true"]');
        event.preventDefault();
        if (event.shiftKey && event.target === advanceRef.current && messageViewport instanceof HTMLElement) {
          messageViewport.focus();
          return;
        }
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
              scrollable
            />
            <DiceLadderVisualAid visualAid={visualAid} />
            {message ? <p className={styles.feedback} data-tone={feedback?.tone || "success"} role="status" aria-live="polite" aria-atomic="true">{message}</p> : null}
          </div>
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
