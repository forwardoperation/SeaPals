# Homepage tabletop image

Asset: `public/images/promo/searealm-tabletop-exact.webp` (1800 x 2700, lossless WebP).

This is a deterministic composite of the original product artwork. The mats, card backs, and card faces are not generated or redrawn. Their full designs are preserved, with only proportional resizing and a 180-degree rotation for the opposite player. Shadows and paper-stack edges sit behind the artwork. No color grading, perspective distortion, or replacement lettering is applied to product graphics.

## Exact source artwork

Sources are stored in `scripts/assets/homepage-tabletop/`:

- `coral-garden.webp`: lossless copy of the [Coral Garden playmat](https://www.figma.com/design/xeol2YE0jCE0N5vAD6tjzx?node-id=3347-943089), 5700 x 3900. Original PNG SHA-256: `ba82b5e3ffa78db729ac22e715fa3da2aab495382ecb1c02e18347f7b1672ebd`.
- `drop-off.webp`: lossless copy of the [Drop Off playmat](https://www.figma.com/design/xeol2YE0jCE0N5vAD6tjzx?node-id=3342-839012), 5472 x 3744. Original PNG SHA-256: `ef3c2c4449d0103aa24d16377953661894e5d5a5ebf4b3521c442135ee916d72`.
- `card-back.webp`: the complete 738 x 1034 back cropped from the finished nine-up manufacturing sheet at left 86, top 79. The finished sheet combines the [original back logo artwork](https://www.figma.com/design/xeol2YE0jCE0N5vAD6tjzx?node-id=3758-338124) and [ocean backdrop](https://www.figma.com/design/xeol2YE0jCE0N5vAD6tjzx?node-id=4116-234589). Sheet SHA-256: `4df30e1695890272e3926ec165fc44a9bbdf5ec5910245a503f98a1d4a06777f`. The crop uses the print pipeline's rounded rendered card bounds, not the separate logo sheet's coordinates.
- Card faces come directly from `public/images/cards/coral/Reef/elkhorn-base.png`, `public/images/cards/fish/Reef/french-angelfish.png`, and `public/images/cards/invertebrates/Reef/Cleaner Shrimp.png`.

The stored mat images and card-back crop were checked against the original decoded RGBA pixels and are identical. The final composite also passed direct comparisons against the original PNG sources: 3,108,512 visible pixels across both mats, all eight card faces, and all four backs had zero differing RGB channels after proportional resizing and rotation. Shadow areas and three-pixel card edges were excluded; mat headings and score tracks were included. WebP fast shrinking is disabled so resizing matches the original PNG pipeline. Source assets live outside `public`; the browser downloads only the finished composite.

## Layout and rendering

Run `node scripts/render-homepage-tabletop.mjs` from the repository root after installing project dependencies.

Each mat retains its 19:13 aspect ratio. Two Elkhorn Coral cards occupy the central Foundations band. French Angelfish and Cleaner Shrimp occupy the upper and lower Creature bands, respectively. Side score tracks and printed zone headings remain visible. Foundation and Main decks sit beyond the printed arrows on the wood. The far player's complete arrangement is rotated 180 degrees.

The script uses Sharp, available through the existing Next.js dependency, and exports its layout for inspection. The final image is encoded losslessly, and the site's existing image configuration serves it without lossy re-encoding.

## Background generation

Only the empty tabletop background was generated with the built-in image generation tool, then saved as `scripts/assets/homepage-tabletop/oak-table.webp`. No product artwork was passed to or produced by that generation step.

Final prompt:

> Use case: product-mockup background. Create a completely empty warm natural oak tabletop photographed strictly top-down, flat camera parallel to table, portrait 2:3 framing. Fine realistic horizontal wood grain, medium honey brown, quiet even soft daylight with no heavy vignette. The tabletop fills the entire image edge to edge. No objects, no cards, no mats, no logos, no writing, no hands, no plants, no shells, no props, no border, no perspective. This is ONLY a neutral photographic background; product artwork will be composited separately and must not be generated.
