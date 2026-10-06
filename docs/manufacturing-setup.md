# Manufacturing integration and activation

The implementation connects paid-order intake, immutable booster draws, private
Figma PNG releases, separate Epson/Canon print jobs, a QR work ticket, a staff
checklist, and buyer milestone emails. It is **not enabled in production yet**.

## Database setup completed — October 5, 2026

Applied `supabase/manufacturing.sql` successfully to the existing SeaPalsTCG
production project (`ehlrzpcusxsbdsddyykm`) through the Supabase SQL Editor.
The migration ran in one transaction. No existing orders were backfilled.

All nine checks in the original `supabase/manufacturing-verify.sql` passed: four tables,
row-level security, restricted client access, server access, all thirteen
server-only functions, the paid-order/fulfillment trigger, the settings row,
the private artwork bucket, and the restrictive storage policy.
Authenticated server API reads also succeeded; the website's public key was
denied access to all four manufacturing tables. The queue, release, and buyer
notification tables were empty after setup, with no active artwork release.

Applied migration SHA-256:
`ae50c1d9e8047878452423c0d85ca5b4f2905ae5697953517c35194dce47f508`.
The migration is saved in the project's SQL Editor. Future database checks can
use the read-only verification file; no print jobs or buyer messages are needed.

## Inventory database extension completed — October 6, 2026

Applied `supabase/manufacturing-inventory.sql` to the same production project.
All eleven updated verification checks passed: seven tables with restricted
client access, eighteen server-only functions, the refund reservation-release
trigger, and valid finished-stock counters. Read-only server API checks also
verified the new order relationship and inventory endpoint; public reads were
denied. All fifteen finished products start at zero. Checkout capacity was
compared with its pre-migration snapshot and is unchanged. No workshop jobs,
stock movements, or stock operations were created in production by testing.

Applied inventory migration SHA-256:
`68fbe8f008aa8e33f012453a5e3fe4da29d2edd58a55f94aaeb874021a330c42`.

For a new database, apply `manufacturing.sql` and then
`manufacturing-inventory.sql`. For this existing database, the inventory
extension is already applied. If the base migration is ever reapplied, apply
the inventory extension again afterward; it replaces the base job functions.
Both migrations are rerunnable without resetting existing stock.

## Verified in this workspace

- Before the main-branch push, an isolated checkout containing this integration
  and its required rarity definitions passed all 2,361 repository tests and the
  Next/Cloudflare production build. Its source-map check also passed using the
  tracked `scripts/manufacturing/figma-holo-sources.json`; no scratch artifact
  directory is needed to run the exporter.
- All 35 manufacturing tests pass, including seven finished-inventory tests
  using the real migration and service boundary against embedded PostgreSQL
  (PGlite). Coverage includes independent builds, duplicate receipts, competing
  reservations, shortages, stock-only orders, cancellation/refund release,
  packing consumption, and test-order isolation. The base migration covers
  duplicate payments, claims, immutable manifests, revision conflicts, refunds,
  access restrictions, and email retry expiry. The current full repository run
  passes 2,401 of 2,402 tests; the unrelated Cleaner Shrimp metadata expectation
  in `src/app/simulator/updatedCardArtworkRules.test.mjs:77` fails against existing
  card data changes. The earlier October 5 full-suite run passed.
- The Next and Cloudflare production builds passed. The offline browser walkthrough confirmed
  printing → glue → cut → manual holo → QC → packing, including a phone viewport.
- The inventory browser walkthrough completed an independent two-unit stock
  build and verified that receiving it adds two available units and clears the
  build queue. The offline sample order reserves three of five boosters and
  prints only the remaining two. These demonstrations use local fake data.
- The generated Letter work ticket was rendered and visually checked. Its QR
  was decoded from the rendered PDF and points only to a staff order URL.
- A private `searealm-manufacturing-private` bucket was created in the existing
  Supabase project. A temporary test object was uploaded, authenticated download
  and metadata were verified, public download was rejected, and the test object
  was removed. R2 is not enabled on this account; Supabase Storage is the default.
- Official portable SumatraPDF 3.6.1 was downloaded to `.private/manufacturing/tools`.
  Windows verified its Authenticode signature. No printer job was submitted.
- `.private/manufacturing/printers.json` and `agent.env` were prepared. The device
  token is a separate random credential; calibration remains `false`.

## Finished inventory and independent builds

`supabase/manufacturing-inventory.sql` extends the original migration. It adds
finished-product stock, a movement ledger, and standalone workshop jobs without
creating purchase orders or buyers. Stock begins at zero; the previous
`store_inventory` capacity numbers are not physical counts and are not copied.
The existing checkout production-capacity limits are unchanged.

In the workshop's **Finished inventory** section:

- Use **Record a stock change** for an opening count, finished goods made
  outside the system, damage, returns inspected for resale, or event sales.
  Enter a positive or negative change and a reason. Stock reserved for an
  order cannot be removed. The ledger records every change.
- Use **Build stock without an order** to make up to 100 finished units per
  job. This uses the existing private artwork, Epson fronts, Canon backs,
  QR work ticket, and manual finishing checklist. Packs keep the same odds
  and saved draw. Stock is credited only after QC and **Packed — receive into
  stock**. A completed build cannot credit stock twice or email a buyer.
- Paid live orders atomically reserve available finished products. Ordering
  five boosters when three are available reserves three and generates only
  two new boosters. Fully stocked orders need only the work ticket and stock
  picking/QC/packing checklist; they do not need new artwork or a new draw.
- Stock builds in progress are displayed separately and cannot be reserved
  as finished goods. Allocation is saved for the order: later receipts do not
  silently replace a pinned production plan or change booster contents.
- Packing a customer order consumes its reserved goods once. Cancellation,
  refunds, and disputes release unused reservations and block the job for
  review. An already packed order does not create a returned item automatically.
  Reconcile physical returns and record an explicit stock change.
- Whole products are tracked independently: a Starter Kit is one finished kit,
  not an automatic conversion of loose deck/dice stock. Individual cards,
  component conversion, and low-stock automatic replenishment are not enabled.

The existing staff token authenticates these hooks at
`POST /api/admin/manufacturing`. Keep one UUID per operation and reuse it if a
request's response is lost. Reusing an ID with different contents is rejected.

```json
{"action":"build_stock","id":"<uuid>","items":[{"productId":"reef-dive-pack","quantity":10}]}
```

```json
{"action":"adjust_stock","id":"<uuid>","productId":"reef-dive-pack","quantity":5,"reason":"Opening shelf count"}
```

`GET /api/admin/manufacturing` includes `stock` (on hand, reserved, available,
and planned) and recent `movements`. Job details include `job_kind` and the
saved `inventoryPlan`. The staff UI retains an uncertain operation for retry,
including across refreshes. Stock builds never insert into `store_orders`.

## Remaining activation steps

1. Deploy the integrated application after reviewing the working tree. Keep
   `MANUFACTURING_ENABLED`, `MANUFACTURING_ALLOW_TEST_ORDERS`, and
   `MANUFACTURING_BUYER_NOTIFICATIONS_ENABLED` false initially. Existing store,
   Supabase, and Resend configuration remains in use. No R2 billing activation
   or bucket binding is needed. No deployment was made by this integration turn.
2. Set the Worker secret `MANUFACTURING_AGENT_TOKEN` to the value in the private
   `agent.env` file using Wrangler's interactive secret input. Do not put it in
   `NEXT_PUBLIC_*`, the QR, a tracked file, or browser JavaScript. The staff
   screen reuses `STORE_ADMIN_TOKEN`; both tokens must be at least 24 characters.
3. Provide a local `FIGMA_ACCESS_TOKEN` with file read access for unattended
   export. The Figma connector inspected source nodes, but its connection is
   not a reusable credential for a scheduled Node process. Keep this token on
   the sync PC. Supply `STORE_ADMIN_TOKEN` to that process for publishing.
4. Resolve the eleven missing card mappings below, then publish a private
   artwork release. The script pins one Figma version for every export and
   checks collector numbers, dimensions, sheet positions, and checksums.
5. Use the established Epson and Canon printer profiles with Letter, actual
   size, simplex, and the intended trays/media settings. The owner opted to
   skip the separate alignment-check print on October 5, 2026. That print is
   optional; it is not a database setup or activation prerequisite. The local
   `calibrationConfirmed` setting is still false because this database-only
   step did not activate the printers. Confirm the existing profiles in that
   setting when enabling the printer agent.
6. Enable agent claiming and explicitly allow test orders for one controlled
   paid test order. Test orders never enqueue buyer emails. Confirm an actual
   work-ticket scan and both printer outputs. Turn test-order allowance back
   off, enable buyer milestone emails, then install the Windows startup task.

No live buyer emails or physical prints were sent during implementation.

## Local commands

Use Node 24 and `npm ci` (including dev dependencies on the printer PC). The PDF
renderer, PNG decoder, and QR generator are local tools and are not imported by
the public website. `npm.cmd` avoids Windows PowerShell script-policy issues.

```powershell
# Read-only source audit; no Figma token needed.
node scripts/manufacturing/sync-figma.mjs --check

# Secrets belong in an ignored local environment file, not command arguments.
# sync.env: FIGMA_ACCESS_TOKEN and STORE_ADMIN_TOKEN.
node --env-file=.private/manufacturing/sync.env scripts/manufacturing/sync-figma.mjs --publish

# Subsequent runs only export/publish when the Figma version or mappings change.
node --env-file=.private/manufacturing/sync.env scripts/manufacturing/sync-figma.mjs --publish --if-changed

# Read-only readiness check, including the deployed database and private bucket.
node --env-file=.env.local --env-file=.private/manufacturing/agent.env scripts/manufacturing/doctor.mjs --online

# One production poll; blocked by the local calibration flag until confirmed.
node --env-file=.private/manufacturing/agent.env scripts/manufacturing/agent.mjs --config .private/manufacturing/printers.json --once

# Continuous outbound polling every 15 seconds while this PC is awake.
node --env-file=.private/manufacturing/agent.env scripts/manufacturing/agent.mjs --config .private/manufacturing/printers.json

# Optional Windows sign-in startup; installer refuses uncalibrated profiles.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/manufacturing/install-startup-task.ps1

# Optional hourly Figma sync, after setting up sync.env and all source mappings.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/manufacturing/install-sync-task.ps1

# Targeted integration checks and an offline PDF preview.
node --test src/lib/manufacturing/*.test.mjs
node scripts/manufacturing/preview.mjs
```

The startup installer registers a hidden task for the current user at sign-in.
It does not start it immediately or install an always-on service. The PC must
remain awake and signed in. To stop future runs, disable `SeaRealm Manufacturing
Agent` in Task Scheduler and stop the running agent, or turn the server printing
flag off. Never remove an uncertain print attempt to make the queue retry it.

The sync installer creates `SeaRealm Figma Print Artwork Sync`, an hourly local
job using the private `sync.env` and optional `figma-overrides.json`. It runs
while the user is signed in, preserves completed exports after interruptions,
and observes Figma's retry time after rate limits. No recurring chat task or
Windows sync schedule has been installed yet. Publishing is independent of
printing: existing saved manifests keep their original artwork and booster draw.

## Missing artwork

269 of 280 required source nodes are mapped, including the shared back and 51
fixed deck/Conditions sheets. The complete set catalog remains 228 printings.

| Printing | Card |
|---|---|
| deep-060 | Yeti Crab |
| deep-061 | Hatchetfish |
| deep-062 | Bloody-Belly Comb Jelly |
| ocean-064 | Chum Bucket |
| reef-094 | Horseshoe Crab |
| reef-096 | Yellow Tang |
| reef-097 | Bicolor Dottyback |
| reef-098 | Copperband Butterflyfish |
| reef-099 | Yellowwatchman Goby |
| reef-100 | Hermit Crab |
| reef-101 | Sea Cucumber |

Southern Flounder (`reef-068`) maps to Figma's `winter-flounder` component
`193:27`, verified by `68/102`. Sea Fan (`reef-095`) maps to `92:310`, verified
by `95/102`. These name differences do not change the catalog.

Provide an overrides JSON object such as `{ "deep-060": "1234:5678" }` and pass
`--overrides <file>`. Export validation still requires the correct collector
number. Missing nodes are not replaced with public previews or removed from
the random pool. With explicit `--allow-incomplete`, available artwork can be
published for fixed decks and ready orders. An order needing an incomplete
booster set is held before its first draw; no cards are excluded from that set's
pool. Once the complete artwork is published, explicitly retry preparation to
use that release. Already saved draws retain their original artwork and contents.
The default export mode requires complete mappings.

## Operational behavior

- Live paid transitions queue one manufacturing record. Neither checkout-page
  visits nor repeated Stripe events create additional prints. Old orders can
  be explicitly queued in the staff screen by UUID if still eligible.
- Three Dive Pack recipes use 5 common + 3 uncommon + 1 premium, with a 25%
  independent holo replacement chance, strictly within their set. Prerelease
  printings remain eligible. The first saved draw is never rerolled.
- All seven fixed decks use their full Figma Letter PNG frames, including
  reference inserts. Starter Kit expands to Coral Garden + Drop Off + the
  18-card Conditions Deck, seven dice, and 15 tokens. Accessories Kit includes
  Conditions, dice, and tokens. Standalone prepared accessory SKUs are supported.
  Existing packaging supplies are checked during packing; this integration
  does not generate new box/wrapper artwork or carrier labels.
- Boosters use the measured 720 × 1008 slots at (195,138). Canon's back template
  is reduced to 96% once inside the Letter PDF. Fixed-sheet backs are imposed
  at matching card positions captured from each Figma frame; Conditions has
  slightly different gaps. Their positions are reflected left-to-right so they
  align after gluing with the printed faces outward. Artwork itself is never
  mirrored, and no automatic duplexing is used.
- Work tickets, fronts, and backs have separate durable attempt states. The
  Canon ticket defaults to the same stock/tray as backs; configure a dedicated
  plain-paper bin in its profile if desired. Sumatra submits exact-size PDFs
  with arguments passed directly, without constructing a shell command.
- A two-minute database lease prevents simultaneous claims. Before every
  physical submission, the agent records intent locally and reserves it in
  the database. Payment, refund, dispute, and fulfillment eligibility is checked
  again under an order lock. Orders on hold never begin another submission.
- An interrupted `submitting` attempt becomes `needs_review`; it is never
  automatically printed again. Check the printer queue and paper, then use
  **Paper checked** or **Reprint** with a reason. Reprints reuse the same art and
  draw; front reprints reset their holo checkboxes and both types reset assembly/QC.
  Already submitted pages may still finish after a hold or refund.
- A submission acknowledgement is not proof of physical output. Staff confirms
  both sides, glue/drying/cutting, every holo sticker, accessory picking, QC, and
  packing. Holo finishing may occur before or after gluing/cutting but precedes QC.
- The QR contains only `/admin/manufacturing?order=<UUID>`. Staff must sign in;
  scanning itself cannot change progress. A copied QR reveals no print image,
  device credential, buyer contact information, or booster contents.
- Confirmed printing and QC enqueue production/packing emails transactionally.
  Shipment and pickup readiness follow the existing Orders & shipping controls.
  The existing five-minute Worker cron drains this outbox. Emails contain no
  booster spoilers and skip obsolete milestones and refunded/held/test orders.
- One stable Resend idempotency key and frozen payload are used per milestone.
  Ambiguous sends older than 23 hours move to review before Resend's 24-hour
  deduplication window ends. Review the provider's delivery history before any
  manual resend. Their status is visible in the staff order detail.
- PNG masters, PDFs, journals, and device credentials remain in ignored
  `.private/manufacturing` locally. Supabase objects are private; the migration
  also denies ordinary authenticated/public access through restrictive policies.
  Only the authenticated server/agent path can return full-resolution bytes.

## Main implementation files

- `supabase/manufacturing.sql`: intake, leases, immutable manifests, atomic state,
  private access, and buyer outbox.
- `supabase/manufacturing-inventory.sql`: finished goods, reservations, movement
  ledger, independent stock builds, and atomic receipt/consumption hooks.
- `src/lib/manufacturing/`: recipes, generation, workflow, integration, storage,
  notifications, and tests.
- `/api/admin/manufacturing`: staff checklist and private release publishing.
- `/api/manufacturing/agent`: device claim, heartbeat, reserved attempts, and assets.
- `/admin/manufacturing`: QR destination and workshop dashboard.
- `scripts/manufacturing/`: Figma export, PDF rendering, local printer agent,
  startup scripts, readiness check, and offline preview.

Primary references: [Figma versioned exports](https://developers.figma.com/docs/rest-api/file-endpoints/),
[Supabase private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals),
[SumatraPDF print arguments](https://www.sumatrapdfreader.org/docs/Command-line-arguments),
and [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
