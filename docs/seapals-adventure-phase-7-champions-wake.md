# SeaPals Adventure Phase 7 - Champion's Wake

**Status:** Tournament domain, authored world/content, route-to-reward integration, save/reload recovery, settings integration, and seeded live-browser checkpoint implemented; clean-profile campaign play, full device/assistive-technology QA, performance, audio, child-privacy, target-age, balance, and named marine-science release gates remain open until separately verified

**Branch:** `codex/seapals-adventure`

**Scope source:** `docs/seapals-adventure-game-scope.md`

## Release boundary

Champion's Wake is the final floating settlement and championship chapter. It extends the existing route travel, exploration, deck-validation, Simulator-result, reward-ledger, Field Note, quest, and local-save systems. It does not create a second card engine or a separate tournament save format.

Authored for this phase:

- A 16-by-10 manual first-voyage route from Trenchlight Station to Champion's Wake, with dock-only auto-steer available after the route's first completed crossing.
- A floating tournament plaza plus Registration Hall, Tournament Arena, and Reflection Pavilion interiors.
- Six original story roles: Director Amara Vela, quarterfinalist Miri Fen, semifinalist Oren Vale, defending champion Sabine Rook, learning steward Dr. Ivo Kestrel, and junior Reefkeeper Tali.
- Registration gated by all five ecosystem Tide Marks, all five ecosystem Field Notes, and one legal active owned-card deck.
- One exact, persisted deck snapshot locked across an ordered three-round bracket attempt.
- Three full 30 VP games: Disruption in the quarterfinal, Open Ocean Hunt in the semifinal, and Darkness Shroud in the final.
- Defeat recording and same-round retry without losing the registered deck, cards, bracket wins, or one-time rewards.
- Exactly-once completion of the bracket, Champion's Wake quest, SeaPals Championship Cup, and Archipelago Reflections Field Note.
- Tournament conversations, spectator and reflection conversations, ceremony/epilogue material, and postgame conversation modes.

The implementation checkpoint is not the same as a Version 1.0 release sign-off. Automated contracts prove state transitions and authored references. They do not prove that a child can complete the entire campaign in a browser, understand every synthesis prompt, use every supported device and assistive technology, or receive scientifically and legally reviewed production copy.

## Entry and registration contract

The Trenchlight qualifier grants `route-trenchlight-champions-wake`. The player boards at `trenchlight-champions-wake-dock`, manually reaches the opposite docking zone, and docks at `champions-wake-dock`. The completed route remains available for later two-way travel under the existing route rules.

Entering any safe, non-route Champion's Wake scene starts `quest-champions-wake` when it has not yet begun. This arrival reconciliation is idempotent and also runs during safe resume. It does not register or alter a deck. The authored Director interaction, `interaction-champions-wake-director`, is the explicit registration boundary; registration requires:

1. `tide-mark-sunpatch` and `field-note-coral-observations`.
2. `tide-mark-brackwater` and `field-note-estuary-conditions`.
3. `tide-mark-current` and `field-note-current-connections`.
4. `tide-mark-kelpwatch` and `field-note-kelp-food-web`.
5. `tide-mark-trenchlight` and `field-note-deep-adaptations`.
6. An active deck that passes the shared game-facing legality rules and is supported by the player's owned-card inventory.

Successful registration stores the active deck's identifier, name, normalized card quantities, and fingerprint in `progression.tournament.lockedDeckSnapshot`. Editing or switching the active deck afterward does not change the registered bracket list. Reloading does not reconstruct the list from mutable deck-library data.

If an active tournament save has no snapshot or a fingerprint that cannot be verified, tournament recovery fails closed and returns the bracket to registration. It does not silently substitute the current active deck.

## Ordered 30 VP bracket

| Round | Opponent | Simulator deck | Difficulty | Win result |
| --- | --- | --- | --- | --- |
| Quarterfinal | Miri Fen, Tidal-Creek Tactician | Disruption | Medium | Records `encounter-tournament-quarterfinal` once and opens the semifinal. |
| Semifinal | Oren Vale, Blue-Water Navigator | Open Ocean Hunt | Hard | Records `encounter-tournament-semifinal` once and opens the final. |
| Final | Sabine Rook, Defending SeaPals Champion | Darkness Shroud | Hard | Records `encounter-tournament-final`, completes the bracket and quest, and grants the championship reward once. |

Every launch is bound to the authored opponent, opponent deck, registered player-deck fingerprint, and a 30 VP target. A result with a different encounter, opponent, deck fingerprint, or VP target is rejected instead of being adapted into progression.

Only the active unfinished round is available during the bracket. A defeat records one attempt and its result evidence while preserving the same active round and locked snapshot. A victory advances exactly one position. A stale duplicate victory callback is a no-op: it does not increment attempts, advance twice, or grant another reward.

The final reward is `reward-tournament-champion`, which grants one `seapals-championship-cup` story item and adds `field-note-archipelago-reflection`. The reward ledger remains the source of truth for one-time delivery. Recovery can repair an interrupted final reward write from verified ordered victory evidence without granting a second Cup or note.

## Ecosystem synthesis contract

Champion's Wake is a synthesis and transfer chapter, not a sixth field investigation. Its conversations ask the player to compare the evidence habits practiced in the five habitat towns:

- Distinguish an observation from an explanation.
- Match a claim to local measurements and relationships.
- Compare plausible alternatives instead of assigning one cause too quickly.
- Keep uncertainty visible when evidence is incomplete.
- Choose bounded, habitat-protective actions with monitoring and a way to revise or stop.
- Avoid treating one response, habitat pattern, or card strategy as universal.

The tournament scenario copy intentionally retains the earlier chapters' limits: white coral is not automatically dead, murky water is not automatically polluted, a modeled current does not prove an exact path or owner, one food-web pattern does not prove one universal driver, and darkness does not prove a hydrothermal vent. The ending describes continued observation and modest follow-up work rather than declaring the archipelago permanently fixed.

This authored synthesis still requires a named marine-science review. Structural tests can confirm that the intended caveats exist, but they cannot establish that every child-facing statement is accurate, age-appropriate, complete, or unlikely to create a misconception.

## Save, retry, ending, and postgame acceptance

The canonical save must preserve:

- Manual route completion, current safe dock, Champion's Wake scene and position, and later return travel.
- The Champion's Wake quest state and any presentation flags used by ceremony, epilogue, credits, and postgame unlocking.
- Tournament status, active round, ordered completed-round IDs, registration attempt baselines, exact victory-attempt proof, and the exact locked deck snapshot.
- Every duel attempt's latest result and immutable first-victory provenance.
- The one-time Cup, Archipelago Reflections Field Note, and reward-ledger entry.

Required live behavior is:

1. Save immediately after registration and before each tournament round.
2. Save each defeat or victory before showing the corresponding Arena result state.
3. Resume the same round and registered deck after a defeat or reload.
4. Resume the first unfinished ceremony, epilogue, or credits step after interruption.
5. Never replay the one-time ending automatically after postgame is unlocked.
6. Preserve free travel and allow practice-only rematches without reopening or mutating the completed bracket.

The automated content-loop checkpoint covers route arrival, automatic quest activation on safe Champion's Wake scene entry, the authored registration action, legal-deck registration, a local save/reload after registration, all three ordered 30 VP wins with a save/reload after each result, exact locked-fingerprint reuse, exact-once Cup and Field Note delivery, duplicate-final-callback rejection, rematches remaining closed before the ending, and practice-only availability after `postgame-unlocked`. Attempt-scoped recovery also preserves a completed bracket when only its archival deck list is missing, without reopening rewards or substituting the current deck.

## Live browser checkpoint

Seeded browser scenarios verified the registration record and legal 60-card deck lock, persistence after reload, the quarterfinal's real Simulator launch with Miri Fen at 30 VP, safe loss/retry presentation, ceremony-to-epilogue-to-credits progression, interrupted ending resume, one-time postgame unlock, practice availability, and free relocation to the Reflection Pavilion. Desktop, 360-by-800 phone, 667-by-375 landscape, and 834-by-1112 tablet viewports showed no horizontal overflow or application page errors. Settings were exercised for instant text, reduced motion, high contrast, and completed-route boat auto-steer.

The boat now uses throttle, braking/reverse, momentum, and a speed-sensitive rudder instead of rotating or teleporting between four movement directions. Deterministic physics and rendering checks cover continuous headings, coasting, reverse steering, swept collision, shoreline sliding, speed-scaled wake feedback, destination bearing, and dock-ready guidance. Human feel testing on keyboard and touch remains a release gate.

These are controlled, seeded checkpoints. They do not replace a fresh unseeded campaign, three human-played 30 VP tournament wins, assistive-technology testing, or target-age usability sessions.

## Generated environment assets

The Champion's Wake environment set was created with the built-in image-generation workflow. The prompt set requested cozy orthographic 16-bit pixel art, 3:2 environment-only compositions, clear central traversal lanes, perimeter landmarks, distinct teal/gold/purple pavilion palettes, no characters, no labels, no logos, and no baked-in interface elements:

- `public/images/adventure/trenchlight-champions-wake-route.png`
- `public/images/adventure/champions-wake-town.png`
- `public/images/adventure/champions-wake-registration-hall.png`
- `public/images/adventure/champions-wake-arena.png`
- `public/images/adventure/champions-wake-reflection-pavilion.png`

The route prompt moves from Trenchlight's dark dock toward a warm festival dock through a clear buoy-marked teal-and-gold channel. The town prompt establishes a registration building, arena, pavilion, central plaza, and habitat-inspired gardens. Interior prompts place counters, spectator edges, exhibits, and tournament landmarks around open circulation space.

Raster appearance does not define gameplay geometry. World bounds, collision rectangles, automatic doors, NPC positions, route endpoints, and safe spawns are separate authored data. The five source PNGs total about 15.3 MiB, so responsive delivery, decoding cost, caching, and image optimization remain performance release gates.

## Runtime map

Canonical Champion's Wake scenes, cast, conversations, encounters, reward, route, docks, and interactions live in `src/app/adventure/adventureContent.mjs`. Tournament registration, recovery, launch identity, result recording, ordered progression, and reward completion live in `src/app/adventure/adventureTournament.mjs`. The small shared round gate lives in `src/app/adventure/adventureTournamentGate.mjs` so general encounter availability can enforce tournament order without introducing a session/controller import cycle.

The locked snapshot is an additive schema-v2 field normalized by `src/app/adventure/adventureProgression.mjs`. Browser persistence continues through `src/app/adventure/adventureStorage.mjs`; no Phase 7 cloud-save or account data model was added.

## Automated test matrix

| Contract | Primary evidence | What it proves | What it does not prove |
| --- | --- | --- | --- |
| Tournament domain | `adventureTournament.test.mjs` | Requirements, legal registration, immutable snapshot, ordered gates, loss/retry, strict result identity, reload, recovery, and exact-once final reward. | Browser wiring, comprehensibility, or real-match balance. |
| Authored content and world | `adventureChampionsWakeContent.test.mjs` | Route, docks, four runtime scenes, reachable doors/interactions, original cast/conversations, three authored 30 VP encounters, and content-validator failures. | Art-aligned feel on every screen size or full user navigation. |
| Route-to-reward integration | `adventureChampionsWakeContentLoop.test.mjs` | Manual arrival, safe-scene quest activation, Director registration boundary, local persistence after every bracket milestone, three ordered wins, exact-once Cup/Field Note, and practice-only postgame encounter gates. | Ceremony/credits focus flow, a defeat in the live Simulator, or postgame rematch presentation. |
| Fresh-profile campaign acceptance | `adventureCampaignLoop.test.mjs` | Each real starter crosses tutorial, six first voyages, five chapters, packs, repeated save/recovery boundaries, a persisted quarterfinal defeat/retry, three 30 VP results, ending, postgame, and return travel without seeded progression. | Real rules-engine victories, continuous browser navigation, balance, child comprehension, or device/accessibility QA. |
| Shared regression | Adventure content, progression, session, travel, storage, world, deck, Field Note journal, and Simulator tests | Existing save/travel/encounter systems remain compatible with the complete campaign; Stunned, Lionfish ownership with attack-to-owner-Lost and Spearfishing-to-owner-discard removal, Cookie Cutter fallback, per-attack Ensnare, Green Sea Turtle healing, and Deep Sea Jelly Flashing Alarm have controller parity. | External review or human playability. |
| Live UI/browser checkpoint | Dedicated Champion's Wake UI tests and browser evidence | Registration and bracket controls, 30 VP Simulator launches, retry, ending resume, postgame, focus, responsive layout, and errors in the running application. | Named science review, legal privacy determination, or target-age learning outcomes. |

Run the focused Phase 7 contracts:

```powershell
node --test src/app/adventure/adventureTournament.test.mjs src/app/adventure/adventureChampionsWakeContent.test.mjs src/app/adventure/adventureChampionsWakeContentLoop.test.mjs src/app/adventure/adventureContent.test.mjs src/app/adventure/adventureSession.test.mjs src/app/adventure/adventureTravel.test.mjs src/app/adventure/adventureStorage.test.mjs src/app/adventure/adventureWorld.test.mjs
```

Then run the complete regression and production gates:

```powershell
npm.cmd run test:adventure
npm.cmd test
npm.cmd run build
git diff --check
```

Latest integrated checkpoint results:

- `npm.cmd run test:adventure`: **367/367 passed**.
- `npm.cmd test`: **602/602 passed**.
- `npm.cmd run build`: **26/26 routes generated successfully**.
- `git diff --check`: **passed** (line-ending notices only).

## External review gaps

### Marine science

The five regional phase documents record authoritative planning sources and the tournament copy preserves their key uncertainty limits. No named marine scientist has yet approved the final combined set of Field Notes, NPC conversations, scenario prompts, measurements, safety language, or archipelago synthesis. That review must be performed by a qualified reviewer, recorded with version/date and disposition of findings, and repeated for materially changed science copy. Automated tests and source links do not close this gate.

### Child privacy

The post-Phase-7 account increment now requires a verified, adult-owned Supabase family account before `/adventure` renders. It adds Google and passwordless email authentication, account-scoped local save namespaces, an explicit older-save import choice, a separate optional Kit marketing opt-in, and a post-play invitation that asks for explicit adult and marketing confirmations before Kit emails the adult account holder. Declining or a provider failure never blocks play, and Kit acceptance is recorded as submitted rather than subscribed until confirmation. It does not add a child name, chat, user-generated content, public profile, cloud save, or tournament submission. Google Analytics is excluded from the account and adventure routes. These are data-minimizing design controls, not legal conclusions.

A formal child-privacy review is still required before the account requirement is enabled publicly. It must inventory Google, Supabase, Kit, Cloudflare, Resend, production analytics, error reporting, cookies and local storage, hosting logs, embedded/third-party requests, retention and deletion behavior, privacy notice language, parental notice and consent requirements, and jurisdiction-specific obligations. The product should not claim COPPA or other legal compliance based only on an adult-attestation checkbox or the current local-first save architecture. Provider setup and review details are recorded in `docs/adventure-account-setup.md`.

### Audio

No adventure audio files or audio runtime were found at this checkpoint. Therefore the Phase 7 scope item for audio is not implemented or verified. The release decision must either explicitly approve a silent launch or add licensed/original audio with persisted mute and volume controls, redundant visual/text cues for every informative sound, reduced/startle-safe behavior, and device/browser testing. Audio must never be the only way to learn that a turn, warning, interaction, or result occurred.

## Open release gates

- [x] Author the Champion's Wake route, floating town, three interiors, original cast, conversations, and ordered 30 VP encounters.
- [x] Implement legal registration, an exact persisted deck lock, strict ordered launches/results, loss-safe retry state, reload recovery, and exact-once final reward behavior.
- [x] Add a cross-boundary route-to-registration-to-three-wins-to-reload automated acceptance test.
- [x] Add fresh-profile domain/storage acceptance for Coral Garden, Murky Water, and Blue Water through the complete campaign, including a persisted tournament defeat/retry.
- [ ] Verify the complete live registration and bracket UI, including invalid-deck recovery through the Deck Workshop.
- [ ] Verify a real Simulator defeat/retry and all three real 30 VP victories with the same locked deck snapshot.
- [x] Verify ceremony, epilogue, credits, interrupted-step resume, one-time presentation, postgame free travel, and practice-only rematches in controlled seeded browser scenarios.
- [ ] Complete a fresh, unseeded live browser playthrough from starter choice through all five ecosystem chapters and the final tournament.
- [x] Resolve mandatory-deck effects for Stunned, Lionfish invasion with successful-attack-to-owner-Lost and Spearfishing-to-owner-discard parity, Cookie Cutter's board-supply fallback, and per-attack Ensnare.
- [ ] Complete desktop keyboard, tablet/touch, narrow-phone, safe-area, focus, screen-reader, text-scaling, contrast, reduced-motion, modal-scroll, and 44-pixel-target QA.
- [ ] Optimize and measure the five generated images and complete route/town/Simulator performance checks on representative low-powered devices.
- [ ] Complete final opponent tuning and confirm through playtesting that no starter or reasonable legal deck suffers a material progression disadvantage.
- [ ] Complete target-age comprehension testing across registration, deck lock, 30 VP pacing, evidence synthesis, losses, retry, ending, and postgame.
- [ ] Obtain and record named marine-science review of the final child-facing campaign and synthesis copy.
- [ ] Complete and record formal child-privacy review of the actual production deployment and data flows.
- [ ] Resolve the audio scope decision and verify the resulting accessible behavior.
- [x] Run the complete test/build/diff regression on the final integrated tree and record the results here.
