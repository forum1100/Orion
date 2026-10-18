'use strict';
// Read-only, present-time projection of real, registered learning records.
// Adds no authority, executes no skill, issues no Birth Number and cannot
// edit the causally authoritative ledger or SelfGraph materialized file.
const fs=require('node:fs'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const STATUS=new Set(['CANDIDATE','PROMOTED','RETIRED','DISABLED']);
const bounded=(s,n=120)=>String(s??'').slice(0,n);
function safeHashFile(file,limit=512*1024){
 try{const st=fs.lstatSync(file);if(!st.isFile()||st.isSymbolicLink()||st.size>limit)
  return {ok:false,reason:'UNSAFE_OR_OVERSIZE'};
  const data=fs.readFileSync(file);
  return data.length===st.size?{ok:true,sha256:sha(data)}:{ok:false,reason:'BYTE_LENGTH_CHANGED'};
 }catch{return {ok:false,reason:'NOT_READABLE'}}
}
function overlay({workingGraph,skillRegistry,generatedRegistry,upgradeAdoption,maxSkillNodes=18,maxGeneratedNodes=18}={}){
 if(!workingGraph||!Array.isArray(workingGraph.nodes)||!Array.isArray(workingGraph.edges))
  throw Error('ORION_LEARNING_BRAIN_AUTHENTIC_WORKING_GRAPH_REQUIRED');
 if(!Number.isInteger(maxSkillNodes)||maxSkillNodes<0||maxSkillNodes>32||
  !Number.isInteger(maxGeneratedNodes)||maxGeneratedNodes<0||maxGeneratedNodes>32)
  throw Error('ORION_LEARNING_BRAIN_BOUNDS_REQUIRED');
 const nodes=workingGraph.nodes.slice(),edges=workingGraph.edges.slice(),ids=new Set(nodes.map(x=>x.id));
 const sourceHash=bounded(workingGraph.source?.headHash,128);
 if(!sourceHash||sourceHash==='undefined')
  throw Error('ORION_LEARNING_BRAIN_CAUSAL_SOURCE_REQUIRED');
 const observations=[],added=[],safeArray=f=>{try{return Array.isArray(f())?f():[]}catch{return []}};
 const skillRecords=skillRegistry?.list?.()||[];
 const validSkills=Array.isArray(skillRecords)?skillRecords.filter(s=>s&&
  typeof s.id==='string'&&s.id.length<=96&&STATUS.has(s.state)&&
  typeof s.name==='string'&&s.name.length<=160):[];
 validSkills.sort((a,b)=>String(b.promotedAt||b.createdAt||'').localeCompare(String(a.promotedAt||a.createdAt||'')));
 for(const s of validSkills.slice(0,maxSkillNodes)){
  const id='learning:skill:'+s.id;if(ids.has(id))continue;
  // The skill hash stored in the record is historical evidence, not a
  // cryptographic proof that a current skill executed or passed tests.
  const row={id,type:'LearnedSkill',skillId:s.id,name:bounded(s.name,100),
   status:s.state==='PROMOTED'?'PROMOTED_RECORDED':'CANDIDATE_RECORDED',
   skillHash:bounded(s.skillHash,128),recordedAt:s.promotedAt||s.createdAt||null,
   evidenceSource:'DURABLE_LEARNED_SKILL_REGISTRY',executedThisSnapshot:false,
   liveCapabilityActiveNotInferred:true,synthetic:false};
  nodes.push(row);ids.add(id);added.push(id);
  if(ids.has('root'))edges.push({type:'LEARNING_RECORD_UNDER_ROOT',from:id,to:'root',
   source:'PRESENT_TIME_SKILL_REGISTRY_OBSERVATION'});
 }
 const status=generatedRegistry?.status?.()||{};
 const generated=Array.isArray(status.loaded)?status.loaded.filter(x=>x&&
  typeof x.id==='string'&&x.id.startsWith('orion.generated.')&&x.id.length<=130):[];
 generated.sort((a,b)=>a.id.localeCompare(b.id));
 // Use the already-live, validated in-process probation registry. Do not
 // repeatedly parse the potentially large improvement backlog every 2 s.
 const active=upgradeAdoption?.active instanceof Map?upgradeAdoption.active:new Map();
 for(const g of generated.slice(0,maxGeneratedNodes)){
  const id='learning:capability:'+g.id;if(ids.has(id))continue;
  const integrity=safeHashFile(g.file);
  const hashMatched=integrity.ok&&integrity.sha256===g.sourceSha256;
  const probation=hashMatched&&active.get(g.id)?.sourceHash===g.sourceSha256;
  const row={id,type:'GeneratedCapability',capabilityId:g.id,
   name:bounded(g.description||g.id,100),
   status:hashMatched?(probation?'TRAINING_PROBATION_RECORDED':'LOADED_REGISTERED'):'SOURCE_INTEGRITY_UNVERIFIED',
   sourceSha256:bounded(g.sourceSha256,64),sourceIntegrityVerified:hashMatched,
   risk:bounded(g.risk,40),
   evidenceSource:'LIVE_GENERATED_CAPABILITY_REGISTRY',
   ownerAuthorizedExecutionNotInferred:true,synthetic:false};
  nodes.push(row);ids.add(id);added.push(id);
  if(ids.has('root'))edges.push({type:'REGISTERED_LEARNING_CAPABILITY',from:id,to:'root',
   source:'PRESENT_TIME_CAPABILITY_REGISTRY_OBSERVATION'});
 }
 return {schema:'orion-learning-brain-overlay/1.0',workingGraph:{...workingGraph,nodes,edges,
   shown:{...workingGraph.shown,nodes:nodes.length,edges:edges.length},
   learningOverlay:{observedAt:new Date().toISOString(),
    addedNodeCount:added.length,sourceHeadHash:sourceHash,
    baseNodeCount:workingGraph.nodes.length,
    source:'LIVE_DURABLE_LEARNING_REGISTRIES',
    historicalLedgerUnmodified:true,
    executionNotInferred:true}},
  learning:{observedSkillRecords:validSkills.length,
   observedGeneratedCapabilities:generated.length,
   graphLearningNodes:added.length,sourceClass:'PRESENT_TIME_REGISTRY_OBSERVATION',
   cloudMirroringImplied:false,canAuthorizeNewCapabilities:false},
  addedNodeIds:added,sourceRootHash:sourceHash};
}
module.exports={overlay,safeHashFile};
