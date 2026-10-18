#!/usr/bin/env python3
"""Index observable native asset references; do not substitute filenames for bytes."""
import argparse,collections,datetime,hashlib,json,pathlib,re
HIDDEN={'thoughts','analysis'}
sha=lambda b:hashlib.sha256(b).hexdigest()
def refs(v,path=''):
 if isinstance(v,dict):
  for k,x in v.items():
   p=path+'/'+k
   if k in ('asset_pointer','watermarked_asset_pointer') and isinstance(x,str) and x.startswith('sediment://file_'):yield x.split('/')[-1],p
   elif k=='id' and isinstance(x,str) and re.fullmatch(r'file[_-][A-Za-z0-9_-]+',x):yield x,p
   else:yield from refs(x,p)
 elif isinstance(v,list):
  for i,x in enumerate(v):yield from refs(x,path+'/'+str(i))
def main():
 ap=argparse.ArgumentParser();ap.add_argument('sources',type=pathlib.Path);ap.add_argument('asset_names',type=pathlib.Path);ap.add_argument('output',type=pathlib.Path);a=ap.parse_args();a.output.mkdir(parents=True,exist_ok=True)
 names=json.loads(a.asset_names.read_text());idx=collections.defaultdict(list)
 for n in range(6):
  p=a.sources/f'conversations-{n:03}.json'
  for j,c in enumerate(json.loads(p.read_text())):
   if not isinstance(c,dict) or not c.get('id'):continue
   for nid,node in c.get('mapping',{}).items():
    m=node.get('message') or {};co=m.get('content') or {}
    if co.get('content_type') in HIDDEN:continue
    for source,v in [('content',co),('attachments',(m.get('metadata') or {}).get('attachments',[]))]:
     for fid,loc in refs(v):idx[fid].append({'conversation_id':c['id'],'source_file':p.name,'source_index':j,'node_id':nid,'source_locator':source+loc})
 rows=[]
 for fid,occ in sorted(idx.items()):
  filename=fid+'.dat';rows.append({'asset_id':fid,'export_filename':filename,'original_display_name':names.get(filename),'reference_occurrences':len(occ),'references':occ,'native_bytes_status':'UNVERIFIED','source_index_status':'FILENAME_INDEX_PRESENT' if filename in names else 'FILENAME_NOT_IN_INDEX'})
 summary={'schema':'DT_CLOSEOUT_G2_ASSET_REFERENCE_INDEX_v1','generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'All six verified Generation-2 working shards','asset_names_source':a.asset_names.name,'asset_names_sha256':sha(a.asset_names.read_bytes()),'asset_names_entries':len(names),'unique_observable_asset_ids':len(rows),'observable_reference_occurrences':sum(len(v) for v in idx.values()),'references_with_filename_entry':sum(x['source_index_status']=='FILENAME_INDEX_PRESENT' for x in rows),'references_without_filename_entry':sum(x['source_index_status']!='FILENAME_INDEX_PRESENT' for x in rows),'native_bytes_verified':0,'note':'A filename match is not binary custody. Unresolved is not proof of absence. Hidden internal content is not extracted.'}
 (a.output/'asset_references_private.jsonl').write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in rows))
 (a.output/'asset_reference_summary.json').write_text(json.dumps(summary,indent=2)+'\n')
 print(json.dumps(summary,indent=2))
if __name__=='__main__':main()
