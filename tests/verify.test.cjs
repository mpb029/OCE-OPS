const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {options,plan,childEnv,suite,reusable,fullEvidence,sha}=require('./verify.cjs');

test('FAST workflow runs no browsers, PDFs, screenshots or recovery by default',()=>{
  assert.deepEqual(plan(options(['fast'],{})),[]);
  const navigation=plan(options(['fast','--scope','navigation'],{}));
  assert.equal(navigation.length,1);assert.equal(navigation[0].engine,'chromium');
  assert.match(navigation[0].filter,/Navigation 768/);
  const overview=plan(options(['fast','--scope','overview'],{}));
  assert.ok(overview.some(s=>s.filter==='^Overview(:| refinement:)'));
  assert.ok(overview.every(s=>s.engine==='chromium'));
  assert.ok(!overview.some(s=>/recovery|screenshots/.test(s.id)));
});
test('existing filters select FAST checks; FOCUSED cannot lose audience, persistence or print guards',()=>{
  const env={OCE_STAGE_A_FILTER:'^Opt-in,',OCE_TEST_FILTER:'^Production stat:'};
  const fast=plan(options(['fast'],env));
  assert.equal(fast[0].filter,env.OCE_TEST_FILTER);assert.equal(fast[1].filter,env.OCE_STAGE_A_FILTER);
  const focused=plan(options(['focused'],env));
  for(const engine of ['chromium','firefox']) {
    const regression=focused.find(s=>s.id===engine+'-regression');
    for(const name of ['Production stat: edit','Project selection one','Audience parity crew','Local persistence: reload','Print parity: report'])
      assert.ok(new RegExp(regression.filter).test(name));
    assert.ok(focused.some(s=>s.id===engine+'-workspaces'));
  }
  assert.ok(!focused.some(s=>/recovery|screenshots|workspace-pdf/.test(s.id)));
});
test('FULL always includes complete suites, both PDF comparisons, all captures and standalone recovery',()=>{
  const steps=plan(options(['full'],{OCE_TEST_FILTER:'nothing',OCE_STAGE_A_FILTER:'nothing',OCE_SCREENSHOT_FILTER:'nothing'}));
  assert.equal(steps.length,12);assert.ok(steps.every(s=>s.filter===''));
  for(const id of ['chromium-regression','chromium-workspaces','firefox-regression','firefox-workspaces',
    'report-comparison','workspace-pdfs','workspace-pdf-comparison','workspace-screenshots','classic-screenshots',
    'model-evidence','complete-recovery','recovery-verification']) assert.ok(steps.some(s=>s.id===id));
  assert.throws(()=>options(['full','--reuse','old'],{}));assert.throws(()=>options(['full','--shots','mobile'],{}));
  assert.throws(()=>options(['full','--scope','navigation'],{}));
});
test('children cannot inherit unrelated filters, stale output paths, main overrides or Chromium into Firefox',()=>{
  const inherited={OCE_TEST_FILTER:'x',OCE_STAGE_A_FILTER:'y',OCE_SCREENSHOT_FILTER:'z',OCE_BROWSER:'chrome.exe',OCE_MAIN_REF:'old',OCE_TEST_OUTPUT:'stale'};
  const env=childEnv({file:'tests/regression.cjs',engine:'firefox',filter:''},'fresh',inherited);
  for(const key of ['OCE_TEST_FILTER','OCE_STAGE_A_FILTER','OCE_SCREENSHOT_FILTER','OCE_MAIN_REF','OCE_BROWSER']) assert.equal(env[key],undefined);
  assert.equal(env.OCE_TEST_OUTPUT,'fresh');assert.equal(env.OCE_ENGINE,'firefox');
});
test('zero matches, failed assertions, partial suites, wrong commit and dirty FULL runs cannot pass',()=>{
  const report={commit:'head',endCommit:'head',engine:'chromium',fullRun:true,worktreeClean:true,tests:Array.from({length:59},(_,i)=>({name:i<13?'Overview: '+i:i<25?'Overview refinement: '+i:'Existing '+i,status:'PASS'}))};
  suite(report,'chromium',true,'head');
  assert.throws(()=>suite({...report,tests:report.tests.filter(t=>!t.name.startsWith('Overview refinement:'))},'chromium',true,'head'),/All B2 refinement contracts required/);
  for(const change of [{tests:[]},{tests:[{status:'FAIL'}]},{fullRun:false},{commit:'old'},{endCommit:'new'},{worktreeClean:false},{tests:[{status:'PASS'}]}])
    assert.throws(()=>suite({...report,...change},'chromium',true,'head'));
  assert.throws(()=>fullEvidence('.', {level:'focused',status:'PASS'},'head','main'));
  assert.throws(()=>fullEvidence('.', {level:'full',status:'FAIL'},'head','main'));
});
test('reuse rejects changed inputs, expired evidence, missing or corrupted artifacts, and previous failures',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'oce-evidence-test-'));
  try {
    const file=path.join(directory,'result.json');fs.writeFileSync(file,'original');
    const input={source:'same',fixture:'same',browser:'same',steps:['same']};
    const receipt={level:'focused',status:'PASS',inputs:input,completedAt:new Date().toISOString(),artifacts:[{file:'result.json',sha256:sha('original')}]};
    reusable(receipt,input,directory);
    for(const key of Object.keys(input)) assert.throws(()=>reusable(receipt,{...input,[key]:'changed'},directory));
    for(const change of [{level:'fast'},{status:'FAIL'},{completedAt:'2020-01-01'},{reusedFrom:'older'},{artifacts:[]}])
      assert.throws(()=>reusable({...receipt,...change},input,directory));
    fs.writeFileSync(file,'corrupted');assert.throws(()=>reusable(receipt,input,directory));
    fs.unlinkSync(file);assert.throws(()=>reusable(receipt,input,directory));
  } finally {fs.rmdirSync(directory);}
});
test('acceptance rejects stale commits, changed main, skipped steps and an incomplete FULL command plan',()=>{
  const steps=plan(options(['full'],{}));
  const receipt={level:'full',status:'PASS',commit:'head',endCommit:'head',clean:true,
    inputs:{main:'main',steps},steps:steps.map(s=>({id:s.id,status:'PASS'}))};
  for(const [changed,commit,main] of [
    [receipt,'new-head','main'],[receipt,'head','new-main'],
    [{...receipt,steps:receipt.steps.slice(1)},'head','main'],
    [{...receipt,inputs:{...receipt.inputs,steps:steps.slice(1)}},'head','main'],
    [{...receipt,steps:receipt.steps.map((s,i)=>i?s:{...s,status:'SKIP'})},'head','main']
  ]) assert.throws(()=>fullEvidence('.',changed,commit,main),error=>error.code==='ERR_ASSERTION');
});
