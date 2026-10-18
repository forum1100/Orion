const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

function sleepSync(ms){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);}
function atomic(file,value){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=file+'.'+process.pid+'.'+crypto.randomUUID()+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(value,null,2),'utf8');
  let lastError=null;
  for(let attempt=0;attempt<8;attempt++){
    try{fs.renameSync(tmp,file);return;}
    catch(error){
      lastError=error;
      if(!['EPERM','EACCES','EBUSY'].includes(String(error.code||'')))break;
      sleepSync(10*(attempt+1));
    }
  }
  try{fs.copyFileSync(tmp,file);fs.unlinkSync(tmp);return;}catch(error){lastError=error;}
  try{fs.unlinkSync(tmp);}catch{}
  throw lastError;
}
function now(){return new Date().toISOString();}
function terminal(status){return ['COMPLETE','CANCELED','FAILED_PRESERVED'].includes(String(status));}

class OrionTaskEngine {
  constructor({root,vault=null,experience=null,reconcile=null,hardwareState=null,failureClassifier=null,gapLedger=null,watchdogMs=60000}={}){
    this.root=path.join(root,'orion-task-engine'); this.file=path.join(this.root,'state.json');
    this.events=path.join(this.root,'events.jsonl'); this.vault=vault; this.experience=experience;
    this.reconcileFn=typeof reconcile==='function'?reconcile:null;
    this.hardwareStateFn=typeof hardwareState==='function'?hardwareState:null;
    this.failureClassifier=typeof failureClassifier==='function'?failureClassifier:null;this.gapLedger=gapLedger||null;
    this.handlers=new Map(); this.running=false; this.evaluating=false; this.pendingReason=null;
    this.wakeTimer=null; this.watchdog=null; this.watchdogMs=Math.max(30000,Number(watchdogMs)||60000);
    fs.mkdirSync(this.root,{recursive:true}); this.ensureState();
  }
  blank(){return {schema:'orion-task-engine/1.0',mode:'SELF_DIRECTED',startedAt:null,stoppedAt:null,currentTaskId:null,
    tasks:{},lastEvaluationAt:null,lastWakeReason:null,stats:{created:0,completed:0,failed:0,waiting:0},updatedAt:now()};}
  ensureState(){if(!fs.existsSync(this.file))atomic(this.file,this.blank());}
  load(){try{return JSON.parse(fs.readFileSync(this.file,'utf8'));}catch{return this.blank();}}
  save(state){state.updatedAt=now();atomic(this.file,state);return state;}
  event(type,data={}){const row={at:now(),type,...data};fs.appendFileSync(this.events,JSON.stringify(row)+'\n','utf8');
    this.vault?.append?.('orion-task-event','orion-task-engine',row);this.experience?.append?.('orion-task-event',row,{sourceClass:'DERIVED_TASK_RUNTIME'});return row;}
  register(kind,handler){if(!kind||typeof handler!=='function')throw new Error('Task handler requires kind and function');this.handlers.set(String(kind),handler);return this;}
  task(id){return this.load().tasks?.[id]||null;}
  list({includeTerminal=true}={}){const rows=Object.values(this.load().tasks||{});return includeTerminal?rows:rows.filter(x=>!terminal(x.status));}
  status(){const s=this.load();return {...s,running:this.running,evaluating:this.evaluating,registeredKinds:[...this.handlers.keys()],
    runnable:this.runnable(s).map(x=>x.id),watchdogRole:'LIVENESS_AND_RECOVERY_ONLY'};}
  upsert(input={}){
    const state=this.load(),id=String(input.id||crypto.randomUUID()),prior=state.tasks[id];
    if(prior&&terminal(prior.status)&&input.reopen!==true)return prior;
    const createdAt=prior?.createdAt||now();
    const task={id,kind:String(input.kind||prior?.kind||''),title:String(input.title||prior?.title||input.kind||id),
      status:String(input.status||prior?.status||'READY'),priority:Number(input.priority??prior?.priority??50),deadline:input.deadline??prior?.deadline??null,
      availableAt:input.availableAt??prior?.availableAt??null,dependencies:[...(input.dependencies??prior?.dependencies??[])],
      input:input.input??prior?.input??{},source:input.source??prior?.source??'ORION_RECONCILIATION',responsibleAgentId:input.responsibleAgentId??prior?.responsibleAgentId??input.input?.agentId??prior?.input?.agentId??null,attempts:Number(prior?.attempts||0),
      createdAt,updatedAt:now(),lastError:prior?.lastError||null,lastResult:prior?.lastResult||null};
    if(!task.kind)throw new Error('Task kind required'); state.tasks[id]=task;if(!prior)state.stats.created++;
    this.save(state);if(!prior)this.event('TASK_CREATED',{taskId:id,kind:task.kind,priority:task.priority,deadline:task.deadline,responsibleAgentId:task.responsibleAgentId});return task;
  }
  completeExternal(id,result={}){const state=this.load(),task=state.tasks[id];if(!task)return null;task.status='COMPLETE';task.updatedAt=now();task.lastResult=result;
    state.stats.completed++;this.save(state);this.event('TASK_COMPLETED_EXTERNAL',{taskId:id});this.requestEvaluation('EXTERNAL_COMPLETION');return task;}
  dependencyReady(task,state){return (task.dependencies||[]).every(id=>state.tasks?.[id]?.status==='COMPLETE');}
  runnable(state=this.load()){
    const t=Date.now();return Object.values(state.tasks||{}).filter(task=>{
      if(!['DISCOVERED','PLANNED','READY','RETRY_READY'].includes(task.status))return false;
      if(task.availableAt&&new Date(task.availableAt).getTime()>t)return false;
      return this.dependencyReady(task,state);
    });
  }
  score(task){
    let score=Number(task.priority||0);const t=Date.now();
    if(task.deadline){const d=new Date(task.deadline).getTime()-t;if(d<=0)score+=1000;else score+=Math.max(0,240-(d/3600000))*2;}
    const ageMs=Math.max(0,t-new Date(task.createdAt||t).getTime());
    score+=Math.min(50,(ageMs/60000)*2);
    score+=Math.min(50,(task.attempts||0)*2);return score;
  }
  choose(state=this.load()){const rows=this.runnable(state);rows.sort((a,b)=>this.score(b)-this.score(a)||new Date(a.createdAt)-new Date(b.createdAt));return rows[0]||null;}
  async reconcile(reason='RECONCILE'){
    if(!this.reconcileFn)return null;
    const discovered=await this.reconcileFn({engine:this,state:this.load(),reason});
    for(const task of (Array.isArray(discovered)?discovered:[]))this.upsert(task);
    return discovered;
  }
  scheduleWake(at,reason='DEPENDENCY_READY'){
    if(this.wakeTimer)clearTimeout(this.wakeTimer);this.wakeTimer=null;
    if(!at)return;
    const delay=Math.max(250,new Date(at).getTime()-Date.now());
    this.wakeTimer=setTimeout(()=>{this.wakeTimer=null;this.requestEvaluation(reason);},Math.min(delay,2147483647));
  }
  nextFutureWake(state=this.load()){
    const candidates=Object.values(state.tasks||{}).filter(t=>['READY','RETRY_READY','PLANNED','DISCOVERED'].includes(t.status)&&t.availableAt)
      .map(t=>new Date(t.availableAt).getTime()).filter(x=>Number.isFinite(x)&&x>Date.now()).sort((a,b)=>a-b);
    return candidates.length?new Date(candidates[0]).toISOString():null;
  }
  async execute(task){
    const handler=this.handlers.get(task.kind);const state=this.load(),live=state.tasks[task.id];if(!live)return null;
    if(!handler){live.status='WAITING_DEPENDENCY';live.lastError='NO_HANDLER:'+task.kind;live.updatedAt=now();state.stats.waiting++;this.save(state);this.event('TASK_WAITING_HANDLER',{taskId:task.id,kind:task.kind,responsibleAgentId:live.responsibleAgentId});return live;}
    const hardware=this.hardwareStateFn?.();
    if(hardware&&hardware.heavyWorkPermitted===false&&task.input?.heavy!==false){
      live.status='RETRY_READY';live.availableAt=new Date(Date.now()+60000).toISOString();live.lastError='HARDWARE_BACKOFF';live.updatedAt=now();this.save(state);return live;
    }
    live.status='RUNNING';live.attempts=(live.attempts||0)+1;live.startedAt=now();live.updatedAt=live.startedAt;state.currentTaskId=live.id;this.save(state);
    this.event('TASK_STARTED',{taskId:live.id,kind:live.kind,attempt:live.attempts,responsibleAgentId:live.responsibleAgentId});
    try{
      const result=await handler({...live},{engine:this});
      const fresh=this.load(),row=fresh.tasks[live.id];fresh.currentTaskId=null;row.lastResult=result??null;row.lastError=null;row.updatedAt=now();
      const requested=String(result?.status||'COMPLETE');
      if(['WAITING_USER','WAITING_DEPENDENCY','DEFERRED'].includes(requested)){row.status=requested;fresh.stats.waiting++;}
      else if(requested==='RETRY_READY'){
        row.status='RETRY_READY';row.availableAt=result.availableAt||new Date(Date.now()+Math.min(300000,5000*(2**Math.min(row.attempts,6)))).toISOString();
      }else{row.status='COMPLETE';row.completedAt=now();fresh.stats.completed++;}
      this.save(fresh);this.event('TASK_FINISHED',{taskId:row.id,kind:row.kind,status:row.status,responsibleAgentId:row.responsibleAgentId});
      for(const follow of (result?.followUps||[]))this.upsert(follow);
      return row;
    }catch(error){
      const fresh=this.load(),row=fresh.tasks[live.id];fresh.currentTaskId=null;row.lastError=String(error.stack||error);row.updatedAt=now();
      const classified=this.failureClassifier?this.failureClassifier(error):null;
      const disposition=String(classified?.disposition||'');
      if(disposition==='WAITING_DEPENDENCY'||disposition==='WAITING_USER'){
        row.status=disposition;fresh.stats.waiting++;
      }else if(disposition==='RETRY_READY'){
        row.status='RETRY_READY';row.availableAt=new Date(Date.now()+Math.min(300000,5000*(2**Math.min(row.attempts,6)))).toISOString();
      }else if(row.attempts>=4||disposition==='FAILED_PRESERVED'){
        row.status='FAILED_PRESERVED';row.failedAt=now();fresh.stats.failed++;
      }else{
        row.status='RETRY_READY';row.availableAt=new Date(Date.now()+Math.min(300000,5000*(2**row.attempts))).toISOString();
      }
      if(classified&&disposition!=='RETRY_READY'){
        this.gapLedger?.preserve?.({kind:classified.kind||'UNCLASSIFIED_RUNTIME_FAILURE',summary:String(error.message||error),sourceTaskId:row.id,
          surface:row.kind,revisitTriggers:classified.kind==='BROWSER_CONTROL_UNAVAILABLE'?['INTERFACE_CHANGED','NEW_CAPABILITY','NEW_EVIDENCE']:['NEW_CAPABILITY','RECOVERY_PATH_ADDED','AUTHORITY_CHANGED','NEW_EVIDENCE'],
          evidence:{classification:classified,error:String(error.message||error),attempts:row.attempts}});
      }
      this.save(fresh);this.event('TASK_ERROR',{taskId:row.id,kind:row.kind,status:row.status,error:String(error.message||error),classification:classified,responsibleAgentId:row.responsibleAgentId});return row;
    }
  }
  requestEvaluation(reason='INTERNAL_EVENT'){
    this.pendingReason=reason;
    if(!this.running||this.evaluating)return;
    queueMicrotask(()=>this.evaluate().catch(error=>this.event('ENGINE_ERROR',{error:String(error.stack||error)})));
  }
  async evaluate(){
    if(!this.running||this.evaluating)return this.status();this.evaluating=true;
    try{
      let safety=0;
      while(this.running&&safety++<100){
        const reason=this.pendingReason||'CONTINUE';this.pendingReason=null;await this.reconcile(reason);
        const state=this.load();state.lastEvaluationAt=now();state.lastWakeReason=reason;this.save(state);
        const task=this.choose(state);if(!task){this.scheduleWake(this.nextFutureWake(state),'FUTURE_TASK_READY');break;}
        await this.execute(task);
      }
    }finally{this.evaluating=false;}
    if(this.pendingReason&&this.running)this.requestEvaluation(this.pendingReason);
    else if(this.running&&this.choose(this.load()))this.requestEvaluation('CONTINUE_AFTER_BATCH');
    return this.status();
  }
  start(){
    if(this.running)return this.status();this.running=true;const state=this.load();
    if(state.currentTaskId){
      const interrupted=state.tasks?.[state.currentTaskId];
      if(interrupted?.status==='RUNNING'){
        interrupted.status='RETRY_READY';interrupted.availableAt=now();interrupted.lastError='STARTUP_RECOVERED_INTERRUPTED_TASK';interrupted.updatedAt=now();
        state.currentTaskId=null;
      }
    }
    state.startedAt=state.startedAt||now();state.stoppedAt=null;this.save(state);
    this.event('ENGINE_STARTED',{mode:'SELF_DIRECTED'});
    this.watchdog=setInterval(()=>{
      if(!this.running)return;const state=this.load();
      if(state.currentTaskId&&!this.evaluating){const t=state.tasks?.[state.currentTaskId];if(t?.status==='RUNNING'){t.status='RETRY_READY';t.availableAt=now();t.lastError='WATCHDOG_RECOVERED_INTERRUPTED_TASK';state.currentTaskId=null;this.save(state);}}
      if(!this.evaluating)this.requestEvaluation('LIVENESS_WATCHDOG');
    },this.watchdogMs);
    this.requestEvaluation('STARTUP_BACKLOG_RECONCILIATION');return this.status();
  }
  stop(){this.running=false;if(this.wakeTimer)clearTimeout(this.wakeTimer);if(this.watchdog)clearInterval(this.watchdog);this.wakeTimer=null;this.watchdog=null;
    const state=this.load();state.stoppedAt=now();this.save(state);this.event('ENGINE_STOPPED');return this.status();}
}
module.exports={OrionTaskEngine};
