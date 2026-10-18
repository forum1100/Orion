const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const KNOWN_DT = [
  { id:'dt-desktop', match:r=>/DT Desktop Suite\.exe/i.test(r.name), role:'REQUIRED_DT' },
  { id:'orion-chair', match:r=>/ollama\.exe/i.test(r.name), role:'REQUIRED_WHEN_LOCAL_AI_ACTIVE' },
  { id:'tj-personal-pro', match:r=>/python(?:w)?\.exe/i.test(r.name)&&/run_tj_personal_pro\.py\s+serve/i.test(r.commandLine||''), role:'REQUIRED_DT' },
  { id:'self-observer', match:r=>/ffmpeg\.exe/i.test(r.name)&&/self_observer[\\/]screen_/i.test(r.commandLine||''), role:'REQUIRED_WHEN_OBSERVATION_ACTIVE' },
  { id:'dt-browser', match:r=>/chrome\.exe|msedge\.exe/i.test(r.name)&&/TJ_Personal_Pro[\\/]browser-profile/i.test(r.commandLine||''), role:'REQUIRED_WHEN_BROWSER_AI_ACTIVE' },
  { id:'browser-bros-free', match:r=>/chrome\.exe|msedge\.exe/i.test(r.name)&&/browser-bros-free-profile/i.test(r.commandLine||''), role:'REQUIRED_WHEN_BROWSER_BROS_ACTIVE' },
  { id:'google-drive', match:r=>/GoogleDriveFS\.exe/i.test(r.name), role:'SUPPORTING_WHEN_DRIVE_ACTIVE' },
  { id:'git', match:r=>/^git(?:\.exe)?$/i.test(r.name), role:'REQUIRED_DURING_SOURCE_WORK' }
];

function psJson(script) {
  try {
    const raw=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{
      encoding:'utf8',windowsHide:true,timeout:12000,maxBuffer:16*1024*1024}).trim();
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function processSnapshot() {
  const script = [
    "$p=Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine,ExecutablePath,CreationDate",
    "$g=@{}; Get-Process -ErrorAction SilentlyContinue | ForEach-Object {$g[[int]$_.Id]=@{ws=[double]$_.WorkingSet64;cpu=[double]($_.CPU)}}",
    "$rows=@(); foreach($x in $p){$m=$g[[int]$x.ProcessId];$rows += [pscustomobject]@{pid=[int]$x.ProcessId;ppid=[int]$x.ParentProcessId;name=[string]$x.Name;commandLine=[string]$x.CommandLine;path=[string]$x.ExecutablePath;created=[string]$x.CreationDate;workingSetBytes=if($m){$m.ws}else{0};cpuSeconds=if($m){$m.cpu}else{0}}}",
    "$rows|ConvertTo-Json -Compress -Depth 3"
  ].join(';');
  const parsed=psJson(script);
  return Array.isArray(parsed)?parsed:(parsed?[parsed]:[]);
}

function classify(row) {
  const hit=KNOWN_DT.find(item=>item.match(row));
  if(hit) return {class:hit.role,capability:hit.id,confidence:'HIGH'};
  if(/^(System|Registry|Memory Compression|Secure System)$/i.test(row.name||'')) return {class:'WINDOWS_SYSTEM',confidence:'HIGH'};
  if(/^(svchost|csrss|lsass|services|wininit|winlogon|dwm|explorer)\.exe$/i.test(row.name||'')) return {class:'WINDOWS_SYSTEM',confidence:'HIGH'};
  return {class:'UNKNOWN_OBSERVE',confidence:'LOW'};
}

function aggregate(rows) {
  const byName={};
  for(const row of rows){
    const key=String(row.name||'unknown').toLowerCase();
    const x=byName[key]||={name:row.name,count:0,workingSetBytes:0,cpuSeconds:0,pids:[]};
    x.count++; x.workingSetBytes+=Number(row.workingSetBytes||0); x.cpuSeconds+=Number(row.cpuSeconds||0); x.pids.push(row.pid);
  }
  return Object.values(byName).sort((a,b)=>b.workingSetBytes-a.workingSetBytes);
}
function candidates(rows) {
  const out=[];
  const classified=rows.map(row=>({...row,classification:classify(row)}));
  const observer=classified.filter(x=>x.classification.capability==='self-observer');
  if(observer.length>1) out.push({kind:'DUPLICATE_DT_SELF_OBSERVER',severity:'HIGH',count:observer.length,
    pids:observer.map(x=>x.pid),workingSetBytes:observer.reduce((n,x)=>n+Number(x.workingSetBytes||0),0),
    action:'KEEP_ONE_VALID_RECORDER_CLEAN_STALE_DT_CHILDREN'});
  for(const group of aggregate(classified)){
    if(group.workingSetBytes<768*1024*1024 || group.count<2) continue;
    const members=classified.filter(x=>String(x.name).toLowerCase()===String(group.name).toLowerCase());
    if(members.every(x=>x.classification.class==='WINDOWS_SYSTEM')) continue;
    const dtMembers=members.filter(x=>x.classification.capability);
    const unknownMembers=members.filter(x=>x.classification.class==='UNKNOWN_OBSERVE');
    const kind=dtMembers.length && unknownMembers.length ? 'HIGH_RESOURCE_MIXED_PROCESS_GROUP'
      : dtMembers.length ? 'HIGH_RESOURCE_DT_PROCESS_GROUP' : 'HIGH_RESOURCE_UNKNOWN_PROCESS_GROUP';
    out.push({kind,severity:'REVIEW',...group,dtPids:dtMembers.map(x=>x.pid),unknownPids:unknownMembers.map(x=>x.pid)});
  }
  return out;
}

class SystemProcessIntelligence {
  constructor({root,intervalMs=60000,vault=null,experience=null}={}){
    this.root=path.join(root,'system-process-intelligence');
    this.intervalMs=Math.max(15000,Number(intervalMs)||60000); this.vault=vault; this.experience=experience;
    this.timer=null; this.last=null; fs.mkdirSync(this.root,{recursive:true});
  }
  sample(){
    const rows=processSnapshot().map(row=>({...row,classification:classify(row)}));
    const snapshot={schema:'dt-system-process-intelligence/1.0',observedAt:new Date().toISOString(),
      processCount:rows.length,rows,aggregate:aggregate(rows).slice(0,80),candidates:candidates(rows)};
    this.last=snapshot;
    fs.writeFileSync(path.join(this.root,'latest.json'),JSON.stringify(snapshot,null,2),'utf8');
    fs.appendFileSync(path.join(this.root,'history.jsonl'),JSON.stringify({observedAt:snapshot.observedAt,processCount:snapshot.processCount,
      top:snapshot.aggregate.slice(0,20),candidates:snapshot.candidates})+'\n','utf8');
    this.experience?.append('system-process-snapshot',{processCount:snapshot.processCount,top:snapshot.aggregate.slice(0,20),candidates:snapshot.candidates},{sourceClass:'LIVE_MACHINE_OBSERVATION'});
    if(snapshot.candidates.length) this.vault?.append('system-process-candidates','orion',snapshot.candidates);
    return snapshot;
  }
  status(){
    if(!this.last){
      try{this.last=JSON.parse(fs.readFileSync(path.join(this.root,'latest.json'),'utf8'));}catch{}
    }
    return this.last || {schema:'dt-system-process-intelligence/1.0',observedAt:null,processCount:0,rows:[],aggregate:[],candidates:[]};
  }
  start(){
    this.sample();
    if(!this.timer)this.timer=setInterval(()=>{try{this.sample();}catch{}},this.intervalMs);
    return {running:true,intervalMs:this.intervalMs,observedAt:this.last?.observedAt||null};
  }
  stop(){if(this.timer)clearInterval(this.timer);this.timer=null;return {running:false};}
}

module.exports={SystemProcessIntelligence,processSnapshot,classify,aggregate,candidates,KNOWN_DT};
