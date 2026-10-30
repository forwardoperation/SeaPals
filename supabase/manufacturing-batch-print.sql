-- Apply after manufacturing-receiving.sql. Safe to reapply.
-- Patch only the production milestone predicate, preserving the installed function
-- body, owner and execution grants. This does not change jobs, print leases or stock.
begin;

do $migration$
declare
  target regprocedure := to_regprocedure('public.manufacturing_commit(uuid,uuid,integer,jsonb,jsonb,text)');
  definition text;
  normalized_definition text;
  old_predicate text := $old$if p_event->>'type'='confirm_printed' and p_event->>'side'<>'ticket' then milestone:='in_production'; end if;$old$;
  new_predicate text := $new$if p_event->>'role'='operator' and (p_event->>'type'='glued' or
      (p_event->>'type'='confirm_printed' and p_event->>'side'<>'ticket')) then milestone:='in_production'; end if;$new$;
  old_count integer;
  new_count integer;
begin
  if target is null then raise exception 'manufacturing_commit is missing; apply manufacturing-receiving.sql first'; end if;
  definition := pg_get_functiondef(target);
  -- Windows and SQL-editor line endings must not make a completed patch look unknown.
  normalized_definition := replace(definition,E'\r\n',E'\n');
  new_predicate := replace(new_predicate,E'\r\n',E'\n');
  old_count := (length(definition)-length(replace(definition,old_predicate,'')))/length(old_predicate);
  new_count := (length(normalized_definition)-length(replace(normalized_definition,new_predicate,'')))/length(new_predicate);
  if old_count=1 and new_count=0 then
    execute replace(definition,old_predicate,new_predicate);
  elsif old_count=0 and new_count=1 then
    null; -- Already updated; preserve the installed function unchanged.
  else
    raise exception 'Unexpected manufacturing_commit milestone predicate (legacy %, updated %); inspect before applying',old_count,new_count;
  end if;
end
$migration$;

commit;
