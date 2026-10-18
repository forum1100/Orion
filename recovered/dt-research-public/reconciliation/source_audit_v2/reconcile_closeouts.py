#!/usr/bin/env python3
"""Source-faithful, non-destructive closeout audit. Never reconstruct hidden thoughts."""
import argparse, collections, datetime, hashlib, json, pathlib
HIDDEN={'thoughts','analysis'}
EXPECTED=['conversations-%03d.json'%i for i in range(6)]
def sha(b): return hashlib.sha256(b if isinstance(b,bytes) else b.encode('utf-8')).hexdigest()
def canonical(b): return json.dumps(b,ensure_ascii=False,sort_keys=True,separators=(',',':'))
def text_of(c):
    if not isinstance(c,dict) or c.get('content_type') in HIDDEN:return None
    if c.get('content_type')=='reasoning_recap':return c.get('content') if isinstance(c.get('content'),str) else None
    p=c.get('parts');return ''.join(x for x in p if isinstance(x,str)) if isinstance(p,list) else None
def chain(c):
    out=[];seen=set();p=c.get('current_node')
    while p in c['mapping'] and p not in seen:
        seen.add(p);out.append(p);p=c['mapping'][p].get('parent')
    return list(reversed(out))
def records(p):
    return [json.loads(x) for x in p.read_text(encoding='utf-8-sig').splitlines() if x.strip()]
def field(r,*keys):
    return next((r[k] for k in keys if k in r),None)
def compare(c,p,name,source_sha,index):
    rows=records(p);mapping=c['mapping'];selected=chain(c);selected_set=set(selected)
    groups=collections.defaultdict(list);noncanonical=[]
    for r in rows:
        if r.get('source_class') not in (None,'CANONICAL_HISTORY_SOURCE'):
            noncanonical.append(r);continue
        if r.get('node_id'):groups[r['node_id']].append(r)
    issues=[];matched=[];missing_native=[];metadata_unstored=[];hidden_payloads=[]
    for nid,group in groups.items():
        if nid not in mapping:
            issues.append({'node_id':nid,'kind':'UNKNOWN_ARCHIVE_NODE'});continue
        node=mapping[nid];m=node.get('message') or {};content=m.get('content');kind=(content or {}).get('content_type')
        expected={'message_id':m.get('id'),'parent_node_id':node.get('parent'),'create_time':m.get('create_time'),'original_role':(m.get('author') or {}).get('role'),'content_type':kind}
        for r in group:
            differences=[]
            for k,v in expected.items():
                aliases={'parent_node_id':('parent_node_id','parent'),'original_role':('original_role','speaker')}.get(k,(k,))
                if field(r,*aliases)!=v:differences.append(k)
            expected_text=text_of(content);actual=r.get('text')
            if isinstance(expected_text,str) and actual!=expected_text:differences.append('OBSERVABLE_TEXT')
            if kind in HIDDEN and actual not in (None,''):hidden_payloads.append(nid)
            if isinstance(actual,str) and r.get('text_sha256') is not None and r['text_sha256']!=sha(actual):differences.append('DECLARED_TEXT_HASH')
            native=r.get('canonical_content');native_state='NOT_STORED'
            if native is not None:
                native_state='EXACT' if native==content else 'DIFFERENT'
                if native_state=='DIFFERENT':differences.append('CANONICAL_CONTENT')
            if kind not in HIDDEN and kind is not None and native_state=='NOT_STORED':missing_native.append(nid)
            meta=field(r,'canonical_metadata','message_metadata','metadata')
            meta_state='NOT_STORED' if meta is None else 'EXACT' if meta==(m.get('metadata') or {}) else 'DIFFERENT'
            if meta_state=='NOT_STORED':metadata_unstored.append(nid)
            if meta_state=='DIFFERENT':differences.append('CANONICAL_METADATA')
            if differences:issues.append({'node_id':nid,'kind':'RECORD_DIFFERENCE','fields':differences,'source_content_type':kind,'source_text_sha256':sha(expected_text) if isinstance(expected_text,str) else None,'archive_text_sha256':sha(actual) if isinstance(actual,str) else None})
            matched.append({'node_id':nid,'native_content':native_state,'metadata':meta_state})
    visible={nid:text_of((n.get('message') or {}).get('content')) for nid,n in mapping.items()}
    visible={nid:t for nid,t in visible.items() if isinstance(t,str)}
    missing_text=sorted(nid for nid,t in visible.items() if not any(r.get('text')==t for r in groups[nid]))
    missing_nodes=sorted(selected_set-set(groups));hidden_missing=[nid for nid in missing_nodes if ((mapping[nid].get('message') or {}).get('content') or {}).get('content_type') in HIDDEN]
    structural_missing=sorted(set(missing_nodes)-set(hidden_missing))
    duplicate={nid:len(g) for nid,g in groups.items() if len(g)>1}
    offchain=sorted(set(mapping)-selected_set)
    source_counts=collections.Counter(((n.get('message') or {}).get('content') or {}).get('content_type') for n in mapping.values())
    report={'conversation_id':c['id'],'title':c.get('title'),'source_file':name,'source_index':index,'source_sha256':source_sha,'source_current_node':c.get('current_node'),
      'archive_file':p.name,'archive_sha256':sha(p.read_bytes()),'archive_bytes':p.stat().st_size,'source_mapping_nodes':len(mapping),'selected_chain_nodes':len(selected),'offchain_nodes':offchain,
      'source_content_types':dict((str(k),v) for k,v in source_counts.items()),'source_observable_text_records':len(visible),'archive_records':len(rows),'archive_canonical_records':sum(map(len,groups.values())),
      'archive_noncanonical_records':len(noncanonical),'archive_unique_nodes':len(groups),'duplicate_node_ids':duplicate,'missing_selected_nodes':missing_nodes,'missing_hidden_nodes':hidden_missing,'missing_structural_nodes':structural_missing,
      'missing_observable_text_nodes':missing_text,'missing_selected_observable_text_nodes':sorted(set(missing_text)&selected_set),'missing_reasoning_recap_nodes':sorted(nid for nid in missing_text if ((mapping[nid].get('message') or {}).get('content') or {}).get('content_type')=='reasoning_recap'),
      'native_content_not_stored_nodes':sorted(set(missing_native)),'metadata_not_stored_nodes':sorted(set(metadata_unstored)),'unexpected_hidden_payload_nodes':sorted(set(hidden_payloads)),'issues':issues,
      'observable_text_complete_all_mapping':not missing_text,'observable_text_complete_selected':not(set(missing_text)&selected_set),
      'structural_selected_complete':not missing_nodes,'native_content_complete_for_stored_observable_records':not missing_native,
      'status':'OBSERVABLE_TEXT_GAP' if missing_text else 'RECORD_DIFFERENCES' if issues or duplicate else 'OBSERVABLE_TEXT_EXACT',
      'scope_note':'Full source mapping compared for observable text; selected-chain structural scope separately reported. Native payload and attachment-byte custody are separate gates.'}
    return report

def load_sources(root):
    sources={};conversations={};duplicates=[]
    for name in EXPECTED:
        p=root/name
        if not p.exists():raise FileNotFoundError(p)
        b=p.read_bytes();h=sha(b);data=json.loads(b.decode('utf-8-sig'));sources[name]={'bytes':len(b),'sha256':h,'conversations':len(data)}
        for i,c in enumerate(data):
            cid=c.get('id')
            if not cid:continue
            if cid in conversations:duplicates.append(cid)
            conversations[cid]=(c,name,h,i)
    if duplicates:raise ValueError('Duplicate canonical conversation IDs: '+repr(duplicates))
    return sources,conversations

def main():
    ap=argparse.ArgumentParser();ap.add_argument('source_dir',type=pathlib.Path);ap.add_argument('archive_dir',type=pathlib.Path);ap.add_argument('--output',type=pathlib.Path,required=True);args=ap.parse_args()
    sources,conversations=load_sources(args.source_dir);results=[];unmatched=[]
    for p in sorted(args.archive_dir.rglob('*VERBATIM_CAUSAL_ARCHIVE.jsonl')):
        try:
            rows=records(p);ids={r.get('conversation_id') for r in rows if r.get('conversation_id')}
            if len(ids)!=1:unmatched.append({'file':p.name,'reason':'CONVERSATION_ID_AMBIGUOUS','ids':sorted(ids)});continue
            cid=next(iter(ids))
            if cid not in conversations:unmatched.append({'file':p.name,'reason':'SOURCE_NOT_LOCATED','conversation_id':cid});continue
            results.append(compare(*conversations[cid][:1],p,*conversations[cid][1:]))
        except Exception as e:unmatched.append({'file':p.name,'reason':'AUDIT_ERROR','error':str(e)})
    out={'schema':'DT_CLOSEOUT_SOURCE_RECONCILIATION_v3','generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'available archives only; no all-history certification','sources':sources,'source_conversation_count':len(conversations),'archive_count':len(results),'unique_conversations_audited':len({r['conversation_id'] for r in results}),'unmatched_archives':unmatched,'results':results}
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'archives':len(results),'unique_conversations':out['unique_conversations_audited'],'observable_text_exact':sum(r['observable_text_complete_all_mapping'] for r in results),'missing_observable_text_records':sum(len(r['missing_observable_text_nodes']) for r in results),'unmatched':len(unmatched),'report':str(args.output)},indent=2))
if __name__=='__main__':main()
