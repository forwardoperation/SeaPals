"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import OceanSceneMotion from "./OceanSceneMotion";
import styles from "./OceanBackground.module.css";

const motes = [
  [9, 12, 13, -4], [22, 42, 16, -10], [38, 18, 18, -8],
  [57, 61, 15, -3], [75, 27, 20, -12], [89, 72, 14, -6],
  [14, 79, 19, -14], [46, 84, 17, -7], [68, 45, 21, -15],
  [93, 9, 16, -9], [31, 67, 22, -18], [81, 91, 18, -11],
];

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

      if (reducedMotion) {
        world.style.removeProperty("transform");
        return;
      }

      const progress = maxScroll > 0
        ? Math.min(1, Math.max(0, window.scrollY / maxScroll))
        : 0;
      world.style.transform = `translate3d(0, ${-progress * travel}px, 0)`;
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
    <div ref={viewportRef} className={styles.ocean} aria-hidden="true">
      <div ref={worldRef} className={styles.world}>
        <div className={styles.surface}>
          <div className={styles.surfaceMotion} />
          <OceanSceneMotion kind="surface" className={styles.sceneCanvas} />
        </div>
        <div className={styles.water}>
          {motes.map(([x, y, duration, delay], index) => (
            <span key={index} className={styles.mote} style={{
              left: `${x}%`, top: `${y}%`,
              animationDuration: `${duration}s`, animationDelay: `${delay}s`,
            }} />
          ))}
        </div>
        <div className={styles.floor}>
          <div className={styles.floorMotion} />
          <OceanSceneMotion kind="floor" className={styles.sceneCanvas} />
        </div>
        <div className={styles.depthShade} />
      </div>
    </div>
  );
}
