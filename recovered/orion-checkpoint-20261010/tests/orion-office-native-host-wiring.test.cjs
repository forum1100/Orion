'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {OrionCrewHouse}=require('../packages/core/src/orion-crew-house.cjs');
const {PerceptionMemory}=require('../packages/core/src/perception-memory.cjs');
const {OrionCanonicalPerceptionVerifier}=require('../packages/core/src/orion-canonical-perception-verifier.cjs');
const {OrionTaskEngine}=require('../packages/core/src/orion-task-engine.cjs');
const {AgentStateFabric}=require('../packages/core/src/agent-state-fabric.cjs');
const {CapabilityBus}=require('../packages/core/src/capability-bus.cjs');
const {nativeOfficeHost}=require('../packages/core/src/orion-office-native-host-wiring.cjs');
const {documentReview,textSource}=require('../packages/core/src/orion-office-native-pledge-review.cjs');
const SHA=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixture(t,{legacyBirth=false,historicalCrew=false}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'orion-native-host-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const inbox=path.join(root,'inbox'),store=path.join(root,'ssd-custody');fs.mkdirSync(inbox);
 const crew=new OrionCrewHouse({root});
 crew.registerChapter({chapterNumber:'0032',name:'Memory'});
 crew.registerChapter({chapterNumber:'0033',name:'Project',parentChapterNumber:'0032',
  metadata:historicalCrew?{agentId:'librarian'}:{}});
 const canonicalPoint=historicalCrew
  ?new PerceptionMemory(root).observe({kind:'owner-source-record',
    data:{topic:'synthetic archival source custody'},
    context:{sourceClass:'LIVE_INTERACTION'}}):null;
 const pointId=canonicalPoint?.id||'PP1';
 crew.registerPledge({scrollNumber:'0045',
  birthNumber:(legacyBirth||historicalCrew)?null:'70001',name:'Project Steward',
  metadata:historicalCrew?{agentId:'librarian'}:
    {agentId:'librarian',stewardedPerceptionPointIds:['PP1']}});
 crew.assignPledge({scrollNumber:'0045',chapterNumber:'0033'});
 const engine=new OrionTaskEngine({root,hardwareState:()=>({heavyWorkPermitted:true,
  eDrive:{present:true,health:'healthy',freeBytes:20*1024**3}})});
 const fabric=new AgentStateFabric({root});
 const policy={
  status:()=>({ready:true,rootHash:'synthetic-signed-owner-root',activeGrants:2}),
  evaluate:({capabilityId,agentId,taskId,risk,deviceId,unattended})=>
   unattended&&agentId==='librarian'&&taskId&&deviceId==='test-device'&&
   ((capabilityId==='orion.office.document.arrived'&&risk==='LOCAL_MUTATION')||
    (capabilityId==='ORION_OFFICE_DOCUMENT_REVIEW'&&risk==='READ_ONLY'))
    ?{ok:true,grantId:'signed-fixture-owner',capabilityId,agentId,taskId,risk,deviceId}
    :{ok:false,reason:'SCOPE_DENIED'}
 };
 const bus=new CapabilityBus({standingAuthority:policy});
 const {adapter,status}=nativeOfficeHost({inboxRoot:inbox,storageRoot:store,
  rootVault:root,crewHouse:crew,taskEngine:engine,
  agentStateFabric:fabric,capabilityBus:bus,standingAuthority:policy,
  deviceId:'test-device'});
 const dirname=path.join(inbox,'0033',pointId);fs.mkdirSync(dirname,{recursive:true});
 const file=path.join(dirname,'observed-source.txt');
 fs.writeFileSync(file,'Title: New factual source\nAuthor: named in source, not verified\nDate: October 10 2026\nPurpose: Reconcile evidence\nMethod: Read local notes\nHowever original detail conflicts with another statement.\n');
 const context={unattended:true,agentId:'librarian',taskId:'native-source-001',deviceId:'test-device'};
 const request={chapterNumber:'0033',perceptionPointId:pointId,
  sourcePath:file,documentId:'source-1'};
 return {root,inbox,store,crew,engine,fabric,bus,adapter,status,context,request,file,
  canonicalPoint};
}
test('real host wiring validates PP Folder/Chapter lineage and processes source into existing Pledge checkpoint',async t=>{
 const h=fixture(t);
 assert.equal(h.status.registered,true);
 assert.equal(h.status.directoryObserverInstalled,false);
 assert.equal(h.status.externalArrivalDeliveryAlreadyActive,false);
 const call=await h.bus.call('orion.office.document.arrived',h.request,h.context);
 assert.equal(call.output.status,'DISPATCHED_TO_PLEDGE');
 const task=h.engine.task(call.output.executionReceiptId);
 assert.equal(task.status,'READY');
 const run=await h.engine.execute(task);
 assert.equal(run.status,'COMPLETE');
 assert.equal(run.lastResult.growthActionsExecuted,false);
 assert.equal(run.lastResult.linkedDerivedDocumentReadbackVerified,true);
 const documents=h.adapter.tree.inventory().documents;
 assert.equal(documents.length,2);
 const derived=documents.find(n=>n.classification==='DERIVED');
 const record=JSON.parse(h.adapter.tree.readback(derived).bytes.toString());
 assert.equal(record.analysis.who,'SOURCE_DECLARES Author: named in source, not verified');
 assert.equal(record.independentlyVerifiedTruth,false);
 assert.equal(record.growthCandidates.some(c=>c.kind==='CONTRADICTION_REVIEW'),true);
 assert.equal(h.crew.scrollBook().pledges.length,1);
 assert.equal((await h.bus.call('orion.office.document.arrived',h.request,h.context)).output.status,'ALREADY_PROCESSED');
});
test('invalid PP custody fails before storage, preserves file and cannot register unowned chapter',async t=>{
 const h=fixture(t);
 await assert.rejects(()=>h.bus.call('orion.office.document.arrived',{
  ...h.request,perceptionPointId:'PP2'},h.context),/SCOPED_PROJECT_CUSTODY_REQUIRED/);
 const unowned=path.join(h.inbox,'0032','PP1','new.txt');fs.mkdirSync(path.dirname(unowned),{recursive:true});
 fs.writeFileSync(unowned,'unowned');
 await assert.rejects(()=>h.bus.call('orion.office.document.arrived',{
  ...h.request,chapterNumber:'0032',sourcePath:unowned},h.context),/SCOPED_PROJECT_CUSTODY_REQUIRED/);
 assert.equal(h.adapter.tree.events().length,0);
 assert.equal(h.engine.list().length,0);
});
test('qualifier denies mismatched Pledge status and document execution does not acquire birth authority',async t=>{
 const h=fixture(t);
 const p=h.crew.scrollBook().pledges[0];
 assert.equal(p.birthNumber,'70001');
 assert.equal(h.status.existingCrewSelectionOnly,true);
 assert.equal(h.status.bornAgents,0);
 assert.equal(h.crew.chapterBook().chapters.length,2);
 const denied=await h.bus.call('orion.office.document.arrived',h.request,h.context);
 assert.equal(denied.output.status,'DISPATCHED_TO_PLEDGE');
 assert.equal(h.adapter.intake.events().some(e=>e.kind==='PLEDGE_BIRTH_CATALOGUED'),false);
});
test('native Pledge rejects binary/invalid UTF8 and annotates unknown facts rather than inventing them',()=>{
 const source=Buffer.from('Project files have arrived. No author or date specified.\n');
 const context={sourceBytes:source,sourceSha256:SHA(source),chapterNumber:'0033',
  perceptionPointId:'PP1',scrollNumber:'0045',birthNumber:'70001',agentId:'librarian',taskId:'review-1'};
 const s=documentReview(context);
 assert.equal(s.analysis.who,'NOT_ESTABLISHED_BY_SOURCE');
 assert.equal(s.analysis.when,'NOT_ESTABLISHED_BY_SOURCE');
 assert.equal(s.truthEstablished,false);
 assert.equal(s.growthCandidates.some(c=>c.kind==='PROVENANCE_RECONCILIATION'),true);
 assert.equal(textSource(Buffer.from([0,1,2])).supported,false);
 assert.throws(()=>documentReview({...context,sourceBytes:Buffer.from([0,1,2])}),/NOT_VERIFIED/);
});

test('historical Pledge without a recorded Birth Number retains null rather than being silently assigned a new identity',async t=>{
 const h=fixture(t,{legacyBirth:true});
 const call=await h.bus.call('orion.office.document.arrived',h.request,h.context);
 const row=await h.engine.execute(h.engine.task(call.output.executionReceiptId));
 assert.equal(row.status,'COMPLETE');
 assert.equal(row.lastResult.birthNumber,null);
 assert.equal(h.crew.scrollBook().pledges[0].birthNumber,null);
 const follow=h.engine.list().filter(x=>x.kind==='ORION_OFFICE_GROWTH_REVIEW');
 assert.equal(follow.length,1);
 assert.equal(follow[0].input.growth.birthNumber,null);
 const growth=await h.engine.execute(follow[0]);
 assert.equal(growth.status,'RETRY_READY');
 assert.equal(growth.lastResult.growthReview.birthNumber,null);
 assert.equal(h.crew.scrollBook().pledges.length,1);
});
test('new document automatically generates persistent growth re-review duties in the same TaskEngine',async t=>{
 const h=fixture(t);
 const call=await h.bus.call('orion.office.document.arrived',h.request,h.context);
 const processed=await h.engine.execute(h.engine.task(call.output.executionReceiptId));
 assert.equal(processed.status,'COMPLETE');
 assert.equal(processed.lastResult.growthTasksQueued,1);
 const growth=h.engine.list().filter(x=>x.kind==='ORION_OFFICE_GROWTH_REVIEW');
 assert.equal(growth.length,1);
 const due=await h.engine.execute(growth[0]);
 assert.equal(due.status,'RETRY_READY');
 assert.ok(Date.parse(due.availableAt)>Date.now());
 assert.equal(due.lastResult.growthReview.growthCandidatePreserved,true);
 assert.equal(due.lastResult.growthReview.disposition,'NEEDS_EVIDENCE');
 const dashboard=await h.bus.call('orion.office.growth.status');
 assert.equal(dashboard.output.open,1);
 assert.equal(dashboard.output.visibleOpen[0].nextReviewAt,due.availableAt);
 const another=path.join(path.dirname(h.file),'new-evidence.txt');
 fs.writeFileSync(another,'New supporting document for the same Perception Point.');
 const wake=await h.bus.call('orion.office.document.arrived',{...h.request,
  documentId:'additional-source',sourcePath:another},h.context);
 assert.equal(wake.output.growthTasksWoken,1);
 assert.equal(h.engine.task(growth[0].id).status,'READY');
 assert.equal((await h.bus.call('orion.office.document.arrived',{...h.request,
  documentId:'additional-source',sourcePath:another},h.context)).output.growthTasksWoken,0);
});

test('legacy Librarian may triage an exact recorded Perception Point without changing frozen Crew identities',async t=>{
 const h=fixture(t,{historicalCrew:true});
 const beforeScroll=fs.readFileSync(h.crew.scrollBookFile);
 const beforeChapter=fs.readFileSync(h.crew.chapterBookFile);
 const proof=new OrionCanonicalPerceptionVerifier({root:h.root}).verifyPoint(h.request.perceptionPointId);
 assert.equal(proof.verified,true);
 assert.equal(proof.perceptionHash,h.canonicalPoint.perceptionHash);
 const delivered=await h.bus.call('orion.office.document.arrived',h.request,h.context);
 assert.equal(delivered.output.status,'DISPATCHED_TO_PLEDGE');
 const result=await h.engine.execute(h.engine.task(delivered.output.executionReceiptId));
 assert.equal(result.status,'COMPLETE');
 assert.equal(result.lastResult.birthNumber,null);
 assert.equal(h.adapter.tree.inventory().documents.length,2);
 assert.deepEqual(fs.readFileSync(h.crew.scrollBookFile),beforeScroll);
 assert.deepEqual(fs.readFileSync(h.crew.chapterBookFile),beforeChapter);
 assert.equal(h.engine.list().filter(x=>x.kind==='ORION_OFFICE_GROWTH_REVIEW').length,1);
});
test('unregistered PP UUID or modified canonical source is rejected without creating custody',async t=>{
 const h=fixture(t,{historicalCrew:true});
 const nonexistent=crypto.randomUUID();
 const target=path.join(h.inbox,'0033',nonexistent,'rogue.txt');
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,'Unregistered point');
 await assert.rejects(()=>h.bus.call('orion.office.document.arrived',{
  ...h.request,perceptionPointId:nonexistent,sourcePath:target},h.context),
  /SCOPED_PROJECT_CUSTODY_REQUIRED/);
 const canon=path.join(h.root,'perception-memory','perception-points.jsonl');
 const verifier=new OrionCanonicalPerceptionVerifier({root:h.root});
 assert.equal(verifier.verifyPoint(h.request.perceptionPointId).verified,true);
 const old=fs.readFileSync(canon,'utf8');
 fs.writeFileSync(canon,old.replace('owner-source-record','owmer-source-record'));
 const verified=verifier.verifyPoint(h.request.perceptionPointId);
 assert.equal(verified.verified,false);
 assert.equal(verified.reason,'CANONICAL_PP_CACHED_BYTES_CHANGED');
 await assert.rejects(()=>h.bus.call('orion.office.document.arrived',h.request,h.context),
  /SCOPED_PROJECT_CUSTODY_REQUIRED/);
 assert.equal(h.adapter.tree.events().length,0);
});

test('Office custody creates distinct never-stale cloud-mirror tasks for source and derived output without unauthorized upload',async t=>{
 const h=fixture(t);
 const arrival=await h.bus.call('orion.office.document.arrived',h.request,h.context);
 assert.equal(arrival.output.status,'DISPATCHED_TO_PLEDGE');
 assert.equal(arrival.output.cloudMirrorPending,true);
 const sourceTask=h.engine.task(arrival.output.cloudMirrorTaskId);
 assert.equal(sourceTask.kind,'ORION_OFFICE_DOCUMENT_CLOUD_MIRROR');
 assert.equal(sourceTask.status,'READY');
 const processed=await h.engine.execute(h.engine.task(arrival.output.executionReceiptId));
 assert.equal(processed.status,'COMPLETE');
 assert.equal(processed.lastResult.cloudMirrorTasksQueued,1);
 const mirrorRows=h.engine.list().filter(x=>x.kind==='ORION_OFFICE_DOCUMENT_CLOUD_MIRROR');
 assert.equal(mirrorRows.length,2);
 assert.equal(new Set(mirrorRows.map(x=>x.id)).size,2);
 for(const queued of mirrorRows){
  const run=await h.engine.execute(queued);
  assert.equal(run.status,'RETRY_READY');
  assert.match(run.lastResult.reason,/SIGNED_CLOUD_SCOPE_MISSING/);
  assert.equal(run.lastResult.remoteBytesReadbackVerified,false);
  assert.equal(run.lastResult.originalStillLocalVerified,true);
 }
 assert.equal(h.adapter.cloudMirror.status().lastKnownCloudVerified,0);
 assert.equal(h.adapter.cloudMirror.mirror.rows().filter(x=>x.kind==='DRIVE_BYTES_VERIFIED').length,0);
 assert.equal(h.adapter.tree.inventory().documents.length,2);
 assert.equal(h.adapter.cloudMirror.reconcile().alreadyPresent,2);
 assert.equal(h.crew.scrollBook().pledges.length,1);
});
