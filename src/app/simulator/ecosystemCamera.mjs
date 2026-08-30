export const CAMERA_MIN_ZOOM = 0.12;
export const CAMERA_MAX_ZOOM = 2.2;

const MIN_PINCH_DISTANCE = 0.001;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizePoint(point) {
  return {
    x: finiteNumber(point?.x),
    y: finiteNumber(point?.y),
  };
}

function normalizeViewport(viewport) {
  return {
    width: Math.max(1, finiteNumber(viewport?.width, 1)),
    height: Math.max(1, finiteNumber(viewport?.height, 1)),
  };
}

function normalizeZoomBounds({ minZoom = CAMERA_MIN_ZOOM, maxZoom = CAMERA_MAX_ZOOM } = {}) {
  const minimum = Math.max(0.001, finiteNumber(minZoom, CAMERA_MIN_ZOOM));
  const maximum = Math.max(minimum, finiteNumber(maxZoom, CAMERA_MAX_ZOOM));
  return { minZoom: minimum, maxZoom: maximum };
}

function normalizeCamera(camera, bounds) {
  return {
    zoom: clampCameraZoom(camera?.zoom, bounds),
    offset: normalizePoint(camera?.offset),
  };
}

function midpoint(pointA, pointB) {
  return {
    x: (pointA.x + pointB.x) / 2,
    y: (pointA.y + pointB.y) / 2,
  };
}

function pointDistance(pointA, pointB) {
  return Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
}

function getViewportCenter(viewport) {
  return { x: viewport.width / 2, y: viewport.height / 2 };
}

function screenPointToWorld(camera, screenPoint, viewport) {
  const center = getViewportCenter(viewport);
  return {
    x: center.x + (screenPoint.x - center.x - camera.offset.x) / camera.zoom,
    y: center.y + (screenPoint.y - center.y - camera.offset.y) / camera.zoom,
  };
}

function cameraForWorldAnchor(worldPoint, screenPoint, zoom, viewport) {
  const center = getViewportCenter(viewport);
  return {
    zoom,
    offset: {
      x: screenPoint.x - center.x - (worldPoint.x - center.x) * zoom,
      y: screenPoint.y - center.y - (worldPoint.y - center.y) * zoom,
    },
  };
}

/**
 * Clamp a requested ecosystem camera scale to the simulator's supported range.
 */
export function clampCameraZoom(zoom, options = {}) {
  const { minZoom, maxZoom } = normalizeZoomBounds(options);
  const requestedZoom = finiteNumber(zoom, 1);
  return Math.min(maxZoom, Math.max(minZoom, requestedZoom));
}

/**
 * Move an existing center-origin camera by a screen-space delta.
 */
export function panCamera(camera, delta, options = {}) {
  const normalized = normalizeCamera(camera, options);
  const movement = normalizePoint(delta);
  return {
    zoom: normalized.zoom,
    offset: {
      x: normalized.offset.x + movement.x,
      y: normalized.offset.y + movement.y,
    },
  };
}

/**
 * Zoom a center-origin camera while keeping the world point beneath `point`
 * stationary. `point` is expressed in viewport-local screen coordinates.
 */
export function zoomCameraAtPoint(camera, requestedZoom, point, viewport, options = {}) {
  const normalizedViewport = normalizeViewport(viewport);
  const normalizedCamera = normalizeCamera(camera, options);
  const focalPoint = normalizePoint(point);
  const worldAnchor = screenPointToWorld(normalizedCamera, focalPoint, normalizedViewport);
  const nextZoom = clampCameraZoom(requestedZoom, options);
  return cameraForWorldAnchor(worldAnchor, focalPoint, nextZoom, normalizedViewport);
}

/**
 * Snapshot a two-pointer gesture. Pointer coordinates must be local to the same
 * viewport used by the ecosystem's center-origin CSS transform.
 */
export function beginPinchCamera(camera, pointerA, pointerB, viewport, options = {}) {
  const normalizedViewport = normalizeViewport(viewport);
  const normalizedCamera = normalizeCamera(camera, options);
  const firstPoint = normalizePoint(pointerA);
  const secondPoint = normalizePoint(pointerB);
  const startMidpoint = midpoint(firstPoint, secondPoint);
  const bounds = normalizeZoomBounds(options);

  return {
    camera: normalizedCamera,
    viewport: normalizedViewport,
    startMidpoint,
    startDistance: Math.max(MIN_PINCH_DISTANCE, pointDistance(firstPoint, secondPoint)),
    worldAnchor: screenPointToWorld(normalizedCamera, startMidpoint, normalizedViewport),
    bounds,
  };
}

/**
 * Resolve the next camera from a pinch snapshot. Distance changes control zoom;
 * midpoint changes pan. The initial focal world point remains beneath the live
 * midpoint even when zoom reaches a clamp boundary.
 */
export function updatePinchCamera(pinch, pointerA, pointerB, options = pinch?.bounds ?? {}) {
  if (!pinch?.camera || !pinch?.viewport || !pinch?.worldAnchor) {
    throw new TypeError("A pinch snapshot from beginPinchCamera is required.");
  }

  const firstPoint = normalizePoint(pointerA);
  const secondPoint = normalizePoint(pointerB);
  const liveMidpoint = midpoint(firstPoint, secondPoint);
  const liveDistance = Math.max(MIN_PINCH_DISTANCE, pointDistance(firstPoint, secondPoint));
  const nextZoom = clampCameraZoom(
    pinch.camera.zoom * (liveDistance / pinch.startDistance),
    options,
  );

  return cameraForWorldAnchor(
    pinch.worldAnchor,
    liveMidpoint,
    nextZoom,
    pinch.viewport,
  );
}

/**
 * Return the translate offset that places a world-space content center in the
 * usable portion of a viewport. The transform origin is the full viewport
 * center, while bottom occlusion (for example the mobile hand) only changes the
 * desired on-screen target center.
 */
export function getVisibleAreaFitOffset({
  viewport,
  contentCenter,
  zoom,
  bottomOcclusion = 0,
  minVisibleHeight = 96,
  horizontalAlign = 0.5,
  verticalAlign = 0.5,
} = {}) {
  const normalizedViewport = normalizeViewport(viewport);
  const normalizedContentCenter = normalizePoint(contentCenter);
  const normalizedZoom = finiteNumber(zoom, 1);
  const viewportCenter = getViewportCenter(normalizedViewport);
  const usableHeight = Math.max(
    Math.min(normalizedViewport.height, Math.max(1, finiteNumber(minVisibleHeight, 96))),
    normalizedViewport.height - Math.max(0, finiteNumber(bottomOcclusion)),
  );
  const targetPoint = {
    x: normalizedViewport.width * Math.min(1, Math.max(0, finiteNumber(horizontalAlign, 0.5))),
    y: usableHeight * Math.min(1, Math.max(0, finiteNumber(verticalAlign, 0.5))),
  };

  return {
    x: targetPoint.x
      - viewportCenter.x
      - (normalizedContentCenter.x - viewportCenter.x) * normalizedZoom,
    y: targetPoint.y
      - viewportCenter.y
      - (normalizedContentCenter.y - viewportCenter.y) * normalizedZoom,
  };
}
