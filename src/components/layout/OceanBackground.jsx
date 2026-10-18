"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import OceanFootage from "./OceanFootage";
import styles from "./OceanBackground.module.css";

export default function OceanBackground() {
  const pathname = usePathname();
  const viewportRef = useRef(null);
  const worldRef = useRef(null);
  const isGameRoute =
    pathname?.startsWith("/adventure") ||
    pathname?.startsWith("/auth") ||
    pathname?.startsWith("/dev/reefbound/play") ||
    /^\/instructions\/tutorial(-v2)?$/.test(pathname ?? "") ||
    pathname === "/simulator" ||
    pathname === "/simulator-v2";

  useEffect(() => {
    const viewport = viewportRef.current;
    const world = worldRef.current;
    if (isGameRoute || !viewport || !world) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionPreference.matches;
    let frameId = null;
    let needsMeasurement = true;
    let maxScroll = 0;
    let travel = 0;

    function updateCamera() {
      frameId = null;

      if (needsMeasurement) {
        needsMeasurement = false;
        const viewportHeight = window.innerHeight;
        const documentHeight = Math.max(
          viewportHeight,
          document.documentElement.scrollHeight,
          document.body.scrollHeight,
        );
        maxScroll = Math.max(0, documentHeight - viewportHeight);
        travel = Math.min(maxScroll, viewportHeight * 2.1);
        viewport.dataset.reducedMotion = String(reducedMotion);
        world.style.height = `${reducedMotion ? documentHeight : viewportHeight + travel}px`;
      }

      const progress = maxScroll > 0
        ? Math.min(1, Math.max(0, window.scrollY / maxScroll))
        : 0;
      const depth = Math.min(1, Math.max(0, (progress - 0.1) / 0.85));
      // Keep the underwater camera level, and lose daylight as the page deepens.
      viewport.style.setProperty("--depth-darkness", String(depth * depth * (3 - 2 * depth)));
      viewport.dataset.atDepth = String(depth === 1);

      if (reducedMotion) {
        world.style.removeProperty("transform");
        return;
      }

      // The homepage invitation descends below the surface before the card passage.
      const surfaceOffset = pathname === "/"
        ? Math.min(travel, Math.max(0, window.scrollY))
        : progress * travel;
      world.style.transform = `translate3d(0, ${-surfaceOffset}px, 0)`;
    }

    function scheduleFrame() {
      if (frameId === null) frameId = window.requestAnimationFrame(updateCamera);
    }

    function measure() {
      needsMeasurement = true;
      scheduleFrame();
    }

    function updateMotionPreference(event) {
      reducedMotion = event.matches;
      measure();
    }

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(measure);
    resizeObserver?.observe(document.body);
    window.addEventListener("scroll", scheduleFrame, { passive: true });
    window.addEventListener("resize", measure);
    window.addEventListener("pageshow", measure);
    motionPreference.addEventListener("change", updateMotionPreference);
    measure();

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener("scroll", scheduleFrame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("pageshow", measure);
      motionPreference.removeEventListener("change", updateMotionPreference);
    };
  }, [isGameRoute, pathname]);

  if (isGameRoute) return null;

  return (
    <div ref={viewportRef} className={styles.ocean} data-ocean-viewport aria-hidden="true">
      <div className={styles.water}>
        <OceanFootage
          src="/media/ocean/clear-blue-water.mp4"
          poster="/media/ocean/clear-blue-water.webp"
          className={styles.footage}
        />
      </div>
      <div ref={worldRef} className={styles.world}>
        <div className={styles.surface}>
          <OceanFootage
            src="/media/ocean/surface-steady.mp4"
            poster="/media/ocean/surface-steady.webp"
            className={styles.footage}
          />
        </div>
      </div>
      <div className={styles.depthShade} />
    </div>
  );
}
