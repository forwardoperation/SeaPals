-- ONE-TIME PRODUCTION CAPACITY SEED FOR THE INITIAL SEAPALS STORE LAUNCH.
--
-- Apply this file only after supabase/store-orders.sql has completed, during a
-- checkout-disabled production cutover. The owner approved an initial
-- available-to-promise capacity of 10 for each of the 12 prepared SKUs below.
-- The Starter Kit, seven deck SKUs, and Accessories Kit are in the current
-- public allowlist; retaining the other three rows does not make those products
-- purchasable. This non-replenishing seed records initial capacity only; the
-- Starter Kit may now be below 10 because an earlier test consumed one unit.
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
  ('SP-ACC-SET', 10, 0),
  ('SP-ACC-CONDITIONS-DECK', 10, 0),
  ('SP-ACC-DICE-PACK', 10, 0),
  ('SP-ACC-REEF-POINTS', 10, 0)
on conflict (sku) do nothing;

commit;
