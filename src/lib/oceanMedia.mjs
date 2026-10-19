// Safari probes MP4 files with byte ranges. Workers Static Assets currently
// returns the complete body, so adapt only these two small, public ocean clips.
// The fallback sizes are checked against the source files by oceanMedia.test.mjs.
const OCEAN_MEDIA_BYTES = new Map([
  ["/media/ocean/clear-blue-water.mp4", 1216595],
  ["/media/ocean/surface-steady.mp4", 2723351],
]);

function parseRange(value, size) {
  // HTTP permits ignoring malformed/unsupported ranges, including multipart.
  if (!value || value.length > 256) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return null;
  const total = BigInt(size);
  if (!match[1]) {
    const suffix = BigInt(match[2]);
    if (!suffix || !total) return { unsatisfiable: true };
    return { start: Number(suffix >= total ? 0n : total - suffix), end: size - 1 };
  }
  const start = BigInt(match[1]);
  const end = match[2] ? BigInt(match[2]) : total - 1n;
  if (start >= total || end < start) return { unsatisfiable: true };
  return { start: Number(start), end: Number(end < total ? end : total - 1n) };
}

function matchesIfRange(value, headers) {
  if (!value) return true;
  const validator = value.trim();
  if (validator.startsWith('"')) {
    const etag = headers.get("ETag");
    return Boolean(etag && !etag.startsWith("W/") && validator === etag);
  }
  if (validator.startsWith("W/")) return false;
  const modified = headers.get("Last-Modified");
  const date = Date.parse(validator);
  return Boolean(modified && Number.isFinite(date) && date === Date.parse(modified));
}

function sliceStream(body, start, end) {
  const reader = body.getReader();
  let offset = 0;
  return new ReadableStream({
    async pull(controller) {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            controller.error(new Error("Ocean media ended before its declared byte range"));
            return;
          }
          const chunkStart = offset;
          offset += value.byteLength;
          if (offset <= start) continue;
          const first = Math.max(0, start - chunkStart);
          const last = Math.min(value.byteLength, end + 1 - chunkStart);
          if (last > first) controller.enqueue(value.subarray(first, last));
          if (offset > end) {
            controller.close();
            await reader.cancel();
          }
          return;
        }
      } catch (error) {
        controller.error(error);
        await reader.cancel(error).catch(() => {});
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

function fixedLengthBody(body, length) {
  // Workers ignores a manual Content-Length on an arbitrary ReadableStream.
  // Node's test runtime has no FixedLengthStream and retains the header itself.
  return typeof globalThis.FixedLengthStream === "function"
    ? body.pipeThrough(new globalThis.FixedLengthStream(length))
    : body;
}

export async function serveOceanMedia(request, environment) {
  const fallbackSize = OCEAN_MEDIA_BYTES.get(new URL(request.url).pathname);
  if (!fallbackSize || !["GET", "HEAD"].includes(request.method)) return null;

  const sourceHeaders = new Headers(request.headers);
  sourceHeaders.delete("Range");
  sourceHeaders.delete("If-Range");
  sourceHeaders.set("Accept-Encoding", "identity");
  const asset = await environment.ASSETS.fetch(new Request(request, { headers: sourceHeaders }));
  // Preserve normal validators (304/412), missing files, and other asset errors.
  if (asset.status !== 200) return asset;

  const headers = new Headers(asset.headers);
  const declaredLength = headers.get("Content-Length");
  const declaredSize = declaredLength && /^\d+$/.test(declaredLength) ? Number(declaredLength) : NaN;
  const size = Number.isSafeInteger(declaredSize) ? declaredSize : fallbackSize;
  const encoding = headers.get("Content-Encoding");
  if (encoding && encoding.toLowerCase() !== "identity") {
    await asset.body?.cancel();
    return new Response(null, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  headers.delete("Content-Encoding");
  headers.delete("Content-Range");
  headers.set("Content-Type", "video/mp4");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(size));

  // RFC 9110: Range modifies GET only. HEAD describes the complete resource.
  if (request.method === "HEAD") {
    await asset.body?.cancel();
    return new Response(null, { status: 200, headers });
  }

  const range = matchesIfRange(request.headers.get("If-Range"), headers)
    ? parseRange(request.headers.get("Range"), size)
    : null;
  if (range?.unsatisfiable) {
    await asset.body?.cancel();
    headers.set("Content-Range", `bytes */${size}`);
    headers.set("Content-Length", "0");
    return new Response(null, { status: 416, headers });
  }
  if (!range || !asset.body) return new Response(asset.body, { status: 200, headers });

  const length = range.end - range.start + 1;
  headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
  headers.set("Content-Length", String(length));
  const body = fixedLengthBody(sliceStream(asset.body, range.start, range.end), length);
  return new Response(body, { status: 206, headers });
}
