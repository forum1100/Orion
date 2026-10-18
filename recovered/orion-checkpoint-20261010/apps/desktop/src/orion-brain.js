const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=(s,n=90)=>{s=String(s??'');return s.length>n?s.slice(0,n-1)+'…':s;};
const metric=(v,l)=>`<div class="metric"><b>${esc(v)}</b><span>${esc(l)}</span></div>`;
const row=(l,v,c='')=>`<div class="status-row"><span>${esc(l)}</span><b class="${c}">${esc(v)}</b></div>`;
let latest=null,selectedNode='scheduler';
const modules=[
  {id:'event',label:'Event / Input',owner:'source-discovery',x:8,y:17,kinds:[]},
  {id:'planner',label:'Reconcile / Plan',owner:'agent-supervisor',x:24,y:17,kinds:[]},
  {id:'queue',label:'Durable Task Queue',owner:'branch-spark',x:40,y:17,kinds:[]},
  {id:'scheduler',label:'Scheduler',owner:'completion-spark',x:56,y:17,kinds:[]},
  {id:'hardware',label:'Hardware Gate',owner:'telemetry',x:72,y:17,kinds:[]},
  {id:'executor',label:'Executor',owner:'desktop-control',x:88,y:17,kinds:[]},
  {id:'prediction',label:'Prediction Freeze',owner:'prediction',x:10,y:49,kinds:['research.cycle']},
  {id:'simulation',label:'Simulation / Replay',owner:'simulation-replay',x:28,y:49,kinds:['research.cycle']},
  {id:'model',label:'Local Model',owner:'derived-model',x:46,y:49,kinds:['research.cycle']},
  {id:'analysis',label:'Analysis / Evidence',owner:'evidence',x:64,y:49,kinds:['research.cycle']},
  {id:'learning',label:'Lesson / Residual',owner:'divergence-spark',x:82,y:49,kinds:['research.cycle']},
  {id:'provider',label:'Provider History',owner:'canonical-reconciler',x:10,y:81,kinds:['browser.history.reconcile']},
  {id:'ingestion',label:'Observation Ingest',owner:'ingestion-spark',x:28,y:81,kinds:['learning.observation.ingest']},
  {id:'builder',label:'Build / Improve',owner:'suite-release-manager',x:46,y:81,kinds:['orion.improvement']},
  {id:'tests',label:'Tests / Validation',owner:'evaluation',x:64,y:81,kinds:['orion.improvement']},
  {id:'provenance',label:'Provenance / Custody',owner:'librarian',x:82,y:81,kinds:[]},
  {id:'successor',label:'Successor Task',owner:'index-spark',x:94,y:49,kinds:[]}
];const edges=[['event','planner'],['planner','queue'],['queue','scheduler'],['scheduler','hardware'],['hardware','executor'],
  ['executor','prediction'],['prediction','simulation'],['simulation','model'],['model','analysis'],['analysis','learning'],['learning','provenance'],['provenance','successor'],
  ['executor','provider'],['provider','provenance'],['executor','ingestion'],['ingestion','provenance'],
  ['executor','builder'],['builder','tests'],['tests','provenance']];
const agentColor=(id)=>latest?.agents?.find(a=>a.id===id)?.color||'#5d7898';
const agentName=(id)=>latest?.agents?.find(a=>a.id===id)?.name||id;
function crewAssignment(id,data=latest){
  const pledges=data?.crew?.scrollBook?.pledges||[],chapters=data?.crew?.chapterBook?.chapters||[];
  const pledge=pledges.find(p=>p.metadata?.agentId===id);if(!pledge)return null;
  const chapter=chapters.find(c=>c.chapterNumber===pledge.currentChapterNumber)||chapters.find(c=>c.metadata?.agentId===id)||null;
  return {pledge,chapter};
}
function crewLabel(id,data=latest){const c=crewAssignment(id,data);return c?`Scroll ${c.pledge.scrollNumber} Â· Chapter ${c.chapter?.chapterNumber||'â€”'}`:agentName(id);}
function traceNode(t){
  if(t.stage==='model.request'||t.stage==='model.response'||t.stage==='model.error')return'model';
  if(t.stage==='artifact.write'){
    const k=String(t.kind||'');if(k.includes('prediction'))return'prediction';if(k.includes('execution'))return'simulation';
    if(k.includes('analysis'))return'analysis';if(k.includes('learning'))return'learning';return'provenance';
  }
  return null;
}
function activePath(data){
  const base=['event','planner','queue','scheduler','hardware','executor'],kind=data.currentTask?.kind;
  let branch=[];
  if(kind==='research.cycle')branch=['prediction','simulation','model','analysis','learning','provenance','successor'];
  else if(kind==='orion.improvement')branch=['builder','tests','provenance','successor'];
  else if(kind==='browser.history.reconcile')branch=['provider','provenance','successor'];
  else if(kind==='learning.observation.ingest')branch=['ingestion','provenance','successor'];
  const traced=(data.trace||[]).slice(-12).map(traceNode).filter(Boolean);return new Set([...base,...branch,...traced]);
}
function edgeKey(a,b){return a+'>'+b;}
function renderGraph(data){
  const box=$('#compute-graph'),nodes=$('#graph-nodes'),svg=$('#graph-lines');nodes.replaceChildren();svg.replaceChildren();
  const active=activePath(data),w=box.clientWidth||900,h=box.clientHeight||455;
  const byId=Object.fromEntries(modules.map(m=>[m.id,m]));
  for(const [a,b] of edges){const x1=w*byId[a].x/100,y1=h*byId[a].y/100,x2=w*byId[b].x/100,y2=h*byId[b].y/100;
    const p=document.createElementNS('http://www.w3.org/2000/svg','path');const dx=Math.max(28,(x2-x1)*.45);p.setAttribute('d',`M ${x1} ${y1} C ${x1+dx} ${y1}, ${x2-dx} ${y2}, ${x2} ${y2}`);
    if(active.has(a)&&active.has(b))p.setAttribute('class','active');svg.append(p);}
  for(const m of modules){const n=document.createElement('button');n.type='button';n.className='graph-node';if(active.has(m.id))n.classList.add('active');if(selectedNode===m.id)n.classList.add('selected');
    n.style.left=m.x+'%';n.style.top=m.y+'%';n.style.setProperty('--node-color',agentColor(m.owner));n.innerHTML=`<strong>${esc(m.label)}</strong><span>${esc(crewLabel(m.owner,data))}</span><small>${nodeStatus(m,data)}</small>`;
    n.onclick=()=>{selectedNode=m.id;renderGraph(data);renderDetail(m,data);};nodes.append(n);}
}
function nodeStatus(m,data){
  if(m.id==='hardware')return data.hardware?.severity||'UNKNOWN';if(m.id==='provider')return data.closeout?.status||'IDLE';
  if(m.id==='builder')return data.improvement?.running?'RUNNING':(data.improvement?.autoPromote?'AUTHORIZED':'STANDBY');
  if(m.id==='scheduler')return data.currentTask?'DISPATCHED':'IDLE';if(m.id==='queue')return `${(data.queue||[]).length} ACTIVE`;
  if(m.kinds.includes(data.currentTask?.kind))return data.currentTask?.status||'ACTIVE';return activePath(data).has(m.id)?'ACTIVE':'STANDBY';
}
function tasksForModule(m,data){
  const q=data.queue||[],current=data.currentTask?[data.currentTask]:[];
  if(m.id==='event'||m.id==='planner'||m.id==='queue')return q;
  if(m.id==='scheduler'||m.id==='hardware'||m.id==='executor')return current;
  if(m.id==='successor')return q.filter(t=>t.id!==data.currentTask?.id);
  if(m.id==='provider')return q.filter(t=>t.kind==='browser.history.reconcile');
  if(m.id==='ingestion')return q.filter(t=>t.kind==='learning.observation.ingest');
  if(m.id==='builder'||m.id==='tests')return q.filter(t=>t.kind==='orion.improvement').concat(current.filter(t=>t.kind==='orion.improvement'));
  if(['prediction','simulation','model','analysis','learning'].includes(m.id))return current.filter(t=>t.kind==='research.cycle');
  if(m.id==='provenance')return current;
  return [];
}
function tracesForModule(m,data){return (data.trace||[]).filter(t=>traceNode(t)===m.id).slice(-12).reverse();}
function renderDetail(m,data){
  const color=agentColor(m.owner);$('#detail-title').textContent=m.label;$('#detail-owner').textContent=agentName(m.owner)+' · '+m.owner;$('#detail-owner').style.color=color;
  const tasks=tasksForModule(m,data),traces=tracesForModule(m,data),tree=$('#detail-tree');tree.className='tree';tree.replaceChildren();
  for(const t of tasks.slice(0,12)){const d=document.createElement('div');d.className='tree-row '+String(t.status||'').toLowerCase();d.style.setProperty('--tree-color',color);
    d.innerHTML=`<b>${esc(short(t.title||t.id,72))}</b><span>${esc(t.kind)} · ${esc(t.status)} · attempt ${esc(t.attempts||0)} · P${esc(t.priority)}</span>`;tree.append(d);}
  for(const tr of traces){const d=document.createElement('div');d.className='tree-row';d.style.setProperty('--tree-color',color);d.innerHTML=`<b>${esc(tr.stage)}${tr.kind?' · '+esc(tr.kind):''}</b><span>${esc(tr.at)}</span>`;tree.append(d);}
  if(!tasks.length&&!traces.length){const d=document.createElement('div');d.className='tree-row';d.style.setProperty('--tree-color',color);d.innerHTML='<b>No live child process</b><span>Module remains available in the computational topology.</span>';tree.append(d);}
  const payload={module:m.id,owner:{id:m.owner,name:agentName(m.owner),color},tasks,traces,dependencies:tasks.flatMap(t=>t.dependencies||[])};$('#detail-json').textContent=JSON.stringify(payload,null,2);
}
function duration(ms){if(ms==null)return 'UNAVAILABLE';const mins=Math.ceil(ms/60000);return mins<2?'< 2 min':mins<60?mins+' min':(mins/60).toFixed(1)+' hr';}
function renderHealth(h){
  const e=h.estimate||{},range=e.lowerMs==null?'No defensible ETA':duration(e.lowerMs)+'–'+duration(e.upperMs);
  $('#activity-summary').innerHTML=row('Execution state',h.status||'UNKNOWN',h.status==='EXECUTING'?'ok':h.status==='STALE'||h.status==='STOPPED'?'bad':'warn')
    +row('Reason',h.reason||'—')+row('Known backlog',h.knownBacklog??'—')
    +row('Runnable / delayed / blocked',`${h.runnable??0} / ${h.delayed??0} / ${h.blocked??0}`)
    +row('Current task age',h.taskAgeMs==null?'—':duration(h.taskAgeMs))
    +row('Last evaluation',h.lastEvaluationAt?new Date(h.lastEvaluationAt).toLocaleTimeString():'Never')
    +row('Known runnable ETA',range,e.lowerMs==null?'warn':'ok')
    +row('Estimate basis',e.lowerMs==null?e.reason:`${e.sampleCount} known tasks · same-kind historical range`);
}

function renderCrew(c={},data=latest){
  const roll=c.rollCall||{},chapters=c.chapterBook?.chapters||[],bookRows=c.yourBook||[],confirmed=c.yourBookConfirmed||[];
  const working=data?.currentTask?new Set(modules.filter(m=>activePath(data).has(m.id)).map(m=>m.owner)).size:0,pending=bookRows.filter(e=>e.confidence==='NEEDS_OWNER_CONFIRMATION').length;
  $('#crew-house').innerHTML=row('TKE pledges / Scrolls',roll.total??0)+row('Chapters / offices',chapters.length)+row('Mission Teams',(c.missionTeams||[]).length)+row('Working paths now',working)+row('Your Book confirmed',confirmed.length)+row('Review queue',pending,pending?'warn':'ok')+row('Replay Room',c.replayRoomReady?'READY':'WAITING FOR FROZEN MOMENT',c.replayRoomReady?'ok':'warn');
  const moments=c.frozenMoments||[];$('#frozen-moments').innerHTML=moments.slice(0,6).map(m=>`<div class="feed-item"><b>${esc(m.perspective||'ORION')} Â· ${m.scrollNumber?'Scroll '+esc(m.scrollNumber):'Orion'}</b><span>${esc(new Date(m.eventTime).toLocaleString())} Â· knowledge frozen at ${esc(new Date(m.knowledgeCutoff).toLocaleTimeString())}</span></div>`).join('')||'<div class="feed-item"><b>No Frozen Moments recorded yet</b><span>Historical perspectives will appear here without hindsight rewriting.</span></div>';
  const book=c.yourBook||[];$('#your-book').innerHTML=book.slice(0,6).map(e=>`<div class="feed-item lesson"><b>${esc(short(e.summary||e.category,115))}</b><span>${esc(e.category||'')} Â· ${esc(e.confidence||'')} Â· learned ${esc(new Date(e.learnedAt).toLocaleDateString())}</span></div>`).join('')||'<div class="feed-item"><b>Your Book is ready</b><span>Confirmed interaction knowledge will appear here with effective time and learning time kept separate.</span></div>';
}

function renderResearch(r){
  $('#research-metrics').innerHTML=metric(r.cycles||0,'cycles')+metric(r.pendingHypotheses||0,'hypotheses')+metric(r.learnedLessons||0,'lessons')+metric(r.unreplayedSimulations||0,'unreplayed');
  $('#hypotheses').innerHTML=(r.hypotheses||[]).slice(0,8).map(h=>`<div class="feed-item proposed"><b>${esc(short(h.title||h.question||h.id,100))}</b><span>${esc(h.status||'')} · ${esc(h.id||'')}</span></div>`).join('')||'<div class="feed-item"><b>No current hypotheses</b></div>';
  $('#lessons').innerHTML=(r.lessons||[]).slice(0,8).map(l=>`<div class="feed-item lesson"><b>${esc(short(l.learning||l.id,120))}</b><span>${esc(short(l.nextAction||l.basis||'',110))}</span></div>`).join('')||'<div class="feed-item"><b>No lessons recorded yet</b></div>';
}
function renderCorpus(c){$('#corpus').innerHTML=c.available?
  row('Repository files',c.sourceFiles)+row('Equation records',c.equationFiles)+row('Simulation files',c.simulationFiles)
  +row('Replay output files',c.replayOutputs)+row('Live research cycles',c.liveResearchCycles)+row('Snapshot provenance',short(c.head||'—',16)):
  row('Research snapshot','UNAVAILABLE','warn')+row('Live research cycles',c.liveResearchCycles||0);}
function renderImprovement(i){const last=i.lastCycle||{};$('#improvement').className='status-box';$('#improvement').innerHTML=
  row('Auto-promote',i.autoPromote?'AUTHORIZED':'OFF',i.autoPromote?'ok':'warn')+row('Engine',i.running?'RUNNING':'STANDBY',i.running?'ok':'')+row('Cycles',i.cycleCount||0)+row('Last result',last.status||last.result?.status||'—')+row('Scheduler',i.scheduler?.mode||'SELF_DIRECTED');}
function renderCloseout(c){$('#closeout').className='status-box';$('#closeout').innerHTML=c.available?
  row('State',c.status||'—',c.status==='active'?'ok':'')+row('Provider',c.provider||'—')+row('Conversation',short(c.title||'—',44))+row('Completed',c.completed||0)+row('Queued',c.queued||0)+row('Grok',c.grok||'—',String(c.grok).includes('quota')?'warn':''):
  row('Coordinator','UNAVAILABLE','warn');}
function renderHardware(h){const sev=h.severity||'UNKNOWN';$('#hardware').className='status-box';$('#hardware').innerHTML=row('Severity',sev,sev==='OK'?'ok':sev==='UNKNOWN'?'warn':'bad')+row('Heavy concurrency',h.recommendation?.heavyConcurrency??'—')+row('Inference parallelism',h.recommendation?.inferenceParallelism??'—')+row('Reason',h.recommendation?.reason||'—')+row('Sample',h.sampledAt?new Date(h.sampledAt).toLocaleTimeString():'—');}
function render(data){
  latest=data;const current=data.currentTask;
  lastSnapshotMs=Date.now();$('#live-dot').classList.toggle('on',data.health?.status==='EXECUTING');
  $('#live-dot').classList.toggle('attention',['STALE','THROTTLED','WAITING','STOPPED'].includes(data.health?.status));
  $('#live-state').textContent='ORION '+(data.health?.status||'UNKNOWN');$('#updated-at').textContent=new Date(data.at).toLocaleTimeString();
  $('#current-title').textContent=current?(current.title||current.id):'No task currently executing';$('#current-kind').textContent=current?`${current.kind} · ${current.status}`:'IDLE';
  const s=data.stats||{};$('#task-stats').innerHTML=metric(s.created||0,'created')+metric(s.completed||0,'completed')+metric(s.failed||0,'failed')+metric((data.queue||[]).length,'nonterminal');
  renderGraph(data);renderDetail(modules.find(m=>m.id===selectedNode)||modules[0],data);renderHealth(data.health||{});renderCrew(data.crew||{},data);renderResearch(data.research||{});renderCorpus(data.corpus||{});renderImprovement(data.improvement||{});renderCloseout(data.closeout||{});renderHardware(data.hardware||{});
}
let busy=false,lastSnapshotMs=0;async function refresh(){if(busy)return;busy=true;try{render(await window.dt.orionBrainSnapshot());}catch(error){$('#live-state').textContent='GRAPH ERROR';$('#detail-json').textContent=String(error.stack||error);}finally{busy=false;}}
window.addEventListener('resize',()=>{if(latest)renderGraph(latest);});
refresh();setInterval(refresh,5000);
setInterval(()=>{if(lastSnapshotMs&&Date.now()-lastSnapshotMs>15000){$('#live-dot').classList.remove('on');$('#live-dot').classList.add('attention');$('#live-state').textContent='TELEMETRY STALE';}},1000);
