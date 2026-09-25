import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  getActionAccessibleLabel,
  getAttackActionPresentation,
} from "./attackActionPresentation.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("Crunch presents its die and generic Invertebrate target symbol", () => {
  const presentation = getAttackActionPresentation({
    attackDice: "D4",
    targetCategories: ["invertebrate"],
  });

  assert.equal(presentation.attackDice, "D4");
  assert.deepEqual(presentation.targets, [{
    category: "invertebrate",
    icon: "/images/icons/invertebrate_any.png",
    label: "any Invertebrate",
  }]);
  assert.equal(presentation.accessibleTargetSummary, "any Invertebrate");
});

test("multi-family targets retain source order and remove duplicates", () => {
  const presentation = getAttackActionPresentation({
    attackDice: "D8",
    targetCategories: ["apex", "predator", "fish", "predator"],
  });

  assert.deepEqual(
    presentation.targets.map(({ category, icon }) => ({ category, icon })),
    [
      { category: "apex", icon: "/images/icons/apex-any.png" },
      { category: "predator", icon: "/images/icons/predator-any.png" },
      { category: "fish", icon: "/images/icons/fish-any.png" },
    ],
  );
  assert.equal(presentation.accessibleTargetSummary, "any Apex, any Predator, or any Fish");
});

test("unrestricted and habitat-specific attacks use truthful symbols", () => {
  const unrestricted = getAttackActionPresentation({ attackDice: "D6" });
  assert.equal(unrestricted.targets[0].icon, "/images/icons/any-creature.png");
  assert.equal(unrestricted.accessibleTargetSummary, "any Creature");

  const deepFish = getAttackActionPresentation({
    attackDice: "D6",
    targetCategories: ["fish"],
    targetZone: "deep",
  });
  assert.equal(deepFish.targets[0].icon, "/images/icons/deep-fish-icon.png");
  assert.equal(deepFish.accessibleTargetSummary, "Deep Fish");
});

test("specific prey tags remain visible and accessible beside the family symbol", () => {
  const presentation = getAttackActionPresentation({
    attackDice: "D4",
    targetCategories: ["invertebrate"],
    targetTags: ["sea-urchin", "anemone"],
  });

  assert.equal(presentation.restrictionSummary, "Only Sea Urchin or Anemone");
  assert.equal(
    presentation.accessibleTargetSummary,
    "any Invertebrate, limited to Sea Urchin or Anemone",
  );
});

test("action labels announce combat facts while utility labels stay concise", () => {
  const availability = { ready: true, status: "Ready", reason: "" };
  const attack = {
    label: "Crunch",
    kind: "attack",
    attackDice: "D4",
    targetCategories: ["invertebrate"],
    cost: 1,
    availability,
  };
  assert.equal(
    getActionAccessibleLabel(attack, getAttackActionPresentation(attack)),
    "Crunch, D4 attack, targets any Invertebrate, costs 1 RP, ready to use",
  );

  assert.equal(
    getActionAccessibleLabel({
      label: "Scavenge",
      kind: "utility",
      cost: 0,
      availability,
    }),
    "Scavenge, ready to use",
  );

  const unavailable = {
    ...attack,
    availability: {
      ready: false,
      status: "No valid targets",
      reason: "Crunch has no compatible target in the opponent's ecosystem.",
    },
  };
  assert.equal(
    getActionAccessibleLabel(unavailable, getAttackActionPresentation(unavailable)),
    "Crunch, D4 attack, targets any Invertebrate, costs 1 RP, unavailable: Crunch has no compatible target in the opponent's ecosystem.",
  );
});

test("every generic target-family presentation points at a shipped icon", async () => {
  const presentation = getAttackActionPresentation({
    targetCategories: ["fish", "predator", "apex", "invertebrate", "filter-feeder"],
  });

  await Promise.all(presentation.targets.map((target) => (
    access(path.join(projectRoot, "public", target.icon.replace(/^\//, "")))
  )));
});
