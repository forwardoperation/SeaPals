# Homepage tabletop image

Asset: `public/images/promo/searealm-tabletop-figma.webp` (1024 x 1536).

Mode: built-in image generation with two layout refinements. This is an illustrative product mockup based on exported Figma playmats; it is not a production print proof. Small typography and artwork details can differ from the Figma source.

## Source designs

- [Coral Garden playmat](https://www.figma.com/design/xeol2YE0jCE0N5vAD6tjzx?node-id=3347-943089), 5700 x 3900.
- [Drop Off playmat](https://www.figma.com/design/xeol2YE0jCE0N5vAD6tjzx?node-id=3342-839012), 5472 x 3744.
- Play Mat page: `3342:839010`.
- Finished card references: `elkhorn-coral-base`, `french-angelfish`, `cleaner-shrimp` from the gallery manifest.

The actual mats have a central Foundations band, Creature bands above and below, side School Density and Victory Point tracks, and deck arrows pointing beyond the player-facing edge. This replaces the previous generic rectangular Ecosystem layout. The final scene uses opposite players, a portrait crop, and two copies of Elkhorn Coral plus a French Angelfish and Cleaner Shrimp on each mat.

## Generation prompt

Use case: product-mockup / compositing
Create a strictly top-down tabletop photograph of SeaRealm played on the EXACT two Figma playmats supplied, with cards placed according to their printed zones.
Image 1: actual Coral Garden mat. Image 2: actual Drop Off mat. Preserve both complete designs, original 1.46:1 aspect ratio, ocean artwork, white dividing lines, SeaRealm branding, School Density track on left, Victory Points track on right, and bottom deck labels with arrows pointing off the mat. Do not redesign, simplify, stretch, or substitute generic mats.
Images 3, 4, 5: complete actual Elkhorn Coral Base, French Angelfish, Cleaner Shrimp cards. Preserve FULL card faces including blue borders, lower rules text and stats, not just illustrations. Use 5:7 portrait card proportions.
Landscape 3:2 composition. Two complete mats side-by-side on warm oak, players sitting at the LEFT and RIGHT ends of the table facing each other. Left Coral Garden mat rotated 90 degrees clockwise, right Drop Off rotated 90 degrees counterclockwise. Both mats same physical size, with generous wood outside the two outer player-facing edges for decks. Soft daylight, subtle contact shadows, realistic cloth mats and card stock.
CRITICAL PLACEMENT relative to each mat's own upright orientation, before rotating the whole setup:
- Two Elkhorn Coral Base cards in the central FOUNDATIONS band, centered at x38%, x67%, y44%. These fit entirely BETWEEN the two horizontal dividing lines at y30% and y59%.
- One French Angelfish in upper CREATURES band centered x38%, y16%, aligned with the first coral.
- One Cleaner Shrimp in lower CREATURES band centered x67%, y73%, aligned with the second coral.
- Thus four face-up cards per mat: exactly two foundations and two creatures. Card dimensions approximately 13% of mat width by 27% of mat height. All cards within a setup share their mat's rotation. Leave gaps; no card crosses a dividing line.
- Foundation Deck and Main Deck are two neat face-down stacks on the WOOD just OUTSIDE the mat at its bottom-arrow positions, not on the creature bands or foundation band. Use blue ocean texture and one white SeaRealm logo copied from the mat for each card back. Leave Lost and Discard empty.
Preserve the full mat structure and typography. Played cards may naturally partly cover large printed headings. Keep side score tracks clear. No extra deck boxes, added labels, overlay captions, people, hands, plants, shells, UI, watermarks or prerelease markings. Focus on accurate mat geometry and zone placement.

## Proportion refinement

Use case: precise-object-edit / compositing
Edit image 1. Correct the badly stretched mat proportions and the players' orientation. Preserve the faithful card faces, printed mat artwork, warm wood table and lighting.
Images 2 and 3 are authoritative ORIGINAL landscape playmats. Each is 1.46 times as WIDE as it is TALL. Do not turn the mat artwork into portrait shape. Preserve exact artwork and spacing from these references.
OUTPUT A PORTRAIT 2:3 IMAGE, not landscape. Show TWO HORIZONTAL LANDSCAPE MATS one ABOVE the other on an oak table. Each complete mat has WIDTH:HEIGHT = 1.46:1. They nearly fill the image width, with generous wood margins at the very TOP and BOTTOM for deck stacks.
BOTTOM MAT: Coral Garden (image2), upright and readable to a player sitting at the bottom of the image. Printed logo near mat top. Two Elkhorn coral cards in its middle FOUNDATIONS band; French Angelfish in the upper CREATURES band; Cleaner Shrimp in the lower CREATURES band. All face text upright. Foundation Deck and Main Deck stacks on wood just beyond its bottom-edge arrows.
TOP MAT: Drop Off (image3), ROTATED EXACTLY 180 DEGREES relative to bottom mat, with all its printed text and all played cards UPSIDE DOWN in the image. This player's deck stacks are on wood beyond the TOP EDGE of the image-side mat, matching its rotated bottom arrows. The player sits at the top and faces the bottom player. Its coral cards remain in the CENTRAL foundations band; creatures occupy upper/lower creature bands in the MAT'S OWN coordinates.
Normalize played card size so each is exactly about 13% of its mat's width, with its original 5:7 portrait shape. Coral cards fully within the foundations band; creatures fully within creature bands. Leave scoreboard scales, printed dividing lines, and most printed zone text visible. All actual card fronts must retain their full lower rules areas; don't simplify into cropped illustrations.
Focus on this one fix: TRUE LANDSCAPE mat proportions, portrait overall photograph, opposite players. No side-by-side mats, no portrait-stretched mats, no redrawn labels, no extra props, no humans. The two landscape mats must be full and undistorted.

## Final placement refinement

Edit this tabletop image with ONLY these targeted corrections:
1. On the TOP player's mat, rotate the two Elkhorn Coral cards and the French Angelfish card each EXACTLY 180 degrees IN PLACE. Their top title bars must be at their LOWER edges in the photograph, like the already-upside-down Cleaner Shrimp above them. All four card faces on the top mat must read upside down because that player sits at the TOP of the photograph. Do not move their centers or resize them. The entire top mat's artwork is already upside down and must stay that way.
2. On the BOTTOM mat, the large printed word FOUNDATIONS is currently wrongly above the upper dividing line. Move ONLY that printed label into the CENTRAL band containing the two coral cards, partly behind the coral cards, matching the actual mat design. Leave the upper band labeled CREATURES.
3. Pull the camera back slightly so both deck stacks at the very top and both stacks at the bottom are fully within the photograph with visible wood outside them. Do not crop any mat or stack.
Preserve everything else: portrait composition, landscape mat geometry, two facing players, ocean artwork, accurate card illustrations and complete rules areas, SeaRealm logos, dividing lines, cloth texture and warm wood. Do not add or remove cards. Four face-up cards on each mat, with all TOP mat cards upside down and all BOTTOM mat cards upright.
