# SeaPals Adventure Phase 2 - Academy Onboarding

**Status:** Implementation complete; full interactive 26 VP curriculum completion with each starter, target-age playtesting, and named marine-science review remain open gates

**Branch:** `codex/seapals-adventure`

**Scope source:** `docs/seapals-adventure-game-scope.md`

## Player-facing result

- New voyages begin inside the illustrated Shellshore Academy lab with Professor Marlow Current, an original older marine ecologist with gray hair.
- Professor Current introduces three complete starter decks: Coral Garden, Murky Water, and Blue Water. Each preview includes habitat, play style, five one-to-five metrics, strengths, and a strategy tip.
- Starter choice uses an explicit permanent-choice confirmation. The selected starter becomes the active simulator deck, initializes its exact 60-card owned collection, and appears on the voyage profile.
- Before play, Professor Current walks the player through nine board regions, then hands off to the opening coin flip; the tutorial always lets the player go first while ordinary games and completed Academy rematches use a real random result.
- The professor launches a scripted seven-round, 26 VP simulator match using the selected deck. The curriculum builds economy before combat, introduces Foundation growth, creature passives and actions, Support cards, a Coral Reef Habitat, Creature School, a Filter Feeder, an Apex predator, attacks, conditions, drawing choices, turn flow, and VP.
- The Academy reserves the exact legal creature slots required by the lesson and gives Professor Current a legal, durable practice tableau, so an alternate legal placement or Parrotfish damage cannot strand the later Great Barracuda or Hammerhead lesson.
- Tutorial checkpoints autosave as they occur. Exiting preserves the completed ordered prefix, retry starts a fresh local attempt without erasing it, and a loss never removes progress.
- Winning completes the academy encounter and grants the Harbor Habitats & Safe Boating Field Note plus the first route unlock exactly once.
- The Field Note explains habitat versus ecosystem, evidence-based observation, a boating-safety checklist, and introductory glossary terms. Boat safety is marked reviewed only after the player explicitly acknowledges the note; dismissing it with Escape does not count, and the professor keeps the review available. The note can be reopened from the pause menu.
- Resident home duels remain gated until the academy lesson is complete, then use the player's chosen active deck.

## World and presentation

- The content-driven world now contains a fourth playable Shellshore scene, `academy-lab`, with a safe spawn, walkable route to the professor, town entrance, and town exit.
- The academy uses a polished top-down pixel-art laboratory background with habitat samples, aquariums, field notebooks, and boating-safety gear.
- Professor Current has a transparent 12-frame directional pixel-art sprite sheet used in the map, dialogue portrait, and academy status card.
- Desktop and mobile layouts keep modal focus contained, avoid horizontal overflow, expose 44-pixel touch actions, and honor reduced-motion preferences.

## Progression and recovery contracts

- `adventureOnboarding.mjs` owns permanent starter selection, ordered tutorial advancement, practice outcomes, one-time completion, and interrupted-save repair.
- Simulator tutorial events are frozen, serializable evidence records. Only the current checkpoint advances, duplicate event IDs are harmless, and early real VP evidence waits until the authored order permits it.
- The existing reward ledger remains authoritative. Replaying or recovering completion cannot duplicate the Field Note, route, encounter completion, or reward grant.
- The boat-safety-reviewed flag is recorded separately from practice victory and only after explicit Field Note acknowledgment. Continue flow preserves a pending review instead of inferring acknowledgment from an earned note or repaired completion state.
- Continue flow repairs stale starter, active-deck, checkpoint-order, status, encounter, reward, and completion-flag combinations before play resumes.

## Phase 2 exit criteria

- [x] A new player can select any of the three legal starter decks with a permanent-choice warning.
- [x] The chosen deck drives the scripted seven-round, 26 VP practice simulator.
- [x] The board tour and real simulator actions advance the lesson in canonical order and save independently.
- [x] Loss, exit, and retry preserve safe progression and expose matching professor dialogue.
- [x] Practice victory grants the first Field Note and route exactly once.
- [x] Boat safety is recorded as reviewed only after explicit Field Note acknowledgment; Escape leaves the review pending.
- [x] Save/load restores academy location, starter, active deck, tutorial prefix, and completion rewards.
- [x] Desktop keyboard and mobile/touch layouts pass implementation smoke checks without horizontal overflow or uncaught page errors.
- [ ] Manually complete the full interactive 26 VP curriculum with Coral Garden, Murky Water, and Blue Water, including reward, Field Note acknowledgment, save, and resume for each starter.
- [ ] Complete moderated playtesting with children in the target age range and resolve any critical rule-comprehension blockers.
- [ ] Obtain named marine-science approval for final educational copy before release.

## Verification

```powershell
npm.cmd run test:adventure
npm.cmd run test:simulator
npm.cmd test
npm.cmd run build
```

Browser checks used clean and seeded local profiles at desktop and 390x844 touch viewports. They covered the academy start, continuous movement to Professor Current, authored dialogue, all three starter previews, permanent confirmation, selected-deck simulator handoff, visible tutorial step, safe practice exit, profile resume, pause-menu Field Note access, modal focus, 44-pixel actions, no horizontal overflow, and no uncaught page errors. Automated integration now proves the exact 26 VP route for all three starters; a full interactive completion with every starter remains an explicit manual QA gate above.

## Boundaries carried into Phase 3

- Mid-duel board-state save/resume remains outside version 1.0; only tutorial checkpoint progress and final duel outcomes persist.
- Collection inventory, starter ownership, the first-win booster, and reward-pack presentation moved into the first Phase 3 slice. Arbitrary owned-card deck snapshots and the reusable deck builder remain.
- The Shellshore reward unlocks a planned route, but personal boat piloting and Sunpatch Cay are Phase 4.
- Profiles remain local to the current browser. Cloud sync and accounts remain deferred.
