-- SeaPals fulfillment-due reminder migration
-- Safe to rerun against the current store-orders v6 schema.
-- This migration does not delete or rewrite order rows.

begin;

do $preflight$
declare
  v_v6_ready boolean;
begin
  if to_regclass('public.store_orders') is null
     or to_regclass('public.store_order_notifications') is null then
    raise exception
      'Install the current SeaPals store-orders schema before this migration.';
  end if;
  if to_regprocedure('public.check_store_inventory_contract_v6()') is null then
    raise exception
      'The SeaPals store-orders v6 contract must be installed first.';
  end if;
  execute 'select public.check_store_inventory_contract_v6()'
    into v_v6_ready;
  if v_v6_ready is distinct from true then
    raise exception
      'The SeaPals store-orders v6 readiness check is not satisfied.';
  end if;
end;
$preflight$;

-- Allow one purchase alert and one fulfillment-due reminder per order.
alter table public.store_order_notifications
  drop constraint if exists store_order_notifications_notification_type_check;
alter table public.store_order_notifications
  add constraint store_order_notifications_notification_type_check
    check (notification_type in (
      'merchant_purchase',
      'merchant_fulfillment_due'
    ));

create unique index if not exists store_order_notifications_order_type_idx
  on public.store_order_notifications (order_id, notification_type);

-- Extend the existing lease-backed outbox operations to the new type.
create or replace function public.claim_store_order_notification(
  p_order_id uuid,
  p_notification_type text,
  p_claim_token uuid,
  p_lease_seconds integer default 300
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_notification public.store_order_notifications%rowtype;
begin
  if p_order_id is null or p_claim_token is null then
    raise exception 'A notification order and claim token are required.';
  end if;
  if p_notification_type is null or p_notification_type not in (
    'merchant_purchase',
    'merchant_fulfillment_due'
  ) then
    raise exception 'Unsupported store notification type.';
  end if;
  if p_lease_seconds is null or p_lease_seconds not between 30 and 900 then
    raise exception 'Notification lease must be between 30 and 900 seconds.';
  end if;

  select notifications.*
    into v_notification
    from public.store_order_notifications as notifications
   where notifications.order_id = p_order_id
     and notifications.notification_type = p_notification_type
   for update;

  if not found then
    return 'missing';
  end if;
  if v_notification.sent_at is not null then
    return 'sent';
  end if;
  if v_notification.claim_token is not null
     and v_notification.claimed_until > now()
     and v_notification.claim_token <> p_claim_token then
    return 'busy';
  end if;

  update public.store_order_notifications
     set claim_token = p_claim_token,
         claimed_until = now() + make_interval(secs => p_lease_seconds),
         last_attempt_at = now(),
         attempt_count = attempt_count + 1,
         last_error_code = null
   where id = v_notification.id;

  return 'claimed';
end;
$$;

create or replace function public.complete_store_order_notification(
  p_order_id uuid,
  p_notification_type text,
  p_claim_token uuid,
  p_provider_message_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  if p_notification_type is null or p_notification_type not in (
    'merchant_purchase',
    'merchant_fulfillment_due'
  ) then
    raise exception 'Unsupported store notification type.';
  end if;

  update public.store_order_notifications
     set sent_at = coalesce(sent_at, now()),
         provider_message_id = coalesce(
           nullif(left(trim(p_provider_message_id), 255), ''),
           provider_message_id
         ),
         claim_token = null,
         claimed_until = null,
         last_error_code = null
   where order_id = p_order_id
     and notification_type = p_notification_type
     and sent_at is null
     and claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.release_store_order_notification(
  p_order_id uuid,
  p_notification_type text,
  p_claim_token uuid,
  p_failure_code text default 'merchant_notification_failed'
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_failure_code text := coalesce(
    nullif(left(trim(p_failure_code), 100), ''),
    'merchant_notification_failed'
  );
  v_updated integer;
begin
  if p_notification_type is null or p_notification_type not in (
    'merchant_purchase',
    'merchant_fulfillment_due'
  ) then
    raise exception 'Unsupported store notification type.';
  end if;
  if v_failure_code !~ '^[A-Za-z0-9_-]{1,100}$' then
    v_failure_code := 'merchant_notification_failed';
  end if;

  update public.store_order_notifications
     set claim_token = null,
         claimed_until = null,
         last_error_code = v_failure_code
   where order_id = p_order_id
     and notification_type = p_notification_type
     and sent_at is null
     and claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

-- Fulfillment promises count Monday through Friday only. This intentionally
-- matches the existing production policy and does not add a holiday calendar.
create or replace function public.add_store_business_days(
  p_start_date date,
  p_business_days integer
)
returns date
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_due_date date;
begin
  if p_start_date is null then
    return null;
  end if;
  if p_business_days is null or p_business_days not between 1 and 30 then
    raise exception 'Business-day count must be between 1 and 30.';
  end if;

  select candidates.candidate_date
    into v_due_date
    from (
      select p_start_date + offsets.day_offset as candidate_date,
             row_number() over (
               order by offsets.day_offset
             ) as business_day_number
        from generate_series(
          1,
          greatest(14, p_business_days * 3)
        ) as offsets(day_offset)
       where extract(
         isodow from p_start_date + offsets.day_offset
       ) between 1 and 5
    ) as candidates
   where candidates.business_day_number = p_business_days;

  if v_due_date is null then
    raise exception 'A fulfillment due date could not be calculated.';
  end if;
  return v_due_date;
end;
$$;

-- Atomically enqueue due-soon live orders and return a bounded retry batch.
-- Only order IDs and due dates enter the outbox path; customer PII stays in
-- the canonical order ledger.
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
             when orders.production_option_id = 'expedited-production'
               then orders.production_due_date
             else public.add_store_business_days(
               (orders.paid_at at time zone 'America/New_York')::date,
               orders.production_max_business_days
             )
           end as pending_due_date,
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
   order by deadlines.notification_created_at, deadlines.notification_id
   limit p_limit;
end;
$$;

-- Read-only rollout check used by the existing readiness command.
create or replace function public.check_store_inventory_contract_v7()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.check_store_inventory_contract_v6()
    and to_regprocedure(
      'public.add_store_business_days(date,integer)'
    ) is not null
    and to_regprocedure(
      'public.prepare_store_fulfillment_due_notifications(integer,timestamp with time zone)'
    ) is not null
    and exists (
      select 1
        from pg_catalog.pg_constraint as constraints
        join pg_catalog.pg_class as tables
          on tables.oid = constraints.conrelid
        join pg_catalog.pg_namespace as schemas
          on schemas.oid = tables.relnamespace
       where schemas.nspname = 'public'
         and tables.relname = 'store_order_notifications'
         and constraints.conname =
           'store_order_notifications_notification_type_check'
         and pg_catalog.pg_get_constraintdef(constraints.oid)
           like '%merchant_purchase%'
         and pg_catalog.pg_get_constraintdef(constraints.oid)
           like '%merchant_fulfillment_due%'
    )
    and not exists (
      select 1
        from unnest(array[
          'claim_store_order_notification',
          'complete_store_order_notification',
          'release_store_order_notification',
          'prepare_store_fulfillment_due_notifications'
        ]) as required(function_name)
       where not exists (
         select 1
           from pg_catalog.pg_proc as functions
           join pg_catalog.pg_namespace as schemas
             on schemas.oid = functions.pronamespace
          where schemas.nspname = 'public'
            and functions.proname = required.function_name
            and functions.prosrc like '%merchant_fulfillment_due%'
       )
    );
$$;

-- Keep the new and updated functions service-role only.
revoke all on function public.claim_store_order_notification(
  uuid, text, uuid, integer
) from public, anon, authenticated;
revoke all on function public.complete_store_order_notification(
  uuid, text, uuid, text
) from public, anon, authenticated;
revoke all on function public.release_store_order_notification(
  uuid, text, uuid, text
) from public, anon, authenticated;
revoke all on function public.add_store_business_days(date, integer)
  from public, anon, authenticated;
revoke all on function public.prepare_store_fulfillment_due_notifications(
  integer, timestamptz
) from public, anon, authenticated;
revoke all on function public.check_store_inventory_contract_v7()
  from public, anon, authenticated;

grant execute on function public.claim_store_order_notification(
  uuid, text, uuid, integer
) to service_role;
grant execute on function public.complete_store_order_notification(
  uuid, text, uuid, text
) to service_role;
grant execute on function public.release_store_order_notification(
  uuid, text, uuid, text
) to service_role;
grant execute on function public.prepare_store_fulfillment_due_notifications(
  integer, timestamptz
) to service_role;
grant execute on function public.check_store_inventory_contract_v7()
  to service_role;

-- Make the new RPC visible to the Supabase REST schema cache at commit.
notify pgrst, 'reload schema';

do $verify$
begin
  if public.check_store_inventory_contract_v7() is distinct from true then
    raise exception 'The fulfillment-reminder v7 contract failed verification.';
  end if;
end;
$verify$;

commit;

-- Expected result: true
select public.check_store_inventory_contract_v7() as fulfillment_reminders_ready;
