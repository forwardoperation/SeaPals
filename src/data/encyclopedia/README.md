# SeaPals encyclopedia content

This directory is the kid-facing fact library for every gallery-visible creature card in SeaPals.

## Entry shape

Each ecosystem file exports an array of entries with these fields:

- `name`: canonical SeaPals display name
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
