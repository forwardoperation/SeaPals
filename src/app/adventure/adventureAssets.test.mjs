import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { ADVENTURE_CONTENT } from "./adventureContent.mjs";
import { ELVERSON_REEF_CREATURE_ATLAS_PATH } from "./adventureAquariumExhibits.mjs";
import { ELVERSON_TOWN_PORTALS } from "./adventureElversonTownLayout.mjs";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIRECTORY = path.resolve(TEST_DIRECTORY, "../../../public");
const PNG_SIGNATURE = "89504e470d0a1a0a";
const ELVERSON_MOBILE_OPENING_ASSETS = Object.freeze([
  "/images/adventure/player-bedroom-v1.webp",
  "/images/adventure/player-home-v1.webp",
  "/images/adventure/elverson-ground-v3.webp",
  "/images/adventure/shellshore-academy.webp",
  "/images/adventure/elverson-reef-creature-atlas-v1.webp",
  "/images/adventure/mr-easterling-portrait-v2.webp",
  "/images/adventure/player-sprites-512-v3.webp",
  "/images/adventure/marina-sprites-512-v3.webp",
  "/images/adventure/dorian-sprites-512-v3.webp",
  "/images/adventure/fisherman-wyeth-sprites-512-v3.webp",
  "/images/adventure/teacher-caroline-sprites-512-v3.webp",
  "/images/adventure/ivy-sprites-512-v3.webp",
  "/images/adventure/explorer-jordan-sprites-512-v3.webp",
  "/images/adventure/marine-biologist-jonah-sprites-512-v3.webp",
  "/images/adventure/town-adult-sprites-512-v3.webp",
  "/images/adventure/mr-easterling-sprites-627-v4.webp",
  "/images/adventure/programmer-harlan-sprites-512-v3.webp",
  "/images/adventure/town-elder-sprites-512-v3.webp",
  "/images/adventure/elverson-objects-v2/blue-home.webp",
  "/images/adventure/elverson-objects-v2/tan-home.webp",
  "/images/adventure/elverson-objects-v2/green-home.webp",
  "/images/adventure/elverson-objects-v2/brick-school.webp",
  "/images/adventure/elverson-objects-v2/brick-civic-hall.webp",
  "/images/adventure/elverson-objects-v2/green-awning-shop.webp",
  "/images/adventure/elverson-objects-v2/aquarium-workshop.webp",
  "/images/cards/coral/Reef/mustard-coral-base.webp",
  "/images/cards/coral/Reef/brain-coral-base.webp",
  "/images/cards/coral/Reef/brain-coral-stage-1.webp",
  "/images/cards/coral/Reef/brain-coral-stage-2.webp",
  "/images/cards/habitats/coral-reef.webp",
  "/images/cards/coral/Reef/clubfinger-stage-1.webp",
  "/images/cards/invertebrates/Reef/Sea Urchin.webp",
  "/images/cards/fish/Reef/picasso-triggerfish.webp",
  "/images/cards/predator/reef/reef-shark.webp",
]);

function publicAssetPath(artPath) {
  return path.join(PUBLIC_DIRECTORY, ...artPath.split("/").filter(Boolean));
}

async function readWebpAsset(artPath) {
  const asset = await readFile(publicAssetPath(artPath));
  assert.equal(asset.subarray(0, 4).toString("ascii"), "RIFF", `${artPath} RIFF header`);
  assert.equal(asset.subarray(8, 12).toString("ascii"), "WEBP", `${artPath} WebP header`);
  const metadata = await sharp(asset).metadata();
  assert.equal(metadata.format, "webp", `${artPath} format`);
  return { asset, metadata };
}

async function readRgbaAsset(artPath) {
  return sharp(publicAssetPath(artPath))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
}

function getOpaqueCellMetrics({ data, info }, {
  column,
  row,
  columns,
  rows,
  footprintDepth = 16,
}) {
  const xStart = Math.round((column * info.width) / columns);
  const xEnd = Math.round(((column + 1) * info.width) / columns);
  const yStart = Math.round((row * info.height) / rows);
  const yEnd = Math.round(((row + 1) * info.height) / rows);
  let count = 0;
  let minX = xEnd;
  let maxX = xStart - 1;
  let minY = yEnd;
  let maxY = yStart - 1;

  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      if (data[((y * info.width + x) * 4) + 3] <= 128) continue;
      count += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  let footprintMinX = xEnd;
  let footprintMaxX = xStart - 1;
  const footprintStart = Math.max(minY, maxY - footprintDepth + 1);
  for (let y = footprintStart; y <= maxY; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      if (data[((y * info.width + x) * 4) + 3] <= 128) continue;
      footprintMinX = Math.min(footprintMinX, x);
      footprintMaxX = Math.max(footprintMaxX, x);
    }
  }

  return {
    count,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    footprintWidth: footprintMaxX - footprintMinX + 1,
  };
}

function getOpaqueConnectedComponents({ data, info }, alphaThreshold = 128) {
  const { width, height } = info;
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Uint32Array(pixelCount);
  const components = [];

  for (let start = 0; start < pixelCount; start += 1) {
    if (visited[start] || data[(start * 4) + 3] <= alphaThreshold) continue;

    let head = 0;
    let tail = 1;
    queue[0] = start;
    visited[start] = 1;
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;

    while (head < tail) {
      const pixel = queue[head];
      head += 1;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      const neighborMinX = Math.max(0, x - 1);
      const neighborMaxX = Math.min(width - 1, x + 1);
      const neighborMinY = Math.max(0, y - 1);
      const neighborMaxY = Math.min(height - 1, y + 1);
      for (let neighborY = neighborMinY; neighborY <= neighborMaxY; neighborY += 1) {
        for (let neighborX = neighborMinX; neighborX <= neighborMaxX; neighborX += 1) {
          const neighbor = (neighborY * width) + neighborX;
          if (
            neighbor === pixel
            || visited[neighbor]
            || data[(neighbor * 4) + 3] <= alphaThreshold
          ) {
            continue;
          }
          visited[neighbor] = 1;
          queue[tail] = neighbor;
          tail += 1;
        }
      }
    }

    components.push({
      pixels: queue.slice(0, tail),
      minX,
      maxX,
      minY,
      maxY,
    });
  }

  return components;
}

function getBoundingBoxDistanceSquared(a, b) {
  const distanceX = a.maxX < b.minX
    ? b.minX - a.maxX
    : b.maxX < a.minX
      ? a.minX - b.maxX
      : 0;
  const distanceY = a.maxY < b.minY
    ? b.minY - a.maxY
    : b.maxY < a.minY
      ? a.minY - b.maxY
      : 0;
  return (distanceX * distanceX) + (distanceY * distanceY);
}

function getOpaqueSpriteGroups(atlas, { columns, rows, label }) {
  const { width } = atlas.info;
  const componentsByColumn = Array.from({ length: columns }, () => []);
  for (const component of getOpaqueConnectedComponents(atlas)) {
    const centerX = (component.minX + component.maxX) / 2;
    const column = Math.max(0, Math.min(
      columns - 1,
      Math.floor((centerX * columns) / width),
    ));
    componentsByColumn[column].push(component);
  }

  return componentsByColumn.map((components, column) => {
    const mainComponents = [...components]
      .sort((a, b) => b.pixels.length - a.pixels.length)
      .slice(0, rows)
      .sort((a, b) => a.minY - b.minY);
    assert.equal(mainComponents.length, rows, `${label} column ${column} sprite bodies`);
    for (const [row, component] of mainComponents.entries()) {
      assert.ok(component.pixels.length > 400, `${label} column ${column}, row ${row} body`);
    }

    const groups = mainComponents.map((component) => ({
      components: [component],
      minX: component.minX,
      maxX: component.maxX,
      minY: component.minY,
      maxY: component.maxY,
    }));
    const mainComponentSet = new Set(mainComponents);
    for (const component of components) {
      if (mainComponentSet.has(component)) continue;
      let closestGroup = groups[0];
      let closestDistance = getBoundingBoxDistanceSquared(component, closestGroup);
      for (const group of groups.slice(1)) {
        const distance = getBoundingBoxDistanceSquared(component, group);
        if (distance >= closestDistance) continue;
        closestGroup = group;
        closestDistance = distance;
      }
      closestGroup.components.push(component);
      closestGroup.minX = Math.min(closestGroup.minX, component.minX);
      closestGroup.maxX = Math.max(closestGroup.maxX, component.maxX);
      closestGroup.minY = Math.min(closestGroup.minY, component.minY);
      closestGroup.maxY = Math.max(closestGroup.maxY, component.maxY);
    }

    return groups;
  });
}

function getGroupedFootprintWidth(group, imageWidth, depthFraction = 0.25) {
  const spriteHeight = group.maxY - group.minY + 1;
  const footprintStart = group.maxY - Math.ceil(spriteHeight * depthFraction) + 1;
  let minX = imageWidth;
  let maxX = -1;

  for (const component of group.components) {
    for (const pixel of component.pixels) {
      const y = Math.floor(pixel / imageWidth);
      if (y < footprintStart) continue;
      const x = pixel % imageWidth;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }

  assert.ok(maxX >= minX, "grouped sprite footprint must contain opaque pixels");
  return maxX - minX + 1;
}

function assertNoOpaqueCellBoundaryBridges({ data, info }, { columns, rows, label }) {
  for (let column = 1; column < columns; column += 1) {
    const seamX = Math.round((column * info.width) / columns);
    for (let y = 0; y < info.height; y += 1) {
      const leftAlpha = data[((y * info.width + seamX - 1) * 4) + 3];
      const rightAlpha = data[((y * info.width + seamX) * 4) + 3];
      assert.equal(
        leftAlpha > 128 && rightAlpha > 128,
        false,
        `${label} artwork crosses column seam ${column}`,
      );
    }
  }
  for (let row = 1; row < rows; row += 1) {
    const seamY = Math.round((row * info.height) / rows);
    for (let x = 0; x < info.width; x += 1) {
      const upperAlpha = data[((((seamY - 1) * info.width) + x) * 4) + 3];
      const lowerAlpha = data[(((seamY * info.width + x) * 4) + 3)];
      assert.equal(
        upperAlpha > 128 && lowerAlpha > 128,
        false,
        `${label} artwork crosses row seam ${row}`,
      );
    }
  }
}

test("every playable scene artwork is a structurally complete map-sized PNG or WebP", async () => {
  const playableScenes = ADVENTURE_CONTENT.scenes.filter((scene) => (
    scene.status === "prototype" && scene.world?.artPath
  ));

  assert.ok(playableScenes.length > 0);
  for (const scene of playableScenes) {
    const metadata = await sharp(publicAssetPath(scene.world.artPath)).metadata();
    assert.ok(["png", "webp"].includes(metadata.format), `${scene.id} must use PNG or WebP`);
    const width = metadata.width;
    const height = metadata.height;
    const aspectRatio = width / height;
    assert.ok(width >= 1000 && height >= 900, `${scene.id} artwork is unexpectedly small`);
    assert.ok(
      aspectRatio >= 1.45 && aspectRatio <= 1.65,
      `${scene.id} artwork aspect ratio ${aspectRatio.toFixed(3)} will distort the map grid`,
    );
  }
});

test("Kelpwatch ships the exact five map-sized PNG assets used by its live scenes", async () => {
  const expectedAssets = new Map([
    ["current-kelpwatch-sea", "/images/adventure/current-kelpwatch-route.png"],
    ["kelpwatch-island-town", "/images/adventure/kelpwatch-island.png"],
    ["kelpwatch-ecology-lab", "/images/adventure/kelpwatch-ecology-lab.png"],
    ["kelpwatch-diver-home", "/images/adventure/kelpwatch-diver-home.png"],
    ["kelpwatch-tide-hall", "/images/adventure/kelpwatch-tide-hall.png"],
  ]);

  for (const [sceneId, artPath] of expectedAssets) {
    const scene = ADVENTURE_CONTENT.scenes.find((candidate) => candidate.id === sceneId);
    assert.equal(scene?.status, "prototype", `${sceneId} must be playable`);
    assert.equal(scene.world.artPath, artPath);

    const png = await readFile(publicAssetPath(artPath));
    assert.equal(png.subarray(0, 8).toString("hex"), PNG_SIGNATURE);
    assert.equal(png.readUInt32BE(16), 1536, `${artPath} width`);
    assert.equal(png.readUInt32BE(20), 1024, `${artPath} height`);
  }
});

test("Elverson ships its mobile-sized layered ground and transparent WebP facades", async () => {
  const town = ADVENTURE_CONTENT.scenes.find((scene) => scene.id === "town");
  assert.equal(town?.status, "prototype");
  assert.equal(town.world.artPath, "/images/adventure/elverson-ground-v3.webp");
  assert.notEqual(town.world.artPath, "/images/adventure/elverson-town.png");

  const ground = await readWebpAsset(town.world.artPath);
  assert.equal(ground.metadata.width, 1536, "layered Elverson ground width");
  assert.equal(ground.metadata.height, 1024, "layered Elverson ground height");
  assert.ok(ground.asset.byteLength < 650_000, "the Elverson ground must remain mobile-sized");

  const objects = town.world.layeredObjects;
  assert.equal(objects.length, 9, "Elverson v3 should expose one facade for each town portal");
  assert.deepEqual(
    objects.map(({ id, interactionId }) => ({ id, interactionId })),
    ELVERSON_TOWN_PORTALS.map(({ objectId, id }) => ({ id: objectId, interactionId: id })),
  );
  const spritePaths = [...new Set(objects.map((object) => object.sprite.src))];
  assert.equal(spritePaths.length, 7, "the nine facades should reuse the seven authored buildings");
  assert.ok(spritePaths.every((spritePath) => (
    spritePath.startsWith("/images/adventure/elverson-objects-v2/")
    && spritePath.endsWith(".webp")
  )));

  for (const spritePath of spritePaths) {
    const webp = await readWebpAsset(spritePath);
    assert.ok(webp.metadata.width > 0 && webp.metadata.height > 0, `${spritePath} dimensions`);
    assert.equal(webp.metadata.hasAlpha, true, `${spritePath} must retain transparency`);
    assert.ok(webp.asset.byteLength < 50_000, `${spritePath} must remain mobile-sized`);
  }
});

test("Elverson ships one complete mobile WebP atlas for hand-net and Aquarium creatures", async () => {
  const webp = await readWebpAsset(ELVERSON_REEF_CREATURE_ATLAS_PATH);
  assert.equal(webp.metadata.width, 1983);
  assert.equal(webp.metadata.height, 793);
  assert.equal(webp.metadata.hasAlpha, true, "the ten-species atlas must retain transparency");
  assert.ok(webp.asset.byteLength < 180_000, "the atlas must remain mobile-sized");
});

test("the v3 player walk sheet ships twelve isolated poses with a compact neutral stance", async () => {
  const sourceMetadata = await sharp(publicAssetPath(
    "/images/adventure/player-sprites-v3.png",
  )).metadata();
  assert.equal(sourceMetadata.width, 1_024);
  assert.equal(sourceMetadata.height, 1_536);
  assert.equal(sourceMetadata.hasAlpha, true, "the full-resolution walk sheet must retain transparency");

  const optimizedPath = "/images/adventure/player-sprites-512-v3.png";
  const atlas = await readRgbaAsset(optimizedPath);
  assert.equal(atlas.info.width, 512);
  assert.equal(atlas.info.height, 768);
  assert.equal(atlas.info.channels, 4);
  assertNoOpaqueCellBoundaryBridges(atlas, {
    columns: 3,
    rows: 4,
    label: optimizedPath,
  });

  let rowsWithClearlyCompactNeutralFeet = 0;
  for (let row = 0; row < 4; row += 1) {
    const frames = [0, 1, 2].map((column) => getOpaqueCellMetrics(atlas, {
      column,
      row,
      columns: 3,
      rows: 4,
    }));
    for (const [column, frame] of frames.entries()) {
      assert.ok(frame.count > 5_000, `player row ${row}, column ${column} must contain one complete pose`);
      assert.ok(frame.width >= 60 && frame.height >= 130, `player row ${row}, column ${column} pose bounds`);
    }

    const [strideA, neutral, strideB] = frames;
    const narrowestStride = Math.min(strideA.footprintWidth, strideB.footprintWidth);
    if (neutral.footprintWidth + 8 <= narrowestStride) {
      rowsWithClearlyCompactNeutralFeet += 1;
    }
    assert.ok(
      neutral.footprintWidth <= Math.max(strideA.footprintWidth, strideB.footprintWidth) + 2,
      `player row ${row} neutral feet must not be broader than its stride`,
    );
  }
  assert.ok(
    rowsWithClearlyCompactNeutralFeet >= 3,
    "the neutral pose must visibly close the player's stance in at least three directional views",
  );
});

test("the live player WebP preserves the v3 pixel art losslessly", async () => {
  const png = await readRgbaAsset("/images/adventure/player-sprites-512-v3.png");
  const webp = await readRgbaAsset("/images/adventure/player-sprites-512-v3.webp");

  assert.deepEqual(webp.info, png.info);
  let alphaMismatches = 0;
  let visibleColorMismatches = 0;
  for (let offset = 0; offset < png.data.length; offset += 4) {
    const pngAlpha = png.data[offset + 3];
    const webpAlpha = webp.data[offset + 3];
    if (pngAlpha !== webpAlpha) alphaMismatches += 1;
    if (
      pngAlpha > 0
      && (
        png.data[offset] !== webp.data[offset]
        || png.data[offset + 1] !== webp.data[offset + 1]
        || png.data[offset + 2] !== webp.data[offset + 2]
      )
    ) {
      visibleColorMismatches += 1;
    }
  }
  assert.equal(alphaMismatches, 0, "the runtime player sheet must preserve alpha exactly");
  assert.equal(
    visibleColorMismatches,
    0,
    "the runtime asset must not introduce visible color noise into the player or NPC aliases",
  );
});

test("every distinct NPC walk sheet has a feet-together neutral column", async () => {
  const npcSheets = [
    "/images/adventure/marina-sprites-512-v3.png",
    "/images/adventure/dorian-sprites-512-v3.png",
    "/images/adventure/fisherman-wyeth-sprites-512-v3.png",
    "/images/adventure/teacher-caroline-sprites-512-v3.png",
    "/images/adventure/ivy-sprites-512-v3.png",
    "/images/adventure/explorer-jordan-sprites-512-v3.png",
    "/images/adventure/marine-biologist-jonah-sprites-512-v3.png",
    "/images/adventure/programmer-harlan-sprites-512-v3.png",
    "/images/adventure/town-elder-sprites-512-v3.png",
    "/images/adventure/town-adult-sprites-512-v3.png",
    "/images/adventure/mr-easterling-sprites-627-v4.png",
  ];

  for (const spritePath of npcSheets) {
    const atlas = await readRgbaAsset(spritePath);
    assert.equal(atlas.info.channels, 4, `${spritePath} channels`);
    const cellWidth = atlas.info.width / 3;
    for (let row = 0; row < 4; row += 1) {
      const frames = [0, 1, 2].map((column) => getOpaqueCellMetrics(atlas, {
        column,
        row,
        columns: 3,
        rows: 4,
      }));
      for (const [column, frame] of frames.entries()) {
        assert.ok(frame.count > 400, `${spritePath} row ${row}, column ${column} pose`);
      }
      const [strideA, neutral, strideB] = frames;
      assert.ok(
        neutral.footprintWidth <= cellWidth * 0.33,
        `${spritePath} row ${row} neutral feet must stay together`,
      );
      assert.ok(
        neutral.footprintWidth <= Math.max(strideA.footprintWidth, strideB.footprintWidth)
          + (cellWidth * 0.1),
        `${spritePath} row ${row} neutral stance must not read broader than the gait`,
      );
    }

    const spriteGroups = getOpaqueSpriteGroups(atlas, {
      columns: 3,
      rows: 4,
      label: spritePath,
    });
    for (const row of [1, 2]) {
      const [strideAWidth, neutralWidth, strideBWidth] = [0, 1, 2].map((column) => (
        getGroupedFootprintWidth(spriteGroups[column][row], atlas.info.width)
      ));
      assert.ok(
        neutralWidth * 5 <= Math.min(strideAWidth, strideBWidth) * 4,
        `${spritePath} row ${row} connected neutral footprint ${neutralWidth}px must be at least 20% narrower than both stride footprints (${strideAWidth}px, ${strideBWidth}px)`,
      );
    }
  }
});

test("the hand-net player atlas ships seven complete poses for four isometric facings", async () => {
  const artPath = "/images/adventure/player-hand-net-isometric-v2.png";
  const png = await readFile(publicAssetPath(artPath));
  const metadata = await sharp(png).metadata();

  assert.equal(png.subarray(0, 8).toString("hex"), PNG_SIGNATURE);
  assert.equal(metadata.width, 2_464, "seven 352px animation cells");
  assert.equal(metadata.height, 1_024, "four 256px facing rows");
  assert.equal(metadata.hasAlpha, true, "the integrated player and net must retain transparency");
  assert.ok(png.byteLength < 1_500_000, "the lossless animation atlas must remain practical on mobile");

  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const atlas = { data, info };
  const frameWidth = 352;
  const frameHeight = 256;
  assertNoOpaqueCellBoundaryBridges(atlas, {
    columns: 7,
    rows: 4,
    label: artPath,
  });

  for (let row = 0; row < 4; row += 1) {
    const walkBodyCenters = [];
    for (let column = 0; column < 3; column += 1) {
      let weightedX = 0;
      let bodyPixelCount = 0;
      for (let y = 50; y < 250; y += 1) {
        for (let x = 45; x < 307; x += 1) {
          const pixel = (((row * frameHeight + y) * info.width) + column * frameWidth + x) * 4;
          const red = data[pixel];
          const green = data[pixel + 1];
          const blue = data[pixel + 2];
          const alpha = data[pixel + 3];
          const playerTeal = alpha > 128
            && green >= 70
            && blue >= 55
            && green > red * 1.05
            && blue > red * 0.72
            && Math.abs(green - blue) < 100;
          if (!playerTeal) continue;
          weightedX += x;
          bodyPixelCount += 1;
        }
      }
      assert.ok(bodyPixelCount > 1_000, `walk body mask must find row ${row}, frame ${column}`);
      walkBodyCenters.push(weightedX / bodyPixelCount);
    }
    const registrationSpread = Math.max(...walkBodyCenters) - Math.min(...walkBodyCenters);
    assert.ok(
      registrationSpread <= 4,
      `walk row ${row} body registration drifted ${registrationSpread.toFixed(2)}px`,
    );

    const [neutral, stepA, stepB] = [0, 1, 2].map((column) => getOpaqueCellMetrics(atlas, {
      column,
      row,
      columns: 7,
      rows: 4,
    }));
    assert.ok(
      neutral.footprintWidth + 20 <= Math.min(stepA.footprintWidth, stepB.footprintWidth),
      `walk row ${row} neutral feet must be visibly closer than either planted stride`,
    );
  }

  const actionRegion = Buffer.alloc((info.width - (3 * frameWidth)) * info.height * 4);
  let actionOffset = 0;
  for (let y = 0; y < info.height; y += 1) {
    const sourceStart = ((y * info.width) + (3 * frameWidth)) * 4;
    const sourceEnd = ((y + 1) * info.width) * 4;
    data.copy(actionRegion, actionOffset, sourceStart, sourceEnd);
    actionOffset += sourceEnd - sourceStart;
  }
  assert.equal(
    createHash("sha256").update(actionRegion).digest("hex"),
    "6a6ba09c4b4fb2b7594fcf5c471e2354b923516472fb49a03c06f2ec36a4769f",
    "the authored windup, scoop, impact, recovery, and celebration cells must remain byte-identical when decoded",
  );
});

test("Elverson ships distinct transparent GBA-style resident walk sheets", async () => {
  const spriteAssets = [
    "/images/adventure/marina-sprites-v3.png",
    "/images/adventure/dorian-sprites-v3.png",
    "/images/adventure/fisherman-wyeth-sprites-v3.png",
    "/images/adventure/teacher-caroline-sprites-v3.png",
    "/images/adventure/ivy-sprites-v3.png",
    "/images/adventure/explorer-jordan-sprites-v3.png",
    "/images/adventure/marine-biologist-jonah-sprites-v3.png",
    "/images/adventure/programmer-harlan-sprites-v3.png",
    "/images/adventure/town-elder-sprites-v3.png",
    "/images/adventure/town-adult-sprites-v3.png",
  ];

  for (const spritePath of spriteAssets) {
    const png = await readFile(publicAssetPath(spritePath));
    assert.equal(png.subarray(0, 8).toString("hex"), PNG_SIGNATURE, spritePath);
    assert.equal(png.readUInt32BE(16), 1024, `${spritePath} width`);
    assert.equal(png.readUInt32BE(20), 1536, `${spritePath} height`);
    assert.ok([3, 6].includes(png[25]), `${spritePath} must use indexed-alpha or RGBA color`);
    if (png[25] === 3) {
      assert.ok(png.includes(Buffer.from("tRNS")), `${spritePath} must retain indexed transparency`);
    }
    assert.equal(png.subarray(-8, -4).toString("ascii"), "IEND", `${spritePath} must be complete`);
  }
});

test("Elverson town ships compact transparent WebP walk sheets", async () => {
  const optimizedSpriteAssets = [
    ["/images/adventure/player-sprites-512-v3.webp", "/images/adventure/player-sprites-v3.png"],
    ["/images/adventure/marina-sprites-512-v3.webp", "/images/adventure/marina-sprites-v3.png"],
    ["/images/adventure/dorian-sprites-512-v3.webp", "/images/adventure/dorian-sprites-v3.png"],
    ["/images/adventure/fisherman-wyeth-sprites-512-v3.webp", "/images/adventure/fisherman-wyeth-sprites-v3.png"],
    ["/images/adventure/teacher-caroline-sprites-512-v3.webp", "/images/adventure/teacher-caroline-sprites-v3.png"],
    ["/images/adventure/ivy-sprites-512-v3.webp", "/images/adventure/ivy-sprites-v3.png"],
    ["/images/adventure/explorer-jordan-sprites-512-v3.webp", "/images/adventure/explorer-jordan-sprites-v3.png"],
    ["/images/adventure/marine-biologist-jonah-sprites-512-v3.webp", "/images/adventure/marine-biologist-jonah-sprites-v3.png"],
    ["/images/adventure/programmer-harlan-sprites-512-v3.webp", "/images/adventure/programmer-harlan-sprites-v3.png"],
    ["/images/adventure/town-elder-sprites-512-v3.webp", "/images/adventure/town-elder-sprites-v3.png"],
    ["/images/adventure/town-adult-sprites-512-v3.webp", "/images/adventure/town-adult-sprites-v3.png"],
  ];
  let optimizedBytes = 0;
  let sourceBytes = 0;

  for (const [optimizedPath, sourcePath] of optimizedSpriteAssets) {
    const { asset: optimized, metadata } = await readWebpAsset(optimizedPath);
    const source = await readFile(publicAssetPath(sourcePath));
    assert.equal(metadata.width, 512, `${optimizedPath} width`);
    assert.equal(metadata.height, 768, `${optimizedPath} height`);
    assert.equal(metadata.hasAlpha, true, `${optimizedPath} must retain transparency`);
    optimizedBytes += optimized.byteLength;
    sourceBytes += source.byteLength;
  }

  const mentorOptimizedPath = "/images/adventure/mr-easterling-sprites-627-v4.webp";
  const mentorSourcePath = "/images/adventure/mr-easterling-sprites-v3.png";
  const { asset: mentorOptimized, metadata: mentorMetadata } = await readWebpAsset(mentorOptimizedPath);
  const mentorSource = await readFile(publicAssetPath(mentorSourcePath));
  assert.equal(mentorMetadata.width, 627, `${mentorOptimizedPath} width`);
  assert.equal(mentorMetadata.height, 627, `${mentorOptimizedPath} height`);
  assert.equal(mentorMetadata.hasAlpha, true, `${mentorOptimizedPath} must retain transparency`);
  optimizedBytes += mentorOptimized.byteLength;
  sourceBytes += mentorSource.byteLength;

  assert.ok(optimizedBytes < sourceBytes, "compact Elverson walk sheets must reduce transfer size");
});

test("Mr. Easterling ships a transparent identity-based walk sheet and portrait", async () => {
  for (const spritePath of [
    "/images/adventure/mr-easterling-sprites-v3.png",
    "/images/adventure/mr-easterling-portrait-v2.png",
  ]) {
    const png = await readFile(publicAssetPath(spritePath));
    assert.equal(png.subarray(0, 8).toString("hex"), PNG_SIGNATURE, spritePath);
    assert.equal(png.readUInt32BE(16), 1254, `${spritePath} width`);
    assert.equal(png.readUInt32BE(20), 1254, `${spritePath} height`);
    assert.equal(png[25], 6, `${spritePath} must retain RGBA transparency`);
    assert.equal(png.subarray(-8, -4).toString("ascii"), "IEND", `${spritePath} must be complete`);
  }
});

test("the Elverson opening and first tutorial remain inside the mobile image budget", async () => {
  let totalBytes = 0;
  for (const assetPath of ELVERSON_MOBILE_OPENING_ASSETS) {
    const { asset } = await readWebpAsset(assetPath);
    totalBytes += asset.byteLength;
  }
  assert.ok(
    totalBytes < 3_200_000,
    `Elverson mobile opening assets total ${totalBytes} bytes; expected less than 3.2 MB`,
  );
});

test("playable science notes use unique authoritative government sources", () => {
  const sourcedNotes = ADVENTURE_CONTENT.fieldNotes.filter((fieldNote) => (
    fieldNote.status === "prototype" && fieldNote.sourceUrls?.length
  ));

  assert.ok(sourcedNotes.length > 0);
  for (const fieldNote of sourcedNotes) {
    assert.equal(
      new Set(fieldNote.sourceUrls).size,
      fieldNote.sourceUrls.length,
      `${fieldNote.id} must not repeat a science source`,
    );
    for (const sourceUrl of fieldNote.sourceUrls) {
      const hostname = new URL(sourceUrl).hostname;
      assert.ok(
        hostname === "epa.gov"
        || hostname.endsWith(".epa.gov")
        || hostname === "noaa.gov"
        || hostname.endsWith(".noaa.gov")
        || hostname === "nps.gov"
        || hostname.endsWith(".nps.gov"),
        `${fieldNote.id} source ${hostname} must be an authoritative NOAA, EPA, or NPS page`,
      );
    }
  }
});
