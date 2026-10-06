# SeaRealm card manufacturing workflow

Use one immutable manufacturing manifest per order. Generate each booster once,
print its fronts on the Epson and its backs on the Canon, and match the two
sheets before gluing. Track manual holo sticker application per card. Every
required sticker must be confirmed before quality check and packing.

This document records the agreed workflow. Paid-order intake, private versioned
artwork synchronization, PDF/QR rendering, the Windows printer agent, staff
screen, and buyer notifications are now implemented. Production activation is
still pending. See [the integration setup guide](manufacturing-setup.md) for the
verified status, remaining artwork mappings, deployment steps, and commands.

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
- Prerelease cards remain eligible. Preserve the printed prerelease stamp in
  the source artwork. Public gallery visibility does not determine eligibility.
- Epson fronts use thin photo paper in the standard tray. Canon backs use
  separate sheets. The two sheets are glued together; this is not duplex
  printing and the same sheet does not pass through both printers.
- Holo stickers are already printed and must be manually applied. They are a
  finishing operation, not another automatically submitted printer job.

## Source artwork and sheet geometry

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

The existing [Canon laser back sheet](https://www.figma.com/design/xeol2YE0jCE0N5vAD6tjzx?node-id=3758-338124)
also exports PNG at 2550 x 3300, but its grid starts at (150, 75) and uses
750 x 1050 slots. The booster renderer scales the complete back image to 96%
and centers it on the letter page. Its translation is (51, 66) pixels:

- Left edge: `150 * 0.96 + 51 = 195`.
- Top edge: `75 * 0.96 + 66 = 138`.
- Card size: `750 * 0.96 = 720`; `1050 * 0.96 = 1008`.

This makes the artwork grids match mathematically. Confirm actual alignment,
orientation, margins, colors, media selection, and any laser registration
offset using a physical sheet pair before enabling unattended printing. The
96% adjustment belongs in the generated page, once; a subsequent printer
"fit" setting would shrink it again. Send the explicit letter PDF at actual
size after calibration. Fixed deck/Conditions sheet backs use their own saved
Figma card positions, because the Conditions gaps differ slightly. If a physical
offset remains, correct the driver profile or rendering template and re-proof it.

Verified Windows queue names:

| Role | Queue | Sheets per booster |
|---|---|---:|
| Fronts | `ET-8550 Series(Network)` | 1 |
| Backs | `Canon MF750C II Series UFR II` | 1 |

Windows identifies the installed Epson as an ET-8550. Do not select the Canon
fax queue or the alternate Epson WSD queue automatically. The work ticket needs
its own document/media profile so it does not unexpectedly consume card stock.

## Operator workflow and holo finishing

1. Both printers receive independently tracked jobs with the same order,
   pack, and sheet-pair identifiers. All pages for the order must pass artwork
   preflight before the first printer receives a job.
2. An operator confirms the front sheet and back sheet actually printed.
   Acceptance by a print spooler is not confirmation of usable output.
3. Match the identified pair, glue the sheets, and confirm gluing.
4. Cut the assembled sheet and confirm cutting.
5. Confirm every required holo sticker. Stickers may be applied any time after
   the matching front is confirmed printed, including before or after gluing
   and cutting. The software does not prescribe an unverified application
   technique.
6. Quality check requires both prints, gluing, cutting, and all holo stickers.
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
sheets. It lists the exact number of holo stickers selected, not an estimate of
three. Each pack has either zero or one required sticker.

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

The production switches remain disabled. Follow [manufacturing-setup.md](manufacturing-setup.md)
for the verified integration status, eleven missing Figma mappings, deployment,
credentials, printer profiles, and recovery steps. The production database
migration was applied and verified on October 5, 2026. The separate alignment
check print was skipped at the owner's request.

## References

- [Figma named-version webhook](https://developers.figma.com/docs/rest-api/webhooks-events/)
- [Figma versioned image exports](https://developers.figma.com/docs/rest-api/file-endpoints/)
- [Cloudflare R2 public access controls](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [SumatraPDF print commands](https://www.sumatrapdfreader.org/docs/Command-line-arguments)
