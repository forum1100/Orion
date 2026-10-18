const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const SOURCE_CLASSES=Object.freeze([
  'CONSTITUTION','STATUTE','COURT_RULE','LOCAL_ADMIN_ORDER','PUBLISHED_CASE','UNPUBLISHED_CASE',
  'REGULATION','OFFICIAL_AGENCY_GUIDANCE','DOCKET_RECORD','USER_EVIDENCE','SECONDARY_AUTHORITY'
]);
const AUTHORITY_RANK=Object.freeze({CONSTITUTION:100,STATUTE:90,COURT_RULE:90,LOCAL_ADMIN_ORDER:85,
  PUBLISHED_CASE:80,REGULATION:75,UNPUBLISHED_CASE:55,OFFICIAL_AGENCY_GUIDANCE:50,
  DOCKET_RECORD:45,SECONDARY_AUTHORITY:30,USER_EVIDENCE:20});
const DEFAULT_PROFILE=Object.freeze({country:'US',state:'FL',county:'Volusia',primaryCourtSystem:'Florida State Courts'});

function hash(value){return crypto.createHash('sha256').update(String(value)).digest('hex');}
function atomic(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2),'utf8');fs.renameSync(tmp,file);}

class ProSeLegalCopilot {
  constructor({root,vault=null,experience=null,runAICouncil=null,sprintEnd='2026-09-29T23:13:00-04:00',intervalMs=3*60*60*1000}={}){
    this.root=path.join(root,'legal-pro-se'); this.file=path.join(this.root,'state.json');
    this.vault=vault;this.experience=experience;this.runAICouncil=runAICouncil;this.sprintEnd=new Date(sprintEnd);
    this.intervalMs=Math.max(30*60*1000,Number(intervalMs)||3*60*60*1000); this.timer=null; this.running=false;
    fs.mkdirSync(this.root,{recursive:true});
  }
  load(){try{return JSON.parse(fs.readFileSync(this.file,'utf8'));}catch{return {schema:'dt-pro-se-legal/1.0',
    role:'PRO_SE_LEGAL_RESEARCH_DRAFTING_PROCEDURE_COPILOT_NOT_ATTORNEY_OF_RECORD',sprintEnd:this.sprintEnd.toISOString(),
    profiles:{primary:DEFAULT_PROFILE},sources:{},training:{tasks:[],completed:[]},updatedAt:null};}}
  registerSource(input={}){
    const type=String(input.type||'').toUpperCase(); if(!SOURCE_CLASSES.includes(type))throw new Error('Unknown legal source class');
    const url=String(input.url||'').trim(), citation=String(input.citation||input.title||url).trim();
    const record={id:input.id||hash(type+'|'+citation+'|'+url).slice(0,24),type,citation,url:url||null,
      jurisdiction:input.jurisdiction||DEFAULT_PROFILE,effectiveDate:input.effectiveDate||null,
      checkedAt:input.checkedAt||new Date().toISOString(),authorityRank:AUTHORITY_RANK[type]||0,
      status:input.status||'UNVERIFIED',notes:input.notes||null,sourceHash:input.sourceHash||null};
    const state=this.load(); state.sources[record.id]=record; state.updatedAt=new Date().toISOString(); atomic(this.file,state);
    this.experience?.append('legal-source-registered',record,{sourceClass:'LEGAL_SOURCE_METADATA'});
    this.vault?.append('legal-source-registered','orion-legal',record); return record;
  }
  status(){const s=this.load();return {...s,sprintActive:Date.now()<this.sprintEnd.getTime(),running:this.running,intervalMs:this.intervalMs,sourceCount:Object.keys(s.sources||{}).length};}
  validateSource(input={}){
    const type=String(input.type||'').toUpperCase(); const rank=AUTHORITY_RANK[type]||0;
    const problems=[]; if(!SOURCE_CLASSES.includes(type))problems.push('UNKNOWN_SOURCE_CLASS');
    if(!input.citation&&!input.url)problems.push('NO_CITATION_OR_URL');
    if(!input.checkedAt)problems.push('FRESHNESS_NOT_RECORDED');
    if(!input.jurisdiction)problems.push('JURISDICTION_NOT_RECORDED');
    return {valid:problems.length===0,authorityRank:rank,problems,
      rule:'Primary authority and current procedural sources outrank secondary summaries; user evidence proves facts, not governing law.'};
  }
  trainingPlan(profile=DEFAULT_PROFILE){
    const tasks=[
      'Build jurisdiction map: federal, state, county/local, trial/appellate, administrative bodies.',
      'Index current constitutions, statutes, procedural rules, evidence rules, local administrative orders, and filing requirements.',
      'Learn citation verification: confirm quoted proposition, court, date, precedential status, and later treatment before use.',
      'Learn procedural-calendar generation from service/filed/hearing dates with explicit rule/source for each deadline.',
      'Learn record architecture: pleadings, orders, transcripts, exhibits, correspondence, agency records, service proofs, and docket chronology.',
      'Learn motion/response drafting structure: requested relief, facts with record cites, governing law, application, preservation, certificate/service blocks.',
      'Learn opposing-argument testing and preservation of adverse authority instead of hiding it.',
      'Learn pro se workflow UX: plain-language options, draft generation, checklist, filing packet, source ledger, unresolved questions.',
      'Train jurisdiction portability so a new state/county profile rebuilds sources instead of reusing Florida rules by assumption.'
    ];
    return {profile,sprintEnd:this.sprintEnd.toISOString(),tasks,completionGate:{
      sourceFreshnessRequired:true,primaryAuthorityPreferred:true,localProcedureVerified:true,
      citationValidationRequired:true,adverseAuthorityPreserved:true,proceduralPostureRequired:true,
      noAttorneyRepresentationClaim:true}};
  }
  async consultPeers(question,profile=DEFAULT_PROFILE){
    if(typeof this.runAICouncil!=='function')return {available:false,reason:'COUNCIL_UNAVAILABLE'};
    try{return await this.runAICouncil({advisoryOnly:true,task:[
      'LEGAL TRAINING TASK FOR ORION. This is legal research/engineering support for a pro se user, not attorney representation.',
      'Jurisdiction profile: '+JSON.stringify(profile),
      'Question: '+String(question||''),
      'Identify primary authorities and official procedural sources to verify. Separate binding law, persuasive authority, local procedure, facts, and uncertainty.',
      'Do not invent citations. Return implementation/training recommendations for Orion and a verification checklist.'
    ].join('\n')},{ownerApproved:false});}catch(error){return {available:false,reason:'COUNCIL_ERROR',error:String(error.message||error)};}
  }
  async trainingCycle(input={}){
    if(Date.now()>=this.sprintEnd.getTime()) return {status:'LEGAL_SPRINT_COMPLETE',sprintEnd:this.sprintEnd.toISOString()};
    const state=this.load(); const profile=input.profile||state.profiles?.primary||DEFAULT_PROFILE;
    const plan=this.trainingPlan(profile); const question=String(input.question||plan.tasks[(state.training.completed||[]).length%plan.tasks.length]);
    const peer=await this.consultPeers(question,profile);
    const row={id:crypto.randomUUID(),startedAt:new Date().toISOString(),profile,question,peer,
      status:peer?.available===false?'LOCAL_PLAN_ONLY':'ADVISORY_COLLECTED',completedAt:new Date().toISOString()};
    state.training.tasks=plan.tasks; state.training.completed=[...(state.training.completed||[]),row].slice(-500);
    state.updatedAt=row.completedAt; atomic(this.file,state); this.vault?.append('legal-training-cycle','orion-legal',row);
    this.experience?.append('legal-training-cycle',row,{sourceClass:'DERIVED_LEGAL_TRAINING'}); return row;
  }
  start(){
    if(Date.now()>=this.sprintEnd.getTime()) return this.status();
    this.running=true; const state=this.load(); state.updatedAt=new Date().toISOString(); atomic(this.file,state);
    if(!this.timer)this.timer=setInterval(()=>this.trainingCycle().catch(()=>{}),this.intervalMs);
    setTimeout(()=>this.trainingCycle().catch(()=>{}),90000);
    return this.status();
  }
  stop(){if(this.timer)clearInterval(this.timer);this.timer=null;this.running=false;return this.status();}
}
module.exports={ProSeLegalCopilot,SOURCE_CLASSES,AUTHORITY_RANK,DEFAULT_PROFILE};
