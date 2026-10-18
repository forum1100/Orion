'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {OrionCrewHouse}=require('../packages/core/src/orion-crew-house.cjs');
const {OrionCrewDelegation}=require('../packages/core/src/orion-crew-delegation.cjs');
function setup(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'orion-crew-delegation-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const crew=new OrionCrewHouse({root});
 crew.registerChapter({chapterNumber:'0032',name:'Memory Office'});
 crew.registerPledge({scrollNumber:'0045',birthNumber:'70001',name:'Original PP Steward',
  metadata:{agentId:'founding-steward',stewardedPerceptionPointIds:['PP-FOUNDING-01']}});
 crew.assignPledge({scrollNumber:'0045',chapterNumber:'0032',reason:'ORIGINAL_SOURCE'});
 // Synthetic verifier exercises the injected authorization boundary.
 // It is NOT evidence that the live Orion has this caller/authentication wiring.
 const verifyDelegationGrant=({grant,action})=>grant.issuedBy==='OWNER_POLICY_QUALIFIED'&&
  grant.actions.includes(action)&&grant.receiptId==='grant-001';
 const broker=new OrionCrewDelegation({root,crewHouse:crew,verifyDelegationGrant});
 const grant={issuedBy:'OWNER_POLICY_QUALIFIED',
  actions:['CREW_PROMOTE_SCROLL','CREW_BIRTH_DORMANT_AGENT','CREW_INITIATE_OFFICE'],receiptId:'grant-001'};
 const common={perceptionPointId:'PP-FOUNDING-01',reason:'measured PP source growth',
  evidenceRefs:['source:PP-FOUNDING-01','metric:retrieval-2026-10-10'],
  loadEvidence:{pointCount:81,retrievalMisses:3,coordinationBurden:'HIGH'},grant};
 return {crew,broker,grant,common};
}
test('Office promotes founding Pledge without changing Scroll or birth Number; manager creates subordinate Pledge',t=>{
 const {crew,broker,common}=setup(t);
 const founding=crew.scrollBook().pledges.find(x=>x.scrollNumber==='0045');
 const identity=founding.durableIdentityId,birthNumber=founding.birthNumber;
 const promoted=broker.promote({...common,scrollNumber:'0045',
  initiatedBy:{kind:'OFFICE',id:'0032'}});
 assert.equal(promoted.promoted,true);
 const parent=crew.scrollBook().pledges.find(x=>x.scrollNumber==='0045');
 assert.equal(parent.durableIdentityId,identity);
 assert.equal(parent.birthNumber,birthNumber);
 assert.equal(parent.rank,'PERCEPTION_POINT_MANAGER');
 assert.equal(parent.managerOfPerceptionPointId,'PP-FOUNDING-01');
 const child=broker.birth({...common,initiatedBy:{kind:'SCROLL_MANAGER',id:'0045'},
  parentScrollNumber:'0045',childScrollNumber:'0046',birthNumber:'70002',
  childAgentId:'new-pp-helper',childName:'Dormant Source Verifier'});
 assert.equal(child.pledge.status,'RESTING');
 assert.equal(child.pledge.scrollNumber,'0046');
 assert.equal(child.pledge.birthNumber,'70002');
 assert.equal(child.pledge.metadata.parentScrollNumber,'0045');
 assert.equal(child.pledge.metadata.originPerceptionPointId,'PP-FOUNDING-01');
 assert.equal(child.activeProcessStarted,false);
 assert.notEqual(child.pledge.durableIdentityId,identity);
 assert.equal(crew.chapterBook().chapters.length,1);
 assert.equal(broker.trace({perceptionPointId:'PP-FOUNDING-01'}).events.length,4);
 assert.ok(crew.history().some(x=>x.eventType==='SCROLL_RANK_PROMOTED'));
});
test('Librarian and Office each may manufacture a distinct dormant TKE Pledge with unique Scroll and birth Numbers',t=>{
 const {crew,broker,common}=setup(t);
 const l=broker.birth({...common,initiatedBy:{kind:'LIBRARIAN',id:'ORION_INTERNAL_LIBRARIAN'},
  childScrollNumber:'0100',birthNumber:'80001',childAgentId:'librarian-created-helper',
  childName:'Librarian Research Custodian'});
 const o=broker.birth({...common,initiatedBy:{kind:'OFFICE',id:'0032'},
  childScrollNumber:'0101',birthNumber:'80002',childAgentId:'office-created-helper',
  childName:'Office PP Custodian'});
 assert.equal(l.pledge.metadata.createdBy.kind,'LIBRARIAN');
 assert.equal(o.pledge.metadata.createdBy.kind,'OFFICE');
 assert.notEqual(l.pledge.birthNumber,o.pledge.birthNumber);
 assert.notEqual(l.pledge.scrollNumber,o.pledge.scrollNumber);
 assert.equal(crew.scrollBook().pledges.length,3);
 assert.equal(crew.scrollBook().pledges.filter(p=>p.status==='RESTING').length,3);
 assert.equal(broker.trace().journalIntegrityVerified,true);
});
test('a single simple Perception Point can justify an autonomous Orion-created Office',t=>{
 const {crew,broker,grant}=setup(t);
 const before=fs.readFileSync(crew.chapterBookFile,'utf8');
 const input={initiatedBy:{kind:'ORION',id:'ORION_BRAIN'},
  chapterNumber:'0033',name:'One-Point Custody Office',
  perceptionPointId:'PP-ONE',responsibility:'Independent custody of one PP',
  reason:'Single point has a dedicated bounded provenance duty',
  evidenceRefs:['original:PP-ONE'],needsIndependentOffice:true,grant};
 const decision=broker.assessOfficeNeed(input);
 assert.equal(decision.justified,true);
 assert.equal(decision.singlePerceptionPointCanJustifyOffice,true);
 const result=broker.initiateOffice(input);
 assert.equal(result.created,true);
 assert.equal(result.agentProcessesSpawned,0);
 assert.equal(result.chapter.chapterNumber,'0033');
 assert.equal(result.chapter.metadata.originPerceptionPointId,'PP-ONE');
 assert.equal(result.chapter.metadata.createdBy.kind,'ORION');
 assert.notEqual(fs.readFileSync(crew.chapterBookFile,'utf8'),before);
 const again=broker.initiateOffice({...input,chapterNumber:'0034'});
 assert.equal(again.created,false);
 assert.throws(()=>broker.initiateOffice({...input,chapterNumber:'0034',
  grant:{receiptId:'forged'}}),/VERIFIED_CAPABILITY_REQUIRED/);
 assert.equal(again.chapter.chapterNumber,'0033');
 assert.equal(crew.chapterBook().chapters.length,2);
 assert.equal(broker.trace({perceptionPointId:'PP-ONE'}).events.length,2);
});
test('an existing Office may independently initiate a child Chapter for one Perception Point',t=>{
 const {crew,broker,grant}=setup(t);
 const child=broker.initiateOffice({
  initiatedBy:{kind:'OFFICE',id:'0032'},parentChapterNumber:'0032',
  chapterNumber:'0033',name:'Focused PP Office',perceptionPointId:'PP-ONE',
  responsibility:'Independent source validation',reason:'Single PP has a distinct mandate',
  evidenceRefs:['PP-ONE:source'],needsIndependentOffice:true,grant
 });
 assert.equal(child.created,true);
 assert.equal(child.chapter.parentChapterNumber,'0032');
 assert.deepEqual(crew.chapterDescendants('0032'),['0033']);
});
test('Office initiation rejects fabricated authority, unjustified work, and incorrect supervision',t=>{
 const {crew,broker,grant}=setup(t);
 const before=fs.readFileSync(crew.chapterBookFile,'utf8');
 const base={initiatedBy:{kind:'ORION',id:'ORION_BRAIN'},
  chapterNumber:'0033',name:'Source Office',perceptionPointId:'PP-ONE',
  responsibility:'One point custody',reason:'Necessary ownership',
  evidenceRefs:['PP-ONE:source'],needsIndependentOffice:true,grant};
 assert.throws(()=>broker.initiateOffice({...base,grant:{receiptId:'forged'}}),
  /VERIFIED_CAPABILITY_REQUIRED/);
 assert.throws(()=>broker.initiateOffice({...base,needsIndependentOffice:false}),
  /NOT_JUSTIFIED/);
 assert.throws(()=>broker.initiateOffice({...base,evidenceRefs:[]}),
  /NOT_JUSTIFIED/);
 assert.throws(()=>broker.initiateOffice({...base,
  initiatedBy:{kind:'OFFICE',id:'0032'},parentChapterNumber:null}),
  /PARENT_CHAPTER_MISMATCH/);
 assert.equal(fs.readFileSync(crew.chapterBookFile,'utf8'),before);
});
test('unknown Pledge creator, bad authority, no evidence or unrelated manager cannot manufacture a Pledge',t=>{
 const {crew,broker,common}=setup(t);
 const prior=fs.readFileSync(crew.scrollBookFile,'utf8');
 const base={...common,childScrollNumber:'0100',birthNumber:'80001',
  childAgentId:'forbidden',childName:'X'};
 assert.throws(()=>broker.birth({...base,initiatedBy:{kind:'OFFICE',id:'9999'}}),
  /OFFICE_NOT_REGISTERED/);
 assert.throws(()=>broker.birth({...base,initiatedBy:{kind:'LIBRARIAN',id:'ORION_INTERNAL_LIBRARIAN'},
  grant:{receiptId:'forged'}}),/VERIFIED_CAPABILITY_REQUIRED/);
 assert.throws(()=>broker.birth({...base,initiatedBy:{kind:'LIBRARIAN',id:'ORION_INTERNAL_LIBRARIAN'},
  loadEvidence:null}),/MEASURED_JUSTIFICATION_REQUIRED/);
 assert.throws(()=>broker.birth({...base,initiatedBy:{kind:'SCROLL_MANAGER',id:'0045'},
  parentScrollNumber:'0045'}),/NOT_MANAGER_OF_POINT/);
 assert.throws(()=>broker.birth({...base,initiatedBy:{kind:'OFFICE',id:'0032'},
  birthNumber:null}),/PLEDGE_DISTINCT_BIRTH_NUMBER_REQUIRED/);
 assert.equal(fs.readFileSync(crew.scrollBookFile,'utf8'),prior);
});
test('duplicate Scroll and duplicate birth Number never silently replace a prior Pledge',t=>{
 const {crew,broker,common}=setup(t);
 const options={...common,initiatedBy:{kind:'OFFICE',id:'0032'},
  childScrollNumber:'0100',birthNumber:'80001',childAgentId:'newborn-0100',childName:'First'};
 broker.birth(options);
 assert.throws(()=>broker.birth({...options,childAgentId:'different',childName:'Second'}),
  /SCROLL_ALREADY_ASSIGNED/);
 assert.throws(()=>broker.birth({...options,childScrollNumber:'0101',childAgentId:'different'}),
  /PLEDGE_BIRTH_NUMBER_ALREADY_ASSIGNED/);
 assert.equal(crew.scrollBook().pledges.length,2);
 assert.ok(broker.trace().events.some(x=>x.kind==='BIRTH_FAILED_PRESERVED'));
});
test('tampered delegation journal cannot be treated as validated Pledge history',t=>{
 const {broker,common}=setup(t);
 broker.birth({...common,initiatedBy:{kind:'LIBRARIAN',id:'ORION_INTERNAL_LIBRARIAN'},
  childScrollNumber:'0100',birthNumber:'80001',childAgentId:'child-1',childName:'Child'});
 const rows=fs.readFileSync(broker.journal,'utf8').trim().split(/\r?\n/);
 const forged=JSON.parse(rows[0]);forged.data.childAgentId='fake';rows[0]=JSON.stringify(forged);
 fs.writeFileSync(broker.journal,rows.join('\n')+'\n');
 assert.throws(()=>broker.trace(),/JOURNAL_INTEGRITY_FAILURE_PRESERVED/);
});

test('one Perception Point can recursively split into three sub-Offices at proven project-specific safe-context boundaries',t=>{
 const {crew,grant}=setup(t);
 const root=path.dirname(crew.root);
 const broker=new OrionCrewDelegation({root,crewHouse:crew,
  verifyDelegationGrant:({grant:g,action})=>g.receiptId===grant.receiptId&&g.actions.includes(action),
  verifyContextBenchmark:({benchmark,perceptionPointId,projectId,contextPartitionKey})=>
   benchmark.benchmarkReceiptId.startsWith('synthetic-receipt-')&&
   benchmark.projectId===projectId&&benchmark.perceptionPointId===perceptionPointId&&
   Boolean(contextPartitionKey)
 });
 const makeBenchmark=(contentProfileId,requiredUnits,maxSafe)=>({
  projectId:'PROJECT-CONTEXT-PP1',perceptionPointId:'PP-ONE',
  contentProfileId,benchmarkReceiptId:'synthetic-receipt-'+contentProfileId,
  unit:'PROJECT_EFFECTIVE_CONTEXT_UNITS',
  provenMaximumSafeUnits:maxSafe,requiredUnits,
  originalSourceReadbackPass:true,semanticReconstructionPass:true,
  contradictionPreservationPass:true,frozenMomentReplayPass:true
 });
 const beforeScroll=fs.readFileSync(crew.scrollBookFile,'utf8');
 const chapters=['0033','0034','0035'];
 let parent='0032';
 for(const [index,chapterNumber] of chapters.entries()){
  const partition='partition-'+(index+1);
  const responsibility='PP-ONE source memory custody';
  const input={
   initiatedBy:{kind:'OFFICE',id:parent},parentChapterNumber:parent,
   chapterNumber,name:'PP nested Office '+(index+1),
   perceptionPointId:'PP-ONE',projectId:'PROJECT-CONTEXT-PP1',
   contextPartitionKey:partition,
   contextBenchmark:makeBenchmark('profile-'+(index+1),12+index,6),
   responsibility,reason:'measured project working context exceeds safe reconstruction envelope',
   evidenceRefs:['source:PP-ONE','benchmark:profile-'+(index+1)],grant
  };
  const assessment=broker.assessOfficeNeed(input);
  assert.equal(assessment.justified,true);
  assert.equal(assessment.basis,'VERIFIED_PROJECT_CONTEXT_OVERFLOW');
  assert.equal(assessment.context.modelContextWindowChanged,false);
  const response=broker.initiateOffice(input);
  assert.equal(response.chapter.parentChapterNumber,parent);
  assert.equal(response.chapter.metadata.contextBenchmark.provenMaximumSafeUnits,6);
  assert.equal(response.chapter.metadata.contextPartitionKey,partition);
  assert.equal(broker.initiateOffice({...input,chapterNumber:'0099'}).created,false);
  parent=chapterNumber;
 }
 assert.deepEqual(crew.chapterDescendants('0032'),chapters);
 assert.equal(crew.chapterBook().chapters.length,4);
 assert.equal(fs.readFileSync(crew.scrollBookFile,'utf8'),beforeScroll);
 assert.ok(broker.trace({perceptionPointId:'PP-ONE'}).events.some(e=>
  e.kind==='OFFICE_INITIATION_REQUESTED'&&e.data.assessment.context.qualified===true));
});
test('context overload cannot self-certify capacity or borrow an unrelated project benchmark',t=>{
 const {crew,grant}=setup(t),root=path.dirname(crew.root);
 const benchmark={
  projectId:'PROJECT-A',perceptionPointId:'PP-ONE',contentProfileId:'profile-A',
  benchmarkReceiptId:'synthetic-receipt-1',unit:'PROJECT_EFFECTIVE_CONTEXT_UNITS',
  provenMaximumSafeUnits:6,requiredUnits:12,
  originalSourceReadbackPass:true,semanticReconstructionPass:true,
  contradictionPreservationPass:true,frozenMomentReplayPass:true
 };
 const input={initiatedBy:{kind:'OFFICE',id:'0032'},parentChapterNumber:'0032',
  chapterNumber:'0033',perceptionPointId:'PP-ONE',projectId:'PROJECT-A',
  contextPartitionKey:'subscope-a',contextBenchmark:benchmark,
  responsibility:'bounded PP custody',reason:'safe effective context is exceeded',
  evidenceRefs:['original:PP-ONE','test:synthetic-receipt-1'],grant};
 const withoutVerifier=new OrionCrewDelegation({root,crewHouse:crew,
  verifyDelegationGrant:()=>true});
 const before=fs.readFileSync(crew.chapterBookFile,'utf8');
 assert.throws(()=>withoutVerifier.initiateOffice(input),/NOT_INDEPENDENTLY_VERIFIED/);
 const withVerifier=new OrionCrewDelegation({root,crewHouse:crew,
  verifyDelegationGrant:()=>true,
  verifyContextBenchmark:({benchmark:b})=>b.benchmarkReceiptId==='synthetic-receipt-1'});
 assert.throws(()=>withVerifier.initiateOffice({...input,projectId:'PROJECT-B'}),/NOT_INDEPENDENTLY_VERIFIED/);
 assert.throws(()=>withVerifier.initiateOffice({...input,
  contextBenchmark:{...benchmark,frozenMomentReplayPass:false}}),/NOT_INDEPENDENTLY_VERIFIED/);
 const withinSafe={...input,contextBenchmark:{...benchmark,requiredUnits:5}};
 assert.equal(withVerifier.assessOfficeNeed(withinSafe).justified,false);
 assert.throws(()=>withVerifier.initiateOffice(withinSafe),/NOT_JUSTIFIED/);
 assert.equal(fs.readFileSync(crew.chapterBookFile,'utf8'),before);
 assert.equal(withVerifier.trace().observedEventCount,0);
});
