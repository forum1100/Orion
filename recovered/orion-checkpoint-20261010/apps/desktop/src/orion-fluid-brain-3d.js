'use strict';
// Orion live GPU neural volume. The authoritative SelfGraph is the only source
// of identities/edges/status. 3D is a visualization, NOT new agent cognition.
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.OrionFluidBrain3D=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 const TAU=2*Math.PI;
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const hash=s=>{let x=2166136261;for(const c of String(s)){x^=c.charCodeAt(0);x=Math.imul(x,16777619);}return x>>>0;};
 const vec=(id,type)=>{const h=hash(id),a=(h%4096)/4096*TAU,z=(((h>>>12)%2048)/1024-1);
   const r=type==='OwnerRoot'?0:type==='Agent'?2.4:type==='Task'?3.5:4.9;
   return [r*Math.sqrt(1-z*z)*Math.cos(a),r*Math.sqrt(1-z*z)*Math.sin(a),r*z];};
 const source=(g={},crew={})=>{
  const nodes=Array.isArray(g.nodes)?g.nodes.filter(n=>n&&typeof n.id==='string'&&n.id.length<=256):[];
  const seen=new Set(),out=[];
  for(const n of nodes){if(seen.has(n.id))continue;seen.add(n.id);out.push(n);}
  // Only materialize genuine CrewHouse registry identifiers. The graphic must
  // not infer a Chapter/Scroll from an arbitrary folder or task label.
  const chapters=crew?.chapterBook?.chapters||[],pledges=crew?.scrollBook?.pledges||[];
  for(const c of chapters){if(!/^[0-9]{4,}$/.test(String(c.chapterNumber||'')))continue;
   const id='chapter:'+c.chapterNumber;if(seen.has(id))continue;seen.add(id);
   out.push({id,type:'Chapter',chapterNumber:c.chapterNumber,name:c.name,
    status:c.status||'RECORDED',parentChapterNumber:c.parentChapterNumber||null,
    evidenceSource:'CREW_HOUSE_CHAPTER_BOOK'});}
  for(const p of pledges){if(!/^[0-9]{4,}$/.test(String(p.scrollNumber||'')))continue;
   const id='scroll:'+p.scrollNumber;if(seen.has(id))continue;seen.add(id);
   out.push({id,type:'Pledge',scrollNumber:p.scrollNumber,
    birthNumber:p.birthNumber||null,agentId:p.metadata?.agentId||null,
    status:p.status||'RECORDED',chapterNumber:p.currentChapterNumber||null,
    evidenceSource:'CREW_HOUSE_SCROLL_BOOK'});}
  const edges=(Array.isArray(g.edges)?g.edges:[]).filter(e=>e&&seen.has(e.from)&&seen.has(e.to)&&e.from!==e.to);
  for(const c of chapters){const from='chapter:'+c.chapterNumber;
   const to=c.parentChapterNumber?'chapter:'+c.parentChapterNumber:null;
   if(to&&seen.has(from)&&seen.has(to))edges.push({from,to,type:'CHAPTER_PARENT',source:'CREW_HOUSE'});}
  for(const p of pledges){const from='scroll:'+p.scrollNumber,to='chapter:'+p.currentChapterNumber;
   if(seen.has(from)&&seen.has(to))edges.push({from,to,type:'PLEDGE_ASSIGNED_TO_CHAPTER',source:'CREW_HOUSE'});
   const ai=p.metadata?.agentId?'agent:'+p.metadata.agentId:null;
   if(ai&&seen.has(from)&&seen.has(ai))edges.push({from,to:ai,type:'PLEDGE_AGENT_IDENTITY',source:'CREW_HOUSE'});
  }
  return {nodes:out,edges,hash:String(g.source?.headHash||''),eventCount:Number(g.source?.eventCount||0)};
 };
 function project(v,yaw=0,pitch=0,zoom=15){
  const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  const x=v[0]*cy-v[2]*sy,z=v[0]*sy+v[2]*cy,y=v[1]*cp-z*sp;
  const depth=v[1]*sp+z*cp;
  const perspective=clamp(zoom/(zoom+depth+8),.25,3);
  return {x:x*perspective,y:y*perspective,depth,scale:perspective};
 }
 const palette=n=>n.type==='OwnerRoot'?[.73,.54,1]:n.type==='Agent'?[.3,.95,.7]:
  n.type==='Task'?[1,.72,.36]:n.type==='Failure'?[1,.3,.4]:
  n.type==='LearnedSkill'?[.45,1,.55]:
  n.type==='GeneratedCapability'?(n.sourceIntegrityVerified?[.94,.69,1]:[1,.24,.3]):
  n.type==='Project'||n.type==='ChatWorkspace'?[.6,.5,1]:[.35,.76,1];
 function create({container,onPick=()=>{},canvas=null,graphLimit=280}={}){
  if(!container)throw Error('ORION_FLUID_CANVAS_HOST_REQUIRED');
  const doc=container.ownerDocument||document;
  const c=canvas||doc.createElement('canvas');
  c.className='orion-fluid-3d-canvas';c.setAttribute('aria-label','Interactive 3D projection of live Orion causal SelfGraph');
  if(!canvas)container.insertBefore(c,container.firstChild);
  let gl=null;
  try{gl=c.getContext('webgl2',{antialias:true,alpha:true,depth:true,preserveDrawingBuffer:false})||
    c.getContext('webgl',{antialias:true,alpha:true,depth:true,preserveDrawingBuffer:false});}catch{}
  const S={canvas:c,gl,mode:gl?'GPU_3D':'UNAVAILABLE',nodes:new Map(),edges:[],yaw:.4,pitch:.23,
   zoom:13,last:0,active:false,anim:null,drag:null,dead:false,screen:[],graphHash:'',
   eventCount:0,selected:null,updateCount:0};
  const gpu={};
  function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
   if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('ORION_3D_SHADER_ERROR:'+gl.getShaderInfoLog(s));return s;}
  if(gl){
   try{
    const v=shader(gl.VERTEX_SHADER,'attribute vec3 p; attribute vec3 c; attribute float size; uniform float aspect; varying vec3 color; void main(){gl_Position=vec4(p.x/aspect,p.y,p.z,1.);gl_PointSize=size;color=c;}');
    const f=shader(gl.FRAGMENT_SHADER,'precision mediump float; varying vec3 color; uniform float points; void main(){if(points>0.5){float r=length(gl_PointCoord-.5);if(r>.5)discard;float a=1.-smoothstep(.30,.50,r);gl_FragColor=vec4(color,a);}else{gl_FragColor=vec4(color,.58);}}');
    gpu.program=gl.createProgram();gl.attachShader(gpu.program,v);gl.attachShader(gpu.program,f);gl.linkProgram(gpu.program);
    if(!gl.getProgramParameter(gpu.program,gl.LINK_STATUS))throw Error('ORION_3D_SHADER_LINK_FAILED');
    gpu.buffer=gl.createBuffer();gpu.aPos=gl.getAttribLocation(gpu.program,'p');
    gpu.aColor=gl.getAttribLocation(gpu.program,'c');gpu.aSize=gl.getAttribLocation(gpu.program,'size');
    gpu.aspect=gl.getUniformLocation(gpu.program,'aspect');gpu.points=gl.getUniformLocation(gpu.program,'points');
   }catch(error){S.mode='UNAVAILABLE';S.error=String(error.message||error);gl=null;S.gl=null;}
  }
  function setGraph(raw,crew){
   const g=source(raw,crew),ordered=[...g.nodes].sort((a,b)=>{
    const rank=n=>n.type==='OwnerRoot'?0:n.status==='RUNNING'||n.status==='ACTIVE'?1:n.type==='Agent'?2:n.type==='Task'?3:4;
    return rank(a)-rank(b)||a.id.localeCompare(b.id);
   }).slice(0,graphLimit),kept=new Set(ordered.map(n=>n.id));
   const next=new Map();
   for(const n of ordered){
    const prior=S.nodes.get(n.id);
    next.set(n.id,prior?{...prior,data:n}:{id:n.id,data:n,pos:vec(n.id,n.type),vel:[0,0,0]});
   }
   S.nodes=next;S.edges=g.edges.filter(e=>kept.has(e.from)&&kept.has(e.to)).slice(0,graphLimit*5);
   S.graphHash=g.hash;S.eventCount=g.eventCount;S.updateCount++;
   return {nodes:S.nodes.size,edges:S.edges.length,sourceEventCount:g.eventCount,
    sourceHeadHash:g.hash,syntheticNodes:0,knownNodeLimit:graphLimit};
  }
  function physics(dt){
   const a=[...S.nodes.values()],force=new Map(a.map(n=>[n.id,[0,0,0]]));
   // Bounded density + causal link elasticity; a fluid layout is never used
   // as evidence that an agent ran or a new event occurred.
   for(let i=0;i<a.length;i++){
    const p=a[i],f=force.get(p.id);
    for(let k=0;k<3;k++)f[k]-=p.pos[k]*(p.data.type==='OwnerRoot'?.25:.025);
    const loops=Math.min(a.length,130);
    for(let j=0;j<loops;j++){const q=a[(i+j+1)%a.length];if(q.id===p.id)continue;
      const d=p.pos.map((x,k)=>x-q.pos[k]),s=d.reduce((v,x)=>v+x*x,0)+.55;
      const repel=Math.min(.14,.028/(s*Math.sqrt(s)));
      for(let k=0;k<3;k++)f[k]+=d[k]*repel;
    }
   }
   for(const e of S.edges){const p=S.nodes.get(e.from),q=S.nodes.get(e.to);if(!p||!q)continue;
    const d=p.pos.map((x,k)=>x-q.pos[k]),len=Math.max(.001,Math.hypot(...d));
    const spring=clamp((len-2.5)*.005,-.025,.025);
    for(let k=0;k<3;k++){force.get(p.id)[k]-=d[k]*spring;force.get(q.id)[k]+=d[k]*spring;}
   }
   for(const n of a){const f=force.get(n.id);
    for(let k=0;k<3;k++){n.vel[k]=clamp((n.vel[k]+f[k]*dt)*.89,-.035,.035);
      n.pos[k]=clamp(n.pos[k]+n.vel[k]*dt,-9,9);}
   }
  }
  function render(){
   if(!gl||S.dead||!S.active)return;
   const w=Math.max(1,Math.floor(c.clientWidth*(Math.min(2,window.devicePixelRatio||1)))),
     h=Math.max(1,Math.floor(c.clientHeight*(Math.min(2,window.devicePixelRatio||1))));
   if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
   gl.viewport(0,0,w,h);gl.clearColor(.016,.028,.055,.98);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
   gl.useProgram(gpu.program);gl.bindBuffer(gl.ARRAY_BUFFER,gpu.buffer);
   gl.enableVertexAttribArray(gpu.aPos);gl.enableVertexAttribArray(gpu.aColor);gl.enableVertexAttribArray(gpu.aSize);
   gl.vertexAttribPointer(gpu.aPos,3,gl.FLOAT,false,28,0);gl.vertexAttribPointer(gpu.aColor,3,gl.FLOAT,false,28,12);
   gl.vertexAttribPointer(gpu.aSize,1,gl.FLOAT,false,28,24);gl.uniform1f(gpu.aspect,w/h);
   const coords=new Map();const scale=1/9;
   for(const n of S.nodes.values()){const p=project(n.pos,S.yaw,S.pitch,S.zoom),v=[p.x*scale,p.y*scale,p.depth/100];
    coords.set(n.id,{v,p});}
   const eVertices=[];
   for(const e of S.edges){const a=coords.get(e.from),b=coords.get(e.to);if(!a||!b)continue;
    const active=[S.nodes.get(e.from)?.data?.status,S.nodes.get(e.to)?.data?.status].some(s=>s==='RUNNING'||s==='ACTIVE');
    const color=active?[.35,.85,.82]:[.15,.32,.49];
    for(const v of [a.v,b.v])eVertices.push(...v,...color,1);
   }
   gl.uniform1f(gpu.points,0);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(eVertices),gl.DYNAMIC_DRAW);
   gl.drawArrays(gl.LINES,0,eVertices.length/7);
   const nodeVerts=[];S.screen=[];
   for(const n of S.nodes.values()){
    const pt=coords.get(n.id),c=palette(n.data);
    const active=n.data.status==='RUNNING'||n.data.status==='ACTIVE';
    const size=clamp((n.data.type==='OwnerRoot'?19:active?14:9)*pt.p.scale,4,38);
    nodeVerts.push(...pt.v,...c,size);
    S.screen.push({id:n.id,x:(pt.v[0]/(w/h)+1)*.5*w,y:(1-pt.v[1])*.5*h,r:size});
   }
   gl.uniform1f(gpu.points,1);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(nodeVerts),gl.DYNAMIC_DRAW);
   gl.drawArrays(gl.POINTS,0,nodeVerts.length/7);
  }
  function frame(t){if(S.dead||!S.active)return;
   const delta=clamp((t-(S.last||t))/16.67,.2,2);S.last=t;
   if(!doc.hidden){physics(delta);render();}
   S.anim=requestAnimationFrame(frame);
  }
  function start(){if(S.dead||S.active||S.mode!=='GPU_3D')return false;
   S.active=true;S.last=0;S.anim=requestAnimationFrame(frame);return true;}
  function stop(){S.active=false;if(S.anim!==null)cancelAnimationFrame(S.anim);S.anim=null;}
  function pointerDown(e){if(!S.active)return;S.drag={x:e.clientX,y:e.clientY,yaw:S.yaw,pitch:S.pitch};c.setPointerCapture?.(e.pointerId);}
  function pointerMove(e){if(!S.drag)return;S.yaw=S.drag.yaw+(e.clientX-S.drag.x)*.006;S.pitch=clamp(S.drag.pitch+(e.clientY-S.drag.y)*.005,-1.3,1.3);}
  function pointerUp(){S.drag=null;}
  function onClick(e){if(!S.active||S.drag)return;const box=c.getBoundingClientRect(),x=(e.clientX-box.left)*c.width/Math.max(1,box.width),
   y=(e.clientY-box.top)*c.height/Math.max(1,box.height);
   let best=null,dist=30*Math.min(2,window.devicePixelRatio||1);
   for(const n of S.screen){const d=Math.hypot(n.x-x,n.y-y);if(d<dist){dist=d;best=n;}}
   if(best){S.selected=best.id;onPick(S.nodes.get(best.id).data);}
  }
  c.addEventListener('pointerdown',pointerDown);c.addEventListener('pointermove',pointerMove);
  c.addEventListener('pointerup',pointerUp);c.addEventListener('pointercancel',pointerUp);
  c.addEventListener('click',onClick);
  c.addEventListener('wheel',e=>{if(!S.active)return;e.preventDefault();S.zoom=clamp(S.zoom+Math.sign(e.deltaY),7,35);},{passive:false});
  return {state:S,setGraph,start,stop,available:S.mode==='GPU_3D',
   destroy(){stop();S.dead=true;c.remove?.();},project,source};
 }
 return {create,project,source,hash};
});
