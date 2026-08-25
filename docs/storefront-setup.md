# SeaPals storefront setup

The storefront is prepared through the payment-account handoff and is safe by
default. Visitors can browse the catalog, but no item can enter the cart and no
payment can start until its product ID is explicitly allowlisted, the private
order ledger and Stripe webhook are ready, and the launch switch is turned on.

## Current public catalog and live allowlist

The owner approved the first public catalog on **2026-08-15** as seven `$22`
ready-to-play decks, then approved the `$12` Accessories Kit and `$44`
two-player Starter Kit on **2026-08-16**. On **2026-08-24**, the owner approved
the names, `$10` prices, and same five-business-day made-to-order policy for
three set-specific Dive Packs: Pelagic Rush for the Oceanic Set, Coral Bloom for
the Reef Set, and Abyssal Glow for the Deep Set. On **2026-08-25**, the owner
authorized all three Dive Packs for live release, accepted ATP 10 and the
conservative 8-ounce checkout input for each, and retained the Killer Whale,
Great White, and Colossal Squid Apex card covers. Production verification found
all three `SP-PACK-*` rows at exactly 10 on hand and 0 reserved. The exact live
catalog now contains 12 products: the Starter Kit, seven decks, three Dive
Packs, and the Accessories Kit. The three `$5` individual accessories and future
apparel, storage, and plush products remain defined for preparation but are
hidden and unavailable by default.

All twelve displayed prices are server-controlled and owner-approved. Each
established deck's 60-card code manifest is confirmed, and all twelve live SKUs
use the standard five-business-day build-and-dispatch window. Each Dive Pack
definition represents one Dive Pack from its named set; no cards-per-pack count,
collation or randomization method, wrapper material, measured weight or
dimensions, or physical sample observation is claimed. The owner accepted ATP
10 and the conservative 8-ounce checkout input for each Dive Pack, and the three
production rows were verified at exactly 10 on hand and 0 reserved. The Starter
Kit contains the
Coral Garden and Blue Water 60-card decks, one 18-card Conditions Deck, seven
dice (D4, D6, D8, D10, D12, D20, and D100), and 15 Reef Point tokens. The
Accessories Kit contains the same 18-card Conditions Deck, seven dice, and 15
Reef Point tokens.
The optional expedited choice adds $10 once per order for build and dispatch
within one business day, subject to a hard limit of 10 expedited orders per
Eastern-time production due date; carrier transit time is separate. The
individual Dice Pack, RP Token Set, and Conditions Deck remain unavailable as
standalone products. The Pennsylvania license supplied by the owner
satisfies the storefront's government-registration confirmation gate. Stripe
Automatic Tax is required for mailed orders; scheduled Elverson pickup uses a
separately verified fixed manual Tax Rate. Checkout fails closed unless the
sellable catalog, made-to-order capacity, packaged shipping rates, pickup
sourcing, live webhook, deployment secrets, and order lifecycle gates are ready.

Use a separate staging ledger and a nonpublic test SKU for local sandbox
purchases; never consume a public SKU's production capacity for routine tests.
The payment flow is:

1. SeaPals validates the cart and price on the server.
2. Stripe-hosted Checkout collects payment and, for mailed orders, the delivery
   address. Pickup orders do not request a shipping address.
3. A signature-verified Stripe webhook updates the private Supabase order
   ledger, atomically queues one merchant purchase alert, and immediately tries
   to send that alert through Resend. A five-minute Cloudflare Cron Trigger
   independently drains anything still pending and prepares due-soon
   fulfillment reminders; the browser success page never authorizes
   fulfillment.
4. The alert separates production speed from carrier service and includes every
   purchased item and quantity, totals, and the selected shipping or scheduled
   pickup method. Pickup customers are contacted after the build to arrange a
   time.
5. Test payments remain in Stripe's sandbox and never settle. They can still
   mutate whichever Supabase inventory project is configured, so use the
   isolated test procedure in section 6. After the lifecycle passes, separate
   live credentials and a live webhook are used, and Stripe pays the live
   balance to the configured business settlement account.

Checkout uses Stripe's Dashboard-managed dynamic payment methods and tags each
Session with `seapals_store_web_kvqzrmta` so this storefront flow can be
measured separately in Stripe.

## What is included

- `/store`: responsive live catalog containing the two-player Starter Kit,
  seven approved Expansion Decks, three set-specific Dive Packs, and the
  Accessories Kit. Prepared future products require an explicit private preview
  switch and remain unavailable by default.
- `/api/store/checkout`: server-priced cart validation and Stripe-hosted
  Checkout. Payment credentials never pass through SeaPals servers.
- `/api/store/webhook`: raw-body Stripe signature verification plus
  idempotent payment, failure, expiration, refund, dispute hold, receipt,
  address recording, and immediate merchant purchase-alert delivery.
- `custom-worker.mjs`: the generated OpenNext fetch handler plus five-minute
  private purchase-alert, fulfillment-reminder, inventory-reconciliation, and
  quarterly PA-report drains, so recovery does not depend on one request.
- `/admin/orders`: a token-protected shipping and Elverson pickup workspace with
  immutable product, price, and fulfillment-method snapshots; receipt and
  Stripe references; tracking; private notes; a shipping CSV; and a
  Pennsylvania quarterly website-ledger reconciliation plus myPATH return CSV.
- `supabase/store-orders.sql`: private orders, items, payment-event idempotency,
  durable receipt references, fulfillment state, and a private notification
  outbox with lease-based concurrent-claim prevention and a private pending-row
  listing RPC for the scheduled drainer.
- `supabase/pa-quarterly-report-email.sql`: a separate quarter-keyed, frozen
  aggregate outbox and PII-reduced tax-ledger RPC for the scheduled PA report.
- `npm run store:check` and `npm run store:check:online`: launch-readiness checks.

SeaPals stores order, customer contact, delivery, total, payment state,
processor references, receipt references, and fulfillment records. Stripe hosts
the payment page and retains the underlying payment record.

## Owner-approved catalog prices

SeaPals Credits are intentionally excluded. The repository currently uses
these server-controlled cash-price definitions. The owner approved the seven
launch decks at $22 each on 2026-08-15, then the Accessories Kit at $12 and
Starter Kit at $44 on 2026-08-16, then three set-specific Dive Packs at $10
each on 2026-08-24. The owner authorized the Dive Packs for live release on
2026-08-25; the other future rows remain unavailable:

| Product | Configured price | Included | Catalog state |
| --- | ---: | --- | --- |
| Each Expansion Deck | $22 | One 60-card ready-to-play deck | **Live** |
| Pelagic Rush — Oceanic Set Dive Pack | $10 | One Oceanic Set Dive Pack | **Live** |
| Coral Bloom — Reef Set Dive Pack | $10 | One Reef Set Dive Pack | **Live** |
| Abyssal Glow — Deep Set Dive Pack | $10 | One Deep Set Dive Pack | **Live** |
| Starter Kit | $44 | Coral Garden and Blue Water 60-card decks, one 18-card Conditions Deck, seven dice (D4, D6, D8, D10, D12, D20, D100), and 15 Reef Point tokens | **Live** |
| Accessories Kit | $12 | One 18-card Conditions Deck, seven dice (D4, D6, D8, D10, D12, D20, D100), and 15 Reef Point tokens | **Live** |
| Conditions Deck | $5 | 18 cards; title-list/sample review remains required before a standalone release | Future |
| Dice Pack | $5 | One each D4, D6, D8, D10, D12, D20, D100 | Future |
| Reef Point (RP) Token Set | $5 | 15 tokens | Future |

The seven Expansion Decks are Blue Water, Coral Garden, Murky Water,
Disruption, Stinging Fortress, Darkness Shroud, and Open Ocean. Each code
manifest resolves to exactly 60 cards. The local print-sheet folder contains a
sheet set for every deck. The owner approved those 60-card manifests and an
initial made-to-order ATP capacity of 10 per launch deck on 2026-08-15.
The Dive Pack approval defines each sellable unit as one set-specific Dive Pack
and intentionally does not claim a cards-per-pack count, collation or
randomization method, or wrapper material. Their approved representative covers
use the existing Killer Whale Oceanic Apex, Great White Reef Apex, and Colossal
Squid Deep Apex card fronts. A cover does not promise that card is included.
The owner authorized the existing five-business-day made-to-order process, ATP
10, and the conservative 8-ounce checkout input for live release on 2026-08-25;
the production rows were verified at 10 on hand and 0 reserved. This record does
not claim a measured Dive Pack weight or dimensions or a physical observation.

The prepared individual accessories plus future Custom T-Shirt, Card Binder,
Backpack, and Plush Toy concepts are hidden
unless `STORE_SHOW_FUTURE_PRODUCTS=true`. Custom T-Shirts remain locked even if
priced because checkout does not yet collect size, color, or customization
choices.

## 1. Create the private order ledger

Open the Supabase SQL editor for the existing SeaPals project and run:

`supabase/store-orders.sql`

Then apply `supabase/pa-quarterly-report-email.sql` before enabling the
quarterly Pennsylvania email.

Do not seed capacity merely because the schema has been applied. During the
checkout-disabled production cutover, follow
`docs/store-inventory-operations.md` to drain any legacy payment sessions and
then run the non-replenishing `supabase/store-launch-capacity.sql` seed. The
file defines the planned 15-row catalog at an intended initial ATP limit of 10;
it inserts only missing rows and leaves existing, potentially sold-down rows
untouched. Its presence in source or a deployment does not prove that all 15
rows exist in production. Query production after every cutover. On 2026-08-25,
that production query verified `SP-PACK-OCEANIC`, `SP-PACK-REEF`, and
`SP-PACK-DEEP` at exactly 10 on hand and 0 reserved before the owner-authorized
live release. The seed remains non-replenishing and must never be used to reset
a sold-down row.

`supabase/store-orders.sql` is safe to rerun when this branch changes: it adds
missing catalog and receipt columns and replaces the payment-event function. The tables have
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
- `STORE_CHECKOUT_ALLOWED_ORIGINS` (comma-separated exact app origins allowed
  to initiate checkout; the browser Origin must also equal the request URL
  origin)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- the existing Supabase URL and service-role key
- a strong, unique `STORE_ADMIN_TOKEN` of at least 32 characters
- `RESEND_API_KEY`, a verified-domain `EMAIL_FROM`, and the explicit private
  `STORE_ORDER_NOTIFICATION_EMAIL`
- `STORE_ORDER_NOTIFICATION_ENABLED=true` to exercise alerts in sandbox
- `STORE_ORDER_NOTIFICATION_DELIVERY_CONFIRMED=true` only after a synthetic
  alert reaches the private inbox; this owner gate is required in live mode
- `STORE_FULFILLMENT_DUE_NOTIFICATION_ENABLED=true` to send one due-soon alert
  for each paid live order through the same verified sender and recipient
- `STORE_PA_TAX_REPORT_ENABLED=true`, an explicit private
  `STORE_PA_TAX_REPORT_EMAIL`,
  `STORE_PA_TAX_REPORT_START_PERIOD_END=2026-09-30`, and
  `STORE_PA_TAX_REPORT_DELIVERY_CONFIRMED=true` for the once-per-quarter
  Pennsylvania preparation email

`NEXT_PUBLIC_SITE_URL` remains a legacy fallback, but new deployments should
prefer `SITE_URL` so the canonical store origin is not compiled into browser
JavaScript.

Apply `supabase/pa-quarterly-report-email.sql` after the main store schema
before enabling that quarterly job. It creates a separate private aggregate
outbox; it does not reuse the per-order notification table and does not store
tax account IDs, customer data, banking details, or filing CSVs.

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
- `refund.created`
- `refund.updated`
- `refund.failed`
- `charge.dispute.created`
- `charge.dispute.closed`

The application intentionally treats legacy `charge.refunded` deliveries as an
acknowledged no-op because that Charge snapshot does not prove the underlying
refund ultimately succeeded. It can be removed from the destination once the
three `refund.*` subscriptions above are active.

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
IDs. The current live twelve-product value is:

`starter-kit,blue-water,disruption,coral-garden,darkness-shroud,open-ocean-hunt,murky-water,stinging-fortress,oceanic-dive-pack,reef-dive-pack,deep-dive-pack,accessory-set`

There is deliberately no `all` wildcard. The server rejects unknown,
unavailable, client-priced, over-quantity, or stale cart items. Add a product
only after its inventory, packaging, contents, price, tax treatment, and
fulfillment procedure are verified. Live mode also requires the independent
`STORE_CATALOG_CONFIRMED=true` owner gate. As of 2026-08-25, it confirms the
exact twelve-product allowlist. Before extending the allowlist, every added SKU
must have verified finished stock or owner-approved made-to-order ATP capacity,
verified packaged contents, an approved price, a published build-and-dispatch
window, and a repeatable fulfillment procedure. The owner approved the Dive
Pack cover assignments on 2026-08-24: Killer Whale for Oceanic, Great White for
Reef, and Colossal Squid for Deep. They use canonical card fronts directly,
with no separate custom wrapper illustration. Packaged-product photography
remains optional.

The 2026-08-25 Dive Pack release followed this order:

1. The owner authorized one set-specific Dive Pack as each sellable definition,
   the $10 price, five-business-day made-to-order policy, ATP 10, conservative
   8-ounce checkout input, and approved Apex cover assignment. This directive
   did not assert a card count, collation or randomization method, wrapper
   material, measured weight or dimensions, or physical sample observation.
2. `STORE_CHECKOUT_ENABLED=false` was deployed for the cutover, the
   non-replenishing capacity seed was applied, and all three `SP-PACK-*` rows
   were queried at exactly 10 on hand and 0 reserved.
3. All twelve product IDs were staged and the launch readiness checker passed
   with the exact Wrangler production values overriding developer-local catalog
   values. The read-only online checks confirmed all twelve inventory rows and
   the current Supabase contracts while checkout remained disabled. The local
   restricted Stripe test key could not re-read the unchanged production Tax,
   payment-method-configuration, or pickup-rate resources.
4. The three Dive Pack IDs were added to `STORE_AVAILABLE_PRODUCT_IDS` for the
   owner-authorized live release.

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
`npm.cmd run store:check:online` against the exact twelve-product production
allowlist. `npm.cmd run store:check:launch` verifies that exact allowlist and the
owner-approved server-controlled prices: $44 for the Starter Kit, $22 per deck,
$10 per set-specific Dive Pack, and $12 for the Accessories Kit.

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
each deck or set-specific Dive Pack and 16 ounces for each Starter Kit or
accessory SKU. It sums quantity times weight, selects the base tier through 16
ounces and the higher tier above 16 ounces, and rejects orders above 8 items or
128 ounces. Never accept a client-supplied weight or use an unpackaged product
weight for tier selection.

The original shipping approval and Pirate Ship evidence were recorded on
2026-08-15 for Elverson 19520 to Los Angeles 90001. The owner accepted the same
conservative 8-ounce checkout input for each Dive Pack in the 2026-08-25 go-live
directive. It is not a measured packed weight or dimensions record. The measured
parcel table remains evidence for the listed deck, kit, and maximum cart samples
and does not assert Dive Pack dimensions or a separate quote:

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
Use [the free Pennsylvania quarterly filing runbook](pa-automatic-filing.md)
for the private website-ledger reconciliation, myPATH return CSV, first-period
confirmation, exception review, owner submission, and record retention.

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

Stripe sandbox mode does not isolate the Supabase ledger or ATP rows. Use a
separate staging Supabase project for paid lifecycle tests and allowlist only a
nonpublic test product such as `conditions-deck`. Do not use any of the 12 live
production rows, including the three `SP-PACK-*` rows. The seed file is not
evidence of current row values; query production instead. A refund intentionally
does not restock inventory; any
deliberate production-ledger test unit remains consumed unless restored through
a documented, reviewed capacity adjustment.

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
8. Verify a paid live shipping order receives one reminder at 9 a.m. Eastern on
   the business day before it is due until it reaches Awaiting Shipment, and a
   pickup order until it reaches Ready for Pickup. Verify a status change after
   queueing or the end of the due date suppresses a stale email, and a repeated
   cron does not duplicate it. Apply `supabase/store-orders.sql` and verify the
   online v7 contract before deploying a Worker with the reminder flag enabled.
9. Verify the expedited fee appears exactly once on a multi-item order, uses the
   handling tax code, and records a one-business-day production promise without
   describing carrier delivery as one day. Verify the eleventh expedited order
   for one production due date is rejected, Friday through Sunday share Monday's
   slots, and a terminal unpaid/expired Session releases its slot. Also test a
   decline, partial/full refund, dispute hold, In Production, Packing, Awaiting
   Shipment, tracking entry, Shipped, pickup scheduling notes, Ready for Pickup,
   Picked Up, and the paid-unshipped CSV export.
10. Run the application checks:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run cloudflare:build
```

The seven-deck catalog audit was recorded on 2026-08-15; the Accessories Kit,
Starter Kit, and 18-card Conditions Deck count were approved on 2026-08-16. On
2026-08-25, the owner authorized the three $10 Dive Packs for the same
five-business-day made-to-order policy, accepted ATP 10 and the conservative
8-ounce checkout input for each, and retained the three canonical Apex card
covers. Production verification found all three `SP-PACK-*` rows at exactly 10
on hand and 0 reserved. Those approvals support
`STORE_CATALOG_CONFIRMED=true` for the exact twelve-product live allowlist. No
cards-per-pack count, collation or randomization method, wrapper material,
measured pack weight or dimensions, or physical observation is recorded here.
Keep the independent `STORE_CHECKOUT_ENABLED` switch true only while the
production checks for every live product remain satisfied.

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
with `STORE_ADMIN_TOKEN` to move mailed orders through Awaiting Production, In
Production, Packing, Awaiting Shipment, and Shipped. Pickup orders follow
Awaiting Production, In Production, Packing for Pickup, Ready for Pickup, and
Picked Up. On Hold and Cancelled remain available for exceptions. Tracking is
unavailable for pickup. The token is stored only in that browser tab's session
storage.

The scheduled Worker also sends one private due-soon reminder for each paid
live order that has not reached its method's ready state. Expedited orders use
their stored next-business-day deadline; Standard orders are due after five
Monday-through-Friday days from payment. The reminder window opens at 9 a.m.
Eastern on the prior business day. For shipping, **Awaiting shipment** is the
existing ready-to-ship milestone; for pickup, the milestone is **Ready for
pickup**. The outbox lease, a per-order-and-date Resend idempotency key, and a
final status-and-time-window recheck prevent routine duplicates and stale
alerts.

For low-volume shipping, the CSV can feed a label workflow such as Pirate Ship.
Its software has no monthly or per-label service fee, but postage still costs
money. Refunds stay in Stripe so the signed webhook reconciles the local
ledger. Partial refunds and disputes automatically move incomplete shipments or
pickups to `on_hold`; full refunds cancel incomplete orders. Pickup orders and
those states are excluded from the paid-unshipped CSV.

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
7. Complete the paid, receipt, packing, shipping, failure, and refund lifecycle
   in a Stripe sandbox. [Stripe prohibits testing live mode with real payment
   details](https://docs.stripe.com/testing?testing-method=payment-methods).
   For the live smoke test, create a Checkout Session without entering payment
   details, expire it, and verify the signed expiration event releases the
   reservation before opening public ordering.

## 9. Edge protection

As defense in depth for customer PII in `/admin/orders`, put both `/admin/*`
and `/api/admin/*` behind a Cloudflare Access self-hosted application whose
Allow policy contains only the owner's verified identity. Keep the existing
application-level high-entropy admin token as the required authorization layer
until staff authentication replaces it. Because the dashboard fetches its API
on the same origin, the Access session cookie should cover both protected paths;
test the page, GET, and PATCH after enabling the policy. Cloudflare Access
applications deny unmatched users by default.
See [Cloudflare application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)
and [self-hosted applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/).

The Worker uses a native Cloudflare Rate Limiting binding for exact `POST
/api/store/checkout` requests: 10 attempts per 60 seconds for a one-way hash of
the edge-reported network address. Exhausted callers receive a private 429 with
`Retry-After: 60`; a missing or failed binding makes checkout fail closed with
503. The binding and limit are encoded in `wrangler.jsonc`, and the webhook is
deliberately excluded because legitimate Stripe retries can burst. The rate
limiter is permissive and eventually consistent, so inventory reservations and
scheduled Stripe-verified cleanup remain the authoritative availability
controls. See [Cloudflare Worker Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

Cloudflare Access identity selection remains an optional owner Dashboard
change; it is not encoded in `wrangler.jsonc`.

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
  packaging for every enabled SKU. Keep representative imagery clearly
  presented as a product preview rather than packaged-product photography.
- Keep the individual accessories unavailable until each standalone
  future-release audit is complete.
- The Conditions Deck count is owner-confirmed at 18 cards. Before a standalone
  Conditions Deck release, confirm its title list and finished sample; the
  bundle descriptions intentionally do not claim individual card titles.
- Preserve the Starter Kit contents: Coral Garden and Blue Water 60-card decks,
  one 18-card Conditions Deck, one each D4, D6, D8, D10, D12, D20, and D100,
  and 15 Reef Point tokens.
- Preserve the Accessories Kit contents: one 18-card Conditions Deck, one each
  D4, D6, D8, D10, D12, D20, and D100, and 15 Reef Point tokens.
- Preserve the approved $44 Starter Kit, $22 deck, $10 set-specific Dive Pack,
  and $12 Accessories Kit prices, the reviewed capacity for established SKUs,
  the owner-accepted ATP of 10 per Dive Pack, and seven 60-card deck manifests.
  The three Dive Pack rows were verified at 10 on hand and 0 reserved on
  2026-08-25. Do not publish a Dive Pack card count, collation, or randomization
  method until separately approved.
- Retain the 0.5-pound conservative checkout weight for each deck and the
  owner-accepted 0.5-pound checkout input for each Dive Pack, the 1-pound
  Starter Kit weight, and the 8-pound maximum order weight. The Dive Pack input
  is not a measured packed weight or dimensions record;
  keep the tested $10/$15 and $20/$35 tier boundary plus the 8-item/128-ounce
  rejection unchanged while
  `STORE_SHIPPING_RATES_CONFIRMED=true`.
- Test the standard five-business-day and expedited one-business-day production
  paths, confirm the $10 fee is once per order, and verify the hard 10-order
  rush limit, Eastern due-date allocation, and terminal-unpaid slot release.
- Keep `STORE_CATALOG_CONFIRMED=true` only while the exact twelve currently
  enabled products continue to satisfy those checks; an allowlist by itself is
  not an inventory reservation system.
- Keep the three Dive Packs at $10 under the five-business-day made-to-order
  policy and retain the approved Killer Whale, Great White, and Colossal Squid
  Apex card covers. Preserve the verified `SP-PACK-*` rows and stable SKUs; never
  rerun the seed to restore sold-down capacity.
- Confirm the Elverson pickup workflow and pickup tax sourcing before setting
  `STORE_PICKUP_TAX_CONFIRMED=true`; publish only a pickup address approved for
  customers.
- Build T-shirt size/color/customization selection before ever allowlisting it.
- Reconfirm the Pennsylvania government registration remains active, keep its
  Stripe Tax registration Collecting, and revalidate product and shipping tax
  codes with appropriate professional guidance before launch.
- Back up order records regularly and move from one shared admin token to staff
  accounts with MFA before multiple people handle fulfillment.
