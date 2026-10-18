'use strict';
// First-party, document-backed cognitive folder graph.
// Office -> Scroll -> Perception Point. Metadata points to original evidence.
// A folder/document is a memory address, NOT a running agent or a proof of truth.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const id=x=>{const s=String(x||'');if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(s)||s==='..')
 throw Error('MEMORY_FOLDER_ID_INVALID');return s;};
const select=(x,max=12)=>Math.max(1,Math.min(64,Math.trunc(Number(x)||max)));
class OrionPerceptionFolderGraph{
 constructor({root,maxActive=12,orionId='ORION'}={}){
  if(!root)throw Error('MEMORY_FOLDER_ROOT_REQUIRED');
  this.root=path.join(path.resolve(root),'orion-perception-folder-graph');
  this.journal=path.join(this.root,'index-events.jsonl');
  this.maxActive=select(maxActive);
  this.orionId=id(orionId);
  fs.mkdirSync(this.root,{recursive:true});
 }
 events(){
  if(!fs.existsSync(this.journal))return [];
  const rows=fs.readFileSync(this.journal,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
  let previous=null;
  for(const row of rows){
   const {eventHash,...payload}=row;
   if(payload.parentHash!==previous||eventHash!==sha(payload))
    throw Error('MEMORY_FOLDER_INDEX_CHAIN_INVALID_PRESERVED');
   previous=eventHash;
  }
  return rows;
 }
 record(type,officeId,scrollId,pointId,details={}){
  const office=id(officeId);
  const scroll=scrollId===null?null:id(scrollId);
  const point=pointId===null?null:id(pointId);
  if(type==='OFFICE'&&(scroll||point)||type==='SCROLL'&&(!scroll||point)||
     type==='POINT'&&(!scroll||!point))throw Error('MEMORY_FOLDER_TOPOLOGY_INVALID');
  const idPath=[office,scroll,point].filter(Boolean);
  const key=[type,...idPath].join(':');
  const previous=this.state();
  if(type==='SCROLL'&&!previous.nodes.has('OFFICE:'+office))
   throw Error('MEMORY_SCROLL_PARENT_OFFICE_MISSING');
  if(type==='POINT'&&!previous.nodes.has('SCROLL:'+office+':'+scroll))
   throw Error('MEMORY_POINT_PARENT_SCROLL_MISSING');
  const existing=previous.nodes.get(key);
  if(existing)return {created:false,record:existing,localIndexReadbackVerified:true,
   originalSourceVerified:false,canonicalCrewIdentityVerified:false};
  const base=path.join(this.root,'offices',office,
   ...(scroll?['scrolls',scroll]:[]),...(point?['points',point]:[]));
  const docs=path.join(base,'versions');fs.mkdirSync(docs,{recursive:true});
  const data={schema:'orion-folder-memory-node/1.0',type,key,officeId:office,
   scrollId:scroll,pointId:point,orionId:this.orionId,
   createdAt:new Date().toISOString(),
   details:{...details,loadedIntoRunningAgent:false,
    originalSourcesVerified:false}};
  const content=JSON.stringify(data);
  const contentHash=sha(content);
  const relative=path.relative(this.root,path.join(docs,contentHash+'.json')).replace(/\\/g,'/');
  fs.writeFileSync(path.join(docs,contentHash+'.json'),content,{flag:'wx'});
  const prior=previous.lastHash;
  const evt={schema:'orion-folder-memory-index-event/1.0',at:new Date().toISOString(),
   type:'NODE_REGISTERED',key,nodeType:type,relative,contentHash,parentHash:prior};
  evt.eventHash=sha(evt);
  fs.appendFileSync(this.journal,JSON.stringify(evt)+'\n');
  return {created:true,record:data,contentHash};
 }
 office({officeId,title,chapter=null,sourceRefs=[]}={}){
  return this.record('OFFICE',officeId,null,null,{title,chapter,sourceRefs,
   scope:'OFFICE_PERSISTED_DIRECTORY'});
 }
 scroll({officeId,scrollId,agentId,chapterId=null,checkpointRef=null,state='DORMANT'}={}){
  if(!['DORMANT','AWAITING_TASK','CHECKPOINTED'].includes(state))
   throw Error('SCROLL_AGENT_STATE_UNQUALIFIED');
  return this.record('SCROLL',officeId,scrollId,null,{agentId:String(agentId||''),
   chapterId,checkpointRef,agentState:state,executionGranted:false});
 }
 indexExistingScrollFromFabric({officeId,scrollId,agentId,agentStateRoot}={}){
  if(!agentStateRoot)throw Error('FABRIC_ROOT_REQUIRED');
  const agent=id(agentId),fabricRoot=fs.realpathSync(path.resolve(agentStateRoot));
  const manifestFile=path.join(fabricRoot,agent,'manifest.json');
  const realManifest=fs.realpathSync(manifestFile);
  if(!realManifest.startsWith(fabricRoot+path.sep))
   throw Error('FABRIC_MANIFEST_OUTSIDE_ROOT');
  const bytes=fs.readFileSync(realManifest);
  const manifest=JSON.parse(bytes.toString('utf8'));
  if(manifest.agentId!==agent||manifest.memory?.mode!=='FILE_BACKED_PAGED')
   throw Error('FABRIC_AGENT_IDENTITY_OR_MEMORY_MODE_INVALID');
  const continuationFile=path.join(path.dirname(realManifest),'continuation.json');
  let checkpointRef=null;
  if(fs.existsSync(continuationFile)){
   const p=fs.realpathSync(continuationFile);
   if(!p.startsWith(fabricRoot+path.sep))
    throw Error('FABRIC_CHECKPOINT_OUTSIDE_ROOT');
   const text=fs.readFileSync(p,'utf8'),cp=JSON.parse(text);
   if(cp.agentId!==agent)throw Error('FABRIC_CHECKPOINT_AGENT_MISMATCH');
   checkpointRef={path:p,sha256:sha(text),
    checkpointId:cp.checkpointId||null,sourceReadback:'LOCAL_ONLY'};
  }
  return this.scroll({officeId,scrollId,agentId:agent,
   checkpointRef:{manifestPath:realManifest,manifestSha256:sha(bytes),
    checkpoint:checkpointRef},state:'DORMANT'});
 }
 point({officeId,scrollId,handle,canonicalId=null,sourceLocator,
  contentHash=null,evidenceStatus='UNVERIFIED',deviceReplicas=[]}={}){
  if(!sourceLocator)throw Error('POINT_SOURCE_LOCATOR_REQUIRED');
  const replicas=deviceReplicas.map(x=>({deviceId:id(x.deviceId),
   locator:String(x.locator||''),identityVerified:false,contentVerified:false,
   enrollment:'OBSERVED_REFERENCE_ONLY'}));
  return this.record('POINT',officeId,scrollId,handle,{numericHandle:String(handle),
   canonicalPerceptionPointId:canonicalId,sourceLocator:String(sourceLocator),
   originalContentHash:contentHash,evidenceStatus,
   sourceContentReadbackVerified:false,replicas});
 }
 state(){
  const rows=this.events(),nodes=new Map();
  for(const row of rows){
   if(row.type!=='NODE_REGISTERED'||nodes.has(row.key))
    throw Error('MEMORY_FOLDER_DUPLICATE_OR_UNKNOWN_EVENT_PRESERVED');
   const f=path.resolve(this.root,row.relative);
   const root=path.resolve(this.root)+path.sep;
   if(!f.startsWith(root))throw Error('MEMORY_FOLDER_POINTER_ESCAPE_PRESERVED');
   const bytes=fs.readFileSync(f,'utf8');
   if(sha(bytes)!==row.contentHash)throw Error('MEMORY_FOLDER_CONTENT_MISMATCH_PRESERVED');
   const record=JSON.parse(bytes);
   if(record.key!==row.key||record.orionId!==this.orionId)
    throw Error('MEMORY_FOLDER_IDENTITY_MISMATCH_PRESERVED');
   nodes.set(row.key,record);
  }
  return {nodes,lastHash:rows.length?rows.at(-1).eventHash:null,recordCount:rows.length};
 }
 inspect({officeId=null,scrollId=null,limit=this.maxActive}={}){
  const s=this.state(),office=officeId===null?null:id(officeId);
  const scroll=scrollId===null?null:id(scrollId);
  const rows=[...s.nodes.values()].filter(x=>(!office||x.officeId===office)&&
   (!scroll||x.scrollId===scroll));
  const max=select(limit,this.maxActive);
  return {schema:'orion-cognitive-folder-working-set/1.0',total:rows.length,
   active:rows.slice(0,max).map(x=>({key:x.key,type:x.type,officeId:x.officeId,
    scrollId:x.scrollId,pointId:x.pointId,
    agentStatus:x.details.agentState||'NOT_AN_AGENT',
    sourceLocator:x.type==='POINT'?x.details.sourceLocator:null,
    originalVerified:x.details.sourceContentReadbackVerified===true})),
   remaining:Math.max(0,rows.length-max),maxActive:max,
   agentProcessCountStarted:0,dormantWorkersAreStorageRecords:true,
   remoteReplicasAreUnverifiedPointers:true,
   proofScope:'LOCAL_DOCUMENT_POINTER_READBACK_ONLY',
   modelContextWindowChanged:false};
 }
 // Read-only projection of the pre-existing Scroll Book and Chapter Book.
 // This never calls registerPledge/registerChapter; it cannot mint duplicate
 // identities or retroactively rewrite past Chapter assignments.
 projectAuthoritativeCrew({crewHouse,agentStateFabric=null,chapterNumber=null,
  maxActive=this.maxActive}={}){
  if(!crewHouse||typeof crewHouse.scrollBook!=='function'||
     typeof crewHouse.chapterBook!=='function')
   throw Error('AUTHORITATIVE_ORION_CREW_HOUSE_REQUIRED');
  const scrollBook=crewHouse.scrollBook(),chapterBook=crewHouse.chapterBook();
  const pledges=Array.isArray(scrollBook.pledges)?scrollBook.pledges:[];
  const chapters=Array.isArray(chapterBook.chapters)?chapterBook.chapters:[];
  const seenScrolls=new Set(),seenChapters=new Set();
  for(const c of chapters){
   if(!/^\d{4,}$/.test(c.chapterNumber)||seenChapters.has(c.chapterNumber))
    throw Error('DUPLICATE_OR_INVALID_AUTHORITATIVE_CHAPTER_PRESERVED');
   seenChapters.add(c.chapterNumber);
  }
  for(const s of pledges){
   if(!/^\d{4,}$/.test(s.scrollNumber)||seenScrolls.has(s.scrollNumber))
    throw Error('DUPLICATE_OR_INVALID_AUTHORITATIVE_SCROLL_PRESERVED');
   seenScrolls.add(s.scrollNumber);
   if(s.currentChapterNumber&&!seenChapters.has(s.currentChapterNumber))
    throw Error('SCROLL_ASSIGNED_TO_MISSING_CHAPTER_PRESERVED');
  }
  const filter=chapterNumber===null?null:String(chapterNumber).replace(/^(?:chapter)\s*/i,'').padStart(4,'0');
  if(filter&&!seenChapters.has(filter))throw Error('AUTHORITATIVE_CHAPTER_MISSING');
  const chapterRows=chapters.filter(c=>!filter||c.chapterNumber===filter);
  const scrollRows=pledges.filter(p=>!filter||p.currentChapterNumber===filter);
  const nodes=[
   ...chapterRows.map(c=>({type:'CHAPTER',chapterNumber:c.chapterNumber,
    parentChapterNumber:c.parentChapterNumber||null,displayName:c.name,
    identitySource:'CREW_HOUSE_CHAPTER_BOOK',memoryNotLoaded:true})),
   ...scrollRows.map(s=>{
    let savedMemory=null;
    if(agentStateFabric&&s.metadata?.agentId){
     const agentId=String(s.metadata.agentId);
     // Caller-provided fabric access is paged; never call beginRun or spawn.
     const roots=fs.realpathSync(path.resolve(agentStateFabric.root));
     const file=path.join(roots,agentId.replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,120),'manifest.json');
     if(fs.existsSync(file)){
      const resolved=fs.realpathSync(file);
      if(!resolved.startsWith(roots+path.sep))
       throw Error('FABRIC_PROJECTION_MANIFEST_OUTSIDE_ROOT_PRESERVED');
      const bytes=fs.readFileSync(resolved);
      const manifest=JSON.parse(bytes.toString('utf8'));
      if(manifest.agentId!==agentId||manifest.memory?.mode!=='FILE_BACKED_PAGED')
       throw Error('FABRIC_PROJECTION_AGENT_IDENTITY_MISMATCH_PRESERVED');
      savedMemory={manifestLocator:resolved,
       manifestSha256:crypto.createHash('sha256').update(bytes).digest('hex'),
       manifestAgentIdentityReadbackVerified:true,
       readback:'LOCAL_AGENT_FABRIC_MANIFEST_ONLY',
       checkpointContentsLoaded:false};
     }
    }
    return {type:'SCROLL',scrollNumber:s.scrollNumber,
     durableIdentityId:s.durableIdentityId,
     chapterNumber:s.currentChapterNumber||null,
     state:s.status||'UNKNOWN',node:s.currentNode||null,
     canRunOn:Array.isArray(s.canRunOn)?[...s.canRunOn]:[],
     serviceHistoryCount:Array.isArray(s.serviceHistory)?s.serviceHistory.length:0,
     agentId:s.metadata?.agentId||null,savedMemory,
     identitySource:'CREW_HOUSE_SCROLL_BOOK',memoryNotLoaded:true};
   })
  ];
  const limit=select(maxActive,this.maxActive);
  return {schema:'orion-cognitive-folder-authoritative-projection/1.0',
   authority:'EXISTING_ORION_CREW_HOUSE_ONLY',
   nodeCount:nodes.length,chapterCount:chapterRows.length,
   scrollCount:scrollRows.length,active:nodes.slice(0,limit),
   remaining:Math.max(0,nodes.length-limit),maxActive:limit,
   identitiesCreated:0,recordsModified:0,agentProcessesSpawned:0,
   sourceFilesAreMirrorsNotRoots:true,remoteDevicesAreLocatorsNotEnrollment:true};
 }
 capacityPlan({targetGrowth=[1,3,9,27],baselinePoints=3}={}){
  const current=this.status(),base=Math.max(1,Math.trunc(Number(baselinePoints)||3));
  const stages=targetGrowth.map(factor=>{
   const f=Math.max(1,Math.trunc(Number(factor)||1));
   const target=base*f;
   const pages=Math.ceil((target+current.scrolls+current.offices)/this.maxActive);
   return {factor:f,targetPointReferences:target,estimatedPages:pages,
    maxResidentReferences:this.maxActive,
    requiresMoreRunningAgents:false,
    qualifiedAtThisScale:current.points>=target? 'POINTERS_PRESENT_NOT_SEMANTICALLY_VALIDATED'
      :'NOT_YET_TESTED'};
  });
  return {schema:'orion-context-capacity-plan/1.0',current,
   stages,materializedOfficeCount:current.offices,
   dormantScrollCount:current.scrolls,
   decisionGate:'SPAWN_OR_MIGRATE_STEWARDS_ONLY_AFTER_MEASURED_RETRIEVAL_FAILURE_AND_OWNER_POLICY',
   sourceRecallExternallyVerified:false,semanticLosslessProven:false,
   agentProcessesCreatedByPlan:0,
   agentConsolidation:'REUSE_ONE_SCROLL_STEWARD_FOR_MULTIPLE_POINTS_WHEN_CAPABILITY_SCOPE_MATCHES'};
 }
 status(){
  const nodes=[...this.state().nodes.values()];
  const count=type=>nodes.filter(x=>x.type===type).length;
  return {offices:count('OFFICE'),scrolls:count('SCROLL'),points:count('POINT'),
   residentAgentProcessesStarted:0,agentStorageMode:'DORMANT_DOCUMENTS_PAGED_ON_DEMAND',
   expandedContextSemantics:'EXTERNAL_REFERENCES_NOT_CONTEXT_WINDOW_EXTENSION'};
 }
}
module.exports={OrionPerceptionFolderGraph};
