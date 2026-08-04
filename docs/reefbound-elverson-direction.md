# Reefbound: Elverson Direction

**Status:** Opening vertical slice implemented
**Direction date:** August 3, 2026
**First playable target:** The complete Elverson opening and aquarium collection loop

This document is the source of truth for Reefbound's Elverson chapter. It supersedes earlier assumptions that the adventure begins at an academy and that catching sea creatures is outside the game. Existing exploration, card-game, save, deck, accessibility, and ecosystem-learning systems should be reused wherever they support this direction.

## North star

Reefbound is a warm, child-scale sea adventure about becoming a **Master of the Sea**. The player explores coastal communities, learns how ocean ecosystems work, catches creatures from the campaign-wide Sea Realm requested set with increasingly capable tools, brings them to the Sea Realm Aquarium, and earns the matching Sea Realm trading card for every creature delivered.

Collecting and understanding are inseparable:

> Catch the creature -> learn what it needs and what role it plays -> deliver it to the appropriate aquarium habitat -> receive its matching card -> use that knowledge and card in SeaRealm decks

Mr. Easterling frames the promise of the game: finding every creature is not enough. A Master of the Sea understands how living things, habitats, food webs, and changing conditions fit together.

## Experience pillars

1. **A town full of anticipation.** Elverson should feel as though a once-in-a-generation aquarium challenge has just begun. Children and adults are preparing gear, decks, exhibit copy, research, and travel plans.
2. **A best-friend adventure.** The opening is personal before it becomes epic: a tenth birthday, breakfast at home, excited parents, a best friend at the door, and a friendly race toward Pelora City.
3. **Collection with purpose.** Each captured species fills a real place in the aquarium, contributes to a regional list and the campaign-wide requested set, teaches an ecosystem relationship, and awards the same species' card.
4. **Learning through play.** SeaRealm duels model healthy ecosystems. Catching tools teach observation, patience, habitat awareness, and the differences among species and environments.
5. **A changing physical world.** Aquarium rooms begin visibly empty and come alive with animated creature sprites as the player contributes residents.
6. **Clear, welcoming navigation.** Main routes are broad and readable. Buildings cannot trap the player behind them, essential doors are obvious, and decorative objects never turn primary roads into obstacle courses.

## Elverson opening beat sheet

### 1. The player's tenth birthday

- Start downstairs in the player's home, not at the town crossroads or inside the aquarium.
- The player's best friend arrives early because neither child could sleep.
- Mom prepares breakfast.
- Dad reads a newspaper whose lead story announces the Sea Realm Aquarium challenge.
- The parents explicitly give permission before the children leave.
- Keep the scene brisk, affectionate, and playable; the player should be moving within the first few minutes.

### 2. Race to the aquarium

- The best friend leads the first walk through Elverson.
- Town activity and short ambient remarks establish that adventurers young and old are preparing.
- The route teaches movement and interaction without cluttering the road or allowing the player to become stuck behind buildings.

### 3. Mr. Easterling's challenge

- Mr. Easterling explains that the new aquarium needs a requested set of fantastic sea creatures, great and small.
- Delivered species will live in habitat-appropriate exhibits for the town to enjoy.
- Every delivered creature awards its matching Sea Realm trading card.
- Completing the full Sea Realm requested set across the journey awards the title **Master of the Sea**. Completing Elverson's local list is an early milestone, not the final title boundary.
- His characterization is an absent-minded, wholehearted professor: he may misplace a clipboard or lose his place in a sentence, but he never loses interest in a child's dream.

### 4. Starter deck and live tutorial

- Mr. Easterling explains that responsible catching requires study and that SeaRealm models the relationships in a healthy ocean ecosystem.
- The player chooses one of the existing starter decks.
- The existing guided live card tutorial remains the mechanical foundation, with story copy tied directly to aquarium learning.

### 5. The friendly race begins

- After the tutorial, the best friend announces that he is leaving Elverson to begin his own journey.
- He asks the player to meet him in **Pelora City** and says, "May the best catcher win!"
- This is friendly motivation, not hostility. Later meetings should show that both children help each other grow.

## Elverson locations and cast

| Location | Required function | Cast and content |
| --- | --- | --- |
| Player home | Opening, family warmth, first movement | Mom, Dad, best friend; breakfast and newspaper scene |
| Elverson Supply Company | Gear progression and preparation | Henderson; Sam (8), Ellis (10), Karah |
| Sea Realm Aquarium | Main collection hub, starter/tutorial, requested-set turn-in, visible exhibits | Mr. Easterling, Finn, Ivy; multiple ecosystem rooms with initially empty aquariums |
| Red Schoolhouse | Exhibit descriptions and accessible science writing | Teacher Caroline; Hudson, Harrison, Rosie, Juliana |
| Fisherman's Wharf | First catching lesson and hand-net award | Fisherman Wyeth; guided walk to the sandy practice shore |
| Marine Research Lab | Research context, future tools, exploration aspiration | Programmer Harlan, Marine Biologist Jonah, Explorer Jordan (10) |
| Reef house | Reef-aligned resident duelists | George: Coral Garden; Henry: Disruption; Charlie: Stinging Fortress; Danny: Blue Water; Jack: Murky Water |
| Deep house | Deep-aligned resident duelists | Calvin: Darkness Shroud; Landon: The Abyss; Oliver: Deep Waters |
| Oceanic house | Open-ocean resident duelists | Charlotte: Open Ocean; Eloise: Pelagic Zone; Edith: Plankton Bloom |
| Hybrid house | Teaches deck mixing | William: Murky Water's Revenge; Olivia: Whirlpool; Alyssa: Coral Ledge; Henry: Drop Off |
| Streets and park | Short ecosystem/card guidance without blocking travel | Theo, Eli, Micah, Erik and other ambient townspeople |

Names, ages, skin tone, requested deck identity, and supplied dialogue intent are authored facts. Sprite, portrait, and copy work should preserve them. Henry appears in two supplied house lists; until a later direction resolves whether these are one or two characters, content IDs must keep the two roles unambiguous rather than silently overwriting either duel.

### Authored Elverson content register

The following details are part of the supplied direction, not optional flavor to be reconstructed later.

**Elverson Supply Company**

- The shop clerk is Henderson.
- Sam is 8: “I’m looking for just the right cast net before I set out on my adventure!”
- Ellis is 10: “I just got a fishing rod! This will help me catch fish that a net can’t reach.”
- Karah: “With so many creatures to collect, make sure you stock up on essential items.”

**Sea Realm Aquarium**

- The aquarium is down by the shore and is Elverson's central research/collection hub.
- Mr. Easterling leads the challenge and the SeaRealm tutorial.
- Finn: “SeaRealm Decks can be customized to your liking, I designed Murky Water’s Revenge!”
- Ivy: “I’m helping Mr. Easterling catalogue all the different species we collect for the aquarium.”
- The building contains multiple explorable rooms centered on real-world ecosystems. Tanks begin empty and visibly populate with animated creature sprites after delivery.

**Red Schoolhouse**

- Teacher Caroline: “Hello there! Mr. Easterling told my class about the aquarium exhibit. We are writing descriptions for the various Sea Creature Exhibits.”
- Hudson, age 6: “Sea Anemones may look like swaying flowers, but they are animal cousins of corals and jellyfish. Their tentacles fire microscopic stinging capsules that capture prey and discourage hungry visitors.”
- Harrison, age 6: “Arrow Crabs tiptoe over Caribbean reefs on extremely long, skinny legs. Their triangular bodies and pointed rostrums make them look like animated arrows or underwater spiders.”
- Rosie, age 6: “I love all Sea Creatures! Did you know Crevalle jacks are powerful schooling fishes with broad chests and deeply forked tails? They can handle an unusual range of water, from the open sea into salty rivers.”
- Juliana, age 6: “Goliath Groupers are enormous, thick-bodied fish that rest around reefs, wrecks, and ledges. A sudden opening of the mouth creates suction strong enough to sweep prey inside.”

**Fisherman's Wharf**

- Fisherman Wyeth: “It’s a fine day for fishing! I hear you’d like to learn how to catch some sea creatures? Let’s start with catching with just a good ol fashioned hand net to start!”
- Wyeth physically escorts the player along a predetermined path to the sandy shore. During this segue the player cannot deviate from the route.
- The lesson awards a hand net and unlocks crabs, invertebrates, and small reef fish under 12 inches.
- The catching view is top-down shallow water: moving waves at the upper edge, a visible sandy floor, and animated crabs, wrasses, tangs, and other appropriate targets that can be startled into fleeing.

**Marine Research Lab**

- The lab is located on the shore.
- Programmer Harlan: “I’m working on making an underwater robot that can collect samples of coral to better understand what makes certain species vulnerable or resilient to different ocean conditions. Many corals are susceptible to high temperatures, storm surge, and even disease.”
- Marine Biologist Jonah: “Did you know that last year we discovered over a thousand new sea creatures! Who knows what else might be hiding in the deep…”
- Explorer Jordan is a 10-year-old boy: “I am soooo excited to collect all the creatures for Mr. Easterling! The first thing I am going to do is find a boat so I can explore every region.”

**Resident duel houses**

- Reef house: George, age 10 — Coral Garden; Henry, age 8 — Disruption; Charlie, age 10 — Stinging Fortress; Danny, age 12 and Black — Blue Water; Jack — Murky Water.
- Deep house: Calvin, age 13 — Darkness Shroud; Landon, age 10 — The Abyss; Oliver, age 11 — Deep Waters.
- Oceanic house: Charlotte, age 13 — Open Ocean; Eloise, age 7 — Pelagic Zone; Edith, age 7 — Plankton Bloom.
- Hybrid-teaching house: William — Murky Water’s Revenge, with a heavy apex-shark focus; Olivia — Whirlpool, a Disruption/Blue Water mix; Alyssa — Coral Ledge, a Reef/Deep hybrid; Henry — Drop Off, a Reef/Open Ocean hybrid.

**Walking around town**

- Theo: “A healthy ecosystem comprises every layer of the food chain, well balanced SeaRealm Decks reflect this in their design.”
- Eli: “Did you know that support cards are designed to help you solve problems when playing SeaRealm? They help you search for creatures, heal corals, and many other helpful things!”
- Micah: “All creatures have a habitat that they were designed for. When playing SeaRealm, you will find that many cards have abilities that are unlocked if you have a habitat in play.”
- Erik: “Invertebrates are small, but crucial to any reef ecosystem, they help recycle nutrients and serve as a vital food source for larger creatures.”

Final child-facing copy may receive grammar, reading-level, and marine-science edits, but those edits must preserve the named speaker, species or deck assignment, and teaching intent.

## Core system contracts

### Aquarium request set

- Each region has an authored list of stable creature IDs grouped by aquarium ecosystem room.
- Regional lists contribute to one campaign-wide Sea Realm requested set. The complete campaign list must be authored explicitly before the final title can be awarded.
- Progress distinguishes `observed`, `caught`, `carried`, `delivered`, and `studied` state. Quantity-bearing inventory remains separate from species-level mastery.
- A species counts toward set completion after its first successful delivery.
- A species counts as `studied` only after the player completes its authored learning evidence, not merely by opening a menu. The vertical-slice default is: observe one species behavior or habitat clue during collection, then complete or review its aquarium species note with the relevant ecosystem relationship recorded.
- The final campaign title requires both delivery of every species in the full Sea Realm requested set and completion of its required learning/mastery records. This fulfills Mr. Easterling's promise that catching alone is insufficient.
- Duplicate catches remain useful and may award duplicate cards, but set completion is species-based.
- Regional and campaign completion are distinct, idempotent, and save-safe. Reloads or repeated conversations cannot turn a regional milestone into global completion or duplicate a one-time reward.
- The collection UI shows discovered silhouettes, delivered species, room assignment, matching card, and total requested-set progress.

### Delivery rewards

- Every delivered creature awards one matching Sea Realm card using the creature's stable `cardId`.
- A delivery of multiple creatures awards the matching quantity of each card in the same atomic save update.
- For the current vertical slice, every physical duplicate delivery also awards one duplicate matching card. This is the implemented rule, not an unresolved balancing placeholder; a later cap would require an explicit product decision and save migration.
- The result presentation names the delivered species and cards awarded.
- Completing Elverson's local list does **not** award the final title. Completing the full campaign-wide Sea Realm requested set awards the non-discardable **Master of the Sea** title once.

### Catching equipment progression

The current rod-fishing prototype is a reusable technical spike, not the final first-catching experience.

1. **Hand net:** Wyeth's required first lesson; catches crabs, invertebrates, and small reef fish under 12 inches in shallow water.
2. **Fishing rod:** Reaches fish a hand net cannot; becomes a later tool rather than the first award.
3. **Cast net and later specialized gear:** Unlock broader habitats and species while remaining bounded by safe, age-appropriate game abstractions.

Each species definition should declare its habitat, size band, eligible tools, movement behavior, rarity, aquarium room, card ID, and learning note. Required story species cannot be luck-gated.

### Hand-net minigame

- Use a top-down shallow-water view with a readable sandy floor and gentle wave movement at the top edge.
- Show several animated creature sprites moving according to species behavior.
- The player positions or aims the net and chooses when to scoop.
- Fast movement, repeated misses, or approaching directly can raise an alert meter and make a creature flee.
- The tutorial uses a forgiving authored creature and cannot permanently fail.
- Standard, assisted, reduced-motion, keyboard, and touch modes must all be first-class.
- Wyeth walks to the practice shore on a predetermined route; control is temporarily guided and restored immediately after arrival.

### Aquarium rooms

- Rooms are organized around recognizable real-world ecosystems rather than one generic tank wall.
- Every room has empty, partial, and increasingly lively states driven by delivered species.
- Delivered creatures render as small animated sprites with bounded swimming or crawling behaviors.
- The exhibit label can incorporate the Red Schoolhouse descriptions after editorial and marine-science review.
- Habitat requirements and animal care are part of the fiction: the aquarium team assesses and places catches; the child is never shown performing unsafe real-world handling.

### SeaRealm learning and duels

- Starter choice remains Coral Garden, Murky Water, or Blue Water unless a later direction changes the set.
- Elverson resident duels teach archetypes first, then hybrids and customization.
- NPC guidance should connect card roles to ecosystem roles without becoming a mandatory lecture.
- Species-note progress should be earned through short observation-and-connection interactions, not rote trivia gates. A wrong interpretation receives specific feedback and another try.
- Automated acceptance must prove that a delivered-but-unstudied species does not satisfy the final Master of the Sea gate, while a completed species record persists across reload.
- Defeats never remove collected creatures, cards, or story progress.

### Stable IDs and legacy-save migration

The current build uses historical internal IDs such as `shellshore-village`, `academy-lab`, `academy-mentor`, and `quest-shellshore-first-voyage`. That quest currently combines introduction, tutorial, fishing, neighborhood duel, and route-unlock facts. User-facing renames do not justify breaking those IDs.

- Keep a historical ID when its meaning can safely expand without ambiguity. If a new canonical ID is necessary, add a versioned migration map; never rename it in content and hope normalization will recover it.
- Split onboarding, aquarium collection, and outward-route progression into separate quest domains before their state machines diverge. Migrate every known flag, reward-ledger fact, and completion state explicitly.
- Preserve existing Rosie/George encounter wins even when their new house roles or deck assignments change. Map old encounter evidence to the intended replacement or archive it as legacy completion; do not silently erase or re-award it.
- A town geometry update must relocate every old exterior position through a versioned map migration. A coordinate that remains numerically walkable but now belongs to the wrong district is not a valid resume location.
- Move a blocked or obsolete position to a named safe spawn, preserving facing, inventory, collection quantities, tutorial state, deck ownership, encounters, and reward ledger.
- Add fixtures for saves from every released Elverson layout and assert idempotent migration, safe placement, no repeated prologue, no duplicate matching cards, and no lost progression.

## Town and traversal rules

- Expand the map or reduce density so primary walking lanes are at least two comfortable character widths wherever practical.
- Do not place trees, lampposts, benches, signs, planters, NPC anchors, or patrol endpoints in the center of a primary route.
- Put decorative collision near curbs, walls, gardens, or the map perimeter.
- Use positive walkable regions and building-base collision so the player cannot enter invisible water or disappear behind a large facade.
- Seal narrow rear alleys behind buildings unless they lead to intentional content with a clear exit.
- Every required doorway, NPC, and waterfront lesson must be reachable from the start under both static and moving-NPC collision.
- Add automated traversal tests for every essential route and guided cutscene path.

## Work chunks and exit criteria

### Chunk 1 — Direction and collection contract

- Record this product pivot in the repository.
- Make aquarium delivery award matching cards atomically.
- Record Elverson as one regional list while preserving the campaign-wide Master of the Sea boundary.
- Do not award the final title from the initial Elverson species table.
- Reflect rewards in dialogue, inventory/progress presentation, and automated tests.

**Exit:** The existing playable Elverson build supports catch -> delivery -> matching-card reward -> local-list completion without duplication or save corruption, while the campaign title remains unawarded.

### Chunk 2 — Opening state, save migration, and indoor home prologue

- Split the current combined Shellshore quest facts into explicit onboarding, aquarium-collection, and outward-route domains with versioned migration.
- Add the player-home scene, Mom, Dad, best friend, tenth-birthday breakfast, newspaper, and permission beat.
- Persist an ordered opening state machine through `birthday-breakfast -> permission-granted -> aquarium-challenge-accepted -> starter-chosen -> tutorial-complete -> friend-departed`.
- Do not author the outdoor guided route against the soon-to-be-replaced town geometry.

**Exit:** A fresh profile begins at home and reaches the permission/front-door checkpoint; interruption at every dialogue boundary resumes once; legacy profiles preserve inventory, reward ledger, tutorial, encounters, and location without replaying the birthday prologue.

### Chunk 3 — Elverson town rebuild and aquarium race

- Recompose the town into legible districts with the full exterior building set.
- Add Supply Company, Schoolhouse, Wharf, Research Lab, four houses, Aquarium, player home, and clear paths.
- Use full building-footprint/rear collision so no player-reachable samples exist beneath or behind a facade unless an intentional open route is visibly authored.
- Keep named Main Street and Chestnut Street corridors three tiles wide where practical and the waterfront promenade at least two tiles wide; test two parallel swept player routes, not only one centerline.
- Keep scenery, stationary NPC blockers, and patrol endpoints outside those named road rectangles.
- Migrate all earlier exterior coordinates to an equivalent named safe spawn.
- Add the best friend's guided race to the aquarium, connect Mr. Easterling's challenge and existing starter tutorial, and stage the one-time Pelora City departure.

**Exit:** A fresh profile plays continuously from breakfast through starter tutorial and friendly-rival departure. Automated flood/swept-route tests find no rear-building trap, every required portal and return spawn is reachable under all patrol endpoints, named corridors preserve their minimum clearance, and all released layout fixtures migrate idempotently.

### Chunk 4 — Hand-net catching vertical slice

- Add species metadata for habitat, length/size band, eligible tools, movement behavior, alert response, aquarium room, sprite profile, card ID, and learning evidence.
- Add the hand-net equipment contract, Wyeth's visible waypoint-based escort, shallow-water minigame, animated target behaviors, alert/flee response, tutorial catch, and under-12-inch small-species eligibility.
- Preserve the rod prototype behind a later unlock or migrate it cleanly.
- Required tutorial/story species use an authored deterministic encounter or pity path and cannot be luck-gated.

**Exit:** A new player earns the net and catches one required creature in a forgiving, save-safe tutorial on keyboard, touch, assisted, and reduced-motion modes. Tests prove real non-teleporting escort interpolation, locked input, bounded leader distance, collision-safe waypoints, alert/flee behavior, tool eligibility, deterministic required access, one-time modal launch, and reload recovery at stable escort checkpoints.

### Chunk 5 — Aquarium rooms and living exhibits

- Add ecosystem-room navigation, data-driven tank assignments, empty/partial/full states, animated delivered-creature sprites, species learning records, and exhibit labels.
- Map every Elverson species to exactly one valid room and behavior profile; reject duplicate, missing, and cross-habitat assignments in content validation.

**Exit:** Every Elverson species appears in its authored room after delivery and reload; automated fixtures verify every room's empty, partial, and complete state; animations remain bounded by tank geometry; and an observed/delivered species does not become `studied` until its learning evidence is completed and persisted.

### Chunk 6 — Elverson residents and deck curriculum

- Implement the supplied shop, school, lab, street, and four-house cast.
- Map all named decks to encounters, create missing deck definitions, and stage pure-to-hybrid learning order. The currently missing requested decks are The Abyss, Deep Waters, Pelagic Zone, Plankton Bloom, Murky Water’s Revenge, Whirlpool, Coral Ledge, and Drop Off.

**Exit:** Every named resident, age/identity fact, location role, supplied teaching line, and deck assignment validates against the authored register. Every requested duel resolves to a valid playable deck and passes a live launch smoke test; an unresolved deck dependency cannot satisfy this chunk.

### Chunk 7 — Pelora and campaign mastery contract

- Resolve Pelora City's relationship to the already implemented archipelago towns and add post-Elverson best-friend continuity.
- Lock the product naming contract among Reefbound, SeaRealm, and SeaPals before final player-facing copy and metadata spread further.
- Author the full campaign requested-set registry and its regional membership without silently treating the current ten catches as complete.
- Require both full delivery and the authored ecosystem/species learning milestones before granting Master of the Sea exactly once.

**Exit:** The player can leave Elverson toward an authored Pelora destination and retain rival continuity. Contract tests prove regional completion cannot grant the title, delivered-but-unstudied species cannot grant it, the full verified delivery-and-learning set grants it once, and reload/duplicate callbacks cannot grant it twice.

### Chunk 8 — Production validation

- Finish town, home, aquarium, shore, creature, and character art/animation; add audio and transcripts.
- Record measurable budgets for load size, decode time, frame pacing, and supported viewport/input combinations before sign-off.
- Complete keyboard, touch, reduced-motion, high-contrast, screen-reader/focus, and short-viewport QA.
- Complete fresh-profile playthroughs, target-age usability sessions, named marine-science review, and the existing child-privacy launch review.

**Exit:** All automated tests and the production build pass; recorded performance budgets pass on supported devices; every required path passes human keyboard/touch and assistive-technology checks; target-age findings have dispositions; and named science/privacy reviewers approve the exact release candidate or record explicit blocking findings.

## Existing implementation: keep, revise, retire

| Existing element | Direction |
| --- | --- |
| Continuous movement, touch controls, collision, scene transitions, local profiles, autosave/recovery | Keep and extend |
| Starter decks and guided SeaRealm tutorial | Keep; revise story framing |
| Elverson layered-object renderer and positive shoreline regions | Keep; recompose layout and collision data |
| Existing resident sprite sheets | Reuse where identity matches; create missing children/adults deliberately |
| Rod-fishing modal, catch table, delivery inventory, Reef Log | Reuse domain/accessibility lessons; move rod later and replace the first lesson with hand-net play |
| Current crossroads opening and exterior Easterling auto-introduction | Retire for fresh profiles after the home prologue is ready |
| Two enterable homes standing in for the town's duelist curriculum | Replace with four clearly themed houses plus the player home |
| Previous exclusion of creature catching | Superseded by this direction |
| Later ecosystem towns, boats, Field Notes, packs, deck editor, tournament systems | Preserve as reusable campaign foundation; review names and story order against Pelora City continuity |

## Decisions intentionally left open

- Best friend's name and final visual identity.
- The full Sea Realm requested set beyond the initial Elverson species.
- Final aquarium room count and the exact ecosystem grouping of all future species.
- The relationship between Pelora City and the already implemented later archipelago locations.
- Whether the two supplied Henry duel roles represent one versatile character or two different children.
- The final public naming hierarchy among Reefbound, SeaRealm, and SeaPals.
- The exact learning-evidence pattern for later species whose behavior or habitat cannot reuse Elverson's observe-and-species-note flow.

The best-friend name, later species roster, and final room count do not block the first collection contract, indoor home opening, town traversal foundation, or hand-net tutorial. Pelora's world relationship and the naming hierarchy are hard dependencies for Chunk 7. The Henry identity decision is a hard dependency before both requested duel roles can pass Chunk 6.
