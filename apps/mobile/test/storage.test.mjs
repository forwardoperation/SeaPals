import { test } from "node:test";
import assert from "node:assert/strict";
import { createDurableStorage, parseStoredValues } from "../src/storage.mjs";

test("native writes serialize changes that arrive during a pending save", async () => {
  let release;
  const saves = [];
  const storage = createDurableStorage({}, async (snapshot) => {
    saves.push(snapshot);
    if (saves.length === 1) await new Promise((resolve) => { release = resolve; });
  });
  storage.setItem("match", "turn one");
  const saving = storage.flush();
  storage.setItem("match", "turn two");
  storage.setItem("collection", "new card");
  release();
  await saving;
  assert.equal(saves.length, 2);
  assert.deepEqual(parseStoredValues(saves.at(-1)), { match: "turn two", collection: "new card" });
});

test("failed native writes remain retryable and report recovery", async () => {
  let fail = true;
  let persisted;
  const storage = createDurableStorage({ match: "old" }, async (snapshot) => {
    if (fail) throw new Error("Device storage full");
    persisted = snapshot;
  });
  const observed = [];
  storage.subscribe((error) => observed.push(error?.message ?? null));
  storage.setItem("match", "latest");
  await assert.rejects(storage.flush(), /storage full/);
  assert.equal(storage.getItem("match"), "latest");
  assert.equal(storage.getError().message, "Device storage full");
  fail = false;
  await storage.flush();
  assert.equal(parseStoredValues(persisted).match, "latest");
  assert.equal(storage.getError(), null);
  assert.deepEqual(observed, ["Device storage full", null]);
});

test("deletions persist and identical saves do not write repeatedly", async () => {
  const saves = [];
  const storage = createDurableStorage({ match: "old", lessons: "done" }, async (snapshot) => saves.push(snapshot));
  storage.setItem("match", "old");
  await storage.flush();
  assert.equal(saves.length, 0);
  storage.removeItem("match");
  await storage.flush();
  assert.deepEqual(parseStoredValues(saves[0]), { lessons: "done" });
});

test("malformed native saves fail closed instead of resetting progress", () => {
  assert.deepEqual(parseStoredValues(null), {});
  for (const raw of ["broken", "null", '{"version":2,"values":{}}', '{"version":1,"values":{"match":{}}}']) {
    assert.throws(() => parseStoredValues(raw));
  }
});
