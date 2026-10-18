'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {create,source,project,hash}=require('../apps/desktop/src/orion-fluid-brain-3d.js');
function graph(){
 return {source:{headHash:'observed-source-head',eventCount:18},
  nodes:[{id:'root',type:'OwnerRoot',status:'ACTIVE'},
   {id:'agent:doc',type:'Agent',agentId:'doc',status:'DORMANT'},
   {id:'task:1',type:'Task',status:'RUNNING',taskId:'1'}],
  edges:[{from:'task:1',to:'agent:doc',type:'RESPONSIBLE_AGENT'},
   {from:'agent:doc',to:'root',type:'REGISTERED_UNDER_ROOT'}]};
}
const crew={chapterBook:{chapters:[{chapterNumber:'0032',name:'Memory Office',parentChapterNumber:null},
 {chapterNumber:'0033',name:'PP Sub Office',parentChapterNumber:'0032'}]},
 scrollBook:{pledges:[{scrollNumber:'0045',birthNumber:'70001',status:'RESTING',
  currentChapterNumber:'0033',metadata:{agentId:'doc'}}]}};
test('3D brain shows only genuine ledger/CrewHouse nodes including Scroll/Birth and nested Chapter lineage',()=>{
 const merged=source(graph(),crew);
 assert.equal(merged.hash,'observed-source-head');
 assert.equal(merged.eventCount,18);
 assert.equal(merged.nodes.length,6);
 assert.equal(merged.edges.length,5);
 assert.ok(merged.nodes.some(n=>n.type==='Pledge'&&n.scrollNumber==='0045'&&n.birthNumber==='70001'));
 assert.ok(merged.nodes.some(n=>n.type==='Chapter'&&n.chapterNumber==='0033'));
 assert.ok(merged.edges.some(e=>e.from==='chapter:0033'&&e.to==='chapter:0032'&&e.type==='CHAPTER_PARENT'));
 assert.ok(merged.edges.some(e=>e.from==='scroll:0045'&&e.to==='agent:doc'&&e.type==='PLEDGE_AGENT_IDENTITY'));
 assert.ok(merged.edges.some(e=>e.from==='scroll:0045'&&e.to==='chapter:0033'));
});
test('3D view cannot invent Scrolls/Chapters from strings or unconstrained graph edges',()=>{
 const spoof={...crew,chapterBook:{chapters:[...crew.chapterBook.chapters,{chapterNumber:'../escape'}]},
 scrollBook:{pledges:[...crew.scrollBook.pledges,{scrollNumber:'not-born',birthNumber:'123'}]}};
 const g=source(graph(),spoof);
 assert.equal(g.nodes.length,6);
 assert.equal(g.nodes.some(n=>n.id.includes('escape')),false);
 assert.equal(g.edges.some(e=>e.to==='missing-id'),false);
 assert.equal(source({nodes:[],edges:[{from:'ghost',to:'root'}]}).nodes.length,0);
});
test('perspective is real x/y/z with stable deterministic seeded coordinates',()=>{
 const a=project([2,1,4],0,0,14),b=project([2,1,4],1.2,.4,14);
 assert.notEqual(a.x,b.x);assert.notEqual(a.y,b.y);
 assert.ok(Number.isFinite(a.depth)&&Number.isFinite(b.depth));
 assert.equal(hash('scroll:0045'),hash('scroll:0045'));
 assert.notEqual(hash('scroll:0045'),hash('scroll:0046'));
});
function mockGl(){
 const calls={points:0,lines:0};
 const gl={VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,
  ARRAY_BUFFER:5,FLOAT:6,DYNAMIC_DRAW:7,POINTS:8,LINES:9,
  BLEND:10,SRC_ALPHA:11,ONE_MINUS_SRC_ALPHA:12,
  COLOR_BUFFER_BIT:13,DEPTH_BUFFER_BIT:14,
  createShader:()=>({}),shaderSource:()=>{},compileShader:()=>{},
  getShaderParameter:()=>true,createProgram:()=>({}),attachShader:()=>{},linkProgram:()=>{},
  getProgramParameter:()=>true,createBuffer:()=>({}),
  getAttribLocation:(_p,n)=>({p:0,c:1,size:2}[n]),getUniformLocation:()=>({}),
  viewport:()=>{},clearColor:()=>{},clear:()=>{},enable:()=>{},blendFunc:()=>{},
  useProgram:()=>{},bindBuffer:()=>{},enableVertexAttribArray:()=>{},
  vertexAttribPointer:()=>{},uniform1f:()=>{},bufferData:()=>{},
  drawArrays:(kind)=>{if(kind===8)calls.points++;if(kind===9)calls.lines++;}};
 return {gl,calls};
}
test('GPU renderer starts only for available WebGL and animates real snapshot without touching agent state',()=>{
 const {gl,calls}=mockGl();const events={},canvas={
  clientWidth:850,clientHeight:520,style:{},width:0,height:0,
  getContext:()=>gl,setAttribute:()=>{},className:'',
  addEventListener:(name,fn)=>events[name]=fn,
  getBoundingClientRect:()=>({left:0,top:0,width:850,height:520}),remove:()=>{}};
 const ownerDocument={hidden:false,createElement:()=>canvas},host={ownerDocument,insertBefore:()=>{}};
 const oldWindow=global.window,oldRequest=global.requestAnimationFrame,oldCancel=global.cancelAnimationFrame;
 let nextFrame=null;global.window={devicePixelRatio:1};
 global.requestAnimationFrame=f=>{nextFrame=f;return 1;};
 global.cancelAnimationFrame=()=>{};
 try{
  const brain=create({container:host});
  assert.equal(brain.available,true);
  const topology=brain.setGraph(graph(),crew);
  assert.equal(topology.syntheticNodes,0);
  assert.equal(topology.nodes,6);
  assert.equal(topology.edges,5);
  assert.equal(brain.start(),true);
  assert.equal(brain.start(),false);
  nextFrame(10);
  assert.equal(calls.points,1);
  assert.equal(calls.lines,1);
  assert.equal(brain.state.screen.length,6);
  const original=graph().nodes[1];
  assert.equal(original.status,'DORMANT');
  brain.stop();
  brain.destroy();
 }finally{
  global.window=oldWindow;global.requestAnimationFrame=oldRequest;global.cancelAnimationFrame=oldCancel;
 }
});
test('2D fallback remains available when WebGL cannot initialize, and source UI includes toggle',()=>{
 const canvas={getContext:()=>null,setAttribute:()=>{},addEventListener:()=>{}},
  ownerDocument={createElement:()=>canvas},host={ownerDocument,insertBefore:()=>{}};
 const brain=create({container:host});
 assert.equal(brain.available,false);
 assert.equal(brain.start(),false);
 assert.equal(brain.setGraph(graph(),crew).nodes,6);
 const root=path.resolve(__dirname,'..');
 const js=fs.readFileSync(path.join(root,'apps/desktop/src/orion-brain.js'),'utf8');
 const html=fs.readFileSync(path.join(root,'apps/desktop/src/orion-brain.html'),'utf8');
 assert.ok(html.includes('src="orion-fluid-brain-3d.js"'));
 assert.ok(js.includes('fluidBrain.setGraph(data.workingGraph||{},data.crew||{})'));
 assert.ok(js.includes('fluidSwitch.onclick'));
 assert.ok(js.includes('fluidBrain.start()'));
 assert.ok(js.includes('fluidBrain.stop()'));
 brain.destroy();
});
