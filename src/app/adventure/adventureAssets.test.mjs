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
