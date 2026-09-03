import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [simulatorSource, proxySource, proxyStyles] = await Promise.all([
  readFile(new URL("./Simulator.jsx", import.meta.url), "utf8"),
  readFile(new URL("./CardActionProxyOverlay.jsx", import.meta.url), "utf8"),
  readFile(new URL("./CardActionProxyOverlay.module.css", import.meta.url), "utf8"),
]);

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

function countMatches(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

test("the action proxy is a focusable, discoverable touch control", () => {
  assert.match(proxySource, /data-card-action-proxy/);
  assert.match(proxySource, /<button[\s\S]*?type="button"/);
  assert.match(proxySource, /const ready\s*=\s*action\.availability\.ready[\s\S]*?aria-disabled=\{!ready\}/);
  assert.match(proxySource, /aria-label=\{/);
  assert.doesNotMatch(proxySource, /\sdisabled=\{/);
  assert.match(proxySource, /onClick=\{[\s\S]*?if \(ready\) action\.onActivate\?\.\(\)/);
  assert.match(proxySource, /action\.availability\.reason/);
  assert.match(proxySource, /action\.availability\.status/);
  assert.match(proxyStyles, /\.proxy\s*\{[\s\S]*?min-height:\s*(?:2\.75rem|3\.5rem|3\.75rem|44px);/);
  assert.match(proxyStyles, /\.proxy\s*\{[\s\S]*?touch-action:\s*manipulation;/);
});

test("the proxy is positioned with the card art instead of below scrollable details", () => {
  assert.match(proxyStyles, /\.proxyRail\s*\{[\s\S]*?position:\s*absolute;/);
  assert.match(proxyStyles, /\.stage\s*\{[\s\S]*?position:\s*relative;/);

  const inspector = sourceSection(
    simulatorSource,
    "{inspectedCardData ? (",
    "{compactTurnSequence ?",
  );
  const proxyIndex = inspector.indexOf("<CardActionProxyOverlay");
  const longDetailsIndex = inspector.indexOf("{inspectedCardData.text ?");

  assert.ok(proxyIndex >= 0, "the inspector should render the card-art action proxy");
  assert.ok(longDetailsIndex > proxyIndex, "long-form card details must follow the always-visible proxy");
  assert.match(inspector, /<CardActionProxyOverlay[\s\S]*?actions=\{inspectedActionProxies\}/);
});

test("mobile card art does not force the action proxy below a 21rem minimum", () => {
  assert.match(proxyStyles, /\.cardImage\s*\{[\s\S]*?height:\s*auto;/);
  assert.doesNotMatch(
    simulatorSource,
    /\.seapals-simulator-preview \.seapals-card-inspector-image\s*\{[^}]*min-height:\s*21rem;/,
    "the former mobile image minimum can push the always-visible action proxy below the viewport",
  );
});

test("Simulator derives every player proxy from the shared availability evaluator", () => {
  assert.match(simulatorSource, /import\s+CardActionProxyOverlay\s+from\s+"\.\/CardActionProxyOverlay"/);
  assert.match(simulatorSource, /import\s*\{\s*evaluateCardActionAvailability\s*\}\s*from\s*"\.\/cardActionAvailability\.mjs"/);

  const derivation = sourceSection(
    simulatorSource,
    "const inspectedActionProxies",
    "function stopBoardFaceoff",
  );
  assert.match(derivation, /inspectedCard\?\.owner\s*!==\s*"player"/);
  assert.match(derivation, /inspectedCardData\.(?:actions|passives)/);
  assert.match(derivation, /getBasicAttackEffect/);
  assert.match(derivation, /getSupportedUtilityEffect/);
  assert.match(derivation, /getPassiveCoralHeal/);
  assert.match(derivation, /getDamageCounterMove/);
  assert.match(derivation, /getJointedStructureMove/);
  assert.match(derivation, /const createAvailability[\s\S]*?evaluateCardActionAvailability\(/);
  assert.ok(countMatches(derivation, /createAvailability\(\{/g) >= 3,
    "attacks, utility actions, and action-phase passives should share one evaluator");
  assert.doesNotMatch(derivation, /tutorialContract\s*\?/);
  assert.doesNotMatch(derivation, /\.find\(\([^)]*\)\s*=>\s*[^)]*\.ready/);
});

test("informational passives remain descriptive while manual passives get proxies", () => {
  const derivation = sourceSection(
    simulatorSource,
    "const inspectedActionProxies",
    "function stopBoardFaceoff",
  );
  assert.match(derivation, /for \(const \[index, passive\] of \(inspectedCardData\.passives \?\? \[\]\)\.entries\(\)\)/);
  assert.match(
    derivation,
    /if \(!heal && !damageCounterMove && !jointedStructureMove\) continue;/,
    "automatic/informational passives must not become misleading action buttons",
  );
  assert.match(derivation, /if \(heal\) beginPassiveCoralHeal\(passive\)/);
  assert.match(derivation, /else if \(damageCounterMove\) beginDamageCounterMove\(passive\)/);
  assert.match(derivation, /else beginJointedStructureMove\(passive\)/);
});

test("proxy descriptors retain card-specific reasons and exact action identity", () => {
  const derivation = sourceSection(
    simulatorSource,
    "const inspectedActionProxies",
    "function stopBoardFaceoff",
  );
  const availabilitySource = sourceSection(
    simulatorSource,
    "function getInspectedUtilitySpecificBlock",
    "function stopBoardFaceoff",
  );
  assert.match(derivation, /specificBlock/);
  assert.match(derivation, /utilityActionKey|actionKey/);
  assert.match(derivation, /targetCount|no compatible target|no legal target/i);
  assert.match(availabilitySource, /discardPile\.length/);
  assert.match(availabilitySource, /foundationDeck\.length[\s\S]*?palsDeck\.length/);
  assert.match(availabilitySource, /effect\.targetTags/);
  assert.match(availabilitySource, /effect\.targetStages|effect\.requiredStage/);
  assert.match(availabilitySource, /getAcademyActionBlock/);
});

test("the proxy keeps tutorial hooks while opponent and reference previews stay read-only", () => {
  assert.match(proxySource, /data-tutorial-target=\{/);
  assert.match(proxySource, /data-tutorial-action-key=\{/);
  assert.match(proxySource, /className=\{[\s\S]*tutorial/);

  const derivation = sourceSection(
    simulatorSource,
    "const inspectedActionProxies",
    "function stopBoardFaceoff",
  );
  assert.match(derivation, /inspectedCard\?\.owner\s*!==\s*"player"[\s\S]*?return \[\]/);
  assert.match(derivation, /"attack-button"/);
  assert.match(derivation, /"utility-action-button"/);
  assert.match(derivation, /tutorialActionTargetClass/);
});

test("V2 uses the proxy without duplicating the legacy controls below the card", () => {
  const inspector = sourceSection(
    simulatorSource,
    "{inspectedCardData ? (",
    "{compactTurnSequence ?",
  );
  assert.match(inspector, /previewExperience\s*\?[\s\S]*?<CardActionProxyOverlay/);
  assert.match(inspector, /\{!previewExperience && inspectedCard\.owner === "player" && utilityEffect \? \(/);
  assert.match(
    inspector,
    /\{!previewExperience && inspectedCard\.owner === "player" && getBasicAttackEffect\(inspectedCardData\) \? \(/,
    "the lower attack control should be legacy-only",
  );
});

test("closing remains available by Escape, close button, and backdrop", () => {
  const keyEffect = sourceSection(
    simulatorSource,
    "if (!inspectedCardData) return undefined;",
    "if (!handPopoverCardId) return undefined;",
  );
  assert.match(keyEffect, /event\.key\s*!==\s*"Escape"/);
  assert.match(keyEffect, /closeCardInspector\(\)/);

  const inspector = sourceSection(
    simulatorSource,
    "{inspectedCardData ? (",
    "{compactTurnSequence ?",
  );
  assert.ok(countMatches(inspector, /aria-label="Close card inspector"/g) >= 2);
  assert.ok(countMatches(inspector, /onClick=\{closeCardInspector\}/g) >= 2);
});
