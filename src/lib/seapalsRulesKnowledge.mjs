/**
 * Player-facing rules derived from the public instructions, tutorial script,
 * structured card schema, and simulator rule modules. Keep these entries
 * concise so both deterministic retrieval and the browser-local model can use
 * them as grounded context.
 */
export const SIMULATOR_RULES = [
  {
    title: "How many players can play and recommended VP targets",
    text: "SeaPals is designed for 2 to 4 players. A recommended full game uses a 30 VP target, while a quick game can use 10 VP. Players should agree on the target before play begins.",
  },
  {
    title: "Deck construction",
    text: "A standard deck has 60 cards, allows up to 4 copies of a card, includes at least one Foundation card and a base Foundation, and contains at least 30 total printed Victory Points. Tournament-specific restrictions can override the defaults.",
  },
  {
    title: "Foundation and Pals deck routing",
    text: "Coral cards and Creature Schools belong in the Foundation Deck. Other playable cards, including regular creatures, Support cards, and Habitat cards, belong in the Pals Deck. Conditions use a separate shared Conditions Deck.",
  },
  {
    title: "Setup round",
    text: "Each player draws 4 Foundation cards and 4 Pals cards, starts with 3 RP, and spends setup RP to play a valid starting Foundation. If a player cannot play a valid Foundation, that player redraws the Foundation hand. Begin the first round after everyone has a starting Foundation.",
  },
  {
    title: "Round and turn structure",
    text: "At the start of a round, reveal and apply the next shared Condition. Players then take turns. A turn follows Choose, Collect, Build, and Attack, followed by end-of-turn maintenance and the transition to the next player.",
  },
  {
    title: "Choose and draw",
    text: "During Choose, draw from either your Foundation Deck or your Pals Deck. Effects can cause additional draws, searches, recovery, or deck reordering. If a mandatory draw is required and both personal decks are depleted, that player loses.",
  },
  {
    title: "Collecting RP",
    text: "During Collect, gain 1 RP and collect RP produced by active Foundations. Apply Condition and card modifiers, then discard RP above the current bank cap. The simulator's default RP bank cap is 8 unless a card or Condition changes it.",
  },
  {
    title: "Build phase and paid actions",
    text: "During Build, spend RP to play legal cards, upgrade Foundations, and use paid actions. Pay all printed and additional costs before resolving a play. Conditions can prevent certain card types from being played or modify their requirements.",
  },
  {
    title: "Habitat and class matching for Reef Fish and Deep slots",
    text: "A creature must match a slot's habitat zone and an accepted class. Reef, Oceanic, and Deep creatures cannot use one another's zone slots unless a card explicitly permits it. Fish slots accept Fish; Predator slots accept Fish or Predators; Apex slots accept Fish, Predators, or Apex; Invertebrate and Filter Feeder slots accept their own class.",
  },
  {
    title: "Coral upgrades",
    text: "To upgrade Coral, have the next printed stage in hand, pay its RP cost, and place it over the current stage. Each Coral can upgrade only once per turn. Existing damage is preserved: the upgraded Coral gains the increase in maximum health rather than healing all damage.",
  },
  {
    title: "Foundation destruction and what happens when Coral dies",
    text: "When a Coral or other Foundation is destroyed, its card leaves play and its VP immediately stops counting. Attached creatures are moved into compatible empty slots when possible. Creatures without a legal slot remain displaced until a compatible slot becomes available or another rule moves them.",
  },
  {
    title: "How normal attacks resolve",
    text: "Choose a target allowed by the attack's target icons and habitat restrictions. Roll the printed attack die and the target's defense die, including valid modifiers. The attack succeeds only when the attack total is higher; ties go to the defender. A successful normal creature attack discards the defending creature unless another effect saves it.",
  },
  {
    title: "What D4, D6, D8, D10, D12, and D20 mean",
    text: "The number after D is the number of sides on the die: D4 rolls 1 through 4, D6 rolls 1 through 6, D8 rolls 1 through 8, D10 rolls 1 through 10, D12 rolls 1 through 12, and D20 rolls 1 through 20. A modifier is applied after the roll, so D8+2 adds 2 and D6-1 subtracts 1. Modified totals cannot fall below zero. Advantage rolls twice and keeps the higher result; disadvantage rolls twice and keeps the lower result.",
  },
  {
    title: "Repeated attacks",
    text: "When an attack repeats, resolve every attack separately with its own target and rolls. The same physical target cannot be selected twice during that sequence. Modifiers that apply to the attack apply separately unless their text says they are consumed after one roll.",
  },
  {
    title: "Creature Schools and bait balls",
    text: "Creature Schools are Foundation cards that use School Density and health. They do not make defense rolls. When attacked, they take damage equal to the attack roll multiplied by 10 and are discarded at 0 HP. Creature Schools do not count as ordinary Fish for requirements that explicitly exclude schools.",
  },
  {
    title: "School Density requirements",
    text: "Some Oceanic cards require a minimum School Density before they can be played. Check the current density and any active reductions before paying costs. Sardine Run reduces the next qualifying Oceanic Predator requirement by 30 once per player; Krill Bloom reduces the next qualifying Filter Feeder requirement by 150 once per player.",
  },
  {
    title: "Oceanic Apex additional cost",
    text: "Playing an Oceanic Apex can require sacrificing either one Oceanic Predator or two distinct Oceanic Fish. The sacrificed physical cards leave play as the additional cost; duplicate card names still represent separate physical choices.",
  },
  {
    title: "What Conditions cards are used for",
    text: "The Conditions Deck is a separate shared deck that changes the round for everyone. Reveal the next Condition at the start of each round and apply its printed effect to all players for its stated duration. Conditions can change costs, card-play rules, School Density requirements, or RP production. For example, a Condition matching a Coral weakness such as Storm, High Temperature, or Disease stops that Coral from producing RP for the round without removing it.",
  },
  {
    title: "Victory Points",
    text: "Count VP only from cards currently in your ecosystem, including any conditional bonuses whose requirements are satisfied. If a VP card leaves play or its condition stops being true, remove those points. Reaching the agreed target wins. If multiple players reach it simultaneously, compare current VP totals and consult the latest official ruling if those totals are exactly tied.",
  },
  {
    title: "Hand limits and overflow",
    text: "When a draw, search, or recovery would put more cards into a hand than its current limit allows, keep cards only up to the limit and place the overflow into the discard pile in resolution order. Cards are still considered drawn even when hand-limit overflow discards them.",
  },
  {
    title: "Support cards",
    text: "Support cards resolve their printed effects, such as healing, drawing, searching, recovering, changing RP, or modifying the next play or attack. Unless a Support explicitly remains in play, it goes to discard after resolving. A Support that explicitly locks further Support play prevents additional Support cards for its stated duration.",
  },
  {
    title: "Searching and recovering cards",
    text: "A search looks through the named deck or zone for a card matching the printed restrictions. Reveal or select the card as instructed, move it to the stated destination, then shuffle when required. Recovery moves an eligible card from discard to hand or deck; hand-limit overflow can return it to discard.",
  },
  {
    title: "Toxic creatures",
    text: "A Toxic effect applies only according to its printed trigger. Toxic When Eaten affects a creature that successfully consumes the Toxic card, unless the attacker has explicit immunity or a protection such as Poison Heal. A pre-attack coin-flip Toxic effect is separate and should not also be treated as Toxic When Eaten unless the card says so.",
  },
  {
    title: "Regenerate",
    text: "When a creature with Regenerate is successfully attacked, its controller may pay the printed RP cost to keep it in play. Regenerate is optional, requires enough RP, and does not apply after another survival effect has already resolved for that destruction.",
  },
  {
    title: "Massive, advantage, and disadvantage",
    text: "Read the exact Massive text on the card. Some Massive creatures cause attacks against them to roll with disadvantage; others roll their defense with advantage. Defensive advantage rolls twice and uses the higher defense result. Effects that ignore defensive bonuses also suppress applicable advantage bonuses.",
  },
  {
    title: "Cloak and Transparency",
    text: "Cloak does not make a creature untargetable; it grants the printed defensive benefit, implemented as +3 defense for the current Cloak cards. Transparency can prevent attacks whose printed die has more faces than the listed limit; modifiers do not change the die's printed size for this check.",
  },
  {
    title: "Deep creatures and Abyss",
    text: "Deep creatures use Deep slots and Deep-targeting restrictions. Abyss enables Deep ecosystem interactions. Darkness Shroud grants its defense bonus only while Abyss is in play. An attack restricted to Deep targets cannot target a Reef creature merely because that creature has a similarly named tag.",
  },
  {
    title: "Habitats",
    text: "Habitat cards are played from the Pals Deck and remain as independent cards in the ecosystem. Each physical copy tracks its own health and effects. Open Ocean and Abyss enable their related creature strategies; damage or destruction affects only the targeted Habitat copy.",
  },
  {
    title: "Coral Reef Habitat maintenance",
    text: "Coral Reef has 40 HP and requires 4 true Corals, 2 non-school Fish, and 2 non-school Invertebrates in play. At end of turn, if that composition is not met, each Coral Reef takes 10 damage. Destroy it when its health reaches zero.",
  },
  {
    title: "Attachments and special hosts",
    text: "Some cards can be placed in special hosts when their allowed host tag matches and the host has capacity. Hosted cards retain their own physical identity. If a hosted creature moves with its primary host creature, the hosted cards move with it unless another effect says otherwise.",
  },
  {
    title: "Continuous health bonuses",
    text: "Continuous health bonuses increase both current and maximum health while active without erasing existing damage. When the bonus leaves, reduce maximum and current health by the bonus; if current health becomes zero, the card is destroyed. Unique-per-host bonuses do not stack twice from the same named effect on one host.",
  },
  {
    title: "Action timing and cooldowns",
    text: "Resolve actions at their printed timing, pay their costs, choose legal targets, and apply their effects in order. Once-per-turn actions remain used for that physical card until its controller's next turn. Moving a creature does not reset its identity or action cooldown.",
  },
  {
    title: "Star icons and colored circles under On Play abilities",
    text: "A colored circle containing a star is a family target icon. It means any subtype in that pictured family can satisfy or be targeted by the ability. For example, the Any Apex star can refer to a Reef, Oceanic, or Deep Apex, while Any Creature can refer to any creature family allowed by the effect. The surrounding On Play text explains what happens when the card enters play; read the star icons as the legal families for that effect.",
  },
  {
    title: "Lost Zone boundary",
    text: "The current rules repository shows a Lost Zone, but no complete source-of-truth effect currently sends cards there. Do not move a card to the Lost Zone unless its printed rule or a future official rule explicitly says to do so.",
  },
  {
    title: "Stunned boundary",
    text: "The current rules data can mark a Coral as Stunned, but it does not yet define an automatic gameplay consequence or expiration. Follow the printed card and latest official rules rather than inventing an additional penalty.",
  },
  {
    title: "Unknown or incomplete card effects",
    text: "When a printed effect is incomplete or missing from the current source-of-truth rules, resolve only the clearly documented portion and do not invent the rest. Consult the latest How to Play guide or official card ruling for unresolved edge cases.",
  },
].map((rule) => ({ ...rule, source: "knowledge" }));
