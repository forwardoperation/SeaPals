# Ocean background footage

The site background plays filmed ocean video. The wave motion, underwater sunbeams, suspended particles, and seabed caustics come from the recordings. No ripple shaders, generated animation, or animated light overlays are used.

## Sources and license

Downloaded October 17, 2026. The [Pexels License](https://www.pexels.com/license/) permits free use and modification on commercial websites without required attribution. These recordings are used as part of the SeaRealm website, not offered as standalone stock downloads.

| Local asset in `public/media/ocean/` | Original footage | Creator | Source excerpt |
| --- | --- | --- | --- |
| `surface.mp4` / `surface.webp` | [Water Level Shot With View of Sunset](https://www.pexels.com/video/water-level-shot-with-view-of-sunset-3138050/) | juv | 0–12 seconds |
| `sunlight.mp4` / `sunlight.webp` | [Underwater Ocean View with Sunlight Rays](https://www.pexels.com/video/underwater-ocean-view-with-sunlight-rays-32790667/) | JUN HO LEE | 1–13 seconds |
| `seafloor.mp4` / `seafloor.webp` | [Time Lapse of a Sandy Seabed](https://www.pexels.com/video/time-lapse-of-a-sandy-seabed-11781634/) | Markus Winkler | 17–29 seconds |

Original download URLs:

- https://videos.pexels.com/video-files/3138050/3138050-hd_1920_1080_30fps.mp4
- https://videos.pexels.com/video-files/32790667/13977647_3840_2160_60fps.mp4
- https://videos.pexels.com/video-files/11781634/11781634-uhd_3840_2160.mp4

## Preparation

Prepared with FFmpeg 7.1. Each clip is 1280 pixels wide, 24 fps, H.264/yuv420p MP4 with fast-start metadata and no audio. The surface and sunlight clips are 720 pixels high; the cropped seafloor is 584 pixels high. Twelve seconds of source footage become an eleven-second loop: the final second dissolves into the original first second, and playback starts at source second one so the loop joins continuously. Playback speed is unchanged. Matching WebP posters are extracted from the first encoded frame.

The surface frame is cropped to 1728×972 at (96,54) and given a restrained cool color balance. The underwater clip receives a -12° hue adjustment to reduce purple and a slight contrast adjustment. The seafloor is cropped to 3840×1750 at (0,410) and color graded toward blue. No water displacement or light patterns are synthesized.

## Runtime

`OceanBackground` retains the scroll-driven surface-to-floor camera. Static masks blend the three recordings into the blue depth gradient; a static shade keeps text legible. `OceanFootage` loads nearby scenes, plays visible scenes, pauses offscreen scenes and hidden tabs, and starts with posters without downloading video when reduced motion is requested. Autoplay uses muted inline playback; posters remain available if playback is blocked. The game and auth route exclusions are unchanged.

Original full-resolution downloads and encoder tooling are development-only files under ignored `tmp/ocean-footage/`. Runtime media is self-hosted, with no third-party media requests.
