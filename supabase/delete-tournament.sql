create or replace function public.delete_tournament(tournament_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.match_results
  where match_results.tournament_id = delete_tournament.tournament_id;

  delete from public.deck_submissions
  where deck_submissions.tournament_id = delete_tournament.tournament_id;

  delete from public.tournaments
  where id = delete_tournament.tournament_id;

  get diagnostics deleted_count = row_count;

  return deleted_count = 1;
end;
$$;

grant execute on function public.delete_tournament(uuid) to anon, authenticated;
