# SeaPals Simulator Implementation Status

This is the living audit and continuation checkpoint for the simulator. The rules in
`src/app/instructions`, `src/app/tutorial`, and `src/data/cards` are the source of
truth. When those sources do not define a consequence, the simulator displays that
limitation instead of inventing a rule.

## Current priorities

1. Complete the Coral Garden teaching path and opponent parity.
2. Extract additional pure rule transitions from `Simulator.jsx` as behavior settles.
3. Cover other prebuilt decks' structured card effects, starting with effects that
   already have complete card data.
4. Expand rendered browser-path verification through combat-heavy wins, losses, and
   optional effect branches.

## Implemented gameplay

- New-game introduction, independent player/opponent deck selection, Setup Round,
  4 Foundation plus 4 Pals opening hands, Foundation mulligans, and the default
  Coral Garden teaching deck.
- Foundation/Pals deck separation, hand limits, discard piles, empty-deck loss,
  split multi-card draws, reveal feedback, searches, recovery, and deck reordering.
- Turn and round transitions, start-of-turn RP collection, RP bank caps, condition
  modifiers, visible prompts, action logs, and restart behavior. Turn order enforces
  Choose/Draw before Collect. Player and opponent turns each have a dedicated summary
  transition, and legal plays, abilities, and attacks can be taken in any order.
- Conditions deck with card-art round reveal events, persistent Sardine Run and
  Krill Bloom once-per-player School Density reductions, supported global condition
  effects, and visible warnings for unknown effects.
- Coral placement, cursor-focused ecosystem zoom/pan, Zoom to Fit, upgrades after a
  full turn, damage preservation, compatible slots, creature placement, Creature
  Schools, Oceanic creatures, draggable/inspectable Habitat and Open Water cards on
  both boards, and cancelable placement/target modes. Both ecosystems have independent
  view state; opponent auto-fit no longer overwrites a manually adjusted view, pointer
  capture survives leaving the board, and floating-card dragging is zoom-correct.
- RP costs and deductions, EcoBoost/Abundant Sunlight caps, RP income, VP-in-play
  totals, conditional VP, a configurable 10/30 VP target, and simultaneous victory.
- Player and opponent ecosystem state, deterministic opponent draw/play/upgrade,
  core draw and dice-RP creature actions, mirrored inspection controls, board-impact
  events, and turn summaries. Opponent turns now expose start-of-turn draw/collection,
  each Support and its impact, permanent plays, utility actions, every repeated attack,
  optional Regenerate decisions, and Habitat maintenance as ordered event snapshots.
  Each matching player/opponent board mutation and Recent Events entry commits only
  when that event closes, followed by a visible Thinking beat.
- Opposed attacks, interactive player dice stopping, ties to the defender, advantage,
  disadvantage, repeat attacks, cooldowns, Creature School damage, Toxic, Poison
  Heal, Blue Crab Recycle, Plenteous, Ancient Resilience, Black Swallower's conditional
  self-discard, Transparency targeting, and on-play attacks. Repeat attacks preserve
  distinct card identities through hosted, slotted, open-water, and orphan movement;
  an optional Regenerate choice resumes any remaining attacks afterward.
- Coral damage/destruction with compatible creature redistribution, explicit orphan
  creature state and later automatic re-slotting, immediate VP changes, Sturdy
  continuous health, per-host Sea Urchin/Sargeant Major HP bonuses, Bamboo Coral
  Shelter defense, and Elkhorn Fragment recovery on implemented destruction paths.
- Coral Garden support and action mechanics including Coral Heal, Coral Cement,
  Recovery, Restocking, Dr. Evans, Scientist Jes, Remote Search, Fishing, Arrow Crab,
  Cleaner Shrimp, conditional Parrotfish damage, and Dolphin attack advantages.
  Dr. Evans can split its seven draws, duplicate Restocking targets remain distinct,
  and recovered Foundation cards return to the Foundation deck. Green Sea Turtle's
  mandatory On Play Coral Heal also resolves for the automated opponent, targets the
  most damaged legal Coral, and never treats a Creature School as a Coral.
- Open Ocean and Deep teaching paths include interactive Oceanic Apex sacrifices,
  School Density checks and one-use condition discounts, On Play deck discard/search/
  draw/reorder effects, Tripod Fish Vantage Point, Ocean Triggerfish Territorial target
  selection, Crevalle RP gain, Deep Sea Jelly's next-turn Flashing Alarm for both
  controllers, and deterministic opponent equivalents.
- Stunned now has a complete controller-parity lifecycle: an affected Coral
  produces no RP, contributes none of its own passives, cannot use its own
  actions, and cannot upgrade through the end of its controller's next turn.
  The board keeps the status visible, end-turn logs announce recovery, and Coral
  Heal clears it early.
- Lionfish now invades the rival physical reef for either controller while its
  controller identity remains on the card instance. The invaded controller can
  target and remove it with a successful legal attack or Spearfishing. Because
  Spearfishing targets a Fish or Predator physically on the acting player's reef,
  an opponent-owned Lionfish is eligible. Lionfish has no Lost Zone
  instruction, so a successful attack or Spearfishing sends it to its original
  owner's discard pile. Spearfishing itself enters the acting player's discard
  pile, and awards the recovered RP only to that acting player.
  The maintained Invader ruling triggers at the start of the turn of the player
  whose ecosystem physically contains Lionfish, but resolves targets from the
  Lionfish owner's perspective: heads attacks an opponent-controlled Fish and
  tails attacks another owner-controlled Fish. The triggering Lionfish is
  excluded; if the rolled branch has no legal target, the attack fizzles without
  switching branches.
- Cookie Cutter Parasite now transfers opposing RP first, collects any shortfall
  from the shared board supply up to the recipient's live bank cap, and reports
  both sources separately. Giant and Colossal Squid resolve a fresh Ensnare coin
  flip before every attack in a repeated On Play sequence for both controllers.

## Known rule/data boundaries

- Apex and Filter Feeder card data defines the printed destruction destination:
  when one of those creatures is destroyed in combat, the simulator moves it to
  its owner's Lost Zone instead of discard. Lionfish has no such
  instruction, so both destruction and Spearfishing send it to its owner's discard.
- Complex companion effects on an otherwise supported attack resolve the documented
  attack portion and explicitly identify the remainder as unsupported.
- Several original card-art files remain absent from the repository. Every absent art
  reference points directly to a bundled SeaPals placeholder, avoiding failed requests
  and browser-console noise. White Grunt now has supplied art and structured Creature
  School rules; its printed three-school-stack maximum is not yet generically enforced,
  though the starter decks contain only two copies and cannot exceed it.
- Several advanced legacy Deep-card companion effects remain visible but explicitly
  marked as unsupported when their complete consequence cannot be derived without
  inventing rules.
- The automated opponent ranks legal permanent plays and useful Support cards, then
  performs an available utility action or attack. It is intentionally rules-focused
  rather than strategically exhaustive.

## Verification checkpoint

- Simulator suite: `npm.cmd run test:simulator` (**349/349 passed** on 2026-08-11),
  including Stunned lifecycle, Parasite supply fallback, per-attack Ensnare,
  Lionfish start-of-host-turn Invader resolution and owner-zone routing,
  Flashing Alarm lifecycle, and automatic legal Coral Heal targeting.
- Full repository suite: `npm.cmd test` (**1183/1183 passed** on 2026-08-11).
- Production build: `npm.cmd run build` (**154 static pages generated** on 2026-08-11).
- Diff whitespace and duplicate named-function audits pass.
- Rendered browser verification covers every prebuilt deck's opening setup, an Open
  Ocean setup-to-opponent-turn sequence, correct opponent summary/draw ordering,
  missing-art fallbacks, player-to-opponent transition timing, and an opponent Support
  followed by a permanent whose board mutation appeared only after its event closed.
  It also covers the explicit opponent start-of-turn beat, delayed event logging,
  independently staged repeated-attack state, and the Round 2 condition screen appearing
  after the `Your Turn` summary but before the next draw chooser.
  Fixed-height 1440x900 plus 390x844 layouts have no page errors or document overflow.

## Remaining completion work

- Inventory every effect used by every prebuilt deck and implement or visibly mark
  each unsupported effect.
- Improve opponent parity for non-attack activated abilities and optional sequencing.
- Extract and test opponent turn/play/attack transitions as pure helpers.
- Verify complete combat-heavy setup-to-victory and depletion-loss paths in a rendered
  browser, including every optional target choice and advanced deck effect.
- Replace the remaining component-level continuous-health reconciliation side effects
  with explicit rule transitions so future event snapshots cannot depend on React
  effect timing.
- Import final source artwork and rules for repository-missing cards when those assets
  become available.
- Re-audit all card-removal paths when additional damage/destruction effects are added.
