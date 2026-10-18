"""Non-destructive inventory and source-faithful mirror of existing PUBLIC DT research."""
from pathlib import Path
import re,subprocess,json,hashlib,collections
orion=Path(__file__).resolve().parents[1]
research=orion.parent/"Distel-Theory-Research"
old=Path(r"E:\Orion\Source\DT-Desktop-Suite")
base="94103348b7402056de64f10fe86826562d9b9363"
def git(root,*args,safe=False):
    a=["git"]+(["-c","safe.directory=E:/Orion/Source/DT-Desktop-Suite"] if safe else [])+["-C",str(root)]+list(args)
    return subprocess.run(a,check=True,capture_output=True).stdout
origin_sha=git(research,"rev-parse","HEAD").decode().strip()
files=[b.decode("utf-8") for b in git(research,"ls-files","-z").split(b"\0") if b]
destroot=orion/"recovered"/"dt-research-public"
manroot=orion/"recovered"/"manifests"
destroot.mkdir(parents=True,exist_ok=True);manroot.mkdir(parents=True,exist_ok=True)
sensitive=[
 ("email",r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}"),
 ("credential",r"(?i)(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AIza[\w-]{20,}|AKIA[0-9A-Z]{16}|(?:sk|rk)-[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)"),
 ("private-person",r"(?i)\b(?:Ariel Cutler|Crystal Cutler|Annie Cutler|DeBary Elementary|Volusia County Schools)\b")
]
whitelist={".md",".py",".json",".csv",".html",".htm",".mjs",".js",".cjs",".txt",".cff",".xml",".yaml",".yml",".svg",".css"}
records=[]
for f in files:
    p=research/f
    if not p.is_file():continue
    raw=p.read_bytes(); reasons=[]
    if len(raw)>50_000_000:reasons.append("too-large")
    special_name=p.name in {".gitignore",".nojekyll"}
    if p.suffix.lower() not in (whitelist|{".jsonl"}) and not special_name:reasons.append("unreviewed-format")
    if b"\x00" in raw:reasons.append("binary")
    if not reasons:
        try: s=raw.decode("utf-8-sig")
        except UnicodeDecodeError: reasons.append("non-utf8");s=""
        for label,pattern in sensitive:
            if re.search(pattern,s):reasons.append("possible-"+label)
    state="COPIED_HASH_VERIFIED" if not reasons else "HELD_FOR_REVIEW"
    if not reasons:
        out=destroot/(f+".source.txt" if special_name else f);out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(raw)
        assert hashlib.sha256(out.read_bytes()).digest()==hashlib.sha256(raw).digest()
    records.append({"source_path":f,"target_path":str(Path("recovered/dt-research-public")/(f+".source.txt" if special_name else f)).replace("\\","/") if not reasons else None,"sha256":hashlib.sha256(raw).hexdigest(),"size":len(raw),"state":state,"review_flags":reasons})
count=collections.Counter(x["state"] for x in records)
manifest={"schema":"2026-10-18","source_repo":"forum1100/Distel-Theory-Research","source_commit_sha":origin_sha,"total_tracked_files":len(records),"copied_exact":count["COPIED_HASH_VERIFIED"],"held_for_review":count["HELD_FOR_REVIEW"],"coverage_this_public_repo":count["COPIED_HASH_VERIFIED"]/len(records),"not_entire_Orion_archive":True,"files":records}
(manroot/"research_source_inventory.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
head=git(old,"rev-parse","HEAD",safe=True).decode().strip()
commits=git(old,"log","--format=%H%x09%aI%x09%s",base+".."+head,safe=True).decode(errors="replace").splitlines()
refs=git(old,"for-each-ref","--format=%(refname:short)%09%(objectname)","refs/heads",safe=True).decode(errors="replace").splitlines()
history={"baseline_remote_main_sha":base,"local_main_sha":head,"main_commit_count":len(commits),"branch_ref_count":len(refs),"push_failure_count":"NOT_VERIFIED","commits":[{"sha":x.split("\t",2)[0],"date":x.split("\t",2)[1],"subject":x.split("\t",2)[2]} for x in commits if x.count("\t")>=2],"branches":[{"name":x.split("\t")[0],"sha":x.split("\t")[1],"push_status":"UNKNOWN"} for x in refs if "\t" in x]}
(manroot/"local_git_history_index.json").write_text(json.dumps(history,indent=2)+"\n",encoding="utf-8")
readme=f"""# DT research exact-source public mirror
Source: https://github.com/forum1100/Distel-Theory-Research at commit `{origin_sha}`.

Inventoried **{len(records)}** tracked existing public files. Copied **{count['COPIED_HASH_VERIFIED']}** exact files and held **{count['HELD_FOR_REVIEW']}** for privacy/credential or format review. Each file has its original path and SHA-256 in [the inventory](manifests/research_source_inventory.json).

**Coverage is only of the already-public research repository, NOT of the total privately recovered Orion/Google/DT corpus.** Original source claims and failures are preserved without reclassifying them as new validated results.

Historical local DT checkout: `{head}`, with **{len(commits)}** mainline commits beyond public main `{base}` and **{len(refs)}** local branch refs. Git push-failure status remains unverified without actual logs; see [local Git index](manifests/local_git_history_index.json).
"""
(orion/"recovered"/"README.md").write_text(readme,encoding="utf-8")
print(json.dumps({"origin":origin_sha,"tracked":len(records),"copied":count["COPIED_HASH_VERIFIED"],"held":count["HELD_FOR_REVIEW"],"held_files":[{"file":x["source_path"],"flags":x["review_flags"]} for x in records if x["review_flags"]],"local_main":head,"commits":len(commits),"branches":len(refs)},indent=2))
