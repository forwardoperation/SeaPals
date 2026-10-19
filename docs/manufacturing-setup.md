# Manufacturing integration and activation

The implementation connects paid-order intake, immutable booster draws, private
Figma PNG releases, separate Epson/Canon print jobs, a QR work ticket, a staff
checklist, and buyer milestone emails. **Printing is enabled for Reef booster
jobs approved with Send to printers.** Buyer manufacturing notifications and
paid test-order intake remain disabled.

## Tuned printer templates activated - October 19, 2026

The active private artwork release is
`figma-2412156090472208619-ee3b0b94`, pinned to Figma version
`2412156090472208619`. Its 97 assets include all 95 eligible Reef printings,
the tuned front ocean backdrop, and the complete Canon rear page.
The V4 layout preserves the Epson grid's native positions and 0.35 degree
clockwise rotation. The Canon PDF embeds the complete opaque rear export,
including blue water and all nine white logos, once at actual size.

All 137 manufacturing tests passed. Every exported PNG passed checksum and
image validation; the rendered front, rear, and work-ticket proofs were
visually checked. The rear PDF's embedded pixels matched the native Figma
export exactly, and the ticket QR decoded successfully. The live release
matches the verified local manifest. Its storage bucket remains private;
anonymous artwork access was denied and an authenticated download matched
the recorded checksum.

The existing **SeaRealm Manufacturing Agent** Windows task was started with
the updated renderer after confirming there were no approved pages waiting
to print. Both printer queues were empty. No production jobs, stock movements,
buyer messages, or physical prints were created by this update. Reef-only
printing remains enabled; test orders and buyer notifications remain off.

Create a **new** Reef stock build in
[Manufacturing](https://searealm.com/admin/manufacturing) and use
**Send to printers** to use the tuned templates. Existing saved jobs retain
their original cards, artwork release, and layout, including on reprints.
The ignored `.private/manufacturing/template-update-2026-10-19/` directory
contains local proofs and verification receipts.

## Initial Reef printing activation - October 14, 2026

At initial activation, the private artwork release was
`figma-2410259424823644926-49a271a8`, pinned to Figma version
`2410259424823644926`. Its 98 assets include every eligible Reef printing (95),
the transparent card-back artwork, and both ocean backgrounds. All PNG hashes,
dimensions, and CRCs passed. The Letter page proofs were rendered at 300 DPI
and visually checked, including the updated regular/holo Great White and the
white logos over ocean backs. The sample ticket QR decoded successfully.
The storage bucket is private; an anonymous printable-artwork request was
denied, and an authenticated download matched its recorded hash.

The catalog still contains all 217 eligible printings. Deep, Oceanic, and fixed
decks with missing assets are held before a draw. Reef packs use five commons,
three uncommons, and one rare slot with a 25% holo chance. Finished prerelease
cards remain eligible; the approved unfinished cards remain excluded.

The Windows task **SeaRealm Manufacturing Agent** is installed and running. It
starts at user login and checks for approved jobs every 15 seconds while this
PC is awake and signed in. Fronts route to `ET-8550 Series(Network)`; separate
backs and the work ticket route to `Canon MF750C II Series UFR II`. Profiles use
Letter paper, actual size, and simplex printing. Holo stickers remain a manual
checklist step.

For the first print, open `https://searealm.com/admin/manufacturing`, choose
**Build stock without an order**, select one **Reef Dive Pack**, and create the
workshop job. Open that job and click **Send to printers**. The agent saves the
random card selection before rendering and printing; repeated Send clicks do
not reroll it. Scan the printed work-ticket QR to open its staff checklist.
Finished inventory increases only after the batch is checked and received.

Only `MANUFACTURING_ENABLED` was switched on. Test-order intake and buyer
manufacturing notifications remain off. Activation created no jobs, stock
movements, buyer messages, or physical prints; the existing job was unapproved.
The ignored `.private/manufacturing/` directory holds the activation receipt,
release checks, and local QA proofs.

## Local printer connection and test - October 14, 2026

The owner confirmed the printer profiles. The ignored local `printers.json`
now has `calibrationConfirmed: true`. The existing device credential was
registered as `MANUFACTURING_AGENT_TOKEN` on Worker `seapals`, using secret
stdin and the owner's explicit approval. Agent authentication succeeded; a
single agent poll returned `disabled`. All three manufacturing switches were
false at that stage. No physical print, live job, stock movement, or buyer notification was
created by these checks.

A full artwork release is not required to test the local printers. The prepared
private packet is `.private/manufacturing/printer-test/reef-one-pack/packet.json`.
Its three one-page Letter PDFs contain one saved Reef booster draw, its backs,
and a clearly labeled local test ticket. It uses cached card fronts plus the
current ocean backgrounds and transparent white logos. It is a mixed-source
printer test, not a production artwork release. The saved draw is unchanged:
five commons, three uncommons, and one rare, with no holo in this sample.

The preview is `printer-test-preview.pdf` in that directory. All three pages
were rendered and visually checked; the ticket QR decoded correctly. This QR
uses a local preview UUID and cannot update a live workshop job.

From the repository directory:

```powershell
# Validate all PDFs and routes without printing or creating a receipt.
node scripts/manufacturing/print-local-test.mjs --packet .private/manufacturing/printer-test/reef-one-pack/packet.json --config .private/manufacturing/printers.json

# Physically print exactly this packet: Canon ticket, Epson front, Canon back.
node scripts/manufacturing/print-local-test.mjs --packet .private/manufacturing/printer-test/reef-one-pack/packet.json --config .private/manufacturing/printers.json --print
```

The local-only command checks every PDF checksum, page count, Letter size,
private path, executable, and single-copy printer profile before submission.
It requires actual size, simplex, Letter, and an explicit color mode. The
Canon ticket uses its configured tray, which is currently the backing-sheet
tray. An exclusive, durable `print-receipt.json` prevents repeated or concurrent
submissions. An uncertain result stops the packet; inspect the paper and queue
instead of deleting that receipt and retrying. Printer acceptance is not proof
that paper physically printed. No staff token, agent token, or online artwork
release is needed for this local command.

The local printer packet does not exercise QR-driven manufacturing status
updates. The subsequent Reef activation above completed the private release
publication and enabled the admin **Send to printers** workflow.

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
The authenticated dashboard refreshes the queue and selected job every five
seconds while visible. It shows waiting, preparation, submission, and review
states with sent/checked counts. Successful submission means the local print
helper handed the job to Windows; it does not confirm that paper emerged or
printed correctly. Check the output and use **Paper checked** for each side.
Background refreshes cannot send, retry, reroll, or confirm a job.
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

## Historical implementation checks

These dated checkpoints record the state at each check. The current activation
status is in the Reef printing section above.

- October 14, transparent card backs: the owner confirmed white logos over the
  blue ocean backdrop. Removed only the white fills on source frame
  `3758:338124` and its grid `3758:338139` in Figma. All nine logos and source
  dimensions are unchanged; the existing renderer already preserves PNG alpha.
  The transparent proof exposed the old sheet-guide group (`3758:338125`),
  whose white marks previously disappeared against white. That group is now
  hidden so the source crop contains only the logo.
  Live REST metadata confirms both fills are empty. Figma still reported
  version `2410243403523590401` while `lastModified` advanced to 16:04:28 UTC;
  an explicit request for that version also returned the updated fills. Keep
  the earlier candidate/proofs intact. A subsequent complete export must use
  a fresh cache and verify the source timestamp/content, rather than treating
  that version number alone as proof that cached artwork is current.
  The new back-only proof is saved as `LOCAL-LIVE-TRANSPARENT-BACK-QA.pdf` in
  `.private/manufacturing/live-proofs/transparent-back-2026-10-14T16-15-34-859Z/`.
  It uses current native PNG exports, with identical source/template node
  fingerprints before and after export, and is explicitly a local proof.
  No production artwork release or printer job was created.
- October 14, updated template snapshot: native exports pinned to Figma version
  `2410243403523590401` contain the two ocean backdrop layers and the six
  previously flagged card printings. The backdrop renderer uses saved v3
  templates, preserves the cutter positions and white outside margins, and
  omits guide marks and labels. All 105 manufacturing tests pass, including
  legacy v1/v2 rendering, backdrop validation before a draw, PNG corruption,
  separate front/rear backgrounds, and ocean in an unused card slot.
  Candidate assets and their provenance are retained in ignored
  `.private/manufacturing/candidates/2410243403523590401/`; they are not a
  complete or published release. Five photo windows are corrected. Holo
  Bamboo Coral (`deep-013`) still extends outside its picture window, and
  Krill (`ocean-057`) and Silverside (`ocean-060`) still contain faint duplicate
  ability text. Finish those source edits before exporting the next complete
  private release. The earlier incomplete release and saved proofs are preserved.
- The updated local proof is
  `.private/manufacturing/candidates/2410243403523590401/local-v3-artwork-qa/LOCAL-ARTWORK-QA-v3-bundle.pdf`.
  Its three Letter pages use six reviewed card sources plus three explicitly
  repeated samples, the new backgrounds, and a QR work ticket. This is an
  artwork fixture, not a random booster or live job. The QR decodes from the
  rendered PDF. The native back artwork also changed from blue/black lettering
  to a nearly white embossed logo on white; its intended appearance needs
  review. The renderer preserves that source appearance.
- The isolated Next/Cloudflare build passed and backdrop support was deployed
  as Worker version `0bd71995-d1e0-4fd4-bf33-223018fd40d0`. The staff API returned
  HTTP 200 afterward; printing, test-order manufacturing, and buyer manufacturing
  notifications remain disabled. The existing job is unapproved, finished and
  reserved stock are zero, and no artwork release is active.
- October 14: the initial private export contains 266 of 269 required assets:
  all 217 eligible card printings, the shared back, and 48 of 51 fixed sheets.
  Those assets are uploaded privately, but there is no published or active
  release. Three native PNG exports return Figma server timeouts; see the
  recovery checkpoint below. Alternate SVG output failed visual comparison
  and has not been accepted into the release.
- The private real-artwork review bundle now contains 14 Letter pages: Reef,
  Deep, and Oceanic booster fronts, backs, and tickets, plus both Conditions
  fronts, their backs, and its ticket. All four saved manifests are preserved.
  Each booster has 5 commons, 3 uncommons, and 1 rare slot from its own set;
  the 25% holo policy is unchanged. Ticket QR codes decode, but their preview
  UUIDs do not identify live workshop jobs. The bundle is saved under ignored
  `.private/manufacturing/artwork-preview/figma-2409981651040810260-daaea18f/`
  as `LOCAL-PREVIEW-review-bundle.pdf`.
- October 14: commit `5f389de` passed the isolated Next/Cloudflare build and was
  deployed as Worker version `394be2ba-3437-41e0-8bd1-87bc2437c8a9`. The live staff
  API returned HTTP 200 afterward. Printing, test-order manufacturing, and buyer
  manufacturing notifications remain disabled; the existing job is unapproved
  and finished/reserved stock remains zero.
- October 14: all 51 fixed source pages were checked against the pinned Figma
  version. Source crops retain their measured sizes, including the two smaller
  Robotic Survey instances and the slightly taller card instances. The three
  final pages for Murky Water, Stinging Fortress, and Disruption contain eight
  cards; their ninth front slot stays blank. Other pages still require nine.
  These source differences do not change the front or rear cutter templates.
  The actual Murky Water final-page preview was rendered and visually checked:
  eight front crops, a fully blank ninth front slot, nine backs, Letter pages,
  and a readable ticket QR all passed. Its ticket labels it as a local page-only
  review, with no production job attached.
- Real-artwork Reef, Deep, and Oceanic booster previews now contain saved random
  draws from their complete eligible pools. Each has a Letter front, back, and
  QR work ticket. A separately labeled deterministic holo demonstration shows
  the manual sticker checklist; it does not alter the 25% production pull rate.
  All four ticket QR codes decoded from the rendered PDFs. These are private
  local previews with no live workshop jobs or printer submissions.
- October 14: all 95 manufacturing tests passed in the isolated checkout,
  including bounded export concurrency, checkpoint serialization, transient
  failures, immediate scheduling stops after authentication or rate limits,
  audited source-crop sizes, and eight-card final-page rendering.
  The real-artwork Deep preview uses a saved random draw from the complete
  59-printing Deep pool. Its front, back, and work ticket are Letter pages;
  the QR decoded correctly from the rendered PDF. This preview has no live
  workshop job and sends nothing to a printer.
- The real-artwork preview exposed a Figma source issue on Bamboo Coral
  `deep-044`, `deep-033`, `deep-030`, and holo `deep-013`: the image spills
  beyond the card's artwork window. The pinned Base metadata confirms an
  image outside that window; the other three show the same visible spill.
  Correct these masks in Figma and publish a new artwork version before
  physical production. The 750-by-1050 PNGs and cutter placement are correct;
  changing page geometry would not repair the source. Details and visual
  evidence are in ignored `.private/manufacturing/source-artwork-review.json`.
  Oceanic's real-artwork preview also shows image spill and faint duplicate
  ability text in the source PNGs for `ocean-057` (Krill) and `ocean-060`
  (Silverside); these findings are recorded in the same review. Its saved draw
  used the complete 63-printing Oceanic pool, and its rendered QR and Letter
  pages passed verification too.
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
- At the October 13 checkpoint, the live database had one existing workshop job,
  no approved jobs, zero finished/reserved units, and no active artwork release.
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
  token is a separate random credential. The initial profile gate was `false`;
  see the October 14 connection and test status above for the later confirmation.

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

## Activation checklist and remaining rollout

1. Reef printing is enabled with `MANUFACTURING_ENABLED=true`.
   `MANUFACTURING_ALLOW_TEST_ORDERS` and
   `MANUFACTURING_BUYER_NOTIFICATIONS_ENABLED` remain false. Existing store,
   Supabase, and Resend configuration remains in use. No R2 billing activation
   or bucket binding is needed.
2. Completed October 14: the Worker secret `MANUFACTURING_AGENT_TOKEN` matches
   the private `agent.env` file. Future rotations must use secret stdin. Do not put it in
   `NEXT_PUBLIC_*`, the QR, a tracked file, or browser JavaScript. The staff
   screen reuses `STORE_ADMIN_TOKEN`; both tokens must be at least 24 characters.
3. Keep `FIGMA_ACCESS_TOKEN` with file read access and `STORE_ADMIN_TOKEN`
   in the ignored local `sync.env` for unattended export and publishing. Both
   credentials were verified on October 13. The Figma connector's connection
   is not a reusable credential for a scheduled Node process.
4. The complete Reef artwork scope is published. Export and validate additional
   product scopes before making those products; publish a release containing
   all product pools that should be available together.
   The owner-approved eleven unfinished printings below are excluded until
   their sources are mapped and validated; finished prerelease cards remain
   included. Any other missing mapping must be resolved. The script pins one
   Figma version for every export and checks collector numbers, dimensions,
   sheet positions, and checksums.
5. Use the established Epson and Canon printer profiles with Letter, actual
   size, simplex, and the intended trays/media settings. The owner opted to
   skip the separate alignment-check print on October 5, 2026. That print is
   optional; it is not a database setup or activation prerequisite. The owner
   confirmed the profiles on October 14 and `calibrationConfirmed` is now true.
   The local three-page printer test above is ready without a full release.
6. The Windows startup task is installed and running. Use one independent Reef
   stock build for the first print; paid test-order intake is not needed. Click
   Send to printers for that job, confirm both physical printer outputs, and
   scan its work-ticket QR. Unapproved jobs remain waiting. Enable buyer
   milestone emails separately after the physical workflow has been confirmed.

No live buyer emails or physical prints were sent during implementation.

## Earlier artwork release recovery checkpoint

This checkpoint predates the October 14 source corrections and ocean
backdrops. It preserves the older version for reproducibility; completing it
would not deliver the updated artwork. The next production release needs a
fresh pinned source map. A full-catalog release needs all 271 assets, including
both backdrops; the active Reef scope above needs only its complete 98 assets.
Do not mix the updated candidate PNGs into this older release or overwrite its
saved manifests.

The approved release is `figma-2409981651040810260-daaea18f`, pinned to Figma
version `2409981651040810260` (file last modified October 13, 2026 at 23:14:07
UTC / 7:14:07 p.m. Eastern). Its source hash, cached PNGs, upload journal,
and restart instructions are retained in ignored `.private/manufacturing/`.
No exporter or diagnostic render process remains running at this checkpoint.

The remaining sheets are:

| Source | Figma node | Required image |
|---|---|---|
| `sheet-blue-water-5` | `2224:312946` | 2550 × 3300 PNG |
| `sheet-blue-water-7` | `2224:312950` | 2550 × 3300 PNG |
| `sheet-stinging-fortress-4` | `2363:254617` | 2550 × 3300 PNG |

Individual page retries with a longer client deadline reached Figma's HTTP
504 after about six minutes. A native child PNG and a PDF export also timed
out. SVG sources downloaded, but a Chrome rendering of the Blue Water 6
comparison sheet changed the verse lettering and coral textures. The pinned
node metadata confirms the native PNG's small white italic verse label;
the SVG's large cyan outlined label is unsuitable. Keep those SVGs and their
derived PNGs diagnostic-only. Do not use `--allow-incomplete` to bypass this
checkpoint or mix a newer Figma version into the saved release.

To recover manually, export the three full frames above as PNG at 1× from
that saved Figma version and place them in the ignored
`.private/manufacturing/manual-imports/` directory, using the source IDs as
filenames. Before importing, verify their source version, complete sheet
contents, 2550 × 3300 dimensions, PNG CRC decoding, checksums, and measured
card positions. Then resume the pinned exporter, validate all 269 assets,
upload the remaining PNGs, and publish the complete private release. Verify
the live manifest and denied public access afterward. These historical recovery
instructions do not supersede the active October 14 Reef release; do not publish
the older artwork over it.

The existing three booster manifests and Conditions manifest must be reused
when rebuilding the review bundle against the complete release. A rerun
must not generate replacement random draws.

## Local commands

Use Node 24 and `npm ci` (including dev dependencies on the printer PC). The PDF
renderer, PNG decoder, and QR generator are local tools and are not imported by
the public website. `npm.cmd` avoids Windows PowerShell script-policy issues.

For a first Reef-only activation, export a complete eligible Reef pool with
`--products reef-dive-pack`. This selects all 95 eligible Reef printings plus
the back and two backgrounds (98 assets). It retains the full 217-printing
catalog; it never narrows random draws to whichever images are available.
Deep, Oceanic, and fixed products with missing artwork stop before drawing.
Already-finished inventory can still be fulfilled without new card artwork.
The product scope participates in the source hash and release ID, so its cache
cannot collide with the full-catalog export. Omitting `--products` keeps the
existing full-export behavior. Comma-separated product IDs are supported.

```powershell
# Export privately for review; no publication or printing.
node --env-file=.private/manufacturing/sync.env scripts/manufacturing/sync-figma.mjs --products reef-dive-pack --batch-size 1 --concurrency 2

# Publish the reviewed scope at its exact saved version and release ID.
node --env-file=.private/manufacturing/sync.env scripts/manufacturing/sync-figma.mjs --products reef-dive-pack --version <reviewed-version> --release <reviewed-release-id> --publish
```

Review the new release before publishing. All included assets must be complete
and validated; `--allow-incomplete` is not a substitute for the full Reef pool.
Publishing a later scope replaces the active release for future preparation;
existing jobs retain their pinned release and saved draw.

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

# One production poll; can claim approved work when server printing is enabled.
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
add `--batch-size 1` through `--batch-size 10` (the direct CLI default is 10),
and `--concurrency 1` through `--concurrency 3` (the direct CLI default is 1).
Progress writes are serialized. A timed-out batch or server error allows other
pending batches to finish, but any failed batch prevents publication; rerun
the same version to retry only missing assets. Authentication and rate-limit
errors stop new batches immediately and preserve in-flight successes. These
options do not change the release or its saved cards. No recurring chat task or
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

The wrapper defaults to one asset per batch with 2 concurrent batches, following
timeouts on grouped deck-sheet requests during the initial export. It accepts `-BatchSize`
from 1 through 10 and `-Concurrency` from 1 through 3. To use one request group
at a time, append `-Concurrency 1`. These options change only request grouping;
they preserve the same release and cached exports.

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
270 mapped assets, including the complete Canon back page, 51 fixed
deck/Conditions sheets, and one private Epson ocean backdrop. The store/gallery catalog remains
228 printings. Finished prerelease
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

Regular Great White (`reef-017`) follows the gallery mapping to the `great-white`
component `241:1124`, verified by `17/102`. Its holo instance `4132:62194`
(`reef-002`) inherits that artwork and displays `2/102`. No separate Great
White manufacturing override is needed. Historical release manifests and caches
retain their original source references.

The `Holo Rare — Production` page (`3961:6979`) now contains 35 linked
regular-card instances: 15 Reef, 15 Deep, and 5 Oceanic. Great White is a direct
instance; the other 34 retain their original component-wrapper export IDs.
Each holo printing inherits regular artwork and displays its holo number.
Update `scripts/manufacturing/figma-holo-sources.json` if an export node is
replaced. Edit artwork and layout on the regular component so the holo printing
inherits the changes; keep the holo instance attached. Existing exported
releases remain snapshots and require a fresh artwork sync to include these changes.

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
- New releases use the October 19 printer-tuned V4 templates: nine native
  738.5952 ? 1034.0333 Epson cards with saved positions and a 0.35? clockwise
  rotation, plus the complete Canon rear page with water and nine white logos.
  The front backdrop's exported rotation is applied once. Fixed-sheet cards
  use their saved source crops on this grid. Existing V1/V2/V3 jobs retain
  their original layouts and assets. See `manufacturing-workflow.md` for
  exact references. No automatic duplexing or separate alignment print is used.
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
