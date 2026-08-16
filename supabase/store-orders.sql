create extension if not exists pgcrypto;

create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  payment_provider text not null default 'stripe'
    check (payment_provider in ('stripe')),
  checkout_session_id text unique,
  payment_intent_id text unique,
  charge_id text,
  payment_livemode boolean,
  customer_email text,
  customer_name text,
  shipping_address jsonb not null default '{}'::jsonb,
  currency text not null default 'usd'
    check (currency ~ '^[a-z]{3}$'),
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  production_option_id text not null default 'standard-production',
  production_option_name text not null default 'Standard production',
  production_max_business_days integer not null default 5,
  production_cents integer not null default 0 check (production_cents >= 0),
  production_due_date date,
  expedited_capacity_state text not null default 'not_applicable',
  fulfillment_method text not null default 'shipping'
    check (fulfillment_method in ('shipping', 'pickup')),
  fulfillment_option_id text not null default 'standard',
  fulfillment_option_name text not null default 'Standard Shipping & Handling',
  pickup_location text,
  stripe_shipping_rate_id text,
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  amount_refunded_cents integer not null default 0
    check (amount_refunded_cents >= 0),
  refund_lifecycle_started_at timestamptz not null default now(),
  dispute_id text,
  dispute_status text,
  dispute_updated_at timestamptz,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'partially_refunded', 'refunded', 'disputed', 'chargeback')),
  fulfillment_status text not null default 'unfulfilled'
    check (fulfillment_status in ('unfulfilled', 'packing', 'ready_for_pickup', 'picked_up', 'on_hold', 'shipped', 'cancelled')),
  receipt_url text,
  receipt_number text,
  tracking_number text,
  tracking_url text,
  internal_notes text,
  paid_at timestamptz,
  refunded_at timestamptz,
  shipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_orders
  add column if not exists charge_id text;
alter table public.store_orders
  add column if not exists receipt_number text;
alter table public.store_orders
  add column if not exists amount_refunded_cents integer not null default 0;
alter table public.store_orders
  add column if not exists refund_lifecycle_started_at timestamptz not null default now();
alter table public.store_orders
  add column if not exists dispute_id text;
alter table public.store_orders
  add column if not exists dispute_status text;
alter table public.store_orders
  add column if not exists dispute_updated_at timestamptz;
alter table public.store_orders
  add column if not exists fulfillment_method text not null default 'shipping';
alter table public.store_orders
  add column if not exists fulfillment_option_id text not null default 'standard';
alter table public.store_orders
  add column if not exists fulfillment_option_name text not null default 'Standard Shipping & Handling';
alter table public.store_orders
  add column if not exists pickup_location text;
alter table public.store_orders
  add column if not exists stripe_shipping_rate_id text;
alter table public.store_orders
  add column if not exists checkout_request_id uuid;
alter table public.store_orders
  add column if not exists checkout_request_snapshot jsonb;
alter table public.store_orders
  add column if not exists checkout_url text;
alter table public.store_orders
  add column if not exists production_option_id text not null default 'standard-production';
alter table public.store_orders
  add column if not exists production_option_name text not null default 'Standard production';
alter table public.store_orders
  add column if not exists production_max_business_days integer not null default 5;
alter table public.store_orders
  add column if not exists production_cents integer not null default 0;
alter table public.store_orders
  add column if not exists production_due_date date;
alter table public.store_orders
  add column if not exists expedited_capacity_state text;
alter table public.store_orders
  add column if not exists inventory_state text not null default 'not_managed';
alter table public.store_orders
  add column if not exists inventory_reserved_until timestamptz;
alter table public.store_orders
  add column if not exists inventory_committed_at timestamptz;
alter table public.store_orders
  add column if not exists inventory_released_at timestamptz;
alter table public.store_orders
  add column if not exists inventory_release_reason text;
alter table public.store_orders
  add column if not exists inventory_reconciliation_claim_token uuid;
alter table public.store_orders
  add column if not exists inventory_reconciliation_claimed_until timestamptz;
alter table public.store_orders
  add column if not exists inventory_reconciliation_attempt_count integer not null default 0;
alter table public.store_orders
  add column if not exists inventory_reconciliation_last_attempt_at timestamptz;
alter table public.store_orders
  add column if not exists inventory_reconciliation_retry_at timestamptz;
alter table public.store_orders
  add column if not exists inventory_reconciliation_last_error_code text;
update public.store_orders
   set amount_refunded_cents = 0
 where amount_refunded_cents is null;
alter table public.store_orders
  alter column amount_refunded_cents set default 0;
alter table public.store_orders
  alter column amount_refunded_cents set not null;

-- Preserve legacy orders while giving any pre-existing expedited order the
-- business-day bucket it would have received when it was created. No holiday
-- calendar is applied: Friday, Saturday, and Sunday all roll to Monday.
update public.store_orders
   set production_due_date = null,
       expedited_capacity_state = 'not_applicable'
 where production_option_id = 'standard-production'
   and (
     production_due_date is not null
     or expedited_capacity_state is distinct from 'not_applicable'
   );

update public.store_orders
   set production_due_date =
         (created_at at time zone 'America/New_York')::date
         + case extract(
             isodow from (created_at at time zone 'America/New_York')::date
           )::integer
             when 5 then 3
             when 6 then 2
             else 1
           end,
       expedited_capacity_state = case
         when payment_status in (
           'paid',
           'partially_refunded',
           'refunded',
           'disputed',
           'chargeback'
         ) or inventory_state = 'committed' then 'committed'
         when payment_status = 'pending' and inventory_state = 'reserved'
           then 'reserved'
         else 'released'
       end
 where production_option_id = 'expedited-production'
   and (
     production_due_date is null
     or expedited_capacity_state is null
     or expedited_capacity_state = 'not_applicable'
   );

alter table public.store_orders
  alter column expedited_capacity_state set default 'not_applicable';
alter table public.store_orders
  alter column expedited_capacity_state set not null;

alter table public.store_orders
  drop constraint if exists store_orders_amount_refunded_cents_check;
alter table public.store_orders
  add constraint store_orders_amount_refunded_cents_check
    check (amount_refunded_cents >= 0);

alter table public.store_orders
  drop constraint if exists store_orders_fulfillment_method_check;
alter table public.store_orders
  add constraint store_orders_fulfillment_method_check
    check (fulfillment_method in ('shipping', 'pickup'));

alter table public.store_orders
  drop constraint if exists store_orders_fulfillment_option_id_check;
alter table public.store_orders
  add constraint store_orders_fulfillment_option_id_check
    check (fulfillment_option_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.store_orders
  drop constraint if exists store_orders_production_option_check;
alter table public.store_orders
  add constraint store_orders_production_option_check
    check (
      (
        production_option_id = 'standard-production'
        and production_option_name = 'Standard production'
        and production_max_business_days = 5
        and production_cents = 0
      )
      or (
        production_option_id = 'expedited-production'
        and production_option_name = 'Expedited production'
        and production_max_business_days = 1
        and production_cents = 1000
      )
    );

alter table public.store_orders
  drop constraint if exists store_orders_expedited_capacity_check;
alter table public.store_orders
  add constraint store_orders_expedited_capacity_check
    check (
      (
        production_option_id = 'standard-production'
        and production_due_date is null
        and expedited_capacity_state = 'not_applicable'
      )
      or (
        production_option_id = 'expedited-production'
        and production_due_date is not null
        and expedited_capacity_state in ('reserved', 'committed', 'released')
      )
    );

alter table public.store_orders
  drop constraint if exists store_orders_pickup_details_check;
alter table public.store_orders
  add constraint store_orders_pickup_details_check
    check (
      fulfillment_method <> 'pickup'
      or (shipping_cents = 0 and nullif(trim(pickup_location), '') is not null)
    );

alter table public.store_orders
  drop constraint if exists store_orders_inventory_state_check;
alter table public.store_orders
  add constraint store_orders_inventory_state_check
    check (inventory_state in (
      'not_managed',
      'reserved',
      'committed',
      'released'
    ));

alter table public.store_orders
  drop constraint if exists store_orders_inventory_timestamps_check;
alter table public.store_orders
  add constraint store_orders_inventory_timestamps_check
    check (
      (inventory_state = 'not_managed')
      or (
        inventory_state = 'reserved'
        and inventory_reserved_until is not null
        and inventory_committed_at is null
        and inventory_released_at is null
      )
      or (
        inventory_state = 'committed'
        and inventory_reserved_until is not null
        and inventory_committed_at is not null
        and inventory_released_at is null
      )
      or (
        inventory_state = 'released'
        and inventory_reserved_until is not null
        and inventory_committed_at is null
        and inventory_released_at is not null
      )
    );

alter table public.store_orders
  drop constraint if exists store_orders_inventory_reconciliation_lease_check;
alter table public.store_orders
  add constraint store_orders_inventory_reconciliation_lease_check
    check (
      (inventory_reconciliation_claim_token is null) =
      (inventory_reconciliation_claimed_until is null)
    );

alter table public.store_orders
  drop constraint if exists store_orders_inventory_reconciliation_attempt_check;
alter table public.store_orders
  add constraint store_orders_inventory_reconciliation_attempt_check
    check (inventory_reconciliation_attempt_count >= 0);

alter table public.store_orders
  drop constraint if exists store_orders_inventory_reconciliation_error_check;
alter table public.store_orders
  add constraint store_orders_inventory_reconciliation_error_check
    check (
      inventory_reconciliation_last_error_code is null
      or inventory_reconciliation_last_error_code ~ '^[A-Za-z0-9_-]{1,100}$'
    );

alter table public.store_orders
  drop constraint if exists store_orders_checkout_url_check;
alter table public.store_orders
  add constraint store_orders_checkout_url_check
    check (
      checkout_url is null
      or checkout_url ~ '^https://checkout[.]stripe[.]com/'
    );

alter table public.store_orders
  drop constraint if exists store_orders_payment_status_check;
alter table public.store_orders
  add constraint store_orders_payment_status_check
    check (payment_status in (
      'pending',
      'paid',
      'failed',
      'partially_refunded',
      'refunded',
      'disputed',
      'chargeback'
    ));

alter table public.store_orders
  drop constraint if exists store_orders_dispute_lifecycle_check;
alter table public.store_orders
  add constraint store_orders_dispute_lifecycle_check
    check (
      (
        dispute_id is null
        and dispute_status is null
        and dispute_updated_at is null
      )
      or (
        dispute_id ~ '^dp_[A-Za-z0-9_]+$'
        and dispute_status in (
          'warning_needs_response',
          'warning_under_review',
          'warning_closed',
          'needs_response',
          'under_review',
          'won',
          'lost',
          'prevented'
        )
        and dispute_updated_at is not null
      )
    );

alter table public.store_orders
  drop constraint if exists store_orders_fulfillment_status_check;
alter table public.store_orders
  add constraint store_orders_fulfillment_status_check
    check (fulfillment_status in (
      'unfulfilled',
      'packing',
      'ready_for_pickup',
      'picked_up',
      'on_hold',
      'shipped',
      'cancelled'
    ));

-- Bring pre-existing refund records into the same safe fulfillment state used
-- by new webhook events. Shipped orders are intentionally never overwritten.
update public.store_orders
   set fulfillment_status = case
         when payment_status in ('refunded', 'chargeback') then 'cancelled'
         else 'on_hold'
       end
 where payment_status in (
   'partially_refunded',
   'refunded',
   'disputed',
   'chargeback'
 )
   and fulfillment_status in ('unfulfilled', 'packing', 'ready_for_pickup');

create table if not exists public.store_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  product_id text not null,
  product_category text not null default 'uncategorized',
  sku text not null,
  deck_id text,
  product_name text not null,
  unit_amount_cents integer not null check (unit_amount_cents >= 0),
  quantity integer not null check (quantity between 1 and 8),
  line_total_cents integer not null check (line_total_cents >= 0),
  created_at timestamptz not null default now(),
  unique (order_id, product_id)
);

alter table public.store_order_items
  add column if not exists product_category text not null default 'uncategorized';
alter table public.store_order_items
  alter column deck_id drop not null;
alter table public.store_order_items
  drop constraint if exists store_order_items_quantity_check;
alter table public.store_order_items
  add constraint store_order_items_quantity_check
    check (quantity between 1 and 8);

create table if not exists public.store_inventory (
  sku text primary key,
  on_hand_quantity integer not null default 0
    check (on_hand_quantity >= 0),
  reserved_quantity integer not null default 0
    check (reserved_quantity >= 0),
  updated_at timestamptz not null default now(),
  check (sku ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$'),
  check (reserved_quantity <= on_hand_quantity)
);

create table if not exists public.store_payment_events (
  provider_event_id text primary key,
  event_type text not null,
  order_id uuid references public.store_orders(id) on delete set null,
  checkout_session_id text,
  event_created_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.store_refunds (
  id uuid primary key default gen_random_uuid(),
  provider_refund_id text not null unique
    check (provider_refund_id ~ '^re_[A-Za-z0-9_]+$'),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  payment_intent_id text,
  charge_id text,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  status text not null
    check (status in (
      'pending',
      'requires_action',
      'succeeded',
      'failed',
      'canceled'
    )),
  pending_reason text,
  failure_reason text,
  payment_livemode boolean not null,
  provider_created_at timestamptz,
  provider_updated_at timestamptz not null,
  latest_provider_event_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (payment_intent_id is null or payment_intent_id ~ '^pi_[A-Za-z0-9_]+$'),
  check (charge_id is null or charge_id ~ '^ch_[A-Za-z0-9_]+$'),
  check (payment_intent_id is not null or charge_id is not null),
  check (pending_reason is null or pending_reason ~ '^[a-z0-9_]{1,100}$'),
  check (failure_reason is null or failure_reason ~ '^[a-z0-9_]{1,100}$'),
  check (length(latest_provider_event_id) between 1 and 255)
);

create table if not exists public.store_order_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  notification_type text not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  claim_token uuid,
  claimed_until timestamptz,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (notification_type = 'merchant_purchase'),
  check ((claim_token is null) = (claimed_until is null)),
  check (provider_message_id is null or length(provider_message_id) <= 255),
  check (last_error_code is null or last_error_code ~ '^[A-Za-z0-9_-]{1,100}$')
);

create index if not exists store_orders_created_at_idx
  on public.store_orders (created_at desc);
create index if not exists store_orders_payment_status_idx
  on public.store_orders (payment_status, created_at desc);
create index if not exists store_orders_fulfillment_status_idx
  on public.store_orders (fulfillment_status, created_at desc);
create index if not exists store_orders_expedited_capacity_active_idx
  on public.store_orders (production_due_date, expedited_capacity_state)
  where production_option_id = 'expedited-production'
    and expedited_capacity_state in ('reserved', 'committed');
create index if not exists store_orders_overdue_inventory_reconciliation_idx
  on public.store_orders (
    inventory_reserved_until,
    inventory_reconciliation_retry_at,
    inventory_reconciliation_claimed_until
  )
  where inventory_state = 'reserved';
create unique index if not exists store_orders_charge_id_idx
  on public.store_orders (charge_id) where charge_id is not null;
create unique index if not exists store_orders_checkout_request_id_idx
  on public.store_orders (checkout_request_id)
  where checkout_request_id is not null;
create unique index if not exists store_orders_stripe_shipping_rate_id_idx
  on public.store_orders (stripe_shipping_rate_id)
  where stripe_shipping_rate_id is not null;
create index if not exists store_order_items_order_id_idx
  on public.store_order_items (order_id);
create index if not exists store_payment_events_order_id_idx
  on public.store_payment_events (order_id);
create index if not exists store_refunds_order_status_idx
  on public.store_refunds (order_id, status, provider_updated_at desc);
create unique index if not exists store_order_notifications_order_type_idx
  on public.store_order_notifications (order_id, notification_type);
create index if not exists store_order_notifications_pending_idx
  on public.store_order_notifications (created_at)
  where sent_at is null;

create or replace function public.set_store_order_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_store_orders_updated_at on public.store_orders;
create trigger set_store_orders_updated_at
before update on public.store_orders
for each row execute function public.set_store_order_updated_at();

drop trigger if exists set_store_inventory_updated_at on public.store_inventory;
create trigger set_store_inventory_updated_at
before update on public.store_inventory
for each row execute function public.set_store_order_updated_at();

drop trigger if exists set_store_order_notifications_updated_at
  on public.store_order_notifications;
create trigger set_store_order_notifications_updated_at
before update on public.store_order_notifications
for each row execute function public.set_store_order_updated_at();

drop trigger if exists set_store_refunds_updated_at on public.store_refunds;
create trigger set_store_refunds_updated_at
before update on public.store_refunds
for each row execute function public.set_store_order_updated_at();

drop function if exists public.reserve_store_order_inventory(
  uuid, uuid, text, text, boolean, integer, text, text, text, text,
  integer, integer, timestamptz, jsonb
);
drop function if exists public.reserve_store_order_inventory(
  uuid, uuid, text, text, boolean, integer, text, text, integer, integer,
  text, text, text, text, integer, integer, timestamptz, jsonb
);
create or replace function public.reserve_store_order_inventory(
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
  created boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.store_orders%rowtype;
  v_inventory public.store_inventory%rowtype;
  v_item record;
  v_normalized_items jsonb;
  v_request_snapshot jsonb;
  v_item_count integer;
  v_product_count integer;
  v_sku_count integer;
  v_local_order_date date;
  v_production_due_date date;
  v_expedited_capacity_state text := 'not_applicable';
  v_active_expedited_count integer;
begin
  if p_order_id is null
     or p_checkout_request_id is null
     or nullif(trim(p_order_number), '') is null
     or p_order_number !~ '^SP-[A-Za-z0-9-]+$' then
    raise exception 'Invalid store order identity.';
  end if;

  if p_currency is null or lower(p_currency) !~ '^[a-z]{3}$' then
    raise exception 'Invalid store order currency.';
  end if;

  if p_payment_livemode is null
     or p_subtotal_cents is null
     or p_subtotal_cents < 0
     or p_shipping_cents is null
     or p_shipping_cents < 0
     or p_production_cents is null
     or p_production_cents < 0
     or p_total_cents is null
     or p_total_cents <>
       p_subtotal_cents + p_production_cents + p_shipping_cents then
    raise exception 'Invalid store order totals.';
  end if;

  if not coalesce((
       (
         p_production_option_id = 'standard-production'
         and p_production_option_name = 'Standard production'
         and p_production_max_business_days = 5
         and p_production_cents = 0
       )
       or (
         p_production_option_id = 'expedited-production'
         and p_production_option_name = 'Expedited production'
         and p_production_max_business_days = 1
         and p_production_cents = 1000
       )
     ), false) then
    raise exception 'Invalid store order production option.';
  end if;

  if p_fulfillment_method not in ('shipping', 'pickup')
     or p_fulfillment_option_id is null
     or p_fulfillment_option_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or nullif(trim(p_fulfillment_option_name), '') is null
     or length(p_fulfillment_option_name) > 100
     or (
       p_fulfillment_method = 'pickup'
       and (
         p_shipping_cents <> 0
         or nullif(trim(coalesce(p_pickup_location, '')), '') is null
       )
     ) then
    raise exception 'Invalid store order fulfillment details.';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 8 then
    raise exception 'Invalid store order items.';
  end if;

  select count(*), count(distinct item.product_id), count(distinct item.sku)
    into v_item_count, v_product_count, v_sku_count
    from jsonb_to_recordset(p_items) as item(
      product_id text,
      product_category text,
      sku text,
      deck_id text,
      product_name text,
      unit_amount_cents integer,
      quantity integer,
      line_total_cents integer
    );

  if v_item_count <> v_product_count
     or v_item_count <> v_sku_count
     or exists (
       select 1
         from jsonb_to_recordset(p_items) as item(
           product_id text,
           product_category text,
           sku text,
           deck_id text,
           product_name text,
           unit_amount_cents integer,
           quantity integer,
           line_total_cents integer
         )
        where nullif(trim(item.product_id), '') is null
           or length(item.product_id) > 100
           or nullif(trim(item.product_category), '') is null
           or length(item.product_category) > 100
           or item.sku is null
           or item.sku !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$'
           or nullif(trim(item.product_name), '') is null
           or length(item.product_name) > 200
           or item.unit_amount_cents is null
           or item.unit_amount_cents < 0
           or item.quantity is null
           or item.quantity not between 1 and 8
           or item.line_total_cents is null
           or item.line_total_cents <> item.unit_amount_cents * item.quantity
     )
     or (
       select coalesce(sum(item.line_total_cents::bigint), 0)
         from jsonb_to_recordset(p_items) as item(line_total_cents integer)
     ) <> p_subtotal_cents::bigint
     or (
       select coalesce(sum(item.quantity), 0)
         from jsonb_to_recordset(p_items) as item(quantity integer)
     ) > 8 then
    raise exception 'Invalid store order item snapshots.';
  end if;

  select jsonb_agg(
           jsonb_build_object(
             'product_id', item.product_id,
             'product_category', item.product_category,
             'sku', item.sku,
             'deck_id', item.deck_id,
             'product_name', item.product_name,
             'unit_amount_cents', item.unit_amount_cents,
             'quantity', item.quantity,
             'line_total_cents', item.line_total_cents
           )
           order by item.sku, item.product_id
         )
    into v_normalized_items
    from jsonb_to_recordset(p_items) as item(
      product_id text,
      product_category text,
      sku text,
      deck_id text,
      product_name text,
      unit_amount_cents integer,
      quantity integer,
      line_total_cents integer
    );

  v_request_snapshot := jsonb_build_object(
    'currency', lower(p_currency),
    'payment_livemode', p_payment_livemode,
    'subtotal_cents', p_subtotal_cents,
    'production_option_id', p_production_option_id,
    'production_option_name', p_production_option_name,
    'production_max_business_days', p_production_max_business_days,
    'production_cents', p_production_cents,
    'fulfillment_method', p_fulfillment_method,
    'fulfillment_option_id', p_fulfillment_option_id,
    'fulfillment_option_name', p_fulfillment_option_name,
    'pickup_location', p_pickup_location,
    'shipping_cents', p_shipping_cents,
    'total_cents', p_total_cents,
    'items', v_normalized_items
  );

  -- Serialize identical HTTP request IDs before checking the unique index.
  perform pg_advisory_xact_lock(
    hashtextextended(p_checkout_request_id::text, 0)
  );

  select orders.*
    into v_existing
    from public.store_orders as orders
   where orders.checkout_request_id = p_checkout_request_id
   for update;

  if found then
    if v_existing.checkout_request_snapshot is distinct from v_request_snapshot then
      raise exception using
        message = 'store_checkout_request_conflict',
        detail = 'A checkout request ID was replayed with a different cart.';
    end if;

    if v_existing.inventory_state = 'released' then
      raise exception using
        message = 'store_checkout_request_closed',
        detail = 'The prior inventory reservation has already been released.';
    end if;

    return query
      select v_existing.id,
             v_existing.order_number,
             v_existing.inventory_reserved_until,
             v_existing.inventory_state,
             v_existing.production_due_date,
             v_existing.expedited_capacity_state,
             v_existing.checkout_session_id,
             v_existing.checkout_url,
             false;
    return;
  end if;

  if p_inventory_reserved_until is null
     or p_inventory_reserved_until < now() + interval '25 minutes'
     or p_inventory_reserved_until > now() + interval '24 hours' then
    raise exception 'Invalid inventory reservation deadline.';
  end if;

  if p_production_option_id = 'expedited-production' then
    v_local_order_date := (now() at time zone 'America/New_York')::date;
    v_production_due_date := v_local_order_date
      + case extract(isodow from v_local_order_date)::integer
          when 5 then 3
          when 6 then 2
          else 1
        end;
    v_expedited_capacity_state := 'reserved';

    -- A transaction-scoped lock serializes the count-and-insert decision for
    -- one production due date. The checkout-request replay path above runs
    -- first, so a retry never consumes a second slot after midnight.
    perform pg_advisory_xact_lock(
      hashtext('store_expedited_capacity'),
      (v_production_due_date - date '2000-01-01')::integer
    );

    select count(*)::integer
      into v_active_expedited_count
      from public.store_orders as orders
     where orders.production_option_id = 'expedited-production'
       and orders.production_due_date = v_production_due_date
       and orders.expedited_capacity_state in ('reserved', 'committed');

    if v_active_expedited_count >= 10 then
      raise exception using
        message = 'store_expedited_capacity_unavailable',
        detail = format(
          'Expedited production already has 10 active orders due %s.',
          v_production_due_date
        );
    end if;
  end if;

  -- Every transaction locks SKUs in the same order before checking availability.
  -- This prevents both overselling and multi-SKU deadlocks under concurrency.
  for v_item in
    select item.sku, sum(item.quantity)::integer as quantity
      from jsonb_to_recordset(p_items) as item(sku text, quantity integer)
     group by item.sku
     order by item.sku
  loop
    select inventory.*
      into v_inventory
      from public.store_inventory as inventory
     where inventory.sku = v_item.sku
     for update;

    if not found
       or v_inventory.on_hand_quantity - v_inventory.reserved_quantity
          < v_item.quantity then
      raise exception using
        message = 'store_inventory_unavailable',
        detail = format('SKU %s does not have enough available inventory.', v_item.sku);
    end if;
  end loop;

  for v_item in
    select item.sku, sum(item.quantity)::integer as quantity
      from jsonb_to_recordset(p_items) as item(sku text, quantity integer)
     group by item.sku
     order by item.sku
  loop
    update public.store_inventory
       set reserved_quantity = reserved_quantity + v_item.quantity
     where sku = v_item.sku;
  end loop;

  insert into public.store_orders (
    id,
    checkout_request_id,
    checkout_request_snapshot,
    order_number,
    currency,
    payment_livemode,
    subtotal_cents,
    production_option_id,
    production_option_name,
    production_max_business_days,
    production_cents,
    production_due_date,
    expedited_capacity_state,
    fulfillment_method,
    fulfillment_option_id,
    fulfillment_option_name,
    pickup_location,
    shipping_cents,
    tax_cents,
    total_cents,
    payment_status,
    fulfillment_status,
    inventory_state,
    inventory_reserved_until
  ) values (
    p_order_id,
    p_checkout_request_id,
    v_request_snapshot,
    p_order_number,
    lower(p_currency),
    p_payment_livemode,
    p_subtotal_cents,
    p_production_option_id,
    p_production_option_name,
    p_production_max_business_days,
    p_production_cents,
    v_production_due_date,
    v_expedited_capacity_state,
    p_fulfillment_method,
    p_fulfillment_option_id,
    p_fulfillment_option_name,
    nullif(trim(coalesce(p_pickup_location, '')), ''),
    p_shipping_cents,
    0,
    p_total_cents,
    'pending',
    'unfulfilled',
    'reserved',
    p_inventory_reserved_until
  );

  insert into public.store_order_items (
    order_id,
    product_id,
    product_category,
    sku,
    deck_id,
    product_name,
    unit_amount_cents,
    quantity,
    line_total_cents
  )
  select p_order_id,
         item.product_id,
         item.product_category,
         item.sku,
         nullif(trim(coalesce(item.deck_id, '')), ''),
         item.product_name,
         item.unit_amount_cents,
         item.quantity,
         item.line_total_cents
    from jsonb_to_recordset(p_items) as item(
      product_id text,
      product_category text,
      sku text,
      deck_id text,
      product_name text,
      unit_amount_cents integer,
      quantity integer,
      line_total_cents integer
    );

  return query
    select orders.id,
           orders.order_number,
           orders.inventory_reserved_until,
           orders.inventory_state,
           orders.production_due_date,
           orders.expedited_capacity_state,
           orders.checkout_session_id,
           orders.checkout_url,
           true
      from public.store_orders as orders
     where orders.id = p_order_id;
end;
$$;

drop function if exists public.attach_store_checkout_session(uuid, text, text);
create or replace function public.attach_store_checkout_session(
  p_order_id uuid,
  p_checkout_session_id text,
  p_checkout_url text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.store_orders%rowtype;
begin
  if p_order_id is null
     or p_checkout_session_id is null
     or p_checkout_session_id !~ '^cs_[A-Za-z0-9_]+$'
     or p_checkout_url is null
     or p_checkout_url !~ '^https://checkout[.]stripe[.]com/' then
    raise exception 'Invalid Stripe Checkout reference.';
  end if;

  select orders.*
    into v_order
    from public.store_orders as orders
   where orders.id = p_order_id
   for update;

  if v_order.id is null
     or v_order.inventory_state not in ('reserved', 'committed') then
    raise exception 'The order does not have an active or committed inventory reservation.';
  end if;

  if v_order.checkout_session_id is not null
     and v_order.checkout_session_id <> p_checkout_session_id then
    raise exception 'The order already has a different Checkout Session.';
  end if;

  if v_order.checkout_url is not null
     and v_order.checkout_url <> p_checkout_url then
    raise exception 'The order already has a different Checkout URL.';
  end if;

  update public.store_orders
     set checkout_session_id = p_checkout_session_id,
         checkout_url = p_checkout_url
   where id = p_order_id;

  return true;
end;
$$;

drop function if exists public.fail_store_order_checkout_and_release_inventory(
  uuid, text
);
create or replace function public.fail_store_order_checkout_and_release_inventory(
  p_order_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.store_orders%rowtype;
  v_inventory public.store_inventory%rowtype;
  v_item record;
begin
  select orders.*
    into v_order
    from public.store_orders as orders
   where orders.id = p_order_id
   for update;

  if v_order.id is null or v_order.inventory_state = 'released' then
    return false;
  end if;

  if p_reason is null
     or p_reason not in (
       'Checkout session expired',
       'Checkout async payment failed',
       'Stripe-confirmed terminal unpaid',
       'Checkout session creation failed',
       'Stripe session expired after attach failure',
       'Order creation did not complete',
       'Order creation returned an invalid response'
     ) then
    raise exception 'Inventory release requires a verified terminal reason.';
  end if;

  if v_order.inventory_state <> 'reserved'
     or v_order.payment_status <> 'pending' then
    raise exception 'Only a pending reserved order can release inventory.';
  end if;

  if v_order.expedited_capacity_state = 'reserved' then
    perform pg_advisory_xact_lock(
      hashtext('store_expedited_capacity'),
      (v_order.production_due_date - date '2000-01-01')::integer
    );
  end if;

  for v_item in
    select items.sku, sum(items.quantity)::integer as quantity
      from public.store_order_items as items
     where items.order_id = p_order_id
     group by items.sku
     order by items.sku
  loop
    select inventory.*
      into v_inventory
      from public.store_inventory as inventory
     where inventory.sku = v_item.sku
     for update;

    if not found or v_inventory.reserved_quantity < v_item.quantity then
      raise exception 'Reserved inventory is inconsistent for SKU %.', v_item.sku;
    end if;
  end loop;

  for v_item in
    select items.sku, sum(items.quantity)::integer as quantity
      from public.store_order_items as items
     where items.order_id = p_order_id
     group by items.sku
     order by items.sku
  loop
    update public.store_inventory
       set reserved_quantity = reserved_quantity - v_item.quantity
     where sku = v_item.sku;
  end loop;

  update public.store_orders
     set inventory_state = 'released',
         expedited_capacity_state = case
           when expedited_capacity_state = 'reserved' then 'released'
           else expedited_capacity_state
         end,
         inventory_released_at = now(),
         inventory_release_reason = left(
           coalesce(nullif(trim(p_reason), ''), 'Checkout failed.'),
           500
         ),
         payment_status = 'failed',
         internal_notes = left(
           coalesce(nullif(trim(p_reason), ''), 'Checkout failed.'),
           500
         )
   where id = p_order_id;

  return true;
end;
$$;

drop function if exists public.claim_store_order_notification(
  uuid, text, uuid, integer
);
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
  if p_notification_type <> 'merchant_purchase' then
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

drop function if exists public.complete_store_order_notification(
  uuid, text, uuid, text
);
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
  if p_notification_type <> 'merchant_purchase' then
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

drop function if exists public.release_store_order_notification(
  uuid, text, uuid, text
);
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
  if p_notification_type <> 'merchant_purchase' then
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

drop function if exists public.list_pending_store_order_notifications(integer);
create or replace function public.list_pending_store_order_notifications(
  p_limit integer default 25
)
returns table (order_id uuid)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_limit is null or p_limit not between 1 and 50 then
    raise exception 'Notification batch limit must be between 1 and 50.';
  end if;

  return query
  select notifications.order_id
    from public.store_order_notifications as notifications
    join public.store_orders as orders on orders.id = notifications.order_id
   where notifications.notification_type = 'merchant_purchase'
     and notifications.sent_at is null
     and (
       notifications.claimed_until is null
       or notifications.claimed_until <= now()
     )
     and orders.payment_status = 'paid'
   order by notifications.created_at, notifications.id
   limit p_limit;
end;
$$;

drop function if exists public.list_overdue_store_inventory_reservations(integer);
create or replace function public.list_overdue_store_inventory_reservations(
  p_limit integer default 10
)
returns table (order_id uuid)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_limit is null or p_limit not between 1 and 25 then
    raise exception 'Inventory reconciliation batch limit must be between 1 and 25.';
  end if;

  -- Passing the reservation deadline only makes a row eligible for Stripe
  -- verification. This function never releases inventory by the clock alone.
  return query
  select orders.id
    from public.store_orders as orders
   where orders.inventory_state = 'reserved'
     and orders.inventory_reserved_until <= now()
     and (
       orders.inventory_reconciliation_retry_at is null
       or orders.inventory_reconciliation_retry_at <= now()
     )
     and (
       orders.inventory_reconciliation_claimed_until is null
       or orders.inventory_reconciliation_claimed_until <= now()
     )
   order by orders.inventory_reserved_until, orders.id
   limit p_limit;
end;
$$;

drop function if exists public.claim_overdue_store_inventory_reservation(
  uuid, uuid, integer
);
create or replace function public.claim_overdue_store_inventory_reservation(
  p_order_id uuid,
  p_claim_token uuid,
  p_lease_seconds integer default 180
)
returns table (
  claim_status text,
  order_id uuid,
  checkout_session_id text,
  payment_livemode boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.store_orders%rowtype;
begin
  if p_order_id is null or p_claim_token is null then
    raise exception 'An inventory reconciliation order and claim token are required.';
  end if;
  if p_lease_seconds is null or p_lease_seconds not between 60 and 600 then
    raise exception 'Inventory reconciliation lease must be between 60 and 600 seconds.';
  end if;

  select orders.*
    into v_order
    from public.store_orders as orders
   where orders.id = p_order_id
   for update;

  if not found then
    return query select 'missing', p_order_id, null::text, null::boolean;
    return;
  end if;
  if v_order.inventory_state <> 'reserved' then
    return query select 'resolved', v_order.id, null::text, v_order.payment_livemode;
    return;
  end if;
  if v_order.inventory_reserved_until > now() then
    return query select 'not_due', v_order.id, null::text, v_order.payment_livemode;
    return;
  end if;
  if v_order.inventory_reconciliation_retry_at > now() then
    return query select 'retry_later', v_order.id, null::text, v_order.payment_livemode;
    return;
  end if;
  if v_order.inventory_reconciliation_claim_token is not null
     and v_order.inventory_reconciliation_claimed_until > now()
     and v_order.inventory_reconciliation_claim_token <> p_claim_token then
    return query select 'busy', v_order.id, null::text, v_order.payment_livemode;
    return;
  end if;

  update public.store_orders
     set inventory_reconciliation_claim_token = p_claim_token,
         inventory_reconciliation_claimed_until =
           now() + make_interval(secs => p_lease_seconds),
         inventory_reconciliation_attempt_count =
           inventory_reconciliation_attempt_count + 1,
         inventory_reconciliation_last_attempt_at = now(),
         inventory_reconciliation_last_error_code = null
   where id = v_order.id;

  return query
  select 'claimed', v_order.id, v_order.checkout_session_id,
         v_order.payment_livemode;
end;
$$;

drop function if exists public.release_store_inventory_reconciliation_claim(
  uuid, uuid, text, integer
);
create or replace function public.release_store_inventory_reconciliation_claim(
  p_order_id uuid,
  p_claim_token uuid,
  p_failure_code text default 'inventory_reconciliation_failed',
  p_retry_seconds integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_failure_code text := coalesce(
    nullif(left(trim(p_failure_code), 100), ''),
    'inventory_reconciliation_failed'
  );
  v_updated integer;
begin
  if p_retry_seconds is null or p_retry_seconds not between 60 and 3600 then
    raise exception 'Inventory reconciliation retry must be between 60 and 3600 seconds.';
  end if;
  if v_failure_code !~ '^[A-Za-z0-9_-]{1,100}$' then
    v_failure_code := 'inventory_reconciliation_failed';
  end if;

  update public.store_orders
     set inventory_reconciliation_claim_token = null,
         inventory_reconciliation_claimed_until = null,
         inventory_reconciliation_retry_at =
           now() + make_interval(secs => p_retry_seconds),
         inventory_reconciliation_last_error_code = v_failure_code
   where id = p_order_id
     and inventory_state = 'reserved'
     and inventory_reconciliation_claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

drop function if exists public.complete_store_inventory_reconciliation_claim(
  uuid, uuid
);
create or replace function public.complete_store_inventory_reconciliation_claim(
  p_order_id uuid,
  p_claim_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.store_orders%rowtype;
  v_updated integer;
begin
  select orders.*
    into v_order
    from public.store_orders as orders
   where orders.id = p_order_id
   for update;

  if not found
     or v_order.inventory_state not in ('committed', 'released') then
    return false;
  end if;
  -- The payment-event transaction clears the lease atomically with its
  -- terminal inventory transition. A lost HTTP response can therefore retry
  -- completion safely after the token is already gone.
  if v_order.inventory_reconciliation_claim_token is null then
    return true;
  end if;
  if v_order.inventory_reconciliation_claim_token <> p_claim_token then
    return false;
  end if;

  -- Completion is legal only after the payment-event RPC moved the order to a
  -- terminal inventory state. A caller cannot use this RPC to clear a hold.
  update public.store_orders
     set inventory_reconciliation_claim_token = null,
         inventory_reconciliation_claimed_until = null,
         inventory_reconciliation_retry_at = null,
         inventory_reconciliation_last_error_code = null
   where id = p_order_id
     and inventory_state in ('committed', 'released')
     and inventory_reconciliation_claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

drop function if exists public.check_store_inventory_contract();
drop function if exists public.check_store_inventory_contract_v2();
drop function if exists public.check_store_inventory_contract_v3();
drop function if exists public.check_store_inventory_contract_v4();
drop function if exists public.check_store_inventory_contract_v5();
create or replace function public.check_store_inventory_contract_v5()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    to_regclass('public.store_inventory') is not null
    and to_regclass('public.store_order_notifications') is not null
    and to_regclass('public.store_refunds') is not null
    and to_regclass(
      'public.store_orders_expedited_capacity_active_idx'
    ) is not null
    and to_regclass(
      'public.store_order_notifications_order_type_idx'
    ) is not null
    and to_regclass(
      'public.store_orders_overdue_inventory_reconciliation_idx'
    ) is not null
    and to_regclass('public.store_refunds_order_status_idx') is not null
    and not exists (
      select 1
        from unnest(array[
          'provider_refund_id',
          'order_id',
          'payment_intent_id',
          'charge_id',
          'amount_cents',
          'currency',
          'status',
          'pending_reason',
          'failure_reason',
          'payment_livemode',
          'provider_created_at',
          'provider_updated_at',
          'latest_provider_event_id'
        ]) as required(column_name)
       where not exists (
         select 1
           from information_schema.columns as columns
          where columns.table_schema = 'public'
            and columns.table_name = 'store_refunds'
            and columns.column_name = required.column_name
       )
    )
    and not exists (
      select 1
        from unnest(array[
          'order_id',
          'notification_type',
          'attempt_count',
          'claim_token',
          'claimed_until',
          'last_attempt_at',
          'sent_at',
          'provider_message_id',
          'last_error_code'
        ]) as required(column_name)
       where not exists (
         select 1
           from information_schema.columns as columns
          where columns.table_schema = 'public'
            and columns.table_name = 'store_order_notifications'
            and columns.column_name = required.column_name
       )
    )
    and not exists (
      select 1
        from unnest(array[
          'checkout_request_id',
          'checkout_request_snapshot',
          'checkout_url',
          'production_option_id',
          'production_option_name',
          'production_max_business_days',
          'production_cents',
          'production_due_date',
          'expedited_capacity_state',
          'inventory_state',
          'inventory_reserved_until',
          'inventory_committed_at',
           'inventory_released_at',
           'inventory_release_reason',
           'inventory_reconciliation_claim_token',
           'inventory_reconciliation_claimed_until',
           'inventory_reconciliation_attempt_count',
           'inventory_reconciliation_last_attempt_at',
           'inventory_reconciliation_retry_at',
           'inventory_reconciliation_last_error_code',
           'refund_lifecycle_started_at',
           'dispute_id',
           'dispute_status',
           'dispute_updated_at'
        ]) as required(column_name)
       where not exists (
         select 1
           from information_schema.columns as columns
          where columns.table_schema = 'public'
            and columns.table_name = 'store_orders'
            and columns.column_name = required.column_name
       )
    )
    and to_regprocedure(
      'public.reserve_store_order_inventory(uuid,uuid,text,text,boolean,integer,text,text,integer,integer,text,text,text,text,integer,integer,timestamp with time zone,jsonb)'
    ) is not null
    and exists (
      select 1
        from pg_catalog.pg_proc as functions
       where functions.oid = to_regprocedure(
         'public.reserve_store_order_inventory(uuid,uuid,text,text,boolean,integer,text,text,integer,integer,text,text,text,text,integer,integer,timestamp with time zone,jsonb)'
       )
         and functions.proargnames::text[] @> array[
           'production_due_date',
           'expedited_capacity_state'
         ]::text[]
    )
    and to_regprocedure(
      'public.attach_store_checkout_session(uuid,text,text)'
    ) is not null
    and to_regprocedure(
      'public.fail_store_order_checkout_and_release_inventory(uuid,text)'
    ) is not null
    and to_regprocedure(
      'public.claim_store_order_notification(uuid,text,uuid,integer)'
    ) is not null
    and to_regprocedure(
      'public.complete_store_order_notification(uuid,text,uuid,text)'
    ) is not null
    and to_regprocedure(
      'public.release_store_order_notification(uuid,text,uuid,text)'
    ) is not null
    and to_regprocedure(
      'public.list_pending_store_order_notifications(integer)'
    ) is not null
    and to_regprocedure(
      'public.list_overdue_store_inventory_reservations(integer)'
    ) is not null
    and to_regprocedure(
      'public.claim_overdue_store_inventory_reservation(uuid,uuid,integer)'
    ) is not null
    and to_regprocedure(
      'public.release_store_inventory_reconciliation_claim(uuid,uuid,text,integer)'
    ) is not null
    and to_regprocedure(
      'public.complete_store_inventory_reconciliation_claim(uuid,uuid)'
    ) is not null
    and to_regprocedure(
      'public.process_store_payment_event(text,text,timestamp with time zone,uuid,text,text,text,text,text,text,jsonb,text,integer,text,text,integer,integer,integer,integer,integer,text,text,boolean,integer,text,text,text,text,text)'
    ) is not null
    and to_regprocedure(
      'public.process_store_refund_event(text,text,timestamp with time zone,uuid,text,text,text,text,integer,text,timestamp with time zone,text,text,boolean)'
    ) is not null
    and to_regprocedure(
      'public.process_store_dispute_event(text,text,timestamp with time zone,uuid,text,text,integer,text,text,text,boolean)'
    ) is not null;
$$;

create or replace function public.guard_store_order_fulfillment()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.fulfillment_method is distinct from old.fulfillment_method
     or new.fulfillment_option_id is distinct from old.fulfillment_option_id
     or new.fulfillment_option_name is distinct from old.fulfillment_option_name
     or new.pickup_location is distinct from old.pickup_location then
    raise exception 'Order fulfillment method snapshots are immutable.';
  end if;

  if new.production_option_id is distinct from old.production_option_id
     or new.production_option_name is distinct from old.production_option_name
     or new.production_max_business_days is distinct from old.production_max_business_days
     or new.production_cents is distinct from old.production_cents
     or new.production_due_date is distinct from old.production_due_date then
    raise exception 'Order production option snapshots are immutable.';
  end if;

  if new.expedited_capacity_state is distinct from old.expedited_capacity_state
     and not (
       old.expedited_capacity_state = 'reserved'
       and new.expedited_capacity_state in ('committed', 'released')
     ) then
    raise exception 'Expedited capacity state transitions are forward-only.';
  end if;

  if old.stripe_shipping_rate_id is not null
     and new.stripe_shipping_rate_id is distinct from old.stripe_shipping_rate_id then
    raise exception 'The Stripe shipping rate reference is immutable.';
  end if;

  if new.fulfillment_method = 'pickup'
     and (
       nullif(trim(coalesce(new.tracking_number, '')), '') is not null
       or nullif(trim(coalesce(new.tracking_url, '')), '') is not null
     ) then
    raise exception 'Pickup orders cannot have shipping tracking details.';
  end if;

  if new.fulfillment_method = 'pickup'
     and new.fulfillment_status = 'shipped' then
    raise exception 'Pickup orders must be marked picked up, not shipped.';
  end if;

  if new.fulfillment_method = 'shipping'
     and new.fulfillment_status in ('ready_for_pickup', 'picked_up') then
    raise exception 'Shipping orders cannot use pickup fulfillment statuses.';
  end if;

  if new.fulfillment_status is distinct from old.fulfillment_status then
    if old.fulfillment_status in ('shipped', 'picked_up')
       and new.payment_status in (
         'partially_refunded',
         'refunded',
         'disputed',
         'chargeback'
       ) then
      raise exception 'Refund or dispute updates cannot overwrite a completed order.';
    end if;

    if new.payment_status in ('refunded', 'chargeback')
       and new.fulfillment_status <> 'cancelled' then
      raise exception 'Refunded or charged-back orders must remain cancelled before shipment.';
    end if;

    if new.payment_status in ('partially_refunded', 'disputed')
       and new.fulfillment_status not in ('on_hold', 'cancelled') then
      raise exception 'Partially refunded or disputed orders must remain on hold.';
    end if;

    if new.fulfillment_status in (
         'packing',
         'ready_for_pickup',
         'picked_up',
         'shipped'
       )
       and new.payment_status <> 'paid' then
      raise exception 'Only fully paid orders can advance through fulfillment.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_store_order_fulfillment on public.store_orders;
create trigger guard_store_order_fulfillment
before update on public.store_orders
for each row execute function public.guard_store_order_fulfillment();

drop function if exists public.process_store_payment_event(
  text, text, timestamptz, uuid, text, text, text, text, text, jsonb,
  text, integer, integer, integer, integer, text, boolean
);
drop function if exists public.process_store_payment_event(
  text, text, timestamptz, uuid, text, text, text, text, text, text, jsonb,
  text, integer, integer, integer, integer, text, text, boolean
);
drop function if exists public.process_store_payment_event(
  text, text, timestamptz, uuid, text, text, text, text, text, text, jsonb,
  text, integer, integer, integer, integer, integer, text, text, boolean
);
drop function if exists public.process_store_payment_event(
  text, text, timestamptz, uuid, text, text, text, text, text, text, jsonb,
  text, integer, integer, integer, integer, text, text, boolean, integer
);
drop function if exists public.process_store_payment_event(
  text, text, timestamptz, uuid, text, text, text, text, text, text, jsonb,
  text, integer, integer, integer, integer, text, text, boolean, integer,
  text, text, text, text, text
);
drop function if exists public.process_store_payment_event(
  text, text, timestamptz, uuid, text, text, text, text, text, text, jsonb,
  text, integer, text, text, integer, integer, integer, integer, integer,
  text, text, boolean, integer, text, text, text, text, text
);

create or replace function public.process_store_payment_event(
  p_provider_event_id text,
  p_event_type text,
  p_event_created_at timestamptz,
  p_order_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_charge_id text,
  p_payment_status text,
  p_customer_email text,
  p_customer_name text,
  p_shipping_address jsonb,
  p_currency text,
  p_subtotal_cents integer,
  p_production_option_id text,
  p_production_option_name text,
  p_production_max_business_days integer,
  p_production_cents integer,
  p_shipping_cents integer,
  p_tax_cents integer,
  p_total_cents integer,
  p_receipt_url text,
  p_receipt_number text,
  p_payment_livemode boolean,
  p_amount_refunded_cents integer default null,
  p_fulfillment_method text default null,
  p_fulfillment_option_id text default null,
  p_fulfillment_option_name text default null,
  p_pickup_location text default null,
  p_stripe_shipping_rate_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted integer;
  v_match_count integer;
  v_order_id uuid;
  v_order public.store_orders%rowtype;
  v_inventory public.store_inventory%rowtype;
  v_item record;
  v_event_time timestamptz := coalesce(p_event_created_at, now());
begin
  if nullif(trim(coalesce(p_provider_event_id, '')), '') is null then
    raise exception 'A provider event id is required.';
  end if;

  if not coalesce((
    (p_event_type = 'checkout.session.completed'
      and p_payment_status in ('paid', 'pending'))
    or (p_event_type = 'checkout.session.async_payment_succeeded'
      and p_payment_status = 'paid')
    or (p_event_type in (
          'checkout.session.async_payment_failed',
          'checkout.session.expired'
        ) and p_payment_status = 'failed')
    or (p_event_type = 'payment_intent.payment_failed'
      and p_payment_status = 'pending')
    or (p_event_type = 'charge.refunded'
      and p_payment_status in ('partially_refunded', 'refunded'))
    or (p_event_type = 'charge.dispute.created'
      and p_payment_status = 'disputed')
  ), false) then
    raise exception 'Payment event % has an invalid status transition.', p_provider_event_id;
  end if;

  if p_payment_status = 'paid'
     and (
       p_checkout_session_id is null
       or p_checkout_session_id !~ '^cs_[A-Za-z0-9_]+$'
        or p_currency is null
        or p_subtotal_cents is null
        or p_production_option_id is null
        or p_production_option_name is null
        or p_production_max_business_days is null
        or p_production_cents is null
        or p_shipping_cents is null
       or p_tax_cents is null
       or p_total_cents is null
     ) then
    raise exception 'Paid event % is missing required reconciliation fields.', p_provider_event_id;
  end if;

  insert into public.store_payment_events (
    provider_event_id,
    event_type,
    checkout_session_id,
    event_created_at
  ) values (
    p_provider_event_id,
    p_event_type,
    p_checkout_session_id,
    p_event_created_at
  )
  on conflict (provider_event_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    -- A previous request may have committed the paid ledger update and outbox
    -- before its HTTP response was lost. Restore a missing outbox row from the
    -- immutable event-to-order link, then let the webhook retry delivery.
    if p_payment_status = 'paid' then
      insert into public.store_order_notifications (
        order_id,
        notification_type
      )
      select events.order_id, 'merchant_purchase'
        from public.store_payment_events as events
        join public.store_orders as orders on orders.id = events.order_id
       where events.provider_event_id = p_provider_event_id
         and orders.payment_status = 'paid'
         and events.order_id is not null
      on conflict (order_id, notification_type) do nothing;
    end if;
    return false;
  end if;

  select count(*)
    into v_match_count
    from public.store_orders as orders
   where (p_order_id is not null and orders.id = p_order_id)
      or (
        p_checkout_session_id is not null
        and orders.checkout_session_id = p_checkout_session_id
      )
      or (
        p_payment_intent_id is not null
        and orders.payment_intent_id = p_payment_intent_id
      )
      or (
        p_charge_id is not null
        and orders.charge_id = p_charge_id
      );

  if v_match_count > 1 then
    raise exception 'Payment event % matched conflicting store orders.', p_provider_event_id;
  end if;

  select orders.*
    into v_order
    from public.store_orders as orders
   where (p_order_id is not null and orders.id = p_order_id)
      or (
        p_checkout_session_id is not null
        and orders.checkout_session_id = p_checkout_session_id
      )
      or (
        p_payment_intent_id is not null
        and orders.payment_intent_id = p_payment_intent_id
      )
      or (
        p_charge_id is not null
        and orders.charge_id = p_charge_id
      )
   order by
     case when p_order_id is not null and orders.id = p_order_id then 0 else 1 end,
     orders.created_at desc
   limit 1
   for update;

  if v_order.id is null then
    raise exception 'No store order matched payment event %.', p_provider_event_id;
  end if;

  v_order_id := v_order.id;

  if v_order.expedited_capacity_state = 'reserved'
     and p_payment_status in (
       'paid',
       'failed',
       'partially_refunded',
       'refunded',
       'disputed'
     ) then
    perform pg_advisory_xact_lock(
      hashtext('store_expedited_capacity'),
      (v_order.production_due_date - date '2000-01-01')::integer
    );
  end if;

  if p_order_id is not null and p_order_id <> v_order.id then
    raise exception 'Payment event % supplied a conflicting order id.', p_provider_event_id;
  end if;

  if p_checkout_session_id is not null
     and v_order.checkout_session_id is not null
     and p_checkout_session_id <> v_order.checkout_session_id then
    raise exception 'Payment event % supplied a conflicting Checkout Session.', p_provider_event_id;
  end if;

  if p_payment_intent_id is not null
     and v_order.payment_intent_id is not null
     and p_payment_intent_id <> v_order.payment_intent_id then
    raise exception 'Payment event % supplied a conflicting Payment Intent.', p_provider_event_id;
  end if;

  if p_charge_id is not null
     and v_order.charge_id is not null
     and p_charge_id <> v_order.charge_id then
    raise exception 'Payment event % supplied a conflicting Charge.', p_provider_event_id;
  end if;

  if p_stripe_shipping_rate_id is not null
     and v_order.stripe_shipping_rate_id is not null
     and p_stripe_shipping_rate_id <> v_order.stripe_shipping_rate_id then
    raise exception 'Payment event % supplied a conflicting shipping rate.', p_provider_event_id;
  end if;

  if p_payment_livemode is not null
     and v_order.payment_livemode is not null
     and p_payment_livemode <> v_order.payment_livemode then
    raise exception 'Payment event % used the wrong Stripe mode.', p_provider_event_id;
  end if;

  if p_currency is not null
     and lower(p_currency) <> v_order.currency then
    raise exception 'Payment event % used the wrong currency.', p_provider_event_id;
  end if;

  if p_subtotal_cents is not null
     and p_subtotal_cents <> v_order.subtotal_cents then
    raise exception 'Payment event % used the wrong subtotal.', p_provider_event_id;
  end if;

  if p_production_option_id is not null
     and p_production_option_id <> v_order.production_option_id then
    raise exception 'Payment event % used the wrong production option.', p_provider_event_id;
  end if;

  if p_production_option_name is not null
     and p_production_option_name <> v_order.production_option_name then
    raise exception 'Payment event % used the wrong production label.', p_provider_event_id;
  end if;

  if p_production_max_business_days is not null
     and p_production_max_business_days <>
       v_order.production_max_business_days then
    raise exception 'Payment event % used the wrong production window.', p_provider_event_id;
  end if;

  if p_production_cents is not null
     and p_production_cents <> v_order.production_cents then
    raise exception 'Payment event % used the wrong production amount.', p_provider_event_id;
  end if;

  if p_shipping_cents is not null
     and p_shipping_cents <> v_order.shipping_cents then
    raise exception 'Payment event % used the wrong shipping amount.', p_provider_event_id;
  end if;

  if p_fulfillment_method is not null
     and p_fulfillment_method <> v_order.fulfillment_method then
    raise exception 'Payment event % used the wrong fulfillment method.', p_provider_event_id;
  end if;

  if p_fulfillment_option_id is not null
     and p_fulfillment_option_id <> v_order.fulfillment_option_id then
    raise exception 'Payment event % used the wrong fulfillment option.', p_provider_event_id;
  end if;

  if p_fulfillment_option_name is not null
     and p_fulfillment_option_name <> v_order.fulfillment_option_name then
    raise exception 'Payment event % used the wrong fulfillment label.', p_provider_event_id;
  end if;

  if p_pickup_location is not null
     and p_pickup_location <> coalesce(v_order.pickup_location, '') then
    raise exception 'Payment event % used the wrong pickup location.', p_provider_event_id;
  end if;

  if p_fulfillment_method = 'pickup'
     and p_shipping_address is not null
     and p_shipping_address <> '{}'::jsonb then
    raise exception 'Payment event % supplied a shipping address for pickup.', p_provider_event_id;
  end if;

  if p_fulfillment_method = 'pickup'
     and p_stripe_shipping_rate_id is not null then
    raise exception 'Payment event % supplied a shipping rate for pickup.', p_provider_event_id;
  end if;

  if p_subtotal_cents is not null
     and p_production_cents is not null
     and p_shipping_cents is not null
     and p_tax_cents is not null
     and p_total_cents is not null
     and p_total_cents <>
       p_subtotal_cents + p_production_cents + p_shipping_cents + p_tax_cents then
    raise exception 'Payment event % supplied inconsistent total components.', p_provider_event_id;
  end if;

  if p_amount_refunded_cents is not null
     and p_amount_refunded_cents < 0 then
    raise exception 'Payment event % supplied a negative refund amount.', p_provider_event_id;
  end if;

  if p_amount_refunded_cents is not null
     and p_amount_refunded_cents > v_order.total_cents then
    raise exception 'Payment event % supplied a refund larger than the order total.', p_provider_event_id;
  end if;

  if p_payment_status in (
       'paid',
       'partially_refunded',
       'refunded',
       'disputed'
     ) then
    if v_order.inventory_state = 'released' then
      raise exception 'Paid event % arrived after inventory was released.', p_provider_event_id;
    end if;

    if v_order.inventory_state = 'reserved' then
      for v_item in
        select items.sku, sum(items.quantity)::integer as quantity
          from public.store_order_items as items
         where items.order_id = v_order.id
         group by items.sku
         order by items.sku
      loop
        select inventory.*
          into v_inventory
          from public.store_inventory as inventory
         where inventory.sku = v_item.sku
         for update;

        if not found
           or v_inventory.reserved_quantity < v_item.quantity
           or v_inventory.on_hand_quantity < v_item.quantity then
          raise exception 'Reserved inventory is inconsistent for paid SKU %.', v_item.sku;
        end if;
      end loop;

      for v_item in
        select items.sku, sum(items.quantity)::integer as quantity
          from public.store_order_items as items
         where items.order_id = v_order.id
         group by items.sku
         order by items.sku
      loop
        update public.store_inventory
           set on_hand_quantity = on_hand_quantity - v_item.quantity,
               reserved_quantity = reserved_quantity - v_item.quantity
         where sku = v_item.sku;
      end loop;
    end if;
  elsif p_payment_status = 'failed'
        and v_order.inventory_state = 'reserved' then
    for v_item in
      select items.sku, sum(items.quantity)::integer as quantity
        from public.store_order_items as items
       where items.order_id = v_order.id
       group by items.sku
       order by items.sku
    loop
      select inventory.*
        into v_inventory
        from public.store_inventory as inventory
       where inventory.sku = v_item.sku
       for update;

      if not found or v_inventory.reserved_quantity < v_item.quantity then
        raise exception 'Reserved inventory is inconsistent for failed SKU %.', v_item.sku;
      end if;
    end loop;

    for v_item in
      select items.sku, sum(items.quantity)::integer as quantity
        from public.store_order_items as items
       where items.order_id = v_order.id
       group by items.sku
       order by items.sku
    loop
      update public.store_inventory
         set reserved_quantity = reserved_quantity - v_item.quantity
       where sku = v_item.sku;
    end loop;
  end if;

  update public.store_orders
     set checkout_session_id = coalesce(
           nullif(p_checkout_session_id, ''),
           checkout_session_id
         ),
         payment_intent_id = coalesce(
           nullif(p_payment_intent_id, ''),
           payment_intent_id
         ),
         charge_id = coalesce(nullif(p_charge_id, ''), charge_id),
         stripe_shipping_rate_id = coalesce(
           nullif(p_stripe_shipping_rate_id, ''),
           stripe_shipping_rate_id
         ),
         payment_livemode = coalesce(payment_livemode, p_payment_livemode),
         customer_email = coalesce(nullif(p_customer_email, ''), customer_email),
         customer_name = coalesce(nullif(p_customer_name, ''), customer_name),
         shipping_address = case
           when p_shipping_address is not null and p_shipping_address <> '{}'::jsonb
             then p_shipping_address
           else shipping_address
         end,
         currency = coalesce(nullif(lower(p_currency), ''), currency),
         subtotal_cents = coalesce(p_subtotal_cents, subtotal_cents),
         shipping_cents = coalesce(p_shipping_cents, shipping_cents),
         tax_cents = coalesce(p_tax_cents, tax_cents),
         total_cents = coalesce(p_total_cents, total_cents),
         amount_refunded_cents = case
           when p_amount_refunded_cents is null then amount_refunded_cents
           else greatest(amount_refunded_cents, p_amount_refunded_cents)
         end,
         inventory_state = case
           when p_payment_status in (
             'paid',
             'partially_refunded',
             'refunded',
             'disputed'
           )
             and inventory_state in ('reserved', 'committed') then 'committed'
           when p_payment_status = 'failed'
             and inventory_state = 'reserved' then 'released'
           else inventory_state
         end,
         expedited_capacity_state = case
           when p_payment_status in (
             'paid',
             'partially_refunded',
             'refunded',
             'disputed'
           )
             and expedited_capacity_state = 'reserved' then 'committed'
           when p_payment_status = 'failed'
             and expedited_capacity_state = 'reserved' then 'released'
           else expedited_capacity_state
         end,
         inventory_committed_at = case
           when p_payment_status in (
             'paid',
             'partially_refunded',
             'refunded',
             'disputed'
           )
             and inventory_state = 'reserved'
             then coalesce(inventory_committed_at, v_event_time)
           else inventory_committed_at
         end,
         inventory_released_at = case
           when p_payment_status = 'failed'
             and inventory_state = 'reserved'
             then coalesce(inventory_released_at, v_event_time)
           else inventory_released_at
         end,
          inventory_release_reason = case
           when p_payment_status = 'failed'
             and inventory_state = 'reserved'
             then left('Stripe event: ' || p_event_type, 500)
            else inventory_release_reason
          end,
          inventory_reconciliation_claim_token = case
            when p_payment_status in (
              'paid',
              'failed',
              'partially_refunded',
              'refunded',
              'disputed'
            ) then null
            else inventory_reconciliation_claim_token
          end,
          inventory_reconciliation_claimed_until = case
            when p_payment_status in (
              'paid',
              'failed',
              'partially_refunded',
              'refunded',
              'disputed'
            ) then null
            else inventory_reconciliation_claimed_until
          end,
          inventory_reconciliation_retry_at = case
            when p_payment_status in (
              'paid',
              'failed',
              'partially_refunded',
              'refunded',
              'disputed'
            ) then null
            else inventory_reconciliation_retry_at
          end,
          inventory_reconciliation_last_error_code = case
            when p_payment_status in (
              'paid',
              'failed',
              'partially_refunded',
              'refunded',
              'disputed'
            ) then null
            else inventory_reconciliation_last_error_code
          end,
          payment_status = case
           when p_payment_status = 'paid'
             and payment_status in ('pending', 'failed') then 'paid'
           when p_payment_status = 'partially_refunded'
             and payment_status not in ('refunded', 'disputed')
             then 'partially_refunded'
           when p_payment_status = 'refunded' then 'refunded'
           when p_payment_status = 'disputed'
             and payment_status <> 'refunded' then 'disputed'
           when p_payment_status = 'failed' and payment_status = 'pending' then 'failed'
           else payment_status
         end,
         fulfillment_status = case
           when fulfillment_status in ('shipped', 'picked_up')
             then fulfillment_status
           when p_payment_status = 'refunded'
             and fulfillment_status in (
               'unfulfilled',
               'packing',
               'ready_for_pickup',
               'on_hold'
             )
             then 'cancelled'
           when p_payment_status in ('partially_refunded', 'disputed')
             and fulfillment_status in (
               'unfulfilled',
               'packing',
               'ready_for_pickup'
             )
             then 'on_hold'
           else fulfillment_status
         end,
         receipt_url = coalesce(nullif(p_receipt_url, ''), receipt_url),
         receipt_number = coalesce(
           nullif(p_receipt_number, ''),
           receipt_number
         ),
         paid_at = case
           when p_payment_status = 'paid' then coalesce(paid_at, v_event_time)
           else paid_at
         end,
         refunded_at = case
           when p_payment_status in ('partially_refunded', 'refunded')
             then coalesce(refunded_at, v_event_time)
           else refunded_at
         end
   where id = v_order_id;

  if p_payment_status = 'paid' then
    -- Enqueue atomically with the paid order transition. The unique key makes
    -- Checkout's completed/async-success overlap and webhook retries harmless.
    insert into public.store_order_notifications (
      order_id,
      notification_type
    )
    select orders.id, 'merchant_purchase'
      from public.store_orders as orders
     where orders.id = v_order_id
       and orders.payment_status = 'paid'
    on conflict (order_id, notification_type) do nothing;
  end if;

  update public.store_payment_events
     set order_id = v_order_id,
         checkout_session_id = coalesce(
           nullif(p_checkout_session_id, ''),
           checkout_session_id
         ),
         processed_at = now()
   where provider_event_id = p_provider_event_id;

  return true;
end;
$$;

drop function if exists public.process_store_refund_event(
  text, text, timestamptz, uuid, text, text, text, text, integer, text,
  timestamptz, text, text, boolean
);
create or replace function public.process_store_refund_event(
  p_provider_event_id text,
  p_event_type text,
  p_event_created_at timestamptz,
  p_order_id uuid,
  p_refund_id text,
  p_refund_status text,
  p_refund_pending_reason text,
  p_refund_failure_reason text,
  p_amount_cents integer,
  p_currency text,
  p_refund_created_at timestamptz,
  p_payment_intent_id text,
  p_charge_id text,
  p_payment_livemode boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted integer;
  v_match_count integer;
  v_order public.store_orders%rowtype;
  v_existing_refund public.store_refunds%rowtype;
  v_inventory public.store_inventory%rowtype;
  v_item record;
  v_event_time timestamptz := coalesce(p_event_created_at, now());
  v_previous_status text;
  v_should_update boolean := true;
  v_refund_delta integer := 0;
  v_refunded_total integer;
  v_has_refund_attention boolean;
begin
  if nullif(trim(coalesce(p_provider_event_id, '')), '') is null then
    raise exception 'A provider event id is required.';
  end if;

  if not coalesce((
    (p_event_type in ('refund.created', 'refund.updated')
      and p_refund_status in (
        'pending',
        'requires_action',
        'succeeded',
        'failed',
        'canceled'
      ))
    or (p_event_type = 'refund.failed' and p_refund_status = 'failed')
  ), false) then
    raise exception 'Refund event % has an invalid lifecycle status.',
      p_provider_event_id;
  end if;

  if p_refund_id is null or p_refund_id !~ '^re_[A-Za-z0-9_]+$' then
    raise exception 'Refund event % is missing a valid refund id.',
      p_provider_event_id;
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Refund event % is missing a positive amount.',
      p_provider_event_id;
  end if;

  if p_currency is null or lower(p_currency) !~ '^[a-z]{3}$' then
    raise exception 'Refund event % is missing a valid currency.',
      p_provider_event_id;
  end if;

  if p_payment_intent_id is null and p_charge_id is null then
    raise exception 'Refund event % has no payment reference.',
      p_provider_event_id;
  end if;

  if p_refund_pending_reason is not null
     and (
       p_refund_status <> 'pending'
       or p_refund_pending_reason !~ '^[a-z0-9_]{1,100}$'
     ) then
    raise exception 'Refund event % supplied an invalid pending reason.',
      p_provider_event_id;
  end if;

  if p_refund_failure_reason is not null
     and (
       p_refund_status <> 'failed'
       or p_refund_failure_reason !~ '^[a-z0-9_]{1,100}$'
     ) then
    raise exception 'Refund event % supplied an invalid failure reason.',
      p_provider_event_id;
  end if;

  insert into public.store_payment_events (
    provider_event_id,
    event_type,
    event_created_at
  ) values (
    p_provider_event_id,
    p_event_type,
    p_event_created_at
  )
  on conflict (provider_event_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false;
  end if;

  select count(distinct orders.id)
    into v_match_count
    from public.store_orders as orders
   where (p_order_id is not null and orders.id = p_order_id)
      or (
        p_payment_intent_id is not null
        and orders.payment_intent_id = p_payment_intent_id
      )
      or (p_charge_id is not null and orders.charge_id = p_charge_id);

  if v_match_count > 1 then
    raise exception 'Refund event % matched conflicting store orders.',
      p_provider_event_id;
  end if;

  select orders.*
    into v_order
    from public.store_orders as orders
   where (p_order_id is not null and orders.id = p_order_id)
      or (
        p_payment_intent_id is not null
        and orders.payment_intent_id = p_payment_intent_id
      )
      or (p_charge_id is not null and orders.charge_id = p_charge_id)
   order by
     case when p_order_id is not null and orders.id = p_order_id then 0 else 1 end,
     orders.created_at desc
   limit 1
   for update;

  if v_order.id is null then
    raise exception 'No store order matched refund event %.',
      p_provider_event_id;
  end if;

  if p_order_id is not null and p_order_id <> v_order.id then
    raise exception 'Refund event % supplied a conflicting order id.',
      p_provider_event_id;
  end if;

  if p_payment_intent_id is not null
     and v_order.payment_intent_id is not null
     and p_payment_intent_id <> v_order.payment_intent_id then
    raise exception 'Refund event % supplied a conflicting Payment Intent.',
      p_provider_event_id;
  end if;

  if p_charge_id is not null
     and v_order.charge_id is not null
     and p_charge_id <> v_order.charge_id then
    raise exception 'Refund event % supplied a conflicting Charge.',
      p_provider_event_id;
  end if;

  if p_payment_livemode is null
     or (
       v_order.payment_livemode is not null
       and p_payment_livemode <> v_order.payment_livemode
     ) then
    raise exception 'Refund event % used the wrong Stripe mode.',
      p_provider_event_id;
  end if;

  if lower(p_currency) <> v_order.currency then
    raise exception 'Refund event % used the wrong currency.',
      p_provider_event_id;
  end if;

  if p_amount_cents > v_order.total_cents then
    raise exception 'Refund event % supplied an amount larger than the order total.',
      p_provider_event_id;
  end if;

  select refunds.*
    into v_existing_refund
    from public.store_refunds as refunds
   where refunds.provider_refund_id = p_refund_id
   for update;

  if found then
    if v_existing_refund.order_id <> v_order.id
       or v_existing_refund.amount_cents <> p_amount_cents
       or v_existing_refund.currency <> lower(p_currency)
       or v_existing_refund.payment_livemode <> p_payment_livemode
       or (
         p_payment_intent_id is not null
         and v_existing_refund.payment_intent_id is not null
         and p_payment_intent_id <> v_existing_refund.payment_intent_id
       )
       or (
         p_charge_id is not null
         and v_existing_refund.charge_id is not null
         and p_charge_id <> v_existing_refund.charge_id
       ) then
      raise exception 'Refund event % conflicts with its saved refund.',
        p_provider_event_id;
    end if;

    v_previous_status := v_existing_refund.status;
    v_should_update := v_event_time > v_existing_refund.provider_updated_at;

    if v_event_time = v_existing_refund.provider_updated_at then
      v_should_update := case p_refund_status
        when 'failed' then 5
        when 'canceled' then 4
        when 'succeeded' then 3
        when 'requires_action' then 2
        else 1
      end >= case v_existing_refund.status
        when 'failed' then 5
        when 'canceled' then 4
        when 'succeeded' then 3
        when 'requires_action' then 2
        else 1
      end;
    end if;
  else
    v_previous_status := null;
  end if;

  if v_should_update then
    insert into public.store_refunds (
      provider_refund_id,
      order_id,
      payment_intent_id,
      charge_id,
      amount_cents,
      currency,
      status,
      pending_reason,
      failure_reason,
      payment_livemode,
      provider_created_at,
      provider_updated_at,
      latest_provider_event_id
    ) values (
      p_refund_id,
      v_order.id,
      p_payment_intent_id,
      p_charge_id,
      p_amount_cents,
      lower(p_currency),
      p_refund_status,
      p_refund_pending_reason,
      p_refund_failure_reason,
      p_payment_livemode,
      p_refund_created_at,
      v_event_time,
      p_provider_event_id
    )
    on conflict (provider_refund_id) do update
      set payment_intent_id = coalesce(
            excluded.payment_intent_id,
            store_refunds.payment_intent_id
          ),
          charge_id = coalesce(excluded.charge_id, store_refunds.charge_id),
          status = excluded.status,
          pending_reason = excluded.pending_reason,
          failure_reason = excluded.failure_reason,
          provider_created_at = coalesce(
            store_refunds.provider_created_at,
            excluded.provider_created_at
          ),
          provider_updated_at = excluded.provider_updated_at,
          latest_provider_event_id = excluded.latest_provider_event_id;

    if v_previous_status is null
       and p_refund_created_at is not null
       and p_refund_created_at < v_order.refund_lifecycle_started_at
       and v_order.amount_refunded_cents >= p_amount_cents then
      -- Before the Refund-object cutover, charge.refunded snapshots could
      -- already have counted this amount. Do not double count a historical
      -- success, and undo the legacy optimistic amount as soon as Stripe says
      -- that historical refund is not actually succeeded.
      if p_refund_status <> 'succeeded' then
        v_refund_delta := -p_amount_cents;
      end if;
    elsif v_previous_status = 'succeeded'
       and p_refund_status <> 'succeeded' then
      v_refund_delta := -p_amount_cents;
    elsif coalesce(v_previous_status, '') <> 'succeeded'
          and p_refund_status = 'succeeded' then
      v_refund_delta := p_amount_cents;
    end if;
  end if;

  v_refunded_total := v_order.amount_refunded_cents + v_refund_delta;
  if v_refunded_total < 0 or v_refunded_total > v_order.total_cents then
    raise exception 'Refund event % produced an invalid refunded total.',
      p_provider_event_id;
  end if;

  if v_order.inventory_state = 'released' then
    raise exception 'Refund event % arrived after inventory was released.',
      p_provider_event_id;
  end if;

  if v_order.inventory_state = 'reserved' then
    for v_item in
      select items.sku, sum(items.quantity)::integer as quantity
        from public.store_order_items as items
       where items.order_id = v_order.id
       group by items.sku
       order by items.sku
    loop
      select inventory.*
        into v_inventory
        from public.store_inventory as inventory
       where inventory.sku = v_item.sku
       for update;

      if not found
         or v_inventory.reserved_quantity < v_item.quantity
         or v_inventory.on_hand_quantity < v_item.quantity then
        raise exception 'Reserved inventory is inconsistent for refund SKU %.',
          v_item.sku;
      end if;
    end loop;

    for v_item in
      select items.sku, sum(items.quantity)::integer as quantity
        from public.store_order_items as items
       where items.order_id = v_order.id
       group by items.sku
       order by items.sku
    loop
      update public.store_inventory
         set on_hand_quantity = on_hand_quantity - v_item.quantity,
             reserved_quantity = reserved_quantity - v_item.quantity
       where sku = v_item.sku;
    end loop;
  end if;

  select exists (
    select 1
      from public.store_refunds as refunds
     where refunds.order_id = v_order.id
       and refunds.status in (
         'pending',
         'requires_action',
         'failed',
         'canceled'
       )
  ) into v_has_refund_attention;

  update public.store_orders
     set payment_intent_id = coalesce(
           payment_intent_id,
           nullif(p_payment_intent_id, '')
         ),
         charge_id = coalesce(charge_id, nullif(p_charge_id, '')),
         payment_livemode = coalesce(payment_livemode, p_payment_livemode),
         amount_refunded_cents = v_refunded_total,
         payment_status = case
           when payment_status in ('disputed', 'chargeback') then payment_status
           when v_refunded_total = total_cents and total_cents > 0
             then 'refunded'
           when v_refunded_total > 0 then 'partially_refunded'
           else 'paid'
         end,
         fulfillment_status = case
           when fulfillment_status in ('shipped', 'picked_up')
             then fulfillment_status
           when payment_status = 'chargeback' then 'cancelled'
           when payment_status = 'disputed' then 'on_hold'
           when v_refunded_total = total_cents and total_cents > 0
             then 'cancelled'
           when v_refunded_total > 0 or v_has_refund_attention
             then 'on_hold'
           else fulfillment_status
         end,
         inventory_state = case
           when inventory_state = 'reserved' then 'committed'
           else inventory_state
         end,
         expedited_capacity_state = case
           when expedited_capacity_state = 'reserved' then 'committed'
           else expedited_capacity_state
         end,
         inventory_committed_at = case
           when inventory_state = 'reserved'
             then coalesce(inventory_committed_at, v_event_time)
           else inventory_committed_at
         end,
         inventory_reconciliation_claim_token = null,
         inventory_reconciliation_claimed_until = null,
         inventory_reconciliation_retry_at = null,
         inventory_reconciliation_last_error_code = null,
         paid_at = coalesce(paid_at, v_event_time),
         refunded_at = case
           when v_refunded_total > 0 then coalesce(refunded_at, v_event_time)
           else null
         end
   where id = v_order.id;

  update public.store_payment_events
     set order_id = v_order.id,
         processed_at = now()
   where provider_event_id = p_provider_event_id;

  return true;
end;
$$;

drop function if exists public.process_store_dispute_event(
  text, text, timestamptz, uuid, text, text, integer, text, text, text, boolean
);
create or replace function public.process_store_dispute_event(
  p_provider_event_id text,
  p_event_type text,
  p_event_created_at timestamptz,
  p_order_id uuid,
  p_dispute_id text,
  p_dispute_status text,
  p_amount_cents integer,
  p_currency text,
  p_payment_intent_id text,
  p_charge_id text,
  p_payment_livemode boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted integer;
  v_match_count integer;
  v_order public.store_orders%rowtype;
  v_inventory public.store_inventory%rowtype;
  v_item record;
  v_event_time timestamptz := coalesce(p_event_created_at, now());
  v_should_update boolean := true;
begin
  if nullif(trim(coalesce(p_provider_event_id, '')), '') is null then
    raise exception 'A provider event id is required.';
  end if;

  if not coalesce((
    (p_event_type = 'charge.dispute.created'
      and p_dispute_status in (
        'warning_needs_response',
        'warning_under_review',
        'warning_closed',
        'needs_response',
        'under_review',
        'won',
        'lost',
        'prevented'
      ))
    or (p_event_type = 'charge.dispute.closed'
      and p_dispute_status in ('warning_closed', 'won', 'lost', 'prevented'))
  ), false) then
    raise exception 'Dispute event % has an invalid lifecycle status.',
      p_provider_event_id;
  end if;

  if p_dispute_id is null or p_dispute_id !~ '^dp_[A-Za-z0-9_]+$' then
    raise exception 'Dispute event % is missing a valid dispute id.',
      p_provider_event_id;
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Dispute event % is missing a positive amount.',
      p_provider_event_id;
  end if;

  if p_currency is null or lower(p_currency) !~ '^[a-z]{3}$' then
    raise exception 'Dispute event % is missing a valid currency.',
      p_provider_event_id;
  end if;

  if p_payment_intent_id is null and p_charge_id is null then
    raise exception 'Dispute event % has no payment reference.',
      p_provider_event_id;
  end if;

  insert into public.store_payment_events (
    provider_event_id,
    event_type,
    event_created_at
  ) values (
    p_provider_event_id,
    p_event_type,
    p_event_created_at
  )
  on conflict (provider_event_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false;
  end if;

  select count(distinct orders.id)
    into v_match_count
    from public.store_orders as orders
   where (p_order_id is not null and orders.id = p_order_id)
      or (
        p_payment_intent_id is not null
        and orders.payment_intent_id = p_payment_intent_id
      )
      or (p_charge_id is not null and orders.charge_id = p_charge_id);

  if v_match_count > 1 then
    raise exception 'Dispute event % matched conflicting store orders.',
      p_provider_event_id;
  end if;

  select orders.*
    into v_order
    from public.store_orders as orders
   where (p_order_id is not null and orders.id = p_order_id)
      or (
        p_payment_intent_id is not null
        and orders.payment_intent_id = p_payment_intent_id
      )
      or (p_charge_id is not null and orders.charge_id = p_charge_id)
   order by
     case when p_order_id is not null and orders.id = p_order_id then 0 else 1 end,
     orders.created_at desc
   limit 1
   for update;

  if v_order.id is null then
    raise exception 'No store order matched dispute event %.',
      p_provider_event_id;
  end if;

  if p_order_id is not null and p_order_id <> v_order.id then
    raise exception 'Dispute event % supplied a conflicting order id.',
      p_provider_event_id;
  end if;

  if v_order.dispute_id is not null and v_order.dispute_id <> p_dispute_id then
    raise exception 'Dispute event % conflicts with the saved dispute.',
      p_provider_event_id;
  end if;

  if p_payment_intent_id is not null
     and v_order.payment_intent_id is not null
     and p_payment_intent_id <> v_order.payment_intent_id then
    raise exception 'Dispute event % supplied a conflicting Payment Intent.',
      p_provider_event_id;
  end if;

  if p_charge_id is not null
     and v_order.charge_id is not null
     and p_charge_id <> v_order.charge_id then
    raise exception 'Dispute event % supplied a conflicting Charge.',
      p_provider_event_id;
  end if;

  if p_payment_livemode is null
     or (
       v_order.payment_livemode is not null
       and p_payment_livemode <> v_order.payment_livemode
     ) then
    raise exception 'Dispute event % used the wrong Stripe mode.',
      p_provider_event_id;
  end if;

  if lower(p_currency) <> v_order.currency
     or p_amount_cents > v_order.total_cents then
    raise exception 'Dispute event % conflicts with the order amount.',
      p_provider_event_id;
  end if;

  if v_order.dispute_updated_at is not null then
    v_should_update := v_event_time > v_order.dispute_updated_at;
    if v_event_time = v_order.dispute_updated_at then
      v_should_update := case p_dispute_status
        when 'won' then 8
        when 'lost' then 7
        when 'prevented' then 6
        when 'warning_closed' then 5
        when 'under_review' then 4
        when 'warning_under_review' then 3
        when 'needs_response' then 2
        else 1
      end >= case v_order.dispute_status
        when 'won' then 8
        when 'lost' then 7
        when 'prevented' then 6
        when 'warning_closed' then 5
        when 'under_review' then 4
        when 'warning_under_review' then 3
        when 'needs_response' then 2
        else 1
      end;
    end if;
  end if;

  if not v_should_update then
    update public.store_payment_events
       set order_id = v_order.id,
           processed_at = now()
     where provider_event_id = p_provider_event_id;
    return true;
  end if;

  if v_order.inventory_state = 'released' then
    raise exception 'Dispute event % arrived after inventory was released.',
      p_provider_event_id;
  end if;

  if v_order.inventory_state = 'reserved' then
    for v_item in
      select items.sku, sum(items.quantity)::integer as quantity
        from public.store_order_items as items
       where items.order_id = v_order.id
       group by items.sku
       order by items.sku
    loop
      select inventory.*
        into v_inventory
        from public.store_inventory as inventory
       where inventory.sku = v_item.sku
       for update;

      if not found
         or v_inventory.reserved_quantity < v_item.quantity
         or v_inventory.on_hand_quantity < v_item.quantity then
        raise exception 'Reserved inventory is inconsistent for dispute SKU %.',
          v_item.sku;
      end if;
    end loop;

    for v_item in
      select items.sku, sum(items.quantity)::integer as quantity
        from public.store_order_items as items
       where items.order_id = v_order.id
       group by items.sku
       order by items.sku
    loop
      update public.store_inventory
         set on_hand_quantity = on_hand_quantity - v_item.quantity,
             reserved_quantity = reserved_quantity - v_item.quantity
       where sku = v_item.sku;
    end loop;
  end if;

  update public.store_orders
     set payment_intent_id = coalesce(
           payment_intent_id,
           nullif(p_payment_intent_id, '')
         ),
         charge_id = coalesce(charge_id, nullif(p_charge_id, '')),
         payment_livemode = coalesce(payment_livemode, p_payment_livemode),
         dispute_id = p_dispute_id,
         dispute_status = p_dispute_status,
         dispute_updated_at = v_event_time,
         payment_status = case
           when p_dispute_status in (
             'warning_needs_response',
             'warning_under_review',
             'needs_response',
             'under_review'
           ) then 'disputed'
           when p_dispute_status = 'lost' then 'chargeback'
           when amount_refunded_cents = total_cents and total_cents > 0
             then 'refunded'
           when amount_refunded_cents > 0 then 'partially_refunded'
           else 'paid'
         end,
         fulfillment_status = case
           when fulfillment_status in ('shipped', 'picked_up')
             then fulfillment_status
           when p_dispute_status = 'lost'
             or (amount_refunded_cents = total_cents and total_cents > 0)
             then 'cancelled'
           else 'on_hold'
         end,
         inventory_state = case
           when inventory_state = 'reserved' then 'committed'
           else inventory_state
         end,
         expedited_capacity_state = case
           when expedited_capacity_state = 'reserved' then 'committed'
           else expedited_capacity_state
         end,
         inventory_committed_at = case
           when inventory_state = 'reserved'
             then coalesce(inventory_committed_at, v_event_time)
           else inventory_committed_at
         end,
         inventory_reconciliation_claim_token = null,
         inventory_reconciliation_claimed_until = null,
         inventory_reconciliation_retry_at = null,
         inventory_reconciliation_last_error_code = null,
         paid_at = coalesce(paid_at, v_event_time)
   where id = v_order.id;

  update public.store_payment_events
     set order_id = v_order.id,
         processed_at = now()
   where provider_event_id = p_provider_event_id;

  return true;
end;
$$;

alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;
alter table public.store_payment_events enable row level security;
alter table public.store_refunds enable row level security;
alter table public.store_inventory enable row level security;
alter table public.store_order_notifications enable row level security;

drop policy if exists "Store orders are private" on public.store_orders;
drop policy if exists "Store order items are private" on public.store_order_items;
drop policy if exists "Store payment events are private" on public.store_payment_events;
drop policy if exists "Store refunds are private" on public.store_refunds;
drop policy if exists "Store inventory is private" on public.store_inventory;
drop policy if exists "Store order notifications are private"
  on public.store_order_notifications;

create policy "Store orders are private"
  on public.store_orders for all using (false) with check (false);
create policy "Store order items are private"
  on public.store_order_items for all using (false) with check (false);
create policy "Store payment events are private"
  on public.store_payment_events for all using (false) with check (false);
create policy "Store refunds are private"
  on public.store_refunds for all using (false) with check (false);
create policy "Store inventory is private"
  on public.store_inventory for all using (false) with check (false);
create policy "Store order notifications are private"
  on public.store_order_notifications for all using (false) with check (false);

revoke all on public.store_orders from public, anon, authenticated;
revoke all on public.store_order_items from public, anon, authenticated;
revoke all on public.store_payment_events from public, anon, authenticated;
revoke all on public.store_refunds from public, anon, authenticated;
revoke all on public.store_inventory from public, anon, authenticated;
revoke all on public.store_order_notifications from public, anon, authenticated;
revoke all on function public.reserve_store_order_inventory(
  uuid, uuid, text, text, boolean, integer, text, text, integer, integer,
  text, text, text, text, integer, integer, timestamptz, jsonb
) from public, anon, authenticated;
revoke all on function public.attach_store_checkout_session(
  uuid, text, text
) from public, anon, authenticated;
revoke all on function public.fail_store_order_checkout_and_release_inventory(
  uuid, text
) from public, anon, authenticated;
revoke all on function public.check_store_inventory_contract_v5()
  from public, anon, authenticated;
revoke all on function public.claim_store_order_notification(
  uuid, text, uuid, integer
) from public, anon, authenticated;
revoke all on function public.complete_store_order_notification(
  uuid, text, uuid, text
) from public, anon, authenticated;
revoke all on function public.release_store_order_notification(
  uuid, text, uuid, text
) from public, anon, authenticated;
revoke all on function public.list_pending_store_order_notifications(integer)
  from public, anon, authenticated;
revoke all on function public.list_overdue_store_inventory_reservations(integer)
  from public, anon, authenticated;
revoke all on function public.claim_overdue_store_inventory_reservation(
  uuid, uuid, integer
) from public, anon, authenticated;
revoke all on function public.release_store_inventory_reconciliation_claim(
  uuid, uuid, text, integer
) from public, anon, authenticated;
revoke all on function public.complete_store_inventory_reconciliation_claim(
  uuid, uuid
) from public, anon, authenticated;
revoke all on function public.process_store_payment_event(
  text, text, timestamptz, uuid, text, text, text, text, text, text, jsonb,
  text, integer, text, text, integer, integer, integer, integer, integer,
  text, text, boolean, integer, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.process_store_refund_event(
  text, text, timestamptz, uuid, text, text, text, text, integer, text,
  timestamptz, text, text, boolean
) from public, anon, authenticated;
revoke all on function public.process_store_dispute_event(
  text, text, timestamptz, uuid, text, text, integer, text, text, text, boolean
) from public, anon, authenticated;

revoke all on public.store_orders from service_role;
revoke all on public.store_order_items from service_role;
revoke all on public.store_payment_events from service_role;
revoke all on public.store_refunds from service_role;
revoke all on public.store_inventory from service_role;
revoke all on public.store_order_notifications from service_role;
grant select on public.store_orders to service_role;
grant update (
  fulfillment_status,
  tracking_number,
  tracking_url,
  internal_notes,
  shipped_at
) on public.store_orders to service_role;
grant select on public.store_order_items to service_role;
grant select on public.store_inventory to service_role;
grant select on public.store_refunds to service_role;
grant execute on function public.reserve_store_order_inventory(
  uuid, uuid, text, text, boolean, integer, text, text, integer, integer,
  text, text, text, text, integer, integer, timestamptz, jsonb
) to service_role;
grant execute on function public.attach_store_checkout_session(
  uuid, text, text
) to service_role;
grant execute on function public.fail_store_order_checkout_and_release_inventory(
  uuid, text
) to service_role;
grant execute on function public.check_store_inventory_contract_v5()
  to service_role;
grant execute on function public.claim_store_order_notification(
  uuid, text, uuid, integer
) to service_role;
grant execute on function public.complete_store_order_notification(
  uuid, text, uuid, text
) to service_role;
grant execute on function public.release_store_order_notification(
  uuid, text, uuid, text
) to service_role;
grant execute on function public.list_pending_store_order_notifications(integer)
  to service_role;
grant execute on function public.list_overdue_store_inventory_reservations(integer)
  to service_role;
grant execute on function public.claim_overdue_store_inventory_reservation(
  uuid, uuid, integer
) to service_role;
grant execute on function public.release_store_inventory_reconciliation_claim(
  uuid, uuid, text, integer
) to service_role;
grant execute on function public.complete_store_inventory_reconciliation_claim(
  uuid, uuid
) to service_role;
grant execute on function public.process_store_payment_event(
  text, text, timestamptz, uuid, text, text, text, text, text, text, jsonb,
  text, integer, text, text, integer, integer, integer, integer, integer,
  text, text, boolean, integer, text, text, text, text, text
) to service_role;
grant execute on function public.process_store_refund_event(
  text, text, timestamptz, uuid, text, text, text, text, integer, text,
  timestamptz, text, text, boolean
) to service_role;
grant execute on function public.process_store_dispute_event(
  text, text, timestamptz, uuid, text, text, integer, text, text, text, boolean
) to service_role;

comment on table public.store_orders is
  'Private SeaPals order ledger. Payment state is updated only by signed provider webhooks.';
comment on table public.store_order_items is
  'Immutable product and price snapshots retained with each order.';
comment on table public.store_payment_events is
  'Idempotency log for payment-provider webhook events.';
comment on table public.store_refunds is
  'Private Stripe Refund lifecycle ledger. Only succeeded rows contribute to the order refunded amount; pending and failed attempts remain visible without restocking inventory.';
comment on column public.store_orders.refund_lifecycle_started_at is
  'Stable cutover boundary used to avoid double-counting refunds previously recorded from legacy charge.refunded snapshots.';
comment on table public.store_inventory is
  'Private per-SKU finished inventory or owner-approved made-to-order ATP capacity. On-hand includes active reservations; available capacity is on-hand minus reserved.';
comment on table public.store_order_notifications is
  'Private transactional outbox for idempotent merchant order notifications. Customer PII remains in the canonical order ledger, not in this retry table.';
comment on column public.store_orders.inventory_reconciliation_claim_token is
  'Private short-lived lease token for Stripe-verified overdue reservation reconciliation.';
comment on column public.store_orders.inventory_reconciliation_retry_at is
  'Earliest time an unresolved overdue reservation may be retried; never authorizes inventory release.';
