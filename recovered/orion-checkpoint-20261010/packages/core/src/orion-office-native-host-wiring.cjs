'use strict';
// Qualify existing first-party CrewHouse steward and explicitly owner-controlled
// source layout. A file never self-creates an Office/Scroll or expands authority.
const path=require('node:path'),fs=require('node:fs');
const {OrionCrewDelegation}=require('./orion-crew-delegation.cjs');
const {OrionOfficeHostAdapter}=require('./orion-office-host-adapter.cjs');
const {documentReview}=require('./orion-office-native-pledge-review.cjs');
const {OrionCanonicalPerceptionVerifier}=require('./orion-canonical-perception-verifier.cjs');
const idPattern=/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;
const within=(file,root)=>file===root||file.startsWith(root+path.sep);
function nativeOfficeHost({inboxRoot,storageRoot,crewHouse,taskEngine,
 agentStateFabric,capabilityBus,standingAuthority,deviceId,rootVault,
 allowCreateInbox=false,vault=null,driveProvider=null}={}){
 if(!inboxRoot||!storageRoot||!crewHouse||!taskEngine||!agentStateFabric||
  !capabilityBus||!standingAuthority||!deviceId||!rootVault)
  throw Error('ORION_NATIVE_OFFICE_HOST_PREREQUISITES_MISSING');
 const inbox=path.resolve(inboxRoot),store=path.resolve(storageRoot);
 if(inbox===store||within(inbox,store)||within(store,inbox))
  throw Error('ORION_NATIVE_OFFICE_INBOX_AND_STORAGE_MUST_BE_SEPARATE');
 if(allowCreateInbox)fs.mkdirSync(inbox,{recursive:true});
 const approved=fs.realpathSync(inbox);
 fs.mkdirSync(store,{recursive:true});
 const verifiedStorage=fs.realpathSync(store);
 if(verifiedStorage===approved||within(verifiedStorage,approved)||
  within(approved,verifiedStorage))
  throw Error('ORION_NATIVE_OFFICE_STORAGE_OVERLAPS_SOURCE');
 // This is a read-only present-time triage view, NOT a historical stewardship
 // assignment or an invented Birth Number. The actual UUID and Perception Hash
 // must read back from the first-party append-only PerceptionMemory source.
 const canonical=new OrionCanonicalPerceptionVerifier({root:rootVault});
 const legacyProof=({pledge,chapterNumber,perceptionPointId})=>{
  if(!pledge||pledge.metadata?.agentId!=='librarian'||
   pledge.currentChapterNumber!==chapterNumber||
   pledge.birthNumber!=null)return false;
  const chapter=crewHouse.chapterBook().chapters.find(c=>
   c.chapterNumber===chapterNumber&&c.metadata?.agentId==='librarian');
  return Boolean(chapter&&canonical.verifyPoint(perceptionPointId).verified===true);
 };
 // Narrow sender route: one native Librarian, an actual registered Chapter,
 // source files under {inbox}/{ChapterNumber}/{PerceptionPointId}/filename.
 const checkScope=({grant,chapterNumber,perceptionPointId,sourcePath})=>{
  const chapterId=String(chapterNumber||''),pp=String(perceptionPointId||'');
  if(!/^\d{4,}$/.test(chapterId)||!idPattern.test(pp)||grant?.agentId!=='librarian'||
   grant?.deviceId!==deviceId)return false;
  const segments=path.relative(approved,sourcePath).split(path.sep);
  if(segments.length!==3||segments[0]!==chapterId||segments[1]!==pp||
   !segments[2]||segments.some(s=>s==='..'))return false;
  const chapter=crewHouse.chapterBook().chapters.find(c=>c.chapterNumber===chapterId);
  if(!chapter)return false;
  const tied=chapter.metadata?.originPerceptionPointId===pp||
   crewHouse.scrollBook().pledges.some(p=>p.currentChapterNumber===chapterId&&(
    p.metadata?.originPerceptionPointId===pp||
    p.managerOfPerceptionPointId===pp||
    (p.metadata?.stewardedPerceptionPointIds||[]).includes(pp)||
    legacyProof({pledge:p,chapterNumber:chapterId,perceptionPointId:pp})));
  return tied;
 };
 const choose=evidence=>{
  const pp=evidence.document.perceptionPointId,chapter=evidence.document.chapterNumber;
  const matches=crewHouse.scrollBook().pledges.filter(p=>
   p.currentChapterNumber===chapter&&
   p.metadata?.agentId&&
   ((p.metadata.stewardedPerceptionPointIds||[]).includes(pp)||
     p.metadata.originPerceptionPointId===pp||p.managerOfPerceptionPointId===pp||
     legacyProof({pledge:p,chapterNumber:chapter,perceptionPointId:pp})));
  const steward=matches.find(p=>!['FAULTED','REVOKED','DISABLED'].includes(p.status));
  if(!steward)return null; // preserved WAITING_DEPENDENCY; do not invent a birth
  const snippet=evidence.loadSourcePage({offset:0,length:Math.min(4096,evidence.byteLength)});
  if(!snippet.originalBytesVerified||snippet.sourceSha256!==evidence.document.sha256)
   throw Error('ORION_NATIVE_OFFICE_SOURCE_CUSTODY_FAILED');
  return {route:'EXISTING_PLEDGE',scrollNumber:steward.scrollNumber,
   why:'Existing CrewHouse steward for bounded project document; first page inspected as untrusted source data',
   evidenceRefs:['sha256:'+evidence.document.sha256,'crew-scroll:'+steward.scrollNumber,
    'custody-chapter:'+chapter]};
 };
 const delegation=new OrionCrewDelegation({root:verifiedStorage,crewHouse,
  verifyDelegationGrant:()=>false}); // No Pledge birth without separate qualified owner grant.
 const adapter=new OrionOfficeHostAdapter({
  root:verifiedStorage,crewHouse,taskEngine,agentStateFabric,delegation,
  capabilityBus,standingAuthority,allowedSourceRoots:[approved],deviceId,
  decideDisposition:choose,verifyOfficeScope:checkScope,
  verifyLegacyStewardship:legacyProof,
  enableMirrorLifecycle:true,driveProvider,
  verifyCloudDestination:({authority,chapterLineage,perceptionPointId,sourceClass})=>{
   const signed=standingAuthority.signedManifest?.();
   if(!signed?.ok||!Array.isArray(chapterLineage)||!chapterLineage.length||
    !idPattern.test(String(perceptionPointId))||
    !['SOURCE_COPY','DERIVED','CHECKPOINT','FROZEN_MOMENT','CONTRADICTION',
     'SCROLL_MEMORY'].includes(sourceClass))return false;
   const g=signed.manifest?.standingAuthority?.grants?.find(x=>
    x.id===authority?.grantId&&x.enabled===true);
   // Cloud writes require an explicit owner-signed Drive root folder and
   // a native provider bound to the identical authenticated root.
   return typeof g?.approvedDriveFolderId==='string'&&
    g.approvedDriveFolderId.length>10&&
    driveProvider?.rootFolderId===g.approvedDriveFolderId&&
    chapterLineage.every(c=>crewHouse.chapterBook().chapters.some(x=>x.chapterNumber===c));
  },
  invokePledge:async context=>documentReview(context),
  assessGrowth:({candidate,newEvidence})=>{
   const kind=String(candidate?.kind||'UNCLASSIFIED_GROWTH');
   if(/OFFICE|SUB.?OFFICE|CONTEXT|DELEGAT/i.test(kind))
    return {action:'NEEDS_CONTEXT_BENCHMARK',
     reason:'Verify content/project safe-context maximum and independent Chapter responsibility before delegated growth'+
      (newEvidence?'; fresh PP evidence is now available':'')};
   if(/PROVENANCE|CONTRADICTION|EVIDENCE|SOURCE/i.test(kind))
    return {action:'NEEDS_EVIDENCE',
     reason:'Reconcile source provenance/contradictions with independently collected evidence'+
      (newEvidence?'; fresh PP source added for comparison':'')};
   return {action:'REVISIT',reason:'No qualified autonomous growth implementation or independent closure receipt'};
  }
 });
 const status=adapter.register();
 capabilityBus.register({id:'orion.office.growth.status',
  description:'Read bounded, task-backed open Orion Office growth responsibilities and next re-evaluation times.',
  risk:'READ_ONLY'},async()=>{
   const rows=taskEngine.list().filter(t=>t.kind==='ORION_OFFICE_GROWTH_REVIEW');
   const open=rows.filter(t=>!['COMPLETE','CANCELED','FAILED_PRESERVED'].includes(t.status));
   const byStatus={};
   for(const t of rows)byStatus[t.status]=(byStatus[t.status]||0)+1;
   return {schema:'orion-office-growth-status/1.0',
    source:'ORION_TASK_ENGINE_DURABLE_TASKS',total:rows.length,open:open.length,
    byStatus,visibleOpen:open.slice(0,100).map(t=>({
     id:t.id,chapterNumber:t.input?.growth?.chapterNumber,
     perceptionPointId:t.input?.growth?.perceptionPointId,
     responsibleAgentId:t.responsibleAgentId,status:t.status,
     nextReviewAt:t.availableAt||null,
     lastDisposition:t.lastResult?.growthReview?.disposition||null})),
    truncationCount:Math.max(0,open.length-100),
    noCandidateMaySelfAuthorizeBirth:true};
  });
 const result={schema:'orion-native-office-host-wiring/1.0',...status,
  signedPolicy:standingAuthority.status(),storageRoot:verifiedStorage,
  authorizedInboxRoot:approved,deviceId,
  bornAgents:0,existingCrewSelectionOnly:true,
  externalArrivalDeliveryAlreadyActive:false,
  directoryObserverInstalled:false,driveCloudMirrorVerified:false};
 try{vault?.append?.('orion-office-host-installed','orion',{
  capabilityId:status.capabilityId,authorizedInboxRoot:approved,
  storageRoot:verifiedStorage,deviceId,bornAgents:0,
  externalArrivalDeliveryAlreadyActive:false,policyRootHash:result.signedPolicy.rootHash});}catch{}
 return {adapter,status:result};
}
module.exports={nativeOfficeHost};
