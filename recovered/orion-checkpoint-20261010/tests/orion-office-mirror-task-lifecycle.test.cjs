'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {OrionCrewHouse}=require('../packages/core/src/orion-crew-house.cjs');
const {OrionOfficeDocumentTree}=require('../packages/core/src/orion-office-document-tree.cjs');
const {OrionTaskEngine}=require('../packages/core/src/orion-task-engine.cjs');
const {OrionOfficeMirrorTaskLifecycle,KIND,CAPABILITY}=require('../packages/core/src/orion-office-mirror-task-lifecycle.cjs');
function fixture(t,{grant=false,provider=null,allowDestination=true,clock}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'orion-mirror-durable-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const crew=new OrionCrewHouse({root});
 crew.registerChapter({chapterNumber:'0032',name:'Source Office'});
 crew.registerChapter({chapterNumber:'0033',name:'Child Office',parentChapterNumber:'0032'});
 const docs=new OrionOfficeDocumentTree({root,crewHouse:crew});
 const original=docs.save({chapterNumber:'0033',perceptionPointId:'PP1',
  documentId:'human-record',content:'Human source provenance preserved',
  sourceLocator:'approved-owner-record://1'}).receipt;
 const engine=new OrionTaskEngine({root,hardwareState:()=>({heavyWorkPermitted:true,
  eDrive:{present:true,health:'healthy',freeBytes:30*1024**3}})});
 const authority={status:()=>({reason:'SIGNED_GRANTS_AVAILABLE'}),
  evaluate:({capabilityId,agentId,taskId,risk,deviceId,unattended})=>
   grant&&capabilityId===CAPABILITY&&agentId==='librarian'&&taskId&&
   risk==='EXTERNAL_MUTATION'&&deviceId==='own-device'&&unattended?
   {ok:true,capabilityId,agentId,taskId,risk,deviceId,
    grantId:'OWNER_VERIFIED_EXTERNAL_SCOPE'}:
   {ok:false,reason:'NO_MATCHING_STANDING_GRANT'}};
 const lifecycle=new OrionOfficeMirrorTaskLifecycle({root,taskEngine:engine,
  documentTree:docs,standingAuthority:authority,deviceId:'own-device',
  provider,verifyCloudDestination:()=>allowDestination,clock});
 return {root,docs,original,engine,lifecycle,authority};
}
test('every original source gets a deterministic durable cloud task and denied grant keeps it scheduled not falsely mirrored',async t=>{
 const f=fixture(t,{clock:()=>Date.parse('2026-10-10T12:00:00Z')});
 const startup=f.lifecycle.install();
 assert.equal(startup.recovered,1);
 assert.equal(f.engine.list().filter(x=>x.kind===KIND).length,1);
 const task=f.engine.list()[0];assert.equal(task.responsibleAgentId,'librarian');
 const denied=await f.engine.execute(task);
 assert.equal(denied.status,'RETRY_READY');
 assert.equal(denied.availableAt,'2026-10-11T12:00:00.000Z');
 assert.match(denied.lastResult.reason,/SIGNED_CLOUD_SCOPE_MISSING/);
 assert.equal(denied.lastResult.remoteBytesReadbackVerified,false);
 assert.equal(f.lifecycle.status().lastKnownCloudVerified,0);
 assert.equal(f.lifecycle.reconcile().alreadyPresent,1);
 assert.equal(f.engine.list().filter(x=>x.kind===KIND).length,1);
});
test('cloud provider cannot upload at all without owner signed external mutation grant',async t=>{
 let calls=0;
 const provider={putDocument:async()=>{calls++;return {fileId:'wrong'};},
  readDocumentBytes:async()=>{calls++;return Buffer.alloc(0);}};
 const f=fixture(t,{grant:false,provider});
 f.lifecycle.install();
 const result=await f.engine.execute(f.engine.list()[0]);
 assert.equal(result.status,'RETRY_READY');assert.equal(calls,0);
});
test('verified owner grant plus provider byte readback creates provenance-linked terminal cloud task',async t=>{
 let calls=0,remote=new Map();
 const provider={putDocument:async request=>{calls++;
  const remoteId='id:'+request.sha256;
  remote.set(remoteId,Buffer.from(request.bytes));
  assert.equal(request.destination[0],'Chapter 0032 - Source-Office');
  assert.equal(request.destination[1],'Chapter 0033 - Child-Office');
  return {fileId:remoteId};},
  readDocumentBytes:async({fileId})=>remote.get(fileId)};
 const f=fixture(t,{grant:true,provider});
 f.lifecycle.install();
 const row=await f.engine.execute(f.engine.list()[0]);
 assert.equal(row.status,'COMPLETE');assert.equal(row.lastResult.mirrored,true);
 assert.equal(row.lastResult.providerReadbackVerified,true);
 assert.equal(f.lifecycle.status().lastKnownCloudVerified,1);
 assert.equal(calls,1);assert.equal(f.docs.inventory().documents.length,1);
 const receipt=f.lifecycle.mirror.rows().find(e=>e.kind==='DRIVE_BYTES_VERIFIED');
 assert.equal(receipt.data.sha256,f.original.data.sha256);
 const again=await f.lifecycle.mirror.mirror(f.original,
  {authority:f.authority.evaluate({capabilityId:CAPABILITY,agentId:'librarian',
   risk:'EXTERNAL_MUTATION',taskId:'cloud-verify',deviceId:'own-device',unattended:true})});
 assert.equal(again.alreadyVerified,true);
 assert.equal(again.currentRemoteBytesReadbackVerified,true);
 assert.equal(calls,1);
 remote.delete(row.lastResult.remoteFileId);
 const restored=await f.lifecycle.mirror.mirror(f.original,
  {authority:f.authority.evaluate({capabilityId:CAPABILITY,agentId:'librarian',
   risk:'EXTERNAL_MUTATION',taskId:'cloud-verify-recover',deviceId:'own-device',unattended:true})});
 assert.equal(restored.alreadyVerified,false);assert.equal(calls,2);
 assert.equal(f.lifecycle.mirror.rows().some(e=>e.kind==='DRIVE_REMOTE_STALE_PRESERVED'),true);
});
test('provider rejection or wrong remote byte hash never closes task and preserves original SSD',async t=>{
 const p={putDocument:async()=>({fileId:'wrong-bytes'}),
  readDocumentBytes:async()=>Buffer.from('incorrect bytes')};
 const f=fixture(t,{grant:true,provider:p});
 f.lifecycle.install();const row=await f.engine.execute(f.engine.list()[0]);
 assert.equal(row.status,'RETRY_READY');
 assert.match(row.lastResult.reason,/REMOTE_BYTES_MISMATCH/);
 assert.equal(f.lifecycle.status().lastKnownCloudVerified,0);
 assert.equal(f.docs.readback(f.original.data).verified,true);
});
test('unqualified Drive destination blocks upload even if signed write capability otherwise permits it',async t=>{
 let uploads=0;
 const p={putDocument:async()=>{uploads++;return {fileId:'f'};},
  readDocumentBytes:async()=>Buffer.alloc(1)};
 const f=fixture(t,{grant:true,provider:p,allowDestination:false});
 f.lifecycle.install();const row=await f.engine.execute(f.engine.list()[0]);
 assert.equal(row.status,'RETRY_READY');
 assert.match(row.lastResult.reason,/PRIVATE_DESTINATION_UNQUALIFIED/);
 assert.equal(uploads,0);
});
test('source task recovery recreates missing mirror task and provider connection wakes deferred native review promptly',async t=>{
 const f=fixture(t,{grant:false});
 assert.equal(f.engine.list().length,0);
 assert.equal(f.lifecycle.install().recovered,1);
 assert.equal(f.lifecycle.reconcile().recovered,0);
 const row=await f.engine.execute(f.engine.list()[0]);
 assert.equal(row.status,'RETRY_READY');
 const provider={putDocument:async()=>({fileId:'f'}),readDocumentBytes:async()=>Buffer.from('irrelevant')};
 assert.equal(f.lifecycle.setProvider(provider).resumed,1);
 assert.equal(f.engine.list()[0].status,'READY');
 assert.equal(f.engine.runnable().length,1);
});
test('invalid source bytes are not silently mirrored or orphaned',async t=>{
 const f=fixture(t,{grant:true});
 f.lifecycle.install();
 fs.writeFileSync(path.join(f.docs.root,f.original.data.relativePath),'tampered');
 const row=await f.engine.execute(f.engine.list()[0]);
 assert.equal(row.status,'WAITING_DEPENDENCY');
 assert.match(row.lastResult.reason,/BYTES_TAMPERED_PRESERVED/);
 assert.equal(f.lifecycle.status().lastKnownCloudVerified,0);
});
