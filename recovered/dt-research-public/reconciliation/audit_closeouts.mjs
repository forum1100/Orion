#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const [,, sourceDir, closeoutRoot, outPath='closeout_reconciliation.json']=process.argv;
if(!sourceDir||!closeoutRoot){console.error('Usage: node audit_closeouts.mjs <canonical-export-dir> <closeout-root> [report.json]');process.exit(2);}
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function walk(root){const out=[];for(const e of fs.readdirSync(root,{withFileTypes:true})){const p=path.join(root,e.name);if(e.isDirectory())out.push(...walk(p));else out.push(p);}return out;}
const sourcePaths=walk(sourceDir).filter(p=>/^conversations(?:-\d+)?\.json$/i.test(path.basename(p)));
const byConversation=new Map(),sources=[];
for(const p of sourcePaths){
 const bytes=fs.readFileSync(p),data=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,'')),rows=Array.isArray(data)?data:[data];
 sources.push({path:p,name:path.basename(p),bytes:bytes.length,sha256:sha(bytes),conversations:rows.length});
 rows.forEach((c,index)=>{const id=c?.id??c?.conversation_id;if(id)byConversation.set(id,{source_path:p,source_file:path.basename(p),array_index:index,conversation:c});});
}
const manifestPaths=walk(closeoutRoot).filter(p=>/DT_CLOSEOUT.*PROVENANCE_MANIFEST\.json$/i.test(path.basename(p)));
const manifests=[];
for(const full of manifestPaths){
 try{
  const m=JSON.parse(fs.readFileSync(full,'utf8').replace(/^\uFEFF/,''));
  const id=m.conversation_id??m.conversation?.conversation_id??null,src=id?byConversation.get(id):null;
  const declaredFile=m.canonical_source?.source_file??m.canonical_source?.file_name??m.canonical_source_file??null;
  const declaredIndex=m.canonical_source?.conversation_array_index??m.canonical_source?.source_conversation_index??m.conversation?.source_array_index??m.source_conversation_index??null;
  const declaredSha=m.canonical_source?.source_file_sha256??m.canonical_source?.sha256_recomputed??m.canonical_source?.sha256??null;
  const actualSource=sources.find(s=>s.name===src?.source_file);
  manifests.push({manifest_path:full,manifest:path.basename(full),conversation_id:id,title:m.title??m.conversation?.title??m.conversation_title??null,
   declared_source_file:declaredFile,declared_array_index:declaredIndex,declared_source_sha256:declaredSha,source_found:Boolean(src),actual_source_file:src?.source_file??null,actual_array_index:src?.array_index??null,
   source_file_agrees:src&&declaredFile?declaredFile===src.source_file:null,index_agrees:src&&declaredIndex!==null?Number(declaredIndex)===src.array_index:null,
   source_hash_agrees:actualSource&&declaredSha?actualSource.sha256===declaredSha:null,gaps_reported:Array.isArray(m.gaps)?m.gaps.length:null,
   status:!id?'MANIFEST_ID_MISSING':src?'SOURCE_LOCATED':'AWAITING_CANONICAL_SOURCE'});
 }catch(e){manifests.push({manifest_path:full,manifest:path.basename(full),status:'MANIFEST_PARSE_ERROR',error:String(e)});}
}const report={generated_at:new Date().toISOString(),source_dir:sourceDir,closeout_root:closeoutRoot,
 source_files:sources,canonical_conversation_count:byConversation.size,manifest_count:manifests.length,
 source_located_count:manifests.filter(x=>x.source_found).length,
 awaiting_source_count:manifests.filter(x=>x.status==='AWAITING_CANONICAL_SOURCE').length,
 parse_error_count:manifests.filter(x=>x.status==='MANIFEST_PARSE_ERROR').length,
 source_file_disagreement_count:manifests.filter(x=>x.source_file_agrees===false).length,
 source_index_disagreement_count:manifests.filter(x=>x.index_agrees===false).length,
 source_hash_disagreement_count:manifests.filter(x=>x.source_hash_agrees===false).length,manifests};
fs.writeFileSync(outPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({canonical_sources:sourcePaths.length,canonical_conversations:byConversation.size,
 closeout_manifests:manifests.length,source_located:report.source_located_count,awaiting_source:report.awaiting_source_count,
 parse_errors:report.parse_error_count,source_file_disagreements:report.source_file_disagreement_count,
 source_index_disagreements:report.source_index_disagreement_count,source_hash_disagreements:report.source_hash_disagreement_count,report:outPath},null,2));