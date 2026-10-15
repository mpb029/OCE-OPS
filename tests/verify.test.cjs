const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {options,plan,childEnv,suite,overviewNavigation,overviewQuickAdd,releaseDefault,reportRefinement,reportComparisons,punchClient,punchClientComparisons,historicalPrintComparisons,reusable,formsScreenshots,projectSpatialScreenshots,fullEvidence,sha}=require('./verify.cjs');

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
test('existing general scopes retain FAST filters and FOCUSED audience, persistence and print guards',()=>{
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
test('Overview navigation runs a bounded interaction contract in both engines without report or broad suites',()=>{
  const inherited={OCE_TEST_FILTER:'^Production stat:',OCE_STAGE_A_FILTER:'^Deep links'};
  const fast=plan(options(['fast','--scope','overview-navigation'],inherited));
  assert.deepEqual(fast,[{id:'chromium-overview-navigation',engine:'chromium',file:'tests/overview-navigation.cjs',args:[],filter:''}]);
  const focused=plan(options(['focused','--scope','overview-navigation'],inherited));
  assert.deepEqual(focused.map(s=>s.id),['chromium-overview-navigation','firefox-overview-navigation']);
  assert.ok(focused.every(s=>s.file==='tests/overview-navigation.cjs' && s.args.length===0 && s.filter===''));
  assert.throws(()=>options(['focused','--scope','overview-navigation','--shots','anything'],{}));
  assert.throws(()=>options(['full','--scope','overview-navigation'],{}));
});
test('Overview navigation receipts reject stale, incomplete, duplicate and failed contracts',()=>{
  const result={commit:'head',endCommit:'head',engine:'chromium',fullRun:true,worktreeClean:true,tests:Array.from({length:10},(_,i)=>({name:'Overview record '+i,status:'PASS'}))};
  overviewNavigation(result,'chromium','head',true);
  for(const change of [{commit:'old'},{endCommit:'new'},{engine:'firefox'},{fullRun:false},{worktreeClean:false},{tests:[]},{tests:result.tests.slice(1)},{tests:result.tests.map((t,i)=>i?t:{...t,status:'FAIL'})},{tests:result.tests.map(()=>result.tests[0])}])
    assert.throws(()=>overviewNavigation({...result,...change},'chromium','head',true));
});
test('report refinement runs only affected report checks and two representative comparisons',()=>{
  const inherited={OCE_TEST_FILTER:'^Production stat:',OCE_STAGE_A_FILTER:'^Deep links'};
  const fast=plan(options(['fast','--scope','report-refinement'],inherited));
  assert.deepEqual(fast,[{id:'chromium-report-refinement',engine:'chromium',file:'tests/report-refinement.cjs',args:[],filter:''}]);
  const focused=plan(options(['focused','--scope','report-refinement'],inherited));
  assert.deepEqual(focused.map(s=>s.id),['chromium-report-refinement','report-refinement-comparison','firefox-report-refinement']);
  assert.deepEqual(focused[0].args,['--pdf']);assert.deepEqual(focused[2].args,[]);
  assert.ok(!focused.some(s=>/regression|workspaces|recovery|screenshots/.test(s.id)));
  assert.throws(()=>options(['focused','--scope','report-refinement','--shots','anything'],{}));
});
test('Punch List and Client scope runs only two affected reports, with four PDFs at FOCUSED',()=>{
  const inherited={OCE_TEST_FILTER:'^Production stat:',OCE_STAGE_A_FILTER:'^Deep links'};
  const fast=plan(options(['fast','--scope','punch-client'],inherited));
  assert.deepEqual(fast,[{id:'chromium-punch-client',engine:'chromium',file:'tests/punch-client-reports.cjs',args:[],filter:''}]);
  const focused=plan(options(['focused','--scope','punch-client'],inherited));
  assert.deepEqual(focused.map(s=>s.id),['chromium-punch-client','punch-client-comparison','firefox-punch-client']);
  assert.deepEqual(focused[0].args,['--pdf']);assert.deepEqual(focused[2].args,[]);
  assert.ok(!focused.some(s=>/report-refinement|regression|workspaces|recovery|screenshots/.test(s.id)));
  assert.throws(()=>options(['focused','--scope','punch-client','--shots','anything'],{}));
  assert.throws(()=>options(['full','--scope','punch-client'],{}));
});
test('Punch List and Client evidence rejects stale, partial or failed checks and missing content/images',()=>{
  const result={commit:'head',endCommit:'head',engine:'chromium',pdfs:true,tests:Array.from({length:25},(_,i)=>({name:'report '+i,status:'PASS'}))};
  punchClient(result,'chromium','head',true);
  for(const change of [{commit:'old'},{endCommit:'new'},{engine:'firefox'},{pdfs:false},{tests:[]},{tests:result.tests.slice(1)},{tests:result.tests.map((t,i)=>i?t:{...t,status:'FAIL'})}])
    assert.throws(()=>punchClient({...result,...change},'chromium','head',true));
  const comparisons=['punchlist','client'].map(mode=>({mode,sameContent:true,photosPreserved:true}));
  punchClientComparisons(comparisons);
  assert.throws(()=>punchClientComparisons(comparisons.slice(1)));
  assert.throws(()=>punchClientComparisons([comparisons[0],comparisons[0]]));
  for(const change of [{sameContent:false},{photosPreserved:false}])
    assert.throws(()=>punchClientComparisons([comparisons[0],{...comparisons[1],...change}]));
});
test('report evidence rejects failed/stale checks, missing photos/content and unrelated pagination changes',()=>{
  const result={commit:'head',endCommit:'head',engine:'chromium',pdfs:true,tests:Array.from({length:25},(_,i)=>({name:'report '+i,status:'PASS'}))};
  reportRefinement(result,'chromium','head',true);
  for(const change of [{commit:'old'},{endCommit:'new'},{engine:'firefox'},{pdfs:false},{tests:[]},{tests:[{status:'FAIL'}]}])
    assert.throws(()=>reportRefinement({...result,...change},'chromium','head',true));
  const comparisons=['report','photos'].map(mode=>({mode,sameContent:true,photosPreserved:true,firstPhotoPage:1}));
  reportComparisons(comparisons);
  assert.throws(()=>reportComparisons(comparisons.slice(1)));
  for(const change of [{sameContent:false},{photosPreserved:false},{firstPhotoPage:2}])
    assert.throws(()=>reportComparisons([comparisons[0],{...comparisons[1],...change}]));
  historicalPrintComparisons([{report:'report',sameContent:true,photosPreserved:true,sameTextOnEveryPage:false},{report:'dailyWorks',sameTextOnEveryPage:true}],2);
  historicalPrintComparisons([{report:'client',sameContent:true,photosPreserved:true,sameTextOnEveryPage:false}],1);
  historicalPrintComparisons([{report:'punchlist',sameContent:true,photosPreserved:true,sameTextOnEveryPage:false}],1);
  assert.throws(()=>historicalPrintComparisons([{report:'punchlist',sameContent:true,photosPreserved:false,sameTextOnEveryPage:true}],1));
  assert.throws(()=>historicalPrintComparisons([{report:'client',sameContent:false,photosPreserved:true,sameTextOnEveryPage:true}],1));
  assert.throws(()=>historicalPrintComparisons([{report:'dailyWorks',sameContent:true,sameTextOnEveryPage:false}],1));
  assert.throws(()=>historicalPrintComparisons([{report:'photos',sameContent:false,sameTextOnEveryPage:true}],1));
});
test('project spatial scope selects map, models, backup, audience, STAT-001 and all new contracts without bulk evidence',()=>{
  const selected=plan(options(['fast','--scope','project-spatial'],{}));
  for(const name of ['Map: imported layers','Map repair: Fit','3D: actual geometry','Backup repair: full state','Readiness: failed import','Production stat: edit','Project spatial: assignments','Spatial usability: state','Spatial instances preserve state','Audience compatibility client'])
    assert.ok(selected.some(s=>new RegExp(s.filter).test(name)),name);
  assert.ok(selected.every(s=>s.engine==='chromium'));
  assert.ok(!selected.some(s=>/recovery|screenshots|comparison/.test(s.id)));
  const focused=plan(options(['focused','--scope','project-spatial'],{}));
  for(const engine of ['chromium','firefox'])for(const name of ['Project selection one','Audience parity client','Local persistence: reload','Print parity: report'])
    assert.ok(focused.some(s=>s.engine===engine&&new RegExp(s.filter).test(name)),engine+' '+name);
  const capture=plan(options(['fast','--scope','project-spatial','--shots','stage-e-tablet'],{})).find(s=>s.id==='project-spatial-screenshots');
  assert.equal(capture.file,'tests/capture-project-spatial.cjs');assert.equal(capture.filter,'stage-e-tablet');
  assert.equal(childEnv(capture,'fresh',{}).OCE_SCREENSHOT_FILTER,'stage-e-tablet');
});
test('Stage E source allowance reverses only exact integration edits and preserves all prior runtime/assertion bodies',()=>{
  const {execFileSync}=require('node:child_process'),root=path.resolve(__dirname,'..');
  const {normalise,sourcePatches,start,end,link,printLink}=require('./stage-e-source.cjs');
  const baseline='aeac20f872c092337849f7360cd1746da1940ee1';
  for(const file of ['index.html',...Object.keys(sourcePatches)]) {
    const before=execFileSync('git',['show',baseline+':'+file],{cwd:root,encoding:'utf8',maxBuffer:2e6}).replace(/\r\n/g,'\n');
    const current=fs.readFileSync(path.join(root,file),'utf8');
    assert.equal(normalise(file,current),before,file+' previous functions and assertion bodies unchanged');
    assert.notEqual(normalise(file,current+'\n// unexpected edit'),before,file+' cannot conceal an unrelated edit');
  }
  const sample='prefix\n'+link+start+'  extension();\n'+end+'suffix\n';
  assert.equal(normalise('index.html',sample),'prefix\nsuffix\n');
  assert.equal(normalise('index.html',sample+printLink),'prefix\nsuffix\n');
  assert.throws(()=>normalise('index.html',sample+printLink+printLink));
  assert.notEqual(normalise('index.html',sample+printLink.replace('media="print"','media="screen"')),'prefix\nsuffix\n');
  for(const changed of [sample.replace(start,''),sample.replace(end,''),sample.replace(link,''),sample+start,sample+end,sample+link,end+start+link])
    assert.throws(()=>normalise('index.html',changed),'Missing, repeated or out-of-order allowances must fail');
  for(const [file,patches] of Object.entries(sourcePatches)) {
    const current=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
    for(const [,after] of patches) {
      assert.throws(()=>normalise(file,current.replace(after,'')),file+' deleted source allowance');
      assert.throws(()=>normalise(file,current+after),file+' repeated source allowance');
    }
  }
});
test('G1 source allowance preserves historical source and rejects duplicate or altered navigation extensions',()=>{
  const {execFileSync}=require('node:child_process'),root=path.resolve(__dirname,'..');
  const {normalise,resolver,newRecord,highlight,newLink}=require('./overview-record-source.cjs');
  for(const [file,addition] of [['index.html',resolver],['ui-workspaces.css',highlight],['ui-overview.js',newLink]]) {
    const baseline=execFileSync('git',['show','6920ece:'+file],{cwd:root,encoding:'utf8',maxBuffer:2e6}).replace(/\r\n/g,'\n');
    const current=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
    assert.equal(normalise(file,current),baseline,file+' original source preserved');
    assert.throws(()=>normalise(file,current+addition),file+' duplicate allowance');
    assert.throws(()=>normalise(file,current.replace(addition,addition.replace(/.$/m,' '))),file+' altered allowance');
    assert.notEqual(normalise(file,current+'\n// unrelated change'),baseline,file+' unrelated change remains visible');
  }
  const current=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/\r\n/g,'\n');
  assert.throws(()=>normalise('index.html',current.replace(resolver,'')));
  assert.throws(()=>normalise('index.html',current.replace(newRecord,'')));
});
test('Quick Add acceptance rejects stale, dirty, partial, failed or source-mismatched evidence',()=>{
  const files=['index.html','ui-overview.js','ui-overview.css','ui-workspaces.js','ui-workspaces.css','ui-forms.js','ui-forms.css','tests/harness.cjs','tests/workspace-fixture.cjs','tests/overview-record-source.cjs','tests/overview-quick-add-source.cjs','tests/overview-quick-add.cjs'];
  const sourceHashes=Object.fromEntries(files.map(file=>[file,sha(fs.readFileSync(path.join(__dirname,'..',file)))]));
  const report={commit:'head',endCommit:'head',engine:'chromium',inputsUnchanged:true,worktreeClean:true,sourceHashes,passed:8,failed:0,tests:Array.from({length:8},(_,i)=>({name:'G2 contract '+i,status:'PASS'}))};
  overviewQuickAdd(report,'chromium','head',true);
  for(const change of [{commit:'old'},{endCommit:'new'},{engine:'firefox'},{inputsUnchanged:false},{worktreeClean:false},{passed:7},{failed:1},{tests:report.tests.slice(1)},{tests:report.tests.map(()=>report.tests[0])},{tests:report.tests.map((t,i)=>i?t:{...t,status:'FAIL'})},{sourceHashes:{}},{sourceHashes:{...sourceHashes,'index.html':'changed'}},{sourceHashes:{...sourceHashes,'extra.js':'unexpected'}}])
    assert.throws(()=>overviewQuickAdd({...report,...change},'chromium','head',true));
});
test('FULL includes complete suites, both PDF comparisons, three Stage E captures, model inspection and standalone recovery',()=>{
  const steps=plan(options(['full'],{OCE_TEST_FILTER:'nothing',OCE_STAGE_A_FILTER:'nothing',OCE_SCREENSHOT_FILTER:'nothing'}));
  assert.equal(steps.length,23);assert.ok(steps.every(s=>s.filter===''));
  for(const id of ['chromium-regression','chromium-workspaces','firefox-regression','firefox-workspaces',
    'report-comparison','workspace-pdfs','workspace-pdf-comparison','project-spatial-screenshots',
    'model-evidence','complete-recovery','recovery-verification','chromium-overview-navigation','firefox-overview-navigation','chromium-overview-quick-add','firefox-overview-quick-add','chromium-release-default','firefox-release-default','chromium-report-refinement','firefox-report-refinement','report-refinement-comparison','chromium-punch-client','firefox-punch-client','punch-client-comparison']) assert.ok(steps.some(s=>s.id===id));
  assert.equal(steps.find(s=>s.id==='project-spatial-screenshots').file,'tests/capture-project-spatial.cjs');
  assert.deepEqual(steps.find(s=>s.id==='model-evidence').args,['--no-screenshots']);
  assert.ok(!steps.some(s=>['tests/capture-workspaces.cjs','tests/capture.cjs'].includes(s.file)));
  assert.throws(()=>options(['full','--reuse','old'],{}));assert.throws(()=>options(['full','--shots','mobile'],{}));
  assert.throws(()=>options(['full','--scope','navigation'],{}));
  assert.throws(()=>options(['full','--scope','report-refinement'],{}));
});
test('Release default acceptance requires complete, clean, exact-source evidence in the requested engine',()=>{
  const files=['index.html','ui-workspaces.js','ui-workspaces.css','ui-overview.js','ui-overview.css','tests/harness.cjs','tests/workspace-fixture.cjs','tests/release-default.cjs','tests/release-default-source.cjs'];
  const sourceHashes=Object.fromEntries(files.map(file=>[file,sha(fs.readFileSync(path.join(__dirname,'..',file)))]));
  const report={commit:'head',endCommit:'head',engine:'firefox',inputsUnchanged:true,worktreeClean:true,sourceHashes,passed:6,failed:0,tests:Array.from({length:6},(_,i)=>({name:'Release default: contract '+i,status:'PASS'}))};
  releaseDefault(report,'firefox','head',true);
  for(const change of [{commit:'old'},{endCommit:'new'},{engine:'chromium'},{inputsUnchanged:false},{worktreeClean:false},{passed:5},{failed:1},{tests:report.tests.slice(1)},{tests:report.tests.map(()=>report.tests[0])},{tests:report.tests.map((t,i)=>i?t:{...t,status:'FAIL'})},{sourceHashes:{}},{sourceHashes:{...sourceHashes,'index.html':'changed'}},{sourceHashes:{...sourceHashes,'extra.js':'unexpected'}}])
    assert.throws(()=>releaseDefault({...report,...change},'firefox','head',true));
});
test('children cannot inherit unrelated filters, stale output paths, main overrides or Chromium into Firefox',()=>{
  const inherited={OCE_TEST_FILTER:'x',OCE_STAGE_A_FILTER:'y',OCE_SCREENSHOT_FILTER:'z',OCE_BROWSER:'chrome.exe',OCE_MAIN_REF:'old',OCE_TEST_OUTPUT:'stale'};
  const env=childEnv({file:'tests/regression.cjs',engine:'firefox',filter:''},'fresh',inherited);
  for(const key of ['OCE_TEST_FILTER','OCE_STAGE_A_FILTER','OCE_SCREENSHOT_FILTER','OCE_MAIN_REF','OCE_BROWSER']) assert.equal(env[key],undefined);
  assert.equal(env.OCE_TEST_OUTPUT,'fresh');assert.equal(env.OCE_ENGINE,'firefox');
  assert.equal(childEnv({file:'tests/capture-forms.cjs',engine:'chromium',filter:'stage-d-tablet'},'fresh',inherited).OCE_SCREENSHOT_FILTER,'stage-d-tablet');
});
test('zero matches, failed assertions, partial suites, wrong commit and dirty FULL runs cannot pass',()=>{
  const report={commit:'head',endCommit:'head',engine:'chromium',fullRun:true,worktreeClean:true,tests:Array.from({length:104},(_,i)=>({name:i<13?'Overview: '+i:i<25?'Overview refinement: '+i:i<37?'Spatial usability: '+i:i<49?'Field usability: '+i:i<60?'Forms and Settings: '+i:i<70?'Project spatial: '+i:'Existing '+i,status:'PASS'}))};
  suite(report,'chromium',true,'head');
  assert.throws(()=>suite({...report,tests:report.tests.filter(t=>!t.name.startsWith('Overview refinement:'))},'chromium',true,'head'),/All B2 refinement contracts required/);
  assert.throws(()=>suite({...report,tests:report.tests.filter(t=>!t.name.startsWith('Spatial usability:'))},'chromium',true,'head'),/All C1 spatial usability contracts required/);
  assert.throws(()=>suite({...report,tests:report.tests.filter(t=>!t.name.startsWith('Field usability:'))},'chromium',true,'head'),/All C2 field usability contracts required/);
  assert.throws(()=>suite({...report,tests:report.tests.filter(t=>!t.name.startsWith('Forms and Settings:'))},'chromium',true,'head'),/All Stage D forms and Settings contracts required/);
  assert.throws(()=>suite({...report,tests:report.tests.filter(t=>!t.name.startsWith('Project spatial:'))},'chromium',true,'head'),/All Stage E project spatial contracts required/);
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
test('Stage E capture gate rejects stale, missing, duplicate, partial, invalid or wrong-size images',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'oce-stage-e-captures-'));
  const entries=[['stage-e-desktop.png',1440,900],['stage-e-tablet.png',768,1024],['stage-e-mobile.png',390,844]];
  const png=(width,height)=>{const bytes=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);bytes.writeUInt32BE(13,8);bytes.write('IHDR',12);bytes.writeUInt32BE(width,16);bytes.writeUInt32BE(height,20);return bytes;};
  const manifest={commit:'head',fullRun:true,screenshots:entries.map(([name,width,height])=>({name,width,height}))};
  try {
    for(const [name,width,height] of entries)fs.writeFileSync(path.join(directory,name),png(width,height));
    projectSpatialScreenshots(manifest,directory,'head');
    for(const change of [{commit:'old'},{fullRun:false},{screenshots:manifest.screenshots.slice(1)},{screenshots:[manifest.screenshots[0],manifest.screenshots[0],manifest.screenshots[2]]},{screenshots:manifest.screenshots.map((s,i)=>i?s:{...s,width:1200})}])
      assert.throws(()=>projectSpatialScreenshots({...manifest,...change},directory,'head'));
    const file=path.join(directory,entries[0][0]);
    fs.writeFileSync(file,png(1200,900));assert.throws(()=>projectSpatialScreenshots(manifest,directory,'head'),/Captured PNG width/);
    fs.writeFileSync(file,'not a PNG');assert.throws(()=>projectSpatialScreenshots(manifest,directory,'head'),/Invalid PNG/);
    fs.unlinkSync(file);assert.throws(()=>projectSpatialScreenshots(manifest,directory,'head'));
  }finally{for(const [name] of entries){const file=path.join(directory,name);if(fs.existsSync(file))fs.unlinkSync(file);}fs.rmdirSync(directory);}
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
