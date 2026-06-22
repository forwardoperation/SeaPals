create extension if not exists pgcrypto;

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_slug text not null default 'seapals-main',
  respondent_name text not null,
  respondent_age integer,
  answers jsonb not null default '{}'::jsonb,
  reward_status text not null default 'pending'
    check (reward_status in ('pending', 'counted', 'void')),
  submitted_at timestamptz not null default now()
);

create index if not exists survey_responses_survey_slug_idx
  on public.survey_responses (survey_slug);

create index if not exists survey_responses_submitted_at_idx
  on public.survey_responses (submitted_at desc);

alter table public.survey_responses enable row level security;

drop policy if exists "Survey responses are inserted by server routes" on public.survey_responses;
drop policy if exists "Survey responses are private" on public.survey_responses;

create policy "Survey responses are private"
  on public.survey_responses
  for all
  using (false)
  with check (false);

