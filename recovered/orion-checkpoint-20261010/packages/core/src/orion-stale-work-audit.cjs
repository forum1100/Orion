'use strict';
// This auditor reads native Orion's current state and receipts. It NEVER
// changes a task, promotes a candidate, grants device access or starts Orion.
const fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const safe=x=>String(x||'');
class OrionStaleWorkAudit{
 constructor({root}={}){
  if(!root)throw Error('STALE_AUDIT_ROOT_REQUIRED');
  this.root=path.resolve(root);
 }
 run({maxCycles=24}={}){
  const state=read(path.join(this.root,'orion-task-engine','state.json'));
  const active=[],review=[],deferred=[],ready=[];
  for(const t of Object.values(state.tasks||{})){
   if(['COMPLETE','FAILED_PRESERVED','CANCELED'].includes(t.status))continue;
   const reason=safe(t.lastResult?.result?.reason||t.lastError);
   const entry={id:t.id,kind:t.kind,status:t.status,attempts:Number(t.attempts||0),
    reason,updatedAt:t.updatedAt||null,
    correctiveAuthority:'NONE_FROM_AUDIT'};
   if(t.status==='WAITING_DEPENDENCY'&&/REVIEW|PROMOTION/.test(reason))review.push(entry);
   else if(t.status==='WAITING_DEPENDENCY'&&/DEFERRED|PROVIDER|NO_PROGRESS/.test(reason))
    deferred.push({...entry,proposeNoRetryWithoutChangedEvidence:true});
   else if(['READY','RETRY_READY'].includes(t.status))ready.push(entry);
   else active.push(entry);
  }
  const cycleRoot=path.join(this.root,'orion-improvement','cycles');
  let files=[];
  try{files=fs.readdirSync(cycleRoot).filter(x=>x.endsWith('.json')).sort().reverse()
    .slice(0,Math.max(1,Math.min(200,Number(maxCycles)||24)));}catch{}
  const cycles=[],statuses={};
  for(const filename of files){
   let row;try{row=read(path.join(cycleRoot,filename));}
   catch{cycles.push({file:filename,status:'CYCLE_UNREADABLE_PRESERVED'});continue;}
   const stage=safe(row.promotion?.deployment||row.status||'UNKNOWN');
   cycles.push({file:filename,candidateId:row.candidateId||null,
    status:safe(row.status),deployment:safe(row.promotion?.deployment||'NOT_PROMOTED'),
    validationStatus:row.validation?.status||null,
    trainingQualified:row.status==='QUALIFIED_COMMITTED_TRAINING',
    livePromotionVerified:false});
   statuses[stage]=(statuses[stage]||0)+1;
  }
  let activeSkills='UNKNOWN';
  try{
   const adoption=read(path.join(this.root,'orion-upgrade-adoption','state.json'));
   activeSkills=Object.keys(adoption.active||{}).length;
  }catch{}
  return {schema:'orion-stale-work-read-only-audit/1.0',generatedAt:new Date().toISOString(),
   root:this.root,taskSummary:{reviewHeld:review.length,deferredProvider:deferred.length,
    ready:ready.length,otherActive:active.length},
   reviewHeld:review,deferredProvider:deferred,ready,otherActive:active,
   cycleSummary:statuses,recentCycles:cycles,activeSkillsInAdoptionState:activeSkills,
   prescribedContinuation:[
    'Do not silently retry unchanged deferred provider after historical repeated attempts',
    'Do not count a pending review as rejection or approval',
    'TRAINING_SHELF_ONLY_PENDING_RELEASE_GATE is not a live deployment receipt',
    'Future agent/Office/Scroll architecture is file-backed until actual process adoption proven'
   ],tasksModified:0,releasePromotions:0,devicePermissionEffects:0};
 }
}
module.exports={OrionStaleWorkAudit};
