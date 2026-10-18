'use strict';
// Restart convergence is a release audit, not evidence of execution.
// A source module, a packaged copy, and a live verified capability are
// different assertions. Never infer production deployment from existence.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const P='packages/core/src/';
const C=Object.freeze([
 {id:'owner-root-prism',label:'Owner root, signed scopes, local Prism',modules:[P+'orion-root-authority.cjs',P+'orion-standing-authority.cjs',P+'orion-prism-device-agent.cjs'],host:['orionBootstrap','orion.device.prism.status'],critical:true},
 {id:'causal-provenance',label:'Causal event ledger, append-only perspective',modules:[P+'orion-event-ledger.cjs',P+'orion-causal-bridge.cjs',P+'orion-temporal-counterfactual.cjs'],host:['OrionCausalBridge'],critical:true},
 {id:'durable-self-directed-tasks',label:'Self-owned event-triggered durable TaskEngine',modules:[P+'orion-task-engine.cjs',P+'orion-task-cold-store.cjs'],host:['orionTasks.start()','orionTasks.requestEvaluation'],critical:true},
 {id:'crew-scroll-chapters',label:'Crew, numbered Scrolls, Chapters, Frozen Moments',modules:[P+'orion-crew-house.cjs',P+'orion-crew-delegation.cjs'],host:['orionCrewHouse.seedCrew'],critical:true},
 {id:'perception-memory',label:'Original Perception Points and canonical evidence',modules:[P+'perception-memory.cjs',P+'orion-canonical-perception-verifier.cjs'],host:['new PerceptionMemory'],critical:true},
 {id:'concept-bar',label:'Numerical Concept Bar, evidence states and huge-to-small context',modules:[P+'orion-concept-bar.cjs'],host:['OrionConceptBar'],critical:true},
 {id:'memory-convergence',label:'Memory Crew, bounded locators, durable chat lineage',modules:[P+'orion-memory-crew.cjs',P+'orion-chat-continuity.cjs'],host:['orionMemoryCrew = new OrionMemoryCrew','new OrionChatContinuity'],critical:true},
 {id:'dt-closeout',label:'DT_CLOSEOUT, failed branches and original event records',modules:[P+'dt-closeout-runtime.cjs',P+'orion-gap-ledger.cjs'],host:['executeResidentCloseout'],critical:true},
 {id:'office-source-custody',label:'Authorized native Office source intake and document lineage',modules:[P+'orion-office-native-host-wiring.cjs',P+'orion-office-autonomous-intake.cjs',P+'orion-office-document-tree.cjs'],host:['nativeOfficeHost('],critical:true},
 {id:'office-growth-continuity',label:'Growth reviews, evidence wake, restart reconciliation',modules:[P+'orion-office-growth-lifecycle.cjs',P+'orion-office-task-bridge.cjs'],host:['nativeOfficeHost('],critical:true},
 {id:'cloud-mirror-task',label:'Durable source and derived document cloud mirror responsibility',modules:[P+'orion-office-mirror-task-lifecycle.cjs',P+'orion-office-drive-mirror.cjs'],host:['nativeOfficeHost('],critical:true},
 {id:'gdrive-mount',label:'Verified read-only G mounted repository adapter',modules:[P+'orion-google-drive-mounted-readonly.cjs'],host:['OrionGoogleDriveMountedReadOnly'],critical:true},
 {id:'gdrive-remote',label:'Google Drive sole external repository, owner-private signed remote read/write',modules:[P+'orion-drive-remote-port.cjs',P+'orion-google-drive-private-office-provider.cjs'],host:['orionDriveRemote','OrionGoogleDrivePrivateOfficeProvider'],critical:true},
 {id:'selfgraph-brain',label:'Causal SelfGraph projector and distributed visual brain',modules:[P+'orion-selfgraph-projector.cjs',P+'orion-brain-projection.cjs','apps/desktop/src/orion-brain.js','apps/desktop/src/orion-fluid-brain-3d.js','apps/desktop/src/orion-brain.html'],host:['orion.selfgraph.current'],critical:true},
 {id:'hot-skill-learning-no-restart',label:'Validated learned skills and generated capabilities adopted in the resident process',modules:[P+'learned-skills.cjs',P+'orion-generated-capability-registry.cjs',P+'orion-upgrade-adoption.cjs'],host:['new LearnedSkillRegistry','orion.skill_builder.refresh','orionUpgradeAdoption.activateQualified'],critical:true},
 {id:'live-3d-brain-learning-no-restart',label:'Learned skills, staged training and integrity changes update live causal 3D Brain',modules:[P+'orion-learning-brain-overlay.cjs','apps/desktop/src/orion-fluid-brain-3d.js','apps/desktop/src/orion-brain.js'],host:['orion-learning-brain-overlay.cjs','workingGraph,learningBrain'],critical:true},
 {id:'self-healing',label:'Failure classification, Daze recovery, self-reorientation',modules:[P+'orion-self-health.cjs',P+'orion-runtime-failure-classifier.cjs',P+'session-recovery.cjs'],host:['orionSelfHealth.start()'],critical:true},
 {id:'recursive-improvement',label:'Learning, testing, staged self-improvement and rollback',modules:[P+'orion-improvement-loop.cjs',P+'orion-upgrade-adoption.cjs',P+'orion-generated-capability-registry.cjs'],host:['orionImprovement = new OrionImprovementLoop','new OrionUpgradeAdoption'],critical:true},
 {id:'learning-director',label:'Learning epochs, resumption and historical curriculum',modules:[P+'orion-learning-director.cjs',P+'observation-learning.cjs'],host:['new OrionLearningDirector'],critical:true},
 {id:'research-control',label:'Research queues, hypotheses, research reports and interrupted successors',modules:[P+'orion-research-loop.cjs',P+'orion-research-interruption-recovery.cjs',P+'orion-research-successor-trials.cjs'],host:['new OrionResearchLoop'],critical:true},
 {id:'simulation-safety',label:'Simulation replay, provenance, null control and preserved failures',modules:['packages/simulations/src/replay.cjs',P+'research-simulation-engine.cjs','resources/simulations/replay/registry.json'],host:['orion.research.catalog'],critical:true},
 {id:'resource-governor',label:'Thermals, workload limits, heavy-work gating',modules:[P+'adaptive-hardware-envelope.cjs',P+'orion-resource-controller.cjs',P+'orion-brain-resource-monitor.cjs'],host:['currentHardwareState()'],critical:true},
 {id:'first-party-reasoners',label:'Native thought, synthesis and proposal validation',modules:[P+'orion-native-reasoner.cjs',P+'orion-native-synthesizer.cjs',P+'orion-native-drafter.cjs'],host:[],critical:false},
 {id:'teacher-perception',label:'Consented OS observations and command learning',modules:[P+'orion-teaching-perception.cjs'],host:['OrionTeachingPerception'],critical:false},
 {id:'native-troubleshooting',label:'Native process, terminal, Wi-Fi and repair observations',modules:[P+'orion-remote-dependency-audit.cjs',P+'orion-wifi-observer.cjs',P+'system-process-intelligence.cjs',P+'headless-command.cjs'],host:['orion.native.parity.status'],critical:true},
 {id:'multi-model-consult',label:'External ChatGPT/Grok/Gemini advisory, authority outside providers',modules:[P+'provider-independence.cjs'],host:['ProviderIndependence'],critical:false},
 {id:'distributed-sibling',label:'Sibling birth, Prism, multi-device routing and dual data-path pairing',modules:[P+'orion-device-birth-orchestrator.cjs',P+'orion-dual-path-pairing.cjs',P+'orion-dad-fleet-control.cjs'],host:['orion.device.birth.status'],critical:false},
 {id:'release-and-recovery',label:'Owner-signed release staging, rollback, and native model qualification',modules:[P+'orion-release-gate.cjs',P+'orion-upgrade-adoption.cjs'],host:['new OrionReleaseGate'],critical:true}
]);
function audit({repoRoot,asarPath=null,readFile=fs.readFileSync,exists=fs.existsSync}={}){
 if(!repoRoot)throw Error('RELEASE_CONVERGENCE_REPO_ROOT_REQUIRED');
 const root=path.resolve(repoRoot),mainPath=path.join(root,'apps/desktop/src/main.cjs');
 if(!exists(mainPath))throw Error('RELEASE_CONVERGENCE_DESKTOP_HOST_MISSING');
 const main=String(readFile(mainPath,'utf8'));
 let asar=null,pkgFiles=null,pkgError=null;
 if(asarPath){
  try{asar=require('@electron/asar');pkgFiles=new Map(asar.listPackage(asarPath).map(x=>[x.replace(/\\/g,'/').replace(/^\//,''),x.replace(/^[\\/]/,'')]))}
  catch(error){pkgError=String(error.message||error);}
 }
 // The host process carries the actual handler registrations. A package
 // with old main.cjs cannot borrow source-only wiring as proof of readiness.
 const mainSourceSha256=sha(Buffer.from(main,'utf8'));
 let mainPackagedSha256=null,mainSourcePackageHashMatch=false;
 if(asar&&pkgFiles?.has('apps/desktop/src/main.cjs')){
  try{mainPackagedSha256=sha(asar.extractFile(asarPath,pkgFiles.get('apps/desktop/src/main.cjs')));
    mainSourcePackageHashMatch=mainSourceSha256===mainPackagedSha256;
  }catch(error){pkgError=String(error.message||error);}
 }
 const rows=C.map(c=>{
  const modules=c.modules.map(rel=>{
   const src=path.join(root,...rel.split('/'));
   if(!exists(src))return {path:rel,exists:false,inPackage:false,shaMatch:false};
   const data=readFile(src);let inPackage=false,shaMatch=false;
   if(asar&&pkgFiles){
    inPackage=pkgFiles.has(rel);
    if(inPackage){try{shaMatch=sha(data)===sha(asar.extractFile(asarPath,pkgFiles.get(rel)))}
      catch{shaMatch=false}}
   }
   return {path:rel,exists:true,sourceSha256:sha(data),
    inPackage:asarPath?inPackage:null,shaMatch:asarPath?shaMatch:null};
  });
  const missing=c.host.filter(marker=>!main.includes(marker));
  const sourceComplete=modules.every(x=>x.exists);
  const packaged=Boolean(asarPath&&pkgFiles&&modules.every(x=>x.inPackage&&x.shaMatch));
  let stage=!sourceComplete?'MODULE_MISSING':
    !asarPath?'SOURCE_ONLY_UNPACKAGED':
    !packaged?'PACKAGE_MISSING_OR_HASH_MISMATCH':
    missing.length?'DESKTOP_WIRING_NOT_ESTABLISHED':
    c.host.length>0&&!mainSourcePackageHashMatch?'DESKTOP_PACKAGE_MAIN_NOT_MATCHING_SOURCE':
    'PACKAGE_SOURCE_MATCHES_DESKTOP_REFERENCES_RUNTIME_UNVERIFIED';
  return {id:c.id,label:c.label,critical:c.critical,stage,
   modules,missingDesktopMarkers:missing,
   realAutonomousExecutionVerified:false,ownerAuthorityWidened:false};
 });
 const blockers=rows.filter(r=>r.critical&&r.stage!=='PACKAGE_SOURCE_MATCHES_DESKTOP_REFERENCES_RUNTIME_UNVERIFIED');
 const additional=[
  'PRODUCTION_ORION_HAS_NOT_BEEN_RESTARTED_WITH_CANDIDATE',
  'REAL_LIVE_SELFGRAPH_GPU_NOT_VISUALLY_QUALIFIED',
  'NATIVE_ORION_AUTHENTICATED_DRIVE_WRITE_PROVIDER_NOT_ACTIVE',
  'OWNER_SIGNED_EXTERNAL_DRIVE_MUTATION_GRANT_NOT_VERIFIED',
  'AUTONOMOUS_FILE_ARRIVAL_PRODUCER_NOT_QUALIFIED',
  'DIRTY_WORKTREE_AND_UNTRACKED_SOURCE_NOT_CLOUD_VERIFIED',
  'NATIVE_MODEL_FROM_SCRATCH_TRAINING_UNVERIFIED',
  'FULL_SIM_LOGGING_SAFETY_STACK_NOT_INDEPENDENTLY_QUALIFIED',
  'PRODUCTION_SELF_TROUBLESHOOTING_AND_CROSS_MODEL_ROUNDTRIP_NOT_VERIFIED'
 ];
 return {schema:'orion-autonomy-final-restart-convergence/1.0',
  at:new Date().toISOString(),repoRoot:root,asarPath:asarPath||null,
  mainSourceSha256,mainPackagedSha256,mainSourcePackageHashMatch,
  sourceOnlyWithoutProductionClaims:true,cloudBackupNotImplied:true,
  criticalBlockers:blockers.map(r=>({id:r.id,stage:r.stage,missingDesktopMarkers:r.missingDesktopMarkers})),
  additionalReleaseGates:additional,
  counts:{requirements:rows.length,sourceModulesComplete:rows.filter(r=>r.modules.every(m=>m.exists)).length,
   packageBytesMatching:rows.filter(r=>r.stage==='PACKAGE_SOURCE_MATCHES_DESKTOP_REFERENCES_RUNTIME_UNVERIFIED').length,
   criticalBlockerCount:blockers.length},
  noFinalRestartAuthorizationInferred:true,releaseEligible:false,
  asarInspectionError:pkgError,requirements:rows};
}
module.exports={audit,REQUIREMENTS:C};
