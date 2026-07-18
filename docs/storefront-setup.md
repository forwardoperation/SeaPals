# SeaPals storefront setup

The storefront is prepared through the payment-account handoff and is safe by
default. Visitors can browse the complete catalog, but no item can enter the
cart and no payment can start until its product ID is explicitly allowlisted,
the private order ledger and Stripe webhook are ready, and the launch switch is
turned on.

## What is included

- `/store`: responsive catalog grouped into Starter Kits, Expansion Decks,
  Game Accessories, Custom T-Shirts, Binders & Backpacks, and Plush Toys.
- `/api/store/checkout`: server-priced cart validation and Stripe-hosted card
  checkout. Card numbers and security codes never pass through SeaPals servers.
- `/api/store/webhook`: raw-body Stripe signature verification plus
  duplicate-safe payment, failure, expiration, refund, receipt, and address
  recording.
- `/admin/orders`: a token-protected packing and shipping queue with immutable
  product/price snapshots, receipt and Stripe references, tracking, private
  notes, and paid-unshipped CSV export.
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
| Starter Kit | $40 | Coral Garden 60 Card Deck, Blue Water 60 Card Deck, Conditions Deck, Dice Set, and Reef Point Tokens |
| Each Expansion Deck | $20 | One 60-card ready-to-play deck |
| Accessory Set | $10 | Dice Pack, Conditions Deck, and Reef Point Tokens |

The seven Expansion Decks are Blue Water, Coral Garden, Murky Water,
Disruption, Stinging Fortress, Darkness Shroud, and Open Ocean Hunt.

Individual Reef Point Tokens, Dice Pack, Conditions Deck, Custom T-Shirt, Card
Binder, Backpack, and Plush Toy are visible as coming soon with `Price TBA`.
They cannot be purchased until a price and explicit allowlist entry are added.
Custom T-Shirts remain locked even if priced because checkout does not yet
collect size, color, or customization choices.

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

A standard `sk_test_...` key is simplest during development. A restricted key
can be used after granting only the necessary Checkout Session write and
Payment Intent read access; the online account-readiness check may also require
account read access. Validate the final permissions with
`npm run store:check:online`.

Create a test webhook endpoint for:

`https://YOUR_DOMAIN/api/store/webhook`

Pin it to Stripe API version `2026-06-24.dahlia` and subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `payment_intent.payment_failed`
- `charge.refunded`

Only a signature-verified webhook moves an order to paid. The success page is
informational and never authorizes fulfillment. For local testing, use Stripe
CLI forwarding to `http://localhost:3000/api/store/webhook` and use the
temporary `whsec_...` it prints only for that local listener. Test and live
webhook signing secrets are separate.

## 4. Configure products, inventory, and shipping

Prices are integer cents. Established products have safe source defaults; every
price can still be overridden with the matching `STORE_PRICE_*_CENTS` key in
`.env.example`. Set unpriced merchandise only after its final SKU and retail
price are known.

Set `STORE_AVAILABLE_PRODUCT_IDS` to a comma-separated list of reviewed product
IDs, for example:

`starter-kit,coral-garden,accessory-set`

There is deliberately no `all` wildcard. The server rejects unknown,
unavailable, client-priced, over-quantity, or stale cart items. Add a product
only after its inventory, packaging, contents, price, tax treatment, and
fulfillment procedure are verified.

`STORE_SHIPPING_CENTS` is one flat amount per order. Zero displays as free
shipping. The optional minimum/maximum business-day values are sent to Stripe
only when both are valid. Keep `STORE_ALLOWED_COUNTRIES=US` for the initial
launch unless international tax, customs, pricing, and delivery are ready.

## 5. Decide how tax will be handled

`STRIPE_AUTOMATIC_TAX` is off by default. Before enabling it, determine where
SeaPals is registered and required to collect tax. Use Stripe Tax codes that
have been verified for the actual products:

- `STRIPE_GAME_PRODUCT_TAX_CODE`
- `STRIPE_APPAREL_TAX_CODE`
- `STRIPE_STORAGE_TAX_CODE`
- `STRIPE_PLUSH_TAX_CODE`

`STRIPE_PRODUCT_TAX_CODE` is a supported global fallback, but category-specific
codes are safer for a mixed catalog. Checkout stays closed when automatic tax
is enabled and any available product lacks a valid code. Stripe Tax is an
optional paid service; enabling calculation does not replace tax-registration
advice.

## 6. Test the complete lifecycle

Keep `STORE_CHECKOUT_ENABLED=false` while preparing the store. Then:

1. Run the SQL and add Stripe/Supabase test credentials.
2. Allowlist only test-ready products and set a realistic shipping amount.
3. Run `npm.cmd run store:check` and `npm.cmd run store:check:online`.
4. Set `STORE_CHECKOUT_ENABLED=true` locally.
5. Complete a successful Stripe test Checkout and verify the signed webhook
   creates a paid order in `/admin/orders`.
6. Test a decline, expired session, duplicate webhook, partial/full refund,
   packing update, tracking entry, shipped update, and CSV export.
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
with `STORE_ADMIN_TOKEN` to move paid orders through Unfulfilled, Packing, and
Shipped, add tracking and notes, and export paid-unshipped orders. The token is
stored only in that browser tab's session storage.

For low-volume shipping, the CSV can feed a label workflow such as Pirate Ship.
Its software has no monthly or per-label service fee, but postage still costs
money. Refunds stay in Stripe so the signed webhook reconciles the local ledger.

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
- Confirm the printed Starter Kit and Accessory Set exactly match their listed
  contents.
- Finalize individual accessory prices and merchandise materials, dimensions,
  character/design choices, inventory, and photography.
- Build T-shirt size/color/customization selection before ever allowlisting it.
- Confirm tax registrations and product tax codes with appropriate professional
  guidance.
- Back up order records regularly and move from one shared admin token to staff
  accounts with MFA before multiple people handle fulfillment.
