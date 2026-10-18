'use strict';
// Staged native bridge. The Orion host supplies its existing TaskEngine,
// CrewHouse, AgentStateFabric, owner-signed authority verifier and trusted
// Pledge executor. No timers, watched folders or second Orion instance.
const crypto=require('node:crypto');
const {OrionOfficeGrowthLifecycle}=require('./orion-office-growth-lifecycle.cjs');
const KIND='ORION_OFFICE_DOCUMENT_REVIEW';
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const decisionFields=['who','what','where','when','why','how'];
class OrionOfficeTaskBridge {
 constructor({taskEngine,documentTree,crewHouse,agentStateFabric,standingAuthority,
  invokePledge,assessGrowth,verifyGrowthClosure,verifyLegacyStewardship,
  deviceId=null}={}){
  if(!taskEngine||!documentTree||!crewHouse||!agentStateFabric)
   throw Error('OFFICE_TASK_BRIDGE_NATIVE_DEPENDENCIES_REQUIRED');
  this.tasks=taskEngine;this.docs=documentTree;this.crew=crewHouse;
  this.fabric=agentStateFabric;this.authority=standingAuthority;
  this.invokePledge=invokePledge;this.deviceId=deviceId;
  this.verifyLegacyStewardship=verifyLegacyStewardship;
  this.growth=new OrionOfficeGrowthLifecycle({
   taskEngine,documentTree,crewHouse,
   assessGrowth,verifyClosure:verifyGrowthClosure});
 }
 // Register a handler within Orion's EXISTING self-directed TaskEngine.
 // No agent is activated until the approved engine executes this handler.
 install(){
  this.tasks.register(KIND,async(task)=>this.perform(task));
  const growth=this.growth.install();
  return {registered:true,kind:KIND,growth,
   taskEngineStartedByInstallation:false};
 }
 requireDocument(assignment){
  const row=this.docs.events().find(e=>e.kind==='DOCUMENT_STORED'&&
   e.data.relativePath===assignment.immutableDocument&&
   e.data.sha256===assignment.sourceSha256&&
   e.data.chapterNumber===assignment.chapterNumber&&
   e.data.perceptionPointId===assignment.perceptionPointId);
  if(!row)throw Error('OFFICE_TASK_DOCUMENT_SOURCE_NOT_REGISTERED');
  const read=this.docs.readback(row.data);
  const pledge=this.crew.scrollBook().pledges.find(p=>p.scrollNumber===assignment.scrollNumber);
  if(!pledge||(pledge.birthNumber??null)!==(assignment.birthNumber??null)||
    !pledge.metadata?.agentId||!pledge.durableIdentityId)
   throw Error('OFFICE_TASK_PLEDGE_IDENTITY_MISMATCH');
  const scope=[...(pledge.metadata.stewardedPerceptionPointIds||[]),
   pledge.metadata.originPerceptionPointId,pledge.managerOfPerceptionPointId];
  if(!scope.includes(assignment.perceptionPointId)&&
   (typeof this.verifyLegacyStewardship!=='function'||
    this.verifyLegacyStewardship({pledge,
     chapterNumber:assignment.chapterNumber,
     perceptionPointId:assignment.perceptionPointId,
     authority:'READ_ONLY_CANONICAL_LEGACY_CUSTODY'})!==true))
   throw Error('OFFICE_TASK_PLEDGE_OUTSIDE_PERCEPTION_POINT');
  if(!this.crew.chapterBook().chapters.some(c=>c.chapterNumber===assignment.chapterNumber))
   throw Error('OFFICE_TASK_CHAPTER_MISSING');
  return {source:row.data,bytes:read.bytes,pledge};
 }
 taskId(assignment){
  return 'office-doc-'+sha({kind:KIND,source:assignment.sourceSha256,
   file:assignment.immutableDocument,chapter:assignment.chapterNumber,
   point:assignment.perceptionPointId,scroll:assignment.scrollNumber,
   birthNumber:assignment.birthNumber}).slice(0,48);
 }
 dispatch(assignment){
  const {source,pledge}=this.requireDocument(assignment);
  if(!String(assignment.key||'').trim()||!String(assignment.why||'').trim())
   throw Error('OFFICE_TASK_CAUSAL_ASSIGNMENT_REQUIRED');
  const id=this.taskId(assignment),previous=this.tasks.task(id);
  const fixed={...assignment,durableIdentityId:pledge.durableIdentityId,
   agentId:pledge.metadata.agentId,sourceFileSha256:source.sha256};
  const input={assignment:fixed,heavy:false,requiresSSD:true};
  if(previous){
   if(previous.kind!==KIND||sha(previous.input?.assignment)!==sha(fixed))
    throw Error('OFFICE_TASK_CAUSAL_TASK_ID_COLLISION');
   return {accepted:true,executionReceiptId:id,taskId:id,
    durableTaskReadbackVerified:true,status:previous.status,created:false,
    processingComplete:previous.status==='COMPLETE'};
  }
  const task=this.tasks.upsert({id,kind:KIND,title:'Inspect source for '+assignment.perceptionPointId,
   status:'READY',priority:65,input,source:'ORION_OFFICE_INTAKE',
   responsibleAgentId:pledge.metadata.agentId});
  const recovered=this.tasks.task(id);
  if(!recovered||recovered.kind!==KIND||sha(recovered.input?.assignment)!==sha(fixed))
   throw Error('OFFICE_TASK_DURABLE_RECEIPT_READBACK_FAILED');
  // Wakes Orion's own engine when already running; never starts a new one.
  this.tasks.requestEvaluation('OFFICE_DOCUMENT_ARRIVAL');
  return {accepted:true,executionReceiptId:id,taskId:id,
   durableTaskReadbackVerified:true,status:task.status,created:true,
   processingComplete:false};
 }
 async perform(task){
  const assignment=task.input?.assignment;
  if(!assignment)return {status:'WAITING_DEPENDENCY',
   reason:'OFFICE_TASK_INPUT_MISSING'};
  let body;
  try{body=this.requireDocument(assignment);}
  catch(e){return {status:'WAITING_DEPENDENCY',
   reason:e.message,blockerKind:'SECURITY_INVARIANT'};}
  const {source,bytes,pledge}=body;
  if(assignment.agentId!==pledge.metadata.agentId||
    assignment.durableIdentityId!==pledge.durableIdentityId)
   return {status:'WAITING_DEPENDENCY',
    reason:'OFFICE_TASK_AGENT_LINEAGE_CHANGED',blockerKind:'SECURITY_INVARIANT'};
  if(!this.authority||typeof this.authority.evaluate!=='function')
   return {status:'WAITING_DEPENDENCY',
    reason:'OFFICE_TASK_SIGNED_STANDING_AUTHORITY_NOT_WIRED',blockerKind:'OWNER_POLICY'};
  const permitted=this.authority.evaluate({
   capabilityId:KIND,agentId:pledge.metadata.agentId,taskId:task.id,
   risk:'READ_ONLY',deviceId:this.deviceId,unattended:true});
  if(!permitted?.ok||permitted.capabilityId!==KIND||
   permitted.agentId!==pledge.metadata.agentId||permitted.taskId!==task.id)
   return {status:'WAITING_DEPENDENCY',
    reason:'OFFICE_TASK_SIGNED_SCOPE_DENIED:'+String(permitted?.reason||'UNVERIFIED'),
    blockerKind:'OWNER_POLICY'};
  if(typeof this.invokePledge!=='function')
   return {status:'WAITING_DEPENDENCY',
    reason:'OFFICE_TASK_NATIVE_PLEDGE_EXECUTOR_NOT_WIRED',
    blockerKind:'TECHNICAL_DEPENDENCY'};
  const agentId=pledge.metadata.agentId;
  // The native agent's state is persisted independently from its transient
  // process. A resumed task may use this continuation to avoid repeating work.
  const run=this.fabric.beginRun(agentId,{input:{taskId:task.id,
   sourceSha256:source.sha256,perceptionPointId:source.perceptionPointId},
   invokedBy:'ORION_OFFICE_TASK_ENGINE'});
  try{
   const outcome=await this.invokePledge({agentId,scrollNumber:pledge.scrollNumber,
    birthNumber:pledge.birthNumber,durableIdentityId:pledge.durableIdentityId,
    chapterNumber:source.chapterNumber,perceptionPointId:source.perceptionPointId,
    taskId:task.id,runId:run.runId,sourceBytes:Buffer.from(bytes),
    sourceSha256:source.sha256,sourceLocator:source.sourceLocator,
    context:this.fabric.resumeHeader(agentId),
    objective:'Determine who, what, where, when, why, how, contradictions and potential growth',
    standingGrant:permitted});
   if(!outcome||outcome.accepted!==true||!outcome.executionReceiptId||
    outcome.agentId!==agentId||outcome.sourceSha256!==source.sha256||
    !outcome.analysis||decisionFields.some(k=>typeof outcome.analysis[k]!=='string'||
       !outcome.analysis[k].trim())||
    !Array.isArray(outcome.evidenceRefs)||
    !outcome.evidenceRefs.includes('sha256:'+source.sha256)||
    !Array.isArray(outcome.growthCandidates))
    throw Error('OFFICE_TASK_PLEDGE_SEMANTIC_RECEIPT_INCOMPLETE');
   // Recheck the exact source after the asynchronous Pledge run. Newer
   // evidence creates a later interpretation, never a retroactive rewrite.
   this.docs.readback(source);
   // Derived reasoning belongs in the same real SSD document tree as the
   // Perception Point and Scroll that produced it. Do not overwrite or promote
   // the original source, and do not claim Drive bytes were mirrored.
   const analysisDocument=this.docs.save({
    chapterNumber:source.chapterNumber,perceptionPointId:source.perceptionPointId,
    scrollNumber:pledge.scrollNumber,
    documentId:'analysis-'+sha({taskId:task.id}).slice(0,24),
    content:JSON.stringify({
     schema:'orion-office-linked-analysis/1.0',sourceDocumentId:source.documentId,
     sourceSha256:source.sha256,sourceLocator:source.sourceLocator,
     taskId:task.id,agentId,scrollNumber:pledge.scrollNumber,
     birthNumber:pledge.birthNumber,durableIdentityId:pledge.durableIdentityId,
     executionReceiptId:outcome.executionReceiptId,
     analysis:outcome.analysis,evidenceRefs:outcome.evidenceRefs,
     growthCandidates:outcome.growthCandidates,
     evidenceStatus:'PLEDGE_REPORTED_DERIVATION_NOT_ORIGINAL_SOURCE',
     independentlyVerifiedTruth:false},null,2),
    sourceLocator:'orion-task://'+task.id,
    origin:'ORION_AUTHORED',classification:'DERIVED'});
   this.docs.readback(analysisDocument.receipt.data);
   const checkpoint=this.fabric.completeRun(agentId,{
    runId:run.runId,status:'COMPLETE',cursor:{taskId:task.id,
     sourceSha256:source.sha256,executionReceiptId:outcome.executionReceiptId,
     analysisDocumentSha256:analysisDocument.receipt.data.sha256},
    result:{analysisDocument:analysisDocument.receipt.data.relativePath,
     analysisDocumentSha256:analysisDocument.receipt.data.sha256,
     evidenceRefs:outcome.evidenceRefs,growthCandidates:outcome.growthCandidates}});
   if(this.fabric.resumeHeader(agentId).latestCheckpoint?.hash!==checkpoint.hash)
    throw Error('OFFICE_TASK_PLEDGE_CHECKPOINT_READBACK_FAILED');
   return {status:'COMPLETE',sourceSha256:source.sha256,
    agentId,scrollNumber:pledge.scrollNumber,birthNumber:pledge.birthNumber??null,
    executionReceiptId:outcome.executionReceiptId,
    checkpointId:checkpoint.checkpointId,
    analysisDocument:analysisDocument.receipt.data.relativePath,
    analysisDocumentSha256:analysisDocument.receipt.data.sha256,
    analysis:outcome.analysis,evidenceRefs:outcome.evidenceRefs,
    growthCandidates:outcome.growthCandidates,
    semanticUnderstanding:'PLEDGE_EXECUTOR_REPORTED_WITH_DURABLE_CHECKPOINT',
    sourceReadbackVerified:true,linkedDerivedDocumentReadbackVerified:true,
    growthActionsExecuted:false,driveMirrorVerified:false,
    growthTasksQueued:outcome.growthCandidates.length,
    cloudMirrorTasksQueued:this.cloudMirror?1:0,
    followUps:[...this.growth.followUps({derived:analysisDocument.receipt.data}),
     ...(this.cloudMirror?.followUps({derived:analysisDocument.receipt.data})||[])]};
  }catch(e){
   this.fabric.completeRun(agentId,{runId:run.runId,status:'WAITING_DEPENDENCY',
    result:{errorCode:String(e.message||e),taskId:task.id},
    cursor:{taskId:task.id,sourceSha256:source.sha256}});
   return {status:'WAITING_DEPENDENCY',reason:String(e.message||e),
    blockerKind:'TECHNICAL_DEPENDENCY'};
  }
 }
}
module.exports={OrionOfficeTaskBridge,KIND};
