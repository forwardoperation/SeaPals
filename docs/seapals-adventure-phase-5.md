# SeaPals Adventure Phase 5 - Brackwater Landing

**Status:** Brackwater Landing vertical slice implemented and passing automated, production-build, and seeded browser checkpoint checks; full clean-profile playthrough, target-age comprehension testing, and named marine-science review remain open

**Branch:** `codex/seapals-adventure`

**Scope source:** `docs/seapals-adventure-game-scope.md`

## Phase 5 release boundary

Phase 5 is organized as independently testable regional releases. This document records the first of those releases.

| Regional release | Runtime status | Boundary |
| --- | --- | --- |
| **Brackwater Landing** | Implemented vertical slice | Travel route, floating town and interiors, field investigation, five NPC roles, two resident duels, qualifier, Field Note, earned pack, Tide Mark, return state, and save-backed progression are authored and connected to the live adventure UI. |
| **Current Commons** | Planned | Its town, travel scene, open-ocean/current investigation, opponents, Field Note, and pack are not playable. Brackwater can chart/unlock its route identifier, but that is not a navigable Current Commons release. |
| **Kelpwatch Island** | Planned | Its town, route, kelp food-web investigation, opponents, Field Note, and pack are not playable. |

Trenchlight Station and the sub expedition belong to Phase 6. Champion's Wake and the 30 VP tournament belong to Phase 7; neither is part of this Phase 5 release.

## Player-facing result

- The route from Sunpatch Cay to Brackwater Landing is a live 16-by-10 boat scene. The first crossing is manually piloted; completing it enables the existing dock-only auto-steer behavior in both directions.
- Brackwater is a 16-by-10 floating/stilt town with a Water Lab, Neri's Mangrove Home, and Tide Hall. Each 12-by-8 interior has a walkable center corridor and authored furniture collision.
- Rhea's briefing gates the estuary investigation UI. Dr. Sola Reyes gives her authored introduction once before shifting to guidance, field-report debrief, and return dialogue; Neri and Harbor Master Juno provide resident perspectives and 10 VP duels, and Tide Steward Amina hosts the 10 VP qualifier.
- Four monitoring stations present qualitative salinity, turbidity, and dissolved-oxygen readings together with site, tide, and rainfall context.
- The player must distinguish expected estuary variation from a repeated runoff-side pattern, then choose a response supported by those observations.
- Corrective feedback is retryable. Repeating an identical incorrect choice does not inflate progress, and an accepted correct decision cannot be replaced by a later unsupported choice.
- Completing the report grants **Changing Estuary Water**. Winning the qualifier grants a Brackwater Discovery Pack, the Brackwater Tide Mark, and charts the planned route toward Current Commons exactly once.
- Return dialogue preserves scientific uncertainty: the town continues monitoring normal variation while tracing the supported runoff pathway.

## Science and learning contract

### Learning objectives

After the chapter, the player should be able to:

1. Describe an estuary as a place where freshwater and ocean water meet and mix.
2. Explain that salinity, turbidity, and dissolved oxygen can change with location, tide, rainfall, time, water movement, biological activity, and bottom type.
3. Explain why naturally cloudy water can be part of productive estuary and mangrove nursery habitat and is not, by itself, proof of pollution.
4. Compare a measurement with the same site's normal range and with repeated observations instead of treating one location or one sample as the universal baseline.
5. Identify the repeated combination of unusually high turbidity and low dissolved oxygen after rain beside a possible source as evidence that warrants source tracing.
6. Choose a bounded response: test the supported pathway, reduce confirmed nutrient or organic inputs, preserve naturally muddy nursery habitat, and continue monitoring.

The chapter does not claim that one cloudy sample identifies pollution, that a visual pattern proves a specific contaminant, or that dredging or clearing the whole estuary is an appropriate response.

### Authored observation set

The readings are intentionally qualitative. Their meaning comes from comparison and context, not from teaching a single universal numerical threshold.

| Station | Context and measurements | Intended evidence reading |
| --- | --- | --- |
| **Incoming-tide channel** | Nearest the estuary mouth; incoming tide; no substantial rain for three days. Salinity is higher than upstream, turbidity is moderate and near the site's usual range, and dissolved oxygen is near its daytime baseline. | Saltier incoming water and some cloudiness fit this place and tide; cloudiness alone is not evidence of pollution. |
| **Creek mouth after rain** | Freshwater creek; outgoing tide; heavy rain the previous night. Salinity is lower than the channel, turbidity is higher than before rain, and oxygen is near the creek's rainy-day baseline. | Freshwater and stirred or transported sediment can explain this single cloudy reading. |
| **Mangrove nursery at low tide** | Shallow muddy mangrove edge; low tide and light breeze; no substantial rain for three days. Salinity falls between creek and channel readings, turbidity is high after bottom sediment is stirred, and oxygen is lower than the open channel but near this site's daytime baseline. | A naturally muddy nursery must be compared with its own tide and time-of-day history. |
| **Repeated runoff-side pattern** | Drainage outlet beside developed shoreline; repeated low-tide morning checks following several rain events. Salinity is below the site's dry-weather baseline, turbidity is repeatedly above its usual rain-event range, and oxygen is repeatedly below its morning baseline. | The repeated, site-specific pairing supports tracing runoff and testing nutrient or organic inputs without labeling the entire estuary polluted. |

### Authoritative sources encoded in the Field Note

The runtime Field Note `field-note-estuary-conditions` carries these source URLs, and content validation requires at least three HTTPS science sources for this chapter:

- [NOAA Ocean Service - What is an estuary?](https://oceanservice.noaa.gov/education/tutorial_estuaries/est01_whatis.html)
- [NOAA Ocean Service - Monitoring estuaries](https://oceanservice.noaa.gov/education/tutorial_estuaries/est10_monitor.html)
- [U.S. EPA - Volunteer Estuary Monitoring Methods Manual](https://www.epa.gov/nep/volunteer-estuary-monitoring-methods-manual)

These sources establish the planning boundary and do not replace review of the final player-facing script by a named marine-science reviewer.

## Chapter flow and progression gates

1. **Unlock and travel.** Completing Sunpatch's quest and Tide Mark reward unlocks `route-sunpatch-brackwater`. The player boards at the separate Sunpatch-Brackwater dock, manually pilots the first crossing, and docks at Brackwater Landing. Route completion is stored for later auto-steer.
2. **Meet the guide.** Docking initializes the save-backed `quest-brackwater-water-clues` state, but monitoring stations and Water Lab decision consoles remain unavailable until the player speaks with Rhea. Finishing her introduction records the guide checkpoint.
3. **Observe.** The player may visit the four town monitoring stations in any order. Each interaction stores one canonical observation flag and can be safely revisited.
4. **Interpret.** The Water Lab interpretation is unavailable until all four observations are recorded. The supported choice separates normal variation from the repeated runoff-side high-turbidity/low-oxygen pattern.
5. **Respond.** The response decision is unavailable until the interpretation is correct. The supported response traces and tests the source, reduces confirmed inputs, protects nursery habitat, and continues monitoring.
6. **Hear and duel residents.** Neri's Murky Water encounter and Juno's Disruption encounter are repeatable 10 VP resident duels. Both first wins are required for report readiness; the encounter definitions do not grant separate inventory packs.
7. **Turn in the report.** Dr. Sola's authored introduction appears on the first conversation and is recorded once; later conversations select guidance, debrief, or return copy from save-backed chapter state. Only all four observations, the correct interpretation, the correct response, and both resident victories can move the quest to `readyToTurnIn`. Dr. Sola completes the turn-in and grants `field-note-estuary-conditions` once.
8. **Qualify.** Amina's 10 VP qualifier is gated by the completed fieldwork quest. A first qualifier win grants the chapter reward ledger entry once; rematches do not duplicate it.
9. **Open or keep the pack.** The earned-only Brackwater Discovery Pack contains four distinct cards drawn from its 12-card pool and guarantees an unowned card when an eligible card remains. Opening consumes the unopened pack atomically.
10. **Revisit or depart.** Return dialogue reflects continued monitoring. The player may pilot or auto-steer back to Sunpatch. `route-brackwater-current` is added to progression as the next charted route, but Current Commons is still planned content.

The Brackwater quest reconciler derives readiness from actual observations, accepted decisions, and resident encounter records. A malformed or manually edited terminal quest status cannot bypass those requirements. Quest flags are JSON-safe, repeat observations and turn-ins are idempotent, and rewards use the existing one-time grant ledger.

## Duel, reward, and collection contract

| Milestone | Result |
| --- | --- |
| Neri first win | Counts `encounter-brackwater-resident-naturalist` toward field-report readiness; no configured inventory reward. |
| Juno first win | Counts `encounter-brackwater-resident-harbormaster` toward field-report readiness; no configured inventory reward. |
| Dr. Sola field-report turn-in | Grants **Changing Estuary Water** through `reward-brackwater-fieldwork`. |
| Amina qualifier first win | Grants one **Brackwater Discovery Pack**, `tide-mark-brackwater`, and `route-brackwater-current` through `reward-brackwater-qualifier`. |
| Qualifier rematch | Practice only; cannot recreate the one-time reward. |

The Brackwater Discovery Pack is playable, earned-only, and draws four distinct cards from: Leather Starfish, Oysters, Blue Crab, White Grunt, Bull Shark, Octopus, Arrow Crab, Emerald Crab, Robotic Survey, Scientist Jes, Recovery, and Remote Search.

All three Brackwater encounters use the existing Simulator launch, active-deck snapshot, result-provenance, save, inventory, and reward contracts. The chapter does not introduce a parallel duel or collection engine.

## Runtime and asset map

The reusable ecosystem chapter registry in `src/app/adventure/adventureEcosystemChapters.mjs` adapts the Brackwater domain to the same adventure UI used by Sunpatch. The chapter-specific evidence and progression rules live in `src/app/adventure/adventureBrackwater.mjs`; canonical authored content lives in `src/app/adventure/adventureContent.mjs`.

The five project-bound environment assets are:

- `public/images/adventure/sunpatch-brackwater-route.png`
- `public/images/adventure/brackwater-landing.png`
- `public/images/adventure/brackwater-water-lab.png`
- `public/images/adventure/brackwater-mangrove-home.png`
- `public/images/adventure/brackwater-tide-hall.png`

Each scene references its asset through the canonical `artPath` in adventure content. Collision, interaction, portal, dock, and spawn geometry remain authored data rather than being inferred from the raster artwork.

## Brackwater release criteria

- [x] A live first-voyage boat route connects Sunpatch Cay and Brackwater Landing and records completion for two-way auto-steer.
- [x] The floating town, three interiors, dock, portals, NPCs, observation stations, and decision consoles are present in the runtime world registry.
- [x] The evidence-first fieldwork domain enforces four observations, an accepted interpretation, an accepted response, and both resident victories.
- [x] Rhea's first briefing gates fieldwork UI, and Dr. Sola's first-meeting flag preserves the authored intro before later guidance, debrief, and return dialogue.
- [x] Two resident duels and the quest-gated qualifier use the existing custom-deck Simulator contract.
- [x] Field Note, playable reward pack, Tide Mark, and next-route unlock use idempotent reward grants.
- [x] Save/resume reconciliation and authored content-loop tests cover travel, fieldwork, encounters, reward, pack opening, and valid persisted state.
- [x] Adventure automated tests and the production build pass at this implementation checkpoint.
- [ ] Complete a clean-profile browser playthrough from Sunpatch departure through the Brackwater return voyage without developer seeding.
- [ ] Complete desktop keyboard and tablet touch/safe-area QA, including walking collision, boat controls, modal focus/scroll, notices, and reduced-motion behavior.
- [ ] Verify partial-fieldwork, pre-qualifier, post-reward, pack-opened, and return-visit saves through an actual browser reload.
- [ ] Confirm target-age players can explain why murky water alone is not proof of pollution and can identify the repeated pattern and supported response.
- [ ] Obtain and record named marine-science review of the final salinity, turbidity, dissolved-oxygen, runoff, and nursery-habitat copy.
- [ ] Confirm through playtesting that no starter choice creates a material progression disadvantage in the Brackwater duels.

### Browser QA checkpoint

A seeded canonical-save browser run verified the manual Sunpatch-to-Brackwater voyage, continuous boat steering, docking, route/town/lab/hall art, Rhea's paced guide greeting, all four observation stations and their full measurement context, collision around Rhea and the stations, Water Lab and Tide Hall automatic entry/exit, pre-report qualifier gating, Dr. Sola's first-meeting greeting, autosave notices, and canonical save loading/reconciliation. The run produced no application exceptions or application 4xx responses. The Mangrove Home portal, decision submission, field-report turn-in, post-report qualifier launch, and a reload after completed fieldwork remain part of the full clean-profile gate above.

## Verification commands

Run the focused chapter contracts:

```powershell
node --test src/app/adventure/adventureBrackwater.test.mjs src/app/adventure/adventureBrackwaterContentLoop.test.mjs src/app/adventure/adventureEcosystemChapters.test.mjs src/app/adventure/adventureContent.test.mjs src/app/adventure/adventureSession.test.mjs src/app/adventure/adventureTravel.test.mjs src/app/adventure/adventureWorld.test.mjs src/app/adventure/adventurePacks.test.mjs
```

Run the complete adventure suite and production build:

```powershell
npm.cmd run test:adventure
npm.cmd run build
```

Before merge or deployment, also run the repository-wide suite:

```powershell
npm.cmd test
```

At this implementation checkpoint, `npm.cmd run test:adventure` passes 222 tests, the repository-wide suite passes 453 tests, and `npm.cmd run build` succeeds. Those checks verify domain and integration contracts; they do not close the full browser, child-comprehension, starter-balance, or science-review gates above.

## Remaining Phase 5 work

1. Close the open Brackwater browser, accessibility, save/reload, comprehension, balance, and science-review gates.
2. Build Current Commons as the second independent Phase 5 content release: a live Brackwater-to-Current route, floating town, current/ghost-gear investigation, two resident duels, qualifier, Blue Water pack, Field Note, Tide Mark, and return state.
3. Build Kelpwatch Island as the third independent Phase 5 content release: a live route, island town, kelp food-web investigation, two resident duels, qualifier, pack, Field Note, Tide Mark, and return state.
4. Re-run the Phase 5 regression matrix after each release to ensure the new content reuses, rather than duplicates, adventure movement, save, inventory, deck, Simulator, quest, and reward systems.
