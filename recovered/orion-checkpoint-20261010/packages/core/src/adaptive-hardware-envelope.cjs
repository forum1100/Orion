const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {sampleHardware,evaluateHardware}=require('./hardware-governor.cjs');
function atomic(file,v){fs.mkdirSync(path.dirname(file),{recursive:true});const t=file+'.tmp';fs.writeFileSync(t,JSON.stringify(v,null,2),'utf8');fs.renameSync(t,file);}
class AdaptiveHardwareEnvelope{
  constructor({root,vault=null,experience=null,intervalMs=60000}={}){
    this.root=path.join(root,'hardware-envelope');this.file=path.join(this.root,'profile.json');this.vault=vault;this.experience=experience;
    this.intervalMs=Math.max(15000,Number(intervalMs)||60000);this.timer=null;
    fs.mkdirSync(this.root,{recursive:true});
  }
  identity(){return {host:os.hostname(),platform:os.platform(),arch:os.arch(),cpuCount:os.cpus().length,totalMemoryBytes:os.totalmem()};}
  load(){try{return JSON.parse(fs.readFileSync(this.file,'utf8'));}catch{return {schema:'dt-hardware-envelope/1.0',device:this.identity(),samples:[],stableSamples:0,pressureSamples:0,recommendation:null};}}
  observe(sample=sampleHardware()){
    const state=this.load(),evaluation=evaluateHardware(sample);
    state.samples=[...(state.samples||[]),{sample,evaluation}].slice(-240);
    if(evaluation.severity==='OK')state.stableSamples=(state.stableSamples||0)+1;else{state.pressureSamples=(state.pressureSamples||0)+1;state.stableSamples=0;}
    const cpuCount=Math.max(1,state.device?.cpuCount||os.cpus().length),ramGB=(state.device?.totalMemoryBytes||os.totalmem())/1073741824;
    let heavy=1;if(state.stableSamples>=10&&ramGB>=16)heavy=Math.min(2,Math.max(1,Math.floor(cpuCount/4)));if(state.stableSamples>=60&&ramGB>=32)heavy=Math.min(4,Math.floor(cpuCount/3));
    if(evaluation.severity!=='OK')heavy=0;
    state.recommendation={heavyConcurrency:heavy,scanBatchSize:heavy?Math.min(4000,500+heavy*750):100,
      inferenceParallelism:heavy?Math.min(2,heavy):0,reason:evaluation.severity==='OK'?'LEARNED_STABLE_ENVELOPE':'RESOURCE_PRESSURE_BACKOFF',
      thermalTelemetryAvailable:sample.thermalTelemetryAvailable};
    state.updatedAt=new Date().toISOString();atomic(this.file,state);
    this.experience?.append('hardware-envelope-observation',{evaluation,recommendation:state.recommendation},{sourceClass:'LIVE_MACHINE_OBSERVATION'});
    return state;
  }
  status(){return this.load();}
  start(){
    this.observe();
    if(!this.timer)this.timer=setInterval(()=>{try{this.observe();}catch{}},this.intervalMs);
    return {running:true,intervalMs:this.intervalMs,profile:this.load()};
  }
  stop(){if(this.timer)clearInterval(this.timer);this.timer=null;return {running:false};}
}
module.exports={AdaptiveHardwareEnvelope};