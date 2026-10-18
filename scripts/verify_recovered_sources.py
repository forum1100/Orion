"""Recheck all exact-source imports against original hashes; exits on mismatch."""
import pathlib,json,hashlib,sys
r=pathlib.Path(__file__).resolve().parents[1]
checks=[("research",r/"recovered/manifests/research_source_inventory.json","files","target_path"),("orion",r/"recovered/manifests/orion_committed_source_inventory.json","files","published_path")]
total=0;bad=[]
for name,path,records_col,target_col in checks:
 m=json.loads(path.read_text(encoding="utf-8"))
 n=0
 for record in m[records_col]:
  loc=record.get(target_col)
  if not loc:continue
  f=r/loc
  if not f.exists():bad.append((name,loc,"MISSING"));continue
  actual=hashlib.sha256(f.read_bytes()).hexdigest()
  if actual!=record["sha256"]:bad.append((name,loc,"HASH_MISMATCH"))
  n+=1
 print(name,"checked",n)
 total+=n
print("TOTAL_CHECKED",total,"ISSUES",len(bad))
if bad:
 print("ISSUES",bad[:20]);sys.exit(1)
