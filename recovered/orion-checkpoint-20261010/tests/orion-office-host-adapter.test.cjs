'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {OrionCrewHouse}=require('../packages/core/src/orion-crew-house.cjs');
const {OrionCrewDelegation}=require('../packages/core/src/orion-crew-delegation.cjs');
const {OrionTaskEngine}=require('../packages/core/src/orion-task-engine.cjs');
const {AgentStateFabric}=require('../packages/core/src/agent-state-fabric.cjs');
const {CapabilityBus}=require('../packages/core/src/capability-bus.cjs');
const {OrionOfficeHostAdapter,CAPABILITY}=require('../packages/core/src/orion-office-host-adapter.cjs');
function setup(t,{grant=true,ppAllowed=true,route=true,executor=true}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'orion-office-host-integration-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const allowed=path.join(root,'approved-incoming');fs.mkdirSync(allowed);
 const outside=path.join(root,'outside');fs.mkdirSync(outside);
 const inputFile=path.join(allowed,'new-note.txt');
 fs.writeFileSync(inputFile,'Source bytes from a new Office document');
 const crew=new OrionCrewHouse({root});
 crew.registerChapter({chapterNumber:'0032',name:'Founding Office'});
 crew.registerChapter({chapterNumber:'0033',name:'Sub Office',parentChapterNumber:'0032'});
 crew.registerPledge({scrollNumber:'0045',birthNumber:'70001',name:'Custodian',
  metadata:{agentId:'custodian',stewardedPerceptionPointIds:['PP1']}});
 crew.assignPledge({scrollNumber:'0045',chapterNumber:'0033'});
 const engine=new OrionTaskEngine({root,hardwareState:()=>({heavyWorkPermitted:true,
  eDrive:{present:true,health:'healthy',freeBytes:100*1024**3}})});
 const fabric=new AgentStateFabric({root});
 const delegation=new OrionCrewDelegation({root,crewHouse:crew});
 const policy={
  evaluate:({capabilityId,agentId,taskId,risk,deviceId,unattended})=>
   (grant&&unattended&&agentId&&taskId&&deviceId==='owned-machine'&&
    ['LOCAL_MUTATION','READ_ONLY'].includes(risk))?
    {ok:true,capabilityId,agentId,taskId,risk,deviceId,
     grantId:'fixture-signature-verified-grant',
     source:'SYNTHETIC_OWNER_SIGNED_POLICY_VERIFIER'}:
    {ok:false,reason:'NO_ACTIVE_OWNER_SIGNED_GRANT'}
 };
 const bus=new CapabilityBus({standingAuthority:policy});
 let executions=0;
 const host=new OrionOfficeHostAdapter({
  root,crewHouse:crew,taskEngine:engine,agentStateFabric:fabric,delegation,
  capabilityBus:bus,standingAuthority:policy,allowedSourceRoots:[allowed],
  deviceId:'owned-machine',
  verifyOfficeScope:({chapterNumber,perceptionPointId})=>ppAllowed&&
   chapterNumber==='0033'&&perceptionPointId==='PP1',
  decideDisposition:route?()=>({route:'EXISTING_PLEDGE',scrollNumber:'0045',
   why:'Project steward is registered to PP1 and source needs native review',
   evidenceRefs:['source:registered-PP1']}):undefined,
  invokePledge:executor?async ctx=>{executions++;
   return {accepted:true,executionReceiptId:'native-'+executions,
    agentId:ctx.agentId,sourceSha256:ctx.sourceSha256,
    evidenceRefs:['sha256:'+ctx.sourceSha256],
    growthCandidates:[{kind:'POTENTIAL_SUB_OFFICE',qualified:false}],
    analysis:{who:'UNVERIFIED_AUTHOR',what:'New PP document',
     where:ctx.chapterNumber,when:'UNKNOWN_ORIGIN_TIME',
     why:'Test source should be evaluated',how:'Signed capability document route'}};}:undefined
 });
 const registration=host.register();
 const context={unattended:true,agentId:'internal-librarian',
  taskId:'owner-delegated-source-arrival-001',deviceId:'owned-machine'};
 const input={chapterNumber:'0033',perceptionPointId:'PP1',
  documentId:'source-1',sourcePath:inputFile};
 return {root,allowed,outside,inputFile,crew,engine,fabric,
  host,bus,input,context,registration,executions:()=>executions};
}
test('native CapabilityBus only routes a signed scoped Office document, queues one durable Pledge and preserves derived bytes',async t=>{
 const x=setup(t);
 assert.equal(x.registration.independentWatcherInstalled,false);
 assert.equal(x.registration.additionalOrionStarted,false);
 const result=await x.bus.call(CAPABILITY,x.input,x.context);
 assert.equal(result.output.status,'DISPATCHED_TO_PLEDGE');
 assert.equal(result.invocation.authority.source,'OWNER_SIGNED_STANDING_GRANT');
 assert.equal(result.output.processingComplete,false);
 assert.equal(x.executions(),0);
 assert.equal(x.engine.task(result.output.executionReceiptId).status,'READY');
 const repeated=await x.bus.call(CAPABILITY,x.input,x.context);
 assert.equal(repeated.output.status,'ALREADY_DISPATCHED');
 assert.equal(repeated.output.executionReceiptId,result.output.executionReceiptId);
 assert.equal(x.engine.list().filter(z=>z.kind==='ORION_OFFICE_DOCUMENT_REVIEW').length,1);
 const task=await x.engine.execute(x.engine.task(result.output.executionReceiptId));
 assert.equal(task.status,'COMPLETE');
 assert.equal(x.executions(),1);
 const third=await x.bus.call(CAPABILITY,x.input,x.context);
 assert.equal(third.output.status,'ALREADY_PROCESSED');
 assert.equal(third.output.processingComplete,true);
 const files=x.host.tree.inventory().documents;
 assert.equal(files.length,2);
 assert.equal(files.filter(z=>z.classification==='SOURCE_COPY').length,1);
 assert.equal(files.filter(z=>z.classification==='DERIVED').length,1);
 assert.equal(fs.readFileSync(x.inputFile,'utf8'),'Source bytes from a new Office document');
 assert.equal(x.crew.scrollBook().pledges.length,1);
});
test('without signed unattended approval, event never enters Office storage or spawns Pledge',async t=>{
 const x=setup(t,{grant:false});
 await assert.rejects(()=>x.bus.call(CAPABILITY,x.input,x.context),/NO_ACTIVE_OWNER_SIGNED_GRANT/);
 assert.equal(x.host.tree.events().length,0);
 assert.equal(x.engine.list().length,0);
 assert.equal(x.crew.scrollBook().pledges.length,1);
});
test('unauthorized source path and unrelated PP lineage cannot be smuggled through even with valid grant',async t=>{
 const x=setup(t);
 const external=path.join(x.outside,'elsewhere.txt');fs.writeFileSync(external,'from outside');
 await assert.rejects(()=>x.bus.call(CAPABILITY,{...x.input,sourcePath:external},x.context),
  /OUTSIDE_APPROVED_ROOT/);
 await assert.rejects(()=>x.bus.call(CAPABILITY,{...x.input,perceptionPointId:'OTHER-PP'},x.context),
  /SCOPED_PROJECT_CUSTODY_REQUIRED/);
 assert.equal(x.host.tree.events().length,0);
});
test('forgeable direct call is not an alternate path around freshly evaluated signed authority',t=>{
 const x=setup(t,{grant:false});
 assert.throws(()=>x.host.arrived(x.input,{
  ...x.context,delegation:{ok:true,capabilityId:CAPABILITY,risk:'LOCAL_MUTATION',
   grantId:'fixture-signature-verified-grant'}}),/GRANT_NOT_FRESHLY_VERIFIED/);
 assert.equal(x.host.tree.events().length,0);
});
test('missing Orion cognitive disposition preserves authorized source, not fake autonomous understanding',async t=>{
 const x=setup(t,{route:false});
 const r=await x.bus.call(CAPABILITY,x.input,x.context);
 assert.equal(r.output.status,'WAITING_DEPENDENCY');
 assert.equal(r.output.reason,'ORION_INTAKE_DECISION_ENGINE_NOT_WIRED');
 assert.equal(x.host.tree.inventory().documents.length,1);
 assert.equal(x.engine.list().length,0);
});
test('unwired Pledge executor returns durable queued work and then preserves native dependency on execution',async t=>{
 const x=setup(t,{executor:false});
 const res=await x.bus.call(CAPABILITY,x.input,x.context);
 assert.equal(res.output.status,'DISPATCHED_TO_PLEDGE');
 const blocked=await x.engine.execute(x.engine.task(res.output.executionReceiptId));
 assert.equal(blocked.status,'WAITING_DEPENDENCY');
 assert.match(blocked.lastResult.reason,/EXECUTOR_NOT_WIRED/);
 assert.equal((await x.bus.call(CAPABILITY,x.input,x.context)).output.status,'ALREADY_DISPATCHED');
});
