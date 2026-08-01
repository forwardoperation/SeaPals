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

All twelve draft prices are server-controlled. Exact packaged
counts for the Conditions Deck, Dice Pack, and RP Token Set still need to be
confirmed before publication. Production checkout and Stripe automatic tax
stay off until Pennsylvania confirms the government sales tax registration.
Adding a Pennsylvania registration inside Stripe Tax is not, by itself, that
confirmation.

The `$44` Starter Kit can remain the first local sandbox purchase. The payment
flow is:

1. SeaPals validates the cart and price on the server.
2. Stripe-hosted Checkout collects payment and, for mailed orders, the delivery
   address. Pickup orders do not request a shipping address.
3. A signature-verified Stripe webhook updates the private Supabase order
   ledger; the browser success page never authorizes fulfillment.
4. Test payments remain in Stripe's sandbox and never reach Chase. After the
   lifecycle passes, separate live credentials and a live webhook are used,
   and Stripe pays the live balance to the Chase business checking account.

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
  duplicate-safe payment, failure, expiration, refund, dispute hold, receipt,
  and address recording.
- `/admin/orders`: a token-protected shipping and Elverson pickup workspace with
  immutable product, price, and fulfillment-method snapshots; receipt and
  Stripe references; tracking; private notes; and a shipping-only CSV export.
- `supabase/store-orders.sql`: private orders, items, payment-event idempotency,
  durable receipt references, and fulfillment state.
- `npm run store:check` and `npm run store:check:online`: launch-readiness checks.

SeaPals stores order, customer contact, delivery, total, payment state,
processor references, receipt references, and fulfillment records. Stripe hosts
the payment page and retains the underlying payment record.

## Catalog and established cash prices

SeaPals Credits are intentionally excluded. The purchase sheet establishes:

| Product | Cash price | Included |
| --- | ---: | --- |
| Starter Kit | $44 | Coral Garden 60 Card Deck, Blue Water 60 Card Deck, Conditions Deck, Dice Set, and Reef Point Tokens |
| Each Expansion Deck | $22 | One 60-card ready-to-play deck |
| Accessories Kit | $12 | Conditions Deck, Dice Pack, and Reef Point Tokens |
| Conditions Deck | $5 | Packaged card count must also be confirmed |
| Dice Pack | $5 | Dice types and quantities must also be confirmed |
| Reef Point (RP) Token Set | $5 | Tokens per set must also be confirmed |

The seven Expansion Decks are Blue Water, Coral Garden, Murky Water,
Disruption, Stinging Fortress, Darkness Shroud, and Open Ocean.

Future Custom T-Shirt, Card Binder, Backpack, and Plush Toy concepts are hidden
unless `STORE_SHOW_FUTURE_PRODUCTS=true`. Custom T-Shirts remain locked even if
priced because checkout does not yet collect size, color, or customization
choices.

## 1. Create the private order ledger

Open the Supabase SQL editor for the existing SeaPals project and run:

`supabase/store-orders.sql`

It is safe to rerun when this branch changes: the script adds missing catalog
and receipt columns and replaces the payment-event function. The tables have
row-level security enabled and deny the public `anon` and `authenticated`
roles. Store routes use the server-only service-role key. Never expose
`SUPABASE_SERVICE_ROLE_KEY` to browser code.

## 2. Prepare the Stripe account, stopping before the bank

A normal direct Stripe account with hosted Checkout is enough. Stripe Connect,
paid Invoicing, and a custom Checkout domain are not needed.

The account owner should complete these Dashboard steps personally:

1. Create the account, verify the email, and begin in sandbox/test mode.
2. Enter the legal business type, tax details, business/product description,
   representative and ownership details, customer-facing contact information,
   and a recognizable statement descriptor such as `SEAPALS TCG`.
3. Complete any identity or business-document requests.
4. Enable two-factor authentication, preferably with a passkey or security key.
5. Review Stripe's agreement and account requirements.
6. Stop at **Settings > Business > Bank accounts and currencies** until the
   business checking account is ready.

For a US account, prepare the legal entity name/type, EIN or applicable
SSN/ITIN, a physical address, representative information, and owner/controller
details that match the business structure. Stripe's requests are dynamic, so
the Dashboard remains authoritative. Never put identity, tax, or banking data
in this repository or in chat.

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

- `NEXT_PUBLIC_SITE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- the existing Supabase URL and service-role key
- a strong, unique `STORE_ADMIN_TOKEN` of at least 32 characters

Prefer a restricted sandbox key (`rk_test_...`) named `SeaPals storefront
sandbox`. Start every permission at **None**, then grant:

- **Checkout Sessions: Write** (create, retrieve, and expire Sessions)
- **Payment Intents: Read** (retrieve the Stripe-hosted receipt reference)
- **Charges: Read** (read the expanded charge and hosted receipt link)
- **Account: Read** (used only by `npm run store:check:online`)

If Stripe returns a permission error, use that key's request logs to identify
the exact missing resource instead of granting broad access. Keep every other
permission at **None**. Store the key only in `.env.local` or the deployment
secret vault, never in source control or chat. Validate the final permissions
with `npm run store:check:online`.

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

## 4. Configure products, inventory, and shipping

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
fulfillment procedure are verified.

Keep `STORE_SHOW_FUTURE_PRODUCTS=false` for the launch store. Run
`npm.cmd run store:check:launch` to verify the exact twelve-product allowlist
and server-controlled prices.

The draft fulfillment choices are server-controlled:

| Option | Draft price | Checkout behavior |
| --- | ---: | --- |
| Standard Shipping & Handling | $7.50 | Collects a US delivery address |
| Priority Shipping & Handling | $12.50 | Collects a US delivery address |
| Local pickup — Elverson, PA | Free | Does not request a shipping address; staff email when ready |

Override the two mailed-order prices with
`STORE_STANDARD_SHIPPING_CENTS` and `STORE_PRIORITY_SHIPPING_CENTS`.
`STORE_SHIPPING_CENTS` remains only as a legacy Standard-rate fallback. Stripe
Shipping Rates are fixed per whole order, not weight- or quantity-sensitive,
so weigh the packed SKUs and test multi-item orders before setting
`STORE_SHIPPING_RATES_CONFIRMED=true`. No delivery-day promise is configured
yet. Keep `STORE_ALLOWED_COUNTRIES=US` for the initial launch unless
international tax, customs, pricing, and delivery are ready.

## 5. Decide how tax will be handled

`STORE_TAX_REGISTRATION_CONFIRMED` and `STRIPE_AUTOMATIC_TAX` are both off by
default. Only the owner should set the first value to `true`, and only after the
government registration is active. Live checkout is code-gated on that manual
confirmation. Then determine where SeaPals must collect and use Stripe Tax
codes that have been verified for the actual products and shipping:

- `STRIPE_GAME_PRODUCT_TAX_CODE`
- `STRIPE_SHIPPING_TAX_CODE`
- `STRIPE_APPAREL_TAX_CODE`
- `STRIPE_STORAGE_TAX_CODE`
- `STRIPE_PLUSH_TAX_CODE`

`STRIPE_PRODUCT_TAX_CODE` is a supported global fallback, but category-specific
codes are safer for a mixed catalog. Checkout stays closed when automatic tax
is requested without owner confirmation, or when any available product or
shipping lacks a valid code. Stripe Tax is an optional paid service; enabling
calculation does not create a government registration or replace
tax-registration advice.

Pickup tax sourcing must also be verified for the Elverson performance
location before setting `STORE_PICKUP_TAX_CONFIRMED=true`. Automatic tax stays
blocked while local pickup is enabled and that confirmation is false.

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
6. Test Standard, Priority, and Elverson pickup orders, plus a decline, expired
   session, duplicate webhook, partial/full refund, dispute hold, packing
   update, tracking entry, shipped update, pickup-ready/picked-up updates, and
   the shipping-only CSV export.
7. Run the application checks:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run cloudflare:build
```

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

## 8. Bank and live-mode handoff

When the business checking account is ready, the owner completes the one step
Codex cannot perform:

1. Stripe Dashboard > Settings > Business > Bank accounts and currencies.
2. Under USD settlement, choose **Add bank account**.
3. Complete Stripe's owner verification.
4. Enter the 9-digit routing number, account number, and matching account-holder
   name directly in Stripe.
5. Save it and confirm the payout schedule.

Only an Owner or Admin should change the payout destination. Manual payout-bank
entry is distinct from linking an external account for ongoing bank-data access.
Stripe may request a statement, voided check, or bank letter to prove ownership.
See [Stripe payouts](https://docs.stripe.com/payouts) and
[linked external accounts](https://docs.stripe.com/get-started/account/linked-external-accounts).

After the account reports details submitted, charges enabled, and payouts
enabled:

1. Create a separate live production webhook with the same events and pinned
   API version.
2. Put the live key and live `whsec_...` only in deployment secrets.
3. Run `npm run store:check:online` against live credentials.
4. Complete one small real purchase, receipt, packing, shipping, and refund
   audit before enabling additional product IDs.

## Cost posture

- Stripe has no setup or monthly fee for standard online payments. US domestic
  online cards currently cost 2.9% + 30 cents per successful transaction;
  normal payouts and hosted Checkout are included.
- The optional custom Checkout domain is unnecessary. Stripe Tax and one-time
  invoice PDFs are intentionally off because they add fees.
- Continue using the existing Cloudflare and Supabase free tiers while volume is
  low, but monitor their current quotas before launch.
- Shipping software can be free; postage, packaging, refunds, chargebacks,
  taxes, and card processing are unavoidable operating costs.

Current Stripe prices should be reconfirmed before launch:
[Stripe pricing](https://stripe.com/pricing),
[Stripe Tax pricing](https://stripe.com/tax/pricing).

## Before live ordering

- Publish owner-approved contact, shipping, return/refund/cancellation, privacy,
  and promotion terms.
- Audit printed inventory and packaging for every enabled SKU. Blue Water and
  Murky Water currently reference White Grunt records unavailable in the card
  database, and some card art remains placeholder art.
- Confirm the printed Starter Kit and Accessories Kit match their listed
  contents.
- Confirm the Conditions Deck card count, Dice Pack die types and quantities,
  RP Tokens per set, inventory, packaging, and product photography.
- Weigh packed one- and multi-item orders, confirm the $7.50/$12.50 fixed rates,
  and document handling and delivery expectations before setting
  `STORE_SHIPPING_RATES_CONFIRMED=true`.
- Confirm the Elverson pickup workflow and pickup tax sourcing before setting
  `STORE_PICKUP_TAX_CONFIRMED=true`; publish only a pickup address approved for
  customers.
- Build T-shirt size/color/customization selection before ever allowlisting it.
- Confirm the Pennsylvania government sales tax registration before setting
  `STORE_TAX_REGISTRATION_CONFIRMED=true`, then validate product and shipping
  tax codes with appropriate professional guidance.
- Back up order records regularly and move from one shared admin token to staff
  accounts with MFA before multiple people handle fulfillment.
