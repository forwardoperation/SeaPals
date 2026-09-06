import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const combatPresentation = await import("./combatResultBreakdown.mjs");
const simulatorSource = (await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8"))
  .replaceAll("\r\n", "\n");

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

function cssRule(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Missing CSS rule: ${selector}`);
  return match[1];
}

function remFontSize(rule, label) {
  const directSize = rule.match(/font-size:\s*([0-9.]+)rem/);
  const clampFloor = rule.match(/font-size:\s*clamp\(\s*([0-9.]+)rem/);
  const size = Number(clampFloor?.[1] ?? directSize?.[1]);
  assert.ok(Number.isFinite(size), `${label} needs an explicit rem-based minimum font size`);
  return size;
}

test("identical modifier sources collapse into one bounded contributor row", () => {
  const breakdown = combatPresentation.buildCombatResultBreakdown({
    combatBreakdown: {
      attack: {
        contributors: [
          { id: "roll", label: "Roll", value: 1, kind: "roll" },
          { id: "jelly-1", label: "Deep Sea Jelly", value: 1 },
          { id: "jelly-2", label: "Deep Sea Jelly", value: 1 },
          { id: "jelly-3", label: "Deep Sea Jelly", value: 1 },
        ],
        total: 4,
      },
    },
  });

  const jellyRows = breakdown.attack.contributors.filter(({ label }) => label === "Deep Sea Jelly");
  assert.deepEqual(
    jellyRows.map(({ label, value }) => ({ label, value })),
    [{ label: "Deep Sea Jelly", value: 3 }],
    "Repeated copies of one source should add together instead of growing the result card without bound",
  );
  assert.equal(breakdown.attack.contributors.length, 2, "The roll plus one aggregated modifier should be enough");
  assert.equal(
    breakdown.attack.contributors.reduce((sum, contributor) => sum + contributor.value, 0),
    breakdown.attack.total,
  );
});

test("structured consequences preserve every material movement and deduplicate the default cue", () => {
  assert.equal(
    typeof combatPresentation.buildCombatResultConsequences,
    "function",
    "Combat result consequences need a pure normalization helper so multiple movements cannot be dropped by a single-cue fallback",
  );

  const event = {
    combatConsequences: [
      { id: "defender-discard", label: "Clownfish", detail: "Discard pile" },
      { id: "attacker-lost", label: "Anglerfish", detail: "Lost Zone" },
    ],
  };
  const original = structuredClone(event);
  const consequences = combatPresentation.buildCombatResultConsequences(event, {
    defaultConsequence: { id: "default-discard", label: "Clownfish", detail: "Discard pile" },
  });

  assert.deepEqual(
    consequences.map(({ label, detail }) => ({ label, detail })),
    [
      { label: "Clownfish", detail: "Discard pile" },
      { label: "Anglerfish", detail: "Lost Zone" },
    ],
    "Both sides moving cards must remain visible while the duplicate automatic cue is removed",
  );
  assert.equal(new Set(consequences.map(({ id }) => id)).size, consequences.length, "Rendered consequence rows need stable unique keys");
  assert.deepEqual(event, original, "Consequence normalization must not mutate a queued combat event");
});

test("Bite Back remains a defense result and gets its own concise counter row", () => {
  const playerDefenseBranch = sourceSection(
    simulatorSource,
    "const biteBack = getBiteBackAttack(targetEntry.card);",
    "function applyPlayerOnPlayDeckDiscard(",
  );

  assert.doesNotMatch(
    playerDefenseBranch,
    /title:\s*counterSucceeded\s*\?\s*"Bite Back Counterattack!"/,
    "A defended attack must not relabel the original attack-versus-defense columns as Bite Back",
  );
  assert.match(
    playerDefenseBranch,
    /title:\s*"[^"]*Defense[^"]*"/i,
    "The main heading should plainly describe the original defended attack",
  );
  assert.match(
    playerDefenseBranch,
    /combatConsequences\s*(?:=|:)\s*counter\?\.resolved[\s\S]*?label:\s*"Bite Back"[\s\S]*?counter\.attack\.total[\s\S]*?counter\.defense\.total/,
    "Bite Back needs a separate structured row with its own counterattack arithmetic",
  );
  assert.match(
    playerDefenseBranch,
    /discardCue:\s*counterSucceeded\s*\?[\s\S]*?cardId:\s*attacker\.id[\s\S]*?destinationZone:/,
    "A successful counter should add the attacking card's destination as the default movement row",
  );
  assert.match(
    playerDefenseBranch,
    /resultOverlay\s*=\s*\{[\s\S]*?combatBreakdown,[\s\S]*?combatConsequences,/,
    "The held result should keep the original combat columns and carry the separate Bite Back row",
  );

  const opponentEventBuilder = sourceSection(
    simulatorSource,
    "function buildOpponentAttackEventSequence(",
    "function preserveOpponentNormalActionsAfterOnPlay(",
  );
  assert.doesNotMatch(
    opponentEventBuilder,
    /step\.counterSucceeded\s*\?\s*"Bite Back Counterattack!"/,
    "Opponent attacks defended with Bite Back should also retain a defense-oriented main heading",
  );
  assert.match(
    opponentEventBuilder,
    /const combatConsequences\s*=\s*\[[\s\S]*?\.\.\.\(step\.combatConsequences\s*\?\?\s*\[\]\)[\s\S]*?combatConsequences,/,
    "Opponent Bite Back details must reach the same structured result presentation",
  );

  const opponentResolver = sourceSection(
    simulatorSource,
    "function runOpponentAttackStep(",
    "function runOpponentAttack(",
  );
  const opponentBiteBackBranch = sourceSection(
    opponentResolver,
    "const biteBack = getBiteBackAttack(targetEntry.card);",
    "if (targetEntry.onOpponentBoard)",
  );
  assert.match(
    opponentBiteBackBranch,
    /combatConsequences:[\s\S]*?label:\s*"Bite Back"[\s\S]*?counter\.attack\.total[\s\S]*?counter\.defense\.total/,
    "The opponent resolver should create the same short Bite Back arithmetic row",
  );
  assert.match(
    opponentBiteBackBranch,
    /opponentDiscardedCardId:\s*counterSucceeded\s*\?\s*attackerEntry\.card\.id\s*:\s*null/,
    "A successful opponent counter should retain the attacking card movement for the merged default row",
  );
});

test("a successful attack does not lose a second card movement behind its default discard cue", () => {
  const playerAttackResolution = sourceSection(
    simulatorSource,
    "function resolvePlayerAttack(",
    "function applyPlayerOnPlayDeckDiscard(",
  );
  const successBranch = sourceSection(
    playerAttackResolution,
    "const opponentActualRecycleRp = blueCrabRecycle.recoveredRp;",
    "} else {\n      const biteBack = getBiteBackAttack(targetEntry.card);",
  );

  assert.match(
    successBranch,
    /const combatConsequences\s*=\s*\[[\s\S]*?attackerDiscardedAfterConsume[\s\S]*?attacker\.name[\s\S]*?\]\.filter\(Boolean\)/,
    "A Toxic/consume self-discard should be retained as an explicit second movement row",
  );
  assert.match(
    successBranch,
    /discardCue:\s*!defenderKept\s*\?[\s\S]*?cardId:\s*targetEntry\.card\.id/,
    "The defeated target should remain the default movement cue that is merged with explicit rows",
  );
  assert.match(
    successBranch,
    /resultOverlay\s*=\s*\{[\s\S]*?combatBreakdown,[\s\S]*?combatConsequences,/,
    "All material rows must travel with the held player result",
  );
});

test("every repeated opponent combat result carries its ordinal through the event boundary", () => {
  const eventBuilder = sourceSection(
    simulatorSource,
    "function buildOpponentAttackEventSequence(",
    "function preserveOpponentNormalActionsAfterOnPlay(",
  );

  assert.ok(
    (eventBuilder.match(/attackNumber:\s*step\.attackNumber/g) ?? []).length >= 2,
    "Regenerate and ordinary opponent combat events should both retain the current attack number",
  );
  assert.ok(
    (eventBuilder.match(/attackCount:\s*step\.requiredAttacks/g) ?? []).length >= 2,
    "Regenerate and ordinary opponent combat events should both retain the total attack count",
  );
  assert.match(
    simulatorSource,
    /Number\(combatResultCheckpoint\.event\.attackCount\) > 1[\s\S]*?Attack \$\{combatResultCheckpoint\.event\.attackNumber\} of \$\{combatResultCheckpoint\.event\.attackCount\}/,
    "The compact checkpoint should expose the propagated ordinal at a glance",
  );
});

test("the checkpoint renders all normalized consequences without a redundant no-breakdown stack", () => {
  const presentationModel = sourceSection(
    simulatorSource,
    "const combatCheckpointBreakdown =",
    "const selectedHandPlayError =",
  );
  const checkpointMarkup = sourceSection(
    simulatorSource,
    "{combatResultCheckpoint ? (",
    "{opponentPlacementFlight ? (",
  );

  assert.match(
    presentationModel,
    /buildCombatResultConsequences\(combatResultCheckpoint\.event,\s*\{[\s\S]*?defaultConsequence:/,
    "Explicit consequence rows should be merged with the one automatic board-state cue",
  );
  assert.match(
    checkpointMarkup,
    /combatCheckpointConsequences\.map\(\(consequence\)[\s\S]*?data-combat-consequence/,
    "Every material consequence should render as its own short row",
  );
  assert.match(
    checkpointMarkup,
    /data-combat-consequence[\s\S]*?consequence\.label[\s\S]*?consequence\.detail/,
    "Each consequence row should expose its short label and result",
  );
  assert.match(
    presentationModel,
    /combatCheckpointConsequences\.map\([\s\S]*?consequence\.label[\s\S]*?consequence\.detail/,
    "The accessible summary should include every visible consequence row",
  );
  assert.doesNotMatch(
    checkpointMarkup,
    /\)\s*:\s*<span className="seapals-combat-result-outcome">\{combatCheckpointOutcomeLabel\}<\/span>[\s\S]*?\{combatCheckpointVerdict \|\| combatCheckpointConsequence \? \(/,
    "A no-breakdown event should not stack a title, outcome pill, and a second consequence strip",
  );
  assert.doesNotMatch(
    checkpointMarkup,
    /seapals-combat-result-outcome/,
    "No-roll events should rely on their single heading instead of adding a redundant visible fallback",
  );
  assert.match(
    checkpointMarkup,
    /\)\s*:\s*null\}\s*\{combatCheckpointVerdict \|\| combatCheckpointConsequences\.length \? \(/,
    "The arithmetic and consequence regions should disappear entirely when a no-roll result has neither",
  );
});

test("attack, defense, action, total, and contributor labels retain a readable minimum size", () => {
  const styles = sourceSection(
    simulatorSource,
    ".seapals-combat-result-breakdown {",
    ".seapals-opponent-placement-layer {",
  );
  const keyRules = [
    [".seapals-combat-result-side-header > small", "Attack/Defense label"],
    [".seapals-combat-result-side-header > span", "Action label"],
    [".seapals-combat-result-contributor", "Contributor label"],
    [".seapals-combat-result-total", "Total label"],
  ];

  for (const [selector, label] of keyRules) {
    const size = remFontSize(cssRule(styles, selector), label);
    assert.ok(size >= 0.7, `${label} should be at least .7rem, received ${size}rem`);
  }
});
