'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {overlay}=require('../packages/core/src/orion-learning-brain-overlay.cjs');
const renderer=require('../apps/desktop/src/orion-fluid-brain-3d.js');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const base=()=>({source:{headHash:'real-ledger-hash-not-invented',eventCount:41},nodes:[
 {id:'root',type:'OwnerRoot',status:'ACTIVE'},
 {id:'agent:librarian',type:'Agent',status:'ACTIVE'}
],edges:[{type:'REGISTERED_UNDER_ROOT',from:'agent:librarian',to:'root'}]});
test('real durable learned skill becomes an immediate 3D-visible node without process restart or synthetic agent',()=>{
 const graph=base(),skills=[{id:'skill-1',name:'Read email safely',state:'CANDIDATE',
  skillHash:'hash-from-registry',createdAt:'2026-10-10T14:00:00Z'}];
 const registry={list:()=>skills};
 const first=overlay({workingGraph:graph,skillRegistry:registry});
 assert.equal(first.workingGraph.nodes.length,3);
 assert.equal(first.workingGraph.source.headHash,graph.source.headHash);
 assert.equal(first.workingGraph.nodes[2].status,'CANDIDATE_RECORDED');
 assert.equal(first.workingGraph.nodes[2].synthetic,false);
 skills[0]={...skills[0],state:'PROMOTED',promotedAt:'2026-10-10T15:00:00Z'};
 const second=overlay({workingGraph:graph,skillRegistry:registry});
 assert.equal(second.workingGraph.nodes[2].status,'PROMOTED_RECORDED');
 assert.equal(second.workingGraph.learningOverlay.executionNotInferred,true);
 assert.equal(second.learning.canAuthorizeNewCapabilities,false);
 const prior=renderer.source(first.workingGraph,{});
 const next=renderer.source(second.workingGraph,{});
 assert.deepEqual(prior.nodes.map(n=>n.id),next.nodes.map(n=>n.id));
 assert.ok(next.nodes.some(n=>n.id==='learning:skill:skill-1'&&n.status==='PROMOTED_RECORDED'));
 assert.ok(next.edges.some(e=>e.from==='learning:skill:skill-1'&&e.to==='root'));
 assert.equal(graph.nodes.length,2);
 assert.equal(graph.edges.length,1);
});
test('registered dynamic capability source hash and probation identity are verified, not assumed from on-disk file',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'orion-3d-learning-proof-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'known.cjs'),src=Buffer.from('module.exports={};\n');fs.writeFileSync(file,src);
 const loaded=[{id:'orion.generated.training-a',file,sourceSha256:sha(src),risk:'READ_ONLY',description:'Qualified training only'}];
 const status={active:new Map([['orion.generated.training-a',{sourceHash:sha(src)}]])};
 const registry={status:()=>({loaded})};
 const first=overlay({workingGraph:base(),generatedRegistry:registry,upgradeAdoption:status});
 const verified=first.workingGraph.nodes.find(x=>x.type==='GeneratedCapability');
 assert.equal(verified.status,'TRAINING_PROBATION_RECORDED');
 assert.equal(verified.sourceIntegrityVerified,true);
 assert.equal(verified.ownerAuthorizedExecutionNotInferred,true);
 fs.writeFileSync(file,'module.exports={tampered:true};');
 const second=overlay({workingGraph:base(),generatedRegistry:registry,upgradeAdoption:status});
 assert.equal(second.workingGraph.nodes.find(x=>x.type==='GeneratedCapability').status,'SOURCE_INTEGRITY_UNVERIFIED');
 assert.equal(second.workingGraph.nodes.find(x=>x.type==='GeneratedCapability').sourceIntegrityVerified,false);
});
test('bounded graph only accepts recorded registry identities and no imaginary skill birth',()=>{
 const registry={list:()=>Array.from({length:45},(_,i)=>({id:'x'+i,name:'n',state:'PROMOTED',skillHash:'h'}))};
 const result=overlay({workingGraph:base(),skillRegistry:registry,maxSkillNodes:8});
 assert.equal(result.workingGraph.nodes.length,10);
 assert.equal(result.workingGraph.learningOverlay.addedNodeCount,8);
 assert.equal(result.workingGraph.nodes.filter(x=>x.type==='LearnedSkill').length,8);
 assert.ok(result.workingGraph.nodes.every(x=>!Object.hasOwn(x,'birthNumber')));
 assert.throws(()=>overlay({workingGraph:base(),maxSkillNodes:100}),/BOUNDS_REQUIRED/);
});
test('false graph, no real causal source and ghost skill cannot be labeled live',()=>{
 const g=base();delete g.source.headHash;
 assert.throws(()=>overlay({workingGraph:g}),/CAUSAL_SOURCE_REQUIRED/);
 assert.throws(()=>overlay({workingGraph:{nodes:[],edges:[]}}),/CAUSAL_SOURCE_REQUIRED/);
 const result=overlay({workingGraph:base(),skillRegistry:{list:()=>[
  {name:'bad',state:'PROMOTED'},{id:'foo',name:'x',state:'FABRICATED'},
  {id:'good',name:'g',state:'PROMOTED',skillHash:'registry-stated'}
 ]}});
 assert.equal(result.learning.graphLearningNodes,1);
 assert.equal(result.workingGraph.nodes.at(-1).id,'learning:skill:good');
});
