'use strict';
// Source-only staging contract: Orion-brain governed agent delegation.
// Librarian, Offices and promoted Scroll managers may birth subordinate agents.
// Not a runtime activation path; CrewHouse is the authoritative identity book.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
class OrionCrewDelegation {
 constructor({root,crewHouse,verifyDelegationGrant,verifyContextBenchmark}={}){
  if(!root||!crewHouse)throw Error('CREW_DELEGATION_ROOT_AND_CREW_REQUIRED');
  this.root=path.join(path.resolve(root),'orion-crew-delegation');
  this.journal=path.join(this.root,'delegation-events.jsonl');
  this.crew=crewHouse;this.verifyDelegationGrant=verifyDelegationGrant;
  this.verifyContextBenchmark=verifyContextBenchmark;
  fs.mkdirSync(this.root,{recursive:true});
 }
 events(){
  if(!fs.existsSync(this.journal))return [];
  const rows=fs.readFileSync(this.journal,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
  let prev=null;
  for(const row of rows){
   const {eventHash,...payload}=row;
   if(payload.previousHash!==prev||digest(payload)!==eventHash)
    throw Error('CREW_DELEGATION_JOURNAL_INTEGRITY_FAILURE_PRESERVED');
   prev=eventHash;
  }
  return rows;
 }
 record(kind,data){
  const previous=this.events();
  const row={schema:'orion-crew-delegation/1.0',eventId:crypto.randomUUID(),
   at:new Date().toISOString(),kind,data,
   previousHash:previous.at(-1)?.eventHash||null};
  row.eventHash=digest(row);
  fs.appendFileSync(this.journal,JSON.stringify(row)+'\n','utf8');
  return row;
 }
 initiator(identity,perceptionPointId){
  const kind=String(identity?.kind||''),id=String(identity?.id||'');
  if(kind==='ORION'){
   if(id!=='ORION_BRAIN')throw Error('ORION_BRAIN_IDENTITY_INVALID');
   return {kind,id};
  }
  if(kind==='LIBRARIAN'){
   if(id!=='ORION_INTERNAL_LIBRARIAN')throw Error('LIBRARIAN_IDENTITY_INVALID');
   return {kind,id};
  }
  if(kind==='OFFICE'){
   const chapter=this.crew.chapterBook().chapters.find(c=>c.chapterNumber===id);
   if(!chapter)throw Error('DELEGATING_OFFICE_NOT_REGISTERED');
   return {kind,id,chapterNumber:id};
  }
  if(kind==='SCROLL_MANAGER'){
   const pledge=this.crew.scrollBook().pledges.find(p=>p.scrollNumber===id);
   if(!pledge||pledge.rank!=='PERCEPTION_POINT_MANAGER'||
      pledge.managerOfPerceptionPointId!==perceptionPointId)
    throw Error('DELEGATING_SCROLL_NOT_MANAGER_OF_POINT');
   return {kind,id,scrollNumber:id,perceptionPointId};
  }
  throw Error('CREW_DELEGATION_INITIATOR_INVALID');
 }
 authorized({grant,action,initiator,perceptionPointId}){
  if(!grant||!grant.receiptId||typeof this.verifyDelegationGrant!=='function'||
   this.verifyDelegationGrant({grant,action,initiator,perceptionPointId})!==true)
   throw Error('CREW_DELEGATION_VERIFIED_CAPABILITY_REQUIRED');
  return String(grant.receiptId);
 }
 evidence({reason,evidenceRefs=[],loadEvidence}={}){
  if(!String(reason||'').trim()||!Array.isArray(evidenceRefs)||!evidenceRefs.length||
     !loadEvidence||!Number.isFinite(Number(loadEvidence.pointCount))||
     Number(loadEvidence.pointCount)<0)
   throw Error('CREW_DELEGATION_MEASURED_JUSTIFICATION_REQUIRED');
  return {reason:String(reason),evidenceRefs:[...evidenceRefs],
   pointCount:Number(loadEvidence.pointCount),
   retrievalMisses:Number(loadEvidence.retrievalMisses||0),
   coordinationBurden:String(loadEvidence.coordinationBurden||'UNMEASURED')};
 }
 // Capacity is empirically scoped to a particular project, content profile,
 // and Perception Point. It is NOT the native model context-window size.
 // The injected verifier must inspect an external benchmark receipt; merely
 // asserting numeric values here does not establish a safe capacity.
 contextAssessment({perceptionPointId,projectId,contextPartitionKey,contextBenchmark}={}){
  if(!contextBenchmark)return {present:false,qualified:false,overflow:false};
  const b=contextBenchmark;
  const valid=String(projectId||'').trim()&&String(contextPartitionKey||'').trim()&&
   String(b.projectId||'')===String(projectId)&&
   String(b.perceptionPointId||'')===String(perceptionPointId)&&
   String(b.contentProfileId||'').trim()&&String(b.benchmarkReceiptId||'').trim()&&
   b.unit==='PROJECT_EFFECTIVE_CONTEXT_UNITS'&&
   Number.isSafeInteger(b.provenMaximumSafeUnits)&&b.provenMaximumSafeUnits>0&&
   Number.isSafeInteger(b.requiredUnits)&&b.requiredUnits>0&&
   b.originalSourceReadbackPass===true&&b.semanticReconstructionPass===true&&
   b.contradictionPreservationPass===true&&b.frozenMomentReplayPass===true;
  if(!valid||typeof this.verifyContextBenchmark!=='function'||
   this.verifyContextBenchmark({benchmark:b,perceptionPointId,projectId,
    contextPartitionKey})!==true)
   throw Error('PROJECT_CONTEXT_BENCHMARK_NOT_INDEPENDENTLY_VERIFIED');
  return {present:true,qualified:true,overflow:b.requiredUnits>b.provenMaximumSafeUnits,
   projectId:String(projectId),contextPartitionKey:String(contextPartitionKey),
   contentProfileId:b.contentProfileId,benchmarkReceiptId:b.benchmarkReceiptId,
   provenMaximumSafeUnits:b.provenMaximumSafeUnits,requiredUnits:b.requiredUnits,
   pressureUnits:Math.max(0,b.requiredUnits-b.provenMaximumSafeUnits),
   evidenceScope:'PROJECT_SPECIFIC_RETRIEVAL_AND_TEMPORAL_SEMANTICS',
   modelContextWindowChanged:false};
 }
 // One Perception Point can justify an Office by independently scoped duty OR
 // verified overload. Recursion may continue whenever a child scope itself
 // exceeds its own proven project/content-specific safe envelope.
 assessOfficeNeed({perceptionPointId,responsibility,reason,evidenceRefs=[],
  needsIndependentOffice=false,projectId=null,contextPartitionKey=null,contextBenchmark=null}={}){
  const point=String(perceptionPointId||'').trim();
  const objective=String(responsibility||'').trim();
  const sources=Array.isArray(evidenceRefs)?evidenceRefs.filter(Boolean):[];
  const context=this.contextAssessment({perceptionPointId:point,
   projectId,contextPartitionKey,contextBenchmark});
  const sufficientEvidence=Boolean(point&&objective&&String(reason||'').trim()&&sources.length);
  const justified=sufficientEvidence&&(needsIndependentOffice===true||context.overflow===true);
  const basis=!justified?'INSUFFICIENT_JUSTIFICATION':
   context.overflow?'VERIFIED_PROJECT_CONTEXT_OVERFLOW':'INDEPENDENT_RESPONSIBILITY_EVIDENCE';
  return {schema:'orion-office-need-assessment/1.1',perceptionPointId:point,
   responsibility:objective,justified,basis,context,
   singlePerceptionPointCanJustifyOffice:true,numberOfPointsIsNotTheDecisionGate:true,
   recursiveSubOfficesSupported:true,unboundedAgentCreationAuthorized:false,
   evidenceRefs:sources};
 }
 initiateOffice({initiatedBy,chapterNumber,perceptionPointId,responsibility,
  name,reason,evidenceRefs=[],needsIndependentOffice=false,
  parentChapterNumber=null,projectId=null,contextPartitionKey=null,
  contextBenchmark=null,grant}={}){
  const point=String(perceptionPointId||'').trim();
  const caller=this.initiator(initiatedBy,point);
  const assessment=this.assessOfficeNeed({perceptionPointId:point,
   responsibility,reason,evidenceRefs,needsIndependentOffice,
   projectId,contextPartitionKey,contextBenchmark});
  if(!assessment.justified)throw Error('OFFICE_INDEPENDENT_RESPONSIBILITY_NOT_JUSTIFIED');
  if(!String(name||'').trim())throw Error('OFFICE_NAME_REQUIRED');
  const parent=parentChapterNumber===null?null:String(parentChapterNumber).padStart(4,'0');
  if(caller.kind==='OFFICE'&&parent!==caller.id)
   throw Error('OFFICE_INITIATION_PARENT_CHAPTER_MISMATCH');
  if(caller.kind==='SCROLL_MANAGER'){
   const supervisor=this.crew.scrollBook().pledges.find(p=>p.scrollNumber===caller.id)?.currentChapterNumber;
   if(!supervisor||parent!==supervisor)throw Error('SCROLL_MANAGER_OFFICE_SUPERVISION_REQUIRED');
  }
  const receiptId=this.authorized({grant,action:'CREW_INITIATE_OFFICE',initiator:caller,perceptionPointId:point});
  const existing=this.crew.chapterBook().chapters.find(c=>
   c.parentChapterNumber===parent&&
   c.metadata?.originPerceptionPointId===point&&
   c.metadata?.independentResponsibility===assessment.responsibility&&
   (c.metadata?.projectId||null)===(projectId||null)&&
   (c.metadata?.contextPartitionKey||null)===(contextPartitionKey||null));
  if(existing)return {created:false,chapter:existing,assessment,agentProcessesSpawned:0};
  const request=this.record('OFFICE_INITIATION_REQUESTED',{initiator:caller,
   chapterNumber:String(chapterNumber),perceptionPointId:point,
   parentChapterNumber:parent,projectId,contextPartitionKey,assessment,
   reason:String(reason),authorityReceiptId:receiptId});
  try{
   const chapter=this.crew.registerChapter({chapterNumber,name,
    parentChapterNumber:parent,mission:assessment.responsibility,
    metadata:{originPerceptionPointId:point,
     independentResponsibility:assessment.responsibility,createdBy:caller,
     projectId:projectId||null,contextPartitionKey:contextPartitionKey||null,
     contextBenchmark:assessment.context.qualified?assessment.context:null,
     originRequestEventId:request.eventId,authorityReceiptId:receiptId,
     sourceEvidenceRefs:[...assessment.evidenceRefs],sourceOnlyNoProcessBirth:true}});
   this.record('OFFICE_INITIATED',{requestEventId:request.eventId,
    perceptionPointId:point,chapterNumber:chapter.chapterNumber,
    parentChapterNumber:parent,projectId:projectId||null,
    contextPartitionKey:contextPartitionKey||null,agentProcessesSpawned:0});
   return {created:true,chapter,assessment,agentProcessesSpawned:0};
  }catch(e){
   this.record('OFFICE_INITIATION_FAILED_PRESERVED',{requestEventId:request.eventId,
    perceptionPointId:point,errorCode:e.message});
   throw e;
  }
 }
 promote({initiatedBy,scrollNumber,perceptionPointId,reason,evidenceRefs,
  loadEvidence,grant}={}){
  const point=String(perceptionPointId||'').trim();
  if(!point)throw Error('PROMOTION_PERCEPTION_POINT_REQUIRED');
  const caller=this.initiator(initiatedBy,point),metrics=this.evidence({reason,evidenceRefs,loadEvidence});
  const receiptId=this.authorized({grant,action:'CREW_PROMOTE_SCROLL',initiator:caller,perceptionPointId:point});
  const request=this.record('PROMOTION_REQUESTED',{initiator:caller,scrollNumber,
   perceptionPointId:point,metrics,authorityReceiptId:receiptId});
  try{
   const result=this.crew.promotePledge({scrollNumber,perceptionPointId:point,
    reason,evidenceRefs,authorityReceiptId:receiptId});
   this.record('PROMOTION_CATALOGUED',{requestEventId:request.eventId,
    scrollNumber:result.pledge.scrollNumber,perceptionPointId:point,
    promoted:result.promoted,durableIdentityId:result.pledge.durableIdentityId});
   return result;
  }catch(e){
   this.record('PROMOTION_FAILED_PRESERVED',{requestEventId:request.eventId,
    errorCode:e.message});throw e;
  }
 }
 birth({initiatedBy,perceptionPointId,childScrollNumber,birthNumber,childAgentId,
  childName,parentScrollNumber=null,reason,evidenceRefs,loadEvidence,grant}={}){
  const point=String(perceptionPointId||'').trim();
  if(!point||!String(childAgentId||'').trim()||!String(childName||'').trim())
   throw Error('PLEDGE_BIRTH_ORIGIN_AND_IDENTITY_REQUIRED');
  if(!birthNumber||!/^\d+$/.test(String(birthNumber)))
   throw Error('PLEDGE_DISTINCT_BIRTH_NUMBER_REQUIRED');
  const caller=this.initiator(initiatedBy,point),metrics=this.evidence({reason,evidenceRefs,loadEvidence});
  const receiptId=this.authorized({grant,action:'CREW_BIRTH_DORMANT_AGENT',initiator:caller,
   perceptionPointId:point});
  const parent=parentScrollNumber===null?null:String(parentScrollNumber);
  if(caller.kind==='SCROLL_MANAGER'&&parent!==caller.id)
   throw Error('SCROLL_MANAGER_PARENT_LINEAGE_REQUIRED');
  if(parent&&!this.crew.scrollBook().pledges.some(p=>p.scrollNumber===parent))
   throw Error('AGENT_BIRTH_PARENT_SCROLL_NOT_FOUND');
  if(this.crew.scrollBook().pledges.some(p=>p.metadata?.agentId===String(childAgentId)))
   throw Error('AGENT_BIRTH_DUPLICATE_AGENT_ID');
  const request=this.record('BIRTH_REQUESTED',{initiator:caller,perceptionPointId:point,
   childScrollNumber:String(childScrollNumber),birthNumber:String(birthNumber),
   childAgentId:String(childAgentId),
   parentScrollNumber:parent,metrics,authorityReceiptId:receiptId});
  try{
   const pledge=this.crew.registerPledge({scrollNumber:childScrollNumber,
    birthNumber:String(birthNumber),name:childName,status:'RESTING',
    metadata:{agentId:String(childAgentId),
     originPerceptionPointId:point,parentScrollNumber:parent,createdBy:caller,
     birthRequestEventId:request.eventId,authorityReceiptId:receiptId,
     sourceEvidenceRefs:[...evidenceRefs],sourceOnlyDormantCandidate:true}});
   this.record('BIRTH_REGISTERED_DORMANT',{requestEventId:request.eventId,
    perceptionPointId:point,scrollNumber:pledge.scrollNumber,
    birthNumber:pledge.birthNumber,durableIdentityId:pledge.durableIdentityId,
    agentId:pledge.metadata.agentId,agentProcessStarted:false});
   return {pledge,activeProcessStarted:false,authority:'CREW_HOUSE_SCROLL_BOOK'};
  }catch(e){
   this.record('BIRTH_FAILED_PRESERVED',{requestEventId:request.eventId,
    errorCode:e.message});throw e;
  }
 }
 trace({perceptionPointId=null}={}){
  const events=this.events();
  const selected=perceptionPointId===null?events:events.filter(e=>e.data?.perceptionPointId===perceptionPointId);
  return {schema:'orion-delegation-audit-view/1.0',events:selected,
   observedEventCount:selected.length,
   authoritativeIdentityBook:'CREW_HOUSE_SCROLL_BOOK',
   materializationIsNotActivation:true,
   journalIntegrityVerified:true,
   crossProcessLockVerified:false,
   ownerSessionVerificationProvidedByCaller:false,
   deployedToExistingOrion:false};
 }
}
module.exports={OrionCrewDelegation};
