-- SeaRealm Binder fulfillment upgrade. Apply after store-orders.sql and
-- store-preorders.sql, before publishing the binder catalog. No stock seed.
-- These function definitions are copied from the corresponding canonical
-- schema files; this focused migration preserves existing tables and orders.
begin;
do $$ begin
  if to_regprocedure('public.check_store_inventory_contract_v8()') is null then
    raise exception 'Apply store-orders.sql and store-preorders.sql first.';
  end if;
  if public.check_store_inventory_contract_v8() is distinct from true then
    raise exception 'The existing store order contract is not ready.';
  end if;
end $$;


alter table public.store_orders
  drop constraint if exists store_orders_production_option_check;
alter table public.store_orders
  add constraint store_orders_production_option_check
    check (
      (
        production_option_id = 'standard-production'
        and production_option_name = 'Standard production'
        and production_max_business_days in (5, 25)
        and production_cents = 0
      )
      or (
        production_option_id = 'expedited-production'
        and production_option_name = 'Expedited production'
        and production_max_business_days = 1
        and production_cents = 1000
      )
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
         and p_production_max_business_days in (5, 25)
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

  -- Outsourced binders have their own flat rate, calendar-week lead time,
  -- and no finite inventory pool. Never let another SKU use this exception.
  if exists (
    select 1 from jsonb_array_elements(p_items) as item
    where item->>'product_id' = 'card-binder'
       or item->>'sku' = 'SP-MERCH-CARD-BINDER'
  ) then
    if exists (
      select 1 from jsonb_array_elements(p_items) as item
      where item->>'product_id' is distinct from 'card-binder'
         or item->>'sku' is distinct from 'SP-MERCH-CARD-BINDER'
         or coalesce(item->>'fulfillment_type', 'regular') <> 'regular'
    ) or p_production_option_id <> 'standard-production'
      or p_production_max_business_days <> 25
      or not (
        (p_fulfillment_option_id = 'standard' and p_fulfillment_method = 'shipping' and p_shipping_cents = 999)
        or (p_fulfillment_option_id = 'pickup-elverson-pa' and p_fulfillment_method = 'pickup' and p_shipping_cents = 0)
      ) then
      raise exception 'store_binder_fulfillment_invalid';
    end if;
  elsif p_production_option_id = 'standard-production'
    and p_production_max_business_days <> 5 then
    raise exception 'Invalid store order production option.';
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
     where item.sku <> 'SP-MERCH-CARD-BINDER'
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
     where item.sku <> 'SP-MERCH-CARD-BINDER'
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
       and items.sku <> 'SP-MERCH-CARD-BINDER'
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
       and items.sku <> 'SP-MERCH-CARD-BINDER'
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
           and items.sku <> 'SP-MERCH-CARD-BINDER'
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
           and items.sku <> 'SP-MERCH-CARD-BINDER'
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
         and items.sku <> 'SP-MERCH-CARD-BINDER'
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
         and items.sku <> 'SP-MERCH-CARD-BINDER'
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
               'in_production',
               'packing',
               'awaiting_shipment',
               'ready_for_pickup',
               'on_hold'
             )
             then 'cancelled'
           when p_payment_status in ('partially_refunded', 'disputed')
             and fulfillment_status in (
               'unfulfilled',
               'in_production',
               'packing',
               'awaiting_shipment',
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
         and items.sku <> 'SP-MERCH-CARD-BINDER'
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
         and items.sku <> 'SP-MERCH-CARD-BINDER'
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
         and items.sku <> 'SP-MERCH-CARD-BINDER'
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
         and items.sku <> 'SP-MERCH-CARD-BINDER'
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
             when orders.production_max_business_days = 25
               then (orders.paid_at at time zone 'America/New_York')::date + 35
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
             when orders.production_max_business_days = 25
               then (orders.paid_at at time zone 'America/New_York')::date + 35
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

-- Update only installed manufacturing functions, preserving dispatch controls.
do $binder_manufacturing$ begin
  if to_regclass('public.manufacturing_orders') is not null then
    execute $binder_definition$create or replace function public.manufacturing_eligible(p_order public.store_orders) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select p_order.payment_status = 'paid' and coalesce(p_order.amount_refunded_cents,0)=0
    and not exists(select 1 from store_order_items where order_id=p_order.id and sku='SP-MERCH-CARD-BINDER')
    and coalesce(p_order.dispute_status,'') not in ('needs_response','under_review','lost','warning_needs_response','warning_under_review')
    and p_order.fulfillment_status in ('unfulfilled','in_production','packing')
    and not exists(select 1 from store_refunds where order_id=p_order.id and status in ('pending','requires_action','succeeded'));
$$;$binder_definition$;
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name='manufacturing_orders' and column_name='inventory_plan') then
      execute $binder_definition$create or replace function public.manufacturing_order_changed() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  -- Outsourced binders are fulfilled through Orders, never the local printers.
  if exists(select 1 from store_order_items where order_id=new.id and sku='SP-MERCH-CARD-BINDER') then return new; end if;
  if new.payment_status='paid' and (tg_op='INSERT' or old.payment_status is distinct from 'paid') then
    insert into manufacturing_orders(order_id,customer_order_id,display_number,release_id)
      select new.id,new.id,new.order_number,active_release from manufacturing_settings where id on conflict do nothing;
    perform manufacturing_allocate_stock(new.id);
  end if;
  if new.payment_status<>'paid' or coalesce(new.amount_refunded_cents,0)>0 or new.fulfillment_status='cancelled'
    or coalesce(new.dispute_status,'') in ('needs_response','under_review','lost','warning_needs_response','warning_under_review') then
    perform manufacturing_release_stock(new.id,'Order cancelled, refunded, or disputed; review before further work');
  end if;
  if tg_op='UPDATE' and new.fulfillment_status is distinct from old.fulfillment_status
    and new.fulfillment_status in ('ready_for_pickup','shipped') and new.payment_status='paid' and new.payment_livemode
    and exists(select 1 from manufacturing_orders where order_id=new.id and manifest_text is not null) then
    insert into manufacturing_notifications(order_id,milestone) values(new.id,new.fulfillment_status) on conflict do nothing;
  end if;
  return new;
end $$;$binder_definition$;
    else
      execute $binder_definition$create or replace function public.manufacturing_order_changed() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Outsourced binders are fulfilled through Orders, never the local printers.
  if exists(select 1 from store_order_items where order_id=new.id and sku='SP-MERCH-CARD-BINDER') then return new; end if;
  if new.payment_status = 'paid' and (tg_op = 'INSERT' or old.payment_status is distinct from 'paid') then
    insert into manufacturing_orders(order_id,release_id)
      select new.id,active_release from manufacturing_settings where id
      on conflict do nothing;
  end if;
  if tg_op = 'UPDATE' and new.fulfillment_status is distinct from old.fulfillment_status
     and new.fulfillment_status in ('ready_for_pickup','shipped')
     and new.payment_status = 'paid' and new.payment_livemode
     and exists(select 1 from manufacturing_orders where order_id=new.id and manifest_text is not null) then
    insert into manufacturing_notifications(order_id,milestone) values(new.id,new.fulfillment_status) on conflict do nothing;
  end if;
  return new;
end $$;$binder_definition$;
    end if;
  end if;
end $binder_manufacturing$;
notify pgrst, 'reload schema';
commit;
