import assert from "node:assert/strict";
import test from "node:test";
import { observeOceanFootage } from "./oceanVideoPlayback.mjs";

class Events {
  listeners = new Map();
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  emit(type, extra = {}) {
    for (const callback of this.listeners.get(type) ?? []) callback({ type, ...extra });
  }
  listenerCount() { return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0); }
}

function fixture({ reduced = false, legacyMotion = false, top = 0 } = {}) {
  const browser = new Events();
  const page = new Events();
  const video = new Events();
  const motion = new Events();
  motion.matches = reduced;
  if (legacyMotion) {
    motion.addListener = (callback) => Events.prototype.addEventListener.call(motion, "change", callback);
    motion.removeListener = (callback) => Events.prototype.removeEventListener.call(motion, "change", callback);
    motion.addEventListener = undefined;
    motion.removeEventListener = undefined;
  }
  const frames = new Map();
  let nextFrame = 0;
  browser.innerWidth = 390;
  browser.innerHeight = 800;
  browser.matchMedia = () => motion;
  browser.requestAnimationFrame = (callback) => { frames.set(++nextFrame, callback); return nextFrame; };
  browser.cancelAnimationFrame = (id) => frames.delete(id);
  browser.flush = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((callback) => callback()); };
  browser.IntersectionObserver = class {
    constructor(callback) { browser.observerCallback = callback; }
    observe() {}
    disconnect() { browser.disconnected = true; }
  };
  page.hidden = false;
  video.rect = { top, bottom: top + 600, left: 0, right: 390, width: 390, height: 600 };
  video.getBoundingClientRect = () => video.rect;
  video.attributes = new Map();
  video.setAttribute = (key, value) => video.attributes.set(key, value);
  video.removeAttribute = (key) => { video.attributes.delete(key); if (key === "src") video.src = ""; };
  video.paused = true;
  video.playCalls = 0;
  video.loadCalls = 0;
  video.pause = () => { video.paused = true; };
  video.load = () => { video.loadCalls += 1; };
  video.play = () => {
    video.playCalls += 1;
    if (video.rejectPlay) return Promise.reject(new DOMException("Autoplay blocked", "NotAllowedError"));
    video.paused = false;
    return Promise.resolve();
  };
  const start = () => observeOceanFootage(video, "/media/ocean/surface-steady.mp4", browser, page);
  return { browser, page, video, motion, frames, start };
}

const settled = () => Promise.resolve();

test("visible footage starts muted and inline without waiting for an observer callback", async () => {
  const { video, start } = fixture();
  const stop = start();
  assert.equal(video.muted, true);
  assert.equal(video.defaultMuted, true);
  assert.equal(video.playsInline, true);
  assert.equal(video.attributes.get("playsinline"), "");
  assert.equal(video.attributes.get("webkit-playsinline"), "");
  assert.equal(video.autoplay, true);
  assert.equal(video.loadCalls, 1);
  assert.equal(video.playCalls, 1);
  await settled();
  stop();
});

test("a rejected autoplay is retried synchronously in the next touch gesture", async () => {
  const { video, page, start } = fixture();
  video.rejectPlay = true;
  const stop = start();
  await settled();
  assert.equal(video.paused, true);
  video.rejectPlay = false;
  page.emit("touchend");
  assert.equal(video.playCalls, 2);
  assert.equal(video.paused, false);
  await settled();
  stop();
});

test("media readiness can recover an interrupted initial play request", async () => {
  const { video, start } = fixture();
  video.rejectPlay = true;
  const stop = start();
  await settled();
  video.rejectPlay = false;
  video.emit("canplay");
  assert.equal(video.playCalls, 2);
  await settled();
  stop();
});

test("scroll recovers missed observer crossings and batches geometry work", async () => {
  const { video, browser, frames, start } = fixture({ top: 1100 });
  const stop = start();
  assert.equal(video.src, undefined);
  video.rect.top = 400;
  video.rect.bottom = 1000;
  browser.emit("scroll");
  browser.emit("scroll");
  assert.equal(frames.size, 1);
  browser.flush();
  assert.equal(video.playCalls, 1);
  await settled();
  video.rect.top = -700;
  video.rect.bottom = -100;
  browser.emit("scroll");
  browser.flush();
  assert.equal(video.paused, true);
  assert.equal(video.autoplay, false);
  stop();
});

test("tab visibility and Safari page restoration resume eligible footage", async () => {
  const { video, browser, page, start } = fixture();
  const stop = start();
  await settled();
  page.hidden = true;
  page.emit("visibilitychange");
  assert.equal(video.paused, true);
  page.hidden = false;
  page.emit("visibilitychange");
  assert.equal(video.playCalls, 2);
  await settled();
  video.pause();
  browser.emit("pageshow", { persisted: true });
  assert.equal(video.playCalls, 3);
  await settled();
  stop();
});

test("reduced motion keeps the poster through gestures and supports older Safari listeners", async () => {
  const { video, page, motion, start } = fixture({ reduced: true, legacyMotion: true });
  const stop = start();
  page.emit("touchend");
  page.emit("click");
  assert.equal(video.playCalls, 0);
  assert.equal(video.src, undefined);
  motion.emit("change", { matches: false });
  assert.equal(video.playCalls, 1);
  await settled();
  motion.emit("change", { matches: true });
  assert.equal(video.paused, true);
  stop();
  assert.equal(motion.listenerCount(), 0);
});

test("cleanup cancels queued work and a late play promise cannot pause a replacement", async () => {
  const { video, browser, page, motion, frames, start } = fixture();
  let resolvePlay;
  video.play = () => new Promise((resolve) => { resolvePlay = resolve; });
  const stop = start();
  browser.emit("scroll");
  stop();
  assert.equal(frames.size, 0);
  assert.equal(browser.disconnected, true);
  assert.equal(browser.listenerCount() + page.listenerCount() + motion.listenerCount() + video.listenerCount(), 0);
  assert.equal(video.src, "");
  video.paused = false;
  resolvePlay();
  await settled();
  assert.equal(video.paused, false);
});
