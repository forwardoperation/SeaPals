import { createHash } from 'node:crypto';
import { ARTWORK_BUCKET } from './storage.mjs';

const RELEASE_ID = /^[A-Za-z0-9._-]{1,100}$/;
const OBJECT_KEY = /^manufacturing\/sha256\/([a-f0-9]{64})\.png$/;
const ownObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export class RetentionAuditError extends Error {}
const check = (condition, message) => { if (!condition) throw new RetentionAuditError(message); };
const hash = value => createHash('sha256').update(value).digest('hex');
function parse(value, label) {
  check(typeof value === 'string', `${label} must be serialized JSON.`);
  try { const parsed = JSON.parse(value); check(ownObject(parsed), `${label} is invalid.`); return parsed; }
  catch { throw new RetentionAuditError(`${label} is invalid.`); }
}
function timestamp(value, label) {
  check(typeof value === 'string' && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value)), `${label} is invalid.`);
  return Date.parse(value);
}
function bytes(items) {
  let total = 0;
  for (const item of items) { total += item.size; check(Number.isSafeInteger(total), 'Storage total exceeds safe integer precision.'); }
  return total;
}
const totals = items => ({ objects: items.length, bytes: bytes(items) });

// This function produces evidence only. It has no storage client or deletion path.
export function analyzeArtworkRetention(snapshot, { now = Date.now(), graceDays = 7, archiveReleaseIds = [] } = {}) {
  check(Number.isFinite(now), 'Audit time is invalid.');
  check(Number.isSafeInteger(graceDays) && graceDays >= 1 && graceDays <= 3650, 'Grace days must be an integer from 1 to 3650.');
  check(typeof snapshot?.cleanupActive === 'boolean', 'Cleanup status is missing from the snapshot.');
  check(snapshot?.bucket?.id === ARTWORK_BUCKET && snapshot.bucket.public === false, 'Expected the private manufacturing bucket.');
  for (const name of ['releases', 'jobs', 'objects']) check(Array.isArray(snapshot[name]), `Missing complete ${name} snapshot.`);
  check(Array.isArray(archiveReleaseIds) && new Set(archiveReleaseIds).size === archiveReleaseIds.length, 'Archive release IDs must be distinct.');
  const releases = new Map(), allKeys = new Set(), objects = new Map(), archived = new Set();
  for (const row of snapshot.releases) {
    check(RELEASE_ID.test(row?.id ?? '') && !releases.has(row.id), 'Invalid or duplicate release ID.');
    check(row.archived_at === null || typeof row.archived_at === 'string', 'Release archival registry is missing; apply the retention migration.');
    check(row.archive_ref === null || typeof row.archive_ref === 'string', 'Release archive reference is missing.');
    if (row.archived_at !== null) { timestamp(row.archived_at, 'Release archival time'); check(typeof row.archive_ref === 'string' && row.archive_ref.trim().length > 0 && row.archive_ref === row.archive_ref.trim() && row.archive_ref.length <= 2048, 'Archived release has no recovery reference.'); archived.add(row.id); }
    else check(row.archive_ref === null, 'Unarchived release has conflicting archive metadata.');
    const release = parse(row.manifest_text, 'Release manifest');
    check(release.releaseId === row.id && ownObject(release.assets), 'Release identity or assets are invalid.');
    const keys = new Set();
    for (const asset of Object.values(release.assets)) {
      const match = typeof asset?.path === 'string' && asset.path.match(OBJECT_KEY);
      check(match && asset.sha256 === match[1], 'Release contains an invalid content-addressed artwork path.');
      keys.add(asset.path); allKeys.add(asset.path);
    }
    releases.set(row.id, { row, keys, manifestSha256: hash(row.manifest_text) });
  }
  const pinned = new Set(), jobIds = new Set(), jobReferences = [];
  const pin = id => { check(RELEASE_ID.test(id ?? '') && releases.has(id), 'A pinned release is missing from the complete release snapshot.'); check(!archived.has(id), 'An archived release is active or job-pinned; restore it before evaluating retention.'); pinned.add(id); };
  check(snapshot.activeRelease === null || typeof snapshot.activeRelease === 'string', 'Active-release setting is missing.');
  if (snapshot.activeRelease !== null) pin(snapshot.activeRelease);
  for (const job of snapshot.jobs) {
    check(typeof job?.order_id === 'string' && job.order_id.length > 0 && !jobIds.has(job.order_id), 'Invalid or duplicate job identity.');
    jobIds.add(job.order_id);
    check(job.release_id === null || typeof job.release_id === 'string', 'Job release reference is missing.');
    if (job.release_id !== null) pin(job.release_id);
    check(job.manifest_text === null || typeof job.manifest_text === 'string', 'Job manifest field is missing.');
    if (job.manifest_text !== null) {
      const manifest = parse(job.manifest_text, 'Job manifest');
      const stockOnly = manifest.artworkRelease === 'stock-only' && job.release_id === null && Array.isArray(manifest.sheets) && manifest.sheets.length === 0;
      if (!stockOnly) {
        pin(manifest.artworkRelease);
        check(manifest.artworkRelease === job.release_id, 'Job and saved manifest disagree about their pinned release.');
      }
    }
    // Every phase is protected, including completed, held, and unprepared jobs.
    jobReferences.push({ id: job.order_id, releaseId: job.release_id, manifestSha256: job.manifest_text === null ? null : hash(job.manifest_text) });
  }
  const archive = new Set(archiveReleaseIds);
  for (const id of archive) check(RELEASE_ID.test(id ?? '') && releases.has(id) && !pinned.has(id) && !archived.has(id), 'Only an existing online unpinned release can be proposed for archival.');
  for (const object of snapshot.objects) {
    check(object?.bucket === ARTWORK_BUCKET && typeof object.name === 'string' && OBJECT_KEY.test(object.name), 'Storage object is outside the exact manufacturing hash scope.');
    check(!objects.has(object.name), 'Duplicate storage object; pagination may be inconsistent.');
    check(Number.isSafeInteger(object.size) && object.size >= 0, 'Storage object size is invalid.');
    const created = timestamp(object.created_at, 'Object creation time'), updated = timestamp(object.updated_at, 'Object update time');
    objects.set(object.name, { ...object, ageDays: (now - Math.max(created, updated)) / 86_400_000 });
  }
  const onlineKeys = new Set([...releases].filter(([id])=>!archived.has(id)).flatMap(([,r])=>[...r.keys]));
  for (const key of onlineKeys) check(objects.has(key), 'Online published artwork is missing from storage; no candidate report is safe.');
  const keysFor = ids => new Set([...ids].flatMap(id => [...releases.get(id).keys]));
  const pinnedKeys = keysFor(pinned), activeKeys = snapshot.activeRelease === null ? new Set() : releases.get(snapshot.activeRelease).keys;
  const keptReleaseIds = [...releases.keys()].filter(id => !archive.has(id) && !archived.has(id)).sort(), keptKeys = keysFor(keptReleaseIds);
  const listed = [...objects.values()].sort((a, b) => a.name.localeCompare(b.name));
  const orphans = listed.filter(o => !allKeys.has(o.name));
  const agedOrphans = orphans.filter(o => o.ageDays >= graceDays);
  const recentOrphans = orphans.filter(o => o.ageDays < graceDays);
  const alreadyArchivedOnly = listed.filter(o => allKeys.has(o.name) && !onlineKeys.has(o.name));
  const archiveDelta = listed.filter(o => onlineKeys.has(o.name) && !keptKeys.has(o.name));
  const candidates = [...agedOrphans.map(o => ({ ...o, reason: 'aged-orphan' })), ...archiveDelta.map(o => ({ ...o, reason: 'explicit-release-archive' })), ...alreadyArchivedOnly.map(o => ({ ...o, reason: 'archived-release' }))].sort((a, b) => a.name.localeCompare(b.name));
  check(candidates.every(o => !pinnedKeys.has(o.name)), 'A protected artwork object entered the candidate set.');
  const referenceFingerprint = hash(JSON.stringify({ activeRelease: snapshot.activeRelease, releases: [...releases].map(([id, r]) => ({ id, manifestSha256: r.manifestSha256, archivedAt: r.row.archived_at, archiveRef: r.row.archive_ref })).sort((a,b)=>a.id.localeCompare(b.id)), jobs: jobReferences.sort((a,b)=>a.id.localeCompare(b.id)) }));
  const objectFingerprint = hash(JSON.stringify(listed.map(({ ageDays, ...o }) => o)));
  return {
    schemaVersion: 1, readOnly: true, deletionAuthorized: false, auditedAt: new Date(now).toISOString(),
    scope: { bucket: ARTWORK_BUCKET, prefix: 'manufacturing/sha256/', includesOtherBucketsOrProjects: false },
    graceDays, activeRelease: snapshot.activeRelease, releaseCount: releases.size, jobCount: snapshot.jobs.length,
    cleanupActive: snapshot.cleanupActive, cleanupStartedAt: snapshot.cleanupStartedAt ?? null,
    archivedReleases: [...archived].sort().map(id=>({id,archivedAt:releases.get(id).row.archived_at,archiveRef:releases.get(id).row.archive_ref})),
    protectedReleaseIds: [...pinned].sort(), keptReleaseIds, archiveReleaseIds: [...archive].sort(), referenceFingerprint, objectFingerprint,
    usage: totals(listed), active: totals(listed.filter(o => activeKeys.has(o.name))),
    activeAndJobPinned: totals(listed.filter(o => pinnedKeys.has(o.name))),
    allPublished: totals(listed.filter(o => allKeys.has(o.name))), onlinePublished: totals(listed.filter(o => onlineKeys.has(o.name))), alreadyArchivedOnly: totals(alreadyArchivedOnly),
    orphans: totals(orphans), agedOrphans: totals(agedOrphans), recentOrphans: totals(recentOrphans),
    archiveDelta: totals(archiveDelta), proposed: totals(candidates), afterProposed: { objects: listed.length-candidates.length, bytes: bytes(listed)-bytes(candidates) },
    candidates: candidates.map(({ bucket, name, size, created_at, updated_at, ageDays, reason }) => ({ bucket, name, sha256: name.match(OBJECT_KEY)[1], size, created_at, updated_at, ageDays, reason })),
    caveats: ['Read-only evidence, not permission to delete.', 'Archive candidates require a verified recoverable copy and explicit release retirement.', 'Recheck references and exclude concurrent publication before any separately authorized cleanup.'],
  };
}
