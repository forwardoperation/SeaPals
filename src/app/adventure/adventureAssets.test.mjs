import assert from "node:assert/strict";
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
  "/images/adventure/player-sprites-512-v2.webp",
  "/images/adventure/marina-sprites-512-v2.webp",
  "/images/adventure/dorian-sprites-512-v2.webp",
  "/images/adventure/fisherman-wyeth-sprites-512-v2.webp",
  "/images/adventure/teacher-caroline-sprites-512-v2.webp",
  "/images/adventure/ivy-sprites-512-v2.webp",
  "/images/adventure/explorer-jordan-sprites-512-v2.webp",
  "/images/adventure/marine-biologist-jonah-sprites-512-v2.webp",
  "/images/adventure/town-adult-sprites-512-v2.webp",
  "/images/adventure/mr-easterling-sprites-627-v3.webp",
  "/images/adventure/programmer-harlan-sprites.webp",
  "/images/adventure/town-elder-sprites.webp",
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

test("the hand-net player atlas ships seven complete poses for four isometric facings", async () => {
  const artPath = "/images/adventure/player-hand-net-isometric-v1.png";
  const png = await readFile(publicAssetPath(artPath));
  const metadata = await sharp(png).metadata();

  assert.equal(png.subarray(0, 8).toString("hex"), PNG_SIGNATURE);
  assert.equal(metadata.width, 2_464, "seven 352px animation cells");
  assert.equal(metadata.height, 1_024, "four 256px facing rows");
  assert.equal(metadata.hasAlpha, true, "the integrated player and net must retain transparency");
  assert.ok(png.byteLength < 1_500_000, "the lossless animation atlas must remain practical on mobile");

  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const frameWidth = 352;
  const frameHeight = 256;
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
      registrationSpread <= 3,
      `walk row ${row} body registration drifted ${registrationSpread.toFixed(2)}px`,
    );
  }
});

test("Elverson ships distinct transparent GBA-style resident walk sheets", async () => {
  const spriteAssets = [
    "/images/adventure/fisherman-wyeth-sprites.png",
    "/images/adventure/teacher-caroline-sprites.png",
    "/images/adventure/ivy-sprites.png",
    "/images/adventure/explorer-jordan-sprites.png",
    "/images/adventure/marine-biologist-jonah-sprites.png",
    "/images/adventure/programmer-harlan-sprites.png",
    "/images/adventure/town-elder-sprites.png",
    "/images/adventure/town-adult-sprites.png",
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
    ["/images/adventure/player-sprites-512-v2.webp", "/images/adventure/player-sprites.png"],
    ["/images/adventure/marina-sprites-512-v2.webp", "/images/adventure/marina-sprites.png"],
    ["/images/adventure/dorian-sprites-512-v2.webp", "/images/adventure/dorian-sprites.png"],
    ["/images/adventure/fisherman-wyeth-sprites-512-v2.webp", "/images/adventure/fisherman-wyeth-sprites.png"],
    ["/images/adventure/teacher-caroline-sprites-512-v2.webp", "/images/adventure/teacher-caroline-sprites.png"],
    ["/images/adventure/ivy-sprites-512-v2.webp", "/images/adventure/ivy-sprites.png"],
    ["/images/adventure/explorer-jordan-sprites-512-v2.webp", "/images/adventure/explorer-jordan-sprites.png"],
    ["/images/adventure/marine-biologist-jonah-sprites-512-v2.webp", "/images/adventure/marine-biologist-jonah-sprites.png"],
    ["/images/adventure/town-adult-sprites-512-v2.webp", "/images/adventure/town-adult-sprites.png"],
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

  const mentorOptimizedPath = "/images/adventure/mr-easterling-sprites-627-v3.webp";
  const mentorSourcePath = "/images/adventure/mr-easterling-sprites-v2.png";
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
    "/images/adventure/mr-easterling-sprites-v2.png",
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
