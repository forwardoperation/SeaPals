"use client";

import { useEffect, useRef } from "react";
import styles from "./HomeDiveReveal.module.css";

export default function HomeDiveReveal({ children }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (
      !container ||
      typeof window.IntersectionObserver !== "function" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pending = new Set();
    const enhanced = [];
    let observer = null;

    const reveal = (element) => {
      element.classList.remove(styles.pending);
      pending.delete(element);
      observer?.unobserve(element);
    };

    const revealAll = () => {
      pending.forEach(reveal);
      observer?.disconnect();
    };

    const handleMotionChange = (event) => {
      // Once visible, content stays visible even if the preference changes back.
      if (event.matches) revealAll();
    };

    const handleFocus = (event) => {
      // Reveal every pending ancestor, including nested chapter elements.
      pending.forEach((element) => {
        if (element.contains(event.target)) reveal(element);
      });
    };

    if (!motionPreference.matches) {
      const viewportBottom = window.innerHeight || document.documentElement.clientHeight;
      const candidates = Array.from(
        container.querySelectorAll("[data-dive-reveal]"),
      ).filter((element) => {
        if (element.contains(document.activeElement)) return false;
        const bounds = element.getBoundingClientRect();
        return bounds.height > 0 && bounds.top >= viewportBottom;
      });

      if (candidates.length) {
        observer = new window.IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting && entry.intersectionRatio >= 0.12) {
                reveal(entry.target);
              }
            });
          },
          { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
        );

        // Server-rendered and already-visible content never receives hidden styles.
        candidates.forEach((element) => {
          element.classList.add(styles.item, styles.pending);
          enhanced.push(element);
          pending.add(element);
          observer.observe(element);
        });
      }
    }

    container.addEventListener("focusin", handleFocus);
    if (typeof motionPreference.addEventListener === "function") {
      motionPreference.addEventListener("change", handleMotionChange);
    } else {
      motionPreference.addListener(handleMotionChange);
    }

    return () => {
      observer?.disconnect();
      container.removeEventListener("focusin", handleFocus);
      if (typeof motionPreference.removeEventListener === "function") {
        motionPreference.removeEventListener("change", handleMotionChange);
      } else {
        motionPreference.removeListener(handleMotionChange);
      }
      enhanced.forEach((element) => {
        element.classList.remove(styles.item, styles.pending);
      });
      pending.clear();
    };
  }, []);

  return (
    <div ref={containerRef} className={styles.wrapper}>
      {children}
    </div>
  );
}
