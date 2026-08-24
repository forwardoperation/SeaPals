import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schemaUrl = new URL(
  "../../../../../supabase/adventure-saves.sql",
  import.meta.url,
);

async function schema() {
  return readFile(schemaUrl, "utf8");
}

test("cloud-save schema owns three versioned account slots and permanent tombstones", async () => {
  const sql = await schema();
  assert.match(sql, /create table if not exists public\.adventure_saves/i);
  assert.match(sql, /user_id uuid not null references auth\.users\(id\) on delete cascade/i);
  assert.match(sql, /primary key \(user_id, profile_id\)/i);
  assert.match(sql, /profile_id in \('profile-1', 'profile-2', 'profile-3'\)/i);
  assert.match(sql, /deleted = true and payload is null/i);
  assert.doesNotMatch(sql, /delete from public\.adventure_saves/i);
});

test("live cloud saves use owner-only RLS with no anonymous grants", async () => {
  const sql = await schema();
  assert.match(sql, /alter table public\.adventure_saves enable row level security/i);
  assert.match(sql, /alter table public\.adventure_saves force row level security/i);
  assert.match(sql, /using \(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(sql, /with check \(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(sql, /revoke all on table public\.adventure_saves from anon, authenticated/i);
  assert.match(sql, /grant select, insert, update on table public\.adventure_saves to authenticated/i);
  assert.doesNotMatch(sql, /grant [^;]*adventure_saves[^;]* anon/i);
});

test("private history archives OLD revisions, cascades with account deletion, and expires after 30 days", async () => {
  const sql = await schema();
  assert.match(sql, /create table if not exists public\.adventure_save_history/i);
  assert.match(sql, /user_id uuid not null references auth\.users\(id\) on delete cascade/i);
  assert.match(sql, /insert into public\.adventure_save_history[\s\S]*old\.user_id[\s\S]*old\.cloud_version/i);
  assert.match(sql, /before update on public\.adventure_saves[\s\S]*archive_adventure_save_revision/i);
  assert.match(sql, /create policy "Adventure save history is private"[\s\S]*using \(false\)[\s\S]*with check \(false\)/i);
  assert.match(sql, /revoke all on table public\.adventure_save_history from anon, authenticated/i);
  assert.match(sql, /where archived_at < now\(\) - interval '30 days'/i);
  assert.match(sql, /grant execute on function public\.prune_adventure_save_history\(\) to service_role/i);
  assert.doesNotMatch(sql, /grant [^;]*adventure_save_history[^;]*authenticated/i);
});
