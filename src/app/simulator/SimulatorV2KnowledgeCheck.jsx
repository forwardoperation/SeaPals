"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LessonDialogueMessage } from "./SimulatorV2LessonPanel";
import styles from "./SimulatorV2KnowledgeCheck.module.css";

export function evaluateLessonKnowledgeAnswer(check, choiceId) {
  const choice = check?.choices?.find((entry) => entry.id === choiceId);
  if (!choice) return null;
  return {
    choiceId: choice.id,
    correct: choice.id === check.correctChoiceId,
    feedback: String(choice.feedback ?? "").trim(),
  };
}

export default function SimulatorV2KnowledgeCheck({ check, guide = {}, onComplete }) {
  const [answer, setAnswer] = useState(null);
  const dialogRef = useRef(null);
  const titleRef = useRef(null);
  const continueRef = useRef(null);
  const completedRef = useRef(false);
  const titleId = useId();
  const promptId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const previousFocus = document.activeElement;
    if (!dialog.open) dialog.showModal();
    titleRef.current?.focus({ preventScroll: true });
    return () => {
      if (dialog.open) dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  useEffect(() => {
    setAnswer(null);
    completedRef.current = false;
  }, [check]);

  useEffect(() => {
    if (answer?.correct) continueRef.current?.focus({ preventScroll: true });
  }, [answer?.correct]);

  function chooseAnswer(choiceId) {
    setAnswer((current) => current?.correct
      ? current
      : evaluateLessonKnowledgeAnswer(check, choiceId) ?? current);
  }

  function finishCheck() {
    if (!answer?.correct || completedRef.current) return;
    completedRef.current = true;
    onComplete?.();
  }

  if (!check?.prompt || !Array.isArray(check.choices)) return null;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={promptId}
      data-v2-knowledge-check
      onCancel={(event) => event.preventDefault()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className={styles.heading}>
        <img
          src={guide.portraitSrc || "/images/adventure/mr-easterling-portrait-v2.webp"}
          width="44"
          height="44"
          alt=""
          className={styles.portrait}
        />
        <h2 ref={titleRef} tabIndex={-1} id={titleId}>Before you go…</h2>
      </div>
      <LessonDialogueMessage
        key={check.prompt}
        id={promptId}
        className={styles.prompt}
        message={check.prompt}
        textSpeed={guide.textSpeed || "normal"}
        reducedMotion={guide.reducedMotion === true}
      />
      <div className={styles.choices} role="group" aria-labelledby={promptId}>
        {check.choices.map((choice) => {
          const selected = answer?.choiceId === choice.id;
          return (
            <button
              key={choice.id}
              type="button"
              className={styles.choice}
              onClick={() => chooseAnswer(choice.id)}
              disabled={answer?.correct === true}
              aria-pressed={selected}
              data-v2-knowledge-choice={choice.id}
              data-result={selected ? answer.correct ? "correct" : "retry" : undefined}
            >
              {choice.text}
            </button>
          );
        })}
      </div>
      <div className={styles.feedback} role="status" aria-live="polite" aria-atomic="true">
        {answer ? (
          <p>
            <strong>{answer.correct ? "That’s right. " : "Let’s think it through. "}</strong>
            {answer.feedback}
            {!answer.correct ? " Try another answer." : null}
          </p>
        ) : null}
      </div>
      {answer?.correct ? (
        <div className={styles.actions}>
          <button
            ref={continueRef}
            type="button"
            onClick={finishCheck}
            className={styles.continueButton}
            data-v2-knowledge-continue
          >
            Continue <span aria-hidden="true">→</span>
          </button>
        </div>
      ) : null}
    </dialog>
  );
}
