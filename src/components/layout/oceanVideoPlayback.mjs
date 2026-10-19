// Keep media startup and visibility recovery independent of React rendering.
export function observeOceanFootage(video, src, browser = window, page = document) {
  const motion = browser.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = motion.matches;
  let nearView = false;
  let inView = false;
  let attached = false;
  let disposed = false;
  let pendingPlay = false;
  let playRequest = 0;
  let frameId = null;

  // Safari checks both inline playback and the muted media property at startup.
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");

  function shouldPlay() {
    return !disposed && inView && !page.hidden && !reducedMotion;
  }

  function pause() {
    playRequest += 1;
    pendingPlay = false;
    video.autoplay = false;
    video.pause();
  }

  function syncPlayback() {
    if (disposed) return;
    video.autoplay = shouldPlay();
    if (!attached && (nearView || inView) && !page.hidden && !reducedMotion) {
      attached = true;
      video.preload = "auto";
      video.src = src;
      // Explicitly select the dynamically attached source on WebKit too.
      video.load();
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
          if (disposed) return;
          if (request === playRequest) pendingPlay = false;
          if (!shouldPlay()) video.pause();
        },
        () => {
          if (!disposed && request === playRequest) pendingPlay = false;
          // Keep the poster, then retry on readiness, visibility or a gesture.
        },
      );
    } catch {
      pendingPlay = false;
    }
  }

  function measureVisibility() {
    if (disposed) return;
    const rect = video.getBoundingClientRect();
    const width = browser.innerWidth;
    const height = browser.innerHeight;
    const hasArea = rect.width > 0 && rect.height > 0;
    inView = hasArea && rect.bottom > 0 && rect.top < height && rect.right > 0 && rect.left < width;
    nearView = hasArea && rect.bottom > -200 && rect.top < height + 200 && rect.right > -200 && rect.left < width + 200;
    syncPlayback();
  }

  function scheduleMeasurement() {
    if (disposed || frameId !== null) return;
    frameId = browser.requestAnimationFrame(() => {
      frameId = null;
      measureVisibility();
    });
  }

  function changeMotion(event) {
    reducedMotion = event.matches;
    measureVisibility();
  }

  // Measure even when IntersectionObserver exists: transformed fixed layers and
  // Safari's page cache can otherwise leave visibility stale until the next crossing.
  let observer = null;
  if (typeof browser.IntersectionObserver === "function") {
    observer = new browser.IntersectionObserver(scheduleMeasurement, {
      rootMargin: "200px",
      threshold: [0, 0.001],
    });
    observer.observe(video);
  }
  browser.addEventListener("scroll", scheduleMeasurement, { passive: true, capture: true });
  browser.addEventListener("resize", scheduleMeasurement);
  browser.addEventListener("pageshow", measureVisibility);
  page.addEventListener("visibilitychange", measureVisibility);
  video.addEventListener("loadeddata", measureVisibility);
  video.addEventListener("canplay", measureVisibility);

  // Call play synchronously in the gesture, not from a later React effect/RAF.
  // This recovers when a device/browser policy initially blocks muted autoplay.
  page.addEventListener("touchend", measureVisibility, { passive: true });
  page.addEventListener("click", measureVisibility, { passive: true });
  page.addEventListener("keydown", measureVisibility);
  if (typeof motion.addEventListener === "function") {
    motion.addEventListener("change", changeMotion);
  } else {
    motion.addListener(changeMotion);
  }
  measureVisibility();

  return () => {
    disposed = true;
    if (frameId !== null) browser.cancelAnimationFrame(frameId);
    observer?.disconnect();
    browser.removeEventListener("scroll", scheduleMeasurement, true);
    browser.removeEventListener("resize", scheduleMeasurement);
    browser.removeEventListener("pageshow", measureVisibility);
    page.removeEventListener("visibilitychange", measureVisibility);
    video.removeEventListener("loadeddata", measureVisibility);
    video.removeEventListener("canplay", measureVisibility);
    page.removeEventListener("touchend", measureVisibility);
    page.removeEventListener("click", measureVisibility);
    page.removeEventListener("keydown", measureVisibility);
    if (typeof motion.removeEventListener === "function") {
      motion.removeEventListener("change", changeMotion);
    } else {
      motion.removeListener(changeMotion);
    }
    pause();
    if (attached) {
      video.removeAttribute("src");
      video.preload = "none";
      video.load();
    }
  };
}
