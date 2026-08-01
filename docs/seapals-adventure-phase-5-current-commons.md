# SeaPals Adventure Phase 5 - Current Commons

**Status:** Current Commons vertical slice implemented and passing automated, production-build, and seeded browser checkpoint checks; full clean-profile playthrough, target-age comprehension testing, and named marine-science review remain open

**Branch:** `codex/seapals-adventure`

**Scope source:** `docs/seapals-adventure-game-scope.md`

## Release boundary

Current Commons is the second independently testable Phase 5 regional release. It extends the existing adventure movement, travel, ecosystem-chapter, dialogue, Simulator, collection, reward, and save systems; it does not introduce a parallel engine.

Implemented in this release:

- A live 16-by-10 first-voyage boat route from Brackwater Landing to Current Commons, with a separate Brackwater departure dock and dock-only auto-steer after the first manual crossing.
- A live 16-by-10 floating open-ocean flotilla with a Navigation Lab, Kaiya's Navigator Home, and Current Commons Tide Hall.
- Five authored NPC roles: Suri as local guide, Dr. Amara Nwosu as field partner, Kaiya and Tomas as resident challengers, and Orla as Tide Steward.
- Four current-and-gear evidence stations, two lab decisions, two 10 VP resident duels, one quest-gated 10 VP qualifier, a Field Note, an earned Blue Water pack, a Tide Mark, and a charted route toward Kelpwatch Island.
- Save-backed guide and analyst introductions, observation order, corrective attempts, accepted decisions, resident wins, report turn-in, rewards, route state, and return dialogue.

Kelpwatch Island remains the final Phase 5 regional release. Trenchlight Station belongs to Phase 6, and Champion's Wake plus the 30 VP tournament belong to Phase 7.

## Learning and safety contract

After the chapter, the player should be able to:

1. Explain that a current is moving water and that an ordered series of drifter positions can estimate a short-term surface direction and likely path.
2. Combine a dated loss report, a drifter track, wildlife overlap, and repeated downstream sightings into a likely search corridor.
3. State the uncertainty honestly: a drifter does not guarantee one exact destination, and the evidence does not prove ownership.
4. Describe derelict or ghost gear as uncontrolled fishing gear that can continue catching wildlife, damage habitat, or create navigation hazards.
5. Choose a safe sequence: observe remotely and stay aboard, record and report useful details, keep a safe and legal distance, and leave assessment, removal, or disentanglement to trained authorized responders.
6. Explain why removal and prevention are both needed. Gear inspection and security, storm planning, prompt loss reporting, retrieval planning, and approved local collection or disposal reduce recurrence.

The player never approaches, touches, pulls, cuts, swims or dives to, or disentangles gear or wildlife. The chapter does not show injured animals, promise a universal separation distance, villainize fishers, claim that all loss is intentional, or treat a drift estimate as certainty.

## Evidence set

| Station | Evidence | Intended conclusion |
| --- | --- | --- |
| **Source-port gear-loss report** | A dated report identifies an up-current location, marked trap line, and a missing buoy. | This is a possible source-area clue, not proof that every downstream item has one owner. |
| **Surface-drifter track** | Timed instrument positions trace surface flow toward the commons during the observed tide and wind period. | Floating material may follow a similar short-term corridor, while later, deeper, or differently buoyant material may move differently. |
| **Wildlife-overlap watch** | Remote observations place a feeding and travel corridor across the projected path. | The overlap supports a risk worth reporting; it does not claim that an animal is already injured or that every animal will be caught. |
| **Downstream gear accumulation** | Repeated responder reports locate unattended trap line down-current after similar conditions. | Repetition strengthens the transport pattern and shows why safe removal must be paired with prevention. |

The accepted interpretation is `currents-connect-report-to-risk-zone`. The accepted response is `coordinate-safe-removal-and-prevention`. Unsupported choices remain retryable and receive explicit corrective feedback.

## Authoritative sources

The runtime Field Note `field-note-current-connections` carries the following primary-source URLs:

- [NOAA Ocean Service - Measuring currents](https://oceanservice.noaa.gov/education/tutorial_currents/06measure1.html)
- [NOAA Marine Debris Program - Modeling oceanic transport of floating marine debris](https://marinedebris.noaa.gov/modeling-and-monitoring/modeling-oceanic-transport-floating-marine-debris)
- [NOAA Marine Debris Program - Derelict fishing gear](https://marinedebris.noaa.gov/what-marine-debris/derelict-fishing-gear)
- [NOAA Marine Debris Program - On the water](https://marinedebris.noaa.gov/how-help/water)
- [NOAA Fisheries - Report entangled marine life](https://www.fisheries.noaa.gov/national/marine-life-distress/report-entangled-marine-mammal)

These sources define the implementation boundary but do not replace a named marine-science review of the final player-facing script.

## Chapter progression

1. Brackwater's qualifier reward unlocks `route-brackwater-current`. The player boards at `brackwater-current-dock`, manually pilots the first crossing, and docks at `current-commons-dock`.
2. Docking initializes `quest-current-ghost-gear`. Evidence stations and lab consoles remain gated until the player completes Suri's greeting.
3. The four observations may be recorded in any order and are idempotent across revisits and reloads.
4. The Navigation Lab interpretation remains unavailable until all four observations are recorded. The response remains unavailable until the interpretation is accepted.
5. Dr. Amara's first greeting is stored separately from later guidance, debrief, and return dialogue.
6. Kaiya's Blue Water duel and Tomas's Open Ocean duel are both required for report readiness.
7. Only the four observations, accepted interpretation, accepted response, and both resident victories can move the quest to `readyToTurnIn`. Dr. Amara then grants **Connected by Currents** exactly once.
8. Orla's qualifier remains locked until fieldwork is complete. Its first win grants the Current Commons Blue Water Pack, `tide-mark-current`, and `route-current-kelpwatch` through the existing reward ledger.
9. Return conversations preserve uncertainty and ongoing monitoring. Completed routes may be piloted manually or auto-steered from their authored docks.

Malformed Current Commons flag values are repaired only at the save-storage boundary. Unrelated and forward-compatible flags are preserved, while fabricated terminal quest states cannot bypass evidence or qualifier gates.

## Duel, reward, and collection contract

| Milestone | Result |
| --- | --- |
| Kaiya first win | Counts `encounter-current-resident-navigator` toward report readiness; no separate inventory reward. |
| Tomas first win | Counts `encounter-current-resident-deckhand` toward report readiness; no separate inventory reward. |
| Dr. Amara report turn-in | Grants **Connected by Currents** through `reward-current-fieldwork`. |
| Orla qualifier first win | Grants one **Current Commons Blue Water Pack**, `tide-mark-current`, and `route-current-kelpwatch`. |
| Qualifier rematch | Practice only; cannot duplicate the one-time reward. |

The playable earned-only pack draws four distinct cards from a 12-card pool and guarantees an unowned card when an eligible card remains. The pool contains Blue Sea Dragon, Krill Bloom Base, Anchovy Ball Base, Herring Ball Base, Bluefin Tuna Juvenile, Frigate Tuna, Flying Fish, Market Squid, Mahi-Mahi, Wahoo, Sailfish, and Open Ocean.

## Runtime and assets

The chapter domain lives in `src/app/adventure/adventureCurrent.mjs`. The reusable adapter and UI copy live in `src/app/adventure/adventureEcosystemChapters.mjs`, while canonical world, dialogue, Field Note, encounter, pack, reward, and route data remain in `src/app/adventure/adventureContent.mjs`.

Project-bound environment assets:

- `public/images/adventure/brackwater-current-route.png`
- `public/images/adventure/current-commons.png`
- `public/images/adventure/current-navigation-lab.png`
- `public/images/adventure/current-navigator-home.png`
- `public/images/adventure/current-tide-hall.png`

Collision, portals, NPC positions, evidence stations, docks, and spawns are authored data and are not inferred from the raster art.

## Verification checkpoint

- `npm.cmd run test:adventure`: **256/256 passed**
- `npm.cmd test`: **487/487 passed**
- `npm.cmd run build`: production build succeeded
- `git diff --check`: clean

A seeded canonical-save browser run verified the manual Brackwater-to-Current voyage, continuous steering, docking, route and town art, Suri's paced greeting, all four observation modals, generic Site/Timing/Method context labels, an incorrect and accepted interpretation, an incomplete and accepted response, Dr. Amara's paced first greeting, automatic entry and exit for the Navigation Lab and Navigator Home, automatic Tide Hall entry, pre-report qualifier gating, autosave notices, and reload of a partial 4-of-4 investigation. The run produced no page exceptions or application 4xx responses.

Automated chapter-loop coverage additionally verifies both resident wins, report turn-in, Field Note grant, qualifier, pack grant and opening, Tide Mark, Kelpwatch route reward, JSON reload, and return travel.

## Open release gates

- [ ] Complete a clean-profile browser playthrough from Brackwater departure through the Current Commons return voyage without developer seeding.
- [ ] Complete tablet touch, safe-area, focus, modal-scroll, reduced-motion, and narrow-screen QA.
- [ ] Verify pre-duel, post-resident, ready-to-turn-in, post-report, post-qualifier, pack-opened, and return-visit saves through actual browser reloads.
- [ ] Confirm target-age players can explain a likely current corridor without treating it as an exact prediction or proof of ownership.
- [ ] Confirm target-age players select observe-record-report-authorized-response instead of direct gear handling.
- [ ] Obtain and record named marine-science review of the final current, drifter, ghost-gear, wildlife, removal, and prevention copy.
- [ ] Confirm through playtesting that no starter choice creates a material progression disadvantage in the Current Commons duels.
