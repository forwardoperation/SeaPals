"use client";

import { useEffect, useId, useRef } from "react";

import styles from "./DefeatPresentation.module.css";

const BUBBLES = [
  { x: 12, size: 8, delay: -0.8, duration: 4.2 },
  { x: 23, size: 5, delay: -2.4, duration: 5.1 },
  { x: 37, size: 7, delay: -1.5, duration: 4.7 },
  { x: 64, size: 5, delay: -3.1, duration: 5.4 },
  { x: 78, size: 8, delay: -1.9, duration: 4.5 },
  { x: 90, size: 4, delay: -3.8, duration: 5.7 },
];

function formatDefeatReason(message) {
  const normalized = String(message ?? "").trim().replace(/^defeat\s*:\s*/i, "");
  return normalized || "Your ecosystem fell short this time.";
}

function ReefDefeatEmblem({ instanceId }) {
  const oceanGradientId = `${instanceId}-defeat-ocean`;
  const rimGradientId = `${instanceId}-defeat-rim`;
  const shadeGradientId = `${instanceId}-defeat-shade`;

  return (
    <svg
      className={styles.emblemGraphic}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      focusable="false"
      data-defeat-emblem-graphic
    >
      <defs>
        <radialGradient id={oceanGradientId} cx="40%" cy="28%" r="74%">
          <stop offset="0" stopColor="#48c7d4" />
          <stop offset="0.48" stopColor="#126b83" />
          <stop offset="1" stopColor="#052a43" />
        </radialGradient>
        <linearGradient id={rimGradientId} x1="18" y1="10" x2="84" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d8f4f4" />
          <stop offset="0.48" stopColor="#6597a5" />
          <stop offset="1" stopColor="#263e54" />
        </linearGradient>
        <linearGradient id={shadeGradientId} x1="31" y1="25" x2="70" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fb7185" />
          <stop offset="1" stopColor="#9f2848" />
        </linearGradient>
      </defs>

      <circle cx="50" cy="50" r="45" fill={`url(#${rimGradientId})`} className={styles.emblemRim} />
      <circle cx="50" cy="50" r="38" fill={`url(#${oceanGradientId})`} className={styles.emblemOcean} />
      <path className={styles.emblemCurrent} d="M19 48c10-8 20-8 30 0s20 8 32 0" />
      <path className={styles.emblemCurrentBack} d="M23 59c8-6 17-6 26 0s18 6 28 0" />
      <path
        className={styles.emblemCoral}
        fill={`url(#${shadeGradientId})`}
        d="M47 76V57l-9-8 4-5 5 4V31h7v13l7-8 5 5-12 13v22h-7Zm-5-18-12-7 3-6 9 4v9Zm17 3 12-8 4 6-16 10v-8Z"
      />
      <path className={styles.emblemCrack} d="m55 7-8 19 10 9-9 16 8 11-7 17" />
      <circle className={styles.emblemBubble} cx="31" cy="31" r="2.2" />
      <circle className={styles.emblemBubble} cx="70" cy="27" r="1.6" />
    </svg>
  );
}

export default function DefeatPresentation({
  message,
  actions = null,
  children = null,
  reducedMotion = false,
}) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const instanceId = useId().replaceAll(":", "");
  const reason = formatDefeatReason(message);
  const actionContent = actions ?? children;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const focusFrame = window.requestAnimationFrame(() => {
      const primaryAction = dialogRef.current?.querySelector("[data-defeat-primary-action]");
      const firstAction = primaryAction ?? dialogRef.current?.querySelector(
        "button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
      );
      (firstAction ?? dialogRef.current)?.focus?.({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, []);

  function keepFocusInDialog(event) {
    if (event.key !== "Tab") return;
    const focusable = [...(dialogRef.current?.querySelectorAll(
      "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ) ?? [])];
    if (!focusable.length) {
      event.preventDefault();
      dialogRef.current?.focus({ preventScroll: true });
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className={`${styles.layer}${reducedMotion ? ` ${styles.reducedMotion}` : ""}`}
      data-defeat-presentation
      data-reduced-motion={reducedMotion ? "true" : undefined}
    >
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.depthGlow} aria-hidden="true" />
      <div className={`${styles.ripple} ${styles.rippleOuter}`} aria-hidden="true" />
      <div className={`${styles.ripple} ${styles.rippleInner}`} aria-hidden="true" />
      <div className={styles.bubbles} aria-hidden="true" data-defeat-bubbles>
        {BUBBLES.map((bubble, index) => (
          <span
            key={`${bubble.x}-${bubble.size}`}
            className={styles.bubble}
            style={{
              "--bubble-x": `${bubble.x}%`,
              "--bubble-size": `${bubble.size}px`,
              "--bubble-delay": `${bubble.delay}s`,
              "--bubble-duration": `${bubble.duration}s`,
            }}
            data-bubble-index={index}
          />
        ))}
      </div>

      <section
        ref={dialogRef}
        className={styles.result}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={keepFocusInDialog}
      >
        <div className={styles.eyebrow}>Match complete</div>
        <div className={styles.emblem} data-defeat-emblem aria-hidden="true">
          <span className={styles.emblemGlow} />
          <ReefDefeatEmblem instanceId={instanceId} />
        </div>

        <h2 id={titleId} className={styles.title}>DEFEAT</h2>

        <p id={descriptionId} className={styles.reason} data-defeat-reason>
          <span className={styles.reasonAccent} aria-hidden="true" />
          <span>{reason}</span>
          <span className={styles.reasonAccent} aria-hidden="true" />
        </p>

        {actionContent ? (
          <div className={styles.actions} data-defeat-actions>
            {actionContent}
          </div>
        ) : null}
      </section>
    </div>
  );
}
