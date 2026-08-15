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
   produce different answers. The owner has set the initial cap at 10 for each
   of the 12 launch SKUs. The reviewed one-time seed is
   `supabase/store-launch-capacity.sql`; it inserts one row for every launch
   catalog SKU. Its values are reproduced here for operational review:

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
     ('SP-ACC-SET', 10),
     ('SP-ACC-CONDITIONS-DECK', 10),
     ('SP-ACC-DICE-PACK', 10),
     ('SP-ACC-REEF-POINTS', 10)
   on conflict (sku) do nothing;
   ```

   This example records the owner-approved caps; it does not prove that shared
   resources can support 120 simultaneous units. Confirm the aggregate material
   and labor plan before running it. Never use an `on conflict ... do update`
   deployment script: redeploying it could replenish already-sold capacity.
   Never reset a count merely because a new day or week began.
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
   read-only. Run test-mode Checkout, signed webhook, expiration/failure release,
   and refund/dispute lifecycle tests against a separate non-production Supabase
   project and inventory dataset. Never give a staging/test deployment the
   production service-role key or let Stripe test-mode events mutate production
   inventory. The ledger is keyed by SKU rather than Stripe mode, so a test-mode
   payment against production would consume real counters. Any production smoke
   purchase must be a real live sale with its finished unit or ATP capacity
   allocated; do not silently restore it afterward. Verify `on_hand` and
   `reserved` after every transition.
9. Enable checkout only after the owner confirms the ATP capacities and
   published build-and-dispatch windows, confirms the shared one-business-day
   expedited workload and hard 10-order daily limit when that option is
   enabled, verifies its Eastern allocation boundary and exact Stripe Handling
   Charge tax code, drains every legacy pay-capable Session, and all test
   results pass.

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

The owner-approved initial cap is 10 and the standard build-and-dispatch window
is five business days for each of the 12 launch SKUs. Before seeding all rows,
verify that dedicated materials and labor can support the aggregate promise;
twelve separate rows at 10 can accept up to 120 units concurrently. If that is
not supportable, dedicate resources or lower the affected values.

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
- paid/refund/dispute events commit once by subtracting both on-hand and held
  units. Refunds never automatically restock a returned product.
- `checkout.session.expired` and `checkout.session.async_payment_failed`
  release both the inventory hold and an expedited due-date slot. A
  `payment_intent.payment_failed` event is a retryable payment attempt and
  deliberately releases neither.
- webhook event IDs and checkout request UUIDs make both transitions
  idempotent. A browser retry, cancel return, or reload reuses the saved Session
  while the cart, production choice, and fulfillment choice are unchanged.

## Stale or ambiguous reservations

Never release solely because `inventory_reserved_until` passed. Stripe can
deliver a terminal webhook late, and a completed asynchronous payment can settle
after Checkout itself closes. Launch configuration therefore excludes delayed
payment methods.

For a reserved order whose Session outcome is unclear:

1. Retrieve the saved `checkout_session_id` from Stripe.
2. If Stripe says `complete` or `payment_status=paid`, replay/reconcile the
   signed event and commit the reservation.
3. If Stripe says `open`, explicitly expire it and confirm Stripe returns
   `status=expired`; the signed expiration event should release the hold.
4. Only after Stripe confirms terminal unpaid/expired status may an operator
   call `fail_store_order_checkout_and_release_inventory` for that order.
5. If the order has no saved Session because Session creation had an ambiguous
   network outcome, retry the same browser request UUID. Stripe receives the
   same per-order idempotency key. Do not create a second request UUID merely
   to clear the hold.

A scheduled reconciliation job should follow those Stripe verification steps
for overdue `reserved` orders. The database intentionally has no clock-only
sweep because that could sell a unit twice.

## Merchant purchase-alert outbox

The paid-order transaction inserts one unique `merchant_purchase` row in the
private `store_order_notifications` outbox. The webhook claims that row with a
short database lease, sends through Resend with a stable per-order idempotency
key, and marks it sent. The Cloudflare Worker also drains eligible pending rows
every five minutes, so recovery does not end with Stripe's webhook retry
window. A delivery or database-completion failure leaves the outbox entry
retryable and never logs customer details. Concurrent webhook and cron workers
cannot hold the same lease.

Before accepting payments, enable `STORE_ORDER_NOTIFICATION_ENABLED`, configure
`RESEND_API_KEY`, `EMAIL_FROM`, and `STORE_ORDER_NOTIFICATION_EMAIL`, and verify a
synthetic test-mode order reaches the private recipient. Only then set
`STORE_ORDER_NOTIFICATION_DELIVERY_CONFIRMED=true`. Monitor Cloudflare Cron
Trigger outcomes and the unsent queue; after correcting a provider or
configuration problem, the next five-minute run retries it automatically. Never
manually mark an alert sent merely to silence the retry.

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
- inventory RPC/webhook failures; and
- unsent `store_order_notifications` rows, failed Cron Trigger outcomes, or
  repeated email-provider failures;
- bursts of new unpaid reservations.

Unauthenticated reservations can be abused to hold scarce stock. Add a
Cloudflare rate limit for `POST /api/store/checkout` by IP/device plus a global
burst alarm before a limited-inventory launch. The SQL locking prevents
overselling, but rate limiting protects availability from deliberate hoarding.
Treat that rate limit and a scheduled Stripe-verified overdue-reservation
reconciliation job as launch blockers, not optional future cleanup.
