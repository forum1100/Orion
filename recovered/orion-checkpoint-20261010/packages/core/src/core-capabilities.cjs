const fs = require('node:fs');
const path = require('node:path');
const { buildSetupGuide } = require('./ai-setup-guide.cjs');
const { findMatches } = require('./orion-capability.cjs');
const { evaluateInteraction } = require('./accessibility-lab.cjs');

function underRoots(target, roots) {
  const resolved = path.resolve(String(target || ''));
  return roots.some(root => {
    const base = path.resolve(root);
    return resolved === base || resolved.startsWith(base + path.sep);
  });
}

function registerCoreCapabilities(bus, context = {}) {
  const environment = context.environment || {};
  const roots = [environment.home,
    ...(environment.googleDrive || []).map(item => item.root),
    ...(context.extraRoots || [])].filter(Boolean);

  bus.register({
    id: 'system.environment', description: 'Read DT bootstrap and machine discovery state.',
    risk: 'READ_ONLY'
  }, async () => environment);

  bus.register({
    id: 'google_drive.roots', description: 'List Google Drive roots detected on this installation.',
    risk: 'READ_ONLY', hardwareClass: 'storage'
  }, async () => environment.googleDrive || []);
  bus.register({
    id: 'filesystem.list', description: 'List a local directory under DT-authorized roots.',
    risk: 'READ_ONLY', hardwareClass: 'storage'
  }, async input => {
    const target = path.resolve(String(input.path || environment.home || '.'));
    if (!underRoots(target, roots)) throw new Error('Path outside DT-authorized roots');
    return fs.readdirSync(target, { withFileTypes: true }).map(item => ({
      name: item.name, type: item.isDirectory() ? 'directory' : item.isFile() ? 'file' : 'other'
    }));
  });

  bus.register({
    id: 'filesystem.read', description: 'Read a bounded UTF-8 text file under DT-authorized roots.',
    risk: 'READ_ONLY', hardwareClass: 'storage'
  }, async input => {
    const target = path.resolve(String(input.path || ''));
    if (!underRoots(target, roots)) throw new Error('Path outside DT-authorized roots');
    const stat = fs.statSync(target);
    if (!stat.isFile()) throw new Error('Target is not a file');
    const maxBytes = Math.max(1, Math.min(4 * 1024 * 1024, Number(input.maxBytes) || 1024 * 1024));
    const fd = fs.openSync(target, 'r');
    try {
      const buffer = Buffer.alloc(Math.min(stat.size, maxBytes));
      const bytes = fs.readSync(fd, buffer, 0, buffer.length, 0);
      return { path: target, bytes, truncated: stat.size > bytes, text: buffer.subarray(0, bytes).toString('utf8') };
    } finally { fs.closeSync(fd); }
  });

  bus.register({
    id: 'powershell.run', description: 'Run a bounded DT-governed PowerShell command headlessly.',
    risk: 'DYNAMIC', hardwareClass: 'computer'
  }, async (input, callContext) => {
    const result = context.runHeadlessCommand({
      command: String(input.command || ''),
      cwd: String(input.cwd || environment.home || ''),
      timeoutSeconds: Number(input.timeoutSeconds) || 120
    }, input.variables || {}, {
      ownerApproved: callContext.ownerApproved === true,
      defaultCwd: environment.home,
      allowedRoots: roots
    });
    context.experience?.append('headless-command', {
      command: result.command, cwd: result.cwd, exitCode: result.exitCode,
      stdout: result.stdout, stderr: result.stderr, success: result.exitCode === 0
    }, { capability: 'powershell.run' });
    if (result.exitCode !== 0 || result.error) {
      context.residentRuntime?.submitIncident({
        source: 'powershell.run', command: result.command, cwd: result.cwd,
        exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr, error: result.error
      });
    }
    return result;
  });

  bus.register({
    id: 'ai.setup_guide',
    description: 'Generate provider-neutral setup instructions and a copy/paste bootstrap prompt for connecting an AI assistant to DT.',
    risk: 'READ_ONLY',
    hardwareClass: 'computer'
  }, async input => buildSetupGuide({
    provider: input?.provider || 'other',
    deviceId: input?.deviceId || context.deviceId || null,
    cliPath: input?.cliPath || context.cliPath || 'DT Command Center / DT governed CLI',
    capabilities: bus.list().map(item => item.id)
  }));

  bus.register({
    id: 'orion.capability.audit',
    description: 'Ask Orion whether DT already possesses a requested capability; explain how to use it or consult AI peers when absent.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async input => {
    const question = String(input?.capability || input?.question || input?.task || '').trim();
    if (!question) throw new Error('Capability question required');
    const skills = typeof context.getSkills === 'function' ? context.getSkills() : [];
    const matches = findMatches(question, bus.list(), skills);
    const best = matches[0] || null;
    const possessed = Boolean(best && best.score >= 0.34);
    if (possessed) return { identity:'Orion', possessed:true, match:best, howToUse:best.kind==='tool' ? '/tool '+best.id+' { ... }' : 'Ask Orion naturally; route to promoted skill '+best.id, matches };
    const council = typeof context.runAICouncil === 'function' ? await context.runAICouncil({ advisoryOnly:true, task:'Orion capability gap: '+question+'. Design and implement this from scratch for DT Desktop. Return architecture, implementation path, tests, risks, and integration points.' }, {}) : null;
    return { identity:'Orion', possessed:false, matches, consultedPeers:Boolean(council), council };
  });

  bus.register({
    id: 'accessibility.evaluate_interaction',
    description: 'Generate synthetic accessibility scenarios and measurable success criteria for interacting with Orion without prompt-engineering knowledge.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async input => evaluateInteraction(input || {}));
  bus.register({
    id: 'ai.council.decide_and_act',
    description: 'Consult available configured AI peers, have the resident DT model synthesize their recommendations, and enact the selected bounded DT tool or promoted skill.',
    risk: 'DYNAMIC', hardwareClass: 'computer'
  }, async (input, callContext) => {
    if (typeof context.runAICouncil !== 'function') throw new Error('DT AI Council runtime is unavailable');
    return context.runAICouncil(input || {}, callContext || {});
  });

  bus.register({
    id: 'ai.council.status',
    description: 'Read currently eligible council advisors and recent council decision state.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async () => typeof context.councilStatus === 'function' ? context.councilStatus() : { available:false });

  bus.register({
    id: 'browser.closeout.run_all',
    description: 'Open ChatGPT, Grok, and Gemini sequentially and run one DT_CLOSEOUT task in each through the DT Browser Perception Bridge.',
    risk: 'LOCAL_MUTATION', hardwareClass: 'computer'
  }, async input => {
    const response = await fetch('http://127.0.0.1:43120/v1/browser/closeout/run-all', {
      method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify({task: String(input?.task || '')})
    });
    if (!response.ok) throw new Error('TJ Personal Pro browser closeout request failed: ' + response.status);
    return response.json();
  });

  bus.register({
    id: 'browser.closeout.run_history', description: 'Discover authenticated provider conversation histories and run DT_CLOSEOUT once per conversation with durable resume state.',
    risk: 'EXTERNAL_MUTATION', hardwareClass: 'computer'
  }, async input => {
    const response = await fetch('http://127.0.0.1:43120/v1/browser/closeout/run-history', {
      method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(input || {})
    });
    if (!response.ok) throw new Error('TJ Personal Pro history closeout request failed: ' + response.status);
    return response.json();
  });

  bus.register({
    id: 'browser.bros.ask', description: 'Ask ChatGPT, Grok, and Gemini free/logged-out browser surfaces in parallel using the dedicated Browser Bros profile.',
    risk: 'EXTERNAL_MUTATION', hardwareClass: 'computer'
  }, async input => {
    const response = await fetch('http://127.0.0.1:43120/v1/browser-bros/ask', {
      method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({question:String(input?.question || input?.task || '')})
    });
    if (!response.ok) throw new Error('Browser Bros request failed: ' + response.status);
    return response.json();
  });

  bus.register({
    id: 'browser.bros.status', description: 'Read the current Browser Bros free/logged-out peer consultation state.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async () => {
    const response = await fetch('http://127.0.0.1:43120/v1/browser-bros/state');
    if (!response.ok) throw new Error('Browser Bros status failed: ' + response.status);
    return response.json();
  });

  bus.register({
    id: 'browser.closeout.status', description: 'Read the current sequential browser DT_CLOSEOUT queue and provider job.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async () => {
    const response = await fetch('http://127.0.0.1:43120/v1/browser/closeout/state');
    if (!response.ok) throw new Error('TJ Personal Pro browser closeout status failed: ' + response.status);
    return response.json();
  });

  bus.register({
    id: 'social.status',
    description: 'Read Orion social publishing state, learned owner voice, account observations, publishing queue, and source-signal watchlist.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async () => context.socialPublishing?.status() || { available:false });

  bus.register({
    id: 'social.voice.learn',
    description: 'Learn owner writing-style features from owner-authored text while preserving source provenance.',
    risk: 'LOCAL_MUTATION', hardwareClass: 'storage'
  }, async input => context.socialPublishing?.learnVoice(input || {}) || { available:false });

  bus.register({
    id: 'social.content.generate',
    description: 'Generate an original DT-themed cross-platform social content package in the owner voice with an image brief.',
    risk: 'LOCAL_MUTATION', hardwareClass: 'computer'
  }, async input => context.socialPublishing?.generateConcept(input || {}) || { available:false });

  bus.register({
    id: 'social.content.enqueue',
    description: 'Queue a generated social package for X-first publishing and adapted cross-posting through TJ Personal Pro.',
    risk: 'EXTERNAL_MUTATION', hardwareClass: 'computer'
  }, async input => {
    const queued=context.socialPublishing?.enqueuePackage(input || {}); if(!queued) return {available:false};
    const response=await fetch('http://127.0.0.1:43120/v1/social/enqueue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobs:queued.jobs})});
    if(!response.ok) throw new Error('TJ Personal Pro social enqueue failed: '+response.status);
    return {local:queued,remote:await response.json()};
  });

  bus.register({
    id: 'social.source.observe',
    description: 'Record evidence about a social account as a signal/noise research source.',
    risk: 'LOCAL_MUTATION', hardwareClass: 'storage'
  }, async input => context.socialPublishing?.observeSource(input || {}) || { available:false });

  bus.register({
    id: 'social.source.recommend_follows',
    description: 'Rank social accounts whose observed signal value exceeds noise for potential follow/watch actions.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async input => context.socialPublishing?.recommendFollows(input || {}) || []);

  bus.register({
    id:'social.source.follow', description:'Queue a verified social source/profile for a visible follow action through the authenticated social browser lane.',
    risk:'EXTERNAL_MUTATION', hardwareClass:'computer'
  }, async input => {
    const job=context.socialPublishing?.queueFollow(input || {}); if(!job)return {available:false};
    const response=await fetch('http://127.0.0.1:43120/v1/social/enqueue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobs:[job]})});
    if(!response.ok)throw new Error('TJ Personal Pro social follow enqueue failed: '+response.status);
    return {local:job,remote:await response.json()};
  });
  bus.register({
    id: 'enterprise.family_capital.status',
    description: 'Read Orion enterprise/family-capital training state for trusts, LLCs, holding companies, regulated financial institutions, and revenue execution.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async () => context.enterpriseFamilyCapital?.status() || { available:false });

  bus.register({
    id: 'enterprise.family_capital.training_plan',
    description: 'Read the Orion training plan for family trusts, LLC/holding-company architecture, credit-union/bank feasibility, and lawful revenue execution.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async () => context.enterpriseFamilyCapital?.trainingPlan() || { available:false });

  bus.register({
    id: 'enterprise.family_capital.training_cycle',
    description: 'Run one advisory enterprise/family-capital training cycle through the AI council.',
    risk: 'LOCAL_MUTATION', hardwareClass: 'computer'
  }, async input => context.enterpriseFamilyCapital?.trainingCycle(input || {}) || { available:false });

  bus.register({
    id: 'enterprise.revenue.blueprint',
    description: 'Generate the executable ordinary-business-revenue launch blueprint, excluding regulated deposits, securities, lending, and custody until verified.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async input => context.enterpriseFamilyCapital?.revenueBlueprint(input || {}) || { available:false });

  bus.register({
    id: 'enterprise.money_flow.classify',
    description: 'Classify a proposed money flow as ordinary business revenue or a regulated deposit, securities, or lending activity before execution.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async input => context.enterpriseFamilyCapital?.classifyMoneyFlow(input || {}) || { available:false });

  bus.register({
    id: 'parent.child_device.status',
    description: 'Read the DT parent/child-device sprint, Ariel reference-device state, adapters, and training progress.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async () => context.parentChildDevice?.status() || { available:false });

  bus.register({
    id: 'parent.child_device.interface',
    description: 'Read the prompt-free parent dashboard/interface specification nested inside Orion.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async () => context.parentChildDevice?.interfaceSpec() || { available:false });

  bus.register({
    id: 'parent.child_device.discover',
    description: 'Perform read-only child-device discovery through available ADB tooling without modifying the live child profile.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async () => context.parentChildDevice?.discoverDevices() || { available:false });

  bus.register({
    id: 'parent.child_device.training_plan',
    description: 'Read the two-day Orion parent/tablet implementation and training plan.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async () => context.parentChildDevice?.trainingPlan() || { available:false });

  bus.register({
    id: 'parent.child_device.training_cycle',
    description: 'Run one parent/tablet implementation-training cycle using current device observations and advisory AI peers.',
    risk: 'LOCAL_MUTATION', hardwareClass: 'computer'
  }, async input => context.parentChildDevice?.trainingCycle(input || {}) || { available:false });

  bus.register({
    id: 'legal.pro_se.status',
    description: 'Read Orion pro se legal-copilot sprint state, jurisdiction profile, source registry, and training progress.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async () => context.proSeLegal?.status() || { available:false });

  bus.register({
    id: 'legal.pro_se.training_plan',
    description: 'Generate Orion legal training plan for a jurisdiction, emphasizing current primary authority, local procedure, citations, evidence, and pro se workflow.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async input => context.proSeLegal?.trainingPlan(input?.profile) || { available:false });

  bus.register({
    id: 'legal.pro_se.training_cycle',
    description: 'Run one advisory legal-training cycle for Orion using the AI council and jurisdiction-specific verification requirements.',
    risk: 'LOCAL_MUTATION', hardwareClass: 'computer'
  }, async input => context.proSeLegal?.trainingCycle(input || {}) || { available:false });

  bus.register({
    id: 'legal.pro_se.register_source',
    description: 'Register a legal authority, local procedure, docket record, or evidence item with jurisdiction, freshness, authority class, and provenance.',
    risk: 'LOCAL_MUTATION', hardwareClass: 'storage'
  }, async input => context.proSeLegal?.registerSource(input || {}) || { available:false });

  bus.register({
    id: 'legal.pro_se.validate_source',
    description: 'Validate legal source metadata for authority class, jurisdiction, freshness, and citation traceability.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async input => context.proSeLegal?.validateSource(input || {}) || { available:false });

  bus.register({
    id: 'provider.independence.status',
    description: 'Read DT provider-independence contract and learned provider/browser/API capability matrix.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async () => context.providerIndependence?.status() || { available:false });

  bus.register({
    id: 'provider.independence.observe',
    description: 'Record a provider/session observation so Orion can learn context, authentication, quota, export/import, and automation behavior.',
    risk: 'LOCAL_MUTATION', hardwareClass: 'computer'
  }, async input => context.providerIndependence?.observe(input || {}) || { available:false });

  bus.register({
    id: 'provider.independence.route',
    description: 'Select the best currently learned provider/lane while keeping DT local state canonical.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async input => context.providerIndependence?.route(input || {}) || { available:false });

  bus.register({
    id:'hardware.envelope.status', description:'Read Orion learned per-device hardware operating envelope and workload recommendation.',
    risk:'READ_ONLY', hardwareClass:'computer'
  }, async () => context.adaptiveHardwareEnvelope?.status() || {available:false});

  bus.register({
    id:'hardware.envelope.observe', description:'Take a fresh hardware observation and update the learned safe workload envelope for this device.',
    risk:'READ_ONLY', hardwareClass:'computer'
  }, async () => context.adaptiveHardwareEnvelope?.observe() || {available:false});

  bus.register({
    id:'tiered.storage.status', description:'Read Orion storage roots, artifact locations, hashes, and rehydration catalog.',
    risk:'READ_ONLY', hardwareClass:'storage'
  }, async () => context.tieredStorage?.status() || {available:false});

  bus.register({
    id:'tiered.storage.register_root', description:'Register an authorized local, Drive, network, or external storage root for tiered DT storage.',
    risk:'LOCAL_MUTATION', hardwareClass:'storage'
  }, async input => context.tieredStorage?.registerRoot(input || {}) || {available:false});

  bus.register({
    id:'tiered.storage.offload', description:'Copy and hash-verify an artifact into a registered storage tier while preserving its DT identity and provenance.',
    risk:'LOCAL_MUTATION', hardwareClass:'storage'
  }, async input => context.tieredStorage?.offload(input || {}) || {available:false});

  bus.register({
    id:'tiered.storage.evict_local', description:'Replace local bytes with a DT reference only after two independently verified durable copies exist.',
    risk:'DESTRUCTIVE_LOCAL', hardwareClass:'storage'
  }, async input => context.tieredStorage?.evictLocal(input || {}) || {available:false});

  bus.register({
    id:'tiered.storage.rehydrate', description:'Restore a logically present offloaded artifact from a verified storage location.',
    risk:'LOCAL_MUTATION', hardwareClass:'storage'
  }, async input => context.tieredStorage?.rehydrate(input || {}) || {available:false});

  bus.register({
    id: 'system.process_intelligence.status',
    description: 'Read Orion system-process intelligence: current processes, aggregates, DT dependency roles, and resource-waste candidates.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async () => context.systemProcessIntelligence?.status() || { available:false });

  bus.register({
    id: 'system.process_intelligence.sample',
    description: 'Take a fresh system-process and resource-usage observation for Orion process learning.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async () => context.systemProcessIntelligence?.sample() || { available:false });

  bus.register({
    id: 'runtime.status', description: 'Read resident DT worker/runtime status.',
    risk: 'READ_ONLY'
  }, async () => context.residentRuntime?.status() || { running: false });

  bus.register({
    id: 'runtime.submit_incident', description: 'Submit a DT incident for background diagnosis.',
    risk: 'LOCAL_MUTATION'
  }, async input => context.residentRuntime?.submitIncident(input || {}) || null);

  return { roots, capabilities: bus.list() };
}

module.exports = { registerCoreCapabilities, underRoots };
