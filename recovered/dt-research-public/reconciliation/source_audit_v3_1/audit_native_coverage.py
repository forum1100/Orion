#!/usr/bin/env python3
"""Compare native content and metadata without replacing legacy archives."""
import argparse,collections,datetime,hashlib,json,pathlib
HIDDEN={'thoughts','analysis'}
sha=lambda b:hashlib.sha256(b).hexdigest()
canon=lambda x:json.dumps(x,sort_keys=True,ensure_ascii=False,separators=(',',':'))
def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def rows(p):return [json.loads(x) for x in p.read_text(encoding='utf-8-sig').splitlines() if x.strip()]
def source_text(c):
 if not isinstance(c,dict) or c.get('content_type') in HIDDEN:return None
 if c.get('content_type')=='reasoning_recap':return c.get('content') if isinstance(c.get('content'),str) else None
 parts=c.get('parts');return ''.join(x for x in parts if isinstance(x,str)) if isinstance(parts,list) else None
def main():
 ap=argparse.ArgumentParser();ap.add_argument('source_dir',type=pathlib.Path);ap.add_argument('archive_dir',type=pathlib.Path);ap.add_argument('output_dir',type=pathlib.Path);a=ap.parse_args();a.output_dir.mkdir(parents=True,exist_ok=True)
 src={}
 for p in sorted(a.source_dir.glob('conversations-00[0-5].json')):
  for i,c in enumerate(load(p)):
   if isinstance(c,dict) and c.get('id'):src[c['id']]=(c,p,i)
 results=[];detail=[]
 for p in sorted(a.archive_dir.glob('*VERBATIM_CAUSAL_ARCHIVE*.jsonl')):
  rr=rows(p);ids={r.get('conversation_id') for r in rr if r.get('conversation_id')}
  if len(ids)!=1 or next(iter(ids)) not in src:continue
  cid=next(iter(ids));c,sp,ix=src[cid];mp=c['mapping'];groups=collections.defaultdict(list)
  for r in rr:
   if r.get('source_class') in (None,'CANONICAL_HISTORY_SOURCE') and r.get('node_id'):groups[r['node_id']].append(r)
  counts=collections.Counter();diffs=[]
  for nid,node in mp.items():
   m=node.get('message');group=groups.get(nid,[])
   if m is None:
    counts['structural_nodes']+=1
    if group:counts['structural_nodes_stored']+=1
    else:counts['structural_nodes_not_stored']+=1
    continue
   co=m.get('content') or {};kind=co.get('content_type')
   if kind in HIDDEN:
    counts['hidden_nodes']+=1
    if group:counts['hidden_structural_nodes_stored']+=1
    if any(r.get('text') not in (None,'') or r.get('canonical_content') is not None for r in group):diffs.append({'node_id':nid,'kind':'UNEXPECTED_HIDDEN_PAYLOAD'});counts['hidden_payload_issues']+=1
    continue
   counts['observable_nodes']+=1
   if not group:counts['observable_nodes_absent']+=1;diffs.append({'node_id':nid,'kind':'OBSERVABLE_NODE_ABSENT'});continue
   if len(group)>1:counts['duplicate_archive_nodes']+=1;diffs.append({'node_id':nid,'kind':'DUPLICATE_ARCHIVE_NODE'})
   exacttext=source_text(co);texts=[r.get('text') for r in group]
   if isinstance(exacttext,str):
    counts['observable_text_nodes']+=1
    if exacttext in texts:counts['observable_text_exact']+=1
    else:counts['observable_text_missing']+=1;diffs.append({'node_id':nid,'kind':'OBSERVABLE_TEXT_DIFFERENCE'})
   else:counts['nontext_observable_nodes']+=1
   if any(r.get('canonical_content')==co for r in group):counts['native_content_exact']+=1
   elif any('canonical_content' in r and r['canonical_content'] is not None for r in group):counts['native_content_different']+=1;diffs.append({'node_id':nid,'kind':'NATIVE_CONTENT_DIFFERENT'})
   else:counts['native_content_unstored']+=1
   expectedmeta=m.get('metadata') or {};stored=[]
   for r in group:
    for key in ('canonical_metadata','message_metadata','metadata'):
     if key in r and r[key] is not None:stored.append(r[key]);break
   if any(v==expectedmeta for v in stored):counts['metadata_exact']+=1
   elif stored:counts['metadata_different']+=1;diffs.append({'node_id':nid,'kind':'METADATA_DIFFERENT'})
   else:counts['metadata_unstored']+=1
  counts['source_nodes']=len(mp);counts['archive_records']=len(rr);counts['archive_noncanonical_records']=sum(r.get('source_class') not in (None,'CANONICAL_HISTORY_SOURCE') for r in rr)
  counts['source_native_content_reconstructable']=counts['native_content_unstored']+counts['native_content_exact']
  r={'conversation_id':cid,'source_file':sp.name,'source_index':ix,'source_sha256':sha(sp.read_bytes()),'archive_file':p.name,'archive_sha256':sha(p.read_bytes()),'counts':dict(counts),'status':'SOURCE_REFERENCE_AUDIT__NOT_FULL_BACKUP_CERTIFICATION','native_content_difference_count':counts['native_content_different'],'metadata_difference_count':counts['metadata_different'],'source_locator':f'{sp.name}#/conversation_index/{ix}'}
  results.append(r);detail.extend({'conversation_id':cid,'source_file':sp.name,'source_index':ix,**x} for x in diffs)
 summary={'schema':'DT_CLOSEOUT_NATIVE_COVERAGE_v1','generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Ten historical archive files; all source mapping nodes; no native attachment-byte certification','results':results,'totals':dict(sum((collections.Counter(r['counts']) for r in results),collections.Counter())),'difference_count':len(detail),'source_content_available':'All six verified Generation-2 source members; missing legacy native content can be referenced without overwriting original records','hidden_reasoning':'Original internal payloads not copied into reports','custody':'DERIVED_AUDIT_NOT_CANONICAL_PROMOTION'}
 (a.output_dir/'native_coverage_private.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
 (a.output_dir/'native_differences_private.json').write_text(json.dumps(detail,ensure_ascii=False,indent=2)+'\n')
 public={k:v for k,v in summary.items() if k!='results'}
 public['results']=[{k:v for k,v in r.items() if k not in ['conversation_id','source_locator','archive_file']} for r in results]
 (a.output_dir/'native_coverage_public.json').write_text(json.dumps(public,indent=2)+'\n')
 print(json.dumps({'historical_archives':len(results),'totals':summary['totals'],'differences':len(detail)},indent=2))
if __name__=='__main__':main()
