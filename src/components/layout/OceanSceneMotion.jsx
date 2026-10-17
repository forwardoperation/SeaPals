"use client";

import { useEffect, useRef } from "react";

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  // Keep source coordinates top-down, matching the CSS background image.
  v_uv = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5);
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform sampler2D u_image;
uniform vec2 u_cropScale;
uniform vec2 u_cropOffset;
uniform vec2 u_sourcePixel;
uniform float u_time;
uniform float u_surface;
uniform float u_waterline;

vec3 scene(vec2 uv) {
  return texture2D(u_image, clamp(uv, 0.0, 1.0)).rgb;
}

float luminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

// Isolate bright ridges already present in the photograph, not its terrain.
float causticLight(vec2 uv) {
  float light = luminance(scene(uv));
  vec2 spread = u_sourcePixel * vec2(9.0, 6.0);
  float surroundings = 0.5 * (
    luminance(scene(uv + spread)) + luminance(scene(uv - spread))
  );
  return smoothstep(0.42, 0.78, light)
    * smoothstep(0.012, 0.13, light - surroundings);
}

void main() {
  vec2 sourceUV = u_cropOffset + v_uv * u_cropScale;
  float t = u_time;
  vec3 color;

  if (u_surface > 0.5) {
    float water = smoothstep(u_waterline - 0.025, u_waterline + 0.025, sourceUV.y);
    float depth = 1.0 - smoothstep(u_waterline + 0.28, u_waterline + 0.64, sourceUV.y);
    float swell = sin(sourceUV.x * 32.0 - t * 1.7 + sin(sourceUV.y * 14.0 + t * 0.6));
    float ripple = sin(sourceUV.x * 73.0 + sourceUV.y * 27.0 + t * 2.0);
    float crossWave = sin(sourceUV.x * 19.0 - sourceUV.y * 36.0 + t * 1.35);
    vec2 displacement = vec2(3.2 * swell + 1.4 * ripple, 4.2 * swell + 2.1 * crossWave);
    color = scene(sourceUV + displacement * u_sourcePixel * water * depth);
    float sparkle = smoothstep(0.46, 0.88, luminance(color));
    color *= 1.0 + water * depth * sparkle * 0.055 * sin(sourceUV.x * 53.0 + sourceUV.y * 31.0 - t * 2.4);
  } else {
    // The base image never moves: only extracted illumination changes position.
    color = scene(sourceUV);
    float seabed = smoothstep(0.58, 0.74, sourceUV.y);
    vec2 drift = vec2(
      5.4 * sin(sourceUV.x * 17.0 + sourceUV.y * 11.0 + t * 1.5),
      3.8 * sin(sourceUV.x * 24.0 - sourceUV.y * 16.0 - t * 1.8)
    ) * u_sourcePixel;
    float originalLight = causticLight(sourceUV);
    float movingLight = causticLight(sourceUV + drift);
    float shimmer = 0.88 + 0.12 * sin(sourceUV.x * 21.0 + sourceUV.y * 29.0 + t * 2.0);
    color += vec3(0.85, 0.97, 1.0) * (movingLight * shimmer - originalLight) * seabed * 0.23;
    color *= 1.0 + seabed * 0.022 * sin(sourceUV.x * 13.0 + sourceUV.y * 19.0 - t * 1.25);
  }

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

function releaseResources(gl, resources) {
  if (!resources || gl.isContextLost()) return;
  if (resources.texture) gl.deleteTexture(resources.texture);
  if (resources.buffer) gl.deleteBuffer(resources.buffer);
  if (resources.program) gl.deleteProgram(resources.program);
  if (resources.vertex) gl.deleteShader(resources.vertex);
  if (resources.fragment) gl.deleteShader(resources.fragment);
}

function createResources(gl) {
  const resources = {};
  try {
    for (const [name, type, source] of [
      ["vertex", gl.VERTEX_SHADER, VERTEX_SHADER],
      ["fragment", gl.FRAGMENT_SHADER, FRAGMENT_SHADER],
    ]) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Shader unavailable");
      resources[name] = shader;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error("Shader compilation failed");
    }

    resources.program = gl.createProgram();
    if (!resources.program) throw new Error("Program unavailable");
    gl.attachShader(resources.program, resources.vertex);
    gl.attachShader(resources.program, resources.fragment);
    gl.linkProgram(resources.program);
    if (!gl.getProgramParameter(resources.program, gl.LINK_STATUS)) throw new Error("Shader linking failed");

    resources.buffer = gl.createBuffer();
    resources.texture = gl.createTexture();
    if (!resources.buffer || !resources.texture) throw new Error("Scene resources unavailable");
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    resources.position = gl.getAttribLocation(resources.program, "a_position");
    if (resources.position < 0) throw new Error("Scene position unavailable");
    resources.uniforms = Object.fromEntries(
      ["image", "cropScale", "cropOffset", "sourcePixel", "time", "surface", "waterline"]
        .map((name) => [name, gl.getUniformLocation(resources.program, `u_${name}`)]),
    );
    gl.bindTexture(gl.TEXTURE_2D, resources.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return resources;
  } catch {
    releaseResources(gl, resources);
    return null;
  }
}

export default function OceanSceneMotion({ kind, className }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || (kind !== "surface" && kind !== "floor")) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 767px)");
    let reducedMotion = motion.matches;
    let inView = typeof IntersectionObserver === "undefined";
    let disposed = false;
    let contextLost = false;
    let failed = false;
    let gl = null;
    let resources = null;
    let image = null;
    let pendingImage = null;
    let loadVersion = 0;
    let needsUpload = false;
    let needsResize = true;
    let frameId = null;
    let lastFrame = null;
    let frameClock = null;
    let sceneTime = 0;
    let cssWidth = 0;
    let cssHeight = 0;

    function clearReady() {
      canvas.dataset.ready = "false";
    }

    function stop() {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = null;
      lastFrame = null;
      frameClock = null;
    }

    function cancelImageLoad() {
      loadVersion += 1;
      if (pendingImage) {
        pendingImage.onload = null;
        pendingImage.onerror = null;
        pendingImage = null;
      }
    }

    function canAnimate() {
      return !disposed && !reducedMotion && inView && !document.hidden && !contextLost && !failed;
    }

    function schedule() {
      if (frameId === null && canAnimate() && resources && image) {
        frameId = window.requestAnimationFrame(render);
      }
    }

    function fail() {
      failed = true;
      clearReady();
      stop();
      if (gl) releaseResources(gl, resources);
      resources = null;
    }

    function render(now) {
      frameId = null;
      if (!canAnimate() || !resources || !image) return;
      const interval = 1000 / 30;
      if (frameClock !== null && now - frameClock < interval - 0.25) {
        schedule();
        return;
      }
      // Keep the pacing remainder so 60 Hz timestamp jitter doesn't skip a frame.
      frameClock = frameClock === null ? now
        : frameClock + Math.max(1, Math.floor((now - frameClock + 0.25) / interval)) * interval;
      // Every temporal frequency is a multiple of .05, so this loops seamlessly
      // and keeps the mediump fallback accurate during long browsing sessions.
      sceneTime = (sceneTime + (lastFrame === null ? 0 : Math.min((now - lastFrame) / 1000, 0.1))) % (Math.PI * 40);
      lastFrame = now;

      try {
        gl.useProgram(resources.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, resources.texture);
        if (needsUpload) {
          // Our UV origin already matches an HTML image; do not flip it again.
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
          needsUpload = false;
          needsResize = true;
        }

        if (needsResize) {
          const bounds = canvas.getBoundingClientRect();
          cssWidth = bounds.width;
          cssHeight = bounds.height;
          if (cssWidth <= 0 || cssHeight <= 0) {
            clearReady();
            return;
          }
          const resolution = Math.min(
            window.devicePixelRatio || 1,
            1.5,
            1600 / cssWidth,
            Math.sqrt(1000000 / (cssWidth * cssHeight)),
          );
          const width = Math.max(1, Math.floor(cssWidth * resolution));
          const height = Math.max(1, Math.floor(cssHeight * resolution));
          if (canvas.width !== width) canvas.width = width;
          if (canvas.height !== height) canvas.height = height;
          gl.viewport(0, 0, width, height);

          // CSS background-size: cover, horizontally centered, top/bottom aligned.
          const cover = Math.max(cssWidth / image.naturalWidth, cssHeight / image.naturalHeight);
          const sourceWidth = image.naturalWidth * cover;
          const sourceHeight = image.naturalHeight * cover;
          const cropX = cssWidth / sourceWidth;
          const cropY = cssHeight / sourceHeight;
          gl.uniform2f(resources.uniforms.cropScale, cropX, cropY);
          gl.uniform2f(resources.uniforms.cropOffset, (1 - cropX) / 2, kind === "floor" ? 1 - cropY : 0);
          gl.uniform2f(resources.uniforms.sourcePixel, 1 / sourceWidth, 1 / sourceHeight);
          gl.uniform1f(resources.uniforms.surface, kind === "surface" ? 1 : 0);
          gl.uniform1f(resources.uniforms.waterline, mobile.matches ? 0.31 : 0.16);
          gl.uniform1i(resources.uniforms.image, 0);
          needsResize = false;
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, resources.buffer);
        gl.enableVertexAttribArray(resources.position);
        gl.vertexAttribPointer(resources.position, 2, gl.FLOAT, false, 0, 0);
        gl.uniform1f(resources.uniforms.time, sceneTime);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (canvas.dataset.ready !== "true") {
          if (gl.getError() !== gl.NO_ERROR || gl.isContextLost()) {
            fail();
            return;
          }
          canvas.dataset.ready = "true";
        }
      } catch {
        fail();
        return;
      }
      schedule();
    }

    function loadImage() {
      if (pendingImage || image) return;
      const version = ++loadVersion;
      const nextImage = new Image();
      pendingImage = nextImage;
      nextImage.onload = () => {
        if (disposed || version !== loadVersion) return;
        nextImage.onload = null;
        nextImage.onerror = null;
        pendingImage = null;
        image = nextImage;
        needsUpload = true;
        schedule();
      };
      nextImage.onerror = () => {
        if (disposed || version !== loadVersion) return;
        cancelImageLoad();
        fail();
      };
      nextImage.src = `/images/backgrounds/ocean-dive-${kind}${mobile.matches ? "-mobile" : ""}.webp`;
    }

    function resume() {
      if (!canAnimate()) {
        stop();
        return;
      }
      if (!gl) {
        try {
          gl = canvas.getContext("webgl", {
            alpha: false,
            antialias: false,
            depth: false,
            stencil: false,
            premultipliedAlpha: false,
            preserveDrawingBuffer: false,
            powerPreference: "low-power",
          });
        } catch {
          gl = null;
        }
        if (!gl) {
          failed = true;
          return;
        }
      }
      if (!resources) {
        resources = createResources(gl);
        if (!resources) {
          failed = true;
          return;
        }
        needsUpload = true;
        needsResize = true;
      }
      loadImage();
      schedule();
    }

    function resize() {
      needsResize = true;
      resume();
    }

    function changeArt() {
      stop();
      clearReady();
      cancelImageLoad();
      image = null;
      failed = false;
      needsResize = true;
      resume();
    }

    function changeMotion(event) {
      reducedMotion = event.matches;
      if (reducedMotion) {
        stop();
        clearReady();
        cancelImageLoad();
        image = null;
        if (gl) releaseResources(gl, resources);
        resources = null;
      } else {
        failed = false;
        resume();
      }
    }

    function loseContext(event) {
      event.preventDefault();
      contextLost = true;
      stop();
      clearReady();
      cancelImageLoad();
      // Context loss invalidates all GPU objects; restoration creates new ones.
      resources = null;
    }

    function restoreContext() {
      contextLost = false;
      failed = false;
      needsUpload = true;
      needsResize = true;
      resume();
    }

    const visibilityObserver = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(([entry]) => {
          inView = entry.isIntersecting;
          resume();
        });
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(resize);
    clearReady();
    visibilityObserver?.observe(canvas);
    resizeObserver?.observe(canvas);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", resume);
    mobile.addEventListener("change", changeArt);
    motion.addEventListener("change", changeMotion);
    canvas.addEventListener("webglcontextlost", loseContext);
    canvas.addEventListener("webglcontextrestored", restoreContext);
    resume();

    return () => {
      disposed = true;
      stop();
      clearReady();
      cancelImageLoad();
      visibilityObserver?.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", resume);
      mobile.removeEventListener("change", changeArt);
      motion.removeEventListener("change", changeMotion);
      canvas.removeEventListener("webglcontextlost", loseContext);
      canvas.removeEventListener("webglcontextrestored", restoreContext);
      if (gl) releaseResources(gl, resources);
      resources = null;
      image = null;
    };
  }, [kind]);

  return <canvas ref={canvasRef} className={className} data-ready="false" aria-hidden="true" />;
}
