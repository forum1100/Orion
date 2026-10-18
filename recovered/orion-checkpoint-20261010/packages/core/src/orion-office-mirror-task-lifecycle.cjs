'use strict';
// Orion's durable cloud-mirror obligation: a source or derived document always
// gets a recoverable task. A local sync path is never treated as cloud proof.
// The owner must separately sign the exact external-write capability.
// If absent, the task remains alive with a bounded native next review.
const crypto=require('node:crypto');
const {OrionOfficeDriveMirror}=require('./orion-office-drive-mirror.cjs');
const KIND='ORION_OFFICE_DOCUMENT_CLOUD_MIRROR';
const CAPABILITY='orion.office.drive.mirror';
const hash=s=>crypto.createHash('sha256').update(JSON.stringify(s)).digest('hex');
class OrionOfficeMirrorTaskLifecycle{
 constructor({root,taskEngine,documentTree,standingAuthority,deviceId,
  provider=null,agentId='librarian',clock=()=>Date.now(),verifyCloudDestination}={}){
  if(!root||!taskEngine||!documentTree||!standingAuthority||!deviceId)
   throw Error('ORION_MIRROR_DURABLE_NATIVE_SERVICES_REQUIRED');
  this.tasks=taskEngine;this.docs=documentTree;this.authority=standingAuthority;
  this.deviceId=deviceId;this.agentId=agentId;this.clock=clock;
  this.verifyCloudDestination=verifyCloudDestination;this.provider=provider;
  this.mirror=new OrionOfficeDriveMirror({root,documentTree,provider,
   verifyDriveScope:({authority,chapterLineage,perceptionPointId,
    sourceClass,action})=>action==='ORION_MIRROR_DOCUMENT'&&
    authority?.ok===true&&authority.capabilityId===CAPABILITY&&
    authority.agentId===this.agentId&&authority.risk==='EXTERNAL_MUTATION'&&
    authority.deviceId===this.deviceId&&
    typeof authority.grantId==='string'&&authority.grantId.length>0&&
    typeof this.verifyCloudDestination==='function'&&
    this.verifyCloudDestination({authority,chapterLineage,perceptionPointId,
     sourceClass})===true
  });
 }
 setProvider(provider){
  // A live connector may be attached only by the trusted host; this method
  // does not itself supply credentials or widen signed owner authority.
  if(!provider||typeof provider.putDocument!=='function'||
   typeof provider.readDocumentBytes!=='function')
   throw Error('ORION_MIRROR_NATIVE_PROVIDER_INTERFACE_INVALID');
  this.provider=provider;this.mirror.provider=provider;
  let resumed=0;
  for(const t of this.tasks.list({includeTerminal:false})){
   if(t.kind!==KIND||t.status!=='RETRY_READY')continue;
   this.tasks.upsert({id:t.id,kind:KIND,status:'READY',
    availableAt:new Date(this.clock()-1000).toISOString(),
    input:{...t.input,providerChanged:true}});
   resumed++;
  }
  if(resumed)this.tasks.requestEvaluation('ORION_MIRROR_PROVIDER_CONNECTED');
  return {resumed,credentialsCopied:false,signedAuthorityChanged:false};
 }
 definition(row){
  if(row?.kind!=='DOCUMENT_STORED'||!row?.data?.sha256||
   !row.data.relativePath||!row.data.documentId)
   throw Error('ORION_MIRROR_SOURCE_RECEIPT_REQUIRED');
  const d=row.data;
  const pointer={relativePath:d.relativePath,sha256:d.sha256,
   byteLength:d.byteLength,documentId:d.documentId,
   chapterNumber:d.chapterNumber,perceptionPointId:d.perceptionPointId,
   scrollNumber:d.scrollNumber||null,birthNumber:d.birthNumber||null,
   origin:d.origin,classification:d.classification};
  return {id:'office-cloud-mirror-'+hash(pointer).slice(0,46),
   kind:KIND,title:'Cloud mirror and byte-verify '+d.documentId,
   source:'ORION_OFFICE_DOCUMENT_PRESERVATION',priority:55,
   responsibleAgentId:this.agentId,
   input:{mirror:pointer,heavy:false,requiresSSD:true}};
 }
 followUps({derived}){
  const row=this.docs.events().find(e=>e.kind==='DOCUMENT_STORED'&&
   e.data.sha256===derived?.sha256&&
   e.data.relativePath===derived?.relativePath);
  if(!row)throw Error('ORION_MIRROR_DERIVED_DOCUMENT_NOT_REGISTERED');
  this.docs.readback(row.data);
  return [this.definition(row)];
 }
 enqueueDocument(data){
  const row=this.docs.events().find(e=>e.kind==='DOCUMENT_STORED'&&
   e.data.sha256===data?.sha256&&e.data.relativePath===data?.relativePath);
  if(!row)throw Error('ORION_MIRROR_LOCAL_DOCUMENT_UNREGISTERED');
  this.docs.readback(row.data);
  const expected=this.definition(row),old=this.tasks.task(expected.id);
  if(old){
   if(old.kind!==KIND||hash(old.input?.mirror)!==hash(expected.input.mirror))
    throw Error('ORION_MIRROR_DURABLE_TASK_IDENTITY_CONFLICT');
   return {created:false,taskId:old.id};
  }
  const t=this.tasks.upsert(expected);
  if(this.tasks.task(t.id)?.kind!==KIND)
   throw Error('ORION_MIRROR_NATIVE_TASK_READBACK_FAILED');
  this.tasks.requestEvaluation('ORION_LOCAL_DOCUMENT_NEEDS_REMOTE_MIRROR');
  return {created:true,taskId:t.id};
 }
 install(){
  this.tasks.register(KIND,async task=>this.perform(task));
  return {registered:true,kind:KIND,...this.reconcile()};
 }
 reconcile({maxDocuments=2000}={}){
  const rows=this.docs.events().filter(e=>e.kind==='DOCUMENT_STORED');
  if(rows.length>maxDocuments)return {recovered:0,blocked:true,
   reason:'ORION_MIRROR_REPLAY_CURSOR_REQUIRED',totalDocuments:rows.length};
  let recovered=0,alreadyPresent=0;
  for(const row of rows){
   const result=this.enqueueDocument(row.data);
   if(result.created)recovered++;else alreadyPresent++;
  }
  return {recovered,alreadyPresent,blocked:false,totalDocuments:rows.length};
 }
 readReceipt(pointer){
  if(!pointer?.sha256||!pointer.relativePath)
   throw Error('ORION_MIRROR_TASK_POINTER_REQUIRED');
  const row=this.docs.events().find(e=>e.kind==='DOCUMENT_STORED'&&
   e.data.sha256===pointer.sha256&&
   e.data.relativePath===pointer.relativePath);
  if(!row)throw Error('ORION_MIRROR_DOCUMENT_GONE_FROM_CUSTODY');
  const d=row.data;
  if(d.byteLength!==pointer.byteLength||
   d.documentId!==pointer.documentId||
   d.chapterNumber!==pointer.chapterNumber||
   d.perceptionPointId!==pointer.perceptionPointId||
   (d.scrollNumber||null)!==(pointer.scrollNumber||null)||
   (d.birthNumber||null)!==(pointer.birthNumber||null)||
   d.classification!==pointer.classification)
   throw Error('ORION_MIRROR_TASK_POINTER_MISMATCH');
  this.docs.readback(d);
  return row;
 }
 async perform(task){
  let receipt;
  try{receipt=this.readReceipt(task.input?.mirror);}
  catch(error){return {status:'WAITING_DEPENDENCY',blockerKind:'SECURITY_INVARIANT',
   reason:String(error.message||error),sourcePreserved:true,mirrored:false};}
  const d=receipt.data;
  const decision=this.authority.evaluate({capabilityId:CAPABILITY,
   agentId:this.agentId,taskId:task.id,risk:'EXTERNAL_MUTATION',
   deviceId:this.deviceId,unattended:true});
  const follow=reason=>({
   status:'RETRY_READY',
   availableAt:new Date(this.clock()+24*3600000).toISOString(),
   reason,mirrored:false,originalStillLocalVerified:true,
   originalSha256:d.sha256,remoteBytesReadbackVerified:false,
   cloudDestinationNotWidened:true,preserveUntilAuthenticated:true,
   retryTriggers:['OWNER_SIGNED_EXTERNAL_GRANT','PROVIDER_CONNECTED',
    'REMOTE_BYTES_RESTORED','SCHEDULED_REVIEW']
  });
  if(!decision?.ok)return follow('ORION_MIRROR_SIGNED_CLOUD_SCOPE_MISSING:'+String(decision?.reason||'DENIED'));
  if(!this.provider)return follow('ORION_MIRROR_PROVIDER_NOT_CONNECTED');
  if(typeof this.verifyCloudDestination!=='function'||
   this.verifyCloudDestination({authority:decision,chapterLineage:d.chapterLineage,
    perceptionPointId:d.perceptionPointId,sourceClass:d.classification})!==true)
   return follow('ORION_MIRROR_PRIVATE_DESTINATION_UNQUALIFIED');
  try{
   const result=await this.mirror.mirror(receipt,{authority:decision});
   if(!result.mirrored||!result.receipt?.data?.providerReadbackVerified)
    return follow('ORION_MIRROR_NO_PROVIDER_REMOTE_BYTE_PROOF');
   return {status:'COMPLETE',mirrored:true,providerReadbackVerified:true,
    sourceSha256:d.sha256,remoteFileId:result.receipt.data.remoteFileId,
    mirrorReceiptId:result.receipt.eventId,remoteBytesReadbackVerified:true,
    ownerSignedGrantId:decision.grantId,
    cloudProvider:'OWNER_APPROVED_NATIVE_PROVIDER',
    originalStillLocalVerified:true,
    sourceCanonical:false,localSyncFolderDoesNotProveCloud:true};
  }catch(error){
   return follow('ORION_MIRROR_REMOTE_EXCEPTION_PRESERVED:'+String(error.message||error).slice(0,130));
  }
 }
 status(){
  const rows=this.tasks.list().filter(x=>x.kind===KIND);
  const counts={};for(const r of rows)counts[r.status]=(counts[r.status]||0)+1;
  return {schema:'orion-office-cloud-mirror-status/1.0',
   tasks:rows.length,counts,providerConnected:!!this.provider,
   lastKnownCloudVerified:rows.filter(t=>t.status==='COMPLETE'&&
    this.tasks.readArchivedTask(t.id)?.lastResult?.remoteBytesReadbackVerified===true).length,
   provisionedCloudScope:this.authority.status?.().reason||'UNAVAILABLE',
   noCloudConfirmationWithoutRemoteReadback:true};
 }
}
module.exports={OrionOfficeMirrorTaskLifecycle,KIND,CAPABILITY};
