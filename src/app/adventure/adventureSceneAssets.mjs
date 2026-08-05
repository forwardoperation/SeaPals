const EMPTY_ASSET_PATHS = Object.freeze([]);

/**
 * Scenes with inline `artPath` values do not need this fallback. These entries
 * mirror the CSS-backed scene themes whose ground artwork otherwise remains
 * invisible to JavaScript preloading.
 */
export const ADVENTURE_SCENE_THEME_GROUND_ASSETS = Object.freeze({
  "academy-lab": "/images/adventure/shellshore-academy.webp",
  "coral-cottage": "/images/adventure/coral-cottage.png",
  "deep-sea-den": "/images/adventure/deepwater-den.png",
  "shellshore-sunpatch-route": "/images/adventure/shellshore-sunpatch-route.png",
  "sunpatch-cay": "/images/adventure/sunpatch-cay.png",
  "sunpatch-field-station": "/images/adventure/sunpatch-field-station.png",
  "sunpatch-tide-hall": "/images/adventure/sunpatch-tide-hall.png",
});

/** Maps rendered sprite-profile IDs to the bitmap actually used by CSS. */
export const ADVENTURE_CHARACTER_SPRITE_ASSETS = Object.freeze({
  player: "/images/adventure/player-sprites-512-v2.webp",
  marina: "/images/adventure/marina-sprites-512-v2.webp",
  dorian: "/images/adventure/dorian-sprites-512-v2.webp",
  "fisherman-wyeth": "/images/adventure/fisherman-wyeth-sprites-512-v2.webp",
  "teacher-caroline": "/images/adventure/teacher-caroline-sprites-512-v2.webp",
  ivy: "/images/adventure/ivy-sprites-512-v2.webp",
  "explorer-jordan": "/images/adventure/explorer-jordan-sprites-512-v2.webp",
  "marine-biologist-jonah": "/images/adventure/marine-biologist-jonah-sprites-512-v2.webp",
  "programmer-harlan": "/images/adventure/programmer-harlan-sprites.webp",
  "town-elder": "/images/adventure/town-elder-sprites.webp",
  "town-adult": "/images/adventure/town-adult-sprites-512-v2.webp",
  "academy-mentor": "/images/adventure/mr-easterling-sprites-627-v3.webp",
  "current-guide": "/images/adventure/player-sprites.png",
  "current-deckhand": "/images/adventure/player-sprites.png",
  "current-analyst": "/images/adventure/marina-sprites.png",
  "current-leader": "/images/adventure/marina-sprites.png",
  "current-navigator": "/images/adventure/dorian-sprites.png",
  "kelpwatch-guide": "/images/adventure/player-sprites.png",
  "kelpwatch-ranger": "/images/adventure/player-sprites.png",
  "kelpwatch-ecologist": "/images/adventure/marina-sprites.png",
  "kelpwatch-leader": "/images/adventure/marina-sprites.png",
  "kelpwatch-diver": "/images/adventure/dorian-sprites.png",
  "trenchlight-guide": "/images/adventure/player-sprites.png",
  "trenchlight-engineer": "/images/adventure/player-sprites.png",
  "trenchlight-scientist": "/images/adventure/marina-sprites.png",
  "trenchlight-leader": "/images/adventure/marina-sprites.png",
  "trenchlight-observer": "/images/adventure/dorian-sprites.png",
  "champions-wake-director": "/images/adventure/marina-sprites.png",
  "tournament-champion": "/images/adventure/marina-sprites.png",
  "tournament-quarterfinalist": "/images/adventure/player-sprites.png",
  "champions-wake-spectator": "/images/adventure/player-sprites.png",
  "tournament-semifinalist": "/images/adventure/dorian-sprites.png",
  "champions-wake-reflector": "/images/adventure/dorian-sprites.png",
});

/** Characters that can be staged by progression rather than scene authorship. */
export const ADVENTURE_SCENE_TRANSIENT_CHARACTER_PROFILES = Object.freeze({
  town: Object.freeze([
    "academy-mentor",
    "teacher-caroline",
    "town-adult",
    "explorer-jordan",
    "marina",
    "dorian",
    "ivy",
    "marine-biologist-jonah",
    "programmer-harlan",
    "fisherman-wyeth",
    "player",
  ]),
});

function isAssetPath(value) {
  return typeof value === "string" && value.trim().startsWith("/");
}

export function getAdventureCharacterSpriteAssetPath(spriteProfileId) {
  return typeof spriteProfileId === "string"
    ? ADVENTURE_CHARACTER_SPRITE_ASSETS[spriteProfileId] ?? null
    : null;
}

/** Returns the unique doorway destinations that are worth warming in advance. */
export function getAdventureInteriorDestinationSceneIds(scene) {
  if (!scene || scene.kind !== "interior" || !Array.isArray(scene.interactions)) {
    return EMPTY_ASSET_PATHS;
  }
  return Object.freeze([...new Set(
    scene.interactions
      .map((interaction) => interaction?.targetScene)
      .filter((sceneId) => typeof sceneId === "string" && sceneId.trim()),
  )]);
}

/**
 * Produces a stable, unique list for a destination scene. Character IDs here
 * are rendered sprite-profile IDs, not story NPC IDs.
 */
export function collectAdventureSceneAssetPaths(
  scene,
  { characterSpriteProfileIds = [] } = {},
) {
  if (!scene || typeof scene !== "object" || Array.isArray(scene)) return EMPTY_ASSET_PATHS;
  if (!Array.isArray(characterSpriteProfileIds)) {
    throw new TypeError("Adventure scene characterSpriteProfileIds must be an array.");
  }

  const paths = new Set();
  const groundPath = isAssetPath(scene.artPath)
    ? scene.artPath
    : ADVENTURE_SCENE_THEME_GROUND_ASSETS[scene.theme];
  if (isAssetPath(groundPath)) paths.add(groundPath);

  for (const object of scene.layeredObjects ?? []) {
    if (isAssetPath(object?.sprite?.src)) paths.add(object.sprite.src);
  }
  for (const spriteProfileId of characterSpriteProfileIds) {
    const path = getAdventureCharacterSpriteAssetPath(spriteProfileId);
    if (path) paths.add(path);
  }
  for (const spriteProfileId of ADVENTURE_SCENE_TRANSIENT_CHARACTER_PROFILES[scene.id] ?? []) {
    const path = getAdventureCharacterSpriteAssetPath(spriteProfileId);
    if (path) paths.add(path);
  }
  return Object.freeze([...paths]);
}

/**
 * Creates a best-effort image loader whose per-path promises survive callers.
 * Decode failures resolve because transition fallback and gameplay must never
 * be held hostage by decorative artwork.
 */
export function createAdventureSceneAssetPreloader({ createImage } = {}) {
  if (typeof createImage !== "function") {
    throw new TypeError("Adventure scene asset preloading requires a createImage function.");
  }
  const assetPromises = new Map();

  function preloadAsset(pathValue) {
    if (!isAssetPath(pathValue)) {
      throw new TypeError("Adventure scene asset paths must be root-relative strings.");
    }
    const path = pathValue.trim();
    const cached = assetPromises.get(path);
    if (cached) return cached;

    let transportFailed = false;
    const promise = new Promise((resolve) => {
      let image;
      let settled = false;
      let decodeStarted = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (image) {
          image.onload = null;
          image.onerror = null;
        }
        resolve();
      };
      const failTransport = () => {
        transportFailed = true;
        finish();
      };
      const decodeLoadedImage = () => {
        if (settled || decodeStarted) return;
        decodeStarted = true;
        if (typeof image.decode === "function") {
          try {
            Promise.resolve(image.decode()).then(finish, finish);
          } catch {
            finish();
          }
        } else {
          finish();
        }
      };

      try {
        image = createImage();
        image.onload = decodeLoadedImage;
        image.onerror = failTransport;
        image.src = path;
        if (image.complete) decodeLoadedImage();
      } catch {
        failTransport();
      }
    });
    assetPromises.set(path, promise);
    // A decoded image (including a decode that is unsupported) is useful to
    // cache. A transport/setup failure is not: let a later transition retry
    // instead of permanently treating a flaky mobile request as warm.
    void promise.then(() => {
      if (transportFailed && assetPromises.get(path) === promise) {
        assetPromises.delete(path);
      }
    });
    return promise;
  }

  function preloadAssetPaths(paths) {
    if (!Array.isArray(paths)) {
      throw new TypeError("Adventure scene asset preload paths must be an array.");
    }
    return Promise.all([...new Set(paths)].map(preloadAsset)).then(() => undefined);
  }

  function preloadScene(scene, options) {
    return preloadAssetPaths(collectAdventureSceneAssetPaths(scene, options));
  }

  return Object.freeze({
    preloadAsset,
    preloadAssetPaths,
    preloadScene,
    hasCachedAsset: (path) => assetPromises.has(path),
  });
}
