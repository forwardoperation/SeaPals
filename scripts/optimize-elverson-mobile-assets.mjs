import { stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const PUBLIC_IMAGE_DIRECTORY = path.join(ROOT, "public", "images");
const ADVENTURE_ASSET_DIRECTORY = path.join(ROOT, "public", "images", "adventure");

const MOBILE_ASSETS = Object.freeze([
  { source: "player-home-v1.png", destination: "player-home-v1.webp", quality: 82, maxBytes: 350_000 },
  { source: "elverson-ground-v3.png", destination: "elverson-ground-v3.webp", quality: 82, maxBytes: 650_000 },
  { source: "shellshore-academy.png", destination: "shellshore-academy.webp", quality: 82, maxBytes: 300_000 },
  { source: "elverson-reef-creature-atlas-v1.png", destination: "elverson-reef-creature-atlas-v1.webp", quality: 90, maxBytes: 180_000 },
  { source: "mr-easterling-portrait-v2.png", destination: "mr-easterling-portrait-v2.webp", quality: 90, maxBytes: 120_000 },
  { source: "player-sprites-512-v2.png", destination: "player-sprites-512-v2.webp", quality: 90, maxBytes: 90_000 },
  { source: "marina-sprites-512-v2.png", destination: "marina-sprites-512-v2.webp", quality: 90, maxBytes: 90_000 },
  { source: "dorian-sprites-512-v2.png", destination: "dorian-sprites-512-v2.webp", quality: 90, maxBytes: 75_000 },
  { source: "fisherman-wyeth-sprites-512-v2.png", destination: "fisherman-wyeth-sprites-512-v2.webp", quality: 90, maxBytes: 70_000 },
  { source: "teacher-caroline-sprites-512-v2.png", destination: "teacher-caroline-sprites-512-v2.webp", quality: 90, maxBytes: 60_000 },
  { source: "ivy-sprites-512-v2.png", destination: "ivy-sprites-512-v2.webp", quality: 90, maxBytes: 85_000 },
  { source: "explorer-jordan-sprites-512-v2.png", destination: "explorer-jordan-sprites-512-v2.webp", quality: 90, maxBytes: 65_000 },
  { source: "marine-biologist-jonah-sprites-512-v2.png", destination: "marine-biologist-jonah-sprites-512-v2.webp", quality: 90, maxBytes: 60_000 },
  { source: "town-adult-sprites-512-v2.png", destination: "town-adult-sprites-512-v2.webp", quality: 90, maxBytes: 60_000 },
  { source: "mr-easterling-sprites-627-v3.png", destination: "mr-easterling-sprites-627-v3.webp", quality: 90, maxBytes: 75_000 },
  { source: "programmer-harlan-sprites.png", destination: "programmer-harlan-sprites.webp", quality: 90, maxBytes: 130_000 },
  { source: "town-elder-sprites.png", destination: "town-elder-sprites.webp", quality: 90, maxBytes: 160_000 },
  { source: "elverson-objects-v2/blue-home.png", destination: "elverson-objects-v2/blue-home.webp", quality: 90, maxBytes: 40_000 },
  { source: "elverson-objects-v2/tan-home.png", destination: "elverson-objects-v2/tan-home.webp", quality: 90, maxBytes: 40_000 },
  { source: "elverson-objects-v2/green-home.png", destination: "elverson-objects-v2/green-home.webp", quality: 90, maxBytes: 40_000 },
  { source: "elverson-objects-v2/brick-school.png", destination: "elverson-objects-v2/brick-school.webp", quality: 90, maxBytes: 50_000 },
  { source: "elverson-objects-v2/brick-civic-hall.png", destination: "elverson-objects-v2/brick-civic-hall.webp", quality: 90, maxBytes: 50_000 },
  { source: "elverson-objects-v2/green-awning-shop.png", destination: "elverson-objects-v2/green-awning-shop.webp", quality: 90, maxBytes: 35_000 },
  { source: "elverson-objects-v2/aquarium-workshop.png", destination: "elverson-objects-v2/aquarium-workshop.webp", quality: 90, maxBytes: 45_000 },
  { directory: "cards/coral/Reef", source: "mustard-coral-base.png", destination: "mustard-coral-base.webp", quality: 90, maxBytes: 80_000 },
  { directory: "cards/coral/Reef", source: "brain-coral-base.png", destination: "brain-coral-base.webp", quality: 90, maxBytes: 80_000 },
  { directory: "cards/coral/Reef", source: "brain-coral-stage-1.png", destination: "brain-coral-stage-1.webp", quality: 90, maxBytes: 80_000 },
  { directory: "cards/coral/Reef", source: "brain-coral-stage-2.png", destination: "brain-coral-stage-2.webp", quality: 90, maxBytes: 80_000 },
  { directory: "cards/habitats", source: "coral-reef.png", destination: "coral-reef.webp", quality: 90, maxBytes: 250_000 },
  { directory: "cards/coral/Reef", source: "clubfinger-stage-1.png", destination: "clubfinger-stage-1.webp", quality: 90, maxBytes: 80_000 },
  { directory: "cards/invertebrates/Reef", source: "Sea Urchin.png", destination: "Sea Urchin.webp", quality: 90, maxBytes: 80_000 },
  { directory: "cards/fish/Reef", source: "picasso-triggerfish.png", destination: "picasso-triggerfish.webp", quality: 90, maxBytes: 80_000 },
  { directory: "cards/predator/reef", source: "reef-shark.png", destination: "reef-shark.webp", quality: 90, maxBytes: 80_000 },
]);

for (const asset of MOBILE_ASSETS) {
  const assetDirectory = asset.directory
    ? path.join(PUBLIC_IMAGE_DIRECTORY, asset.directory)
    : ADVENTURE_ASSET_DIRECTORY;
  const sourcePath = path.join(assetDirectory, asset.source);
  const destinationPath = path.join(assetDirectory, asset.destination);
  const sourceMetadata = await sharp(sourcePath).metadata();

  await sharp(sourcePath)
    .webp({
      quality: asset.quality,
      alphaQuality: 100,
      smartSubsample: true,
      effort: 6,
    })
    .toFile(destinationPath);

  const [destinationMetadata, sourceFile, destinationFile] = await Promise.all([
    sharp(destinationPath).metadata(),
    stat(sourcePath),
    stat(destinationPath),
  ]);
  if (
    destinationMetadata.format !== "webp"
    || destinationMetadata.width !== sourceMetadata.width
    || destinationMetadata.height !== sourceMetadata.height
    || destinationMetadata.hasAlpha !== sourceMetadata.hasAlpha
  ) {
    throw new Error(`${asset.destination} did not preserve its source geometry and alpha contract.`);
  }
  if (destinationFile.size >= sourceFile.size || destinationFile.size > asset.maxBytes) {
    throw new Error(
      `${asset.destination} is ${destinationFile.size} bytes; expected less than both its source and ${asset.maxBytes} bytes.`,
    );
  }

  console.log(
    `${asset.destination}: ${(sourceFile.size / 1024).toFixed(1)} KB -> ${(destinationFile.size / 1024).toFixed(1)} KB`,
  );
}
