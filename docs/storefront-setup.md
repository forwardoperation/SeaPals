# SeaPals storefront setup

The storefront is prepared through the payment-account handoff and is safe by
default. Visitors can browse the prelaunch catalog, but no item can enter the
cart and no payment can start until its product ID is explicitly allowlisted,
the private order ledger and Stripe webhook are ready, and the launch switch is
turned on.

## Twelve-product prelaunch catalog

The first public catalog is deliberately limited to the `$44` Starter Kit,
seven `$22` ready-to-play decks, the `$12` Accessories Kit, and three `$5`
individual gameplay accessories: the Conditions Deck, Dice Pack, and Reef
Point (RP) Token Set. Future apparel, storage, and plush products are hidden by
default.

All twelve draft prices are server-controlled, and the owner has approved a
standard build-and-dispatch window of five business days for every launch SKU.
The optional expedited choice adds $10 once per order for build and dispatch
within one business day, subject to a hard limit of 10 expedited orders per
Eastern-time production due date; carrier transit time is separate. Exact packaged
counts for the Conditions Deck, Dice Pack, and RP Token Set still need to be
confirmed before publication. The Pennsylvania license supplied by the owner
satisfies the storefront's government-registration confirmation gate. Stripe
Automatic Tax is required for mailed orders; scheduled Elverson pickup uses a
separately verified fixed manual Tax Rate. Checkout remains off until the sellable
catalog, made-to-order capacity, packaged shipping rates, pickup sourcing, live
webhook, deployment secrets, and end-to-end order lifecycle are also ready.

The `$44` Starter Kit can remain the first local sandbox purchase. The payment
flow is:

1. SeaPals validates the cart and price on the server.
2. Stripe-hosted Checkout collects payment and, for mailed orders, the delivery
   address. Pickup orders do not request a shipping address.
3. A signature-verified Stripe webhook updates the private Supabase order
   ledger, atomically queues one merchant purchase alert, and immediately tries
   to send that alert through Resend. A five-minute Cloudflare Cron Trigger
   independently drains anything still pending; the browser success page never
   authorizes fulfillment.
4. The alert separates production speed from carrier service and includes every
   purchased item and quantity, totals, and the selected shipping or scheduled
   pickup method. Pickup customers are contacted after the build to arrange a
   time.
5. Test payments remain in Stripe's sandbox and never settle. After the
   lifecycle passes, separate live credentials and a live webhook are used,
   and Stripe pays the live balance to the configured business settlement
   account.

Checkout uses Stripe's Dashboard-managed dynamic payment methods and tags each
Session with `seapals_store_web_kvqzrmta` so this storefront flow can be
measured separately in Stripe.

## What is included

- `/store`: responsive prelaunch catalog grouped into Starter Kits, Expansion
  Decks, and Game Accessories. Future concepts require an explicit private
  preview switch.
- `/api/store/checkout`: server-priced cart validation and Stripe-hosted
  Checkout. Payment credentials never pass through SeaPals servers.
- `/api/store/webhook`: raw-body Stripe signature verification plus
  idempotent payment, failure, expiration, refund, dispute hold, receipt,
  address recording, and immediate merchant purchase-alert delivery.
- `custom-worker.mjs`: the generated OpenNext fetch handler plus a five-minute
  private outbox drainer, so alert recovery does not depend on Stripe's webhook
  retry window.
- `/admin/orders`: a token-protected shipping and Elverson pickup workspace with
  immutable product, price, and fulfillment-method snapshots; receipt and
  Stripe references; tracking; private notes; and a shipping-only CSV export.
- `supabase/store-orders.sql`: private orders, items, payment-event idempotency,
  durable receipt references, fulfillment state, and a private notification
  outbox with lease-based concurrent-claim prevention and a private pending-row
  listing RPC for the scheduled drainer.
- `npm run store:check` and `npm run store:check:online`: launch-readiness checks.

SeaPals stores order, customer contact, delivery, total, payment state,
processor references, receipt references, and fulfillment records. Stripe hosts
the payment page and retains the underlying payment record.

## Catalog prices pending owner approval

SeaPals Credits are intentionally excluded. The repository currently uses
these server-controlled cash-price defaults, but no authoritative pricing sheet
is present locally. The owner must approve them before the live catalog gate is
enabled:

| Product | Configured price | Included |
| --- | ---: | --- |
| Starter Kit | $44 | Coral Garden 60 Card Deck, Blue Water 60 Card Deck, Conditions Deck, Dice Set, and Reef Point Tokens |
| Each Expansion Deck | $22 | One 60-card ready-to-play deck |
| Accessories Kit | $12 | Conditions Deck, Dice Pack, and Reef Point Tokens |
| Conditions Deck | $5 | Packaged card count must also be confirmed |
| Dice Pack | $5 | Dice types and quantities must also be confirmed |
| Reef Point (RP) Token Set | $5 | Tokens per set must also be confirmed |

The seven Expansion Decks are Blue Water, Coral Garden, Murky Water,
Disruption, Stinging Fortress, Darkness Shroud, and Open Ocean. Each code
manifest resolves to exactly 60 cards. The local print-sheet folder contains a
sheet set for every deck, but physical parity and either finished stock or
owner-approved made-to-order capacity must still be checked before launch.

Future Custom T-Shirt, Card Binder, Backpack, and Plush Toy concepts are hidden
unless `STORE_SHOW_FUTURE_PRODUCTS=true`. Custom T-Shirts remain locked even if
priced because checkout does not yet collect size, color, or customization
choices.

## 1. Create the private order ledger

Open the Supabase SQL editor for the existing SeaPals project and run:

`supabase/store-orders.sql`

Do not seed capacity merely because the schema has been applied. During the
checkout-disabled production cutover, follow
`docs/store-inventory-operations.md` to drain any legacy payment sessions and
then run the non-replenishing `supabase/store-launch-capacity.sql` seed. It
creates the twelve launch SKU rows at the owner's approved ATP limit of 10 and
leaves existing rows untouched on reruns.

It is safe to rerun when this branch changes: the script adds missing catalog
and receipt columns and replaces the payment-event function. The tables have
row-level security enabled and deny the public `anon` and `authenticated`
roles. Store routes use the server-only service-role key. Never expose
`SUPABASE_SERVICE_ROLE_KEY` to browser code.

## 2. Verify the live Stripe account

A normal direct Stripe account with hosted Checkout is enough. Stripe Connect,
paid Invoicing, and a custom Checkout domain are not needed. On 2026-08-13, a
read-only live-account check confirmed that Stripe reports business details
submitted, charges enabled, payouts enabled, and a settlement account present.
No account, person, bank, or license identifiers are stored in this repository.

The owner should still keep legal and customer-facing details aligned with the
business, clear any new Dashboard requirements, review the statement
descriptor and support contact, and enable strong two-factor authentication.
Stripe's requests are dynamic, so the Dashboard remains authoritative. Never
put identity, tax, license, or banking data in this repository or in chat.

Stripe also reviews the public website. Before live activation, publish accurate
business/product details, USD prices, direct contact information, shipping and
delivery terms, return/refund/cancellation terms, a privacy notice, and any
promotion terms. The owner must approve these business promises; they should
not be invented in code.

Official references: [account setup](https://docs.stripe.com/get-started/account/set-up),
[account checklist](https://docs.stripe.com/get-started/account/checklist), and
[website checklist](https://docs.stripe.com/get-started/checklist/website).

## 3. Configure Stripe in test mode

Copy `.env.example` to the local/deployment secret store and set:

- `SITE_URL` (the server-only canonical origin; use the final HTTPS origin in
  production)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- the existing Supabase URL and service-role key
- a strong, unique `STORE_ADMIN_TOKEN` of at least 32 characters
- `RESEND_API_KEY`, a verified-domain `EMAIL_FROM`, and the explicit private
  `STORE_ORDER_NOTIFICATION_EMAIL`
- `STORE_ORDER_NOTIFICATION_ENABLED=true` to exercise alerts in sandbox
- `STORE_ORDER_NOTIFICATION_DELIVERY_CONFIRMED=true` only after a synthetic
  alert reaches the private inbox; this owner gate is required in live mode

`NEXT_PUBLIC_SITE_URL` remains a legacy fallback, but new deployments should
prefer `SITE_URL` so the canonical store origin is not compiled into browser
JavaScript.

Prefer a restricted sandbox key (`rk_test_...`) named `SeaPals storefront
sandbox`. Start every permission at **None**, then grant:

- **Checkout Sessions: Write** (create, retrieve, and expire Sessions)
- **Payment Intents: Read** (retrieve the Stripe-hosted receipt reference)
- **Charges: Read** (read the expanded charge and hosted receipt link)
- **Account: Read** (used only by `npm run store:check:online`)
- **Tax Settings: Read** (verify Stripe Tax is active)
- **Tax Registrations: Read** (verify the active Pennsylvania registration)
- **Tax Rates: Read** (verify the fixed Elverson pickup rate when pickup is
  enabled)
- **Payment Method Configurations: Read** (verify the dedicated launch
  configuration before production handoff)

If Stripe returns a permission error, use that key's request logs to identify
the exact missing resource instead of granting broad access. Keep every other
permission at **None**. Store the key only in `.env.local` or the deployment
secret vault, never in source control or chat. Validate the final permissions
with `npm run store:check:online`.

Create a dedicated Stripe Dashboard payment-method configuration for this
storefront and enable only methods whose Checkout payment result is synchronous
at launch. Save its `pmc_...` ID as
`STRIPE_PAYMENT_METHOD_CONFIGURATION_ID`. The production account's default
configuration currently exposes delayed or asynchronous methods, so it must not
be used with one-hour inventory reservations. Checkout stays closed when the
dedicated configuration is missing. Keep dynamic payment methods—do not
hard-code `payment_method_types` in the API request.

After reviewing every method enabled in that dedicated configuration, set
`STORE_SYNCHRONOUS_PAYMENT_METHODS_CONFIRMED=true`. The online readiness check
proves the `pmc_...` resource is active and belongs to the correct Stripe mode;
it does not infer settlement timing from arbitrary current or future payment
methods. The owner gate therefore remains mandatory for live credentials.

Create a test webhook endpoint for:

`https://YOUR_DOMAIN/api/store/webhook`

Pin it to Stripe API version `2026-07-29.dahlia` and subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `payment_intent.payment_failed`
- `charge.refunded`
- `charge.dispute.created`

Only a signature-verified webhook moves an order to paid. The success page is
informational and never authorizes fulfillment. For local testing, use Stripe
CLI forwarding to `http://localhost:3000/api/store/webhook` and use the
temporary `whsec_...` it prints only for that local listener. Test and live
webhook signing secrets are separate.

## 4. Configure products, production, inventory, and shipping

The canonical launch and proposed-future SKU registry is documented in
`docs/store-sku-policy.md`. Product IDs drive browser carts; stable SKUs drive
inventory reservations, immutable order snapshots, fulfillment, and reporting.

Prices are positive integer cents. Established products have safe source
defaults; every price can still be overridden with the matching
`STORE_PRICE_*_CENTS` key in `.env.example`. Set unpriced merchandise only after
its final SKU and retail price are known.

Set `STORE_AVAILABLE_PRODUCT_IDS` to a comma-separated list of reviewed product
IDs, for example:

`starter-kit,blue-water,disruption,coral-garden,darkness-shroud,open-ocean-hunt,murky-water,stinging-fortress,accessory-set,conditions-deck,dice-pack,reef-point-tokens`

There is deliberately no `all` wildcard. The server rejects unknown,
unavailable, client-priced, over-quantity, or stale cart items. Add a product
only after its inventory, packaging, contents, price, tax treatment, and
fulfillment procedure are verified. Live mode also requires the independent
`STORE_CATALOG_CONFIRMED=true` owner gate; keep it false until every allowlisted
SKU has verified finished stock or owner-approved made-to-order ATP capacity,
packaged contents, an approved price, a published build-and-dispatch window,
and a repeatable fulfillment procedure. The owner accepted the current
representative art on 2026-08-15 and deferred packaged-product photography, so
photography is not a launch gate.

Production speed is selected once for the whole order:

| Production option | Additional charge | Build-and-dispatch promise |
| --- | ---: | --- |
| Standard production | $0 | Within 5 business days |
| Expedited production | $10 per order | Within 1 business day |

`STORE_EXPEDITED_PRODUCTION_ENABLED` controls whether customers can select the
expedited option. Keep `STORE_EXPEDITED_PRODUCTION_CENTS=1000` and
`STRIPE_PRODUCTION_TAX_CODE=txcd_92010004`, Stripe's exact Handling Charge tax
code. The enforced launch settings are
`STORE_EXPEDITED_PRODUCTION_DAILY_ORDER_LIMIT=10` and
`STORE_EXPEDITED_PRODUCTION_TIME_ZONE=America/New_York`. Live readiness fails
closed if either value changes or is absent. It also requires
`STORE_EXPEDITED_PRODUCTION_CAPACITY_CONFIRMED=true` while expedited production
is enabled. The owner has confirmed a hard 10-order daily limit; the 10-unit
per-SKU ATP rows remain a separate unit constraint.

Each expedited order consumes one slot, regardless of its item count. Checkout
assigns that slot atomically to the next Monday-through-Friday production due
date using `America/New_York`: a Friday, Saturday, or Sunday order targets
Monday. The calendar boundary is Eastern midnight. Abandoned Sessions release
their slot only after a terminal unpaid/expired outcome is verified. Paid,
refunded, and disputed orders continue to consume their slot. Public holidays
are not modeled, so disable expedited selection or adjust operations before a
closure makes the next-business-day promise unsafe. Existing expedited orders
remain promises that must still be honored or resolved directly with the
customer.

Expedited production advances the build queue only. It does not select faster
carrier service or guarantee delivery within one day. The $10 fee appears once
per order regardless of its item count; do not fold it into a product price or
create a rush SKU.

Keep `STRIPE_ALLOW_PROMOTION_CODES=false`. The readiness checker fails closed
if it is enabled because the private order ledger does not yet reconcile a
`discount_cents` field against Stripe Checkout's
`total_details.amount_discount`. Add and verify that reconciliation before
offering any promotion code, or staff totals can disagree with Stripe.

Keep `STORE_SHOW_FUTURE_PRODUCTS=false` for the launch store. Run
`npm.cmd run store:check:launch` to verify the exact twelve-product allowlist
and server-controlled prices.

The owner-approved fulfillment choices and conservative weight tiers are
server-controlled:

| Option | Up to and including 1 lb (16 oz) | More than 1 lb through 8 lb (128 oz) | Checkout behavior |
| --- | ---: | ---: | --- |
| Standard Shipping & Handling | $10.00 | $20.00 | Collects a US delivery address; economy carrier service is estimated at 2–7 business days in transit after production |
| Priority Shipping & Handling | $15.00 | $35.00 | Collects a US delivery address; USPS Priority Mail is estimated at 2–3 business days in transit after production |
| Scheduled pickup — Elverson, PA | Free | Free | No time is chosen at Checkout; after production, Sea Realm emails the customer to arrange a time and privately shares the address/instructions |

Configure the base tier with `STORE_STANDARD_SHIPPING_CENTS` and
`STORE_PRIORITY_SHIPPING_CENTS`, and the higher tier with
`STORE_LARGE_STANDARD_SHIPPING_CENTS` and
`STORE_LARGE_PRIORITY_SHIPPING_CENTS`. `STORE_SHIPPING_CENTS` remains only as a
legacy Standard base-rate fallback.

Checkout uses the catalog's conservative `shippingWeightOunces`: 8 ounces for
each deck and 16 ounces for each Starter Kit or accessory SKU. It sums quantity
times weight, selects the base tier through 16 ounces and the higher tier above
16 ounces, and rejects orders above 8 items or 128 ounces. Never accept a
client-supplied weight or use an unpackaged product weight for tier selection.

The shipping approval and Pirate Ship evidence were recorded on 2026-08-15 for
Elverson 19520 to Los Angeles 90001:

| Confirmed ready-to-mail parcel | Weight and outside dimensions | Economy postage | Priority postage | Economy / Priority incl. $0.75 box |
| --- | --- | ---: | ---: | --- |
| One 60-card deck | 0.5 lb; 8 × 6 × 2 in | $6.23 | $13.48 | $6.98 / $14.23 |
| One Starter Kit | 1 lb; 10 × 8 × 2 in | $8.76 | $13.48 | $9.51 / $14.23 |
| Maximum 8-item cart | 8 lb; 20 × 14 × 6 in | $18.86 | $33.04 | $19.61 / $33.79 |

The quoted postage excludes the $0.75 brown box shown in the final column.
These are estimates rather than carrier guarantees. Automated tests cover the
16-ounce tier boundary and the 8-item/128-ounce rejection; production therefore
uses `STORE_SHIPPING_RATES_CONFIRMED=true`. Re-run those tests and reconfirm the
gate whenever weights, carton sizes, carrier services, or rates change. Keep
`STORE_ALLOWED_COUNTRIES=US` for the initial launch unless
international tax, customs, pricing, and delivery are ready.

Set `STORE_LOCAL_PICKUP_ENABLED=true` to publish the free option. Checkout does
not collect a calendar slot or publish a street address. The purchase alert and
private order workspace provide the customer email so the owner can arrange a
time after the order is built. Do not mark the order Ready for Pickup or share
instructions until that time is agreed.

## 5. Decide how tax will be handled

`STORE_TAX_REGISTRATION_CONFIRMED` and `STRIPE_AUTOMATIC_TAX` are both off by
default. Only the owner should set the first value to `true`, and only after the
government registration is active. Live checkout requires both values so mailed
orders use the implemented Automatic Tax path. Scheduled pickup additionally
requires its separately confirmed fixed manual Tax Rate.
Before enabling automatic tax, record the active Pennsylvania registration in
Stripe Tax and confirm it shows as **Collecting**; this records an existing
registration and does not register the business with Pennsylvania. Then use
Stripe Tax codes that have been verified for the actual products and shipping:

- `STRIPE_GAME_PRODUCT_TAX_CODE`
- `STRIPE_SHIPPING_TAX_CODE`
- `STRIPE_PRODUCTION_TAX_CODE`
- `STRIPE_APPAREL_TAX_CODE`
- `STRIPE_STORAGE_TAX_CODE`
- `STRIPE_PLUSH_TAX_CODE`

`STRIPE_PRODUCT_TAX_CODE` is a supported global fallback, but category-specific
codes are safer for a mixed catalog. Checkout stays closed when automatic tax
is requested without owner confirmation, when live mode does not enable
automatic tax, or when any available product or shipping lacks a valid code.
Stripe Tax may be a paid service; enabling calculation does not create a
government registration or replace tax-registration advice. Do not weaken these
fail-closed gates without implementing and testing an equivalent tax path.

For taxable Pennsylvania card orders, the expedited handling fee is part of the
taxable purchase price even when separately stated. Pennsylvania's regulation
expressly includes handling and labor/service charges; see [61 Pa. Code
§ 33.2](https://www.pacodeandbulletin.gov/Display/pacode?d=reduce&file=%2Fsecure%2Fpacode%2Fdata%2F061%2Fchapter33%2Fs33.2.html)
and the statutory [purchase-price definition in Tax Reform Code
§ 201(g)](https://www.legis.state.pa.us/WU01/LI/LI/US/htm/1971/0/0002.002.000.001.000..htm).
Stripe's [canonical tax-code list](https://docs.stripe.com/tax/tax-codes) names
`txcd_92010004` as **Handling Charge**. Model it as its own Checkout line item
so Stripe Tax can apply each jurisdiction's handling rules and the ledger can
reconcile the per-order fee independently.

As of 2026-08-13, the live Stripe account's Tax Settings status was verified as
active and its US/PA `state_sales_tax` registration was verified as active. No
account or registration identifiers are recorded here. `npm run
store:check:online` reads those two resources again on every online readiness
run, and a live run fails when owner confirmation is true but either live state
is no longer active.

Use [the Pennsylvania sales-tax operations checklist](pa-sales-tax-operations.md)
for myPATH, display, filing, reconciliation, records, resale-certificate, and
other-state nexus tasks. It deliberately contains no license or account IDs.

Shipped orders use Stripe Automatic Tax. Pickup is handed over at the fixed
Elverson location, so its Checkout path intentionally disables Automatic Tax
and applies one separately configured, exclusive manual Stripe Tax Rate to every
product and any expedited-production line. Before setting
`STORE_PICKUP_TAX_CONFIRMED=true`, create and verify an active 6% US/PA Tax Rate,
store its `txr_...` ID as `STRIPE_PICKUP_TAX_RATE_ID`, and test the resulting
Checkout total. Checkout fails closed while either value is missing. Reconcile
manual pickup tax from Checkout exports alongside Stripe Tax's automatic-tax
reports; the two reporting paths are separate.

[Pennsylvania's local-sales-tax guidance](https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/sales-use-and-hotel-occupancy-tax/local-sales-tax)
says Act 21 of 2026 changes applicable Philadelphia and Allegheny County local
tax collection to the purchaser's delivery destination beginning 2026-10-01.
The expected totals for a taxable sale are 6% elsewhere in Pennsylvania, 7% in
Allegheny County, and 8% in Philadelphia. On 2026-08-13, representative Stripe
sandbox calculations still returned 6% for all three destinations. Re-test the
6%/7%/8% cases after Stripe publishes the rule update and again before taking
orders on or after 2026-10-01; do not treat the current sandbox result as proof
that the future local rates are configured.

## 6. Test the complete lifecycle

Keep `STORE_CHECKOUT_ENABLED=false` while preparing the store. Then:

1. Run the SQL and add Stripe/Supabase test credentials.
2. Allowlist only test-ready products and set realistic Standard and Priority
   shipping amounts.
3. Run `npm.cmd run store:check`, `npm.cmd run store:check:launch`, and
   `npm.cmd run store:check:online`.
4. Set `STORE_CHECKOUT_ENABLED=true` locally.
5. Complete a successful Stripe test Checkout and verify the signed webhook
   creates a paid order in `/admin/orders`.
6. Test Standard and expedited production with Standard, Priority, and free
   Scheduled pickup. For pickup, verify the configured manual tax is exactly 6%,
   no shipping address or appointment slot is requested, and the confirmation
   says the owner will email to arrange a time.
7. Verify one paid event creates exactly one purchase alert at the configured
   merchant address. Confirm it lists every item and quantity, labels expedited
   production separately from Priority shipping, includes the fulfillment
   details, and lets the owner reply to the customer. Replay the same webhook
   and verify the already-sent database row suppresses an immediate duplicate;
   simulate one delivery failure and verify the five-minute scheduled drainer
   sends the pending outbox entry without replaying Stripe manually.
8. Verify the expedited fee appears exactly once on a multi-item order, uses the
   handling tax code, and records a one-business-day production promise without
   describing carrier delivery as one day. Verify the eleventh expedited order
   for one production due date is rejected, Friday through Sunday share Monday's
   slots, and a terminal unpaid/expired Session releases its slot. Also test a
   decline, partial/full refund, dispute hold, packing update, tracking entry,
   shipped update, pickup scheduling notes, Ready for Pickup, Picked Up, and the
   shipping-only CSV export.
9. Run the application checks:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run cloudflare:build
```

After the physical catalog audit passes, set `STORE_CATALOG_CONFIRMED=true`.
This gate is required only for live credentials, so it does not block sandbox
lifecycle testing.

## 7. Receipts and fulfillment

In Stripe Dashboard customer email settings, enable **Successful payments** and
**Refunds**, then review Branding and Public details and send a test receipt.
Checkout collects the customer email.

The private order ledger keeps an immutable product/price snapshot, order
number, Payment Intent ID, Charge ID, and Stripe receipt number. It also stores
the hosted receipt URL for staff convenience. Stripe-hosted receipt links expire
after 30 days and are not directly downloadable, so the local ledger and Stripe
reports are the durable records. Customers can use their original email to have
Stripe resend a receipt.

For each newly paid order, the webhook also queues one private merchant alert
and delivers it through Resend. The message includes customer contact details,
all item names/SKUs/quantities, production speed and fee, shipping or pickup
selection, tax, total, and the delivery address when applicable. Rush production
and Priority carrier service are displayed as separate choices. A database
lease prevents concurrent claims, and the stable Resend key suppresses routine
replays during Resend's documented 24-hour idempotency window. Delivery is
intentionally at-least-once: if Resend accepts a message but its response and
the database completion are both lost, a retry more than 24 hours later can
send a rare duplicate. Delivery failures return a retryable webhook error while
the outbox entry stays pending. See [Resend idempotency
keys](https://resend.com/docs/dashboard/emails/idempotency-keys).

One-time invoice PDFs remain disabled. Normal payment receipts are sufficient
at launch, while post-payment Invoicing adds a fee. Staff use `/admin/orders`
with `STORE_ADMIN_TOKEN` to move mailed orders through Unfulfilled, Packing,
and Shipped, or pickup orders through Awaiting Preparation, Preparing Pickup,
Ready for Pickup, and Picked Up. Tracking is unavailable for pickup. The token
is stored only in that browser tab's session storage.

For low-volume shipping, the CSV can feed a label workflow such as Pirate Ship.
Its software has no monthly or per-label service fee, but postage still costs
money. Refunds stay in Stripe so the signed webhook reconciles the local
ledger. Partial refunds and disputes automatically move incomplete shipments or
pickups to `on_hold`; full refunds cancel incomplete orders. Pickup orders and
those states are excluded from the ready-to-ship CSV.

## 8. Live-mode handoff

The live account and settlement readiness checks have passed. Do not change the
payout destination as part of storefront setup. The remaining live-mode steps
are:

1. Create a restricted live production key with only the documented resource
   permissions.
2. Create a separate live production webhook with the same events and pinned
   API version.
3. Put the live key and live `whsec_...` only in deployment secrets.
4. Confirm the Pennsylvania registration shows as Collecting in Stripe Tax,
   validate the product, shipping, and expedited handling tax codes, and set
   `STRIPE_AUTOMATIC_TAX=true`.
5. If expedited production is enabled, verify the exact 10-order daily limit
   and `America/New_York` allocation boundary, confirm current shared one-day
   capacity, and set `STORE_EXPEDITED_PRODUCTION_CAPACITY_CONFIRMED=true`.
6. Run `npm run store:check:online` against live credentials.
7. Complete one small real purchase, receipt, packing, shipping, and refund
   audit before enabling additional product IDs.

## 9. Edge protection

Before placing customer PII in `/admin/orders`, put both `/admin/*` and
`/api/admin/*` behind a Cloudflare Access self-hosted application whose Allow
policy contains only the owner's verified identity. Keep the application-level
admin token as a second layer until staff authentication replaces it. Because
the dashboard fetches its API on the same origin, the Access session cookie
should cover both protected paths; test the page, GET, and PATCH after enabling
the policy. Cloudflare Access applications deny unmatched users by default.
See [Cloudflare application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)
and [self-hosted applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/).

Add a conservative IP-based Cloudflare rate-limit rule for the exact
`/api/store/checkout` path (start with 10 requests per 60 seconds and a 60-second
429 block), then tune it from Security Events. Protect `/api/admin/store-orders`
with Access first; a second 30-per-60-second IP rule is reasonable defense in
depth for the owner dashboard. Free-plan rate-limit expressions may offer only
the path field, so all methods on an exact API path can count. Do not apply a
low per-IP limit to the Stripe webhook: Stripe delivery addresses are shared
and legitimate event retries can burst. Its one-megabyte body cap, signature
verification, event ownership check, and idempotent ledger remain the primary
controls. See [Cloudflare rate limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/).

Access identity selection and WAF rules require an owner-approved Cloudflare
Dashboard change; they are not encoded in `wrangler.jsonc`.

## Cost posture

- Standard online payments and Stripe Tax are usage-priced; review the linked
  live pricing before approving margins.
- The optional custom Checkout domain and one-time invoice PDFs remain off.
  Stripe Tax is on because it is the implemented sales-tax path.
- Continue using the existing Cloudflare and Supabase free tiers while volume is
  low, but monitor their current quotas before launch.
- Shipping software can be free; postage, packaging, refunds, chargebacks,
  taxes, and card processing are unavoidable operating costs.

Current Stripe prices should be reconfirmed before launch:
[Stripe pricing](https://stripe.com/pricing),
[Stripe Tax pricing](https://stripe.com/tax/pricing).

## Before live ordering

Record the owner's operational decisions in
[the launch input sheet](store-launch-owner-input.md), then retain the signed
copy with the store's private launch records.

- Publish owner-approved contact, shipping, return/refund/cancellation, privacy,
  and promotion terms.
- Audit finished stock or owner-approved made-to-order ATP capacity and
  packaging for every enabled SKU. Keep the current representative art clearly
  presented as illustration rather than packaged-product photography.
- Confirm the printed Starter Kit and Accessories Kit match their listed
  contents.
- Confirm the Conditions Deck card count and titles. Two local candidate sheets
  contain 18 card positions but disagree with the coded condition list, so they
  are not yet a retail-package specification.
- Confirm the Dice Pack die types and quantities; gameplay references six die
  types while the current three-dice SVG is only concept art. Confirm RP Token
  count and denominations per set as well.
- Approve the configured prices, record finished stock or made-to-order ATP
  capacity, and verify each physical sample deck against its 60-card manifest.
- Retain the confirmed 0.5-pound deck, 1-pound Starter Kit, and 8-pound maximum
  parcel measurements; keep the tested $10/$15 and $20/$35 tier boundary plus
  the 8-item/128-ounce rejection unchanged while
  `STORE_SHIPPING_RATES_CONFIRMED=true`.
- Test the standard five-business-day and expedited one-business-day production
  paths, confirm the $10 fee is once per order, and verify the hard 10-order
  rush limit, Eastern due-date allocation, and terminal-unpaid slot release.
- Set `STORE_CATALOG_CONFIRMED=true` only after all enabled-SKU checks above
  pass; an allowlist by itself is not an inventory reservation system.
- Confirm the Elverson pickup workflow and pickup tax sourcing before setting
  `STORE_PICKUP_TAX_CONFIRMED=true`; publish only a pickup address approved for
  customers.
- Build T-shirt size/color/customization selection before ever allowlisting it.
- Reconfirm the Pennsylvania government registration remains active, keep its
  Stripe Tax registration Collecting, and revalidate product and shipping tax
  codes with appropriate professional guidance before launch.
- Back up order records regularly and move from one shared admin token to staff
  accounts with MFA before multiple people handle fulfillment.
