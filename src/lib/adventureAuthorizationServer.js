import "server-only";

import {
  beginAdventureMarketingAuthorization,
  createAdventureAuthorizationRecord,
  finalizeAdventureMarketingAuthorization,
  getAdventureAuthorizationFromAppMetadata,
  mergeAdventureAuthorizationAppMetadata,
} from "@/lib/adventureAuthorization.mjs";
import {
  getAdventureNewsletterOptInDisposition,
} from "@/lib/adventureNewsletterOptIn.mjs";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

const USER_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._:@-]{0,126}[A-Za-z0-9])?$/;

export class AdventureAuthorizationStoreError extends Error {
  constructor(code) {
    super("Adventure authorization storage is unavailable.");
    this.name = "AdventureAuthorizationStoreError";
    this.code = code;
  }
}

function normalizeUserId(userId) {
  if (typeof userId !== "string" || !USER_ID_PATTERN.test(userId)) {
    throw new AdventureAuthorizationStoreError("INVALID_USER_ID");
  }
  return userId;
}

function resolveAdmin(admin) {
  return admin ?? createSupabaseAdmin();
}

async function persistAdventureAuthorization({
  client,
  currentUser,
  normalizedUserId,
  authorization,
}) {
  const appMetadata = mergeAdventureAuthorizationAppMetadata(
    currentUser.app_metadata,
    authorization,
  );
  const { data, error } = await client.auth.admin.updateUserById(
    normalizedUserId,
    { app_metadata: appMetadata },
  );
  if (error || data?.user?.id !== normalizedUserId) {
    throw new AdventureAuthorizationStoreError("AUTHORIZATION_WRITE_FAILED");
  }

  return {
    user: data.user,
    authorization,
  };
}

export async function getAdventureAuthorizationUser(
  userId,
  { admin } = {},
) {
  const normalizedUserId = normalizeUserId(userId);
  const client = resolveAdmin(admin);
  const { data, error } = await client.auth.admin.getUserById(normalizedUserId);
  const user = data?.user;
  if (error || !user || user.id !== normalizedUserId) {
    throw new AdventureAuthorizationStoreError("USER_LOOKUP_FAILED");
  }

  return {
    user,
    authorization: getAdventureAuthorizationFromAppMetadata(
      user.app_metadata,
    ),
  };
}

export async function writeAdventureAuthorization({
  userId,
  intent,
  intentId,
  newsletterStatus,
  now = () => new Date(),
  admin,
  user,
} = {}) {
  const normalizedUserId = normalizeUserId(userId);
  const client = resolveAdmin(admin);
  let currentUser = user;
  if (!currentUser) {
    currentUser = (
      await getAdventureAuthorizationUser(normalizedUserId, { admin: client })
    ).user;
  }
  if (currentUser.id !== normalizedUserId) {
    throw new AdventureAuthorizationStoreError("USER_ID_MISMATCH");
  }

  const authorization = createAdventureAuthorizationRecord({
    intent,
    intentId,
    newsletterStatus,
    previousAuthorization: getAdventureAuthorizationFromAppMetadata(
      currentUser.app_metadata,
    ),
    now,
  });
  return persistAdventureAuthorization({
    client,
    currentUser,
    normalizedUserId,
    authorization,
  });
}

export async function beginAdventureMarketingOptIn({
  userId,
  consentIntentId,
  now = () => new Date(),
  admin,
} = {}) {
  const normalizedUserId = normalizeUserId(userId);
  const client = resolveAdmin(admin);
  const account = await getAdventureAuthorizationUser(normalizedUserId, {
    admin: client,
  });
  if (!account.authorization) {
    throw new AdventureAuthorizationStoreError("AUTHORIZATION_REQUIRED");
  }

  const disposition = getAdventureNewsletterOptInDisposition(
    account.authorization,
    { now },
  );
  if (disposition.kind !== "eligible") {
    return {
      ...account,
      started: false,
      disposition,
    };
  }

  let authorization;
  try {
    authorization = beginAdventureMarketingAuthorization({
      authorization: account.authorization,
      consentIntentId,
      now,
    });
  } catch {
    throw new AdventureAuthorizationStoreError("CONSENT_BEGIN_FAILED");
  }

  const persisted = await persistAdventureAuthorization({
    client,
    currentUser: account.user,
    normalizedUserId,
    authorization,
  });
  return {
    ...persisted,
    started: true,
    disposition: Object.freeze({ kind: "processing" }),
  };
}

export async function finalizeAdventureMarketingOptIn({
  userId,
  consentIntentId,
  newsletterStatus,
  now = () => new Date(),
  admin,
} = {}) {
  const normalizedUserId = normalizeUserId(userId);
  const client = resolveAdmin(admin);
  const account = await getAdventureAuthorizationUser(normalizedUserId, {
    admin: client,
  });
  if (!account.authorization) {
    throw new AdventureAuthorizationStoreError("AUTHORIZATION_REQUIRED");
  }

  let authorization;
  try {
    authorization = finalizeAdventureMarketingAuthorization({
      authorization: account.authorization,
      consentIntentId,
      newsletterStatus,
      now,
    });
  } catch (error) {
    const code = /ID does not match/i.test(String(error?.message))
      ? "CONSENT_ID_MISMATCH"
      : "CONSENT_FINALIZE_FAILED";
    throw new AdventureAuthorizationStoreError(code);
  }

  return persistAdventureAuthorization({
    client,
    currentUser: account.user,
    normalizedUserId,
    authorization,
  });
}
