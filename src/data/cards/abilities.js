import { Timing } from "./types";

export const ecoBoost = (amount = 1) => ({
  id: "eco-boost",
  name: "Eco Boost",
  text: `Add +${amount} to your max resource bank while this card is in play.`,
  timing: Timing.PASSIVE,
  effect: { type: "modifyRpBankCap", controller: "you", amount, duration: "whileInPlay" },
});

export const venomous = {
  id: "venomous",
  name: "Venomous",
  text: "Attackers have disadvantage.",
  timing: Timing.PASSIVE,
  effect: { type: "attackDisadvantage" },
};
