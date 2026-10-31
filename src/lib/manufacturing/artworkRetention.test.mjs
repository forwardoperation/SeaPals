import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

const baselineSql = await readFile(new URL("../../../supabase/manufacturing.sql", import.meta.url), "utf8");
const retentionSql = await readFile(new URL("../../../supabase/manufacturing-artwork-retention.sql", import.meta.url), "utf8");
const bucket = "searealm-manufacturing-private";
const key = (hash) => "manufacturing/sha256/" + hash + ".png";
const hash = (character) => character.repeat(64);
const release = (id, hashes) => ({ releaseId: id, assets: Object.fromEntries(hashes.map((sha256, i) => [
  "asset-" + i, { sha256, path: key(sha256), width: 750, height: 1050 },
])) });

async function fixture() {
  const db = new PGlite();
  await db.exec("create role anon;create role authenticated;create role service_role;" +
    "create table store_orders(id uuid primary key,order_number text,payment_status text default 'pending',payment_livemode boolean default true," +
    "amount_refunded_cents integer default 0,dispute_status text,fulfillment_status text default 'unfulfilled',updated_at timestamptz default now());" +
    "create table store_refunds(id uuid primary key default gen_random_uuid(),order_id uuid,status text);" +
    "create schema storage;create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));");
  await db.exec(baselineSql);
  await db.exec(retentionSql);
  const rpc = async (name, values) => (await db.query(
    "select manufacturing_" + name + "(" + values.map((_, i) => "$" + (i + 1)).join(",") + ") as value", values,
  )).rows[0].value;
  const put = async (sha256, targetBucket = bucket) => db.query(
    "insert into storage.objects(bucket_id,name) values($1,$2) on conflict do nothing", [targetBucket, key(sha256)],
  );
  const publish = (manifest) => rpc("publish", [manifest.releaseId, JSON.stringify(manifest)]);
  const settings = async () => (await db.query("select * from manufacturing_settings")).rows[0];
  const releases = async () => (await db.query("select * from manufacturing_releases order by id")).rows;
  const jobs = async () => (await db.query("select * from manufacturing_orders order by order_id")).rows;
  const job = async (releaseId, savedRelease = releaseId, phase = "complete") => {
    const id = randomUUID(), lease = phase === "active" ? randomUUID() : null;
    await db.query("insert into store_orders(id,order_number) values($1,'RETENTION-TEST')", [id]);
    await db.query("insert into manufacturing_orders(order_id,release_id,manifest_text,state,revision,phase,lease_token,leased_until) " +
      "values($1,$2,$3,$4,7,$5,$6,case when $6::uuid is null then null else now()+interval '2 minutes' end)",
      [id, releaseId, savedRelease ? JSON.stringify({ artworkRelease: savedRelease, saved: "immutable manifest" }) : null,
        { packed: phase === "complete", saved: "printing state" }, phase, lease]);
    return { id, lease };
  };
  const seed = async () => {
    await put(hash("a")); await put(hash("b"));
    await publish(release("old", [hash("a")]));
    await publish(release("current", [hash("b")]));
  };
  const begin = (token = randomUUID(), candidates = [key(hash("a"))], archived = "old", ref = "C:/private/verified-archive/receipt.json") =>
    rpc("begin_artwork_cleanup", [token, archived, ref, candidates]);
  return { db, rpc, put, publish, settings, releases, jobs, job, seed, begin };
}

test("artwork retention migration is idempotent and preserves jobs, settings, and service-only grants", async () => {
  const f = await fixture();
  try {
    await f.seed();
    await f.job("current", "current", "active");
    const jobs = await f.jobs(), settings = await f.settings(), releases = await f.releases();
    await f.db.exec(retentionSql);
    assert.deepEqual(await f.jobs(), jobs);
    assert.deepEqual(await f.settings(), settings);
    assert.deepEqual(await f.releases(), releases);
    const signatures = ["manufacturing_publish(text,text)", "manufacturing_assert_artwork_available(text)",
      "manufacturing_guard_artwork_references()", "manufacturing_begin_artwork_cleanup(uuid,text,text,text[])",
      "manufacturing_finish_artwork_cleanup(uuid)"];
    for (const signature of signatures) {
      for (const role of ["anon", "authenticated", "service_role"])
        assert.equal((await f.db.query("select has_function_privilege($1,$2,'EXECUTE') as allowed", [role, signature])).rows[0].allowed, role === "service_role");
    }
    for (const role of ["anon", "authenticated"]) {
      await f.db.exec("set role " + role);
      await assert.rejects(f.begin(), /permission denied/);
      await assert.rejects(f.db.query("select archive_ref from manufacturing_releases"), /permission denied/);
      await f.db.exec("reset role");
    }
    await f.db.exec("set role service_role");
    await f.publish(release("current", [hash("b")]));
    await f.db.exec("reset role");
  } finally { await f.db.close(); }
});

test("publication requires every canonical hash in the private bucket and preserves immutable release contents", async () => {
  const f = await fixture();
  try {
    await f.seed();
    const original = await f.settings();
    await f.put(hash("c"), "public-images");
    await assert.rejects(f.publish(release("missing", [hash("b"), hash("c")])), /Private artwork is missing/);
    assert.deepEqual(await f.settings(), original);
    assert.equal((await f.releases()).length, 2);
    await f.put(hash("c"));
    const next = release("next", [hash("b"), hash("c")]);
    await f.publish(next);
    await f.publish(next);
    await assert.rejects(f.publish({ ...next, changed: true }), /immutable/);
    await assert.rejects(f.rpc("publish", ["wrong", JSON.stringify(next)]), /identity/);
    await assert.rejects(f.publish({ releaseId: "malformed", assets: { card: { sha256: hash("c"), path: "other/" + hash("c") + ".png" } } }), /Invalid private artwork/);
    await assert.rejects(f.publish({ releaseId: "malformed", assets: [] }), /artwork entries/);
    assert.equal((await f.settings()).active_release, "next");
  } finally { await f.db.close(); }
});

test("cleanup rejects active releases, either form of saved-job pin, and references in every retained release", async () => {
  const f = await fixture();
  try {
    await f.seed();
    await assert.rejects(f.begin(randomUUID(), [key(hash("b"))], "current"), /active release/);
    const pinned = await f.job("old", null, "complete");
    await assert.rejects(f.begin(), /print job pins/);
    await f.db.query("update manufacturing_orders set release_id='current',manifest_text=$2 where order_id=$1", [pinned.id, JSON.stringify({ artworkRelease: "old" })]);
    await assert.rejects(f.begin(), /print job pins/);
    await f.db.query("update manufacturing_orders set manifest_text=null where order_id=$1", [pinned.id]);
    await f.publish(release("inactive-but-retained", [hash("a"), hash("b")]));
    await f.publish(release("current", [hash("b")]));
    await assert.rejects(f.begin(), /still referenced by retained artwork/);
    assert.equal((await f.settings()).artwork_cleanup_token, null);
    assert.ok((await f.releases()).every((r) => r.archived_at === null));
  } finally { await f.db.close(); }
});

test("cleanup validates exact object candidates and the verified local archive reference before changing metadata", async () => {
  const f = await fixture();
  try {
    await f.seed();
    for (const candidates of [[], [null], ["manufacturing/sha256/../secret.png"], [key(hash("a")), key(hash("a"))]])
      await assert.rejects(f.begin(randomUUID(), candidates), /artwork candidates/);
    for (const ref of [null, "", " padded ", "a".repeat(2049)])
      await assert.rejects(f.begin(randomUUID(), [key(hash("a"))], "old", ref), /archive reference/);
    await assert.rejects(f.begin(null), /cleanup token/);
    assert.equal((await f.settings()).artwork_cleanup_token, null);
    assert.ok((await f.releases()).every((r) => r.archived_at === null));
  } finally { await f.db.close(); }
});

test("cleanup gates publication while existing printing continues, then rejects a stale publish after deletion", async () => {
  const f = await fixture();
  try {
    await f.seed();
    const printing = await f.job("current", "current", "active"), beforeJobs = await f.jobs();
    const token = randomUUID(), beforeRelease = (await f.releases()).find((r) => r.id === "old");
    assert.deepEqual(await f.begin(token), { archivedRelease: "old", candidateCount: 1, cleanupActive: true });
    const archived = (await f.releases()).find((r) => r.id === "old");
    assert.equal(archived.manifest_text, beforeRelease.manifest_text);
    assert.ok(archived.archived_at);
    assert.equal(archived.archive_ref, "C:/private/verified-archive/receipt.json");
    assert.deepEqual(await f.jobs(), beforeJobs, "Cleanup never changes saved print contents or progress");
    assert.equal(await f.rpc("heartbeat", [printing.id, printing.lease]), true, "Existing printer leases remain usable during storage cleanup");
    assert.equal((await f.settings()).active_release, "current");
    await assert.rejects(f.begin(token), /already active/);
    await assert.rejects(f.publish(release("stale", [hash("a")])), /cleanup is active/);
    await assert.rejects(f.publish(release("current", [hash("b")])), /cleanup is active/);
    await assert.rejects(f.db.query("update manufacturing_settings set active_release='current' where id"), /cleanup is active/);
    assert.equal(await f.rpc("finish_artwork_cleanup", [randomUUID()]), false);
    assert.equal((await f.settings()).artwork_cleanup_token, token);
    // Represents the external Storage API deletion after preflight committed.
    await f.db.query("delete from storage.objects where bucket_id=$1 and name=$2", [bucket, key(hash("a"))]);
    assert.equal(await f.rpc("finish_artwork_cleanup", [token]), true);
    assert.equal(await f.rpc("finish_artwork_cleanup", [token]), false);
    assert.equal((await f.settings()).artwork_cleanup_started_at, null);
    // This caller may have completed its API HEAD checks before cleanup started.
    await assert.rejects(f.publish(release("stale", [hash("a")])), /Private artwork is missing/);
    await assert.rejects(f.publish(release("old", [hash("a")])), /archived/);
    await f.publish(release("current", [hash("b")]));
    await f.put(hash("c"));
    await f.publish(release("fresh", [hash("b"), hash("c")]));
    assert.equal((await f.settings()).active_release, "fresh");
  } finally { await f.db.close(); }
});

test("archived artwork cannot be activated or pinned directly and re-uploading alone does not unarchive it", async () => {
  const f = await fixture();
  try {
    await f.seed();
    const existing = await f.job("current"), token = randomUUID();
    await f.begin(token);
    await f.rpc("finish_artwork_cleanup", [token]);
    await assert.rejects(f.db.query("update manufacturing_settings set active_release='old' where id"), /Archived artwork/);
    await assert.rejects(f.job("old"), /Archived artwork/);
    await assert.rejects(f.db.query("update manufacturing_orders set release_id='old' where order_id=$1", [existing.id]), /Archived artwork/);
    await assert.rejects(f.db.query("update manufacturing_orders set manifest_text=$2 where order_id=$1", [existing.id, JSON.stringify({ artworkRelease: "old" })]), /Archived artwork/);
    await f.put(hash("a"));
    await assert.rejects(f.publish(release("old", [hash("a")])), /archived/);
    await f.db.query("update manufacturing_releases set archived_at=null,archive_ref=null where id='old'");
    await f.publish(release("old", [hash("a")]));
    assert.equal((await f.settings()).active_release, "old", "Explicit restoration works only when every object exists");
  } finally { await f.db.close(); }
});


test("direct release writes cannot bypass cleanup or missing artwork checks, while intact releases remain usable", async () => {
  const f = await fixture();
  try {
    await f.seed();
    const token = randomUUID();
    await f.begin(token);
    const insert = (manifest) => f.db.query("insert into manufacturing_releases(id,manifest_text) values($1,$2)", [manifest.releaseId, JSON.stringify(manifest)]);
    await assert.rejects(insert(release("direct-alias", [hash("a")])), /cleanup is active/);
    await assert.rejects(f.db.query("update manufacturing_releases set manifest_text=$1 where id='current'", [JSON.stringify(release("current", [hash("a")]))]), /cleanup is active/);
    await f.job("current", "current", "active");
    await f.db.query("delete from storage.objects where bucket_id=$1 and name=$2", [bucket, key(hash("a"))]);
    await f.rpc("finish_artwork_cleanup", [token]);
    await assert.rejects(insert(release("direct-alias", [hash("a")])), /Private artwork is missing/);
    await assert.rejects(f.db.query("update manufacturing_releases set manifest_text=$1 where id='current'", [JSON.stringify(release("current", [hash("a")]))]), /immutable/);
    await insert(release("intact-alias", [hash("b")]));
    await f.job("intact-alias");
    // Simulate external loss: a new or changed job pin must not silently accept it.
    await f.db.query("delete from storage.objects where bucket_id=$1 and name=$2", [bucket, key(hash("b"))]);
    await assert.rejects(f.job("current"), /Private artwork is missing/);
    await assert.rejects(f.db.query("update manufacturing_orders set manifest_text=manifest_text where release_id='current'"), /Private artwork is missing/);
  } finally { await f.db.close(); }
});


test("archive metadata cannot bypass active-job protection or restore then pin during cleanup", async () => {
  const f = await fixture();
  try {
    await f.seed();
    const archive = (id) => f.db.query("update manufacturing_releases set archived_at=now(),archive_ref='verified-receipt' where id=$1", [id]);
    await assert.rejects(archive("current"), /active release/);
    const pinned = await f.job("old", "old");
    await assert.rejects(archive("old"), /print job pins/);
    await f.db.query("update manufacturing_orders set release_id='current' where order_id=$1", [pinned.id]);
    await assert.rejects(archive("old"), /print job pins/);
    await f.db.query("update manufacturing_orders set manifest_text=null where order_id=$1", [pinned.id]);
    await assert.rejects(f.db.query("update manufacturing_releases set id='renamed' where id='old'"), /immutable/);
    await assert.rejects(f.db.query("update manufacturing_releases set archived_at=now() where id='old'"), /set or cleared together/);
    await assert.rejects(f.db.query("update manufacturing_releases set archived_at=now(),archive_ref=' ' where id='old'"), /set or cleared together/);
    const token = randomUUID();
    await f.begin(token);
    await assert.rejects(f.db.query("update manufacturing_releases set archived_at=null,archive_ref=null where id='old'"), /cleanup is active/);
    await assert.rejects(f.job("old"), /Archived artwork/);
    assert.ok((await f.releases()).find((r) => r.id === "old").archived_at);
    await f.db.query("delete from storage.objects where bucket_id=$1 and name=$2", [bucket, key(hash("a"))]);
    await f.rpc("finish_artwork_cleanup", [token]);
    await assert.rejects(f.db.query("update manufacturing_releases set archived_at=null where id='old'"), /set or cleared together/);
    await assert.rejects(f.db.query("update manufacturing_releases set archived_at=null,archive_ref=null where id='old'"), /Private artwork is missing/);
    await f.put(hash("a"));
    await f.db.query("update manufacturing_releases set archived_at=null,archive_ref=null where id='old'");
    await f.job("old");
  } finally { await f.db.close(); }
});
