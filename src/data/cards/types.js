export const CardKind = {
  CREATURE: "creature",
  CORAL: "coral",
  SUPPORT: "support",
  HABITAT: "habitat",
  CONDITION: "condition",
};

export const CardCategory = {
  APEX: "apex",
  FISH: "fish",
  PREDATOR: "predator",
  INVERTEBRATE: "invertebrate",
  FILTER_FEEDER: "filter-feeder",
  CORAL: "coral",
  SUPPORT: "support",
  HABITAT: "habitat",
  CONDITION: "condition",
};

export const CreatureZone = {
  REEF: "reef",
  OCEAN: "ocean",
  DEEP: "deep",
};

export const CreatureClass = {
  INVERTEBRATE: "invertebrate",
  CORAL: "coral",
  FILTER_FEEDER: "filter_feeder",
  FISH: "fish",
  PREDATOR: "predator",
  APEX: "apex",
};

export const CreatureSubtype = {
  BAITBALL: "baitball",
  OCEANIC: "oceanic",
};

export function formatCreatureZone(zone) {
  if (!zone) return "";

  return String(zone)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatCreatureClass(creatureClass) {
  if (!creatureClass) return "";

  return String(creatureClass)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatCreatureSubtype(subtype) {
  if (!subtype) return "";

  return String(subtype)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatCreatureType(card) {
  if (!card?.zone || !card?.class) return "";

  return [
    formatCreatureZone(card.zone),
    formatCreatureSubtype(card.subtype),
    formatCreatureClass(card.class),
  ]
    .filter(Boolean)
    .join(" ");
}

export function getAcceptedClassesForSlot(slotClass) {
  switch (slotClass) {
    case CreatureClass.FISH:
      return [CreatureClass.FISH];

    case CreatureClass.PREDATOR:
      return [CreatureClass.FISH, CreatureClass.PREDATOR];

    case CreatureClass.APEX:
      return [CreatureClass.FISH, CreatureClass.PREDATOR, CreatureClass.APEX];

    case CreatureClass.INVERTEBRATE:
      return [CreatureClass.INVERTEBRATE];

    case CreatureClass.FILTER_FEEDER:
      return [CreatureClass.FILTER_FEEDER];

    default:
      return [slotClass];
  }
}

export function makeCreatureSlot(zone, slotClass) {
  return {
    zone,
    slotClass,
    accepts: getAcceptedClassesForSlot(slotClass),
  };
}

export function canCardOccupySlot(card, slot) {
  if (!card || !slot) return false;
  if (card.zone !== slot.zone) return false;
  return slot.accepts?.includes(card.class) ?? false;
}

export const Weakness = {
  STORM: "storm",
  HIGH_TEMPERATURE: "high-temperature",
  DISEASE: "disease",
};

export const CardIcon = {
  APEX: "apex_icon",
  PREDATOR: "predator_icon",
  PELAGIC: "pelagic_icon",
  CORAL: "coral_icon",
  FISH: "fish_icon",
  INVERTEBRATE: "invertebrate_icon",
  HABITAT: "environment_icon",

  D10_ATTACK: "d10_attack",
};

export const Timing = {
  ON_PLAY: "onPlay",
  PASSIVE: "whileInPlay",
  START_OF_TURN: "startOfTurn",
  ACTION_PHASE: "actionPhase",
  ON_DESTROYED: "onDestroyed",
  ON_UPGRADE: "onUpgrade",
};

export const EffectType = {
  // Core combat
  DAMAGE: "damage",
  ATTACK: "attack",
  MODIFY_DEFENSE_ROLL: "modifyDefenseRoll",

  // Resources / economy
  GAIN_RESOURCE: "gainResource",
  MODIFY_PLAY_COST: "modifyPlayCost",
  MODIFY_RP_BANK_CAP: "modifyRpBankCap",
  MODIFY_RP_GENERATION: "modifyRpGeneration",
  PREVENT_RP_GENERATION: "preventRpGeneration",

  // Card flow
  DRAW_CARDS: "drawCards",
  SEARCH_DECK: "searchDeck",
  DISCARD_RANDOM_CARD: "discardRandomCard",
  RECOVER_CARD_FROM_DISCARD: "recoverCardFromDiscard",
  MOVE_CARD: "moveCard",

  // Play restrictions / permissions
  PREVENT_CARD_PLAY: "preventCardPlay",
  ENABLE_FILTER_FEEDER_PLAY: "enableFilterFeederPlay",
  ENABLE_TARGETING_HIDDEN_CREATURES: "enableTargetingHiddenCreatures",

  // Special board/game objects
  CREATE_ATTACKABLE_VP_CARD: "createAttackableVpCard",
  CREATE_BAITBALL_STACK: "createBaitballStack",
  MODIFY_PREY_DENSITY: "modifyPreyDensity",

  // Upgrades / attachments
  UPGRADE_CARD: "upgradeCard",
  ATTACH_TO_CARD: "attachToCard",

  // Status / conditions
  STUN_CORAL: "stunCoral",
  GRANT_CONDITION: "grantCondition",
  IGNORE_EFFECT: "ignoreEffect",

  // Dice / randomness
  FLIP_COIN: "flipCoin",
  ROLL_DICE_FOR_RESOURCE: "rollDiceForResource",

  // Passive / triggered mechanics
  TOXIC_WHEN_EATEN: "toxicWhenEaten",
  DISCARD_CONSUMING_CREATURE: "discardConsumingCreature",
  RECYCLE_ON_EATEN: "recycleOnEaten",

  // Buffs / modifiers
  GRANT_DEFENSE_ADVANTAGE: "grantDefenseAdvantage",
  MODIFY_HEALTH: "modifyHealth",
};

export const Zone = {
  HAND: "hand",
  YOUR_REEF: "yourReef",
  OPPONENT_REEF: "opponentReef",
  DECK: "deck",
  DISCARD: "discard",
};

export const Duration = {
  THIS_TURN: "thisTurn",
  NEXT_TURN: "nextTurn",
  NEXT_ROUND: "nextRound",
  ROUND: "round",
  WHILE_IN_PLAY: "whileInPlay",
  UNTIL_YOUR_NEXT_TURN: "untilYourNextTurn",
  OPPONENT_NEXT_TURN: "opponentNextTurn",
  NEXT_ATTACK: "nextAttack",
};

export const GamePhase = {
  START_OF_ROUND: "startOfRound",
  DRAW: "draw",
  MAIN: "main",
  ACTION: "action",
  END: "end",
};
