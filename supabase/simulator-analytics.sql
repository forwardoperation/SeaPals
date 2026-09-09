-- Run once in the Supabase SQL editor before enabling the Simulator V2 dashboard.
-- Server service-role access only. The public API exposes aggregate statistics.
begin;

create table if not exists public.simulator_analytics_matches (
  id uuid primary key,
  completed_at timestamptz not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  human_deck_id text not null check (char_length(human_deck_id) between 1 and 100),
  ai_deck_id text not null check (char_length(ai_deck_id) between 1 and 100),
  report jsonb not null check (
    jsonb_typeof(report) = 'object' and octet_length(report::text) <= 128000
    and report->>'schemaVersion' = '1' and report->>'simulatorVersion' = 'v2'
    and report->>'mode' = 'standard' and report->>'winner' in ('player', 'opponent', 'draw')
    and jsonb_array_length(report->'players') = 2
  ),
  received_at timestamptz not null default now()
);
create index if not exists simulator_analytics_completed_idx on public.simulator_analytics_matches (completed_at desc, id desc);
create index if not exists simulator_analytics_difficulty_idx on public.simulator_analytics_matches (difficulty, completed_at desc);
create index if not exists simulator_analytics_human_deck_idx on public.simulator_analytics_matches (human_deck_id, completed_at desc);
create index if not exists simulator_analytics_ai_deck_idx on public.simulator_analytics_matches (ai_deck_id, completed_at desc);

-- This table is deliberately separate from match reports, with no join key.
-- Hashes rotate daily and expired buckets are removed during submissions.
create table if not exists public.simulator_analytics_submission_limits (
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  hour_start timestamptz not null,
  reports integer not null check (reports between 0 and 30),
  primary key (source_hash, hour_start)
);
create index if not exists simulator_analytics_limits_expiry_idx on public.simulator_analytics_submission_limits (hour_start);

alter table public.simulator_analytics_matches enable row level security;
alter table public.simulator_analytics_submission_limits enable row level security;
revoke all on public.simulator_analytics_matches from public, anon, authenticated;
revoke all on public.simulator_analytics_submission_limits from public, anon, authenticated;
grant select, insert on public.simulator_analytics_matches to service_role;

create or replace function public.submit_simulator_analytics(report jsonb, source_hash text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  match_id uuid := (report->>'id')::uuid;
  bucket timestamptz := date_trunc('hour', now());
  report_count integer;
  inserted_id uuid;
begin
  if source_hash is null or source_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid submission source';
  end if;
  -- A retry never consumes quota or changes an existing match.
  if exists (select 1 from public.simulator_analytics_matches where id = match_id) then
    return 'duplicate';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(source_hash, 0));
  delete from public.simulator_analytics_submission_limits where hour_start < now() - interval '2 days';
  insert into public.simulator_analytics_submission_limits as limits (source_hash, hour_start, reports)
    values (submit_simulator_analytics.source_hash, bucket, 0)
    on conflict on constraint simulator_analytics_submission_limits_pkey do nothing;
  select limits.reports into report_count from public.simulator_analytics_submission_limits as limits
    where limits.source_hash = submit_simulator_analytics.source_hash and limits.hour_start = bucket;
  if report_count >= 30 then return 'rate_limited'; end if;
  insert into public.simulator_analytics_matches (id, completed_at, difficulty, human_deck_id, ai_deck_id, report)
    values (match_id, (report->>'completedAt')::timestamptz, report->>'difficulty',
      report->'players'->0->>'deckId', report->'players'->1->>'deckId', report)
    on conflict (id) do nothing returning id into inserted_id;
  if inserted_id is null then return 'duplicate'; end if;
  update public.simulator_analytics_submission_limits as limits set reports = limits.reports + 1
    where limits.source_hash = submit_simulator_analytics.source_hash and limits.hour_start = bucket;
  return 'saved';
end;
$$;
revoke all on function public.submit_simulator_analytics(jsonb, text) from public, anon, authenticated;
grant execute on function public.submit_simulator_analytics(jsonb, text) to service_role;

comment on table public.simulator_analytics_matches is 'Anonymous completed standard Simulator V2 match counters. No account ID, player name, raw logs, IP address or custom deck names.';
comment on table public.simulator_analytics_submission_limits is 'Short-lived daily HMAC hashes for hourly submission quotas; not linked to matches.';
commit;
