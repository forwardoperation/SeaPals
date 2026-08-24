export const ADVENTURE_CLOUD_SAVE_ENDPOINT = "/api/adventure/saves";

const NO_STORE_HEADERS = Object.freeze({
  Accept: "application/json",
});

function accountHeaders(expectedAccountId) {
  return expectedAccountId
    ? { ...NO_STORE_HEADERS, "X-SeaPals-Account-Id": expectedAccountId }
    : NO_STORE_HEADERS;
}

function cloudError(code, message, options = {}) {
  const error = new Error(message);
  error.name = "AdventureCloudSaveError";
  error.code = code;
  error.status = options.status ?? null;
  error.retryable = options.retryable ?? false;
  error.record = options.record ?? null;
  return error;
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    throw cloudError(
      "INVALID_CLOUD_RESPONSE",
      "SeaPals returned an unreadable cloud-save response.",
      { status: response.status, retryable: response.status >= 500 },
    );
  }
}

async function requestCloudSaves(fetchImpl, endpoint, options) {
  let response;
  try {
    response = await fetchImpl(endpoint, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
    });
  } catch (cause) {
    throw cloudError(
      "CLOUD_SAVE_OFFLINE",
      "Cloud saves are offline. Progress is still saved on this device.",
      { retryable: true, cause },
    );
  }

  const body = await readJsonResponse(response);
  if (response.ok) return body;
  if (response.status === 409 && body?.conflict && body?.record) {
    return {
      ok: false,
      conflict: true,
      record: body.record,
      error: body.error ?? {
        code: "CLOUD_VERSION_CONFLICT",
        message: "This save changed on another device.",
      },
    };
  }

  throw cloudError(
    body?.error?.code ?? body?.code ?? `CLOUD_SAVE_HTTP_${response.status}`,
    body?.error?.message
      ?? (typeof body?.error === "string" ? body.error : null)
      ?? "SeaPals could not reach cloud saves.",
    {
      status: response.status,
      retryable: response.status === 408 || response.status === 429 || response.status >= 500,
    },
  );
}

export function createAdventureCloudSaveClient({
  fetchImpl = globalThis.fetch,
  endpoint = ADVENTURE_CLOUD_SAVE_ENDPOINT,
  expectedAccountId = null,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("Adventure cloud saves require a fetch implementation.");
  }
  if (typeof endpoint !== "string" || !endpoint.startsWith("/")) {
    throw new TypeError("Adventure cloud-save endpoint must be a same-origin path.");
  }
  if (expectedAccountId !== null && (
    typeof expectedAccountId !== "string"
    || expectedAccountId.length < 1
    || expectedAccountId.length > 128
  )) {
    throw new TypeError("Expected account ID must be a non-empty bounded string.");
  }

  return Object.freeze({
    async listProfiles() {
      const result = await requestCloudSaves(fetchImpl, endpoint, {
        method: "GET",
        headers: accountHeaders(expectedAccountId),
      });
      if (!result?.ok || !Array.isArray(result.profiles)) {
        throw cloudError(
          "INVALID_CLOUD_RESPONSE",
          "SeaPals returned an incomplete cloud-save list.",
          { retryable: true },
        );
      }
      return result.profiles;
    },

    async saveProfile({
      profileId,
      expectedCloudVersion,
      save,
      saveKind = "autosave",
      checkpointId = null,
    } = {}) {
      return requestCloudSaves(fetchImpl, endpoint, {
        method: "PUT",
        headers: {
          ...accountHeaders(expectedAccountId),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileId,
          expectedCloudVersion,
          save,
          metadata: { saveKind, checkpointId },
        }),
      });
    },

    async deleteProfile({
      profileId,
      expectedCloudVersion,
      checkpointId = "profile-deleted",
    } = {}) {
      return requestCloudSaves(fetchImpl, endpoint, {
        method: "DELETE",
        headers: {
          ...accountHeaders(expectedAccountId),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileId,
          expectedCloudVersion,
          metadata: { saveKind: "delete", checkpointId },
        }),
      });
    },
  });
}
