import test from "node:test";
import assert from "node:assert/strict";
import {
  isTransientExportError,
  parseConcurrency,
  runExportBatches,
} from "../../../scripts/manufacturing/sync-figma.mjs";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

// Observe rejection immediately, including while a test deliberately holds
// another worker open. Node's test runner still detects leaked rejections.
function observe(promise) {
  const result = { status: "pending" };
  result.done = Promise.resolve(promise).then(
    (value) => Object.assign(result, { status: "fulfilled", value }),
    (error) => Object.assign(result, { status: "rejected", error }),
  );
  return result;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

function assertFailures(result, expected) {
  assert.equal(result.status, "rejected");
  assert.ok(result.error instanceof AggregateError);
  assert.equal(result.error.errors.length, expected.length);
  for (const error of expected) assert.ok(result.error.errors.includes(error));
  assert.match(result.error.message, /release/i);
  assert.match(result.error.message, /(?:no |not |without )/i);
  assert.match(result.error.message, /writ|written/i);
  assert.match(result.error.message, /publish/i);
}

test("only server failures and recognized timeouts are transient export failures", () => {
  for (const status of [500, 502, 503, 504, 599]) {
    assert.equal(isTransientExportError(Object.assign(new Error(`HTTP ${status}`), { status })), true);
  }
  for (const name of ["TimeoutError", "AbortError"]) {
    const timeout = Object.assign(new Error("Request timed out"), { name });
    assert.equal(isTransientExportError(timeout), true);
    assert.equal(isTransientExportError(new Error("Fetch failed", { cause: timeout })), true);
  }
  for (const code of ["UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"]) {
    const timeout = Object.assign(new Error("Request timed out"), { code });
    assert.equal(isTransientExportError(timeout), true);
    assert.equal(isTransientExportError(new TypeError("Fetch failed", { cause: timeout })), true);
  }
  assert.equal(isTransientExportError(Object.assign(new Error("Mock timeout"), { transient: true })), true);
  for (const error of [
    new Error("Collector number mismatch"),
    new Error("Incorrect image dimensions"),
    new TypeError("Unknown fetch failure"),
    Object.assign(new Error("Connection refused"), { code: "ECONNREFUSED" }),
    Object.assign(new Error("HTTP 400"), { status: 400 }),
    Object.assign(new Error("HTTP 404"), { status: 404 }),
  ]) {
    assert.equal(isTransientExportError(error), false, error.message);
  }
});

test("authentication and rate-limit statuses override transient hints and timeout causes", () => {
  for (const status of [401, 403, 429]) {
    const cause = Object.assign(new Error("Timeout"), { name: "TimeoutError" });
    const error = Object.assign(new Error(`HTTP ${status}`, { cause }), {
      status,
      transient: true,
    });
    assert.equal(isTransientExportError(error), false);
  }
});

test("a paired-request aggregate is transient only if every contained error is transient", () => {
  const timeout = Object.assign(new Error("Timeout"), { name: "TimeoutError" });
  const serverFailure = Object.assign(new Error("HTTP 503"), { status: 503 });
  const rateLimit = Object.assign(new Error("HTTP 429"), { status: 429 });
  const invalidArtwork = new Error("Collector number mismatch");
  assert.equal(isTransientExportError(new AggregateError([timeout, serverFailure])), true);
  assert.equal(isTransientExportError(new AggregateError([timeout, rateLimit])), false);
  assert.equal(isTransientExportError(new AggregateError([serverFailure, invalidArtwork])), false);
  assert.equal(isTransientExportError(new AggregateError([])), false);
});

test("export concurrency defaults to one and accepts the supported decimal values", () => {
  assert.equal(parseConcurrency([]), 1);
  assert.equal(parseConcurrency(["--check"]), 1);
  for (const value of [1, 2, 3]) {
    assert.equal(parseConcurrency(["--concurrency", String(value)]), value);
    assert.equal(
      parseConcurrency(["--check", "--concurrency", String(value), "--if-changed"]),
      value,
    );
  }
});

test("invalid or repeated concurrency arguments fail before an export starts", () => {
  const invalid = [
    ["--concurrency"],
    ["--concurrency", "--check"],
    ["--concurrency", "1", "--concurrency", "1"],
    ["--concurrency", "1", "--concurrency", "2"],
    ...["", "0", "-1", "4", "100", "NaN", "Infinity", "1.5", "2.0", "1e0", "0x2", "+2", " 2", "2 "].map(
      (value) => ["--concurrency", value],
    ),
  ];
  for (const args of invalid) {
    assert.throws(() => parseConcurrency(args), /concurrency/i, JSON.stringify(args));
  }
});

for (const concurrency of [1, 2, 3]) {
  test(`export runner never exceeds ${concurrency} active worker(s)`, async () => {
    const batches = [0, 1, 2, 3, 4];
    const gates = batches.map(deferred);
    const started = [];
    const completed = [];
    let active = 0;
    let maximum = 0;
    const result = observe(runExportBatches(batches, {
      ...(concurrency === 1 ? {} : { concurrency }),
      async runBatch(batch) {
        started.push(batch);
        active += 1;
        maximum = Math.max(maximum, active);
        try {
          await gates[batch].promise;
          completed.push(batch);
        } finally {
          active -= 1;
        }
      },
    }));

    await flush();
    assert.deepEqual(started, batches.slice(0, concurrency));
    assert.equal(result.status, "pending");
    gates[0].resolve();
    await flush();
    assert.deepEqual(started, batches.slice(0, concurrency + 1));
    assert.equal(active, concurrency);
    for (const gate of gates) gate.resolve();
    await result.done;

    assert.equal(result.status, "fulfilled");
    assert.equal(maximum, concurrency);
    assert.equal(active, 0);
    assert.deepEqual(started, batches);
    assert.deepEqual(completed.toSorted(), batches);
  });
}

test("runner rejects invalid worker counts before starting any batch", async () => {
  let calls = 0;
  for (const concurrency of [0, -1, 4, 1.5, NaN, Infinity, "2", null]) {
    await assert.rejects(
      async () => runExportBatches(["unused"], {
        concurrency,
        runBatch: async () => { calls += 1; },
      }),
      /concurrency/i,
    );
  }
  assert.equal(calls, 0);
});

test("an empty export resolves without starting workers or writing progress", async () => {
  await runExportBatches([], {
    concurrency: 3,
    runBatch: async () => assert.fail("No batch should run"),
    checkpoint: async () => assert.fail("No progress should be written"),
  });
});

test("concurrent saveProgress calls serialize writes and await their own checkpoint", async () => {
  const gates = [deferred(), deferred(), deferred()];
  const saved = [];
  const writes = [];
  let calls = 0;
  let activeWrites = 0;
  let maximumWrites = 0;
  const result = observe(runExportBatches([0, 1, 2], {
    concurrency: 3,
    async runBatch(batch, saveProgress) {
      await saveProgress();
      saved.push(batch);
    },
    async checkpoint() {
      const index = calls++;
      activeWrites += 1;
      maximumWrites = Math.max(maximumWrites, activeWrites);
      await gates[index].promise;
      writes.push(index);
      activeWrites -= 1;
    },
  }));

  await flush();
  assert.equal(calls, 1);
  assert.deepEqual(saved, []);
  for (let index = 0; index < gates.length; index += 1) {
    assert.equal(result.status, "pending");
    gates[index].resolve();
    await flush();
    assert.deepEqual(saved, [0, 1, 2].slice(0, index + 1));
    assert.equal(calls, Math.min(index + 2, gates.length));
  }
  await result.done;
  assert.equal(result.status, "fulfilled");
  assert.equal(maximumWrites, 1);
  assert.deepEqual(writes, [0, 1, 2]);
});

test("timeouts and server failures preserve partial checkpoints and allow later batches", async () => {
  const checkpointGate = deferred();
  const timeoutGate = deferred();
  const timeout = Object.assign(new Error("Image export timed out"), { transient: true });
  const unavailable = Object.assign(new Error("Figma HTTP 503"), { transient: true });
  const started = [];
  const downloaded = new Set();
  const snapshots = [];
  let checkpointCalls = 0;
  const result = observe(runExportBatches(["success", "timeout", "partial", "later"], {
    concurrency: 2,
    async runBatch(batch, saveProgress) {
      started.push(batch);
      if (batch === "timeout") {
        await timeoutGate.promise;
        throw timeout;
      }
      downloaded.add(batch);
      await saveProgress();
      if (batch === "partial") throw unavailable;
    },
    async checkpoint() {
      checkpointCalls += 1;
      const snapshot = [...downloaded];
      await checkpointGate.promise;
      snapshots.push(snapshot);
    },
  }));

  await flush();
  assert.deepEqual(started, ["success", "timeout"]);
  assert.equal(checkpointCalls, 1);
  timeoutGate.resolve();
  await flush();
  assert.deepEqual(started, ["success", "timeout", "partial"]);
  assert.equal(checkpointCalls, 1);
  assert.equal(result.status, "pending");

  checkpointGate.resolve();
  await result.done;
  assertFailures(result, [timeout, unavailable]);
  assert.deepEqual(started, ["success", "timeout", "partial", "later"]);
  assert.equal(checkpointCalls, 3);
  assert.equal(snapshots.length, 3);
  assert.deepEqual(snapshots.at(-1), ["success", "partial", "later"]);
});

for (const status of [429, 401, 403]) {
  test(`fatal HTTP ${status} stops new batches but drains in-flight downloads and progress`, async () => {
    const fatalGate = deferred();
    const downloadGate = deferred();
    const checkpointGate = deferred();
    const fatal = Object.assign(new Error(`Figma HTTP ${status}`), { status });
    const started = [];
    let checkpointStarted = false;
    let checkpointSaved = false;
    let downloadFinished = false;
    const result = observe(runExportBatches(["fatal", "in-flight", "queued"], {
      concurrency: 2,
      async runBatch(batch, saveProgress) {
        started.push(batch);
        if (batch === "fatal") {
          await fatalGate.promise;
          throw fatal;
        }
        await downloadGate.promise;
        downloadFinished = true;
        await saveProgress();
      },
      async checkpoint() {
        checkpointStarted = true;
        await checkpointGate.promise;
        checkpointSaved = true;
      },
    }));

    await flush();
    assert.deepEqual(started, ["fatal", "in-flight"]);
    fatalGate.resolve();
    await flush();
    assert.equal(result.status, "pending");
    assert.equal(downloadFinished, false);
    assert.deepEqual(started, ["fatal", "in-flight"]);
    downloadGate.resolve();
    await flush();
    assert.equal(downloadFinished, true);
    assert.equal(checkpointStarted, true);
    assert.equal(checkpointSaved, false);
    assert.equal(result.status, "pending");
    checkpointGate.resolve();
    await result.done;

    assertFailures(result, [fatal]);
    assert.equal(checkpointSaved, true);
    assert.deepEqual(started, ["fatal", "in-flight"]);
  });
}

test("an early fatal response stops scheduling while its paired request still runs", async () => {
  const fatalResponseGate = deferred();
  const pairedRequestGate = deferred();
  const otherWorkerGate = deferred();
  const fatal = new Error("Figma HTTP 429");
  const started = [];
  let pairedRequestFinished = false;
  const result = observe(runExportBatches(["fatal-pair", "other", "queued"], {
    concurrency: 2,
    async runBatch(batch, saveProgress, stopScheduling) {
      started.push(batch);
      if (batch === "fatal-pair") {
        await fatalResponseGate.promise;
        stopScheduling();
        await pairedRequestGate.promise;
        pairedRequestFinished = true;
        throw fatal;
      }
      await otherWorkerGate.promise;
      await saveProgress();
    },
  }));

  await flush();
  fatalResponseGate.resolve();
  await flush();
  otherWorkerGate.resolve();
  await flush();
  assert.deepEqual(started, ["fatal-pair", "other"]);
  assert.equal(pairedRequestFinished, false);
  assert.equal(result.status, "pending");
  pairedRequestGate.resolve();
  await result.done;
  assertFailures(result, [fatal]);
  assert.equal(pairedRequestFinished, true);
  assert.deepEqual(started, ["fatal-pair", "other"]);
});

test("concurrent failures are all observed, including rejection after a fatal failure", async () => {
  const firstGate = deferred();
  const secondGate = deferred();
  const fatal = new Error("Collector number mismatch");
  const timeout = Object.assign(new Error("Late image timeout"), { transient: true });
  const started = [];
  const result = observe(runExportBatches([0, 1, 2], {
    concurrency: 2,
    async runBatch(batch) {
      started.push(batch);
      await (batch === 0 ? firstGate.promise : secondGate.promise);
      throw batch === 0 ? fatal : timeout;
    },
  }));

  await flush();
  firstGate.resolve();
  await flush();
  assert.equal(result.status, "pending");
  secondGate.resolve();
  await result.done;
  await flush();
  assertFailures(result, [fatal, timeout]);
  assert.deepEqual(started, [0, 1]);
});

test("a fatal validation failure remains visible after an earlier transient timeout", async () => {
  const timeout = Object.assign(new Error("Image export timed out"), { name: "TimeoutError" });
  const fatal = new Error("Collector number mismatch for reef-017");
  const started = [];
  const result = observe(runExportBatches(["timeout", "invalid-artwork", "queued"], {
    async runBatch(batch) {
      started.push(batch);
      if (batch === "timeout") throw timeout;
      if (batch === "invalid-artwork") throw fatal;
      assert.fail("A batch was started after fatal artwork validation failed");
    },
  }));

  await result.done;
  assertFailures(result, [timeout, fatal]);
  assert.ok(result.error.message.includes(timeout.message));
  assert.ok(result.error.message.includes(fatal.message));
  assert.deepEqual(started, ["timeout", "invalid-artwork"]);
});

test("failure summaries deduplicate nested leaf messages and redact HTTP image URLs", async () => {
  const serverFailure = () => Object.assign(new Error("Figma HTTP 503"), { status: 503 });
  const first = serverFailure();
  const second = serverFailure();
  const timeout = Object.assign(
    new Error("Image export timed out at https://private-assets.example/front.png?signature=private-front-signature"),
    { name: "TimeoutError" },
  );
  const invalidArtwork = new Error(
    "Image dimensions invalid at http://private-assets.example/back.png?token=private-back-token",
  );
  const nested = new AggregateError([
    serverFailure(),
    new AggregateError([timeout, invalidArtwork], "Paired export request failed"),
  ], "Batch export failed");
  const failures = [first, second, nested];
  const started = [];
  const result = observe(runExportBatches([0, 1, 2, 3], {
    async runBatch(batch) {
      started.push(batch);
      if (batch < failures.length) throw failures[batch];
      assert.fail("A batch was started after a nested fatal validation failure");
    },
  }));

  await result.done;
  assertFailures(result, failures);
  assert.deepEqual(started, [0, 1, 2]);
  const summary = result.error.message;
  for (const message of ["Figma HTTP 503", "Image export timed out at", "Image dimensions invalid at"]) {
    assert.equal(summary.split(message).length - 1, 1, `${message} should appear exactly once`);
  }
  assert.doesNotMatch(summary, /https?:\/\//i);
  for (const privateValue of ["private-assets.example", "front.png", "back.png", "private-front-signature", "private-back-token"]) {
    assert.ok(!summary.includes(privateValue), `${privateValue} must not be in the failure summary`);
  }
});

test("a failed progress write does not discard another already queued checkpoint", async () => {
  const checkpointGate = deferred();
  const diskError = new Error("Progress write failed");
  const started = [];
  let checkpointCalls = 0;
  let secondCheckpointSaved = false;
  const result = observe(runExportBatches([0, 1, 2], {
    concurrency: 2,
    async runBatch(batch, saveProgress) {
      started.push(batch);
      await saveProgress();
    },
    async checkpoint() {
      checkpointCalls += 1;
      if (checkpointCalls === 1) {
        await checkpointGate.promise;
        throw diskError;
      }
      secondCheckpointSaved = true;
    },
  }));

  await flush();
  assert.equal(checkpointCalls, 1);
  checkpointGate.resolve();
  await result.done;
  await flush();
  assertFailures(result, [diskError]);
  assert.equal(checkpointCalls, 2);
  assert.equal(secondCheckpointSaved, true);
  assert.deepEqual(started, [0, 1]);
});
