# Reefbound perspective world view

The full game at `/adventure` now defaults to a fixed, angled 2.5D camera. The terrain recedes into
the distance while characters, Elverson buildings, and street trees stand upright
and scale with distance. The world still uses the existing XY movement, collision,
interaction, and save coordinates.

In **Settings → World view**, choose:

- **Automatic (recommended):** the default. Uses 3D perspective on desktop and
  enables the same perspective with battery saver on phones and tablets.
- **3D perspective:** the new camera, with world updates capped at 60 per second.
- **Battery saver:** the same perspective at up to 30 updates per second, with
  idle stepping, markers, and wake animations disabled. Walking and boat speed
  use elapsed time and remain the same.
- **Classic overhead:** the original flat camera.

Older saves without a graphics preference default to Automatic. Explicit choices
remain available and survive local and cloud save normalization. Detection happens
on the current device, without saving the detected mode to the account; an automatic
save can move between desktop and phone without carrying over the other device's
power setting. Existing story, quests, interactions, inventories, and saves use the
same full-game components and logic. Street trees are decorative and add no collision
obstacles or changes to saved positions.

Device detection uses mobile client hints where present, phone/tablet user agents,
the iPadOS desktop-agent touch fallback, and touch-first pointer capabilities. It
does not depend on viewport width, so rotation keeps battery saver enabled and a
narrow desktop window keeps full quality. The server and initial client render use
the same default; detection runs during game boot. Browser API references:
[client hints](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/userAgentData),
[touch points](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/maxTouchPoints),
and [pointer capabilities](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/pointer).

## Rendering and phone budget

`adventurePerspective.mjs` owns the projection, inverse, camera bounds, billboard
sizes, and CSS ground matrix. The same math positions the ground and actor feet,
so doors and collisions stay aligned. The viewport is observed only on resize;
movement does not measure the DOM. Camera bounds include all four corners of the
perspective footprint, including portrait and landscape layouts.

Only the visible terrain region, with tile-snapped overscan, becomes a composited
surface. Objects are culled by their projected visual rectangles, retaining roofs
whose bases are below the viewport. Offscreen residents remain in the simulation
for collision and story logic but are not mounted. Projected sprites use inexpensive
ground shadows instead of per-sprite filter effects. The 16 trees reuse one 26 KB
transparent WebP. No 3D engine, additional runtime dependency, dynamic lighting,
or full-screen blur was added.

The phone camera shows eight tiles across and uses a taller portrait viewport.
Touch buttons remain at least 44 CSS pixels and support pointer cancellation.
CSS-drawn direction arrows cannot trigger text selection. Scene transitions,
reduced motion, and high contrast still use the existing accessibility controls.

Interior artwork uses a gentler angle because furniture and walls are already
painted into the room backgrounds. Aquarium promenades retain their authored
side view, and the submarine, catching minigames, and card battles retain their
specialized presentations. Later towns with flattened artwork gain terrain
perspective and upright residents; their painted buildings are not separate 3D
objects.

## Verification and local preview

Run `npm run test:adventure` and `npm run build`.

After starting `npm run dev`, open `/dev/reefbound` for an isolated visual preview.
It uses the actual game sprites, renderer, movement, touch buttons, collision, and
doorway logic, without accessing account saves. The route returns 404 in production.
Choose a location and view mode, move with WASD/arrow keys or the D-pad, and use
the five-second movement check to see update cadence. The Phone view button embeds
the preview in a 390 × 844 viewport.

The viewer demo is deliberately limited; it is not the main game. Use `/adventure`
and the existing family-account sign-in to play the complete game with the new view.
The preview links to that route. No demo movement or interaction handlers are imported
by the main game. Battles, catching, aquarium exhibits, dialogue, progression,
cloud saves, and account access retain their existing implementation.

For local testing without email sign-in, open `/dev/reefbound/play`. This route mounts
the same `AdventureGame` with the normal opening, story, and gameplay. Its three save
slots persist under the separate `reefbound-local-playtest-v1:` browser-storage prefix.
It does not import account or legacy saves, initialize a cloud client, or show account
newsletter prompts. Both the route and the guest-mode switch require a development
environment; the route returns 404 in production. The development login page includes
a direct playtest link. The regular `/adventure` authorization and save APIs are unchanged.

Local browser checks at 390 × 844 observed approximately 50 updates/second in
perspective and 30 in battery saver. These are desktop browser measurements at
phone dimensions, not physical phone benchmarks. Test on representative iOS Safari
and Android Chrome hardware for sustained performance, thermal behavior, and
battery use before claiming a mobile frame-rate guarantee.

Projection tests cover every authored scene at desktop and phone dimensions,
ground/billboard alignment, near-plane culling, frame pacing under jitter,
identical movement speed at 30/60 updates, and save compatibility. Existing town
traversal tests cover all nine portals, public roads, and scripted escort routes.
Graphics tests cover mobile detection, desktop fallbacks, manual overrides,
device-independent save preferences, unchanged gameplay save domains, and all nine
town doorways at both 30 and 60 fps. Walking keeps its original 50 ms stalled-frame
limit; resident motion keeps its original 80 ms limit.
