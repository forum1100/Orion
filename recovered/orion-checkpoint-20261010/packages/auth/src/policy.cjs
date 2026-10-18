const ADMIN_SCOPES = Object.freeze([
  'agent:list', 'agent:invoke', 'agent:message',
  'automation:create', 'automation:run', 'automation:revoke',
  'key:issue', 'key:rotate', 'key:revoke',
  'provider:configure', 'provider:request',
  'vault:read', 'vault:append', 'vault:export',
  'release:review'
]);
function isOwner(profile, localProof) {
  return Boolean(profile?.ownerId==='orion-local-root-owner' &&
   localProof?.localAuthenticated===true &&
   localProof?.signedRootVerified===true &&
   localProof?.ownerId===profile.ownerId);
}
function ownerBootstrap(keys,profile){
  if(profile?.ownerId!=='orion-local-root-owner')
    throw Error('OWNER_SIGNED_LOCAL_ROOT_PROFILE_REQUIRED');
  return keys.issue({label:'owner:'+profile.ownerId,scopes:[...ADMIN_SCOPES]});
}
module.exports={ADMIN_SCOPES,isOwner,ownerBootstrap};
