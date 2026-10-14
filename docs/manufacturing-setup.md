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

For a new database, apply `manufacturing.sql`, `manufacturing-inventory.sql`,
then `manufacturing-dispatch.sql`, in that order. Always reapply the later
migrations after rerunning an earlier one: each replaces shared job functions.
The migrations are rerunnable without resetting stock, saved cards, or dispatch
approval.

## Sending work to the printers

Applied `manufacturing-dispatch.sql` to the existing production Supabase project
on October 13, 2026. All thirteen read-only verification checks passed, including
nineteen server-only functions and the claim/submission approval gates.
Migration SHA-256:
`d4a95136f3de0fbe11891b66b3e72d053758050672df102b0c5d7f8ce2064100`.

Creating a paid-order job or an independent stock build leaves it **Awaiting
send**. Open the job in `/admin/manufacturing`, review the quantities from stock
and to make, then click **Send to printers**. The database records one approval
timestamp. Repeated clicks return that original request and cannot create a new
draw, duplicate a print, retry blocked work, or restart completed work.

```json
{"action":"send_to_printers","orderId":"<workshop-job-uuid>"}
```

This authenticated `POST /api/admin/manufacturing` action applies to customer
orders and stock builds. Approval does not consume inventory or notify a buyer.
Printing still waits for the global printing switch and the local agent.
The first eligible agent claim generates and saves randomized packs for the
shortfall; retries and explicit reprints use those saved contents. Fully stocked
orders need only their work ticket. A blocked preparation must be retried
explicitly; a repeated Send request does not clear it. Reasoned reprints after
initial approval keep the existing reprint workflow.

The dispatch migration leaves existing jobs unapproved too. The agent must
check approval both when claiming a job and immediately before every new spool
submission, including an old lease acquired before the migration. An already
submitted physical print can still finish; its late acknowledgement remains
recordable. Ordinary website users cannot call the dispatch database function.

## Verified in this workspace

- October 13: the Figma API and staff manufacturing API returned HTTP 200
  using the credentials in the ignored local environment file. All three
  manufacturing switches remain false. Private artwork export is in progress;
  no release has been published at this checkpoint.
- October 13: all 67 manufacturing tests passed, including approved unfinished
  artwork exclusions, printable prerelease cards, manual dispatch, duplicate
  clicks, old leases, refunds, frozen draws, new cutting-template
  rendering, and legacy layout compatibility. The isolated current-main
  checkout passed all 2,400 repository tests. Synthetic front/back PDFs were
  rendered and visually compared with the supplied Figma templates; these
  were preview files only. The offline browser walkthrough confirmed separate
  approval for customer orders and independent stock builds.
- The live database has one existing workshop job, no approved jobs, zero
  finished/reserved units, and no active artwork release as of this check.
  No production job was sent by the implementation or its verification.
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
  job, then open the build and click **Send to printers**. This uses the existing private artwork, Epson fronts, Canon backs,
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

1. Keep
   `MANUFACTURING_ENABLED`, `MANUFACTURING_ALLOW_TEST_ORDERS`, and
   `MANUFACTURING_BUYER_NOTIFICATIONS_ENABLED` false initially. Existing store,
   Supabase, and Resend configuration remains in use. No R2 billing activation
   or bucket binding is needed.
2. Set the Worker secret `MANUFACTURING_AGENT_TOKEN` to the value in the private
   `agent.env` file using Wrangler's interactive secret input. Do not put it in
   `NEXT_PUBLIC_*`, the QR, a tracked file, or browser JavaScript. The staff
   screen reuses `STORE_ADMIN_TOKEN`; both tokens must be at least 24 characters.
3. Keep `FIGMA_ACCESS_TOKEN` with file read access and `STORE_ADMIN_TOKEN`
   in the ignored local `sync.env` for unattended export and publishing. Both
   credentials were verified on October 13. The Figma connector's connection
   is not a reusable credential for a scheduled Node process.
4. Export and validate the eligible artwork, then publish a private release.
   The owner-approved eleven unfinished printings below are excluded until
   their sources are mapped and validated; finished prerelease cards remain
   included. Any other missing mapping must be resolved. The script pins one
   Figma version for every export and checks collector numbers, dimensions,
   sheet positions, and checksums.
5. Use the established Epson and Canon printer profiles with Letter, actual
   size, simplex, and the intended trays/media settings. The owner opted to
   skip the separate alignment-check print on October 5, 2026. That print is
   optional; it is not a database setup or activation prerequisite. The local
   `calibrationConfirmed` setting is still false because this database-only
   step did not activate the printers. Confirm the existing profiles in that
   setting when enabling the printer agent.
6. Enable agent claiming and explicitly allow test orders for one controlled
   paid test order, then explicitly send that selected order to the printers.
   Unapproved orders remain waiting. Test orders never enqueue buyer emails. Confirm an actual
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

# Optional hourly Figma sync, after setting up sync.env and eligible source mappings.
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
and observes Figma's retry time after rate limits. Image export requests can
take up to five minutes; metadata requests retain a 90-second limit. To resume
an interrupted manual sync after Figma changes, pass `--version <saved-version>`
to continue the same version and reuse its verified exports. For slow batches,
add `--batch-size 1` through `--batch-size 10` (the default is 10); this does
not change the release or its saved cards. No recurring chat task or
Windows sync schedule has been installed yet. Publishing is independent of
printing: existing saved manifests keep their original artwork and booster draw.

### Separate recurring chat handoff

The workflow stores pre-downloaded artwork in the private Supabase bucket
and the local `.private/manufacturing/releases` cache. Each release is
versioned and immutable. Orders use those saved PNGs without calling Figma;
a separate private Git repository is not required for this workflow.

Run the recurring chat on this same Windows PC and local checkout. The private
credentials, overrides, and downloaded cache are ignored by Git, so they are
not available automatically in another worktree, clone, or cloud chat.

Use the following instructions when creating a separate recurring chat:

> In `C:\Users\jacob\Documents\SeaPals`, run
> `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/manufacturing/run-sync.ps1`.
> The script loads `FIGMA_ACCESS_TOKEN` and `STORE_ADMIN_TOKEN` from the ignored
> `.private/manufacturing/sync.env`; do not display or copy those secrets.
> It reads optional `.private/manufacturing/figma-overrides.json`, checks for
> changed Figma versions or source mappings, resumes verified local downloads,
> and publishes validated PNGs to the private artwork bucket. Keep the exact
> 11-card unfinished-artwork policy: finished prerelease cards remain eligible,
> mapped cards must pass validation, and any newly unmapped card outside that
> list must stop the sync rather than being excluded. Do not add
> `--allow-incomplete`. Keep printing and buyer-notification settings unchanged;
> do not dispatch orders or start the print agent. Observe Figma's retry time
> after rate limits. Report a newly published release or an actionable failure;
> stay quiet when nothing has changed.

For slow image exports, append `-BatchSize 1` to the `run-sync.ps1` command.
The wrapper accepts sizes 1 through 10 and defaults to 10. This changes only
request grouping; it preserves the same release and cached exports.

The unchanged check compares the Figma file version and source mappings with
the last successfully published release. Each new file version exports the
complete eligible artwork set, even if only one card changed; it can therefore
be a lengthy run. Interrupted downloads resume only when the pinned version
and source mappings match. This is version-level caching, not a per-card change
detector.

This handoff does not create a chat or install a schedule. Use either that
recurring chat or the Windows hourly sync task to avoid overlapping publishers.

## Unfinished artwork and release eligibility

The owner approved using finished artwork only while the following 11 cards
are unfinished. The exact list is recorded in
`scripts/manufacturing/figma-unfinished-printings.json`. These printings are
excluded from new booster draws only while they have no Figma source mapping.
The current configuration therefore exports 217 eligible printings and
269 mapped assets, including the shared back and 51 fixed deck/Conditions
sheets. The store/gallery catalog remains 228 printings. Finished prerelease
cards remain eligible, and collector numbers and printed set totals are unchanged.

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

Regular Great White (`reef-017`) maps to the `great-white-standard` frame
`3277:51900`, verified by `17/102`. The gallery's full-art frame carries `2/102`
and is not used for that regular printing.

Southern Flounder (`reef-068`) maps to Figma's `winter-flounder` component
`193:27`, verified by `68/102`. Sea Fan (`reef-095`) maps to `92:310`, verified
by `95/102`. These name differences do not change the catalog.

Provide an overrides JSON object such as `{ "deep-060": "1234:5678" }` and pass
`--overrides <file>`, or put it in `.private/manufacturing/figma-overrides.json`
for the hourly sync. Once a listed card has a mapping, it automatically returns
to the next release's pool after its export passes validation. Adding artwork
in Figma alone does not discover its node ID: update the gallery mapping or
the private overrides. The correct collector number and full-resolution image
are still required; a mapped card that fails export or validation stops the sync.

The source-map audit (`--check`) and each release manifest record the specific
unfinished printings excluded from that release. Any newly missing card outside
the approved list stays in the pool and blocks the default sync. Missing assets
are never replaced with public previews. With explicit `--allow-incomplete`,
available artwork can still be published for fixed decks and ready orders; any
booster set missing eligible artwork is held before its first draw. Once the
needed artwork is published, explicitly retry preparation to use that release.
Already saved draws retain their original artwork and contents. The default
export mode requires complete mappings for every eligible printing.

## Operational behavior

- Live paid transitions create one manufacturing record awaiting staff dispatch. Neither checkout-page
  visits nor repeated Stripe events create additional prints. Old orders can
  be added to the workshop by UUID if still eligible, then explicitly sent.
- Three Dive Pack recipes use 5 common + 3 uncommon + 1 premium, with a 25%
  independent holo replacement chance, strictly within their set. Prerelease
  printings remain eligible. The first saved draw is never rerolled.
- All seven fixed decks use their full Figma Letter PNG frames, including
  reference inserts. Starter Kit expands to Coral Garden + Drop Off + the
  18-card Conditions Deck, seven dice, and 15 tokens. Accessories Kit includes
  Conditions, dice, and tokens. Standalone prepared accessory SKUs are supported.
  Existing packaging supplies are checked during packing; this integration
  does not generate new box/wrapper artwork or carrier labels.
- New jobs use the October 13 cutting-machine templates: nine 738.5952 ×
  1034.0333 pixel cards per Letter page, with independent Epson/Canon positions.
  Fixed deck and Conditions cards are cropped from their original Figma sheets
  and arranged on that same grid. The Canon template's −79 X / +18 Y offset is
  used directly; the old 96% scaling and position reflection apply only to
  legacy saved manifests. Actual back art comes from the original back frame,
  never the cutting template's numbered placeholders. No automatic duplexing
  is used. See `manufacturing-workflow.md` for the exact template references.
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
- `supabase/manufacturing-dispatch.sql`: per-job staff approval and print gates.
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
