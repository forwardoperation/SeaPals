# Ocean background footage

The site background uses two filmed ocean clips: the stabilized original surface shot and a calm open-water view with a distant rippled ceiling and faint natural light. Both clips have slow motion encoded into their files. The underwater framing stays level while scrolling gradually removes daylight and fades the background to black. There is no seafloor scene or generated ripple/light animation.

## Sources and license

Downloaded October 17, 2026. The [Pexels License](https://www.pexels.com/license/) permits free use and modification on commercial websites without required attribution. The recordings are incorporated into the SeaRealm website, not offered as standalone stock downloads.

| Local asset in `public/media/ocean/` | Original footage | Creator | Source excerpt |
| --- | --- | --- | --- |
| `surface-steady.mp4` / `surface-steady.webp` | [Water Level Shot With View of Sunset](https://www.pexels.com/video/water-level-shot-with-view-of-sunset-3138050/) | juv | 0-12 seconds |
| `clear-blue-water.mp4` / `clear-blue-water.webp` | [Vast Underwater Scene with Turquoise Hues](https://www.pexels.com/video/vast-underwater-scene-with-turquoise-hues-38881597/) | JUN HO LEE | Full 7-second recording, slowed to 40% speed; central squid removed |

Original download URLs:

- https://videos.pexels.com/video-files/3138050/3138050-hd_1920_1080_30fps.mp4
- https://videos.pexels.com/video-files/38881597/16530873_1920_1080_60fps.mp4

The underwater source was published August 5, 2026, at 1920x1080 and 59.94 fps. Its narrow surface band and mostly empty blue water replace the previous close view of turbulent reflections. The central squid is removed from the source frames before the slow-motion loop and its dissolve are assembled. The slight natural camera drift remains in the recording.

The cleanup tracks the squid through all 425 source frames and blends adjacent water from the same frame and depth into a small feathered patch. The 288x160-pixel patch uses water sampled 320 pixels to either side; the rest of the composition is preserved. This also cleans both branches of the loop dissolve. New `clear-blue-water` asset URLs prevent browsers from reusing the previous clip or poster.

## Surface stabilization

The original surface source is native 1920x1080 at 29.97 fps. Its sky/water boundary is tracked per frame; low-confidence detections during wave occlusion are rejected and interpolated. Stabilization preserves the original frame cadence rather than first reducing it to 24 fps. Each frame receives rigid rotation and vertical translation, followed by the retained fixed 1536x864 crop from the original frame. That crop retains 80% of the source width and height and is modestly scaled to the 1920x1080 output; the result is not uncropped native 1080p detail. Stabilization uses no variable zoom or replacement sky. A real wave briefly passing over the lens remains in the recording.

The earlier 720p/24 fps stabilization pass measured 234 confidently tracked matched frames: horizon-angle standard deviation fell from 2.41 to 0.31 degrees (87.1% reduction), and vertical-position standard deviation from 5.05 to 0.89 pixels at the 480x270 measurement resolution (82.3% reduction). These are historical measurements, not a new measurement of the 1080p/60 fps encode. The regenerated surface retains the cool color grade and the loop dissolve.

## Video preparation

Prepared with FFmpeg 7.1 and Pillow. Both clips are H.264/yuv420p MP4 with fast-start metadata and no audio, but their output resolutions and frame rates differ. Slow motion is encoded into both files, which play at the normal 1x runtime rate. Matching WebP posters are extracted from the first encoded frame.

- Surface: 1920x1080, 60 fps, with half-speed motion baked into a 22-second loop (1,320 frames). After stabilization at the original 29.97 fps cadence, the timeline is slowed to 50% speed and motion-compensated interpolation supplies the 60 fps output frames. This interpolates motion between recorded frames; it does not replace the filmed scene. The one-second source-time loop dissolve occupies two seconds on the half-speed timeline, with playback beginning after the opening section for a continuous join. H.264 CRF 20 reduces compression relative to the previous surface encode. Grade: saturation 0.86; red shadows -0.025, blue shadows +0.035, blue midtones +0.035. The video and poster URLs use `?v=3` to refresh cached assets.
- Open water (unchanged): 1280x720 at 24 fps. The full frame is retained and the 59.94 fps recording is slowed to 40% speed for gentle movement. No optical-flow interpolation, generated beams, or ripple distortion is used. A two-second dissolve makes a 15.708-second loop (377 frames); playback begins after the opening section so the loop wraps continuously. Grade: green channel 98%, blue channel 101%, red unchanged. The poster is extracted from the cleaned video so reduced-motion and autoplay-blocked views also omit the squid.

## Runtime

`OceanBackground` moves the surface out of view as the page scrolls, while the underwater scene stays fixed. The underwater layer fills the viewport without the previous oversized zoom; top-centered cover framing preserves the distant ceiling on portrait screens. Static shading deepens from lightly tinted blue at the top to dark navy below. A smooth opacity curve starts darkening after 10% scroll and reaches black at 95%. Both clips are hidden at full darkness, so their intersection observers pause decoding.

`OceanFootage` loads nearby scenes, plays visible scenes, pauses offscreen scenes and hidden tabs, and starts with posters without downloading video when reduced motion is requested. Reduced motion uses ordinary document scrolling through the posters into black. Playback is muted and inline; posters remain available when autoplay is blocked. Both scenes use the default 1x playback rate because their slow motion is encoded in the files; the surface no longer applies an additional runtime slowdown. Reusable playback-rate support remains in `OceanFootage` for other callers. Game and auth route exclusions are unchanged.

The earlier turbulent blue-water, downward-looking sunlight, and seafloor clips have been removed. Original downloads, stabilization measurements/contact sheets, and encoder tooling remain development-only files under ignored `tmp/ocean-footage/`. Runtime media is self-hosted, with no third-party media requests.
