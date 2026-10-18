# Ocean background footage

The site background uses two filmed ocean clips: the stabilized original surface shot and a calm open-water view with a distant rippled ceiling and faint natural light. The underwater clip plays in slow motion; its framing stays level while scrolling gradually removes daylight and fades the background to black. There is no seafloor scene or generated ripple/light animation.

## Sources and license

Downloaded October 17, 2026. The [Pexels License](https://www.pexels.com/license/) permits free use and modification on commercial websites without required attribution. The recordings are incorporated into the SeaRealm website, not offered as standalone stock downloads.

| Local asset in `public/media/ocean/` | Original footage | Creator | Source excerpt |
| --- | --- | --- | --- |
| `surface-steady.mp4` / `surface-steady.webp` | [Water Level Shot With View of Sunset](https://www.pexels.com/video/water-level-shot-with-view-of-sunset-3138050/) | juv | 0-12 seconds |
| `calm-blue-water.mp4` / `calm-blue-water.webp` | [Vast Underwater Scene with Turquoise Hues](https://www.pexels.com/video/vast-underwater-scene-with-turquoise-hues-38881597/) | JUN HO LEE | Full 7-second recording, slowed to 40% speed |

Original download URLs:

- https://videos.pexels.com/video-files/3138050/3138050-hd_1920_1080_30fps.mp4
- https://videos.pexels.com/video-files/38881597/16530873_1920_1080_60fps.mp4

The underwater source was published August 5, 2026, at 1920x1080 and 59.94 fps. Its narrow surface band and mostly empty blue water replace the previous close view of turbulent reflections. The slight natural camera drift and small distant fish remain in the recording.

## Surface stabilization

The original surface footage is preserved. Its sky/water boundary is tracked per frame; low-confidence detections during wave occlusion are rejected and interpolated. Each frame receives only rigid rotation and vertical translation, followed by a fixed 1536x864 crop from the original 1920x1080 frame and resampling to 1280x720. The crop retains 80% of the original width and height. There is no variable zoom, water warping, or replacement sky. A real wave briefly passing over the lens remains in the recording.

On 234 confidently tracked matched frames, horizon-angle standard deviation fell from 2.41 to 0.31 degrees (87.1% reduction), and vertical-position standard deviation from 5.05 to 0.89 pixels at the 480x270 measurement resolution (82.3% reduction). The stabilized clip retains the previous cool color grade and one-second loop dissolve.

## Video preparation

Prepared with FFmpeg 7.1 and Pillow. Both clips are 1280x720, 24 fps, H.264/yuv420p MP4 with fast-start metadata and no audio. The surface retains its original playback speed. Matching WebP posters are extracted from the first encoded frame.

- Surface: 720 pixels high, 11-second loop. The last second dissolves into the original first second; playback begins at source second one to make the loop join continuously. Grade: saturation 0.86; red shadows -0.025, blue shadows +0.035, blue midtones +0.035.
- Open water: the full frame is retained and the 59.94 fps recording is slowed to 40% speed for gentle movement at 24 fps. No optical-flow interpolation, generated beams, or ripple distortion is used. A two-second dissolve makes a 15.708-second loop (377 frames); playback begins after the opening section so the loop wraps continuously. Grade: green channel 98%, blue channel 101%, red unchanged. The video is 1,280,112 bytes and its poster is 13,710 bytes.

## Runtime

`OceanBackground` moves the surface out of view as the page scrolls, while the underwater scene stays fixed. The underwater layer fills the viewport without the previous oversized zoom; top-centered cover framing preserves the distant ceiling on portrait screens. Static shading deepens from lightly tinted blue at the top to dark navy below. A smooth opacity curve starts darkening after 10% scroll and reaches black at 95%. Both clips are hidden at full darkness, so their intersection observers pause decoding.

`OceanFootage` loads nearby scenes, plays visible scenes, pauses offscreen scenes and hidden tabs, and starts with posters without downloading video when reduced motion is requested. Reduced motion uses ordinary document scrolling through the posters into black. Playback is muted and inline; posters remain available when autoplay is blocked. Game and auth route exclusions are unchanged.

The earlier turbulent blue-water, downward-looking sunlight, and seafloor clips have been removed. Original downloads, stabilization measurements/contact sheets, and encoder tooling remain development-only files under ignored `tmp/ocean-footage/`. Runtime media is self-hosted, with no third-party media requests.
