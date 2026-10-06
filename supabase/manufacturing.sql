-- Apply after store-orders.sql. No historical orders are automatically printed.
begin;

create table if not exists public.manufacturing_releases (
  id text primary key check (id ~ '^[A-Za-z0-9._-]{1,100}$'),
  -- Text preserves the exact serialized manifest used by SHA-256 verification.
  manifest_text text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.manufacturing_settings (
  id boolean primary key default true check (id),
  active_release text references public.manufacturing_releases(id)
);
insert into public.manufacturing_settings(id) values(true) on conflict do nothing;
create table if not exists public.manufacturing_orders (
  order_id uuid primary key references public.store_orders(id),
  release_id text references public.manufacturing_releases(id),
  manifest_text text,
  state jsonb,
  revision integer not null default 0,
  phase text not null default 'queued' check (phase in ('queued','active','awaiting_operator','blocked','complete')),
  issue text,
  lease_token uuid,
  leased_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists manufacturing_queue_idx on public.manufacturing_orders(phase,created_at);
create table if not exists public.manufacturing_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id),
  milestone text not null check(milestone in ('in_production','packing','ready_for_pickup','shipped')),
  status text not null default 'pending' check(status in ('pending','sending','sent','review','skipped')),
  lease_token uuid,
  leased_until timestamptz,
  first_attempt_at timestamptz,
  payload jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(order_id,milestone)
);

create or replace function public.manufacturing_order_changed() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
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
end $$;
drop trigger if exists manufacturing_order_changed on public.store_orders;
create trigger manufacturing_order_changed after insert or update of payment_status,fulfillment_status
  on public.store_orders for each row execute function public.manufacturing_order_changed();

create or replace function public.manufacturing_eligible(p_order public.store_orders) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select p_order.payment_status = 'paid' and coalesce(p_order.amount_refunded_cents,0)=0
    and coalesce(p_order.dispute_status,'') not in ('needs_response','under_review','lost','warning_needs_response','warning_under_review')
    and p_order.fulfillment_status in ('unfulfilled','in_production','packing')
    and not exists(select 1 from store_refunds where order_id=p_order.id and status in ('pending','requires_action','succeeded'));
$$;

-- Lock order first in every mutation, matching payment/fulfillment transactions.
create or replace function public.manufacturing_claim(p_token uuid, p_allow_test boolean default false) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare o store_orders; m manufacturing_orders;
begin
  select s.* into o from store_orders s join manufacturing_orders q on q.order_id=s.id
    where q.phase in ('queued','active') and (q.leased_until is null or q.leased_until<now())
      and (s.payment_livemode or p_allow_test)
      and (q.phase='active' or manufacturing_eligible(s))
      and (q.release_id is not null or exists(select 1 from manufacturing_settings where active_release is not null))
    order by q.created_at for update of s skip locked limit 1;
  if not found then return null; end if;
  update manufacturing_orders set lease_token=p_token,leased_until=now()+interval '2 minutes',phase='active',
    release_id=coalesce(release_id,(select active_release from manufacturing_settings where id)),updated_at=now()
    where order_id=o.id returning * into m;
  return to_jsonb(m);
end $$;

create or replace function public.manufacturing_heartbeat(p_order uuid,p_token uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform 1 from store_orders where id=p_order for update;
  update manufacturing_orders set leased_until=now()+interval '2 minutes'
    where order_id=p_order and lease_token=p_token and leased_until>now() and phase='active';
  return found;
end $$;

create or replace function public.manufacturing_save_manifest(p_order uuid,p_token uuid,p_manifest text,p_state jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare m manufacturing_orders;
begin
  perform 1 from store_orders where id=p_order for update;
  select * into m from manufacturing_orders where order_id=p_order for update;
  if m.lease_token is distinct from p_token or m.leased_until<=now() then raise exception 'Lease expired'; end if;
  if m.manifest_text is null then
    if p_manifest::jsonb->>'artworkRelease' is distinct from m.release_id then raise exception 'Release mismatch'; end if;
    update manufacturing_orders set manifest_text=p_manifest,state=p_state,revision=0,issue=null,updated_at=now()
      where order_id=p_order returning * into m;
  end if;
  return to_jsonb(m);
end $$;

create or replace function public.manufacturing_commit(p_order uuid,p_token uuid,p_expected integer,p_state jsonb,p_event jsonb,p_phase text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare o store_orders; m manufacturing_orders; milestone text;
begin
  select * into o from store_orders where id=p_order for update;
  select * into m from manufacturing_orders where order_id=p_order for update;
  if not found or m.revision<>p_expected then raise exception 'Revision conflict'; end if;
  if p_event->>'role'='agent' and (m.lease_token is distinct from p_token or m.leased_until<=now()) then raise exception 'Lease expired'; end if;
  if p_event->>'type'='submission_started' and not manufacturing_eligible(o) then raise exception 'Order is not eligible for printing'; end if;
  if (p_state->>'revision')::integer<>p_expected+1 then raise exception 'Invalid revision'; end if;
  if p_state->>'manifestHash' is distinct from m.state->>'manifestHash' then raise exception 'Manifest mismatch'; end if;
  update manufacturing_orders set state=p_state,revision=p_expected+1,phase=p_phase,issue=null,updated_at=now(),
    lease_token=case when p_phase='active' then lease_token else null end,
    leased_until=case when p_phase='active' then leased_until else null end
    where order_id=p_order returning * into m;
  if p_event->>'type'='confirm_printed' and p_event->>'side'<>'ticket' then milestone='in_production'; end if;
  if p_event->>'type'='quality_checked' then milestone='packing'; end if;
  if milestone is not null and manufacturing_eligible(o) then
    -- Never move a later fulfillment status backwards after a reprint.
    if (milestone='in_production' and o.fulfillment_status='unfulfilled') or
       (milestone='packing' and o.fulfillment_status in ('unfulfilled','in_production')) then
      update store_orders set fulfillment_status=milestone,updated_at=now() where id=p_order;
    end if;
    if o.payment_livemode then
      insert into manufacturing_notifications(order_id,milestone) values(p_order,milestone) on conflict do nothing;
    end if;
  end if;
  return to_jsonb(m);
end $$;

create or replace function public.manufacturing_block(p_order uuid,p_token uuid,p_issue text) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform 1 from store_orders where id=p_order for update;
  update manufacturing_orders set phase='blocked',issue=left(p_issue,500),lease_token=null,leased_until=null,updated_at=now()
    where order_id=p_order and lease_token=p_token and leased_until>now();
  return found;
end $$;

create or replace function public.manufacturing_retry(p_order uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare o store_orders;
begin
  select * into o from store_orders where id=p_order for update;
  if not found or not manufacturing_eligible(o) then raise exception 'Order is not eligible'; end if;
  if exists(select 1 from manufacturing_orders where order_id=p_order and (state->>'packed'='true' or state->>'hold'='true')) then raise exception 'Release the hold or review the already packed order first'; end if;
  insert into manufacturing_orders(order_id,release_id) select p_order,active_release from manufacturing_settings where id on conflict do nothing;
  update manufacturing_orders set phase='queued',issue=null,updated_at=now(),
    release_id=case when manifest_text is null then coalesce((select active_release from manufacturing_settings where id),release_id) else release_id end
    where order_id=p_order and (leased_until is null or leased_until<now());
  if not found then raise exception 'Agent is active; wait for its lease'; end if;
  -- Existing draws, artwork, and uncertain attempts stay pinned. A job blocked
  -- before its first draw may explicitly retry against newly completed artwork.
  return true;
end $$;

create or replace function public.manufacturing_settle(p_order uuid,p_token uuid,p_expected integer,p_phase text) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_phase not in ('awaiting_operator','blocked','complete') then raise exception 'Unfinished attempts'; end if;
  perform 1 from store_orders where id=p_order for update;
  update manufacturing_orders set phase=p_phase,lease_token=null,leased_until=null,updated_at=now()
    where order_id=p_order and lease_token=p_token and leased_until>now() and revision=p_expected;
  if not found then raise exception 'Revision or lease conflict'; end if;
  return true;
end $$;

create or replace function public.manufacturing_publish(p_id text,p_manifest text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into manufacturing_releases(id,manifest_text) values(p_id,p_manifest) on conflict do nothing;
  if (select manifest_text from manufacturing_releases where id=p_id)<>p_manifest then raise exception 'Release is immutable; choose a new ID'; end if;
  update manufacturing_settings set active_release=p_id where id;
end $$;

create or replace function public.manufacturing_claim_notifications(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  -- Resend keys expire after 24h. Ambiguous attempts older than 23h need review.
  update manufacturing_notifications set status='review',lease_token=null,leased_until=null
    where status in ('pending','sending') and first_attempt_at<now()-interval '23 hours'
      and (leased_until is null or leased_until<now());
  with candidates as (
    select n.id from manufacturing_notifications n
      where n.status in ('pending','sending') and (n.leased_until is null or n.leased_until<now())
      order by n.created_at for update skip locked limit 10
  ), claimed as (
    update manufacturing_notifications n set status='sending',lease_token=p_token,leased_until=now()+interval '5 minutes',
      first_attempt_at=coalesce(first_attempt_at,now()) from candidates c where n.id=c.id returning n.*
  ) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) into result from claimed;
  return result;
end $$;
create or replace function public.manufacturing_finish_notification(p_id uuid,p_token uuid,p_status text) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_status not in ('sent','skipped','pending','review') then raise exception 'Invalid status'; end if;
  update manufacturing_notifications set status=p_status,lease_token=null,leased_until=null,
    sent_at=case when p_status='sent' then now() else sent_at end
    where id=p_id and lease_token=p_token and leased_until>now();
  return found;
end $$;

create or replace function public.manufacturing_notification_payload(p_id uuid,p_token uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare saved jsonb;
begin
  update manufacturing_notifications set payload=coalesce(payload,p_payload)
    where id=p_id and lease_token=p_token and leased_until>now() returning payload into saved;
  if not found then raise exception 'Notification lease expired'; end if;
  return saved;
end $$;

alter table public.manufacturing_releases enable row level security;
alter table public.manufacturing_settings enable row level security;
alter table public.manufacturing_orders enable row level security;
alter table public.manufacturing_notifications enable row level security;
revoke all on public.manufacturing_releases,public.manufacturing_settings,public.manufacturing_orders,public.manufacturing_notifications from public,anon,authenticated;
grant all on public.manufacturing_releases,public.manufacturing_settings,public.manufacturing_orders,public.manufacturing_notifications to service_role;
-- Defense against broad permissive Storage policies elsewhere in the project.
-- Restrictive policies cannot be bypassed by another authenticated/public policy.
do $$ begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists manufacturing_private_only on storage.objects';
    execute $policy$create policy manufacturing_private_only on storage.objects as restrictive
      for all to anon,authenticated using (bucket_id <> 'searealm-manufacturing-private')
      with check (bucket_id <> 'searealm-manufacturing-private')$policy$;
  end if;
end $$;
do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'manufacturing_%' loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
commit;
