-- Apply after the existing manufacturing migrations. Safe to reapply.
-- Archives release metadata and briefly blocks publication during verified Storage
-- cleanup. This migration never deletes Storage objects or changes print jobs.
begin;

alter table public.manufacturing_releases add column if not exists archived_at timestamptz;
alter table public.manufacturing_releases add column if not exists archive_ref text;
alter table public.manufacturing_settings add column if not exists artwork_cleanup_token uuid;
alter table public.manufacturing_settings add column if not exists artwork_cleanup_started_at timestamptz;

create or replace function public.manufacturing_assert_artwork_available(p_manifest text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare manifest jsonb:=p_manifest::jsonb; missing text;
begin
  if jsonb_typeof(manifest->'assets') is distinct from 'object' then raise exception 'Release artwork entries are required'; end if;
  if exists(select 1 from jsonb_each(manifest->'assets') a where
    jsonb_typeof(a.value) is distinct from 'object' or
    coalesce(a.value->>'sha256','') !~ '^[a-f0-9]{64}$' or
    a.value->>'path' is distinct from 'manufacturing/sha256/'||(a.value->>'sha256')||'.png') then
    raise exception 'Invalid private artwork entry';
  end if;
  select a.key into missing from jsonb_each(manifest->'assets') a where not exists(
    select 1 from storage.objects o where o.bucket_id='searealm-manufacturing-private'
      and o.name='manufacturing/sha256/'||(a.value->>'sha256')||'.png') limit 1;
  if missing is not null then raise exception 'Private artwork is missing for asset %; restore it before publishing',missing; end if;
end $$;

create or replace function public.manufacturing_publish(p_id text,p_manifest text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare settings manufacturing_settings;
begin
  -- Cleanup takes this same lock before inspecting release and job references.
  select * into settings from manufacturing_settings where id for update;
  if not found then raise exception 'Manufacturing settings are missing'; end if;
  if settings.artwork_cleanup_token is not null then raise exception 'Artwork cleanup is active; publish after cleanup finishes'; end if;
  if exists(select 1 from manufacturing_releases where id=p_id and archived_at is not null) then
    raise exception 'Release is archived; restore all artwork before explicitly restoring the release';
  end if;
  if p_manifest::jsonb->>'releaseId' is distinct from p_id then raise exception 'Release identity does not match'; end if;
  -- API HEAD checks precede this transaction and cannot close a deletion race.
  perform manufacturing_assert_artwork_available(p_manifest);
  insert into manufacturing_releases(id,manifest_text) values(p_id,p_manifest) on conflict do nothing;
  if (select manifest_text from manufacturing_releases where id=p_id)<>p_manifest then raise exception 'Release is immutable; choose a new ID'; end if;
  update manufacturing_settings set active_release=p_id where id;
end $$;

-- Also guard direct service-role writes and an old publish invocation that
-- was already running when this migration was installed.
create or replace function public.manufacturing_guard_artwork_references() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare release manufacturing_releases; cleanup uuid;
begin
  if tg_table_name='manufacturing_releases' then
    -- The cleanup transaction drains release writes before checking references.
    select artwork_cleanup_token into cleanup from manufacturing_settings where id;
    if cleanup is not null then raise exception 'Artwork cleanup is active; release changes are blocked'; end if;
    if tg_op='UPDATE' and (new.id is distinct from old.id or new.manifest_text is distinct from old.manifest_text) then
      raise exception 'Release is immutable; choose a new ID';
    end if;
    if (new.archived_at is null)<>(new.archive_ref is null) or
      (new.archive_ref is not null and (new.archive_ref<>trim(new.archive_ref) or length(new.archive_ref) not between 1 and 2048)) then
      raise exception 'Archive timestamp and verified reference must be set or cleared together';
    end if;
    if new.archived_at is not null then
      -- Serializes an explicit metadata archive with activations and new job pins.
      -- The cleanup RPC already owns these locks in the same settings-first order.
      select artwork_cleanup_token into cleanup from manufacturing_settings where id for update;
      if cleanup is not null then raise exception 'Artwork cleanup is active; release changes are blocked'; end if;
      lock table manufacturing_orders in share row exclusive mode;
      if exists(select 1 from manufacturing_settings where id and active_release=new.id) then
        raise exception 'The active release cannot be archived';
      end if;
      if exists(select 1 from manufacturing_orders m where m.release_id=new.id
        or m.manifest_text::jsonb->>'artworkRelease'=new.id) then
        raise exception 'A print job pins this artwork release';
      end if;
    else
      -- Clearing archive metadata is a restore and requires every private object.
      perform manufacturing_assert_artwork_available(new.manifest_text);
    end if;
  elsif tg_table_name='manufacturing_settings' then
    if new.artwork_cleanup_token is not null then raise exception 'Artwork cleanup is active; activation is blocked'; end if;
    if new.active_release is not null then
      select * into release from manufacturing_releases where id=new.active_release;
      if release.archived_at is not null then raise exception 'Archived artwork cannot be activated'; end if;
      if release.id is not null then perform manufacturing_assert_artwork_available(release.manifest_text); end if;
    end if;
  else
    -- Current, intact releases remain usable for new preparation during cleanup.
    for release in select * from manufacturing_releases r where
      r.id=new.release_id or r.id=new.manifest_text::jsonb->>'artworkRelease' loop
      if release.archived_at is not null then raise exception 'Archived artwork cannot be pinned to a print job'; end if;
      perform manufacturing_assert_artwork_available(release.manifest_text);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists manufacturing_guard_artwork_release on public.manufacturing_releases;
create trigger manufacturing_guard_artwork_release before insert or update of id,manifest_text,archived_at,archive_ref
  on public.manufacturing_releases for each row execute function public.manufacturing_guard_artwork_references();
drop trigger if exists manufacturing_guard_artwork_activation on public.manufacturing_settings;
create trigger manufacturing_guard_artwork_activation before insert or update of active_release
  on public.manufacturing_settings for each row execute function public.manufacturing_guard_artwork_references();
drop trigger if exists manufacturing_guard_artwork_job on public.manufacturing_orders;
create trigger manufacturing_guard_artwork_job before insert or update of release_id,manifest_text
  on public.manufacturing_orders for each row execute function public.manufacturing_guard_artwork_references();

create or replace function public.manufacturing_begin_artwork_cleanup(
  p_token uuid,p_archive_release text,p_archive_ref text,p_candidate_keys text[]
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare settings manufacturing_settings; release manufacturing_releases; overlap text;
begin
  if p_token is null then raise exception 'A cleanup token is required'; end if;
  if p_archive_ref is null or p_archive_ref<>trim(p_archive_ref) or length(p_archive_ref) not between 1 and 2048 then
    raise exception 'A verified local archive reference is required';
  end if;
  if coalesce(cardinality(p_candidate_keys),0)=0 or exists(select 1 from unnest(p_candidate_keys) k
      where k is null or k !~ '^manufacturing/sha256/[a-f0-9]{64}[.]png$') or
    cardinality(p_candidate_keys)<>(select count(distinct k) from unnest(p_candidate_keys) k) then
    raise exception 'Unique content-addressed artwork candidates are required';
  end if;
  select * into settings from manufacturing_settings where id for update;
  if not found then raise exception 'Manufacturing settings are missing'; end if;
  if settings.artwork_cleanup_token is not null then raise exception 'Artwork cleanup is already active'; end if;
  -- These locks are held only for this preflight transaction, never across
  -- Storage HTTP requests. Fresh writes cannot introduce pins during the check.
  lock table manufacturing_releases in share row exclusive mode;
  lock table manufacturing_orders in share row exclusive mode;
  select * into release from manufacturing_releases where id=p_archive_release;
  if not found then raise exception 'Archive release was not found'; end if;
  if settings.active_release=p_archive_release then raise exception 'The active release cannot be archived'; end if;
  if release.archived_at is not null and release.archive_ref is distinct from p_archive_ref then
    raise exception 'The archived release has a different archive reference';
  end if;
  if exists(select 1 from manufacturing_orders m where m.release_id=p_archive_release
    or m.manifest_text::jsonb->>'artworkRelease'=p_archive_release) then
    raise exception 'A print job pins this artwork release';
  end if;
  select a.key into overlap from manufacturing_releases r
    cross join lateral jsonb_each(coalesce(r.manifest_text::jsonb->'assets','{}'::jsonb)) a
    where r.archived_at is null and r.id<>p_archive_release and
      ((a.value->>'path')=any(p_candidate_keys) or
       ('manufacturing/sha256/'||(a.value->>'sha256')||'.png')=any(p_candidate_keys)) limit 1;
  if overlap is not null then raise exception 'Cleanup candidate is still referenced by retained artwork asset %',overlap; end if;
  update manufacturing_releases set archived_at=coalesce(archived_at,now()),archive_ref=p_archive_ref where id=p_archive_release;
  update manufacturing_settings set artwork_cleanup_token=p_token,artwork_cleanup_started_at=now() where id;
  return jsonb_build_object('archivedRelease',p_archive_release,'candidateCount',cardinality(p_candidate_keys),'cleanupActive',true);
end $$;

create or replace function public.manufacturing_finish_artwork_cleanup(p_token uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_token is null then raise exception 'A cleanup token is required'; end if;
  update manufacturing_settings set artwork_cleanup_token=null,artwork_cleanup_started_at=null
    where id and artwork_cleanup_token=p_token;
  return found;
end $$;

-- Existing table RLS and service-only grants cover the new metadata columns.
revoke all on function public.manufacturing_assert_artwork_available(text),
  public.manufacturing_publish(text,text),public.manufacturing_guard_artwork_references(),
  public.manufacturing_begin_artwork_cleanup(uuid,text,text,text[]),
  public.manufacturing_finish_artwork_cleanup(uuid) from public,anon,authenticated;
grant execute on function public.manufacturing_assert_artwork_available(text),
  public.manufacturing_publish(text,text),public.manufacturing_guard_artwork_references(),
  public.manufacturing_begin_artwork_cleanup(uuid,text,text,text[]),
  public.manufacturing_finish_artwork_cleanup(uuid) to service_role;
notify pgrst,'reload schema';
commit;
