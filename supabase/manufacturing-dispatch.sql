-- Apply after manufacturing.sql and manufacturing-inventory.sql.
-- Creating a job reserves finished stock but never authorizes printing.
-- Every existing and new job waits for an explicit staff dispatch request.
begin;

alter table public.manufacturing_orders add column if not exists print_requested_at timestamptz;
create index if not exists manufacturing_requested_queue_idx on public.manufacturing_orders(phase,created_at)
  where print_requested_at is not null;

create or replace function public.manufacturing_send_to_printers(p_order uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare o store_orders; m manufacturing_orders;
begin
  -- Use the same lock order as payment/refund transactions and printer claims.
  select * into o from store_orders where id=p_order for update;
  select * into m from manufacturing_orders where order_id=p_order for update;
  if not found then raise exception 'Workshop job not found'; end if;
  -- A repeated click acknowledges the original request. In particular, it does
  -- not retry blocked work, requeue completed work, reroll cards, or steal a lease.
  if m.print_requested_at is not null then return to_jsonb(m); end if;
  if m.phase='blocked' or m.state->>'hold'='true' then raise exception 'Resolve the job hold before sending to printers'; end if;
  if m.phase='complete' or m.state->>'packed'='true' or m.inventory_posted_at is not null or m.inventory_consumed_at is not null then
    raise exception 'Completed work cannot be sent again; use the explicit reprint workflow';
  end if;
  if m.job_kind='order' then
    if o.id is null or not manufacturing_eligible(o) or m.inventory_released_at is not null then
      raise exception 'Order or stock reservation is no longer eligible';
    end if;
    if not manufacturing_allocate_stock(p_order) then raise exception 'Order items are not ready for printing'; end if;
  end if;
  update manufacturing_orders set print_requested_at=now(),updated_at=now()
    where order_id=p_order returning * into m;
  return to_jsonb(m);
end $$;

create or replace function public.manufacturing_claim(p_token uuid,p_allow_test boolean default false) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare candidate record; o store_orders; m manufacturing_orders;
begin
  for candidate in select q.order_id,q.customer_order_id from manufacturing_orders q
    left join store_orders s on s.id=q.customer_order_id
    where q.print_requested_at is not null
      and q.phase in ('queued','active') and (q.leased_until is null or q.leased_until<now())
      and (q.job_kind='stock' or ((s.payment_livemode or p_allow_test) and manufacturing_eligible(s)))
    order by (q.job_kind='stock'),q.created_at limit 50 loop
    if candidate.customer_order_id is not null then
      select * into o from store_orders where id=candidate.customer_order_id for update skip locked;
      if not found or not manufacturing_eligible(o) or not (o.payment_livemode or p_allow_test) then continue; end if;
    end if;
    select * into m from manufacturing_orders where order_id=candidate.order_id for update skip locked;
    if not found or m.print_requested_at is null or m.phase not in ('queued','active') or m.leased_until>now() then continue; end if;
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

create or replace function public.manufacturing_commit(p_order uuid,p_token uuid,p_expected integer,p_state jsonb,p_event jsonb,p_phase text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare o store_orders; m manufacturing_orders; milestone text; item record; k text;
begin
  select * into o from store_orders where id=p_order for update;
  select * into m from manufacturing_orders where order_id=p_order for update;
  if not found or m.revision<>p_expected then raise exception 'Revision conflict'; end if;
  if p_event->>'role'='agent' and (m.lease_token is distinct from p_token or m.leased_until is null or m.leased_until<=now()) then raise exception 'Lease expired'; end if;
  -- Also enforce dispatch immediately before spool submission. A lease acquired
  -- before this migration cannot bypass the new approval gate.
  if p_event->>'type'='submission_started' and m.print_requested_at is null then raise exception 'Send to printers is required before printing'; end if;
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

-- No browser, customer, or anonymous role can approve jobs or bypass the gate.
revoke all on function public.manufacturing_send_to_printers(uuid),public.manufacturing_claim(uuid,boolean),public.manufacturing_commit(uuid,uuid,integer,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.manufacturing_send_to_printers(uuid),public.manufacturing_claim(uuid,boolean),public.manufacturing_commit(uuid,uuid,integer,jsonb,jsonb,text) to service_role;
commit;
