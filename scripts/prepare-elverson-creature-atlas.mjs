import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const [sourcePath, destinationPath] = process.argv.slice(2);
if (!sourcePath || !destinationPath) {
  throw new Error("Usage: node scripts/prepare-elverson-creature-atlas.mjs <source.png> <destination.png>");
}

const source = path.resolve(sourcePath);
const destination = path.resolve(destinationPath);
const { data, info } = await sharp(source)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const pixelCount = info.width * info.height;
const visited = new Uint8Array(pixelCount);
const queue = new Int32Array(pixelCount);
let head = 0;
let tail = 0;

function isCheckerPixel(index) {
  const offset = index * info.channels;
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const minimum = Math.min(red, green, blue);
  const maximum = Math.max(red, green, blue);
  return minimum >= 216 && maximum - minimum <= 14;
}

function enqueue(index) {
  if (index < 0 || index >= pixelCount || visited[index] || !isCheckerPixel(index)) return;
  visited[index] = 1;
  queue[tail] = index;
  tail += 1;
}

for (let x = 0; x < info.width; x += 1) {
  enqueue(x);
  enqueue((info.height - 1) * info.width + x);
}
for (let y = 0; y < info.height; y += 1) {
  enqueue(y * info.width);
  enqueue(y * info.width + info.width - 1);
}

while (head < tail) {
  const index = queue[head];
  head += 1;
  const x = index % info.width;
  if (x > 0) enqueue(index - 1);
  if (x < info.width - 1) enqueue(index + 1);
  if (index >= info.width) enqueue(index - info.width);
  if (index < pixelCount - info.width) enqueue(index + info.width);
}

for (let index = 0; index < pixelCount; index += 1) {
  if (visited[index]) data[index * info.channels + 3] = 0;
}

await sharp(data, {
  raw: {
    width: info.width,
    height: info.height,
    channels: info.channels,
  },
})
  .png({ compressionLevel: 9, palette: false })
  .toFile(destination);

const metadata = await sharp(destination).metadata();
if (!metadata.hasAlpha) throw new Error("Prepared atlas does not contain an alpha channel.");
process.stdout.write(`${metadata.width}x${metadata.height} RGBA atlas written to ${destination}\n`);
