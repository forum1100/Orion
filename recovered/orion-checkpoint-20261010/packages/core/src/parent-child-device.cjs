const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');

const ARIEL_REFERENCE=Object.freeze({
  child:'Ariel',deviceFamily:'Amazon Fire',model:'KFTUWI',product:'tungsten',androidUser:11,
  primaryApp:{name:'Teach Your Monster',package:'com.teachyourmonstertoread.tmapp.freetime'},
  recoveryStatus:'UNRESOLVED',sandboxFirst:true,
  educationAlignment:['Florida B.E.S.T.','Volusia FAST K-2']
});
const DEFAULT_DEADLINE='2026-09-24T23:13:00-04:00';
function atomic(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const t=file+'.tmp';fs.writeFileSync(t,JSON.stringify(value,null,2),'utf8');fs.renameSync(t,file);}

class ParentChildDevice {
  constructor({root,vault=null,experience=null,runAICouncil=null,sprintEnd=DEFAULT_DEADLINE,intervalMs=2*60*60*1000}={}){
    this.root=path.join(root,'parent-child-device');this.file=path.join(this.root,'state.json');
    this.vault=vault;this.experience=experience;this.runAICouncil=runAICouncil;this.sprintEnd=new Date(sprintEnd);
    this.intervalMs=Math.max(30*60*1000,Number(intervalMs)||2*60*60*1000);this.timer=null;this.running=false;
    fs.mkdirSync(this.root,{recursive:true});
  }
  load(){try{return JSON.parse(fs.readFileSync(this.file,'utf8'));}catch{return {schema:'dt-parent-child-device/1.0',
    referenceDevice:ARIEL_REFERENCE,sprintEnd:this.sprintEnd.toISOString(),training:{tasks:[],completed:[]},adapters:{},updatedAt:null};}}
  status(){const s=this.load();return {...s,running:this.running,sprintActive:Date.now()<this.sprintEnd.getTime(),intervalMs:this.intervalMs};}
  interfaceSpec(){return {schema:'dt-parent-interface/1.0',surface:'ORION_TOOL',sections:[
    {id:'child-overview',purpose:'Current child/device/app status and unresolved recovery branches'},
    {id:'live-session',purpose:'Session supervisor, capture status, app adapter, parent-visible controls'},
    {id:'learning-evidence',purpose:'Work samples, OCR, app activity, reading/phonics evidence, source provenance'},
    {id:'alignment',purpose:'Map evidence to Florida B.E.S.T. and Volusia FAST K-2 categories/benchmarks'},
    {id:'analysis',purpose:'Bi-weekly strengths, weaknesses, response-to-instruction, next instructional targets'},
    {id:'archive',purpose:'Timestamped source-faithful records, generated paper/PDF copies, recovery lineage'},
    {id:'permissions',purpose:'Separate read/capture, control/write, export/share, and destructive actions'}
  ],interactionGoal:'PARENT_CAN_OPERATE_WITHOUT_PROMPT_ENGINEERING',sandboxFirst:true};}
  trainingPlan(){return {sprintEnd:this.sprintEnd.toISOString(),referenceDevice:ARIEL_REFERENCE,tasks:[
    'Discover child devices and establish stable device/profile identity without modifying the live child profile.',
    'Build parent-to-child device bridge abstraction for ADB/local network/approved app adapters.',
    'Implement parent dashboard and prompt-free interaction cards inside Orion.',
    'Implement session supervisor with screen capture, app-state observation, touch/UI/accessibility event intake where available.',
    'Implement OCR/paper reconstruction pipeline and source-faithful archive receipts.',
    'Implement Teach Your Monster adapter/recovery branch without assuming unresolved historical data was recovered.',
    'Implement education evidence normalization and Florida B.E.S.T./Volusia FAST K-2 mapping.',
    'Implement bi-weekly analysis and adaptive instructional recommendations with preserved evidence links.',
    'Test identical-device/sandbox workflow before any write/control action on the live tablet.'
  ]};}
  discoverDevices(){
    const candidates=['adb',path.join(process.env.LOCALAPPDATA||'','Android','Sdk','platform-tools','adb.exe')];
    for(const exe of candidates){
      try{const raw=execFileSync(exe,['devices','-l'],{encoding:'utf8',windowsHide:true,timeout:8000});
        const devices=String(raw).split(/\r?\n/).slice(1).map(x=>x.trim()).filter(Boolean).map(line=>({raw:line,authorized:/\sdevice\s/.test(' '+line+' '),offline:/\soffline\b/.test(' '+line+' ')}));
        const state=this.load();state.adapters.adb={observedAt:new Date().toISOString(),executable:exe,devices};state.updatedAt=new Date().toISOString();atomic(this.file,state);
        return {available:true,executable:exe,devices};
      }catch{}
    }
    return {available:false,devices:[]};
  }
  async consultPeers(question){
    if(typeof this.runAICouncil!=='function')return {available:false,reason:'COUNCIL_UNAVAILABLE'};
    try{return await this.runAICouncil({advisoryOnly:true,task:[
      'PARENT/CHILD DEVICE TOOL TRAINING FOR ORION.',
      'Reference: '+JSON.stringify(ARIEL_REFERENCE),
      'Architecture: parent launcher/dashboard -> session supervisor -> app adapters -> capture/archive -> OCR/paper generator -> bi-weekly analysis -> standards mapping.',
      'Constraint: sandbox/read-only recovery before live child-profile modification.',
      'Question: '+question,
      'Return implementation steps, interfaces, tests, failure modes, and how this should interlock with existing DT services.'
    ].join('\n')},{ownerApproved:false});}catch(error){return {available:false,reason:'COUNCIL_ERROR',error:String(error.message||error)};}
  }
  async trainingCycle(input={}){
    if(Date.now()>=this.sprintEnd.getTime())return {status:'PARENT_TOOL_SPRINT_COMPLETE',sprintEnd:this.sprintEnd.toISOString()};
    const state=this.load(),plan=this.trainingPlan();
    const question=String(input.question||plan.tasks[(state.training.completed||[]).length%plan.tasks.length]);
    const deviceObservation=this.discoverDevices();const peer=await this.consultPeers(question);
    const row={id:crypto.randomUUID(),startedAt:new Date().toISOString(),question,deviceObservation,peer,
      status:peer?.available===false?'LOCAL_PLAN_ONLY':'ADVISORY_COLLECTED',completedAt:new Date().toISOString()};
    state.training.tasks=plan.tasks;state.training.completed=[...(state.training.completed||[]),row].slice(-500);state.updatedAt=row.completedAt;atomic(this.file,state);
    this.vault?.append('parent-child-device-training','orion-parent',row);this.experience?.append('parent-child-device-training',row,{sourceClass:'DERIVED_PARENT_TOOL_TRAINING'});return row;
  }
  start(){if(Date.now()>=this.sprintEnd.getTime())return this.status();this.running=true;const state=this.load();state.updatedAt=new Date().toISOString();atomic(this.file,state);if(!this.timer)this.timer=setInterval(()=>this.trainingCycle().catch(()=>{}),this.intervalMs);setTimeout(()=>this.trainingCycle().catch(()=>{}),60000);return this.status();}
  stop(){if(this.timer)clearInterval(this.timer);this.timer=null;this.running=false;return this.status();}
}
module.exports={ParentChildDevice,ARIEL_REFERENCE,DEFAULT_DEADLINE};
