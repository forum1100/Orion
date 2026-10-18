'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {OrionCrewHouse}=require('../packages/core/src/orion-crew-house.cjs');

function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'orion-crew-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  return new OrionCrewHouse({root});
}

test('scroll identity survives chapter reassignment and node movement',t=>{
  const crew=fixture(t);
  const pledge=crew.registerPledge({scrollNumber:42,name:'Atlas',status:'ACTIVE',capabilities:['queue.recover'],currentNode:'Dad Desktop',canRunOn:['Dad Desktop','Compute Node']});
  crew.registerChapter({chapterNumber:7,name:'Scheduling'});
  crew.registerChapter({chapterNumber:12,name:'Recovery'});
  crew.assignPledge({scrollNumber:42,chapterNumber:7,at:'2026-09-27T23:00:00.000Z'});
  crew.assignPledge({scrollNumber:42,chapterNumber:12,at:'2026-09-27T23:30:00.000Z'});
  crew.movePledge(42,{currentNode:'Compute Node'});
  const current=crew.scrollBook().pledges.find(p=>p.scrollNumber==='0042');
  assert.equal(current.durableIdentityId,pledge.durableIdentityId);
  assert.equal(current.currentChapterNumber,'0012');
  assert.equal(current.currentNode,'Compute Node');
});
test('chapter identity survives occupant changes',t=>{
  const crew=fixture(t);
  crew.registerPledge({scrollNumber:1,name:'One',status:'ACTIVE'});
  crew.registerPledge({scrollNumber:2,name:'Two',status:'ACTIVE'});
  crew.registerChapter({chapterNumber:7,name:'Scheduling'});
  crew.registerChapter({chapterNumber:8,name:'Holding'});
  crew.assignPledge({scrollNumber:1,chapterNumber:7,at:'2026-09-27T20:00:00.000Z'});
  crew.assignPledge({scrollNumber:1,chapterNumber:8,at:'2026-09-27T20:30:00.000Z'});
  crew.assignPledge({scrollNumber:2,chapterNumber:7,at:'2026-09-27T20:31:00.000Z'});
  const chapter=crew.chapterBook().chapters.find(c=>c.chapterNumber==='0007');
  assert.equal(chapter.currentScrollNumber,'0002');
  assert.equal(chapter.occupancyHistory[0].scrollNumber,'0001');
  assert.equal(chapter.occupancyHistory[1].scrollNumber,'0002');
});
test('later understanding does not rewrite a frozen moment',t=>{
  const crew=fixture(t);
  const moment=crew.recordFrozenMoment({eventTime:'2026-09-27T23:44:13.000Z',whatCouldSee:['worker heartbeat missing'],whatCouldNotSee:['later hardware finding'],beliefs:['worker likely stalled']});
  const before=fs.readFileSync(crew.frozenMomentsFile,'utf8');
  crew.addLaterUnderstanding({frozenMomentId:moment.frozenMomentId,discoveredAt:'2026-09-28T00:13:00.000Z',evidence:['later diagnostic evidence'],interpretation:'Original diagnosis was incomplete'});
  assert.equal(fs.readFileSync(crew.frozenMomentsFile,'utf8'),before);
  assert.equal(crew.laterUnderstanding()[0].historicalAccountability,'UNCHANGED');
});

test('Replay Room is locked to the original knowledge cutoff',t=>{
  const crew=fixture(t);
  const moment=crew.recordFrozenMoment({eventTime:'2026-05-07T14:17:32.000Z',knowledgeCutoff:'2026-05-07T14:17:32.000Z',whatCouldSee:['A','B'],whatCouldNotSee:['C learned later'],tools:['screen.read'],grants:['screen.read']});
  const replay=crew.replayRoom(moment.frozenMomentId);
  assert.equal(replay.knowledgeCutoff,'2026-05-07T14:17:32.000Z');
  assert.deepEqual(replay.allowedKnowledge,['A','B']);
  assert.deepEqual(replay.blockedKnowledge,['C learned later']);
  assert.equal(replay.simulationMustNotWriteBack,true);
});
test('distributed Crew routing finds a pledge by capability and reachable node',t=>{
  const crew=fixture(t);
  crew.registerPledge({scrollNumber:81,name:'GPU Pledge',status:'ACTIVE',capabilities:['compute.gpu'],currentNode:'Compute Node 02',canRunOn:['Compute Node 02']});
  crew.registerPledge({scrollNumber:82,name:'Memory Pledge',status:'RESTING',capabilities:['memory.archive'],currentNode:'NAS'});
  const matches=crew.findCrew({capability:'compute.gpu',node:'Compute Node 02'});
  assert.equal(matches.length,1);
  assert.equal(matches[0].scrollNumber,'0081');
});

test('Your Book preserves effective time separately from learning time',t=>{
  const crew=fixture(t);
  const entry=crew.addYourBookEntry({category:'terminology',effectiveAt:'2026-05-01T12:00:00.000Z',learnedAt:'2026-09-27T23:50:00.000Z',summary:'Earlier concept later recognized as part of the Crew architecture',confidence:'STRONGLY_SUPPORTED'});
  assert.notEqual(entry.effectiveAt,entry.learnedAt);
  assert.equal(crew.yourBook()[0].summary,entry.summary);
});

test('legacy agent programs converge into stable Scrolls and Chapters',t=>{
  const crew=fixture(t);
  const agents=[{id:'librarian',name:'The Librarian',purpose:'custody'},{id:'scheduler',name:'Scheduler',purpose:'routing'}];
  crew.seedCrew(agents,{currentNode:'CoffeeMaker3737'});
  const first=crew.snapshot();
  crew.seedCrew(agents,{currentNode:'Other Node'});
  const second=crew.snapshot();
  assert.equal(first.rollCall.total,2);
  assert.equal(first.chapterBook.chapters.length,2);
  assert.equal(second.rollCall.total,2);
  assert.equal(second.scrollBook.pledges[0].scrollNumber,first.scrollBook.pledges[0].scrollNumber);
  assert.equal(second.scrollBook.pledges[0].durableIdentityId,first.scrollBook.pledges[0].durableIdentityId);
});

test('automatic experience capture freezes decision time and stages corrections for review',t=>{
  const crew=fixture(t);
  const event={id:'exp-1',kind:'user-prompt',at:'2026-09-27T20:00:00.000Z',hash:'abc123',data:{prompt:'No, that is not what I meant. Orion should preserve the original branch.'},context:{}};
  const captured=crew.observeExperience(event,{availableTools:['tool.b','tool.a'],grants:['grant.owner'],runtimeState:{currentTaskId:'task-9'}});
  assert.equal(crew.frozenMoments().length,1);
  assert.equal(captured.moment.knowledgeCutoff,event.at);
  assert.equal(captured.moment.state.sourceActor,'OWNER');
  assert.equal(captured.yourBookCandidate.confidence,'NEEDS_OWNER_CONFIRMATION');
  assert.equal(crew.currentYourBook().length,0);
  const replay=crew.replayRoom(captured.moment.frozenMomentId);
  assert.deepEqual(replay.availableTools,['tool.a','tool.b']);
  assert.deepEqual(replay.availableGrants,['grant.owner']);
});

test('owner review confirms Your Book candidate without rewriting candidate',t=>{
  const crew=fixture(t);
  const candidate=crew.considerOwnerText({text:'Stop calling agents anonymous workers; each pledge needs a Scroll Number.',effectiveAt:'2026-09-27T20:01:00.000Z',sourceRef:'chat:1'});
  const before=JSON.stringify(candidate);
  const review=crew.reviewYourBookEntry({entryId:candidate.entryId,decision:'CONFIRM',reason:'Owner confirmed terminology'});
  assert.equal(JSON.stringify(crew.yourBook().find(e=>e.entryId===candidate.entryId)),before);
  assert.equal(review.decision,'CONFIRM');
  assert.equal(crew.currentYourBook().length,1);
  assert.equal(crew.currentYourBook()[0].sourceCandidateId,candidate.entryId);
  assert.equal(crew.currentYourBook()[0].supersedes,null);
  assert.throws(()=>crew.reviewYourBookEntry({entryId:candidate.entryId,decision:'CONFIRM'}),/ALREADY_REVIEWED/);
});

test('agent experience maps Frozen Moment to stable Scroll and Chapter',t=>{
  const crew=fixture(t);
  const mapped=crew.ensureAgentPledge({id:'librarian',name:'The Librarian',purpose:'custody'},{currentNode:'Desk'});
  const result=crew.observeExperience({id:'exp-2',kind:'agent-run',at:'2026-09-27T20:02:00.000Z',hash:'hash2',data:{agentId:'librarian',success:true},context:{}},{availableTools:['memory.read']});
  assert.equal(result.moment.scrollNumber,mapped.pledge.scrollNumber);
  assert.equal(result.moment.chapterNumber,mapped.chapter.chapterNumber);
  assert.equal(result.moment.perspective,'TKE_PLEDGE');
});

test('routine task-engine heartbeat is not frozen but task boundaries are',t=>{
  const crew=fixture(t);
  assert.equal(crew.observeExperience({id:'e1',kind:'orion-task-event',at:'2026-09-27T20:03:00.000Z',hash:'h1',data:{type:'ENGINE_STARTED'},context:{}}),null);
  assert.equal(crew.frozenMoments().length,0);
  const result=crew.observeExperience({id:'e2',kind:'orion-task-event',at:'2026-09-27T20:03:01.000Z',hash:'h2',data:{type:'TASK_STARTED',taskId:'t1'},context:{}},{availableTools:['task.run']});
  assert.ok(result.moment);
  assert.equal(crew.frozenMoments().length,1);
});

test('current Your Book keeps old confirmed history but uses later confirmed supersession',t=>{
  const crew=fixture(t);
  const old=crew.addYourBookEntry({category:'work-style',effectiveAt:'2026-05-01T00:00:00Z',learnedAt:'2026-05-01T00:00:00Z',summary:'Old understanding',confidence:'CONFIRMED'});
  const candidate=crew.considerOwnerText({text:'No, that is not how Orion should handle the main quest anymore.',effectiveAt:'2026-09-27T00:00:00Z',sourceRef:'chat:later',supersedes:old.entryId});
  crew.reviewYourBookEntry({entryId:candidate.entryId,decision:'CONFIRM'});
  const all=crew.yourBook();
  const current=crew.currentYourBook();
  assert.ok(all.some(e=>e.entryId===old.entryId));
  assert.equal(current.some(e=>e.entryId===old.entryId),false);
  assert.equal(current.length,1);
  assert.equal(current[0].supersedes,old.entryId);
});

test('owner directive wording with word boundaries becomes a review candidate',t=>{
  const crew=fixture(t);
  const candidate=crew.considerOwnerText({text:'Each pledge gets his own scroll number and each office gets its own chapter number.',sourceRef:'chat:directive'});
  assert.ok(candidate);
  assert.equal(candidate.category,'owner-directive');
  assert.equal(candidate.confidence,'NEEDS_OWNER_CONFIRMATION');
});

test('delegated task Frozen Moment resolves responsible pledge Scroll and Chapter',t=>{
  const crew=fixture(t);
  const mapped=crew.ensureAgentPledge({id:'librarian',name:'The Librarian',purpose:'custody'},{currentNode:'Desk'});
  const event={id:'task-exp',kind:'orion-task-event',at:'2026-09-27T20:04:00.000Z',hash:'taskhash',data:{type:'TASK_STARTED',taskId:'task-1',responsibleAgentId:'librarian'},context:{}};
  const result=crew.observeExperience(event,{runtimeState:{tasks:{'task-1':{responsibleAgentId:'librarian',input:{agentId:'librarian'}}}}});
  assert.equal(result.moment.scrollNumber,mapped.pledge.scrollNumber);
  assert.equal(result.moment.chapterNumber,mapped.chapter.chapterNumber);
  assert.equal(result.moment.perspective,'TKE_PLEDGE');
});
