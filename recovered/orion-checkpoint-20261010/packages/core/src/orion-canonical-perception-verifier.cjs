'use strict';
// Read-only, bounded canonical Perception Point verification for pre-stewardship
// CrewHouse records. Never creates a PP, changes old Scrolls or assigns a new
// Birth Number. A valid source observation is NOT an executable permission.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class OrionCanonicalPerceptionVerifier{
 constructor({root,maxBytes=1024*1024*1024}={}){
  if(!root)throw Error('ORION_PP_CANONICAL_ROOT_REQUIRED');
  this.root=path.resolve(root);
  this.points=path.join(this.root,'perception-memory','perception-points.jsonl');
  this.maxBytes=maxBytes;this.cached=new Map();
 }
 verifyPoint(id){
  if(typeof id!=='string'||!uuid.test(id))return {verified:false,reason:'PP_ID_FORMAT_UNSUPPORTED'};
  if(!fs.existsSync(this.points))return {verified:false,reason:'CANONICAL_PP_RECORDS_MISSING'};
  const stat=fs.lstatSync(this.points);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>this.maxBytes)
   return {verified:false,reason:'CANONICAL_PP_FILE_UNSAFE_OR_TOO_LARGE'};
  const cache=this.cached.get(id);
  if(cache){
   const row=this.readAt(cache.offset,cache.length);
   if(row?.id===id&&row.perceptionHash===cache.perceptionHash&&this.validateRow(row))
    return {verified:true,id,perceptionHash:row.perceptionHash,
     sourceEventId:row.sourceEventId,sourceClass:row.sourceClass,
     originalObservedAt:row.observedAt,registryProof:'EXACT_CANONICAL_PP_BYTES_READBACK',
     createdStewardship:false};
   this.cached.delete(id);
   return {verified:false,reason:'CANONICAL_PP_CACHED_BYTES_CHANGED'};
  }
  let fd=null,pos=0,pending=Buffer.alloc(0);
  const chunk=Buffer.allocUnsafe(128*1024);
  try{
   fd=fs.openSync(this.points,'r');
   while(pos<stat.size){
    const n=fs.readSync(fd,chunk,0,Math.min(chunk.length,stat.size-pos),pos);
    if(!n)break;
    const data=Buffer.concat([pending,chunk.subarray(0,n)]);
    const base=pos-pending.length;let cursor=0,end;
    while((end=data.indexOf(10,cursor))!==-1){
     const raw=data.subarray(cursor,end);
     const offset=base+cursor;cursor=end+1;
     if(raw.length>1024*1024)throw Error('ORION_PP_CANONICAL_ROW_TOO_LARGE');
     if(!raw.includes(Buffer.from(id)))continue;
     let row;
     try{row=JSON.parse(raw.toString('utf8'));}catch{continue;}
     if(row.id!==id)continue;
     if(!this.validateRow(row))return {verified:false,reason:'CANONICAL_PP_HASH_INVALID'};
     this.cached.set(id,{offset,length:raw.length,perceptionHash:row.perceptionHash});
     return {verified:true,id,perceptionHash:row.perceptionHash,
      sourceEventId:row.sourceEventId,sourceClass:row.sourceClass,
      originalObservedAt:row.observedAt,registryProof:'EXACT_CANONICAL_PP_BYTES_READBACK',
      createdStewardship:false};
    }
    pending=Buffer.from(data.subarray(cursor));
    if(pending.length>1024*1024)throw Error('ORION_PP_CANONICAL_ROW_BUDGET_EXCEEDED');
    pos+=n;
   }
   return {verified:false,reason:'PP_NOT_REGISTERED_IN_CANONICAL_SOURCE'};
  }finally{if(fd!==null)fs.closeSync(fd);}
 }
 readAt(offset,length){
  if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||length<=0||length>1024*1024)
   return null;
  const fd=fs.openSync(this.points,'r'),b=Buffer.alloc(length);
  try{if(fs.readSync(fd,b,0,length,offset)!==length)return null;
   return JSON.parse(b.toString('utf8'));
  }catch{return null;}finally{fs.closeSync(fd);}
 }
 validateRow(row){
  if(!row||row.schema!=='dt-perception-point/1.0'||!uuid.test(row.id||'')||
   typeof row.perceptionHash!=='string'||!row.sourceEventHash)return false;
  const {perceptionHash,...raw}=row;
  return sha(JSON.stringify(raw))===perceptionHash;
 }
}
module.exports={OrionCanonicalPerceptionVerifier};
