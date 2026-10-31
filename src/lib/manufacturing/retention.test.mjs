import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeArtworkRetention } from './retention.mjs';
import { ARTWORK_BUCKET } from './storage.mjs';
import { collectCountedRows, collectArtworkObjects, collectArtworkSnapshot, readOnlyAuditFetch, parseAuditArguments } from '../../../scripts/manufacturing/storage-audit.mjs';

const now = Date.parse('2026-10-30T12:00:00Z');
const hash = n => n.toString(16).padStart(64, '0');
const key = n => `manufacturing/sha256/${hash(n)}.png`;
const asset = n => ({ sha256: hash(n), path: key(n) });
const release = (id, ids) => ({ id, archived_at: null, archive_ref: null, manifest_text: JSON.stringify({ releaseId: id, assets: Object.fromEntries(ids.map(n=>['card'+n,asset(n)])) }) });
const object = (n, ageDays=20) => ({ bucket: ARTWORK_BUCKET, name: key(n), size:n*10, created_at:new Date(now-ageDays*86_400_000).toISOString(), updated_at:new Date(now-ageDays*86_400_000).toISOString() });
const job = (id='job1', phase='complete') => ({order_id:id,release_id:'job-release',manifest_text:JSON.stringify({artworkRelease:'job-release',sheets:[]}),phase});
const fixture = () => ({bucket:{id:ARTWORK_BUCKET,public:false},activeRelease:'active',cleanupActive:false,releases:[release('active',[1,2]),release('old',[1,3]),release('job-release',[1,4])],jobs:[job()],objects:[object(1),object(2),object(3),object(4),object(5),object(6,2)]});
const audit = (snapshot=fixture(), options={}) => analyzeArtworkRetention(snapshot,{now,...options});

test('counts shared hashes once and proposes only aged true orphans by default',()=>{
 const input=fixture(),before=structuredClone(input),r=audit(input);
 assert.deepEqual(r.usage,{objects:6,bytes:210});assert.deepEqual(r.allPublished,{objects:4,bytes:100});assert.deepEqual(r.activeAndJobPinned,{objects:3,bytes:70});
 assert.deepEqual(r.agedOrphans,{objects:1,bytes:50});assert.deepEqual(r.recentOrphans,{objects:1,bytes:60});assert.deepEqual(r.candidates.map(x=>x.name),[key(5)]);assert.deepEqual(r.afterProposed,{objects:5,bytes:160});assert.equal(r.deletionAuthorized,false);assert.deepEqual(input,before);
});
test('explicit archive delta excludes hashes shared with any other online release',()=>{
 const r=audit(fixture(),{archiveReleaseIds:['old']});assert.deepEqual(r.archiveDelta,{objects:1,bytes:30});assert.deepEqual(r.candidates.map(x=>x.name),[key(3),key(5)]);assert.deepEqual(r.afterProposed,{objects:4,bytes:130});
 const s=fixture();s.releases.push(release('other-old',[3]));assert.equal(audit(s,{archiveReleaseIds:['old']}).archiveDelta.objects,0);assert.equal(audit(s,{archiveReleaseIds:['old','other-old']}).archiveDelta.objects,1);
});
test('all phases and unsaved jobs pin their whole release',()=>{
 for(const phase of ['queued','active','awaiting_operator','blocked','complete','future-phase'])for(const manifest_text of [null,job().manifest_text]){const s=fixture();s.jobs=[{...job(),phase,manifest_text}];assert.deepEqual(audit(s).protectedReleaseIds,['active','job-release']);assert.throws(()=>audit(s,{archiveReleaseIds:['job-release']}),/unpinned/);}
 assert.throws(()=>audit(fixture(),{archiveReleaseIds:['active']}),/unpinned/);
});
test('fails closed on missing, inconsistent, or malformed release/manifest references',()=>{
 for(const mutate of [s=>s.activeRelease='missing',s=>s.jobs[0].release_id='missing',s=>s.jobs[0].manifest_text=JSON.stringify({artworkRelease:'old'}),s=>s.jobs[0].manifest_text='{',s=>delete s.jobs[0].manifest_text,s=>s.objects=s.objects.filter(o=>o.name!==key(3)),s=>s.releases[0].manifest_text=JSON.stringify({releaseId:'different',assets:{}})]){const s=fixture();mutate(s);assert.throws(()=>audit(s));}
 const s=fixture();s.jobs.push({order_id:'stock-only',release_id:null,manifest_text:JSON.stringify({artworkRelease:'stock-only',sheets:[]}),phase:'complete'});assert.equal(audit(s).jobCount,2);s.jobs[1].manifest_text=JSON.stringify({artworkRelease:'stock-only',sheets:[{}]});assert.throws(()=>audit(s),/pinned release/);
});
test('retention registry allows cold archived files but never archived active/job references',()=>{
 const s=fixture();s.releases[1].archived_at='2026-10-25T12:00:00Z';s.releases[1].archive_ref='private-archive-receipt';s.objects=s.objects.filter(o=>o.name!==key(3));assert.equal(audit(s).archivedReleases.length,1);assert.equal(audit(s).onlinePublished.objects,3);
 s.objects.push(object(3));assert.equal(audit(s).alreadyArchivedOnly.objects,1);assert.equal(audit(s).candidates.find(o=>o.name===key(3)).reason,'archived-release');assert.throws(()=>audit(s,{archiveReleaseIds:['old']}),/online unpinned/);
 s.activeRelease='old';assert.throws(()=>audit(s),/archived release is active/);
 const t=fixture();t.releases[2].archived_at='2026-10-25T12:00:00Z';t.releases[2].archive_ref='receipt';assert.throws(()=>audit(t),/archived release is active/);
});
test('age uses latest modification and keeps future/recent objects; seven-day boundary is inclusive',()=>{
 const s=fixture();s.objects[4].updated_at=new Date(now-1).toISOString();s.objects[5]=object(6,7);s.objects.push(object(7,-1));const r=audit(s);assert.deepEqual(r.candidates.map(x=>x.name),[key(6)]);assert.equal(r.recentOrphans.objects,2);
 for(const graceDays of [0,-1,1.5,Infinity,3651])assert.throws(()=>audit(s,{graceDays}));
});
test('rejects unsafe scope, malformed hashes, duplicates, unknown sizes, and missing archival schema',()=>{
 const mutations=[s=>s.bucket.public=true,s=>s.bucket.id='other',s=>s.objects[0].bucket='other',s=>s.objects[0].name='../secret.png',s=>s.objects[0].name='manufacturing/sha256/ABC.png',s=>s.objects[0].size=NaN,s=>s.objects[0].size=-1,s=>s.objects[0].updated_at=null,s=>s.objects.push({...s.objects[0]}),s=>s.jobs.push({...s.jobs[0]}),s=>s.releases.push({...s.releases[0]}),s=>delete s.releases[0].archived_at,s=>s.releases[0].archive_ref='unpaired',s=>s.releases[0].manifest_text=JSON.stringify({releaseId:'active',assets:{bad:{...asset(1),sha256:hash(2)}}})];for(const mutate of mutations){const s=fixture();mutate(s);assert.throws(()=>audit(s));}
 assert.throws(()=>audit(fixture(),{archiveReleaseIds:['old','old']}));assert.throws(()=>audit(fixture(),{archiveReleaseIds:['missing']}));
});
test('reference fingerprint changes with a job pin or archival metadata, not input order',()=>{
 const s=fixture(),a=audit(s);s.releases.reverse();s.jobs.reverse();assert.equal(audit(s).referenceFingerprint,a.referenceFingerprint);s.jobs[0].manifest_text=null;assert.notEqual(audit(s).referenceFingerprint,a.referenceFingerprint);
});

test('counted pagination handles server-capped short pages and validates the complete count',async()=>{
 const rows=Array.from({length:5},(_,i)=>({id:String(i)})),offsets=[];
 const result=await collectCountedRows(async(offset)=>{offsets.push(offset);return{data:rows.slice(offset,offset+2),error:null,count:5};},{key:'id',pageSize:4});assert.deepEqual(result,rows);assert.deepEqual(offsets,[0,2,4]);
 await assert.rejects(()=>collectCountedRows(async()=>({data:[],error:null,count:1}),{key:'id'}),/ended before/);
 await assert.rejects(()=>collectCountedRows(async()=>({data:[{id:'a'}],error:null,count:2}),{key:'id'}),/Duplicate/);
 let calls=0;await assert.rejects(()=>collectCountedRows(async()=>({data:[{id:String(calls)}],error:null,count:++calls===1?2:3}),{key:'id'}),/changed/);
 await assert.rejects(()=>collectCountedRows(async()=>({data:[],error:null,count:null}),{key:'id'}),/pagination/);
 await assert.rejects(()=>collectCountedRows(async()=>({data:[],error:null,count:100001}),{key:'id'}),/pagination/);
});
const folder=name=>({name,id:null,metadata:null});
const listedObject=n=>({name:hash(n)+'.png',id:'object'+n,metadata:{size:String(n*10)},created_at:object(n).created_at,updated_at:object(n).updated_at});
function listing(rows=[listedObject(1),listedObject(2)]){return {'':[folder('manufacturing')],manufacturing:[folder('sha256')],'manufacturing/sha256':rows};}
test('storage pagination scans to empty after short pages and refuses repeated/out-of-scope entries',async()=>{
 const pages=listing(),offsets=[];const objects=await collectArtworkObjects(async(prefix,{offset})=>{offsets.push([prefix,offset]);return{data:pages[prefix].slice(offset,offset+1),error:null};},{pageSize:10});assert.equal(objects.length,2);assert.ok(offsets.some(([p,o])=>p==='manufacturing/sha256'&&o===2));assert.equal(objects[0].size,10);
 await assert.rejects(()=>collectArtworkObjects(async()=>({data:[folder('other')],error:null})),/Unexpected/);
 await assert.rejects(()=>collectArtworkObjects(async()=>({data:[folder('../escape')],error:null})),/Unsafe/);
 await assert.rejects(()=>collectArtworkObjects(async()=>({data:[folder('manufacturing')],error:null})),/repeated/);
 const bad=listing([{...listedObject(1),metadata:{}}]);await assert.rejects(()=>collectArtworkObjects(async(p,{offset})=>({data:bad[p].slice(offset,offset+1),error:null})),/size/);
 await assert.rejects(()=>collectArtworkObjects(async()=>({data:null,error:{message:'SECRET'}})),error=>!error.message.includes('SECRET'));
});
test('network transport cannot upload, archive, delete, invoke RPCs, or send credentials to another host',async()=>{
 let calls=0;const origin='https://abcdefghijklmnopqrst.supabase.co',read=readOnlyAuditFetch(origin,async(input,options)=>{calls++;assert.equal(options.redirect,'error');return{ok:true};});
 await read(origin+'/rest/v1/manufacturing_releases');await read(origin+'/storage/v1/object/list/'+ARTWORK_BUCKET,{method:'POST'});
 for(const [url,method]of [[origin+'/rest/v1/manufacturing_releases','DELETE'],[origin+'/rest/v1/rpc/manufacturing_publish','POST'],[origin+'/storage/v1/object/'+ARTWORK_BUCKET+'/x','PUT'],['https://other.example/rest/v1/manufacturing_releases','GET']])await assert.rejects(()=>read(url,{method}),/refused/);
 assert.equal(calls,2);
});
function fakeDatabase({changeReferences=false,changeObjects=false}={}){
 const s=fixture();let settingsCalls=0,rootCalls=0;
 return {from(table){return {select(){return this;},order(){return this;},range(){const data=table==='manufacturing_releases'?s.releases:s.jobs;return Promise.resolve({data:structuredClone(data),error:null,count:data.length});},eq(){return this;},single(){settingsCalls++;return Promise.resolve({data:{active_release:changeReferences&&settingsCalls>1?'old':'active',artwork_cleanup_token:null,artwork_cleanup_started_at:null},error:null});}};},storage:{getBucket:async()=>({data:s.bucket,error:null}),from(){return{list:async(prefix,{offset})=>{if(prefix===''&&offset===0)rootCalls++;const p=listing(s.objects.map((o,i)=>({...listedObject(i+1),metadata:{size:o.size},created_at:o.created_at,updated_at:o.updated_at})));if(changeObjects&&rootCalls>1)p['manufacturing/sha256'][0].metadata.size=999;return{data:p[prefix].slice(offset,offset+500),error:null};}};}}};
}
test('collector compares two full metadata passes and omits cleanup tokens',async()=>{
 const s=await collectArtworkSnapshot(fakeDatabase());assert.equal(s.objects.length,6);assert.equal(s.cleanupActive,false);assert.equal(JSON.stringify(s).includes('artwork_cleanup_token'),false);assert.equal(audit(s).usage.bytes,210);
 await assert.rejects(()=>collectArtworkSnapshot(fakeDatabase({changeReferences:true})),/changed during/);
 await assert.rejects(()=>collectArtworkSnapshot(fakeDatabase({changeObjects:true})),/changed during/);
});
test('CLI requires explicit project and exposes no apply/delete argument',()=>{
 assert.equal(parseAuditArguments(['--project-ref','abcdefghijklmnopqrst']).graceDays,7);assert.deepEqual(parseAuditArguments(['--project-ref','abcdefghijklmnopqrst','--archive-release','old']).archiveReleaseIds,['old']);
 for(const args of [[],['--apply'],['--delete'],['--project-ref','wrong'],['--project-ref','abcdefghijklmnopqrst','--grace-days','1.5']])assert.throws(()=>parseAuditArguments(args));
});
