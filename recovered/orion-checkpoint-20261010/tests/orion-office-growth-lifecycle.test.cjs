'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {OrionCrewHouse}=require('../packages/core/src/orion-crew-house.cjs');
const {OrionOfficeDocumentTree}=require('../packages/core/src/orion-office-document-tree.cjs');
const {OrionTaskEngine}=require('../packages/core/src/orion-task-engine.cjs');
const {OrionOfficeGrowthLifecycle,KIND}=require('../packages/core/src/orion-office-growth-lifecycle.cjs');
function fixture(t,{assessGrowth,verifyClosure,clock}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'orion-growth-lifecycle-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const crew=new OrionCrewHouse({root});
 crew.registerChapter({chapterNumber:'0032',name:'Memory Office'});
 crew.registerChapter({chapterNumber:'0033',name:'One PP',parentChapterNumber:'0032'});
 crew.registerPledge({scrollNumber:'0045',birthNumber:'70001',name:'Custodian',
  metadata:{agentId:'librarian',stewardedPerceptionPointIds:['PP1']}});
 crew.assignPledge({scrollNumber:'0045',chapterNumber:'0033'});
 const engine=new OrionTaskEngine({root,hardwareState:()=>({
  heavyWorkPermitted:true,eDrive:{present:true,health:'healthy',freeBytes:18*1024**3}})});
 const docs=new OrionOfficeDocumentTree({root,crewHouse:crew});
 const src=docs.save({chapterNumber:'0033',perceptionPointId:'PP1',
  documentId:'source',content:'Some source with gaps and conflicting statements',
  sourceLocator:'owner-approved://original'}).receipt.data;
 const report={schema:'orion-office-linked-analysis/1.0',
  sourceDocumentId:src.documentId,sourceSha256:src.sha256,
  sourceLocator:src.sourceLocator,taskId:'original-task',
  agentId:'librarian',scrollNumber:'0045',birthNumber:'70001',
  executionReceiptId:'executor-receipt',analysis:{who:'UNKNOWN'},
  growthCandidates:[{kind:'PROVENANCE_RECONCILIATION',reason:'Who and when need review',
   proposalOnly:true},{kind:'SUB_OFFICE',reason:'Potential project scope overflow',
   proposalOnly:true}]};
 const derived=docs.save({chapterNumber:'0033',perceptionPointId:'PP1',scrollNumber:'0045',
  documentId:'analysis',content:JSON.stringify(report),
  classification:'DERIVED',origin:'ORION_AUTHORED',
  sourceLocator:'orion-task://original-task'}).receipt.data;
 const lifecycle=new OrionOfficeGrowthLifecycle({taskEngine:engine,documentTree:docs,
  crewHouse:crew,assessGrowth,verifyClosure,clock});
 return {root,crew,engine,docs,src,derived,lifecycle,report};
}
test('every growth candidate becomes an independently scheduled native TaskEngine duty; none count as executed',async t=>{
 const f=fixture(t,{clock:()=>Date.parse('2026-10-10T16:00:00Z')});
 assert.equal(f.lifecycle.install().recovered,2);
 const ids=f.engine.list().filter(t=>t.kind===KIND).map(t=>t.id);
 assert.equal(ids.length,2);assert.equal(new Set(ids).size,2);
 for(const id of ids){
  const row=await f.engine.execute(f.engine.task(id));
  assert.equal(row.status,'RETRY_READY');
  assert.equal(row.lastResult.growthReview.growthCandidatePreserved,true);
  assert.equal(row.lastResult.growthReview.newPledgeBorn,false);
  assert.equal(row.lastResult.growthReview.newOfficeCreated,false);
  assert.equal(row.availableAt,'2026-10-10T17:00:00.000Z');
  assert.equal(row.lastResult.growthReview.disposition,'REVISIT');
  assert.equal(row.lastResult.growthReview.originalSha256,f.src.sha256);
  assert.equal(row.lastResult.growthReview.derivedSha256,f.derived.sha256);
 }
 assert.equal(f.crew.scrollBook().pledges.length,1);
 assert.equal(f.crew.chapterBook().chapters.length,2);
 assert.equal(f.lifecycle.reconcile().alreadyPresent,2);
 assert.equal(f.engine.list().filter(t=>t.kind===KIND).length,2);
});
test('after interruption between analysis document save and task creation, recovery reconstructs exact same tasks',t=>{
 const f=fixture(t);
 const expected=f.lifecycle.followUps({derived:f.derived});
 assert.equal(f.engine.list().length,0);
 const boot=f.lifecycle.install();
 assert.equal(boot.recovered,2);assert.equal(boot.blocked,false);
 assert.deepEqual(f.engine.list().map(x=>x.id).sort(),expected.map(x=>x.id).sort());
 const restarted=new OrionOfficeGrowthLifecycle({taskEngine:f.engine,
  documentTree:f.docs,crewHouse:f.crew});
 assert.equal(restarted.install().recovered,0);
 assert.equal(restarted.reconcile().alreadyPresent,2);
});
test('scoped independent closure evidence is required before a growth candidate can be marked complete',async t=>{
 const f=fixture(t,{assessGrowth:async()=>({action:'CLOSED_WITH_EVIDENCE',
  evidenceRefs:['source:review-evidence'],reason:'candidate examined'})});
 f.lifecycle.install();
 const row=await f.engine.execute(f.engine.list().find(x=>x.kind===KIND));
 assert.equal(row.status,'WAITING_DEPENDENCY');
 assert.match(row.lastResult.reason,/CLOSURE_NOT_INDEPENDENTLY_VERIFIED/);
 assert.equal(f.docs.inventory().documents.length,2);
});
test('qualified closure remains attributable to original source and cannot imply unverified Office birth',async t=>{
 const f=fixture(t,{assessGrowth:()=>({action:'CLOSED_WITH_EVIDENCE',
  evidenceRefs:['qualified:independent-check'],reason:'Independent evidence disconfirmed'}),
  verifyClosure:({decision})=>decision.evidenceRefs.includes('qualified:independent-check')});
 f.lifecycle.install();const row=await f.engine.execute(f.engine.list()[0]);
 assert.equal(row.status,'COMPLETE');
 assert.equal(row.lastResult.growthReview.disposition,'CLOSED_WITH_EVIDENCE');
 assert.equal(row.lastResult.executionVerified,false);
 assert.equal(row.lastResult.growthReview.newOfficeCreated,false);
 assert.equal(f.engine.list().length,2);
});
test('derived or original data tampering blocks growth reassessment rather than pretending it was done',async t=>{
 const f=fixture(t);
 f.lifecycle.install();
 fs.writeFileSync(path.join(f.docs.root,f.derived.relativePath),'modified report');
 const row=await f.engine.execute(f.engine.list()[0]);
 assert.equal(row.status,'WAITING_DEPENDENCY');
 assert.match(row.lastResult.reason,/BYTES_TAMPERED_PRESERVED/);
});

test('new authentic PP evidence immediately reopens sleeping growth tasks, without repeated wake or cross-project leakage',async t=>{
 const f=fixture(t,{clock:()=>Date.parse('2026-10-10T16:00:00Z')});
 f.lifecycle.install();
 const ids=f.engine.list().map(x=>x.id);
 for(const id of ids)await f.engine.execute(f.engine.task(id));
 assert.equal(f.engine.list().filter(x=>x.status==='RETRY_READY').length,2);
 const second=f.docs.save({chapterNumber:'0033',perceptionPointId:'PP1',
  documentId:'new-source',content:'Previously unavailable contrary source notes',
  sourceLocator:'owner-approved://new-source'}).receipt.data;
 const wake=f.lifecycle.wakeForEvidence({chapterNumber:'0033',
  perceptionPointId:'PP1',sourceSha256:second.sha256});
 assert.equal(wake.woken,2);
 assert.equal(f.engine.list().filter(x=>x.status==='READY').length,2);
 assert.equal(f.lifecycle.wakeForEvidence({chapterNumber:'0033',
  perceptionPointId:'PP1',sourceSha256:second.sha256}).woken,0);
 assert.throws(()=>f.lifecycle.wakeForEvidence({chapterNumber:'0032',
  perceptionPointId:'PP1',sourceSha256:f.src.sha256}),/WAKE_SOURCE_NOT_AUTHORITATIVE/);
 for(const id of ids){
  const row=await f.engine.execute(f.engine.task(id));
  assert.equal(row.status,'RETRY_READY');
  assert.equal(row.lastResult.growthReview.newEvidenceSha256,second.sha256);
  assert.ok(row.lastResult.growthReview.evidenceRefs.includes('sha256:'+second.sha256));
 }
});
