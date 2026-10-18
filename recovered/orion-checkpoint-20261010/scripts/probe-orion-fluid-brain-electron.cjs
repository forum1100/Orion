'use strict';
// Isolated Electron renderer qualification only. Creates a separate temporary
// synthetic profile, never boots the Orion production main process or vault.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
if(!app?.whenReady)throw Error('ISOLATED_ELECTRON_RUNTIME_REQUIRED');
const asar=process.argv.find(a=>a.endsWith('app.asar'));
if(!asar||!fs.existsSync(asar))throw Error('PACKAGED_ASAR_REQUIRED');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'orion-fluid-ui-probe-'));
app.setPath('userData',root);
app.commandLine.appendSwitch('disable-features','HardwareMediaKeyHandling');
app.commandLine.appendSwitch('disable-background-timer-throttling');
const receiptFile=path.join(root,'render-receipt.json');
const synthetic={
 schema:'orion-live-brain/1.4',at:new Date().toISOString(),running:true,
 health:{status:'EXECUTING'},selfHealth:{},stats:{created:3,failed:0},
 queue:[{id:'sample-task',kind:'research.cycle',status:'RUNNING',title:'SYNTHETIC qualification task'}],
 agents:[{id:'librarian',name:'SYNTHETIC Librarian',status:'ACTIVE'}],
 workingGraph:{
  source:{eventCount:25,headHash:'SYNTHETIC_NOT_REAL_LEDGER'},
  nodes:[{id:'root',type:'OwnerRoot',status:'ACTIVE'},{id:'agent:librarian',type:'Agent',status:'ACTIVE'},
   {id:'task:example',type:'Task',status:'RUNNING'}],
  edges:[{from:'root',to:'agent:librarian'},{from:'agent:librarian',to:'task:example'}]
 },
 crew:{chapterBook:{chapters:[{chapterNumber:'0032',name:'Sample Chapter'},
  {chapterNumber:'0033',name:'Sample Subchapter',parentChapterNumber:'0032'}]},
 scrollBook:{pledges:[{scrollNumber:'0045',birthNumber:'70001',currentChapterNumber:'0033',
  status:'RESTING',metadata:{agentId:'librarian'}}]}},
 telemetry:{residentTasks:1,coldTasks:0,ledgerEvents:25},
 bootstrapTrust:{ledger:{ok:true}},visualTheme:{},queueTriage:{},corpus:{},resources:{},
 healthTelemetry:{},research:{},improvement:{},hardware:{},wifi:{},
 trace:[],currentTask:null
};
const json=JSON.stringify(synthetic);
const preload=path.join(root,'preload.cjs');
fs.writeFileSync(preload,`const {contextBridge}=require('electron'); const synthetic=JSON.parse(${JSON.stringify(JSON.stringify(synthetic))});contextBridge.exposeInMainWorld('dt',{orionBrainSnapshot:async()=>synthetic,rendererReady:()=>true});`);
let done=false;
function finish(receipt,code){
 if(done)return;done=true;try{fs.writeFileSync(receiptFile,JSON.stringify({
  schema:'orion-fluid-ui-packaged-probe/1.0',at:new Date().toISOString(),
  packagedAsar:asar,syntheticDataOnly:true,activeVaultOpened:false,
  productionAppStarted:false,...receipt},null,2));}catch{}
 console.log('ORION_FLUID_UI_RECEIPT='+receiptFile);
 console.log('ORION_FLUID_UI_RESULT='+JSON.stringify(receipt));
 setTimeout(()=>{app.exit(code)},100);
}
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 const win=new BrowserWindow({width:1180,height:820,show:true,backgroundColor:'#03050b',
  webPreferences:{preload,contextIsolation:true,nodeIntegration:false,sandbox:true}});
 let fail=null;
 win.webContents.on('console-message',(_,level,message)=>{if(level>=2)console.error('BRAIN_RENDER_CONSOLE',message)});
 win.webContents.on('render-process-gone',(_event,details)=>{finish({ok:false,error:'RENDER_GONE',details},4)});
 win.webContents.on('did-fail-load',(_event,code,reason)=>{fail=code+':'+reason;});
 const safeTimer=setTimeout(()=>finish({ok:false,error:'RENDER_QUALIFICATION_TIMEOUT',loadFailure:fail},3),15000);
 try{
  await win.loadFile(path.join(asar,'apps','desktop','src','orion-brain.html'));
  await new Promise(resolve=>setTimeout(resolve,1600));
  const state=await win.webContents.executeJavaScript(`(()=>{
   const g=(typeof fluidBrain!=='undefined'?fluidBrain:null),canvas=document.querySelector('.orion-fluid-3d-canvas');
   return {ready:globalThis.__orionFirstFrameReady===true,available:!!g?.available,
    active:!!g?.state?.active,mode:g?.state?.mode||null,webglVersion:g?.state?.gl?.getParameter(g.state.gl.VERSION)||null,
    nodes:g?.state?.nodes?.size||0,edges:g?.state?.edges?.length||0,
    syntheticGraphHash:g?.state?.graphHash||null,canvasWidth:canvas?.width||0,canvasHeight:canvas?.height||0,
    layout3D:document.querySelector('#compute-graph')?.classList?.contains('fluid-mode'),
    togglePresent:!!document.querySelector('.fluid-switch'),selectedNode:globalThis.selectedSelfGraphId||null,
    errors:(document.querySelector('#live-state')?.textContent||'')};
  })()`,true);
  // Same renderer instance, same GPU context, new documented learning record:
  // verify a qualified learning node appears without reloading Electron.
  const hotLearning=await win.webContents.executeJavaScript(`(()=>{
   const g=fluidBrain;
   if(!g?.state?.active)return {verified:false,reason:'3D_NOT_ACTIVE'};
   const priorCount=g.state.updateCount,rootPrior=g.state.nodes.get('root');
   const sameRoot=rootPrior,positionBefore=rootPrior?.pos?.slice();
   const raw=latest?.workingGraph||{};
   const lesson={id:'learning:skill:gpu-smoke',type:'LearnedSkill',
    name:'SYNTHETIC recorded lesson',status:'PROMOTED_RECORDED',
    evidenceSource:'SYNTHETIC_PROBE_NOT_LIVE',synthetic:true};
   const next={...raw,source:{...raw.source,eventCount:26},
    nodes:[...(raw.nodes||[]),lesson],
    edges:[...(raw.edges||[]),{from:lesson.id,to:'root',type:'LEARNING_RECORD_UNDER_ROOT'}]};
   g.setGraph(next,latest?.crew||{});
   const learned=g.state.nodes.get(lesson.id),rootNow=g.state.nodes.get('root');
   return {verified:!!learned&&g.state.updateCount>priorCount&&
     rootNow?.id===sameRoot?.id&&rootNow?.pos===sameRoot?.pos&&
     JSON.stringify(rootNow?.pos)===JSON.stringify(positionBefore),
    updateCountBefore:priorCount,updateCountAfter:g.state.updateCount,
    nodesAfter:g.state.nodes.size,edgesAfter:g.state.edges.length,
    retainedRootLineageAndPosition:rootNow?.id===sameRoot?.id&&rootNow?.pos===sameRoot?.pos,
    learnedEvidence:learned?.data?.evidenceSource||null,
    rendererReloaded:false};
  })()`,true);
  const snap=await win.webContents.capturePage();
  const bmp=snap.toBitmap(),size=snap.getSize();
  let nonDark=0,samples=0;
  for(let y=110;y<Math.min(size.height,520);y+=17)for(let x=50;x<Math.min(size.width,1110);x+=17){
   const offset=(y*size.width+x)*4;const b=bmp[offset],g=bmp[offset+1],r=bmp[offset+2];
   if(r>70||g>70||b>100)nonDark++;samples++;
  }
  clearTimeout(safeTimer);
  const ok=state.ready&&state.available&&state.active&&
   state.nodes===6&&state.edges>=4&&state.layout3D&&
   state.canvasWidth>100&&state.canvasHeight>100&&nonDark>15&&
   hotLearning.verified===true;
  finish({ok,...state,hotLearning,pixelSamples:samples,visibleBrightSamples:nonDark,
   screenshotPixelSize:size,realProduction3DVerified:false},ok?0:2);
 }catch(error){clearTimeout(safeTimer);finish({ok:false,error:String(error.stack||error),loadFailure:fail},1)}
}).catch(e=>finish({ok:false,error:String(e)},5));
