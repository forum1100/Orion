'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {OrionCrewHouse}=require('../packages/core/src/orion-crew-house.cjs');
const {OrionCrewDelegation}=require('../packages/core/src/orion-crew-delegation.cjs');
const {OrionOfficeDocumentTree}=require('../packages/core/src/orion-office-document-tree.cjs');
const {OrionOfficeAutonomousIntake}=require('../packages/core/src/orion-office-autonomous-intake.cjs');
const {OrionOfficeTaskBridge,KIND}=require('../packages/core/src/orion-office-task-bridge.cjs');
const {OrionTaskEngine}=require('../packages/core/src/orion-task-engine.cjs');
const {AgentStateFabric}=require('../packages/core/src/agent-state-fabric.cjs');
function setup(t,{approved=true,executor=true,invalidReceipt=false,birth=false}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'orion-office-task-native-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const crew=new OrionCrewHouse({root});
 crew.registerChapter({chapterNumber:'0032',name:'PP Root Office'});
 crew.registerChapter({chapterNumber:'0033',name:'PP Subchapter',parentChapterNumber:'0032'});
 crew.registerPledge({scrollNumber:'0045',birthNumber:'70001',name:'Caretaker',
  metadata:{agentId:'pledge-caretaker',stewardedPerceptionPointIds:['PP1']}});
 crew.assignPledge({scrollNumber:'0045',chapterNumber:'0033'});
 const docs=new OrionOfficeDocumentTree({root,crewHouse:crew});
 const fabric=new AgentStateFabric({root});
 const engine=new OrionTaskEngine({root,hardwareState:()=>({
  heavyWorkPermitted:true,eDrive:{present:true,health:'healthy',freeBytes:12*1024**3}})});
 let invocations=0;
 const bridge=new OrionOfficeTaskBridge({taskEngine:engine,documentTree:docs,
  crewHouse:crew,agentStateFabric:fabric,deviceId:'approved-device',
  standingAuthority:{evaluate:({capabilityId,agentId,taskId,unattended})=>approved&&unattended?
   {ok:true,capabilityId,agentId,taskId,grantId:'signed-fixture'}:
   {ok:false,reason:'SIGNED_GRANT_NOT_AVAILABLE'}},
  invokePledge:executor?async ctx=>{
   invocations++;
   assert.equal(ctx.sourceBytes.toString('utf8'),'incoming document text');
   assert.equal(ctx.context.agentId,ctx.agentId);
   return {accepted:true,executionReceiptId:'qualified-execution-'+invocations,
    agentId:ctx.agentId,sourceSha256:ctx.sourceSha256,
    analysis:invalidReceipt?{who:'Author'}:{
     who:'UNKNOWN_SOURCE_AUTHOR',what:'Document added to PP',
     where:ctx.chapterNumber,when:'UNKNOWN_SOURCE_TIMESTAMP',
     why:'Assess source and infer downstream tasks',
     how:'Approved source delivered to Office task engine'},
    evidenceRefs:['sha256:'+ctx.sourceSha256],
    growthCandidates:[{kind:'PLEDGE_REVIEW',reason:'Check factual source context'}]};
  }:undefined});
 bridge.install();
 const broker=new OrionCrewDelegation({root,crewHouse:crew,
  verifyDelegationGrant:({grant})=>grant?.receiptId==='grant-fixture'});
 const decision=()=>birth?{route:'BIRTH_PLEDGE',
  why:'Native Office assigned its own Pledge for bounded source review',
  evidenceRefs:['source:PP1'],birth:{childScrollNumber:'0046',
   birthNumber:'70002',childAgentId:'child-pledge',childName:'Child',
   loadEvidence:{pointCount:1,retrievalMisses:0},
   grant:{receiptId:'grant-fixture'}}}:{
  route:'EXISTING_PLEDGE',scrollNumber:'0045',
  why:'Existing known PP steward is appropriate',
  evidenceRefs:['source:PP1']};
 const intake=new OrionOfficeAutonomousIntake({root,documentTree:docs,
  crewHouse:crew,delegation:broker,
  verifyStandingPolicy:()=>true,decideDisposition:decision,
  dispatchPledge:a=>bridge.dispatch(a),
  getDispatchStatus:a=>engine.readArchivedTask(bridge.taskId(a))});
 const input={chapterNumber:'0033',perceptionPointId:'PP1',
  documentId:'user-original',content:'incoming document text',
  sourceLocator:'owner-drive://incoming',sourceActor:'UNKNOWN',
  standingAuthority:'standing-fixture'};
 return {root,crew,docs,fabric,engine,bridge,intake,input,
  invocations:()=>invocations};
}
test('native Orion task remains queued until an authorized Pledge creates its durable checkpoint',async t=>{
 const x=setup(t);
 const first=x.intake.ingest(x.input);
 assert.equal(first.status,'DISPATCHED_TO_PLEDGE');
 assert.equal(first.receipt.data.acceptedMeans,'DURABLE_TASK_QUEUED_NOT_SEMANTICALLY_PROCESSED');
 assert.equal(first.receipt.data.durableTaskReadbackVerified,true);
 const queued=x.engine.task(first.receipt.data.executionReceiptId);
 assert.equal(queued.kind,KIND);
 assert.equal(queued.status,'READY');
 assert.equal(x.invocations(),0);
 assert.equal(x.intake.ingest(x.input).status,'ALREADY_DISPATCHED');
 const finished=await x.engine.execute(queued);
 assert.equal(finished.status,'COMPLETE');
 const actual=x.engine.readArchivedTask(queued.id);
 assert.equal(actual.lastResult.status,'COMPLETE');
 assert.equal(actual.lastResult.sourceReadbackVerified,true);
 assert.equal(actual.lastResult.linkedDerivedDocumentReadbackVerified,true);
 assert.ok(actual.lastResult.checkpointId);
 const stored=x.docs.inventory({perceptionPointId:'PP1'}).documents;
 assert.equal(stored.length,2);
 const derived=stored.find(d=>d.classification==='DERIVED');
 const original=stored.find(d=>d.classification==='SOURCE_COPY');
 assert.equal(derived.scrollNumber,'0045');
 assert.equal(derived.birthNumber,'70001');
 assert.deepEqual(derived.chapterLineage,['0032','0033']);
 const report=JSON.parse(x.docs.readback(derived).bytes.toString('utf8'));
 assert.equal(report.sourceSha256,original.sha256);
 assert.equal(report.independentlyVerifiedTruth,false);
 assert.equal(report.evidenceStatus,'PLEDGE_REPORTED_DERIVATION_NOT_ORIGINAL_SOURCE');
 assert.ok(x.fabric.resumeHeader('pledge-caretaker').latestCheckpoint.cursor.analysisDocumentSha256===derived.sha256);
 assert.equal(x.invocations(),1);
 assert.equal(x.intake.ingest(x.input).status,'ALREADY_PROCESSED');
 assert.equal(x.crew.scrollBook().pledges.length,1);
 assert.equal(x.fabric.resumeHeader('pledge-caretaker').latestCheckpoint.status,'COMPLETE');
});
test('missing signed grant cannot execute waiting task or claim semantic completion',async t=>{
 const x=setup(t,{approved:false});
 const submission=x.intake.ingest(x.input);
 const row=await x.engine.execute(x.engine.task(submission.receipt.data.executionReceiptId));
 assert.equal(row.status,'WAITING_DEPENDENCY');
 assert.match(x.engine.task(row.id).lastResult.reason,/SIGNED_SCOPE_DENIED/);
 assert.equal(x.invocations(),0);
 assert.equal(x.intake.ingest(x.input).status,'ALREADY_DISPATCHED');
 assert.equal(x.fabric.recentHeaders().length,0);
});
test('missing trusted Pledge executor is recorded as task dependency rather than successful review',async t=>{
 const x=setup(t,{executor:false});
 const submission=x.intake.ingest(x.input);
 const task=await x.engine.execute(x.engine.task(submission.receipt.data.executionReceiptId));
 assert.equal(task.status,'WAITING_DEPENDENCY');
 assert.match(x.engine.task(task.id).lastResult.reason,/EXECUTOR_NOT_WIRED/);
 assert.equal(x.intake.ingest(x.input).processingComplete,false);
});
test('incomplete who what where when why how creates a durable agent failure checkpoint, not a complete task',async t=>{
 const x=setup(t,{invalidReceipt:true});
 const submission=x.intake.ingest(x.input);
 const task=await x.engine.execute(x.engine.task(submission.receipt.data.executionReceiptId));
 assert.equal(task.status,'WAITING_DEPENDENCY');
 assert.match(x.engine.task(task.id).lastResult.reason,/SEMANTIC_RECEIPT_INCOMPLETE/);
 assert.equal(x.fabric.resumeHeader('pledge-caretaker').latestCheckpoint.status,'WAITING_DEPENDENCY');
});
test('re-discovery after an interrupted Pledge birth reuses original Scroll/Birth and dispatches a single durable task',async t=>{
 const x=setup(t,{birth:true});
 const first=x.intake.ingest(x.input);
 assert.equal(first.status,'DISPATCHED_TO_PLEDGE');
 assert.equal(first.pledge.scrollNumber,'0046');
 assert.equal(first.pledge.birthNumber,'70002');
 assert.equal(x.crew.scrollBook().pledges.length,2);
 assert.equal(x.intake.ingest(x.input).status,'ALREADY_DISPATCHED');
 const task=await x.engine.execute(x.engine.task(first.receipt.data.executionReceiptId));
 assert.equal(task.status,'COMPLETE');
 assert.equal(x.intake.ingest(x.input).status,'ALREADY_PROCESSED');
 assert.equal(x.crew.scrollBook().pledges.length,2);
});
test('tampered stored document fails closed before task birth or Pledge execution',t=>{
 const x=setup(t);
 const submission=x.intake.ingest(x.input);
 const p=x.docs.events().find(e=>e.kind==='DOCUMENT_STORED').data.relativePath;
 fs.writeFileSync(path.join(x.docs.root,p),'tampered text');
 assert.throws(()=>x.bridge.dispatch(submission.receipt.data.assignment),
  /BYTES_TAMPERED_PRESERVED/);
 assert.equal(x.invocations(),0);
});
