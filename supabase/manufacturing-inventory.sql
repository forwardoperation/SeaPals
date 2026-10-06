-- Apply after manufacturing.sql. Physical finished goods are separate from
-- store_inventory, which controls checkout's available production capacity.
begin;

alter table public.manufacturing_orders add column if not exists job_kind text not null default 'order';
alter table public.manufacturing_orders add column if not exists customer_order_id uuid references public.store_orders(id);
alter table public.manufacturing_orders add column if not exists stock_request jsonb;
alter table public.manufacturing_orders add column if not exists display_number text;
alter table public.manufacturing_orders add column if not exists inventory_plan jsonb;
alter table public.manufacturing_orders add column if not exists inventory_released_at timestamptz;
alter table public.manufacturing_orders add column if not exists inventory_consumed_at timestamptz;
alter table public.manufacturing_orders add column if not exists inventory_posted_at timestamptz;
update public.manufacturing_orders m set customer_order_id=m.order_id,display_number=o.order_number
  from public.store_orders o where m.order_id=o.id and m.job_kind='order' and m.customer_order_id is null;
-- order_id is now the stable workshop job ID; order jobs retain their original ID.
alter table public.manufacturing_orders drop constraint if exists manufacturing_orders_order_id_fkey;
alter table public.manufacturing_orders drop constraint if exists manufacturing_job_kind_check;
alter table public.manufacturing_orders add constraint manufacturing_job_kind_check check (
  (job_kind='order' and customer_order_id is not null and order_id=customer_order_id and stock_request is null)
  or (job_kind='stock' and customer_order_id is null and jsonb_typeof(stock_request)='array'));
create unique index if not exists manufacturing_customer_order_idx on public.manufacturing_orders(customer_order_id);

create table if not exists public.manufacturing_stock (
  product_id text primary key,
  product_name text not null,
  on_hand integer not null default 0 check(on_hand>=0),
  reserved integer not null default 0 check(reserved>=0 and reserved<=on_hand),
  updated_at timestamptz not null default now()
);
insert into public.manufacturing_stock(product_id,product_name) values
 ('starter-kit','Starter Kit'),('coral-garden','Coral Garden Deck'),('blue-water','Drop Off Deck'),
 ('darkness-shroud','Darkness Shroud Deck'),('open-ocean-hunt','Open Ocean Deck'),
 ('murky-water','Murky Water Deck'),('stinging-fortress','Stinging Fortress Deck'),('disruption','Disruption Deck'),
 ('oceanic-dive-pack','Pelagic Rush Dive Pack'),('reef-dive-pack','Coral Bloom Dive Pack'),
 ('deep-dive-pack','Abyssal Glow Dive Pack'),('accessory-set','Accessories Kit'),
 ('reef-point-tokens','Reef Point (RP) Token Set'),('dice-pack','Dice Pack'),('conditions-deck','Conditions Deck')
 on conflict(product_id) do nothing;

create table if not exists public.manufacturing_stock_operations (
  id text primary key, payload jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.manufacturing_stock_movements (
  id uuid primary key default gen_random_uuid(),
  operation_id text not null references public.manufacturing_stock_operations(id),
  product_id text not null references public.manufacturing_stock(product_id),
  on_hand_delta integer not null default 0, reserved_delta integer not null default 0,
  job_id uuid references public.manufacturing_orders(order_id),
  reason text not null, created_at timestamptz not null default now(),
  unique(operation_id,product_id)
);
create index if not exists manufacturing_stock_history_idx on public.manufacturing_stock_movements(created_at desc);

-- All stock changes serialize after the customer-order and workshop-job locks.
-- The small workshop ledger favors a single, predictable lock over overselling.
create or replace function public.manufacturing_adjust_stock(p_id uuid,p_product text,p_quantity integer,p_reason text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare k text:='adjust:'||p_id; payload jsonb; prior jsonb; s manufacturing_stock;
begin
  if p_id is null or p_quantity is null or p_quantity=0 or abs(p_quantity::bigint)>10000 or length(trim(coalesce(p_reason,''))) not between 1 and 500 then raise exception 'A product, nonzero quantity, and reason are required'; end if;
  payload:=jsonb_build_object('productId',p_product,'quantity',p_quantity,'reason',trim(p_reason));
  perform pg_advisory_xact_lock(732601006);
  select o.payload into prior from manufacturing_stock_operations o where id=k;
  if found then
    if prior<>payload then raise exception 'Operation ID reused with different contents'; end if;
    return jsonb_build_object('recorded',true,'duplicate',true);
  end if;
  select * into s from manufacturing_stock where product_id=p_product for update;
  if not found then raise exception 'Unknown finished product'; end if;
  if s.on_hand::bigint+p_quantity<s.reserved then raise exception 'Cannot remove stock reserved for orders'; end if;
  update manufacturing_stock set on_hand=on_hand+p_quantity,updated_at=now() where product_id=p_product;
  insert into manufacturing_stock_operations values(k,payload,now());
  insert into manufacturing_stock_movements(operation_id,product_id,on_hand_delta,reason) values(k,p_product,p_quantity,trim(p_reason));
  return jsonb_build_object('recorded',true,'duplicate',false);
end $$;

create or replace function public.manufacturing_create_stock_job(p_id uuid,p_items jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare m manufacturing_orders; item jsonb; total integer:=0;
begin
  if p_id is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Stock build items required'; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if not exists(select 1 from manufacturing_stock where product_id=item->>'productId') or coalesce(item->>'quantity','')!~'^[1-9][0-9]{0,2}$' then raise exception 'Invalid stock build product or quantity'; end if;
    total:=total+(item->>'quantity')::integer;
  end loop;
  if total>100 or (select count(distinct value->>'productId') from jsonb_array_elements(p_items))<>jsonb_array_length(p_items) then raise exception 'Use unique products and at most 100 finished units'; end if;
  insert into manufacturing_orders(order_id,job_kind,stock_request,display_number,release_id)
    select p_id,'stock',p_items,'STOCK-'||upper(replace(p_id::text,'-','')),active_release from manufacturing_settings where id on conflict do nothing;
  select * into m from manufacturing_orders where order_id=p_id for update;
  if m.job_kind<>'stock' or m.stock_request<>p_items then raise exception 'Job ID reused with different contents'; end if;
  return to_jsonb(m);
end $$;

create or replace function public.manufacturing_allocate_stock(p_order uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare o store_orders; m manufacturing_orders; item record; available integer; take integer; plan jsonb:='[]'; k text:='reserve:'||p_order;
begin
  select * into o from store_orders where id=p_order for update;
  if not found then return false; end if;
  select * into m from manufacturing_orders where order_id=p_order for update;
  if not found then return false; end if;
  if m.inventory_plan is not null then return true; end if;
  if not manufacturing_eligible(o) then return false; end if;
  if not exists(select 1 from store_order_items where order_id=p_order) then return false; end if;
  perform pg_advisory_xact_lock(732601006);
  -- Never reinterpret a saved legacy print manifest or use physical stock for test payments.
  for item in select product_id,sum(quantity)::integer as quantity from store_order_items where order_id=p_order group by product_id order by product_id loop
    select on_hand-reserved into available from manufacturing_stock where product_id=item.product_id for update;
    take:=case when o.payment_livemode and m.manifest_text is null then least(coalesce(available,0),item.quantity) else 0 end;
    plan:=plan||jsonb_build_array(jsonb_build_object('productId',item.product_id,'quantity',item.quantity,'fromStock',take,'toMake',item.quantity-take));
  end loop;
  insert into manufacturing_stock_operations(id,payload) values(k,plan);
  for item in select * from jsonb_to_recordset(plan) as x("productId" text,"fromStock" integer) loop
    if item."fromStock">0 then
      update manufacturing_stock set reserved=reserved+item."fromStock",updated_at=now() where product_id=item."productId";
      insert into manufacturing_stock_movements(operation_id,product_id,reserved_delta,job_id,reason)
        values(k,item."productId",item."fromStock",p_order,'Reserved for paid order');
    end if;
  end loop;
  update manufacturing_orders set inventory_plan=plan where order_id=p_order;
  return true;
end $$;

create or replace function public.manufacturing_release_stock(p_order uuid,p_reason text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare m manufacturing_orders; item record; k text:='release:'||p_order;
begin
  perform 1 from store_orders where id=p_order for update;
  select * into m from manufacturing_orders where order_id=p_order for update;
  if not found then return; end if;
  if m.inventory_plan is not null and m.inventory_released_at is null and m.inventory_consumed_at is null then
    perform pg_advisory_xact_lock(732601006);
    insert into manufacturing_stock_operations(id,payload) values(k,m.inventory_plan);
    for item in select * from jsonb_to_recordset(m.inventory_plan) as x("productId" text,"fromStock" integer) loop
      if item."fromStock">0 then
        update manufacturing_stock set reserved=reserved-item."fromStock",updated_at=now() where product_id=item."productId";
        insert into manufacturing_stock_movements(operation_id,product_id,reserved_delta,job_id,reason)
          values(k,item."productId",-item."fromStock",p_order,left(p_reason,500));
      end if;
    end loop;
    update manufacturing_orders set inventory_released_at=now() where order_id=p_order;
  end if;
  update manufacturing_orders set phase='blocked',issue=left(p_reason,500),updated_at=now() where order_id=p_order;
end $$;

create or replace function public.manufacturing_order_changed() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
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
end $$;
drop trigger if exists manufacturing_order_changed on public.store_orders;
create trigger manufacturing_order_changed after insert or update of payment_status,fulfillment_status,amount_refunded_cents,dispute_status
  on public.store_orders for each row execute function public.manufacturing_order_changed();

create or replace function public.manufacturing_refund_changed() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.status in ('pending','requires_action','succeeded') then
    perform manufacturing_release_stock(new.order_id,'Refund pending or completed; reserved finished stock released');
  end if;
  return new;
end $$;
drop trigger if exists manufacturing_refund_changed on public.store_refunds;
create trigger manufacturing_refund_changed after insert or update of status on public.store_refunds for each row execute function public.manufacturing_refund_changed();

create or replace function public.manufacturing_claim(p_token uuid,p_allow_test boolean default false) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare candidate record; o store_orders; m manufacturing_orders;
begin
  for candidate in select q.order_id,q.customer_order_id from manufacturing_orders q
    left join store_orders s on s.id=q.customer_order_id
    where q.phase in ('queued','active') and (q.leased_until is null or q.leased_until<now())
      and (q.job_kind='stock' or ((s.payment_livemode or p_allow_test) and manufacturing_eligible(s)))
    order by (q.job_kind='stock'),q.created_at limit 50 loop
    if candidate.customer_order_id is not null then
      select * into o from store_orders where id=candidate.customer_order_id for update skip locked;
      if not found or not manufacturing_eligible(o) then continue; end if;
    end if;
    select * into m from manufacturing_orders where order_id=candidate.order_id for update skip locked;
    if not found or m.phase not in ('queued','active') or m.leased_until>now() then continue; end if;
    if m.job_kind='order' then
      if m.inventory_released_at is not null then continue; end if;
      if not manufacturing_allocate_stock(m.order_id) then continue; end if;
    end if;
    update manufacturing_orders set lease_token=p_token,leased_until=now()+interval '2 minutes',phase='active',
      release_id=case when manifest_text is null then coalesce(release_id,(select active_release from manufacturing_settings where id)) else release_id end,updated_at=now()
      where order_id=m.order_id returning * into m;
    return to_jsonb(m);
  end loop;
  return null;
end $$;

create or replace function public.manufacturing_save_manifest(p_order uuid,p_token uuid,p_manifest text,p_state jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare m manufacturing_orders;
begin
  perform 1 from store_orders where id=p_order for update;
  select * into m from manufacturing_orders where order_id=p_order for update;
  if not found or m.lease_token is distinct from p_token or m.leased_until is null or m.leased_until<=now() then raise exception 'Lease expired'; end if;
  if m.manifest_text is null then
    if p_manifest::jsonb->>'artworkRelease' is distinct from coalesce(m.release_id,'stock-only') then raise exception 'Release mismatch'; end if;
    if m.job_kind='order' and p_manifest::jsonb->'inventoryPlan' is distinct from m.inventory_plan then raise exception 'Stock allocation mismatch'; end if;
    if coalesce(p_manifest::jsonb->>'jobKind','order')<>m.job_kind then raise exception 'Job kind mismatch'; end if;
    update manufacturing_orders set manifest_text=p_manifest,state=p_state,revision=0,issue=null,updated_at=now() where order_id=p_order returning * into m;
  end if;
  return to_jsonb(m);
end $$;

create or replace function public.manufacturing_commit(p_order uuid,p_token uuid,p_expected integer,p_state jsonb,p_event jsonb,p_phase text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare o store_orders; m manufacturing_orders; milestone text; item record; k text;
begin
  select * into o from store_orders where id=p_order for update;
  select * into m from manufacturing_orders where order_id=p_order for update;
  if not found or m.revision<>p_expected then raise exception 'Revision conflict'; end if;
  if p_event->>'role'='agent' and (m.lease_token is distinct from p_token or m.leased_until is null or m.leased_until<=now()) then raise exception 'Lease expired'; end if;
  if p_event->>'type' not in ('submission_succeeded','submission_uncertain','hold') and m.job_kind='order'
    and (not manufacturing_eligible(o) or m.inventory_released_at is not null) then raise exception 'Order or stock reservation is no longer eligible'; end if;
  if m.inventory_posted_at is not null and p_event->>'type'='reprint' and p_event->>'side'<>'ticket' then raise exception 'Finished stock already received; record damaged stock and create a replacement build'; end if;
  if (p_state->>'revision')::integer<>p_expected+1 or p_state->>'manifestHash' is distinct from m.state->>'manifestHash' then raise exception 'Invalid state revision or manifest'; end if;
  if m.job_kind='order' and (not manufacturing_eligible(o) or m.inventory_released_at is not null) then p_phase:='blocked'; end if;
  if p_event->>'type'='packed' then
    if p_event->>'role'<>'operator' or p_state->>'packed'<>'true' or p_state->>'qualityChecked'<>'true' or p_state->>'hold'='true' then raise exception 'Operator quality check and packing required'; end if;
    perform pg_advisory_xact_lock(732601006);
    if m.job_kind='stock' and m.inventory_posted_at is null then
      k:='build:'||p_order;
      insert into manufacturing_stock_operations(id,payload) values(k,m.stock_request);
      for item in select * from jsonb_to_recordset(m.stock_request) as x("productId" text,quantity integer) loop
        update manufacturing_stock set on_hand=on_hand+item.quantity,updated_at=now() where product_id=item."productId";
        insert into manufacturing_stock_movements(operation_id,product_id,on_hand_delta,job_id,reason) values(k,item."productId",item.quantity,p_order,'Finished stock build received');
      end loop;
      update manufacturing_orders set inventory_posted_at=now() where order_id=p_order;
    elsif m.job_kind='order' and m.inventory_plan is not null and m.inventory_consumed_at is null then
      k:='consume:'||p_order;
      insert into manufacturing_stock_operations(id,payload) values(k,m.inventory_plan);
      for item in select * from jsonb_to_recordset(m.inventory_plan) as x("productId" text,"fromStock" integer) loop
        if item."fromStock">0 then
          update manufacturing_stock set on_hand=on_hand-item."fromStock",reserved=reserved-item."fromStock",updated_at=now() where product_id=item."productId";
          insert into manufacturing_stock_movements(operation_id,product_id,on_hand_delta,reserved_delta,job_id,reason)
            values(k,item."productId",-item."fromStock",-item."fromStock",p_order,'Picked stock packed for customer');
        end if;
      end loop;
      update manufacturing_orders set inventory_consumed_at=now() where order_id=p_order;
    end if;
  end if;
  update manufacturing_orders set state=p_state,revision=p_expected+1,phase=p_phase,issue=case when p_phase='blocked' then issue else null end,updated_at=now(),
    lease_token=case when p_phase='active' then lease_token else null end,
    leased_until=case when p_phase='active' then leased_until else null end where order_id=p_order returning * into m;
  if m.job_kind='order' then
    if p_event->>'type'='confirm_printed' and p_event->>'side'<>'ticket' then milestone:='in_production'; end if;
    if p_event->>'type'='quality_checked' then milestone:='packing'; end if;
    if milestone is not null and manufacturing_eligible(o) then
      if (milestone='in_production' and o.fulfillment_status='unfulfilled') or (milestone='packing' and o.fulfillment_status in ('unfulfilled','in_production')) then
        update store_orders set fulfillment_status=milestone,updated_at=now() where id=p_order;
      end if;
      if o.payment_livemode then insert into manufacturing_notifications(order_id,milestone) values(p_order,milestone) on conflict do nothing; end if;
    end if;
  end if;
  return to_jsonb(m);
end $$;

create or replace function public.manufacturing_retry(p_order uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare o store_orders; m manufacturing_orders;
begin
  select * into o from store_orders where id=p_order for update;
  select * into m from manufacturing_orders where order_id=p_order for update;
  if not found then
    if o.id is null or not manufacturing_eligible(o) then raise exception 'Order is not eligible'; end if;
    insert into manufacturing_orders(order_id,customer_order_id,display_number,release_id)
      select p_order,p_order,o.order_number,active_release from manufacturing_settings where id returning * into m;
  end if;
  if m.job_kind='order' and (not manufacturing_eligible(o) or m.inventory_released_at is not null) then raise exception 'Order or stock reservation requires review'; end if;
  if m.state->>'packed'='true' or m.state->>'hold'='true' or m.inventory_posted_at is not null then raise exception 'Release hold or review completed work first'; end if;
  if m.leased_until>now() then raise exception 'Agent is active; wait for its lease'; end if;
  if m.job_kind='order' then perform manufacturing_allocate_stock(p_order); end if;
  update manufacturing_orders set phase='queued',issue=null,updated_at=now(),
    release_id=case when manifest_text is null then coalesce((select active_release from manufacturing_settings where id),release_id) else release_id end where order_id=p_order;
  return true;
end $$;

alter table public.manufacturing_stock enable row level security;
alter table public.manufacturing_stock_operations enable row level security;
alter table public.manufacturing_stock_movements enable row level security;
revoke all on public.manufacturing_stock,public.manufacturing_stock_operations,public.manufacturing_stock_movements from public,anon,authenticated;
grant all on public.manufacturing_stock,public.manufacturing_stock_operations,public.manufacturing_stock_movements to service_role;
do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'manufacturing_%' loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
commit;
