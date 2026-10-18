const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {OrionTaskEngine}=require('../packages/core/src/orion-task-engine.cjs');
const {OrionCrewHouse}=require('../packages/core/src/orion-crew-house.cjs');

test('delegated task keeps responsible pledge through task events',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'orion-task-responsibility-'));
  try{
    const engine=new OrionTaskEngine({root});
    engine.register('agent.execute',async()=>({status:'COMPLETE'}));
    const task=engine.upsert({id:'delegated',kind:'agent.execute',responsibleAgentId:'librarian',input:{agentId:'librarian'}});
    await engine.execute(task);
    const rows=fs.readFileSync(engine.events,'utf8').trim().split(/\r?\n/).map(JSON.parse);
    for(const type of ['TASK_CREATED','TASK_STARTED','TASK_FINISHED']) assert.equal(rows.find(x=>x.type===type).responsibleAgentId,'librarian');
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
