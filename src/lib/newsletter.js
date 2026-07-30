export const DEFAULT_KIT_FORM_ID = "9233650";

const KIT_FORM_ORIGIN = "https://app.kit.com";
const EMAIL_MAX_LENGTH = 254;
const EMAIL_LOCAL_PART_MAX_LENGTH = 64;
const FIRST_NAME_MAX_LENGTH = 100;
const EMAIL_LOCAL_PART_PATTERN = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/i;
const EMAIL_DOMAIN_LABEL_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

const ERROR_MESSAGES = Object.freeze({
  CONSENT_REQUIRED: "Newsletter consent is required.",
  INVALID_EMAIL: "Enter a valid email address.",
  INVALID_FIRST_NAME: "Enter a valid first name.",
  INVALID_FORM_ID: "Newsletter form configuration is invalid.",
  SERVER_ONLY: "Newsletter subscriptions must be submitted from the server.",
  TRANSPORT_UNAVAILABLE: "Newsletter subscription transport is unavailable.",
  UPSTREAM_REJECTED: "The newsletter provider rejected the subscription.",
  UNSAFE_REDIRECT: "The newsletter provider returned an unsupported redirect.",
});

export class NewsletterSubscriptionError extends Error {
  constructor(code, { status } = {}) {
    super(ERROR_MESSAGES[code] ?? "The newsletter subscription failed.");
    this.name = "NewsletterSubscriptionError";
    this.code = code;
    if (Number.isInteger(status)) this.status = status;
  }
}

function subscriptionError(code, options) {
  return new NewsletterSubscriptionError(code, options);
}

function assertServerRuntime() {
  if (typeof window !== "undefined") {
    throw subscriptionError("SERVER_ONLY");
  }
}

function countCodePoints(value) {
  return Array.from(value).length;
}

export function normalizeNewsletterEmail(value) {
  if (typeof value !== "string") {
    throw subscriptionError("INVALID_EMAIL");
  }

  const email = value.trim().normalize("NFC").toLowerCase();
  if (
    !email
    || email.length > EMAIL_MAX_LENGTH
    || /[\s\u0000-\u001f\u007f]/u.test(email)
  ) {
    throw subscriptionError("INVALID_EMAIL");
  }

  const separator = email.indexOf("@");
  if (separator <= 0 || separator !== email.lastIndexOf("@")) {
    throw subscriptionError("INVALID_EMAIL");
  }

  const localPart = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  if (
    localPart.length > EMAIL_LOCAL_PART_MAX_LENGTH
    || localPart.startsWith(".")
    || localPart.endsWith(".")
    || localPart.includes("..")
    || !EMAIL_LOCAL_PART_PATTERN.test(localPart)
  ) {
    throw subscriptionError("INVALID_EMAIL");
  }

  const domainLabels = domain.split(".");
  if (
    domain.length > 253
    || domainLabels.length < 2
    || domainLabels.some((label) => !EMAIL_DOMAIN_LABEL_PATTERN.test(label))
  ) {
    throw subscriptionError("INVALID_EMAIL");
  }

  return `${localPart}@${domain}`;
}

export function normalizeNewsletterFirstName(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw subscriptionError("INVALID_FIRST_NAME");
  }

  const firstName = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (!firstName) return null;
  if (
    countCodePoints(firstName) > FIRST_NAME_MAX_LENGTH
    || /[\u0000-\u001f\u007f]/u.test(firstName)
  ) {
    throw subscriptionError("INVALID_FIRST_NAME");
  }

  return firstName;
}

function resolveKitFormId({ formId, env }) {
  const runtimeEnv =
    env ?? (typeof process !== "undefined" ? process.env : Object.create(null));
  const configuredId = formId ?? runtimeEnv.KIT_FORM_ID ?? DEFAULT_KIT_FORM_ID;
  const normalizedId =
    typeof configuredId === "number" && Number.isSafeInteger(configuredId)
      ? String(configuredId)
      : typeof configuredId === "string"
        ? configuredId.trim()
        : "";

  if (!/^[1-9]\d{0,19}$/.test(normalizedId)) {
    throw subscriptionError("INVALID_FORM_ID");
  }

  return normalizedId;
}

function kitSubscriptionUrl(formId) {
  return new URL(
    `/forms/${encodeURIComponent(formId)}/subscriptions`,
    KIT_FORM_ORIGIN,
  ).toString();
}

/**
 * Adds a consenting account email to the existing public Kit form.
 *
 * This deliberately requires an explicit boolean consent value, reads no
 * browser state, never logs subscriber data, never returns subscriber data,
 * and refuses to run when imported into a browser runtime.
 */
export async function subscribeToNewsletter({
  consent,
  email,
  firstName,
  fetchImpl = globalThis.fetch,
  formId,
  env,
  signal,
} = {}) {
  assertServerRuntime();

  if (consent !== true) {
    throw subscriptionError("CONSENT_REQUIRED");
  }

  const normalizedEmail = normalizeNewsletterEmail(email);
  const normalizedFirstName = normalizeNewsletterFirstName(firstName);
  const resolvedFormId = resolveKitFormId({ formId, env });

  if (typeof fetchImpl !== "function") {
    throw subscriptionError("TRANSPORT_UNAVAILABLE");
  }

  const body = new URLSearchParams({ email_address: normalizedEmail });
  if (normalizedFirstName) {
    body.set("fields[first_name]", normalizedFirstName);
  }

  let response;
  try {
    response = await fetchImpl(kitSubscriptionUrl(resolvedFormId), {
      method: "POST",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body,
      cache: "no-store",
      redirect: "manual",
      signal,
    });
  } catch {
    throw subscriptionError("TRANSPORT_UNAVAILABLE");
  }

  const status = response?.status;
  if (!Number.isInteger(status)) {
    throw subscriptionError("TRANSPORT_UNAVAILABLE");
  }

  if (status >= 200 && status < 300) {
    return Object.freeze({
      ok: true,
      accepted: true,
      status,
      confirmation: "response",
    });
  }

  // Kit's public form normally confirms a successful POST with a redirect.
  // Do not follow it: a 302/303 is enough to record acceptance without
  // forwarding subscriber data or credentials to another location.
  if (status === 302 || status === 303) {
    return Object.freeze({
      ok: true,
      accepted: true,
      status,
      confirmation: "redirect",
    });
  }

  if (status >= 300 && status < 400) {
    throw subscriptionError("UNSAFE_REDIRECT", { status });
  }

  // Do not read or attach the response body because providers may echo PII in
  // validation errors. Callers receive only a stable code and numeric status.
  throw subscriptionError("UPSTREAM_REJECTED", { status });
}
