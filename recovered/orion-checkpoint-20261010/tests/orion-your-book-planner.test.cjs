const test = require('node:test');
const assert = require('node:assert/strict');
const { PromptRuntime } = require('../packages/core/src/prompt-runtime.cjs');

function runtime(confirmed = []) {
  return new PromptRuntime({
    skillRegistry:{ list:()=>[], match:()=>[], load:()=>null },
    capabilityBus:{ list:()=>[], has:()=>false, call:async()=>null },
    localIntelligence:{ status:async()=>({available:false}) },
    executeSkill:async()=>null, vault:null,
    crewHouse:{ currentYourBook:()=>confirmed }
  });
}

test('planner sees confirmed Your Book knowledge with frozen-time rule', () => {
  const r=runtime([{category:'terminology',summary:'Each pledge has a permanent Scroll Number.',effectiveAt:'2026-09-27T20:00:00Z',learnedAt:'2026-09-27T21:00:00Z',confidence:'CONFIRMED'}]);
  const system=r.plannerSystem();
  assert.match(system,/Owner-confirmed Your Book context/);
  assert.match(system,/permanent Scroll Number/);
  assert.match(system,/must never be projected backward into a Frozen Moment/);
});
