/**
 * A fixed, pitched camera over the existing XY world. Only presentation changes:
 * collision, saves, doorways and input continue to use their original coordinates.
 * The ground homography and upright billboards share this projection exactly.
 */
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finitePositive = (value, label) => {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be positive.`);
  return value;
};

export function createAdventurePerspective(scene, target, viewport) {
  const width = finitePositive(viewport.width, "Viewport width");
  const height = finitePositive(viewport.height, "Viewport height");
  finitePositive(scene.width, "Scene width");
  finitePositive(scene.height, "Scene height");
  if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) {
    throw new TypeError("Camera target must be finite.");
  }
  const interior = scene.kind === "interior";
  const pitch = interior ? 0.9 : 0.72;
  const strength = interior ? 0.16 : 0.42;
  const anchorY = 0.6;
  const aspect = width / height;
  // Portrait phones show fewer tiles across, so people remain easy to see.
  const requestedWidth = aspect < 1.25 ? 8 : (scene.camera?.tilesAcross ?? 12);
  const farRatio = -anchorY / (pitch - strength * anchorY);
  const nearRatio = (1 - anchorY) / (pitch + strength * (1 - anchorY));
  const farScaleInverse = 1 - strength * farRatio;
  const viewWidth = Math.min(
    requestedWidth,
    scene.width / farScaleInverse,
    scene.height * aspect / (nearRatio - farRatio),
  );
  const viewHeight = viewWidth / aspect;
  const far = farRatio * viewHeight;
  const near = nearRatio * viewHeight;
  const halfWidth = viewWidth * farScaleInverse / 2;
  const centerX = clamp(target.x, halfWidth, scene.width - halfWidth);
  const centerY = clamp(target.y, -far, scene.height - near);
  const unit = width / viewWidth;
  const camera = {
    width, height, viewWidth, viewHeight, centerX, centerY, pitch,
    perspective: strength / viewHeight,
    anchorX: width / 2,
    anchorY: height * anchorY,
    unit,
    // Culling uses centered tile coordinates, matching the world's actors.
    bounds: {
      left: centerX - halfWidth - 0.5,
      right: centerX + halfWidth - 0.5,
      top: centerY + far - 0.5,
      bottom: centerY + near - 0.5,
    },
  };
  return camera;
}

/** Input is in image coordinates; actor tile centers must add 0.5. */
export function projectAdventurePoint(camera, point) {
  const dx = point.x - camera.centerX;
  const dy = point.y - camera.centerY;
  const denominator = 1 - camera.perspective * dy;
  if (denominator <= 0.08) return null; // Behind the camera/near plane.
  const scale = 1 / denominator;
  return {
    x: camera.anchorX + dx * camera.unit * scale,
    y: camera.anchorY + dy * camera.unit * camera.pitch * scale,
    scale,
  };
}

export function unprojectAdventurePoint(camera, point) {
  const y = (point.y - camera.anchorY) / camera.unit;
  const dy = y / (camera.pitch + camera.perspective * y);
  return {
    x: camera.centerX + ((point.x - camera.anchorX) / camera.unit) * (1 - camera.perspective * dy),
    y: camera.centerY + dy,
  };
}

export function getPerspectiveActorStyle(position, camera) {
  const point = projectAdventurePoint(camera, { x: position.x + 0.5, y: position.y + 0.5 });
  if (!point) return { display: "none" };
  const size = camera.unit * point.scale;
  return { left: point.x, top: point.y, width: size, height: size };
}

export function getPerspectiveObjectRect(object, camera) {
  const point = projectAdventurePoint(camera, { x: object.at.x + 0.5, y: object.at.y + 0.5 });
  if (!point) return null;
  const width = (object.visualBounds.right - object.visualBounds.left) * camera.unit * point.scale;
  const height = (object.visualBounds.bottom - object.visualBounds.top) * camera.unit * point.scale;
  return {
    left: point.x - width * object.sprite.anchorX,
    top: point.y - height * object.sprite.anchorY,
    width, height,
  };
}

export function isPerspectiveRectVisible(rect, camera, margin = 48) {
  return Boolean(rect
    && rect.left + rect.width >= -margin && rect.left <= camera.width + margin
    && rect.top + rect.height >= -margin && rect.top <= camera.height + margin);
}

export function isPerspectiveActorVisible(position, camera) {
  const style = getPerspectiveActorStyle(position, camera);
  if (style.display === "none") return false;
  return isPerspectiveRectVisible({
    left: style.left - style.width,
    top: style.top - style.height * 1.75,
    width: style.width * 2,
    height: style.height * 2.5,
  }, camera);
}

/**
 * Crop to the visible ground before compositing. A town-sized GPU layer at phone
 * devicePixelRatio is unnecessary. Tile-snapped overscan also avoids resampling
 * the texture on every small movement. The matrix moves it as one surface.
 */
export function getPerspectiveGroundStyle(scene, camera) {
  const left = Math.max(0, Math.floor(camera.bounds.left + 0.5) - 1);
  const top = Math.max(0, Math.floor(camera.bounds.top + 0.5) - 1);
  const right = Math.min(scene.width, Math.ceil(camera.bounds.right + 0.5) + 1);
  const bottom = Math.min(scene.height, Math.ceil(camera.bounds.bottom + 0.5) + 1);
  const dx = (left - camera.centerX) * camera.unit;
  const dy = (top - camera.centerY) * camera.unit;
  const k = camera.perspective / camera.unit;
  const w = 1 - k * dy;
  const ax = camera.anchorX;
  const ay = camera.anchorY;
  // CSS matrix3d is column-major. z stays zero; w supplies perspective divide.
  const matrix = [
    1, 0, 0, 0,
    -ax * k, camera.pitch - ay * k, 0, -k,
    0, 0, 1, 0,
    dx + ax * w, camera.pitch * dy + ay * w, 0, w,
  ];
  return {
    width: (right - left) * camera.unit,
    height: (bottom - top) * camera.unit,
    backgroundSize: `${scene.width * camera.unit}px ${scene.height * camera.unit}px`,
    backgroundPosition: `${-left * camera.unit}px ${-top * camera.unit}px`,
    transform: `matrix3d(${matrix.join(",")})`,
  };
}

/** Elapsed-time gate, shared by movement and residents; never changes game speed. */
export function createAdventureFrameGate(fps = 60, maxElapsedMs = 80) {
  finitePositive(fps, "Frame rate");
  finitePositive(maxElapsedMs, "Elapsed-time limit");
  const interval = 1000 / fps;
  let previous = null;
  let nextDue = null;
  return (timestamp) => {
    if (!Number.isFinite(timestamp)) return 0;
    if (previous === null || timestamp < previous) {
      previous = timestamp;
      nextDue = timestamp + interval;
      return 0;
    }
    const elapsed = timestamp - previous;
    if (timestamp + 0.75 < nextDue) return 0;
    previous = timestamp;
    // Advance the deadline rather than resetting it on every frame. Otherwise
    // ordinary rAF jitter can accidentally turn a 60 fps target into 30 fps.
    nextDue += interval;
    if (nextDue < timestamp - interval) nextDue = timestamp + interval;
    // Discard background-tab time instead of teleporting through the world.
    return Math.min(elapsed, maxElapsedMs);
  };
}
