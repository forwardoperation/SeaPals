import assert from "node:assert/strict";
import test from "node:test";

import { createInitialAdventureSave } from "../../../adventure/adventureProgression.mjs";
import {
  ADVENTURE_CLOUD_SAVE_MAX_REQUEST_BYTES,
  createAdventureSavesHandlers,
  hashCanonicalAdventureSave,
} from "./handler.mjs";

const ORIGIN = "https://seapalstcg.com";
const USER_ID = "6df90d1e-d669-4a4a-8269-fb375862c43a";

function row(profileId, overrides = {}) {
  const payload = overrides.payload === undefined
    ? createInitialAdventureSave(profileId)
    : overrides.payload;
  return {
    user_id: USER_ID,
    profile_id: profileId,
    payload,
    schema_version: 4,
    cloud_version: 1,
    canonical_hash: payload ? hashCanonicalAdventureSave(payload) : "0".repeat(64),
    metadata: { saveKind: "manual", checkpointId: null },
    deleted: false,
    created_at: "2026-08-12T12:00:00.000Z",
    updated_at: "2026-08-12T12:00:00.000Z",
    ...overrides,
  };
}

class MemoryAdventureSaves {
  constructor(rows = []) {
    this.rows = new Map(rows.map((value) => [value.profile_id, structuredClone(value)]));
    this.operations = [];
    this.race = null;
  }

  client({ claims = { sub: USER_ID, role: "authenticated" }, claimsError = null } = {}) {
    const memory = this;
    return {
      auth: {
        async getClaims() {
          return { data: { claims }, error: claimsError };
        },
      },
      from(table) {
        assert.equal(table, "adventure_saves");
        return memory.query();
      },
    };
  }

  query() {
    const memory = this;
    const state = { action: null, value: null, filters: [] };
    const query = {
      select() {
        if (!state.action) state.action = "select";
        return query;
      },
      insert(value) {
        state.action = "insert";
        state.value = structuredClone(value);
        return query;
      },
      update(value) {
        state.action = "update";
        state.value = structuredClone(value);
        return query;
      },
      eq(field, value) {
        state.filters.push([field, value]);
        return query;
      },
      order(field, options) {
        memory.operations.push({ ...state, order: [field, options] });
        const data = [...memory.rows.values()]
          .filter((value) => state.filters.every(([key, expected]) => value[key] === expected))
          .sort((a, b) => a.profile_id.localeCompare(b.profile_id));
        return Promise.resolve({ data: structuredClone(data), error: null });
      },
      single() {
        memory.operations.push(structuredClone(state));
        if (state.action !== "insert") throw new Error("unexpected single");
        if (memory.rows.has(state.value.profile_id)) {
          return Promise.resolve({ data: null, error: { code: "23505" } });
        }
        const created = row(state.value.profile_id, state.value);
        memory.rows.set(created.profile_id, created);
        return Promise.resolve({ data: structuredClone(created), error: null });
      },
      maybeSingle() {
        memory.operations.push(structuredClone(state));
        const profileId = state.filters.find(([key]) => key === "profile_id")?.[1];
        if (state.action === "select") {
          const found = memory.rows.get(profileId) ?? null;
          return Promise.resolve({ data: structuredClone(found), error: null });
        }
        if (state.action !== "update") throw new Error("unexpected maybeSingle");
        if (memory.race) {
          memory.rows.set(profileId, structuredClone(memory.race));
          memory.race = null;
          return Promise.resolve({ data: null, error: null });
        }
        const current = memory.rows.get(profileId);
        const matches = current
          && state.filters.every(([key, expected]) => current[key] === expected);
        if (!matches) return Promise.resolve({ data: null, error: null });
        const updated = {
          ...current,
          ...state.value,
          updated_at: "2026-08-12T13:00:00.000Z",
        };
        memory.rows.set(profileId, updated);
        return Promise.resolve({ data: structuredClone(updated), error: null });
      },
    };
    return query;
  }
}

function handlers({
  storage = new MemoryAdventureSaves(),
  claims,
  claimsError,
  authorization = { version: 1 },
  getFamilyAccount,
} = {}) {
  return createAdventureSavesHandlers({
    createClient: async () => storage.client({ claims, claimsError }),
    getFamilyAccount: getFamilyAccount ?? (async (userId) => ({
      user: { id: userId },
      authorization,
    })),
    logger: { error() {} },
  });
}

function request(method, body, options = {}) {
  const headers = new Headers({
    Origin: options.origin ?? ORIGIN,
    "Sec-Fetch-Site": options.fetchSite ?? "same-origin",
    "Content-Type": options.contentType ?? "application/json",
  });
  if (options.contentLength !== undefined) {
    headers.set("Content-Length", String(options.contentLength));
  }
  if (options.expectedAccountId !== undefined) {
    headers.set("X-SeaPals-Account-Id", options.expectedAccountId);
  }
  return new Request(`${ORIGIN}/api/adventure/saves`, {
    method,
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function saveRequest(profileId, expectedCloudVersion, save, overrides = {}) {
  return {
    profileId,
    expectedCloudVersion,
    save,
    metadata: { saveKind: "autosave", checkpointId: "exploration" },
    ...overrides,
  };
}

test("canonical adventure hashes recursively sort keys and use SHA-256", () => {
  assert.equal(
    hashCanonicalAdventureSave({ z: [{ b: 2, a: 1 }], a: "reef" }),
    hashCanonicalAdventureSave({ a: "reef", z: [{ a: 1, b: 2 }] }),
  );
  assert.equal(
    hashCanonicalAdventureSave({ a: 1 }),
    "015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862",
  );
});

test("GET requires verified authenticated claims and approved family account", async () => {
  const unsigned = handlers({ claims: null });
  const unsignedResponse = await unsigned.GET(new Request(`${ORIGIN}/api/adventure/saves`));
  assert.equal(unsignedResponse.status, 401);
  assert.equal((await unsignedResponse.json()).error.code, "SIGN_IN_REQUIRED");

  const unapproved = handlers({ authorization: null });
  const unapprovedResponse = await unapproved.GET(new Request(`${ORIGIN}/api/adventure/saves`));
  assert.equal(unapprovedResponse.status, 403);
  assert.equal((await unapprovedResponse.json()).error.code, "FAMILY_ACCOUNT_REQUIRED");
});

test("GET returns only caller records with camel-case API fields", async () => {
  const storage = new MemoryAdventureSaves([
    row("profile-2", { cloud_version: 3 }),
    row("profile-1", {
      payload: null,
      deleted: true,
      metadata: { saveKind: "delete", checkpointId: "profile-deleted" },
    }),
  ]);
  const response = await handlers({ storage }).GET(
    new Request(`${ORIGIN}/api/adventure/saves`),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.profiles.map((profile) => profile.profileId), [
    "profile-1",
    "profile-2",
  ]);
  assert.equal(body.profiles[0].payload, null);
  assert.equal("userId" in body.profiles[0], false);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(response.headers.get("vary"), "Cookie");
  assert.ok(storage.operations[0].filters.some(
    ([field, value]) => field === "user_id" && value === USER_ID,
  ));
});

test("PUT rejects cross-origin mutations before authentication or storage", async () => {
  let createCalls = 0;
  const api = createAdventureSavesHandlers({
    createClient: async () => {
      createCalls += 1;
      throw new Error("must not authenticate");
    },
    getFamilyAccount: async () => ({ authorization: {} }),
    logger: { error() {} },
  });
  const response = await api.PUT(request(
    "PUT",
    saveRequest("profile-1", 0, createInitialAdventureSave("profile-1")),
    { origin: "https://attacker.example", fetchSite: "cross-site" },
  ));
  assert.equal(response.status, 403);
  assert.equal(createCalls, 0);
});

test("mutations reject a rendered account that no longer matches the authenticated session", async () => {
  const storage = new MemoryAdventureSaves();
  const response = await handlers({ storage }).PUT(request(
    "PUT",
    saveRequest("profile-1", 0, createInitialAdventureSave("profile-1")),
    { expectedAccountId: "different-account" },
  ));
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.error.code, "ACCOUNT_SESSION_CHANGED");
  assert.equal(storage.rows.size, 0);
  assert.equal(storage.operations.length, 0);
});

test("PUT enforces JSON and UTF-8 request limits", async () => {
  const api = handlers();
  const wrongType = await api.PUT(request("PUT", "{}", { contentType: "text/plain" }));
  assert.equal(wrongType.status, 415);

  const declaredLarge = await api.PUT(request("PUT", "{}", {
    contentLength: ADVENTURE_CLOUD_SAVE_MAX_REQUEST_BYTES + 1,
  }));
  assert.equal(declaredLarge.status, 413);

  const large = `"${"ðŸ ".repeat(Math.ceil(ADVENTURE_CLOUD_SAVE_MAX_REQUEST_BYTES / 4))}"`;
  assert.ok(new TextEncoder().encode(large).byteLength > ADVENTURE_CLOUD_SAVE_MAX_REQUEST_BYTES);
  const measuredLarge = await api.PUT(request("PUT", large));
  assert.equal(measuredLarge.status, 413);
});

test("PUT validates profile IDs, versions, bounded metadata, and profile matches", async () => {
  const api = handlers();
  const validSave = createInitialAdventureSave("profile-1");
  const cases = [
    saveRequest("profile-4", 0, validSave),
    saveRequest("profile-1", -1, validSave),
    saveRequest("profile-1", Number.MAX_SAFE_INTEGER, validSave),
    saveRequest("profile-1", 0, validSave, {
      metadata: { saveKind: "root", checkpointId: null },
    }),
    saveRequest("profile-1", 0, validSave, {
      metadata: { saveKind: "manual", checkpointId: "x".repeat(193) },
    }),
  ];
  for (const value of cases) {
    const response = await api.PUT(request("PUT", value));
    assert.equal(response.status, 422);
  }

  const mismatched = await api.PUT(request(
    "PUT",
    saveRequest("profile-1", 0, createInitialAdventureSave("profile-2")),
  ));
  assert.equal(mismatched.status, 422);
  assert.equal((await mismatched.json()).error.code, "INVALID_SAVE_DATA");
});

test("PUT migrates older saves, generates its own canonical hash, and inserts version one", async () => {
  const storage = new MemoryAdventureSaves();
  const api = handlers({ storage });
  const legacy = {
    schemaVersion: 0,
    profileId: "profile-1",
    sceneId: "elverson-town",
    position: { x: 40, y: 50 },
    facing: "down",
    defeated: [],
  };
  const response = await api.PUT(request("PUT", {
    ...saveRequest("profile-1", 0, legacy),
    canonicalHash: "attacker-controlled",
  }));

  // Strict envelopes reject client hashes; retry without it.
  assert.equal(response.status, 422);
  const accepted = await api.PUT(request("PUT", saveRequest("profile-1", 0, legacy)));
  const body = await accepted.json();
  assert.equal(accepted.status, 201);
  assert.equal(body.applied, true);
  assert.equal(body.idempotent, false);
  assert.equal(body.record.cloudVersion, 1);
  assert.equal(body.record.schemaVersion, 4);
  assert.equal(body.record.payload.schemaVersion, 4);
  assert.equal(body.record.canonicalHash, hashCanonicalAdventureSave(body.record.payload));
  assert.match(body.record.canonicalHash, /^[0-9a-f]{64}$/);
});

test("PUT updates atomically only at expected cloud version", async () => {
  const original = row("profile-1", { cloud_version: 4 });
  const storage = new MemoryAdventureSaves([original]);
  const next = createInitialAdventureSave("profile-1");
  next.playtimeSeconds = 20;

  const response = await handlers({ storage }).PUT(request(
    "PUT",
    saveRequest("profile-1", 4, next),
  ));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.record.cloudVersion, 5);
  assert.equal(body.record.payload.playtimeSeconds, 20);
  const update = storage.operations.find((operation) => operation.action === "update");
  assert.ok(update.filters.some(
    ([field, value]) => field === "cloud_version" && value === 4,
  ));
  assert.ok(update.filters.some(
    ([field, value]) => field === "user_id" && value === USER_ID,
  ));
});

test("stale PUT returns current remote record with 409", async () => {
  const current = row("profile-1", { cloud_version: 9 });
  const storage = new MemoryAdventureSaves([current]);
  const next = createInitialAdventureSave("profile-1");
  next.playtimeSeconds = 40;
  const response = await handlers({ storage }).PUT(request(
    "PUT",
    saveRequest("profile-1", 8, next),
  ));
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.conflict, true);
  assert.equal(body.error.code, "CLOUD_VERSION_CONFLICT");
  assert.equal(body.record.cloudVersion, 9);
});

test("same canonical PUT retry is idempotent even with an old expected version", async () => {
  const save = createInitialAdventureSave("profile-2");
  const current = row("profile-2", {
    payload: save,
    cloud_version: 6,
    canonical_hash: hashCanonicalAdventureSave(save),
  });
  const storage = new MemoryAdventureSaves([current]);
  const response = await handlers({ storage }).PUT(request(
    "PUT",
    saveRequest("profile-2", 5, structuredClone(save)),
  ));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.applied, false);
  assert.equal(body.idempotent, true);
  assert.equal(body.record.cloudVersion, 6);
  assert.equal(storage.operations.some((operation) => operation.action === "update"), false);
});

test("a lost PUT race resolves to idempotence or a conflict after rereading", async () => {
  const original = row("profile-1", { cloud_version: 1 });
  const save = createInitialAdventureSave("profile-1");
  save.playtimeSeconds = 30;
  const winning = row("profile-1", {
    payload: save,
    cloud_version: 2,
    canonical_hash: hashCanonicalAdventureSave(save),
  });
  const storage = new MemoryAdventureSaves([original]);
  storage.race = winning;
  const response = await handlers({ storage }).PUT(request(
    "PUT",
    saveRequest("profile-1", 1, save),
  ));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).idempotent, true);
});

test("DELETE creates a null-payload tombstone and blocks stale resurrection", async () => {
  const storage = new MemoryAdventureSaves();
  const api = handlers({ storage });
  const deleted = await api.DELETE(request("DELETE", {
    profileId: "profile-3",
    expectedCloudVersion: 0,
    metadata: { saveKind: "delete", checkpointId: "profile-deleted" },
  }));
  const tombstone = await deleted.json();
  assert.equal(deleted.status, 201);
  assert.equal(tombstone.record.deleted, true);
  assert.equal(tombstone.record.payload, null);
  assert.equal(tombstone.record.cloudVersion, 1);

  const staleSave = createInitialAdventureSave("profile-3");
  const resurrection = await api.PUT(request(
    "PUT",
    saveRequest("profile-3", 0, staleSave),
  ));
  assert.equal(resurrection.status, 409);
  assert.equal((await resurrection.json()).record.deleted, true);
});

test("DELETE updates by CAS and repeated deletion is idempotent", async () => {
  const storage = new MemoryAdventureSaves([row("profile-1", { cloud_version: 4 })]);
  const api = handlers({ storage });
  const deleted = await api.DELETE(request("DELETE", {
    profileId: "profile-1",
    expectedCloudVersion: 4,
    metadata: { saveKind: "delete", checkpointId: "profile-deleted" },
  }));
  assert.equal(deleted.status, 200);
  assert.equal((await deleted.json()).record.cloudVersion, 5);

  const retry = await api.DELETE(request("DELETE", {
    profileId: "profile-1",
    expectedCloudVersion: 4,
    metadata: { saveKind: "delete", checkpointId: "profile-deleted" },
  }));
  const body = await retry.json();
  assert.equal(retry.status, 200);
  assert.equal(body.idempotent, true);
  assert.equal(body.record.payload, null);
  assert.equal(body.record.cloudVersion, 5);
});

test("DELETE rejects live save kinds and stale versions return the live remote", async () => {
  const storage = new MemoryAdventureSaves([row("profile-2", { cloud_version: 3 })]);
  const api = handlers({ storage });
  const invalid = await api.DELETE(request("DELETE", {
    profileId: "profile-2",
    expectedCloudVersion: 3,
    metadata: { saveKind: "manual", checkpointId: "profile-deleted" },
  }));
  assert.equal(invalid.status, 422);

  const conflict = await api.DELETE(request("DELETE", {
    profileId: "profile-2",
    expectedCloudVersion: 2,
    metadata: { saveKind: "delete", checkpointId: "profile-deleted" },
  }));
  const body = await conflict.json();
  assert.equal(conflict.status, 409);
  assert.equal(body.record.cloudVersion, 3);
  assert.equal(body.record.deleted, false);
});

test("DELETE enforces same-origin requests independently of PUT", async () => {
  const storage = new MemoryAdventureSaves([row("profile-1")]);
  const response = await handlers({ storage }).DELETE(request("DELETE", {
    profileId: "profile-1",
    expectedCloudVersion: 1,
    metadata: { saveKind: "delete", checkpointId: "profile-deleted" },
  }, {
    origin: "https://attacker.example",
    fetchSite: "cross-site",
  }));
  assert.equal(response.status, 403);
  assert.equal(storage.operations.length, 0);
});
