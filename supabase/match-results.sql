create table if not exists public.match_results (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  deck_a_id uuid not null references public.deck_submissions(id) on delete cascade,
  deck_b_id uuid not null references public.deck_submissions(id) on delete cascade,
  winner_deck_id uuid references public.deck_submissions(id) on delete set null,
  notes text default '' not null,
  created_at timestamptz default now() not null,
  constraint match_results_distinct_decks check (deck_a_id <> deck_b_id)
);

alter table public.tournaments
  add column if not exists bracket_seed_order uuid[] not null default '{}'::uuid[];

alter table public.match_results enable row level security;

drop policy if exists "Allow public match result reads for testing"
  on public.match_results;

create policy "Allow public match result reads for testing"
on public.match_results
for select
using (true);

create index if not exists match_results_tournament_id_idx
  on public.match_results (tournament_id);

create index if not exists match_results_deck_a_id_idx
  on public.match_results (deck_a_id);

create index if not exists match_results_deck_b_id_idx
  on public.match_results (deck_b_id);

create or replace function public.create_match_result(
  match_deck_a_id uuid,
  match_deck_b_id uuid,
  match_tournament_id uuid,
  match_winner_deck_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_match_id uuid;
begin
  insert into public.match_results (
    tournament_id,
    deck_a_id,
    deck_b_id,
    winner_deck_id
  )
  values (
    create_match_result.match_tournament_id,
    create_match_result.match_deck_a_id,
    create_match_result.match_deck_b_id,
    create_match_result.match_winner_deck_id
  )
  returning id into new_match_id;

  return new_match_id;
end;
$$;

grant execute on function public.create_match_result(
  uuid,
  uuid,
  uuid,
  uuid
) to anon, authenticated;

create or replace function public.update_match_result(
  match_deck_a_id uuid,
  match_deck_b_id uuid,
  match_id uuid,
  match_winner_deck_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.match_results
  set
    deck_a_id = update_match_result.match_deck_a_id,
    deck_b_id = update_match_result.match_deck_b_id,
    winner_deck_id = update_match_result.match_winner_deck_id
  where id = update_match_result.match_id;

  get diagnostics updated_count = row_count;

  return updated_count = 1;
end;
$$;

grant execute on function public.update_match_result(
  uuid,
  uuid,
  uuid,
  uuid
) to anon, authenticated;

create or replace function public.delete_match_result(match_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.match_results
  where id = delete_match_result.match_id;

  get diagnostics deleted_count = row_count;

  return deleted_count = 1;
end;
$$;

grant execute on function public.delete_match_result(uuid) to anon, authenticated;

create or replace function public.reseed_tournament_bracket(
  bracket_tournament_id uuid,
  bracket_deck_ids uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  approved_deck_count integer;
  supplied_deck_count integer;
  distinct_deck_count integer;
  invalid_deck_count integer;
  updated_count integer;
begin
  select count(*)
  into approved_deck_count
  from public.deck_submissions
  where tournament_id = reseed_tournament_bracket.bracket_tournament_id
    and status = 'approved';

  select count(deck_id), count(distinct deck_id)
  into supplied_deck_count, distinct_deck_count
  from unnest(reseed_tournament_bracket.bracket_deck_ids)
    as seeded_decks(deck_id);

  select count(*)
  into invalid_deck_count
  from unnest(reseed_tournament_bracket.bracket_deck_ids)
    as seeded_decks(deck_id)
  where deck_id is not null
    and not exists (
      select 1
      from public.deck_submissions
      where id = deck_id
        and tournament_id = reseed_tournament_bracket.bracket_tournament_id
        and status = 'approved'
    );

  if supplied_deck_count <> approved_deck_count
    or distinct_deck_count <> approved_deck_count
    or invalid_deck_count > 0 then
    raise exception 'Bracket order must contain every approved deck exactly once.';
  end if;

  update public.tournaments
  set bracket_seed_order = reseed_tournament_bracket.bracket_deck_ids
  where id = reseed_tournament_bracket.bracket_tournament_id;

  get diagnostics updated_count = row_count;

  if updated_count <> 1 then
    return false;
  end if;

  delete from public.match_results
  where tournament_id = reseed_tournament_bracket.bracket_tournament_id;

  return true;
end;
$$;

grant execute on function public.reseed_tournament_bracket(uuid, uuid[])
  to anon, authenticated;
