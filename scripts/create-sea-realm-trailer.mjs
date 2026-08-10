import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  access,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CAPTURE_DIR = path.join(ROOT, "tmp", "reefbound-trailer", "captures");
const WORK_DIR = path.join(ROOT, "tmp", "reefbound-trailer", "render");
const VIDEO_DIR = path.join(ROOT, "public", "videos");
const POSTER_DIR = path.join(ROOT, "public", "images", "promo");
const FFMPEG_PATH = path.join(
  ROOT,
  "tmp",
  "reefbound-trailer-tools",
  "node_modules",
  "ffmpeg-static",
  "ffmpeg.exe",
);

const OUTPUT_PATH = path.join(VIDEO_DIR, "sea-realm-core-features-trailer.mp4");
const POSTER_PATH = path.join(POSTER_DIR, "sea-realm-core-features-trailer-poster.jpg");
const CONTACT_SHEET_PATH = path.join(WORK_DIR, "sea-realm-trailer-contact-sheet.jpg");
const AUDIO_PATH = path.join(WORK_DIR, "sea-realm-trailer-original-score.wav");

const WIDTH = 1280;
const HEIGHT = 720;
const MASTER_WIDTH = 1600;
const MASTER_HEIGHT = 900;
const FPS = 30;
const DURATION_SECONDS = 30;
const TOTAL_FRAMES = FPS * DURATION_SECONDS;

const ASSETS = Object.freeze({
  brandLogo: path.join(ROOT, "public", "images", "brand", "SeaRealm.png"),
  aquariumHall: path.join(ROOT, "public", "images", "adventure", "aquarium-grand-hall-v1.webp"),
  elversonTown: path.join(ROOT, "public", "images", "adventure", "elverson-town.png"),
  openWaterRoute: path.join(ROOT, "public", "images", "adventure", "shellshore-sunpatch-route.png"),
  trenchlightDescent: path.join(ROOT, "public", "images", "adventure", "trenchlight-sub-descent.png"),
  tidepool: path.join(ROOT, "public", "images", "adventure", "elverson-hand-net-tidepool-v2.png"),
  creatureAtlas: path.join(ROOT, "public", "images", "adventure", "elverson-reef-creature-atlas-v1.png"),
  cardStream: path.join(ROOT, "public", "images", "promo", "hero-card-stream-reef.jpg"),
  clownfish: path.join(ROOT, "public", "images", "cards", "fish", "Reef", "Clownfish.png"),
  blueTang: path.join(ROOT, "public", "images", "cards", "fish", "Reef", "blue-tang.png"),
  frenchAngelfish: path.join(ROOT, "public", "images", "cards", "fish", "Reef", "french-angelfish.png"),
  hammerhead: path.join(ROOT, "public", "images", "cards", "apex", "Reef", "hammerhead.png"),
  mantaRay: path.join(ROOT, "public", "images", "cards", "filter-feeders", "Reef", "manta-ray.png"),
});

const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));
const lerp = (start, end, amount) => start + ((end - start) * amount);
const smoothstep = (value) => {
  const t = clamp(value);
  return t * t * (3 - (2 * t));
};
const easeOutCubic = (value) => 1 - ((1 - clamp(value)) ** 3);
const easeOutBack = (value) => {
  const t = clamp(value);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + (c3 * ((t - 1) ** 3)) + (c1 * ((t - 1) ** 2));
};

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function svgBuffer(body, width, height) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`,
  );
}

async function rasterizeSvg(body, width, height) {
  return sharp(svgBuffer(body, width, height)).png().toBuffer();
}

async function prepareMaster(input, position = "center") {
  return sharp(input)
    .resize(MASTER_WIDTH, MASTER_HEIGHT, { fit: "cover", position })
    .png()
    .toBuffer();
}

function cropForCamera(scale = 1, centerX = 0.5, centerY = 0.5) {
  const safeScale = Math.max(1, scale);
  const width = Math.max(1, Math.round(MASTER_WIDTH / safeScale));
  const height = Math.max(1, Math.round(MASTER_HEIGHT / safeScale));
  const left = clamp(
    Math.round((MASTER_WIDTH * centerX) - (width / 2)),
    0,
    MASTER_WIDTH - width,
  );
  const top = clamp(
    Math.round((MASTER_HEIGHT * centerY) - (height / 2)),
    0,
    MASTER_HEIGHT - height,
  );
  return { left, top, width, height };
}

function layer(input, left, top, blend = "over") {
  return {
    input,
    left: Math.max(0, Math.round(left)),
    top: Math.max(0, Math.round(top)),
    blend,
  };
}

async function composeFrame(master, {
  scale = 1,
  centerX = 0.5,
  centerY = 0.5,
  layers = [],
  background = "#00131f",
} = {}) {
  return sharp(master)
    .extract(cropForCamera(scale, centerX, centerY))
    .resize(WIDTH, HEIGHT)
    .composite(layers)
    .flatten({ background })
    .removeAlpha()
    .raw()
    .toBuffer();
}

function textSpans(lines, {
  x,
  firstY,
  lineHeight,
  fontSize,
  fill,
  fontWeight = 900,
  letterSpacing = 0,
  anchor = "start",
  filter = "url(#shadow)",
}) {
  return lines.map((line, index) => (
    `<text x="${x}" y="${firstY + (index * lineHeight)}" text-anchor="${anchor}" font-family="Arial, Segoe UI, sans-serif" font-size="${fontSize}" font-weight="${fontWeight}" letter-spacing="${letterSpacing}" fill="${fill}" filter="${filter}">${escapeXml(line)}</text>`
  )).join("");
}

async function makeTextBlock({
  width = 760,
  height = 300,
  kicker,
  titleLines,
  subtitleLines = [],
  accent = "#5eeaf0",
  titleColor = "#ffffff",
  titleSize = 72,
  subtitleSize = 27,
  center = false,
  showAccent = true,
}) {
  const x = center ? width / 2 : 12;
  const anchor = center ? "middle" : "start";
  const kickerY = 48;
  const titleFirstY = 126;
  const titleLineHeight = titleSize * 1.07;
  const lastTitleBaseline = titleFirstY + ((titleLines.length - 1) * titleLineHeight);
  const subtitleFirstY = lastTitleBaseline + Math.max(44, subtitleSize * 1.7);
  const subtitleLineHeight = subtitleSize * 1.32;
  return rasterizeSvg(`
    <defs>
      <filter id="shadow" x="-20%" y="-30%" width="150%" height="170%">
        <feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#00131f" flood-opacity="0.92"/>
      </filter>
    </defs>
    ${showAccent ? `<rect x="${center ? (width / 2) - 46 : 12}" y="14" width="92" height="5" rx="3" fill="${accent}"/>` : ""}
    <text x="${x}" y="${kickerY}" text-anchor="${anchor}" font-family="Arial, Segoe UI, sans-serif" font-size="18" font-weight="900" letter-spacing="4.2" fill="${accent}" filter="url(#shadow)">${escapeXml(kicker)}</text>
    ${textSpans(titleLines, {
      x,
      firstY: titleFirstY,
      lineHeight: titleLineHeight,
      fontSize: titleSize,
      fill: titleColor,
      fontWeight: 950,
      letterSpacing: 1.5,
      anchor,
    })}
    ${textSpans(subtitleLines, {
      x,
      firstY: subtitleFirstY,
      lineHeight: subtitleLineHeight,
      fontSize: subtitleSize,
      fill: "#e5fbff",
      fontWeight: 700,
      letterSpacing: 0,
      anchor,
    })}
  `, width, height);
}

async function makeBadge(text, {
  width = 360,
  height = 54,
  fill = "#0a5668",
  stroke = "#6ef3f2",
  textColor = "#ffffff",
  fontSize = 21,
} = {}) {
  return rasterizeSvg(`
    <defs>
      <filter id="badgeShadow" x="-20%" y="-30%" width="140%" height="180%">
        <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#00131f" flood-opacity="0.8"/>
      </filter>
    </defs>
    <rect x="5" y="5" width="${width - 10}" height="${height - 10}" rx="${height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="2" filter="url(#badgeShadow)"/>
    <text x="${width / 2}" y="${(height / 2) + (fontSize * 0.34)}" text-anchor="middle" font-family="Arial, Segoe UI, sans-serif" font-size="${fontSize}" font-weight="900" letter-spacing="1.5" fill="${textColor}">${escapeXml(text)}</text>
  `, width, height);
}

async function makeBrandLogo(width = 820) {
  const resized = await sharp(ASSETS.brandLogo).resize({ width }).png().toBuffer();
  const metadata = await sharp(resized).metadata();
  const padding = 42;
  return rasterizeSvg(`
    <defs>
      <filter id="brandShadow" x="-20%" y="-45%" width="140%" height="210%">
        <feDropShadow dx="0" dy="10" stdDeviation="11" flood-color="#00121d" flood-opacity="0.96"/>
        <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#61eff0" flood-opacity="0.28"/>
      </filter>
    </defs>
    <image href="data:image/png;base64,${resized.toString("base64")}" x="${padding}" y="${padding}" width="${metadata.width}" height="${metadata.height}" filter="url(#brandShadow)"/>
  `, metadata.width + (padding * 2), metadata.height + (padding * 2));
}

async function makeShadowedCard(cardPath, { height = 310, angle = 0 } = {}) {
  const resized = await sharp(cardPath).resize({ height }).png().toBuffer();
  const metadata = await sharp(resized).metadata();
  const padding = 34;
  const canvasWidth = metadata.width + (padding * 2);
  const canvasHeight = metadata.height + (padding * 2);
  const embedded = resized.toString("base64");
  const rendered = await rasterizeSvg(`
    <defs>
      <filter id="cardShadow" x="-30%" y="-30%" width="180%" height="190%">
        <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#001018" flood-opacity="0.85"/>
      </filter>
    </defs>
    <image href="data:image/png;base64,${embedded}" x="${padding}" y="${padding}" width="${metadata.width}" height="${metadata.height}" filter="url(#cardShadow)"/>
  `, canvasWidth, canvasHeight);
  const buffer = angle === 0
    ? rendered
    : await sharp(rendered).rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const finalMetadata = await sharp(buffer).metadata();
  return { buffer, width: finalMetadata.width, height: finalMetadata.height };
}

async function makePremiumCard(cardPath) {
  const card = await sharp(cardPath).resize({ height: 390 }).png().toBuffer();
  const cardMetadata = await sharp(card).metadata();
  const width = cardMetadata.width + 42;
  const height = cardMetadata.height + 94;
  return {
    buffer: await rasterizeSvg(`
      <defs>
        <linearGradient id="foil" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff4a8"/>
          <stop offset="0.24" stop-color="#63f1ef"/>
          <stop offset="0.5" stop-color="#ffffff"/>
          <stop offset="0.72" stop-color="#d092ff"/>
          <stop offset="1" stop-color="#ffd04d"/>
        </linearGradient>
        <filter id="premiumShadow" x="-30%" y="-20%" width="170%" height="180%">
          <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#001018" flood-opacity="0.92"/>
        </filter>
      </defs>
      <rect x="10" y="10" width="${width - 20}" height="${height - 20}" rx="26" fill="#062737" stroke="url(#foil)" stroke-width="8" filter="url(#premiumShadow)"/>
      <image href="data:image/png;base64,${card.toString("base64")}" x="21" y="25" width="${cardMetadata.width}" height="${cardMetadata.height}"/>
      <rect x="24" y="${height - 62}" width="${width - 48}" height="40" rx="20" fill="url(#foil)"/>
      <text x="${width / 2}" y="${height - 34}" text-anchor="middle" font-family="Arial, Segoe UI, sans-serif" font-size="18" font-weight="1000" letter-spacing="2" fill="#062737">EXCLUSIVE DROP</text>
    `, width, height),
    width,
    height,
  };
}

async function makeAtlasSprite(column, row, width) {
  const metadata = await sharp(ASSETS.creatureAtlas).metadata();
  const left = Math.round((column * metadata.width) / 5);
  const right = Math.round(((column + 1) * metadata.width) / 5);
  const top = Math.round((row * metadata.height) / 2);
  const bottom = Math.round(((row + 1) * metadata.height) / 2);
  const cell = await sharp(ASSETS.creatureAtlas)
    .extract({ left, top, width: right - left, height: bottom - top })
    .png()
    .toBuffer();
  const buffer = await sharp(cell)
    .trim()
    .resize({ width })
    .png()
    .toBuffer();
  const output = await sharp(buffer).metadata();
  return { buffer, width: output.width, height: output.height };
}

function transitionLayers(time, flashOverlay) {
  const boundaries = [3, 7.2, 12, 16.2, 21.2, 27.4];
  return boundaries.some((boundary) => Math.abs(time - boundary) <= 0.055)
    ? [layer(flashOverlay, 0, 0, "screen")]
    : [];
}

function seededRandom(seed = 0x5ea5a1) {
  let state = seed >>> 0;
  return () => {
    state = ((state * 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function makeOriginalScore(destination) {
  const sampleRate = 48000;
  const sampleCount = Math.ceil(DURATION_SECONDS * sampleRate);
  const left = new Float32Array(sampleCount);
  const right = new Float32Array(sampleCount);
  const random = seededRandom();

  function mixSample(index, value, pan = 0) {
    if (index < 0 || index >= sampleCount) return;
    const leftGain = Math.sqrt((1 - clamp(pan, -1, 1)) / 2);
    const rightGain = Math.sqrt((1 + clamp(pan, -1, 1)) / 2);
    left[index] += value * leftGain;
    right[index] += value * rightGain;
  }

  function addTone(start, duration, frequency, amplitude, {
    pan = 0,
    wave = "sine",
    attack = 0.012,
    release = 0.18,
    detune = 0,
  } = {}) {
    const first = Math.floor(start * sampleRate);
    const length = Math.max(1, Math.floor(duration * sampleRate));
    for (let offset = 0; offset < length; offset += 1) {
      const seconds = offset / sampleRate;
      const progress = offset / length;
      const attackEnvelope = Math.min(1, seconds / Math.max(attack, 0.001));
      const releaseEnvelope = Math.min(1, (duration - seconds) / Math.max(release, 0.001));
      const envelope = Math.max(0, Math.min(attackEnvelope, releaseEnvelope)) ** 1.35;
      const phase = Math.PI * 2 * frequency * (1 + detune) * seconds;
      let oscillator = Math.sin(phase);
      if (wave === "triangle") oscillator = (2 / Math.PI) * Math.asin(Math.sin(phase));
      if (wave === "soft-square") oscillator = Math.tanh(Math.sin(phase) * 2.4) * 0.72;
      const shimmer = wave === "bell"
        ? (Math.sin(phase) * 0.67) + (Math.sin(phase * 2.01) * 0.23) + (Math.sin(phase * 3.98) * 0.1)
        : oscillator;
      mixSample(first + offset, shimmer * amplitude * envelope, pan);
      if (wave === "bell" && progress < 0.72) {
        mixSample(first + offset, Math.sin(phase * 0.5) * amplitude * envelope * 0.08, -pan);
      }
    }
  }

  function addNoise(start, duration, amplitude, pan = 0, rising = false) {
    const first = Math.floor(start * sampleRate);
    const length = Math.max(1, Math.floor(duration * sampleRate));
    let previous = 0;
    for (let offset = 0; offset < length; offset += 1) {
      const progress = offset / length;
      const raw = (random() * 2) - 1;
      previous = (previous * 0.76) + (raw * 0.24);
      const envelope = rising
        ? smoothstep(progress) * (1 - smoothstep((progress - 0.78) / 0.22))
        : Math.sin(Math.PI * progress) ** 1.8;
      mixSample(first + offset, previous * amplitude * envelope, pan);
    }
  }

  function addKick(start, amplitude = 0.16) {
    const duration = 0.24;
    const first = Math.floor(start * sampleRate);
    const length = Math.floor(duration * sampleRate);
    let phase = 0;
    for (let offset = 0; offset < length; offset += 1) {
      const progress = offset / length;
      const frequency = lerp(118, 46, smoothstep(progress));
      phase += (Math.PI * 2 * frequency) / sampleRate;
      const envelope = ((1 - progress) ** 3.5) * Math.min(1, progress * 42);
      mixSample(first + offset, Math.sin(phase) * amplitude * envelope, 0);
    }
  }

  const chordRoots = [130.81, 174.61, 220, 196];
  const chordIntervals = [1, 1.259921, 1.498307];
  for (let start = 0; start < DURATION_SECONDS; start += 2) {
    const root = chordRoots[Math.floor(start / 2) % chordRoots.length];
    chordIntervals.forEach((ratio, index) => {
      addTone(start, 2.16, root * ratio, 0.018, {
        pan: (index - 1) * 0.34,
        wave: "sine",
        attack: 0.38,
        release: 0.62,
        detune: index === 1 ? 0.0017 : -0.0011,
      });
    });
  }

  const arpeggio = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46];
  for (let beat = 0; beat < DURATION_SECONDS * 4; beat += 1) {
    const start = beat * 0.25;
    const sectionLift = start >= 21.2 ? 1.12246 : 1;
    addTone(start, 0.22, arpeggio[beat % arpeggio.length] * sectionLift, 0.048, {
      pan: ((beat % 4) - 1.5) * 0.18,
      wave: "bell",
      attack: 0.004,
      release: 0.16,
    });
    addNoise(start + 0.02, 0.07, beat % 4 === 0 ? 0.018 : 0.011, beat % 2 ? 0.5 : -0.5);
  }

  for (let beat = 0; beat < DURATION_SECONDS * 2; beat += 1) {
    const start = beat * 0.5;
    const root = chordRoots[Math.floor(start / 2) % chordRoots.length] / 2;
    addTone(start, 0.38, root, 0.07, {
      pan: 0,
      wave: "triangle",
      attack: 0.01,
      release: 0.22,
    });
    if (beat % 2 === 0) addKick(start, start >= 21.2 ? 0.2 : 0.15);
  }

  [3, 7.2, 12, 16.2, 21.2, 24.1, 27.4].forEach((time, index) => {
    addNoise(time - 0.28, 0.42, 0.08, index % 2 ? 0.55 : -0.55, true);
    addTone(time, 0.7, index >= 4 ? 1046.5 : 783.99, 0.09, {
      pan: index % 2 ? -0.28 : 0.28,
      wave: "bell",
      attack: 0.003,
      release: 0.62,
    });
  });

  [7.8, 8.22, 8.64, 17.7, 18.55, 19.35].forEach((time, index) => {
    addTone(time, 0.26, [987.77, 1174.66, 1318.51][index % 3], 0.085, {
      pan: (index % 3) * 0.35 - 0.35,
      wave: "bell",
      attack: 0.002,
      release: 0.22,
    });
  });

  [21.52, 21.7, 21.92, 27.58, 27.82, 28.06].forEach((time, index) => {
    addTone(time, 1.15, [523.25, 659.25, 783.99][index % 3] * (index >= 3 ? 2 : 1), 0.07, {
      pan: ((index % 3) - 1) * 0.38,
      wave: "bell",
      attack: 0.005,
      release: 0.95,
    });
  });

  addNoise(0, DURATION_SECONDS, 0.007, 0, false);

  let peak = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]));
  }
  const gain = peak > 0 ? 0.9 / peak : 1;
  const dataSize = sampleCount * 4;
  const wav = Buffer.allocUnsafe(44 + dataSize);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 4, 28);
  wav.writeUInt16LE(4, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    const leftValue = Math.tanh(left[index] * gain * 1.15) / Math.tanh(1.15);
    const rightValue = Math.tanh(right[index] * gain * 1.15) / Math.tanh(1.15);
    wav.writeInt16LE(Math.round(clamp(leftValue, -1, 1) * 32767), 44 + (index * 4));
    wav.writeInt16LE(Math.round(clamp(rightValue, -1, 1) * 32767), 46 + (index * 4));
  }
  return writeFile(destination, wav);
}

async function prepareAssets() {
  const aquariumFrameNames = (await readdir(CAPTURE_DIR))
    .filter((name) => /^aquarium-\d{3}\.png$/i.test(name))
    .sort();
  if (aquariumFrameNames.length < 24) {
    throw new Error(`Expected at least 24 aquarium capture frames, found ${aquariumFrameNames.length}.`);
  }

  const [
    brandLogo,
    introMaster,
    elversonMaster,
    routeMaster,
    trenchlightMaster,
    tidepoolMaster,
    deckReadyMaster,
    deckOpenMaster,
    deckCustomizedMaster,
    aquariumFrames,
  ] = await Promise.all([
    makeBrandLogo(820),
    prepareMaster(ASSETS.aquariumHall),
    prepareMaster(ASSETS.elversonTown),
    prepareMaster(ASSETS.openWaterRoute),
    prepareMaster(ASSETS.trenchlightDescent),
    prepareMaster(ASSETS.tidepool),
    prepareMaster(path.join(CAPTURE_DIR, "deck-00-ready.png")),
    prepareMaster(path.join(CAPTURE_DIR, "deck-01-slot-open.png")),
    prepareMaster(path.join(CAPTURE_DIR, "deck-02-customized.png")),
    Promise.all(aquariumFrameNames.map((name) => prepareMaster(path.join(CAPTURE_DIR, name)))),
  ]);

  const [
    introTagline,
    exploreBlock,
    collectBlock,
    aquariumBlock,
    createBlock,
    dropBlock,
    printBlock,
    finalTagline,
    triadBadge,
    matchingBadge,
    readyBadge,
    elversonBadge,
    openWaterBadge,
    deepBadge,
    clownfishCard,
    blueTangCard,
    frenchCard,
    hammerheadCard,
    mantaCard,
    premiumCard,
    whiteGruntSprite,
    clownfishSprite,
    blueTangSprite,
  ] = await Promise.all([
    makeTextBlock({
      width: 780,
      height: 160,
      kicker: "YOUR OCEAN ADVENTURE",
      titleLines: ["STARTS HERE"],
      subtitleLines: [],
      accent: "#ffd453",
      titleSize: 46,
      center: true,
    }),
    makeTextBlock({
      kicker: "SEA REALM",
      titleLines: ["EXPLORE"],
      subtitleLines: ["Coastal towns. Living reefs.", "Deep-sea mysteries."],
      accent: "#75f0eb",
    }),
    makeTextBlock({
      kicker: "DISCOVER THE OCEAN",
      titleLines: ["COLLECT"],
      subtitleLines: ["Discover creatures.", "Earn their matching cards."],
      accent: "#ffd453",
    }),
    makeTextBlock({
      width: 1040,
      height: 245,
      kicker: "DELIVER YOUR CREATURES",
      titleLines: ["WATCH THE REEF GALLERY", "COME ALIVE"],
      subtitleLines: ["See each delivery join the aquarium—and earn its matching card."],
      accent: "#73f3ef",
      titleSize: 52,
      subtitleSize: 23,
    }),
    makeTextBlock({
      width: 830,
      height: 185,
      kicker: "YOUR CARDS. YOUR STRATEGY.",
      titleLines: ["CREATE"],
      subtitleLines: ["Build custom decks from the cards you own."],
      accent: "#ffd453",
      titleSize: 62,
      subtitleSize: 25,
    }),
    makeTextBlock({
      width: 760,
      height: 305,
      kicker: "FUTURE DROPS",
      titleLines: ["EXCLUSIVE CREATURE", "+ CARD DROPS"],
      subtitleLines: ["Playable in Sea Realm—and planned", "for premium custom deck printing."],
      accent: "#ffd453",
      titleSize: 50,
      subtitleSize: 23,
    }),
    makeTextBlock({
      width: 1160,
      height: 225,
      kicker: "FROM SCREEN TO TABLE",
      titleLines: ["BUILD IT IN-GAME.", "ORDER IT AS REAL CARDS."],
      subtitleLines: ["Ask a grown-up to order your custom deck."],
      accent: "#75f0eb",
      titleSize: 38,
      subtitleSize: 23,
      center: true,
      showAccent: false,
    }),
    makeTextBlock({
      width: 820,
      height: 145,
      kicker: "YOUR REEF. YOUR DECK.",
      titleLines: ["YOUR ADVENTURE."],
      subtitleLines: [],
      accent: "#ffd453",
      titleSize: 48,
      center: true,
    }),
    makeBadge("COLLECT  •  CREATE  •  EXPLORE", { width: 560, height: 62, fill: "#063b4d" }),
    makeBadge("MATCHING CARDS EARNED", { width: 380, height: 56, fill: "#795810", stroke: "#ffd453" }),
    makeBadge("60 / 60  •  LEGAL  •  READY TO PLAY", { width: 480, height: 58, fill: "#075b5a" }),
    makeBadge("ELVERSON", { width: 220, height: 50 }),
    makeBadge("OPEN WATER", { width: 250, height: 50 }),
    makeBadge("THE DEEP", { width: 220, height: 50, fill: "#281e60", stroke: "#b8a9ff" }),
    makeShadowedCard(ASSETS.clownfish, { height: 300, angle: -9 }),
    makeShadowedCard(ASSETS.blueTang, { height: 320, angle: 0 }),
    makeShadowedCard(ASSETS.frenchAngelfish, { height: 300, angle: 9 }),
    makeShadowedCard(ASSETS.hammerhead, { height: 330, angle: -7 }),
    makeShadowedCard(ASSETS.mantaRay, { height: 330, angle: 7 }),
    makePremiumCard(ASSETS.hammerhead),
    makeAtlasSprite(0, 0, 155),
    makeAtlasSprite(2, 0, 115),
    makeAtlasSprite(4, 0, 150),
  ]);

  const [leftShade, bottomShade, vignette, flashOverlay, comingSoonBanner, finalComingSoonBanner, futureMaster] = await Promise.all([
    rasterizeSvg(`
      <defs><linearGradient id="left" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#00131f" stop-opacity="0.92"/><stop offset="0.52" stop-color="#00131f" stop-opacity="0.58"/><stop offset="1" stop-color="#00131f" stop-opacity="0"/></linearGradient></defs>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#left)"/>
    `, WIDTH, HEIGHT),
    rasterizeSvg(`
      <defs><linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00131f" stop-opacity="0"/><stop offset="0.56" stop-color="#00131f" stop-opacity="0.28"/><stop offset="1" stop-color="#00131f" stop-opacity="0.94"/></linearGradient></defs>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bottom)"/>
    `, WIDTH, HEIGHT),
    rasterizeSvg(`
      <defs><radialGradient id="vignette" cx="50%" cy="45%" r="72%"><stop offset="0.48" stop-color="#00131f" stop-opacity="0"/><stop offset="1" stop-color="#00131f" stop-opacity="0.72"/></radialGradient></defs>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#vignette)"/>
    `, WIDTH, HEIGHT),
    rasterizeSvg(`<rect width="${WIDTH}" height="${HEIGHT}" fill="#73f3ef" opacity="0.52"/>`, WIDTH, HEIGHT),
    rasterizeSvg(`
      <defs><linearGradient id="soon" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffd24d"/><stop offset="0.5" stop-color="#fff3a4"/><stop offset="1" stop-color="#ffd24d"/></linearGradient></defs>
      <rect width="${WIDTH}" height="70" fill="url(#soon)"/>
      <text x="${WIDTH / 2}" y="47" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="30" font-weight="1000" letter-spacing="7" fill="#063244">COMING SOON</text>
    `, WIDTH, 70),
    rasterizeSvg(`
      <rect width="${WIDTH}" height="58" fill="#ffd24d"/>
      <text x="${WIDTH / 2}" y="39" text-anchor="middle" font-family="Arial, Segoe UI, sans-serif" font-size="23" font-weight="1000" letter-spacing="2" fill="#063244">CUSTOM DECK ORDERS + PREMIUM DROPS  —  COMING SOON</text>
    `, WIDTH, 58),
    prepareMaster(svgBuffer(`
      <defs>
        <linearGradient id="futureBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#041729"/><stop offset="0.5" stop-color="#063e56"/><stop offset="1" stop-color="#220e4b"/></linearGradient>
        <linearGradient id="futureSoon" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffd24d"/><stop offset="0.5" stop-color="#fff3a4"/><stop offset="1" stop-color="#ffd24d"/></linearGradient>
        <radialGradient id="futureGlow" cx="72%" cy="48%" r="48%"><stop offset="0" stop-color="#55f4ef" stop-opacity="0.48"/><stop offset="0.48" stop-color="#7a5cff" stop-opacity="0.19"/><stop offset="1" stop-color="#00131f" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="${MASTER_WIDTH}" height="${MASTER_HEIGHT}" fill="url(#futureBg)"/>
      <rect width="${MASTER_WIDTH}" height="${MASTER_HEIGHT}" fill="url(#futureGlow)"/>
      ${Array.from({ length: 34 }, (_, index) => {
        const x = (index * 193) % MASTER_WIDTH;
        const y = 90 + ((index * 127) % 740);
        const radius = 3 + (index % 5);
        return `<circle cx="${x}" cy="${y}" r="${radius}" fill="#8ef8f2" opacity="${0.18 + ((index % 4) * 0.08)}"/>`;
      }).join("")}
      <path d="M-80 730 C340 520 420 820 840 620 S1430 520 1700 700" fill="none" stroke="#68efeb" stroke-width="3" opacity="0.18"/>
      <path d="M-60 770 C300 610 520 850 890 680 S1420 610 1700 760" fill="none" stroke="#ffd453" stroke-width="2" opacity="0.14"/>
      <rect width="${MASTER_WIDTH}" height="88" fill="url(#futureSoon)"/>
      <text x="${MASTER_WIDTH / 2}" y="59" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="38" font-weight="1000" letter-spacing="9" fill="#063244">COMING SOON</text>
    `, MASTER_WIDTH, MASTER_HEIGHT)),
  ]);

  const streamBuffer = await sharp(ASSETS.cardStream).resize({ height: 116 }).png().toBuffer();
  const streamMetadata = await sharp(streamBuffer).metadata();

  const screenCrop = await sharp(deckCustomizedMaster)
    .extract({ left: 72, top: 26, width: 1420, height: 798 })
    .resize(520, 292, { fit: "cover" })
    .png()
    .toBuffer();
  const deckScreen = await rasterizeSvg(`
    <defs><filter id="screenShadow" x="-20%" y="-20%" width="150%" height="170%"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#000b14" flood-opacity="0.9"/></filter></defs>
    <rect x="10" y="10" width="540" height="332" rx="22" fill="#052536" stroke="#67efeb" stroke-width="4" filter="url(#screenShadow)"/>
    <image href="data:image/png;base64,${screenCrop.toString("base64")}" x="20" y="20" width="520" height="292"/>
    <text x="280" y="333" text-anchor="middle" font-family="Arial, Segoe UI, sans-serif" font-size="18" font-weight="900" letter-spacing="2" fill="#dffcff">IN-GAME CUSTOM DECK</text>
  `, 560, 352);

  const arrow = await rasterizeSvg(`
    <defs><linearGradient id="arrow" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#66efec"/><stop offset="1" stop-color="#ffd453"/></linearGradient></defs>
    <path d="M8 42 H116 V16 L158 54 L116 92 V66 H8 Z" fill="url(#arrow)" stroke="#ffffff" stroke-opacity="0.62" stroke-width="2"/>
  `, 170, 108);
  const premiumOrdersBadge = await makeBadge("PREMIUM CARDS IN CUSTOM DECK ORDERS", {
    width: 530,
    height: 50,
    fill: "#6a4b0a",
    stroke: "#ffd453",
    fontSize: 18,
  });

  return {
    aquariumFrames,
    deckReadyMaster,
    deckOpenMaster,
    deckCustomizedMaster,
    introMaster,
    elversonMaster,
    routeMaster,
    trenchlightMaster,
    tidepoolMaster,
    futureMaster,
    brandLogo,
    introTagline,
    exploreBlock,
    collectBlock,
    aquariumBlock,
    createBlock,
    dropBlock,
    printBlock,
    finalTagline,
    triadBadge,
    matchingBadge,
    readyBadge,
    elversonBadge,
    openWaterBadge,
    deepBadge,
    clownfishCard,
    blueTangCard,
    frenchCard,
    hammerheadCard,
    mantaCard,
    premiumCard,
    whiteGruntSprite,
    clownfishSprite,
    blueTangSprite,
    leftShade,
    bottomShade,
    vignette,
    flashOverlay,
    comingSoonBanner,
    finalComingSoonBanner,
    streamBuffer,
    streamWidth: streamMetadata.width,
    deckScreen,
    arrow,
    premiumOrdersBadge,
  };
}

async function streamWindow(assets, offset) {
  const maximumLeft = Math.max(0, assets.streamWidth - WIDTH);
  const left = clamp(Math.round(offset), 0, maximumLeft);
  return sharp(assets.streamBuffer)
    .extract({ left, top: 0, width: WIDTH, height: 116 })
    .png()
    .toBuffer();
}

function cardPosition(startTime, local, finalX, finalY) {
  const progress = easeOutBack((local - startTime) / 0.62);
  return {
    x: lerp(WIDTH + 80, finalX, progress),
    y: finalY - (Math.sin(progress * Math.PI) * 34),
    visible: local >= startTime,
  };
}

async function renderIntro(time, assets) {
  const local = time;
  const progress = smoothstep(local / 3);
  const stream = await streamWindow(assets, 130 + (local * 82));
  const layers = [
    layer(assets.vignette, 0, 0),
    layer(stream, 0, 604),
    layer(assets.bottomShade, 0, 0),
  ];
  if (local >= 0.22) {
    layers.push(layer(assets.brandLogo, 188, 78 + Math.round((1 - easeOutCubic((local - 0.22) / 0.7)) * 28)));
  }
  if (local >= 0.72) layers.push(layer(assets.introTagline, 250, 326));
  if (local >= 1.28) layers.push(layer(assets.triadBadge, 360, 492));
  layers.push(...transitionLayers(time, assets.flashOverlay));
  return composeFrame(assets.introMaster, {
    scale: 1 + (progress * 0.08),
    centerX: 0.5,
    centerY: 0.42,
    layers,
  });
}

async function renderExplore(time, assets) {
  const local = time - 3;
  const segment = Math.min(2, Math.floor(local / 1.4));
  const segmentProgress = (local - (segment * 1.4)) / 1.4;
  const masters = [assets.elversonMaster, assets.routeMaster, assets.trenchlightMaster];
  const badges = [assets.elversonBadge, assets.openWaterBadge, assets.deepBadge];
  const badgeWidths = [220, 250, 220];
  const centers = [
    { x: 0.48, y: 0.5 },
    { x: 0.52, y: 0.48 },
    { x: 0.5, y: 0.52 },
  ];
  const layers = [
    layer(assets.leftShade, 0, 0),
    layer(assets.vignette, 0, 0),
    layer(assets.exploreBlock, 62, 108),
    layer(badges[segment], WIDTH - badgeWidths[segment] - 48, 624),
    ...transitionLayers(time, assets.flashOverlay),
  ];
  return composeFrame(masters[segment], {
    scale: 1.04 + (segmentProgress * 0.08),
    centerX: centers[segment].x + ((segment - 1) * segmentProgress * 0.015),
    centerY: centers[segment].y,
    layers,
  });
}

async function renderCollect(time, assets) {
  const local = time - 7.2;
  const progress = smoothstep(local / 4.8);
  const layers = [
    layer(assets.leftShade, 0, 0),
    layer(assets.vignette, 0, 0),
    layer(assets.collectBlock, 55, 112),
  ];

  const fishTracks = [
    { sprite: assets.whiteGruntSprite, start: 0.1, y: 134, speed: 82, wobble: 18 },
    { sprite: assets.clownfishSprite, start: 0.35, y: 446, speed: 94, wobble: 12 },
    { sprite: assets.blueTangSprite, start: 0.58, y: 306, speed: 76, wobble: 22 },
  ];
  fishTracks.forEach(({ sprite, start, y, speed, wobble }, index) => {
    if (local < start) return;
    const x = 560 + (((local - start) * speed) % 590);
    const top = y + (Math.sin((local * 2.2) + index) * wobble);
    layers.push(layer(sprite.buffer, x, top));
  });

  const cardSpecs = [
    { card: assets.clownfishCard, start: 0.58, x: 728, y: 220 },
    { card: assets.blueTangCard, start: 1.0, x: 892, y: 180 },
    { card: assets.frenchCard, start: 1.42, x: 1050, y: 218 },
  ];
  cardSpecs.forEach(({ card, start, x, y }) => {
    const position = cardPosition(start, local, x, y);
    if (position.visible && position.x < WIDTH) {
      layers.push(layer(card.buffer, position.x, position.y));
    }
  });
  if (local >= 2.25) layers.push(layer(assets.matchingBadge, 802, 594));
  layers.push(...transitionLayers(time, assets.flashOverlay));
  return composeFrame(assets.tidepoolMaster, {
    scale: 1.04 + (progress * 0.12),
    centerX: 0.47,
    centerY: 0.49,
    layers,
  });
}

async function renderAquarium(time, assets) {
  const local = time - 12;
  const progress = smoothstep(local / 4.2);
  const aquariumIndex = Math.floor(local * 12) % assets.aquariumFrames.length;
  const layers = [
    layer(assets.bottomShade, 0, 0),
    layer(assets.vignette, 0, 0),
  ];
  if (local >= 0.25) layers.push(layer(assets.aquariumBlock, 52, 376));
  layers.push(...transitionLayers(time, assets.flashOverlay));
  return composeFrame(assets.aquariumFrames[aquariumIndex], {
    scale: 1.02 + (progress * 0.42),
    centerX: lerp(0.5, 0.27, progress),
    centerY: lerp(0.45, 0.38, progress),
    layers,
  });
}

async function renderCreate(time, assets) {
  const local = time - 16.2;
  const stage = local < 1.65 ? 0 : local < 2.75 ? 1 : 2;
  const masters = [assets.deckReadyMaster, assets.deckOpenMaster, assets.deckCustomizedMaster];
  const progress = smoothstep(local / 5);
  const layers = [
    layer(assets.bottomShade, 0, 0),
    layer(assets.vignette, 0, 0),
  ];
  if (local >= 0.18) layers.push(layer(assets.createBlock, 54, 414));
  if (stage === 2 && local >= 3.15) layers.push(layer(assets.readyBadge, 754, 78));
  if (local >= 2.08 && local <= 3.48) {
    const cardProgress = easeOutBack((local - 2.08) / 0.72);
    const x = lerp(1215, 980, cardProgress);
    const y = lerp(108, 316, smoothstep((local - 2.08) / 1.4));
    layers.push(layer(assets.clownfishCard.buffer, x, y));
  }
  layers.push(...transitionLayers(time, assets.flashOverlay));
  return composeFrame(masters[stage], {
    scale: 1.14 + (progress * 0.24),
    centerX: lerp(0.43, 0.62, progress),
    centerY: lerp(0.5, 0.6, progress),
    layers,
  });
}

async function renderFuture(time, assets) {
  const local = time - 21.2;
  const firstBeat = local < 2.9;
  const layers = [
    layer(assets.vignette, 0, 0),
  ];

  if (firstBeat) {
    const entrance = easeOutBack((local - 0.12) / 0.75);
    if (local >= 0.12) {
      const glowSize = 430 + Math.round(Math.sin(local * 4.4) * 18);
      const glow = svgBuffer(`
        <defs><radialGradient id="premiumGlow"><stop offset="0" stop-color="#fff7a6" stop-opacity="0.72"/><stop offset="0.38" stop-color="#5ef3ee" stop-opacity="0.32"/><stop offset="1" stop-color="#5ef3ee" stop-opacity="0"/></radialGradient></defs>
        <circle cx="${glowSize / 2}" cy="${glowSize / 2}" r="${glowSize / 2}" fill="url(#premiumGlow)"/>
      `, glowSize, glowSize);
      layers.push(layer(glow, 790, 142, "screen"));
      layers.push(layer(assets.hammerheadCard.buffer, 812, 197));
      layers.push(layer(assets.mantaCard.buffer, 1000, 214));
      layers.push(layer(assets.premiumCard.buffer, lerp(1200, 913, entrance), lerp(560, 124, entrance)));
    }
    if (local >= 0.2) layers.push(layer(assets.dropBlock, 52, 150));
  } else {
    const entrance = easeOutCubic((local - 2.9) / 0.55);
    layers.push(layer(assets.deckScreen, lerp(32, 82, entrance), 78));
    layers.push(layer(assets.arrow, 630, 210));
    layers.push(layer(assets.frenchCard.buffer, 820, 50));
    layers.push(layer(assets.clownfishCard.buffer, 900, 42));
    layers.push(layer(assets.premiumCard.buffer, 965, 14));
    layers.push(layer(assets.printBlock, 60, 415));
    layers.push(layer(assets.premiumOrdersBadge, 684, 661));
  }
  layers.push(...transitionLayers(time, assets.flashOverlay));
  return composeFrame(assets.futureMaster, {
    scale: 1.02,
    centerX: 0.5,
    centerY: 0.5,
    layers,
  });
}

async function renderFinal(time, assets) {
  const local = time - 27.4;
  const progress = smoothstep(local / 2.6);
  const stream = await streamWindow(assets, 510 + (local * 110));
  const layers = [
    layer(assets.vignette, 0, 0),
    layer(assets.bottomShade, 0, 0),
    layer(assets.brandLogo, 188, 72),
    layer(assets.finalTagline, 230, 312),
    layer(assets.triadBadge, 360, 474),
    layer(stream, 0, 546),
    layer(assets.finalComingSoonBanner, 0, 662),
  ];
  layers.push(...transitionLayers(time, assets.flashOverlay));
  return composeFrame(assets.introMaster, {
    scale: 1.08 + (progress * 0.05),
    centerX: 0.5,
    centerY: 0.43,
    layers,
  });
}

async function renderFrame(time, assets) {
  if (time < 3) return renderIntro(time, assets);
  if (time < 7.2) return renderExplore(time, assets);
  if (time < 12) return renderCollect(time, assets);
  if (time < 16.2) return renderAquarium(time, assets);
  if (time < 21.2) return renderCreate(time, assets);
  if (time < 27.4) return renderFuture(time, assets);
  return renderFinal(time, assets);
}

async function encodeVideo(assets) {
  const args = [
    "-y",
    "-f", "rawvideo",
    "-pix_fmt", "rgb24",
    "-s:v", `${WIDTH}x${HEIGHT}`,
    "-r", String(FPS),
    "-i", "pipe:0",
    "-i", AUDIO_PATH,
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-color_primaries", "bt709",
    "-color_trc", "bt709",
    "-colorspace", "bt709",
    "-c:a", "aac",
    "-b:a", "192k",
    "-movflags", "+faststart",
    "-metadata", "title=Sea Realm — Collect, Create, Explore",
    "-metadata", "comment=Original motion graphics and score created from Sea Realm game assets.",
    "-shortest",
    OUTPUT_PATH,
  ];

  const ffmpeg = spawn(FFMPEG_PATH, args, { stdio: ["pipe", "inherit", "inherit"] });
  const exitPromise = new Promise((resolve, reject) => {
    ffmpeg.once("error", reject);
    ffmpeg.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}.`));
    });
  });

  const contactTimes = [1.45, 4.15, 8.95, 13.75, 18.8, 22.25, 25.45, 28.55];
  const contactFrames = new Map();
  for (let frameIndex = 0; frameIndex < TOTAL_FRAMES; frameIndex += 1) {
    const time = frameIndex / FPS;
    const frame = await renderFrame(time, assets);
    const contactIndex = contactTimes.findIndex((contactTime) => (
      Math.abs(frameIndex - Math.round(contactTime * FPS)) === 0
    ));
    if (contactIndex >= 0) contactFrames.set(contactIndex, Buffer.from(frame));
    if (!ffmpeg.stdin.write(frame)) await once(ffmpeg.stdin, "drain");
    if (frameIndex % 90 === 0) {
      console.log(`Rendered ${frameIndex}/${TOTAL_FRAMES} frames (${time.toFixed(1)}s).`);
    }
  }
  ffmpeg.stdin.end();
  await exitPromise;

  const posterRaw = await renderFrame(28.55, assets);
  await sharp(posterRaw, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toFile(POSTER_PATH);

  const thumbs = await Promise.all(Array.from({ length: 8 }, async (_, index) => {
    const raw = contactFrames.get(index);
    if (!raw) throw new Error(`Missing contact-sheet frame ${index}.`);
    return sharp(raw, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } })
      .resize(320, 180)
      .jpeg({ quality: 88 })
      .toBuffer();
  }));
  await sharp({
    create: {
      width: 1280,
      height: 360,
      channels: 3,
      background: "#00131f",
    },
  }).composite(thumbs.map((input, index) => ({
    input,
    left: (index % 4) * 320,
    top: Math.floor(index / 4) * 180,
  }))).jpeg({ quality: 90 }).toFile(CONTACT_SHEET_PATH);
}

async function main() {
  await Promise.all([
    access(FFMPEG_PATH),
    mkdir(WORK_DIR, { recursive: true }),
    mkdir(VIDEO_DIR, { recursive: true }),
    mkdir(POSTER_DIR, { recursive: true }),
  ]);
  console.log("Preparing Sea Realm trailer assets…");
  const assets = await prepareAssets();
  console.log("Writing original soundtrack…");
  await makeOriginalScore(AUDIO_PATH);
  console.log("Rendering 30-second trailer…");
  await encodeVideo(assets);
  console.log(`Video: ${OUTPUT_PATH}`);
  console.log(`Poster: ${POSTER_PATH}`);
  console.log(`Contact sheet: ${CONTACT_SHEET_PATH}`);
}

await main();
