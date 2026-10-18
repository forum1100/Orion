#!/usr/bin/env python3
"""Non-destructive recovery of source-observable text, never hidden reasoning."""
import argparse, hashlib, json, pathlib, datetime, importlib.util, copy
P=pathlib.Path
sha=lambda b: hashlib.sha256(b if isinstance(b,bytes) else b.encode('utf-8')).hexdigest()
canon=lambda x: json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'))
def load(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def text_of(c):
    if not isinstance(c,dict) or c.get('content_type') in ('thoughts','analysis'):return None
    if c.get('content_type')=='reasoning_recap':return c.get('content') if isinstance(c.get('content'),str) else None
    parts=c.get('parts')
    return ''.join(x for x in parts if isinstance(x,str)) if isinstance(parts,list) else None
def chain(c):
    out=[];seen=set();p=c.get('current_node')
    while p in c['mapping'] and p not in seen:
        seen.add(p);out.append(p);p=c['mapping'][p].get('parent')
    return list(reversed(out))
def run(source,archive,out):
    sb=source.read_bytes();ab=archive.read_bytes();data=load(source)
    raw=ab.splitlines();rows=[json.loads(x) for x in raw if x.strip()]
    ids={r.get('conversation_id') for r in rows if r.get('conversation_id')}
    assert len(ids)==1,'Archive identity must be unique'
    cid=next(iter(ids));matches=[(i,c) for i,c in enumerate(data) if c.get('id')==cid]
    assert len(matches)==1,'Canonical identity missing/ambiguous'
    index,c=matches[0];mapping=c['mapping'];byid={}
    for r,line in zip(rows,raw):
        nid=r.get('node_id')
        if nid:byid.setdefault(nid,[]).append((r,line))
    missing=[];already=[];unresolved=[]
    for nid,node in mapping.items():
        m=node.get('message') or {};content=m.get('content') or {};expected=text_of(content)
        if not isinstance(expected,str):continue
        group=byid.get(nid,[])
        if any(r.get('text')==expected for r,_ in group):already.append(nid);continue
        if len(group)!=1:unresolved.append({'node_id':nid,'reason':'MISSING_OR_DUPLICATE_ARCHIVE_ID'});continue
        r,line=group[0]
        if r.get('text') not in (None,''):unresolved.append({'node_id':nid,'reason':'CONFLICTING_NONEMPTY_TEXT'});continue
        if r.get('message_id')!=m.get('id') or r.get('create_time')!=m.get('create_time') or (r.get('parent_node_id',r.get('parent'))!=node.get('parent')):
            unresolved.append({'node_id':nid,'reason':'SOURCE_IDENTITY_OR_PARENTAGE_DIFFERENCE'});continue
        missing.append(nid)
    assert not unresolved,'Recovery requires individual review: '+repr(unresolved)
    patches=[];sequence={nid:i for i,nid in enumerate(chain(c))}
    for nid in sorted(missing,key=lambda n:(sequence.get(n,10**9),n)):
        node=mapping[nid];m=node['message'];content=m['content'];old,line=byid[nid][0];text=text_of(content)
        rec={'schema':'DT_CLOSEOUT_OBSERVABLE_RECOVERY_v3','conversation_id':cid,'node_id':nid,'message_id':m.get('id'),'parent_node_id':node.get('parent'),'create_time':m.get('create_time'),'source_class':'RECOVERED_CANONICAL_SOURCE','content_type':content.get('content_type'),'text':text,'text_sha256':sha(text),'canonical_content':content,'canonical_metadata':m.get('metadata') or {},'source_file':source.name,'source_file_sha256':sha(sb),'source_locator':f'{source.name}#/conversation_index/{index}/mapping/{nid}','source_message_sha256':sha(canon(m)),'original_archive_sha256':sha(ab),'original_archive_rawline_sha256':sha(line),'original_record_sha256_declared':old.get('record_sha256'),'disposition':'INDEPENDENT_CAPTURE_GAP_RECOVERED_FROM_CANONICAL_SOURCE'}
        rec['recovery_record_sha256']=sha(canon(rec));patches.append(rec)
    overlay=copy.deepcopy(rows)
    for r in overlay:
        for rec in patches:
            if r.get('node_id')==rec['node_id']:
                r['text']=rec['text'];r['text_sha256']=rec['text_sha256']
    patched={r.get('node_id'):r for r in overlay if r.get('node_id')}
    for nid,node in mapping.items():
        content=(node.get('message') or {}).get('content') or {};expected=text_of(content)
        if isinstance(expected,str):assert patched[nid].get('text')==expected
        if content.get('content_type') in ('thoughts','analysis') and nid in patched:assert patched[nid].get('text') in (None,'')
    assert sha(archive.read_bytes())==sha(ab)
    out.mkdir(parents=True,exist_ok=True)
    filename=f'DT_CLOSEOUT_{cid[:8]}_OBSERVABLE_RECOVERY_v3.jsonl'
    payload=('\n'.join(canon(r) for r in patches)+'\n').encode() if patches else b''
    dest=out/filename
    if dest.exists():assert dest.read_bytes()==payload,'Existing recovery differs'
    elif patches:dest.write_bytes(payload)
    manifest={'schema':'DT_CLOSEOUT_RECOVERY_MANIFEST_v3','generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'conversation_id':cid,'status':'SOURCE_RECOVERY_VERIFIED__LIBRARIAN_CUSTODY_PENDING','source':{'file':source.name,'sha256':sha(sb),'conversation_index':index},'original_archive':{'file':archive.name,'sha256':sha(ab),'bytes':len(ab),'records':len(rows)},'recovery':{'file':filename if patches else None,'sha256':sha(payload) if patches else None,'records':len(patches),'node_ids':[r['node_id'] for r in patches]},'validation':{'observable_text_records_after_overlay':len(already)+len(patches),'observable_text_mismatches_after_overlay':0,'hidden_thought_payloads_reconstructed':0,'original_archive_unchanged':True},'residuals':['Native artifact-byte custody is a separate gate.','Original archive is not rewritten.','Later live suffixes and cumulative history remain separately reconcilable.']}
    mp=out/f'DT_CLOSEOUT_{cid[:8]}_OBSERVABLE_RECOVERY_MANIFEST_v3.json';mp.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'conversation_id':cid,'recovered':len(patches),'overlay_mismatches':0,'source_sha256':sha(sb),'archive_sha256':sha(ab),'recovery_sha256':sha(payload) if patches else None,'manifest':str(mp)},indent=2))
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('source',type=P);ap.add_argument('archive',type=P);ap.add_argument('out',type=P);a=ap.parse_args();run(a.source,a.archive,a.out)
