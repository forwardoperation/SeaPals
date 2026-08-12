import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Reefbound and Simulator both expose the shared private bug reporter", async () => {
  const [adventure, simulator, reporter] = await Promise.all([
    readFile(new URL("../adventure/AdventureGame.jsx", import.meta.url), "utf8"),
    readFile(new URL("./Simulator.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../components/feedback/BugReportDialog.jsx", import.meta.url), "utf8"),
  ]);

  for (const source of [adventure, simulator]) {
    assert.match(source, /import BugReportDialog from "@\/components\/feedback\/BugReportDialog"/);
    assert.match(source, /Report a bug/);
    assert.match(source, /<BugReportDialog/);
  }

  assert.match(adventure, /surface="reefbound"/);
  assert.match(simulator, /surface=\{isStoryMode \? "reefbound" : "simulator"\}/);
  assert.doesNotMatch(
    adventure.match(/<BugReportDialog[\s\S]*?\/>/)?.[0] ?? "",
    /account|email|localStorage|gameSave|profileId/,
  );
  assert.match(reporter, /your name, email, and save file are not/);
  assert.match(reporter, /Players under 13 should ask a grown-up/);
  assert.match(reporter, /\/privacy#collection/);
  assert.match(reporter, /role="dialog"/);
  assert.match(reporter, /aria-modal="true"/);
  assert.match(reporter, /createPortal\(dialog, document\.body\)/);
  assert.match(reporter, /setAttribute\("inert", ""\)/);
  assert.match(reporter, /globalThis\.structuredClone\(context\)/);
  assert.match(reporter, /event\.key !== "Tab"/);
});

test("the shared reporter owns Escape, focus, and background isolation", async () => {
  const [adventure, reporter] = await Promise.all([
    readFile(new URL("../adventure/AdventureGame.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../components/feedback/BugReportDialog.jsx", import.meta.url), "utf8"),
  ]);

  const escapeHandler = adventure.slice(
    adventure.indexOf("escapeRef.current = () =>"),
    adventure.indexOf("useEffect(() =>", adventure.indexOf("escapeRef.current = () =>")),
  );
  assert.match(escapeHandler, /if \(bugReportOpen\) return;/);
  assert.ok(
    escapeHandler.indexOf("if (bugReportOpen) return;")
      < escapeHandler.indexOf("setPauseOpen((current) => !current)"),
    "the bug dialog guard must run before Reefbound toggles its pause menu",
  );
  assert.match(adventure, /blocked=\{Boolean\(confirmation\)\}/);
  assert.doesNotMatch(adventure, /blocked=\{Boolean\(confirmation \|\| bugReportOpen\)\}/);

  assert.match(reporter, /window\.addEventListener\("keydown", handleKeyDown, true\)/);
  assert.match(reporter, /event\.stopPropagation\(\)/);
  assert.match(reporter, /if \(status !== "submitting"\) requestClose\(\)/);
  assert.match(reporter, /if \(status === "success"\) resetReport\(\)/);
  assert.match(reporter, /setClientReportId\(createClientReportId\(\)\)/);
  assert.match(reporter, /successActionRef\.current\?\.focus/);
  assert.match(reporter, /opener\?\.isConnected[\s\S]*opener\.focus/);
  assert.match(reporter, /!dialog\?\.contains\(activeElement\)/);
  assert.match(reporter, /dialog\?\.focus/);

  assert.match(reporter, /\[\.\.\.document\.body\.children\]/);
  assert.match(reporter, /inert: element\.getAttribute\("inert"\)/);
  assert.match(reporter, /ariaHidden: element\.getAttribute\("aria-hidden"\)/);
  assert.match(reporter, /restoreAttribute\(element, "inert", inert\)/);
  assert.match(reporter, /restoreAttribute\(element, "aria-hidden", ariaHidden\)/);
});

test("Simulator diagnostics capture enough state to diagnose destroyed schools", async () => {
  const simulator = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
  const reporter = simulator.match(/<BugReportDialog[\s\S]*?onClose=\{\(\) => setBugReportOpen\(false\)\}[\s\S]*?\/>/)?.[0] ?? "";

  assert.match(reporter, /playerDeckId:\s*isStoryMode \? null : selectedDeckId/);
  assert.match(reporter, /playerDeckKind:\s*isStoryMode \? "reefbound-story-deck" : "prebuilt-deck"/);
  assert.doesNotMatch(reporter, /playerDeckId:\s*isStoryMode \? selectedDeckId/);
  assert.match(reporter, /gamePhase/);
  assert.match(reporter, /activeConditionId/);
  assert.match(reporter, /health: coral\.health/);
  assert.match(reporter, /maxHealth: coral\.maxHealth/);
  assert.match(reporter, /discardPile: opponent\.discardPile/);
  assert.match(reporter, /cardId: coral\.cardId/);
});
