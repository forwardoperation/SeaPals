# Simulator opponent strategy

Simulator V2 and the original simulator share `src/app/simulator/Simulator.jsx`.
Difficulty changes decision policy and action budgets, never card legality or dice.

| Difficulty | Permanent plays | Optional actions | Combat decisions |
| --- | --- | --- | --- |
| Easy | One primary play | One Support, one utility, one normal attack | Sensible target for the first profitable attacker |
| Medium | Primary plus one straightforward followup | All useful Supports, utilities, and normal attacks | Compare immediate attacker/target trades |
| Hard | Primary plus affordable straightforward followups | All useful Supports, utilities, and normal attacks | Compare expected repeat sequences, attacker survival, and public engine disruption |

All levels recognize immediate wins, draw toward missing infrastructure or
creatures, and preserve RP for productive actions. Permanent scoring uses net
ecosystem VP (including upgrades, sacrifices, and synergies), net income, and
useful placement, density, or habitat unlocks. It reevaluates after each play.

Combat planning enumerates ordinary dice outcomes without consuming the gameplay
random stream. It considers defender-wins-ties, advantage/disadvantage, defense
bonuses, evasion, Scatter, Toxic, counterattacks, survival abilities, and School
damage. Voluntary bad trades may be skipped; mandatory On Play effects and paid
repeat sequences still resolve. A repeated action stays on the same instance
and pays its action cost once. RP reservation uses this same planner so a
rejected attack cannot block an otherwise useful permanent.

Search effects may inspect their authorized search pool. Ordinary draws choose
a personal deck using the AI's own hand and public board, without inspecting
hidden top cards. Limited top-card effects choose their deck before inspection.

## Code and validation

- `opponentDifficultyRules.mjs`: stable choice ordering and draw policy.
- `opponentPlayRules.mjs`: strategic values, winning-play priority, and budgets.
- `opponentBoardEvaluation.mjs`: net VP projection and foundation target choice.
- `opponentCombatRules.mjs`: dice probabilities and combat plan selection.
- `opponent*Runtime.test.mjs` and `opponentCombatIntegration.test.mjs`: executable
  scenarios against the actual functions extracted from the simulator.

Run `npm run test:simulator` and `npm run build -- --webpack` (use `npm.cmd` in
PowerShell when its script execution policy blocks `npm.ps1`).

## Limits

This is a deterministic heuristic opponent, not a full game-tree search. Complex
On Play cards remain primary plays so their interactive resolution is preserved;
they are not chained as generic followups. Strength against humans still needs
playtesting across deck matchups. Regression scenarios establish decision
correctness, not a measured human win rate.
