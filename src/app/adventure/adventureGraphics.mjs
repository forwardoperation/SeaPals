import { ADVENTURE_GRAPHICS_MODES } from "./adventureSettings.mjs";

export const ADVENTURE_TOUCH_MEDIA_QUERY = "(pointer: coarse) and (hover: none)";

/** Detect the device, not the viewport: rotating a phone keeps battery saver on. */
export function isAdventureMobileDevice(browser = null) {
  const navigator = browser?.navigator;
  if (!navigator) return false;
  if (navigator.userAgentData?.mobile === true) return true;
  const agent = navigator.userAgent ?? "";
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(agent)) return true;
  // iPadOS can identify as a desktop Mac, even with a mouse connected.
  if (/Macintosh|MacIntel/i.test(`${agent} ${navigator.platform ?? ""}`)
    && navigator.maxTouchPoints > 1) return true;
  return navigator.maxTouchPoints > 0
    && browser.matchMedia?.(ADVENTURE_TOUCH_MEDIA_QUERY)?.matches === true;
}

/** Auto stays in the save; the detected device and resolved mode never do. */
export function getAdventureGraphicsProfile(preference, mobileDevice = false) {
  const selected = ADVENTURE_GRAPHICS_MODES.includes(preference) ? preference : "auto";
  const mode = selected === "auto" ? (mobileDevice ? "battery" : "perspective") : selected;
  return {
    mode,
    mobileDevice,
    automatic: selected === "auto",
    batterySaver: mode === "battery",
    worldFrameRate: mode === "battery" ? 30 : 60,
  };
}
