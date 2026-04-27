export const CardKind = {
  CREATURE: "creature",
  CORAL: "coral",
  SUPPORT: "support",
  STRUCTURE: "structure",
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
  STRUCTURE: "structure",
  CONDITION: "condition",
};

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
  STRUCTURE: "structure_icon",

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

  // Special board/game objects
  CREATE_ATTACKABLE_VP_CARD: "createAttackableVpCard",

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