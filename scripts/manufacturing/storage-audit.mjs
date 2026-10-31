import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeArtworkRetention, RetentionAuditError } from '../../src/lib/manufacturing/retention.mjs';
import { ARTWORK_BUCKET } from '../../src/lib/manufacturing/storage.mjs';

const PAGE_SIZE = 500, MAX_ROWS = 100_000;
const fail = message => { throw new RetentionAuditError(message); };
const successful = (result, label) => {
  if (result?.error || result?.data == null) fail(`${label} read failed. Check server credentials and apply manufacturing-artwork-retention.sql; no storage changes were made.`);
  return result.data;
};

// Exact counts protect against server-side row caps and incomplete final pages.
export async function collectCountedRows(fetchPage, { key, pageSize = PAGE_SIZE, maxRows = MAX_ROWS } = {}) {
  assert.ok(Number.isSafeInteger(pageSize) && pageSize > 0 && pageSize <= 1000);
  const rows = [], seen = new Set(); let expected = null;
  for (;;) {
    const response = await fetchPage(rows.length, pageSize), page = successful(response, 'Database metadata');
    if (!Array.isArray(page) || page.length > pageSize || !Number.isSafeInteger(response.count) || response.count < 0 || response.count > maxRows) fail('Invalid metadata pagination/count.');
    if (expected === null) expected = response.count;
    if (response.count !== expected) fail('Metadata changed while paginating; retry the read-only audit.');
    if (!page.length && rows.length < expected) fail('Metadata pagination ended before the exact count.');
    for (const row of page) {
      if (typeof row?.[key] !== 'string' || seen.has(row[key])) fail('Duplicate or invalid metadata row; pagination is inconsistent.');
      seen.add(row[key]); rows.push(row);
    }
    if (rows.length > expected) fail('Metadata pagination exceeded the exact count.');
    if (rows.length === expected) return rows;
  }
}

// Continue to an empty page, not merely a short page: server limits may be lower
// than the requested page size. Only the known content-addressed tree is in scope.
export async function collectArtworkObjects(listPage, { pageSize = PAGE_SIZE, maxRows = MAX_ROWS } = {}) {
  assert.ok(Number.isSafeInteger(pageSize) && pageSize > 0 && pageSize <= 1000);
  const prefixes = [''], seenPrefixes = new Set(prefixes), seenObjects = new Set(), objects = [];
  let scanned = 0;
  for (const prefix of prefixes) {
    let offset = 0; const seenNames = new Set();
    for (;;) {
      const page = successful(await listPage(prefix, { limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } }), 'Storage metadata');
      if (!Array.isArray(page) || page.length > pageSize) fail('Invalid storage pagination.');
      if (!page.length) break;
      for (const item of page) {
        if (typeof item?.name !== 'string' || !item.name || /[/\\]/.test(item.name) || ['.', '..'].includes(item.name) || seenNames.has(item.name)) fail('Unsafe or repeated storage entry; pagination is inconsistent.');
        seenNames.add(item.name);
        if (++scanned > maxRows) fail('Storage pagination exceeded its safety bound.');
        const name = [prefix, item.name].filter(Boolean).join('/');
        if (item.id === null && item.metadata === null) {
          if (!['manufacturing', 'manufacturing/sha256'].includes(name) || seenPrefixes.has(name)) fail('Unexpected manufacturing storage folder.');
          seenPrefixes.add(name); prefixes.push(name);
        } else {
          if (typeof item.id !== 'string' || !item.id || !item.metadata || seenObjects.has(name)) fail('Invalid storage object metadata.');
          const size = item.metadata.size;
          if (!(typeof size === 'number' || typeof size === 'string' && /^\d+$/.test(size)) || !Number.isSafeInteger(Number(size)) || Number(size) < 0) fail('Storage object size is unavailable.');
          seenObjects.add(name); objects.push({ bucket: ARTWORK_BUCKET, name, size: Number(size), created_at: item.created_at, updated_at: item.updated_at });
        }
      }
      offset += page.length;
    }
  }
  return objects.sort((a,b)=>a.name.localeCompare(b.name));
}

export function readOnlyAuditFetch(origin, fetchImpl = fetch) {
  return async (input, init = {}) => {
    const target = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    const method = (init.method ?? input?.method ?? 'GET').toUpperCase();
    const reads = ['/rest/v1/manufacturing_releases', '/rest/v1/manufacturing_orders', '/rest/v1/manufacturing_settings', `/storage/v1/bucket/${ARTWORK_BUCKET}`];
    if (target.origin !== origin || !(method === 'GET' && reads.includes(target.pathname) || method === 'POST' && target.pathname === `/storage/v1/object/list/${ARTWORK_BUCKET}`)) fail('The storage audit refused a non-read-only or out-of-scope request.');
    return fetchImpl(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(60_000) });
  };
}

export async function collectArtworkSnapshot(db) {
  const readRows = (table, fields, key) => collectCountedRows((offset, size) => db.from(table).select(fields, { count: 'exact' }).order(key).range(offset, offset + size - 1), { key });
  const references = async () => {
    const [releases, jobs, result] = await Promise.all([
      readRows('manufacturing_releases', 'id,manifest_text,archived_at,archive_ref', 'id'),
      readRows('manufacturing_orders', 'order_id,release_id,manifest_text,phase', 'order_id'),
      db.from('manufacturing_settings').select('active_release,artwork_cleanup_token,artwork_cleanup_started_at').eq('id', true).single(),
    ]);
    const setting = successful(result, 'Retention registry');
    if (!(setting.artwork_cleanup_token === null || typeof setting.artwork_cleanup_token === 'string') || !(setting.artwork_cleanup_started_at === null || typeof setting.artwork_cleanup_started_at === 'string')) fail('Retention registry is incomplete; apply manufacturing-artwork-retention.sql.');
    if ((setting.artwork_cleanup_token === null) !== (setting.artwork_cleanup_started_at === null)) fail('Cleanup registry fields are inconsistent.');
    return { releases, jobs, setting };
  };
  const before = await references();
  const readObjects = () => collectArtworkObjects((prefix, options) => db.storage.from(ARTWORK_BUCKET).list(prefix, options));
  const bucket = successful(await db.storage.getBucket(ARTWORK_BUCKET), 'Private bucket');
  const objects = await readObjects(), after = await references(), secondObjects = await readObjects();
  if (JSON.stringify(before) !== JSON.stringify(after) || JSON.stringify(objects) !== JSON.stringify(secondObjects)) fail('References or storage changed during the audit; retry without concurrent publication/cleanup.');
  const finalBucket = successful(await db.storage.getBucket(ARTWORK_BUCKET), 'Private bucket');
  if (bucket.id !== ARTWORK_BUCKET || finalBucket.id !== ARTWORK_BUCKET || bucket.public !== false || finalBucket.public !== false) fail('Manufacturing storage must remain private.');
  return { bucket: { id: ARTWORK_BUCKET, public: false }, activeRelease: after.setting.active_release, releases: after.releases, jobs: after.jobs, objects, cleanupActive: after.setting.artwork_cleanup_token !== null, cleanupStartedAt: after.setting.artwork_cleanup_started_at };
}

export function parseAuditArguments(args) {
  const options = { archiveReleaseIds: [], graceDays: 7 }; const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--help') { options.help = true; continue; }
    if (!['--project-ref', '--grace-days', '--archive-release', '--output'].includes(flag)) fail('Unknown argument. This command has no apply/delete mode.');
    const value = args[++i]; if (!value || value.startsWith('--')) fail('Argument value is missing.');
    if (flag !== '--archive-release' && seen.has(flag)) fail('Duplicate argument.'); seen.add(flag);
    if (flag === '--archive-release') options.archiveReleaseIds.push(value);
    else if (flag === '--grace-days') { if (!/^\d+$/.test(value)) fail('Grace days must be an integer.'); options.graceDays = Number(value); }
    else if (flag === '--project-ref') options.projectRef = value;
    else options.output = value;
  }
  if (!options.help && !/^[a-z0-9]{20}$/.test(options.projectRef ?? '')) fail('An explicit --project-ref is required.');
  return options;
}

export async function main(args = process.argv.slice(2), env = process.env) {
  const options = parseAuditArguments(args);
  if (options.help) {
    console.log('Read-only manufacturing storage audit.\nnode --env-file=.env.local scripts/manufacturing/storage-audit.mjs --project-ref <project-ref> [--grace-days 7] [--archive-release <unpinned-release-id>] [--output .private/manufacturing/<report>.json]\nRequires manufacturing-artwork-retention.sql. No upload, archive, delete, job, or print operation is available.'); return;
  }
  let url; try { url = new URL(env.NEXT_PUBLIC_SUPABASE_URL); } catch { fail('Configure NEXT_PUBLIC_SUPABASE_URL.'); }
  if (url.href !== `https://${options.projectRef}.supabase.co/` || !env.SUPABASE_SERVICE_ROLE_KEY) fail('Configured Supabase URL/key does not match the explicitly selected project.');
  let output;
  if (options.output) {
    output = path.resolve(options.output); const relative = path.relative(path.resolve('.private/manufacturing'), output);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || path.extname(output) !== '.json') fail('Save audit reports as JSON inside .private/manufacturing.');
  }
  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(url.origin, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: readOnlyAuditFetch(url.origin) } });
  const report = { project: options.projectRef, ...analyzeArtworkRetention(await collectArtworkSnapshot(db), options) };
  if (output) await writeFile(output, JSON.stringify(report, null, 2), { flag: 'wx' });
  const { candidates, ...summary } = report; console.log(JSON.stringify({ ...summary, candidateDetails: output ?? 'Use --output to save object-level evidence.' }, null, 2));
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {
  // Never echo provider errors or request objects, which can contain credentials.
  console.error(error instanceof RetentionAuditError ? `Storage audit failed closed: ${error.message}` : 'Storage audit failed closed. Check the selected project, retention migration, complete references, and stable storage; no remote changes were made.');
  process.exitCode = 1;
});
