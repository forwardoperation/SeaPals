# SeaPals Adventure Phase 3 - Collection and Deck Progression

**Status:** Feature-complete in the Shellshore slice; desktop and tablet manual QA remain open

**Branch:** `codex/seapals-adventure`

**Scope source:** `docs/seapals-adventure-game-scope.md`

## Implemented player-facing slice

- Choosing Coral Garden, Murky Water, or Blue Water now initializes the exact 60-card starter collection, creates its canonical saved deck, and makes it active.
- Existing Phase 2 saves with a selected starter but empty collection repair automatically without reducing cards earned later.
- Marina's first victory awards one earned-only, versioned Shellshore Discovery Pack. Duplicate result callbacks and rematches cannot repeat the reward.
- The pause menu now opens an Inventory with four explicit categories: Card Collection, Booster Packs, Story Items, and Boat Items.
- A Shellshore Discovery Pack reveals four unique cards, adds them to the permanent collection, and guarantees at least one previously unowned card while an eligible card remains in the pool.
- Pack opening autosaves immediately. If local saving fails, the in-session result remains available and the Inventory explains that Save game should be retried.
- Older saves that already record Marina's victory receive the missing first-win reward once during resume recovery.
- The pause menu opens a Deck Workshop with deck create, duplicate, rename, delete, draft save, validation, and active-deck selection flows.
- Opening a pack offers a direct **Build with these cards** path. Newly revealed cards are highlighted in the workshop.
- The card browser includes owned quantities, locked/unowned explanations, expandable rules text, live legality errors, category composition, VP share, average RP, and five non-authoritative tendency metrics.
- Unsaved edits cannot be discarded accidentally by closing the workshop or selecting another deck.

## Data and recovery contracts

- Starter reconciliation validates an exact 60-card manifest and never mutates the supplied save.
- Reconciliation raises owned quantities only to the starter minimum, preserving later-earned excess cards and unrelated progression.
- Pack definitions declare a stable ID, positive version, display name, cards per pack, earned-only policy, guarantee policy, and a non-empty unique card pool.
- Pack pulls use injected randomness for deterministic tests and sample without replacement.
- Pack consumption and card additions are one normalized save transition; a failed validation cannot partially consume a pack.
- The reward ledger remains authoritative. Encounter completion, recovery, duplicate callbacks, and rematches converge on the same single Marina grant.
- Every duel freezes and revalidates the exact active 60-card deck before Simulator state is created.
- Encounter, opponent, target, deck ID, and recomputed deck fingerprint must match the locked launch identity before progression or rewards can change.
- The latest duel attempt and immutable first-victory deck provenance survive save and reload.

## Verification completed

- All three starters initialize exact canonical ownership and a legal saved 60-card deck.
- Legacy collection repair is idempotent and preserves unrelated save domains.
- Marina grants one pack; Dorian grants none; duplicate and recovered callbacks do not duplicate rewards.
- Pack opening is deterministic, nonmutating, atomic, and rejects missing or planned packs.
- A checkpoint integration test covers starter selection, Marina victory, save/reload, pack opening, save/reload, and duplicate-win protection.
- A custom-deck integration test covers pack discovery, starter duplication, owned-card editing, activation, save/reload, frozen launch, post-launch library editing, exact result fingerprint, and persisted first-win provenance.
- Mismatch tests reject stale encounter, opponent, target, deck ID, and fingerprint callbacks.
- Adventure tests and the production Next.js build pass.

## Remaining Phase 3 validation

- Complete the full player-facing collection-to-custom-duel path on desktop and tablet without developer seeding.
- Confirm that the card catalog, expandable details, and quantity controls remain comfortable at the target tablet viewport.
- Run target-age comprehension playtesting for the pack-to-workshop handoff and legality explanations.

## Phase 3 exit criteria

- [x] Selecting any starter grants its exact 60 cards once and creates its active saved deck.
- [x] A first resident victory grants an earned booster exactly once.
- [x] Opening the booster updates collection and inventory exactly once and survives reload.
- [x] Inventory visibly separates cards, boosters, story items, and boat items.
- [x] A player can create, edit, validate, save, duplicate, rename, delete, and activate an owned-card deck.
- [x] A resident duel launches with an immutable snapshot of that exact custom deck.
- [ ] Desktop and tablet manual QA complete the full collection-to-custom-duel loop without developer seeding.
