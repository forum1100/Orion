'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('Orion active desktop code has no Github API or auth path and defaults to independent SSD source',()=>{
 const src=fs.readFileSync(path.join(root,'apps/desktop/src/main.cjs'),'utf8');
 assert.equal(/githubCliExecutable|authenticatedGithubLogin|DT_ENABLE_GITHUB_TRANSPORT|ghApi\(|github\.com|ownerProfile\.githubLogin/i.test(src),false);
 assert.equal(/transport:\s*'github'/i.test(src),false);
 assert.ok(src.includes("const orionDriveRemote=new OrionDriveRemotePort()"));
 assert.ok(src.includes("ORION_GOOGLE_DRIVE_NATIVE_PROVIDER_NOT_CONNECTED"));
 assert.ok(src.includes("localRootOwnerVerified()"));
 assert.ok(src.includes("E:/Orion/Source/DT-Desktop-Suite"));
});
test('owner account/escrow is local signed-root identity; no GitHub authorization',()=>{
 const owner=require('../packages/auth/src/owner.cjs');
 const auth=require('../packages/auth/src/policy.cjs');
 assert.equal(owner.ownerId,'orion-local-root-owner');
 assert.equal(owner.githubLogin,undefined);
 assert.equal(owner.githubAuthenticationEnabled,false);
 assert.equal(auth.isOwner(owner,{ownerId:owner.ownerId,
  localAuthenticated:true,signedRootVerified:false}),false);
 assert.equal(auth.isOwner(owner,{ownerId:owner.ownerId,
  localAuthenticated:true,signedRootVerified:true}),true);
 const cfg=JSON.parse(fs.readFileSync(path.join(root,'config/owner.json'),'utf8'));
 assert.equal(cfg.ownerId,owner.ownerId);
 assert.equal('githubLogin' in cfg,false);
});
test('peer mailboxes are Drive-only; former GitHub carrier is never accepted',()=>{
 const {classifyTransport,createGrokProposal}=require('../packages/core/src/peer-mailbox.cjs');
 assert.equal(classifyTransport('github'),'LEGACY_ARCHIVAL_ONLY_DISABLED');
 const req=createGrokProposal({executiveId:'grok-ceo',provider:'xai',
  sessionId:'grok-ceo',capability:'mailbox.ping'});
 assert.equal(req.transport,'drive');
 const {manifest,activationState}=require('../packages/plugins/grok-remote-cli/index.cjs');
 assert.equal(manifest.transport,'google-drive-authenticated-mailbox');
 assert.equal(activationState({peerConnected:true,ownerVerified:true,
  activeCapture:true,bridgeAvailable:true}).active,false);
});
