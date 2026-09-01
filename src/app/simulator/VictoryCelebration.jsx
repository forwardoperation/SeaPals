"use client";

import { useEffect, useId, useRef } from "react";

import styles from "./VictoryCelebration.module.css";

const SPARKLES = [
  { x: 9, y: 18, size: 8, delay: -0.4, duration: 2.8 },
  { x: 18, y: 72, size: 5, delay: -1.8, duration: 3.4 },
  { x: 27, y: 34, size: 6, delay: -2.5, duration: 3.1 },
  { x: 38, y: 10, size: 4, delay: -0.9, duration: 2.7 },
  { x: 62, y: 12, size: 6, delay: -1.4, duration: 3.2 },
  { x: 74, y: 36, size: 5, delay: -2.2, duration: 2.9 },
  { x: 84, y: 70, size: 8, delay: -0.7, duration: 3.5 },
  { x: 92, y: 22, size: 4, delay: -2.8, duration: 3 },
  { x: 12, y: 48, size: 4, delay: -2.1, duration: 2.6 },
  { x: 89, y: 49, size: 6, delay: -1.1, duration: 3.3 },
  { x: 30, y: 83, size: 5, delay: -0.2, duration: 2.9 },
  { x: 70, y: 84, size: 4, delay: -1.9, duration: 2.7 },
];

function formatVictoryReason(message) {
  const normalized = String(message ?? "").trim().replace(/^victory\s*:\s*/i, "");
  return normalized || "Your ecosystem reached the victory target.";
}

function ReefVictoryCrest({ instanceId }) {
  const goldGradientId = `${instanceId}-victory-gold`;
  const oceanGradientId = `${instanceId}-victory-ocean`;
  const shineGradientId = `${instanceId}-victory-shine`;

  return (
    <svg
      className={styles.crestGraphic}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      focusable="false"
      data-victory-crest-graphic
    >
      <defs>
        <radialGradient id={goldGradientId} cx="42%" cy="30%" r="68%">
          <stop offset="0" stopColor="#fff9c8" />
          <stop offset="0.34" stopColor="#ffe876" />
          <stop offset="0.72" stopColor="#f7ad28" />
          <stop offset="1" stopColor="#9c4b08" />
        </radialGradient>
        <linearGradient id={oceanGradientId} x1="23" y1="24" x2="78" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a8fbff" />
          <stop offset="0.42" stopColor="#0dd5d1" />
          <stop offset="1" stopColor="#05608c" />
        </linearGradient>
        <linearGradient id={shineGradientId} x1="25" y1="18" x2="72" y2="83" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.92" />
          <stop offset="0.36" stopColor="white" stopOpacity="0.12" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      <polygon
        className={styles.crestBurst}
        points="50,2 60,21 80,8 78,30 99,27 84,43 100,50 84,57 99,73 78,70 80,92 60,79 50,98 40,79 20,92 22,70 1,73 16,57 0,50 16,43 1,27 22,30 20,8 40,21"
        fill={`url(#${goldGradientId})`}
      />
      <polygon
        className={styles.crestEdge}
        points="50,2 60,21 80,8 78,30 99,27 84,43 100,50 84,57 99,73 78,70 80,92 60,79 50,98 40,79 20,92 22,70 1,73 16,57 0,50 16,43 1,27 22,30 20,8 40,21"
      />
      <circle className={styles.crestPearlRim} cx="50" cy="50" r="29" />
      <circle cx="50" cy="50" r="25.5" fill={`url(#${oceanGradientId})`} />
      <path className={styles.crestWave} d="M25 49c8-7 16-7 24 0s16 7 26 0v8c-9 7-18 7-26 0s-16-7-24 0v-8Z" />
      <path className={styles.crestWaveBack} d="M28 39c7-6 14-6 21 0s14 6 23 0" />
      <circle className={styles.crestBubble} cx="34" cy="31" r="2.2" />
      <circle className={styles.crestBubble} cx="41" cy="25" r="1.35" />
      <circle className={styles.crestBubble} cx="68" cy="33" r="1.7" />
      <path d="M30 25c14-8 30-7 42 4-15-5-28-2-39 8Z" fill={`url(#${shineGradientId})`} />
    </svg>
  );
}
export default function VictoryCelebration({
  message,
  actions = null,
  children = null,
  reducedMotion = false,
}) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const instanceId = useId().replaceAll(":", "");
  const reason = formatVictoryReason(message);
  const actionContent = actions ?? children;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const focusFrame = window.requestAnimationFrame(() => {
      const firstAction = dialogRef.current?.querySelector(
        "[data-victory-primary-action], button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
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
      data-victory-celebration
      data-reduced-motion={reducedMotion ? "true" : undefined}
    >
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.rays} aria-hidden="true" />
      <div className={`${styles.ring} ${styles.ringOuter}`} aria-hidden="true" />
      <div className={`${styles.ring} ${styles.ringInner}`} aria-hidden="true" />
      <div className={styles.sparkles} aria-hidden="true" data-victory-sparkles>
        {SPARKLES.map((sparkle, index) => (
          <span
            key={`${sparkle.x}-${sparkle.y}`}
            className={styles.sparkle}
            style={{
              "--spark-x": `${sparkle.x}%`,
              "--spark-y": `${sparkle.y}%`,
              "--spark-size": `${sparkle.size}px`,
              "--spark-delay": `${sparkle.delay}s`,
              "--spark-duration": `${sparkle.duration}s`,
            }}
            data-sparkle-index={index}
          />
        ))}
      </div>

      <section
        ref={dialogRef}
        className={styles.celebration}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={keepFocusInDialog}
      >
        <div className={styles.emblem} data-victory-emblem aria-hidden="true">
          <span className={styles.emblemGlow} />
          <ReefVictoryCrest instanceId={instanceId} />
        </div>

        <h2 id={titleId} className={styles.title} data-title="VICTORY">
          VICTORY
        </h2>

        <p id={descriptionId} className={styles.reason} data-victory-reason>
          <span className={styles.reasonAccent} aria-hidden="true" />
          <span>{reason}</span>
          <span className={styles.reasonAccent} aria-hidden="true" />
        </p>

        {actionContent ? (
          <div className={styles.actions} data-victory-actions>
            {actionContent}
          </div>
        ) : null}
      </section>
    </div>
  );
}
