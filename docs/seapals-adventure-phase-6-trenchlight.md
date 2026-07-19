# SeaPals Adventure Phase 6 - Trenchlight Station

**Status:** Domain, authored content, guided-expedition controller, live guided UI, resume, and end-to-end content-loop checkpoints verified; clean-profile, full accessibility/device, collision, target-age comprehension, starter-balance, and named marine-science verification remain open

**Branch:** `codex/seapals-adventure`

**Scope source:** `docs/seapals-adventure-game-scope.md`

## Release boundary

Trenchlight Station is the fifth and final ecosystem chapter before the Phase 7 tournament. It extends the existing movement, route travel, ecosystem-chapter, dialogue, Simulator, collection, reward, and save systems. Its guided submersible sequence is a bounded instrument controller, not a second free-driving world engine.

Authored for this release:

- A 16-by-10 first-voyage route from Kelpwatch Island to Trenchlight Station, followed by dock-only auto-steer after the first completed manual crossing.
- A 16-by-10 floating research platform with Trenchlight Mission Control, Teo's Submersible Workshop, Trenchlight Tide Hall, and a dedicated guided-sub scene.
- Five story roles: Luz as Station Guide, Dr. Hana Okoye as Deep-Sea Ecologist and expedition lead, Teo as Submersible Engineer, Malik as Low-Light Observer, and Captain Elian as Tide Steward.
- A two-leg, expert-piloted expedition: four ordered observations, a required return to Mission Control for interpretation, and a second launch for a bounded sensor-recovery decision.
- Two 10 VP resident duels, one quest-gated 10 VP qualifier, one Field Note, an earned 12-card-pool pack, the final Tide Mark, and a charted future route toward Champion's Wake.
- Save-backed expedition progress, corrective attempts, accepted decisions, resident wins, field-report turn-in, one-time rewards, route state, and return visits.

Champion's Wake, its traversable route, and its three 30 VP tournament games remain Phase 7 work. The Trenchlight qualifier may unlock `route-trenchlight-champions-wake`, but that route is currently a progression promise rather than a playable runtime scene.

## Learning and safety contract

After the chapter, the player should be able to:

1. Explain that sunlight fades rapidly with depth and that the 1,050-meter station receives no sunlight, so photosynthesis does not occur there.
2. Read light and pressure as different measurements, including the useful approximation that pressure increases by about one atmosphere for every 10 meters of depth.
3. Describe marine snow as sinking material, mostly derived from surface waters, that can carry energy into dark deep-ocean food webs.
4. Describe bioluminescence as light produced by living organisms and name several possible functions without assigning one certain function from a brief sighting.
5. Explain that chemosynthetic communities occur at confirmed vents and seeps, while depth, darkness, pressure, or bioluminescence alone does not establish a vent.
6. Choose a bounded sensor recovery: confirm the marked lift point and a habitat-free approach with camera and sonar, keep the expert crew in control, recover no wildlife, and stop if clearance becomes uncertain.

The chapter does not teach that every trench contains a hydrothermal vent, that all deep life depends on chemosynthesis, that darkness means there is no food or life, or that bioluminescence proves one behavior or energy pathway. The player never free-pilots the sub, exits the pressure-rated vehicle, chases or collects wildlife, or continues a sensor lift when habitat clearance is uncertain. The deployed research sensor is the only recovery target.

## Evidence set

| Ordered stop | Evidence | Intended conclusion |
| --- | --- | --- |
| **Fading-light descent profile** (`trenchlight-fading-light-profile`) | A calibrated light meter is logged at fixed depth marks while the expert pilot holds position. Sunlight dwindles below roughly 200 meters and is absent at the 1,050-meter station. | Darkness rules out photosynthesis at the station, not all life or all surface-linked food. Depth and darkness do not establish a vent. |
| **Rising-pressure profile** (`trenchlight-pressure-profile`) | The external sensor records increasing pressure through the same fixed descent stations, at roughly one additional atmosphere per 10 meters. | Pressure is a general deep-ocean condition and an adaptation constraint; it does not identify a food pathway or a vent. |
| **Marine-snow camera record** (`trenchlight-marine-snow-camera`) | A fixed camera records sinking organic particles without following, feeding, touching, or collecting animals. | Surface-derived material can support deep animals where sunlight does not reach, so chemosynthesis is not the only possible deep-ocean energy pathway. |
| **Bioluminescence camera observation** (`trenchlight-bioluminescence-camera`) | With bright lamps off, a passive low-light camera records brief points of living light at the deep station. | Bioluminescence can support feeding, reproduction, or defense, but one sighting cannot assign a certain function and is not evidence of a vent. |

The accepted interpretation is `trenchlight-local-evidence-supports-multiple-deep-energy-pathways`. The accepted recovery is `trenchlight-recover-sensor-with-clearance-and-abort-criteria`. Unsupported choices remain retryable and receive corrective feedback. An unsafe choice does not disturb habitat, advance the expedition, or remove the player's safe-return option.

## Authoritative sources

The runtime Field Note `field-note-deep-adaptations`, **Life in the Deep**, uses these authored NOAA Ocean Exploration sources:

- [How is light distributed in the ocean?](https://oceanexplorer.noaa.gov/ocean-fact/light-distributed/)
- [How does pressure affect animals in the ocean?](https://oceanexplorer.noaa.gov/ocean-fact/animal-pressure/)
- [What is marine snow?](https://oceanexplorer.noaa.gov/ocean-fact/marinesnow/)
- [What is bioluminescence?](https://oceanexplorer.noaa.gov/ocean-fact/bioluminescence/)
- [Marine life](https://oceanexplorer.noaa.gov/explainers/marine-life/)
- [Cold seeps and hydrothermal vents](https://oceanexplorer.noaa.gov/ocean-fact/seeps-vents/)

These sources bound the authored claims about changing light and pressure, surface-linked sinking food, varied bioluminescent functions, deep-ocean adaptations, and locally established chemosynthetic habitats. They do not replace a named marine-science review of the final child-facing dialogue, measurements, interface labels, or recovery plan.

## Chapter progression

1. The Kelpwatch qualifier unlocks `route-kelpwatch-trenchlight`. The player boards at `kelpwatch-trenchlight-dock`, pilots the first crossing, and docks at `trenchlight-dock`.
2. Arrival initializes `quest-trenchlight-sensor`. Luz introduces the question and directs the player to Dr. Hana Okoye for the expedition and safety briefing.
3. Mission Control launches the survey leg. The expert pilot controls the sub while the player operates four instrument actions in their authored order: light meter, pressure sensor, fixed marine-snow camera, and passive low-light camera.
4. An out-of-order instrument action is retryable and does not mutate progress. Assisted mode derives and highlights the next required action without being written to the save.
5. After the fourth observation, the sub returns to Mission Control. The recovery leg cannot launch until the player accepts an interpretation supported by all four local records.
6. The second launch presents the sensor approach. Unsafe recovery choices receive corrective feedback and preserve a safe retry. The accepted response confirms the marked sensor and clear approach, keeps the expert crew in control, and uses explicit abort criteria.
7. Teo's Submersible Engineer duel and Malik's Low-Light Observer duel are both required for report readiness.
8. Only the four observations, accepted interpretation, accepted recovery, and both resident victories can move the quest to `readyToTurnIn`. Dr. Hana then grants **Life in the Deep** exactly once.
9. Captain Elian's qualifier remains locked until fieldwork is complete. Its first win grants one Trenchlight Discovery Pack, `tide-mark-trenchlight`, and `route-trenchlight-champions-wake` through the existing reward ledger.
10. A completed Kelpwatch-to-Trenchlight route supports two-way dock-only auto-steer for revisits. Completed dialogue retains uncertainty and continued monitoring rather than declaring that one descent describes the whole trench.

## Duel, reward, and collection contract

| Milestone | Simulator contract | Result |
| --- | --- | --- |
| Teo first win | 10 VP, hard difficulty, **Darkness Shroud** opponent | Counts `encounter-trenchlight-resident-engineer` toward report readiness; no separate inventory reward. |
| Malik first win | 10 VP, hard difficulty, **Disruption** opponent | Counts `encounter-trenchlight-resident-observer` toward report readiness; no separate inventory reward. |
| Dr. Hana report turn-in | Existing fieldwork reward ledger | Grants `field-note-deep-adaptations` through `reward-trenchlight-fieldwork`. |
| Captain Elian qualifier first win | 10 VP, hard difficulty, **Darkness Shroud** opponent | Grants one **Trenchlight Discovery Pack**, `tide-mark-trenchlight`, and `route-trenchlight-champions-wake`. |
| Qualifier rematch | Same custom-deck Simulator path | Practice only; cannot duplicate the one-time reward. |

All three encounters use the existing active-deck snapshot and Simulator result-provenance contract. Required progression never depends on a random pack pull.

The earned-only `pack-pool-trenchlight-deep` draws four distinct cards from this 12-card pool and guarantees an unowned card when an eligible card remains: Abyss, Bamboo Coral Base, Black Coral Base, Deep Mushroom Base, Bristlemouth, Barrel-eye Fish, Humpback Anglerfish, Giant Red Shrimp, Deep Sea Jelly, Vampire Squid, Deep Cucumber, and Gulper Eel.

## Save, revisit, and recovery acceptance

The canonical save must preserve:

- Luz's guide checkpoint and Dr. Hana's one-time introduction.
- The current expedition leg, ordered observation progress, interpretation/recovery attempts, accepted choices, and corrective-attempt counts.
- Both resident encounter victories, report readiness, fieldwork completion, Field Note grant, qualifier result, unopened/opened pack state, final Tide Mark, future-route unlock, and return dialogue.
- Manual first-voyage completion separately from later dock-only auto-steer eligibility.

Assisted-mode preference for an expedition run is derived UI state rather than persisted chapter progress. A reload during a valid survey or recovery leg preserves the sub scene and next required action. A sub-scene save with no valid expedition step returns to the authored safe Mission Control location. The Trenchlight reconciler derives `readyToTurnIn` and `complete` from actual evidence, decisions, and resident encounter records; a fabricated terminal quest status cannot bypass missing work. Storage-boundary flag repair and completed-reward reconciliation remain idempotent.

The automated content-loop acceptance covers manual arrival, a partial expedition reload, all four observations, Mission Control interpretation, an unsafe retry, successful recovery, both resident victories, one-time Field Note turn-in, qualifier gating, one-time pack/Tide Mark/route reward, pack opening, JSON reload, and two-way revisit travel. A seeded live-browser checkpoint additionally verifies launch, the vehicle-only interface, optional assisted highlighting, mid-survey reload, ordered completion, automatic station return, every recovery option, corrective retry, safe completion, tablet overflow, 44-pixel return control, and direction-only boat turning with a zero-pixel anchor shift.

## Generated environment assets

The Trenchlight environment set was created with the built-in image-generation workflow using project-bound prompts for cozy orthographic 16-bit pixel art, clear traversable centers, perimeter obstacles, environment-only scenes, and no characters, labels, logos, or unsafe wildlife handling:

- `public/images/adventure/kelpwatch-trenchlight-route.png`
- `public/images/adventure/trenchlight-station.png`
- `public/images/adventure/trenchlight-mission-control.png`
- `public/images/adventure/trenchlight-engineer-workshop.png`
- `public/images/adventure/trenchlight-tide-hall.png`
- `public/images/adventure/trenchlight-sub-descent.png`

The route prompt preserves a clear marked passage from kelp-lined shallows toward the floating platform. The station prompt establishes broad deck circulation, three building entrances, and a lower dock. Interior prompts keep consoles, pressure-safe equipment, workshop benches, and Tide Hall furniture near the perimeter. The sub scene shows an expert helm and separate player instrument stations; an equipment cabinet replaces an earlier aquarium-like detail so the observational mission does not imply specimen collection.

Raster appearance does not define gameplay geometry. Scene bounds, collision boxes, portals, NPC locations, docks, and spawns remain authored runtime data and require art-aligned collision QA.

## Runtime map

Chapter evidence and progression rules live in `src/app/adventure/adventureTrenchlight.mjs`. The ordered two-leg controller and safe-return rules live in `src/app/adventure/adventureTrenchlightExpedition.mjs`. The reusable adapter and storage-boundary recoverer are registered through `src/app/adventure/adventureEcosystemChapters.mjs`; canonical scenes, dialogue, Field Note, encounters, pack, rewards, and routes live in `src/app/adventure/adventureContent.mjs`.

`src/app/adventure/adventureTrenchlightContentLoop.test.mjs` is the release-level progression proof. It intentionally crosses the domain, content, world route, expedition controller, encounter, pack, save-validation, resume, and revisit boundaries rather than testing one module in isolation.

## Verification plan

Run the focused Trenchlight domain and integration contracts:

```powershell
node --test src/app/adventure/adventureTrenchlight.test.mjs src/app/adventure/adventureTrenchlightExpedition.test.mjs src/app/adventure/adventureTrenchlightContent.test.mjs src/app/adventure/adventureTrenchlightContentLoop.test.mjs src/app/adventure/adventureTrenchlightUi.test.mjs src/app/adventure/adventureEcosystemChapters.test.mjs src/app/adventure/adventureContent.test.mjs src/app/adventure/adventureSession.test.mjs src/app/adventure/adventureTravel.test.mjs src/app/adventure/adventureWorld.test.mjs src/app/adventure/adventurePacks.test.mjs src/app/adventure/adventureAssets.test.mjs
```

After shared UI and session integration lands, run the complete regression and production build:

```powershell
npm.cmd run test:adventure
npm.cmd test
npm.cmd run build
git diff --check
```

The completed seeded UI slice covers launch guidance, all four locked-sequence controls, assisted-mode highlighting, partial-expedition reload, required Mission Control return, every recovery choice, corrective safe retry, always-available return control, responsive tablet layout, and stable boat turning. The remaining clean-profile browser checkpoint must cover manual Kelpwatch-to-Trenchlight travel and docking, all authored scenes and automatic doors, paced introductions, one incorrect and one accepted interpretation, both resident Simulator paths, pre-report qualifier gating, Field Note turn-in, qualifier reward, pack state, departure, revisit, return dialogue, page exceptions, and application 4xx responses.

## Open release gates

- [x] Complete focused Trenchlight domain, expedition-controller, content, and end-to-end content-loop tests.
- [x] Prove exactly-once Field Note, qualifier reward, pack, Tide Mark, and Champion's Wake route unlock behavior at the save/domain boundary.
- [x] Complete the full 555-test repository suite, production build of all 26 routes, and `git diff --check` after shared UI/session integration.
- [x] Connect and verify the guided-sub interface in the live adventure UI, including every required instrument action, Mission Control handoff, recovery leg, optional assistance, partial-leg reload, corrective retry, and always-available safe return.
- [ ] Complete a seeded browser checkpoint across travel, station exploration, expedition, decisions, duels, gating, rewards, reload, and revisit states.
- [ ] Complete a clean-profile playthrough from Kelpwatch departure through the Trenchlight return voyage without developer seeding.
- [ ] Complete desktop keyboard, tablet touch, safe-area, focus, modal-scroll, reduced-motion, narrow-screen, and 44-pixel-target QA, including assisted mode.
- [ ] Verify collision against representative art landmarks and uninterrupted walkable routes through the station and each interior.
- [ ] Confirm target-age players can distinguish darkness, pressure, food pathways, and adaptations without inferring that every trench contains a vent or all deep life uses chemosynthesis.
- [ ] Confirm target-age players choose observation, expert control, a habitat-free approach, and abort criteria instead of free-piloting, touching habitat, or collecting wildlife.
- [ ] Obtain and record named marine-science review of the final light, pressure, marine-snow, bioluminescence, chemosynthesis, vent/seep, and recovery-safety copy.
- [ ] Confirm through playtesting that no starter choice creates a material progression disadvantage in the Trenchlight duels.
