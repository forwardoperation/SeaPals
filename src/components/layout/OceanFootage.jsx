"use client";

import { useEffect, useRef } from "react";
import { observeOceanFootage } from "./oceanVideoPlayback.mjs";

export default function OceanFootage({ src, poster, className, playbackRate = 1 }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    return observeOceanFootage(video, src, window, document, playbackRate);
  }, [src, playbackRate]);

  return (
    <video
      ref={videoRef}
      className={className}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="none"
      disablePictureInPicture
      disableRemotePlayback
      tabIndex={-1}
      aria-hidden="true"
    />
  );
}
