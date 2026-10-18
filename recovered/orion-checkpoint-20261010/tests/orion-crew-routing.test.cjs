const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {OrionCrewHouse}=require('../packages/core/src/orion-crew-house.cjs');

function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'orion-routing-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  return new OrionCrewHouse({root});
}

test('Chapter supervision forms a hierarchy and rejects cycles',t=>{
  const crew=fixture(t);
  crew.registerChapter({chapterNumber:1,name:'Crew Operations'});
  crew.registerChapter({chapterNumber:2,name:'Perception',parentChapterNumber:1});
  crew.registerChapter({chapterNumber:3,name:'Hardware',parentChapterNumber:2});
  assert.deepEqual(crew.chapterAncestors(3),['0002','0001']);
  assert.deepEqual(crew.chapterDescendants(1),['0002','0003']);
  assert.throws(()=>crew.setChapterSupervisor(1,3),/SUPERVISION_CYCLE/);
});

test('Crew Routing weighs capability authority locality resources and load',t=>{
  const crew=fixture(t);
  crew.registerChapter({chapterNumber:1,name:'Crew Operations'});
  crew.registerChapter({chapterNumber:2,name:'Perception',parentChapterNumber:1});
  crew.registerPledge({scrollNumber:11,name:'Near Scout',status:'ACTIVE',capabilities:['vision.read'],currentNode:'Desk',canRunOn:['Desk']});
  crew.registerPledge({scrollNumber:12,name:'Busy Scout',status:'ACTIVE',capabilities:['vision.read'],currentNode:'GPU Node',canRunOn:['Desk','GPU Node']});
  crew.assignPledge({scrollNumber:11,chapterNumber:2});
  crew.updatePledgeRouting(11,{authorityScopes:['screen.read'],resourceNeeds:['camera'],currentLoad:.1});
  crew.updatePledgeRouting(12,{authorityScopes:['screen.read'],resourceNeeds:['camera'],currentLoad:.9});
  const route=crew.routeCrewWork({capabilities:['vision.read'],authorityScopes:['screen.read'],preferredNode:'Desk',availableResources:['camera'],requestingChapterNumber:2});
  assert.equal(route.candidates[0].scrollNumber,'0011');
  assert.equal(route.candidates.some(x=>x.scrollNumber==='0012'),true);
  assert.equal(crew.routeCrewWork({capabilities:['vision.read'],authorityScopes:['admin.root'],availableResources:['camera']}).candidates.length,0);
});

test('Mission Team assembles pledges across Chapters without reassigning their home offices',t=>{
  const crew=fixture(t);
  crew.registerChapter({chapterNumber:1,name:'Crew Operations'});
  crew.registerChapter({chapterNumber:2,name:'Perception',parentChapterNumber:1});
  crew.registerChapter({chapterNumber:3,name:'Recovery',parentChapterNumber:1});
  crew.registerPledge({scrollNumber:21,name:'Scout',status:'ACTIVE',capabilities:['vision.read'],currentNode:'Desk'});
  crew.registerPledge({scrollNumber:22,name:'Fixer',status:'RESTING',capabilities:['runtime.recover'],currentNode:'Desk'});
  crew.assignPledge({scrollNumber:21,chapterNumber:2});
  crew.assignPledge({scrollNumber:22,chapterNumber:3});
  const mission=crew.openMission({title:'Diagnose and recover',goal:'Restore stalled UI',requiredCapabilities:['vision.read','runtime.recover'],preferredNode:'Desk',requestingChapterNumber:1});
  assert.equal(mission.status,'READY');
  assert.deepEqual(mission.assigned.map(x=>x.scrollNumber).sort(),['0021','0022']);
  assert.equal(crew.scrollBook().pledges.find(p=>p.scrollNumber==='0021').currentChapterNumber,'0002');
  assert.equal(crew.scrollBook().pledges.find(p=>p.scrollNumber==='0022').currentChapterNumber,'0003');
  const closed=crew.closeMission(mission.missionId,{status:'COMPLETE',result:{recovered:true}});
  assert.equal(closed.status,'COMPLETE');
  assert.ok(closed.closedAt);
});

test('Mission Team preserves missing capability instead of inventing a worker',t=>{
  const crew=fixture(t);
  const mission=crew.openMission({title:'Need unavailable sense',requiredCapabilities:['sensor.unknown']});
  assert.equal(mission.status,'WAITING_FOR_CREW');
  assert.deepEqual(mission.missingCapabilities,['sensor.unknown']);
  assert.deepEqual(mission.assigned,[]);
});

test('active Mission Teams contribute to routing load',t=>{
  const crew=fixture(t);
  crew.registerPledge({scrollNumber:31,name:'A',status:'ACTIVE',capabilities:['work.x'],currentNode:'Desk'});
  crew.registerPledge({scrollNumber:32,name:'B',status:'ACTIVE',capabilities:['work.x'],currentNode:'Desk'});
  const first=crew.openMission({title:'First mission',requiredCapabilities:['work.x'],preferredNode:'Desk'});
  assert.equal(first.assigned[0].scrollNumber,'0031');
  const route=crew.routeCrewWork({capabilities:['work.x'],preferredNode:'Desk'});
  assert.equal(route.candidates[0].scrollNumber,'0032');
  assert.equal(route.candidates.find(x=>x.scrollNumber==='0031').activeMissionCount,1);
});
