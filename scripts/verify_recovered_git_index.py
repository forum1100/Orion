"""Verify Git INDEX stores source bytes identically; no CRLF mutation."""
import subprocess,pathlib,json,hashlib,sys
root=pathlib.Path(__file__).resolve().parents[1]
proc=subprocess.run(["git","-C",str(root),"ls-files","--stage","-z"],check=True,capture_output=True)
index={}
for rec in proc.stdout.split(b"\0"):
 if not rec:continue
 meta,path=rec.split(b"\t",1)
 parts=meta.split()
 if len(parts)>=2:index[path.decode("utf-8")]=parts[1].decode("ascii")
bad=[];count=0
for m in ["research_source_inventory.json","orion_committed_source_inventory.json"]:
 j=json.loads((root/"recovered"/"manifests"/m).read_text(encoding="utf-8"))
 for item in j["files"]:
  loc=item.get("target_path") or item.get("published_path")
  if not loc:continue
  key=loc.replace("\\","/")
  f=root/key
  if not f.exists():bad.append([key,"MISSING"]);continue
  data=f.read_bytes()
  sha256=hashlib.sha256(data).hexdigest()
  blob=hashlib.sha1(b"blob "+str(len(data)).encode("ascii")+b"\0"+data).hexdigest()
  if sha256!=item["sha256"]:bad.append([key,"WORKTREE_SHA256_MISMATCH"])
  if key not in index:bad.append([key,"NOT_STAGED"])
  elif index[key]!=blob:bad.append([key,"INDEX_DIFFERS_FROM_EXACT_BYTES"])
  count+=1
print("EXACT_FILES_CHECKED",count,"INDEX_SHA_MATCHED",count-len(bad),"ISSUES",len(bad))
if bad:print("FIRST_ISSUES",bad[:20]);sys.exit(1)
