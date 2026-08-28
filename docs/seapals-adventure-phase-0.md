# SeaPals Adventure Phase 0 - Foundation Handoff

**Status:** Implemented; ready for product approval

**Branch:** `codex/seapals-adventure`
**Scope source:** `docs/seapals-adventure-game-scope.md`

## Locked working assumptions

- Primary audience: ages 8-12.
- Core dialogue: approximately grades 4-6, with optional glossary depth.
- Platform: web-first desktop and tablet, keyboard and touch.
- Art: retain the current polished 2D top-down pixel-art direction through the vertical-slice review.
- Launch world: Shellshore Academy, five ecosystem towns, and Champion's Wake.
- Main-story length hypothesis: 8-12 hours; validate rather than commit to this target during the Sunpatch vertical slice.
- Travel: short manually piloted routes, then optional auto-steer/fast travel.
- Saves: local-first, three profiles, versioned data, no mid-duel save in version 1.0.
- Rewards: earned-only packs; story progress cannot depend on random pulls.
- Matches: 10 VP teaching games where appropriate; all three final tournament rounds use 30 VP.

## Implemented contracts

### Adventure content

- `adventureContent.mjs` contains versioned launch definitions for towns, scenes, NPC roles, dialogue beats, quests, encounters, rewards, pack pools, boat routes, and unlock rules.
- `adventureContentValidation.mjs` validates uniqueness, cross-references, settlement types, required learning fields, NPC-role coverage, reward routes, and the 30 VP tournament rule.
- Pack pools are deliberately marked `planned` with no final card collation. Phase 3 owns their contents and balance.

### Progression and saving

- `adventureProgression.mjs` defines canonical JSON-only save schema v1.
- The schema covers player/starter state, world position and safe dock, routes, quests, NPC states, encounters, Tide Marks, tournament state, card/pack/item inventory, saved decks, tutorial, Field Notes, accessibility settings, playtime, and a reward ledger.
- Prototype v0 progress migrates known trainer victories as completed encounters. Because the prototype granted no inventory rewards, migration deliberately leaves the reward ledger empty rather than recording phantom grants.
- Quest transitions are forward-only: `notStarted -> active -> readyToTurnIn -> complete`.
- Reward grant IDs are authoritative and idempotent. Replaying a callback cannot grant the same reward twice.
- Pure contract code does not read browser storage, time, randomness, or mutate its inputs. Phase 1 owns the storage adapter and menu UI.

### Adventure-to-simulator results

- `storyModeContract.mjs` defines a serializable encounter configuration and deterministic win/loss result.
- Story results include contract version, encounter/opponent identity, decks, difficulty, scores, target VP, completion reason, round, turn, and result message.
- The simulator now emits `onResult(result)` for wins and losses while preserving `onVictory(result)` compatibility and adding `onDefeat(result)`.
- Reward eligibility is intentionally outside the simulator and belongs to the progression ledger.

The intended flow is:

> Content encounter -> Simulator story configuration -> structured result -> quest transition -> idempotent reward grant -> save checkpoint

### Starter decks

- White Grunt is defined from the supplied card and used by Blue Water and Murky Water.
- `validateGameDeck` checks the shared game-legality rules for any deck list.
- Coral Garden, Murky Water, and Blue Water each resolve to 60 cards, respect the four-copy limit, contain a base Foundation, and meet the 30 VP deck minimum.
- Blue Water's Foundation quantities were rebalanced to respect the four-copy limit while preserving its 60-card size and strategy.

## Phase 0 exit criteria

- [x] All three starter decks resolve and pass the game-facing validator.
- [x] White Grunt has card data and bundled artwork.
- [x] A story encounter has a versioned input contract and deterministic structured win/loss result.
- [x] Town, scene, NPC-role, dialogue, quest, encounter, reward, pack, route, and unlock definitions are versioned and cross-validated.
- [x] Save schema v1, prototype migration, quest transitions, and idempotent rewards have automated tests.
- [x] Every planned chapter has a concept, misconception, evidence, decision, consequence, debrief, callback, and authoritative source notes.
- [x] The launch boundary and working product assumptions are documented.
- [ ] Assign the named marine-science approver before Sunpatch dialogue/content can pass its release gate.

## Known boundaries carried forward

- White Grunt's printed maximum of three fish-school stacks is retained in card rules, but the simulator has no generic ecosystem-limit enforcement yet. The relevant starter decks contain only two White Grunts, so the limitation cannot affect their starter smoke paths. Add generic enforcement before a required deck can exceed the printed cap.
- The current `/adventure` UI still uses its prototype defeated-trainer local-storage shape. Phase 1 will connect it to schema v1 and the storage adapter.
- Story mode still starts from prebuilt deck IDs. Arbitrary owned-card deck snapshots belong to Phase 3.
- Content definitions are planning/runtime contracts; planned towns, scenes, resident duelists, and pack lists do not yet have full assets or dialogue copy.
- Opponent strategy is rules-focused rather than exhaustive. Required campaign decks need playtest tuning as their chapters are built.
- Mid-duel save/resume, cloud sync, multiplayer, paid packs, and a fully open ocean remain outside version 1.0.

## Verification commands

```powershell
node --test src/app/adventure/*.test.mjs
node --test src/app/simulator/*.test.mjs
node --test src/lib/decks/*.test.mjs
npm.cmd test
npm.cmd run build
```

## Phase 1 handoff

Phase 1 should now:

1. Add a storage adapter with three profiles, atomic/recoverable writes, and save-failure UI.
2. Migrate `seapals-reefbound-progress-v1` into the canonical schema with an explicit profile ID.
3. Move the existing Shellshore scenes and trainer data behind the content contract.
4. Add title/continue/new-game and pause/save menus.
5. Keep current movement, collision, touch controls, and story duel behavior passing while the state source changes.
