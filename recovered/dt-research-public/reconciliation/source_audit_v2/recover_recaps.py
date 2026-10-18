#!/usr/bin/env python3
"""Append-only recovery of seven observable recaps. Original archive remains immutable."""
import argparse, hashlib, json, pathlib, datetime, copy, importlib.util
spec=importlib.util.spec_from_file_location('audit',pathlib.Path(__file__).with_name('reconcile_closeouts.py'))
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
CID='69fbc4e7-49e0-83ea-b4b0-f551e8c8ea37'
SOURCE_SHA='a26ecbb674537afe7310b200a6371a4ce733f9b97b940887aed2ecda0b1d581a'
ARCHIVE_SHA='4964223a3f6196f8ebcb4928db46199ad76823f0838a02adf4375738066d8809'
OBJECT_SHA='028ceb658209f6eb5ea7821d376f15cf9c98ade36fef3b8b22a3dd374f3faa4c'
SOURCE_DRIVE='1lX01VOJWfIsBtLOHuCAR332kV4pgcfkc'
ARCHIVE_DRIVE='12LQwlV8ICtxgGm5z-IVD_dTbG8rmFF8c'
OBJECT_DRIVE='1rjUIKKse6askF21NPgrDb8YKosW_5eNb'
def run(source_path,archive_path,out_dir):
    source_bytes=source_path.read_bytes();archive_bytes=archive_path.read_bytes()
    assert audit.sha(source_bytes)==SOURCE_SHA and audit.sha(archive_bytes)==ARCHIVE_SHA,'Source baseline changed'
    c=next(c for c in json.loads(source_bytes.decode('utf-8-sig')) if c['id']==CID)
    rows=audit.records(archive_path);byid={r['node_id']:r for r in rows}
    assert len(rows)==len(byid)==134
    before=audit.compare(c,archive_path,source_path.name,SOURCE_SHA,17)
    missing=before['missing_observable_text_nodes'];assert len(missing)==7
    assert all(c['mapping'][nid]['message']['content']['content_type']=='reasoning_recap' for nid in missing)
    rawlines={json.loads(line)['node_id']:line for line in archive_bytes.splitlines() if line.strip()}
    ordered=[nid for nid in audit.chain(c) if nid in missing];patch=[]
    for nid in ordered:
        node=c['mapping'][nid];m=node['message'];old=byid[nid];text=audit.text_of(m['content'])
        assert old.get('text') is None and old.get('visibility')=='restricted_hidden'
        assert old['message_id']==m['id'] and old['parent']==node['parent'] and old['create_time']==m['create_time']
        rec={'schema':'DT_CLOSEOUT_OBSERVABLE_RECAP_RECOVERY_v1','conversation_id':CID,'node_id':nid,'message_id':m['id'],'parent_node_id':node['parent'],'create_time':m['create_time'],
          'source_class':'RECOVERED_CANONICAL_SOURCE','visibility':'observable_reasoning_recap','content_type':'reasoning_recap','text':text,'text_sha256':audit.sha(text),
          'canonical_content':m['content'],'canonical_metadata':m.get('metadata') or {},'source_file':'conversations-004.json','source_drive_id':SOURCE_DRIVE,'source_file_sha256':SOURCE_SHA,
          'source_locator':'conversations-004.json#/conversation_index/17/mapping/'+nid,'source_message_sha256':audit.sha(audit.canonical(m)),
          'original_archive_drive_id':ARCHIVE_DRIVE,'original_archive_sha256':ARCHIVE_SHA,'original_record_sha256_declared':old.get('record_sha256'),'original_record_rawline_sha256':audit.sha(rawlines[nid]),
          'correction':'Earlier archive incorrectly suppressed an observable UI recap. Source recovery is not independent live-capture success.'}
        rec['recovery_record_sha256']=audit.sha(audit.canonical(rec));patch.append(rec)
    overlay=copy.deepcopy(rows)
    for r in overlay:
        if r['node_id'] in missing:
            rec=next(x for x in patch if x['node_id']==r['node_id']);r['text']=rec['text'];r['visibility']='observable_reasoning_recap'
            # Legacy record hash is deliberately not reassigned to an invented historical hash.
    byview={r['node_id']:r for r in overlay}
    for nid,node in c['mapping'].items():
        m=node.get('message') or {};content=m.get('content') or {};expected=audit.text_of(content)
        if isinstance(expected,str):assert byview[nid]['text']==expected
        if content.get('content_type')=='thoughts':assert byview[nid].get('text') is None
    for rec in patch:
        actual=rec.copy();assert actual.pop('recovery_record_sha256')==audit.sha(audit.canonical(actual))
    assert audit.sha(archive_path.read_bytes())==ARCHIVE_SHA
    out_dir.mkdir(parents=True,exist_ok=True)
    patch_path=out_dir/'DT_CLOSEOUT_69fbc4e7_RECAP_RECOVERY_v1.jsonl'
    data=('\n'.join(json.dumps(r,ensure_ascii=False,sort_keys=True,separators=(',',':')) for r in patch)+'\n').encode('utf-8')
    if patch_path.exists():assert patch_path.read_bytes()==data,'Refusing overwrite of differing recovery'
    else:patch_path.write_bytes(data)
    manifest={'schema':'DT_CLOSEOUT_RECOVERY_MANIFEST_v1','transaction':'DT_CLOSEOUT_RECONCILIATION_20260909_RECAP_69fbc4e7','status':'SOURCE_RECOVERY_VERIFIED__LIBRARIAN_CUSTODY_PENDING',
      'source':{'file':'conversations-004.json','drive_id':SOURCE_DRIVE,'sha256':SOURCE_SHA,'conversation_index':17,'canonical_object_drive_id':OBJECT_DRIVE,'canonical_object_sha256':OBJECT_SHA,'object_byte_span':[1974085,2364350]},
      'original_archive':{'drive_id':ARCHIVE_DRIVE,'sha256':ARCHIVE_SHA,'bytes':len(archive_bytes),'records':len(rows)},
      'repair':{'file':patch_path.name,'sha256':audit.sha(data),'bytes':len(data),'records':len(patch),'node_ids':ordered,'source_class':'RECOVERED_CANONICAL_SOURCE','independent_capture_disposition':'FAILED_FOR_SEVEN_RECAP_PAYLOADS'},
      'validation':{'original_archive_unchanged':True,'all_134_source_mapping_nodes_preserved':True,'observable_text_records_after_overlay':126,'observable_text_mismatches_after_overlay':0,'hidden_thought_payloads_reconstructed':0,'original_record_hashes_not_rewritten':True,'native_source_object_already_exists':True,'attachment_bytes_not_certified':True},
      'application':'Read the original immutable archive, verify its SHA-256, then apply the seven recovery records by node_id only after checking original_record_rawline_sha256 and the canonical source message SHA-256. Preserve original record and correction event as separate provenance. Never replace original history or treat this recovery as successful independent live capture.',
      'residuals':['Parent export ZIP cryptographic lineage remains unproven.','Full historical native content and attachment-byte custody remain separate gates.','Reconcile later live suffixes and all other historical closeouts before declaring cumulative completeness.']}
    mp=out_dir/'DT_CLOSEOUT_69fbc4e7_RECAP_RECOVERY_MANIFEST_v1.json'
    mb=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode('utf8')
    if mp.exists():assert mp.read_bytes()==mb,'Refusing overwrite of differing manifest'
    else:mp.write_bytes(mb)
    print(json.dumps({'patch':str(patch_path),'patch_sha256':audit.sha(data),'records':len(patch),'original_unchanged':True,'overlay_observable_text_mismatches':0,'manifest':str(mp)},indent=2))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('source',type=pathlib.Path);p.add_argument('archive',type=pathlib.Path);p.add_argument('output',type=pathlib.Path);a=p.parse_args();run(a.source,a.archive,a.output)
