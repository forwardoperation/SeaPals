# Legacy ocean background artwork

These images were used by an earlier version of the continuous dive background. The current background uses filmed ocean footage and posters extracted from that footage; see [Ocean background footage](ocean-background-footage.md). These generated images are no longer rendered by `OceanBackground`.

| Web asset | Composition |
| --- | --- |
| `public/images/backgrounds/ocean-dive-surface.webp` | Landscape split-level ocean surface, with the horizon in the upper quarter, blue sky, realistic waves, and sunlight visible underwater. |
| `public/images/backgrounds/ocean-dive-floor.webp` | Landscape reef floor for the lower end of the dive. |
| `public/images/backgrounds/ocean-dive-surface-mobile.webp` | Matching portrait ocean-surface composition. |
| `public/images/backgrounds/ocean-dive-floor-mobile.webp` | Matching portrait reef-floor composition. |

The legacy surface artwork excludes characters and boats. The images and their former shader animation have been replaced by real footage.

## Generation and preparation

All four images used the built-in `image_gen` tool with `transparent_background: false`. The mobile surface and floor generations referenced their respective desktop PNGs. The resulting PNGs were converted to WebP using Sharp at quality 88, without cropping or compositing.

## Exact generation prompts

### Desktop surface

```text
Use case: stylized-concept. Asset type: production website background environment, wide landscape 16:9 image, no interface or text. Create the beginning of a continuous camera dive into a gorgeous tropical blue ocean, with the cinematic believable 3D environment lighting and wonder of Finding Nemo. Camera at the waterline using a split-level ocean lens: top 22% open rich blue sky with a few softly lit distant clouds, horizon near the upper quarter; a natural uneven translucent wave waterline spanning the frame, with small rolling waves seen from very low just above sea level. Below the waterline the remaining 75% is expansive clear cobalt and azure underwater water, looking out horizontally with the rippling underside of the surface overhead and subtle irregular sun rays filtering down from upper left. Physically believable reflections/refraction, gentle fine wavelets, incredible depth and atmospheric blue scattering. The bottom 25% transitions into calm uncluttered uniform deep ocean blue approximately #063b66 so it can blend with another scene. No seafloor, no fish, no boats, no islands, no people, no characters, no text, no logos, no framing. Natural luminous film environment, painterly polished 3D realism, not abstract fluid texture, not glowing neon lines, not a swimming pool. Keep the central area calm with generous negative space for webpage content. High detail ocean environment.
```

### Desktop floor

```text
Use case: stylized-concept. Asset type: production website background, wide landscape 16:9, matching a cinematic continuous tropical ocean dive inspired by the beautiful believable 3D ocean environments in Finding Nemo. Camera underwater floating 1.5 meters above a sandy seabed, looking horizontally into a vast blue ocean. Upper 60% is extremely calm empty deep cobalt and azure water fading from #073b65 at top into atmospheric blue toward distant seabed, no surface or horizon sky. Bottom 40% reveals softly undulating pale blue sandy ocean floor with believable irregular sun caustics, scattered rounded small rocks, low natural coral reef formations at far left and far right edges, softly colored blue-purple, muted warm coral and sea fans. Seabed recedes naturally into hazy blue depth. Keep center and upper region extremely clean and unobstructed for website content. Polished cinematic 3D environmental realism, rich ocean depth, luminous sunlight filtered from far above, restrained gentle light rays from upper left, natural fine particles, subtle texture. No fish, no sea creatures, no characters, no text, no logo, no bubbles, no rocks filling the middle, no huge coral, no neon, no cartoon outlines. Beautiful immersive underwater vista, consistent natural realistic lighting.
```

### Mobile surface

Reference: desktop surface PNG.

```text
Recompose this ocean environment into a tall portrait 9:16 mobile website background. Preserve the cinematic ocean realism, blue palette, natural sunlight and beautiful wave refraction. Important composition change: top 40% is open blue sky with subtle faraway clouds; the rolling waterline sits at 40% of image height so it will be visible just below a mobile website navigation. Bottom 60% clear blue underwater with the rippling underside of the surface and natural diffuse sunlight beams from upper left, fading into uncluttered cobalt blue at the bottom, no seafloor. Camera at ocean waterline using split-level lens. No text, no UI, no boats, no people, no fish or characters, no land. Avoid strong white clouds in upper center because a white logo will sit there. This is a mobile variant of the supplied background, not an interface mockup.
```

### Mobile floor

Reference: desktop floor PNG.

```text
Recompose the supplied underwater seabed scene into a tall portrait 9:16 mobile website background, maintaining the same cinematic believable 3D ocean environment and blue palette. The upper 60% should be calm clear deep cobalt ocean negative space with subtle natural sunrays from upper left, fading to #073b65 at the very top. The lower 40% reveals a sandy seabed in perspective with natural luminous water caustics. Small reef coral and rounded rocks frame the lower left and right edges, with an open sandy pathway in the center. Camera floating just above the floor looking out into blue distance. Preserve beautiful atmospheric depth and rich blues; subtle muted coral colors. No text, no interface, no fish, no characters, no sky, no waterline, no large foreground objects. This is a portrait companion background to the supplied landscape image.
```
