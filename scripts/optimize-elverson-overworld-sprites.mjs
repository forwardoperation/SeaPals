import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const ASSET_DIRECTORY = path.join(ROOT, "public", "images", "adventure");

const OVERWORLD_SHEETS = Object.freeze([
  ["player-sprites.png", "player-sprites-512-v2.png", 1024, 1536, 512, 768],
  ["marina-sprites.png", "marina-sprites-512-v2.png", 1024, 1536, 512, 768],
  ["dorian-sprites.png", "dorian-sprites-512-v2.png", 1024, 1536, 512, 768],
  ["fisherman-wyeth-sprites.png", "fisherman-wyeth-sprites-512-v2.png", 1024, 1536, 512, 768],
  ["teacher-caroline-sprites.png", "teacher-caroline-sprites-512-v2.png", 1024, 1536, 512, 768],
  ["ivy-sprites.png", "ivy-sprites-512-v2.png", 1024, 1536, 512, 768],
  ["explorer-jordan-sprites.png", "explorer-jordan-sprites-512-v2.png", 1024, 1536, 512, 768],
  ["marine-biologist-jonah-sprites.png", "marine-biologist-jonah-sprites-512-v2.png", 1024, 1536, 512, 768],
  ["town-adult-sprites.png", "town-adult-sprites-512-v2.png", 1024, 1536, 512, 768],
  ["mr-easterling-sprites-v2.png", "mr-easterling-sprites-627-v3.png", 1254, 1254, 627, 627],
]);

for (const [
  sourceName,
  destinationName,
  sourceWidth,
  sourceHeight,
  destinationWidth,
  destinationHeight,
] of OVERWORLD_SHEETS) {
  const sourcePath = path.join(ASSET_DIRECTORY, sourceName);
  const destinationPath = path.join(ASSET_DIRECTORY, destinationName);
  const sourceMetadata = await sharp(sourcePath).metadata();
  if (
    sourceMetadata.width !== sourceWidth
    || sourceMetadata.height !== sourceHeight
    || sourceMetadata.hasAlpha !== true
  ) {
    throw new Error(
      `${sourceName} must be the authored ${sourceWidth}x${sourceHeight} transparent walk sheet.`,
    );
  }

  await sharp(sourcePath)
    .resize(destinationWidth, destinationHeight, {
      fit: "fill",
      kernel: sharp.kernel.nearest,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toFile(destinationPath);

  const [outputMetadata, outputStats] = await Promise.all([
    sharp(destinationPath).metadata(),
    sharp(destinationPath).stats(),
  ]);
  const alpha = outputStats.channels[3];
  if (
    outputMetadata.width !== destinationWidth
    || outputMetadata.height !== destinationHeight
    || outputMetadata.hasAlpha !== true
    || alpha?.min !== 0
    || alpha?.max !== 255
  ) {
    throw new Error(`${destinationName} did not preserve the expected dimensions and transparency.`);
  }

  console.log(`Generated ${destinationName} (${destinationWidth}x${destinationHeight}).`);
}
