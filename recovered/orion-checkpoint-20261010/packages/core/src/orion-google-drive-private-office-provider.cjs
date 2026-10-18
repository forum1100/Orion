'use strict';
// Native Google Drive cloud transport for Orion Office custody.
// SOURCE-ONLY until a trusted host injects an official authenticated OAuth
// session and the owner-signed EXACT-folder external mutation grant.
// Never reads DriveFS credentials, caches bearer tokens, or accepts a public
// Drive folder as proof of private custody.
const crypto=require('node:crypto');
const ROOT='1DTF3yG9nUSydcVkLV-DVH2k0rS48xYQc';
const OLD_SHARED_ROOT='1lB1z6vC6iMqIKMU-qqISo5SMZwzvANiI';
const BASE='https://www.googleapis.com';
const FILE='application/vnd.google-apps.folder';
const MAX=16*1024*1024;
const sha=buf=>crypto.createHash('sha256').update(buf).digest('hex');
const isId=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{12,120}$/.test(s);
function segment(s){
 if(typeof s!=='string'||s.length<1||s.length>120||
    s!==s.trim()||s==='.'||s==='..'||/[\/\\\x00-\x1f:?*<>|"]/.test(s))
  throw Error('ORION_DRIVE_UNSAFE_FOLDER_LABEL');
 return s;
}
function privateNode(m){
 return Boolean(m&&m.shared===false&&m.trashed!==true&&
  Array.isArray(m.permissions)&&m.permissions.length===1&&
  m.permissions[0]?.type==='user'&&m.permissions[0]?.role==='owner');
}
function privateFolder(m){return Boolean(m&&m.mimeType===FILE&&privateNode(m));}
class OrionGoogleDrivePrivateOfficeProvider{
 constructor({rootFolderId=ROOT,tokenProvider=null,fetchImpl=globalThis.fetch,
    maxBytes=MAX}={}){
  if(rootFolderId!==ROOT||rootFolderId===OLD_SHARED_ROOT)
   throw Error('ORION_DRIVE_PRIVATE_ROOT_NOT_APPROVED');
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>MAX)
   throw Error('ORION_DRIVE_MAX_UPLOAD_BUDGET_INVALID');
  if(typeof fetchImpl!=='function')throw Error('ORION_DRIVE_FETCH_REQUIRED');
  this.rootFolderId=rootFolderId;
  this.tokenProvider=tokenProvider;this.fetchImpl=fetchImpl;this.maxBytes=maxBytes;
 }
 async api(method,endpoint,{params={},json=null,buffer=null,mime=null,raw=false}={}){
  if(typeof this.tokenProvider!=='function')
   throw Error('ORION_DRIVE_OFFICIAL_OAUTH_SESSION_MISSING');
  const session=await this.tokenProvider();
  if(session?.source!=='OFFICIAL_GOOGLE_OAUTH_SESSION'||
     typeof session.accessToken!=='string'||session.accessToken.length<12||
     (Number.isFinite(session.expiresAt)&&Date.now()>=session.expiresAt))
   throw Error('ORION_DRIVE_OFFICIAL_OAUTH_SESSION_INVALID');
  const url=new URL(endpoint,BASE);
  if(url.origin!==BASE)throw Error('ORION_DRIVE_ENDPOINT_NOT_GOOGLE');
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
  const headers={authorization:'Bearer '+session.accessToken};
  if(json!==null)headers['content-type']='application/json';
  if(buffer!==null)headers['content-type']=mime||'application/octet-stream';
  const res=await this.fetchImpl(url.toString(),{
   method,headers,redirect:'error',cache:'no-store',
   body:json!==null?JSON.stringify(json):buffer
  });
  if(!res||typeof res.ok!=='boolean')throw Error('ORION_DRIVE_BAD_PROVIDER_RESPONSE');
  if(!res.ok)throw Error('ORION_DRIVE_PROVIDER_HTTP_'+String(res.status));
  if(raw){
   const len=Number(res.headers?.get?.('content-length')||0);
   if(len>this.maxBytes)throw Error('ORION_DRIVE_REMOTE_BYTE_LIMIT');
   const bytes=Buffer.from(await res.arrayBuffer());
   if(bytes.length>this.maxBytes)throw Error('ORION_DRIVE_REMOTE_BYTE_LIMIT');
   return bytes;
  }
  const out=await res.json();
  if(!out||typeof out!=='object')throw Error('ORION_DRIVE_BAD_METADATA');
  return out;
 }
 async metadata(id){
  if(!isId(id))throw Error('ORION_DRIVE_BAD_FILE_ID');
  return this.api('GET','/drive/v3/files/'+encodeURIComponent(id),{
   params:{fields:'id,name,mimeType,parents,shared,permissions(type,role),trashed',supportsAllDrives:'true'}
  });
 }
 async assertPrivateRoot(){
  const m=await this.metadata(this.rootFolderId);
  if(m.id!==this.rootFolderId||m.trashed===true||!privateFolder(m))
   throw Error('ORION_DRIVE_PRIVATE_OWNER_SCOPE_NOT_VERIFIED');
  return m;
 }
 async assertPrivateLineage(id,{expectedParent=null}={}){
  await this.assertPrivateRoot();
  const seen=new Set();
  let current=id,depth=0;
  while(current!==this.rootFolderId){
   if(!isId(current)||seen.has(current)||++depth>24)
    throw Error('ORION_DRIVE_PARENT_LINEAGE_INVALID');
   seen.add(current);
   const m=await this.metadata(current);
   if(m.id!==current||m.trashed===true||!Array.isArray(m.parents)||m.parents.length!==1)
    throw Error('ORION_DRIVE_PARENT_LINEAGE_INVALID');
   if(expectedParent && current===id && m.parents[0]!==expectedParent)
    throw Error('ORION_DRIVE_PARENT_MISMATCH');
   if(!privateNode(m))
    throw Error('ORION_DRIVE_NODE_SHARED_OR_UNVERIFIED');
   current=m.parents[0];
  }
 }
 async findChild(parent,name){
  const q="'"+parent.replace(/'/g,"\\'")+"' in parents and name = '"+
   name.replace(/\\/g,'\\\\').replace(/'/g,"\\'")+"' and trashed = false";
  const result=await this.api('GET','/drive/v3/files',{
   params:{q,pageSize:'10',fields:'files(id,name,mimeType,parents,shared,permissions(type,role)),nextPageToken',
    supportsAllDrives:'true',includeItemsFromAllDrives:'true'}
  });
  if(!Array.isArray(result.files)||result.nextPageToken||result.files.length>1)
   throw Error('ORION_DRIVE_FOLDER_CHILD_AMBIGUOUS');
  return result.files[0]||null;
 }
 async ensureFolder(parent,label){
  segment(label);
  await this.assertPrivateLineage(parent);
  const found=await this.findChild(parent,label);
  if(found){
   if(!privateFolder(found)||found.parents?.length!==1||found.parents[0]!==parent)
    throw Error('ORION_DRIVE_EXISTING_FOLDER_NOT_PRIVATE');
   return found.id;
  }
  const created=await this.api('POST','/drive/v3/files',{
   json:{name:label,mimeType:FILE,parents:[parent]},params:{fields:'id,mimeType'}
  });
  if(!isId(created.id)||created.mimeType!==FILE)
   throw Error('ORION_DRIVE_CREATED_FOLDER_INVALID');
  const readback=await this.metadata(created.id);
  if(!privateFolder(readback)||readback.parents?.length!==1||readback.parents[0]!==parent)
   throw Error('ORION_DRIVE_CREATED_FOLDER_NOT_PRIVATE');
  return created.id;
 }
 async readDocumentBytes({fileId}={}){
  if(!isId(fileId)||fileId===this.rootFolderId)
   throw Error('ORION_DRIVE_DOCUMENT_ID_INVALID');
  await this.assertPrivateLineage(fileId);
  const m=await this.metadata(fileId);
  if(m.id!==fileId||m.trashed===true||m.mimeType===FILE)
   throw Error('ORION_DRIVE_REMOTE_FILE_NOT_REGULAR');
  return this.api('GET','/drive/v3/files/'+encodeURIComponent(fileId),
   {params:{alt:'media',supportsAllDrives:'true'},raw:true});
 }
 async putDocument({bytes,sha256,destination,privacy,sourceClass}={}){
  if(privacy!=='OWNER_CONTROLLED_PRIVATE')
   throw Error('ORION_DRIVE_PRIVATE_CUSTODY_REQUIRED');
  if(!['SOURCE_COPY','DERIVED','CHECKPOINT','FROZEN_MOMENT','CONTRADICTION','SCROLL_MEMORY'].includes(sourceClass))
   throw Error('ORION_DRIVE_SOURCE_CLASS_NOT_APPROVED');
  if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>this.maxBytes||
     !/^[a-f0-9]{64}$/i.test(String(sha256))||sha(bytes)!==sha256.toLowerCase())
   throw Error('ORION_DRIVE_PAYLOAD_INTEGRITY_FAILED');
  if(!Array.isArray(destination)||destination.length<2||destination.length>20)
   throw Error('ORION_DRIVE_DESTINATION_DEPTH_INVALID');
  const segments=destination.map(segment);
  await this.assertPrivateRoot();
  let parent=this.rootFolderId;
  for(const folder of segments.slice(0,-1))parent=await this.ensureFolder(parent,folder);
  const fileName=segments.at(-1)+'-'+sha256.slice(0,20)+'.bin';
  if(fileName.length>160)throw Error('ORION_DRIVE_FILENAME_TOO_LONG');
  const existing=await this.findChild(parent,fileName);
  if(existing){
   if(existing.parents?.length!==1||existing.parents[0]!==parent||existing.mimeType===FILE)
    throw Error('ORION_DRIVE_REMOTE_NAME_COLLISION');
   const prev=await this.readDocumentBytes({fileId:existing.id});
   if(prev.length!==bytes.length||sha(prev)!==sha256)
    throw Error('ORION_DRIVE_EXISTING_BYTES_CONFLICT');
   return {fileId:existing.id,alreadyVerified:true};
  }
  const boundary='orion_'+crypto.randomUUID().replace(/-/g,'');
  const meta=Buffer.from('--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+
   JSON.stringify({name:fileName,parents:[parent],mimeType:'application/octet-stream'})+
   '\r\n--'+boundary+'\r\nContent-Type: application/octet-stream\r\n\r\n');
  const end=Buffer.from('\r\n--'+boundary+'--\r\n');
  const wire=Buffer.concat([meta,bytes,end]);
  const uploaded=await this.api('POST','/upload/drive/v3/files',{
   params:{uploadType:'multipart',fields:'id,parents,mimeType'},
   buffer:wire,mime:'multipart/related; boundary='+boundary
  });
  if(!isId(uploaded.id)||uploaded.parents?.length!==1||uploaded.parents[0]!==parent)
   throw Error('ORION_DRIVE_UPLOAD_ID_OR_PARENT_INVALID');
  // API readback is the only cloud confirmation. Nothing about DriveFS cache
  // or a successfully accepted upload is considered sufficient.
  const remote=await this.readDocumentBytes({fileId:uploaded.id});
  if(remote.length!==bytes.length||sha(remote)!==sha256)
   throw Error('ORION_DRIVE_POST_UPLOAD_BYTES_MISMATCH');
  return {fileId:uploaded.id,remoteByteReadbackVerified:true,sha256,
   approvedPrivateFolderId:this.rootFolderId};
 }
 status(){
  return {schema:'orion-google-drive-private-office-provider/1.0',
   rootFolderId:this.rootFolderId,officialOauthSessionInjected:typeof this.tokenProvider==='function',
   independentlyCloudVerified:false,credentialsPersisted:false,
   releaseDeployed:false,oldSharedOfficeRootRejected:true};
 }
}
module.exports={OrionGoogleDrivePrivateOfficeProvider,PRIVATE_OFFICE_ROOT_ID:ROOT,OLD_SHARED_ROOT};
