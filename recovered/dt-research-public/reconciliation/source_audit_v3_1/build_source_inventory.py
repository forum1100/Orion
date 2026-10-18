#!/usr/bin/env python3
"""Read-only, byte-addressed inventory of canonical ChatGPT JSON shards.
Never writes hidden reasoning or private payloads to the public report.
"""
import argparse,collections,datetime,hashlib,json,pathlib,re
HIDDEN={'thoughts','analysis'}
SHA=lambda b:hashlib.sha256(b).hexdigest()
EXPECTED=['addb88ac28df78862ae2fcb170b1768d5e9efebe160fe4f839e4666ee0c98203','008409f56c8c01af794c01fd185f0870a9db9ba15f5553ff6406b5a13fb75213','a38328dbd634ad8ec86b06fff91a8a75810d1347222c9c7aacba371b01dbcf2e','7c858ec8a2026480e8b48f6f8635b53bb879f01dd76a2507279cb080938a2ee4','a26ecbb674537afe7310b200a6371a4ce733f9b97b940887aed2ecda0b1d581a','9f280c784fad5761b8e2dbcd11da01b71d5063049190eb6fe59c43f83572a7bc']
def objects(raw):
    """Yield exact byte spans for every top-level JSON-array value."""
    i=0;n=len(raw)
    def ws(i):
        while i<n and raw[i] in b' \t\r\n':i+=1
        return i
    i=ws(i)
    if i>=n or raw[i]!=91:raise ValueError('Expected JSON array')
    i+=1;first=True
    while True:
        i=ws(i)
        if i>=n:raise ValueError('Unterminated array')
        if raw[i]==93:
            if not first and previous_comma:raise ValueError('Trailing comma')
            if raw[ws(i+1):]:raise ValueError('Trailing data')
            return
        start=i;first=False;previous_comma=False
        if raw[i] in (123,91):
            depth=0;string=False;escape=False
            while i<n:
                c=raw[i]
                if string:
                    if escape:escape=False
                    elif c==92:escape=True
                    elif c==34:string=False
                elif c==34:string=True
                elif c in (123,91):depth+=1
                elif c in (125,93):
                    depth-=1
                    if depth==0:i+=1;break
                i+=1
            if depth!=0 or string:raise ValueError('Unterminated compound value')
        elif raw[i]==34:
            i+=1;escape=False
            while i<n:
                c=raw[i]
                if escape:escape=False
                elif c==92:escape=True
                elif c==34:i+=1;break
                i+=1
            else:raise ValueError('Unterminated string value')
        else:
            while i<n and raw[i] not in b',] \t\r\n':i+=1
        if i==start:raise ValueError('Empty array value')
        blob=raw[start:i]
        json.loads(blob)
        yield start,i,blob
        i=ws(i)
        if i>=n:raise ValueError('Unterminated array')
        if raw[i]==44:i+=1;previous_comma=True
        elif raw[i]!=93:raise ValueError('Expected comma or array end')

def walk_refs(v, path=''):
    if isinstance(v,dict):
        for k,x in v.items():
            p=path+'/'+k
            if k in ('asset_pointer','watermarked_asset_pointer') and isinstance(x,str) and x.startswith('sediment://'):
                yield x,p
            elif k=='id' and isinstance(x,str) and re.fullmatch(r'file[_-][A-Za-z0-9_-]+',x):yield x,p
            else:yield from walk_refs(x,p)
    elif isinstance(v,list):
        for i,x in enumerate(v):yield from walk_refs(x,path+'/'+str(i))
def inspect(c):
    mp=c.get('mapping');out={'mapping_nodes':0,'selected_chain_nodes':0,'offchain_nodes':0,'role_counts':{},'content_type_counts':{},'observable_text_records':0,'observable_text_utf8_bytes':0,'attachment_reference_occurrences':0,'unique_attachment_references':0,'graph_issues':[]}
    if not isinstance(mp,dict):return out
    out['mapping_nodes']=len(mp);roles=collections.Counter();types=collections.Counter();refs=set();totalrefs=0;selected=[];seen=set();cur=c.get('current_node')
    while cur is not None:
        if cur in seen:out['graph_issues'].append({'kind':'SELECTED_CHAIN_CYCLE','node_id':cur});break
        if cur not in mp:out['graph_issues'].append({'kind':'SELECTED_PARENT_NOT_IN_MAPPING','node_id':cur});break
        seen.add(cur);selected.append(cur);cur=mp[cur].get('parent')
    out['selected_chain_nodes']=len(selected);out['offchain_nodes']=len(mp)-len(seen)
    for nid,node in mp.items():
        if not isinstance(node,dict):out['graph_issues'].append({'kind':'INVALID_NODE','node_id':nid});continue
        if node.get('id')!=nid:out['graph_issues'].append({'kind':'NODE_KEY_ID_DIFFERENCE','node_id':nid})
        parent=node.get('parent')
        if parent is not None and parent not in mp:out['graph_issues'].append({'kind':'PARENT_NOT_IN_MAPPING','node_id':nid,'parent_id':parent})
        for child in node.get('children') or []:
            if child not in mp:out['graph_issues'].append({'kind':'CHILD_NOT_IN_MAPPING','node_id':nid,'child_id':child})
        m=node.get('message') or {};co=m.get('content') or {};kind=co.get('content_type');roles[(m.get('author') or {}).get('role') or 'none']+=1;types[kind or 'none']+=1
        if m.get('id') and m['id']!=nid:out['graph_issues'].append({'kind':'NODE_MESSAGE_ID_DIFFERENCE','node_id':nid,'message_id':m['id']})
        if kind not in HIDDEN:
            if kind=='reasoning_recap':text=co.get('content')
            else:
                parts=co.get('parts');text=''.join(x for x in parts if isinstance(x,str)) if isinstance(parts,list) else None
            if isinstance(text,str):out['observable_text_records']+=1;out['observable_text_utf8_bytes']+=len(text.encode())
            for ref,p in walk_refs(co):refs.add(ref);totalrefs+=1
            for ref,p in walk_refs((m.get('metadata') or {}).get('attachments',[])):refs.add(ref);totalrefs+=1
    out.update(role_counts=dict(roles),content_type_counts={str(k):v for k,v in types.items()},attachment_reference_occurrences=totalrefs,unique_attachment_references=len(refs))
    return out

def main():
    ap=argparse.ArgumentParser();ap.add_argument('source_dir',type=pathlib.Path);ap.add_argument('output_dir',type=pathlib.Path);a=ap.parse_args();a.output_dir.mkdir(parents=True,exist_ok=True)
    inv=[];summ=[];ids=set();counts=collections.Counter();issues=[]
    for i,expected in enumerate(EXPECTED):
        p=a.source_dir/f'conversations-{i:03}.json';raw=p.read_bytes();assert SHA(raw)==expected,(p,'SOURCE_HASH_MISMATCH')
        entries=[]
        for j,(start,end,blob) in enumerate(objects(raw)):
            c=json.loads(blob);cid=c.get('id') if isinstance(c,dict) else None
            if cid:
                assert cid not in ids,('DUPLICATE_CONVERSATION_ID',cid);ids.add(cid)
            r={'source_file':p.name,'source_sha256':expected,'source_index':j,'byte_start':start,'byte_end_exclusive':end,'bytes':len(blob),'raw_sha256':SHA(blob),'conversation_id':cid,'title':c.get('title') if isinstance(c,dict) else None,'create_time':c.get('create_time') if isinstance(c,dict) else None,'update_time':c.get('update_time') if isinstance(c,dict) else None,'current_node':c.get('current_node') if isinstance(c,dict) else None,'source_status':'VALID_CONVERSATION' if cid else 'PRESERVED_NONCONVERSATION_ENTRY'}
            if cid:r.update(inspect(c))
            inv.append(r);entries.append(r)
            if cid:
                counts['valid_conversations']+=1
                for key in ['mapping_nodes','selected_chain_nodes','offchain_nodes','observable_text_records','observable_text_utf8_bytes','attachment_reference_occurrences']:counts[key]+=r[key]
                counts.update({'content_type:'+k:v for k,v in r['content_type_counts'].items()})
                issues.extend({'conversation_id':cid,**x} for x in r['graph_issues'])
            else:counts['preserved_nonconversation_entries']+=1
        summ.append({'file':p.name,'bytes':len(raw),'sha256':expected,'entries':len(entries),'valid_conversations':sum(bool(r['conversation_id']) for r in entries),'first_object_byte':entries[0]['byte_start'],'last_object_end':entries[-1]['byte_end_exclusive']})
        assert len(json.loads(raw))==len(entries)
    summary={'schema':'DT_CLOSEOUT_ALL_SUBJECT_SOURCE_INVENTORY_v1','generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Generation-2 six verified working shards; all subjects; no later live or earlier export coverage asserted','shards':summ,'counts':dict(counts),'graph_issue_count':len(issues),'parent_zip_binding':'UNVERIFIED','source_payloads':'Existing source members referenced by exact byte span and hash; no duplicate payloads created','native_attachment_bytes':'NOT_CERTIFIED_BY_THIS_INDEX'}
    files={'source_inventory_private.jsonl':''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in inv),'source_inventory_summary.json':json.dumps(summary,indent=2)+'\n','source_graph_issues_private.json':json.dumps(issues,ensure_ascii=False,indent=2)+'\n'}
    for name,text in files.items():(a.output_dir/name).write_text(text,encoding='utf-8')
    print(json.dumps(summary,indent=2))
if __name__=='__main__':main()
