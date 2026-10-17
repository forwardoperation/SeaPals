# Ocean background footage

The site background uses two filmed ocean clips: the stabilized original surface shot and an open blue-water view with natural moving light. The underwater framing stays level while scrolling gradually removes daylight and fades the background to black. There is no seafloor scene or generated ripple/light animation.

## Sources and license

Downloaded October 17, 2026. The [Pexels License](https://www.pexels.com/license/) permits free use and modification on commercial websites without required attribution. The recordings are incorporated into the SeaRealm website, not offered as standalone stock downloads.

| Local asset in `public/media/ocean/` | Original footage | Creator | Source excerpt |
| --- | --- | --- | --- |
| `surface-steady.mp4` / `surface-steady.webp` | [Water Level Shot With View of Sunset](https://www.pexels.com/video/water-level-shot-with-view-of-sunset-3138050/) | juv | 0-12 seconds |
| `blue-water.mp4` / `blue-water.webp` | [Blue Water](https://www.pexels.com/video/blue-water-3754337/) | Cansu Özcömert | 0.5-6.5 seconds |

Original download URLs:

- https://videos.pexels.com/video-files/3138050/3138050-hd_1920_1080_30fps.mp4
- https://videos.pexels.com/video-files/3754337/3754337-hd_1920_1080_30fps.mp4

## Surface stabilization

The original surface footage is preserved. Its sky/water boundary is tracked per frame; low-confidence detections during wave occlusion are rejected and interpolated. Each frame receives only rigid rotation and vertical translation, followed by a fixed 1536x864 crop from the original 1920x1080 frame and resampling to 1280x720. The crop retains 80% of the original width and height. There is no variable zoom, water warping, or replacement sky. A real wave briefly passing over the lens remains in the recording.

On 234 confidently tracked matched frames, horizon-angle standard deviation fell from 2.41 to 0.31 degrees (87.1% reduction), and vertical-position standard deviation from 5.05 to 0.89 pixels at the 480x270 measurement resolution (82.3% reduction). The stabilized clip retains the previous cool color grade and one-second loop dissolve.

## Video preparation

Prepared with FFmpeg 7.1 and Pillow. Both clips are 1280 pixels wide, 24 fps, H.264/yuv420p MP4 with fast-start metadata and no audio. Playback speed is unchanged. Matching WebP posters are extracted from the first encoded frame.

- Surface: 720 pixels high, 11-second loop. The last second dissolves into the original first second; playback begins at source second one to make the loop join continuously. Grade: saturation 0.86; red shadows -0.025, blue shadows +0.035, blue midtones +0.035.
- Open water: crop 1600x640 at (0,440) to favor blue water below the bright surface, encoded at 1280x512. Saturation 0.92 and contrast 1.04. A 0.75-second dissolve makes a 5.25-second loop; the source's opening black frame is excluded. CSS frames the lower part of this footage so the view remains predominantly open water.

## Runtime

`OceanBackground` moves the surface out of view as the page scrolls, while the underwater scene stays fixed. A smooth opacity curve starts darkening after 10% scroll and reaches black at 95%. Both clips are hidden at full darkness, so their intersection observers pause decoding. Static blue shading preserves text contrast.

`OceanFootage` loads nearby scenes, plays visible scenes, pauses offscreen scenes and hidden tabs, and starts with posters without downloading video when reduced motion is requested. Reduced motion uses ordinary document scrolling through the posters into black. Playback is muted and inline; posters remain available when autoplay is blocked. Game and auth route exclusions are unchanged.

The earlier downward-looking sunlight and seafloor clips have been removed. Original downloads, stabilization measurements/contact sheets, and encoder tooling remain development-only files under ignored `tmp/ocean-footage/`. Runtime media is self-hosted, with no third-party media requests.
