# SeaPals encyclopedia content

This directory is the kid-facing fact library for every gallery-visible creature card in SeaPals.

## Entry shape

Each ecosystem file exports an array of entries with these fields:

- `name`: canonical SeaPals display name
- `grammaticalNumber`: optional `plural` marker for display names such as `Spinner Dolphins`; omitted names are singular
- `scientificName`: species, genus, or family when the card represents a broad group
- `aliases`: alternate names used for card matching and search
- `zone`: `Reef`, `Oceanic`, or `Deep`
- `group`: `Fish`, `Invertebrate`, `Predator`, `Apex`, or `Filter Feeder`
- `tagline`, `intro`, `home`, `diet`, `size`, `superpower`, and `lookFor`: concise copy for ages 7–12
- `funFacts`: exactly four species-specific facts
- `sourceUrls`: one to three authoritative science or education sources

## Adding a creature

1. Add its card to the normal SeaPals card data.
2. Add one matching encyclopedia entry to the correct ecosystem file. Use `aliases` when the card title and common name differ.
3. Prefer NOAA, Smithsonian, MBARI, FishBase, established museums/aquariums, universities, or primary research. Do not use unsourced aggregators.
4. Run the production build. The encyclopedia index rejects duplicate slugs, malformed entries, cards without profiles, and profiles that cannot be matched back to a card.

Card stages and juvenile/adult variants can share one profile when they represent the same real animal.

## Exact card ownership

`aliases` help search and identify possible card matches, but they are not used
for deck discovery. The index gives every creature card ID exactly one profile
owner and exposes those IDs as `cardIds` on the finished entry.

When two profiles share a common name, add the ambiguous card IDs to
`cardOwnership.js`. These overrides must point to a profile that still matches
the card data. The index rejects unknown overrides, ambiguous cards without an
override, duplicate ownership, and creature cards with no owner. Keep the
override list limited to genuine name collisions; unambiguous cards are
validated and assigned automatically.
