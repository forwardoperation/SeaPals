import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { ADVENTURE_CONTENT } from "./adventureContent.mjs";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIRECTORY = path.resolve(TEST_DIRECTORY, "../../../public");
const PNG_SIGNATURE = "89504e470d0a1a0a";

function publicAssetPath(artPath) {
  return path.join(PUBLIC_DIRECTORY, ...artPath.split("/").filter(Boolean));
}

test("every playable scene artwork is a structurally complete map-sized PNG", async () => {
  const playableScenes = ADVENTURE_CONTENT.scenes.filter((scene) => (
    scene.status === "prototype" && scene.world?.artPath
  ));

  assert.ok(playableScenes.length > 0);
  for (const scene of playableScenes) {
    const png = await readFile(publicAssetPath(scene.world.artPath));
    assert.equal(
      png.subarray(0, 8).toString("hex"),
      PNG_SIGNATURE,
      `${scene.id} must point to a valid PNG`,
    );
    assert.equal(
      png.subarray(12, 16).toString("ascii"),
      "IHDR",
      `${scene.id} must contain a PNG image header`,
    );
    assert.equal(
      png.subarray(-8, -4).toString("ascii"),
      "IEND",
      `${scene.id} must contain a complete PNG end chunk`,
    );

    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
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

test("Elverson ships its layered ground and every referenced transparent object sprite", async () => {
  const town = ADVENTURE_CONTENT.scenes.find((scene) => scene.id === "town");
  assert.equal(town?.status, "prototype");
  assert.equal(town.world.artPath, "/images/adventure/elverson-ground-v2.png");
  assert.notEqual(town.world.artPath, "/images/adventure/elverson-town.png");

  const ground = await readFile(publicAssetPath(town.world.artPath));
  assert.equal(ground.subarray(0, 8).toString("hex"), PNG_SIGNATURE);
  assert.equal(ground.readUInt32BE(16), 1536, "layered Elverson ground width");
  assert.equal(ground.readUInt32BE(20), 1024, "layered Elverson ground height");

  const objects = town.world.layeredObjects;
  assert.ok(objects.length >= 40, "Elverson should be assembled from reusable placed objects");
  const spritePaths = [...new Set(objects.map((object) => object.sprite.src))];
  assert.ok(spritePaths.length >= 15, "Elverson should reference the complete object family");
  assert.ok(spritePaths.every((spritePath) => (
    spritePath.startsWith("/images/adventure/elverson-objects-v2/")
  )));

  for (const spritePath of spritePaths) {
    const png = await readFile(publicAssetPath(spritePath));
    assert.equal(png.subarray(0, 8).toString("hex"), PNG_SIGNATURE, spritePath);
    assert.equal(png.subarray(12, 16).toString("ascii"), "IHDR", `${spritePath} header`);
    assert.ok(png.readUInt32BE(16) > 0 && png.readUInt32BE(20) > 0, `${spritePath} dimensions`);
    assert.ok([3, 6].includes(png[25]), `${spritePath} must use indexed-alpha or RGBA color`);
    if (png[25] === 3) {
      assert.ok(png.includes(Buffer.from("tRNS")), `${spritePath} must retain indexed transparency`);
    }
    assert.equal(png.subarray(-8, -4).toString("ascii"), "IEND", `${spritePath} must be complete`);
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

test("Elverson town ships compact versioned walk sheets without softening portraits", async () => {
  const optimizedSpriteAssets = [
    ["/images/adventure/player-sprites-512-v2.png", "/images/adventure/player-sprites.png"],
    ["/images/adventure/marina-sprites-512-v2.png", "/images/adventure/marina-sprites.png"],
    ["/images/adventure/dorian-sprites-512-v2.png", "/images/adventure/dorian-sprites.png"],
    ["/images/adventure/fisherman-wyeth-sprites-512-v2.png", "/images/adventure/fisherman-wyeth-sprites.png"],
    ["/images/adventure/teacher-caroline-sprites-512-v2.png", "/images/adventure/teacher-caroline-sprites.png"],
    ["/images/adventure/ivy-sprites-512-v2.png", "/images/adventure/ivy-sprites.png"],
    ["/images/adventure/explorer-jordan-sprites-512-v2.png", "/images/adventure/explorer-jordan-sprites.png"],
    ["/images/adventure/marine-biologist-jonah-sprites-512-v2.png", "/images/adventure/marine-biologist-jonah-sprites.png"],
    ["/images/adventure/town-adult-sprites-512-v2.png", "/images/adventure/town-adult-sprites.png"],
  ];
  let optimizedBytes = 0;
  let sourceBytes = 0;

  for (const [optimizedPath, sourcePath] of optimizedSpriteAssets) {
    const optimized = await readFile(publicAssetPath(optimizedPath));
    const source = await readFile(publicAssetPath(sourcePath));
    assert.equal(optimized.subarray(0, 8).toString("hex"), PNG_SIGNATURE, optimizedPath);
    assert.equal(optimized.readUInt32BE(16), 512, `${optimizedPath} width`);
    assert.equal(optimized.readUInt32BE(20), 768, `${optimizedPath} height`);
    assert.ok([3, 6].includes(optimized[25]), `${optimizedPath} must retain alpha transparency`);
    if (optimized[25] === 3) {
      assert.ok(optimized.includes(Buffer.from("tRNS")), `${optimizedPath} must retain indexed transparency`);
    }
    assert.equal(optimized.subarray(-8, -4).toString("ascii"), "IEND", `${optimizedPath} must be complete`);
    optimizedBytes += optimized.byteLength;
    sourceBytes += source.byteLength;
  }

  const mentorOptimizedPath = "/images/adventure/mr-easterling-sprites-627-v3.png";
  const mentorSourcePath = "/images/adventure/mr-easterling-sprites-v2.png";
  const mentorOptimized = await readFile(publicAssetPath(mentorOptimizedPath));
  const mentorSource = await readFile(publicAssetPath(mentorSourcePath));
  assert.equal(mentorOptimized.subarray(0, 8).toString("hex"), PNG_SIGNATURE, mentorOptimizedPath);
  assert.equal(mentorOptimized.readUInt32BE(16), 627, `${mentorOptimizedPath} width`);
  assert.equal(mentorOptimized.readUInt32BE(20), 627, `${mentorOptimizedPath} height`);
  assert.ok([3, 6].includes(mentorOptimized[25]), `${mentorOptimizedPath} must retain alpha transparency`);
  if (mentorOptimized[25] === 3) {
    assert.ok(mentorOptimized.includes(Buffer.from("tRNS")), `${mentorOptimizedPath} must retain indexed transparency`);
  }
  assert.equal(mentorOptimized.subarray(-8, -4).toString("ascii"), "IEND", `${mentorOptimizedPath} must be complete`);
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
