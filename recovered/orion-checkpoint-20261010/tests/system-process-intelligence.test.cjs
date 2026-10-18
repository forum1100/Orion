const test = require('node:test');
const assert = require('node:assert/strict');
const { classify, candidates } = require('../packages/core/src/system-process-intelligence.cjs');

test('process intelligence recognizes DT runtime dependencies', () => {
  assert.equal(classify({name:'ollama.exe',commandLine:''}).capability,'orion-chair');
  assert.equal(classify({name:'GoogleDriveFS.exe',commandLine:''}).capability,'google-drive');
  assert.equal(classify({name:'ffmpeg.exe',commandLine:'ffmpeg -i desktop C:\\TJ_Personal_Pro\\data\\self_observer\\screen_001.mp4'}).capability,'self-observer');
  assert.equal(classify({name:'svchost.exe',commandLine:''}).class,'WINDOWS_SYSTEM');
});

test('duplicate DT self observers become a high-confidence waste candidate', () => {
  const rows=[1,2,3].map(pid=>({pid,name:'ffmpeg.exe',workingSetBytes:900*1024*1024,cpuSeconds:10,
    commandLine:'ffmpeg C:\\TJ_Personal_Pro\\data\\self_observer\\screen_'+pid+'.mp4'}));
  const found=candidates(rows).find(x=>x.kind==='DUPLICATE_DT_SELF_OBSERVER');
  assert.ok(found);
  assert.equal(found.count,3);
  assert.equal(found.severity,'HIGH');
});

test('Windows service hosts are never surfaced as waste candidates by memory alone', () => {
  const rows=[1,2,3].map(pid=>({pid,name:'svchost.exe',workingSetBytes:400*1024*1024,cpuSeconds:2,commandLine:''}));
  assert.equal(candidates(rows).length,0);
});
