import { SIMULATOR_V2_LESSON_CONCEPTS } from "./simulatorV2Lessons.mjs";

export const SIMULATOR_V2_COMBAT_TEACHING_STEP_COUNT = 3;

const DIE_SIDE_WORDS = Object.freeze({
  4: "four",
  6: "six",
  8: "eight",
  10: "ten",
  12: "twelve",
  20: "twenty",
});

function finiteNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function rollDetails(side) {
  const contributor = side?.contributors?.find((entry) => entry?.kind === "roll") ?? null;
  if (!contributor) return null;
  const value = finiteNumber(contributor.value);
  const match = String(contributor.detail ?? "").match(/\bD(\d+)(?:\s*[+-]\s*\d+)?\b/i);
  const sides = match ? Number(match[1]) : null;
  return {
    value,
    die: Number.isFinite(sides) && sides > 0 ? `D${sides}` : "",
    sides: Number.isFinite(sides) && sides > 0 ? sides : null,
  };
}

function dieDescription(roll) {
  if (!roll?.die || !roll.sides) return "";
  const sideWord = DIE_SIDE_WORDS[roll.sides] ?? String(roll.sides);
  return `, a ${sideWord}-sided die`;
}

function sentence(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function consequenceSentence(consequences) {
  const entries = Array.isArray(consequences) ? consequences.filter(Boolean) : [];
  const primary = entries.find((entry) => [
    "defender-stays",
    "defender-survived",
    "primary-card-movement",
  ].includes(entry?.id)) ?? entries.at(-1) ?? null;
  if (!primary) return "";
  const label = String(primary.label ?? "").trim();
  const detail = String(primary.detail ?? "").trim().replace(/^\u2192\s*/, "goes to the ");
  return sentence([label, detail].filter(Boolean).join(" "));
}

export function shouldTeachSimulatorV2CombatResult({
  lesson,
  previouslyTaughtConcepts = [],
  alreadyExplained = false,
  eventType,
  breakdown,
} = {}) {
  return Boolean(
    lesson
    && Number(lesson.number) >= 2
    && eventType === "faceoff-result"
    && breakdown?.attack
    && breakdown?.defense
    && !alreadyExplained
    && !previouslyTaughtConcepts.includes(SIMULATOR_V2_LESSON_CONCEPTS.ATTACKING)
  );
}

export function buildSimulatorV2CombatResultTeachingSteps({
  breakdown,
  consequences = [],
  attackName,
  defenseName,
} = {}) {
  const attack = breakdown?.attack;
  const defense = breakdown?.defense;
  if (!attack || !defense) return [];

  const resolvedAttackName = String(attackName ?? attack.name ?? "The attacker").trim() || "The attacker";
  const resolvedDefenseName = String(defenseName ?? defense.name ?? "The defender").trim() || "The defender";
  const attackAction = String(attack.actionName ?? "").trim() || resolvedAttackName;
  const attackRoll = rollDetails(attack);
  const defenseRoll = rollDetails(defense);
  const attackTotal = finiteNumber(attack.total);
  const defenseTotal = finiteNumber(defense.total);

  const attackMessage = attackRoll?.value != null
    ? `${attackAction} rolled ${attackRoll.value}${attackRoll.die ? ` on a ${attackRoll.die}${dieDescription(attackRoll)}` : ""}.`
    : `${resolvedAttackName}'s final attack total is ${attackTotal ?? "shown below"}.`;
  const defenseMessage = defenseRoll?.value != null
    ? `${resolvedDefenseName} rolled ${defenseRoll.value}${defenseRoll.die ? ` for defense on a ${defenseRoll.die}${dieDescription(defenseRoll)}` : " for defense"}.`
    : `${resolvedDefenseName}'s final defense total is ${defenseTotal ?? "shown below"}.`;

  let comparison = "Compare the final totals below.";
  if (attackTotal != null && defenseTotal != null) {
    comparison = attackTotal > defenseTotal
      ? `Here, ${attackTotal} is higher than ${defenseTotal}, so the attack succeeds.`
      : attackTotal < defenseTotal
        ? `Here, ${attackTotal} is lower than ${defenseTotal}, so the attack is blocked.`
        : `Here, both totals are ${attackTotal}, so defense holds the tie.`;
  }
  const consequence = consequenceSentence(consequences);

  return [
    {
      id: "attack",
      focus: "attack",
      message: ["Let’s read that faceoff!", attackMessage].filter(Boolean).join(" "),
    },
    {
      id: "defense",
      focus: "defense",
      message: defenseMessage,
    },
    {
      id: "outcome",
      focus: "outcome",
      message: [
        "Now compare the final totals. The attacker must finish higher; ties favor the defender.",
        comparison,
        consequence,
      ].filter(Boolean).join(" "),
    },
  ];
}
