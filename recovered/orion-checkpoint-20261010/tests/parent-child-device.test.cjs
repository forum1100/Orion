const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {ParentChildDevice,ARIEL_REFERENCE}=require('../packages/core/src/parent-child-device.cjs');

test('parent child-device tool preserves Ariel reference identity and sandbox-first rule',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dt-parent-'));
  const x=new ParentChildDevice({root});const s=x.status();
  assert.equal(s.referenceDevice.model,'KFTUWI');
  assert.equal(s.referenceDevice.product,'tungsten');
  assert.equal(s.referenceDevice.androidUser,11);
  assert.equal(s.referenceDevice.sandboxFirst,true);
});

test('parent interface includes learning evidence, standards alignment, archive, and permissions',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dt-parent-'));const x=new ParentChildDevice({root});
  const ids=x.interfaceSpec().sections.map(x=>x.id);
  for(const id of ['learning-evidence','alignment','archive','permissions'])assert.ok(ids.includes(id));
});
