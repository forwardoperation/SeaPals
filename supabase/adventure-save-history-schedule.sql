-- Apply after adventure-saves.sql. Runs at 04:17 UTC every day.
-- Only prior revisions older than 30 days are pruned; current saves and
-- deletion tombstones stay in adventure_saves.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'adventure-save-history-prune',
  '17 4 * * *',
  'set role service_role; select public.prune_adventure_save_history(); reset role;'
);
