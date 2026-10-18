const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {ProSeLegalCopilot}=require('../packages/core/src/pro-se-legal-copilot.cjs');

test('pro se legal copilot keeps Florida Volusia as primary profile and does not claim attorney role',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dt-legal-'));
  const x=new ProSeLegalCopilot({root}); const s=x.status();
  assert.equal(s.profiles.primary.state,'FL');
  assert.equal(s.profiles.primary.county,'Volusia');
  assert.match(s.role,/NOT_ATTORNEY_OF_RECORD/);
});

test('legal source validation distinguishes primary authority from evidence',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dt-legal-'));const x=new ProSeLegalCopilot({root});
  const statute=x.validateSource({type:'STATUTE',citation:'test',checkedAt:new Date().toISOString(),jurisdiction:{state:'FL'}});
  const evidence=x.validateSource({type:'USER_EVIDENCE',citation:'exhibit',checkedAt:new Date().toISOString(),jurisdiction:{state:'FL'}});
  assert.ok(statute.authorityRank>evidence.authorityRank);
  assert.equal(statute.valid,true);
});
