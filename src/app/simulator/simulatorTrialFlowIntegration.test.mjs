import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { prebuiltDecks } from "../../data/tournaments/prebuiltDecks.js";
import {
  DEFAULT_SIMULATOR_DECK_ID,
  createSimulatorDeckHref,
  getValidSimulatorDeck,
  resolveSimulatorDeckId,
} from "./simulatorDeckRoute.mjs";

const filename = fileURLToPath(import.meta.url);
const simulatorDirectory = path.dirname(filename);
const appDirectory = path.resolve(simulatorDirectory, "..");
const srcDirectory = path.resolve(appDirectory, "..");

async function readSourceFromApp(...segments) {
  return readFile(path.join(appDirectory, ...segments), "utf8");
}

test("simulator deck route accepts one known deck and rejects ambiguous or unknown values", () => {
  for (const deck of prebuiltDecks) {
    assert.equal(getValidSimulatorDeck(deck.id)?.id, deck.id);
    assert.equal(resolveSimulatorDeckId(deck.id), deck.id);
    assert.equal(
      createSimulatorDeckHref(deck.id),
      `/simulator?deck=${encodeURIComponent(deck.id)}`,
    );
  }

  assert.equal(getValidSimulatorDeck(`  ${DEFAULT_SIMULATOR_DECK_ID}  `)?.id, DEFAULT_SIMULATOR_DECK_ID);
  assert.equal(getValidSimulatorDeck("not-a-deck"), null);
  assert.equal(getValidSimulatorDeck(["coral-garden", "blue-water"]), null);
  assert.equal(getValidSimulatorDeck(null), null);
  assert.equal(resolveSimulatorDeckId("not-a-deck"), DEFAULT_SIMULATOR_DECK_ID);
  assert.equal(resolveSimulatorDeckId(["blue-water"]), DEFAULT_SIMULATOR_DECK_ID);
  assert.equal(createSimulatorDeckHref("not-a-deck"), null);
});

test("the simulator page preselects only a validated player deck and story mode keeps precedence", async () => {
  const pageSource = await readSourceFromApp("simulator", "page.jsx");
  const simulatorSource = await readSourceFromApp("simulator", "Simulator.jsx");

  assert.match(pageSource, /await searchParams/);
  assert.match(pageSource, /getValidSimulatorDeck\(params\?\.deck\)\?\.id \?\? null/);
  assert.match(pageSource, /key=\{initialDeckId \?\? "default"\}/);
  assert.match(pageSource, /initialDeckId=\{initialDeckId\}/);
  assert.match(simulatorSource, /normalInitialDeckId = resolveSimulatorDeckId\(initialDeckId\)/);
  assert.match(
    simulatorSource,
    /initialPlayerDeckId = isStoryMode \? storyPlayerDeckId : normalInitialDeckId/,
  );
  assert.match(
    simulatorSource,
    /initialOpponentDeckId = isStoryMode \? storyOpponentDeckId : defaultDeckId/,
  );
});

test("the guided tutorial preserves a validated selected deck as its return target", async () => {
  const tutorialPageSource = await readSourceFromApp("instructions", "tutorial", "page.jsx");
  const simulatorSource = await readSourceFromApp("simulator", "Simulator.jsx");

  assert.match(tutorialPageSource, /getValidSimulatorDeck\(params\?\.returnDeck\)/);
  assert.match(tutorialPageSource, /createSimulatorDeckHref\(returnDeck\?\.id\)/);
  assert.match(tutorialPageSource, /\? `\$\{returnDeckName\} Trial` : "Instructions"/);
  assert.match(simulatorSource, /pathname: "\/instructions\/tutorial"/);
  assert.match(simulatorSource, /query: \{ returnDeck: selectedDeckId \}/);
  assert.match(simulatorSource, /Start guided tutorial/);
});

test("deck discovery, storefront trials, and post-game shopping complete the trial loop", async () => {
  const [decksSource, storefrontSource, simulatorSource, catalogSource] = await Promise.all([
    readSourceFromApp("decks", "page.jsx"),
    readSourceFromApp("store", "Storefront.jsx"),
    readSourceFromApp("simulator", "Simulator.jsx"),
    readFile(path.join(srcDirectory, "lib", "store", "catalog.js"), "utf8"),
  ]);

  assert.match(decksSource, /href=\{`\/simulator\?deck=\$\{deck\.id\}`\}/);
  assert.match(decksSource, /Try this deck/);
  assert.match(storefrontSource, /product\.trialDecks\?\.length/);
  assert.match(storefrontSource, /href=\{deck\.href\}/);
  assert.match(storefrontSource, /Try \$\{deck\.name\.replace/);
  assert.match(catalogSource, /includedDeckIds/);
  assert.match(catalogSource, /trialDecks/);
  assert.match(simulatorSource, /query: \{ deck: selectedPlayerDeck\.id \}/);
  assert.match(simulatorSource, /Shop \{selectedPlayerDeck\.name\}/);
});
