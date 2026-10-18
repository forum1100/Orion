'use strict';
// Explicit owner-requested signing utility. Run outside Orion's normal runtime.
// Never prints, exports, or copies an unprotected private key. Signs only a
// versioned successor root manifest with narrowly scoped Office grants.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {OrionBootstrapSupervisor}=require('../packages/core/src/orion-bootstrap-supervisor.cjs');
const {OrionRootAuthority,canonical,manifestHash}=require('../packages/core/src/orion-root-authority.cjs');
const {OrionStandingAuthority,SCHEMA}=require('../packages/core/src/orion-standing-authority.cjs');
const {unprotectForCurrentUser}=require('./orion-owner-key-utility.cjs');
const mode=process.argv[2];
if(!['--prepare','--apply'].includes(mode))throw Error('EXPLICIT_PREPARE_OR_APPLY_REQUIRED');
const root=path.resolve(process.env.ORION_LIVE_ROOT||path.join(process.env.APPDATA||'','dt-desktop-suite','dt-vault'));
const home=path.resolve(process.env.ORION_OWNER_AUTHORITY_HOME||
 path.join(process.env.USERPROFILE||'','Documents','DT Owner Authority','Orion'));
const file=path.join(root,'orion-root','active-manifest.json');
const protectedFile=path.join(home,'orion-owner-private.dpapi');
const ownerPublic=fs.readFileSync(path.join(home,'orion-owner-public.pem'),'utf8');
const livePublic=fs.readFileSync(path.join(root,'authority','orion-owner-public.pem'),'utf8');
if(ownerPublic!==livePublic)throw Error('OWNER_ROOT_PUBLIC_KEY_NOT_MATCHING_LIVE');
const old=JSON.parse(fs.readFileSync(file,'utf8'));
const prior=new OrionStandingAuthority({root,ownerPublicKey:livePublic});
const existing=prior.signedManifest();
if(!existing.ok||existing.rootHash!==old.manifestHash||
 !Number.isSafeInteger(old.manifest?.version))throw Error('OWNER_ROOT_PREDECESSOR_INVALID');
if(old.manifest.standingAuthority?.grants?.length)
 throw Error('EXISTING_STANDING_GRANTS_REQUIRE_OWNER_RECONCILIATION');
const deviceManifest=JSON.parse(fs.readFileSync(path.join(root,'bootstrap','device.json'),'utf8'));
const deviceId=deviceManifest.deviceId;
if(!/^[0-9a-f-]{36}$/i.test(deviceId||''))throw Error('OWNER_DEVICE_ID_NOT_VERIFIED');
const registry=JSON.parse(fs.readFileSync(path.join(root,'orion-crew-house','scroll-book.json'),'utf8'));
const agents=[...new Set((registry.pledges||[]).map(p=>p.metadata?.agentId).filter(x=>typeof x==='string'&&x.length))].sort();
if(!agents.includes('librarian')||!agents.length)
 throw Error('LIBRARIAN_AND_CURRENT_REGISTERED_PLEDGES_NOT_PRESENT');
const now=new Date(),begin=now.toISOString(),end=new Date(now.getTime()+30*86400000).toISOString();
const grants=[
 {id:'owner-office-arrival-'+crypto.randomUUID(),enabled:true,unattended:true,
  capabilities:['orion.office.document.arrived'],agents:['librarian'],
  risks:['LOCAL_MUTATION'],deviceIds:[deviceId],validFrom:begin,expiresAt:end,
  purpose:'OWNER_APPROVED_KNOWN_OFFICE_SOURCE_ARRIVAL_ONLY'},
 {id:'owner-office-pledge-read-'+crypto.randomUUID(),enabled:true,unattended:true,
  capabilities:['ORION_OFFICE_DOCUMENT_REVIEW'],agents,
  risks:['READ_ONLY'],deviceIds:[deviceId],validFrom:begin,expiresAt:end,
  purpose:'OWNER_APPROVED_DOCUMENT_READ_AND_DERIVED_REPORT_ONLY'}
];
const manifest={...existing.manifest,
 version:existing.manifest.version+1,previousManifestHash:existing.rootHash,
 createdAt:now.toISOString(),
 standingAuthority:{schema:SCHEMA,grants,revokedGrantIds:[]}};
const proposal={
 schema:'orion-owner-standing-grant-proposal/1.0',
 mode:mode==='--prepare'?'PREPARED_NOT_APPLIED':'OWNER_AUTHORIZATION_APPLY',
 previousManifestHash:existing.rootHash,previousVersion:old.manifest.version,
 proposedVersion:manifest.version,proposedManifestHash:manifestHash(manifest),
 deviceId,grantCount:grants.length,agentsInReviewGrant:agents.length,
 grantScopes:grants.map(g=>({id:g.id,capabilities:g.capabilities,agentCount:g.agents.length,
   agents:g.agents.length<=3?g.agents:undefined,risks:g.risks,expiresAt:g.expiresAt})),
 effectiveScope:'SINGLE_APPROVED_DEVICE_EXACT_CAPABILITIES_EXACT_AGENT_IDS',
 durationDays:30,wildcardPrivileges:false,codeExecutionPermitted:false,
 autonomousAgentBirthPermitted:false,existingOrionProcessRestarted:false
};
if(mode==='--prepare'){console.log(JSON.stringify(proposal,null,2));process.exit(0);}
if(!fs.existsSync(protectedFile))throw Error('OWNER_PROTECTED_PRIVATE_KEY_NOT_FOUND');
const readFresh=JSON.parse(fs.readFileSync(file,'utf8'));
if(readFresh.manifestHash!==old.manifestHash||
 readFresh.manifest.version!==old.manifest.version)
 throw Error('OWNER_ROOT_CHANGED_SINCE_PREPARE');
let pem;
try{pem=unprotectForCurrentUser(fs.readFileSync(protectedFile));}
catch(e){throw Error('OWNER_LOCAL_DPAPI_AUTHENTICATION_UNAVAILABLE');}
let secret;
try{secret=crypto.createPrivateKey(pem);}finally{pem=null;}
const publicFromSecret=crypto.createPublicKey(secret).export({type:'spki',format:'pem'}).toString();
if(publicFromSecret!==livePublic)throw Error('UNSEALED_PRIVATE_KEY_DOES_NOT_MATCH_OWNER_ROOT');
const signature=crypto.sign(null,Buffer.from(canonical(manifest)),secret).toString('base64');
secret=null;
const verifier=new OrionRootAuthority({root,ownerPublicKey:livePublic});
const check=verifier.verify({manifest,signature});
if(!check.ok)throw Error('OWNER_SIGNATURE_PREFLIGHT_FAILED:'+check.reason);
const stamped=String(manifest.version).padStart(8,'0');
const preserved=path.join(home,'preserved-root-record-'+
 String(old.manifest.version).padStart(8,'0')+'-'+existing.rootHash+'.json');
fs.writeFileSync(preserved,JSON.stringify(old,null,2)+'\n',{flag:'wx'});
const signedFile=path.join(home,'root-manifest-v'+stamped+'.signed.json');
fs.writeFileSync(signedFile,JSON.stringify({manifest,signature},null,2)+'\n',{flag:'wx'});
const supervisor=new OrionBootstrapSupervisor({root,ownerPublicKey:livePublic});
const result=supervisor.applyRootManifest({manifest,signature});
if(!result.ok)throw Error('SIGNED_ROOT_APPLY_FAILED:'+result.reason);
const status=supervisor.standingAuthority.status();
if(!status.ready||status.activeGrants!==2||result.manifestHash!==manifestHash(manifest))
 throw Error('OWNER_GRANT_POST_APPLY_READBACK_FAILED');
const checks=[
 supervisor.standingAuthority.evaluate({capabilityId:'orion.office.document.arrived',
  agentId:'librarian',taskId:'owner-issue-verify-arrival',risk:'LOCAL_MUTATION',
  deviceId,unattended:true}),
 supervisor.standingAuthority.evaluate({capabilityId:'ORION_OFFICE_DOCUMENT_REVIEW',
  agentId:agents[0],taskId:'owner-issue-verify-review',risk:'READ_ONLY',
  deviceId,unattended:true}),
 supervisor.standingAuthority.evaluate({capabilityId:'desktop.execute',
  agentId:'librarian',taskId:'owner-issue-denied-test',risk:'EXECUTION',
  deviceId,unattended:true})
];
if(checks[0].ok!==true||checks[1].ok!==true||checks[2].ok!==false)
 throw Error('OWNER_GRANT_ALLOW_DENY_SMOKE_FAILED');
console.log(JSON.stringify({...proposal,applied:true,activeRootHash:result.manifestHash,
 activeRootVersion:result.version,activeGrantCount:status.activeGrants,
 grantScopeSmokesPassed:true,unlistedExecutionDenied:true,
 originalRootRecordPreserved:true,signedOwnerRecordPreserved:true,
 installedOrionUpdated:false},null,2));
