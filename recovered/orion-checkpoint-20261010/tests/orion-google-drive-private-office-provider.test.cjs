'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {OrionGoogleDrivePrivateOfficeProvider:Provider,
 PRIVATE_OFFICE_ROOT_ID:ROOT,OLD_SHARED_ROOT}=require('../packages/core/src/orion-google-drive-private-office-provider.cjs');
const FOLDER='application/vnd.google-apps.folder';
const good=b=>crypto.createHash('sha256').update(b).digest('hex');
const owner=()=>[{type:'user',role:'owner'}];
function backend(){
 let next=0,uploads=0,calls=0;
 const entries=new Map([[ROOT,{id:ROOT,name:'Private staging',mimeType:FOLDER,
   permissions:owner(),shared:false,trashed:false,parents:['1UY4yG6Q8b2wv1yo1vEt2X9rp62LVT4ul']}]]);
 const data=new Map();
 const fid=()=> 'orionPrivateFixture'+(++next)+'44444';
 async function fetchImpl(url,opts){
  calls++;
  assert.equal(opts.headers.authorization,'Bearer official-consented-token-for-tests');
  assert.equal(opts.redirect,'error');
  const u=new URL(url),p=u.pathname,id=p.split('/').at(-1);
  if(opts.method==='GET'&&p==='/drive/v3/files'){
   const q=u.searchParams.get('q'),parent=q.match(/^'([^']+)' in parents/)?.[1],
    name=q.match(/name = '([^']+)'/)?.[1];
   const files=[...entries.values()].filter(f=>f.parents?.includes(parent)&&f.name===name);
   return Response.json({files});
  }
  if(opts.method==='GET'&&p.startsWith('/drive/v3/files/')){
   if(!entries.has(id))return new Response('missing',{status:404});
   if(u.searchParams.get('alt')==='media'){
    if(!data.has(id))return new Response('missing',{status:404});
    return new Response(data.get(id));
   }
   return Response.json(entries.get(id));
  }
  if(opts.method==='POST'&&p==='/drive/v3/files'){
   const payload=JSON.parse(opts.body),newId=fid();
   const m={...payload,id:newId,permissions:owner(),shared:false,trashed:false};
   entries.set(newId,m);
   return Response.json({id:newId,mimeType:FOLDER});
  }
  if(opts.method==='POST'&&p==='/upload/drive/v3/files'){
   uploads++;
   const body=Buffer.from(opts.body).toString('utf8');
   const start=body.indexOf('\r\n\r\n')+4,end=body.indexOf('\r\n--',start);
   const info=JSON.parse(body.slice(start,end)),newId=fid();
   const contents=Buffer.from('qualified-source-data');
   assert.ok(Buffer.from(opts.body).includes(contents));
   const m={...info,id:newId,permissions:owner(),shared:false,trashed:false};
   entries.set(newId,m);data.set(newId,contents);
   return Response.json({id:newId,mimeType:m.mimeType,parents:m.parents});
  }
  return new Response('bad fixture route',{status:400});
 }
 const tokenProvider=async()=>({source:'OFFICIAL_GOOGLE_OAUTH_SESSION',
  accessToken:'official-consented-token-for-tests',expiresAt:Date.now()+60000});
 return {fetchImpl,tokenProvider,entries,data,stats:()=>({calls,uploads})};
}
function provider(b){return new Provider({fetchImpl:b.fetchImpl,tokenProvider:b.tokenProvider});}
function request(){
 const bytes=Buffer.from('qualified-source-data');
 return {bytes,sha256:good(bytes),privacy:'OWNER_CONTROLLED_PRIVATE',sourceClass:'SOURCE_COPY',
  destination:['Office 0001','Perception Points','pp-1','Documents','doc-1']};
}
test('historically shared Office root cannot be accepted, private verified ID is required',()=>{
 assert.throws(()=>new Provider({rootFolderId:OLD_SHARED_ROOT}),/PRIVATE_ROOT_NOT_APPROVED/);
 assert.throws(()=>new Provider({rootFolderId:'unapproved_folder'}),/PRIVATE_ROOT_NOT_APPROVED/);
});
test('no official OAuth credential cannot write or read; no network request',async()=>{
 const b=backend(),p=new Provider({fetchImpl:b.fetchImpl});
 await assert.rejects(p.putDocument(request()),/OFFICIAL_OAUTH_SESSION_MISSING/);
 assert.equal(b.stats().calls,0);
 assert.equal(p.status().releaseDeployed,false);
});
test('existing root with anyone-writer access fails before mutation',async()=>{
 const b=backend();b.entries.get(ROOT).permissions=[{type:'anyone',role:'writer'}];
 b.entries.get(ROOT).shared=true;
 await assert.rejects(provider(b).putDocument(request()),/PRIVATE_OWNER_SCOPE_NOT_VERIFIED/);
 assert.equal(b.stats().uploads,0);
});
test('missing privacy metadata fails closed before writing',async()=>{
 const b=backend();delete b.entries.get(ROOT).permissions;
 await assert.rejects(provider(b).putDocument(request()),/PRIVATE_OWNER_SCOPE_NOT_VERIFIED/);
 assert.equal(b.stats().uploads,0);
});
test('Drive API contract: create private ancestry, upload and remote-byte readback',async()=>{
 const b=backend(),p=provider(b),r=await p.putDocument(request());
 assert.equal(r.remoteByteReadbackVerified,true);
 assert.equal(r.sha256,request().sha256);
 assert.equal(r.approvedPrivateFolderId,ROOT);
 assert.equal(b.stats().uploads,1);
 assert.deepEqual(await p.readDocumentBytes({fileId:r.fileId}),request().bytes);
 const replay=await p.putDocument(request());
 assert.equal(replay.fileId,r.fileId);
 assert.equal(replay.alreadyVerified,true);
 assert.equal(b.stats().uploads,1);
});
test('unsafe content, path and class rejected without writing',async()=>{
 const b=backend(),p=provider(b);
 await assert.rejects(p.putDocument({...request(),sha256:'a'.repeat(64)}),/INTEGRITY/);
 await assert.rejects(p.putDocument({...request(),destination:['../../test','doc']}),/UNSAFE_FOLDER_LABEL/);
 await assert.rejects(p.putDocument({...request(),sourceClass:'EXECUTABLE'}),/SOURCE_CLASS/);
 await assert.rejects(p.putDocument({...request(),privacy:'PUBLIC'}),/PRIVATE_CUSTODY/);
 assert.equal(b.stats().uploads,0);
});
test('cannot read guessed file ID outside the private owner root',async()=>{
 const b=backend(),p=provider(b),id='fixtureOutsideOtherRoot444';
 b.entries.set(id,{id,name:'external',mimeType:'application/octet-stream',
  parents:['unapproved_other_root_xxx'],shared:false,permissions:owner()});
 await assert.rejects(p.readDocumentBytes({fileId:id}),/PROVIDER_HTTP_404/);
});
test('file-level anyone-writer permission blocks subsequent cloud reads',async()=>{
 const b=backend(),p=provider(b),r=await p.putDocument(request());
 b.entries.get(r.fileId).shared=true;
 b.entries.get(r.fileId).permissions=[{type:'anyone',role:'writer'}];
 await assert.rejects(p.readDocumentBytes({fileId:r.fileId}),/NODE_SHARED_OR_UNVERIFIED/);
});
test('tampered remote bytes prevent reuse or success',async()=>{
 const b=backend(),p=provider(b),r=await p.putDocument(request());
 b.data.set(r.fileId,Buffer.from('attacker-modified'));
 await assert.rejects(p.putDocument(request()),/EXISTING_BYTES_CONFLICT/);
 assert.equal(b.stats().uploads,1);
});
