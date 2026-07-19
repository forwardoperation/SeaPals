# SeaPals Adventure Phase 5 - Kelpwatch Island

**Status:** Regional vertical-slice implementation checkpoint verified; clean-profile, full accessibility/device, target-age comprehension, starter-balance, and named marine-science verification remain open

**Branch:** `codex/seapals-adventure`

**Scope source:** `docs/seapals-adventure-game-scope.md`

## Release boundary

Kelpwatch Island is the third and final independently testable Phase 5 regional release. It extends the existing movement, boat travel, ecosystem-chapter, dialogue, Simulator, collection, reward, and save systems; it does not add a parallel engine.

Authored for this release:

- A 16-by-10 first-voyage boat route from Current Commons to Kelpwatch Island, followed by dock-only auto-steer after the first completed manual crossing.
- A 16-by-10 rocky kelp-forest island town with a Kelpwatch Ecology Lab, Niko's Diver Cottage, and Kelpwatch Tide Hall.
- Five story roles: Ari as Island Guide, Dr. Mina Park as Kelp Forest Ecologist and field partner, Niko as Restoration Diver, Rosa as Coastal Ranger, and Tala as Tide Steward.
- Four matched food-web observations, two evidence decisions, two 10 VP resident duels, one quest-gated 10 VP qualifier, one Field Note, an earned 12-card-pool pack, the Kelpwatch Tide Mark, and a charted future route toward Trenchlight Station.
- Save-backed introductions, observation order, corrective attempts, accepted decisions, resident wins, field-report turn-in, one-time rewards, route state, and return dialogue.

Trenchlight Station and the sub expedition remain Phase 6 work. The Kelpwatch qualifier may chart `route-kelpwatch-trenchlight`, but this release does not make Trenchlight playable. Champion's Wake and its three 30 VP tournament games remain Phase 7 work.

## Learning and safety contract

After the chapter, the player should be able to:

1. Describe kelp as a habitat-forming or foundational species that creates food and structure for a community.
2. Build a simple three-link hypothesis: predators can limit grazers, grazers consume kelp, and changes at one link can affect the others.
3. Compare kelp cover, grazer counts, predator evidence, repeated visits, and a matched comparison site instead of assigning a cause from one observation.
4. Explain that a food-web pattern can be consistent with a trophic cascade without proving that one species caused every difference.
5. Name other drivers that can constrain kelp, including temperature, storms, nutrients, substrate, recruitment, disease, visibility, habitat structure, harvest, and other human activity.
6. Choose a bounded response: repeat standardized monitoring, protect remnant kelp, and let permitted specialists test a small, reversible, site-specific action against a reference site with success measures and stop criteria.

The chapter does not teach that ecosystems have one fixed ideal balance, that all grazers are harmful, that every kelp forest depends on the same predator, or that removing one species or adding one predator will always restore kelp. The player observes from marked stations and does not touch, feed, move, collect, remove, kill, or introduce organisms. Any underwater survey, organism handling, or restoration treatment is reserved for trained and permitted professionals.

## Evidence set

| Station | Evidence | Intended conclusion |
| --- | --- | --- |
| **Kelp-cover photo transect** (`kelp-cover-transect`) | Fixed photo points show less canopy at the marked cove than at a paired comparison cove during the same tide window. | Kelp cover is one end of the pattern, but low cover alone cannot identify a cause. |
| **Grazer-abundance belt count** (`grazer-abundance-count`) | A fixed belt overlaps the low-kelp area and contains more visible urchins and other large grazers than the comparison cove. | Grazers are a middle food-web link; the overlap supports a hypothesis, not a universal instruction to remove them. |
| **Predator-evidence survey** (`predator-evidence-survey`) | Matched timed views and remote-camera records repeatedly find less predator evidence at the lower-kelp, higher-grazer cove. | Predators are a third link, but a non-detection is not proof of absence and observation does not establish one causal pathway everywhere. |
| **Repeat and comparison-site check** (`repeat-comparison-site`) | The kelp/grazer contrast repeats at matched coves while temperature, nutrients, storm damage, substrate, recruitment, and visibility are logged. | Repetition strengthens the three-link hypothesis while preserving competing physical and biological explanations. |

The accepted interpretation is `three-link-food-web-fits-observed-pattern`. The accepted response is `monitor-drivers-and-test-bounded-restoration`. Unsupported choices remain retryable and receive evidence-specific corrective feedback; repeating the same unsupported choice does not inflate progress, and a supported choice cannot later be overwritten by an unsupported one.

## Authoritative sources

The runtime Field Note `field-note-kelp-food-web`, **A Kelp Forest Food Web**, uses the following authoritative planning boundary:

- [NOAA National Marine Sanctuaries - Kelp forest ecosystem](https://sanctuaries.noaa.gov/visit/ecosystems/kelpdesc.html)
- [NOAA Fisheries - Kelp forest habitat on the West Coast](https://www.fisheries.noaa.gov/west-coast/habitat-conservation/kelp-forest-habitat-west-coast)
- [National Park Service - Kelp forest communities monitoring](https://www.nps.gov/im/medn/kelp-forest-communities.htm)
- [NOAA Fisheries - Monitoring and evaluation of restoration projects](https://www.fisheries.noaa.gov/national/habitat-conservation/monitoring-and-evaluation-restoration-projects)
- [NOAA National Marine Sanctuaries - Restoring Balance](https://sanctuaries.noaa.gov/news/2026/restoring-balance.html)

These sources support kelp's habitat-forming role, food-web relationships, repeated indicator monitoring, reference comparisons, and adaptive restoration. They also support the chapter's context-dependent language: restoration outcomes vary, and grazer pressure can be one contributor without being the only driver. The sources do not replace a named marine-science review of the final child-facing copy.

## Chapter progression

1. Current Commons completion unlocks `route-current-kelpwatch`. The player boards at the authored Current departure dock, pilots the first crossing, and docks at `kelpwatch-dock`.
2. Arrival initializes `quest-kelpwatch-balance`. Evidence stations and lab decisions remain gated until the player completes Ari's paced greeting.
3. The four observations may be recorded in any order and revisited without duplicating progress.
4. The lab interpretation stays unavailable until all observations are recorded. The supported interpretation joins the three biological links while retaining physical and site-specific alternatives.
5. The response stays unavailable until the interpretation is accepted. The supported response uses repeated monitoring, a comparison site, permitted specialists, and a bounded adaptive test.
6. Dr. Mina Park's first greeting is stored separately from later guidance, report debrief, completed-chapter, and return dialogue.
7. Niko's Restoration Diver duel and Rosa's Coastal Ranger duel are both required for report readiness.
8. Only the four observations, accepted interpretation, accepted response, and both resident victories can move the quest to `readyToTurnIn`. Dr. Mina then grants **A Kelp Forest Food Web** exactly once.
9. Tala's qualifier remains locked until fieldwork is complete. Its first win grants the Kelpwatch Food-Web Pack, `tide-mark-kelpwatch`, and `route-kelpwatch-trenchlight` through the existing reward ledger.
10. Return conversations preserve uncertainty and continued monitoring. The completed Current-to-Kelpwatch route supports a manual return crossing or dock-only auto-steer.

## Duel, reward, and collection contract

| Milestone | Simulator contract | Result |
| --- | --- | --- |
| Niko first win | 10 VP, medium difficulty, **Murky Water** opponent | Counts `encounter-kelpwatch-resident-diver` toward report readiness; no separate inventory reward. |
| Rosa first win | 10 VP, medium difficulty, **Coral Garden** opponent | Counts `encounter-kelpwatch-resident-ranger` toward report readiness; no separate inventory reward. |
| Dr. Mina report turn-in | Existing fieldwork reward ledger | Grants `field-note-kelp-food-web` through `reward-kelpwatch-fieldwork`. |
| Tala qualifier first win | 10 VP, medium difficulty, **Stinging Fortress** opponent | Grants one **Kelpwatch Food-Web Pack**, `tide-mark-kelpwatch`, and the future `route-kelpwatch-trenchlight` chart. |
| Qualifier rematch | Same custom-deck Simulator path | Practice only; cannot duplicate the one-time reward. |

All three encounters launch through the existing active-deck snapshot and Simulator result-provenance contract. Required progression never depends on a random pack pull.

The earned-only `pack-pool-kelpwatch` draws four distinct cards from this 12-card pool and guarantees an unowned card when an eligible card remains: Sea Urchin, Anemone, Clownfish, Giant Triton, Crown-of-Thorns, Cleaner Shrimp, Cleaner Wrasse, Octopus, Fairy Parrotfish, Goliath Grouper, Reef Shark, and Marine Sanctuary.

## Save, revisit, and recovery acceptance

The canonical save must preserve:

- Ari's guide checkpoint and Dr. Mina's one-time introduction.
- Any partial observation order, interpretation/response attempts, accepted choices, and corrective-attempt counts.
- Both resident encounter victories, report readiness, fieldwork completion, Field Note grant, qualifier result, unopened/opened pack state, Tide Mark, route completion, and return dialogue.
- Manual first-voyage completion separately from later dock-only auto-steer eligibility.

The Kelpwatch reconciler derives `readyToTurnIn` and `complete` from actual evidence, decisions, and resident encounter records. Fabricating a terminal quest status cannot bypass missing work. Runtime reads remain strict; storage-boundary recovery discards only malformed chapter flags, preserves unrelated forward-compatible flags, and reopens a terminal quest when a malformed required flag invalidates its completion. An interrupted Field Note reward write is repaired idempotently without duplicating the reward.

Final release verification must demonstrate that the player can arrive, partially investigate, save, reload, finish both resident duels and fieldwork, qualify, open or retain the pack, leave, revisit, and return to Current Commons without a softlock or duplicated grant.

## Generated environment assets

The Kelpwatch environment set was created with the built-in image-generation workflow using project-bound prompts for cozy orthographic 16-bit pixel art, clear walkable centers, perimeter obstacles, environment-only scenes, and no characters, labels, logos, or unsafe wildlife handling:

- `public/images/adventure/current-kelpwatch-route.png`
- `public/images/adventure/kelpwatch-island.png`
- `public/images/adventure/kelpwatch-ecology-lab.png`
- `public/images/adventure/kelpwatch-diver-home.png`
- `public/images/adventure/kelpwatch-tide-hall.png`

The route prompt transitions from Current Commons open water to emerald kelp and rocky shallows while preserving an obvious central boat lane. The town prompt places the dock, Diver Cottage, Ecology Lab, Tide Hall, and four evidence landmarks around broad exploration loops. Interior prompts keep furniture, safe stored dive gear, monitoring displays, benches, and cabinets near the perimeter so authored collision can preserve a clear center corridor.

Raster appearance does not define gameplay geometry. Scene bounds, collision boxes, portals, NPC locations, evidence stations, docks, and spawns remain authored runtime data and require art-aligned collision QA.

## Runtime map

Chapter evidence and progression rules live in `src/app/adventure/adventureKelpwatch.mjs`. The reusable adapter and storage-boundary recoverer are registered through `src/app/adventure/adventureEcosystemChapters.mjs`; canonical world scenes, dialogue, Field Note, encounters, pack, rewards, and routes live in `src/app/adventure/adventureContent.mjs`.

## Verification plan

Run the focused Kelpwatch domain and integration contracts:

```powershell
node --test src/app/adventure/adventureKelpwatch.test.mjs src/app/adventure/adventureKelpwatchContentLoop.test.mjs src/app/adventure/adventureEcosystemChapters.test.mjs src/app/adventure/adventureContent.test.mjs src/app/adventure/adventureSession.test.mjs src/app/adventure/adventureTravel.test.mjs src/app/adventure/adventureWorld.test.mjs src/app/adventure/adventurePacks.test.mjs src/app/adventure/adventureAssets.test.mjs
```

Then run the complete regression and production build:

```powershell
npm.cmd run test:adventure
npm.cmd test
npm.cmd run build
git diff --check
```

Checkpoint results on July 18, 2026: the focused Kelpwatch contracts passed, `npm.cmd run test:adventure` passed 289 of 289 tests, `npm.cmd test` passed 520 of 520 tests, `npm.cmd run build` generated all 26 pages, and `git diff --check` passed. Seeded browser verification covered manual and two-way auto-steer travel, continuous steering and docking, all generated scenes, paced dialogue, evidence and corrective-feedback gates, automatic portals, qualifier gating and Simulator launch, one-time rewards, pack opening, save/reload persistence, return travel, return dialogue, representative collision paths, narrow-screen horizontal fit, page exceptions, and application 4xx responses. No page exception or application 4xx response was observed.

The browser checkpoint must cover manual Current-to-Kelpwatch travel, continuous steering and docking, all five generated scenes, Ari's paced greeting, every observation, one incorrect and one accepted interpretation, one incorrect and one accepted response, both automatic interior entries/exits, pre-report qualifier gating, partial investigation reload, resident wins, report turn-in, qualifier reward, pack state, departure, return voyage, and revisit dialogue. It must also record page exceptions and application 4xx responses.

## Open release gates

- [x] Complete focused Kelpwatch domain and content-loop tests.
- [x] Complete the full adventure suite, repository-wide suite, production build, and `git diff --check` after shared integration lands.
- [x] Complete a seeded browser checkpoint across travel, fieldwork, interiors, gating, reward, reload, and revisit states.
- [ ] Complete a clean-profile playthrough from Current Commons departure through the Kelpwatch return voyage without developer seeding.
- [ ] Complete desktop keyboard, tablet touch, safe-area, focus, modal-scroll, reduced-motion, and narrow-screen QA.
- [x] Verify collision against representative art landmarks and uninterrupted walkable routes through the town and each interior.
- [ ] Confirm target-age players can build the three-link hypothesis without treating it as proof, a fixed balance, or a universal intervention.
- [ ] Confirm target-age players choose observation and permitted, bounded monitoring/restoration instead of touching, removing, killing, moving, or introducing organisms.
- [ ] Obtain and record named marine-science review of the final kelp, grazer, predator, trophic-cascade, abiotic-driver, restoration, and safety copy.
- [ ] Confirm through playtesting that no starter choice creates a material progression disadvantage in the Kelpwatch duels.
