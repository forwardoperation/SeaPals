# Gallery card audit — October 2026

## November 9 Coral Nursery sync

Replaced Coral Gardener's displayed name and artwork with Coral Nursery from the [Support source card](https://www.figma.com/design/xeol2YE0jCE0N5vAD6tjzx?node-id=259-692). The card remains Reef 86/102, Common, and an Aide: search for one Coral, put it in hand, and shuffle afterwards. Added the printed shuffle instruction to the canonical rules text; the simulator already implements that effect.

The gallery, set list, deck builder, six physical deck contents lists, Adventure card references, both simulator tutorials, generated card reference, and Finn now use Coral Nursery. The stable `coral-gardener` ID and artwork path preserve saved decks, games, and links. Historical printed-name evidence stays intact and resolves through the existing name-override mechanism. Finn recognizes either card name and answers with Coral Nursery.

Exported the current Figma card to the standard 375 × 525 preview and refreshed its cache hash. The source has no Prerelease label, bringing completed artwork to 79 cards. The isolated release passes all 1,290 simulator, catalog, deck, Adventure, and rules checks. All 204 gallery previews and 221 public card images pass size/hash checks; generated references verify 206 cards and 138 creatures. The production webpack build generates all 170 pages.

## November 7 Oysters and Day Octopus sync

Refreshed both gallery previews from their current Figma source cards, preserving 375 × 525 previews and updating the image cache hashes. The simulator and resumed games resolve those same versioned images. Oysters no longer has a Prerelease label, bringing completed artwork to 78 cards.

Oysters now has no Habitat play requirement. Its Eco Boost raises the controller's RP bank cap by 2, plus another 2 while Coral Reef is in either ecosystem. Updated the playable definition, tutorial guidance, and generated card reference. The conditional bank bonus follows live Habitat state, applies once per Oyster, and is suppressed when that Oyster's abilities are stunned.

Day Octopus retains 4 RP / 4 VP / D6, King of Camouflage, and its printed 3 RP Mimic action. Mimic now copies an available opposing creature Action for both the player and automated opponent. It charges only Mimic's 3 RP, without the donor Action's RP surcharge, and keeps the Octopus as the acting creature. The copied Action retains its targeting, effects, repeated attacks, and cooldown; On Play effects, passives, and recursive Mimic copying are excluded. Choices use the latest live opposing creatures and are revalidated when selected. Each physical Octopus has its own once-per-turn Mimic use, and canceling before commitment spends neither RP nor that use.

Verification: all 2,965 project tests pass, including Oyster rule, stun, removal, projected-event, and analytics regressions; player and opponent Mimic behavior; and refreshed artwork metadata expectations. The production webpack build generates all 170 pages. Gallery checks verify 204 previews and 221 public card images; generated card references verify 206 cards and 138 creatures. Validation ran against the release checkout with the current main changes integrated.

## November 1 artwork and Day Octopus sync (historical checkpoint)

Refreshed the Day Octopus and all 24 Apex/Filter Feeder public previews from the current Figma source frames at 375 × 525. The sync updates cache hashes and export provenance, including removal of the obsolete Octopus reviewed-preview source. The before/current image comparison and captured card text are in `artifacts/nov1-art-sync/`.

- Day Octopus retains card ID `octopus`, set printing 46/102, and saved-deck compatibility. The gallery, set list, deck display, encyclopedia, creature facts, Finn knowledge, and generated card references use its new name. The former encyclopedia URL redirects permanently to `/encyclopedia/day-octopus`.
- The species is now *Octopus cyanea*, replacing the former blue-ringed identification. Educational facts and sources match the new species and printed measurements.
- At the November 1 checkpoint, printed rules were 4 RP / 4 VP / D6, King of Camouflage (+4 Defense while either ecosystem has Coral Reef), and Mimic (3 RP). Camouflage was implemented in combat. Mimic was documented but unavailable in the simulator, with an unsupported-action notice and no RP charge; the November 7 update above implements it.
- Humpback Whale, Ocean Sunfish, and Basking Shark no longer carry Prerelease labels. Completed gallery artwork increases from 74 to 77 cards. Other art-completion labels follow visible current Figma text.
- Ocean Sunfish and Bluefin Tuna now require Open Ocean only, matching the current printed cards.

Verification: 204 gallery previews and 221 public card images pass size/hash checks; 41 gallery, set-list, deck, encyclopedia, and action-availability checks pass; all 54 rules-suite checks pass; 102 targeted habitat/tutorial/rules checks pass. The production webpack build generates all 169 pages. The broader simulator/component run has one existing Cleaner Shrimp bio expectation failure in `updatedCardArtworkRules.test.mjs`; its other 1,155 tests pass. No deployment was performed.

Audited the 204 entries in `src/data/gallery-images.json` against the playable card catalog. Read the current text from 203 linked designs in the [SeaRealm Figma file](https://www.figma.com/design/xeol2YE0jCE0N5vAD6tjzx); Southern Flounder has an existing preview instead of a source node, so its bundled gallery image was checked visually. It matches 3 RP / 3 VP / D10 with no abilities.

The initial audit found 193 cards shared by the gallery and the 199-card playable catalog, including six existing entries outside this gallery export. That rules update changed 52 playable definitions (including the Aide/Item classification on all 20 Supports), the shared simulator engine, tutorial lessons, player instructions, and Finn's rules knowledge. The subsequent deck-list sync added six printed creatures, bringing the catalog to 205 cards, with 199 shared gallery entries.

## Changes applied

| Card(s) | Current gallery rule applied |
|---|---|
| Bottlenose Dolphin | Social Hunter replaces Savvy Hunter: D10 against Apex, Predator, or Fish; +2 for each dolphin in the owner's ecosystem, including itself. Echo Locate still draws three. |
| Green Moray Eel; Reef Shark | The bonus die / additional Bites require **Coral Reef**, rather than any Habitat. |
| Lionfish | D6 defense; Invader D4; Venomous gives attackers disadvantage. Destroyed Lionfish goes to its original owner's Lost Zone. Spearfishing explicitly discards it to that owner's discard pile. |
| Cleaner Wrasse; Picasso Triggerfish; French Angelfish; Blue Tang | Eco Boost adds +1 to the RP bank cap. Blue Tang has no Coral Reef play requirement. |
| French Angelfish; Queen Angelfish | French: 3 RP / 3 VP / Eco Boost +1. Queen: 4 RP / 4 VP / Eco Boost +2. Removed their former conditional Coral Reef VP bonuses. |
| Sergeant Major | 2 VP. Existing internal ID `sargeant-major` is retained. |
| Bluestriped Grunt | Search for two **Reef** Fish, then shuffle. |
| Emerald Crab; Blue Crab; Arrow Crab | Removed Eco Boost. Blue Crab costs 1 RP; its Recycle and Scavenge remain. Cleaner Shrimp and Oysters retain their own Eco Boost. |
| Crown of Thorns | Venomous replaces Toxic. Stun is now **Coral Shock**; it and Venom Spines each cost 1 RP. |
| Nudibranch | Toxic added. Munch reduces a chosen Coral's next RP collection by 2. |
| Giant Triton | 3 RP / 3 VP. Starfish Hunt targets any Invertebrate, has advantage against Crown of Thorns, costs 1 RP, and cannot be used on the next turn. Removed Toxic Immunity. |
| Giant Clam; Basking Shark | D6 and D20 defense, respectively. |
| Reef Manta Ray (`manta-ray`) | 4 RP / 6 VP / D8; requires 135 School Density and Coral Reef. Kept its existing ID so saved decks still resolve it. |
| Barrel Eye; Tripod Fish; Gulper Eel | Barrel Eye is 3 RP / 3 VP. Tripod defense is D4. Gulper Eel's Darkness Shroud adds +4 with Abyss. |
| Deep Sea Jelly | Highlight applies to the next On Play attack **this turn**; unused bonuses expire for both controllers. |
| Frigate Tuna | Snap is a 1 RP **Action**, D4−1 against Fish; removed its former On Play attack. |
| Man O' War | Venomous replaces Stinging Tentacles. Nerve Agent costs 1 RP. Deadly Poison costs 2 RP and deals D4−2 HP (minimum 0) to an opposing Coral. This is 0–2 HP, without the School attack ×10 multiplier. |
| Blue Sea Dragon | Venomous replaces the former Toxic coin defense. Munch costs 2 RP. |
| Krill Bloom, all three stages | When an attack destroys it, Plenteous shuffles the destroyed card itself into its Foundation Deck instead of discard. Its stage is preserved; an unrelated base Krill is not recovered. Discarding or destruction from loss of a continuous health bonus does not trigger this attack-dependent passive. |
| Dr. Evans | Discard the remaining hand and draw **eight**, with existing split-deck allocation and required-draw depletion rules. |
| Recovery | Item; 2 RP; recover a **Support** from discard. No coin flip. Choosing a target commits the cost; cancellation spends nothing. |
| ROV Lights | Item; search for two Deep Fish. Removed the former +2 attack bonus. |
| Restocking | Return up to three **Creatures** from discard to their appropriate personal decks, preserving duplicate copies. |
| Whale Watcher Dani | Updated display name; existing `capt-dani` ID retained. |
| All Supports | **One Aide per turn. Items have no count limit and may be played after an Aide.** Other active restrictions and costs still apply. The opponent tracks the same Aide restriction. |
| Fishing Nets | Blocks Apex, Filter Feeders, and Creature Schools / Baitballs. Ordinary Fish remain playable. |

The tutorial bank-cap example now uses Cleaner Shrimp. Blue Crab's lesson explains Recycle instead. The Support lesson draws eight, leaves its final scripted draw available, and uses Abundant Sunlight so the revised bank can fund the combo. Scripted progression checkpoints and deterministic combat seeds were updated with the lesson setups.

## Timing wording to confirm

Two gallery phrases do not fully specify timing. Existing behavior is preserved pending a ruling:

- **Lionfish, “at the start of your turn”:** the existing maintained ruling triggers on the turn of the player hosting Lionfish. Heads/tails targets remain relative to the original owner. The new phrase could instead mean the owner's turn.
- **Juvenile Bluefin Tuna, Tuna School:** the existing simulator searches on play. The gallery labels it Passive without specifying whether or when it repeats.

## Gallery designs outside the playable catalog

These 11 entries were gallery-only at the initial audit. The deck-list sync added Winter Flounder, Spotfin Butterflyfish, Longhorn Cowfish, Nurse Shark, Yellow-Lipped Sea Krait, and Box Jellyfish to the canonical catalog. The October 5 sync also added Oceanic Manta Ray. All seven resolve their printed rules in the shared simulator and Reefbound engine. The temporary unsupported-effect notices have been removed. Emperor Angelfish, Tropical Storm, Nutrient Rich, and Midnight remain gallery-only.

| Design | Printed mechanics requiring a separate playable definition / integration |
|---|---|
| Oceanic Manta Ray | Added October 5: separate from Reef Manta Ray; 8 RP / 10 VP / D10, 170 Density, Open Ocean, Lost Zone when destroyed. |
| Winter Flounder | Added: 3 RP / 3 VP / D10; Ambush is D4-1 against an Invertebrate. |
| Longhorn Cowfish | Neurotoxic Defense, including failed-attack and shared-Coral consequences. |
| Spotfin Butterflyfish | Added: 2 RP / 2 VP / D4; Eco Boost +1. |
| Emperor Angelfish | Eco Boost +2. |
| Nurse Shark | Opportunist triggers after another friendly creature's successful attack. |
| Yellow-Lipped Sea Krait | Venomous, Defensive Strike, and a creature-stun action. |
| Box Jellyfish | Venomous, Coral Reef-dependent Death Sting, and an opponent Aide restriction. |
| Tropical Storm | Storm-weak Coral HP loss and destruction at zero. |
| Nutrient Rich | Actions cost 0 RP for the round. |
| Midnight | Deep creatures cost 1 RP less. |

## Maintained references and verification

- [Creature roster](creature-roster.md) and [complete playable card reference](card-rules-reference.md) are generated from canonical card data. Run `npm run docs:cards` after editing cards; `npm run docs:cards:check` detects stale references.
- The official `/simulator`, `/simulator-v2` alias, instructions lessons, and Reefbound duels share `Simulator.jsx`, so the rule updates apply to all of them.
- `galleryRulesSync.test.mjs` covers the revised stats, Eco Boost, Venomous, Social Hunter, habitat-specific bonuses, target restrictions, cooldowns, Fishing Nets, Plenteous stages, and player/opponent Deadly Poison resolution. Existing Support, ownership, tutorial, and Finn tests were updated to the current rules.
- Verification: all 2,338 tests pass; `npm run docs:cards:check` passes; the production webpack build compiles and generates all 160 pages. Its gallery check validates 204 previews and 221 public card images. The local Cloudflare runtime needed to run outside the filesystem sandbox; no deployment was performed.
- This audit does not expand the simulator's separately documented legacy-effect limitations. See [implementation status](simulator-implementation-status.md).
- Deck-list follow-up: all seven retail manifests match the October 4 Figma sheets at 60 cards each. The store, simulator selector, deck guide, and Reefbound starter descriptions share those manifests; the former Blue Water deck displays as Drop Off while retaining `blue-water` for saved games and store SKUs. The full suite passes 2,344 tests, and the updated production build generates 166 pages. The following simulator update completes the four previously pending cards.


## Deck ability follow-up

- **Longhorn Cowfish:** after a failed attack, flip independently for the attacking Predator and each creature on the same Coral. Heads discards that physical card to its owner, including invading Lionfish; this is a discard rather than destruction.
- **Nurse Shark:** Opportunist queues a free D4 attack after another friendly creature succeeds. Players choose a legal Fish or Invertebrate target; the AI resolves the same attack. Multiple Nurses can trigger one another, and reaction chains stop when no legal target remains.
- **Yellow-Lipped Sea Krait:** Defensive Strike uses a free D8 attack against the exact creature whose attack failed. Stun Strike costs 3 RP after selecting a legal opposing creature. The selected copy cannot use actions, attacks or passive abilities through the end of its controller's next turn. The status survives saving and restoring a match.
- **Box Jellyfish:** Death Sting performs a D10 attack against Fish or Invertebrates when Coral Reef is in play. Deadly Sighting independently blocks Aides for the next opponent turn; Items remain legal. Both creatures retain Venomous.

Printed wording interpretations: ?Coral Reef Habitat is in play? accepts either player's Habitat. Neurotoxic Defense's ?each creature slotted to the same coral? includes the Cowfish and hosted creatures. Its attacking-Predator clause uses the Predator category, not Apex or attacking Fish.

`reefAbilitiesIntegration.test.mjs` exercises actual combat and reaction resolvers, physical-copy targeting, chained Nurses, independent Cowfish coins, Stun costs and passive suppression, and Box Jellyfish's Habitat and Aide rules. `opponentSupportDecisionsRuntime.test.mjs` also verifies the AI permits Items during Deadly Sighting and resumes Aides afterward.

Verification after the ability follow-up: all 2,361 tests pass; generated card references are current; the production webpack build generates 166 pages. The browser smoke check selected Stinging Fortress against Disruption and reached match setup without console errors. Deployed to https://searealm.com on October 4, 2026 at 17:05 UTC, Worker version `408674b7-e9fb-4be5-8191-b23ada385be6` at 100% traffic. Live Home, Decks, Store, Simulator, and Reefbound pages return HTTP 200. All 15 simulator scripts match the built assets by SHA-256, including the new reaction, stun, and Aide-blocking logic.


## Deep whale and holo follow-up

- Refreshed Pilot Whale (`745:139301`) and Sperm Whale (`2249:52164`) from the updated Figma originals. Both now belong to Deep, require Abyss Habitat, cost 9 RP, award 9 VP, and defend with D20. Their existing Deep Hunt, Echo Disruption, and Battle of the Titans effects remain intact. Pilot Whale has no prerelease stamp; Sperm Whale retains its printed prerelease stamp.
- Updated the gallery images and cache versions, playable catalog, encyclopedia placement, rules guidance, and generated card references. Existing card IDs and artwork paths remain compatible with saved decks.
- The existing Holo Rare ? Production page contains all 35 master-list holo printings (15 Reef, 5 Oceanic, 15 Deep). Refreshed its two whale components from the new originals and verified Sperm Whale at 3/62 and Pilot Whale at 7/62. All 35 names and collector numbers match the master list; both whale renders were visually checked. Figma evidence is in `artifacts/whale-sync/figma-holo-verification.json`.
- Verification: all 2,362 tests pass, all 204 gallery previews and 221 public card images pass the image audit, and the production build generates 166 pages. Deployed Worker version `e82045ff-f93d-48fc-8eae-71e53e8d7cf9` to https://searealm.com on October 4, 2026. Live checks at 2026-10-04T23:10:10.477Z confirmed eight pages return HTTP 200, all 15 simulator assets match the build, and both new whale images match the Figma exports by SHA-256.

## October 5 rarity, Owlfish, and deck sync

- Read the current Figma Support originals, adult Bluefin Tuna, Owlfish, and all 60 playable slots on each of the Darkness Shroud and Open Ocean print sheets. Evidence and exact manifests are saved in `artifacts/oct5-sync`.
- Updated printed rarities: Dani and adult Bluefin Tuna are Rare; Spearfishing, Robotic Survey, and Toxic Heal are Uncommon. Collector numbers stay the same. Revised set totals are Reef: 39 Common / 30 Uncommon / 18 Rare / 15 Holo Rare; Oceanic: 26 / 18 / 15 / 5. Deep is unchanged.
- Refreshed 20 Support previews, Bluefin Tuna, Owlfish, and Oceanic Manta Ray from Figma with new image cache versions. Ocean Jake's export repeatedly timed out; its existing image was visually checked and already matches the current Rare label and 93/102 number.
- Removed Owlfish's former Big Eyes passive. Its printed rules are Darkness Shroud (+2 Defense with Abyss) and an On Play D4 Snap against Fish, with no repeatable Action. Both games use the revised canonical definition.
- Both retail decks exactly match the revised 60-card sheets. Their descriptions are shared by the deck guide, store, simulator, and Reefbound. Darkness Shroud's cover now uses Giant Squid. The Abyss, Deep Waters, and Pelagic Zone encounter variants use the revised source card pools and remain legal 60-card decks.
- Added Oceanic Manta Ray to the playable catalog: 8 RP, 10 VP, D10, 170 School Density, Open Ocean required, Lost Zone when destroyed. Its separate Mobula birostris encyclopedia profile connects to the updated Open Ocean deck. The catalog now contains 206 cards and 138 creatures.
- Verification: all 2,395 tests pass; generated references are current; the image audit passes 204 previews and 221 public card images. The production build generates 170 pages. Browser checks verified the Bluefin search results and current rarity totals without console errors.
- Deployed Worker version `e96a2c4c-7c21-4609-a47b-ad92ab5059a8` to https://searealm.com on October 5, 2026. Live checks at 2026-10-05T11:42:51.483Z confirmed nine pages return HTTP 200, all 18 simulator/Reefbound scripts match the local build, all 23 refreshed images match by SHA-256, and all five changed numbered rarities render correctly. Report: `artifacts/oct5-sync/live-deployment-verification.json`.
