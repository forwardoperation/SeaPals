import assert from "node:assert/strict";
import test from "node:test";
import { createAdventureCloudSaveClient } from "./adventureCloudClient.mjs";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("cloud client lists account save records without caching", async () => {
  const calls = [];
  const client = createAdventureCloudSaveClient({
    fetchImpl: async (...args) => {
      calls.push(args);
      return jsonResponse({ ok: true, profiles: [{ profileId: "profile-1" }] });
    },
  });

  assert.deepEqual(await client.listProfiles(), [{ profileId: "profile-1" }]);
  assert.equal(calls[0][0], "/api/adventure/saves");
  assert.equal(calls[0][1].method, "GET");
  assert.equal(calls[0][1].cache, "no-store");
  assert.equal(calls[0][1].credentials, "same-origin");
});

test("cloud client sends compare-and-swap save metadata", async () => {
  let request;
  const client = createAdventureCloudSaveClient({
    expectedAccountId: "account-a",
    fetchImpl: async (_url, options) => {
      request = options;
      return jsonResponse({ ok: true, record: { cloudVersion: 4 } });
    },
  });
  const save = { profileId: "profile-2" };
  const result = await client.saveProfile({
    profileId: "profile-2",
    expectedCloudVersion: 3,
    save,
    saveKind: "manual",
    checkpointId: "pause-menu",
  });

  assert.equal(result.record.cloudVersion, 4);
  assert.equal(request.method, "PUT");
  assert.equal(request.headers["X-SeaPals-Account-Id"], "account-a");
  assert.deepEqual(JSON.parse(request.body), {
    profileId: "profile-2",
    expectedCloudVersion: 3,
    save,
    metadata: { saveKind: "manual", checkpointId: "pause-menu" },
  });
});

test("cloud client returns version conflicts for explicit resolution", async () => {
  const remote = { profileId: "profile-1", cloudVersion: 9, payload: {} };
  const client = createAdventureCloudSaveClient({
    fetchImpl: async () => jsonResponse({
      ok: false,
      conflict: true,
      error: { code: "CLOUD_VERSION_CONFLICT", message: "stale" },
      record: remote,
    }, 409),
  });

  const result = await client.deleteProfile({
    profileId: "profile-1",
    expectedCloudVersion: 8,
  });
  assert.equal(result.conflict, true);
  assert.deepEqual(result.record, remote);
});

test("cloud client reports network failures as retryable offline saves", async () => {
  const client = createAdventureCloudSaveClient({
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });

  await assert.rejects(
    client.listProfiles(),
    (error) => error.code === "CLOUD_SAVE_OFFLINE" && error.retryable === true,
  );
});

test("cloud client rejects malformed success responses", async () => {
  const client = createAdventureCloudSaveClient({
    fetchImpl: async () => jsonResponse({ ok: true }),
  });
  await assert.rejects(
    client.listProfiles(),
    (error) => error.code === "INVALID_CLOUD_RESPONSE",
  );
});
