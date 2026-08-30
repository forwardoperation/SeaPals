import assert from "node:assert/strict";
import test from "node:test";

import {
  beginPinchCamera,
  clampCameraZoom,
  getVisibleAreaFitOffset,
  panCamera,
  updatePinchCamera,
  zoomCameraAtPoint,
} from "./ecosystemCamera.mjs";

const EPSILON = 1e-9;

function assertClose(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) <= EPSILON, `${message}: expected ${expected}, received ${actual}`);
}

function worldToScreen(camera, worldPoint, viewport) {
  const center = { x: viewport.width / 2, y: viewport.height / 2 };
  return {
    x: center.x + (worldPoint.x - center.x) * camera.zoom + camera.offset.x,
    y: center.y + (worldPoint.y - center.y) * camera.zoom + camera.offset.y,
  };
}

test("camera zoom clamps to the simulator range and accepts explicit bounds", () => {
  assert.equal(clampCameraZoom(0.01), 0.12);
  assert.equal(clampCameraZoom(8), 2.2);
  assert.equal(clampCameraZoom(1.4), 1.4);
  assert.equal(clampCameraZoom(8, { minZoom: 0.5, maxZoom: 1.5 }), 1.5);
});

test("panning applies a screen-space delta without changing zoom", () => {
  assert.deepEqual(
    panCamera({ zoom: 1.25, offset: { x: 18, y: -7 } }, { x: -8, y: 12 }),
    { zoom: 1.25, offset: { x: 10, y: 5 } },
  );
});

test("zooming at a point preserves its focal world coordinate", () => {
  const viewport = { width: 400, height: 600 };
  const focalPoint = { x: 300, y: 200 };
  const camera = zoomCameraAtPoint(
    { zoom: 1, offset: { x: 0, y: 0 } },
    2,
    focalPoint,
    viewport,
  );

  assert.deepEqual(camera, { zoom: 2, offset: { x: -100, y: 100 } });
  assert.deepEqual(worldToScreen(camera, focalPoint, viewport), focalPoint);
});

test("pinch zoom preserves the initial focal world point under a translated midpoint", () => {
  const viewport = { width: 400, height: 600 };
  const startCamera = { zoom: 1.25, offset: { x: 20, y: -10 } };
  const pinch = beginPinchCamera(
    startCamera,
    { x: 100, y: 250 },
    { x: 300, y: 250 },
    viewport,
  );
  const nextCamera = updatePinchCamera(
    pinch,
    { x: 80, y: 210 },
    { x: 400, y: 210 },
  );

  assertClose(nextCamera.zoom, 2, "pinch scale");
  assertClose(nextCamera.offset.x, 72, "pinch horizontal offset");
  assertClose(nextCamera.offset.y, -26, "pinch vertical offset");

  const projectedAnchor = worldToScreen(nextCamera, pinch.worldAnchor, viewport);
  assertClose(projectedAnchor.x, 240, "translated focal x");
  assertClose(projectedAnchor.y, 210, "translated focal y");
});

test("pinch focal preservation continues at a zoom boundary", () => {
  const viewport = { width: 360, height: 640 };
  const pinch = beginPinchCamera(
    { zoom: 1, offset: { x: 0, y: 0 } },
    { x: 100, y: 300 },
    { x: 260, y: 300 },
    viewport,
    { maxZoom: 1.5 },
  );
  const nextCamera = updatePinchCamera(
    pinch,
    { x: -20, y: 340 },
    { x: 420, y: 340 },
  );

  assert.equal(nextCamera.zoom, 1.5);
  const projectedAnchor = worldToScreen(nextCamera, pinch.worldAnchor, viewport);
  assertClose(projectedAnchor.x, 200, "clamped focal x");
  assertClose(projectedAnchor.y, 340, "clamped focal y");
});

test("visible-area fit centers content above a bottom-occluded hand dock", () => {
  const offset = getVisibleAreaFitOffset({
    viewport: { width: 400, height: 600 },
    contentCenter: { x: 200, y: 300 },
    zoom: 1,
    bottomOcclusion: 200,
  });

  assert.deepEqual(offset, { x: 0, y: -100 });
});

test("visible-area fit matches the center-origin transform for off-center content", () => {
  const viewport = { width: 400, height: 600 };
  const contentCenter = { x: 300, y: 400 };
  const zoom = 0.5;
  const offset = getVisibleAreaFitOffset({
    viewport,
    contentCenter,
    zoom,
    bottomOcclusion: 100,
  });
  const projectedCenter = worldToScreen({ zoom, offset }, contentCenter, viewport);

  assert.deepEqual(offset, { x: -50, y: -100 });
  assert.deepEqual(projectedCenter, { x: 200, y: 250 });
});

test("visible-area fit supports the opponent board's divider-biased target", () => {
  const viewport = { width: 400, height: 600 };
  const contentCenter = { x: 200, y: 300 };
  const zoom = 1;
  const offset = getVisibleAreaFitOffset({
    viewport,
    contentCenter,
    zoom,
    bottomOcclusion: 200,
    verticalAlign: 0.65,
  });
  const projectedCenter = worldToScreen({ zoom, offset }, contentCenter, viewport);

  assert.deepEqual(projectedCenter, { x: 200, y: 260 });
});
