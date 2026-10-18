const fs = require('node:fs');
const path = require('node:path');

const PROVIDERS = Object.freeze(['chatgpt','grok','gemini','openai','xai','anthropic','ollama','compatible']);
const DEFAULT_CONTRACT = Object.freeze({
  canonicalStateOwner:'DT_LOCAL',
  providerStateIsAuthoritative:false,
  preserveProvenance:true,
  freshChatAssumption:'NO_PRIOR_CONTEXT_UNLESS_OBSERVED',
  authenticatedSession:'MAY_EXPOSE_ACCOUNT_STATE_NOT_ASSUMED_CONTEXT',
  quotaPolicy:'DEFER_AND_ROUTE_ALTERNATE_LANE',
  securityPolicy:'USE_AUTHORIZED_SURFACES_WITHOUT_BYPASSING_PROVIDER_CONTROLS'
});

function atomicWrite(file, value){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=file+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(value,null,2),'utf8'); fs.renameSync(tmp,file);
}

class ProviderIndependence {
  constructor({root,vault=null,experience=null}={}){
    this.root=path.join(root,'provider-independence');
    this.file=path.join(this.root,'provider-matrix.json'); this.vault=vault; this.experience=experience;
    fs.mkdirSync(this.root,{recursive:true});
    if(!fs.existsSync(this.file)) atomicWrite(this.file,{schema:'dt-provider-independence/1.0',contract:DEFAULT_CONTRACT,providers:{},updatedAt:new Date().toISOString()});
  }
  load(){
    try{return JSON.parse(fs.readFileSync(this.file,'utf8'));}
    catch{return {schema:'dt-provider-independence/1.0',contract:DEFAULT_CONTRACT,providers:{},updatedAt:null};}
  }
  observe(input={}){
    const provider=String(input.provider||'').trim().toLowerCase();
    if(!PROVIDERS.includes(provider)) throw new Error('Unknown provider');
    const lane=String(input.lane||'browser').trim().toLowerCase();
    const state=this.load(); const prior=state.providers[provider]||{observations:[],lanes:{}};
    const observation={observedAt:new Date().toISOString(),lane,
      authenticated:input.authenticated===true,contextRestored:input.contextRestored===true,
      contextObserved:Boolean(input.contextObserved),quotaState:input.quotaState||'unknown',
      resetHint:input.resetHint||null,capabilities:input.capabilities||{},constraints:input.constraints||{},
      source:input.source||'ORION_RUNTIME_OBSERVATION'};
    prior.observations=[...(prior.observations||[]),observation].slice(-200);
    prior.lanes={...(prior.lanes||{}),[lane]:{...(prior.lanes?.[lane]||{}),...observation}};
    state.providers[provider]=prior; state.updatedAt=observation.observedAt; atomicWrite(this.file,state);
    this.experience?.append('provider-independence-observation',{provider,...observation},{sourceClass:'LIVE_PROVIDER_OBSERVATION'});
    this.vault?.append('provider-independence-observation','orion',{provider,...observation});
    return {provider,lane,observation,state:prior};
  }
  status(){return this.load();}
  route(input={}){
    const required=input.required||{}; const state=this.load(); const rows=[];
    for(const [provider,p] of Object.entries(state.providers||{})){
      for(const [lane,x] of Object.entries(p.lanes||{})){
        let score=0; const reasons=[];
        if(x.quotaState==='available'||x.quotaState==='unknown'){score+=2;reasons.push('capacity-not-blocked');}
        if(x.authenticated){score+=1;reasons.push('authenticated');}
        if(required.context && x.contextRestored){score+=1;reasons.push('context-restored-observed');}
        for(const [k,v] of Object.entries(required.capabilities||{})) if(v && x.capabilities?.[k]){score+=1;reasons.push('capability:'+k);}
        if(x.quotaState==='quota_exhausted'){score-=10;reasons.push('quota-exhausted');}
        rows.push({provider,lane,score,reasons,state:x});
      }
    }
    rows.sort((a,b)=>b.score-a.score);
    return {contract:state.contract,selected:rows[0]||null,candidates:rows,decision:'DT_LOCAL_ROUTING'};
  }
}

module.exports={ProviderIndependence,DEFAULT_CONTRACT,PROVIDERS};
