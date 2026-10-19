"use client";

import { useEffect, useRef } from "react";
import styles from "./HomeDiveReveal.module.css";

// Exported so the real observer lifecycle can be tested without mounting React.
export function setupHomeDiveReveal(container, browser = window) {
  const unchanged = () => {};
  if (!container || typeof browser.IntersectionObserver !== "function" ||
      typeof browser.requestAnimationFrame !== "function" ||
      typeof browser.cancelAnimationFrame !== "function" ||
      typeof browser.matchMedia !== "function") return unchanged;

  let motionPreference;
  try {
    motionPreference = browser.matchMedia("(prefers-reduced-motion: reduce)");
  } catch {
    return unchanged;
  }
  if (motionPreference.matches) return unchanged;
  const modernMotionEvents = typeof motionPreference.addEventListener === "function" &&
    typeof motionPreference.removeEventListener === "function";
  const legacyMotionEvents = typeof motionPreference.addListener === "function" &&
    typeof motionPreference.removeListener === "function";
  if (!modernMotionEvents && !legacyMotionEvents) return unchanged;

  const document = container.ownerDocument;
  const viewport = () => ({
    top: browser.visualViewport?.offsetTop || 0,
    height: browser.visualViewport?.height || browser.innerHeight || document.documentElement.clientHeight,
  });
  const initialViewport = viewport();
  if (!(initialViewport.height > 0)) return unchanged;
  const enhanced = Array.from(container.querySelectorAll("[data-dive-reveal]"))
    .filter((element) => {
      const bounds = element.getBoundingClientRect();
      return !element.contains(document.activeElement) && bounds.height > 0 &&
        bounds.top >= initialViewport.top + initialViewport.height;
    });
  if (!enhanced.length) return unchanged;

  const pending = new Set(enhanced);
  const listeners = [];
  let observer;
  let frame = null;
  let stopped = false;

  function stopWatching() {
    if (stopped) return;
    stopped = true;
    observer?.disconnect();
    if (frame !== null) browser.cancelAnimationFrame(frame);
    frame = null;
    listeners.splice(0).forEach((remove) => remove());
  }

  function reveal(element, immediate = false) {
    element.classList.remove(styles.pending);
    if (immediate) element.classList.remove(styles.item);
    pending.delete(element);
    observer?.unobserve(element);
    if (!pending.size) stopWatching();
  }

  function revealAll() {
    [...pending].forEach((element) => reveal(element, true));
    stopWatching();
  }

  function scan() {
    frame = null;
    if (stopped) return;
    if (motionPreference.matches) return revealAll();
    const currentViewport = viewport();
    // A percentage rootMargin is based on WIDTH, and a target-area threshold
    // may never be reached by tall content. Use a viewport-height trigger.
    const revealLine = currentViewport.top + currentViewport.height * 0.92;
    const visible = [...pending].filter((element) =>
      element.getBoundingClientRect().top <= revealLine);
    // Read all bounds before changing styles, avoiding repeated layout work.
    visible.forEach((element) => reveal(element));
  }

  function scheduleScan() {
    if (!stopped && frame === null) frame = browser.requestAnimationFrame(scan);
  }

  function listen(target, name, handler, options) {
    if (typeof target?.addEventListener !== "function") return;
    target.addEventListener(name, handler, options);
    listeners.push(() => target.removeEventListener(name, handler, options));
  }

  function handleFocus(event) {
    [...pending].forEach((element) => {
      if (element.contains(event.target)) reveal(element, true);
    });
  }

  function handleMotionChange(event) {
    // Once visible, content stays visible if the preference later changes back.
    if (event.matches) revealAll();
  }

  try {
    observer = new browser.IntersectionObserver(scheduleScan, {
      rootMargin: `0px 0px -${Math.round(initialViewport.height * 0.08)}px 0px`,
      threshold: 0,
    });
  } catch {
    return unchanged;
  }

  listen(container, "focusin", handleFocus);
  // Recover from delayed/missed observer updates, mobile toolbar changes, and
  // restored scroll positions. There is no continuous animation-frame loop.
  listen(browser, "scroll", scheduleScan, { passive: true });
  listen(browser, "resize", scheduleScan, { passive: true });
  listen(browser.visualViewport, "scroll", scheduleScan, { passive: true });
  listen(browser.visualViewport, "resize", scheduleScan, { passive: true });
  listen(browser, "pageshow", (event) => event.persisted ? revealAll() : scheduleScan());
  listen(document, "visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleScan();
  });
  if (modernMotionEvents) {
    listen(motionPreference, "change", handleMotionChange);
  } else {
    motionPreference.addListener(handleMotionChange);
    listeners.push(() => motionPreference.removeListener(handleMotionChange));
  }

  try {
    // Server/no-JS content and anything already visible never receive opacity 0.
    enhanced.forEach((element) => {
      element.classList.add(styles.item, styles.pending);
      observer.observe(element);
    });
    scheduleScan();
  } catch {
    // A partially working observer must never strand invisible page content.
    revealAll();
  }

  return () => {
    stopWatching();
    enhanced.forEach((element) => element.classList.remove(styles.item, styles.pending));
    pending.clear();
  };
}

export default function HomeDiveReveal({ children }) {
  const containerRef = useRef(null);
  useEffect(() => setupHomeDiveReveal(containerRef.current), []);
  return (
    <div ref={containerRef} className={styles.wrapper}>
      {children}
    </div>
  );
}
