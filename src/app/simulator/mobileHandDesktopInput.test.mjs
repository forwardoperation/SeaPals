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
    pointerMove,
    /absX >= MOBILE_HAND_DRAG_THRESHOLD && absX > absY[\s\S]*?gesture\.phase = "scrolling"[\s\S]*?gesture\.pointerType === "mouse"[\s\S]*?event\.preventDefault\(\)[\s\S]*?captureGesturePointer\(gesture, event\)[\s\S]*?scrollMouseGesture\(gesture, dx\)/,
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

test("desktop browsing does not change touch pan or upward drag-to-play semantics", () => {
  const pointerDown = functionSource("handleCardPointerDown", "handleCardPointerMove");
  const pointerMove = functionSource("handleCardPointerMove", "handleCardPointerUp");
  const horizontalBranch = pointerMove.slice(
    pointerMove.indexOf("if (absX >= MOBILE_HAND_DRAG_THRESHOLD"),
    pointerMove.indexOf("if (dy <= -MOBILE_HAND_DRAG_THRESHOLD"),
  );

  assert.doesNotMatch(pointerDown, /preventDefault|setPointerCapture/);
  assert.match(
    horizontalBranch,
    /if \(gesture\.pointerType === "mouse"\) \{\s*event\.preventDefault\(\)/,
    "touch and pen input should remain browser-native pan-x gestures",
  );
  assert.match(
    pointerMove,
    /dy <= -MOBILE_HAND_DRAG_THRESHOLD && absY >= absX \* MOBILE_HAND_DRAG_AXIS_RATIO[\s\S]*?sourceElement\.setPointerCapture\?\.\(event\.pointerId\)[\s\S]*?onDragStart/,
    "upward pointer intent should still enter the existing placement lifecycle on every pointer type",
  );
  assert.match(
    handDockSource,
    /Drag upward to play, scroll sideways to browse, or press Enter to inspect/,
    "the rail's accessible instructions should describe both desktop browsing and card placement",
  );
});
