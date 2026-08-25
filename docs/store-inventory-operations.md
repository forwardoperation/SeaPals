# Store inventory operations

The storefront uses a private Supabase per-SKU availability ledger. It can
represent finished stock or conservative made-to-order available-to-promise
(ATP) capacity. The catalog's availability allowlist only decides which
products may appear for sale; it does not create capacity and never substitutes
for a `store_inventory` row.

A SKU identifies one sellable configuration, not one physical copy. Multiple
copies use an order quantity against the same SKU. The canonical SKU map and
change rules are in `docs/store-sku-policy.md`.

## Production cutover

Use a checkout-disabled maintenance window:

1. Set `STORE_CHECKOUT_ENABLED=false` and deploy that configuration.
2. Run `supabase/store-orders.sql` in the production Supabase SQL editor. It is
   rerunnable and does not seed or overwrite availability counts.
3. Drain every legacy order before seeding capacity. After the migration,
   enumerate all pending orders that are not inventory-managed:

   ```sql
   select id, order_number, checkout_session_id, payment_intent_id, charge_id,
          payment_status, created_at
     from public.store_orders
    where inventory_state = 'not_managed'
      and payment_status = 'pending'
    order by created_at;
   ```

   For every saved Checkout Session, retrieve its current state from Stripe. Set
   aside sold units and reconcile paid orders before counting. A complete but
   unpaid/processing Session must reach asynchronous success or failure before
   cutover; do not assume completion is terminal. Explicitly expire every open
   Session and confirm Stripe reports it as expired, then wait for or replay its
   signed terminal webhook. Investigate pending rows with no saved Session by
   order metadata and Stripe request logs. Do not seed inventory while any legacy
   Session can still accept or settle a payment, or while any ambiguous legacy
   order remains unresolved.
4. Establish ATP capacity only after the legacy drain. For a finished-goods
   SKU, ATP is the verified sellable count. For a made-to-order SKU, ATP is the
   maximum number of additional units that dedicated materials and labor can
   build and dispatch within the published window, after accounting for work
   already promised. Use the smaller supported limit when materials and labor
   produce different answers. The seed source plans an initial cap of 10 for
   each of 15 prepared SKUs. The three Dive Pack values are targets, not a claim
   that their production capacity or inventory rows have been verified. The
   reviewed one-time seed is `supabase/store-launch-capacity.sql`; it inserts
   only missing rows and never restores existing rows. Its planned values are
   reproduced here for operational review:

   ```sql
   insert into public.store_inventory (sku, on_hand_quantity)
   values
     ('SP-KIT-STARTER', 10),
     ('SP-DECK-BLUE-WATER', 10),
     ('SP-DECK-DISRUPTION', 10),
     ('SP-DECK-CORAL-GARDEN', 10),
     ('SP-DECK-DARKNESS-SHROUD', 10),
     ('SP-DECK-OPEN-OCEAN-HUNT', 10),
     ('SP-DECK-MURKY-WATER', 10),
     ('SP-DECK-STINGING-FORTRESS', 10),
     ('SP-PACK-OCEANIC', 10),
     ('SP-PACK-REEF', 10),
     ('SP-PACK-DEEP', 10),
     ('SP-ACC-SET', 10),
     ('SP-ACC-CONDITIONS-DECK', 10),
     ('SP-ACC-DICE-PACK', 10),
     ('SP-ACC-REEF-POINTS', 10)
   on conflict (sku) do nothing;
   ```

   This example describes a planned 150-unit from-empty maximum; it neither
   proves shared resources can support that promise nor proves all 15 rows exist
   in production. The current live allowlist contains the Starter Kit, seven
   deck SKUs, and Accessories Kit (90 units of intended initial aggregate ATP).
   The three visible Dive Packs are prelaunch and would add a planned 30 only
   after their release gates pass. The other three rows remain private
   preparation records and must not be treated as public availability. The
   Starter Kit row was verified at 9 ATP and 0 reserved on 2026-08-16 after an
   earlier test unit; never rerun the seed to restore it. Confirm current
   production rows by query and the aggregate material and labor plan before
   running the seed. Never use an `on conflict ... do update` deployment script:
   redeploying it could replenish already-sold capacity. Never reset a count
   merely because a new day or week began.
5. Treat Starter Kits and Accessories Kits as independent SKUs. They may be
   assembled after purchase, but this ledger does not allocate shared component
   stock across a bundle and its individually sold components. Until a
   bill-of-materials allocator exists, dedicate a fixed allotment of cards,
   dice, tokens, packaging, and labor to each SKU. Never count the same
   component toward both a bundle's ATP capacity and an individual component's
   capacity.
6. Confirm every `STORE_AVAILABLE_PRODUCT_IDS` product maps to exactly one
   inventory SKU. A zero count is valid sold-out state; a missing row fails
   checkout closed.
7. Configure a dedicated Stripe payment-method configuration containing only
   synchronous payment methods and set `STRIPE_PAYMENT_METHOD_CONFIGURATION_ID`.
   Do not enable delayed methods until processing-state holds are designed.
8. Run `npm run store:check:online` against production; its inventory checks are
   read-only. Prefer a separate non-production Supabase project and inventory
   dataset for test-mode Checkout, signed webhook, expiration/failure release,
   and refund/dispute lifecycle tests. The ledger is keyed by SKU rather than
   Stripe mode, so a test-mode payment against production consumes real counters.
   If a separate project is unavailable, keep public checkout disabled, expose
   only a nonpublic test SKU such as `SP-ACC-CONDITIONS-DECK` locally, and treat
   its one test unit as an intentional production-ledger mutation. Never use a
   public launch row for that test. A refund does not restock it; leave the unit
   conservatively consumed or make a documented, intentional capacity adjustment
   only after reviewing the order and refund records. Verify `on_hand` and
   `reserved` after every transition.
9. Enable checkout only after the owner confirms the ATP capacities and
   published build-and-dispatch windows, confirms the shared one-business-day
   expedited workload and hard 10-order daily limit when that option is
   enabled, verifies its Eastern allocation boundary and exact Stripe Handling
   Charge tax code, drains every legacy pay-capable Session, and all test
    results pass.

For the three Dive Packs, keep the existing nine-product live allowlist in
place until this release sequence is complete: verify contents, representative
art, packaging/fulfillment, and five-business-day capacity; deploy
`STORE_CHECKOUT_ENABLED=false`; apply the non-replenishing seed and query the
three `SP-PACK-*` rows; stage the twelve-product allowlist and run both launch
and online readiness checks; then add the three Dive Pack product IDs and
re-enable checkout. Do not use the seed file itself as evidence that a row was
applied.

Applying the app before the SQL migration is safe: the missing reservation RPC
causes checkout to fail before Stripe is called. Do not leave the old app live
after applying the schema because old order creation does not reserve stock.
Existing pre-migration orders remain `inventory_state='not_managed'`; their
webhooks retain the legacy ledger behavior and never mutate stock. That is why
the legacy-session drain must finish before the first inventory count is seeded:
an old Session paid afterward would otherwise sell a unit without decrementing
the new ledger.

## Made-to-order capacity model

The database column remains named `on_hand_quantity`, but for a made-to-order
SKU its operational meaning is the currently unconsumed ATP capacity. It is not
a raw-material ledger, production schedule, or bill-of-materials system.

The established nine live products use an initial cap of 10 and a standard
five-business-day build-and-dispatch window. The owner approved the same
five-business-day policy for each Dive Pack; the seed proposes an initial cap of
10 subject to physical capacity verification before enablement. The visible
public catalog has 12 products, but the live allowlist remains the Starter Kit,
seven deck rows, and Accessories Kit row. The full seed source plans 15 rows; if
every row were missing, it could insert up to 150 units of intended initial capacity.
That arithmetic is not evidence of current production state or aggregate
support. Query the ledger and verify dedicated materials and labor before any
cutover; dedicate resources or lower affected values when 10 is not supportable.

A reservation reduces customer-visible availability while payment is pending.
A paid order permanently consumes one of the ten slots for its SKU. Restore one
slot only when fulfillment progress, remaining dedicated materials, and labor
again support one additional order inside that SKU's published promise.
Shipping an order does not by itself prove that its materials have been
replenished. If a production delay or material shortage reduces capacity,
lower the affected count promptly after accounting for active reservations.
Never lower `on_hand_quantity` below `reserved_quantity`.

Publish the made-to-order status and a conservative build-and-dispatch window
on the product/store policy before accepting payment. Delivery estimates must
add carrier transit time to that production window rather than presenting the
production deadline as an arrival date.

## Shipping weights, packages, and order limits

The owner approved the launch shipping model on **2026-08-15**. The Dive Pack
definitions use a planned conservative 8-ounce checkout input. For checkout
tiering, each deck or set-specific Dive Pack has a
`shippingWeightOunces` value of 8 ounces; each Starter Kit and accessory SKU has
a value of 16 ounces. Before enabling a Dive Pack, verify a complete packed
sample does not exceed that conservative input and record its packaging
procedure; no Dive Pack parcel measurement or material is asserted here.
Multiply quantity by weight and sum the order before creating Checkout. These
values are separate from inventory ATP units.

Reject an online order above **8 items** or **128 ounces (8 lb)**. Select the
customer-facing rate from the approved conservative order weight:

| Fulfillment option | Up to and including 16 oz | More than 16 oz through 128 oz |
| --- | ---: | ---: |
| Standard Shipping & Handling | $10.00 | $20.00 |
| Priority Shipping & Handling | $15.00 | $35.00 |
| Scheduled pickup — Elverson, PA | Free | Free |

The confirmed ready-to-mail parcels and 19520-to-90001 Pirate Ship quotes that
support those rates are:

| Parcel | Conservative weight | Outside dimensions | Economy postage | Priority postage | Economy / Priority incl. $0.75 box |
| --- | ---: | --- | ---: | ---: | --- |
| One 60-card deck | 0.5 lb | 8 × 6 × 2 in | $6.23 | $13.48 | $6.98 / $14.23 |
| One Starter Kit | 1 lb | 10 × 8 × 2 in | $8.76 | $13.48 | $9.51 / $14.23 |
| Maximum 8-item order | 8 lb | 20 × 14 × 6 in | $18.86 | $33.04 | $19.61 / $33.79 |

The Pirate Ship figures are postage before the owner-confirmed $0.75 brown box
cost; the final column adds it. At fulfillment, still enter the actual packed
weight and outside dimensions when purchasing the label. If an order exceeds
the recorded 8-pound or 20 × 14 × 6 inch maximum, do not improvise a cheaper
service or split shipment: stop and resolve the shipping configuration before
accepting another affected order.

## Standard and expedited production

Standard production is included with every launch order and promises build and
dispatch within five business days. When enabled, expedited production is one
$10 charge per order and promises build and dispatch within one business day.
It is an order-level queue-priority choice, not a per-item charge, a different
SKU, faster carrier postage, or guaranteed one-day delivery.

Use `STORE_EXPEDITED_PRODUCTION_ENABLED=true` only while the option is actually
available. Its configured amount must remain `1000` cents and
`STRIPE_PRODUCTION_TAX_CODE` must remain Stripe's canonical Handling Charge code
`txcd_92010004`. Pennsylvania includes handling and labor/service charges in the
taxable purchase price of a taxable sale; see [61 Pa. Code § 33.2](https://www.pacodeandbulletin.gov/Display/pacode?d=reduce&file=%2Fsecure%2Fpacode%2Fdata%2F061%2Fchapter33%2Fs33.2.html)
and the [Tax Reform Code § 201(g)](https://www.legis.state.pa.us/WU01/LI/LI/US/htm/1971/0/0002.002.000.001.000..htm).
Stripe's current canonical classification appears in its [product tax-code
list](https://docs.stripe.com/tax/tax-codes).

Rush capacity is separate from the per-SKU ATP ledger. The owner-approved hard
limit is 10 expedited orders per production due date, configured as
`STORE_EXPEDITED_PRODUCTION_DAILY_ORDER_LIMIT=10` with
`STORE_EXPEDITED_PRODUCTION_TIME_ZONE=America/New_York`. Each order consumes one
slot regardless of its number of units. Checkout allocates the slot atomically
to the next Monday-through-Friday production due date in Eastern time: orders
accepted Friday, Saturday, or Sunday all target Monday. Eastern midnight is the
calendar boundary.

A terminal unpaid or expired Checkout Session releases its rush slot. A paid
order consumes the slot permanently for capacity accounting; a later refund or
dispute does not restore it. The calendar does not model public holidays, so the
operator must disable expedited selection or adjust staffing/capacity around
closures before accepting promises the business cannot meet.

Review the active expedited queue, total units, staffing, materials, and
quality-control time before every business day and after each large order. If
the one-business-day promise becomes unsafe, set
`STORE_EXPEDITED_PRODUCTION_ENABLED=false` and deploy before accepting another
rush order. Do not treat disabling the option as cancellation of orders already
accepted. Set `STORE_EXPEDITED_PRODUCTION_CAPACITY_CONFIRMED=true` only while the
owner-approved 10-order control remains active.

## State and invariants

- `on_hand_quantity` includes finished units or made-to-order ATP slots held by
  open Checkout Sessions.
- `reserved_quantity` is the subset held by active reservations.
- available units equal `on_hand_quantity - reserved_quantity`.
- reservation atomically locks each SKU, checks availability, increments the
  hold, creates the order, and stores immutable item snapshots.
- paid and authenticated refund/dispute lifecycle events commit once by
  subtracting both on-hand and held units. Refunds and chargebacks never
  automatically restock a returned product.
- `checkout.session.expired` and `checkout.session.async_payment_failed`
  release both the inventory hold and an expedited due-date slot. A
  `payment_intent.payment_failed` event is a retryable payment attempt and
  deliberately releases neither.
- webhook event IDs and checkout request UUIDs make both transitions
  idempotent. A browser retry, cancel return, or reload reuses the saved Session
  while the cart, production choice, and fulfillment choice are unchanged.

## Cancellations, returns, and customer problems

Use `maker@seapalstcg.com` as the public support channel and require the order
number plus the purchaser's email address before changing an order. Apply the
owner-approved policy consistently:

- Honor a cancellation request emailed within two hours after purchase. After
  that window, use the return rules rather than promising cancellation.
- Accept an unopened-item return requested within 30 calendar days after
  carrier-tracked delivery or scheduled pickup. Send return instructions
  before the customer mails anything. The customer pays postage for an ordinary
  unopened-item return.
- Treat opened or played products as final sale unless they are damaged,
  defective, missing, or incorrect. Require those problems to be reported
  within 14 calendar days after delivery or pickup, then record the report and
  send the applicable return or remedy instructions.
- Investigate a shipment when tracking suggests carrier loss. Once carrier loss
  is confirmed, replace the affected order subject to product availability or
  issue a refund.
- Issue an accepted refund to the original payment method within five business
  days. For a physical return, count from receipt and inspection. Tell the
  customer that their bank or card issuer may take additional time to post it.

Record the support request timestamp, order number, decision, any returned
quantity, inspection result, refund identifier, and customer communication in
the private order record. A refund does not automatically put returned units
back into available inventory. Inspect the returned item and make any safe,
intentional inventory adjustment separately.

### Stripe refund and dispute lifecycle

The live Stripe event destination must subscribe to this exact effective set:

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

`charge.refunded` may remain subscribed temporarily for compatibility, making
11 selected events, but the endpoint deliberately acknowledges and ignores it.
Stripe identifies `refund.created`, `refund.updated`, and `refund.failed` as the
authoritative Refund-object lifecycle. A Charge snapshot can describe a refund
before it ultimately succeeds, so it must never mark an order refunded.

Each Refund object is stored privately by its `re_` identifier. `pending` and
`requires_action` refunds keep fulfillment on hold but do not increase the
refunded amount or cancel the order. `failed` and `canceled` attempts remain
visible for operator follow-up and do not change inventory. Only `succeeded`
refunds increase `amount_refunded_cents`; a succeeded refund that later fails
is subtracted again and the order remains on hold for manual resolution.
Multiple partial refunds reconcile independently and webhook event IDs make
retries idempotent. The schema records a stable per-order Refund-object cutover
time so a delayed event for a legacy `charge.refunded` snapshot is not counted
twice, and a later failure can remove that legacy optimistic amount.

An open dispute sets the payment to `disputed`. `charge.dispute.closed`
records Stripe's final status: `lost` becomes `chargeback` and cancels an
unfulfilled order, while `won`, `prevented`, or `warning_closed` restores the
underlying paid/partially-refunded/refunded state. A merchant-favorable closure
stays on hold until an operator deliberately resumes fulfillment; a late win
therefore never restarts a previously cancelled order automatically. Completed
shipments and pickups are never overwritten, and neither outcome restocks
inventory.

## Staff fulfillment workflow

The private `/admin/orders` workspace records production separately from
payment and inventory. Mailed orders normally move through **Awaiting
production**, **In production**, **Packing**, **Awaiting shipment**, then
**Shipped**. Local pickup orders normally move through **Awaiting production**,
**In production**, **Packing for pickup**, **Ready for pickup**, then **Picked
up**. Staff can move backward to correct an operational mistake; the database still prevents pickup-only
states on shipped orders, shipping-only states on pickup orders, and active work
on orders that are not fully paid. Only Shipped or Picked up records the
completion timestamp. On hold and Cancelled are exception states used by the
refund/dispute lifecycle or deliberate staff action.

## Stale or ambiguous reservations

Never release solely because `inventory_reserved_until` passed. Stripe can
deliver a terminal webhook late, and a completed asynchronous payment can settle
after Checkout itself closes. Launch configuration therefore excludes delayed
payment methods.

The five-minute Worker cron now reconciles overdue `reserved` rows through a
private, service-role-only queue. Passing the deadline only makes a row
eligible for inspection; neither the listing RPC nor the lease RPC changes an
inventory count. Each run lists at most 10 rows, processes them sequentially,
and gives each candidate a three-minute database lease. An unresolved claim is
released with a five-minute retry delay, and database limits cap a manual batch
at 25, a lease at 10 minutes, and retry delay at one hour.

For each claimed order, the Worker follows this state machine:

1. Retrieve the exact saved `checkout_session_id` from Stripe and verify its
   ID, live/test mode, order metadata, client reference, reservation version,
   and payment mode against the private order row. A missing or mismatched
   reference remains held.
2. If Stripe reports both `status=complete` and `payment_status=paid`, feed a
   deterministic synthetic event ID into the same atomic
   `process_store_payment_event` RPC used by signed webhooks. That commits the
   reservation and repairs the merchant-notification outbox idempotently. A
   complete-but-unpaid or otherwise ambiguous Session remains held.
3. If Stripe reports `status=open` and `payment_status=unpaid`, explicitly ask
   Stripe to expire it with a stable idempotency key. Ignore the POST response
   for release purposes and retrieve the Session again.
4. Release inventory only when that fresh Stripe retrieval reports
   `status=expired` and `payment_status=unpaid`. The terminal transition again
   runs through `process_store_payment_event`; no reconciliation RPC directly
   decrements `reserved_quantity`.
5. Provider, database, missing-reference, and ambiguous-state failures clear
   only the short reconciliation lease and schedule a retry. They leave the
   inventory and rush-capacity reservation intact.

The payment transition clears reconciliation lease metadata atomically, while
claim completion is idempotent if its response is lost. The cron runs this job
and both merchant-notification drains with `Promise.allSettled`, so every job is
attempted even if another fails. Logs contain bounded count summaries and
stable error codes only—never order IDs, Session IDs, secrets, addresses, or
customer details.

For a reservation with no saved Session because Session creation had an
ambiguous network outcome, retry the same browser request UUID. Stripe receives
the same per-order idempotency key. Do not create a second request UUID or
manually release the row merely to clear the hold.

## Merchant purchase-alert outbox

The paid-order transaction inserts one unique `merchant_purchase` row in the
private `store_order_notifications` outbox. The webhook claims that row with a
short database lease, sends through Resend with a stable per-order idempotency
key, and marks it sent. The Cloudflare Worker also drains eligible pending rows
every five minutes, so recovery does not end with Stripe's webhook retry
window. A delivery or database-completion failure leaves the outbox entry
retryable and never logs customer details. Once a paid transition creates the
outbox row, later refund, dispute, or chargeback state does not suppress the
original purchase alert. Concurrent webhook and cron workers cannot hold the
same lease.

The same private outbox also carries one `merchant_fulfillment_due` reminder
per paid live order. At 9:00 a.m. Eastern on the business day before the order's
production promise ends, the cron queues a reminder unless a mailed order is
already **Awaiting shipment** or **Shipped**, or a pickup order is already
**Ready for pickup** or **Picked up**. Cancelled and non-paid orders are never
queued. A paid order deliberately left **On hold** is still surfaced because
its promised date remains at risk.

Expedited reminders use the immutable reserved `production_due_date`. Standard
reminders calculate five Monday-through-Friday production days after `paid_at`,
matching the published promise and the existing no-holiday-calendar policy. The
database only opens the queue from the prior business day through the due date,
so applying the migration cannot create a flood of historical reminders. The
drainer rechecks payment and fulfillment after claiming; if staff marked the
order ready in the meantime, or the due date has ended, it closes the stale
outbox row without sending.

Before accepting payments, enable `STORE_ORDER_NOTIFICATION_ENABLED`, configure
`RESEND_API_KEY`, `EMAIL_FROM`, and `STORE_ORDER_NOTIFICATION_EMAIL`, and verify a
synthetic test-mode order reaches the private recipient. Only then set
`STORE_ORDER_NOTIFICATION_DELIVERY_CONFIRMED=true`. Monitor Cloudflare Cron
Trigger outcomes and the unsent queue; after correcting a provider or
configuration problem, the next five-minute run retries it automatically. Never
manually mark an alert sent merely to silence the retry.

Set `STORE_FULFILLMENT_DUE_NOTIFICATION_ENABLED=true` to activate due reminders
through that same verified sender and recipient. Disable this flag to pause new
reminder preparation and delivery without affecting purchase alerts.

Roll out the schema before the Worker: apply the current
`supabase/store-orders.sql`, verify `npm.cmd run store:check:online` reaches the
v7 contract, and only then deploy the Worker with the reminder flag enabled. If
the Worker must be deployed first, keep the reminder flag false until the v7
RPC is installed; otherwise each five-minute reminder drain will call a function
that does not exist yet.

The delivery guarantee is at-least-once, not exactly-once. Resend retains an
idempotency key for 24 hours. If it accepted a message but the response and
database completion were both lost, a retry after that window can send a rare
duplicate. Use the order number to recognize it and do not fulfill twice.

## Capacity adjustments, replenishment, and monitoring

Availability counts are private and should be adjusted only by an owner through
the Supabase SQL editor while checkout is disabled or after accounting for all
active reservations. Never set `reserved_quantity` manually.

For finished stock, increase `on_hand_quantity` only when additional sellable
units pass quality control. For made-to-order inventory, increase it only when
dedicated materials and production capacity can support additional orders
inside the published window. A replenishment is an increment to the remaining
count, not a reset to the original launch count. Record the reason, quantity,
operator, and date outside the public storefront. Decrease capacity immediately
when damage, shortages, workload, or carrier constraints make the current
promise unsafe.

Monitor:

- reserved orders without a saved Checkout Session;
- reservations past their deadline;
- repeated checkout request conflicts;
- `reserved_quantity > 0` for long periods;
- inventory RPC/webhook failures;
- reconciliation rows whose attempt count or last safe error code keeps
  increasing after the underlying Stripe or database incident is corrected;
- unsent `store_order_notifications` rows, failed Cron Trigger outcomes, or
  repeated email-provider failures;
- bursts of new unpaid reservations or checkout 429 responses in Cloudflare
  Worker logs.

Unauthenticated reservations can be abused to hold scarce stock. The production
Worker therefore calls a native Cloudflare Rate Limiting binding only for exact
`POST /api/store/checkout` requests. It permits 10 attempts per 60 seconds per
one-way hash of the edge-reported network address, emits safe 429/503 log
records, and fails closed if the binding is unavailable. Cloudflare documents
these counters as local, permissive, and eventually consistent, so they reduce
abuse but do not replace SQL locking, hard ATP limits, or the Stripe-verified
scheduled reconciler.
