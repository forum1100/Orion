'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {OrionStaleWorkAudit}=require('../packages/core/src/orion-stale-work-audit.cjs');
test('stale auditor distinguishes review, provider deferral, and training shelf without mutation',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'orion-stale-audit-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const engine=path.join(root,'orion-task-engine'),cycles=path.join(root,'orion-improvement','cycles'),
  adoption=path.join(root,'orion-upgrade-adoption');
 for(const p of [engine,cycles,adoption])fs.mkdirSync(p,{recursive:true});
 const state={tasks:{
  a:{id:'a',kind:'browser.history.reconcile',status:'WAITING_DEPENDENCY',attempts:2863,
     lastResult:{result:{reason:'BROWSER_HISTORY_DEFERRED_PROVIDER'}}},
  b:{id:'b',kind:'orion.improvement',status:'WAITING_DEPENDENCY',attempts:3,
     lastResult:{result:{reason:'NATIVE_CANDIDATE_AWAITING_REVIEW_OR_PROMOTION'}}},
  c:{id:'c',kind:'learning.reflect',status:'READY',attempts:0},
  d:{id:'d',kind:'research',status:'COMPLETE',attempts:1}}};
 const files=[
  [path.join(engine,'state.json'),state],
  [path.join(cycles,'2026-10-10-a.json'),{status:'QUALIFIED_COMMITTED_TRAINING',
    candidateId:'one',promotion:{deployment:'TRAINING_SHELF_ONLY_PENDING_RELEASE_GATE'}}],
  [path.join(cycles,'2026-10-09-b.json'),{status:'FAILED_PRESERVED',candidateId:'two'}],
  [path.join(adoption,'state.json'),{active:{}}]
 ];
 for(const [f,body] of files)fs.writeFileSync(f,JSON.stringify(body));
 const before=files.map(([f])=>fs.readFileSync(f,'utf8'));
 const out=new OrionStaleWorkAudit({root}).run();
 assert.equal(out.taskSummary.deferredProvider,1);
 assert.equal(out.taskSummary.reviewHeld,1);
 assert.equal(out.taskSummary.ready,1);
 assert.equal(out.deferredProvider[0].attempts,2863);
 assert.equal(out.deferredProvider[0].proposeNoRetryWithoutChangedEvidence,true);
 assert.equal(out.recentCycles[0].trainingQualified,true);
 assert.equal(out.recentCycles[0].livePromotionVerified,false);
 assert.equal(out.activeSkillsInAdoptionState,0);
 assert.equal(out.tasksModified,0);
 assert.equal(out.releasePromotions,0);
 assert.deepEqual(files.map(([f])=>fs.readFileSync(f,'utf8')),before);
});
