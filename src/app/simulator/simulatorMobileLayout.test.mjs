import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("mobile tutorial copy scrolls independently from persistent tour actions", () => {
  const guideCard = sourceSection(
    simulatorSource,
    "function ProfessorGuideCard(",
    "const TUTORIAL_POINTER_TARGETS",
  );
  const mobileStyles = sourceSection(
    simulatorSource,
    "@media (max-width: 767px)",
    "`}</style>",
  );

  assert.match(
    guideCard,
    /className="seapals-professor-card-scroll"[\s\S]*?<\/div>\s*\{onAdvance \? \(\s*<div className="seapals-professor-actions/,
  );
  assert.match(guideCard, /seapals-professor-actions[\s\S]*?min-h-11[\s\S]*?onClick=\{onAdvance\}/);
  assert.match(simulatorSource, /\.seapals-professor-card-scroll\s*\{[\s\S]*?overflow-y:\s*auto;/);
  assert.match(simulatorSource, /\.seapals-professor-actions\s*\{[\s\S]*?flex:\s*0 0 auto;/);
  assert.match(mobileStyles, /\.seapals-professor-card\s*\{[\s\S]*?max-height:\s*min\(34dvh, 15rem\);/);
  assert.match(
    simulatorSource,
    /@media \(max-width: 767px\) and \(max-height: 500px\)[\s\S]*?max-height:\s*min\(calc\(100dvh - var\(--seapals-mobile-dock-clearance\) - 1rem - env\(safe-area-inset-bottom\)\), 15rem\);/,
  );
});

test("an open mobile coach suppresses the duplicate target beacon", () => {
  assert.match(simulatorSource, /tutorialHelpFloating \? " seapals-tutorial-help-floating"/);
  assert.match(
    simulatorSource,
    /@media \(max-width: 767px\)[\s\S]*?\.seapals-tutorial-help-floating \.seapals-target-beacon \{ display: none; \}/,
  );
  assert.match(
    simulatorSource,
    /active=\{tutorialTargetBeaconOpen && !tutorialBoardTourOpen\}/,
  );
});

test("the player reef starts fitted and stops auto-fitting after manual camera input", () => {
  assert.match(simulatorSource, /const \[playerViewportTouched, setPlayerViewportTouched\] = useState\(false\)/);
  assert.match(simulatorSource, /const playerLayoutSignature = \[/);
  assert.match(
    simulatorSource,
    /if \(!playerLayoutSignature \|\| playerViewportTouched\) return undefined;[\s\S]*?new ResizeObserver\(fitPlayerBoard\)[\s\S]*?zoomEcosystemToFit\("player"\)/,
  );
  assert.match(
    simulatorSource,
    /const sparsePlayerBoardMaxZoom = !isOpponent && corals\.length === 1 && !floatingCardsPresent[\s\S]*?rect\.width \* 0\.34/,
  );
  assert.doesNotMatch(
    sourceSection(simulatorSource, "function handleEcosystemPointerDown", "function handleEcosystemPointerMove"),
    /setPlayerViewportTouched\(true\)/,
  );
  assert.match(
    sourceSection(simulatorSource, "function handleEcosystemPointerMove", "function handleEcosystemPointerUp"),
    /Math\.abs\(dx\) \+ Math\.abs\(dy\) > 4[\s\S]*?setPlayerViewportTouched\(true\)/,
  );
  assert.match(
    simulatorSource,
    /attachCursorZoom\(ecosystemRef\.current, setEcosystemZoom, setEcosystemOffset, \(\) => setPlayerViewportTouched\(true\)\)/,
  );
  assert.match(simulatorSource, /setPlayerViewportTouched\(false\)[\s\S]*?setOpponentViewportTouched\(false\)/);
});

test("the narrow HUD uses safe areas, compact rows, and 44px primary tap targets", () => {
  const mobileStyles = sourceSection(
    simulatorSource,
    "@media (max-width: 767px)",
    "`}</style>",
  );

  assert.match(mobileStyles, /height:\s*100dvh;/);
  assert.match(mobileStyles, /padding-top:\s*max\(\.5rem, env\(safe-area-inset-top\)\)/);
  assert.match(mobileStyles, /padding-bottom:\s*max\(\.5rem, env\(safe-area-inset-bottom\)\)/);
  assert.match(mobileStyles, /\.seapals-simulator-header\s*\{[\s\S]*?display:\s*grid;/);
  assert.match(mobileStyles, /\.seapals-simulator-controls\s*\{\s*display:\s*contents;/);
  assert.match(mobileStyles, /\.seapals-board-tabs > button\s*\{[\s\S]*?min-height:\s*2\.75rem;/);
  assert.match(mobileStyles, /\.seapals-mobile-dock\s*\{[\s\S]*?grid-template-columns:/);
  assert.match(simulatorSource, /className=\{`flex h-11 w-11[\s\S]*?aria-label="Zoom in on your ecosystem"/);
  assert.match(simulatorSource, /className=\{`min-h-11 w-11[\s\S]*?aria-label="Fit your ecosystem to view"/);
});
