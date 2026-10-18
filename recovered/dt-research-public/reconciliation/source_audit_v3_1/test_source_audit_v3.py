import copy, hashlib, importlib.util, json, pathlib, tempfile, unittest

ROOT=pathlib.Path(__file__).resolve().parent

def module(name):
    spec=importlib.util.spec_from_file_location(name, ROOT/(name+'.py'))
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
R=module('reconcile_closeouts_v3')
N=module('audit_native_coverage')
V=module('recover_observable_v3')

def fixture():
    root='root';a='u';b='recap';h='hidden';d='other'
    def message(n,role,kind,content):
        return {'id':n,'author':{'role':role},'create_time':1.0,'content':content,'metadata':{'model_slug':'fixture'}}
    def node(n,parent,m):return {'id':n,'parent':parent,'children':[],'message':m}
    mapping={root:node(root,None,None),a:node(a,root,message(a,'user','text',{'content_type':'text','parts':['hello']})),b:node(b,a,message(b,'assistant','reasoning_recap',{'content_type':'reasoning_recap','content':'Worked for 5s'})),h:node(h,b,message(h,'assistant','thoughts',{'content_type':'thoughts','thoughts':[{'content':'PRIVATE FIXTURE'}]})),d:node(d,root,message(d,'assistant','text',{'content_type':'text','parts':['alternate']}))}
    return {'id':'fixture-conversation','title':'Any subject','current_node':h,'mapping':mapping}

def archive(c):
    rows=[]
    for nid,n in c['mapping'].items():
        if nid=='root':continue
        m=n['message'];co=m['content'];kind=co['content_type']
        rows.append({'conversation_id':c['id'],'source_class':'CANONICAL_HISTORY_SOURCE','node_id':nid,'message_id':m['id'],'parent_node_id':n['parent'],'create_time':m['create_time'],'original_role':m['author']['role'],'content_type':kind,'text':None if kind in ('thoughts','reasoning_recap') else R.text_of(co)})
    return rows

class SourceAuditTests(unittest.TestCase):
    def test_byte_inventory_handles_escaped_strings(self):
        raw=b' [ '+json.dumps({"a": "bracket ] and " + chr(34) + "quote" + chr(34)}).encode()+b', [1,{"b":[2,3]}], null ] '
        blobs=list(module('build_source_inventory').objects(raw))
        self.assertEqual([json.loads(x[2]) for x in blobs],json.loads(raw))
        for start,end,blob in blobs:self.assertEqual(raw[start:end],blob)
    def test_native_audit_does_not_elevate_text_to_native(self):
        c=fixture();rr=archive(c);groups={r['node_id']:[r] for r in rr}
        self.assertIsNone(N.source_text(c['mapping']['hidden']['message']['content']))
        self.assertEqual(N.source_text(c['mapping']['recap']['message']['content']),'Worked for 5s')
        r=R.compare(c,self._archive_file(rr),'conversations-005.json','fixture-sha',0)
        self.assertEqual(r['missing_reasoning_recap_nodes'],['recap'])
        self.assertEqual(r['offchain_nodes'],['other'])
        self.assertFalse(r['native_content_complete_for_stored_observable_records'])
    def _archive_file(self,rr):
        if not hasattr(self,'_tmp'):self._tmp=tempfile.TemporaryDirectory();self.addCleanup(self._tmp.cleanup)
        p=pathlib.Path(self._tmp.name)/'archive.jsonl';p.write_text(''.join(json.dumps(r)+'\n' for r in rr));return p
    def test_recovery_is_exact_idempotent_and_non_destructive(self):
        c=fixture();rr=archive(c)
        with tempfile.TemporaryDirectory() as tmp:
            base=pathlib.Path(tmp);source=base/'conversations-005.json';source.write_text(json.dumps([c]))
            original=self._archive_file(rr);before=original.read_bytes();out=base/'repair'
            V.run(source,original,out)
            rec=out/'DT_CLOSEOUT_fixture-_OBSERVABLE_RECOVERY_v3.jsonl'
            self.assertTrue(rec.exists());patches=[json.loads(x) for x in rec.read_text().splitlines()]
            self.assertEqual(len(patches),1);self.assertEqual(patches[0]['node_id'],'recap')
            self.assertEqual(patches[0]['text'],'Worked for 5s')
            self.assertNotIn('PRIVATE FIXTURE',rec.read_text())
            first=rec.read_bytes();V.run(source,original,out)
            self.assertEqual(rec.read_bytes(),first);self.assertEqual(original.read_bytes(),before)
    def test_recovery_rejects_conflicting_text(self):
        c=fixture();rr=archive(c);next(r for r in rr if r['node_id']=='recap')['text']='different'
        with tempfile.TemporaryDirectory() as tmp:
            base=pathlib.Path(tmp);source=base/'conversations-005.json';source.write_text(json.dumps([c]));p=self._archive_file(rr)
            with self.assertRaises(AssertionError):V.run(source,p,base/'repair')
    def test_source_and_archive_hashes_are_distinct(self):
        c=fixture();rr=archive(c);r=R.compare(c,self._archive_file(rr),'conversations-005.json','fixture-sha',0)
        self.assertEqual(r['archive_noncanonical_records'],0)
        self.assertTrue(r['missing_observable_text_nodes'])
        self.assertNotEqual(r['archive_sha256'],'fixture-sha')

if __name__=='__main__':unittest.main()
