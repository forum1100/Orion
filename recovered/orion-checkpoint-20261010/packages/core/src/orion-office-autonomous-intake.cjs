'use strict';
// Source-qualified event-driven intake contract; not installed in resident Electron.
// Unknown documents are never executed as code. Orion-provided native hooks are
// responsible for trusted policy verification, cognition, and actual Pledge work.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
class OrionOfficeAutonomousIntake {
 constructor({root,documentTree,crewHouse,delegation,verifyStandingPolicy,
  decideDisposition,dispatchPledge,getDispatchStatus,verifyLegacyStewardship}={}){
  if(!root||!documentTree||!crewHouse||!delegation)
   throw Error('ORION_INTAKE_FOUNDING_SYSTEM_REQUIRED');
  this.root=path.join(path.resolve(root),'orion-office-intake');
  this.journal=path.join(this.root,'intake-events.jsonl');
  this.docs=documentTree;this.crew=crewHouse;this.delegation=delegation;
  this.verifyStandingPolicy=verifyStandingPolicy;
  this.decideDisposition=decideDisposition;this.dispatchPledge=dispatchPledge;
  this.getDispatchStatus=getDispatchStatus;
  this.verifyLegacyStewardship=verifyLegacyStewardship;
  fs.mkdirSync(this.root,{recursive:true});
 }
 events(){
  if(!fs.existsSync(this.journal))return [];
  const rows=fs.readFileSync(this.journal,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
  let prev=null;
  for(const row of rows){
   const {eventHash,...payload}=row;
   if(row.previousHash!==prev||hash(payload)!==eventHash)
    throw Error('OFFICE_INTAKE_EVENT_CHAIN_INVALID_PRESERVED');
   prev=eventHash;
  }
  return rows;
 }
 record(kind,data){
  const rows=this.events();
  const row={schema:'orion-office-autonomous-intake/1.0',
   eventId:crypto.randomUUID(),at:new Date().toISOString(),
   kind,data,previousHash:rows.at(-1)?.eventHash||null};
  row.eventHash=hash(row);
  fs.appendFileSync(this.journal,JSON.stringify(row)+'\n');
  return row;
 }
 ingest({chapterNumber,perceptionPointId,documentId,content,sourceLocator,
  sourceActor='UNKNOWN',discoveredBy='OWNER_OR_APPROVED_PROVIDER',discoveryReceiptId=null,
  origin='EXTERNAL_UNPROCESSED',standingAuthority=null}={}){
  // Storage is actual bytes; even an unresolved provider/authority remains
  // available for later reasoning and does not silently become 'processed'.
  const stored=this.docs.save({chapterNumber,perceptionPointId,documentId,content,
   sourceLocator,origin,classification:'SOURCE_COPY'});
  const d=stored.receipt.data;
  const key=hash({chapterNumber:d.chapterNumber,perceptionPointId:d.perceptionPointId,
   documentId:d.documentId,sha256:d.sha256});
  // An accepted durable task is not a completed semantic review.
  // Never re-birth a Pledge solely because a discovered document is replayed.
  const old=this.events().find(e=>e.kind==='DOCUMENT_TASK_ACCEPTED'&&e.data.key===key);
  if(old){
   let state=null;
   if(typeof this.getDispatchStatus==='function')
    state=this.getDispatchStatus(old.data.assignment);
   const complete=state?.status==='COMPLETE'&&state?.lastResult?.status==='COMPLETE'&&
    state?.lastResult?.sourceSha256===d.sha256;
   return {status:complete?'ALREADY_PROCESSED':'ALREADY_DISPATCHED',
    receipt:old,document:d,processingComplete:complete};
  }
  const evidence={key,document:d,who:String(sourceActor),what:documentId,
   where:{chapterLineage:d.chapterLineage,sourceLocator:d.sourceLocator,localDocument:d.relativePath},
   when:{discoveredAt:new Date().toISOString(),sourceTimestamp:'NOT_VERIFIED'},
   why:'UNPROCESSED_DOCUMENT_ROUTED_TO_OFFICE',how:discoveredBy,
   discoveryReceiptId,origin};
  this.record('DOCUMENT_DISCOVERED',evidence);
  try{
   if(typeof this.verifyStandingPolicy!=='function'||
    this.verifyStandingPolicy({authority:standingAuthority,chapterNumber:d.chapterNumber,
     perceptionPointId:d.perceptionPointId,action:'ORION_PROCESS_OFFICE_DOCUMENT'})!==true)
    throw Error('ORION_INTAKE_STANDING_AUTHORITY_NOT_VERIFIED');
   if(typeof this.decideDisposition!=='function')throw Error('ORION_INTAKE_DECISION_ENGINE_NOT_WIRED');
   // Orion's native cognitive dispatcher can inspect byte-verified source
   // pages within a bounded window. This is DATA, never runnable code or a
   // substituted root instruction. Page access re-verifies source identity.
   const loadSourcePage=({offset=0,length=65536}={})=>{
    if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(length)||
     length<1||length>65536)
     throw Error('ORION_INTAKE_SOURCE_PAGE_BUDGET_INVALID');
    const verified=this.docs.readback(d);
    return {sourceSha256:d.sha256,totalBytes:d.byteLength,offset,
     bytes:Buffer.from(verified.bytes.subarray(offset,offset+length)),
     originalBytesVerified:true,untrustedSourceData:true};
   };
   const decision=this.decideDisposition({...evidence,contentHash:d.sha256,
    byteLength:d.byteLength,immutableDocumentId:d.documentId,
    sourceReadbackVerified:true,loadSourcePage});
   if(!decision||!['EXISTING_PLEDGE','BIRTH_PLEDGE'].includes(decision.route))
    throw Error('ORION_INTAKE_DISPOSITION_INVALID');
   if(!String(decision.why||'').trim()||!Array.isArray(decision.evidenceRefs)||
    !decision.evidenceRefs.length)throw Error('ORION_INTAKE_DECISION_PROVENANCE_REQUIRED');
   this.record('DISPOSITION_PROPOSED',{key,route:decision.route,reason:decision.why,
    evidenceRefs:decision.evidenceRefs,actor:'ORION_BRAIN'});
   let pledge;
   if(decision.route==='EXISTING_PLEDGE'){
    pledge=this.crew.scrollBook().pledges.find(p=>p.scrollNumber===decision.scrollNumber);
    if(!pledge)throw Error('ORION_INTAKE_EXISTING_SCROLL_MISSING');
    const points=[...(pledge.metadata?.stewardedPerceptionPointIds||[]),
     pledge.metadata?.originPerceptionPointId,pledge.managerOfPerceptionPointId];
    if(!points.includes(d.perceptionPointId)&&
     (typeof this.verifyLegacyStewardship!=='function'||
      this.verifyLegacyStewardship({pledge,chapterNumber:d.chapterNumber,
       perceptionPointId:d.perceptionPointId,
       authority:'READ_ONLY_CANONICAL_LEGACY_CUSTODY'})!==true))
     throw Error('ORION_INTAKE_SCROLL_SCOPE_MISMATCH');
   }else{
    if(!decision.birth||!decision.birth.grant)
     throw Error('ORION_INTAKE_ISSUED_BIRTH_IDENTITY_AND_GRANT_REQUIRED');
    // Recover a previously registered birth after an interrupted dispatch,
    // without allocating a second identity or inventing a new birth history.
    const prev=this.crew.scrollBook().pledges.find(p=>
     p.metadata?.agentId===decision.birth.childAgentId);
    if(prev){
     if(prev.scrollNumber!==String(decision.birth.childScrollNumber).padStart(4,'0')||
      prev.birthNumber!==String(decision.birth.birthNumber)||
      prev.metadata.originPerceptionPointId!==d.perceptionPointId||
      prev.metadata.createdBy?.id!==d.chapterNumber)
      throw Error('ORION_INTAKE_PREVIOUS_BIRTH_IDENTITY_CONFLICT');
     pledge=prev;
     this.record('PLEDGE_BIRTH_REUSED_AFTER_INTERRUPTION',{key,
      scrollNumber:pledge.scrollNumber,durableIdentityId:pledge.durableIdentityId});
    }else{
     const birth=this.delegation.birth({...decision.birth,
      initiatedBy:{kind:'OFFICE',id:d.chapterNumber},
      perceptionPointId:d.perceptionPointId,
      reason:decision.why,evidenceRefs:decision.evidenceRefs});
     pledge=birth.pledge;
     this.record('PLEDGE_BIRTH_CATALOGUED',{key,scrollNumber:pledge.scrollNumber,
      birthNumber:pledge.birthNumber,durableIdentityId:pledge.durableIdentityId,
      physicallyRunning:false});
    }
   }
   if(typeof this.dispatchPledge!=='function')
    throw Error('ORION_INTAKE_PLEDGE_EXECUTOR_NOT_WIRED');
   const assignment={key,scrollNumber:pledge.scrollNumber,
    birthNumber:pledge.birthNumber,chapterNumber:d.chapterNumber,
    perceptionPointId:d.perceptionPointId,sourceSha256:d.sha256,
    immutableDocument:d.relativePath,sourceLocator:d.sourceLocator,
    why:decision.why,task:'TRACE_WHO_WHAT_WHERE_WHEN_WHY_HOW_AND_GROWTH',
    possibleGrowth:'RECORD_POTENTIAL_BRANCHES_AND_PROPOSE_OFFICE_OR_PLEDGE_GROWTH'};
   this.record('PLEDGE_DISPATCH_REQUESTED',assignment);
   const result=this.dispatchPledge(assignment);
   if(!result||result.accepted!==true||!result.executionReceiptId)
    throw Error('ORION_INTAKE_PLEDGE_EXECUTION_NOT_ACKNOWLEDGED');
   const ack=this.record('DOCUMENT_TASK_ACCEPTED',{key,assignment,
    executionReceiptId:String(result.executionReceiptId),
    acceptedMeans:'DURABLE_TASK_QUEUED_NOT_SEMANTICALLY_PROCESSED',
    durableTaskReadbackVerified:result.durableTaskReadbackVerified===true,
    semanticUnderstandingVerified:false,providerDriveMirrorVerified:false});
   return {status:'DISPATCHED_TO_PLEDGE',receipt:ack,pledge,document:d,
    processingComplete:false};
  }catch(e){
   this.record('INTAKE_BLOCKED_PRESERVED',{key,reason:e.message,
    documentStored:true,sourceOriginalUnchanged:true,orionNeedsReconciliation:true});
   return {status:'WAITING_DEPENDENCY',reason:e.message,document:d};
  }
 }
}
module.exports={OrionOfficeAutonomousIntake};
