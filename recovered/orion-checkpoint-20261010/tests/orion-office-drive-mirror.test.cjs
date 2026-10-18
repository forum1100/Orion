'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {OrionCrewHouse}=require('../packages/core/src/orion-crew-house.cjs');
const {OrionOfficeDocumentTree}=require('../packages/core/src/orion-office-document-tree.cjs');
const {OrionOfficeDriveMirror}=require('../packages/core/src/orion-office-drive-mirror.cjs');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'orion-drive-mirror-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const crew=new OrionCrewHouse({root});
 crew.registerChapter({chapterNumber:'0032',name:'Source Office'});
 crew.registerChapter({chapterNumber:'0033',name:'Child',parentChapterNumber:'0032'});
 const tree=new OrionOfficeDocumentTree({root,crewHouse:crew});
 const saved=tree.save({chapterNumber:'0033',perceptionPointId:'PP1',
  documentId:'source',sourceLocator:'drive://owner/source-original',
  content:Buffer.from('exact immutable bytes of source\n')});
 return {root,tree,saved:saved.receipt};
}
test('provider mirror requires real remote bytes readback and retains nested Office path',async t=>{
 const {root,tree,saved}=fixture(t);let uploads=0;
 const remote=new Map();
 const provider={putDocument:async data=>{uploads++;remote.set('file-1',Buffer.from(data.bytes));
  assert.equal(data.destination[0],'Chapter 0032 - Source-Office');
  assert.equal(data.destination[1],'Chapter 0033 - Child');
  return {fileId:'file-1'};},
 readDocumentBytes:async({fileId})=>remote.get(fileId)};
 const mirror=new OrionOfficeDriveMirror({root,documentTree:tree,provider,
  verifyDriveScope:({authority})=>authority==='owner-delegated'});
 const got=await mirror.mirror(saved,{authority:'owner-delegated'});
 assert.equal(got.mirrored,true);assert.equal(got.receipt.data.providerReadbackVerified,true);
 assert.equal((await mirror.mirror(saved,{authority:'owner-delegated'})).alreadyVerified,true);
 assert.equal(uploads,1);
 assert.ok(fs.existsSync(path.join(tree.root,saved.data.relativePath)));
});
test('mirror lacking owner permission or provider byte equality never claims Drive verification',async t=>{
 const {root,tree,saved}=fixture(t);
 const provider={putDocument:async()=>({fileId:'f'}),readDocumentBytes:async()=>Buffer.from('wrong')};
 const mirror=new OrionOfficeDriveMirror({root,documentTree:tree,provider,
  verifyDriveScope:({authority})=>authority==='allowed'});
 await assert.rejects(()=>mirror.mirror(saved,{authority:'denied'}),/NOT_AUTHORIZED/);
 await assert.rejects(()=>mirror.mirror(saved,{authority:'allowed'}),/REMOTE_BYTES_MISMATCH/);
 assert.equal(mirror.rows().filter(e=>e.kind==='DRIVE_BYTES_VERIFIED').length,0);
 assert.equal(mirror.rows().filter(e=>e.kind==='DRIVE_MIRROR_FAILED_PRESERVED').length,1);
 assert.equal(tree.inventory().documents.length,1);
});
