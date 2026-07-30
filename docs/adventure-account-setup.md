# Reefbound family-account setup

## What is implemented

`/adventure` now verifies a Supabase session on the server before it renders
the game. Signed-out visitors see one account screen with:

- **Sign in with Google**
- passwordless **Email me a sign-in link**
- a required adult/parent/legal-guardian attestation
- a separate, optional, unchecked SeaPals marketing opt-in
- an optional post-play invitation that can email the adult account holder a
  Kit confirmation request after the first completed game session

Adventure saves are still device-local. Their local-storage namespace now
includes the verified Supabase user ID, so the SeaPals interface keeps three
save slots separate for accounts sharing a browser profile. This is
namespacing, not encryption against device users, developer tools, or other
same-origin code. A one-time prompt lets the first account explicitly copy
older pre-account saves; the source copies are preserved.

Supabase Auth stores account emails. A signed, one-hour HttpOnly setup cookie
survives OAuth and magic-link tab changes, and the game fails closed until a
server-controlled Supabase `app_metadata` record contains the current
adult-account attestation. The adult can request marketing at account setup or
through the separate post-play invitation. The post-play action requires an
adult-account confirmation and a separate marketing confirmation, then asks Kit
to email the account holder. A successful form response is recorded as
submitted or pending confirmation, not as a confirmed subscription. Declining
or a provider failure never blocks the game.
`/adventure` and `/auth` disable Google Analytics; the normal in-app entry uses
a full document navigation so the tag is not carried into the game route.

## Provider setup required before launch

Set `ADVENTURE_AUTH_SIGNING_SECRET` to a separate random value of at least 32
characters in local and Cloudflare environments. Rotating it invalidates only
unfinished one-hour setup transactions. The code falls back to the Supabase
service-role key for local/backward-compatible setup, but production should use
the dedicated secret.

### 1. Google Cloud and Supabase

The Supabase project's public settings were checked on July 29, 2026: email
sign-in was enabled and Google was disabled.

1. In Google Auth Platform, create a Web OAuth client and configure the
   production consent screen.
2. Add these authorized JavaScript origins:
   - `https://seapalstcg.com`
   - `http://localhost:3000`
3. Add the Supabase provider callback URL shown in the Supabase Google provider
   panel as Google's authorized redirect URI. It has the form
   `https://<project-ref>.supabase.co/auth/v1/callback`.
4. In Supabase Authentication > Providers > Google, add the Google client ID
   and client secret and enable the provider.
5. In Supabase Authentication > URL Configuration:
   - set the Site URL to `https://seapalstcg.com`
   - allow `https://seapalstcg.com/auth/callback`
   - allow `http://localhost:3000/auth/callback` for local testing

The UI uses Google&apos;s pre-approved light pill asset at
`public/images/auth/sign-in-with-google-light-pill@2x.png`. Do not recolor,
crop, or replace its logo with a text approximation.

References:

- [Google Sign in branding guidelines](https://developers.google.com/identity/branding-guidelines)
- [Supabase Google login](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

### 2. Production email delivery

Passwordless email uses Supabase Auth mail delivery. Configure and test custom
SMTP before inviting the public; the default Supabase mail service is intended
for limited testing. Confirm that the magic-link template returns to the app's
allowed `/auth/callback` URL.

- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

### 3. Kit

`KIT_FORM_ID` defaults to the existing form `9233650`. Confirm in Kit that this
form's incentive/double-opt-in email, sender identity, consent copy, automation,
and unsubscribe behavior are the intended production settings. No account is
sent to Kit unless the adult explicitly checks the optional account-setup box
or uses the post-play invitation to request a confirmation email. The account
is not treated as subscribed merely because Kit accepted the request.

## Child-privacy launch gate

Reefbound's documented primary audience is ages 8–12. The account screen is
therefore framed as an adult-owned family account and tells players under 13 to
ask a grown-up. This is a data-minimizing product control, **not** a conclusion
that the service complies with COPPA or another privacy law. A checkbox is not
by itself a verifiable-parental-consent program.

The site now includes owner-review drafts at `/privacy` and `/terms`, a
sitewide legal footer, and direct privacy notices at the adventure account
gate, homepage email form, survey, tournament entry, and store checkout. The
privacy draft identifies the operator as:

- Sea Realm, LLC
- PO Box 11, Elverson, PA 19520, United States
- `maker@seapalstcg.com`

The owner supplied no public telephone number. FTC guidance calls for operator
contact information that includes a telephone number, so that remains a legal
review item. Do not represent the current draft as COPPA-compliant without
qualified review.

The privacy draft also contains finite retention periods. Before publishing
those periods as an operational promise, assign an owner and implement a
repeatable deletion process for Supabase accounts and authorization metadata,
survey records, tournament contact/edit data, store records, server/security
logs, support correspondence, Kit records, and Google Analytics settings.
Provider backup and deletion behavior must be confirmed as part of that work.

Do not enable the account requirement publicly until an owner-approved review
has covered:

- whether the service is child-directed or mixed-audience and which consent
  model applies;
- the direct parental notice and the drafted public privacy notice;
- Google, Supabase, Kit, Cloudflare, Resend, and analytics data flows;
- account email retention, export, correction, and deletion;
- local-save ownership and device-sharing behavior;
- marketing consent records and withdrawal;
- the missing public telephone contact and all operator details that must
  appear in the privacy notice; and
- all jurisdictions in which the game will be offered.

Primary U.S. reference:

- [FTC COPPA compliance FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)

## Launch verification

Before publishing:

1. Test Google account creation and returning sign-in.
2. Test email account creation, returning sign-in, expired links, and resend.
3. Verify the unchecked marketing path creates no Kit subscriber.
4. Verify the checked path submits one Kit signup, records it as pending, and
   sends the configured confirmation; do not mark it subscribed until Kit
   confirms that state.
5. Complete one duel without account-setup marketing consent. Verify the
   post-play invitation appears only after returning from the duel and its
   conversation, both confirmations start unchecked, **Not now** continues
   play, and no request includes an email or user ID from the browser.
6. Verify the post-play affirmative path sends one Kit confirmation request,
   remains optional when Kit fails, and is suppressed after a submitted or
   confirmed status.
7. Sign into two accounts in one browser and confirm their save slots remain
   separate.
8. Exercise the older-save choice in both "Use these saves" and "Start fresh"
   paths.
9. Verify sign-out returns to the account gate without deleting local saves.
10. Test direct `/adventure` access with missing, expired, and valid sessions.
