'use strict';
// Source-qualified Office growth lifecycle. Every candidate is its own
// durable, resumable TaskEngine responsibility, not a forgotten report note.
// Bounded autonomous reassessment never grants privileges or creates agents.
const crypto=require('node:crypto');
const KIND='ORION_OFFICE_GROWTH_REVIEW';
const digest=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const nonempty=v=>typeof v==='string'&&v.trim().length>0;
const terminal=new Set(['COMPLETE','FAILED_PRESERVED','CANCELED']);
class OrionOfficeGrowthLifecycle{
 constructor({taskEngine,documentTree,crewHouse,assessGrowth,verifyClosure,clock=()=>Date.now()}={}){
  if(!taskEngine||!documentTree||!crewHouse)
   throw Error('OFFICE_GROWTH_NATIVE_SERVICES_REQUIRED');
  this.tasks=taskEngine;this.docs=documentTree;this.crew=crewHouse;
  this.assessGrowth=assessGrowth;this.verifyClosure=verifyClosure;this.clock=clock;
 }
 definition({derived,report,candidate,index}){
  if(!derived||!report||!candidate||typeof candidate!=='object'||
   !nonempty(report.sourceSha256))
   throw Error('OFFICE_GROWTH_CANDIDATE_EVIDENCE_REQUIRED');
  const pointer={derivedRelativePath:derived.relativePath,
   derivedSha256:derived.sha256,sourceSha256:report.sourceSha256,
   sourceDocumentId:report.sourceDocumentId,
   sourceLocator:report.sourceLocator,chapterNumber:derived.chapterNumber,
   perceptionPointId:derived.perceptionPointId,scrollNumber:derived.scrollNumber,
   birthNumber:derived.birthNumber,index,candidateSha256:digest(candidate),
   originatingTaskId:report.taskId,originExecutionReceiptId:report.executionReceiptId};
  const id='office-growth-'+digest(pointer).slice(0,48);
  return {id,kind:KIND,title:'Reassess '+String(candidate.kind||'UNCLASSIFIED_GROWTH')+
   ' · '+derived.perceptionPointId,priority:80,source:'ORION_PLEDGE_EVIDENCE_GROWTH',
   responsibleAgentId:report.agentId,
   input:{growth:pointer,heavy:false,requiresSSD:true}};
 }
 candidatesFromDerived(derived){
  if(derived.classification!=='DERIVED')return [];
  const bytes=this.docs.readback(derived).bytes;
  let report;
  try{report=JSON.parse(bytes.toString('utf8'));}catch{return [];}
  if(report?.schema!=='orion-office-linked-analysis/1.0'||
   report.sourceSha256==null)return [];
  if(!Array.isArray(report.growthCandidates))throw Error('OFFICE_GROWTH_CANDIDATE_LIST_INVALID');
  if(report.growthCandidates.length>128)
   throw Error('OFFICE_GROWTH_UNBOUNDED_CANDIDATES');
  return report.growthCandidates.map((candidate,index)=>
   this.definition({derived,report,candidate,index}));
 }
 followUps({derived}){
  return this.candidatesFromDerived(derived);
 }
 install(){
  this.tasks.register(KIND,async task=>this.perform(task));
  const recovery=this.reconcile();
  return {kind:KIND,registered:true,...recovery};
 }
 reconcile({maxDocuments=2000}={}){
  const journal=this.docs.events().filter(e=>e.kind==='DOCUMENT_STORED'&&
   e.data.classification==='DERIVED');
  if(journal.length>maxDocuments)
   return {recovered:0,alreadyPresent:0,blocked:true,
    reason:'OFFICE_GROWTH_REPLAY_PAGE_BUDGET_REQUIRES_CURSOR'};
  let recovered=0,alreadyPresent=0;
  for(const e of journal){
   const definitions=this.candidatesFromDerived(e.data);
   for(const proposed of definitions){
    const previous=this.tasks.task(proposed.id);
    if(previous){
     if(previous.kind!==KIND||digest(previous.input?.growth)!==digest(proposed.input.growth))
      throw Error('OFFICE_GROWTH_CAUSAL_TASK_ID_COLLISION');
     alreadyPresent++;continue;
    }
    const created=this.tasks.upsert(proposed);
    if(!this.tasks.task(created.id))throw Error('OFFICE_GROWTH_RECONCILE_READBACK_FAILED');
    recovered++;
   }
  }
  if(recovered)this.tasks.requestEvaluation('OFFICE_GROWTH_RECOVERED_FROM_DOCUMENTS');
  return {recovered,alreadyPresent,blocked:false,
   checkedDerivedDocuments:journal.length,source:'VERIFIED_LINKED_ANALYSIS_DOCUMENTS'};
 }
 // Fresh independently stored evidence for this exact Chapter and PP can
 // wake sleeping growth reviews immediately. No unrelated project, duplicate
 // evidence, closed case, or failed-security task is silently reopened.
 wakeForEvidence({chapterNumber,perceptionPointId,sourceSha256}={}){
  if(!nonempty(chapterNumber)||!nonempty(perceptionPointId)||
   !/^[a-f0-9]{64}$/i.test(String(sourceSha256||'')))
   throw Error('OFFICE_GROWTH_WAKE_EVIDENCE_SCOPE_INVALID');
  const source=this.docs.events().find(e=>e.kind==='DOCUMENT_STORED'&&
   e.data.classification==='SOURCE_COPY'&&
   e.data.chapterNumber===chapterNumber&&
   e.data.perceptionPointId===perceptionPointId&&
   e.data.sha256===sourceSha256);
  if(!source)throw Error('OFFICE_GROWTH_WAKE_SOURCE_NOT_AUTHORITATIVE');
  this.docs.readback(source.data);
  let woken=0;
  for(const task of this.tasks.list({includeTerminal:false})){
   const g=task.input?.growth;
   if(task.kind!==KIND||task.status!=='RETRY_READY'||!g||
    g.chapterNumber!==chapterNumber||g.perceptionPointId!==perceptionPointId||
    g.sourceSha256===sourceSha256||
    task.input?.newEvidenceSha256===sourceSha256)continue;
   this.tasks.upsert({id:task.id,kind:KIND,title:task.title,priority:task.priority,
    responsibleAgentId:task.responsibleAgentId,source:task.source,
    status:'READY',availableAt:new Date(this.clock()-1000).toISOString(),
    input:{...task.input,newEvidenceSha256:sourceSha256}});
   woken++;
  }
  if(woken)this.tasks.requestEvaluation('NEW_PERCEPTION_POINT_EVIDENCE_FOR_GROWTH');
  return {woken,sourceSha256,chapterNumber,perceptionPointId,
   reassessmentOnly:true,newPledgeBorn:false,newOfficeCreated:false};
 }
 readCandidate(pointer){
  if(!pointer||!nonempty(pointer.derivedRelativePath)||
   !nonempty(pointer.sourceSha256))throw Error('OFFICE_GROWTH_POINTER_MISSING');
  const derived=this.docs.events().find(e=>e.kind==='DOCUMENT_STORED'&&
   e.data.classification==='DERIVED'&&
   e.data.relativePath===pointer.derivedRelativePath&&
   e.data.sha256===pointer.derivedSha256);
  if(!derived)throw Error('OFFICE_GROWTH_DERIVED_DOCUMENT_MISSING');
  const d=derived.data;
  if(d.chapterNumber!==pointer.chapterNumber||
   d.perceptionPointId!==pointer.perceptionPointId||
   d.scrollNumber!==pointer.scrollNumber||d.birthNumber!==pointer.birthNumber)
   throw Error('OFFICE_GROWTH_LINEAGE_MISMATCH');
  const report=JSON.parse(this.docs.readback(d).bytes.toString('utf8'));
  if(report.schema!=='orion-office-linked-analysis/1.0'||
   report.sourceSha256!==pointer.sourceSha256||
   report.taskId!==pointer.originatingTaskId||
   report.executionReceiptId!==pointer.originExecutionReceiptId)
   throw Error('OFFICE_GROWTH_PROVENANCE_MISMATCH');
  const candidate=report.growthCandidates?.[pointer.index];
  if(!candidate||digest(candidate)!==pointer.candidateSha256)
   throw Error('OFFICE_GROWTH_CANDIDATE_MUTATED');
  const source=this.docs.events().find(e=>e.kind==='DOCUMENT_STORED'&&
   e.data.classification==='SOURCE_COPY'&&
   e.data.sha256===pointer.sourceSha256&&
   e.data.documentId===pointer.sourceDocumentId&&
   e.data.chapterNumber===pointer.chapterNumber&&
   e.data.perceptionPointId===pointer.perceptionPointId);
  if(!source)throw Error('OFFICE_GROWTH_ORIGINAL_MISSING');
  this.docs.readback(source.data);
  const pledge=this.crew.scrollBook().pledges.find(p=>
   p.scrollNumber===pointer.scrollNumber);
  if(!pledge||(pledge.birthNumber??null)!==(pointer.birthNumber??null)||
   pledge.metadata?.agentId!==report.agentId)
   throw Error('OFFICE_GROWTH_PLEDGE_IDENTITY_MISMATCH');
  return {candidate,report,derived:d,source:source.data,
   evidenceRefs:['sha256:'+pointer.sourceSha256,
    'sha256:'+pointer.derivedSha256],pledge};
 }
 async perform(task){
  let input,now=this.clock();
  try{input=this.readCandidate(task.input?.growth);}
  catch(error){return {status:'WAITING_DEPENDENCY',blockerKind:'SECURITY_INVARIANT',
   reason:String(error.message||error),candidatePreserved:true};}
  const {candidate,report,source,derived,evidenceRefs}=input;
  let newEvidence=null;
  if(task.input?.newEvidenceSha256){
   const record=this.docs.events().find(e=>e.kind==='DOCUMENT_STORED'&&
    e.data.classification==='SOURCE_COPY'&&
    e.data.sha256===task.input.newEvidenceSha256&&
    e.data.chapterNumber===derived.chapterNumber&&
    e.data.perceptionPointId===derived.perceptionPointId);
   if(!record)return {status:'WAITING_DEPENDENCY',blockerKind:'SECURITY_INVARIANT',
    reason:'OFFICE_GROWTH_NEW_EVIDENCE_NOT_REGISTERED',candidatePreserved:true};
   try{this.docs.readback(record.data);}catch(error){
    return {status:'WAITING_DEPENDENCY',blockerKind:'SECURITY_INVARIANT',
     reason:String(error.message||error),candidatePreserved:true};
   }
   newEvidence={sha256:record.data.sha256,documentId:record.data.documentId,
    sourceLocator:record.data.sourceLocator,byteLength:record.data.byteLength};
   evidenceRefs.push('sha256:'+newEvidence.sha256);
  }
  let decision;
  try{
   decision=typeof this.assessGrowth==='function'
    ?await this.assessGrowth({candidate,report,source,derived,evidenceRefs,
      taskId:task.id,attempt:Number(task.attempts||1),
      projectContextVerified:false,newEvidence,
      ownerAuthorityScopeMayNotBeExpanded:true})
    :null;
  }catch(error){
   decision={action:'REVISIT',reason:'ASSESSMENT_ERROR_PRESERVED:'+String(error.message||error)};
  }
  const action=String(decision?.action||'REVISIT');
  const valid=new Set(['REVISIT','NEEDS_EVIDENCE','NEEDS_AUTHORITY',
   'NEEDS_CONTEXT_BENCHMARK','CLOSED_WITH_EVIDENCE','EXECUTION_VERIFIED']);
  if(!valid.has(action))return {status:'WAITING_DEPENDENCY',blockerKind:'SECURITY_INVARIANT',
   reason:'OFFICE_GROWTH_DECISION_INVALID',candidatePreserved:true};
  const base={schema:'orion-office-growth-review/1.0',
   candidateKind:String(candidate.kind||'UNCLASSIFIED_GROWTH'),
   candidateReason:String(candidate.reason||'REASON_MISSING_REQUIRES_ASSESSMENT'),
   candidateSha256:task.input.growth.candidateSha256,originalSha256:source.sha256,
   derivedSha256:derived.sha256,newEvidenceSha256:newEvidence?.sha256||null,
   chapterNumber:derived.chapterNumber,
   perceptionPointId:derived.perceptionPointId,
   scrollNumber:derived.scrollNumber,birthNumber:derived.birthNumber,
   evidenceRefs,action,reason:String(decision?.reason||
    'REVIEW_PENDING_NEW_EVIDENCE_OR_APPROVED_CAPABILITY'),
   assessmentAt:new Date(now).toISOString(),
   newOfficeCreated:false,newPledgeBorn:false,
   growthCandidatePreserved:true};
  if(action==='CLOSED_WITH_EVIDENCE'||action==='EXECUTION_VERIFIED'){
   if(!Array.isArray(decision.evidenceRefs)||!decision.evidenceRefs.length||
    typeof this.verifyClosure!=='function'||
    (await this.verifyClosure({...base,decision,taskId:task.id}))!==true)
    return {status:'WAITING_DEPENDENCY',blockerKind:'SECURITY_INVARIANT',
     reason:'OFFICE_GROWTH_CLOSURE_NOT_INDEPENDENTLY_VERIFIED',
     growthReview:base,candidatePreserved:true};
   return {status:'COMPLETE',growthReview:{...base,
    disposition:action,closureEvidenceRefs:decision.evidenceRefs},
    executionVerified:action==='EXECUTION_VERIFIED'};
  }
  // These are retained, genuinely runnable tasks in Orion's own TaskEngine.
  // Normal growth work is neither deemed complete nor stuck WAITING forever.
  const hours=Math.min(24,Math.max(1,2**Math.min(5,Math.max(0,Number(task.attempts||1)-1))));
  const revisitAt=new Date(now+hours*3600000).toISOString();
  return {status:'RETRY_READY',availableAt:revisitAt,
   growthReview:{...base,disposition:action,revisitAt,
    revisitTriggers:['NEW_EVIDENCE','SIGNED_AUTHORITY_CHANGE',
     'BENCHMARK_QUALIFIED','OFFICE_CAPABILITY_INSTALLED','SCHEDULED_REVIEW']},
   reason:'OFFICE_GROWTH_LIFECYCLE_OPEN'};
 }
}
module.exports={OrionOfficeGrowthLifecycle,KIND};
