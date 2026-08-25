-- NON-REPLENISHING CAPACITY SEED FOR THE PLANNED 15-SKU STORE CATALOG.
--
-- Apply this file only after supabase/store-orders.sql has completed, during a
-- checkout-disabled production cutover. The source lists 15 planned/prepared
-- SKUs at an intended initial available-to-promise capacity of 10 each. Merely
-- changing or deploying this file does not prove that any production row was
-- inserted, and rerunning it never restores an existing sold-down row.
--
-- The current live allowlist remains the Starter Kit, seven deck SKUs, and
-- Accessories Kit. The three SP-PACK-* Dive Pack rows are prelaunch: verify
-- their contents, packaging/fulfillment procedure, and
-- five-business-day capacity before applying these missing rows. With checkout
-- disabled, apply the seed, verify all three rows and online readiness, and only
-- then add the Dive Pack product IDs to STORE_AVAILABLE_PRODUCT_IDS.
-- The other three accessory rows remain private preparation records.
-- The Starter Kit may now be below 10 because an earlier test consumed one unit.
-- Reserved capacity starts at zero.
--
-- These numbers do not validate shared materials, shared kit components,
-- production labor, or the promised dispatch window. Confirm those constraints
-- operationally before checkout is enabled. Future merchandise SKUs are
-- intentionally excluded.
--
-- Reruns are non-replenishing: an existing SKU is always left untouched, even
-- if orders have reduced its on-hand capacity. Never replace DO NOTHING with an
-- upsert that updates quantities.

begin;

insert into public.store_inventory (
  sku,
  on_hand_quantity,
  reserved_quantity
)
values
  ('SP-KIT-STARTER', 10, 0),
  ('SP-DECK-BLUE-WATER', 10, 0),
  ('SP-DECK-DISRUPTION', 10, 0),
  ('SP-DECK-CORAL-GARDEN', 10, 0),
  ('SP-DECK-DARKNESS-SHROUD', 10, 0),
  ('SP-DECK-OPEN-OCEAN-HUNT', 10, 0),
  ('SP-DECK-MURKY-WATER', 10, 0),
  ('SP-DECK-STINGING-FORTRESS', 10, 0),
  ('SP-PACK-OCEANIC', 10, 0),
  ('SP-PACK-REEF', 10, 0),
  ('SP-PACK-DEEP', 10, 0),
  ('SP-ACC-SET', 10, 0),
  ('SP-ACC-CONDITIONS-DECK', 10, 0),
  ('SP-ACC-DICE-PACK', 10, 0),
  ('SP-ACC-REEF-POINTS', 10, 0)
on conflict (sku) do nothing;

commit;
