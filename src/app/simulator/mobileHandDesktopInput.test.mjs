import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const handDockSource = await readFile(new URL("./MobileHandDock.jsx", import.meta.url), "utf8");

function functionSource(name, nextName) {
  const start = handDockSource.indexOf(`function ${name}`);
  const end = nextName ? handDockSource.indexOf(`function ${nextName}`, start + 1) : handDockSource.length;
  assert.notEqual(start, -1, `missing function ${name}`);
  assert.notEqual(end, -1, `missing function ${nextName}`);
  return handDockSource.slice(start, end);
}

function sourceBetween(startToken, endToken) {
  const start = handDockSource.indexOf(startToken);
  const end = handDockSource.indexOf(endToken, start + startToken.length);
  assert.notEqual(start, -1, `missing ${startToken}`);
  assert.notEqual(end, -1, `missing ${endToken}`);
  return handDockSource.slice(start, end);
}

function numericConstant(name) {
  const match = handDockSource.match(new RegExp(`const ${name} = (\\d+(?:\\.\\d+)?);`));
  assert.ok(match, `missing numeric constant ${name}`);
  return Number(match[1]);
}

const dragThreshold = numericConstant("MOBILE_HAND_DRAG_THRESHOLD");
const dragAxisRatio = numericConstant("MOBILE_HAND_DRAG_AXIS_RATIO");
const scrollAxisRatio = numericConstant("MOBILE_HAND_SCROLL_AXIS_RATIO");

const interactionScaleSource = functionSource(
  "getDesktopHandInteractionScale",
  "getCurrentHandInteractionScale",
);
const getDesktopHandInteractionScale = Function(`return (${interactionScaleSource})`)();

function createGestureHarness(pointerType = "mouse", { dragPreferred = false, cardId = "mustard-hill-coral" } = {}) {
  const source = [
    functionSource("releaseGestureCapture", "clearHandDragGesture"),
    functionSource("clearHandDragGesture", "suppressNextDragClick"),
    functionSource("suppressNextDragClick", "captureGesturePointer"),
    functionSource("captureGesturePointer", "scrollMouseGesture"),
    functionSource("scrollMouseGesture", "handleHandWheel"),
    functionSource("handleCardPointerDown", "handleCardPointerMove"),
    functionSource("handleCardPointerMove", "handleCardPointerUp"),
    functionSource("handleCardPointerUp", "handleCardPointerCancel"),
    sourceBetween("function handleCardClick", "\n\n  return ("),
  ].join("\n");
  return Function(`
    const MOBILE_HAND_DRAG_THRESHOLD = ${JSON.stringify(dragThreshold)};
    const MOBILE_HAND_DRAG_AXIS_RATIO = ${JSON.stringify(dragAxisRatio)};
    const MOBILE_HAND_SCROLL_AXIS_RATIO = ${JSON.stringify(scrollAxisRatio)};
    const getCurrentHandInteractionScale = () => 1;
    const placementPending = false;
    const handRailRef = { current: { scrollLeft: 0, scrollWidth: 600, clientWidth: 300 } };
    const gestureRef = { current: null };
    const suppressDragClickRef = { current: null };
    const calls = [];
    const inspectCalls = [];
    const onInspect = (...args) => inspectCalls.push(args);
    const callbacksRef = { current: {
      onDragStart(payload) { calls.push(["start", payload]); return true; },
      onDragMove(payload) { calls.push(["move", payload]); },
      onDragEnd(payload) { calls.push(["end", payload]); },
      onDragCancel(payload) { calls.push(["cancel", payload]); },
    } };
    const captureCalls = [];
    const releaseCalls = [];
    const capturedPointers = new Set();
    const sourceElement = {
      hasPointerCapture(pointerId) { return capturedPointers.has(pointerId); },
      setPointerCapture(pointerId) { captureCalls.push(pointerId); capturedPointers.add(pointerId); },
      releasePointerCapture(pointerId) { releaseCalls.push(pointerId); capturedPointers.delete(pointerId); },
    };
    const entry = { cardId: ${JSON.stringify(cardId)}, index: 0, dragPreferred: ${JSON.stringify(dragPreferred)} };
    const makeEvent = (clientX, clientY) => ({
      pointerId: 7,
      pointerType: ${JSON.stringify(pointerType)},
      button: 0,
      isPrimary: true,
      clientX,
      clientY,
      target: sourceElement,
      currentTarget: sourceElement,
      defaultPrevented: false,
      propagationStopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.propagationStopped = true; },
    });
    ${source}
    return {
      calls,
      inspectCalls,
      captureCalls,
      releaseCalls,
      gestureRef,
      press() { const event = makeEvent(100, 100); handleCardPointerDown(entry, event); return event; },
      move(clientX, clientY) { const event = makeEvent(clientX, clientY); handleCardPointerMove(entry, event); return event; },
      release(clientX, clientY) { const event = makeEvent(clientX, clientY); handleCardPointerUp(entry, event); return event; },
      click() { const event = makeEvent(100, 100); handleCardClick(entry, event); return event; },
    };
  `)();
}

test("desktop hand interactions smoothly follow the enlarged visual scale", () => {
  assert.equal(getDesktopHandInteractionScale(1279, 1120), 1, "mobile and tablet widths stay unchanged");
  assert.equal(getDesktopHandInteractionScale(1280, 640), 1);
  assert.equal(getDesktopHandInteractionScale(1280, 880), 1.375);
  assert.equal(getDesktopHandInteractionScale(1280, 1120), 1.75);
  assert.equal(getDesktopHandInteractionScale(1920, 1440), 1.75, "the scale caps on tall desktops");
  assert.equal(getDesktopHandInteractionScale(1920, 480), 1, "short desktop viewports do not shrink controls");
});

test("the unified hand rail converts vertical desktop wheel input into bounded horizontal browsing", () => {
  const wheelHandler = functionSource("handleHandWheel", "handleCardPointerDown");

  assert.match(handDockSource, /const handRailRef = useRef\(null\)/);
  assert.match(handDockSource, /ref=\{handRailRef\}[\s\S]*?onWheel=\{handleHandWheel\}/);
  assert.match(wheelHandler, /if \(!rail \|\| event\.ctrlKey\) return/);
  assert.match(
    wheelHandler,
    /Math\.abs\(event\.deltaX\) >= Math\.abs\(event\.deltaY\) \? event\.deltaX : event\.deltaY/,
    "trackpad horizontal deltas and ordinary mouse-wheel vertical deltas should both browse the hand",
  );
  assert.match(wheelHandler, /event\.deltaMode === 1[\s\S]*?event\.deltaMode === 2/);
  assert.match(
    wheelHandler,
    /const interactionScale = getCurrentHandInteractionScale\(\)[\s\S]*?\? 20 \* interactionScale/,
    "line-based mouse wheels should browse proportionally with the enlarged desktop hand",
  );
  assert.match(wheelHandler, /rail\.scrollWidth - rail\.clientWidth/);
  assert.match(wheelHandler, /Math\.max\(0, Math\.min\(maxScrollLeft, rail\.scrollLeft \+ rawDelta \* deltaScale\)\)/);

  const boundaryCheck = wheelHandler.indexOf("nextScrollLeft - rail.scrollLeft");
  const preventDefault = wheelHandler.indexOf("event.preventDefault()");
  assert.ok(
    boundaryCheck >= 0 && preventDefault > boundaryCheck,
    "wheel input should only be consumed while the hand can actually move, leaving page scroll available at either edge",
  );
});

test("a primary mouse drag pans the hand rail after horizontal intent wins", () => {
  const pointerDown = functionSource("handleCardPointerDown", "handleCardPointerMove");
  const pointerMove = functionSource("handleCardPointerMove", "handleCardPointerUp");
  const pointerUp = functionSource("handleCardPointerUp", "handleCardPointerCancel");

  assert.match(pointerDown, /pointerType: event\.pointerType/);
  assert.match(pointerDown, /railElement: handRailRef\.current/);
  assert.match(pointerDown, /originScrollLeft: handRailRef\.current\?\.scrollLeft \?\? 0/);
  assert.match(
    pointerDown,
    /dragThreshold: MOBILE_HAND_DRAG_THRESHOLD \* getCurrentHandInteractionScale\(\)/,
  );
  assert.match(
    pointerDown,
    /gestureRef\.current = gesture;[\s\S]*?gesture\.pointerType === "mouse"[\s\S]*?captureGesturePointer\(gesture, event\)/,
    "mouse input must be captured on its first press so a fast pull cannot leave a stale candidate",
  );
  assert.match(
    pointerMove,
    /absX >= dragThreshold && absX >= absY \* MOBILE_HAND_SCROLL_AXIS_RATIO[\s\S]*?gesture\.phase = "scrolling"[\s\S]*?gesture\.pointerType === "mouse"[\s\S]*?event\.preventDefault\(\)[\s\S]*?captureGesturePointer\(gesture, event\)[\s\S]*?scrollMouseGesture\(gesture, dx\)/,
  );
  assert.match(
    pointerMove,
    /gesture\.phase === "scrolling"[\s\S]*?gesture\.pointerType === "mouse"[\s\S]*?scrollMouseGesture\(gesture, dx\)/,
    "captured mouse movement should keep updating the rail for the full gesture",
  );
  assert.match(
    pointerUp,
    /completedPhase !== "candidate"[\s\S]*?suppressNextDragClick\(entry\.index\)/,
    "finishing a long pan must not accidentally open the inspected-card popover",
  );
});

test("desktop capture leaves touch pan native until upward drag intent wins", () => {
  const pointerDown = functionSource("handleCardPointerDown", "handleCardPointerMove");
  const pointerMove = functionSource("handleCardPointerMove", "handleCardPointerUp");

  assert.doesNotMatch(pointerDown, /preventDefault/);
  assert.match(pointerDown, /if \(gesture\.pointerType === "mouse"\) captureGesturePointer\(gesture, event\)/);
  assert.match(
    pointerMove,
    /absX >= dragThreshold && absX >= absY \* MOBILE_HAND_SCROLL_AXIS_RATIO[\s\S]*?if \(gesture\.pointerType === "mouse"\) \{\s*event\.preventDefault\(\)/,
    "touch and pen input should remain browser-native pan-x gestures",
  );
  assert.match(
    pointerMove,
    /dy <= -dragThreshold && absY >= absX \* MOBILE_HAND_DRAG_AXIS_RATIO[\s\S]*?captureGesturePointer\(gesture, event\)[\s\S]*?onDragStart/,
    "upward pointer intent should still enter the existing placement lifecycle on every pointer type",
  );
  assert.match(
    handDockSource,
    /Drag upward to play, scroll sideways to browse, or press Enter to inspect/,
    "the rail's accessible instructions should describe both desktop browsing and card placement",
  );
});

test("the first diagonal mouse pull completes one card drag without another press", () => {
  const harness = createGestureHarness("mouse");

  harness.press();
  assert.deepEqual(harness.captureCalls, [7], "the initial press captures before the pointer can leave the card");

  const moveEvent = harness.move(155, 70);
  assert.equal(moveEvent.defaultPrevented, true);
  harness.release(420, 180);
  harness.release(420, 180);

  assert.deepEqual(harness.calls.map(([kind]) => kind), ["start", "move", "end"]);
  assert.equal(harness.gestureRef.current, null);
  assert.deepEqual(harness.releaseCalls, [7]);
});

test("a highlighted lesson card starts dragging along a shallow path to its real slot", () => {
  const harness = createGestureHarness("mouse", { dragPreferred: true, cardId: "sea-urchin" });

  harness.press();
  const moveEvent = harness.move(155, 90);
  harness.release(600, 5);

  assert.equal(moveEvent.defaultPrevented, true);
  assert.deepEqual(harness.calls.map(([kind]) => kind), ["start", "move", "end"]);
});

test("a shallow touch swipe still browses past a highlighted lesson card", () => {
  const harness = createGestureHarness("touch", { dragPreferred: true, cardId: "sea-urchin" });

  harness.press();
  const moveEvent = harness.move(145, 98);

  assert.equal(moveEvent.defaultPrevented, false);
  assert.deepEqual(harness.captureCalls, []);
  assert.deepEqual(harness.calls, []);
  assert.equal(harness.gestureRef.current?.phase, "scrolling");
});

test("a deliberate horizontal mouse pull can still browse from a highlighted lesson card", () => {
  const harness = createGestureHarness("mouse", { dragPreferred: true, cardId: "sea-urchin" });

  harness.press();
  const moveEvent = harness.move(145, 100);

  assert.equal(moveEvent.defaultPrevented, true);
  assert.deepEqual(harness.calls, []);
  assert.equal(harness.gestureRef.current?.phase, "scrolling");
});

test("minor upward mouse jitter still browses instead of lifting the highlighted card", () => {
  const harness = createGestureHarness("mouse", { dragPreferred: true, cardId: "sea-urchin" });

  harness.press();
  const moveEvent = harness.move(145, 99);

  assert.equal(moveEvent.defaultPrevented, true);
  assert.deepEqual(harness.calls, []);
  assert.equal(harness.gestureRef.current?.phase, "scrolling");
});

test("touch waits for upward intent before explicitly capturing", () => {
  const harness = createGestureHarness("touch");

  harness.press();
  assert.deepEqual(harness.captureCalls, []);
  harness.move(155, 70);

  assert.deepEqual(harness.captureCalls, [7]);
  assert.deepEqual(harness.calls.map(([kind]) => kind), ["start", "move"]);
});

test("horizontal touch movement stays native and does not start a card drag", () => {
  const harness = createGestureHarness("touch");

  harness.press();
  const moveEvent = harness.move(145, 102);

  assert.equal(moveEvent.defaultPrevented, false);
  assert.deepEqual(harness.captureCalls, []);
  assert.deepEqual(harness.calls, []);
  assert.equal(harness.gestureRef.current?.phase, "scrolling");
});

test("a simple mouse click still inspects the card", () => {
  const harness = createGestureHarness("mouse");

  harness.press();
  harness.release(100, 100);
  const clickEvent = harness.click();

  assert.equal(clickEvent.defaultPrevented, false);
  assert.equal(harness.inspectCalls.length, 1);
});

test("the synthetic click after a drag is suppressed", () => {
  const harness = createGestureHarness("mouse");

  harness.press();
  harness.move(155, 70);
  harness.release(420, 180);
  const clickEvent = harness.click();

  assert.equal(clickEvent.defaultPrevented, true);
  assert.equal(clickEvent.propagationStopped, true);
  assert.deepEqual(harness.inspectCalls, []);
});
