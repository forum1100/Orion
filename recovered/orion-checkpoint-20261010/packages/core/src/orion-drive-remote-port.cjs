'use strict';
// Owner-directed replacement for all formerly GitHub-based remote functions.
// Historical GitHub provenance is not a runtime transport or owner credential.
// Runtime provider registration requires signed owner scope and authenticated
// Google Drive remote byte readback; absent provider, fail closed.
const DRIVE_REPOSITORY_FOLDER_ID='1UY4yG6Q8b2wv1yo1vEt2X9rp62LVT4ul';
const DRIVE_OFFICE_FOLDER_ID='1lB1z6vC6iMqIKMU-qqISo5SMZwzvANiI';
const GOOGLE_DRIVE_REMOTE_KIND='GOOGLE_DRIVE_PRIMARY_REMOTE';
class OrionDriveRemotePort {
 constructor({provider=null,verifyOwnerScope=null,repoFolderId=DRIVE_REPOSITORY_FOLDER_ID}={}){
  if(repoFolderId!==DRIVE_REPOSITORY_FOLDER_ID)
   throw Error('ORION_REMOTE_REPOSITORY_ROOT_UNRECOGNIZED');
  this.provider=provider;
  this.verifyOwnerScope=verifyOwnerScope;
  this.rootFolderId=repoFolderId;
 }
 connected(){
  return Boolean(this.provider?.rootFolderId===this.rootFolderId&&
   typeof this.provider.readBytes==='function'&&
   typeof this.provider.writeBytes==='function'&&
   typeof this.provider.listChildren==='function'&&
   typeof this.verifyOwnerScope==='function');
 }
 assertAuthorized(action,context){
  if(!this.connected())throw Error('ORION_GOOGLE_DRIVE_REMOTE_NOT_CONNECTED');
  if(this.verifyOwnerScope({action,context,rootFolderId:this.rootFolderId})!==true)
   throw Error('ORION_GOOGLE_DRIVE_REMOTE_OWNER_SCOPE_NOT_VERIFIED');
 }
 async list(path,context){
  this.assertAuthorized('REPOSITORY_READ',context);
  const out=await this.provider.listChildren({rootFolderId:this.rootFolderId,path});
  if(!Array.isArray(out))throw Error('ORION_GOOGLE_DRIVE_REMOTE_LIST_INVALID');
  return out;
 }
 async read(path,context){
  this.assertAuthorized('REPOSITORY_READ',context);
  const bytes=await this.provider.readBytes({rootFolderId:this.rootFolderId,path});
  if(!Buffer.isBuffer(bytes))throw Error('ORION_GOOGLE_DRIVE_REMOTE_BYTES_REQUIRED');
  return Buffer.from(bytes);
 }
 async write(path,bytes,context){
  this.assertAuthorized('REPOSITORY_WRITE',context);
  if(!Buffer.isBuffer(bytes)||bytes.length>128*1024*1024||bytes.length===0)
   throw Error('ORION_GOOGLE_DRIVE_REMOTE_PAYLOAD_INVALID');
  const crypto=require('node:crypto');
  const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
  const expected=hash(bytes);
  const receipt=await this.provider.writeBytes({
   rootFolderId:this.rootFolderId,path,bytes:Buffer.from(bytes),sha256:expected
  });
  if(!receipt?.fileId)throw Error('ORION_GOOGLE_DRIVE_REMOTE_FILE_ID_MISSING');
  const remote=await this.provider.readBytes({
   rootFolderId:this.rootFolderId,path,fileId:receipt.fileId
  });
  if(!Buffer.isBuffer(remote)||hash(remote)!==expected||
   remote.length!==bytes.length)
   throw Error('ORION_GOOGLE_DRIVE_REMOTE_READBACK_MISMATCH');
  return {verified:true,fileId:receipt.fileId,sha256:expected,
   remoteByteReadbackVerified:true,provider:'GOOGLE_DRIVE',
   remoteRootFolderId:this.rootFolderId};
 }
 status(){return {provider:'GOOGLE_DRIVE',rootFolderId:this.rootFolderId,
  connected:this.connected(),githubEnabled:false,
  cloudReadbackRequired:true,localDriveSyncNotAuthoritative:true};}
}
module.exports={OrionDriveRemotePort,
 DRIVE_REPOSITORY_FOLDER_ID,DRIVE_OFFICE_FOLDER_ID,GOOGLE_DRIVE_REMOTE_KIND};
