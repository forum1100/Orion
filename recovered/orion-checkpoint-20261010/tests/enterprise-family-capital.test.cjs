const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {EnterpriseFamilyCapital}=require('../packages/core/src/enterprise-family-capital.cjs');

test('ordinary revenue is separated from regulated money flows',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dt-enterprise-')); const x=new EnterpriseFamilyCapital({root});
  assert.equal(x.classifyMoneyFlow({kind:'software subscription revenue'}).class,'ORDINARY_BUSINESS_REVENUE');
  assert.equal(x.classifyMoneyFlow({kind:'customer savings deposit'}).class,'REGULATED_DEPOSIT');
  assert.equal(x.classifyMoneyFlow({kind:'equity investment offering'}).class,'SECURITIES_OR_CAPITAL_RAISE');
  assert.equal(x.classifyMoneyFlow({kind:'consumer loan'}).class,'LENDING');
});

test('revenue blueprint excludes unlicensed regulated activity',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dt-enterprise-')); const x=new EnterpriseFamilyCapital({root});
  const b=x.revenueBlueprint({});
  assert.ok(b.steps.some(s=>s.id==='payments'));
  assert.ok(b.steps.some(s=>s.id==='launch'));
  assert.ok(b.regulatedExclusions.includes('bank deposits'));
});
