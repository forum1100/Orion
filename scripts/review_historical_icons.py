"""Source-faithful, format-verified release of historical Orion app icons.

Read only from a committed Git archive, never from live app windows. An icon
may be copied only when its static format and metadata are checked.
"""
from pathlib import Path
import subprocess,zipfile,io,json,hashlib,re,collections
root=Path(__file__).resolve().parents[1]
source=Path(r"E:\Orion\Source\DT-Desktop-Suite")
manifest=root/"recovered"/"manifests"/"orion_committed_source_inventory.json"
data=json.loads(manifest.read_text(encoding="utf-8"))
zipbytes=subprocess.run(["git","-c","safe.directory=E:/Orion/Source/DT-Desktop-Suite","-C",str(source),"archive","--format=zip","HEAD"],check=True,capture_output=True).stdout
z=zipfile.ZipFile(io.BytesIO(zipbytes))
published=[];rejected=[]
for row in data["files"]:
 name=row["source_path"]
 if not name.startswith("apps/desktop/assets/icons/") or row["publication_status"]=="PUBLIC_EXACT_COPY":continue
 raw=z.read(name);p=Path(name);ext=p.suffix.lower()
 errors=[]
 if len(raw)>200_000:errors.append("oversized-icon")
 if ext==".png":
  if raw[:8]!=b"\x89PNG\r\n\x1a\n":errors.append("invalid-png")
  elif len(raw)<25:errors.append("short-png")
  else:
   width=int.from_bytes(raw[16:20],"big");height=int.from_bytes(raw[20:24],"big")
   if max(width,height)>1024:errors.append("oversized-image-dimensions")
   for chunk in (b"tEXt",b"iTXt",b"zTXt",b"eXIf"):
    if chunk in raw:errors.append("embedded-text-or-exif")
 elif ext==".ico":
  if raw[:4]!=b"\x00\x00\x01\x00":errors.append("invalid-ico")
 elif ext==".svg":
  s=raw.decode("utf-8",errors="replace")
  if "<svg" not in s:errors.append("not-svg")
  if re.search(r"(?i)(<script|foreignObject|https?://|file://|(?:javascript|data):|@|[A-Za-z]:\\)",s):
   errors.append("active-external-or-personal-content")
 else:errors.append("unsupported-format")
 if errors:
  rejected.append({"path":name,"reasons":errors})
  continue
 dest=root/"recovered"/"orion-checkpoint-20261010"/name
 dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(raw)
 assert hashlib.sha256(dest.read_bytes()).hexdigest()==row["sha256"]
 row["publication_status"]="PUBLIC_EXACT_COPY"
 row["published_path"]="recovered/orion-checkpoint-20261010/"+name
 row["hold_reason"]=[]
 row["asset_verification"]="STATIC_FORMAT_AND_METADATA_SCREEN"
 published.append(name)
c=collections.Counter(x["publication_status"] for x in data["files"])
data["published_exact_count"]=c["PUBLIC_EXACT_COPY"]
data["held_count"]=c["HELD_LOCAL_ONLY"]
data["asset_review"]="STATIC_FORMAT_AND_METADATA_SCREEN_ONLY_NOT_VISUAL_HUMAN_REVIEW"
manifest.write_text(json.dumps(data,indent=2)+"\n",encoding="utf-8")
(root/"recovered"/"ORION_CHECKPOINT.md").write_text(f"""# Historical Orion committed source checkpoint

Historical exact source commit: `{data['source_commit']}`.

Inventory: **{data['inventory_count']} tracked committed files**; **{c['PUBLIC_EXACT_COPY']} published byte-verified**; **{c['HELD_LOCAL_ONLY']} held for explicit privacy, local-path, runtime or format review**.

These files were read from `git archive`, NOT a live Orion deployment or approved Guardian release. The exact-source inventory is at [manifests/orion_committed_source_inventory.json](manifests/orion_committed_source_inventory.json).

Desktop icon images were screened for static format and embedded metadata, not for every possible visual content issue. No automatic runtime changes, releases, authorization, or paid services were made.

Do not infer a failed GitHub push from a local branch, nor deployed Orion capability merely from source code.
""",encoding="utf-8")
print(json.dumps({"published_icons":len(published),"icon_review_rejected":rejected,"new_checkpoint_coverage":{"published":c["PUBLIC_EXACT_COPY"],"total":data["inventory_count"],"held":c["HELD_LOCAL_ONLY"]}},indent=2))
