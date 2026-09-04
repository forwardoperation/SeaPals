import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  VP_COUNTER_MAX_DURATION_MS,
  VP_COUNTER_MAX_STEP_MS,
  VP_COUNTER_MIN_STEP_MS,
  getVpCounterDirection,
  getVpCounterStepDelay,
  normalizeVpCounterValue,
} from "./vpCounterPresentation.mjs";

const [simulatorSource, badgeSource] = await Promise.all([
  readFile(new URL("./Simulator.jsx", import.meta.url), "utf8"),
  readFile(new URL("./AnimatedVpBadge.jsx", import.meta.url), "utf8"),
]);

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("VP values are normalized and gains and losses retain their true semantic direction", () => {
  assert.equal(normalizeVpCounterValue(7.9), 7);
  assert.equal(normalizeVpCounterValue(-3), 0);
  assert.equal(normalizeVpCounterValue(Number.NaN), 0);
  assert.equal(getVpCounterDirection(4, 9), "gain");
  assert.equal(getVpCounterDirection(9, 4), "loss");
  assert.equal(getVpCounterDirection(4, 4), null);
});

test("VP stepping is perceptible for small changes and bounded for larger changes", () => {
  assert.equal(getVpCounterStepDelay(2, 2), 0);
  assert.equal(getVpCounterStepDelay(0, 1), VP_COUNTER_MAX_STEP_MS);
  assert.equal(getVpCounterStepDelay(0, 8), 90);
  assert.equal(getVpCounterStepDelay(0, 100), VP_COUNTER_MIN_STEP_MS);
  assert.ok(VP_COUNTER_MIN_STEP_MS > 0);
  assert.ok(VP_COUNTER_MAX_STEP_MS > VP_COUNTER_MIN_STEP_MS);
  assert.ok(VP_COUNTER_MAX_DURATION_MS >= 500 && VP_COUNTER_MAX_DURATION_MS <= 1000);
});

test("the animated badge counts toward the target while direction follows true score changes", () => {
  assert.match(badgeSource, /const \[displayValue, setDisplayValue\] = useState\(targetValue\)/, "Initial scores should not count up from zero on mount");
  assert.match(badgeSource, /const previousTargetRef = useRef\(targetValue\)/);
  assert.match(badgeSource, /const previousTarget = previousTargetRef\.current;[\s\S]{0,120}previousTargetRef\.current = targetValue/);
  assert.match(
    badgeSource,
    /const semanticDirection = getVpCounterDirection\(previousTarget,\s*targetValue\)/,
    "Gold versus red must follow the last real VP total, not an interrupted display frame",
  );
  assert.match(badgeSource, /const visualDirection = getVpCounterDirection\(startingValue,\s*targetValue\)/);
  assert.match(badgeSource, /const step = visualDirection === "gain" \? 1 : -1/);
  assert.match(badgeSource, /nextValue = elapsed >= VP_COUNTER_MAX_DURATION_MS[\s\S]*?\? targetValue[\s\S]*?: nextValue \+ step/);
  assert.match(
    badgeSource,
    /motionReduced \|\| !visualDirection \|\| visualDirection !== semanticDirection[\s\S]*?setDisplayValue\(targetValue\)/,
    "Interrupted counters must never animate in the opposite color or direction from the true VP change",
  );
  assert.match(badgeSource, /sequenceRef\.current !== sequence/);
  assert.match(badgeSource, /window\.clearTimeout\(stepTimerRef\.current\)/);
  assert.match(badgeSource, /window\.clearTimeout\(glowTimerRef\.current\)/);
});

test("VP motion honors both the simulator preference and live operating-system changes", () => {
  assert.match(badgeSource, /window\.matchMedia\?\.\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(badgeSource, /motionPreference\.addEventListener\("change",\s*syncPreference\)/);
  assert.match(badgeSource, /motionPreference\.removeEventListener\("change",\s*syncPreference\)/);
  assert.match(badgeSource, /motionPreference\.addListener\?\.\(syncPreference\)/);
  assert.match(badgeSource, /motionPreference\.removeListener\?\.\(syncPreference\)/);
  assert.match(badgeSource, /const motionReduced = reducedMotion \|\| systemReducedMotion/);
  assert.match(badgeSource, /if \(motionReduced \|\|[\s\S]{0,300}setDisplayValue\(targetValue\)/);
  assert.match(simulatorSource, /(?:\.is-vp-reduced-motion|\.seapals-reduced-motion[^,{]*\.is-vp-(?:gain|loss))[\s\S]{0,500}?animation:\s*none/i);
  assert.match(simulatorSource, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.is-vp-(?:gain|loss)[\s\S]*?animation:\s*none/i);
});

test("VP animation uses gold for gains and red for losses without crowding adjacent HUD values", () => {
  assert.match(badgeSource, /direction \? `is-vp-\$\{direction\}`/);
  assert.doesNotMatch(badgeSource, /seapals-vp-delta/);

  const gainRule = sourceSection(
    simulatorSource,
    ".is-vp-gain",
    ".is-vp-loss",
  );
  const lossRule = sourceSection(
    simulatorSource,
    ".is-vp-loss",
    ".seapals-reef-score-card.is-rp",
  );
  assert.match(gainRule, /(?:#(?:fbbf24|f59e0b|fde68a|fde047)|251,\s*191,\s*36|245,\s*158,\s*11|253,\s*(?:224,\s*71|230,\s*138))/i, "VP gains should glow gold");
  assert.match(lossRule, /(?:#(?:fb7185|ef4444|fda4af|f87171)|(?:248,\s*113,\s*113|251,\s*113,\s*133|239,\s*68,\s*68|253,\s*164,\s*175))/i, "VP losses should glow red");
  assert.match(simulatorSource, /@keyframes\s+seapalsVp(?:Gain|CountUp)/);
  assert.match(simulatorSource, /@keyframes\s+seapalsVp(?:Loss|CountDown)/);
});

test("VP animation reports the true target accessibly without announcing every visual frame", () => {
  assert.match(badgeSource, /aria-label=\{`\$\{label\}: \$\{targetValue\} Victory Points`\}/);
  assert.match(badgeSource, /<strong[^>]*aria-hidden="true"[^>]*>\{displayValue\}<\/strong>/);
  assert.match(badgeSource, /role="status" aria-live="polite" aria-atomic="true">\{announcement\}/);
  assert.match(
    badgeSource,
    /setAnnouncement\([\s\S]{0,100}\$\{label\} VP[\s\S]{0,180}\$\{semanticDirection === "gain" \? "increased" : "decreased"\}[\s\S]{0,100}\$\{scoreDelta\} to \$\{targetValue\}/,
  );
  assert.doesNotMatch(badgeSource, /seapals-vp-delta/);
});

test("animated VP is wired to both reefs in compact V2 and XL score views", () => {
  const v2Opponent = sourceSection(
    simulatorSource,
    "seapals-reef-score seapals-reef-score-opponent",
    "{previewExperience && mobileHandDockVisible ? (",
  );
  const v2Player = sourceSection(
    simulatorSource,
    "seapals-reef-score seapals-reef-score-player",
    "{previewExperience && mobileHandDockVisible ? (",
  );
  assert.match(v2Opponent, /<AnimatedVpBadge[\s\S]*?value=\{presentedOpponentVp\}/);
  assert.match(v2Opponent, /owner="opponent[^"]*"/);
  assert.match(v2Opponent, /label=\{opponentHudLabel\}/);
  assert.match(v2Opponent, /reducedMotion=\{accessibilityReducedMotion \|\| boardStatPresentationActive\}/);
  assert.match(v2Player, /<AnimatedVpBadge[\s\S]*?value=\{presentedPlayerVp\}/);
  assert.match(v2Player, /owner="player[^"]*"/);
  assert.match(v2Player, /label="Your Reef"/);
  assert.match(v2Player, /reducedMotion=\{accessibilityReducedMotion \|\| boardStatPresentationActive\}/);
  assert.match(v2Player, /tutorialTarget="vp-score"/);

  const xlScore = sourceSection(
    simulatorSource,
    '<div className={`grid grid-cols-2 overflow-hidden rounded-xl',
    "<button type=\"button\" disabled={!activeCondition}",
  );
  assert.match(xlScore, /<AnimatedVpBadge[\s\S]*?value=\{presentedPlayerVp\}[\s\S]*?owner="player[^"]*"[\s\S]*?variant="inline"/);
  assert.match(xlScore, /<AnimatedVpBadge[\s\S]*?value=\{presentedOpponentVp\}[\s\S]*?owner="opponent[^"]*"[\s\S]*?variant="inline"/);

  const badgeUses = simulatorSource.match(/<AnimatedVpBadge\b/g) ?? [];
  assert.ok(badgeUses.length >= 4, "Both compact-board and XL player/opponent VP totals should share the animated counter");
});
