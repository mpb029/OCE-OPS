const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {options,plan,childEnv,suite,reusable,formsScreenshots,fullEvidence,sha}=require('./verify.cjs');

test('FAST workflow runs no browsers, PDFs, screenshots or recovery by default',()=>{
  assert.deepEqual(plan(options(['fast'],{})),[]);
  const navigation=plan(options(['fast','--scope','navigation'],{}));
  assert.equal(navigation.length,1);assert.equal(navigation[0].engine,'chromium');
  assert.match(navigation[0].filter,/Navigation 768/);
  const overview=plan(options(['fast','--scope','overview'],{}));
  assert.ok(overview.some(s=>s.filter==='^Overview(:| refinement:)'));
  assert.ok(overview.every(s=>s.engine==='chromium'));
  assert.ok(!overview.some(s=>/recovery|screenshots/.test(s.id)));
  const field=plan(options(['fast','--scope','field'],{}));
  assert.ok(field.some(s=>new RegExp(s.filter).test('Field usability: mobile controls')));
  assert.ok(field.some(s=>new RegExp(s.filter).test('Production stat: extra fields, target, edit, visibility and delete')));
  assert.ok(!field.some(s=>/recovery|screenshots/.test(s.id)));
  const forms=plan(options(['fast','--scope','forms'],{}));
  for(const name of ['Forms and Settings: shared form contract','Production stat: extra fields, target, edit, visibility and delete','Settings editing: clients','CRUD parity: incidents, add/edit','CRUD parity: qualityTesting, add/edit'])
    assert.ok(forms.some(s=>new RegExp(s.filter).test(name)),name);
  assert.ok(forms.every(s=>s.engine==='chromium'));
  assert.ok(!forms.some(s=>/recovery|screenshots|comparison/.test(s.id)));
  const capture=plan(options(['fast','--scope','forms','--shots','stage-d-tablet'],{})).find(s=>s.id==='forms-screenshots');
  assert.equal(capture.file,'tests/capture-forms.cjs');assert.equal(capture.filter,'stage-d-tablet');
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
test('FULL includes complete suites, both PDF comparisons, three Stage D captures, model inspection and standalone recovery',()=>{
  const steps=plan(options(['full'],{OCE_TEST_FILTER:'nothing',OCE_STAGE_A_FILTER:'nothing',OCE_SCREENSHOT_FILTER:'nothing'}));
  assert.equal(steps.length,11);assert.ok(steps.every(s=>s.filter===''));
  for(const id of ['chromium-regression','chromium-workspaces','firefox-regression','firefox-workspaces',
    'report-comparison','workspace-pdfs','workspace-pdf-comparison','forms-screenshots',
    'model-evidence','complete-recovery','recovery-verification']) assert.ok(steps.some(s=>s.id===id));
  assert.equal(steps.find(s=>s.id==='forms-screenshots').file,'tests/capture-forms.cjs');
  assert.deepEqual(steps.find(s=>s.id==='model-evidence').args,['--no-screenshots']);
  assert.ok(!steps.some(s=>['tests/capture-workspaces.cjs','tests/capture.cjs'].includes(s.file)));
  assert.throws(()=>options(['full','--reuse','old'],{}));assert.throws(()=>options(['full','--shots','mobile'],{}));
  assert.throws(()=>options(['full','--scope','navigation'],{}));
});
test('children cannot inherit unrelated filters, stale output paths, main overrides or Chromium into Firefox',()=>{
  const inherited={OCE_TEST_FILTER:'x',OCE_STAGE_A_FILTER:'y',OCE_SCREENSHOT_FILTER:'z',OCE_BROWSER:'chrome.exe',OCE_MAIN_REF:'old',OCE_TEST_OUTPUT:'stale'};
  const env=childEnv({file:'tests/regression.cjs',engine:'firefox',filter:''},'fresh',inherited);
  for(const key of ['OCE_TEST_FILTER','OCE_STAGE_A_FILTER','OCE_SCREENSHOT_FILTER','OCE_MAIN_REF','OCE_BROWSER']) assert.equal(env[key],undefined);
  assert.equal(env.OCE_TEST_OUTPUT,'fresh');assert.equal(env.OCE_ENGINE,'firefox');
  assert.equal(childEnv({file:'tests/capture-forms.cjs',engine:'chromium',filter:'stage-d-tablet'},'fresh',inherited).OCE_SCREENSHOT_FILTER,'stage-d-tablet');
});
test('zero matches, failed assertions, partial suites, wrong commit and dirty FULL runs cannot pass',()=>{
  const report={commit:'head',endCommit:'head',engine:'chromium',fullRun:true,worktreeClean:true,tests:Array.from({length:94},(_,i)=>({name:i<13?'Overview: '+i:i<25?'Overview refinement: '+i:i<37?'Spatial usability: '+i:i<49?'Field usability: '+i:i<60?'Forms and Settings: '+i:'Existing '+i,status:'PASS'}))};
  suite(report,'chromium',true,'head');
  assert.throws(()=>suite({...report,tests:report.tests.filter(t=>!t.name.startsWith('Overview refinement:'))},'chromium',true,'head'),/All B2 refinement contracts required/);
  assert.throws(()=>suite({...report,tests:report.tests.filter(t=>!t.name.startsWith('Spatial usability:'))},'chromium',true,'head'),/All C1 spatial usability contracts required/);
  assert.throws(()=>suite({...report,tests:report.tests.filter(t=>!t.name.startsWith('Field usability:'))},'chromium',true,'head'),/All C2 field usability contracts required/);
  assert.throws(()=>suite({...report,tests:report.tests.filter(t=>!t.name.startsWith('Forms and Settings:'))},'chromium',true,'head'),/All Stage D forms and Settings contracts required/);
  assert.throws(()=>suite({...report,tests:report.tests.slice(0,-1)},'chromium',true,'head'),/Incomplete acceptance suite/);
  const original={...report,environment:{engine:'chromium'},tests:Array.from({length:83},()=>({status:'PASS'}))};
  suite(original,'chromium',true,'head');
  assert.throws(()=>suite({...original,tests:original.tests.slice(1)},'chromium',true,'head'),/Incomplete acceptance suite/);
  for(const change of [{tests:[]},{tests:[{status:'FAIL'}]},{fullRun:false},{commit:'old'},{endCommit:'new'},{worktreeClean:false},{tests:[{status:'PASS'}]}])
    assert.throws(()=>suite({...report,...change},'chromium',true,'head'));
  assert.throws(()=>fullEvidence('.', {level:'focused',status:'PASS'},'head','main'));
  assert.throws(()=>fullEvidence('.', {level:'full',status:'FAIL'},'head','main'));
});
test('Stage D capture gate rejects stale, missing, duplicate, partial, invalid or wrong-size images',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'oce-stage-d-captures-'));
  const entries=[['stage-d-desktop.png',1440,900],['stage-d-tablet.png',768,1024],['stage-d-mobile.png',390,844]];
  const png=(width,height)=>{const bytes=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);bytes.writeUInt32BE(13,8);bytes.write('IHDR',12);bytes.writeUInt32BE(width,16);bytes.writeUInt32BE(height,20);return bytes;};
  const manifest={commit:'head',fullRun:true,screenshots:entries.map(([name,width,height])=>({name,width,height}))};
  try {
    for(const [name,width,height] of entries) fs.writeFileSync(path.join(directory,name),png(width,height));
    formsScreenshots(manifest,directory,'head');
    for(const change of [{commit:'old'},{fullRun:false},{screenshots:manifest.screenshots.slice(1)},{screenshots:[manifest.screenshots[0],manifest.screenshots[0],manifest.screenshots[2]]},{screenshots:manifest.screenshots.map((s,i)=>i?s:{...s,width:1200})}])
      assert.throws(()=>formsScreenshots({...manifest,...change},directory,'head'));
    const file=path.join(directory,entries[0][0]);
    fs.writeFileSync(file,png(1200,900));assert.throws(()=>formsScreenshots(manifest,directory,'head'),/Captured PNG width/);
    fs.writeFileSync(file,'not a PNG');assert.throws(()=>formsScreenshots(manifest,directory,'head'),/Invalid PNG/);
    fs.unlinkSync(file);assert.throws(()=>formsScreenshots(manifest,directory,'head'));
  } finally {for(const [name] of entries){const file=path.join(directory,name);if(fs.existsSync(file))fs.unlinkSync(file);}fs.rmdirSync(directory);}
});
test('model inspection can omit only PNG writes; all original object and interaction inspection stays intact',()=>{
  const {execFileSync}=require('node:child_process'),root=path.resolve(__dirname,'..');
  const baseline=execFileSync('git',['show','76501b5f9cd50c3103c83656a38604ca2b2c4086:tests/model-inspection.cjs'],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n');
  let source=fs.readFileSync(path.join(root,'tests/model-inspection.cjs'),'utf8').replace(/\r\n/g,'\n');
  const declaration="const noScreenshots = process.argv.includes('--no-screenshots');\n";
  assert.equal(source.split(declaration).length,2);
  assert.equal(source.split('if (!noScreenshots) await p.screenshot').length,4);
  source=source.replace(declaration,'').replaceAll('if (!noScreenshots) await p.screenshot','await p.screenshot');
  assert.equal(source,baseline);
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
