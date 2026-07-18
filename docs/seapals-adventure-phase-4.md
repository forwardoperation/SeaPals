# SeaPals Adventure Phase 4 - Personal Boat and Sunpatch Cay

**Status:** Core vertical-slice implementation complete; full new-profile desktop/tablet QA, target-age comprehension playtesting, and named marine-science review remain open

**Branch:** `codex/seapals-adventure`

**Scope source:** `docs/seapals-adventure-game-scope.md`

## Player-facing result

- The Shellshore dock now boards a personal boat into a short, manually piloted sea lane. The player steers around rocks and buoys, reaches the opposite dock zone, and disembarks at Sunpatch Cay.
- Completing the first manual crossing records route mastery. The pause-menu world map then offers auto-steer from either dock, but not while the player is elsewhere in town.
- The world map distinguishes current, visited, charted, and undiscovered towns without revealing locked names. The newly unlocked Brackwater route is truthfully labeled as charted but not yet navigable.
- Sunpatch Cay includes an exterior, reef field station, resident home, and Tide Hall. Its cast covers a local guide, field partner, two residents, and Tide Steward.
- The main investigation asks the player to compare four observations: a healthy comparison patch, pale living tissue consistent with bleaching, a described tissue-loss lesion, and algae-covered exposed skeleton.
- The player must interpret those observations without diagnosing disease from appearance alone, choose a supported local response, and hear both residents' perspectives. Incorrect choices give corrective feedback and remain retryable; a correct choice cannot later be overwritten.
- Dr. Mira turns in the completed report and grants the **Reading a Reef** Field Note. Return dialogue reports a modest change in boating behavior while preserving uncertainty about long-term recovery.
- Two resident duels lead to Nia's 10 VP qualifier. The first qualifier victory grants one Sunpatch Coral Pack, the first Tide Mark, and the charted route toward Brackwater exactly once.
- Nia also offers an optional 30 VP exhibition. It is explicitly rewardless and does not alter story progress on a win or loss.

## Travel and world-map contract

- `adventureTravel.mjs` separates route unlock, manual completion, runtime readiness, and available travel modes.
- First-voyage boarding requires the completed Shellshore quest and explicit boat-safety Field Note review.
- Manual boarding and auto-steer require the player to be in the authored dock zone. Manual docking requires the boat to reach the destination endpoint; the domain API cannot complete a voyage from mid-channel.
- While aboard, the save retains the safe origin town and dock. Arrival atomically records the destination town, scene, position, facing, last safe dock, and first manual route completion.
- Auto-steer is available only after a completed manual voyage and works in either direction from a dock.
- Invalid route saves recover to a usable endpoint. In particular, an impossible incomplete reverse voyage returns to the authored Shellshore origin rather than stranding the profile.
- The route uses a boat-specific movement profile, open-water tiles, solid shoals/buoys, keyboard and touch controls, conditional accessible instructions, and reduced-motion handling for wake and water effects.

## Sunpatch learning contract

The investigation follows an observe, compare, interpret, respond, and reflect sequence:

1. Record all four authored reef observations in any order.
2. Separate visible evidence from a disease diagnosis.
3. Choose monitoring, site protection, and reduction of demonstrated local stress rather than an instant cure.
4. Win both 10 VP resident encounters to hear distinct community perspectives.
5. Review the report with Dr. Mira and receive the Field Note.
6. Complete the Tide Hall qualifier and revisit the community response.

The educational copy keeps these boundaries explicit:

- Bleaching is a stress response and pale tissue may still be living.
- Tissue loss is described as a lesion; its appearance alone does not identify a disease or cause.
- Algae-covered exposed skeleton is distinguished from pale living tissue.
- Local monitoring and protection can be useful without being presented as a cure for ocean warming or a guarantee of reef recovery.

## Duel, reward, and collection contract

- The gardener and surveyor are repeatable 10 VP resident duels.
- The 10 VP qualifier remains locked until the fieldwork quest is complete.
- The optional exhibition uses the normal Simulator integration at 30 VP and clearly carries no story reward.
- Every duel launches with the frozen active-deck snapshot and retains the existing encounter/opponent/target/deck fingerprint checks.
- First-clear and rematch dialogue are selected from story completion state, not merely from newly reconstructed duel provenance.
- The qualifier reward ledger grants the Coral Pack, Tide Mark, and next-route unlock once. Opening the pack consumes it atomically and duplicate callbacks or rematches cannot recreate it.

## Save, migration, and content contracts

- The adventure save schema is now version 2. Version 1 profiles migrate with empty defaults for route-completion and encounter-result provenance while retaining any compatible data already present.
- Current-schema storage envelopes integrity-check `world.completedRouteIds` and `progression.encounterResults`; a truncated primary falls back to a valid backup instead of silently erasing those domains.
- Sunpatch quest flags persist observations, corrective-attempt counts, final supported decisions, resident victories, Field Note turn-in, Tide Mark, reward ledger, and route unlocks.
- Content validation cross-checks the route scene and docks, Sunpatch scenes and roles, four evidence IDs, science decisions, resident/qualifier gates, Field Note, playable pack, and optional exhibition.
- Four new environment assets live under `public/images/adventure`: the sea route, Sunpatch Cay, field station, and Tide Hall.

## Phase 4 exit criteria

- [x] Personal boat boarding, steering, collision, destination docking, route completion, world map, and post-completion auto-steer are implemented.
- [x] Sunpatch exterior/interiors, five NPC roles, and the complete investigation loop are implemented.
- [x] Two resident duels and the quest-gated qualifier use the active frozen deck contract.
- [x] Field Note, playable reward pack, Tide Mark, and next-route unlock are idempotent.
- [x] The optional 30 VP exhibition is integrated and separated from one-time rewards.
- [x] Return-state copy reports a modest response and continued uncertainty.
- [x] Automated coverage exercises manual travel, mid-route reload, incorrect/correct science choices, resident completion, report turn-in, qualifier reward, pack opening, reload, and two-way auto-steer.
- [ ] A clean new profile completes the entire browser path from starter choice through deck editing and post-Tide-Mark reload without developer seeding.
- [ ] Desktop keyboard and tablet touch/safe-area QA pass the complete route and Sunpatch loop.
- [ ] Target-age players can identify at least one stressor, one observation, and one helpful response after play.
- [ ] A named marine-science reviewer approves the bleaching, lesion/suspected-disease, and dead/algae-covered-substrate distinctions.

## Verification completed

```powershell
npm.cmd run test:adventure
npm.cmd run build
```

The adventure suite currently passes 186 tests, including the complete Phase 4 domain loop, save-v2 migration/integrity cases, dock-only fast travel, endpoint-only manual docking, and impossible-route recovery. The production Next.js build also passes. This is automated contract evidence, not a substitute for the open browser, child-comprehension, or science-review gates.

## Open implementation and validation gates

- Run the full clean-profile player journey on desktop and tablet, including reward opening, deck editing, manual save, reload, return voyage, focus containment, visible informational feedback, and reduced-motion preference.
- Assign and record the named marine-science reviewer.
- Conduct moderated target-age comprehension testing and revise any critical language or interaction blockers.
- Decide before Phase 4 is declared fully closed whether explicit current zones and enforceable wildlife-distance navigation belong in this route or are intentionally deferred to a later regional route. The current slice includes rocks, buoys, a marked channel, safe docks, and wildlife-distance safety copy, but no current-force mechanic or wildlife exclusion zone.

## Boundary into Phase 5

- Brackwater Landing is charted but its route, dock, town, quest, encounters, and pack remain planned content.
- Mid-duel save/resume, cloud accounts, unrestricted ocean travel, fuel grinding, and stat-based boat upgrades remain outside the version 1.0 boundary.
- Additional towns should reuse the proven travel, quest, evidence, duel, reward, pack, deck, and save contracts rather than adding parallel engines.
