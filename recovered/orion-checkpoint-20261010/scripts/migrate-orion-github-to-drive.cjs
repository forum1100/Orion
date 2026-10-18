'use strict';
// One-time, scoped source-only replacement of prior remote GitHub mailbox.
// Maintains a byte-identical pre-migration copy. Does not touch live Orion.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=path.resolve(__dirname,'..');
const source=path.join(base,'apps','desktop','src','main.cjs');
const archive='E:\\Orion\\GoogleDriveMigration\\SourcePreMigration';
const original=fs.readFileSync(source,'utf8');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function replaceSpan(s,start,end,replacement){
 const a=s.indexOf(start),b=s.indexOf(end,a+start.length);
 if(a<0||b<0||s.indexOf(start,a+start.length)!==-1||s.indexOf(end,b+end.length)!==-1)
  throw Error('GITHUB_SOURCE_BOUNDARIES_NOT_UNIQUE_OR_MISSING');
 return s.slice(0,a)+replacement+s.slice(b);
}
const remoteBlock=`
const {OrionDriveRemotePort}=require('../../../packages/core/src/orion-drive-remote-port.cjs');
const orionDriveRemote=new OrionDriveRemotePort();
const GROK_INBOUND_PATH='peer-mailbox/inbound/grok-ceo';
const GROK_OUTBOUND_PATH='peer-mailbox/outbound/grok-ceo';
const PEER_CHAT_INBOUND_PATH='peer-chat/inbound';
const PEER_CHAT_OUTBOUND_PATH='peer-chat/outbound';
// Orion's signed local root + authenticated local user replace the old
// GitHub CLI identity check. Failure denies access; no provider fallback.
function localRootOwnerVerified(){
 try{
  const local=localUserStatus();
  const signature=orionBootstrap?.standingAuthority?.signedManifest?.();
  return local?.authenticated===true&&signature?.ok===true;
 }catch{return false;}
}
function unavailableGoogleDriveTransport(){
 throw Error('ORION_GOOGLE_DRIVE_NATIVE_PROVIDER_NOT_CONNECTED');
}
function findGrokProposalsForCapture(){return unavailableGoogleDriveTransport();}
function findGrokProposalForCapture(){return unavailableGoogleDriveTransport();}
function publishGrokReceipt(){return unavailableGoogleDriveTransport();}

`;
const peerBlock=`
function publishPeerChatMessage(){
 return unavailableGoogleDriveTransport();
}
function pollPeerChatInbound(){
 return unavailableGoogleDriveTransport();
}

`;
let output=replaceSpan(original,'function githubCliExecutable() {',
 'function runGrokHandshakeCommand(command) {',remoteBlock);
output=replaceSpan(output,'function publishPeerChatMessage(message) {',
 'function registerIPC(registry) {',peerBlock);
output=output.replaceAll('isOwner(ownerProfile, authenticatedGithubLogin())',
 'localRootOwnerVerified()');
output=output.replaceAll('const login = authenticatedGithubLogin();',
 'const verifiedLocalOwner = localRootOwnerVerified();');
output=output.replaceAll('ownerVerified: isOwner(ownerProfile, login)',
 'ownerVerified: verifiedLocalOwner');
output=output.replaceAll('if (!isOwner(ownerProfile, login)) throw new Error(\'Verified owner GitHub identity is required\');',
 'if (!verifiedLocalOwner) throw new Error(\'SIGNED_LOCAL_ROOT_OWNER_REQUIRED\');');
output=output.replace('githubTransportEnabled: GITHUB_TRANSPORT_ENABLED',
 'googleDriveRemote: orionDriveRemote.status()');
if(output===original||output.includes('authenticatedGithubLogin(')||
 output.includes('GITHUB_TRANSPORT_ENABLED')||output.includes('githubCliExecutable(')||
 output.includes('DT_ENABLE_GITHUB_TRANSPORT'))
 throw Error('GITHUB_RUNTIME_REFERENCES_REMAIN_AFTER_REPLACEMENT');
const report={schema:'orion-drive-replacement-source-transition/1.0',
 at:new Date().toISOString(),beforeSha256:hash(original),afterSha256:hash(output),
 githubCliAvailable:false,githubTransportEnvSwitchRemoved:true,
 activeRemote:'GOOGLE_DRIVE_ONLY',cloudProviderConnected:false,
 remoteRepoFolderId:'1UY4yG6Q8b2wv1yo1vEt2X9rp62LVT4ul',
 originalInstalledExeUntouched:true,
 migrationDoesNotProveCloudBytesUploaded:true};
if(process.argv[2]!=='--apply'){console.log(JSON.stringify(report,null,2));process.exit(0);}
fs.mkdirSync(archive,{recursive:true});
const preserve=path.join(archive,'main-before-drive-remote-'+report.beforeSha256.slice(0,16)+'.cjs');
fs.writeFileSync(preserve,original,{flag:'wx'});
fs.writeFileSync(source,output,'utf8');
if(hash(fs.readFileSync(source,'utf8'))!==report.afterSha256)
 throw Error('GITHUB_MIGRATION_WRITE_READBACK_MISMATCH');
fs.writeFileSync(path.join(archive,'migration-receipt-'+report.afterSha256.slice(0,16)+'.json'),
 JSON.stringify({...report,backupPath:preserve},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({...report,backupPath:preserve,applied:true},null,2));
