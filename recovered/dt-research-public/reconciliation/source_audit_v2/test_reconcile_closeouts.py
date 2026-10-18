import importlib.util,json,pathlib,tempfile
p=pathlib.Path(__file__).with_name('reconcile_closeouts.py');s=importlib.util.spec_from_file_location('audit',p);a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
def node(n,parent,kind,content,role='assistant'):
 return {'id':n,'parent':parent,'message':{'id':n,'author':{'role':role},'content':content,'create_time':float(len(n)),'metadata':{'model_slug':'fixture'}}}
def record(n):
 m=n['message'];c=m['content'];return {'node_id':n['id'],'message_id':m['id'],'parent_node_id':n['parent'],'create_time':m['create_time'],'original_role':m['author']['role'],'content_type':c['content_type'],'text':a.text_of(c),'canonical_content':c,'canonical_metadata':m['metadata'],'text_sha256':a.sha(a.text_of(c)) if isinstance(a.text_of(c),str) else None}
root={'id':'root','parent':None,'message':None};hidden=node('hidden','root','thoughts',{'content_type':'thoughts','thoughts':[{'content':'not observable'}]});recap=node('recap','hidden','reasoning_recap',{'content_type':'reasoning_recap','content':'Worked for 5s'});text=node('text','recap','text',{'content_type':'text','parts':['A','B']});alternate=node('alternate','root','text',{'content_type':'text','parts':['offchain']})
c={'id':'fixture-conversation','title':'fixture','current_node':'text','mapping':{n['id']:n for n in [root,hidden,recap,text,alternate]}}
with tempfile.TemporaryDirectory() as d:
 f=pathlib.Path(d)/'fixture_VERBATIM_CAUSAL_ARCHIVE.jsonl';rows=[record(n) for n in [hidden,recap,text,alternate]]
 def check():
  f.write_text('\n'.join(json.dumps(r) for r in rows)+'\n');return a.compare(c,f,'fixture.json','fixture-sha',0)
 r=check();assert r['status']=='OBSERVABLE_TEXT_EXACT' and not r['missing_observable_text_nodes'];assert r['missing_structural_nodes']==['root'];assert r['offchain_nodes']==['alternate'];assert r['source_observable_text_records']==3
 rows[1]['text']=None;r=check();assert r['missing_reasoning_recap_nodes']==['recap'] and r['status']=='OBSERVABLE_TEXT_GAP'
 rows[1]['text']='Worked for 5s';rows[2]['text']='A B';r=check();assert 'text' in r['missing_observable_text_nodes']
 rows[2]['text']='AB';rows[2]['canonical_metadata']={'wrong':True};r=check();assert any('CANONICAL_METADATA' in x.get('fields',[]) for x in r['issues'])
 rows[2]['canonical_metadata']={'model_slug':'fixture'};rows[2].pop('canonical_content');r=check();assert r['status']=='OBSERVABLE_TEXT_EXACT' and r['native_content_not_stored_nodes']==['text']
print('PASS: observable recaps, exact text, metadata, native-content absence, structural roots and off-chain scope')
