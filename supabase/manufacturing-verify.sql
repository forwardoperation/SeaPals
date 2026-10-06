-- Read-only verification after manufacturing.sql and manufacturing-inventory.sql.
-- Does not create orders, claim print jobs, or enqueue buyer messages.
with manufacturing_tables as (
  select c.oid, c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relname in ('manufacturing_releases', 'manufacturing_settings',
                     'manufacturing_orders', 'manufacturing_notifications',
                     'manufacturing_stock', 'manufacturing_stock_operations', 'manufacturing_stock_movements')
), manufacturing_functions as (
  select p.oid, p.prosecdef, p.proconfig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'manufacturing_%'
), checks as (
  select 1 as position, 'All seven manufacturing tables exist' as check_name,
    (select count(*) = 7 from manufacturing_tables) as passed
  union all select 2, 'Row-level security enabled on all seven tables',
    (select count(*) = 7 and bool_and(relrowsecurity) from manufacturing_tables)
  union all select 3, 'Public and signed-in clients cannot access tables',
    (select count(*) = 7 and bool_and(
      not has_table_privilege('anon', oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      and not has_table_privilege('authenticated', oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    ) from manufacturing_tables)
  union all select 4, 'Server role can read and maintain all seven tables',
    (select count(*) = 7 and bool_and(
      has_table_privilege('service_role', oid, 'SELECT')
      and has_table_privilege('service_role', oid, 'INSERT')
      and has_table_privilege('service_role', oid, 'UPDATE')
      and has_table_privilege('service_role', oid, 'DELETE')
    ) from manufacturing_tables)
  union all select 5, 'All 18 manufacturing functions are server-only',
    (select count(*) = 18 and bool_and(
      prosecdef and 'search_path=public, pg_temp' = any(proconfig)
      and has_function_privilege('service_role', oid, 'EXECUTE')
      and not has_function_privilege('anon', oid, 'EXECUTE')
      and not has_function_privilege('authenticated', oid, 'EXECUTE')
    ) from manufacturing_functions)
  union all select 6, 'Paid-order and fulfillment trigger enabled',
    exists(select 1 from pg_trigger where tgrelid = 'public.store_orders'::regclass
      and tgname = 'manufacturing_order_changed' and tgenabled = 'O'
      and tgfoid = 'public.manufacturing_order_changed()'::regprocedure)
  union all select 7, 'Manufacturing settings initialized',
    (select count(*) = 1 from public.manufacturing_settings where id)
  union all select 8, 'Artwork bucket is private',
    exists(select 1 from storage.buckets
      where id = 'searealm-manufacturing-private' and not public)
  union all select 9, 'Restrictive artwork storage policy installed',
    exists(select 1 from pg_policies where schemaname = 'storage'
      and tablename = 'objects' and policyname = 'manufacturing_private_only'
      and permissive = 'RESTRICTIVE' and cmd = 'ALL'
      and 'anon' = any(roles) and 'authenticated' = any(roles)
      and qual like '%searealm-manufacturing-private%'
      and with_check like '%searealm-manufacturing-private%')
  union all select 10, 'Refund reservation-release trigger enabled',
    exists(select 1 from pg_trigger where tgrelid = 'public.store_refunds'::regclass
      and tgname = 'manufacturing_refund_changed' and tgenabled = 'O')
  union all select 11, 'Finished stock catalog and counters valid',
    (select count(*) = 15 and bool_and(on_hand >= reserved and reserved >= 0) from public.manufacturing_stock)
)
select check_name, coalesce(passed, false) as passed from checks order by position;
