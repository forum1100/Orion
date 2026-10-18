'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {OrionCrewHouse}=require('../packages/core/src/orion-crew-house.cjs');
const {OrionCrewDelegation}=require('../packages/core/src/orion-crew-delegation.cjs');
const {OrionOfficeDocumentTree}=require('../packages/core/src/orion-office-document-tree.cjs');
const {OrionOfficeAutonomousIntake}=require('../packages/core/src/orion-office-autonomous-intake.cjs');
function fixture(t,{allow=true,dispatcher=true,decision=null}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'orion-office-autonomy-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const crew=new OrionCrewHouse({root});
 crew.registerChapter({chapterNumber:'0032',name:'Parent Office'});
 crew.registerChapter({chapterNumber:'0033',name:'One PP Office',parentChapterNumber:'0032'});
 crew.registerPledge({scrollNumber:'0045',birthNumber:'70001',name:'PP steward',
  status:'RESTING',metadata:{agentId:'steward',stewardedPerceptionPointIds:['PP1']}});
 crew.assignPledge({scrollNumber:'0045',chapterNumber:'0033',reason:'FOUNDING_LINEAGE'});
 const sources=path.join(root,'sources');fs.mkdirSync(sources);
 const tree=new OrionOfficeDocumentTree({root,crewHouse:crew,allowedSourceRoots:[sources]});
 const grant={receiptId:'grant-fixture',actions:['CREW_BIRTH_DORMANT_AGENT']};
 const broker=new OrionCrewDelegation({root,crewHouse:crew,
  verifyDelegationGrant:({grant:g})=>g.receiptId===grant.receiptId});
 let count=0;let observed=null;
 const intake=new OrionOfficeAutonomousIntake({root,documentTree:tree,crewHouse:crew,
  delegation:broker,
  verifyStandingPolicy:()=>allow,
  decideDisposition:decision||(()=>({route:'EXISTING_PLEDGE',scrollNumber:'0045',
   why:'PP source needs independent review',evidenceRefs:['original:PP1']})),
  dispatchPledge:dispatcher?assignment=>{count++;observed=assignment;
   return {accepted:true,executionReceiptId:'executor-job-'+count};}:undefined
 });
 return {root,crew,sources,tree,intake,broker,grant,counts:()=>({count,observed})};
}
test('actual bytes live in nested Chapter name / PP / Scroll directories and preserve custody after readback',t=>{
 const {tree,crew}=fixture(t);
 const original=Buffer.from('Raw contradiction + a frozen moment\nwith exact source bytes','utf8');
 const result=tree.save({chapterNumber:'0033',perceptionPointId:'PP1',
  scrollNumber:'0045',documentId:'original-document',content:original,
  sourceLocator:'owner-drive://source-1'});
 assert.equal(result.created,true);
 const row=result.receipt.data;
 assert.deepEqual(row.chapterLineage,['0032','0033']);
 assert.ok(row.folderLabels[0].includes('Parent-Office'));
 assert.ok(row.folderLabels[1].includes('One-PP-Office'));
 assert.equal(row.birthNumber,'70001');
 assert.equal(row.driveMirrorStatus,'PENDING_PROVIDER_BYTES_READBACK');
 assert.deepEqual(tree.readback(row).bytes,original);
 assert.ok(fs.existsSync(path.join(tree.root,row.relativePath)));
 assert.equal(crew.scrollBook().pledges.length,1);
 assert.equal(tree.save({chapterNumber:'0033',perceptionPointId:'PP1',
  scrollNumber:'0045',documentId:'original-document',content:original,
  sourceLocator:'owner-drive://source-1'}).created,false);
});
test('external document is dispatched autonomously to existing resting Pledge once, preserving why, where and source hash',t=>{
 const {tree,intake,counts}=fixture(t);
 const input={chapterNumber:'0033',perceptionPointId:'PP1',
  documentId:'external-note',content:'Founding PP source',
  sourceLocator:'owner-drive://new-file',sourceActor:'user-authored',
  standingAuthority:'predelegated'};
 const first=intake.ingest(input);
 assert.equal(first.status,'DISPATCHED_TO_PLEDGE');
 assert.equal(first.processingComplete,false);
 assert.equal(first.pledge.scrollNumber,'0045');
 assert.equal(counts().count,1);
 assert.equal(counts().observed.task,'TRACE_WHO_WHAT_WHERE_WHEN_WHY_HOW_AND_GROWTH');
 assert.equal(intake.ingest(input).status,'ALREADY_DISPATCHED');
 assert.equal(counts().count,1);
 assert.equal(intake.events().filter(e=>e.kind==='DOCUMENT_TASK_ACCEPTED').length,1);
 assert.equal(tree.inventory().documents.length,1);
});
test('office may autonomously birth distinct numbered Pledge then actually dispatch through executor',t=>{
 let grant;
 const {crew,intake,counts}=fixture(t,{decision:()=>({route:'BIRTH_PLEDGE',
  why:'Existing Pledge cannot responsibly process this source',
  evidenceRefs:['original:PP1'],birth:{
   childScrollNumber:'0046',birthNumber:'70002',childAgentId:'child-2',
   childName:'New Source Custodian',loadEvidence:{pointCount:1,retrievalMisses:1},
   get grant(){return {receiptId:'grant-fixture',actions:['CREW_BIRTH_DORMANT_AGENT']};}
  }})});
 const before=crew.scrollBook().pledges.length;
 const result=intake.ingest({chapterNumber:'0033',perceptionPointId:'PP1',
  documentId:'incoming',content:'New evidence that needs a new custodian',
  sourceLocator:'owner-drive://source-2',standingAuthority:'existing-policy'});
 assert.equal(result.status,'DISPATCHED_TO_PLEDGE');
 assert.equal(crew.scrollBook().pledges.length,before+1);
 assert.equal(result.pledge.birthNumber,'70002');
 assert.equal(result.pledge.scrollNumber,'0046');
 assert.equal(counts().observed.scrollNumber,'0046');
 assert.equal(counts().count,1);
 assert.ok(intake.events().some(e=>e.kind==='PLEDGE_BIRTH_CATALOGUED'));
 assert.equal(result.processingComplete,false);
});
test('no standing authorization or no native executor preserves source and explicit blocker without pretending processed',t=>{
 const f=fixture(t,{allow:false});
 const args={chapterNumber:'0033',perceptionPointId:'PP1',documentId:'pending',
  content:'unprocessed',sourceLocator:'external://new'};
 const r=f.intake.ingest(args);
 assert.equal(r.status,'WAITING_DEPENDENCY');
 assert.match(r.reason,/AUTHORITY_NOT_VERIFIED/);
 assert.equal(f.tree.inventory().documents.length,1);
 assert.equal(f.intake.events().filter(e=>e.kind==='DOCUMENT_TASK_ACCEPTED').length,0);
 const g=fixture(t,{dispatcher:false});
 const p=g.intake.ingest(args);
 assert.equal(p.status,'WAITING_DEPENDENCY');
 assert.match(p.reason,/PLEDGE_EXECUTOR_NOT_WIRED/);
 assert.equal(g.intake.events().some(e=>e.kind==='DOCUMENT_TASK_ACCEPTED'),false);
});
test('actual document bytes fail closed after tampering and unauthorized imports cannot be made authoritative',t=>{
 const {root,sources,tree}=fixture(t);
 const file=path.join(sources,'owned.txt');
 fs.writeFileSync(file,'These are original bytes');
 const v=tree.importSource({sourcePath:file,chapterNumber:'0033',perceptionPointId:'PP1',
  documentId:'original-import'});
 assert.equal(v.created,true);
 assert.equal(fs.readFileSync(file,'utf8'),'These are original bytes');
 const unrelated=path.join(root,'outside.txt');fs.writeFileSync(unrelated,'private');
 assert.throws(()=>tree.importSource({sourcePath:unrelated,chapterNumber:'0033',
  perceptionPointId:'PP1',documentId:'no'}),/OUTSIDE_AUTHORIZED_ROOT/);
 const target=path.join(tree.root,v.receipt.data.relativePath);
 fs.writeFileSync(target,'forged');
 assert.throws(()=>tree.inventory(),/BYTES_TAMPERED_PRESERVED/);
});
