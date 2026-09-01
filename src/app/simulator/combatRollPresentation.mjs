import { createSeededRandom, rollDie } from "./gameRules.mjs";

export function createCombatRollPacket(attackExpression, defenseExpression = null, random = Math.random) {
  const seed = Math.floor(random() * 0x100000000) >>> 0;
  const seededRandom = createSeededRandom(seed);
  const attackRoll = rollDie(attackExpression, seededRandom);
  const defenseRoll = defenseExpression ? rollDie(defenseExpression, seededRandom) : null;
  if (!attackRoll || (defenseExpression && !defenseRoll)) return null;

  return {
    seed,
    attackExpression,
    defenseExpression,
    attack: attackRoll.total,
    defense: defenseRoll?.total ?? 0,
    attackRolls: [{ key: "attack-primary", expression: attackExpression, ...attackRoll }],
    defenseRolls: defenseRoll
      ? [{ key: "defense-primary", expression: defenseExpression, ...defenseRoll }]
      : [],
  };
}

export function createCombatResolutionRandom(packet) {
  if (!Number.isFinite(packet?.seed)) return Math.random;
  const random = createSeededRandom(packet.seed);
  const attackExpression = packet.attackExpression ?? packet.attackRolls?.[0]?.expression;
  const defenseExpression = packet.defenseExpression ?? packet.defenseRolls?.[0]?.expression;
  if (attackExpression) rollDie(attackExpression, random);
  if (defenseExpression) rollDie(defenseExpression, random);
  return random;
}
