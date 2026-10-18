'use strict';
// First-party, source-qualified Orion host entry point. Existing Orion subsystems
// deliver approved document-arrival events through the native CapabilityBus.
// This module installs NO file watcher, timers, worker, or new Orion process.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {OrionOfficeDocumentTree}=require('./orion-office-document-tree.cjs');
const {OrionOfficeAutonomousIntake}=require('./orion-office-autonomous-intake.cjs');
const {OrionOfficeTaskBridge}=require('./orion-office-task-bridge.cjs');
const {OrionOfficeMirrorTaskLifecycle}=require('./orion-office-mirror-task-lifecycle.cjs');
const CAPABILITY='orion.office.document.arrived';
const isInside=(p,root)=>p===root||p.startsWith(root+path.sep);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
class OrionOfficeHostAdapter {
 constructor({root,crewHouse,taskEngine,agentStateFabric,delegation,
  capabilityBus,standingAuthority,allowedSourceRoots=[],decideDisposition,
  invokePledge,assessGrowth,verifyGrowthClosure,
  verifyOfficeScope,verifyLegacyStewardship,
  deviceId=null,maxDocumentBytes=8*1024*1024,
  enableMirrorLifecycle=false,driveProvider=null,verifyCloudDestination}={}){
  if(!root||!crewHouse||!taskEngine||!agentStateFabric||!delegation||
   !capabilityBus||!standingAuthority)
   throw Error('OFFICE_HOST_NATIVE_SERVICES_REQUIRED');
  if(capabilityBus.standingAuthority!==standingAuthority)
   throw Error('OFFICE_HOST_CAPABILITY_AUTHORITY_BINDING_MISMATCH');
  if(!Array.isArray(allowedSourceRoots)||!allowedSourceRoots.length)
   throw Error('OFFICE_HOST_APPROVED_SOURCE_ROOT_REQUIRED');
  this.allowedRoots=allowedSourceRoots.map(p=>fs.realpathSync(path.resolve(p)));
  this.tree=new OrionOfficeDocumentTree({root,crewHouse,
   allowedSourceRoots:this.allowedRoots,verifyLegacyStewardship,maxDocumentBytes});
  this.bridge=new OrionOfficeTaskBridge({
   taskEngine,documentTree:this.tree,crewHouse,agentStateFabric,
   standingAuthority,invokePledge,assessGrowth,verifyGrowthClosure,
   verifyLegacyStewardship,deviceId});
  this.cloudMirror=enableMirrorLifecycle?new OrionOfficeMirrorTaskLifecycle({
   root,taskEngine,documentTree:this.tree,standingAuthority,deviceId,
   provider:driveProvider,verifyCloudDestination}):null;
  if(this.cloudMirror)this.bridge.cloudMirror=this.cloudMirror;
  this.bus=capabilityBus;this.engine=taskEngine;
  this.standingAuthority=standingAuthority;this.verifyOfficeScope=verifyOfficeScope;
  this.deviceId=deviceId;
  this.intake=new OrionOfficeAutonomousIntake({
   root,documentTree:this.tree,crewHouse,delegation,
   verifyStandingPolicy:({authority,chapterNumber,perceptionPointId,action})=>
    action==='ORION_PROCESS_OFFICE_DOCUMENT'&&
    authority?.ok===true&&authority.capabilityId===CAPABILITY&&
    authority.risk==='LOCAL_MUTATION'&&
    typeof authority.grantId==='string'&&Boolean(authority.grantId)&&
    Boolean(chapterNumber)&&Boolean(perceptionPointId),
   decideDisposition,dispatchPledge:a=>this.bridge.dispatch(a),
   verifyLegacyStewardship,
   getDispatchStatus:a=>this.engine.readArchivedTask(this.bridge.taskId(a))
  });
  this.maxDocumentBytes=maxDocumentBytes;
 }
 register(){
  if(this.bus.has(CAPABILITY))throw Error('OFFICE_HOST_CAPABILITY_ALREADY_REGISTERED');
  this.bridge.install();
  const mirrorStatus=this.cloudMirror?.install()||null;
  this.bus.register({id:CAPABILITY,
   description:'Accept a signed Orion-origin Office document event, preserve exact authorized source bytes and queue a durable Pledge review.',
   risk:'LOCAL_MUTATION',inputSchema:{
    chapterNumber:'string',perceptionPointId:'string',
    documentId:'string',sourcePath:'string'}},
   async(input,context)=>this.arrived(input,context));
  return {registered:true,capabilityId:CAPABILITY,
   cloudMirror:mirrorStatus,
   taskKind:'ORION_OFFICE_DOCUMENT_REVIEW',
   eventSource:'AUTHORIZED_EXPLICIT_NATIVE_DELIVERY',
   independentWatcherInstalled:false,additionalOrionStarted:false};
 }
 arrived(input={},context={}){
  // Never let untrusted document text or a caller-asserted 'authorized=true'
  // grant filesystem access or an autonomous agent-birth privilege.
  const grant=context.delegation;
  if(context.unattended!==true||!String(context.agentId||'').trim()||
   !String(context.taskId||'').trim()||
   grant?.ok!==true||grant.capabilityId!==CAPABILITY||
   grant.risk!=='LOCAL_MUTATION'||!grant.grantId)
   throw Error('OFFICE_HOST_SIGNED_ARRIVAL_CAPABILITY_REQUIRED');
  const verified=this.standingAuthority.evaluate({
   capabilityId:CAPABILITY,agentId:context.agentId,taskId:context.taskId,
   risk:'LOCAL_MUTATION',deviceId:context.deviceId||this.deviceId,unattended:true});
  if(verified?.ok!==true||verified.grantId!==grant.grantId||
   verified.capabilityId!==CAPABILITY||
   verified.agentId!==context.agentId||verified.taskId!==context.taskId)
   throw Error('OFFICE_HOST_ARRIVAL_GRANT_NOT_FRESHLY_VERIFIED');
  const source=fs.realpathSync(path.resolve(input.sourcePath||''));
  if(!this.allowedRoots.some(root=>isInside(source,root)))
   throw Error('OFFICE_HOST_SOURCE_OUTSIDE_APPROVED_ROOT');
  if(typeof this.verifyOfficeScope!=='function'||
   this.verifyOfficeScope({grant:verified,chapterNumber:input.chapterNumber,
    perceptionPointId:input.perceptionPointId,sourcePath:source})!==true)
   throw Error('OFFICE_HOST_SCOPED_PROJECT_CUSTODY_REQUIRED');
  const stat=fs.statSync(source);
  if(!stat.isFile()||!stat.size||stat.size>this.maxDocumentBytes)
   throw Error('OFFICE_HOST_SOURCE_INVALID_SIZE_OR_TYPE');
  const originalBytes=fs.readFileSync(source);
  if(originalBytes.length!==stat.size||!originalBytes.length||
   originalBytes.length>this.maxDocumentBytes)
   throw Error('OFFICE_HOST_SOURCE_CHANGED_DURING_READ');
  const output=this.intake.ingest({
   chapterNumber:input.chapterNumber,
   perceptionPointId:input.perceptionPointId,
   documentId:input.documentId,
   content:originalBytes,sourceLocator:source,
   sourceActor:String(input.sourceActor||'UNKNOWN_UNATTESTED'),
   discoveryReceiptId:'source-sha256:'+sha(originalBytes),
   discoveredBy:'SIGNED_ORION_NATIVE_CAPABILITY_EVENT',
   origin:'EXTERNAL_UNPROCESSED',standingAuthority:grant
  });
  if(output.document?.sha256!==sha(originalBytes))
   throw Error('OFFICE_HOST_STORED_DOCUMENT_READBACK_MISMATCH');
  // Independent new evidence wakes paused growth responsibilities belonging
  // to this exact project, never unrelated Chapters or closed tasks.
  const growthWake=this.bridge.growth.wakeForEvidence({
   chapterNumber:input.chapterNumber,perceptionPointId:input.perceptionPointId,
   sourceSha256:output.document.sha256});
  const mirrorTask=this.cloudMirror?.enqueueDocument(output.document)||null;
  return {schema:'orion-office-native-arrival/1.0',
   status:output.status,reason:output.reason||null,
   documentSha256:sha(originalBytes),
   chapterNumber:input.chapterNumber,
   perceptionPointId:input.perceptionPointId,
   executionReceiptId:output.receipt?.data?.executionReceiptId||null,
   processingComplete:output.processingComplete===true,
   signedGrantId:grant.grantId,sourceOwnedLocally:true,
   sourceExecutionPermitted:false,watcherSpawned:false,
   growthTasksWoken:growthWake.woken,
   cloudMirrorTaskId:mirrorTask?.taskId||null,
   cloudMirrorPending:Boolean(mirrorTask),
   externalDriveProviderMirrored:false};
 }
}
module.exports={OrionOfficeHostAdapter,CAPABILITY};
