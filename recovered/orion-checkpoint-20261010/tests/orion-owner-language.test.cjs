'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const language=JSON.parse(fs.readFileSync(path.join(root,'resources','governance','orion-owner-language.json'),'utf8'));

test('owner-facing Orion vocabulary is canonical and connected',()=>{
  assert.equal(language.ownerFacingTerms.agentsCollective,'Crew');
  assert.equal(language.ownerFacingTerms.agent,'TKE Pledge');
  assert.equal(language.ownerFacingTerms.agentIdentity,'Scroll Number');
  assert.equal(language.ownerFacingTerms.officeIdentity,'Chapter Number');
  assert.equal(language.ownerFacingTerms.historicalPerspective,'Frozen Moment');
  assert.equal(language.ownerFacingTerms.ownerModel,'Your Book');
  assert.equal(language.ownerFacingTerms.counterfactualTesting,'Replay Room');
});

test('temporal accountability forbids hindsight rewriting',()=>{
  assert.equal(language.temporalRule.laterKnowledgeMayAttach,true);
  assert.equal(language.temporalRule.laterKnowledgeMayRewritePastPerspective,false);
  assert.equal(language.temporalRule.replayMustEnforceHistoricalKnowledgeCutoff,true);
});

test('Orion identity and DAD MODE authority stay distinct',()=>{
  assert.equal(language.authorityRule.orionUsesOwnActorIdentity,true);
  assert.equal(language.authorityRule.ownerRootControlsDadMode,true);
  assert.equal(language.authorityRule.knowledgeDoesNotEqualAuthority,true);
});
