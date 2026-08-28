-- One-time teardown for the retired public tournament and deck-submission system.
-- Applying this file permanently deletes tournament, submission, and match data.
-- Export any records that must be retained before running it against Supabase.

begin;

drop function if exists public.create_match_result(uuid, uuid, uuid, uuid);
drop function if exists public.update_match_result(uuid, uuid, uuid, uuid);
drop function if exists public.delete_match_result(uuid);
drop function if exists public.reseed_tournament_bracket(uuid, uuid[]);
drop function if exists public.update_deck_submission_with_token(
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb
);
drop function if exists public.update_deck_submission_review(text, text, uuid);
drop function if exists public.delete_tournament(uuid);

drop table if exists public.match_results;
drop table if exists public.deck_submissions;
drop table if exists public.tournaments;

commit;
