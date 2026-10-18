const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {ProviderIndependence,DEFAULT_CONTRACT}=require('../packages/core/src/provider-independence.cjs');

test('DT local state remains canonical across provider observations',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dt-provider-'));
  const p=new ProviderIndependence({root});
  p.observe({provider:'grok',lane:'browser',authenticated:true,quotaState:'quota_exhausted',resetHint:'later'});
  const s=p.status();
  assert.equal(s.contract.canonicalStateOwner,'DT_LOCAL');
  assert.equal(s.contract.providerStateIsAuthoritative,false);
  assert.equal(s.providers.grok.lanes.browser.quotaState,'quota_exhausted');
});

test('routing avoids exhausted provider lanes and prefers observed capability',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dt-provider-'));
  const p=new ProviderIndependence({root});
  p.observe({provider:'grok',lane:'browser',authenticated:true,quotaState:'quota_exhausted',capabilities:{code:true}});
  p.observe({provider:'chatgpt',lane:'browser',authenticated:true,quotaState:'available',capabilities:{code:true}});
  const r=p.route({capabilities:{code:true}});
  assert.equal(r.selected.provider,'chatgpt');
  assert.equal(r.decision,'DT_LOCAL_ROUTING');
});
