#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
const [,, archivePath] = process.argv;
if (!archivePath) { console.error('Usage: node digest_closeout_archive.mjs <archive.jsonl>'); process.exit(2); }
const all=fs.readFileSync(archivePath,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
const rows=all.filter(r=>r.source_class==='CANONICAL_HISTORY_SOURCE');
const meta=r=>r.canonical_metadata??r.message_metadata??{};
const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
const digest=v=>crypto.createHash('sha256').update(stable(v),'utf8').digest('hex');
const core=rows.map(r=>({node_id:r.node_id,message_id:r.message_id,parent_node_id:r.parent_node_id,create_time:r.create_time,original_role:r.original_role,content_type:r.content_type,text_sha256:r.text_sha256}));
const compact=rows.map((r,i)=>({...core[i],canonical_metadata:meta(r)}));
const full=rows.map((r,i)=>({...core[i],canonical_content:r.canonical_content,canonical_metadata:meta(r)}));
const contentRows=rows.filter(r=>r.canonical_content!==undefined).length;
console.log(JSON.stringify({archive:archivePath,total_records:all.length,canonical_records:rows.length,live_or_other_records:all.length-rows.length,canonical_content_records:contentRows,
  core_sha256:digest(core),compact_sha256:digest(compact),full_sha256:contentRows===rows.length?digest(full):null},null,2));