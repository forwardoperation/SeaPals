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

Reefbound keeps a local cache of each save and synchronizes the account's three
save slots to account-owned rows in Supabase. This lets the same adult-managed
family account continue on another device and provides an account copy when
local browser data is lost. A save can include player-entered player and
best-friend names, campaign and collection progress, settings, decks, and other
game state. The local-storage namespace includes the verified Supabase user ID,
so the SeaPals interface keeps saves separate for accounts sharing a browser
profile. This is namespacing, not encryption against device users, developer
tools, or other same-origin code. A one-time prompt lets the first account
explicitly copy older pre-account saves; the source copies are preserved.

Sync is local-first: play writes to the current device and then uploads the
account copy when a connection is available. When devices independently change
the same slot, the service preserves the conflicting copies and asks the user
which version to keep instead of silently overwriting either one. Removing a
profile creates a synchronized deletion record so an offline device cannot
later restore the removed save as current. Prior save history may be retained
for up to 30 days for recovery and security, then deleted, subject to limited
provider backup aging. The current deletion record remains while the family
account exists so a long-offline device cannot silently resurrect the profile.
Deleting the family account must remove its active cloud saves, deletion
records, and save history; clearing one browser's site data removes only that
device's cache and does not itself delete the account copy.

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

### 1. Cloud-save database and account isolation

Run `supabase/adventure-saves.sql` in the SQL editor for the existing SeaPals
Supabase project before enabling cloud saves. The migration creates the private
account-owned save storage, synchronized deletion/history support, and row-level
security policies used by `/api/adventure/saves`. Do not expose the Supabase
service-role key to the browser; the same-origin API must authenticate the
adult-managed family account and scope every operation to that account.

Schedule `select public.prune_adventure_save_history();` to run at least daily
with a server-side scheduler authorized as `service_role` (for example, a
Supabase scheduled database job or an authenticated maintenance worker). The
function is intentionally unavailable to browser roles. Verify the job after
deployment; creating the function alone does not enforce the published 30-day
history limit.

After applying the migration, use two separate test accounts to verify account
isolation. Account A must be able to create, list, update, conflict, and delete
its own three profiles through `/api/adventure/saves`. Account B must not see
Account A's saves in a list response or read, change, or delete one by supplying
a guessed profile identifier. Repeat the checks without a session and confirm
the API fails closed. Inspect the resulting Supabase rows to confirm that save
ownership comes from the authenticated server session rather than a user ID in
the request body.

### 2. Google Cloud and Supabase

The Supabase project's public settings were checked on July 29, 2026: email
sign-in was enabled and Google was disabled.

1. In Google Auth Platform, create a Web OAuth client and configure the
   production consent screen.
2. In the production Web client's authorized JavaScript origins, include both
   `https://seapalstcg.com` and `https://searealm.com` during migration. Use a
   separate development OAuth client/project for `http://localhost:3000`; do
   not add localhost to the verified production client.
3. Add the Supabase provider callback URL shown in the Supabase Google provider
   panel as Google's authorized redirect URI. It has the form
   `https://<project-ref>.supabase.co/auth/v1/callback`.
4. In Supabase Authentication > Providers > Google, add the Google client ID
   and client secret and enable the provider.
5. In Supabase Authentication > URL Configuration:
   - keep the Site URL at `https://seapalstcg.com` during dual-domain testing,
     then switch it to `https://searealm.com` at the canonical cutover
   - allow `https://seapalstcg.com/auth/callback`
   - allow `https://searealm.com/auth/callback`
   - allow `http://localhost:3000/auth/callback` for local testing

Keep Google's authorized redirect URI pointed at Supabase rather than either
site origin. Browser auth cookies and PKCE verifiers are host-only, so users
must start a fresh sign-in on SeaRealm. An OAuth attempt or magic link started
on SeaPals cannot bridge its cookie state to SeaRealm and must be reissued after
cutover. See `docs/domain-migration.md` for the coordinated cutover order.

The UI uses Google&apos;s pre-approved light pill asset at
`public/images/auth/sign-in-with-google-light-pill@2x.png`. Do not recolor,
crop, or replace its logo with a text approximation.

References:

- [Google Sign in branding guidelines](https://developers.google.com/identity/branding-guidelines)
- [Supabase Google login](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

### 3. Production email delivery

Passwordless email uses Supabase Auth mail delivery. Configure and test custom
SMTP before inviting the public; the default Supabase mail service is intended
for limited testing. Confirm that the magic-link template preserves Supabase's
confirmation token and honors the requested `RedirectTo` back to the app's
allowed `/auth/callback` URL. The default `{{ .ConfirmationURL }}` does this;
linking a raw redirect URL does not authenticate the user.

- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

### 4. Kit

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
repeatable deletion process for Supabase accounts, authorization metadata,
active cloud saves and their history, survey records, tournament contact/edit
data, store records, server/security logs, support correspondence, Kit records,
and Google Analytics settings. Implement an authenticated export and correction
workflow for account and save data, and test that deleting a Reefbound profile
synchronizes its deletion across devices while deleting a family account
cascades to all active saves and save history. Provider backup aging and
deletion behavior must be confirmed as part of that work.

Do not enable the account requirement or cloud-save synchronization publicly
until an owner-approved review has covered:

- whether the service is child-directed or mixed-audience and which consent
  model applies;
- the direct parental notice and the drafted public privacy notice;
- Google, Supabase, Kit, Cloudflare, Resend, and analytics data flows;
- account email and cloud-save retention, export, correction, and deletion;
- player-entered names and all other fields included in synchronized saves;
- local-cache and cloud-save ownership, conflicts, recovery, deletion, and
  device-sharing behavior;
- marketing consent records and withdrawal;
- the missing public telephone contact and all operator details that must
  appear in the privacy notice; and
- all jurisdictions in which the game will be offered.

Primary U.S. reference:

- [FTC COPPA compliance FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)

## Launch verification

Before publishing:

1. Apply `supabase/adventure-saves.sql` to the existing Supabase project and
   verify its row-level security policies are enabled. Configure and verify the
   daily service-role history-pruning job.
2. Exercise `/api/adventure/saves` with no session and with two different test
   accounts. Confirm it fails closed without authentication and neither account
   can list, read, change, or delete the other account's profiles.
3. Test Google account creation and returning sign-in.
4. Test email account creation, returning sign-in, expired links, and resend.
5. Verify the unchecked marketing path creates no Kit subscriber.
6. Verify the checked path submits one Kit signup, records it as pending, and
   sends the configured confirmation; do not mark it subscribed until Kit
   confirms that state.
7. Complete one duel without account-setup marketing consent. Verify the
   post-play invitation appears only after returning from the duel and its
   conversation, both confirmations start unchecked, **Not now** continues
   play, and no request includes an email or user ID from the browser.
8. Verify the post-play affirmative path sends one Kit confirmation request,
   remains optional when Kit fails, and is suppressed after a submitted or
   confirmed status.
9. Sign into the same account on two devices. Confirm all three slots can sync,
   including player and best-friend names, progress, settings, and decks, while
   each device keeps a usable local cache.
10. Change the same slot independently while both devices are offline,
    reconnect, and confirm both versions are preserved until the user chooses
    one.
11. Delete a profile, reconnect a device that still has an older local copy,
    and confirm the synchronized deletion prevents that copy from becoming
    current.
12. Sign into two accounts in one browser and confirm their save slots remain
    separate.
13. Exercise the older-save choice in both "Use these saves" and "Start fresh"
    paths.
14. Verify sign-out returns to the account gate without deleting local saves or
    the account's cloud copies.
15. Verify an authenticated account-data export includes cloud saves in a
    portable form; exercise correction, profile deletion, and full account
    deletion; and confirm active saves and save history are removed as promised.
16. Test direct `/adventure` access with missing, expired, and valid sessions.
