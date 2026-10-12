"use client";

import { useEffect, useState } from "react";
import { getPerspectiveGroundStyle } from "./adventurePerspective.mjs";
import {
  ADVENTURE_TOUCH_MEDIA_QUERY,
  getAdventureGraphicsProfile,
  isAdventureMobileDevice,
} from "./adventureGraphics.mjs";
import styles from "./adventure.module.css";

export function useAdventureGraphics(preference) {
  // The server and first client render agree. Detection runs before game boot
  // finishes and never writes a device-specific choice into a cloud save.
  const [mobileDevice, setMobileDevice] = useState(false);
  useEffect(() => {
    const detect = () => setMobileDevice(isAdventureMobileDevice(window));
    detect();
    const query = window.matchMedia?.(ADVENTURE_TOUCH_MEDIA_QUERY);
    query?.addEventListener?.("change", detect);
    return () => query?.removeEventListener?.("change", detect);
  }, []);
  return getAdventureGraphicsProfile(preference, mobileDevice);
}

export function useAdventureViewport() {
  const [element, setElement] = useState(null);
  const [viewport, setViewport] = useState({ width: 900, height: 506.25 });
  useEffect(() => {
    if (!element) return undefined;
    const measure = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (width <= 0 || height <= 0) return;
      setViewport((current) => current.width === width && current.height === height
        ? current : { width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, viewport];
}

export default function AdventurePerspectiveGround({ scene, camera, themeClass }) {
  return (
    <div
      aria-hidden="true"
      className={`${themeClass} ${styles.perspectiveGround}`}
      style={{
        ...getPerspectiveGroundStyle(scene, camera),
        backgroundImage: scene.artPath ? `url("${scene.artPath}")` : undefined,
      }}
    />
  );
}
