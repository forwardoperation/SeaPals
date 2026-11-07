// Shared by the instructions and Finn so tabletop procedures stay in sync.
// Adopted for the how-to-play guide on 2026-10-16.
export const FIRST_PLAYER_RULE = {
  id: "tabletop:first-player",
  title: "Choosing the first player",
  summary: "A coin toss for 2 players; a D20 roll for 3–4",
  text: "Choose the first player before setup. With 2 players, assign one side of a coin to each player, then flip it; the player whose side lands face up goes first. With 3 or 4 players, everyone rolls a D20. The highest roll goes first; if the highest roll is tied, only those tied players roll again until one wins. Take turns clockwise, keeping the same starting player and turn order each round.",
  keywords: ["first player", "who goes first", "opening toss", "coin flip", "turn order", "D20"],
  sourceHref: "/instructions#first-player",
};

export const CONDITIONS_DECK_RULE = {
  id: "tabletop:conditions-exhaustion",
  title: "When the Conditions Deck runs out",
  summary: "Recycle expired Conditions; keep persistent cards and their used benefits aside",
  text: "At the end of a round, discard the shared Condition if its printed duration has ended. When a new round needs a Condition and the Conditions Deck is empty, shuffle the discarded Conditions to make a new deck, then reveal its top card. A Condition can appear in consecutive rounds after this shuffle. Keep persistent Conditions in play as their text instructs; do not shuffle them back or reset benefits already used. Sardine Run and Krill Bloom stay aside even after every player has used their one-time benefit. If there are no eligible discarded Conditions, start the round without a new Condition and continue playing; existing persistent effects still apply. An empty Conditions Deck never causes a deck-out loss.",
  keywords: ["Conditions Deck", "empty", "exhausted", "run out", "reshuffle", "persistent", "weather deck"],
  sourceHref: "/instructions#conditions-exhaustion",
};

export const SIMULTANEOUS_VICTORY_RULE = {
  id: "tabletop:simultaneous-victory",
  title: "Simultaneous VP finishes",
  summary: "Highest VP wins; an equal lead keeps the game going",
  text: "Finish resolving the play or effect that changes VP, then check everyone's current VP. A player at or above the agreed target wins if they have the highest VP total outright. If multiple players reach the target together, the highest total wins. If the highest totals are equal, nobody wins yet: continue the normal turn order until a player has a sole lead at or above the target. Recheck after each resolved play or effect; losing VP can also break the tie. For example, at a 30 VP target, 32 beats 30, but 30–30 continues. Neither the first player nor the active player wins a tied score automatically.",
  keywords: ["simultaneous", "VP tie", "tied score", "same points", "both win", "same time", "victory target"],
  sourceHref: "/instructions#simultaneous-victory",
};

export const TABLETOP_PROCEDURES = [
  FIRST_PLAYER_RULE,
  CONDITIONS_DECK_RULE,
  SIMULTANEOUS_VICTORY_RULE,
];
