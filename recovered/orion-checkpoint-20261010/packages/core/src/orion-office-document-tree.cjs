'use strict';
// Source-only first-party Orion: real document bytes within the owned SSD tree.
// Folders mirror authoritative Chapter/Scroll identities; they do not mint agents.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const token=(v,label)=>{const s=String(v||'');if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(s)||s==='..')throw Error(label+'_INVALID');return s;};
const within=(f,root)=>f===root||f.startsWith(root+path.sep);
class OrionOfficeDocumentTree {
 constructor({root,crewHouse,allowedSourceRoots=[],verifyLegacyStewardship,
  maxDocumentBytes=8*1024*1024}={}){
  if(!root||!crewHouse)throw Error('OFFICE_DOCUMENT_AUTHORITY_REQUIRED');
  this.crew=crewHouse;this.verifyLegacyStewardship=verifyLegacyStewardship;
  this.root=path.resolve(root,'orion-office-documents');
  this.journal=path.join(this.root,'document-events.jsonl');
  this.allowedRoots=allowedSourceRoots.map(x=>fs.realpathSync(path.resolve(x)));
  this.maxDocumentBytes=maxDocumentBytes;fs.mkdirSync(this.root,{recursive:true});
 }
 location({chapterNumber,perceptionPointId,scrollNumber=null}={}){
  const id=token(chapterNumber,'CHAPTER'),pp=token(perceptionPointId,'POINT');
  const chapters=new Map(this.crew.chapterBook().chapters.map(c=>[c.chapterNumber,c]));
  const chain=[],seen=new Set();let cursor=id;
  while(cursor){
   if(seen.has(cursor))throw Error('OFFICE_DOCUMENT_CHAPTER_CYCLE');
   seen.add(cursor);const c=chapters.get(cursor);
   if(!c)throw Error('OFFICE_DOCUMENT_UNKNOWN_CHAPTER');
   chain.unshift(c);cursor=c.parentChapterNumber||null;
  }
  const labels=chain.map(c=>'Chapter '+token(c.chapterNumber,'CHAPTER')+' - '+
   token(String(c.name||'Office').replace(/[^A-Za-z0-9._-]/g,'-').slice(0,64)||'Office','OFFICE_LABEL'));
  const base=path.join(this.root,...labels,'Perception Points',pp);
  let pledge=null,folder=base;
  if(scrollNumber!==null){
   pledge=this.crew.scrollBook().pledges.find(p=>p.scrollNumber===token(scrollNumber,'SCROLL'));
   if(!pledge)throw Error('OFFICE_DOCUMENT_UNKNOWN_SCROLL');
   const ppLinks=[...(pledge.metadata?.stewardedPerceptionPointIds||[]),
    pledge.metadata?.originPerceptionPointId,pledge.managerOfPerceptionPointId];
   if(!ppLinks.includes(pp)&&
    (typeof this.verifyLegacyStewardship!=='function'||
     this.verifyLegacyStewardship({pledge,chapterNumber:id,perceptionPointId:pp,
      authority:'READ_ONLY_CANONICAL_LEGACY_CUSTODY'})!==true))
    throw Error('OFFICE_DOCUMENT_SCROLL_LINEAGE_NOT_VERIFIED');
   folder=path.join(base,'Pledges','Scroll '+pledge.scrollNumber);
  }
  return {folder,labels,chapterLineage:chain.map(c=>c.chapterNumber),pledge,pp,chapterNumber:id};
 }
 events(){
  if(!fs.existsSync(this.journal))return [];
  const rows=fs.readFileSync(this.journal,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
  let prev=null;
  for(const row of rows){
   const {eventHash,...unsigned}=row;
   if(unsigned.previousHash!==prev||sha(Buffer.from(JSON.stringify(unsigned)))!==eventHash)
    throw Error('OFFICE_DOCUMENT_EVENT_CHAIN_INVALID_PRESERVED');
   prev=eventHash;
  }
  return rows;
 }
 readback(data){
  const p=path.resolve(this.root,data.relativePath),root=fs.realpathSync(this.root);
  if(!within(p,path.resolve(this.root)))throw Error('OFFICE_DOCUMENT_PATH_ESCAPE');
  const real=fs.realpathSync(p);
  if(!within(real,root))throw Error('OFFICE_DOCUMENT_SYMLINK_ESCAPE');
  const bytes=fs.readFileSync(real);
  if(bytes.length!==data.byteLength||sha(bytes)!==data.sha256)
   throw Error('OFFICE_DOCUMENT_BYTES_TAMPERED_PRESERVED');
  return {bytes,sourceSha256:data.sha256,verified:true};
 }
 save({chapterNumber,perceptionPointId,scrollNumber=null,documentId,content,
  sourceLocator,origin='EXTERNAL_UNPROCESSED',classification='SOURCE_COPY'}={}){
  if(!['EXTERNAL_UNPROCESSED','ORION_AUTHORED','IMPORTED_ARCHIVE'].includes(origin))
   throw Error('OFFICE_DOCUMENT_ORIGIN_INVALID');
  if(!['SOURCE_COPY','CHECKPOINT','FROZEN_MOMENT','CONTRADICTION','SCROLL_MEMORY','DERIVED'].includes(classification))
   throw Error('OFFICE_DOCUMENT_CLASS_INVALID');
  if(!String(sourceLocator||'').trim())throw Error('OFFICE_DOCUMENT_SOURCE_REQUIRED');
  const id=token(documentId,'DOCUMENT');
  const loc=this.location({chapterNumber,perceptionPointId,scrollNumber});
  const bytes=Buffer.isBuffer(content)?content:Buffer.from(String(content??''),'utf8');
  if(!bytes.length||bytes.length>this.maxDocumentBytes)throw Error('OFFICE_DOCUMENT_BYTES_INVALID');
  const digest=sha(bytes),prior=this.events().find(e=>e.kind==='DOCUMENT_STORED'&&
   e.data.documentId===id&&e.data.sha256===digest&&
   e.data.chapterNumber===loc.chapterNumber&&e.data.perceptionPointId===loc.pp&&
   e.data.scrollNumber===(loc.pledge?.scrollNumber||null));
  if(prior){this.readback(prior.data);return {created:false,receipt:prior};}
  const dir=path.join(loc.folder,'Documents',id);
  fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,digest+'.bin');
  try{fs.writeFileSync(file,bytes,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
  if(sha(fs.readFileSync(file))!==digest)throw Error('OFFICE_DOCUMENT_WRITE_READBACK_MISMATCH');
  const data={documentId:id,chapterNumber:loc.chapterNumber,chapterLineage:loc.chapterLineage,
   folderLabels:loc.labels,perceptionPointId:loc.pp,scrollNumber:loc.pledge?.scrollNumber||null,
   birthNumber:loc.pledge?.birthNumber||null,sourceLocator:String(sourceLocator),
   relativePath:path.relative(this.root,file).replace(/\\/g,'/'),
   sha256:digest,byteLength:bytes.length,origin,classification,
   ssdReadbackVerified:true,driveMirrorStatus:'PENDING_PROVIDER_BYTES_READBACK',
   agentCreatedBySavingDocument:false};
  const prev=this.events(),row={schema:'orion-office-document-event/1.0',
   eventId:crypto.randomUUID(),kind:'DOCUMENT_STORED',
   at:new Date().toISOString(),data,previousHash:prev.at(-1)?.eventHash||null};
  row.eventHash=sha(Buffer.from(JSON.stringify(row)));
  fs.appendFileSync(this.journal,JSON.stringify(row)+'\n');
  return {created:true,receipt:row};
 }
 importSource({sourcePath,...fields}={}){
  const real=fs.realpathSync(path.resolve(sourcePath||''));
  if(!this.allowedRoots.some(root=>within(real,root)))
   throw Error('OFFICE_DOCUMENT_IMPORT_OUTSIDE_AUTHORIZED_ROOT');
  const stat=fs.statSync(real);
  if(!stat.isFile()||stat.size===0||stat.size>this.maxDocumentBytes)
   throw Error('OFFICE_DOCUMENT_IMPORT_INVALID');
  return this.save({...fields,content:fs.readFileSync(real),
   sourceLocator:fields.sourceLocator||real,origin:'EXTERNAL_UNPROCESSED'});
 }
 inventory({perceptionPointId=null}={}){
  const rows=this.events().filter(e=>e.kind==='DOCUMENT_STORED'&&
   (perceptionPointId===null||e.data.perceptionPointId===perceptionPointId));
  return {documents:rows.map(x=>{this.readback(x.data);return x.data;}),
   bytesLocallyVerified:true,driveMirrorVerified:false,processesStartedByIndexing:0};
 }
}
module.exports={OrionOfficeDocumentTree};
