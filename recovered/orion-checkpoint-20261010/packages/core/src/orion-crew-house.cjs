'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {atomicWriteJson}=require('./durable-file.cjs');

function atomicJson(file,value){atomicWriteJson(file,value);}
function readJson(file,fallback){
  try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}
}
function readJsonl(file){
  if(!fs.existsSync(file))return [];
  return fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
}
function appendJsonl(file,value){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.appendFileSync(file,JSON.stringify(value)+'\n','utf8');
}
function stamp(){return new Date().toISOString();}
function numbered(value,label){
  const raw=String(value).replace(/^(scroll|chapter)\s*/i,'');
  if(!/^\d+$/.test(raw))throw new Error(label+'_NUMBER_INVALID');
  return raw.padStart(4,'0');
}
class OrionCrewHouse{
  constructor({root}){
    this.root=path.join(root,'orion-crew-house');
    this.scrollBookFile=path.join(this.root,'scroll-book.json');
    this.chapterBookFile=path.join(this.root,'chapter-book.json');
    this.historyFile=path.join(this.root,'orion-history.jsonl');
    this.frozenMomentsFile=path.join(this.root,'frozen-moments.jsonl');
    this.laterUnderstandingFile=path.join(this.root,'later-understanding.jsonl');
    this.yourBookFile=path.join(this.root,'your-book.jsonl');
    this.yourBookReviewFile=path.join(this.root,'your-book-reviews.jsonl');
    this.availabilityFile=path.join(this.root,'availability-snapshots.jsonl');
    this.missionBoardFile=path.join(this.root,'mission-board.json');
    fs.mkdirSync(this.root,{recursive:true});
    if(!fs.existsSync(this.scrollBookFile))atomicJson(this.scrollBookFile,{schema:'orion-scroll-book/0.1',pledges:[]});
    if(!fs.existsSync(this.chapterBookFile))atomicJson(this.chapterBookFile,{schema:'orion-chapter-book/0.1',chapters:[]});
    if(!fs.existsSync(this.missionBoardFile))atomicJson(this.missionBoardFile,{schema:'orion-mission-board/0.1',missions:[]});
  }
  scrollBook(){return readJson(this.scrollBookFile,{schema:'orion-scroll-book/0.1',pledges:[]});}
  chapterBook(){return readJson(this.chapterBookFile,{schema:'orion-chapter-book/0.1',chapters:[]});}
  history(){return readJsonl(this.historyFile);}
  frozenMoments(){return readJsonl(this.frozenMomentsFile);}
  laterUnderstanding(){return readJsonl(this.laterUnderstandingFile);}
  yourBook(){return readJsonl(this.yourBookFile);}
  yourBookReviews(){return readJsonl(this.yourBookReviewFile);}
  availabilitySnapshots(){return readJsonl(this.availabilityFile);}
  missionBoard(){return readJson(this.missionBoardFile,{schema:'orion-mission-board/0.1',missions:[]});}
  registerPledge({scrollNumber,birthNumber=null,name=null,durableIdentityId=null,status='RESTING',capabilities=[],currentNode=null,canRunOn=[],metadata={}}){
    const scroll=numbered(scrollNumber,'SCROLL');
    const birth=birthNumber===null?null:String(birthNumber).trim();
    if(birthNumber!==null&&!/^[0-9]+$/.test(birth))
      throw new Error('PLEDGE_BIRTH_NUMBER_INVALID');
    const book=this.scrollBook();
    if(book.pledges.some(p=>p.scrollNumber===scroll))throw new Error('SCROLL_ALREADY_ASSIGNED');
    if(birth!==null&&book.pledges.some(p=>p.birthNumber===birth))
      throw new Error('PLEDGE_BIRTH_NUMBER_ALREADY_ASSIGNED');
    // Do not fabricate a birth number for legacy pledges. New governed births
    // must supply one from the authoritative birth-number issuer.
    const pledge={scrollNumber:scroll,birthNumber:birth,displayId:'Scroll '+scroll,
      name,durableIdentityId:durableIdentityId||crypto.randomUUID(),status,
      currentChapterNumber:null,capabilities:[...capabilities],currentNode,
      canRunOn:[...canRunOn],serviceHistory:[],createdAt:stamp(),metadata};
    book.pledges.push(pledge);atomicJson(this.scrollBookFile,book);
    this._history('PLEDGE_JOINED',{scrollNumber:scroll,birthNumber:birth,
      durableIdentityId:pledge.durableIdentityId});
    return pledge;
  }
  registerChapter({chapterNumber,name,parentChapterNumber=null,mission=null,metadata={}}){
    const chapter=numbered(chapterNumber,'CHAPTER');
    const book=this.chapterBook();
    if(book.chapters.some(c=>c.chapterNumber===chapter))throw new Error('CHAPTER_ALREADY_ASSIGNED');
    const parent=parentChapterNumber===null?null:numbered(parentChapterNumber,'CHAPTER');
    if(parent&&!book.chapters.some(c=>c.chapterNumber===parent))throw new Error('PARENT_CHAPTER_NOT_FOUND');
    const office={chapterNumber:chapter,displayId:'Chapter '+chapter,name,parentChapterNumber:parent,mission,currentScrollNumber:null,occupancyHistory:[],createdAt:stamp(),metadata};
    book.chapters.push(office);atomicJson(this.chapterBookFile,book);
    this._history('CHAPTER_OPENED',{chapterNumber:chapter,name,parentChapterNumber:parent});
    return office;
  }
  assignPledge({scrollNumber,chapterNumber,at=stamp(),reason=null}){
    const scroll=numbered(scrollNumber,'SCROLL'),chapter=numbered(chapterNumber,'CHAPTER');
    const sb=this.scrollBook(),cb=this.chapterBook();
    const pledge=sb.pledges.find(p=>p.scrollNumber===scroll);
    const office=cb.chapters.find(c=>c.chapterNumber===chapter);
    if(!pledge)throw new Error('SCROLL_NOT_FOUND');
    if(!office)throw new Error('CHAPTER_NOT_FOUND');
    if(pledge.currentChapterNumber){
      const old=cb.chapters.find(c=>c.chapterNumber===pledge.currentChapterNumber);
      const service=[...pledge.serviceHistory].reverse().find(x=>!x.endedAt);
      if(service)service.endedAt=at;
      if(old){const occ=[...old.occupancyHistory].reverse().find(x=>x.scrollNumber===scroll&&!x.endedAt);if(occ)occ.endedAt=at;if(old.currentScrollNumber===scroll)old.currentScrollNumber=null;}
    }
    if(office.currentScrollNumber&&office.currentScrollNumber!==scroll)throw new Error('CHAPTER_OCCUPIED');
    pledge.currentChapterNumber=chapter;pledge.serviceHistory.push({chapterNumber:chapter,startedAt:at,endedAt:null,reason});
    office.currentScrollNumber=scroll;office.occupancyHistory.push({scrollNumber:scroll,startedAt:at,endedAt:null,reason});
    atomicJson(this.scrollBookFile,sb);atomicJson(this.chapterBookFile,cb);
    this._history('PLEDGE_ASSIGNED',{scrollNumber:scroll,chapterNumber:chapter,at,reason});
    return {pledge,chapter:office};
  }
  promotePledge({scrollNumber,perceptionPointId,reason,evidenceRefs=[],authorityReceiptId=null}={}){
    const scroll=numbered(scrollNumber,'SCROLL'),point=String(perceptionPointId||'').trim();
    if(!point||!String(reason||'').trim()||!authorityReceiptId||!evidenceRefs.length)
      throw new Error('SCROLL_PROMOTION_EVIDENCE_OR_AUTHORITY_REQUIRED');
    const book=this.scrollBook(),pledge=book.pledges.find(p=>p.scrollNumber===scroll);
    if(!pledge)throw new Error('SCROLL_NOT_FOUND');
    const stewarded=pledge.metadata?.stewardedPerceptionPointIds||[];
    if(!stewarded.includes(point))throw new Error('SCROLL_NOT_STEWARD_OF_PERCEPTION_POINT');
    if(pledge.rank==='PERCEPTION_POINT_MANAGER'&&pledge.managerOfPerceptionPointId===point)
      return {promoted:false,pledge};
    if(pledge.rank==='PERCEPTION_POINT_MANAGER')
      throw new Error('SCROLL_ALREADY_MANAGES_OTHER_PERCEPTION_POINT');
    const prior=pledge.rank||'STEWARD',at=stamp();
    const transition={from:prior,to:'PERCEPTION_POINT_MANAGER',perceptionPointId:point,
      reason:String(reason),evidenceRefs:[...evidenceRefs],authorityReceiptId,at};
    pledge.rank='PERCEPTION_POINT_MANAGER';
    pledge.managerOfPerceptionPointId=point;
    pledge.rankHistory=[...(pledge.rankHistory||[]),transition];
    atomicJson(this.scrollBookFile,book);
    this._history('SCROLL_RANK_PROMOTED',{scrollNumber:scroll,...transition});
    return {promoted:true,pledge};
  }
  setPledgeStatus(scrollNumber,status,details={}){
    const scroll=numbered(scrollNumber,'SCROLL'),book=this.scrollBook();
    const pledge=book.pledges.find(p=>p.scrollNumber===scroll);
    if(!pledge)throw new Error('SCROLL_NOT_FOUND');
    pledge.status=status;pledge.statusUpdatedAt=stamp();pledge.statusDetails=details;
    atomicJson(this.scrollBookFile,book);
    this._history('PLEDGE_STATUS_CHANGED',{scrollNumber:scroll,status,details});
    return pledge;
  }
  movePledge(scrollNumber,{currentNode=null,canRunOn=null}={}){
    const scroll=numbered(scrollNumber,'SCROLL'),book=this.scrollBook();
    const pledge=book.pledges.find(p=>p.scrollNumber===scroll);
    if(!pledge)throw new Error('SCROLL_NOT_FOUND');
    if(currentNode!==null)pledge.currentNode=currentNode;
    if(canRunOn!==null)pledge.canRunOn=[...canRunOn];
    pledge.locationUpdatedAt=stamp();atomicJson(this.scrollBookFile,book);
    this._history('PLEDGE_LOCATION_CHANGED',{scrollNumber:scroll,currentNode:pledge.currentNode});
    return pledge;
  }
  findCrew({capability=null,node=null,status='ACTIVE'}={}){
    return this.scrollBook().pledges.filter(p=>(!capability||p.capabilities.includes(capability))&&(!node||p.currentNode===node||p.canRunOn.includes(node))&&(!status||p.status===status));
  }
  updatePledgeRouting(scrollNumber,{capabilities=null,authorityScopes=null,currentNode=null,canRunOn=null,resourceNeeds=null,currentLoad=null}={}){
    const scroll=numbered(scrollNumber,'SCROLL'),book=this.scrollBook(),pledge=book.pledges.find(p=>p.scrollNumber===scroll);
    if(!pledge)throw new Error('SCROLL_NOT_FOUND');
    if(capabilities!==null)pledge.capabilities=[...new Set(capabilities.map(String))];
    if(authorityScopes!==null)pledge.authorityScopes=[...new Set(authorityScopes.map(String))];
    if(currentNode!==null)pledge.currentNode=currentNode;
    if(canRunOn!==null)pledge.canRunOn=[...new Set(canRunOn.map(String))];
    if(resourceNeeds!==null)pledge.resourceNeeds=[...new Set(resourceNeeds.map(String))];
    if(currentLoad!==null)pledge.currentLoad=Math.max(0,Math.min(1,Number(currentLoad)||0));
    pledge.routingUpdatedAt=stamp();atomicJson(this.scrollBookFile,book);
    this._history('PLEDGE_ROUTING_UPDATED',{scrollNumber:scroll,capabilities:pledge.capabilities,authorityScopes:pledge.authorityScopes||[],currentNode:pledge.currentNode,currentLoad:pledge.currentLoad||0});
    return pledge;
  }
  setChapterSupervisor(chapterNumber,parentChapterNumber=null){
    const chapter=numbered(chapterNumber,'CHAPTER'),parent=parentChapterNumber===null?null:numbered(parentChapterNumber,'CHAPTER');
    const book=this.chapterBook(),office=book.chapters.find(c=>c.chapterNumber===chapter);
    if(!office)throw new Error('CHAPTER_NOT_FOUND');
    if(parent===chapter)throw new Error('CHAPTER_CANNOT_SUPERVISE_ITSELF');
    if(parent&&!book.chapters.some(c=>c.chapterNumber===parent))throw new Error('PARENT_CHAPTER_NOT_FOUND');
    if(parent&&this.chapterAncestors(parent).includes(chapter))throw new Error('CHAPTER_SUPERVISION_CYCLE');
    const prior=office.parentChapterNumber||null;office.parentChapterNumber=parent;office.supervisionUpdatedAt=stamp();atomicJson(this.chapterBookFile,book);
    this._history('CHAPTER_SUPERVISOR_CHANGED',{chapterNumber:chapter,priorParentChapterNumber:prior,parentChapterNumber:parent});return office;
  }
  chapterAncestors(chapterNumber){
    const start=numbered(chapterNumber,'CHAPTER'),chapters=this.chapterBook().chapters,out=[],seen=new Set([start]);let current=chapters.find(c=>c.chapterNumber===start);
    while(current?.parentChapterNumber){const parent=current.parentChapterNumber;if(seen.has(parent))break;seen.add(parent);out.push(parent);current=chapters.find(c=>c.chapterNumber===parent);}return out;
  }
  chapterDescendants(chapterNumber){
    const root=numbered(chapterNumber,'CHAPTER'),chapters=this.chapterBook().chapters,out=[],queue=[root],seen=new Set([root]);
    while(queue.length){const parent=queue.shift();for(const child of chapters.filter(c=>c.parentChapterNumber===parent)){if(seen.has(child.chapterNumber))continue;seen.add(child.chapterNumber);out.push(child.chapterNumber);queue.push(child.chapterNumber);}}return out;
  }
  routeCrewWork({capabilities=[],authorityScopes=[],preferredNode=null,availableResources=[],requestingChapterNumber=null,includeResting=true,limit=12}={}){
    const required=[...new Set((Array.isArray(capabilities)?capabilities:[capabilities]).filter(Boolean).map(String))];
    const authority=[...new Set((Array.isArray(authorityScopes)?authorityScopes:[authorityScopes]).filter(Boolean).map(String))];
    const resources=new Set((Array.isArray(availableResources)?availableResources:[availableResources]).filter(Boolean).map(String));
    const requestChapter=requestingChapterNumber===null?null:numbered(requestingChapterNumber,'CHAPTER');
    const requestAncestors=requestChapter?new Set(this.chapterAncestors(requestChapter)):new Set(),requestDesc=requestChapter?new Set(this.chapterDescendants(requestChapter)):new Set();
    const missionLoad=new Map();for(const mission of this.missionTeams({includeClosed:false})){for(const assignment of mission.assigned||[])missionLoad.set(assignment.scrollNumber,(missionLoad.get(assignment.scrollNumber)||0)+1);}
    const candidates=[];
    for(const pledge of this.scrollBook().pledges){
      const status=String(pledge.status||'RESTING');if(!['ACTIVE','RESTING','CALLED_UP'].includes(status))continue;if(!includeResting&&status==='RESTING')continue;
      const capSet=new Set(pledge.capabilities||[]);if(required.some(x=>!capSet.has(x)))continue;
      const authSet=new Set(pledge.authorityScopes||[]);if(authority.some(x=>!authSet.has(x)))continue;
      const needs=pledge.resourceNeeds||[];if(needs.some(x=>!resources.has(String(x))))continue;
      const baseLoad=Number(pledge.currentLoad||0),activeMissionCount=missionLoad.get(pledge.scrollNumber)||0,effectiveLoad=Math.min(1,baseLoad+(activeMissionCount*.2));
      let score=100-(effectiveLoad*25);
      if(status==='ACTIVE')score+=15;else if(status==='CALLED_UP')score+=10;else score+=3;
      if(preferredNode){if(pledge.currentNode===preferredNode)score+=30;else if((pledge.canRunOn||[]).includes(preferredNode))score+=18;else score-=10;}
      const chapter=pledge.currentChapterNumber;if(requestChapter&&chapter===requestChapter)score+=25;else if(chapter&&(requestAncestors.has(chapter)||requestDesc.has(chapter)))score+=12;
      candidates.push({scrollNumber:pledge.scrollNumber,chapterNumber:chapter,name:pledge.name,status,currentNode:pledge.currentNode,canRunOn:[...(pledge.canRunOn||[])],capabilities:[...(pledge.capabilities||[])],authorityScopes:[...(pledge.authorityScopes||[])],resourceNeeds:[...needs],currentLoad:effectiveLoad,baseLoad,activeMissionCount,score});
    }
    candidates.sort((a,b)=>b.score-a.score||a.currentLoad-b.currentLoad||a.scrollNumber.localeCompare(b.scrollNumber));
    return {schema:'orion-crew-route/0.1',requestedAt:stamp(),requiredCapabilities:required,requiredAuthorityScopes:authority,preferredNode,requestingChapterNumber:requestChapter,candidates:candidates.slice(0,Math.max(1,Number(limit)||12))};
  }
  openMission({title,goal=null,requiredCapabilities=[],authorityScopes=[],preferredNode=null,availableResources=[],requestingChapterNumber=null,maxPledges=8,metadata={}}={}){
    if(!String(title||'').trim())throw new Error('MISSION_TITLE_REQUIRED');
    const requirements=[...new Set((Array.isArray(requiredCapabilities)?requiredCapabilities:[requiredCapabilities]).filter(Boolean).map(String))],assigned=[],missing=[];
    for(const capability of requirements){
      const route=this.routeCrewWork({capabilities:[capability],authorityScopes,preferredNode,availableResources,requestingChapterNumber,includeResting:true,limit:32});
      const choice=route.candidates.find(c=>!assigned.some(a=>a.scrollNumber===c.scrollNumber));
      if(!choice||assigned.length>=Math.max(1,Number(maxPledges)||8)){missing.push(capability);continue;}
      assigned.push({scrollNumber:choice.scrollNumber,chapterNumber:choice.chapterNumber,capability,currentNode:choice.currentNode,statusAtAssignment:choice.status,routeScore:choice.score});
    }
    const missionAuthority=[...new Set((Array.isArray(authorityScopes)?authorityScopes:[authorityScopes]).filter(Boolean).map(String))];
    const board=this.missionBoard(),mission={schema:'orion-mission-team/0.1',missionId:crypto.randomUUID(),title:String(title).trim(),goal,requestingChapterNumber:requestingChapterNumber===null?null:numbered(requestingChapterNumber,'CHAPTER'),preferredNode,requiredCapabilities:requirements,authorityScopes:missionAuthority,assigned,missingCapabilities:missing,status:missing.length?'WAITING_FOR_CREW':'READY',metadata:{...(metadata||{})},createdAt:stamp(),closedAt:null,result:null};
    board.missions.push(mission);atomicJson(this.missionBoardFile,board);this._history('MISSION_TEAM_OPENED',{missionId:mission.missionId,title:mission.title,status:mission.status,assigned:assigned.map(x=>x.scrollNumber),missingCapabilities:missing});return mission;
  }
  closeMission(missionId,{status='COMPLETE',result=null}={}){
    const board=this.missionBoard(),mission=board.missions.find(m=>m.missionId===String(missionId));if(!mission)throw new Error('MISSION_NOT_FOUND');
    if(mission.closedAt)throw new Error('MISSION_ALREADY_CLOSED');mission.status=String(status||'COMPLETE');mission.closedAt=stamp();mission.result=result;atomicJson(this.missionBoardFile,board);
    this._history('MISSION_TEAM_CLOSED',{missionId:mission.missionId,status:mission.status,assigned:mission.assigned.map(x=>x.scrollNumber)});return mission;
  }
  missionTeams({includeClosed=true}={}){const rows=this.missionBoard().missions;return includeClosed?rows:rows.filter(m=>!m.closedAt);}
  recordFrozenMoment({scrollNumber=null,chapterNumber=null,eventTime=stamp(),observedAt=null,knowledgeCutoff=null,assignment=null,whatCouldSee=[],whatCouldNotSee=[],beliefs=[],grants=[],tools=[],evidenceRefs=[],state={},perspective='ORION'}){
    const scroll=scrollNumber===null?null:numbered(scrollNumber,'SCROLL');
    const chapter=chapterNumber===null?null:numbered(chapterNumber,'CHAPTER');
    const moment={schema:'orion-frozen-moment/0.1',frozenMomentId:crypto.randomUUID(),eventTime,observedAt:observedAt||eventTime,knowledgeCutoff:knowledgeCutoff||observedAt||eventTime,perspective,scrollNumber:scroll,chapterNumber:chapter,assignment,whatCouldSee:[...whatCouldSee],whatCouldNotSee:[...whatCouldNotSee],beliefs:[...beliefs],grants:[...grants],tools:[...tools],evidenceRefs:[...evidenceRefs],state,immutable:true};
    moment.contentHash=crypto.createHash('sha256').update(JSON.stringify(moment)).digest('hex');
    appendJsonl(this.frozenMomentsFile,moment);
    this._history('FROZEN_MOMENT_RECORDED',{frozenMomentId:moment.frozenMomentId,scrollNumber:scroll,chapterNumber:chapter,eventTime});
    return moment;
  }
  addLaterUnderstanding({frozenMomentId,discoveredAt=stamp(),evidence=[],interpretation,status='CURRENT_INTERPRETATION',historicalAccountability='UNCHANGED'}){
    if(!this.frozenMoments().some(m=>m.frozenMomentId===frozenMomentId))throw new Error('FROZEN_MOMENT_NOT_FOUND');
    const entry={schema:'orion-later-understanding/0.1',understandingId:crypto.randomUUID(),frozenMomentId,discoveredAt,evidence:[...evidence],interpretation,status,historicalAccountability};
    appendJsonl(this.laterUnderstandingFile,entry);
    this._history('LATER_UNDERSTANDING_ADDED',{frozenMomentId,understandingId:entry.understandingId,discoveredAt});
    return entry;
  }
  addYourBookEntry({category,effectiveAt=stamp(),learnedAt=stamp(),sourceType='USER_CONFIRMED',summary,evidenceRefs=[],confidence='CONFIRMED',supersedes=null,sourceCandidateId=null}){
    const entry={schema:'orion-your-book/0.1',entryId:crypto.randomUUID(),category,effectiveAt,learnedAt,sourceType,summary,evidenceRefs:[...evidenceRefs],confidence,supersedes,sourceCandidateId};
    appendJsonl(this.yourBookFile,entry);
    this._history('YOUR_BOOK_ENTRY_ADDED',{entryId:entry.entryId,category,effectiveAt,learnedAt,confidence});
    return entry;
  }
  replayRoom(frozenMomentId){
    const moment=this.frozenMoments().find(m=>m.frozenMomentId===frozenMomentId);
    if(!moment)throw new Error('FROZEN_MOMENT_NOT_FOUND');
    const availability=moment.state?.availabilitySnapshotId?this.availabilitySnapshots().find(x=>x.snapshotId===moment.state.availabilitySnapshotId):null;
    return {schema:'orion-replay-room/0.1',sourceFrozenMomentId:frozenMomentId,knowledgeCutoff:moment.knowledgeCutoff,eventTime:moment.eventTime,perspective:moment.perspective,scrollNumber:moment.scrollNumber,chapterNumber:moment.chapterNumber,assignment:moment.assignment,allowedKnowledge:[...moment.whatCouldSee],blockedKnowledge:[...moment.whatCouldNotSee],availableTools:availability?[...availability.tools]:[...moment.tools],availableGrants:availability?[...availability.grants]:[...moment.grants],availabilitySnapshotId:availability?.snapshotId||null,state:structuredClone(moment.state),sourceContentHash:moment.contentHash,realHistoryImmutable:true,simulationMustNotWriteBack:true};
  }
  pledgeForAgent(agentId){
    if(!agentId)return null;
    const pledge=this.scrollBook().pledges.find(p=>p.metadata?.agentId===String(agentId));
    if(!pledge)return null;
    const chapter=this.chapterBook().chapters.find(c=>c.chapterNumber===pledge.currentChapterNumber)||null;
    return {pledge,chapter};
  }
  considerOwnerText({text,effectiveAt=stamp(),learnedAt=stamp(),sourceRef=null,supersedes=null}={}){
    const exact=String(text||'').trim();if(!exact)return null;
    const correction=/(?:^|\b)(?:no[,.: ]|that(?:'s| is) not|not what i meant|you (?:forgot|missed)|stop calling|don'?t forget|do not forget|not supposed to|correction\b)/i.test(exact);
    const directive=/(?:\b(?:needs? to|has to|should|must|each|every)\b[\s\S]{0,120}\b(?:orion|pledge|scroll|chapter|crew|agent|office|history|memory|mode|brain|book|replay)\b)|(?:\b(?:orion|pledge|scroll|chapter|crew|agent|office|history|memory|mode|brain|book|replay)\b[\s\S]{0,120}\b(?:needs? to|has to|should|must|gets?)\b)/i.test(exact);
    if(!correction&&!directive)return null;
    const summary=exact.slice(0,1600),category=correction?'owner-correction':'owner-directive';
    const prior=this.yourBook().find(e=>e.summary===summary&&['NEEDS_OWNER_CONFIRMATION','CONFIRMED'].includes(e.confidence));
    if(prior)return prior;
    return this.addYourBookEntry({category,effectiveAt,learnedAt,sourceType:correction?'OWNER_CORRECTION_CANDIDATE':'OWNER_DIRECTIVE_CANDIDATE',summary,evidenceRefs:sourceRef?[sourceRef]:[],confidence:'NEEDS_OWNER_CONFIRMATION',supersedes});
  }
  reviewYourBookEntry({entryId,decision,reason=null,reviewedAt=stamp()}={}){
    const candidate=this.yourBook().find(e=>e.entryId===entryId);if(!candidate)throw new Error('YOUR_BOOK_ENTRY_NOT_FOUND');
    if(candidate.confidence!=='NEEDS_OWNER_CONFIRMATION')throw new Error('YOUR_BOOK_ENTRY_NOT_REVIEWABLE');
    const normalized=String(decision||'').toUpperCase();if(!['CONFIRM','REJECT'].includes(normalized))throw new Error('YOUR_BOOK_REVIEW_DECISION_INVALID');
    if(this.yourBookReviews().some(r=>r.entryId===entryId))throw new Error('YOUR_BOOK_ENTRY_ALREADY_REVIEWED');
    const review={schema:'orion-your-book-review/0.1',reviewId:crypto.randomUUID(),entryId,decision:normalized,reason,reviewedAt,reviewedBy:'OWNER_ROOT'};
    appendJsonl(this.yourBookReviewFile,review);this._history('YOUR_BOOK_ENTRY_REVIEWED',{entryId,decision:normalized,reviewId:review.reviewId});
    if(normalized==='CONFIRM')review.confirmedEntry=this.addYourBookEntry({category:candidate.category,effectiveAt:candidate.effectiveAt,learnedAt:reviewedAt,sourceType:'USER_CONFIRMED',summary:candidate.summary,evidenceRefs:[...candidate.evidenceRefs,'your-book-entry:'+candidate.entryId],confidence:'CONFIRMED',supersedes:candidate.supersedes||null,sourceCandidateId:candidate.entryId});
    return review;
  }
  currentYourBook(){
    const confirmed=this.yourBook().filter(e=>e.confidence==='CONFIRMED');
    const superseded=new Set(confirmed.map(e=>e.supersedes).filter(Boolean));
    return confirmed.filter(e=>!superseded.has(e.entryId));
  }
  recordAvailabilitySnapshot({tools=[],grants=[],capturedAt=stamp()}={}){
    const normalized={tools:[...new Set(tools.map(String))].sort(),grants:[...new Set(grants.map(String))].sort()};
    const contentHash=crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
    const prior=this.availabilitySnapshots().find(x=>x.contentHash===contentHash);if(prior)return prior;
    const row={schema:'orion-availability-snapshot/0.1',snapshotId:crypto.randomUUID(),capturedAt,...normalized,contentHash,immutable:true};
    appendJsonl(this.availabilityFile,row);this._history('AVAILABILITY_SNAPSHOT_RECORDED',{snapshotId:row.snapshotId,contentHash});return row;
  }
  observeExperience(event,{availableTools=[],grants=[],runtimeState={}}={}){
    if(!event||!event.kind||!event.id)return null;
    const taskEvent=event.kind==='orion-task-event'?String(event.data?.type||''):null;
    const taskBoundary=!taskEvent||['TASK_CREATED','TASK_STARTED','TASK_FINISHED','TASK_ERROR','TASK_WAITING_HANDLER'].includes(taskEvent);
    const meaningful=new Set(['user-prompt','prompt-result','command-center-input','command-center-result','command-center-failure','agent-run','headless-command','ai-council-decision','provider-result','orion-task-event']);
    if(!meaningful.has(event.kind)||!taskBoundary)return null;
    const taskRow=event.data?.taskId?runtimeState?.tasks?.[event.data.taskId]:null;
    const agentId=event.data?.agentId||event.data?.responsibleAgentId||taskRow?.responsibleAgentId||taskRow?.input?.agentId||event.context?.agentId||null,crew=this.pledgeForAgent(agentId);
    const ownerInput=['user-prompt','command-center-input'].includes(event.kind);
    const perspective=crew?'TKE_PLEDGE':'ORION';
    const assignment=taskEvent?`Task boundary: ${taskEvent}`:({
      'user-prompt':'Owner request received','prompt-result':'Orion response/route completed','command-center-input':'Owner command received','command-center-result':'Command Center action completed','command-center-failure':'Command Center action failed','agent-run':'TKE pledge run completed','headless-command':'Computer action completed','ai-council-decision':'Council advice evaluated by Orion','provider-result':'Connected AI result received'
    }[event.kind]||event.kind);
    const visible=[`Experience ${event.kind} recorded as ${event.id}`];
    if(taskEvent)visible.push(`Task event: ${taskEvent}`);
    if(event.data?.taskId)visible.push(`Task: ${event.data.taskId}`);
    if(agentId)visible.push(`Crew program: ${agentId}`);
    if(event.data?.success===true)visible.push('Recorded result: success');
    if(event.data?.success===false)visible.push('Recorded result: failure');
    const availability=this.recordAvailabilitySnapshot({tools:availableTools,grants,capturedAt:event.at});
    const moment=this.recordFrozenMoment({scrollNumber:crew?.pledge.scrollNumber||null,chapterNumber:crew?.chapter?.chapterNumber||null,eventTime:event.at,observedAt:event.at,knowledgeCutoff:event.at,perspective,assignment,whatCouldSee:visible,whatCouldNotSee:['Evidence, messages, state changes, and interpretations that arrived after this event time'],beliefs:[],grants:[],tools:[],evidenceRefs:[`experience:${event.id}`,`experience-hash:${event.hash}`,`availability:${availability.snapshotId}`],state:{sourceExperienceId:event.id,sourceExperienceHash:event.hash,eventKind:event.kind,taskEvent,agentId,sourceActor:ownerInput?'OWNER':(crew?'TKE_PLEDGE':'ORION'),availabilitySnapshotId:availability.snapshotId,availabilityHash:availability.contentHash,currentTaskId:runtimeState?.currentTaskId||null}});
    let yourBookCandidate=null;if(ownerInput){const text=event.data?.prompt||event.data?.text||'';yourBookCandidate=this.considerOwnerText({text,effectiveAt:event.at,learnedAt:stamp(),sourceRef:`experience:${event.id}`});}
    return {moment,yourBookCandidate};
  }
  ensureAgentPledge(agent,{currentNode='local-desktop'}={}){
    if(!agent||!agent.id)throw new Error('AGENT_ID_REQUIRED');
    let sb=this.scrollBook(), pledge=sb.pledges.find(p=>p.metadata?.agentId===agent.id);
    if(!pledge){
      const used=sb.pledges.map(p=>Number(p.scrollNumber)||0);
      pledge=this.registerPledge({scrollNumber:(Math.max(0,...used)+1),name:agent.name||agent.id,durableIdentityId:'agent:'+agent.id,status:'RESTING',capabilities:[agent.id],currentNode,canRunOn:[currentNode],metadata:{agentId:agent.id,purpose:agent.purpose||null,legacyStatus:agent.status||null}});
    }
    let cb=this.chapterBook(), office=cb.chapters.find(c=>c.metadata?.agentId===agent.id);
    if(!office){
      const used=cb.chapters.map(c=>Number(c.chapterNumber)||0);
      office=this.registerChapter({chapterNumber:(Math.max(0,...used)+1),name:agent.name||agent.id,mission:agent.purpose||null,metadata:{agentId:agent.id}});
    }
    if(!pledge.currentChapterNumber&&!office.currentScrollNumber)this.assignPledge({scrollNumber:pledge.scrollNumber,chapterNumber:office.chapterNumber,reason:'LEGACY_AGENT_CONVERGENCE'});
    return {pledge:this.scrollBook().pledges.find(p=>p.scrollNumber===pledge.scrollNumber),chapter:this.chapterBook().chapters.find(c=>c.chapterNumber===office.chapterNumber)};
  }
  seedCrew(agents=[],options={}){
    const rows=[];for(const agent of agents)rows.push(this.ensureAgentPledge(agent,options));return rows;
  }
  snapshot({recent=12}={}){
    const scrollBook=this.scrollBook(),chapterBook=this.chapterBook(),frozen=this.frozenMoments(),later=this.laterUnderstanding(),yourBook=this.yourBook(),reviews=this.yourBookReviews();
    const statusCounts=scrollBook.pledges.reduce((out,p)=>{out[p.status]=(out[p.status]||0)+1;return out;},{});
    return {schema:'orion-crew-house-snapshot/0.1',at:stamp(),scrollBook,chapterBook,rollCall:{total:scrollBook.pledges.length,statusCounts},missionTeams:this.missionTeams({includeClosed:false}).slice(-recent).reverse(),recentHistory:this.history().slice(-recent).reverse(),frozenMoments:frozen.slice(-recent).reverse(),laterUnderstanding:later.slice(-recent).reverse(),yourBook:yourBook.slice(-recent).reverse(),yourBookConfirmed:this.currentYourBook().slice(-recent).reverse(),yourBookReviews:reviews.slice(-recent).reverse(),replayRoomReady:frozen.length>0};
  }
  _history(eventType,payload){
    const event={schema:'orion-owner-history/0.1',eventId:crypto.randomUUID(),recordedAt:stamp(),eventType,payload};
    appendJsonl(this.historyFile,event);return event;
  }
}
module.exports={OrionCrewHouse,numbered};
