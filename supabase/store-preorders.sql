-- Apply AFTER store-orders.sql (v7), and reapply after future base-schema updates.
-- Backward compatible with the old backend during rollout. Reserves the SAME bounded
-- per-SKU ATP as regular orders; it never adds, replenishes, or duplicates capacity.
-- Existing payment/refund/expiration RPCs continue to commit or release that ATP.
-- December 11 is the dispatch/readiness target; guaranteed delivery is by Dec 24.
-- Orders paid after the cutoff remain accepted, with timing confirmed manually.
begin;

do $preflight$
begin
  if to_regprocedure('public.check_store_inventory_contract_v7()') is null then
    raise exception 'Install store-orders.sql v7 before store-preorders.sql.';
  end if;
  if not public.check_store_inventory_contract_v7() then
    raise exception 'The store-orders v7 readiness contract is not satisfied.';
  end if;
end;
$preflight$;

create or replace function public.store_product_is_preorder(p_product_id text, p_sku text)
returns boolean language sql immutable set search_path = public, pg_temp as $$
  select exists (
    select 1 from (values
      ('starter-kit', 'SP-KIT-STARTER'),
      ('coral-garden', 'SP-DECK-CORAL-GARDEN'),
      ('blue-water', 'SP-DECK-BLUE-WATER'),
      ('darkness-shroud', 'SP-DECK-DARKNESS-SHROUD'),
      ('open-ocean-hunt', 'SP-DECK-OPEN-OCEAN-HUNT'),
      ('murky-water', 'SP-DECK-MURKY-WATER'),
      ('stinging-fortress', 'SP-DECK-STINGING-FORTRESS'),
      ('disruption', 'SP-DECK-DISRUPTION')
    ) as policy(product_id, sku)
    where policy.product_id = p_product_id and policy.sku = p_sku
  );
$$;

alter table public.store_orders
  add column if not exists fulfillment_type text not null default 'regular',
  add column if not exists preorder_campaign_id text,
  add column if not exists preorder_cutoff_at timestamptz,
  add column if not exists preorder_delivery_by date,
  add column if not exists preorder_fulfillment_date date,
  add column if not exists preorder_delivery_guaranteed boolean;
alter table public.store_order_items
  add column if not exists fulfillment_type text not null default 'regular',
  add column if not exists preorder_campaign_id text,
  add column if not exists preorder_cutoff_at timestamptz,
  add column if not exists preorder_delivery_by date,
  add column if not exists preorder_fulfillment_date date;

-- Upgrade only explicit legacy preorder markers. Never reinterpret historic
-- regular purchases just because the catalog now sells that SKU as a preorder.
update public.store_order_items
   set fulfillment_type = 'preorder', preorder_campaign_id = 'christmas-2026',
       preorder_cutoff_at = timestamptz '2026-12-11 05:00:00+00',
       preorder_delivery_by = date '2026-12-24',
       preorder_fulfillment_date = date '2026-12-11'
 where fulfillment_type = 'regular'
   and product_name ~ ' \(pre-order\)$'
   and public.store_product_is_preorder(product_id, sku);
update public.store_orders as orders
   set fulfillment_type = case when exists (
         select 1 from public.store_order_items as items
          where items.order_id = orders.id and items.fulfillment_type = 'regular'
       ) then 'mixed' else 'preorder' end,
       preorder_campaign_id = 'christmas-2026',
       preorder_cutoff_at = timestamptz '2026-12-11 05:00:00+00',
       preorder_delivery_by = date '2026-12-24',
       preorder_fulfillment_date = date '2026-12-11',
       preorder_delivery_guaranteed = case when paid_at is not null
         then paid_at < timestamptz '2026-12-11 05:00:00+00' end
 where orders.fulfillment_type = 'regular'
   and exists (select 1 from public.store_order_items as items
     where items.order_id = orders.id and items.fulfillment_type = 'preorder');

-- The earlier five-business-day workflow may have completed a preorder reminder
-- as stale, or sent a reminder for the old schedule. Retarget only those old
-- completions. The holiday window opens Dec 10 at 09:00 Eastern, so genuine
-- holiday reminders and purchase notifications are never reset by a rerun.
update public.store_order_notifications as notifications
   set sent_at = null, provider_message_id = null,
       claim_token = null, claimed_until = null,
       last_error_code = 'preorder_schedule_reset'
  from public.store_orders as orders
 where notifications.order_id = orders.id
   and notifications.notification_type = 'merchant_fulfillment_due'
   and notifications.sent_at < timestamptz '2026-12-10 14:00:00+00'
   and orders.fulfillment_type in ('preorder', 'mixed')
   and orders.payment_status = 'paid'
   and orders.preorder_delivery_guaranteed is true;

alter table public.store_orders drop constraint if exists store_orders_preorder_snapshot_check;
alter table public.store_orders add constraint store_orders_preorder_snapshot_check check (coalesce((
  (fulfillment_type = 'regular' and preorder_campaign_id is null
   and preorder_cutoff_at is null and preorder_delivery_by is null
   and preorder_fulfillment_date is null and preorder_delivery_guaranteed is null)
  or (fulfillment_type in ('preorder', 'mixed') and preorder_campaign_id = 'christmas-2026'
   and preorder_cutoff_at = timestamptz '2026-12-11 05:00:00+00'
   and preorder_delivery_by = date '2026-12-24'
   and preorder_fulfillment_date = date '2026-12-11'
   and (preorder_delivery_guaranteed is null or paid_at is not null))
), false));
alter table public.store_order_items drop constraint if exists store_order_items_preorder_snapshot_check;
alter table public.store_order_items add constraint store_order_items_preorder_snapshot_check check (coalesce((
  (fulfillment_type = 'regular' and preorder_campaign_id is null
   and preorder_cutoff_at is null and preorder_delivery_by is null and preorder_fulfillment_date is null)
  or (fulfillment_type = 'preorder' and preorder_campaign_id = 'christmas-2026'
   and preorder_cutoff_at = timestamptz '2026-12-11 05:00:00+00'
   and preorder_delivery_by = date '2026-12-24' and preorder_fulfillment_date = date '2026-12-11')
), false));

-- Keep the currently deployed legacy reservation RPC safe during the cutover.
-- Its original arguments, replay fingerprint and return shape stay unchanged.
-- Only new inserts acquire today's policy; historical regular rows stay regular.
create or replace function public.capture_store_preorder_order_snapshot()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  v_has_preorders boolean;
  v_all_preorders boolean;
begin
  if jsonb_typeof(new.checkout_request_snapshot->'items') = 'array' then
    select bool_or(public.store_product_is_preorder(item->>'product_id', item->>'sku')),
           bool_and(public.store_product_is_preorder(item->>'product_id', item->>'sku'))
      into v_has_preorders, v_all_preorders
      from jsonb_array_elements(new.checkout_request_snapshot->'items') as items(item);
    if v_has_preorders then
      if new.production_option_id <> 'standard-production' then
        raise exception 'store_preorder_expedited_unavailable';
      end if;
      new.fulfillment_type := case when v_all_preorders then 'preorder' else 'mixed' end;
      new.preorder_campaign_id := 'christmas-2026';
      new.preorder_cutoff_at := timestamptz '2026-12-11 05:00:00+00';
      new.preorder_delivery_by := date '2026-12-24';
      new.preorder_fulfillment_date := date '2026-12-11';
      new.preorder_delivery_guaranteed := case when new.paid_at is not null
        then new.paid_at < new.preorder_cutoff_at end;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists capture_store_preorder_order_snapshot on public.store_orders;
create trigger capture_store_preorder_order_snapshot before insert on public.store_orders
  for each row execute function public.capture_store_preorder_order_snapshot();

create or replace function public.capture_store_preorder_item_snapshot()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if public.store_product_is_preorder(new.product_id, new.sku)
     and exists (select 1 from public.store_orders where id = new.order_id
       and fulfillment_type in ('preorder', 'mixed')) then
    new.fulfillment_type := 'preorder';
    new.preorder_campaign_id := 'christmas-2026';
    new.preorder_cutoff_at := timestamptz '2026-12-11 05:00:00+00';
    new.preorder_delivery_by := date '2026-12-24';
    new.preorder_fulfillment_date := date '2026-12-11';
  end if;
  return new;
end;
$$;
drop trigger if exists capture_store_preorder_item_snapshot on public.store_order_items;
create trigger capture_store_preorder_item_snapshot before insert on public.store_order_items
  for each row execute function public.capture_store_preorder_item_snapshot();

create or replace function public.guard_store_preorder_order_snapshot()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.fulfillment_type is distinct from old.fulfillment_type
     or new.preorder_campaign_id is distinct from old.preorder_campaign_id
     or new.preorder_cutoff_at is distinct from old.preorder_cutoff_at
     or new.preorder_delivery_by is distinct from old.preorder_delivery_by
     or new.preorder_fulfillment_date is distinct from old.preorder_fulfillment_date then
    raise exception 'Order preorder snapshots are immutable.';
  end if;
  if old.preorder_delivery_guaranteed is not null
     and new.preorder_delivery_guaranteed is distinct from old.preorder_delivery_guaranteed then
    raise exception 'The paid preorder delivery promise is immutable.';
  end if;
  if new.fulfillment_type <> 'regular' and old.preorder_delivery_guaranteed is null then
    -- Derive from the trusted ledger payment time, never Stripe/client metadata.
    new.preorder_delivery_guaranteed := case when new.paid_at is not null
      then new.paid_at < new.preorder_cutoff_at end;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_store_preorder_order_snapshot on public.store_orders;
create trigger guard_store_preorder_order_snapshot before update on public.store_orders
  for each row execute function public.guard_store_preorder_order_snapshot();

create or replace function public.guard_store_preorder_item_snapshot()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.fulfillment_type is distinct from old.fulfillment_type
     or new.preorder_campaign_id is distinct from old.preorder_campaign_id
     or new.preorder_cutoff_at is distinct from old.preorder_cutoff_at
     or new.preorder_delivery_by is distinct from old.preorder_delivery_by
     or new.preorder_fulfillment_date is distinct from old.preorder_fulfillment_date then
    raise exception 'Order item preorder snapshots are immutable.';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_store_preorder_item_snapshot on public.store_order_items;
create trigger guard_store_preorder_item_snapshot before update on public.store_order_items
  for each row execute function public.guard_store_preorder_item_snapshot();

-- Reuse base totals, idempotency, sorted SKU locks, release deadlines and rush
-- limits, with SQL-derived immutable preorder policy captured by insert triggers.
create or replace function public.reserve_store_order_with_preorders(
  p_order_id uuid,
  p_checkout_request_id uuid,
  p_order_number text,
  p_currency text,
  p_payment_livemode boolean,
  p_subtotal_cents integer,
  p_production_option_id text,
  p_production_option_name text,
  p_production_max_business_days integer,
  p_production_cents integer,
  p_fulfillment_method text,
  p_fulfillment_option_id text,
  p_fulfillment_option_name text,
  p_pickup_location text,
  p_shipping_cents integer,
  p_total_cents integer,
  p_inventory_reserved_until timestamptz,
  p_items jsonb
)
returns table (
  id uuid,
  order_number text,
  inventory_reserved_until timestamptz,
  inventory_state text,
  production_due_date date,
  expedited_capacity_state text,
  checkout_session_id text,
  checkout_url text,
  created boolean,
  fulfillment_type text,
  preorder_campaign_id text,
  preorder_cutoff_at timestamptz,
  preorder_delivery_by date,
  preorder_fulfillment_date date,
  preorder_delivery_guaranteed boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reserved record;
begin
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 8 then
    raise exception 'Invalid store order items.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) as items(item)
     where (item ? 'fulfillment_type' and item->>'fulfillment_type' is distinct from
       case when public.store_product_is_preorder(item->>'product_id', item->>'sku') then 'preorder' else 'regular' end)
       or (item ? 'preorder_campaign_id' and item->>'preorder_campaign_id' is distinct from
         case when public.store_product_is_preorder(item->>'product_id', item->>'sku') then 'christmas-2026' end)
       or (item ? 'preorder_cutoff_at' and (item->>'preorder_cutoff_at')::timestamptz is distinct from
         case when public.store_product_is_preorder(item->>'product_id', item->>'sku') then timestamptz '2026-12-11 05:00:00+00' end)
       or (item ? 'preorder_delivery_by' and (item->>'preorder_delivery_by')::date is distinct from
         case when public.store_product_is_preorder(item->>'product_id', item->>'sku') then date '2026-12-24' end)
       or (item ? 'preorder_fulfillment_date' and (item->>'preorder_fulfillment_date')::date is distinct from
         case when public.store_product_is_preorder(item->>'product_id', item->>'sku') then date '2026-12-11' end)
  ) then
    raise exception 'Invalid store preorder item policy.';
  end if;

  -- This call retains sorted SKU locks, request replay, bounded ATP, rush limits,
  -- and reservation deadlines. Insert triggers capture immutable policy below.
  select * into v_reserved from public.reserve_store_order_inventory(
    p_order_id, p_checkout_request_id, p_order_number, p_currency,
    p_payment_livemode, p_subtotal_cents, p_production_option_id,
    p_production_option_name, p_production_max_business_days, p_production_cents,
    p_fulfillment_method, p_fulfillment_option_id, p_fulfillment_option_name,
    p_pickup_location, p_shipping_cents, p_total_cents,
    p_inventory_reserved_until, p_items
  );
  return query select v_reserved.id, v_reserved.order_number,
    v_reserved.inventory_reserved_until, v_reserved.inventory_state,
    v_reserved.production_due_date, v_reserved.expedited_capacity_state,
    v_reserved.checkout_session_id, v_reserved.checkout_url, v_reserved.created,
    orders.fulfillment_type, orders.preorder_campaign_id, orders.preorder_cutoff_at,
    orders.preorder_delivery_by, orders.preorder_fulfillment_date,
    orders.preorder_delivery_guaranteed
    from public.store_orders as orders where orders.id = v_reserved.id;
end;
$$;

create or replace function public.prepare_store_fulfillment_due_notifications(
  p_limit integer default 25,
  p_now timestamptz default now()
)
returns table (order_id uuid, due_date date)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_local_now timestamp without time zone;
  v_local_date date;
  v_local_time time without time zone;
begin
  if p_limit is null or p_limit not between 1 and 50 then
    raise exception 'Fulfillment reminder batch limit must be between 1 and 50.';
  end if;
  if p_now is null then
    raise exception 'Fulfillment reminder time is required.';
  end if;

  v_local_now := p_now at time zone 'America/New_York';
  v_local_date := v_local_now::date;
  v_local_time := v_local_now::time;

  with order_deadlines as (
    select orders.id as order_id,
           case
             when orders.fulfillment_type in ('preorder', 'mixed') then
               case when orders.preorder_delivery_guaranteed is true
                 then orders.preorder_fulfillment_date end
             when orders.production_option_id = 'expedited-production'
               then orders.production_due_date
             else public.add_store_business_days(
               (orders.paid_at at time zone 'America/New_York')::date,
               orders.production_max_business_days
             )
           end as due_date
      from public.store_orders as orders
     where orders.payment_status = 'paid'
       and orders.payment_livemode is true
       and orders.fulfillment_status <> 'cancelled'
       and (
         (
           orders.fulfillment_method = 'shipping'
           and orders.fulfillment_status not in (
             'awaiting_shipment',
             'shipped'
           )
         )
         or (
           orders.fulfillment_method = 'pickup'
           and orders.fulfillment_status not in (
             'ready_for_pickup',
             'picked_up'
           )
         )
       )
  ), due_windows as (
    select deadlines.order_id,
           deadlines.due_date,
           deadlines.due_date - case
             when extract(isodow from deadlines.due_date)::integer = 1 then 3
             when extract(isodow from deadlines.due_date)::integer = 7 then 2
             else 1
           end as reminder_date
      from order_deadlines as deadlines
     where deadlines.due_date is not null
  )
  insert into public.store_order_notifications (
    order_id,
    notification_type
  )
  select windows.order_id,
         'merchant_fulfillment_due'
    from due_windows as windows
   where v_local_date between windows.reminder_date and windows.due_date
     and (
       v_local_date > windows.reminder_date
       or v_local_time >= time '09:00'
     )
     and not exists (
       select 1
         from public.store_order_notifications as existing
        where existing.order_id = windows.order_id
          and existing.notification_type = 'merchant_fulfillment_due'
     )
   order by windows.due_date, windows.order_id
   limit p_limit
  on conflict do nothing;

  return query
  with pending_deadlines as (
    select notifications.order_id as pending_order_id,
           case
             when orders.fulfillment_type in ('preorder', 'mixed') then
               case when orders.preorder_delivery_guaranteed is true
                 then orders.preorder_fulfillment_date end
             when orders.production_option_id = 'expedited-production'
               then orders.production_due_date
             else public.add_store_business_days(
               (orders.paid_at at time zone 'America/New_York')::date,
               orders.production_max_business_days
             )
           end as pending_due_date,
           orders.fulfillment_type as pending_fulfillment_type,
           notifications.created_at as notification_created_at,
           notifications.id as notification_id
      from public.store_order_notifications as notifications
      join public.store_orders as orders on orders.id = notifications.order_id
     where notifications.notification_type = 'merchant_fulfillment_due'
       and notifications.sent_at is null
       and (
         notifications.claimed_until is null
         or notifications.claimed_until <= p_now
       )
  )
  select deadlines.pending_order_id,
         deadlines.pending_due_date
    from pending_deadlines as deadlines
   where deadlines.pending_due_date is not null
     -- An older five-day reminder may already be pending when a legacy marker
     -- is migrated. Keep that future holiday reminder out of today's retry batch.
     and (deadlines.pending_fulfillment_type = 'regular' or (
       v_local_date >= deadlines.pending_due_date - case
         when extract(isodow from deadlines.pending_due_date)::integer = 1 then 3
         when extract(isodow from deadlines.pending_due_date)::integer = 7 then 2
         else 1 end
       and (v_local_date >= deadlines.pending_due_date or v_local_time >= time '09:00')
     ))
   order by deadlines.notification_created_at, deadlines.notification_id
   limit p_limit;
end;
$$;

-- Preserve the legacy RPC during rollout; capture triggers above enforce the
-- same typed policy on its new inserts without changing its retry fingerprints.
revoke all on function public.reserve_store_order_with_preorders(
  uuid, uuid, text, text, boolean, integer, text, text, integer, integer,
  text, text, text, text, integer, integer, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.reserve_store_order_with_preorders(
  uuid, uuid, text, text, boolean, integer, text, text, integer, integer,
  text, text, text, text, integer, integer, timestamptz, jsonb
) to service_role;
revoke all on function public.store_product_is_preorder(text, text) from public, anon, authenticated;
revoke all on function public.guard_store_preorder_order_snapshot() from public, anon, authenticated;
revoke all on function public.guard_store_preorder_item_snapshot() from public, anon, authenticated;
revoke all on function public.capture_store_preorder_order_snapshot() from public, anon, authenticated;
revoke all on function public.capture_store_preorder_item_snapshot() from public, anon, authenticated;

create or replace function public.check_store_inventory_contract_v8()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.check_store_inventory_contract_v7()
    and to_regprocedure('public.reserve_store_order_with_preorders(uuid,uuid,text,text,boolean,integer,text,text,integer,integer,text,text,text,text,integer,integer,timestamp with time zone,jsonb)') is not null
    and not exists (
      select 1 from unnest(array['store_orders','store_order_items']) as required(table_name)
       where not exists (select 1 from pg_catalog.pg_constraint as constraints
         where constraints.conrelid = ('public.' || required.table_name)::regclass
           and constraints.conname = required.table_name || '_preorder_snapshot_check')
    )
    and exists (select 1 from pg_catalog.pg_trigger
      where tgrelid = 'public.store_orders'::regclass
        and tgname = 'guard_store_preorder_order_snapshot' and not tgisinternal)
    and has_function_privilege('service_role',
      'public.reserve_store_order_with_preorders(uuid,uuid,text,text,boolean,integer,text,text,integer,integer,text,text,text,text,integer,integer,timestamp with time zone,jsonb)', 'EXECUTE')
    and not exists (
      select 1 from (values ('store_orders','capture_store_preorder_order_snapshot'),
        ('store_order_items','capture_store_preorder_item_snapshot')) as required(table_name,trigger_name)
       where not exists (select 1 from pg_catalog.pg_trigger
         where tgrelid = ('public.' || required.table_name)::regclass
           and tgname = required.trigger_name and not tgisinternal)
    );
$$;
revoke all on function public.check_store_inventory_contract_v8() from public, anon, authenticated;
grant execute on function public.check_store_inventory_contract_v8() to service_role;

comment on column public.store_orders.fulfillment_type is
  'Immutable checkout snapshot: regular, preorder, or mixed. Mixed orders ship together on the preorder schedule.';
comment on column public.store_orders.preorder_delivery_guaranteed is
  'Null until a paid ledger timestamp exists; true only for payment strictly before the persisted campaign cutoff. Never inferred from mutable catalog copy.';
comment on column public.store_orders.preorder_fulfillment_date is
  'Campaign dispatch/readiness target. Due reminders apply only to paid preorders with a confirmed delivery guarantee; late payments require merchant scheduling.';
commit;
