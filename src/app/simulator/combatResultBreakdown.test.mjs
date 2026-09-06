import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCombatResultBreakdown,
  combatContributorsFromDetails,
  formatCombatContributorValue,
} from "./combatResultBreakdown.mjs";

function assertSideAddsUp(side) {
  assert.ok(side, "Expected a visible combat breakdown side");
  assert.equal(
    side.contributors.reduce((sum, contributor) => sum + contributor.value, 0),
    side.total,
    "Every visible contributor should add up to the displayed total",
  );
}

test("structured combat results preserve two glanceable contributor columns and totals", () => {
  const event = {
    combatBreakdown: {
      attack: {
        cardId: "humpback-anglerfish",
        name: "Anglerfish",
        actionName: "Lure",
        contributors: [
          { id: "attack-roll", label: "Lure (D4)", value: 2, kind: "roll", detail: "Rolled 2" },
          { id: "deep-sea-jelly", label: "Deep Sea Jelly", value: 2 },
        ],
        total: 4,
      },
      defense: {
        cardId: "clownfish",
        label: "Clownfish",
        contributors: [
          { id: "defense-roll", label: "Clownfish (D4)", value: 2, kind: "roll" },
          { id: "stinging-fortress", label: "Stinging Fortress", value: 1 },
        ],
        total: 3,
      },
    },
  };
  const original = structuredClone(event);

  const breakdown = buildCombatResultBreakdown(event);

  assert.deepEqual(
    breakdown.attack.contributors.map(({ label, value, kind }) => ({ label, value, kind })),
    [
      { label: "Lure (D4)", value: 2, kind: "roll" },
      { label: "Deep Sea Jelly", value: 2, kind: "modifier" },
    ],
  );
  assert.deepEqual(
    breakdown.defense.contributors.map(({ label, value, kind }) => ({ label, value, kind })),
    [
      { label: "Clownfish (D4)", value: 2, kind: "roll" },
      { label: "Stinging Fortress", value: 1, kind: "modifier" },
    ],
  );
  assert.equal(breakdown.attack.total, 4);
  assert.equal(breakdown.defense.total, 3);
  assert.deepEqual(
    {
      cardId: breakdown.attack.cardId,
      name: breakdown.attack.name,
      actionName: breakdown.attack.actionName,
    },
    {
      cardId: "humpback-anglerfish",
      name: "Anglerfish",
      actionName: "Lure",
    },
    "Side identity and action metadata must survive normalization so the no-paragraph UI remains self-contained",
  );
  assert.equal(breakdown.defense.cardId, "clownfish");
  assert.equal(breakdown.defense.name, "Clownfish", "A side label should act as its display-name fallback");
  assertSideAddsUp(breakdown.attack);
  assertSideAddsUp(breakdown.defense);
  assert.deepEqual(event, original, "Presentation normalization must not mutate the held result event");
});

test("missing arithmetic is reconciled explicitly instead of hiding it in prose", () => {
  const breakdown = buildCombatResultBreakdown({
    combatBreakdown: {
      attack: {
        contributors: [
          { id: "attack-roll", label: "Attack roll", value: 2, kind: "roll" },
        ],
        total: 4,
      },
      defense: {
        contributors: [
          { id: "defense-roll", label: "Defense roll", value: 1, kind: "roll" },
          { id: "defense-penalty", label: "Defense penalty", value: -3 },
        ],
        total: 0,
      },
    },
  });

  assert.deepEqual(
    breakdown.attack.contributors.map(({ label, value }) => ({ label, value })),
    [
      { label: "Attack roll", value: 2 },
      { label: "Other modifiers", value: 2 },
    ],
  );
  assert.deepEqual(
    breakdown.defense.contributors.map(({ label, value }) => ({ label, value })),
    [
      { label: "Defense roll", value: 1 },
      { label: "Defense penalty", value: -3 },
      { label: "Minimum total", value: 2 },
    ],
  );
  assertSideAddsUp(breakdown.attack);
  assertSideAddsUp(breakdown.defense);
});

test("legacy combat totals receive concise fallback rows without parsing result sentences", () => {
  const breakdown = buildCombatResultBreakdown({
    primaryAttackRoll: 2,
    attackTotal: 4,
    primaryDefenseRoll: 4,
    defenseTotal: 3,
    message: "A deliberately dense sentence that is not presentation data.",
  });

  assert.deepEqual(
    breakdown.attack.contributors.map(({ label, value, kind }) => ({ label, value, kind })),
    [
      { label: "Roll", value: 2, kind: "roll" },
      { label: "Other modifiers", value: 2, kind: "modifier" },
    ],
  );
  assert.deepEqual(
    breakdown.defense.contributors.map(({ label, value, kind }) => ({ label, value, kind })),
    [
      { label: "Roll", value: 4, kind: "roll" },
      { label: "Other modifiers", value: -1, kind: "modifier" },
    ],
  );
  assertSideAddsUp(breakdown.attack);
  assertSideAddsUp(breakdown.defense);
});

test("total-only special results use a neutral Result row rather than inventing a modifier", () => {
  const breakdown = buildCombatResultBreakdown({ attackTotal: 4 });

  assert.deepEqual(
    breakdown.attack.contributors.map(({ label, value, kind }) => ({ label, value, kind })),
    [{ label: "Result", value: 4, kind: "result" }],
  );
  assert.equal(breakdown.attack.total, 4);
  assert.equal(breakdown.defense, null);
  assertSideAddsUp(breakdown.attack);
});

test("Creature School attacks keep an attack result without fabricating a defense column", () => {
  const breakdown = buildCombatResultBreakdown({
    primaryAttackRoll: 3,
    attackTotal: 3,
    primaryDefenseRoll: null,
    defenseTotal: null,
  });

  assert.equal(breakdown.attack.total, 3);
  assert.equal(breakdown.defense, null);
  assertSideAddsUp(breakdown.attack);
});

test("evasion and unresolved events without finite values do not fabricate a breakdown", () => {
  assert.deepEqual(
    buildCombatResultBreakdown({ combatOutcome: "attack-blocked" }),
    { attack: null, defense: null },
  );
  assert.deepEqual(
    buildCombatResultBreakdown({
      combatOutcome: "unresolved",
      primaryAttackRoll: Number.NaN,
      attackTotal: Number.POSITIVE_INFINITY,
    }),
    { attack: null, defense: null },
  );

  const zero = buildCombatResultBreakdown({ primaryAttackRoll: 0, attackTotal: 0 });
  assert.equal(zero.attack.total, 0, "A real zero roll must not be mistaken for missing data");
  assert.equal(zero.attack.contributors[0].value, 0);
  assert.equal(zero.defense, null);
});

test("detail conversion and value formatting keep modifier rows short and signed", () => {
  assert.deepEqual(
    combatContributorsFromDetails([
      "+2 Deep Sea Jelly",
      "+1 from Stinging Fortress",
      "defense advantage 2/4",
    ]).map(({ label, value }) => ({ label, value })),
    [
      { label: "Deep Sea Jelly", value: 2 },
      { label: "Stinging Fortress", value: 1 },
    ],
  );
  assert.equal(formatCombatContributorValue({ kind: "roll", value: 2 }), "2");
  assert.equal(formatCombatContributorValue({ kind: "result", value: 4 }), "4");
  assert.equal(formatCombatContributorValue({ kind: "modifier", value: 2 }), "+2");
  assert.equal(formatCombatContributorValue({ kind: "modifier", value: -2 }), "-2");
  assert.equal(formatCombatContributorValue({ kind: "modifier", value: 0 }), "0");
});
