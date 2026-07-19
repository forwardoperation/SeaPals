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
        hostname === "epa.gov" || hostname.endsWith(".epa.gov") || hostname === "noaa.gov" || hostname.endsWith(".noaa.gov"),
        `${fieldNote.id} source ${hostname} must be an authoritative NOAA or EPA page`,
      );
    }
  }
});
