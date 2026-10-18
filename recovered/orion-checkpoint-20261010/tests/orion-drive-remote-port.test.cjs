'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {OrionDriveRemotePort,DRIVE_REPOSITORY_FOLDER_ID,DRIVE_OFFICE_FOLDER_ID}
 =require('../packages/core/src/orion-drive-remote-port.cjs');
function mock(){
 const docs=new Map(),calls=[];
 const provider={rootFolderId:DRIVE_REPOSITORY_FOLDER_ID,
  listChildren:async query=>{calls.push(['list',query]);return [...docs.keys()].map(name=>({name}))},
  writeBytes:async query=>{calls.push(['write',query.path]);docs.set(query.path,Buffer.from(query.bytes));return {fileId:'owned:'+query.path}},
  readBytes:async query=>{calls.push(['read',query.path]);return docs.get(query.path)}};
 return {docs,calls,provider};
}
test('remote root is real designated Google Drive ID, not GitHub and not just local sync',()=>{
 const p=new OrionDriveRemotePort();
 assert.equal(p.status().rootFolderId,DRIVE_REPOSITORY_FOLDER_ID);
 assert.equal(p.status().githubEnabled,false);
 assert.equal(p.status().connected,false);
 assert.equal(p.status().localDriveSyncNotAuthoritative,true);
 assert.ok(DRIVE_OFFICE_FOLDER_ID.length>10);
});
test('Google Drive provider missing fails closed and cannot be spoofed by arbitrary folder ID',async()=>{
 const p=new OrionDriveRemotePort();
 await assert.rejects(()=>p.read('GIT_HISTORY/latest.bundle',{}),/NOT_CONNECTED/);
 await assert.rejects(()=>p.write('GIT_HISTORY/latest.bundle',Buffer.from('bytes'),{}),/NOT_CONNECTED/);
 assert.throws(()=>new OrionDriveRemotePort({repoFolderId:'other'}),/UNRECOGNIZED/);
});
test('signed scope and genuine provider readback required before remote write is marked verified',async()=>{
 const m=mock();
 const p=new OrionDriveRemotePort({provider:m.provider,verifyOwnerScope:
  ({action,context})=>context?.ownerSigned===true&&context.grantAction===action});
 await assert.rejects(()=>p.write('GIT_HISTORY/example.bundle',Buffer.from('original'),{}),
  /OWNER_SCOPE_NOT_VERIFIED/);
 assert.equal(m.calls.length,0);
 const context={ownerSigned:true,grantAction:'REPOSITORY_WRITE'};
 const row=await p.write('GIT_HISTORY/example.bundle',Buffer.from('original'),context);
 assert.equal(row.verified,true);assert.equal(row.provider,'GOOGLE_DRIVE');
 assert.equal(row.remoteByteReadbackVerified,true);
 assert.equal((await p.read('GIT_HISTORY/example.bundle',
  {ownerSigned:true,grantAction:'REPOSITORY_READ'})).toString(),'original');
 assert.equal((await p.list('GIT_HISTORY',{ownerSigned:true,grantAction:'REPOSITORY_READ'})).length,1);
});
test('remote readback mismatch or missing provider capabilities prevents success',async()=>{
 const m=mock();
 m.provider.readBytes=async()=>Buffer.from('wrong');
 const p=new OrionDriveRemotePort({provider:m.provider,verifyOwnerScope:()=>true});
 await assert.rejects(()=>p.write('source/file',Buffer.from('actual'),{}),/READBACK_MISMATCH/);
 assert.equal(new OrionDriveRemotePort({provider:{...m.provider,readBytes:null},
  verifyOwnerScope:()=>true}).connected(),false);
});
