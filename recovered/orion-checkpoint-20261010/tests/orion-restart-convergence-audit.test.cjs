'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {audit,REQUIREMENTS}=require('../packages/core/src/orion-restart-convergence-audit.cjs');
const project=path.resolve(__dirname,'..');
test('restart audit preserves named autonomous workstreams and never self-certifies runtime deployment',()=>{
 const ids=REQUIREMENTS.map(x=>x.id);
 assert.equal(new Set(ids).size,ids.length);
 for(const must of ['durable-self-directed-tasks','crew-scroll-chapters',
  'concept-bar','memory-convergence','office-growth-continuity','cloud-mirror-task',
  'selfgraph-brain','simulation-safety','recursive-improvement','self-healing',
  'hot-skill-learning-no-restart','live-3d-brain-learning-no-restart',
  'learning-director','native-troubleshooting','gdrive-mount','gdrive-remote',
  'perception-memory','release-and-recovery'])assert.ok(ids.includes(must),must);
 const s=audit({repoRoot:project});
 assert.equal(s.requirements.length,REQUIREMENTS.length);
 assert.equal(s.sourceOnlyWithoutProductionClaims,true);
 assert.equal(s.releaseEligible,false);
 assert.equal(s.noFinalRestartAuthorizationInferred,true);
 assert.ok(s.additionalReleaseGates.includes('DIRTY_WORKTREE_AND_UNTRACKED_SOURCE_NOT_CLOUD_VERIFIED'));
 assert.ok(s.requirements.every(x=>x.realAutonomousExecutionVerified===false));
 assert.ok(s.requirements.every(x=>x.ownerAuthorityWidened===false));
 assert.ok(s.criticalBlockers.length>0);
});
test('missing and fake ASAR cannot produce green package/restart readiness',()=>{
 const x=audit({repoRoot:project,asarPath:'E:/wrong/orion-genuinely-missing.asar'});
 assert.ok(x.criticalBlockers.length>0);
 assert.equal(x.releaseEligible,false);
 assert.equal(x.requirements.filter(y=>y.stage==='PACKAGE_SOURCE_MATCHES_DESKTOP_REFERENCES_RUNTIME_UNVERIFIED').length,0);
 assert.ok(x.asarInspectionError);
});
test('a source module may exist without being wired or deployed',()=>{
 const x=audit({repoRoot:project});
 assert.equal(x.requirements.find(y=>y.id==='concept-bar').stage,'SOURCE_ONLY_UNPACKAGED');
 assert.equal(x.requirements.find(y=>y.id==='gdrive-mount').stage,'SOURCE_ONLY_UNPACKAGED');
 assert.deepEqual(x.requirements.find(y=>y.id==='concept-bar').missingDesktopMarkers,[]);
 assert.deepEqual(x.requirements.find(y=>y.id==='gdrive-mount').missingDesktopMarkers,[]);
 assert.deepEqual(x.requirements.find(y=>y.id==='teacher-perception').missingDesktopMarkers,['OrionTeachingPerception']);
});
test('current package comparison reports source/packaging separation without false live claims',()=>{
 const p='E:/Orion/Orion_GoogleDrivePrimary_Candidate_20261010/win-unpacked/resources/app.asar';
 if(!fs.existsSync(p))return;
 const x=audit({repoRoot:project,asarPath:p});
 assert.equal(x.requirements.find(y=>y.id==='gdrive-mount').stage,
  'PACKAGE_MISSING_OR_HASH_MISMATCH');
 assert.equal(x.requirements.find(y=>y.id==='concept-bar').stage,
  'DESKTOP_PACKAGE_MAIN_NOT_MATCHING_SOURCE');
 assert.equal(x.mainSourcePackageHashMatch,false);
 assert.equal(x.releaseEligible,false);
});
