create table if not exists public.adventure_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null
    check (profile_id in ('profile-1', 'profile-2', 'profile-3')),
  payload jsonb,
  schema_version integer not null
    check (schema_version >= 1),
  cloud_version bigint not null
    check (cloud_version between 1 and 9007199254740991),
  canonical_hash text not null
    check (canonical_hash ~ '^[0-9a-f]{64}$'),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object')
    check (octet_length(metadata::text) <= 4096),
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, profile_id),
  constraint adventure_saves_payload_state_check check (
    (deleted = true and payload is null)
    or
    (
      deleted = false
      and payload is not null
      and jsonb_typeof(payload) = 'object'
      and octet_length(payload::text) <= 262144
      and payload ? 'schemaVersion'
      and payload ? 'profileId'
      and payload -> 'schemaVersion' = to_jsonb(schema_version)
      and payload -> 'profileId' = to_jsonb(profile_id)
    )
  )
);

create index if not exists adventure_saves_user_updated_at_idx
  on public.adventure_saves (user_id, updated_at desc);

-- History exists solely for short-term disaster recovery. The live table is
-- the sync authority (including permanent tombstones); archived rows expire.
create table if not exists public.adventure_save_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null
    check (profile_id in ('profile-1', 'profile-2', 'profile-3')),
  payload jsonb,
  schema_version integer not null
    check (schema_version >= 1),
  cloud_version bigint not null
    check (cloud_version between 1 and 9007199254740991),
  canonical_hash text not null
    check (canonical_hash ~ '^[0-9a-f]{64}$'),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object')
    check (octet_length(metadata::text) <= 4096),
  deleted boolean not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  archived_at timestamptz not null default now(),
  constraint adventure_save_history_payload_state_check check (
    (deleted = true and payload is null)
    or
    (
      deleted = false
      and payload is not null
      and jsonb_typeof(payload) = 'object'
      and octet_length(payload::text) <= 262144
      and payload ? 'schemaVersion'
      and payload ? 'profileId'
      and payload -> 'schemaVersion' = to_jsonb(schema_version)
      and payload -> 'profileId' = to_jsonb(profile_id)
    )
  )
);

create index if not exists adventure_save_history_user_profile_archived_idx
  on public.adventure_save_history (user_id, profile_id, archived_at desc);

create index if not exists adventure_save_history_archived_at_idx
  on public.adventure_save_history (archived_at);

create or replace function public.archive_adventure_save_revision()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  insert into public.adventure_save_history (
    user_id,
    profile_id,
    payload,
    schema_version,
    cloud_version,
    canonical_hash,
    metadata,
    deleted,
    created_at,
    updated_at
  )
  values (
    old.user_id,
    old.profile_id,
    old.payload,
    old.schema_version,
    old.cloud_version,
    old.canonical_hash,
    old.metadata,
    old.deleted,
    old.created_at,
    old.updated_at
  );
  return new;
end;
$$;

drop trigger if exists adventure_saves_archive_revision
  on public.adventure_saves;
create trigger adventure_saves_archive_revision
before update on public.adventure_saves
for each row execute function public.archive_adventure_save_revision();

create or replace function public.set_adventure_save_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists adventure_saves_set_updated_at
  on public.adventure_saves;
create trigger adventure_saves_set_updated_at
before update on public.adventure_saves
for each row execute function public.set_adventure_save_updated_at();

alter table public.adventure_saves enable row level security;
alter table public.adventure_saves force row level security;

alter table public.adventure_save_history enable row level security;
alter table public.adventure_save_history force row level security;

drop policy if exists "Adventure save history is private"
  on public.adventure_save_history;
create policy "Adventure save history is private"
  on public.adventure_save_history
  for all
  using (false)
  with check (false);

drop policy if exists "Adventure saves are selected by their owner"
  on public.adventure_saves;
create policy "Adventure saves are selected by their owner"
  on public.adventure_saves
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Adventure saves are inserted by their owner"
  on public.adventure_saves;
create policy "Adventure saves are inserted by their owner"
  on public.adventure_saves
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Adventure saves are updated by their owner"
  on public.adventure_saves;
create policy "Adventure saves are updated by their owner"
  on public.adventure_saves
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.adventure_saves from anon, authenticated;
grant select, insert, update on table public.adventure_saves to authenticated;

revoke all on table public.adventure_save_history from anon, authenticated;
revoke all on table public.adventure_save_history from public;
revoke all on sequence public.adventure_save_history_id_seq from anon, authenticated;
revoke all on sequence public.adventure_save_history_id_seq from public;

create or replace function public.prune_adventure_save_history()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  pruned_count bigint;
begin
  delete from public.adventure_save_history
  where archived_at < now() - interval '30 days';

  get diagnostics pruned_count = row_count;
  return pruned_count;
end;
$$;

revoke all on function public.set_adventure_save_updated_at() from public;
revoke all on function public.archive_adventure_save_revision() from public;
revoke all on function public.prune_adventure_save_history() from public;
revoke all on function public.set_adventure_save_updated_at()
  from anon, authenticated;
revoke all on function public.archive_adventure_save_revision()
  from anon, authenticated;
revoke all on function public.prune_adventure_save_history()
  from anon, authenticated;
grant execute on function public.prune_adventure_save_history() to service_role;
