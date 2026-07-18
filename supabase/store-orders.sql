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
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'partially_refunded', 'refunded')),
  fulfillment_status text not null default 'unfulfilled'
    check (fulfillment_status in ('unfulfilled', 'packing', 'shipped', 'cancelled')),
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

create table if not exists public.store_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  product_id text not null,
  product_category text not null default 'uncategorized',
  sku text not null,
  deck_id text,
  product_name text not null,
  unit_amount_cents integer not null check (unit_amount_cents >= 0),
  quantity integer not null check (quantity between 1 and 10),
  line_total_cents integer not null check (line_total_cents >= 0),
  created_at timestamptz not null default now(),
  unique (order_id, product_id)
);

alter table public.store_order_items
  add column if not exists product_category text not null default 'uncategorized';
alter table public.store_order_items
  alter column deck_id drop not null;

create table if not exists public.store_payment_events (
  provider_event_id text primary key,
  event_type text not null,
  order_id uuid references public.store_orders(id) on delete set null,
  checkout_session_id text,
  event_created_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists store_orders_created_at_idx
  on public.store_orders (created_at desc);
create index if not exists store_orders_payment_status_idx
  on public.store_orders (payment_status, created_at desc);
create index if not exists store_orders_fulfillment_status_idx
  on public.store_orders (fulfillment_status, created_at desc);
create unique index if not exists store_orders_charge_id_idx
  on public.store_orders (charge_id) where charge_id is not null;
create index if not exists store_order_items_order_id_idx
  on public.store_order_items (order_id);
create index if not exists store_payment_events_order_id_idx
  on public.store_payment_events (order_id);

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

drop function if exists public.process_store_payment_event(
  text, text, timestamptz, uuid, text, text, text, text, text, jsonb,
  text, integer, integer, integer, integer, text, boolean
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
  p_shipping_cents integer,
  p_tax_cents integer,
  p_total_cents integer,
  p_receipt_url text,
  p_receipt_number text,
  p_payment_livemode boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted integer;
  v_order_id uuid;
  v_event_time timestamptz := coalesce(p_event_created_at, now());
begin
  if p_provider_event_id is null or p_provider_event_id = '' then
    raise exception 'A provider event id is required.';
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
    return false;
  end if;

  select orders.id
    into v_order_id
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

  if v_order_id is null then
    raise exception 'No store order matched payment event %.', p_provider_event_id;
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
         payment_livemode = coalesce(p_payment_livemode, payment_livemode),
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
         payment_status = case
           when p_payment_status = 'paid'
             and payment_status in ('pending', 'failed') then 'paid'
           when p_payment_status = 'partially_refunded'
             and payment_status <> 'refunded' then 'partially_refunded'
           when p_payment_status = 'refunded' then 'refunded'
           when p_payment_status = 'failed' and payment_status = 'pending' then 'failed'
           else payment_status
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

alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;
alter table public.store_payment_events enable row level security;

drop policy if exists "Store orders are private" on public.store_orders;
drop policy if exists "Store order items are private" on public.store_order_items;
drop policy if exists "Store payment events are private" on public.store_payment_events;

create policy "Store orders are private"
  on public.store_orders for all using (false) with check (false);
create policy "Store order items are private"
  on public.store_order_items for all using (false) with check (false);
create policy "Store payment events are private"
  on public.store_payment_events for all using (false) with check (false);

revoke all on public.store_orders from anon, authenticated;
revoke all on public.store_order_items from anon, authenticated;
revoke all on public.store_payment_events from anon, authenticated;
revoke all on function public.process_store_payment_event(
  text, text, timestamptz, uuid, text, text, text, text, text, text, jsonb,
  text, integer, integer, integer, integer, text, text, boolean
) from public, anon, authenticated;

grant select, insert, update, delete on public.store_orders to service_role;
grant select, insert, update, delete on public.store_order_items to service_role;
grant select, insert, update, delete on public.store_payment_events to service_role;
grant execute on function public.process_store_payment_event(
  text, text, timestamptz, uuid, text, text, text, text, text, text, jsonb,
  text, integer, integer, integer, integer, text, text, boolean
) to service_role;

comment on table public.store_orders is
  'Private SeaPals order ledger. Payment state is updated only by signed provider webhooks.';
comment on table public.store_order_items is
  'Immutable product and price snapshots retained with each order.';
comment on table public.store_payment_events is
  'Idempotency log for payment-provider webhook events.';
