"""Import public-safe, original OCT 10 committed Orion source bytes, not live state.

Reads Git archive HEAD from E: without changing checkout or config.
Potentially private files and paths are held; every exact-file copy hash verified.
"""
from pathlib import Path
import collections,hashlib,io,json,re,subprocess,zipfile
ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(r"E:\Orion\Source\DT-Desktop-Suite")
DEST=ROOT/"recovered"/"orion-checkpoint-20261010"
M=ROOT/"recovered"/"manifests"
M.mkdir(parents=True,exist_ok=True)
DEST.mkdir(parents=True,exist_ok=True)
def cmd(*extra):
 return subprocess.run(["git","-c","safe.directory=E:/Orion/Source/DT-Desktop-Suite","-C",str(SOURCE),*extra],stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True).stdout
sha=cmd("rev-parse","HEAD").decode().strip()
archive=cmd("archive","--format=zip","HEAD")
zf=zipfile.ZipFile(io.BytesIO(archive))
patterns=[
 ("email",r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}"),
 ("credential-format",r"(?i)(gh[pousr]_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,}|AIza[\w-]{20,}|AKIA[0-9A-Z]{16}|(?:sk|rk)-[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)"),
 ("private-people",r"(?i)\b(?:Ariel Cutler|Crystal Cutler|Annie Cutler|DeBary Elementary|Volusia County Schools)\b"),
 ("windows-home-path",r"(?i)C:\\\\Users\\\\|C:\\Users\\|/Users/"),
 ("private-mounted-drive",r"(?i)G:\\|E:\\Orion|drive.google.com/drive/folders/"),
 ("private-ip-literal",r"\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b")
]
extensions={".cjs",".js",".mjs",".ts",".tsx",".jsx",".html",".css",".json",".md",".txt",".py",".ps1",".cmd",".bat",".sh",".yaml",".yml",".toml",".xml",".sql",".jsonl",".svg",".csv",".lock"}
eligible_prefix=("apps/","packages/","tests/","scripts/","docs/","resources/")
eligible_root={"README.md","package.json","package-lock.json"}
records=[]
for info in zf.infolist():
 if info.is_dir():continue
 name=info.filename
 raw=zf.read(info);size=len(raw)
 notes=[]
 if not (name.startswith(eligible_prefix) or name in eligible_root):notes.append("RUNTIME_OR_CONFIGURATION_PATH_HELD")
 if size>3_000_000:notes.append("SIZE_REQUIRES_REVIEW")
 if Path(name).suffix.lower() not in extensions:notes.append("FORMAT_REQUIRES_REVIEW")
 if Path(name).name in (".env",".gitignore",".npmrc"):notes.append("LOCAL_CONFIGURATION_REQUIRES_REVIEW")
 if b"\x00" in raw:notes.append("BINARY_OR_EMBEDDED_NULL")
 if not notes:
  try: decoded=raw.decode("utf-8-sig")
  except UnicodeDecodeError:notes.append("NOT_UTF8");decoded=""
  for label,pat in patterns:
   if re.search(pat,decoded):notes.append("POSSIBLE_"+label.upper().replace("-","_"))
 status="PUBLIC_EXACT_COPY" if not notes else "HELD_LOCAL_ONLY"
 if not notes:
  dest=DEST/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(raw)
  assert hashlib.sha256(dest.read_bytes()).hexdigest()==hashlib.sha256(raw).hexdigest()
 records.append({"source_path":name,"source_commit":sha,"size":size,"sha256":hashlib.sha256(raw).hexdigest(),"publication_status":status,"published_path":"recovered/orion-checkpoint-20261010/"+name if not notes else None,"hold_reason":notes})
stat=collections.Counter(x["publication_status"] for x in records)
reasons=collections.Counter(n for v in records for n in v["hold_reason"])
out={"source_repository":"local historical DT Desktop Suite Git checkout","source_commit":sha,"source_kind":"COMMITTED_GIT_ARCHIVE_NOT_LIVE_FILES","inventory_count":len(records),"published_exact_count":stat["PUBLIC_EXACT_COPY"],"held_count":stat["HELD_LOCAL_ONLY"],"cannot_claim_99_percent_global_recovery":True,"hold_reasons":dict(reasons),"files":records}
(M/"orion_committed_source_inventory.json").write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
p=ROOT/"recovered"/"ORION_CHECKPOINT.md"
p.write_text(f"""# Orion October 10 source checkpoint â€” screened import

Original source is a private-local Git commit, **not** a new live Orion release.
Source commit: `{sha}`.

Inventoried **{len(records)}** tracked committed files. Published **{stat['PUBLIC_EXACT_COPY']}** exact SHA256-matched files; **{stat['HELD_LOCAL_ONLY']}** were held for manual privacy/format review. Counts exclude untracked source, private Drive archives, staging candidates, temporary simulations and later working-tree changes.

[Per-file manifest](manifests/orion_committed_source_inventory.json) records original paths, hashes, and hold reasons. Files were read via `git archive HEAD` with a per-command Git safe-directory exception, avoiding modifications to the live source checkout. No Guardian pin, process, credential, or Drive structure was touched.

**Do not run these checkpoint files directly as a live deployment.** This is an archival reference for qualified development. Multiple components and original tests may depend on source paths or private configuration that were deliberately held. A GitHub commit is not production release authorization.
""",encoding="utf-8")
print(json.dumps({"sha":sha,"inventory":len(records),"published_exact":stat["PUBLIC_EXACT_COPY"],"held":stat["HELD_LOCAL_ONLY"],"hold_categories":dict(reasons),"held_paths":[v["source_path"] for v in records if v["hold_reason"]][:40]},indent=2))
