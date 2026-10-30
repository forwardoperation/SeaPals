# SeaRealm card manufacturing workflow

Use one immutable manufacturing manifest per order. Generate each booster once,
print its fronts on the Epson and its backs on the Canon, and match the two
sheets before gluing. New booster manifests print a pull instruction in each
holo slot with the card name and collector/set number. Insert the matching
finished holo card instead of making it on this sheet. Older saved manifests
retain their original holo artwork and sticker confirmations.

This document records the agreed workflow. Paid-order intake, private versioned
artwork synchronization, PDF/QR rendering, the Windows printer agent, staff
screen, and buyer notifications are now implemented. Production activation is
enabled for staff-approved Reef, Deep, and Oceanic boosters. The combined
private release passed export, final QA, and live verification on October 20,
2026. Finished prerelease cards remain eligible, including 54 each in Deep and
Oceanic; the eleven unfinished printings remain excluded. Fixed-deck artwork
is outside this release. See [the integration setup guide](manufacturing-setup.md) for verified activation
status, artwork eligibility, deployment steps, and commands.

## Confirmed production rules

- Each booster contains five commons, three uncommons, and one rare slot.
- A pack uses only printings in its own Reef, Deep, or Oceanic set list. There
  is no shared pool of action cards across sets.
- The initial configuration upgrades the rare slot to Holo Rare with 25%
  probability. This replaces the rare; a pack always has nine cards. It is an
  independent probability, not a guarantee of one holo in four packs.
- Choose uniformly within a rarity, without repeating an underlying card in
  the same pack. Choose the premium first so Deep cards with both uncommon and
  holo printings cannot appear twice.
- Finished prerelease cards remain eligible. Preserve the printed prerelease stamp in
  the source artwork. Public gallery visibility does not determine eligibility.
- The owner approved excluding exactly eleven unfinished printings from new
  booster releases while their artwork is unmapped. The explicit list is in
  `scripts/manufacturing/figma-unfinished-printings.json`. A mapped printing
  must pass normal export validation before returning to a new release;
  newly missing artwork outside the list blocks sync. Existing saved packs
  retain their cards and pinned release.
- Epson fronts use thin photo paper in the standard tray. Canon backs use
  separate sheets. The two sheets are glued together; this is not duplex
  printing and the same sheet does not pass through both printers.
- New booster jobs pull already finished holo cards. The holo slot prints a
  disposable instruction; no holo artwork is printed there. Confirm the pull
  in the workshop. Existing saved sticker jobs keep their original behavior.

## Source artwork and sheet geometry

New releases use the Page_Templates adjusted on October 28, 2026. All four
masters are 2550 x 3300 pixels for Letter at 300 DPI:

| Use | Epson front frame | Canon rear frame |
|---|---|---|
| Ordinary cards and randomized Dive Packs | `4290:38532` | `4244:451219` |
| Separate holo replenishment batches | `4311:139557` | `4311:139076` |

The ordinary Epson grid is at (145, 65.6436); the holo grid is at
(95, 65.6436). Each empty 2330 x 3170 grid has three equal columns and rows.
Native 738.5952 x 1034.0333 cards are centered in those cells with zero rotation.
The front background is exported from its full-page component instance so
water, registration strips, and any holo-only staple labels stay together.
Fixed deck cards retain their original source crops on the ordinary grid.

Each Canon rear is the complete native page, including nine backs, their
white gutters, and any holographic-only registration/staple marks. It is
embedded once at full Letter size, without cropping, reflection, or an extra
background. The ordinary rear grid is at (65, 85.8400); the holo rear grid is
at (110, 85.8400). Keep the front/back pair for its intended production type.

New releases save `figma-cutter-nine-up-v7`, all four private template assets,
and exact geometry. The sync checks the pinned grids and background structure
before exporting. Changed geometry requires an explicit layout update. A holo
draw does not switch the whole Dive Pack to the holo template: it still prints
its named finished-holo pull instruction on the ordinary sheet. Holo masters
are used only for a separate replenishment batch; see the setup guide for the
private PDF-generation command. These batches do not add finished products to
inventory. Packaged products are received by barcode after quality control.

Existing saved manifests keep their original version and private release.
V5 retains the original October 26 grids; V6 retains its later ordinary-front
shift to x150 and the original holo/rear positions. Both remain reproducible.
V4 retains the October 19 positions, 0.35 degree front rotation, and complete
rear water-and-logo page. V3 retains the October 14 ocean layers and upright
grid; V2 retains the same upright positions without ocean. Their rear artwork
uses the transparent logo crop from `3758:338124`. V1 retains its original
scaling/reflection. Reprinting a saved job does not change its cards or apply
new printer tuning. Create a new stock build to use updated templates. No
separate alignment print is required, and the printer profiles stay unchanged.

### Original artwork sources and legacy saved jobs

Figma remains the artwork source:
[SeaRealm design file](https://www.figma.com/design/xeol2YE0jCE0N5vAD6tjzx).
The local set list supplies explicit set membership, rarity, and collector
numbers. A printing is identified by set and collector number, because a single
card can have both ordinary and holo artwork.

The inspected [Coral Garden sheet](https://www.figma.com/design/xeol2YE0jCE0N5vAD6tjzx?node-id=2311-519240)
exports PNG at 2550 x 3300 pixels. Its 3 x 3 grid starts at (195, 138) and uses
720 x 1008 pixel slots. At the intended 8.5 x 11 inch size, this corresponds to
300 pixels per inch and nominal 2.4 x 3.36 inch card slots. These are measured
layout dimensions, not a claim about the printer's current scaling settings.

The original [Canon laser back sheet](https://www.figma.com/design/xeol2YE0jCE0N5vAD6tjzx?node-id=3758-338124)
also exports PNG at 2550 x 3300, but its grid starts at (150, 75) and uses
750 x 1050 slots. Legacy saved jobs scale the complete back image to 96%
and centers it on the letter page. Its translation is (51, 66) pixels:

- Left edge: `150 * 0.96 + 51 = 195`.
- Top edge: `75 * 0.96 + 66 = 138`.
- Card size: `750 * 0.96 = 720`; `1050 * 0.96 = 1008`.

These calculations describe the original layout only. They remain available
for previously saved jobs and are not added to the new cutting template.
Always print the generated Letter PDF at actual size. Legacy fixed-sheet backs
use their original saved Figma card positions, including Conditions' gaps.

Verified Windows queue names:

| Role | Queue | Sheets per booster |
|---|---|---:|
| Fronts | `ET-8550 Series(Network)` | 1 |
| Backs | `Canon MF750C II Series UFR II` | 1 |

Windows identifies the installed Epson as an ET-8550. Do not select the Canon
fax queue or the alternate Epson WSD queue automatically. The work ticket needs
its own document/media profile so it does not unexpectedly consume card stock.

## Operator workflow and holo finishing

1. Open an order or stock build, review stock versus quantities to make, and
   click **Send to printers**. Both printers receive independently tracked jobs with the same order,
   pack, and sheet-pair identifiers. All pages for the order must pass artwork
   preflight before the first printer receives a job.
2. The helper sends the full requested batch without page-by-page paper checks.
   Acceptance by a print spooler is not confirmation of usable output. Use the
   per-side reprint controls for blank or damaged pages; only actual interrupted
   attempts require review before resuming.
3. Match the identified pair, glue the sheets, and confirm gluing.
4. Cut the assembled sheet and confirm cutting.
5. Pull the listed finished holo card, discard its printed instruction slot,
   and confirm the pull after checking the front sheet. Older saved jobs still
   ask for sticker application instead.
6. Quality check requires both prints, gluing, cutting, and every holo confirmation.
   Check card count, finish, alignment, print quality, and adhesion; allow the
   materials the drying/curing time their actual process requires.
7. Pack only after quality check. Shipping and pickup follow the store's
   existing fulfillment rules.

The generated booster layout places five commons in slots 1-5, three uncommons
in slots 6-8, and the rare/holo in slot 9 (row 3, column 3). On the work ticket,
show each holo's name, printing number, pack ID, and sheet position, with an
individual checkbox. Never draw the checklist or production QR over card art.
Randomize the physical pack's presentation during assembly if desired; the
saved sheet layout exists to make manufacturing easy.

For an order with 12 packs, the work ticket lists 12 Epson sheets and 12 Canon
sheets. It lists the exact number of finished holo cards to pull, not an estimate
of three. Each pack has either zero or one required holo.

Both sides have `queued`, `submitting`, `submitted`, `needs_review`, and
`confirmed` states. Record `submitting` durably before invoking the printer.
If a crash makes the result uncertain, inspect the spooler/output and mark the
attempt for review. Never retry an ambiguous submission automatically.

An operator-requested reprint always keeps the original pack and artwork
release. A front reprint clears that sheet's holo confirmations. A back reprint
preserves the existing fronts' holo confirmations. Either reprint clears the
sheet's glue/cut completion and the order's quality-check/packing completion.
If damaged assembly also requires replacement fronts, request a front reprint
explicitly. Reprint events require a reason and remain in the event history.

## Receiving packaged inventory

Printing and marking a stock build packed never increase inventory. Open the
stock build's **Receive packaged products** panel, scan each good packaged
product once, review the counts, and attest that those products passed quality
check. Click **Receive N products** to post that count to finished stock.
Unmapped codes can be linked to a product using the actual packaging barcode.

Product barcodes identify a SKU, not a physical unit: scanning the same pack
twice cannot be detected automatically. Remove accidental scans before posting.
A saved receipt ID makes connection retries safe, and the database caps total
receipts at the planned quantity. Keep an uncertain receipt and use its retry
button; do not recreate it in another tab. Partial receipts leave damaged or
unfinished units outstanding. Reprinting keeps the saved cards and never credits
additional stock; after a fully received batch, use a stock adjustment and a new
replacement build for later damage. Customer-order packing still consumes its
reserved inventory and cannot be received as available stock.

Each receipt independently confirms the scanned products were packaged and
checked, so successful products can be received before the whole batch is done.
Wait for an active printer attempt to finish before receiving. Resolve queued
or uncertain pages before receiving the last units. Existing received stock is
preserved when the receiving migration is applied.

## Local tools implemented

`src/lib/manufacturing/boosters.mjs` validates the printing pools and selects
packs using cryptographic randomness. `printPlan.mjs` records the layout,
printer routes, paired sheets, artwork release, and holo checklist.
`workflow.mjs` validates physical operations and enforces the finishing gates.
`scripts/manufacturing/orders.mjs` saves manifests and events locally.

Audit the current catalog:

```powershell
node scripts/manufacturing/orders.mjs audit
```

Create the demonstration order, then inspect it:

```powershell
node scripts/manufacturing/orders.mjs create --request scripts/manufacturing/example-order.json --release demo-artwork-v1
node scripts/manufacturing/orders.mjs status --order-id demo-two-printer-workflow
```

These commands select and save contents; they do not render or print. Running
`create` again for the same order returns its existing contents, even if the
catalog or proposed artwork release changed. Changing the items under the same
order ID is rejected. A file lock prevents simultaneous generation or updates.
An abandoned lock requires inspection before removal; deleting an order to
reroll its contents is not a recovery procedure.

Files live in `.private/manufacturing/orders/<orderId>/order.json`, which is
ignored by Git and is outside the site's public assets. Keep secure backups;
hashes detect accidental changes but are not access control or encryption.

An event JSON file has an ID, type, actor, role, expected revision, and any
required sheet/side/holo fields. For example, an operator confirming a
previously submitted front sheet:

```json
{
  "id": "scan-unique-id",
  "type": "confirm_printed",
  "actor": "maker",
  "role": "operator",
  "expectedRevision": 2,
  "sheetId": "DEMO-001-001",
  "side": "fronts"
}
```

```powershell
node scripts/manufacturing/orders.mjs event --order-id demo-two-printer-workflow --event .private/manufacturing/event.json
node --test src/lib/manufacturing/manufacturing.test.mjs
```

Duplicate event IDs with identical payloads are idempotent. Reusing an ID for
different work is rejected, as are stale revisions. These local helpers trust
the local operator. The HTTP handlers derive the role and actor from
authentication, never from a submitted JSON claim.

`printer-config.example.json` records the discovered queues and starts with
`calibrationConfirmed: false`. It is a configuration contract for the upcoming
print agent; no automatic submission command is installed by this change.

## Integrated production system

The paid-order trigger, private artwork publishing, exact-size PDF renderer,
Windows agent, authenticated QR screen, and buyer outbox are implemented in this
workspace. Fixed decks, Starter Kit, Conditions, dice, and tokens have explicit
recipes. The HTTP handlers derive roles from their authentication credentials.

Staff-approved printing is enabled. Test-order intake and buyer manufacturing
notifications remain disabled. Follow [manufacturing-setup.md](manufacturing-setup.md)
for the active artwork scope, approved unfinished-artwork policy, deployment,
credentials, printer profiles, and recovery steps. The production database
migration was applied and verified on October 5, 2026. The separate alignment
check print was skipped at the owner's request.

## References

- [Figma named-version webhook](https://developers.figma.com/docs/rest-api/webhooks-events/)
- [Figma versioned image exports](https://developers.figma.com/docs/rest-api/file-endpoints/)
- [Cloudflare R2 public access controls](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [SumatraPDF print commands](https://www.sumatrapdfreader.org/docs/Command-line-arguments)
