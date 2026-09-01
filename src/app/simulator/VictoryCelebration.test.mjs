import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentSource = await readFile(new URL("./VictoryCelebration.jsx", import.meta.url), "utf8");
const styleSource = await readFile(new URL("./VictoryCelebration.module.css", import.meta.url), "utf8");
const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

test("victory celebration is a focused accessible dialog with an action slot", () => {
  assert.match(componentSource, /data-victory-celebration/);
  assert.match(componentSource, /role="dialog"/);
  assert.match(componentSource, /aria-modal="true"/);
  assert.match(componentSource, /aria-labelledby=\{titleId\}/);
  assert.match(componentSource, /aria-describedby=\{descriptionId\}/);
  assert.match(componentSource, /data-victory-primary-action/);
  assert.match(componentSource, /actions\s*\?\?\s*children/);
  assert.match(componentSource, /data-victory-actions/);
  assert.match(componentSource, /keepFocusInDialog/);
});

test("victory presentation uses a native SeaPals reef crest without borrowed image assets", () => {
  assert.match(componentSource, /function ReefVictoryCrest/);
  assert.match(componentSource, /data-victory-crest-graphic/);
  assert.match(componentSource, /<svg/);
  assert.match(componentSource, /crestWave/);
  assert.match(componentSource, /data-victory-emblem/);
  assert.doesNotMatch(componentSource, /<img|pok[eé]mon|pokeball|prize cards/i);
});

test("victory reason removes the duplicated result prefix and retains a safe fallback", () => {
  assert.match(componentSource, /replace\(\/\^victory\\s\*:\\s\*\/i,\s*""\)/);
  assert.match(componentSource, /Your ecosystem reached the victory target\./);
  assert.match(componentSource, /data-victory-reason/);
});

test("victory layer preserves board context while delivering rays, rings, sparkles, and a title sweep", () => {
  assert.match(styleSource, /\.layer\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?z-index:\s*190;/);
  assert.match(styleSource, /\.backdrop\s*\{[\s\S]*?rgb\(1 10 22 \/ 74%\);[\s\S]*?backdrop-filter:\s*blur\(3px\)/);
  assert.match(styleSource, /\.rays\s*\{[\s\S]*?repeating-conic-gradient/);
  assert.match(styleSource, /\.ring\s*\{/);
  assert.match(styleSource, /\.sparkle\s*\{/);
  assert.match(styleSource, /\.title::after\s*\{[\s\S]*?victoryTitleSweep/);
  assert.match(styleSource, /@keyframes\s+victoryEmblemArrive/);
  assert.match(styleSource, /@keyframes\s+victoryTitleArrive/);
});

test("victory celebration fits mobile safe areas and honors both motion controls", () => {
  assert.match(styleSource, /min-height:\s*100dvh/);
  assert.match(styleSource, /env\(safe-area-inset-top\)/);
  assert.match(styleSource, /@media\s*\(max-width:\s*520px\)/);
  assert.match(styleSource, /@media\s*\(max-height:\s*620px\)/);
  assert.match(componentSource, /data-reduced-motion=\{reducedMotion \? "true" : undefined\}/);
  assert.match(styleSource, /\.reducedMotion[\s\S]*?animation:\s*none\s*!important/);
  assert.match(styleSource, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation:\s*none\s*!important/);
});

test("the simulator reserves the celebration for wins and keeps a primary exit action", () => {
  assert.match(simulatorSource, /import VictoryCelebration from "\.\/VictoryCelebration";/);
  assert.match(
    simulatorSource,
    /gameResult && !tutorialLessonWon && \/\^Victory\\b\/i\.test\(gameResult\)[\s\S]*?<VictoryCelebration/,
  );
  assert.match(simulatorSource, /<VictoryCelebration[\s\S]*?message=\{gameResult\}/);
  assert.match(simulatorSource, /data-victory-primary-action[\s\S]*?Play Again/);
  assert.match(
    simulatorSource,
    /gameResult && !tutorialLessonWon && !\/\^Victory\\b\/i\.test\(gameResult\)/,
    "Defeat and draw results should retain the existing compact alert rather than the victory spectacle",
  );
});
