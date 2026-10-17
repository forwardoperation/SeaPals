"use client";

import { useEffect, useRef } from "react";

export default function OceanFootage({ src, poster, className }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motion.matches;
    let nearView = false;
    let inView = false;
    let attached = false;
    let disposed = false;
    let pendingPlay = false;
    let playRequest = 0;

    // Keep native autoplay policies satisfied even before React's first update.
    video.muted = true;
    video.defaultMuted = true;

    function shouldPlay() {
      return !disposed && inView && !document.hidden && !reducedMotion;
    }

    function pause() {
      playRequest += 1;
      pendingPlay = false;
      video.pause();
    }

    function syncPlayback() {
      if (disposed) return;
      if (!attached && (nearView || inView) && !document.hidden && !reducedMotion) {
        video.preload = "auto";
        video.src = src;
        attached = true;
      }
      if (!attached || !shouldPlay()) {
        pause();
        return;
      }
      if (pendingPlay || !video.paused) return;

      const request = ++playRequest;
      pendingPlay = true;
      try {
        Promise.resolve(video.play()).then(
          () => {
            // An old effect must never pause a newer source on the same element.
            if (disposed) return;
            if (request === playRequest) pendingPlay = false;
            if (!shouldPlay()) video.pause();
          },
          () => {
            if (!disposed && request === playRequest) pendingPlay = false;
            // Autoplay rejection or an interrupted load keeps the native poster.
          },
        );
      } catch {
        pendingPlay = false;
      }
    }

    function changeMotion(event) {
      reducedMotion = event.matches;
      syncPlayback();
    }

    // Only used by browsers without IntersectionObserver.
    function measureVisibility() {
      const rect = video.getBoundingClientRect();
      const width = window.innerWidth;
      const height = window.innerHeight;
      const hasArea = rect.width > 0 && rect.height > 0;
      inView = hasArea && rect.bottom > 0 && rect.top < height && rect.right > 0 && rect.left < width;
      nearView = hasArea && rect.bottom > -200 && rect.top < height + 200 && rect.right > -200 && rect.left < width + 200;
      syncPlayback();
    }

    let nearObserver = null;
    let visibilityObserver = null;
    if (typeof IntersectionObserver !== "undefined") {
      nearObserver = new IntersectionObserver(([entry]) => {
        nearView = entry.isIntersecting;
        syncPlayback();
      }, { root: video.closest("[data-ocean-viewport]"), rootMargin: "200px" });
      visibilityObserver = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting && entry.intersectionRatio > 0;
        syncPlayback();
      }, { rootMargin: "0px", threshold: [0, 0.001] });
      nearObserver.observe(video);
      visibilityObserver.observe(video);
    } else {
      window.addEventListener("scroll", measureVisibility, { passive: true, capture: true });
      window.addEventListener("resize", measureVisibility);
      measureVisibility();
    }

    document.addEventListener("visibilitychange", syncPlayback);
    motion.addEventListener("change", changeMotion);

    return () => {
      disposed = true;
      nearObserver?.disconnect();
      visibilityObserver?.disconnect();
      window.removeEventListener("scroll", measureVisibility, true);
      window.removeEventListener("resize", measureVisibility);
      document.removeEventListener("visibilitychange", syncPlayback);
      motion.removeEventListener("change", changeMotion);
      pause();
      if (attached) {
        video.removeAttribute("src");
        video.preload = "none";
        video.load();
      }
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      className={className}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      disablePictureInPicture
      disableRemotePlayback
      tabIndex={-1}
      aria-hidden="true"
    />
  );
}
