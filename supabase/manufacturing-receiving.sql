-- Apply after manufacturing-dispatch.sql. Existing receipts remain credited.
-- Product barcodes identify a SKU, not an individual pack. Staff review the
-- scanned quantities and attest that these units are packaged and quality checked.
begin;

alter table public.manufacturing_orders add column if not exists received_quantities jsonb not null default '{}';
-- Preserve the meaning of historical, all-at-once receipts without posting again.
update public.manufacturing_orders m set received_quantities=(
  select jsonb_object_agg(item->>'productId',(item->>'quantity')::integer)
  from jsonb_array_elements(m.stock_request) item
) where m.job_kind='stock' and m.inventory_posted_at is not null and m.received_quantities='{}'::jsonb;

create table if not exists public.manufacturing_product_barcodes (
  barcode text primary key check (length(barcode) between 1 and 128 and barcode=trim(barcode) and barcode !~ '[[:cntrl:]]'),
  product_id text not null references public.manufacturing_stock(product_id),
  created_at timestamptz not null default now()
);
create index if not exists manufacturing_product_barcodes_product_idx on public.manufacturing_product_barcodes(product_id);
alter table public.manufacturing_product_barcodes enable row level security;
revoke all on public.manufacturing_product_barcodes from public,anon,authenticated;
grant all on public.manufacturing_product_barcodes to service_role;

create or replace function public.manufacturing_set_product_barcode(p_barcode text,p_product text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare code text:=trim(p_barcode); mapped text;
begin
  if code is null or length(code) not between 1 and 128 or code ~ '[[:cntrl:]]' then raise exception 'A valid product barcode is required'; end if;
  if not exists(select 1 from manufacturing_stock where product_id=p_product) then raise exception 'Unknown finished product'; end if;
  perform pg_advisory_xact_lock(732601006);
  insert into manufacturing_product_barcodes(barcode,product_id) values(code,p_product) on conflict(barcode) do nothing;
  select product_id into mapped from manufacturing_product_barcodes where barcode=code;
  if mapped is distinct from p_product then raise exception 'This barcode is already assigned to another product'; end if;
  return jsonb_build_object('barcode',code,'productId',mapped);
end $$;

create or replace function public.manufacturing_receive_stock(p_id uuid,p_order uuid,p_items jsonb,p_quality_confirmed boolean) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  m manufacturing_orders; item jsonb; product record; total integer:=0; planned integer; previously integer;
  k text:='receive:'||p_id; payload jsonb; prior jsonb; canonical_items jsonb; mapped_items jsonb;
  quantities jsonb; all_received boolean; pending_print boolean;
begin
  if p_id is null or p_order is null or p_quality_confirmed is distinct from true then raise exception 'Confirm these units are packaged and quality checked'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Scanned product quantities are required'; end if;
  if jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Receive between 1 and 100 finished units'; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'barcode') is distinct from 'string'
      or length(trim(item->>'barcode')) not between 1 and 128 or item->>'barcode' ~ '[[:cntrl:]]'
      or jsonb_typeof(item->'quantity') is distinct from 'number' or coalesce(item->>'quantity','') !~ '^[1-9][0-9]{0,2}$'
      then raise exception 'Each barcode needs a positive whole quantity'; end if;
    total:=total+(item->>'quantity')::integer;
  end loop;
  if total>100 then raise exception 'Receive at most 100 finished units at a time'; end if;
  select jsonb_agg(jsonb_build_object('barcode',code,'quantity',quantity) order by code) into canonical_items
    from (select trim(value->>'barcode') code,sum((value->>'quantity')::integer)::integer quantity
      from jsonb_array_elements(p_items) group by trim(value->>'barcode')) normalized;
  payload:=jsonb_build_object('jobId',p_order,'items',canonical_items,'qualityConfirmed',true);
  -- Same lock ordering as payment, manufacturing events, and stock allocation.
  perform 1 from store_orders where id=p_order for update;
  select * into m from manufacturing_orders where order_id=p_order for update;
  if not found or m.job_kind<>'stock' then raise exception 'Select an independent stock build to receive'; end if;
  perform pg_advisory_xact_lock(732601006);
  select o.payload into prior from manufacturing_stock_operations o where id=k;
  if found then
    if prior<>payload then raise exception 'Operation ID reused with different contents'; end if;
    return jsonb_build_object('recorded',true,'duplicate',true,'receivedQuantities',m.received_quantities,'complete',m.inventory_posted_at is not null);
  end if;
  if m.inventory_posted_at is not null then raise exception 'This stock build has already been received'; end if;
  if m.manifest_text is null or m.state is null or m.print_requested_at is null then raise exception 'Send this stock build to printers before receiving packaged units'; end if;
  if m.phase='blocked' or m.state->>'hold'='true' then raise exception 'Resolve the job hold before receiving stock'; end if;
  if m.leased_until>now() then raise exception 'The printer agent is active; wait before receiving stock'; end if;
  if m.state->'ticket'->>'ticket'='submitting' or exists(
    select 1 from jsonb_each(coalesce(m.state->'sheets','{}'::jsonb)) s
    where s.value->>'fronts'='submitting' or s.value->>'backs'='submitting'
  ) then raise exception 'Resolve the active print attempt before receiving stock'; end if;
  if exists(select 1 from jsonb_array_elements(canonical_items) i
    left join manufacturing_product_barcodes b on b.barcode=i->>'barcode' where b.barcode is null)
    then raise exception 'Unknown product barcode; assign it to a product first'; end if;
  select jsonb_agg(jsonb_build_object('productId',product_id,'quantity',quantity) order by product_id) into mapped_items
    from (select b.product_id,sum((i->>'quantity')::integer)::integer quantity
      from jsonb_array_elements(canonical_items) i join manufacturing_product_barcodes b on b.barcode=i->>'barcode'
      group by b.product_id) mapped;
  quantities:=m.received_quantities;
  for product in select * from jsonb_to_recordset(mapped_items) as x("productId" text,quantity integer) loop
    select (value->>'quantity')::integer into planned from jsonb_array_elements(m.stock_request) where value->>'productId'=product."productId";
    if not found then raise exception 'Scanned product is not part of this stock build'; end if;
    previously:=coalesce((quantities->>product."productId")::integer,0);
    if previously+product.quantity>planned then raise exception 'Received quantity exceeds the remaining units in this stock build'; end if;
    quantities:=jsonb_set(quantities,array[product."productId"],to_jsonb(previously+product.quantity),true);
  end loop;
  select not exists(select 1 from jsonb_array_elements(m.stock_request) i
    where coalesce((quantities->>(i->>'productId'))::integer,0)<>(i->>'quantity')::integer) into all_received;
  pending_print:=coalesce(m.state->'ticket'->>'ticket' in ('queued','needs_review'),false) or exists(
    select 1 from jsonb_each(coalesce(m.state->'sheets','{}'::jsonb)) s
    where s.value->>'fronts' in ('queued','needs_review') or s.value->>'backs' in ('queued','needs_review'));
  if all_received and pending_print then raise exception 'Resolve pending or uncertain print pages before receiving the last units'; end if;
  insert into manufacturing_stock_operations(id,payload) values(k,payload);
  for product in select * from jsonb_to_recordset(mapped_items) as x("productId" text,quantity integer) loop
    update manufacturing_stock set on_hand=on_hand+product.quantity,updated_at=now() where product_id=product."productId";
    insert into manufacturing_stock_movements(operation_id,product_id,on_hand_delta,job_id,reason)
      values(k,product."productId",product.quantity,p_order,'Packaged products received by barcode after quality check');
  end loop;
  update manufacturing_orders set received_quantities=quantities,
    inventory_posted_at=case when all_received then now() else inventory_posted_at end,
    revision=revision+1,state=jsonb_set(state,'{revision}',to_jsonb(revision+1)),
    phase=case when all_received then 'complete' when phase='complete' then 'awaiting_operator' else phase end,
    updated_at=now() where order_id=p_order;
  return jsonb_build_object('recorded',true,'duplicate',false,'receivedQuantities',quantities,'complete',all_received);
end $$;

-- Packing confirms physical work. It must never credit the planned stock batch.
create or replace function public.manufacturing_commit(p_order uuid,p_token uuid,p_expected integer,p_state jsonb,p_event jsonb,p_phase text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare o store_orders; m manufacturing_orders; milestone text; item record; k text;
begin
  select * into o from store_orders where id=p_order for update;
  select * into m from manufacturing_orders where order_id=p_order for update;
  if not found or m.revision<>p_expected then raise exception 'Revision conflict'; end if;
  if p_event->>'role'='agent' and (m.lease_token is distinct from p_token or m.leased_until is null or m.leased_until<=now()) then raise exception 'Lease expired'; end if;
  if p_event->>'type'='submission_started' and m.print_requested_at is null then raise exception 'Send to printers is required before printing'; end if;
  if p_event->>'type' not in ('submission_succeeded','submission_uncertain','hold') and m.job_kind='order'
    and (not manufacturing_eligible(o) or m.inventory_released_at is not null) then raise exception 'Order or stock reservation is no longer eligible'; end if;
  if m.inventory_posted_at is not null and p_event->>'type'='reprint' and p_event->>'side'<>'ticket' then raise exception 'Finished stock already received; record damaged stock and create a replacement build'; end if;
  if (p_state->>'revision')::integer<>p_expected+1 or p_state->>'manifestHash' is distinct from m.state->>'manifestHash' then raise exception 'Invalid state revision or manifest'; end if;
  if m.job_kind='order' and (not manufacturing_eligible(o) or m.inventory_released_at is not null) then p_phase:='blocked'; end if;
  if p_event->>'type'='packed' then
    if p_event->>'role'<>'operator' or p_state->>'packed'<>'true' or p_state->>'qualityChecked'<>'true' or p_state->>'hold'='true' then raise exception 'Operator quality check and packing required'; end if;
    if m.job_kind='order' and m.inventory_plan is not null and m.inventory_consumed_at is null then
      perform pg_advisory_xact_lock(732601006);
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
  if m.job_kind='stock' and m.inventory_posted_at is null and p_phase='complete' then p_phase:='awaiting_operator'; end if;
  update manufacturing_orders set state=p_state,revision=p_expected+1,phase=p_phase,issue=case when p_phase='blocked' then issue else null end,updated_at=now(),
    lease_token=case when p_phase='active' then lease_token else null end,
    leased_until=case when p_phase='active' then leased_until else null end where order_id=p_order returning * into m;
  if m.job_kind='order' then
    -- Operator gluing is physical production evidence; spool acceptance alone is not.
    if p_event->>'role'='operator' and (p_event->>'type'='glued' or
      (p_event->>'type'='confirm_printed' and p_event->>'side'<>'ticket')) then milestone:='in_production'; end if;
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

create or replace function public.manufacturing_settle(p_order uuid,p_token uuid,p_expected integer,p_phase text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_phase not in ('awaiting_operator','blocked','complete') then raise exception 'Unfinished attempts'; end if;
  perform 1 from store_orders where id=p_order for update;
  update manufacturing_orders set phase=case when job_kind='stock' and inventory_posted_at is null and p_phase='complete' then 'awaiting_operator' else p_phase end,
    lease_token=null,leased_until=null,updated_at=now()
    where order_id=p_order and lease_token=p_token and leased_until>now() and revision=p_expected;
  if not found then raise exception 'Revision or lease conflict'; end if;
  return true;
end $$;

revoke all on function public.manufacturing_set_product_barcode(text,text),public.manufacturing_receive_stock(uuid,uuid,jsonb,boolean),public.manufacturing_commit(uuid,uuid,integer,jsonb,jsonb,text),public.manufacturing_settle(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.manufacturing_set_product_barcode(text,text),public.manufacturing_receive_stock(uuid,uuid,jsonb,boolean),public.manufacturing_commit(uuid,uuid,integer,jsonb,jsonb,text),public.manufacturing_settle(uuid,uuid,integer,text) to service_role;
commit;
