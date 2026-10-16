-- Read-only checks after applying store-preorders.sql.
-- Before the migration, save the store_inventory query below; afterward all
-- quantities must match unless an actual checkout/payment changed them.

select public.check_store_inventory_contract_v8() as preorder_contract_ready;

select sku, on_hand_quantity, reserved_quantity
  from public.store_inventory
 order by sku;

select fulfillment_type, payment_status, count(*) as order_count
  from public.store_orders
 group by fulfillment_type, payment_status
 order by fulfillment_type, payment_status;

-- Expected: zero. This contains no customer contact or shipping information.
select count(*) as inconsistent_order_item_types
  from public.store_orders as orders
 where (orders.fulfillment_type = 'regular' and exists (
     select 1 from public.store_order_items as items
      where items.order_id = orders.id and items.fulfillment_type = 'preorder'))
    or (orders.fulfillment_type = 'preorder' and exists (
     select 1 from public.store_order_items as items
      where items.order_id = orders.id and items.fulfillment_type <> 'preorder'))
    or (orders.fulfillment_type = 'mixed' and (
      not exists (select 1 from public.store_order_items as items
        where items.order_id = orders.id and items.fulfillment_type = 'preorder')
      or not exists (select 1 from public.store_order_items as items
        where items.order_id = orders.id and items.fulfillment_type = 'regular')));

-- Expected: zero. Guarantees are based on the ledger payment timestamp.
select count(*) as inconsistent_paid_delivery_promises
  from public.store_orders
 where fulfillment_type in ('preorder', 'mixed')
   and paid_at is not null
   and preorder_delivery_guaranteed is distinct from (paid_at < preorder_cutoff_at);

-- Expected: service_role true, browser roles false.
select role_name, has_function_privilege(role_name,
  'public.reserve_store_order_with_preorders(uuid,uuid,text,text,boolean,integer,text,text,integer,integer,text,text,text,text,integer,integer,timestamp with time zone,jsonb)',
  'EXECUTE') as can_reserve
  from unnest(array['service_role', 'anon', 'authenticated']) as roles(role_name);

-- Expected: four enabled triggers. Existing legacy reservation RPC remains
-- usable during rollout and its new inserts pass through the capture triggers.
select tgname as trigger_name, tgenabled as enabled
  from pg_catalog.pg_trigger
 where tgrelid in ('public.store_orders'::regclass, 'public.store_order_items'::regclass)
   and tgname in ('capture_store_preorder_order_snapshot',
     'capture_store_preorder_item_snapshot', 'guard_store_preorder_order_snapshot',
     'guard_store_preorder_item_snapshot')
 order by tgname;
