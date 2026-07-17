# SeaPals Adventure Phase 1 - Persistent Game Shell

**Status:** Implemented; ready for product review

**Branch:** `codex/seapals-adventure`

**Scope source:** `docs/seapals-adventure-game-scope.md`

## Player-facing result

- The adventure opens on a title screen with exactly three local voyage slots.
- Empty slots offer **New Game**. Valid slots show location, encounter count, playtime, last-save time, **Continue**, and a confirmed **Start over** action.
- A visible 44-pixel menu control and `Escape` open the pause menu. The menu supports Resume, manual Save, Save and return to title, and confirmed voyage restart.
- Save failures remain visible and retryable without ending the current play session.
- Voyage playtime advances while the game is active and visible, pauses with the game or hidden tab, and is included in profile summaries.
- Keyboard, touch controls, conversations, scene transitions, continuous movement, collision, and story duels retain their prototype behavior.

## Save and recovery contract

- `adventureStorage.mjs` owns three fixed profile IDs: `profile-1`, `profile-2`, and `profile-3`.
- Each profile uses a versioned storage envelope outside canonical save schema v1 so monotonic write revisions, timestamps, save kind, and checkpoint IDs do not leak into game state.
- Writes validate and normalize the save, rotate a valid primary into backup, write and verify staging, write and verify primary, and only then remove staging.
- A malformed or incomplete primary can recover from the newest valid staging or backup copy. Monotonic revisions ensure a newer verified staging write wins after an interrupted primary replacement even if the device clock moves backward. Unrecoverable or unavailable storage returns structured recovery information instead of throwing or showing a blank game.
- The legacy `seapals-reefbound-progress-v1` value migrates once into an explicit canonical profile. The legacy key is removed only after the new profile verifies successfully.
- Manual saves capture the current valid exploration position. Autosaves occur for new games, scene transitions, pre-duel checkpoints, duel results, repaired profiles, return to title, and a dirty page becoming hidden.
- A voyage started while a slot is unreadable cannot later overwrite recovered data silently; claiming that slot requires a fresh overwrite confirmation.
- Manual Save retries adapter creation for an in-progress offline session, so recovered browser storage can be reclaimed without abandoning play.

## Central adventure state

- `AdventureGame.jsx` now derives scene, position, facing, quest progress, and completed trainers from one canonical save object.
- Home entry sets a real quest flag (`visited-coral-home` or `visited-deep-home`) and autosaves the scene checkpoint.
- Marina and Dorian use canonical encounter IDs. Wins are idempotent and advance the Shellshore quest to `readyToTurnIn` after both resident encounters.
- Loaded locations pass a content-aware safety check. Invalid positions fall back to the scene spawn; unknown or cross-town scenes fall back to the last authored safe dock and finally the global adventure start.
- Resume reconciles older encounter progress with the active Shellshore quest so migrated wins cannot strand quest progression.
- Mid-duel saving remains excluded. The simulator emits one structured result callback, and only victories complete an encounter.

## Content-driven Shellshore

- The current town and two home maps, collision tiles, spawns, and interactions now originate in `ADVENTURE_CONTENT`.
- Marina and Dorian NPC metadata, three conversation modes, and encounter configuration are content records rather than component constants.
- Runtime selectors resolve towns, scenes, docks, NPCs, conversations, encounters, and interactions while the existing world movement API remains stable.
- The content validator checks runtime scene maps, transition ownership, safe docks, NPC/conversation/encounter references, and prototype interaction IDs.

## Phase 1 exit criteria

- [x] A player can walk through the village and both homes, change a quest flag, save, reload, and resume at the same safe position.
- [x] Malformed primary data recovers from a valid backup and repairs the primary through the visible Continue flow.
- [x] Unrecoverable, unavailable, and legacy data expose structured recovery paths.
- [x] Three profiles, overwrite confirmation, manual saves, and meaningful autosave checkpoints have automated coverage.
- [x] Desktop keyboard and mobile touch exploration remain usable at supported viewport sizes.
- [x] Modal focus is contained and restored; save success and failure messages are announced accessibly.

## Verification

Automated checks:

```powershell
npm.cmd run test:adventure
npm.cmd test
npm.cmd run build
```

Browser checks used clean local profiles at desktop and touch viewports. They verified New Game, active-quest primary and backup copies, advancing playtime, pause/manual save, movement, exact-position reload, a home-entry quest flag, backup recovery/repair, pre-duel save-failure confirmation, recovered-slot overwrite protection, no horizontal overflow, and 44x44 touch movement/menu targets.

## Boundaries carried into Phase 2

- Profiles are local to the current browser. Cloud sync and accounts remain deferred.
- The player still uses the prototype Coral Garden deck in resident duels. Starter choice belongs to Phase 2.
- The academy lab, mentor, live simulator tutorial, and tutorial validation do not exist yet.
- Arbitrary owned-card deck snapshots, boosters, inventory UI, and deck building remain Phase 3 work.
- The named marine-science approver remains required before final educational dialogue ships.

## Phase 2 handoff

Phase 2 should build on the persistent shell by adding the academy interior, original mentor, one-time starter selection, starter preview metrics, real simulator tutorial checkpoints, friendly 10 VP practice duel, first Field Notes, and boat-safety introduction. Every one-time starter or tutorial reward should use the existing reward ledger and save checkpoints.
