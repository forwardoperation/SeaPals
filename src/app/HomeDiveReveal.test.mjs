import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadBindings, transform } from "next/dist/build/swc/index.js";

// Compile the actual component, mocking only imports that require React or the
// CSS-module loader. Tests exercise its exported production lifecycle directly.
await loadBindings();
const source = await readFile(new URL("./HomeDiveReveal.jsx", import.meta.url), "utf8");
const { code } = await transform(source, {
  filename: "HomeDiveReveal.jsx",
  jsc: { parser: { syntax: "ecmascript", jsx: true }, transform: { react: { runtime: "automatic" } } },
  module: { type: "commonjs" },
});
const compiled = { exports: {} };
new Function("require", "module", "exports", code)((name) => {
  if (name === "react") return {};
  if (name === "react/jsx-runtime") return { jsx: () => null };
  if (name.endsWith(".module.css")) return { wrapper: "wrapper", item: "item", pending: "pending" };
  throw new Error(`Unexpected dependency: ${name}`);
}, compiled, compiled.exports);
const { setupHomeDiveReveal } = compiled.exports;

class Events {
  listeners = new Map();
  addEventListener(name, handler) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(handler);
  }
  removeEventListener(name, handler) { this.listeners.get(name)?.delete(handler); }
  emit(name, event = {}) { [...(this.listeners.get(name) ?? [])].forEach((handler) => handler(event)); }
  listenerCount() { return [...this.listeners.values()].reduce((count, handlers) => count + handlers.size, 0); }
}
function element(top, height = 250) {
  const classes = new Set();
  const descendants = new Set();
  return {
    top, height, classes, descendants,
    contains(target) { return target === this || descendants.has(target); },
    getBoundingClientRect() { return { top: this.top, height: this.height }; },
    classList: { add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)) },
  };
}
function fixture(elements, options = {}) {
  const browser = new Events();
  const document = new Events();
  document.activeElement = null;
  document.visibilityState = "visible";
  document.documentElement = { clientHeight: 800 };
  browser.innerHeight = 800;
  browser.visualViewport = Object.assign(new Events(), { height: 800, offsetTop: 0 });
  const motion = Object.assign(new Events(), { matches: options.reducedMotion ?? false });
  if (options.legacyMotion) {
    motion.addListener = (handler) => Events.prototype.addEventListener.call(motion, "change", handler);
    motion.removeListener = (handler) => Events.prototype.removeEventListener.call(motion, "change", handler);
    motion.addEventListener = undefined;
    motion.removeEventListener = undefined;
  }
  browser.matchMedia = () => motion;
  let nextFrame = 0;
  const frames = new Map();
  browser.requestAnimationFrame = (callback) => { frames.set(++nextFrame, callback); return nextFrame; };
  browser.cancelAnimationFrame = (id) => frames.delete(id);
  const observers = [];
  browser.IntersectionObserver = class {
    observed = new Set();
    disconnected = false;
    constructor(callback, settings) {
      if (options.constructorFails) throw new Error("Observer unavailable");
      this.callback = callback;
      this.settings = settings;
      observers.push(this);
    }
    observe(target) {
      if (options.observeFails) throw new Error("Observation failed");
      this.observed.add(target);
    }
    unobserve(target) { this.observed.delete(target); }
    disconnect() { this.disconnected = true; this.observed.clear(); }
  };
  if (options.noObserver) browser.IntersectionObserver = undefined;
  const container = Object.assign(new Events(), { ownerDocument: document, querySelectorAll: () => elements });
  return { browser, document, motion, container, frames, observers,
    flush() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((callback) => callback()); } };
}
const pending = (target) => target.classes.has("pending");

test("progressive enhancement keeps initially visible and keyboard-focused content visible", () => {
  const visible = element(100);
  const focused = element(1000);
  const below = element(1200);
  const f = fixture([visible, focused, below]);
  f.document.activeElement = focused;
  const cleanup = setupHomeDiveReveal(f.container, f.browser);
  assert.equal(pending(visible), false);
  assert.equal(pending(focused), false);
  assert.equal(pending(below), true);
  cleanup();
  assert.equal(below.classes.size, 0);
});

test("missing or failing observer leaves all content visible, including partial setup failure", () => {
  for (const options of [{ noObserver: true }, { constructorFails: true }, { observeFails: true }]) {
    const target = element(1000);
    const f = fixture([target], options);
    setupHomeDiveReveal(f.container, f.browser)();
    assert.equal(target.classes.size, 0);
    assert.equal(f.browser.listenerCount(), 0);
    assert.equal(f.frames.size, 0);
  }
});

test("passive scroll recovery reveals tall content without any observer callback and batches frames", () => {
  const target = element(1000, 12000);
  const f = fixture([target]);
  const cleanup = setupHomeDiveReveal(f.container, f.browser);
  f.flush();
  target.top = 750;
  f.browser.emit("scroll");
  f.browser.emit("scroll");
  assert.equal(f.frames.size, 1);
  f.flush();
  assert.equal(pending(target), true);
  target.top = 730;
  f.browser.emit("scroll");
  f.flush();
  assert.equal(pending(target), false);
  assert.equal(f.observers[0].disconnected, true);
  assert.equal(f.browser.listenerCount(), 0);
  cleanup();
});

test("observer signals use current geometry instead of a rounded or unreachable intersection ratio", () => {
  const target = element(1000, 12000);
  const f = fixture([target]);
  const cleanup = setupHomeDiveReveal(f.container, f.browser);
  f.flush();
  target.top = 700;
  f.observers[0].callback([{ target, isIntersecting: true, intersectionRatio: 0.001 }]);
  f.flush();
  assert.equal(pending(target), false);
  cleanup();
});

test("mobile viewport resize uses visible viewport height and pixel observer margins", () => {
  const target = element(1000);
  const f = fixture([target]);
  f.browser.visualViewport.height = 600;
  const cleanup = setupHomeDiveReveal(f.container, f.browser);
  assert.equal(f.observers[0].settings.rootMargin, "0px 0px -48px 0px");
  f.flush();
  target.top = 800;
  f.browser.visualViewport.height = 900;
  f.browser.visualViewport.emit("resize");
  f.flush();
  assert.equal(pending(target), false);
  cleanup();
});

test("bfcache restoration immediately reveals pending content and releases observers/listeners", () => {
  const target = element(1000);
  const f = fixture([target]);
  const cleanup = setupHomeDiveReveal(f.container, f.browser);
  f.browser.emit("pageshow", { persisted: true });
  assert.equal(target.classes.size, 0);
  assert.equal(f.observers[0].disconnected, true);
  assert.equal(f.frames.size, 0);
  assert.equal(f.browser.visualViewport.listenerCount(), 0);
  cleanup();
});

test("reduced motion starts visible and changing either modern or legacy preference reveals permanently", () => {
  const initial = element(1000);
  const reduced = fixture([initial], { reducedMotion: true });
  setupHomeDiveReveal(reduced.container, reduced.browser)();
  assert.equal(initial.classes.size, 0);
  assert.equal(reduced.observers.length, 0);
  for (const legacyMotion of [false, true]) {
    const target = element(1000);
    const f = fixture([target], { legacyMotion });
    const cleanup = setupHomeDiveReveal(f.container, f.browser);
    f.motion.matches = true;
    f.motion.emit("change", { matches: true });
    assert.equal(target.classes.size, 0);
    f.motion.matches = false;
    f.motion.emit("change", { matches: false });
    assert.equal(target.classes.size, 0);
    assert.equal(f.motion.listenerCount(), 0);
    cleanup();
  }
});

test("keyboard focus reveals all hidden ancestors without delaying the focus target", () => {
  const outer = element(1000);
  const inner = element(1100);
  const button = {};
  outer.descendants.add(button);
  inner.descendants.add(button);
  const f = fixture([outer, inner]);
  const cleanup = setupHomeDiveReveal(f.container, f.browser);
  f.container.emit("focusin", { target: button });
  assert.equal(outer.classes.size, 0);
  assert.equal(inner.classes.size, 0);
  cleanup();
});

test("cleanup cancels queued work and restores the server-visible state", () => {
  const target = element(1000);
  const f = fixture([target]);
  const cleanup = setupHomeDiveReveal(f.container, f.browser);
  assert.equal(f.frames.size, 1);
  cleanup();
  target.top = 600;
  f.observers[0].callback([]);
  assert.equal(f.frames.size, 0);
  assert.equal(target.classes.size, 0);
  assert.equal(f.container.listenerCount(), 0);
  assert.equal(f.document.listenerCount(), 0);
});
