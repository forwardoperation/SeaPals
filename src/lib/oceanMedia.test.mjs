import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import { serveOceanMedia } from "./oceanMedia.mjs";

const path = "/media/ocean/clear-blue-water.mp4";
const bytes = new TextEncoder().encode("0123456789");
function request(headers = {}, method = "GET", pathname = path) {
  return new Request(`https://searealm.com${pathname}`, { method, headers });
}
function source(options = {}) {
  const calls = [];
  const state = { pulls: 0, cancelled: false };
  return {
    calls, state,
    ASSETS: { async fetch(input) {
      calls.push(input);
      if (options.status && options.status !== 200) {
        return new Response(null, { status: options.status, headers: options.headers });
      }
      const data = options.bytes ?? bytes;
      let offset = 0;
      const body = input.method === "HEAD" ? null : new ReadableStream({
        pull(controller) {
          state.pulls += 1;
          if (offset === data.byteLength) { controller.close(); return; }
          controller.enqueue(data.subarray(offset, offset + 2));
          offset += 2;
        },
        cancel() { state.cancelled = true; },
      }, { highWaterMark: 0 });
      return new Response(body, { headers: {
        "Content-Type": "video/mp4",
        ...(options.omitLength ? {} : { "Content-Length": String(data.byteLength) }),
        ETag: '"clip-v1"',
        "Last-Modified": "Sun, 18 Oct 2026 12:00:00 GMT",
        ...options.headers,
      } });
    } },
  };
}

test("limits handling to known ocean clips and safe methods", async () => {
  const environment = source();
  for (const input of [request({}, "POST"), request({}, "GET", "/store"), request({}, "GET", "/media/ocean/other.mp4")]) {
    assert.equal(await serveOceanMedia(input, environment), null);
  }
  assert.equal(environment.calls.length, 0);
});

test("Safari's two-byte probe returns only its requested bytes and cancels upstream", async () => {
  const environment = source();
  const response = await serveOceanMedia(request({ Range: "bytes=0-1" }), environment);
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("Content-Range"), "bytes 0-1/10");
  assert.equal(response.headers.get("Content-Length"), "2");
  assert.equal(response.headers.get("Accept-Ranges"), "bytes");
  assert.equal(await response.text(), "01");
  assert.equal(environment.state.cancelled, true);
  assert.equal(environment.state.pulls, 1);
  assert.equal(environment.calls[0].headers.has("Range"), false);
  assert.equal(environment.calls[0].headers.get("Accept-Encoding"), "identity");
});

test("streams mid-chunk, open-ended, suffix, and clamped ranges correctly", async () => {
  for (const [range, expected, contentRange] of [
    ["bytes=3-6", "3456", "bytes 3-6/10"],
    ["bytes=7-", "789", "bytes 7-9/10"],
    ["bytes=-3", "789", "bytes 7-9/10"],
    ["bytes=-999999999999999999999", "0123456789", "bytes 0-9/10"],
    ["bytes=8-999999999999999999999", "89", "bytes 8-9/10"],
  ]) {
    const response = await serveOceanMedia(request({ Range: range }), source());
    assert.equal(response.status, 206, range);
    assert.equal(response.headers.get("Content-Range"), contentRange);
    assert.equal(await response.text(), expected);
  }
});

test("unsatisfiable ranges return a bodyless 416 with the complete size", async () => {
  for (const range of ["bytes=10-", "bytes=8-7", "bytes=-0", "bytes=999999999999999999999-"]) {
    const environment = source();
    const response = await serveOceanMedia(request({ Range: range }), environment);
    assert.equal(response.status, 416, range);
    assert.equal(response.headers.get("Content-Range"), "bytes */10");
    assert.equal(await response.text(), "");
    assert.equal(environment.state.cancelled, true);
    assert.equal(environment.state.pulls, 0);
  }
});

test("ignores malformed, negative, unsafe and unsupported multipart ranges", async () => {
  for (const range of ["garbage", "items=0-1", "bytes=-", "bytes=1--1", "bytes=0-1,4-5", "bytes=NaN-9", `bytes=${"9".repeat(300)}-`]) {
    const response = await serveOceanMedia(request({ Range: range }), source());
    assert.equal(response.status, 200, range);
    assert.equal(response.headers.has("Content-Range"), false);
    assert.equal(await response.text(), "0123456789");
  }
});

test("honors exact strong If-Range tags and dates, rejects weak or stale validators", async () => {
  for (const [validator, status] of [
    ['"clip-v1"', 206], ['"old"', 200], ['W/"clip-v1"', 200],
    ["Sun, 18 Oct 2026 12:00:00 GMT", 206],
    ["Sun, 18 Oct 2026 11:00:00 GMT", 200],
    ["Sun, 18 Oct 2026 13:00:00 GMT", 200], ["invalid", 200],
  ]) {
    const environment = source();
    const response = await serveOceanMedia(request({ Range: "bytes=0-1", "If-Range": validator }), environment);
    assert.equal(response.status, status, validator);
    assert.equal(await response.text(), status === 206 ? "01" : "0123456789");
    assert.equal(environment.calls[0].headers.has("If-Range"), false);
  }
  const weakAsset = source({ headers: { ETag: 'W/"clip-v1"' } });
  const response = await serveOceanMedia(request({ Range: "bytes=0-1", "If-Range": '"clip-v1"' }), weakAsset);
  assert.equal(response.status, 200);
  await response.body.cancel();
});

test("HEAD ignores Range, sends complete metadata, and does not read a body", async () => {
  const environment = source();
  const response = await serveOceanMedia(request({ Range: "bytes=0-1" }, "HEAD"), environment);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Length"), "10");
  assert.equal(response.headers.get("Accept-Ranges"), "bytes");
  assert.equal(response.headers.has("Content-Range"), false);
  assert.equal(response.body, null);
  assert.equal(environment.state.pulls, 0);
});

test("passes regular conditional validators and asset errors through", async () => {
  for (const status of [304, 404, 412, 500]) {
    const environment = source({ status });
    const response = await serveOceanMedia(request({ Range: "bytes=0-1", "If-None-Match": '"clip-v1"' }), environment);
    assert.equal(response.status, status);
    assert.equal(environment.calls[0].headers.get("If-None-Match"), '"clip-v1"');
  }
});

test("client cancellation propagates to the asset stream", async () => {
  const environment = source();
  const response = await serveOceanMedia(request({ Range: "bytes=0-9" }), environment);
  const reader = response.body.getReader();
  await reader.read();
  await reader.cancel("disconnected");
  assert.equal(environment.state.cancelled, true);
  assert.ok(environment.state.pulls < 5);
});

test("fails a truncated body rather than silently completing a partial response", async () => {
  const response = await serveOceanMedia(request({ Range: "bytes=8-12" }), source({ headers: { "Content-Length": "20" } }));
  await assert.rejects(response.text(), /ended before/);
});

test("does not byte-slice an unexpectedly compressed representation", async () => {
  const environment = source({ headers: { "Content-Encoding": "gzip" } });
  const response = await serveOceanMedia(request({ Range: "bytes=0-1" }), environment);
  assert.equal(response.status, 502);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(environment.state.cancelled, true);
});

test("fallback metadata matches the actual deployed videos when ASSETS omits length", async () => {
  for (const name of ["clear-blue-water.mp4", "surface-steady.mp4"]) {
    const response = await serveOceanMedia(request({}, "HEAD", `/media/ocean/${name}`), source({ omitLength: true }));
    const actual = await stat(new URL(`../../public/media/ocean/${name}`, import.meta.url));
    assert.equal(Number(response.headers.get("Content-Length")), actual.size);
  }
});

test("Worker preserves redirect ordering and scopes worker-first routing to ocean MP4s", async () => {
  const worker = await readFile(new URL("../../custom-worker.mjs", import.meta.url), "utf8");
  assert.ok(worker.indexOf("const oceanMedia =") > worker.indexOf("const redirectLocation ="));
  assert.ok(worker.indexOf("const oceanMedia =") < worker.indexOf("const blockedResponse ="));
  assert.ok(worker.includes("if (oceanMedia) return oceanMedia;"));
  const config = await readFile(new URL("../../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(config, /"run_worker_first":\s*\["\/media\/ocean\/\*\.mp4"\]/);
});
