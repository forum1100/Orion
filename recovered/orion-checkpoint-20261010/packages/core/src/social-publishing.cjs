const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const PLATFORMS=Object.freeze(['x','facebook','instagram','linkedin','youtube']);
const DEFAULT_POLICY=Object.freeze({
  canonicalState:'DT_LOCAL', primaryPlatform:'x', crossPost:true,
  ownerAuthorizedPublishing:true, preserveProvenance:true,
  politicalPersuasion:false, platformTermsAndSecurityControls:'RESPECT',
  destructiveAccountChanges:false
});
function atomic(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const t=file+'.tmp';fs.writeFileSync(t,JSON.stringify(value,null,2),'utf8');fs.renameSync(t,file);}

class SocialPublishing {
  constructor({root,vault=null,experience=null,localIntelligence=null,runAICouncil=null}={}){
    this.root=path.join(root,'social-publishing');this.file=path.join(this.root,'state.json');
    this.vault=vault;this.experience=experience;this.local=localIntelligence;this.runAICouncil=runAICouncil;
    fs.mkdirSync(this.root,{recursive:true});
  }
  load(){try{return JSON.parse(fs.readFileSync(this.file,'utf8'));}catch{return {schema:'dt-social-publishing/1.0',policy:DEFAULT_POLICY,
    voice:{status:'LEARNING',sources:[],traits:[]},accounts:{},queue:[],published:[],updatedAt:null};}}
  status(){return this.load();}
  learnVoice(sample={}){
    const state=this.load();const text=String(sample.text||'').trim();
    if(!text)return {accepted:false,reason:'EMPTY_SAMPLE'};
    const traits=[];
    if(/[.!?]{2,}/.test(text))traits.push('high-emphasis-punctuation');
    if(/\b(i|my|me)\b/i.test(text))traits.push('first-person-direct');
    if(/\b(because|point is|essentially|honestly|literally)\b/i.test(text))traits.push('causal-conversational');
    if(text.length>500)traits.push('long-form-streaming-thought');
    state.voice.sources=[...(state.voice.sources||[]),{id:crypto.randomUUID(),source:sample.source||'USER_WRITING',
      observedAt:new Date().toISOString(),excerpt:text.slice(0,1200)}].slice(-1000);
    state.voice.traits=[...new Set([...(state.voice.traits||[]),...traits])];state.voice.status='LEARNING_FROM_OWNER_CORPUS';
    state.updatedAt=new Date().toISOString();atomic(this.file,state);return {accepted:true,traits:state.voice.traits};
  }
  accountObservation(input={}){
    const platform=String(input.platform||'').toLowerCase();if(!PLATFORMS.includes(platform))throw new Error('Unknown platform');
    const state=this.load();state.accounts[platform]={...(state.accounts[platform]||{}),observedAt:new Date().toISOString(),
      authenticated:input.authenticated===true,profile:input.profile||null,monetization:input.monetization||null,
      limits:input.limits||{},capabilities:input.capabilities||{}};state.updatedAt=new Date().toISOString();atomic(this.file,state);
    return state.accounts[platform];
  }
  async generateConcept(input={}){
    const state=this.load();
    const theme=String(input.theme||'Explain one ordinary thing about the world through a funny DT perspective').trim();
    const voice={traits:state.voice.traits||[],examples:(state.voice.sources||[]).slice(-12).map(x=>x.excerpt)};
    const system=[
      'You are Orion writing for the owner in a style learned from his own writings.',
      'Create an original DT-themed social concept that is funny, observational, and understandable without prior DT knowledge.',
      'Do not claim speculative DT theory is established science. Clearly frame it as a lens/model/perspective when needed.',
      'Return JSON with concept, xPost, facebook, instagram, linkedin, youtubeShort, imageBrief, altText, hashtags.',
      'Adapt tone/length by platform instead of copying identical text.',
      'Do not imitate any third party; use only the owner voice evidence supplied.'
    ].join('\n');
    if(!this.local)throw new Error('Local Orion intelligence unavailable');
    const raw=await this.local.complete({system,prompt:JSON.stringify({theme,voice})});
    let content;try{content=JSON.parse(raw);}catch{throw new Error('Orion social generation was not valid JSON');}
    return {id:crypto.randomUUID(),createdAt:new Date().toISOString(),theme,content,voiceEvidenceCount:voice.examples.length,
      status:'GENERATED_NOT_PUBLISHED'};
  }
  observeSource(input={}){
    const state=this.load(); const platform=String(input.platform||'').toLowerCase();
    if(!PLATFORMS.includes(platform))throw new Error('Unknown platform');
    const handle=String(input.handle||input.name||'').trim(); if(!handle)throw new Error('Source handle required');
    state.sources=state.sources||{}; const key=platform+':'+handle.toLowerCase();
    const prior=state.sources[key]||{platform,handle,observations:0,signalScore:0,noiseScore:0,reasons:[]};
    const plus=Number(input.signalDelta||0), minus=Number(input.noiseDelta||0);
    prior.observations+=1; prior.signalScore+=plus; prior.noiseScore+=minus;
    prior.reasons=[...(prior.reasons||[]),...(input.reasons||[])].slice(-100);
    prior.lastObservedAt=new Date().toISOString(); state.sources[key]=prior; state.updatedAt=prior.lastObservedAt; atomic(this.file,state);
    return {...prior,netScore:prior.signalScore-prior.noiseScore};
  }
  recommendFollows(input={}){
    const state=this.load(); const min=Number(input.minScore??2), limit=Math.max(1,Math.min(50,Number(input.limit)||10));
    return Object.values(state.sources||{}).map(x=>({...x,netScore:Number(x.signalScore||0)-Number(x.noiseScore||0)}))
      .filter(x=>x.netScore>=min).sort((a,b)=>b.netScore-a.netScore).slice(0,limit);
  }
  enqueuePackage(pkg={}){
    const state=this.load(); const content=pkg.content||pkg;
    const id=String(pkg.id||crypto.randomUUID());
    const mapping={x:'xPost',facebook:'facebook',instagram:'instagram',linkedin:'linkedin',youtube:'youtubeShort'};
    const jobs=[];
    for(const platform of PLATFORMS){
      const text=String(content[mapping[platform]]||'').trim(); if(!text)continue;
      jobs.push({jobId:crypto.randomUUID(),packageId:id,platform,text,imagePath:pkg.imagePath||null,
        imageBrief:content.imageBrief||null,altText:content.altText||null,status:'queued',createdAt:new Date().toISOString()});
    }
    state.queue=[...(state.queue||[]),...jobs];state.updatedAt=new Date().toISOString();atomic(this.file,state);
    this.vault?.append('social-package-queued','orion-social',{packageId:id,jobs:jobs.map(x=>({jobId:x.jobId,platform:x.platform}))});
    return {packageId:id,jobs};
  }
  queueFollow(input={}){
    const state=this.load();const platform=String(input.platform||'').toLowerCase();
    if(!PLATFORMS.includes(platform))throw new Error('Unknown platform');
    const handle=String(input.handle||'').trim();if(!handle)throw new Error('Handle required');
    const job={jobId:crypto.randomUUID(),kind:'follow',platform,handle,profileUrl:input.profileUrl||null,
      reason:input.reason||null,status:'queued',createdAt:new Date().toISOString()};
    state.queue=[...(state.queue||[]),job];state.updatedAt=new Date().toISOString();atomic(this.file,state);return job;
  }
}
module.exports={SocialPublishing,PLATFORMS,DEFAULT_POLICY};
