import { forwardRef } from "react";

// Shared game components do not need Next's image server in a bundled app.
export default forwardRef(function Image({
  src, alt = "", fill, priority, unoptimized, quality, loader, placeholder,
  blurDataURL, onLoadingComplete, style, loading, ...props
}, ref) {
  return <img ref={ref} src={typeof src === "object" ? src.src : src} alt={alt}
    loading={loading ?? (priority ? "eager" : "lazy")}
    style={fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style } : style}
    {...props} />;
});
