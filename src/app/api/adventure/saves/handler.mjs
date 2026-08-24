import { createHash } from "node:crypto";

import {
  ADVENTURE_SAVE_SCHEMA_VERSION,
  migrateAdventureSave,
} from "../../../adventure/adventureProgression.mjs";
import { isTrustedSameOriginMutation } from "../../../../lib/sameOriginMutation.mjs";

export const ADVENTURE_CLOUD_SAVE_MAX_REQUEST_BYTES = 256 * 1024;
export const ADVENTURE_CLOUD_SAVE_PROFILE_IDS = Object.freeze([
  "profile-1",
  "profile-2",
  "profile-3",
]);

const PROFILE_ID_SET = new Set(ADVENTURE_CLOUD_SAVE_PROFILE_IDS);
const WRITE_SAVE_KINDS = new Set([
  "manual",
  "autosave",
  "migration",
  "new-game",
]);
const ALL_SAVE_KINDS = new Set([...WRITE_SAVE_KINDS, "delete"]);
const CHECKPOINT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,191}$/;
const RECORD_COLUMNS = [
  "profile_id",
  "payload",
  "schema_version",
  "cloud_version",
  "canonical_hash",
  "metadata",
  "deleted",
  "created_at",
  "updated_at",
].join(",");

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie",
    },
  });
}

function errorResponse(status, code, message) {
  return json({
    ok: false,
    error: { code, message },
  }, status);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashCanonicalAdventureSave(save) {
  return createHash("sha256").update(canonicalJson(save), "utf8").digest("hex");
}

function tombstoneHash(profileId) {
  return createHash("sha256")
    .update(canonicalJson({ deleted: true, profileId }), "utf8")
    .digest("hex");
}

function validCloudVersion(value) {
  return Number.isSafeInteger(value)
    && value >= 0
    && value < Number.MAX_SAFE_INTEGER;
}

function validateProfileId(value) {
  return typeof value === "string" && PROFILE_ID_SET.has(value);
}

function normalizeMetadata(value, { deletion = false } = {}) {
  const metadata = value === undefined ? {} : value;
  if (!isRecord(metadata)) {
    throw new TypeError("Save metadata must be a JSON object.");
  }
  const allowed = new Set(["saveKind", "checkpointId"]);
  if (Object.keys(metadata).some((key) => !allowed.has(key))) {
    throw new TypeError("Save metadata contains an unsupported field.");
  }

  const defaultKind = deletion ? "delete" : "manual";
  const saveKind = metadata.saveKind ?? defaultKind;
  if (!ALL_SAVE_KINDS.has(saveKind)) {
    throw new TypeError("Save metadata has an unsupported save kind.");
  }
  if (deletion ? saveKind !== "delete" : !WRITE_SAVE_KINDS.has(saveKind)) {
    throw new TypeError(
      deletion
        ? "Deleted profiles must use the delete save kind."
        : "Live profiles cannot use the delete save kind.",
    );
  }

  const checkpointId = metadata.checkpointId ?? null;
  if (checkpointId !== null && (
    typeof checkpointId !== "string"
    || !CHECKPOINT_ID_PATTERN.test(checkpointId)
  )) {
    throw new TypeError(
      "Save checkpoint IDs must be 1-192 safe identifier characters.",
    );
  }
  return { saveKind, checkpointId };
}

function formatRecord(row) {
  if (!row) return null;
  return {
    profileId: row.profile_id,
    cloudVersion: row.cloud_version,
    schemaVersion: row.schema_version,
    canonicalHash: row.canonical_hash,
    deleted: row.deleted === true,
    payload: row.deleted === true ? null : row.payload,
    metadata: isRecord(row.metadata) ? row.metadata : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function readLimitedJson(request) {
  const rawLength = request.headers.get("content-length");
  if (rawLength !== null && /^\d+$/.test(rawLength.trim())) {
    const contentLength = Number(rawLength);
    if (Number.isFinite(contentLength)
      && contentLength > ADVENTURE_CLOUD_SAVE_MAX_REQUEST_BYTES) {
      return { tooLarge: true, value: null };
    }
  }

  if (!request.body) return { tooLarge: false, value: null, malformed: true };
  const reader = request.body.getReader();
  const chunks = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > ADVENTURE_CLOUD_SAVE_MAX_REQUEST_BYTES) {
        await reader.cancel().catch(() => {});
        return { tooLarge: true, value: null };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { tooLarge: false, value: JSON.parse(text), malformed: false };
  } catch {
    return { tooLarge: false, value: null, malformed: true };
  }
}

async function authenticate({ createClient, getFamilyAccount }) {
  let client;
  let claimsResult;
  try {
    client = await createClient();
    claimsResult = await client.auth.getClaims();
  } catch {
    return {
      response: errorResponse(
        503,
        "ACCOUNT_VERIFICATION_UNAVAILABLE",
        "SeaPals could not verify the signed-in account.",
      ),
    };
  }

  const claims = claimsResult?.data?.claims;
  if (claimsResult?.error || !claims?.sub || claims.role !== "authenticated") {
    return {
      response: errorResponse(401, "SIGN_IN_REQUIRED", "Sign in is required."),
    };
  }

  let account;
  try {
    account = await getFamilyAccount(claims.sub);
  } catch {
    return {
      response: errorResponse(
        503,
        "FAMILY_ACCOUNT_UNAVAILABLE",
        "The family account is temporarily unavailable.",
      ),
    };
  }
  if (!account?.authorization) {
    return {
      response: errorResponse(
        403,
        "FAMILY_ACCOUNT_REQUIRED",
        "An approved family account is required.",
      ),
    };
  }

  return { client, userId: claims.sub, response: null };
}

async function fetchCurrent(client, userId, profileId) {
  return client
    .from("adventure_saves")
    .select(RECORD_COLUMNS)
    .eq("user_id", userId)
    .eq("profile_id", profileId)
    .maybeSingle();
}

function conflictResponse(row) {
  return json({
    ok: false,
    conflict: true,
    error: {
      code: "CLOUD_VERSION_CONFLICT",
      message: "This profile changed on another device.",
    },
    record: formatRecord(row),
  }, 409);
}

function successResponse(row, { applied, idempotent }) {
  return json({
    ok: true,
    applied,
    idempotent,
    record: formatRecord(row),
  }, applied && row?.cloud_version === 1 ? 201 : 200);
}

function expectedAccountMatches(request, userId) {
  const expectedAccountId = request.headers.get("x-seapals-account-id");
  return expectedAccountId === null || expectedAccountId === userId;
}

async function resolveMutationRace({
  client,
  userId,
  profileId,
  canonicalHash,
  deletion,
  logger,
}) {
  let latest;
  try {
    latest = await fetchCurrent(client, userId, profileId);
  } catch (error) {
    logger?.error?.("Adventure cloud-save conflict lookup failed", error);
    return errorResponse(
      503,
      "CLOUD_SAVE_UNAVAILABLE",
      "Cloud saves are temporarily unavailable.",
    );
  }
  if (latest.error) {
    logger?.error?.("Adventure cloud-save conflict lookup failed", latest.error);
    return errorResponse(
      503,
      "CLOUD_SAVE_UNAVAILABLE",
      "Cloud saves are temporarily unavailable.",
    );
  }
  if (
    latest.data
    && (
      (deletion && latest.data.deleted === true)
      || (
        !deletion
        && latest.data.deleted !== true
        && latest.data.canonical_hash === canonicalHash
      )
    )
  ) {
    return successResponse(latest.data, { applied: false, idempotent: true });
  }
  return conflictResponse(latest.data);
}

function validateMutationEnvelope(value, { deletion }) {
  if (!isRecord(value)) {
    throw new TypeError("The cloud-save request must be a JSON object.");
  }
  const allowed = new Set(deletion
    ? ["profileId", "expectedCloudVersion", "metadata"]
    : ["profileId", "expectedCloudVersion", "save", "metadata"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new TypeError("The cloud-save request contains an unsupported field.");
  }
  if (!validateProfileId(value.profileId)) {
    throw new TypeError(
      `Profile ID must be one of: ${ADVENTURE_CLOUD_SAVE_PROFILE_IDS.join(", ")}.`,
    );
  }
  if (!validCloudVersion(value.expectedCloudVersion)) {
    throw new TypeError(
      "Expected cloud version must be a non-negative safe integer below the maximum safe integer.",
    );
  }
  return {
    profileId: value.profileId,
    expectedCloudVersion: value.expectedCloudVersion,
    metadata: normalizeMetadata(value.metadata, { deletion }),
  };
}

export function createAdventureSavesHandlers({
  createClient,
  getFamilyAccount,
  isTrustedMutation = isTrustedSameOriginMutation,
  migrateSave = migrateAdventureSave,
  logger = console,
} = {}) {
  if (typeof createClient !== "function") {
    throw new TypeError("createClient must be provided.");
  }
  if (typeof getFamilyAccount !== "function") {
    throw new TypeError("getFamilyAccount must be provided.");
  }
  if (typeof migrateSave !== "function") {
    throw new TypeError("migrateSave must be a function.");
  }

  async function GET(request) {
    const auth = await authenticate({ createClient, getFamilyAccount });
    if (auth.response) return auth.response;
    if (!expectedAccountMatches(request, auth.userId)) {
      return errorResponse(
        409,
        "ACCOUNT_SESSION_CHANGED",
        "The signed-in family account changed before cloud sync finished.",
      );
    }

    try {
      const result = await auth.client
        .from("adventure_saves")
        .select(RECORD_COLUMNS)
        .eq("user_id", auth.userId)
        .order("profile_id", { ascending: true });
      if (result.error) throw result.error;
      return json({
        ok: true,
        profiles: (result.data ?? []).map(formatRecord),
      });
    } catch (error) {
      logger?.error?.("Adventure cloud-save list failed", error);
      return errorResponse(
        503,
        "CLOUD_SAVE_UNAVAILABLE",
        "Cloud saves are temporarily unavailable.",
      );
    }
  }

  async function readMutation(request, { deletion }) {
    if (!isTrustedMutation(request)) {
      return {
        response: errorResponse(
          403,
          "UNTRUSTED_ORIGIN",
          "Cloud saves must be changed from SeaPals.",
        ),
      };
    }
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!/^application\/json(?:\s*;|$)/.test(contentType)) {
      return {
        response: errorResponse(
          415,
          "JSON_REQUIRED",
          "Cloud-save changes must use JSON.",
        ),
      };
    }

    let body;
    try {
      body = await readLimitedJson(request);
    } catch {
      body = { tooLarge: false, malformed: true, value: null };
    }
    if (body.tooLarge) {
      return {
        response: errorResponse(
          413,
          "REQUEST_TOO_LARGE",
          "The cloud-save request is too large.",
        ),
      };
    }
    if (body.malformed) {
      return {
        response: errorResponse(
          400,
          "INVALID_JSON",
          "The cloud-save request is not valid JSON.",
        ),
      };
    }

    try {
      return {
        value: validateMutationEnvelope(body.value, { deletion }),
        raw: body.value,
        response: null,
      };
    } catch (error) {
      return {
        response: errorResponse(
          422,
          "INVALID_CLOUD_SAVE_REQUEST",
          error?.message ?? "The cloud-save request is invalid.",
        ),
      };
    }
  }

  async function PUT(request) {
    const parsed = await readMutation(request, { deletion: false });
    if (parsed.response) return parsed.response;

    const auth = await authenticate({ createClient, getFamilyAccount });
    if (auth.response) return auth.response;
    if (!expectedAccountMatches(request, auth.userId)) {
      return errorResponse(
        409,
        "ACCOUNT_SESSION_CHANGED",
        "The signed-in family account changed before cloud sync finished.",
      );
    }

    let save;
    try {
      save = migrateSave(parsed.raw.save, { profileId: parsed.value.profileId });
      if (save.profileId !== parsed.value.profileId) {
        throw new TypeError(
          `The save belongs to ${String(save.profileId)}, not ${parsed.value.profileId}.`,
        );
      }
    } catch (error) {
      return errorResponse(
        422,
        "INVALID_SAVE_DATA",
        error?.message ?? "The save data could not be validated.",
      );
    }
    const canonicalHash = hashCanonicalAdventureSave(save);
    const { profileId, expectedCloudVersion, metadata } = parsed.value;

    let current;
    try {
      current = await fetchCurrent(auth.client, auth.userId, profileId);
    } catch (error) {
      logger?.error?.("Adventure cloud-save lookup failed", error);
      return errorResponse(503, "CLOUD_SAVE_UNAVAILABLE", "Cloud saves are temporarily unavailable.");
    }
    if (current.error) {
      logger?.error?.("Adventure cloud-save lookup failed", current.error);
      return errorResponse(503, "CLOUD_SAVE_UNAVAILABLE", "Cloud saves are temporarily unavailable.");
    }
    if (
      current.data
      && current.data.deleted !== true
      && current.data.canonical_hash === canonicalHash
    ) {
      return successResponse(current.data, { applied: false, idempotent: true });
    }
    if (
      (current.data && current.data.cloud_version !== expectedCloudVersion)
      || (!current.data && expectedCloudVersion !== 0)
    ) {
      return conflictResponse(current.data);
    }

    const values = {
      payload: save,
      schema_version: ADVENTURE_SAVE_SCHEMA_VERSION,
      canonical_hash: canonicalHash,
      metadata,
      deleted: false,
    };
    try {
      let mutation;
      if (expectedCloudVersion === 0) {
        mutation = await auth.client
          .from("adventure_saves")
          .insert({
            user_id: auth.userId,
            profile_id: profileId,
            cloud_version: 1,
            ...values,
          })
          .select(RECORD_COLUMNS)
          .single();
      } else {
        mutation = await auth.client
          .from("adventure_saves")
          .update({
            cloud_version: expectedCloudVersion + 1,
            ...values,
          })
          .eq("user_id", auth.userId)
          .eq("profile_id", profileId)
          .eq("cloud_version", expectedCloudVersion)
          .select(RECORD_COLUMNS)
          .maybeSingle();
      }
      if (!mutation.error && mutation.data) {
        return successResponse(mutation.data, { applied: true, idempotent: false });
      }
      if (
        mutation.error
        && mutation.error.code !== "23505"
        && mutation.error.code !== "PGRST116"
      ) {
        logger?.error?.("Adventure cloud-save write failed", mutation.error);
        return errorResponse(503, "CLOUD_SAVE_UNAVAILABLE", "The profile could not be saved to the cloud.");
      }
      return resolveMutationRace({
        client: auth.client,
        userId: auth.userId,
        profileId,
        canonicalHash,
        deletion: false,
        logger,
      });
    } catch (error) {
      logger?.error?.("Adventure cloud-save write failed", error);
      return errorResponse(503, "CLOUD_SAVE_UNAVAILABLE", "The profile could not be saved to the cloud.");
    }
  }

  async function DELETE(request) {
    const parsed = await readMutation(request, { deletion: true });
    if (parsed.response) return parsed.response;

    const auth = await authenticate({ createClient, getFamilyAccount });
    if (auth.response) return auth.response;
    if (!expectedAccountMatches(request, auth.userId)) {
      return errorResponse(
        409,
        "ACCOUNT_SESSION_CHANGED",
        "The signed-in family account changed before cloud sync finished.",
      );
    }
    const { profileId, expectedCloudVersion, metadata } = parsed.value;
    const canonicalHash = tombstoneHash(profileId);

    let current;
    try {
      current = await fetchCurrent(auth.client, auth.userId, profileId);
    } catch (error) {
      logger?.error?.("Adventure cloud-save delete lookup failed", error);
      return errorResponse(503, "CLOUD_SAVE_UNAVAILABLE", "Cloud saves are temporarily unavailable.");
    }
    if (current.error) {
      logger?.error?.("Adventure cloud-save delete lookup failed", current.error);
      return errorResponse(503, "CLOUD_SAVE_UNAVAILABLE", "Cloud saves are temporarily unavailable.");
    }
    if (current.data?.deleted === true) {
      return successResponse(current.data, { applied: false, idempotent: true });
    }
    if (
      (current.data && current.data.cloud_version !== expectedCloudVersion)
      || (!current.data && expectedCloudVersion !== 0)
    ) {
      return conflictResponse(current.data);
    }

    const values = {
      payload: null,
      schema_version: ADVENTURE_SAVE_SCHEMA_VERSION,
      canonical_hash: canonicalHash,
      metadata,
      deleted: true,
    };
    try {
      let mutation;
      if (expectedCloudVersion === 0) {
        mutation = await auth.client
          .from("adventure_saves")
          .insert({
            user_id: auth.userId,
            profile_id: profileId,
            cloud_version: 1,
            ...values,
          })
          .select(RECORD_COLUMNS)
          .single();
      } else {
        mutation = await auth.client
          .from("adventure_saves")
          .update({
            cloud_version: expectedCloudVersion + 1,
            ...values,
          })
          .eq("user_id", auth.userId)
          .eq("profile_id", profileId)
          .eq("cloud_version", expectedCloudVersion)
          .select(RECORD_COLUMNS)
          .maybeSingle();
      }
      if (!mutation.error && mutation.data) {
        return successResponse(mutation.data, { applied: true, idempotent: false });
      }
      if (
        mutation.error
        && mutation.error.code !== "23505"
        && mutation.error.code !== "PGRST116"
      ) {
        logger?.error?.("Adventure cloud-save delete failed", mutation.error);
        return errorResponse(503, "CLOUD_SAVE_UNAVAILABLE", "The profile deletion could not be saved to the cloud.");
      }
      return resolveMutationRace({
        client: auth.client,
        userId: auth.userId,
        profileId,
        canonicalHash,
        deletion: true,
        logger,
      });
    } catch (error) {
      logger?.error?.("Adventure cloud-save delete failed", error);
      return errorResponse(503, "CLOUD_SAVE_UNAVAILABLE", "The profile deletion could not be saved to the cloud.");
    }
  }

  return Object.freeze({ GET, PUT, DELETE });
}
