module.exports = Object.freeze({
  schemaVersion: 2,
  ownerId: 'orion-local-root-owner',
  displayName: 'DT Platform Owner',
  roles: Object.freeze(['owner','administrator']),
  authentication: Object.freeze(['local-dt-owner-session','signed-owner-root','dt-admin-key']),
  githubAuthenticationEnabled: false,
  credentialsIncluded: false
});
