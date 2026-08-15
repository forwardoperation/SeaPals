# Store launch owner input

Checkout remains intentionally locked until the owner fills and approves this
short operational record. Do not add license numbers, tax IDs, bank details, or
personal identity documents here.

## Catalog and available-to-promise capacity

A SKU identifies one sellable product configuration, not one physical copy.
Every Blue Water Deck, for example, uses `SP-DECK-BLUE-WATER`; do not create a
new SKU for each order, print run, or assembled deck. See
`docs/store-sku-policy.md` for the complete naming and lifecycle policy.

For the made-to-order launch, **available-to-promise (ATP) capacity** is the
maximum number of additional units that current dedicated materials and labor
can support within the published build-and-dispatch window. It is a firm
fulfillment limit, not a sales forecast or aspirational target. Include active
paid orders when deciding whether capacity remains available.

Do not count the same cards, dice, tokens, packaging, or labor under multiple
SKUs. Until a bill-of-materials allocator exists, dedicate a fixed material and
labor allotment to each bundle and individually sold product. A Starter Kit or
Accessories Kit may be assembled after purchase, but its allocated components
cannot also support the ATP capacity of its component SKUs.

| SKU | Product | Configured price | Initial ATP capacity | Build and dispatch within | Contents/sample verified | Package photo ready |
| --- | --- | ---: | ---: | --- | --- | --- |
| `SP-KIT-STARTER` | Starter Kit | $44 | **10** | **5 business days** |  |  |
| `SP-DECK-BLUE-WATER` | Blue Water Deck | $22 | **10** | **5 business days** | 60 cards:  |  |
| `SP-DECK-DISRUPTION` | Disruption Deck | $22 | **10** | **5 business days** | 60 cards:  |  |
| `SP-DECK-CORAL-GARDEN` | Coral Garden Deck | $22 | **10** | **5 business days** | 60 cards:  |  |
| `SP-DECK-DARKNESS-SHROUD` | Darkness Shroud Deck | $22 | **10** | **5 business days** | 60 cards:  |  |
| `SP-DECK-OPEN-OCEAN-HUNT` | Open Ocean Deck | $22 | **10** | **5 business days** | 60 cards:  |  |
| `SP-DECK-MURKY-WATER` | Murky Water Deck | $22 | **10** | **5 business days** | 60 cards:  |  |
| `SP-DECK-STINGING-FORTRESS` | Stinging Fortress Deck | $22 | **10** | **5 business days** | 60 cards:  |  |
| `SP-ACC-SET` | Accessories Kit | $12 | **10** | **5 business days** |  |  |
| `SP-ACC-CONDITIONS-DECK` | Conditions Deck | $5 | **10** | **5 business days** | ___ cards; title list approved:  |  |
| `SP-ACC-DICE-PACK` | Dice Pack | $5 | **10** | **5 business days** | Dice types and quantities:  |  |
| `SP-ACC-REEF-POINTS` | Reef Point Token Set | $5 | **10** | **5 business days** | Count and denominations:  |  |

The owner has confirmed an initial ATP cap of 10 and a standard
five-business-day build-and-dispatch window for each launch SKU. The per-SKU
caps are safe only when materials and labor support them concurrently. If
resources are shared, dedicate the allotments or lower the affected caps before
checkout opens.

Before enabling a SKU, make at least one complete sample to verify contents,
quality control, package photo, packed weight, dimensions, and postage. The
sample does not need to be counted in ATP capacity if it will not be sold.

Capacity calculation reviewed by: ____________________  Date: __________

Materials or production constraint used for each ATP count: ________________

Replenishment owner and review cadence: _____________________________________

Increase a SKU only after materials and build capacity are actually restored.
Decrease it immediately if materials, labor, quality, or shipping capacity
falls. Never reset a sold-down count to its original number on a schedule.

Price approval: ____________________  Date: __________

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

- One-business-day capacity confirmed by: ____________________
- Confirmation date: __________
- Daily expedited-order limit: **10 orders per production due date**
- Allocation time zone and boundary: **America/New_York; Eastern midnight**
- Non-business-day rule: **Friday/Saturday/Sunday target Monday**
- Queue owner and review frequency: ____________________

## Packing and delivery

Measure a ready-to-mail parcel, including the mailer, cushioning, label, and
inserts—not an unpackaged product.

| Test parcel | Weight | Length × width × height | Actual quoted postage |
| --- | --- | --- | ---: |
| One lightest launch item |  |  |  |
| One Starter Kit |  |  |  |
| Heaviest allowed 20-item cart |  |  |  |

- Made-to-order wording to publish: ________________________________________.
- Standard orders leave the business within: **5 business days**.
- Expedited orders leave the business within: **1 business day**.
- Standard customer delivery estimate to publish: __________.
- Priority customer delivery estimate to publish: __________.
- Approved Standard Shipping & Handling charge: __________.
- Approved Priority Shipping & Handling charge: __________.
- Initial destinations: United States only / other: __________.
- Carrier/label workflow and daily cutoff: __________.

The owner requested free **Scheduled pickup — Elverson, PA**. No appointment is
chosen during Checkout and no street address is published. After production,
the owner emails the customer to agree on a time and privately supplies the
address/instructions. Keep the checkout gate closed until an active, exclusive
6% US/PA manual Stripe Tax Rate has been tested for this fixed pickup handoff
and `STORE_PICKUP_TAX_CONFIRMED=true` is recorded.

## Customer policy approval

Use plain, specific promises that the business can perform. A Pennsylvania CPA
or attorney should review any fact-specific tax or legal question.

- Cancellation allowed until: __________.
- Return request window: __________ days from __________.
- Opened/played card products: returnable / not returnable / conditions: __________.
- Items that cannot be returned: __________.
- Return shipping paid by: __________.
- Refund timing after an accepted return: __________.
- Damaged, defective, missing, or incorrect-order process: __________.
- Lost/delayed carrier shipment process: __________.
- Public customer-support email: __________.
- Published dispatch and delivery wording approved: yes / no.
- Published return/refund/cancellation wording approved: yes / no.

Policy approval: ____________________  Date: __________

## Final operational sign-off

- [ ] Supabase inventory migration applied and all 12 SKU rows seeded with
      owner-approved ATP capacities.
- [ ] Restricted live Stripe key and live webhook secret saved in Cloudflare.
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
- [ ] Return/refund/cancellation terms published and linked before payment.
- [ ] Test payment, failure, expiration, duplicate event, refund, inventory
      release, receipt, packing, shipping, and CSV export all passed.
- [ ] One small live order/refund audit passed before broad availability.
- [ ] myPATH filing frequency and next due date recorded privately.
- [ ] License copy displayed as required, without publishing it online.
