'use strict';
// Provider-neutral, source-only Drive-mirror adapter. Does not run unless Orion
// supplies authorized provider put/read capabilities with exact byte readback.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
class OrionOfficeDriveMirror {
 constructor({root,documentTree,provider,verifyDriveScope}={}){
  if(!root||!documentTree)throw Error('OFFICE_DRIVE_MIRROR_CONTEXT_REQUIRED');
  this.root=path.resolve(root,'orion-office-drive-mirror');
  this.journal=path.join(this.root,'mirror-events.jsonl');
  this.tree=documentTree;this.provider=provider;this.verifyDriveScope=verifyDriveScope;
  fs.mkdirSync(this.root,{recursive:true});
 }
 rows(){
  if(!fs.existsSync(this.journal))return [];
  const r=fs.readFileSync(this.journal,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
  let prev=null;
  for(const item of r){
   const {eventHash,...payload}=item;
   if(payload.previousHash!==prev||sha(Buffer.from(JSON.stringify(payload)))!==eventHash)
    throw Error('OFFICE_DRIVE_MIRROR_CHAIN_INVALID_PRESERVED');
   prev=eventHash;
  }
  return r;
 }
 record(kind,data){
  const rows=this.rows(),event={schema:'orion-office-drive-mirror/1.0',
   eventId:crypto.randomUUID(),kind,at:new Date().toISOString(),data,
   previousHash:rows.at(-1)?.eventHash||null};
  event.eventHash=sha(Buffer.from(JSON.stringify(event)));
  fs.appendFileSync(this.journal,JSON.stringify(event)+'\n');
  return event;
 }
 async mirror(receipt,{authority}={}){
  if(!receipt||receipt.kind!=='DOCUMENT_STORED')throw Error('OFFICE_MIRROR_DOCUMENT_RECEIPT_REQUIRED');
  const doc=receipt.data;
  const verifiedLocal=this.tree.readback(doc);
  if(typeof this.verifyDriveScope!=='function'||this.verifyDriveScope({
   authority,chapterLineage:doc.chapterLineage,perceptionPointId:doc.perceptionPointId,
   sourceClass:doc.classification,action:'ORION_MIRROR_DOCUMENT'})!==true)
   throw Error('OFFICE_MIRROR_OWNER_SCOPE_NOT_AUTHORIZED');
  if(!this.provider||typeof this.provider.putDocument!=='function'||
   typeof this.provider.readDocumentBytes!=='function')
   throw Error('OFFICE_MIRROR_PROVIDER_READBACK_NOT_AVAILABLE');
  // Historical cloud confirmation is not evidence that bytes remain in
  // the remote account. Re-read even after a prior successful upload.
  const previous=this.rows().findLast(e=>e.kind==='DRIVE_BYTES_VERIFIED'&&
   e.data.sha256===doc.sha256&&e.data.relativePath===doc.relativePath);
  if(previous){
   try{
    const remote=await this.provider.readDocumentBytes({fileId:previous.data.remoteFileId});
    if(Buffer.isBuffer(remote)&&remote.length===doc.byteLength&&sha(remote)===doc.sha256)
     return {mirrored:true,alreadyVerified:true,receipt:previous,
      currentRemoteBytesReadbackVerified:true};
    this.record('DRIVE_REMOTE_STALE_PRESERVED',{sha256:doc.sha256,
     relativePath:doc.relativePath,remoteFileId:previous.data.remoteFileId,
     reason:'REMOTE_BYTES_MISSING_OR_DIFFERENT'});
   }catch(error){
    this.record('DRIVE_REMOTE_STALE_PRESERVED',{sha256:doc.sha256,
     relativePath:doc.relativePath,remoteFileId:previous.data.remoteFileId,
     reason:'REMOTE_READBACK_UNAVAILABLE'});
   }
  }
  const destination=[...doc.folderLabels,'Perception Points',doc.perceptionPointId,
   ...(doc.scrollNumber?['Pledges','Scroll '+doc.scrollNumber]:[]),'Documents',doc.documentId];
  this.record('DRIVE_MIRROR_REQUESTED',{sha256:doc.sha256,relativePath:doc.relativePath,
   destination,sourceLocator:doc.sourceLocator});
  try{
   const stored=await this.provider.putDocument({bytes:verifiedLocal.bytes,
    sha256:doc.sha256,destination,privacy:'OWNER_CONTROLLED_PRIVATE',
    originalSourceLocator:doc.sourceLocator,sourceClass:doc.classification});
   if(!stored?.fileId)throw Error('OFFICE_MIRROR_PROVIDER_ID_MISSING');
   const actual=await this.provider.readDocumentBytes({fileId:stored.fileId});
   if(!Buffer.isBuffer(actual)||actual.length!==doc.byteLength||sha(actual)!==doc.sha256)
    throw Error('OFFICE_MIRROR_REMOTE_BYTES_MISMATCH');
   const event=this.record('DRIVE_BYTES_VERIFIED',{sha256:doc.sha256,
    relativePath:doc.relativePath,remoteFileId:String(stored.fileId),destination,
    byteLength:doc.byteLength,sourceLocator:doc.sourceLocator,
    providerReadbackVerified:true,sourceCanonical:false,
    originalDataPreservedOnSSD:true});
   return {mirrored:true,alreadyVerified:false,receipt:event};
  }catch(e){
   this.record('DRIVE_MIRROR_FAILED_PRESERVED',{sha256:doc.sha256,
    relativePath:doc.relativePath,reason:e.message});
   throw e;
  }
 }
}
module.exports={OrionOfficeDriveMirror};
