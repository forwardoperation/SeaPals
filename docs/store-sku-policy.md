# Store SKU policy

SeaPals uses stable, human-readable SKUs for inventory reservations, order
history, fulfillment, and reporting. A SKU represents one sellable
configuration. It never represents an individual copy, customer order, or
production slot.

## Format

Use uppercase ASCII words separated by hyphens:

`SP-{FAMILY}-{PRODUCT}[-{VARIANT}]`

The current families are:

- `KIT` for multi-product kits;
- `DECK` for ready-to-play decks;
- `ACC` for game accessories; and
- `MERCH` for future apparel, storage, and character merchandise.

Keep a SKU at 100 characters or fewer and use only uppercase letters, numbers,
and hyphens. Do not encode price, current quantity, supplier,
shelf location, customer, order number, or launch date. Those facts change and
belong in their own records. Track individual print runs, lots, or serialized
items separately when that becomes necessary.

Create one SKU for each configuration a customer can independently select and
that changes what is stocked or fulfilled. All identical copies share that
SKU. If a later physical revision is not interchangeable with the original,
create a new SKU such as a reviewed `-V2` revision; never repurpose an SKU that
appears in order history. Display names and descriptions may change without a
new SKU when the fulfilled product remains interchangeable.

## Prepared inventory SKUs

These values are canonical and must match their product definitions and private
`store_inventory.sku` rows exactly. The public allowlist contains
`SP-KIT-STARTER`, the seven `SP-DECK-*` rows, and `SP-ACC-SET`; keeping the
individual accessory rows prepared does not authorize them for sale.

| Product | Canonical SKU |
| --- | --- |
| Starter Kit | `SP-KIT-STARTER` |
| Blue Water Deck | `SP-DECK-BLUE-WATER` |
| Disruption Deck | `SP-DECK-DISRUPTION` |
| Coral Garden Deck | `SP-DECK-CORAL-GARDEN` |
| Darkness Shroud Deck | `SP-DECK-DARKNESS-SHROUD` |
| Open Ocean Deck | `SP-DECK-OPEN-OCEAN-HUNT` |
| Murky Water Deck | `SP-DECK-MURKY-WATER` |
| Stinging Fortress Deck | `SP-DECK-STINGING-FORTRESS` |
| Accessories Kit | `SP-ACC-SET` |
| Conditions Deck | `SP-ACC-CONDITIONS-DECK` |
| Dice Pack | `SP-ACC-DICE-PACK` |
| Reef Point Token Set | `SP-ACC-REEF-POINTS` |

Kits have their own SKUs because the customer buys and the business fulfills
them as configurations distinct from their components. The current inventory
ledger does not understand their bills of materials, so a component cannot be
counted simultaneously toward a kit's available-to-promise capacity and an
individual product's capacity.

## Production speed is not a SKU variant

Standard and expedited production do not change the physical product the
customer receives, so they never create a new product SKU. The same product SKU
is used whether the order is built and dispatched within the standard five
business days or the optional expedited one business day.

Record the selected order-level production option separately. Expedited
production is one $10 handling charge per order, not an inventory-bearing item
and not a fee repeated for every SKU or unit in the cart. Carrier service and
transit time are also separate: expedited production advances the build queue
but does not promise one-day delivery.

The rush-capacity record is also not a SKU. One expedited order consumes one of
10 slots on its atomically assigned Eastern-time production due date, regardless
of how many SKUs or units it contains. The next Monday-through-Friday date is
used, so Friday, Saturday, and Sunday orders share Monday's capacity. Terminal
unpaid/expired Sessions release their slot; paid, refunded, and disputed orders
continue to consume it. Public holidays require an operator adjustment because
the launch calendar does not model them.

## Proposed future product lines

The catalog reserves the following values, but they are not approved for sale:

| Proposed product | Reserved family SKU | Example sellable pattern | Before sale |
| --- | --- | --- | --- |
| Custom T-Shirt | `SP-MERCH-CUSTOM-TSHIRT` | `SP-MERCH-CUSTOM-TSHIRT-{STYLE}-{COLOR}-{SIZE}` | Define every purchasable style, color, and size. Customer text or art belongs on the order, not in the SKU. |
| SeaPals Card Binder | `SP-MERCH-CARD-BINDER` | `SP-MERCH-CARD-BINDER-{COLOR}` | Use the family code itself only if every fulfilled binder is interchangeable; otherwise use one SKU per selectable configuration. |
| SeaPals Backpack | `SP-MERCH-BACKPACK` | `SP-MERCH-BACKPACK-{STYLE}-{COLOR}` | Finalize style and color options before creating sellable child SKUs. |
| SeaPals Plush Toy | `SP-MERCH-PLUSH-TOY` | `SP-MERCH-PLUSH-TOY-{CHARACTER}-{SIZE}` | Create one child SKU for every independently selectable character and size. |

A reserved SKU is planning metadata, not authorization to expose a product or
seed inventory. Finalize its contents, variant structure, price, tax treatment,
approved representative imagery, packaging, fulfillment procedure, and
available-to-promise capacity before adding it to the public allowlist.

## Change control

- Check the catalog, inventory row, packing instructions, and owner launch
  sheet together whenever adding a SKU.
- Never correct a historical order by changing what its SKU means.
- Do not silently rename a live SKU. Introduce the replacement, stop new sales
  of the old SKU, and retain the old value for order and refund history.
- Use an order quantity with the shared SKU for multiple copies; never append a
  sequence number merely to make each unit unique.
