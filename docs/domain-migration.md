# SeaRealm domain migration runbook

This runbook moves the existing Cloudflare Worker application from
`seapalstcg.com` to `searealm.com` without treating a DNS alias as an application
cutover. SeaRealm is now canonical; the old host permanently redirects browser
requests after successful authentication, cloud-save, and payment checks.

The registrar and authoritative DNS provider are separate choices. The domain
may be registered at GoDaddy or Namecheap while Cloudflare remains authoritative
DNS for a Worker custom domain. A standard Cloudflare Worker custom domain
requires the domain's zone and DNS to be active in the same Cloudflare account as
the Worker.

## Migration checkpoint: October 2, 2026

Read-only checks against public DNS and the authenticated Cloudflare API found
that the application preparation is already deployed. SeaRealm has now been
added to the same Cloudflare account on the Free plan, with five DNS records
imported. With explicit owner approval, the GoDaddy nameserver change was
submitted and verified as saved. Cloudflare now reports **Your domain is now
protected by Cloudflare**, and a public NS query through `1.1.1.1` returns both
assigned Cloudflare nameservers. The owner removed the two imported parking A
records, and `searealm.com` is now connected to the existing production `seapals`
Worker. SeaRealm serves the app over HTTPS; old-host browser requests now
redirect to SeaRealm. The following table includes historical setup evidence
and the current cutover state.

| Check | Observed state |
| --- | --- |
| Existing site | Its Cloudflare zone remains active. Browser GET/HEAD requests redirect to SeaRealm; APIs, auth callbacks, and other methods are excluded. |
| Production Worker | `seapals` has both `seapalstcg.com` and `searealm.com` attached to production. The existing `www.seapalstcg.com/*` route remains present. |
| SeaRealm Cloudflare zone | Activated on the Free plan; dashboard confirms the domain is protected by Cloudflare. |
| Assigned Cloudflare nameservers | `anirban.ns.cloudflare.com` and `eve.ns.cloudflare.com`, verified on SeaRealm's activation page. |
| SeaRealm nameserver delegation | GoDaddy and public resolver `1.1.1.1` show `anirban.ns.cloudflare.com` and `eve.ns.cloudflare.com`. Previous values were `ns49.domaincontrol.com` and `ns50.domaincontrol.com`. |
| Registrar status | GoDaddy lists the domain as leased. The custom nameserver change was accepted and saved. |
| SeaRealm apex routing | Owner removed parking A records `15.197.225.128` and `3.33.251.168`. Cloudflare successfully attached the root hostname to `seapals`; those saved IP values are historical rollback information only. |
| SeaRealm `www` | CNAME to `searealm.com`. |
| SeaRealm email records | No MX records in GoDaddy's full eight-record list. Existing `_dmarc` TXT policy matches Cloudflare's import. |
| SeaRealm DNSSEC | GoDaddy shows **Turn On DNSSEC**, consistent with the earlier absence of public DS records. |
| Imported DNS | Two apex A records, `www` CNAME, `_domainconnect` CNAME, and `_dmarc` TXT. All four A/CNAME records were imported as proxied; TXT is DNS-only. |
| DNS correction completed | With explicit owner approval, `_domainconnect` was saved as DNS-only. Its CNAME target remains `_domainconnect.gd.domaincontrol.com`; verified in the saved DNS table. |
| Onboarding defaults | Bot Preference Sync remains enabled; Search, Agent, and Training crawler categories were set to Allow. |
| Deployed migration variables | `SITE_URL=https://searealm.com`; checkout allows SeaRealm only; both legacy redirect flags are `true`. Permanent redirect Worker version `8834d3f6-45ba-4ec6-8062-3d0f11e39c8c`; the preceding temporary phase was version `4e7f30f2-a20e-4f84-bdf6-6f60f7b22a0d`. |
| Automated verification | All 23 site identity, redirect, checkout-origin, and same-origin mutation tests pass. |
| SeaRealm edge redirect | Active rule `681b6fd9b3b7489a824f891a6516a1e9` sends HTTP apex and both `www` schemes to HTTPS apex with status `308`, preserving path and query. All three variants passed a public `/store?migration=check&item=1` request. |
| Supabase callbacks | Production project `ehlrzpcusxsbdsddyykm` allows both domains' exact `/auth/callback` and `/auth/callback?next=/adventure` URLs (four entries). Site URL is saved as `https://searealm.com`. |
| Magic-link template | Saved template uses `{{ .ConfirmationURL }}`. Owner verified a fresh email login on SeaRealm in the same normal browser. |
| Supabase email delivery | Owner saved custom SMTP. Dashboard confirms enabled, host `smtp.resend.com`, port `465`, sender `SeaPals`, 60-second per-user interval, and stored password. Owner received the sign-in email. |
| Real email login | Initial browser-handoff attempt returned `code_exchange_failed`. Owner then requested and opened a fresh email link entirely in the same normal browser and confirmed successful login on SeaRealm. |
| Admin protection | Unauthenticated requests to the existing site's orders, bug-reports, and survey-responses admin APIs return `401`. Cloudflare Zero Trust shows initial onboarding, with no existing Access application available to copy. App-level admin-token protection remains in place. |
| Dual-domain public checks | Home, Store, and Adventure return `200` on both apex hosts. All three admin APIs also return `401` on SeaRealm. SeaRealm renders the expected homepage artwork and Adventure login screen. |
| Canonical identity | Live homepage canonical, robots sitemap directive, and sitemap URLs use `https://searealm.com`. Home, Store, and Adventure return `200`. |
| Deployment configuration | Added SeaRealm's custom-domain route to local `wrangler.jsonc` to preserve it on future deployments; all 23 targeted tests pass after this change. The live attachment was made directly in Cloudflare without rebuilding the Worker. |
| Real Google login | Owner completed Google sign-in on SeaRealm; authenticated Adventure screen confirmed. Owner later noted this may not be the browser where they previously played. No save loss is established. |
| Cloud-save pilot | With explicit owner approval, installed the save/history tables, indexes, triggers, owner-only RLS, and a temporary restrictive policy named `SeaRealm owner pilot only`. That policy limits sync to the migration owner's existing account. After reload, all three SeaRealm slots show `Saved to account`; slots are still empty. Public rollout remains gated. |
| Live database verification | A rolled-back fixture verified owner read/update, revision archival, denial of cross-account read/update/insert, denial of non-pilot own-account insertion, anonymous read denial, private history, and direct-delete denial. No fixture saves were retained. This is database-role verification, not a full two-browser gameplay test. |
| History cleanup | Installed `pg_cron` job `adventure-save-history-prune`, active daily at `04:17 UTC`, invoking the pruning function as `service_role`. A manual invocation succeeded. The first scheduled run has not yet been observed. Current saves and tombstones are excluded from this cleanup. |
| Checkout guard checks | On both hosts, an empty same-origin cart returns `400 invalid_checkout_request_id`, cross-origin checkout returns `403`, unsigned webhook returns `400 Invalid signature`, and unsigned save reads return `401`. No orders or inventory were changed. |
| Additional automated checks | Cloud-save and checkout/webhook suites passed. Isolated paid/refund lifecycle is now verified below; cross-browser gameplay was confirmed by the owner. |
| Stripe webhook migrated | With explicit approval for the production routing change, saved active endpoint `we_1U4kjuE82MgJzjAx06e4EKNL` at `https://searealm.com/api/store/webhook`. Name `SeaPals Production Order Lifecycle`, API version `2026-07-29.dahlia`, and all 10 subscriptions are unchanged. The signing secret was not rotated. The older disabled seven-event endpoint remains untouched. |
| Signed webhook verification | Stripe delivered the smoke-test `checkout.session.expired` event to `https://searealm.com/api/store/webhook` at 07:38:37 Eastern with HTTP `200`, `received: true`, `processed: true`, and `merchantNotification: not_applicable`. The request identifies the exact unpaid smoke-test session and order. |
| Unpaid live checkout check | Owner approved accepting the purchase terms for one unpaid live session. Hosted Stripe Checkout opened for one Accessories Kit ($12) plus Standard Shipping & Handling ($10), with no customer or payment information entered. Stripe confirms `expired`, `unpaid`, no PaymentIntent, and SeaRealm success/cancel URLs. The Back link returned to SeaRealm's cancellation page. Order `SP-261002-83878C` now has payment status `failed` (the app's expired-unpaid state), inventory state `released`, and release reason `Stripe event: checkout.session.expired`. SKU `SP-ACC-SET` returned to its baseline of 10 on hand / 0 reserved. |
| Expiration and replay verified | Automatic expiration occurred October 2, 2026 at 11:38:36 UTC. The CLI lacked write permissions for expiration and replay; no permissions were expanded. The authenticated Stripe Dashboard allowed one replay at 07:50:01 Eastern. That delivery returned HTTP `200`, `processed: false`, and `merchantNotification: not_applicable`. A read-only SQL query confirmed exactly one processed expiration-event row, zero notification rows/sends, unchanged order update/release timestamps, and baseline stock after replay. Direct REST reads of the two private audit tables were denied, so verification used the existing SQL Editor access without adding grants. Exact identifiers and evidence are retained locally under `tmp/domain-migration/`. |
| Gameplay persistence | Owner created and saved a game under the same Gmail account, then confirmed on October 2 that the game appeared in a second browser. Actual cross-browser cloud-save synchronization is verified for the owner pilot. |
| Cloudflare capacity | Workers Paid is already active ($5/month minimum plus usage); the domain's separate Free zone plan does not mean the Worker is on the free tier. |
| GitHub broadcast URL | Repository variable `SITE_URL` is now `https://searealm.com`. Kit broadcast mode remains draft and the verified old-domain sender is retained. |
| Final authentication check | After changing Supabase's Site URL and enabling temporary redirects, the owner confirmed fresh Google and email-link sign-ins both still work. |
| Analytics | Existing stream `14699630171` is saved as `SeaRealm TCG` at `https://searealm.com`; measurement ID `G-WT26D58KF0` and history retained. |
| Final verification | All 2,311 tests pass. All 16 live checks passed in both temporary and permanent redirect phases. Legacy apex, HTTP, and `www` return path/query-preserving `301` with a one-hour cache; admin APIs remain protected, webhooks are not redirected, and new checkout is allowed only on SeaRealm. Production build passed; the Windows OpenNext deploy wrapper reported exit 1 despite Wrangler confirming successful uploads, routing deployment, and version IDs; live HTTP checks verify the actual result. |
| Public branding | SeaRealm text, metadata, header/Adventure/simulator logos, storefront labels, and rules aliases deployed. Reefbound remains the adventure title. Saved survey values, storage keys, SKUs, database/Worker identifiers, historical quotations, and the verified support address are preserved. Physical card artwork and some social/fallback assets still carry SeaPals. |

GoDaddy's complete eight-record list was compared with Cloudflare's five-record
import: both apex A records, both CNAME records, and the DMARC TXT value match.
The remaining three GoDaddy records are two provider NS records and its SOA;
Cloudflare supplies its own NS and SOA. All GoDaddy records had a one-hour TTL.
Supabase callback settings, SMTP, and real Google/email sign-ins are verified.
Google Cloud branding/origin settings have not been inspected separately.
Stripe's signed expiration delivery, duplicate handling, stock release, and
Checkout cancellation return are verified on SeaRealm. Paid success-return and
refund behavior were subsequently verified with Stripe test mode and the
isolated staging database described below. No real payment was made.

### Isolated paid checkout and refund verification

The owner created **SeaRealm Checkout Staging**, project
`rcbibkqonspvglluyiud`. Installed `supabase/store-orders.sql` there, confirmed
`check_store_inventory_contract_v7()`, and seeded only test SKU
`SP-ACC-CONDITIONS-DECK` at 10 on hand / 0 reserved. Production Supabase and
production inventory were not used by this paid test.

An isolated localhost server used the existing restricted Stripe test key,
cards-only payment configuration `pmc_1U4twwE82MgJzjAxBURdNDmt`, and a Stripe CLI
test webhook listener. Synthetic customer data and Stripe's test card completed
order `SP-261002-D0465D` (`df5f81e8-460f-462d-837d-c94a96a7f7e9`), totaling $15
including shipping. The signed completed event
`evt_1UM6YPE82MgJzjAx0hZLi9ba` returned `200`; the database recorded paid,
`livemode=false`, inventory committed, and stock 9 on hand / 0 reserved.
Stripe returned the browser to the confirmation page with the matching order.

A $5 test refund produced `partially_refunded`; a second $10 refund produced
`refunded` with `amount_refunded=1500` and two succeeded refund rows. Refunds
correctly did not automatically restock inventory. A locally signed replay of
the retrieved paid event returned `200`, `processed=false`. Final SQL confirmed
one paid-event row and exactly one sent merchant notification with one delivery
attempt and a provider ID. Its recipient was Resend's official
`delivered@resend.dev` simulator, not the merchant inbox. This local signed replay
is distinct from the production Dashboard expiration replay verified above.

The confirmation check exposed an existing 80-character receipt-URL truncation
bug. A dedicated Stripe HTTPS receipt-URL parser now preserves long links and
rejects unsafe destinations; regression tests cover both behaviors. The
rendered Stripe receipt link retained all 156 characters. Both the test server
and webhook listener were stopped after verification. Evidence, exact session
IDs, and credentials remain in ignored `tmp/domain-migration/`; never commit
that directory.

### Remaining cutover and rollout work

1. Search Console opened without any verified website in the signed-in Google
   account. A SeaRealm domain property is prepared but unverified; owner approval
   for DNS verification of both domains is pending. Submit the new sitemap and
   eligible Change of Address requests after verification. No DNS verification
   record or Google-to-Cloudflare delegation was added.
2. Inspect Google OAuth public branding and review Kit links/templates. Kit
   requires sign-in; no forms, subscriptions, or broadcasts were changed.
3. Keep the owner-only cloud-save restrictive policy until the public-rollout
   review in `docs/adventure-account-setup.md` is complete. Cross-browser sync
   for the owner is verified; broad public access is a separate rollout.
4. Finish old branding in artwork/social assets and provider email/receipt
   labels. Provision and verify the new email identity before replacing the
   working `maker@seapalstcg.com` address. Old local-only saves still require
   their original browser/device to synchronize.

Repeat the automated checks with:

```powershell
node --test src/lib/siteIdentity.test.mjs src/lib/siteRedirect.test.mjs src/lib/store/checkoutOrigin.test.mjs src/lib/sameOriginMutation.test.mjs
```

References: [Cloudflare zone onboarding](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/),
[GoDaddy nameserver changes](https://www.godaddy.com/help/change-my-domain-nameservers-664).

## Configuration states

| Setting | Dual-domain validation | Final cutover |
| --- | --- | --- |
| `SITE_URL` | `https://seapalstcg.com` | `https://searealm.com` |
| `CANONICAL_SITE_ORIGIN` in `src/lib/siteIdentity.mjs` | SeaPals origin | SeaRealm origin |
| `STORE_CHECKOUT_ALLOWED_ORIGINS` | Both apex origins | SeaRealm only |
| `SITE_LEGACY_REDIRECT_ENABLED` | `false` | `true` |
| `SITE_LEGACY_REDIRECT_PERMANENT` | `false` | `false` for smoke testing, then `true` |
| Stripe webhook URL | Existing SeaPals endpoint | Existing endpoint updated to SeaRealm before redirects |
| Supabase Site URL | SeaPals origin | SeaRealm origin |

Do not enable the legacy redirect while `SITE_URL` still points to SeaPals. Do
not add `www`, preview, or `workers.dev` origins to the checkout allowlist; those
hosts should redirect before the application renders.

## 1. Prepare Cloudflare and TLS

1. Add `searealm.com` to the Cloudflare account that owns the `seapals` Worker
   and complete the authoritative-nameserver setup. This does not require
   Cloudflare to be the registrar.
2. Attach `searealm.com` as a Worker custom domain. Wait for Cloudflare to issue
   its certificate, then verify HTTPS directly.
3. Create a Cloudflare Redirect Rule for `www.searealm.com` that preserves path
   and query while sending it to `https://searealm.com`. Add the required
   proxied placeholder DNS record, but do not attach `www` as another Worker app
   origin. Keep this apex redirect active throughout validation and cutover.
4. Enable Cloudflare Always Use HTTPS, or an equivalent edge rule, on both
   zones. Smoke-test HTTP and HTTPS for apex and `www`, with a deep path and
   query. A two-hop old HTTP to old HTTPS to SeaRealm redirect is acceptable.
5. Keep the SeaPals apex attached to the Worker. Ensure its `www` alias either
   reaches the tested legacy redirect or uses its own path-preserving edge rule.
   The final application redirect can only answer for hostnames routed to it.
   The current SeaPals configuration routes `www.seapalstcg.com/*` to the Worker
   solely for this canonical redirect; it must remain out of checkout and auth
   allowlists and must never render as an application origin.
6. Duplicate hostname-specific Cloudflare controls for SeaRealm, especially
   Access coverage for `/admin/*` and `/api/admin/*`, plus any dashboard WAF or
   rate-limit rules. The checkout rate-limit binding in `wrangler.jsonc` follows
   the Worker automatically; dashboard zone rules do not.

References: [Worker custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/),
[Cloudflare redirects](https://developers.cloudflare.com/rules/url-forwarding/).

## 2. Prepare authentication before testing

In Supabase Authentication > URL Configuration:

- retain the existing SeaPals callbacks;
- add the exact `https://searealm.com/auth/callback` and
  `https://searealm.com/auth/callback?next=/adventure` URLs (the latter is used
  by the current adventure login flow);
- leave the Site URL on SeaPals until the final cutover; and
- inspect the magic-link template to ensure it preserves Supabase's confirmation
  token and honors the requested `RedirectTo`. The default
  `{{ .ConfirmationURL }}` does this; a raw redirect link does not authenticate.

For Google OAuth, keep Google's authorized redirect URI set to Supabase's
`https://<project-ref>.supabase.co/auth/v1/callback`. In that production Web
client's authorized JavaScript origins, retain `https://seapalstcg.com` and add
`https://searealm.com` for the migration. Verify the new domain and update the
public OAuth-brand homepage/privacy/terms URLs. Keep localhost on a separate
development OAuth client/project rather than the production verified client. A
public brand change may require Google verification.

Supabase auth, PKCE, pending-approval cookies, local saves, carts, and checkout
state are host-scoped. They cannot be shared between two unrelated root
domains. Existing accounts and cloud saves remain in the same Supabase project,
but users must start a fresh sign-in on SeaRealm. An OAuth attempt or magic link
started on SeaPals before cutover cannot finish seamlessly on SeaRealm: even if
the old callback exchanges its code, the resulting session and pending setup
cookie remain on SeaPals. Ask the user to begin again on SeaRealm and issue a
fresh link.

Reference: [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## 3. Deploy and validate both apex domains

Deploy the staged configuration with:

- `SITE_URL=https://seapalstcg.com`;
- `STORE_CHECKOUT_ALLOWED_ORIGINS=https://seapalstcg.com,https://searealm.com`;
- `SITE_LEGACY_REDIRECT_ENABLED=false`;
- `SITE_LEGACY_REDIRECT_PERMANENT=false`.

Then validate both apex domains:

- pages, assets, metadata, and same-origin API requests load over HTTPS;
- every `www` request reaches its apex before rendering and all HTTP variants
  upgrade to HTTPS while retaining path and query;
- a real Google login and a real magic link start and finish on the same host;
- cloud saves remain attached to the same user after the one-time SeaRealm
  reauthentication;
- a checkout initiated on each hostname receives Stripe success and cancel URLs
  on that same hostname; and
- cancel returns to that host with its cart and checkout request intact for a
  retry, while success clears those values on that host.

Use the isolated Stripe test-mode procedure in `docs/storefront-setup.md` for
routine checkout validation. The production Worker currently has live checkout
enabled, so do not use production inventory for repeated smoke tests.

The checkout guard deliberately requires both an exact deployment allowlist
match and `Origin === new URL(request.url).origin`. Adding SeaRealm therefore
does not create cross-origin CORS access and does not authorize Worker previews.
All indexable public pages emit a SeaPals canonical during this phase. Keep
SeaRealm out of search submissions until cutover; Cloudflare Access or a
temporary `X-Robots-Tag: noindex` response rule provides additional protection
if the preview URL could become public.

## 4. Move the Stripe webhook without redirecting it

Stripe treats a `3xx` webhook response as a failed delivery and retries live
events. Each webhook endpoint also has its own signing secret, so avoid creating
a second concurrent endpoint unless the application is first changed to verify
multiple secrets.

Use this lower-risk sequence:

1. Keep the existing endpoint at
   `https://seapalstcg.com/api/store/webhook` throughout dual-domain testing.
2. After SeaRealm serves the same verified handler, update that existing Stripe
   endpoint's URL to `https://searealm.com/api/store/webhook`. Keep its enabled
   event types and pinned API version unchanged.
3. Confirm the endpoint's signing secret still matches the deployed
   `STRIPE_WEBHOOK_SECRET` and send a Workbench test event.
4. Verify a signed event returns `2xx`, an invalid signature returns `400`, and a
   replay produces no second ledger transition or merchant notification.
5. Only after that succeeds, enable the old-host browser redirect.

The Worker redirect excludes `/api/*`, `/auth/*`, and every non-GET/HEAD
request. Never replace that protection with a blanket host redirect. The auth
exception prevents callback codes from being rewritten, but it does not bridge
host-scoped auth state; old in-flight sign-ins must be restarted on SeaRealm.
Old Checkout Sessions contain immutable return URLs and can remain open for
roughly one hour, so keep old-host TLS and path/query-preserving GET redirects
available long term.

Reference: [Stripe webhook best practices](https://docs.stripe.com/webhooks).

## 5. Perform the canonical cutover

Use this reviewed sequence:

1. Change `CANONICAL_SITE_ORIGIN` in `src/lib/siteIdentity.mjs` to
   `SEAREALM_SITE_ORIGIN`, and update the staged canonical assertion in
   `src/lib/siteIdentity.test.mjs`.
2. Change `SITE_URL` in `wrangler.jsonc` to `https://searealm.com`.
3. Narrow `STORE_CHECKOUT_ALLOWED_ORIGINS` to `https://searealm.com`. An old
   stale tab will show the checkout error; ask the user to reload manually on
   SeaRealm rather than creating a new Session whose browser state belongs to
   the legacy host.
4. Set `SITE_LEGACY_REDIRECT_ENABLED=true` while keeping
   `SITE_LEGACY_REDIRECT_PERMANENT=false`.
5. Keep `SITE_LEGACY_ORIGINS` limited to `seapalstcg.com` and
   `www.seapalstcg.com`; the separate Cloudflare rule owns SeaRealm `www`.
6. Build, run the domain/checkout tests, deploy, and repeat the checkout/auth
   smoke tests. This first redirect is a non-cached `302`, so rollback remains
   immediate.
7. During this rollback-safe `302` phase, remove any preview-only whole-host
   Access policy or `X-Robots-Tag: noindex` rule. Verify the public SeaRealm
   canonical tags, `/robots.txt`, and `/sitemap.xml`. Change the Supabase Site
   URL to SeaRealm and repeat real Google and magic-link sign-ins. The exact old
   callback may remain briefly for rollback and diagnostics, but it does not
   make already-issued links portable; direct users to start a fresh SeaRealm
   sign-in.
8. After those public and auth tests succeed, set
   `SITE_LEGACY_REDIRECT_PERMANENT=true` and deploy the path-preserving `301`.
   Its current public cache lifetime is one hour, so another rollback will not
   be immediate for every client.
9. Update the existing GA4 web stream URL/name while retaining measurement ID
   `G-WT26D58KF0` for continuity. A clean old-to-new redirect does not need GA4
   cross-domain linker configuration, although GA cookies and client identity
   reset across the unrelated root domains.
10. Set the GitHub Actions repository variable `SITE_URL` to
   `https://searealm.com` before the next art-drop broadcast, and review Kit
   forms, confirmation messages, automations, and templates for old links.
11. Verify the eligible old/new apex and `www` properties in Search Console,
    submit `https://searealm.com/sitemap.xml`, and use Change of Address after
    the 301s are live. Submit the relevant old-apex and old-`www` moves
    separately because a request for one source host does not move its sibling
    subdomain. Monitor redirects, `404`s, auth failures, Checkout returns, and
    webhook deliveries.

The final Worker response is a path- and query-preserving `301` for legacy
GET/HEAD requests. This preserves the receipt URL for an already-open Checkout
Session such as `/store/success?session_id=...` while leaving server-to-server
traffic intact. Browser storage does not cross domains: an old success return
cannot clear the old cart/idempotency keys, but the SeaRealm success page will
clear any SeaRealm cart/request state already present in that browser. An old
canceled Session leaves its legacy cart behind and cannot carry it to SeaRealm.
Ask canceled customers to rebuild the cart on the new host. Keep the public GET
redirect indefinitely.

## 6. Migrate email identity separately

The verified operational mailbox remains `maker@seapalstcg.com` even after the
website cutover. Do not change it merely because the canonical URL changes.

Before switching to `maker@searealm.com`:

- provision and test the mailbox or forwarding route;
- verify the SeaRealm sending domain in Resend and publish valid SPF, DKIM, and
  DMARC records;
- update and test Supabase SMTP, Stripe public/receipt/support details, Kit's
  verified sender, and the GitHub Actions `KIT_FROM_EMAIL` variable;
- change `PUBLIC_SUPPORT_EMAIL` in `src/lib/siteIdentity.mjs` and the production
  `EMAIL_FROM`/`STORE_ORDER_NOTIFICATION_EMAIL` variables; and
- keep the old address as a monitored alias.

## 7. Treat branding as a separate decision

Domain readiness does not decide whether the public product is named SeaRealm,
SeaPals TCG, Reefbound, or a hierarchy of those names. Stable technical
identifiers such as the Worker name, package name, database tables, SKUs,
storage keys, cookies, and Stripe idempotency keys should not be renamed during
the hostname cutover. Replace logos, copy, social images, and customer-facing
Stripe/email labels only after the brand hierarchy and replacement assets are
approved.
