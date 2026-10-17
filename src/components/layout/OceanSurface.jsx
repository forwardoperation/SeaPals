"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import styles from "./OceanBackground.module.css";

const VERTEX_SHADER = `
  attribute vec2 position;
  varying vec2 uv;
  void main() {
    uv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

// A moving wave height field, viewed from beneath the surface. The displaced
// normals make the reflections deform instead of sliding a repeating texture.
const FRAGMENT_SHADER = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif
  varying vec2 uv;
  uniform vec2 resolution;
  uniform float time;

  float hash(vec2 p) {
    // Small intermediates preserve noise even on mediump-only mobile GPUs.
    p = fract(p * vec2(0.1031, 0.1137));
    p += dot(p, p.yx + 3.33);
    return fract((p.x + p.y) * p.x);
  }

  float noise(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), f.x),
               mix(hash(cell + vec2(0.0, 1.0)), hash(cell + 1.0), f.x), f.y);
  }

  float swell(vec2 p) {
    float value = 0.0;
    float weight = 0.55;
    mat2 turn = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 3; i++) {
      value += noise(p) * weight;
      p = turn * p * 2.03 + 7.1;
      weight *= 0.48;
    }
    return value;
  }

  void main() {
    float depth = 1.0 - uv.y;
    float aspect = resolution.x / resolution.y;
    // Perspective compresses the distant ripples at the top of the page.
    vec2 p = vec2((uv.x - 0.5) * aspect * 8.0 / (depth + 0.7),
                  4.0 / (depth + 0.28));
    vec2 drift = vec2(time * 0.11, -time * 0.075);
    vec2 warp = vec2(swell(p * 0.48 + drift),
                     swell(p * 0.53 - drift + 19.7));
    p += (warp - 0.5) * 2.8;

    float a = dot(p, vec2(0.78, 1.32)) + time * 0.8;
    float b = dot(p, vec2(-1.24, 0.92)) - time * 0.62;
    float c = dot(p, vec2(2.18, 1.72)) + time * 1.13 + warp.x * 3.0;
    float d = dot(p, vec2(-3.12, 2.24)) - time * 0.94;
    float height = sin(a) * 0.48 + sin(b) * 0.3 + sin(c) * 0.14 + sin(d) * 0.08;
    vec2 slope = cos(a) * vec2(0.78, 1.32) * 0.48
               + cos(b) * vec2(-1.24, 0.92) * 0.3
               + cos(c) * vec2(2.18, 1.72) * 0.14
               + cos(d) * vec2(-3.12, 2.24) * 0.08;
    vec3 normal = normalize(vec3(-slope.x * 0.85, 1.0, -slope.y * 0.65));
    vec3 light = normalize(vec3(-0.35, 0.85, 0.45));
    float reflection = pow(max(dot(normal, light), 0.0), 18.0);
    float fineReflection = pow(max(dot(normal, normalize(vec3(0.5, 0.72, -0.2))), 0.0), 36.0);
    float foldedLight = pow(max(1.0 - abs(height + (warp.x - 0.5) * 0.6), 0.0), 13.0);
    float brokenLight = 0.35 + 0.65 * swell(p * 1.8 + drift);

    vec3 water = mix(vec3(0.025, 0.14, 0.32), vec3(0.11, 0.42, 0.70), normal.y * 0.7 + height * 0.18);
    water += vec3(0.45, 0.69, 0.88) * reflection * 0.65;
    water += vec3(0.56, 0.77, 0.96) * fineReflection * 0.3;
    water += vec3(0.48, 0.72, 0.92) * foldedLight * brokenLight * 0.28;
    float fade = 1.0 - smoothstep(0.12, 0.92, depth);
    gl_FragColor = vec4(water, fade * 0.92);
  }
`;

export default function OceanSurface() {
  const canvasRef = useRef(null);
  const pathname = usePathname();
  // These screens cover the page with their own scene; save the GPU for it.
  const coveredByScene = /^\/(adventure|auth)(\/|$)/.test(pathname ?? "")
    || /^\/simulator(-v2)?$/.test(pathname ?? "")
    || /^\/dev\/reefbound\/play(\/|$)/.test(pathname ?? "");

  useEffect(() => {
    if (coveredByScene) return;
    const canvas = canvasRef.current;
    let gl;
    try {
      gl = canvas.getContext("webgl", {
        alpha: true, antialias: false, depth: false, stencil: false,
        premultipliedAlpha: false, powerPreference: "low-power",
      });
    } catch {
      return;
    }
    if (!gl) return; // CSS water remains visible without WebGL.

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let program, buffer, vertex, fragment, resolution, time;
    let frame = 0;
    let visible = false;
    let ready = false;
    let elapsed = 0;
    let lastFrame = 0;

    function release() {
      if (program) gl.deleteProgram(program);
      if (buffer) gl.deleteBuffer(buffer);
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
      program = buffer = vertex = fragment = null;
      ready = false;
    }

    function shader(type, source) {
      const result = gl.createShader(type);
      if (!result) throw new Error("Water shader unavailable");
      gl.shaderSource(result, source);
      gl.compileShader(result);
      if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
        gl.deleteShader(result);
        throw new Error("Water shader could not compile");
      }
      return result;
    }

    function draw() {
      if (!ready || gl.isContextLost()) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(time, motion.matches ? 0 : elapsed);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      canvas.dataset.ready = "true";
    }

    function resize() {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      // Cap the framebuffer independently of document length and pixel density.
      const scale = Math.min(window.devicePixelRatio || 1, 1.5, 1440 / width, Math.sqrt(900000 / (width * height)));
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      draw();
    }

    function initialize() {
      release();
      try {
        vertex = shader(gl.VERTEX_SHADER, VERTEX_SHADER);
        fragment = shader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
        program = gl.createProgram();
        if (!program) throw new Error("Water program unavailable");
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Water program could not link");
        gl.useProgram(program);
        buffer = gl.createBuffer();
        if (!buffer) throw new Error("Water buffer unavailable");
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, "position");
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        resolution = gl.getUniformLocation(program, "resolution");
        time = gl.getUniformLocation(program, "time");
        ready = true;
        resize();
      } catch {
        release();
        delete canvas.dataset.ready;
      }
    }

    function tick(now) {
      frame = 0;
      if (!ready || !visible || document.hidden || motion.matches) return;
      if (now - lastFrame >= 1000 / 30) {
        elapsed += lastFrame ? Math.min((now - lastFrame) / 1000, 0.1) : 0;
        lastFrame = now;
        draw();
      }
      frame = requestAnimationFrame(tick);
    }

    function syncPlayback() {
      cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = 0;
      if (motion.matches) draw();
      else if (ready && visible && !document.hidden) frame = requestAnimationFrame(tick);
    }

    function contextLost(event) {
      event.preventDefault();
      ready = false;
      delete canvas.dataset.ready;
      syncPlayback();
    }

    function contextRestored() {
      initialize();
      syncPlayback();
    }

    initialize();
    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(canvas);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncPlayback();
    }, { rootMargin: "120px" });
    visibilityObserver.observe(canvas);
    motion.addEventListener("change", syncPlayback);
    document.addEventListener("visibilitychange", syncPlayback);
    canvas.addEventListener("webglcontextlost", contextLost);
    canvas.addEventListener("webglcontextrestored", contextRestored);

    return () => {
      cancelAnimationFrame(frame);
      sizeObserver.disconnect();
      visibilityObserver.disconnect();
      motion.removeEventListener("change", syncPlayback);
      document.removeEventListener("visibilitychange", syncPlayback);
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("webglcontextrestored", contextRestored);
      release();
    };
  }, [coveredByScene]);

  return coveredByScene ? null : <canvas ref={canvasRef} className={styles.waterCanvas} aria-hidden="true" />;
}
