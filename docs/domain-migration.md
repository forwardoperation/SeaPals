# SeaRealm domain migration runbook

This runbook moves the existing Cloudflare Worker application from
`seapalstcg.com` to `searealm.com` without treating a DNS alias as an application
cutover. The code is intentionally staged so both apex domains can be tested
before SeaRealm becomes canonical.

The registrar and authoritative DNS provider are separate choices. The domain
may be registered at GoDaddy or Namecheap while Cloudflare remains authoritative
DNS for a Worker custom domain. A standard Cloudflare Worker custom domain
requires the domain's zone and DNS to be active in the same Cloudflare account as
the Worker.

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

- retain `https://seapalstcg.com/auth/callback` and the localhost callback;
- add the exact `https://searealm.com/auth/callback` path;
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
