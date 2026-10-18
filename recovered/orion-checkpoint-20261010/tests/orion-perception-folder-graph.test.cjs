'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {OrionPerceptionFolderGraph}=require('../packages/core/src/orion-perception-folder-graph.cjs');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'orion-folder-graph-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 return new OrionPerceptionFolderGraph({root,maxActive:6,orionId:'orion-original'});
}
test('office and scroll storage exists without spawning an agent process',t=>{
 const g=fixture(t);
 g.office({officeId:'SIM',title:'Simulation safety and HTD'});
 g.scroll({officeId:'SIM',scrollId:'scroll-001',agentId:'sim-custodian',state:'DORMANT'});
 const p=g.point({officeId:'SIM',scrollId:'scroll-001',handle:'31337',
  canonicalId:'PP-Original-31337',sourceLocator:'drive://original-doc',
  deviceReplicas:[{deviceId:'laptop',locator:'peer://laptop/archive/31337'}]});
 assert.equal(p.record.details.replicas[0].enrollment,'OBSERVED_REFERENCE_ONLY');
 assert.equal(p.record.details.replicas[0].contentVerified,false);
 assert.equal(g.status().residentAgentProcessesStarted,0);
 assert.equal(g.inspect({officeId:'SIM'}).total,3);
 assert.equal(g.inspect({officeId:'SIM'}).active[2].sourceLocator,'drive://original-doc');
 assert.equal(g.office({officeId:'SIM'}).created,false);
 assert.throws(()=>g.scroll({officeId:'MISSING',scrollId:'bad',agentId:'none'}),
  /PARENT_OFFICE_MISSING/);
 assert.throws(()=>g.point({officeId:'SIM',scrollId:'MISSING',handle:'5',sourceLocator:'x'}),
  /PARENT_SCROLL_MISSING/);
});
test('nested folder graph grows 1x 3x 9x 27x with six active pointers and a single dormant scroll',t=>{
 const g=fixture(t);g.office({officeId:'Perception'});
 g.scroll({officeId:'Perception',scrollId:'0001',agentId:'pp-steward'});
 for(const [growth,count] of [[1,3],[3,9],[9,27],[27,81]]){
  const current=g.status().points;
  for(let i=current;i<count;i++){
   g.point({officeId:'Perception',scrollId:'0001',handle:String(i+1),
    sourceLocator:'drive://historical-source/'+(i+1),
    evidenceStatus:'SOURCE_LOCATOR_ONLY'});
  }
  const snap=g.inspect({officeId:'Perception',scrollId:'0001',limit:6});
  assert.equal(g.status().points,count,'count '+growth+'x');
  assert.equal(snap.active.length,Math.min(6,count+1),'one dormant scroll plus bounded points');
  assert.equal(snap.remaining,Math.max(0,count+1-6));
  assert.equal(snap.agentProcessCountStarted,0);
  assert.equal(g.status().scrolls,1);
  assert.equal(snap.proofScope,'LOCAL_DOCUMENT_POINTER_READBACK_ONLY');
  assert.equal(snap.modelContextWindowChanged,false);
 }
});
test('tampered source reference document fails closed, rather than synthesizing repaired history',t=>{
 const g=fixture(t);g.office({officeId:'OFF'});
 g.scroll({officeId:'OFF',scrollId:'SCR',agentId:'steward'});
 g.point({officeId:'OFF',scrollId:'SCR',handle:'5',sourceLocator:'drive://original'});
 const evt=g.events().find(x=>x.key==='POINT:OFF:SCR:5');
 const file=path.resolve(g.root,evt.relative);
 const forged=JSON.parse(fs.readFileSync(file,'utf8'));forged.details.sourceLocator='drive://forged';
 fs.writeFileSync(file,JSON.stringify(forged));
 assert.throws(()=>g.state(),/CONTENT_MISMATCH_PRESERVED/);
});
test('malformed IDs and unqualified activation requests are rejected',t=>{
 const g=fixture(t);
 assert.throws(()=>g.office({officeId:'../evil'}),/MEMORY_FOLDER_ID_INVALID/);
 g.office({officeId:'OFF'});
 assert.throws(()=>g.scroll({officeId:'OFF',scrollId:'SCR',agentId:'x',state:'ACTIVE'}),
  /SCROLL_AGENT_STATE_UNQUALIFIED/);
 assert.throws(()=>g.point({officeId:'OFF',scrollId:'SCR',handle:'42',sourceLocator:'x'}),
  /PARENT_SCROLL_MISSING/);
});
test('capacity plan projects staged growth without creating permanent agent processes',t=>{
 const g=fixture(t);
 g.office({officeId:'OFF'});
 g.scroll({officeId:'OFF',scrollId:'SCROLL',agentId:'one-dormant-steward'});
 for(let i=0;i<3;i++)g.point({officeId:'OFF',scrollId:'SCROLL',handle:String(i+1),
  sourceLocator:'drive://synthetic/'+(i+1)});
 const plan=g.capacityPlan({baselinePoints:3});
 assert.deepEqual(plan.stages.map(x=>x.targetPointReferences),[3,9,27,81]);
 assert.equal(plan.stages[0].qualifiedAtThisScale,'POINTERS_PRESENT_NOT_SEMANTICALLY_VALIDATED');
 assert.equal(plan.stages[3].qualifiedAtThisScale,'NOT_YET_TESTED');
 assert.equal(plan.agentProcessesCreatedByPlan,0);
 assert.equal(plan.sourceRecallExternallyVerified,false);
 assert.equal(plan.stages[3].requiresMoreRunningAgents,false);
 assert.equal(g.status().scrolls,1);
});
test('existing AgentStateFabric Scroll memory can be indexed without resurrecting a process',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'orion-fabric-folder-link-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const {AgentStateFabric}=require('../packages/core/src/agent-state-fabric.cjs');
 const fabric=new AgentStateFabric({root}),agent='librarian-scroll-1';
 fabric.manifest(agent);
 const cp=fabric.checkpoint(agent,{runId:'fixture',state:{lastReadPage:7},
  cursor:'page-7',status:'CHECKPOINT'});
 const g=new OrionPerceptionFolderGraph({root,orionId:'orion-original'});
 g.office({officeId:'Archive'});
 const saved=g.indexExistingScrollFromFabric({officeId:'Archive',scrollId:'Scroll-1',
  agentId:agent,agentStateRoot:fabric.root}).record;
 assert.equal(saved.details.agentState,'DORMANT');
 assert.equal(saved.details.checkpointRef.checkpoint.checkpointId,cp.checkpointId);
 assert.match(saved.details.checkpointRef.manifestSha256,/^[0-9a-f]{64}$/);
 assert.equal(g.status().residentAgentProcessesStarted,0);
 assert.equal(g.inspect({officeId:'Archive'}).active.length,2);
 const manifestPath=path.join(fabric.root,agent,'manifest.json');
 const corrupt=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 corrupt.agentId='another-agent';
 fs.writeFileSync(manifestPath,JSON.stringify(corrupt));
 assert.throws(()=>g.indexExistingScrollFromFabric({officeId:'Archive',scrollId:'Scroll-2',
  agentId:agent,agentStateRoot:fabric.root}),/FABRIC_AGENT_IDENTITY_OR_MEMORY_MODE_INVALID/);
});

test('founding Scroll/Chapter books remain authoritative; folder graph only projects, never mints agent identity',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'orion-foundry-authority-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const {OrionCrewHouse}=require('../packages/core/src/orion-crew-house.cjs');
 const {AgentStateFabric}=require('../packages/core/src/agent-state-fabric.cjs');
 const crew=new OrionCrewHouse({root});
 const fabric=new AgentStateFabric({root});
 crew.registerChapter({chapterNumber:'0032',name:'SIM Source History'});
 const prior=crew.registerPledge({scrollNumber:'0045',name:'Perception Steward',
   status:'RESTING',metadata:{agentId:'sim-pp-agent'}});
 crew.assignPledge({scrollNumber:'0045',chapterNumber:'0032',reason:'FOUNDING_SIM_LINEAGE'});
 const manifest=fabric.manifest('sim-pp-agent');
 const g=new OrionPerceptionFolderGraph({root});
 const scrollBefore=fs.readFileSync(crew.scrollBookFile,'utf8'),
   chapterBefore=fs.readFileSync(crew.chapterBookFile,'utf8');
 const view=g.projectAuthoritativeCrew({crewHouse:crew,agentStateFabric:fabric,maxActive:4});
 assert.equal(view.authority,'EXISTING_ORION_CREW_HOUSE_ONLY');
 assert.equal(view.chapterCount,1);
 assert.equal(view.scrollCount,1);
 assert.equal(view.identitiesCreated,0);
 assert.equal(view.recordsModified,0);
 assert.equal(view.agentProcessesSpawned,0);
 const agent=view.active.find(x=>x.type==='SCROLL');
 assert.equal(agent.scrollNumber,'0045');
 assert.equal(agent.durableIdentityId,prior.durableIdentityId);
 assert.equal(agent.chapterNumber,'0032');
 assert.equal(agent.state,'RESTING');
 assert.equal(agent.agentId,manifest.agentId);
 assert.equal(agent.savedMemory.readback,'LOCAL_AGENT_FABRIC_MANIFEST_ONLY');
 assert.equal(agent.savedMemory.checkpointContentsLoaded,false);
 assert.deepEqual(fs.readFileSync(crew.scrollBookFile,'utf8'),scrollBefore);
 assert.deepEqual(fs.readFileSync(crew.chapterBookFile,'utf8'),chapterBefore);
});
test('source read projection rejects conflicting founding identities and absent Chapters',t=>{
 const g=fixture(t),broken={scrollBook:()=>({pledges:[
   {scrollNumber:'0001',currentChapterNumber:'0009'}]}),
   chapterBook:()=>({chapters:[]})};
 assert.throws(()=>g.projectAuthoritativeCrew({crewHouse:broken}),/MISSING_CHAPTER/);
 assert.throws(()=>g.projectAuthoritativeCrew({crewHouse:{
   scrollBook:()=>({pledges:[]}),
   chapterBook:()=>({chapters:[{chapterNumber:'0009'},{chapterNumber:'0009'}]})
 }}),/DUPLICATE_OR_INVALID_AUTHORITATIVE_CHAPTER/);
});
test('authoritative Crew projection refuses a mismatched AgentStateFabric identity without changing Crew Books',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'orion-manifest-identity-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const {OrionCrewHouse}=require('../packages/core/src/orion-crew-house.cjs');
 const {AgentStateFabric}=require('../packages/core/src/agent-state-fabric.cjs');
 const crew=new OrionCrewHouse({root}),fabric=new AgentStateFabric({root});
 crew.registerChapter({chapterNumber:'0032',name:'Founding Office'});
 crew.registerPledge({scrollNumber:'0045',name:'Original Agent',status:'RESTING',
  metadata:{agentId:'frozen-identity-001'}});
 crew.assignPledge({scrollNumber:'0045',chapterNumber:'0032',reason:'ORIGINAL_LINEAGE'});
 const manifest=fabric.manifest('frozen-identity-001');
 const file=path.join(fabric.root,'frozen-identity-001','manifest.json');
 const beforeScroll=fs.readFileSync(crew.scrollBookFile,'utf8');
 const beforeChapter=fs.readFileSync(crew.chapterBookFile,'utf8');
 fs.writeFileSync(file,JSON.stringify({...manifest,agentId:'an-unrelated-agent'}));
 const g=new OrionPerceptionFolderGraph({root});
 assert.throws(()=>g.projectAuthoritativeCrew({crewHouse:crew,agentStateFabric:fabric}),
  /FABRIC_PROJECTION_AGENT_IDENTITY_MISMATCH_PRESERVED/);
 assert.equal(fs.readFileSync(crew.scrollBookFile,'utf8'),beforeScroll);
 assert.equal(fs.readFileSync(crew.chapterBookFile,'utf8'),beforeChapter);
 assert.equal(g.status().residentAgentProcessesStarted,0);
});
