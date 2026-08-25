-- Durable, private outbox for the quarterly Pennsylvania sales-tax
-- preparation email. Apply after supabase/store-orders.sql.

begin;

do $$
begin
  if to_regclass('public.store_orders') is null
     or to_regprocedure('public.set_store_order_updated_at()') is null then
    raise exception
      'Apply the current supabase/store-orders.sql before this migration.';
  end if;
end;
$$;

create table if not exists public.store_pa_quarterly_report_notifications (
  period_end date primary key,
  due_date date not null,
  scheduled_for timestamptz not null,
  ready boolean not null,
  included_sales integer not null check (included_sales >= 0),
  excluded_sales integer not null check (excluded_sales >= 0),
  issue_count integer not null check (issue_count >= 0),
  pa_gross_sales_cents integer not null check (pa_gross_sales_cents >= 0),
  pa_taxable_sales_cents integer not null check (pa_taxable_sales_cents >= 0),
  state_tax_cents integer not null check (state_tax_cents >= 0),
  allegheny_tax_cents integer not null check (allegheny_tax_cents >= 0),
  philadelphia_tax_cents integer not null check (philadelphia_tax_cents >= 0),
  issue_code_counts jsonb not null default '{}'::jsonb,
  template_version integer not null default 1 check (template_version = 1),
  source_fingerprint text not null,
  payload_sha256 text not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  claim_token uuid,
  claimed_until timestamptz,
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  delivery_uncertain_at timestamptz,
  snapshot_conflict_at timestamptz,
  provider_message_id text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (to_char(period_end, 'MM-DD') in ('03-31', '06-30', '09-30', '12-31')),
  check (due_date > period_end and due_date <= period_end + 31),
  check ((ready and issue_count = 0) or (not ready and issue_count > 0)),
  check (jsonb_typeof(issue_code_counts) = 'object'),
  check (source_fingerprint ~ '^[a-f0-9]{64}$'),
  check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  check ((claim_token is null) = (claimed_until is null)),
  check (provider_message_id is null or length(provider_message_id) <= 255),
  check (last_error_code is null or last_error_code ~ '^[A-Za-z0-9_-]{1,100}$')
);

alter table public.store_pa_quarterly_report_notifications
  add column if not exists snapshot_conflict_at timestamptz;

create or replace function public.prepare_store_pa_quarterly_report_notification(
  p_period_end date,
  p_due_date date,
  p_scheduled_for timestamptz,
  p_ready boolean,
  p_included_sales integer,
  p_excluded_sales integer,
  p_issue_count integer,
  p_pa_gross_sales_cents integer,
  p_pa_taxable_sales_cents integer,
  p_state_tax_cents integer,
  p_allegheny_tax_cents integer,
  p_philadelphia_tax_cents integer,
  p_issue_code_counts jsonb,
  p_source_fingerprint text,
  p_payload_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.store_pa_quarterly_report_notifications%rowtype;
begin
  if p_period_end is null or p_due_date is null or p_scheduled_for is null then
    raise exception 'A filing period, due date, and schedule are required.';
  end if;
  if to_char(p_period_end, 'MM-DD') not in ('03-31', '06-30', '09-30', '12-31')
     or p_due_date <= p_period_end
     or p_due_date > p_period_end + 31 then
    raise exception 'The quarterly filing schedule is invalid.';
  end if;
  if p_ready is null
     or p_included_sales is null or p_included_sales < 0
     or p_excluded_sales is null or p_excluded_sales < 0
     or p_issue_count is null or p_issue_count < 0
     or (p_ready and p_issue_count <> 0)
     or (not p_ready and p_issue_count = 0)
     or p_pa_gross_sales_cents is null or p_pa_gross_sales_cents < 0
     or p_pa_taxable_sales_cents is null or p_pa_taxable_sales_cents < 0
     or p_state_tax_cents is null or p_state_tax_cents < 0
     or p_allegheny_tax_cents is null or p_allegheny_tax_cents < 0
     or p_philadelphia_tax_cents is null or p_philadelphia_tax_cents < 0 then
    raise exception 'The quarterly report snapshot is invalid.';
  end if;
  if p_issue_code_counts is null or jsonb_typeof(p_issue_code_counts) <> 'object'
     or p_source_fingerprint !~ '^[a-f0-9]{64}$'
     or p_payload_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'The quarterly report evidence is invalid.';
  end if;

  insert into public.store_pa_quarterly_report_notifications (
    period_end, due_date, scheduled_for, ready, included_sales, excluded_sales,
    issue_count, pa_gross_sales_cents, pa_taxable_sales_cents, state_tax_cents,
    allegheny_tax_cents, philadelphia_tax_cents, issue_code_counts,
    source_fingerprint, payload_sha256
  ) values (
    p_period_end, p_due_date, p_scheduled_for, p_ready, p_included_sales,
    p_excluded_sales, p_issue_count, p_pa_gross_sales_cents,
    p_pa_taxable_sales_cents, p_state_tax_cents, p_allegheny_tax_cents,
    p_philadelphia_tax_cents, p_issue_code_counts, p_source_fingerprint,
    p_payload_sha256
  )
  on conflict (period_end) do nothing;

  select notifications.*
    into v_existing
    from public.store_pa_quarterly_report_notifications as notifications
   where notifications.period_end = p_period_end
   for update;

  if v_existing.due_date is distinct from p_due_date
     or v_existing.scheduled_for is distinct from p_scheduled_for
     or v_existing.ready is distinct from p_ready
     or v_existing.included_sales is distinct from p_included_sales
     or v_existing.excluded_sales is distinct from p_excluded_sales
     or v_existing.issue_count is distinct from p_issue_count
     or v_existing.pa_gross_sales_cents is distinct from p_pa_gross_sales_cents
     or v_existing.pa_taxable_sales_cents is distinct from p_pa_taxable_sales_cents
     or v_existing.state_tax_cents is distinct from p_state_tax_cents
     or v_existing.allegheny_tax_cents is distinct from p_allegheny_tax_cents
     or v_existing.philadelphia_tax_cents is distinct from p_philadelphia_tax_cents
     or v_existing.issue_code_counts is distinct from p_issue_code_counts
     or v_existing.source_fingerprint is distinct from p_source_fingerprint
     or v_existing.payload_sha256 is distinct from p_payload_sha256 then
    update public.store_pa_quarterly_report_notifications as notifications
       set snapshot_conflict_at = coalesce(
             notifications.snapshot_conflict_at,
             now()
           ),
           claim_token = null,
           claimed_until = null,
           last_error_code = 'pa_quarterly_report_snapshot_conflict'
     where notifications.period_end = p_period_end
     returning notifications.* into v_existing;
  end if;

  return jsonb_build_object(
    'status', case
      when v_existing.snapshot_conflict_at is not null then 'manual'
      when v_existing.sent_at is not null then 'sent'
      else 'prepared'
    end,
    'snapshot', jsonb_build_object(
      'periodEnd', v_existing.period_end,
      'dueDate', v_existing.due_date,
      'scheduledFor', v_existing.scheduled_for,
      'ready', v_existing.ready,
      'includedSales', v_existing.included_sales,
      'excludedSales', v_existing.excluded_sales,
      'issueCount', v_existing.issue_count,
      'paGrossSalesCents', v_existing.pa_gross_sales_cents,
      'paTaxableSalesCents', v_existing.pa_taxable_sales_cents,
      'stateTaxCents', v_existing.state_tax_cents,
      'alleghenyTaxCents', v_existing.allegheny_tax_cents,
      'philadelphiaTaxCents', v_existing.philadelphia_tax_cents,
      'issueCodeCounts', v_existing.issue_code_counts,
      'sourceFingerprint', v_existing.source_fingerprint,
      'payloadSha256', v_existing.payload_sha256,
      'templateVersion', v_existing.template_version
    )
  );
end;
$$;

drop trigger if exists set_store_pa_quarterly_report_notifications_updated_at
  on public.store_pa_quarterly_report_notifications;
create trigger set_store_pa_quarterly_report_notifications_updated_at
before update on public.store_pa_quarterly_report_notifications
for each row execute function public.set_store_order_updated_at();

create or replace function public.get_store_pa_quarterly_report_notification(
  p_period_end date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_notification public.store_pa_quarterly_report_notifications%rowtype;
begin
  select notifications.*
    into v_notification
    from public.store_pa_quarterly_report_notifications as notifications
   where notifications.period_end = p_period_end;

  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  return jsonb_build_object(
    'status', case
      when v_notification.snapshot_conflict_at is not null then 'manual'
      when v_notification.sent_at is not null then 'sent'
      when v_notification.delivery_uncertain_at is not null then 'manual'
      else 'prepared'
    end,
    'snapshot', jsonb_build_object(
      'periodEnd', v_notification.period_end,
      'dueDate', v_notification.due_date,
      'scheduledFor', v_notification.scheduled_for,
      'ready', v_notification.ready,
      'includedSales', v_notification.included_sales,
      'excludedSales', v_notification.excluded_sales,
      'issueCount', v_notification.issue_count,
      'paGrossSalesCents', v_notification.pa_gross_sales_cents,
      'paTaxableSalesCents', v_notification.pa_taxable_sales_cents,
      'stateTaxCents', v_notification.state_tax_cents,
      'alleghenyTaxCents', v_notification.allegheny_tax_cents,
      'philadelphiaTaxCents', v_notification.philadelphia_tax_cents,
      'issueCodeCounts', v_notification.issue_code_counts,
      'sourceFingerprint', v_notification.source_fingerprint,
      'payloadSha256', v_notification.payload_sha256,
      'templateVersion', v_notification.template_version
    )
  );
end;
$$;

create or replace function public.list_store_pa_quarterly_report_orders(
  p_period_start timestamptz,
  p_period_end_exclusive timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
  v_orders jsonb;
begin
  if p_period_start is null
     or p_period_end_exclusive is null
     or p_period_start >= p_period_end_exclusive
     or p_period_end_exclusive > p_period_start + interval '100 days' then
    raise exception 'The quarterly report interval is invalid.';
  end if;

  -- Refuse to freeze a ledger until every Checkout Session created before the
  -- boundary has had at least its maximum 24-hour lifetime to resolve. The
  -- Worker waits longer than this, and the reservation check below proves the
  -- independent Stripe reconciler has reached a terminal state for the edge.
  if now() < p_period_end_exclusive + interval '24 hours' then
    raise exception 'The quarterly report source settlement window is open.';
  end if;

  if exists (
    select 1
      from public.store_orders as reservations
     where reservations.inventory_state = 'reserved'
       and reservations.created_at >= p_period_start - interval '24 hours'
       and reservations.created_at < p_period_end_exclusive
  ) then
    raise exception 'The quarterly report source ledger is not settled.';
  end if;

  select count(*)
    into v_count
    from public.store_orders as orders
   where (
       orders.paid_at >= p_period_start
       and orders.paid_at < p_period_end_exclusive
     )
     or (
       orders.amount_refunded_cents > 0
       and orders.refunded_at >= p_period_start
       and orders.refunded_at < p_period_end_exclusive
     )
     or (
       orders.dispute_id is not null
       and orders.dispute_updated_at >= p_period_start
       and orders.dispute_updated_at < p_period_end_exclusive
     )
     or exists (
       select 1
         from public.store_refunds as refunds
        where refunds.order_id = orders.id
          and refunds.status = 'succeeded'
          and (
            (
              refunds.provider_created_at >= p_period_start
              and refunds.provider_created_at < p_period_end_exclusive
            )
            or (
              refunds.provider_updated_at >= p_period_start
              and refunds.provider_updated_at < p_period_end_exclusive
            )
          )
     );

  if v_count > 5000 then
    raise exception 'The quarterly report exceeds its safe row limit.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'paid_at', orders.paid_at,
        'refunded_at', orders.refunded_at,
        'shipping_address', case
          when orders.shipping_address is null then null
          else jsonb_build_object(
            'address', jsonb_build_object(
              'city', coalesce(
                orders.shipping_address #>> '{address,city}',
                orders.shipping_address ->> 'city'
              ),
              'state', coalesce(
                orders.shipping_address #>> '{address,state}',
                orders.shipping_address ->> 'state'
              ),
              'postal_code', coalesce(
                orders.shipping_address #>> '{address,postal_code}',
                orders.shipping_address ->> 'postal_code'
              ),
              'country', coalesce(
                orders.shipping_address #>> '{address,country}',
                orders.shipping_address ->> 'country'
              )
            )
          )
        end,
        'currency', orders.currency,
        'subtotal_cents', orders.subtotal_cents,
        'production_cents', orders.production_cents,
        'fulfillment_method', orders.fulfillment_method,
        'pickup_location', orders.pickup_location,
        'shipping_cents', orders.shipping_cents,
        'tax_cents', orders.tax_cents,
        'total_cents', orders.total_cents,
        'amount_refunded_cents', orders.amount_refunded_cents,
        'payment_status', orders.payment_status,
        'payment_livemode', orders.payment_livemode,
        'has_dispute', orders.dispute_id is not null,
        'dispute_updated_at', orders.dispute_updated_at,
        'store_order_items', coalesce((
          select jsonb_agg(
            jsonb_build_object('line_total_cents', items.line_total_cents)
            order by items.id
          )
            from public.store_order_items as items
           where items.order_id = orders.id
        ), '[]'::jsonb),
        'store_refunds', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'amount_cents', refunds.amount_cents,
              'currency', refunds.currency,
              'status', refunds.status,
              'provider_created_at', refunds.provider_created_at,
              'provider_updated_at', refunds.provider_updated_at
            )
            order by refunds.provider_updated_at, refunds.id
          )
            from public.store_refunds as refunds
           where refunds.order_id = orders.id
        ), '[]'::jsonb)
      )
      order by orders.created_at, orders.id
    ),
    '[]'::jsonb
  )
    into v_orders
    from public.store_orders as orders
   where (
       orders.paid_at >= p_period_start
       and orders.paid_at < p_period_end_exclusive
     )
     or (
       orders.amount_refunded_cents > 0
       and orders.refunded_at >= p_period_start
       and orders.refunded_at < p_period_end_exclusive
     )
     or (
       orders.dispute_id is not null
       and orders.dispute_updated_at >= p_period_start
       and orders.dispute_updated_at < p_period_end_exclusive
     )
     or exists (
       select 1
         from public.store_refunds as refunds
        where refunds.order_id = orders.id
          and refunds.status = 'succeeded'
          and (
            (
              refunds.provider_created_at >= p_period_start
              and refunds.provider_created_at < p_period_end_exclusive
            )
            or (
              refunds.provider_updated_at >= p_period_start
              and refunds.provider_updated_at < p_period_end_exclusive
            )
          )
     );

  return v_orders;
end;
$$;

create or replace function public.claim_store_pa_quarterly_report_notification(
  p_period_end date,
  p_due_date date,
  p_claim_token uuid,
  p_lease_seconds integer default 300
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_notification public.store_pa_quarterly_report_notifications%rowtype;
begin
  if p_period_end is null or p_due_date is null or p_claim_token is null then
    raise exception 'A filing period, due date, and claim token are required.';
  end if;
  if to_char(p_period_end, 'MM-DD') not in ('03-31', '06-30', '09-30', '12-31')
     or p_due_date <= p_period_end
     or p_due_date > p_period_end + 31 then
    raise exception 'The quarterly filing schedule is invalid.';
  end if;
  if p_lease_seconds is null or p_lease_seconds not between 30 and 900 then
    raise exception 'Quarterly report lease must be between 30 and 900 seconds.';
  end if;

  select notifications.*
    into v_notification
    from public.store_pa_quarterly_report_notifications as notifications
   where notifications.period_end = p_period_end
   for update;

  if not found then
    return 'missing';
  end if;
  if v_notification.due_date <> p_due_date then
    return 'drift';
  end if;
  if v_notification.sent_at is not null then
    return 'sent';
  end if;
  if v_notification.snapshot_conflict_at is not null then
    update public.store_pa_quarterly_report_notifications
       set claim_token = null,
           claimed_until = null
     where period_end = p_period_end;
    return 'manual';
  end if;
  if v_notification.delivery_uncertain_at is not null
     or (
       v_notification.first_attempt_at is not null
       and v_notification.first_attempt_at < now() - interval '23 hours'
     ) then
    update public.store_pa_quarterly_report_notifications
       set delivery_uncertain_at = coalesce(delivery_uncertain_at, now()),
           claim_token = null,
           claimed_until = null
     where period_end = p_period_end;
    return 'manual';
  end if;
  if v_notification.claim_token is not null
     and v_notification.claimed_until > now()
     and v_notification.claim_token <> p_claim_token then
    return 'busy';
  end if;

  update public.store_pa_quarterly_report_notifications
     set claim_token = p_claim_token,
         claimed_until = now() + make_interval(secs => p_lease_seconds),
         first_attempt_at = coalesce(first_attempt_at, now()),
         last_attempt_at = now(),
         attempt_count = attempt_count + 1,
         last_error_code = null
   where period_end = p_period_end;

  return 'claimed';
end;
$$;

create or replace function public.complete_store_pa_quarterly_report_notification(
  p_period_end date,
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
  update public.store_pa_quarterly_report_notifications
     set sent_at = coalesce(sent_at, now()),
         provider_message_id = coalesce(
           nullif(left(trim(p_provider_message_id), 255), ''),
           provider_message_id
         ),
         claim_token = null,
         claimed_until = null,
         last_error_code = null
   where period_end = p_period_end
     and sent_at is null
     and claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.release_store_pa_quarterly_report_notification(
  p_period_end date,
  p_claim_token uuid,
  p_failure_code text default 'pa_quarterly_report_failed'
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_failure_code text := coalesce(
    nullif(left(trim(p_failure_code), 100), ''),
    'pa_quarterly_report_failed'
  );
  v_updated integer;
begin
  if v_failure_code !~ '^[A-Za-z0-9_-]{1,100}$' then
    v_failure_code := 'pa_quarterly_report_failed';
  end if;

  update public.store_pa_quarterly_report_notifications
     set claim_token = null,
         claimed_until = null,
         last_error_code = v_failure_code
   where period_end = p_period_end
     and sent_at is null
     and claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.check_store_pa_quarterly_report_contract_v1()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_function text;
begin
  if to_regclass('public.store_pa_quarterly_report_notifications') is null
     or not exists (
      select 1
        from information_schema.columns
       where table_schema = 'public'
         and table_name = 'store_pa_quarterly_report_notifications'
         and column_name = 'snapshot_conflict_at'
     )
     or not exists (
       select 1
         from pg_class as relations
         join pg_namespace as namespaces
           on namespaces.oid = relations.relnamespace
        where namespaces.nspname = 'public'
          and relations.relname = 'store_pa_quarterly_report_notifications'
          and relations.relrowsecurity is true
     )
     or to_regprocedure(
      'public.get_store_pa_quarterly_report_notification(date)'
     ) is null
     or to_regprocedure(
      'public.list_store_pa_quarterly_report_orders(timestamp with time zone,timestamp with time zone)'
     ) is null
     or to_regprocedure(
      'public.claim_store_pa_quarterly_report_notification(date,date,uuid,integer)'
     ) is null
     or to_regprocedure(
      'public.prepare_store_pa_quarterly_report_notification(date,date,timestamp with time zone,boolean,integer,integer,integer,integer,integer,integer,integer,integer,jsonb,text,text)'
     ) is null
     or to_regprocedure(
      'public.complete_store_pa_quarterly_report_notification(date,uuid,text)'
     ) is null
     or to_regprocedure(
      'public.release_store_pa_quarterly_report_notification(date,uuid,text)'
     ) is null then
    return false;
  end if;

  if has_table_privilege(
       'anon', 'public.store_pa_quarterly_report_notifications', 'SELECT'
     )
     or has_table_privilege(
       'authenticated', 'public.store_pa_quarterly_report_notifications', 'SELECT'
     )
     or has_table_privilege(
       'service_role', 'public.store_pa_quarterly_report_notifications', 'SELECT'
     )
     or has_table_privilege(
       'service_role', 'public.store_pa_quarterly_report_notifications', 'INSERT'
     )
     or has_table_privilege(
       'service_role', 'public.store_pa_quarterly_report_notifications', 'UPDATE'
     )
     or has_table_privilege(
       'service_role', 'public.store_pa_quarterly_report_notifications', 'DELETE'
     ) then
    return false;
  end if;

  foreach v_function in array array[
    'public.get_store_pa_quarterly_report_notification(date)',
    'public.list_store_pa_quarterly_report_orders(timestamp with time zone,timestamp with time zone)',
    'public.claim_store_pa_quarterly_report_notification(date,date,uuid,integer)',
    'public.prepare_store_pa_quarterly_report_notification(date,date,timestamp with time zone,boolean,integer,integer,integer,integer,integer,integer,integer,integer,jsonb,text,text)',
    'public.complete_store_pa_quarterly_report_notification(date,uuid,text)',
    'public.release_store_pa_quarterly_report_notification(date,uuid,text)',
    'public.check_store_pa_quarterly_report_contract_v1()'
  ] loop
    if has_function_privilege('anon', v_function, 'EXECUTE')
       or has_function_privilege('authenticated', v_function, 'EXECUTE')
       or not has_function_privilege('service_role', v_function, 'EXECUTE') then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

alter table public.store_pa_quarterly_report_notifications enable row level security;

drop policy if exists store_pa_quarterly_report_notifications_private
  on public.store_pa_quarterly_report_notifications;
create policy store_pa_quarterly_report_notifications_private
  on public.store_pa_quarterly_report_notifications
  for all using (false) with check (false);

revoke all on public.store_pa_quarterly_report_notifications
  from public, anon, authenticated, service_role;
revoke all on function public.get_store_pa_quarterly_report_notification(date)
  from public, anon, authenticated;
revoke all on function public.list_store_pa_quarterly_report_orders(
  timestamptz, timestamptz
) from public, anon, authenticated;
revoke all on function public.claim_store_pa_quarterly_report_notification(
  date, date, uuid, integer
) from public, anon, authenticated;
revoke all on function public.prepare_store_pa_quarterly_report_notification(
  date, date, timestamptz, boolean, integer, integer, integer, integer,
  integer, integer, integer, integer, jsonb, text, text
) from public, anon, authenticated;
revoke all on function public.complete_store_pa_quarterly_report_notification(
  date, uuid, text
) from public, anon, authenticated;
revoke all on function public.release_store_pa_quarterly_report_notification(
  date, uuid, text
) from public, anon, authenticated;
revoke all on function public.check_store_pa_quarterly_report_contract_v1()
  from public, anon, authenticated;

grant execute on function public.claim_store_pa_quarterly_report_notification(
  date, date, uuid, integer
) to service_role;
grant execute on function public.get_store_pa_quarterly_report_notification(date)
  to service_role;
grant execute on function public.list_store_pa_quarterly_report_orders(
  timestamptz, timestamptz
) to service_role;
grant execute on function public.prepare_store_pa_quarterly_report_notification(
  date, date, timestamptz, boolean, integer, integer, integer, integer,
  integer, integer, integer, integer, jsonb, text, text
) to service_role;
grant execute on function public.complete_store_pa_quarterly_report_notification(
  date, uuid, text
) to service_role;
grant execute on function public.release_store_pa_quarterly_report_notification(
  date, uuid, text
) to service_role;
grant execute on function public.check_store_pa_quarterly_report_contract_v1()
  to service_role;

comment on table public.store_pa_quarterly_report_notifications is
  'Private frozen aggregate and once-per-quarter delivery state for PA sales-tax preparation emails; contains no tax account, bank, customer, order, or payment identifiers.';

commit;
