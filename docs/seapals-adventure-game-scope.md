# SeaPals Adventure Game - Product Scope

**Status:** Draft for product review

**Working title:** Reefbound

**Platform:** SeaPals web application, desktop and tablet first
**Primary objective:** Build an original SeaPals card-adventure game in which children travel between island and floating towns, learn how marine ecosystems work, help residents with habitat challenges, improve their card collection, and win a town-hosted SeaPals Tournament made up of 30 VP games.

This document defines product scope and build order, not a delivery schedule. Timing and staffing estimates should be made after the vertical slice has been playtested.

## 1. Product vision

The player begins at a marine research academy, chooses one of three starter decks, and learns SeaPals from an original professor-like mentor. They then pilot a personal boat through an archipelago of islands and floating settlements. Each town introduces a habitat, a community, an environmental challenge, resident duelists, and new cards.

The central loop is:

> Sail to a town -> meet its residents -> investigate an ecosystem challenge -> choose a helpful action -> duel local players -> earn cards and a Tide Mark -> improve a deck -> sail onward

After earning the required Tide Marks, the player reaches a floating championship town and enters a three-round SeaPals Tournament. Every tournament round is a full 30 VP game. Winning the tournament completes the main story and unlocks postgame exploration and rematches.

The game may take inspiration from the approachable exploration and progression of creature-battling adventures, but all public-facing characters, creatures, dialogue, locations, art, terminology, and story content must remain original to SeaPals. The word **duel** is used throughout this document for a SeaPals match.

## 2. Product principles

1. **The game comes first.** Learning happens through observation, choices, cause and effect, travel, and deck play rather than long lectures or mandatory quizzes.
2. **Evidence comes before action.** Habitat challenges use an `observe -> understand -> act -> reflect` structure. The player should not instantly repair a complex ecosystem by clicking one object.
3. **Communities are collaborators.** Residents may have different needs or ideas, but environmental stories should avoid simplistic villains. Duels earn trust or demonstrate readiness; they do not represent defeating an environmental problem.
4. **Every town has one clear lesson.** Each chapter has one main concept, one common misconception, observable evidence, a meaningful choice, a modest consequence, and a later callback.
5. **Progress is never luck-gated.** Booster packs add excitement and options, but required cards, starter viability, and story progress cannot depend on random pulls.
6. **Short sessions remain useful.** Exploration, a field activity, deck editing, or one teaching duel should each provide a satisfying stopping point.
7. **Children can play without an account.** The first release is local-first, collects no unnecessary personal information, and does not sell randomized rewards.

## 3. Working audience and experience assumptions

These assumptions should be validated during Phase 0:

- Primary audience: ages 8-12, with family and classroom co-play supported.
- Reading: short dialogue segments, plain language, optional definitions, and Field Notes for deeper detail.
- Inputs: keyboard and touch at launch. Auto-steer, reduced motion, remappable keys, and generous interaction targets are accessibility requirements.
- Structure: a guided opening followed by a mostly linear campaign with optional rematches and limited side activities.
- Match length: early practice and resident teaching duels may use 10 VP; the final tournament and any explicitly labeled full match use 30 VP.
- Save model: three local player profiles, manual save from the pause menu, and autosave at safe checkpoints. Account-based cloud synchronization is a later option.
- Monetization: booster packs are earned through play only. No paid packs, premium currency, or card trading are included in version 1.0.

## 4. Existing SeaPals foundation

The project already contains useful pieces. The plan should extend these rather than create parallel replacements.

| Area | Reusable today | Main gap for the adventure game |
| --- | --- | --- |
| Adventure prototype | `/adventure` has continuous keyboard/touch movement, animated sprites, collision, doors, two homes, NPC conversations, story duels, rematches, and local defeat progress. | Scenes, NPCs, dialogue, trainers, and progression are hardcoded. There is no reusable quest system, boat, world map, inventory, or complete save state. |
| SeaPals simulator | Story mode accepts player/opponent prebuilt deck IDs, opponent name and difficulty, a victory target, exit handling, and a victory callback. The simulator supports 10 and 30 VP games. | It needs structured win/loss results, arbitrary saved deck lists, story reward hooks, stronger loss handling, and a stable adapter between adventure and match state. Mid-duel saving is not planned for version 1.0. |
| Starter decks and cards | Coral Garden, Murky Water, and Blue Water exist as resolved, legal 60-card prebuilt decks. White Grunt now has bundled artwork and card data; reef/open-ocean/deep mechanics, Coral Disease, and Severe Coral Bleaching already exist. | White Grunt's printed three-school-stack cap still needs generic simulator enforcement before a required deck can exceed it. Card conditions are not substitutes for educational quests. |
| Deck editing and metrics | The tournament entry page already edits decks. Shared logic provides deck validation, card counts, VP, average RP, composition, VP share, and Offense/Defense/Economy/Consistency/Tempo metrics. | The editor must be extracted from tournament submission, limited to owned cards, given deck-library controls, and connected to the simulator. A game-facing rules profile must validate 60 cards, copy limits, Foundation requirements, and at least 30 total VP without requiring tournament submission fields. |
| Tutorial material | A scripted seven-round, 26 VP live tutorial, board tour, and explanatory interaction patterns now exist. | Target-age playtesting and named marine-science approval remain release gates. |
| Persistence | The adventure stores defeated trainer IDs locally; tutorial progress and storefront cart data also demonstrate local browser storage. Supabase is already present for other site features. | Player profiles, collection, packs, decks, inventory, quests, world position, boat, settings, and tournament state are new. There is no player authentication or private cloud-save model. |

Recommended reuse boundaries:

- Keep the current adventure movement, collision, interaction, and responsive controls as the exploration foundation.
- Keep the simulator and its pure rule modules as the source of truth for SeaPals matches.
- Extract the existing deck editor and metrics into reusable game-facing components.
- Keep centralized card IDs and prebuilt decks as shared domain data.
- Build quests, rewards, inventory, boat travel, town definitions, and game saves as new versioned systems.

## 5. Version 1.0 content boundary

Version 1.0 is intentionally bounded to:

- One starter academy and harbor.
- Five ecosystem chapters: coral reef, estuary/mangrove, open ocean, kelp forest, and deep ocean/trench.
- One final floating tournament town.
- Three starter decks: Coral Garden, Murky Water, and Blue Water.
- One personal boat with route unlocks and cosmetic changes, not a large upgrade or crafting economy.
- One guided submarine expedition.
- One primary educational challenge per ecosystem chapter.
- Two required resident duels and one leader/qualification duel per standard ecosystem town, with exact counts adjustable after the coral vertical slice.
- A three-round final tournament, with every round played to 30 VP.
- One optional Field Note set and optional rematches per chapter; additional side quests are post-launch content.

Starter choice changes the player's opening collection and early strategy, but it must not lock or change required story content. Every starter must be capable of completing the campaign.

## 6. Proposed archipelago

Names are working names and may change. Every settlement is either located on an island or built as a floating town/platform.

| Location | Settlement | Habitat focus | Main challenge and learning | Card-game role |
| --- | --- | --- | --- | --- |
| **Shellshore Academy** | Island harbor; expand or repurpose the current Shellshore Village | Harbor, lagoon, and introductory habitat mosaic | Conduct a simple harbor survey, learn boat safety, understand the difference between a habitat and an ecosystem, and choose a starter deck. | Mentor-led board tour and scripted seven-round, 26 VP practice duel. |
| **Sunpatch Cay** | Reef island town | Coral reef and neighboring seagrass | Investigate pale and damaged reef patches. Learn that bleaching is a stress response and does not automatically mean a coral is dead; visible damage may be suspected disease and should not be diagnosed from appearance alone. | Coral Garden opponents, coral rewards, and the first Tide Mark. |
| **Brackwater Landing** | Floating and stilt town beside an estuary | Estuary, mangrove, salt marsh, and seagrass nursery | Trace cloudy water and low oxygen. Distinguish natural turbidity from harmful runoff or excess nutrients; learn about salinity gradients and nursery habitat. | Murky Water specialists and water-quality-themed rewards. |
| **Current Commons** | Open-ocean flotilla | Pelagic/open-water ecosystem | Use simple current maps to locate lost fishing gear and plan prevention as well as cleanup. Learn how currents connect places, how food webs begin, and how bycatch or ghost gear affects wildlife. | Blue Water navigators and open-ocean rewards. |
| **Kelpwatch Island** | Rocky island town | Kelp forest and rocky reef | Survey kelp decline and an imbalanced grazer population. Learn about habitat-forming species, food webs, and trophic cascades. | Combo-focused challengers and a later-game deck-building test. |
| **Trenchlight Station** | Floating research platform above a trench | Deep ocean and trench | Join an NPC-piloted sub expedition to recover a sensor without disturbing habitat. Observe fading light, rising pressure, marine snow, and bioluminescent adaptations. | Deepwater challengers, the final Tide Mark, and the Darkness/Deep reward pool. |
| **Champion's Wake** | Large floating tournament town | Synthesis of all regions | Apply habitat knowledge in conversations and tournament matchups; see outcomes from earlier community projects. | Three progressively harder 30 VP tournament games, ending, and postgame rematches. |

### Coral challenge content guardrails

The flagship Sunpatch Cay mission should:

1. Let the player compare healthy, bleached, algae-covered/dead, and suspiciously damaged reef patches.
2. Use temperature, water clarity, images, and resident observations as evidence.
3. Explain that a bleached coral may still be alive and that suspected disease requires expert monitoring rather than a visual guess.
4. Offer contextual actions such as reporting monitoring data, protecting no-anchor areas, reducing nearby sediment/nutrient stress, and supporting scientist-led nursery work.
5. Show modest change on later visits, such as improved monitoring or fewer anchor impacts, rather than an instant cure.
6. State that reducing local stress can support reef resilience but does not replace action on ocean warming.

All final science copy and interventions require review by a qualified marine-science educator or subject-matter expert.

### Trench expedition boundary

The sub ride is a guided 2D sequence, not a second open-world vehicle simulation. The player may operate lights, a camera, sonar, and a sampling arm while an expert NPC pilots. The mission is observational and focused on recovering a sensor or recording evidence, not collecting wildlife. Hydrothermal vents or chemosynthesis should appear only when the location is explicitly established as a vent or cold seep.

## 7. Educational design framework

Each town chapter must contain:

1. **Hook:** A resident describes a change or problem without giving away its cause.
2. **Observation:** The player explores and records two or more pieces of evidence.
3. **Interpretation:** A field partner teaches one tool or model and helps compare explanations.
4. **Decision:** The player chooses an evidence-supported response and sees a realistic tradeoff.
5. **Community action:** Residents implement a modest action; the player does not single-handedly repair the ecosystem.
6. **Duel:** A local challenger tests the player's SeaPals strategy and awards progression.
7. **Reflection:** A short conversation and Field Note connect the activity to the habitat.
8. **Callback:** A later town or tournament conversation asks the player to reuse the concept in a new context.

Incorrect choices should provide specific feedback and another attempt, not remove rewards or create a permanent dead end. Optional knowledge checks may award Field Notes or cosmetics but should not be the primary progression gate.

By the end of version 1.0, playtests should show that most target-age players can:

- Match the five featured habitats with representative conditions or adaptations.
- Interpret a simple temperature, salinity, oxygen, turbidity, or current display in context.
- Distinguish coral bleaching, suspected disease, and dead/algae-covered substrate using evidence.
- Explain why naturally murky estuary water is not automatically polluted.
- Predict one consequence of changing a simple three-link food web.
- Choose an evidence-supported intervention and name at least one limitation or tradeoff.
- Navigate marked channels, no-anchor areas, and wildlife-distance zones safely.

These outcomes are assessed through player decisions, route planning, later callbacks, and NPC responses, not a final exam.

## 8. Required game systems

### 8.1 Adventure, dialogue, and quests

- Convert town, scene, transition, NPC, dialogue, duel, quest, and reward definitions into content data rather than hardcoded component branches.
- Support exterior maps, interiors, docks, interactable evidence, NPC schedules or simple state variants, branching dialogue, and quest markers.
- Track quests as explicit states such as `notStarted`, `active`, `readyToTurnIn`, and `complete`.
- Separate repeatable dialogue/rematches from one-time story rewards.
- Make all rewards idempotent through unique reward/event IDs.
- Provide a reusable town template so later chapters mostly require content and assets, not copied engine logic.

### 8.2 Personal boat and travel

- Allow boarding, steering, collision, docking, and disembarking using keyboard and touch.
- Use a regional route map with short manually piloted sea lanes rather than an unrestricted, fully simulated ocean.
- Include currents, buoys, marked channels, wildlife-distance areas, and safe docks as light navigation gameplay.
- Unlock fast travel and optional auto-steer after a route has been completed manually once.
- Never require fuel purchases or repetitive resource grinding to continue the story.
- Restore the player at a safe sea position or the last dock if a saved position becomes invalid after an update.

### 8.3 Duel integration

- Introduce an adventure-to-simulator contract that accepts a player deck snapshot, opponent deck, opponent profile, target VP, tutorial configuration, and a unique encounter ID.
- Return a structured result containing win/loss, scores, encounter ID, first-win status, and completion reason.
- Use the scripted 26 VP curriculum for the guided Academy tutorial and 10 VP for selected early resident teaching matches.
- Use 30 VP for the final three tournament games and any explicitly designated full exhibition match.
- Validate the active player deck before required full matches and provide a direct path to fix an invalid deck.
- Save immediately before and after a duel. Mid-duel save/resume is excluded from version 1.0.
- Improve or explicitly bound unsupported card effects before an affected deck or opponent becomes required campaign content.

### 8.4 Collection, booster packs, and inventory

The inventory has four visible categories:

- **Card collection:** owned quantity by stable card ID.
- **Booster packs:** unopened earned packs and their source town.
- **Story items:** Tide Marks, research tools, permits, sensor parts, and quest items.
- **Boat items:** route permissions and cosmetic parts; large stat-based boat upgrades are excluded.

Reward rules:

- A starter grants the exact cards needed for its legal 60-card deck.
- First-time duel wins and quest completions grant fixed reward IDs exactly once.
- Packs use versioned, testable card pools and disclose their contents/rules in age-appropriate language.
- Required progress never depends on pack luck. First-clear rewards may include fixed cards, and packs should guarantee a new usable card while eligible cards remain in their pool.
- Rematch rewards are capped or cosmetic so repeated farming cannot destabilize progression.
- Packs cannot be bought with real money in version 1.0.

### 8.5 Deck builder and metrics

- Extract the existing tournament deck editor into reusable card browser, quantity control, deck summary, metric, and validation components.
- Allow create, rename, duplicate, delete, and select-active operations for a small deck library.
- Limit additions to owned quantities and show why locked/unowned cards cannot be added.
- Enforce the game rules profile: exactly 60 cards, maximum four copies per card, at least one base Foundation, and at least 30 total printed VP, subject to final official rules.
- Display existing metrics: total cards, category composition, total VP, average RP, VP share, Offense, Defense, Economy, Consistency, and Tempo.
- Add clear warnings instead of presenting metric scores as guaranteed deck strength.
- Pass a frozen deck snapshot into a duel so later edits cannot change an active or completed result.

### 8.6 Save profiles and pause menu

The recommended version 1.0 save model is three local profiles with a versioned schema. Each profile stores at least:

- Schema version and profile ID.
- Current location, position, facing, last safe dock, and unlocked routes.
- Selected starter and active deck ID.
- Quest flags, NPC state, completed encounters, Tide Marks, and tournament bracket state.
- Card quantities, saved deck lists, unopened packs, story items, and boat items.
- Tutorial, Field Note, settings, accessibility, and playtime state.
- A reward ledger containing unique grant IDs to prevent duplication.

The pause menu includes **Save**, **Decks**, **Inventory**, **Field Notes**, **World Map**, **Settings**, and **Return to title**. Manual save shows the time and location of the completed write. Autosaves occur after starter selection, rewards, pack opening, quest transitions, docking, duel results, and tournament rounds.

Writes must be atomic or recoverable, validated before loading, and migrated when the schema changes. If local storage is unavailable or full, the game must explain that saving failed instead of implying success. Deleting or overwriting a profile requires confirmation.

Account-based cloud saves may be added later using player-owned rows and restrictive row-level security. Anonymous tournament RPC patterns must not be reused for private player data. A child should not need to provide a name, email address, or other personal information to play locally.

### 8.7 Field Notes, map, and accessibility

- Field Notes collect observed species, habitat concepts, evidence, and completed reflections; cards represent observed species rather than captured animals.
- The world map shows discovered towns, route status, Tide Marks, and the current objective without revealing all story details at the start.
- Dialogue supports replay, text-speed controls, and an optional glossary.
- Required interactions work with keyboard and touch and do not rely on color alone.
- Boat auto-steer, reduced motion, generous timing, high-contrast focus, readable text sizing, and non-punitive retries are launch requirements.

**Implementation checkpoint:** The pause menu now opens a selectable journal containing every unlocked Field Note in acquisition order, including each note's observations, checklist, and glossary. The initial Harbor safety acknowledgment remains a focused single-note gate; later journal reading is optional and replayable.

## 9. Phased roadmap

### Phase 0 - Scope lock and architecture

**Goal:** Make the project buildable without committing to large content production too early.

**Deliverables**

- Confirm age range, reading level, campaign length target, supported devices, art direction, and final launch-town count.
- Audit all three starter decks and make every required card available and simulator-compatible.
- Define content schemas for towns, scenes, NPCs, dialogue, quests, encounters, rewards, pack pools, and unlock rules.
- Define the adventure/simulator contract and the versioned game-save schema.
- Create a one-page learning matrix for every planned town and identify the science-review owner.
- Establish automated test fixtures for quest transitions, reward idempotency, deck legality, and save migration.

**Exit criteria**

- All three starter decks pass the agreed game-facing validator and can complete a simulator smoke match.
- A test adventure encounter returns a reliable structured win or loss.
- The save schema, content schema, town learning matrix, and version 1.0 boundary are approved.

### Phase 1 - Adventure foundation and saving

**Goal:** Turn the current prototype into a reusable, persistent game shell.

**Implementation status:** Complete on `codex/seapals-adventure`; see `docs/seapals-adventure-phase-1.md`.

**Deliverables**

- Content-driven scenes, transitions, NPCs, conversations, encounters, and basic quest states.
- Central game-state model and storage adapter.
- Three-profile title screen, Continue/New Game flow, pause menu, manual save, and safe autosave.
- Migration of current Shellshore movement, homes, and interactions onto the new content model.
- Save validation, backup/recovery behavior, and schema migration tests.

**Exit criteria**

- A player can walk through the current village and homes, change a quest flag, save from the menu, reload, and resume at the correct safe position.
- Malformed or older save data produces a recovery path rather than a blank screen or duplicated reward.
- Exploration remains usable with keyboard and touch at supported viewport sizes.

### Phase 2 - Shellshore Academy and live tutorial

**Goal:** Deliver a complete, understandable new-player introduction.

**Implementation status:** Implementation complete on `codex/seapals-adventure`; full interactive 26 VP completion with each starter, target-age comprehension playtesting, and named marine-science approval remain open gates. See `docs/seapals-adventure-phase-2.md`.

**Deliverables**

- An original marine mentor, academy interior, starter presentation, and starter preview metrics.
- One-time choice of Coral Garden, Murky Water, or Blue Water, with confirmation before committing.
- A tutorial layer that drives and validates real simulator actions: setup, collecting RP, drawing, building, attacking, ending a turn, and earning VP.
- A scripted seven-round, 26 VP practice duel with a board tour, guaranteed tutorial coin flip, retry, exit, and loss dialogue.
- First Field Notes and boat-safety introduction, with the boat-safety-reviewed flag recorded only after the player explicitly acknowledges the Field Note.

**Exit criteria**

- A new player can choose any starter, finish the live tutorial without prior rules knowledge, win or retry the practice duel, save, and resume.
- Replaying the tutorial cannot grant a second starter or duplicate one-time reward.
- Target-age playtesting identifies no critical rule-comprehension blocker.

**Open validation gates**

- [ ] Manually complete the full interactive 26 VP curriculum with Coral Garden, Murky Water, and Blue Water, including reward, Field Note acknowledgment, save, and resume for each starter.
- [ ] Complete target-age comprehension playtesting with no critical rule-comprehension blocker.
- [ ] Obtain named marine-science approval for the final academy and Field Note educational copy.

### Phase 3 - Collection, rewards, inventory, and deck building

**Goal:** Complete the card-progression loop before producing more towns.

**Implementation status:** Feature-complete in the Shellshore slice, with desktop/tablet manual QA still open. Starter ownership, recovery, first-win rewards, deterministic pack opening, four-category Inventory, owned-card deck editing, live metrics/validation, active-deck selection, immutable simulator snapshots, and persisted first-win deck provenance are implemented. See `docs/seapals-adventure-phase-3.md`.

**Deliverables**

- Card collection, pack inventory, story inventory, and reward ledger.
- Versioned booster definitions and a pack-opening experience.
- Reusable owned-card deck builder, deck library, active-deck selection, metrics, and game-facing validation.
- Simulator support for an arbitrary validated deck snapshot.
- First-win and rematch reward policies with automated duplication tests.

**Exit criteria**

- A test duel grants its first-win pack exactly once.
- Opening that pack updates collection and inventory exactly once, persists across reload, and never removes required progression.
- The player can build and save a legal owned-card deck, see metrics update live, and start a duel with that exact deck list.

### Phase 4 - Personal boat and Sunpatch Cay vertical slice

**Goal:** Prove the complete travel, education, duel, reward, and progression loop.

**Implementation status:** The core Sunpatch vertical slice is implemented on `codex/seapals-adventure`: the Shellshore-Sunpatch route and world map, Sunpatch investigation, resident/qualifier/exhibition duels, Field Note, Tide Mark, reward pack, return-state dialogue, and save/recovery contracts are in place. Full new-profile desktop/tablet QA, target-age comprehension playtesting, and named marine-science review remain open release gates. Explicit current zones and enforceable wildlife-distance navigation remain an implementation/defer decision. See `docs/seapals-adventure-phase-4.md`.

**Deliverables**

- Personal boat boarding, steering, docking, route completion, auto-steer, and world map.
- One manually piloted route from Shellshore Academy to Sunpatch Cay.
- Sunpatch Cay exterior/interiors, four to six story NPC roles, and a complete coral investigation.
- Two resident duels, one leader/qualification duel, coral reward pool, Field Notes, and first Tide Mark.
- One optional 30 VP exhibition match to prove full-game story integration before the tournament is produced.
- Return-visit state showing a modest community response to the coral investigation.

**Exit criteria**

- From a new profile, a player can choose a starter, finish the tutorial, pilot and dock the boat, complete the coral investigation, win the qualification, open a reward, edit a deck, save, and resume without a progression blocker.
- A marine-science reviewer approves the mission's distinction among bleaching, suspected disease, and dead/algae-covered substrate.
- Target-age players can identify at least one stressor, one observation, and one helpful response after play.
- The vertical slice passes desktop and tablet keyboard/touch testing.

**Open validation gates**

- [ ] Complete a clean-profile browser playthrough through travel, fieldwork, qualifier, reward opening, deck editing, save, reload, and return voyage.
- [ ] Complete desktop keyboard and tablet touch/safe-area QA, including visible notices, modal focus, and reduced-motion behavior.
- [ ] Confirm target-age players can identify a stressor, an observation, and a supported helpful response.
- [ ] Obtain named marine-science approval for the bleaching, lesion/suspected-disease, and dead/algae-covered-substrate distinctions.
- [ ] Implement explicit currents and wildlife-distance zones in the prototype route, or record their intentional deferral to a later regional route.

This phase is the production gate. Do not build all remaining towns until its playtest, art pipeline, content cost, save reliability, and simulator integration have been reviewed.

### Phase 5 - Regional ecosystem chapters

**Goal:** Expand the proven town template without adding another core engine.

**Implementation status:** Brackwater Landing, Current Commons, and Kelpwatch Island have verified implementation checkpoints. Trenchlight Station has verified domain, content, guided-expedition-controller, live guided UI, resume, and end-to-end content-loop checkpoints. A fresh-profile automated campaign contract now carries each real starter through these chapters in order without seeded Tide Marks or Field Notes. Full browser/device QA, target-age comprehension, starter balance in real matches, and named marine-science verification remain open.

Build these as independently testable content releases:

1. **Brackwater Landing:** estuary/mangrove challenge, Murky Water opponents, themed packs, and Tide Mark.
2. **Current Commons:** open-ocean/current challenge, Blue Water opponents, themed packs, and Tide Mark.
3. **Kelpwatch Island:** kelp food-web challenge, advanced opponents, themed packs, and Tide Mark.

Each chapter includes one town, one travel route, one primary field challenge, four to six story NPC roles, two resident duels, one qualification duel, one reward pool, Field Notes, return-visit state, and reviewed science copy.

**Exit criteria for each chapter**

- The town can be reached, completed, left, revisited, saved, and loaded without a softlock.
- Required encounters support the player's custom deck and grant each reward exactly once.
- The educational decision uses observable evidence, gives corrective feedback, and receives science review.
- No starter choice creates a material progression disadvantage.
- Adding the town does not require duplicating core adventure, save, inventory, deck, or simulator logic.

### Phase 6 - Trenchlight Station and sub expedition

**Goal:** Deliver the final ecosystem chapter while keeping its unique vehicle content bounded.

**Implementation status:** The Trenchlight route, platform, interiors, cast, deep-ocean evidence model, two-leg NPC-piloted expedition controller, resident and qualifier encounters, playable reward pack, final Tide Mark, future-route unlock, save recovery, and end-to-end content-loop proof are authored. The live guided-sub interface is connected and browser-verified for launch, ordered controls, optional assistance, partial-leg reload, safe return, corrective recovery, responsive layout, and reduced-motion styling. Fresh-profile domain/storage continuity is now covered for all three starters; complete live browser accessibility/device, collision, target-age, real-match starter-balance, and named science-review gates remain in `docs/seapals-adventure-phase-6-trenchlight.md`.

**Deliverables**

- Trenchlight floating platform, residents, Deepwater duelists, qualification, and reward pool.
- Guided sub descent with sunlit-to-deep transitions, instruments, an observational sensor mission, and safe retry.
- Deep-ocean Field Notes and callbacks to earlier food-web/current concepts.
- The final Tide Mark and route unlock for Champion's Wake.

**Exit criteria**

- The sub sequence works with keyboard and touch, includes an accessible assisted mode, and cannot strand the player.
- Science review confirms the treatment of light, pressure, marine snow, bioluminescence, and any vent/cold-seep content.
- Completion, reward, Tide Mark, route unlock, and save state each occur exactly once.

### Phase 7 - Champion's Wake tournament and release readiness

**Goal:** Complete the main objective and prepare version 1.0 for release.

**Implementation status:** Champion's Wake, its ordered three-round 30 VP bracket, ending, postgame, and save/recovery contracts are implemented. `adventureCampaignLoop.test.mjs` now starts a real fresh profile for Coral Garden, Murky Water, and Blue Water; completes the tutorial, six manual voyages, five ecosystem chapters, earned packs, persisted tournament defeat/retry, three victories, ending, and postgame; and reloads at campaign boundaries. This is domain/storage evidence, not a live rules-engine or child-playability result. Stunned, Lionfish controller parity with successful-attack and Spearfishing removal, Cookie Cutter's board-supply fallback, per-attack Ensnare, Green Sea Turtle opponent healing, and Deep Sea Jelly's Flashing Alarm now have controller-parity implementations.

**Deliverables**

- Floating tournament town, registration, bracket UI, spectators, and story conversations.
- A three-round bracket of progressively harder 30 VP games.
- Active-deck validation before entry, explicit deck-lock rules for a bracket attempt, saving between rounds, and safe defeat/retry behavior.
- Championship ceremony, ending, ecosystem epilogue, credits, and postgame free travel/rematches.
- Final opponent tuning, performance work, audio, accessibility, child-privacy review, science review, and regression testing.

**Exit criteria**

- A fresh profile can progress from starter choice through every required town and win the tournament.
- Every tournament match is configured for 30 VP and records its result once.
- A loss permits a clear retry without losing cards, duplicating rewards, or corrupting the bracket.
- The ending triggers once, the completed save remains usable, and postgame exploration is available.
- No known critical progression blocker, save corruption path, inaccessible required interaction, or required unsupported card effect remains.

## 10. Release gates

| Gate | Included phases | Purpose |
| --- | --- | --- |
| **Technical foundation** | 0-1 | Prove schemas, reusable exploration, and reliable local saving. |
| **Intro demo** | 0-2 | Validate starter choice and live teaching with new players. |
| **Playable vertical slice / MVP** | 0-4 | Prove the complete loop through one ecosystem town and one 30 VP story match. |
| **Content complete** | 0-7 | Include all launch towns, the trench expedition, and the full tournament ending. |

Passing a gate means meeting its exit criteria; it does not merely mean that its screens exist.

## 11. Quality and test strategy

Automated tests should cover:

- Save serialization, validation, migration, recovery, and invalid-position fallback.
- Quest transitions, branch conditions, one-time rewards, pack grants, and pack opening.
- Inventory quantities, owned-card enforcement, deck CRUD, and official deck legality.
- Adventure movement, collision, scene transitions, boat docking, route unlocks, and interaction reach.
- Simulator encounter configuration, arbitrary deck snapshots, structured results, 10/30 VP targets, and callback idempotency.
- Tournament bracket progression, losses, retries, round saves, and ending completion.

End-to-end release paths should include:

- New profile -> each starter -> tutorial -> save/load.
- First town -> investigation -> duel -> pack -> deck edit -> next route.
- Save/load at a town, dock, valid sea position, before duel, after duel, and between tournament rounds.
- Full campaign completion with each starter deck family.
- Desktop keyboard and tablet touch at minimum supported sizes.

Content QA should verify every science statement, glossary definition, intervention, later callback, card-to-habitat connection, and accessibility transcript. Playtests should evaluate comprehension, navigation, match pacing, reading load, and whether players understand why an action helped.

## 12. Scope exclusions for version 1.0

Unless separately approved, version 1.0 excludes:

- Pokemon characters, names, artwork, maps, creature designs, music, or branded terminology.
- Catching, breeding, or managing a separate collectible-creature roster.
- Real-time multiplayer, PvP matchmaking, card trading, live tournaments, chat, or user-generated content.
- Paid randomized packs, premium currency, loot-box purchases, or blockchain systems.
- A fully open ocean, procedural maps, dynamic weather simulation, or survival/fuel economy.
- A free-roaming submarine simulator.
- Mid-duel save/resume.
- Native iOS, Android, or console applications.
- Full voice acting, broad localization, or cinematic cutscenes.
- Cross-device cloud-save synchronization at initial launch.
- A large boat crafting, combat, fishing, or stat-upgrade system.
- More launch habitats than the five ecosystem chapters defined above.

Potential post-launch chapters include polar seas, intertidal pools and seagrass, oyster reefs, cold seeps, or a migrating floating town.

## 13. Major risks and controls

| Risk | Control |
| --- | --- |
| Content and art multiply with every town. | Treat Sunpatch Cay as a hard production gate, reuse content schemas and NPC roles, and keep one main quest per town. |
| The simulator is large and stateful. | Add a narrow adventure adapter first, keep match rules in existing pure modules, pass immutable deck snapshots, and exclude mid-match saves. |
| Some required card effects or starter cards are incomplete. | Audit starters and mandatory opponent decks in Phase 0; do not ship a required encounter with excluded cards or unsupported critical effects. |
| Random rewards can block or frustrate progression. | Grant required cards directly, guarantee useful/new cards where possible, cap farming, and test every starter progression path. |
| Save changes can corrupt long campaigns. | Use a versioned canonical state, validated migrations, atomic/recoverable writes, reward IDs, backups, and load fixtures from every released version. |
| Educational content becomes a quiz or oversimplifies science. | Require evidence-based play, modest outcomes, later callbacks, target-age playtests, and expert review before each chapter passes. |
| Boat or sub features become separate games. | Limit boating to short routes plus fast travel and the sub to one guided expedition with assisted controls. |
| Child accounts create privacy and moderation obligations. | Launch local-first with no account requirement, no chat, and no collection of unnecessary personal information. Review applicable child-privacy requirements before adding cloud accounts or analytics. |
| Originality becomes unclear because of the inspiration reference. | Use the inspiration only as internal design shorthand; maintain original SeaPals characters, world structure, terminology, art, and mechanics. |

## 14. Product decisions still to approve

The roadmap currently uses these recommended defaults:

1. Target ages 8-12.
2. Seven total launch settlements: one academy, five ecosystem towns, and one tournament town.
3. Short manually driven boat routes, then optional auto-steer/fast travel.
4. Three local save profiles with manual save and autosave; cloud sync later.
5. Earned-only packs with guaranteed story progression and no real-money pack sales.
6. Early 10 VP teaching duels, optional 30 VP exhibition, and three mandatory 30 VP tournament rounds.
7. One active deck registered and frozen for a tournament bracket attempt; exact loss/re-registration rules to be settled in tournament design.
8. Five ecosystem chapters for version 1.0; intertidal/seagrass and polar chapters held for expansion.
9. Current polished 2D top-down pixel-art direction retained unless the vertical-slice art review changes it.

The campaign-length target, final names, exact NPC/duel counts, pack composition, tournament retry rules, and cloud-account strategy should be locked only after the Sunpatch Cay vertical slice provides real pacing and production data.

## 15. Version 1.0 definition of done

Version 1.0 is done when a child can start a local profile, choose any of the three legal starter decks, learn the live SeaPals simulator from the academy mentor, travel by personal boat to every required island or floating town, complete five reviewed ecosystem challenges, earn and open packs, manage inventory, build legal owned-card decks with understandable metrics, save from the menu, earn every Tide Mark, and win all three 30 VP games at Champion's Wake without encountering a progression blocker or losing save data.
