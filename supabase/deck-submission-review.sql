create extension if not exists pgcrypto;

alter table public.deck_submissions
  add column if not exists admin_notes text,
  add column if not exists edit_token uuid default gen_random_uuid();

update public.deck_submissions
set admin_notes = ''
where admin_notes is null;

alter table public.deck_submissions
  alter column admin_notes set default '',
  alter column admin_notes set not null;

update public.deck_submissions
set edit_token = gen_random_uuid()
where edit_token is null;

alter table public.deck_submissions
  alter column edit_token set not null;

create unique index if not exists deck_submissions_edit_token_idx
  on public.deck_submissions (edit_token);

create or replace function public.update_deck_submission_with_token(
  submission_id uuid,
  submission_edit_token uuid,
  player_name text,
  player_email text,
  deck_name text,
  deck_cards jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.deck_submissions
  set
    player_name = update_deck_submission_with_token.player_name,
    player_email = update_deck_submission_with_token.player_email,
    deck_name = update_deck_submission_with_token.deck_name,
    cards = update_deck_submission_with_token.deck_cards,
    status = 'pending',
    admin_notes = ''
  where
    id = update_deck_submission_with_token.submission_id
    and edit_token = update_deck_submission_with_token.submission_edit_token;

  get diagnostics updated_count = row_count;

  return updated_count = 1;
end;
$$;

grant execute on function public.update_deck_submission_with_token(
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb
) to anon, authenticated;

create or replace function public.update_deck_submission_review(
  next_status text,
  notes text,
  submission_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.deck_submissions
  set
    status = update_deck_submission_review.next_status,
    admin_notes = coalesce(update_deck_submission_review.notes, '')
  where id = update_deck_submission_review.submission_id;

  get diagnostics updated_count = row_count;

  return updated_count = 1;
end;
$$;

grant execute on function public.update_deck_submission_review(
  text,
  text,
  uuid
) to anon, authenticated;
