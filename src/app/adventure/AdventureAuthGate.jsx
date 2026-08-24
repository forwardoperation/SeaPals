"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { createAdventureAuthIntent } from "@/lib/adventureAccount.mjs";
import styles from "./AdventureAuthGate.module.css";

const ADVENTURE_AUTH_NEXT_PATH = "/adventure";

function DeviceMark() {
  return <span className={styles.deviceMark} aria-hidden="true" />;
}

function friendlyAuthError(error, fallback) {
  const message = String(error?.message ?? "").toLowerCase();

  if (
    message.includes("rate limit")
    || message.includes("too many")
    || message.includes("email rate")
  ) {
    return "Too many sign-in attempts were made. Wait a few minutes, then try again.";
  }

  if (
    message.includes("failed to fetch")
    || message.includes("network")
    || message.includes("offline")
  ) {
    return "We could not reach SeaPals sign-in. Check your connection and try again.";
  }

  return fallback;
}

function getRedirectUrl() {
  return `${window.location.origin}/auth/callback?next=/adventure`;
}

/**
 * Authenticates the visitor or finishes the required family-account setup.
 * The setup intent is stored in a short-lived HttpOnly cookie so OAuth and
 * email links can safely finish in another browser tab.
 */
export default function AdventureAuthGate({
  initialError = null,
  signedInEmail = null,
}) {
  const headingId = useId();
  const descriptionId = useId();
  const saveNoteId = useId();
  const adultCheckboxId = useId();
  const adultHintId = useId();
  const adultErrorId = useId();
  const marketingCheckboxId = useId();
  const emailId = useId();
  const emailHintId = useId();
  const emailErrorId = useId();

  const supabaseRef = useRef(null);
  const headingRef = useRef(null);
  const adultCheckboxRef = useRef(null);
  const emailInputRef = useRef(null);
  const alertRef = useRef(null);
  const autoSetupAttemptedRef = useRef(false);

  const [authStatus, setAuthStatus] = useState("checking");
  const [setupReadyForInput, setSetupReadyForInput] = useState(false);
  const [view, setView] = useState("form");
  const [pendingMethod, setPendingMethod] = useState(null);
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [adultAttested, setAdultAttested] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [attestationError, setAttestationError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [notice, setNotice] = useState(() =>
    initialError ? { kind: "error", message: initialError } : null,
  );

  const isBusy = pendingMethod !== null;

  useEffect(() => {
    let active = true;
    let subscription;

    try {
      const supabase = createBrowserSupabaseClient();
      supabaseRef.current = supabase;

      async function updateVerifiedAuthState(nextSession = null) {
        if (!active) return;
        if (nextSession === null) {
          setAuthStatus("signed-out");
          return;
        }
        const { data, error } = await supabase.auth.getClaims(
          nextSession?.access_token,
        );
        if (!active) return;
        setAuthStatus(!error && data?.claims ? "authenticated" : "signed-out");
      }

      const authListener = supabase.auth.onAuthStateChange(
        (_event, nextSession) => {
          if (!active) return;
          window.setTimeout(
            () => {
              void updateVerifiedAuthState(nextSession);
            },
            0,
          );
        },
      );
      subscription = authListener.data.subscription;

      supabase.auth
        .getClaims()
        .then(({ data, error }) => {
          if (!active) return;
          if (error) {
            setAuthStatus("signed-out");
            setNotice({
              kind: "error",
              message:
                "We could not check your SeaPals account. You can still try signing in.",
            });
            return;
          }
          setAuthStatus(data?.claims ? "authenticated" : "signed-out");
        })
        .catch(() => {
          if (!active) return;
          setAuthStatus("signed-out");
          setNotice({
            kind: "error",
            message:
              "We could not check your SeaPals account. Check your connection and try signing in.",
          });
        });
    } catch {
      setAuthStatus("signed-out");
      setNotice({
        kind: "error",
        message:
          "SeaPals sign-in is not available right now. Please try again later.",
      });
    }

    return () => {
      active = false;
      subscription?.unsubscribe();
      supabaseRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      authStatus !== "signed-out"
      && !(authStatus === "authenticated" && setupReadyForInput)
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      headingRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [authStatus, setupReadyForInput, view]);

  useEffect(() => {
    if (notice?.kind !== "error") return;
    const frame = window.requestAnimationFrame(() => {
      alertRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [authStatus, notice]);

  function requireAdultAttestation() {
    if (adultAttested) return true;

    setAttestationError(
      "An adult, parent, or legal guardian must approve the account before continuing.",
    );
    adultCheckboxRef.current?.focus({ preventScroll: true });
    return false;
  }

  async function storePendingIntent() {
    try {
      const intent = createAdventureAuthIntent({ marketingOptIn });
      const response = await fetch("/api/adventure/auth-intent", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intent),
      });
      if (!response.ok) throw new Error("Intent cookie was not accepted.");
      return true;
    } catch {
      setNotice({
        kind: "error",
        message:
          "SeaPals could not save the temporary account approval. Allow site cookies, then try again.",
      });
      return false;
    }
  }

  function setupNoticePath(result) {
    const noticeByStatus = {
      failed: "newsletter_failed",
      submitted: "newsletter_submitted",
      subscribed: "newsletter_subscribed",
    };
    const notice = noticeByStatus[result?.newsletterStatus];
    return notice
      ? `${ADVENTURE_AUTH_NEXT_PATH}?account_notice=${notice}`
      : ADVENTURE_AUTH_NEXT_PATH;
  }

  async function completeAccountSetup({ automatic = false } = {}) {
    setPendingMethod("setup");
    if (!automatic) setNotice(null);

    try {
      const response = await fetch("/api/adventure/account-setup", {
        method: "POST",
        credentials: "same-origin",
      });
      const result = await response.json().catch(() => null);

      if (automatic && response.status === 400) {
        setSetupReadyForInput(true);
        return;
      }
      if (!response.ok) {
        throw new Error("Family account setup was not accepted.");
      }

      window.location.replace(setupNoticePath(result));
    } catch {
      setSetupReadyForInput(true);
      setNotice({
        kind: "error",
        message:
          "Family account setup did not finish. Review the approval below and try again.",
      });
    } finally {
      setPendingMethod(null);
    }
  }

  useEffect(() => {
    if (authStatus !== "authenticated") return;

    if (!signedInEmail) {
      window.location.replace(ADVENTURE_AUTH_NEXT_PATH);
      return;
    }
    if (autoSetupAttemptedRef.current) return;

    autoSetupAttemptedRef.current = true;
    completeAccountSetup({ automatic: true });
  }, [authStatus, signedInEmail]);

  async function handleGoogleSignIn() {
    setNotice(null);
    if (!requireAdultAttestation()) return;

    const supabase = supabaseRef.current;
    if (!supabase) {
      setNotice({
        kind: "error",
        message:
          "SeaPals sign-in is still getting ready. Wait a moment and try again.",
      });
      return;
    }

    setPendingMethod("google");
    setNotice({
      kind: "success",
      message: "Opening Google sign-in…",
    });
    try {
      if (!(await storePendingIntent())) return;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getRedirectUrl(),
        },
      });

      if (error) throw error;
    } catch (error) {
      setNotice({
        kind: "error",
        message: friendlyAuthError(
          error,
          "Google sign-in did not finish. Try again or use email.",
        ),
      });
    } finally {
      setPendingMethod(null);
    }
  }

  function validateEmail() {
    const submittedEmail = email.trim();
    const input = emailInputRef.current;

    if (!submittedEmail || !input?.checkValidity()) {
      setEmailError("Enter a valid email address.");
      input?.focus({ preventScroll: true });
      return null;
    }

    setEmailError("");
    return submittedEmail;
  }

  async function sendMagicLink(submittedEmail) {
    const supabase = supabaseRef.current;
    if (!supabase) {
      setNotice({
        kind: "error",
        message:
          "SeaPals sign-in is still getting ready. Wait a moment and try again.",
      });
      return;
    }

    setNotice(null);
    setPendingMethod("email");
    try {
      if (!(await storePendingIntent())) return;

      const { error } = await supabase.auth.signInWithOtp({
        email: submittedEmail,
        options: {
          emailRedirectTo: getRedirectUrl(),
          shouldCreateUser: true,
        },
      });

      if (error) throw error;

      setSentEmail(submittedEmail);
      setView("email-sent");
      setNotice({
        kind: "success",
        message: "Your secure sign-in link is on its way.",
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message: friendlyAuthError(
          error,
          "We could not send the sign-in link. Check the email address and try again.",
        ),
      });
    } finally {
      setPendingMethod(null);
    }
  }

  async function handleEmailSubmit(event) {
    event.preventDefault();
    setNotice(null);

    if (!requireAdultAttestation()) return;
    const submittedEmail = validateEmail();
    if (!submittedEmail) return;

    await sendMagicLink(submittedEmail);
  }

  async function handleFinishAccountSetup() {
    setNotice(null);
    if (!requireAdultAttestation()) return;

    setPendingMethod("setup");
    if (!(await storePendingIntent())) {
      setPendingMethod(null);
      return;
    }
    await completeAccountSetup();
  }

  async function handleUseAnotherAccount() {
    setPendingMethod("signout");
    setNotice(null);
    try {
      const supabase = supabaseRef.current;
      if (!supabase) throw new Error("Sign-out client is unavailable.");
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      window.location.replace(ADVENTURE_AUTH_NEXT_PATH);
    } catch {
      setNotice({
        kind: "error",
        message: "Sign-out did not finish. Check your connection and try again.",
      });
      setPendingMethod(null);
    }
  }

  async function handleResend() {
    if (isBusy || !sentEmail) return;
    if (!requireAdultAttestation()) return;
    await sendMagicLink(sentEmail);
  }

  function handleUseDifferentEmail() {
    setView("form");
    setNotice(null);
    setEmailError("");
  }

  if (
    authStatus === "checking"
    || (authStatus === "authenticated" && !setupReadyForInput)
  ) {
    return (
      <main className={styles.gate} aria-labelledby={headingId}>
        <div className={styles.oceanGlow} aria-hidden="true" />
        <section
          className={`${styles.card} ${styles.checkingCard}`}
          aria-live="polite"
          aria-busy="true"
        >
          <img
            className={styles.logo}
            src="/images/brand/SeaPalsTCGLogoWhite.svg"
            alt="SeaPals TCG"
          />
          <div className={styles.spinner} aria-hidden="true" />
          <h1 id={headingId}>
            {authStatus === "authenticated"
              ? "Finishing your family account…"
              : "Checking your account…"}
          </h1>
          <p>
            {authStatus === "authenticated"
              ? "Applying the required adult approval."
              : "Getting Reefbound ready."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main
      className={styles.gate}
      aria-labelledby={headingId}
      aria-describedby={`${descriptionId} ${saveNoteId}`}
    >
      <div className={styles.oceanGlow} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <section className={styles.card} aria-busy={isBusy}>
        <header className={styles.header}>
          <img
            className={styles.logo}
            src="/images/brand/SeaPalsTCGLogoWhite.svg"
            alt="SeaPals TCG"
          />
          <p className={styles.eyebrow}>A SeaPals Story</p>
          <h1 id={headingId} ref={headingRef} tabIndex={-1}>
            {view === "email-sent"
              ? "Check your inbox"
              : authStatus === "authenticated"
                ? "Finish your family account"
                : "Enter REEFBOUND"}
          </h1>
          <div className={styles.divider} aria-hidden="true">
            <span>◆</span>
          </div>
          {view === "email-sent" ? (
            <p id={descriptionId} className={styles.intro}>
              We sent a secure sign-in link to{" "}
              <strong className={styles.sentEmail}>{sentEmail}</strong>. Open it
              on this device to enter Reefbound.
            </p>
          ) : authStatus === "authenticated" ? (
            <p id={descriptionId} className={styles.intro}>
              Signed in as{" "}
              <strong className={styles.sentEmail}>{signedInEmail}</strong>. A
              grown-up must approve the account before the game opens.
            </p>
          ) : (
            <p id={descriptionId} className={styles.intro}>
              Sign in or create a free SeaPals account to play.
            </p>
          )}
        </header>

        <div id={saveNoteId} className={styles.deviceNotice}>
          <DeviceMark />
          <span>
            <strong>Your saves follow your family account.</strong>
            <small>
              Reefbound saves on this device first, then syncs progress when
              you are online so you can continue on another device.
            </small>
          </span>
        </div>

        <div className={styles.privacyNotice}>
          <strong>Privacy notice for parents and guardians</strong>
          <p>
            Sea Realm, LLC uses Supabase to handle the adult account email and
            secure sign-in. Google receives sign-in information only if Google
            is selected. Account approval is recorded, and Reefbound keeps local
            saves while synchronizing the account&apos;s three slots through
            Supabase. Saves can include player-entered names and game progress.
            Kit receives the adult email only when the optional updates box is
            checked. Google Analytics is not loaded on account or adventure
            pages.
          </p>
          <p>
            To review or delete account information, email{" "}
            <a href="mailto:maker@seapalstcg.com">
              maker@seapalstcg.com
            </a>
            .
          </p>
          <div className={styles.privacyLinks}>
            <Link href="/privacy#children" target="_blank" rel="noreferrer">
              Privacy Policy <span className={styles.visuallyHidden}>(opens in a new tab)</span>
            </Link>
            <Link href="/terms" target="_blank" rel="noreferrer">
              Terms of Use <span className={styles.visuallyHidden}>(opens in a new tab)</span>
            </Link>
          </div>
        </div>

        {view === "form" ? (
          <>
            <div className={styles.grownUpNote}>
              <strong>Grown-up approval is required</strong>
              <p id={adultHintId}>
                Players under 13 should ask a grown-up to create or manage the
                account with them.
              </p>
            </div>

            <fieldset className={styles.consentGroup} disabled={isBusy}>
              <legend className={styles.visuallyHidden}>
                Account approval and optional email updates
              </legend>

              <label
                className={`${styles.checkboxRow} ${
                  attestationError ? styles.checkboxRowError : ""
                }`}
                htmlFor={adultCheckboxId}
              >
                <input
                  ref={adultCheckboxRef}
                  id={adultCheckboxId}
                  type="checkbox"
                  checked={adultAttested}
                  required
                  aria-invalid={Boolean(attestationError)}
                  aria-describedby={
                    attestationError
                      ? `${adultHintId} ${adultErrorId}`
                      : adultHintId
                  }
                  onChange={(event) => {
                    setAdultAttested(event.target.checked);
                    if (event.target.checked) setAttestationError("");
                  }}
                />
                <span>
                  <strong>
                    Adult approval <em>Required</em>
                  </strong>
                  <small>
                    I am 18 or older, or I am the player&apos;s parent or legal
                    guardian and approve this account.
                  </small>
                </span>
              </label>
              {attestationError ? (
                <p
                  id={adultErrorId}
                  className={styles.fieldError}
                  role="alert"
                >
                  {attestationError}
                </p>
              ) : null}

              <label
                className={styles.checkboxRow}
                htmlFor={marketingCheckboxId}
              >
                <input
                  id={marketingCheckboxId}
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={(event) =>
                    setMarketingOptIn(event.target.checked)
                  }
                />
                <span>
                  <strong>
                    SeaPals updates <em>Optional</em>
                  </strong>
                  <small>
                    Email me launch news, early purchase updates, and new card
                    reveals. Unsubscribe anytime.
                  </small>
                </span>
              </label>
            </fieldset>

            <p className={styles.legalAcknowledgement}>
              By continuing, the adult approving this account agrees to the{" "}
              <Link href="/terms" target="_blank" rel="noreferrer">
                Terms of Use
              </Link>{" "}
              and acknowledges the{" "}
              <Link href="/privacy" target="_blank" rel="noreferrer">
                Privacy Policy
              </Link>
              .
            </p>

            {notice ? (
              <div
                ref={notice.kind === "error" ? alertRef : undefined}
                tabIndex={notice.kind === "error" ? -1 : undefined}
                className={
                  notice.kind === "error"
                    ? styles.noticeError
                    : styles.noticeSuccess
                }
                role={notice.kind === "error" ? "alert" : "status"}
              >
                {notice.message}
              </div>
            ) : null}

            {authStatus === "authenticated" ? (
              <div className={styles.sentActions}>
                <button
                  className={styles.primaryButton}
                  type="button"
                  disabled={isBusy}
                  onClick={handleFinishAccountSetup}
                >
                  {pendingMethod === "setup"
                    ? "Finishing account setup…"
                    : "Approve and enter Reefbound"}
                </button>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  disabled={isBusy}
                  onClick={handleUseAnotherAccount}
                >
                  {pendingMethod === "signout"
                    ? "Signing out…"
                    : "Use another account"}
                </button>
              </div>
            ) : (
              <>
                <button
                  className={styles.googleButton}
                  type="button"
                  disabled={isBusy}
                  onClick={handleGoogleSignIn}
                >
                  <img
                    className={styles.googleButtonImage}
                    src="/images/auth/sign-in-with-google-light-pill@2x.png"
                    alt={
                      pendingMethod === "google"
                        ? "Connecting to Google"
                        : "Sign in with Google"
                    }
                  />
                </button>

            <div className={styles.orDivider}>
              <span>or continue with email</span>
            </div>

                <form
                  className={styles.emailForm}
                  noValidate
                  onSubmit={handleEmailSubmit}
                >
              <label htmlFor={emailId}>Email address</label>
              <input
                ref={emailInputRef}
                id={emailId}
                type="email"
                value={email}
                required
                disabled={isBusy}
                autoComplete="email"
                autoCapitalize="none"
                inputMode="email"
                enterKeyHint="continue"
                spellCheck="false"
                aria-invalid={Boolean(emailError)}
                aria-describedby={
                  emailError ? `${emailHintId} ${emailErrorId}` : emailHintId
                }
                placeholder="you@example.com"
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (emailError) setEmailError("");
                }}
              />
              <p id={emailHintId} className={styles.emailHint}>
                No password needed. We&apos;ll send a secure link to this
                address.
              </p>
              {emailError ? (
                <p
                  id={emailErrorId}
                  className={styles.fieldError}
                  role="alert"
                >
                  {emailError}
                </p>
              ) : null}
              <button
                className={styles.primaryButton}
                type="submit"
                disabled={isBusy}
              >
                {pendingMethod === "email"
                  ? "Sending secure link…"
                  : "Email me a sign-in link"}
              </button>
                </form>
              </>
            )}
          </>
        ) : (
          <div className={styles.sentActions}>
            {notice ? (
              <div
                ref={notice.kind === "error" ? alertRef : undefined}
                tabIndex={notice.kind === "error" ? -1 : undefined}
                className={
                  notice.kind === "error"
                    ? styles.noticeError
                    : styles.noticeSuccess
                }
                role={notice.kind === "error" ? "alert" : "status"}
                aria-live="polite"
              >
                {notice.message}
              </div>
            ) : null}
            <button
              className={styles.primaryButton}
              type="button"
              disabled={isBusy}
              onClick={handleResend}
            >
              {pendingMethod === "email"
                ? "Sending another link…"
                : "Send another link"}
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={isBusy}
              onClick={handleUseDifferentEmail}
            >
              Use a different email
            </button>
          </div>
        )}

        <a className={styles.exitLink} href="/">
          Return to SeaPals
        </a>
      </section>
    </main>
  );
}
