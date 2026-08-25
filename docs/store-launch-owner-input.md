# Store launch owner input

Checkout remains intentionally locked until the owner fills and approves this
short operational record. Do not add license numbers, tax IDs, bank details, or
personal identity documents here.

## Catalog and available-to-promise capacity

A SKU identifies one sellable product configuration, not one physical copy.
Every Blue Water Deck, for example, uses `SP-DECK-BLUE-WATER`; do not create a
new SKU for each order, print run, or assembled deck. See
`docs/store-sku-policy.md` for the complete naming and lifecycle policy.

For made-to-order products, **available-to-promise (ATP) capacity** is the
maximum number of additional units that current dedicated materials and labor
can support within the published build-and-dispatch window. It is a firm
fulfillment limit, not a sales forecast or aspirational target. Include active
paid orders when deciding whether capacity remains available.

Do not count the same cards, dice, tokens, packaging, or labor under multiple
SKUs. Until a bill-of-materials allocator exists, dedicate a fixed material and
labor allotment to each bundle and individually sold product. A Starter Kit or
Accessories Kit may be assembled after purchase, but its allocated components
cannot also support the ATP capacity of its component SKUs.

The owner approved the initial public catalog on **2026-08-15** as the seven
`$22` 60-card decks: Blue Water, Disruption, Coral Garden, Darkness Shroud, Open
Ocean, Murky Water, and Stinging Fortress. On **2026-08-16**, the owner added the
`$12` Accessories Kit and `$44` two-player Starter Kit and confirmed that the
Conditions Deck contains 18 cards. On **2026-08-24**, the owner added three `$10`
set-specific Dive Packs: Pelagic Rush for the Oceanic Set, Coral Bloom for
the Reef Set, and Abyssal Glow for the Deep Set, with the same five-business-day
made-to-order policy as the established card products. The Dive Packs are visible
as prelaunch products but are not allowlisted for checkout. Their planned initial
ATP target is **10** each, subject to contents, sample, artwork,
packaging/fulfillment, packed-weight, and production-capacity verification. The
other prepared rows remain private and unavailable; retaining their capacity
records does not add them to the public allowlist.

| SKU | Product | Configured price | Initial ATP capacity | Build and dispatch within | Contents / catalog verification |
| --- | --- | ---: | ---: | --- | --- |
| `SP-KIT-STARTER` | Starter Kit | $44 | **10** | **5 business days** | **Public catalog approved 2026-08-16: Coral Garden and Blue Water 60-card decks; 18-card Conditions Deck; 7 dice (D4, D6, D8, D10, D12, D20, D100); 15 RP tokens** |
| `SP-DECK-BLUE-WATER` | Blue Water Deck | $22 | **10** | **5 business days** | **60-card manifest approved 2026-08-15** |
| `SP-DECK-DISRUPTION` | Disruption Deck | $22 | **10** | **5 business days** | **60-card manifest approved 2026-08-15** |
| `SP-DECK-CORAL-GARDEN` | Coral Garden Deck | $22 | **10** | **5 business days** | **60-card manifest approved 2026-08-15** |
| `SP-DECK-DARKNESS-SHROUD` | Darkness Shroud Deck | $22 | **10** | **5 business days** | **60-card manifest approved 2026-08-15** |
| `SP-DECK-OPEN-OCEAN-HUNT` | Open Ocean Deck | $22 | **10** | **5 business days** | **60-card manifest approved 2026-08-15** |
| `SP-DECK-MURKY-WATER` | Murky Water Deck | $22 | **10** | **5 business days** | **60-card manifest approved 2026-08-15** |
| `SP-DECK-STINGING-FORTRESS` | Stinging Fortress Deck | $22 | **10** | **5 business days** | **60-card manifest approved 2026-08-15** |
| `SP-PACK-OCEANIC` | Pelagic Rush — Oceanic Set Dive Pack | $10 | **10 planned** | **5 business days** | **Prelaunch: one Oceanic Set Dive Pack; contents/sample/art/fulfillment verification pending** |
| `SP-PACK-REEF` | Coral Bloom — Reef Set Dive Pack | $10 | **10 planned** | **5 business days** | **Prelaunch: one Reef Set Dive Pack; contents/sample/art/fulfillment verification pending** |
| `SP-PACK-DEEP` | Abyssal Glow — Deep Set Dive Pack | $10 | **10 planned** | **5 business days** | **Prelaunch: one Deep Set Dive Pack; contents/sample/art/fulfillment verification pending** |
| `SP-ACC-SET` | Accessories Kit | $12 | **10** | **5 business days** | **Public catalog approved 2026-08-16: 18-card Conditions Deck; 7 dice (D4, D6, D8, D10, D12, D20, D100); 15 RP tokens** |
| `SP-ACC-CONDITIONS-DECK` | Conditions Deck | $5 | **10** | **5 business days** | **18 cards confirmed 2026-08-16; standalone title list/sample remains a future-release check** |
| `SP-ACC-DICE-PACK` | Dice Pack | $5 | **10** | **5 business days** | **7 dice: one each D4, D6, D8, D10, D12, D20, D100; future release** |
| `SP-ACC-REEF-POINTS` | Reef Point Token Set | $5 | **10** | **5 business days** | **15 tokens; future release** |

The owner has confirmed an initial ATP cap of 10 for the established prepared
SKUs and a standard five-business-day build-and-dispatch window. The three Dive
Pack definitions use the same published window and a planned cap of 10, but that
capacity is not confirmed until a complete sample and the dedicated materials
and labor are verified. Per-SKU caps are safe only when resources support them
concurrently; dedicate shared allotments or lower affected caps before checkout
opens.

Before enabling a SKU, make at least one complete sample to verify contents,
quality control, packed weight, dimensions, and postage. The
sample does not need to be counted in ATP capacity if it will not be sold.

On **2026-08-15**, the owner accepted the catalog's current representative card
art and concept illustrations and deferred packaged-product photography. A
package photo is not a launch gate, but representative art must not be described
as a photograph of the delivered package. The new Dive Pack illustrations remain
prelaunch representative art until they receive the same review.

Capacity calculation reviewed by: **Sea Realm owner**  Date: **2026-08-15**

Dive Pack target recorded: **10 per SKU on 2026-08-24; physical capacity
verification remains pending before enablement**

Materials or production constraint used for each ATP count: **the owner can
build and dispatch up to 10 units of each prepared SKU within five business
days; the Starter Kit, seven deck SKUs, and Accessories Kit are publicly
enabled. The three Dive Pack targets are not yet verified or enabled**.

Production verification on **2026-08-16** found the Starter Kit row at **9 ATP,
0 reserved** after one earlier test unit was consumed. Do not rerun the seed or
reset it to 10; nine is the safe current public capacity until an intentional
capacity review adds another unit.

Replenishment owner and review cadence: **Sea Realm owner; review before every
manual ATP increase and whenever materials or production capacity change**.

Increase a SKU only after materials and build capacity are actually restored.
Decrease it immediately if materials, labor, quality, or shipping capacity
falls. Never reset a sold-down count to its original number on a schedule.

Price approval: **owner confirmed the configured prices**  Dates:
**2026-08-15; Dive Pack prices approved 2026-08-24**

## Production speed options

The owner approved these order-level choices:

| Option | Charge | Promise |
| --- | ---: | --- |
| Standard production | Included | Build and dispatch within **5 business days** |
| Expedited production | **$10 once per order** | Build and dispatch within **1 business day** |

Expedited production changes queue priority, not the product SKU. It does not
include faster carrier service and is not a one-day delivery promise. Carrier
transit begins after dispatch and remains controlled by the separately selected
shipping service.

The 10-unit ATP rows protect per-SKU unit availability. Separately, the owner
has confirmed a hard limit of **10 expedited orders per production due date**.
Each order consumes one rush slot regardless of item quantity. Slots are
assigned atomically to the next Monday-through-Friday due date using
`America/New_York`; Friday, Saturday, and Sunday orders target Monday. The
calendar boundary is Eastern midnight.

Abandoned Sessions release their slot only after a terminal unpaid or expired
outcome. Paid orders consume their slot even if later refunded or disputed.
Public holidays are not modeled, so the operator must disable or adjust
expedited capacity around closures. If staffing, materials, quality-control
time, or queue conditions make the promise unsafe, disable expedited selection
for new orders immediately and continue honoring or personally resolving every
expedited order already accepted.

- One-business-day capacity confirmed by: **Sea Realm owner**
- Confirmation date: **2026-08-15**
- Daily expedited-order limit: **10 orders per production due date**
- Allocation time zone and boundary: **America/New_York; Eastern midnight**
- Non-business-day rule: **Friday/Saturday/Sunday target Monday**
- Queue owner and review frequency: **Sea Realm owner; review each business
  day and after every expedited order alert**

## Packing and delivery

The owner approved conservative shipping weights of **0.5 lb (8 oz) per deck**
and **1 lb (16 oz) per Starter Kit or accessory SKU**. The Dive Pack definitions
use **0.5 lb (8 oz)** as a planned conservative checkout input; verify a complete
packed sample does not exceed it before allowlisting those products. Checkout
sums per-unit weights to select a rate tier. Ready-to-mail measurements include
the brown box, cushioning, label, and inserts—not only the unpackaged product.

| Confirmed ready-to-mail parcel | Conservative weight | Outside length × width × height | Pirate Ship postage to 90001 before $0.75 box cost | Estimated postage + box |
| --- | ---: | --- | --- | --- |
| One 60-card deck | 0.5 lb | 8 × 6 × 2 in | Economy $6.23; Priority $13.48 | Economy $6.98; Priority $14.23 |
| One Starter Kit | 1 lb | 10 × 8 × 2 in | Economy $8.76; Priority $13.48 | Economy $9.51; Priority $14.23 |
| Maximum allowed 8-item cart | 8 lb | 20 × 14 × 6 in | Economy $18.86; Priority $33.04 | Economy $19.61; Priority $33.79 |

Online checkout is limited to **8 items and 8 lb (128 oz)** per order.

| Approved conservative order-weight tier | Standard Shipping & Handling | Priority Shipping & Handling |
| --- | ---: | ---: |
| Up to and including 1 lb (16 oz) | $10.00 | $15.00 |
| More than 1 lb (>16 oz) through 8 lb (128 oz) | $20.00 | $35.00 |

- Made-to-order wording to publish: **Built to order; standard production and
  dispatch within five business days, or one business day with the optional
  per-order expedited-production service; carrier transit is separate**.
- Standard orders leave the business within: **5 business days**.
- Expedited orders leave the business within: **1 business day**.
- Standard customer delivery estimate to publish: **2–7 business days in
  transit after production; economy carrier selected through Pirate Ship**.
- Priority customer delivery estimate to publish: **2–3 business days in
  transit after production via USPS Priority Mail**.
- Approved mailed-order Shipping & Handling charges: **use the weight-tier
  table above**.
- Approved Scheduled pickup charge: **free**.
- Initial destinations: **United States only**.
- Carrier/label workflow and daily cutoff: **Buy labels through Pirate Ship;
  no same-day carrier-acceptance cutoff is promised; buy and tender the parcel
  by its production dispatch deadline**.

Rate basis and approval date: **2026-08-15**. The Dive Pack 8-ounce input was
added as a prelaunch conservative target on **2026-08-24**, not as a completed
parcel measurement or carrier quote. The Pirate Ship quotes above use Elverson
19520 to Los Angeles 90001 and exclude the owner-confirmed $0.75 brown box cost
shown separately. Automated checkout tests verify the 8-item/128-ounce maximum
and the $10/$15 and $20/$35 tier boundary; keep the Dive Packs unavailable until
their complete packed samples validate the planned input.

The owner requested free **Scheduled pickup — Elverson, PA**. No appointment is
chosen during Checkout and no street address is published. After production,
the owner emails the customer to agree on a time and privately supplies the
address/instructions. Keep the checkout gate closed until an active, exclusive
6% US/PA manual Stripe Tax Rate has been tested for this fixed pickup handoff
and `STORE_PICKUP_TAX_CONFIRMED=true` is recorded.

## Customer policy approval

Use plain, specific promises that the business can perform. A Pennsylvania CPA
or attorney should review any fact-specific tax or legal question.

- Cancellation allowed until: **a cancellation request is emailed within two
  hours after purchase**.
- Return request window: **30 calendar days after carrier-tracked delivery or
  scheduled pickup**.
- Opened/played card products: **final sale except when damaged, defective,
  missing, or incorrect**.
- Items that cannot be returned: **opened or played products outside the
  approved damaged/defective/missing/incorrect exception**.
- Return shipping paid by: **the purchaser for an ordinary unopened-item
  return**.
- Refund timing after an accepted return: **issued to the original payment
  method within five business days after approval; for a physical return, the
  clock starts after receipt and inspection**.
- Damaged, defective, missing, or incorrect-order process: **the purchaser must
  email the order number and problem within 14 calendar days after delivery or
  pickup, then wait for return or remedy instructions**.
- Lost carrier shipment process: **investigate when tracking suggests loss;
  once carrier loss is confirmed, replace the affected order subject to
  availability or refund it**.
- Public customer-support email: **`maker@seapalstcg.com`**.
- Published dispatch and delivery wording approved: **yes**.
- Published return/refund/cancellation wording approved: **yes**.

Policy approval: **owner-confirmed in the launch task**  Date: **2026-08-15**

## Final operational sign-off

- [x] The established 12 prepared rows were seeded previously; the Starter Kit,
      seven deck rows, and Accessories Kit are in the live public allowlist. The
      Starter Kit currently has 9 ATP and must not be reseeded.
- [ ] Verify Dive Pack contents, sample, representative art,
      packaging/fulfillment, packed weight, and five-business-day capacity;
      during a checkout-disabled cutover apply and query the three missing
      `SP-PACK-*` rows, run launch and online readiness, then add the three Dive
      Pack IDs to the live allowlist.
- [ ] Latest Supabase order, refund, notification, and reservation-reconciliation
      migration applied; the current inventory contract RPC and online readiness
      checks pass before checkout is enabled.
- [x] Restricted live Stripe key and live webhook secret saved in Cloudflare.
- [ ] Live webhook events and pinned API version verified.
- [ ] Stripe receipt emails, public details, branding, and descriptor reviewed.
- [ ] A synthetic paid-order alert reaches `maker@seapalstcg.com`, contains all
      items/quantities and separate production/fulfillment details, an immediate
      replay is suppressed, and a forced provider failure is recovered by the
      scheduled outbox drainer.
- [ ] Scheduled pickup charges $0 shipping and exactly the confirmed fixed tax;
      scheduling email, private instructions, Ready for Pickup, and Picked Up
      workflows tested.
- [ ] Shipping rates and delivery windows published and tested.
- [ ] Made-to-order wording and per-SKU build-and-dispatch windows published.
- [ ] Standard and expedited production wording, one-charge-per-order behavior,
      10-order daily cap, Eastern due-date allocation, terminal-unpaid slot
      release, and carrier-transit distinction verified.
- [ ] Return/refund/cancellation terms deployed, published, and linked before
      payment. The owner-approved source text is complete.
- [ ] Test payment, failure, expiration, duplicate event, refund, inventory
      release, receipt, packing, shipping, and CSV export all passed.
- [ ] Sandbox paid/refund lifecycle passed, followed by a live no-payment
      Checkout Session creation-and-expiration smoke that released its
      reservation. Do not test live mode with real payment details.
- [x] Pennsylvania notice assigns quarterly filing; no identifier was copied
      into the repository.
- [ ] myPATH Location Start Date, first open filing period, and next due date
      recorded privately.
- [ ] First generated Pennsylvania return passes myPATH validation; website and
      Stripe totals, pickup inclusion, use-tax review, Submit confirmation, and
      Processed status are retained under `docs/pa-automatic-filing.md`.
- [ ] License copy displayed as required, without publishing it online.
