// Development orchestration only. Original browser assertions and runtime stay authoritative.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const os = require('node:os'), vm = require('node:vm'), assert = require('node:assert/strict');
const {execFileSync, spawn} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const git = args => execFileSync('git', args, {cwd:root, encoding:'utf8', maxBuffer:20e6}).trim();
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2));
const scopes = {
  workflow: ['', ''],
  overview: ['^Source contract:', '^Overview(:| refinement:)'],
  'overview-navigation': ['', ''],
  navigation: ['', '^Opt-in,|^Navigation 768×1024|^Keyboard and discoverable drawer 768×1024'],
  audience: ['^Audience parity', '^Audience compatibility|^Absent whole workspace|^Empty permitted'],
  editing: ['^CRUD parity: (dailyWorks|rfis),|^Production stat:', '^Workspace CRUD'],
  backup: ['^Backup repair:|^Readiness: (import|malformed|failed import)', '^Opt-in (Backup repair|Readiness):'],
  spatial: ['^Map:|^Map repair:|^3D', '^Spatial instances|^Spatial usability:|^Navigation 768|^Audience compatibility'],
  'project-spatial': ['^Map:|^Map repair:|^3D|^Backup repair:|^Readiness: (import|malformed|failed import)|^Production stat:', '^Project spatial:|^Spatial instances|^Spatial usability:|^Navigation 768|^Audience compatibility|^Opt-in (Backup repair|Readiness):'],
  field: ['^CRUD parity: (dailyWorks|upcoming|deliveries|punchlist|rfis),|^Production stat:', '^Field usability:|^Workspace CRUD'],
  forms: ['^CRUD parity: (dailyWorks|rfis|variations|incidents|deliveries|qualityTesting|punchlist),|^Production stat:|^Settings editing:', '^Forms and Settings:'],
  'report-refinement': ['', ''],
  'punch-client': ['', ''],
  print: ['^Print parity:|^Client report parity:|^Punch print:', '^Full-board and single-panel print']
};
const common = [
  '^Source contract:|^Loaded state,|^Project selection |^Audience parity |^Local persistence:|^Print parity:|^Client report parity:',
  '^Exact accepted|^Opt-in,|^Deep links|^Audience compatibility|^Absent whole workspace|^Empty permitted|^Full-board'
];

function options(argv, env = process.env) {
  const [level, ...args] = argv;
  assert.ok(['fast','focused','full','gate'].includes(level), 'Use fast, focused, full or gate');
  const opts = {level, scope:'workflow', plan:false};
  for (let i=0; i<args.length; i++) {
    const key = args[i];
    if (key === '--plan') opts.plan = true;
    else {
      assert.ok(['--scope','--shots','--reuse','--evidence'].includes(key), 'Unknown option: '+key);
      assert.ok(args[i+1] && !args[i+1].startsWith('--'), 'Missing value: '+key);
      opts[key.slice(2)] = args[++i];
    }
  }
  assert.ok(scopes[opts.scope], 'Unknown scope: '+opts.scope);
  if (level === 'gate') assert.ok(opts.evidence, 'gate requires --evidence <FULL run directory>');
  if (level === 'full') {
    assert.equal(opts.scope, 'workflow', 'FULL has no scope selection');
    assert.ok(!opts.shots && !opts.reuse, 'FULL cannot select screenshots or reuse evidence');
  }
  if (opts.reuse) assert.equal(level, 'focused', 'Evidence reuse is only for FOCUSED');
  const filters = scopes[opts.scope].map((value, i) => env[i ? 'OCE_STAGE_A_FILTER' : 'OCE_TEST_FILTER'] || value);
  if (level === 'full') opts.filters = ['', ''];
  else opts.filters = filters.map((value, i) => level === 'focused' && !['report-refinement','punch-client','overview-navigation'].includes(opts.scope) ? [value,common[i]].filter(Boolean).join('|') : value);
  if (['report-refinement','punch-client'].includes(opts.scope)) {
    assert.ok(!opts.shots, 'Report refinement produces only its two representative PDF comparisons');
    opts.filters = ['', '']; // This standalone scope owns report/audience guards, not unrelated suites.
  }
  if (opts.scope === 'overview-navigation') {
    assert.ok(!opts.shots, 'Overview navigation runs only its targeted interaction contracts');
    opts.filters = ['', ''];
  }
  opts.filters.filter(Boolean).forEach(value => new RegExp(value));
  if (opts.shots) new RegExp(opts.shots);
  return opts;
}

function plan(opts) {
  const steps = [];
  const add = (id, engine, file, args=[], filter='') => steps.push({id,engine,file,args,filter});
  if (opts.scope === 'overview-navigation') {
    for (const engine of opts.level === 'fast' ? ['chromium'] : ['chromium','firefox'])
      add(engine+'-overview-navigation',engine,'tests/overview-navigation.cjs');
    return steps;
  }
  if (opts.scope === 'punch-client') {
    for (const engine of opts.level === 'fast' ? ['chromium'] : ['chromium','firefox']) {
      add(engine+'-punch-client',engine,'tests/punch-client-reports.cjs',engine === 'chromium' && opts.level === 'focused' ? ['--pdf'] : []);
      if (engine === 'chromium' && opts.level === 'focused') add('punch-client-comparison',engine,'tests/compare-punch-client.py');
    }
    return steps;
  }
  if (opts.scope === 'report-refinement') {
    for (const engine of opts.level === 'fast' ? ['chromium'] : ['chromium','firefox']) {
      add(engine+'-report-refinement',engine,'tests/report-refinement.cjs',engine === 'chromium' && opts.level === 'focused' ? ['--pdf'] : []);
      if (engine === 'chromium' && opts.level === 'focused') add('report-refinement-comparison',engine,'tests/compare-report-refinement.py');
    }
    return steps;
  }
  for (const engine of opts.level === 'fast' ? ['chromium'] : ['chromium','firefox']) {
    if (opts.level === 'full' || opts.filters[0]) add(engine+'-regression',engine,'tests/regression.cjs',[],opts.filters[0]);
    if (opts.level === 'full' || opts.filters[1]) add(engine+'-workspaces',engine,'tests/workspaces.cjs',[],opts.filters[1]);
    if (engine === 'chromium' && ['focused','full'].includes(opts.level)) add('report-comparison',engine,'tests/compare-print.py');
  }
  if (opts.level === 'full') {
    add('chromium-overview-navigation','chromium','tests/overview-navigation.cjs');
    add('firefox-overview-navigation','firefox','tests/overview-navigation.cjs');
    add('chromium-overview-quick-add','chromium','tests/overview-quick-add.cjs');
    add('firefox-overview-quick-add','firefox','tests/overview-quick-add.cjs');
    add('chromium-release-default','chromium','tests/release-default.cjs');
    add('firefox-release-default','firefox','tests/release-default.cjs');
    add('chromium-report-refinement','chromium','tests/report-refinement.cjs',['--pdf']);
    add('firefox-report-refinement','firefox','tests/report-refinement.cjs');
    add('report-refinement-comparison','chromium','tests/compare-report-refinement.py');
    add('chromium-punch-client','chromium','tests/punch-client-reports.cjs',['--pdf']);
    add('firefox-punch-client','firefox','tests/punch-client-reports.cjs');
    add('punch-client-comparison','chromium','tests/compare-punch-client.py');
    add('workspace-pdfs','chromium','tests/workspace-print.cjs');
    add('workspace-pdf-comparison','chromium','tests/compare-workspace-print.py');
    add('project-spatial-screenshots','chromium','tests/capture-project-spatial.cjs');
    add('model-evidence','chromium','tests/model-inspection.cjs',['--no-screenshots']);
    add('complete-recovery','recovery','tests/recovery.cjs');
    add('recovery-verification','recovery','tests/verify-recovery.py');
  } else if (opts.shots) {
    const captures = {forms:['forms-screenshots','tests/capture-forms.cjs'],'project-spatial':['project-spatial-screenshots','tests/capture-project-spatial.cjs']};
    const [id,file] = captures[opts.scope] || ['workspace-screenshots','tests/capture-workspaces.cjs'];
    add(id,'chromium',file,[],opts.shots);
  }
  return steps;
}

function childEnv(step, directory, env = process.env) {
  const result = {...env, OCE_ENGINE:step.engine, OCE_TEST_OUTPUT:directory};
  for (const key of ['OCE_TEST_FILTER','OCE_STAGE_A_FILTER','OCE_SCREENSHOT_FILTER','OCE_MAIN_REF','OCE_BROWSER']) delete result[key];
  if (step.file.endsWith('regression.cjs') && step.filter) result.OCE_TEST_FILTER=step.filter;
  if (step.file === 'tests/workspaces.cjs' && step.filter) result.OCE_STAGE_A_FILTER=step.filter;
  if (['tests/capture-workspaces.cjs','tests/capture-forms.cjs','tests/capture-project-spatial.cjs'].includes(step.file) && step.filter) result.OCE_SCREENSHOT_FILTER=step.filter;
  if (step.engine === 'chromium' && env.OCE_BROWSER) result.OCE_BROWSER=env.OCE_BROWSER;
  return result;
}

function suite(report, engine, full, commit) {
  assert.equal(report.commit, commit);
  assert.equal(report.endCommit, commit, 'Commit changed during suite');
  assert.equal(report.environment?.engine || report.engine, engine);
  assert.ok(report.tests.length, 'Filter matched zero tests');
  assert.ok(report.tests.every(t => t.status === 'PASS'), 'Every selected assertion must pass');
  if (full) {
    assert.equal(report.fullRun, true, 'Partial runs never satisfy FULL');
    if (!report.environment) {
      assert.equal(report.tests.filter(t=>t.name?.startsWith('Overview:')).length,13,'All B1 Overview contracts required');
      assert.equal(report.tests.filter(t=>t.name?.startsWith('Overview refinement:')).length,12,'All B2 refinement contracts required');
      assert.equal(report.tests.filter(t=>t.name?.startsWith('Spatial usability:')).length,12,'All C1 spatial usability contracts required');
      assert.equal(report.tests.filter(t=>t.name?.startsWith('Field usability:')).length,12,'All C2 field usability contracts required');
      assert.equal(report.tests.filter(t=>t.name?.startsWith('Forms and Settings:')).length,11,'All Stage D forms and Settings contracts required');
      assert.equal(report.tests.filter(t=>t.name?.startsWith('Project spatial:')).length,10,'All Stage E project spatial contracts required');
    }
    assert.equal(report.worktreeClean, true);
    assert.ok(report.tests.length >= (report.environment ? 83 : 104), 'Incomplete acceptance suite');
  }
}

function overviewNavigation(report, engine, commit, full = false) {
  assert.equal(report.commit,commit);assert.equal(report.endCommit,commit);
  assert.equal(report.engine,engine);
  assert.equal(report.tests.length,10,'All Overview navigation contracts required');
  assert.equal(new Set(report.tests.map(t=>t.name)).size,10,'Distinct Overview navigation contracts required');
  assert.ok(report.tests.every(t=>t.status==='PASS'),'Every Overview navigation assertion must pass');
  if (full) {assert.equal(report.fullRun,true);assert.equal(report.worktreeClean,true);}
}

const quickAddInputs=['index.html','ui-overview.js','ui-overview.css','ui-workspaces.js','ui-workspaces.css','ui-forms.js','ui-forms.css','tests/harness.cjs','tests/workspace-fixture.cjs','tests/overview-record-source.cjs','tests/overview-quick-add-source.cjs','tests/overview-quick-add.cjs'];
const releaseDefaultInputs=['index.html','ui-workspaces.js','ui-workspaces.css','ui-overview.js','ui-overview.css','tests/harness.cjs','tests/workspace-fixture.cjs','tests/release-default.cjs','tests/release-default-source.cjs'];
function exactSourceHashes(report,files,label) {
  assert.equal(report.inputsUnchanged,true);
  assert.deepEqual(Object.keys(report.sourceHashes).sort(),[...files].sort(),'All '+label+' source inputs required');
  for(const file of files)assert.equal(report.sourceHashes[file],sha(fs.readFileSync(path.join(root,file))),label+' source changed: '+file);
}
function overviewQuickAdd(report, engine, commit, full = false) {
  assert.equal(report.commit,commit);assert.equal(report.endCommit,commit);
  assert.equal(report.engine,engine);
  assert.equal(report.tests.length,8,'All Quick Add contracts required');
  assert.equal(new Set(report.tests.map(t=>t.name)).size,8,'Distinct Quick Add contracts required');
  assert.ok(report.tests.every(t=>t.name.startsWith('G2 ')&&t.status==='PASS'),'Every Quick Add assertion must pass');
  assert.equal(report.passed,8);assert.equal(report.failed,0);
  exactSourceHashes(report,quickAddInputs,'Quick Add');
  if(full)assert.equal(report.worktreeClean,true);
}
function releaseDefault(report, engine, commit, full = false) {
  assert.equal(report.commit,commit);assert.equal(report.endCommit,commit);assert.equal(report.engine,engine);
  assert.equal(report.tests.length,6,'All release default contracts required');
  assert.equal(new Set(report.tests.map(t=>t.name)).size,6,'Distinct release default contracts required');
  assert.ok(report.tests.every(t=>t.name.startsWith('Release default:')&&t.status==='PASS'),'Every release default assertion must pass');
  assert.equal(report.passed,6);assert.equal(report.failed,0);
  exactSourceHashes(report,releaseDefaultInputs,'Release default');
  if(full)assert.equal(report.worktreeClean,true);
}

function reportRefinement(report, engine, commit, pdfs) {
  assert.equal(report.commit,commit);assert.equal(report.endCommit,commit);
  assert.equal(report.engine,engine);assert.equal(report.pdfs,pdfs);
  assert.equal(report.tests.length,25,'All report refinement contracts required');
  assert.ok(report.tests.every(t=>t.status==='PASS'),'Every report assertion must pass');
}
function reportComparisons(results) {
  assert.equal(results.length,2,'Both affected report comparisons required');
  for(const mode of ['report','photos']) {
    const matches=results.filter(r=>r.mode===mode);
    assert.equal(matches.length,1);assert.equal(matches[0].sameContent,true);
    assert.equal(matches[0].photosPreserved,true);
    if(mode==='photos')assert.equal(matches[0].firstPhotoPage,1,'Weekly opening page must contain a photograph');
  }
}
function punchClient(report, engine, commit, pdfs) {
  assert.equal(report.commit,commit);assert.equal(report.endCommit,commit);
  assert.equal(report.engine,engine);assert.equal(report.pdfs,pdfs);
  assert.equal(report.tests.length,25,'All Punch List and Client report contracts required');
  assert.ok(report.tests.every(t=>t.status==='PASS'),'Every report assertion must pass');
}
function punchClientComparisons(results) {
  assert.equal(results.length,2,'Both Punch List and Client comparisons required');
  for(const mode of ['punchlist','client']) {
    const matches=results.filter(r=>r.mode===mode);
    assert.equal(matches.length,1);assert.equal(matches[0].sameContent,true);
    assert.equal(matches[0].photosPreserved,true);
  }
}
function historicalPrintComparisons(results,count) {
  assert.equal(results.length,count);
  for(const result of results) {
    const mode=result.report || result.family;
    assert.ok(['report','photos','client','punchlist'].includes(mode) ? result.sameContent === true && result.photosPreserved === true : result.sameTextOnEveryPage === true,
      'Preserve complete content/order; pagination may change only for full-board, weekly photos and Punch List');
  }
}

// Only documentation-only changes may reuse evidence. Source, fixtures, assets, tooling,
// commands, main baseline, browser binary and platform all participate in the key.
function inputs(steps) {
  const files = git(['ls-files','-c','-o','--exclude-standard','-z']).split('\0').filter(Boolean)
    .filter(file => !file.endsWith('.md') && !file.startsWith('docs/')).sort();
  const filesHash = sha(JSON.stringify([...new Set(files)].map(file => [file,sha(fs.readFileSync(path.join(root,file)))])));
  const engines = [...new Set(steps.map(s => s.engine).filter(e => e !== 'recovery'))];
  const playwright = engines.length ? require('playwright') : null;
  const browsers = engines.map(engine => {
    const executable = engine === 'chromium' && process.env.OCE_BROWSER || playwright[engine].executablePath();
    return {engine,executable,sha256:sha(fs.readFileSync(executable))};
  });
  const python = steps.some(s => s.file.endsWith('.py')) ? execFileSync(process.env.OCE_PYTHON || 'python',
    ['-c','import sys,pypdf; print(sys.version); print(pypdf.__version__)'],{encoding:'utf8'}).trim() : null;
  return {filesHash,main:git(['rev-parse','origin/main']),node:process.version,platform:process.platform,
    arch:process.arch,os:os.release(),playwright:playwright ? require('playwright/package.json').version : null,
    browsers,python,graphics:process.env.LIBGL_ALWAYS_SOFTWARE || '',steps};
}

function artifacts(directory) {
  return fs.readdirSync(directory,{recursive:true,withFileTypes:true}).filter(e=>e.isFile())
    .map(e=>path.relative(directory,path.join(e.parentPath,e.name))).filter(f=>f!=='verification.json').sort()
    .map(file=>({file,sha256:sha(fs.readFileSync(path.join(directory,file)))}));
}
function checkArtifacts(directory, records) {
  assert.ok(records.length, 'No evidence artifacts');
  for (const record of records) {
    const file = path.resolve(directory,record.file);
    assert.ok(file.startsWith(path.resolve(directory)+path.sep), 'Evidence path escapes run directory');
    assert.equal(sha(fs.readFileSync(file)), record.sha256, 'Evidence changed: '+record.file);
  }
}
function reusable(receipt, input, directory) {
  assert.equal(receipt.level, 'focused'); assert.equal(receipt.status, 'PASS');
  assert.ok(!receipt.reusedFrom, 'Reuse must reference the original executed run');
  assert.deepEqual(receipt.inputs, input, 'Source, inputs, commands or environment changed');
  const age = Date.now()-Date.parse(receipt.completedAt);
  assert.ok(age >= 0 && age <= 24*60*60*1000, 'Evidence reuse expires after 24 hours');
  checkArtifacts(directory,receipt.artifacts);
}

function basic(directory) {
  git(['diff','--check']);
  const files = git(['ls-files','-c','-o','--exclude-standard','-z']).split('\0').filter(Boolean);
  for (const file of [...new Set(files)].filter(f=>/\.(c?js)$/.test(f)))
    execFileSync(process.execPath,['--check',file],{cwd:root,stdio:'pipe'});
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for (const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) if (script[1].trim()) new vm.Script(script[1]);
  const mainOverride=process.env.OCE_MAIN_REF;
  let preservation;
  try {process.env.OCE_MAIN_REF='origin/main';preservation=require('./preservation.cjs')(root,directory);}
  finally {if(mainOverride===undefined)delete process.env.OCE_MAIN_REF;else process.env.OCE_MAIN_REF=mainOverride;}
  write(path.join(directory,'integrity.json'),{status:'PASS',syntax:true,diffCheck:true,...preservation});
}

async function execute(step, directory, logfile) {
  const executable=step.file.endsWith('.py') ? (process.env.OCE_PYTHON || 'python') : process.execPath;
  const log=fs.createWriteStream(logfile);
  console.log('RUN '+step.id);
  const code=await new Promise((resolve,reject)=>{
    const child=spawn(executable,[step.file,...step.args],{cwd:root,env:childEnv(step,directory),stdio:['ignore','pipe','pipe']});
    child.stdout.on('data',chunk=>{process.stdout.write(chunk);log.write(chunk);});
    child.stderr.on('data',chunk=>{process.stderr.write(chunk);log.write(chunk);});
    child.on('error',reject);child.on('close',resolve);
  }).finally(()=>new Promise(resolve=>log.end(resolve)));
  assert.equal(code,0,'Failed step: '+step.id+' (no automatic retry)');
}

function formsScreenshots(shots, directory, commit) {
  return screenshots(shots,directory,commit,'d');
}
function projectSpatialScreenshots(shots, directory, commit) {
  return screenshots(shots,directory,commit,'e');
}
function screenshots(shots, directory, commit, stage) {
  assert.equal(shots.commit,commit);assert.equal(shots.fullRun,true);
  const expected=[['desktop',1440,900],['tablet',768,1024],['mobile',390,844]].map(([view,width,height])=>['stage-'+stage+'-'+view+'.png',width,height]);
  assert.equal(shots.screenshots.length,expected.length,'Exactly three representative Stage '+stage.toUpperCase()+' captures required');
  for (const [name,width,height] of expected) {
    const matches=shots.screenshots.filter(s=>s.name===name);
    assert.equal(matches.length,1,'Missing or duplicate capture: '+name);
    assert.equal(matches[0].width,width);assert.equal(matches[0].height,height);
    const bytes=fs.readFileSync(path.join(directory,name));
    assert.ok(bytes.length>=33 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.toString('ascii',12,16)==='IHDR','Invalid PNG: '+name);
    assert.equal(bytes.readUInt32BE(16),width,'Captured PNG width: '+name);
    assert.equal(bytes.readUInt32BE(20),height,'Captured PNG height: '+name);
  }
}

function fullEvidence(directory, receipt, commit, main) {
  assert.equal(receipt.level,'full');assert.equal(receipt.status,'PASS');assert.ok(!receipt.reusedFrom);
  assert.equal(receipt.commit,commit);assert.equal(receipt.endCommit,commit);assert.equal(receipt.clean,true);
  assert.equal(receipt.inputs.main,main,'Operational main changed; rerun FULL');
  const expected=plan(options(['full'],{}));
  assert.deepEqual(receipt.inputs.steps,expected,'FULL command plan incomplete');
  assert.deepEqual(receipt.steps.map(s=>[s.id,s.status]),expected.map(s=>[s.id,'PASS']));
  for (const engine of ['chromium','firefox']) for (const file of ['regression-results.json','stage-a-results.json'])
    suite(read(path.join(directory,engine,file)),engine,true,commit);
  for(const engine of ['chromium','firefox'])overviewNavigation(read(path.join(directory,engine,'overview-navigation/results.json')),engine,commit,true);
  for(const engine of ['chromium','firefox'])overviewQuickAdd(read(path.join(directory,engine,'overview-quick-add/results.json')),engine,commit,true);
  for(const engine of ['chromium','firefox'])releaseDefault(read(path.join(directory,engine,'release-default/results.json')),engine,commit,true);
  const chrome=path.join(directory,'chromium');
  for (const [file,count] of [['print-comparison.json',5],['workspace-pdfs/comparison-results.json',20]]) {
    historicalPrintComparisons(read(path.join(chrome,file)),count);
  }
  for(const engine of ['chromium','firefox'])reportRefinement(read(path.join(directory,engine,'report-refinement-results.json')),engine,commit,engine==='chromium');
  reportComparisons(read(path.join(chrome,'report-refinement-comparison.json')));
  for(const engine of ['chromium','firefox'])punchClient(read(path.join(directory,engine,'punch-client-results.json')),engine,commit,engine==='chromium');
  punchClientComparisons(read(path.join(chrome,'punch-client-comparison.json')));
  const shots=read(path.join(chrome,'screenshots/manifest.json'));
  projectSpatialScreenshots(shots,path.join(chrome,'screenshots'),commit);
  const recovery=read(path.join(directory,'recovery/recovery-manifest.json'));
  assert.equal(recovery.commit,commit);assert.equal(recovery.main,main);assert.deepEqual(recovery.prerequisites,[]);
  assert.equal(recovery.offlineClone,true);assert.equal(recovery.fsck,'PASS');assert.equal(recovery.allTrackedBytesVerified,true);
  const archive=read(path.join(directory,'recovery/source-archive-validation.json'));
  assert.equal(archive.commit,commit);assert.equal(archive.filesVerified,recovery.filesVerified);assert.equal(archive.everyFileSHA256,'PASS');
  for (const artifact of recovery.artifacts) assert.equal(sha(fs.readFileSync(path.join(directory,'recovery',artifact.file))),artifact.sha256);
  checkArtifacts(directory,receipt.artifacts);
}

async function main(argv) {
  const opts=options(argv), steps=plan(opts);
  if (opts.plan) {console.log(JSON.stringify({level:opts.level,scope:opts.scope,basic:true,steps},null,2));return;}
  const commit=git(['rev-parse','HEAD']), clean=!git(['status','--porcelain']);
  if (opts.level === 'gate') {
    assert.ok(clean,'Acceptance gate requires a clean checkout');
    const receipt=read(path.join(opts.evidence,'verification.json'));
    fullEvidence(opts.evidence,receipt,commit,git(['rev-parse','origin/main']));
    assert.deepEqual(receipt.inputs,inputs(receipt.inputs.steps),'Source or verification environment changed');
    console.log('PASS FULL acceptance evidence for '+commit+'; owner approval still required.');return;
  }
  if (opts.level === 'full') assert.ok(clean,'Commit the candidate before FULL verification');
  // Never append filtered results to an old suite JSON or overwrite accepted evidence.
  const parent=path.resolve(process.env.OCE_VERIFY_OUTPUT || path.join(root,'test-results/verification'));
  fs.mkdirSync(parent,{recursive:true});
  const directory=fs.mkdtempSync(path.join(parent,opts.level+'-'+commit.slice(0,7)+'-'));
  const receipt={level:opts.level,scope:opts.scope,commit,clean,startedAt:new Date().toISOString(),status:'FAIL',steps:[]};
  console.log('Evidence: '+directory);
  try {
    basic(directory);
    const toolingLog=path.join(directory,'tooling-tests.log'), descriptor=fs.openSync(toolingLog,'w');
    try {execFileSync(process.execPath,['--test','tests/verify.test.cjs','tests/overview-quick-add-source.cjs','tests/release-default-source.cjs'],{cwd:root,stdio:['ignore',descriptor,descriptor]});}
    finally {fs.closeSync(descriptor);process.stdout.write(fs.readFileSync(toolingLog));}
    receipt.inputs=inputs(steps);
    if (opts.reuse) {
      reusable(read(path.join(opts.reuse,'verification.json')),receipt.inputs,opts.reuse);
      receipt.reusedFrom=path.resolve(opts.reuse);
      receipt.originalCommit=read(path.join(opts.reuse,'verification.json')).commit;
      console.log('REUSED FOCUSED evidence from '+receipt.reusedFrom+'; not a new acceptance run');
    } else for (const step of steps) {
      const target=path.join(directory,step.engine);fs.mkdirSync(target,{recursive:true});
      const result={id:step.id,status:'FAIL'};receipt.steps.push(result);
      await execute(step,target,path.join(directory,step.id+'.log'));
      if (step.file === 'tests/regression.cjs' || step.file === 'tests/workspaces.cjs')
        suite(read(path.join(target,step.file.endsWith('regression.cjs')?'regression-results.json':'stage-a-results.json')),step.engine,opts.level==='full',commit);
      if (step.file === 'tests/overview-navigation.cjs') overviewNavigation(read(path.join(target,'overview-navigation/results.json')),step.engine,commit,opts.level==='full');
      if (step.file === 'tests/overview-quick-add.cjs') overviewQuickAdd(read(path.join(target,'overview-quick-add/results.json')),step.engine,commit,opts.level==='full');
      if (step.file === 'tests/release-default.cjs') releaseDefault(read(path.join(target,'release-default/results.json')),step.engine,commit,opts.level==='full');
      if (step.file === 'tests/report-refinement.cjs') reportRefinement(read(path.join(target,'report-refinement-results.json')),step.engine,commit,step.args.includes('--pdf'));
      if (step.file === 'tests/compare-report-refinement.py') reportComparisons(read(path.join(target,'report-refinement-comparison.json')));
      if (step.file === 'tests/punch-client-reports.cjs') punchClient(read(path.join(target,'punch-client-results.json')),step.engine,commit,step.args.includes('--pdf'));
      if (step.file === 'tests/compare-punch-client.py') punchClientComparisons(read(path.join(target,'punch-client-comparison.json')));
      result.status='PASS';
    }
    receipt.endCommit=git(['rev-parse','HEAD']);assert.equal(receipt.endCommit,commit);
    assert.deepEqual(inputs(steps),receipt.inputs,'Verification inputs changed during run');
    if (opts.level === 'full') assert.equal(git(['status','--porcelain']),'');
    receipt.artifacts=artifacts(directory);receipt.status='PASS';
    if (opts.level === 'full') fullEvidence(directory,receipt,commit,receipt.inputs.main);
  } catch(error) {receipt.status='FAIL';receipt.error=error.stack;throw error;}
  finally {receipt.completedAt=new Date().toISOString();write(path.join(directory,'verification.json'),receipt);}
  console.log('PASS '+opts.level.toUpperCase()+' — '+directory);
}
module.exports={options,plan,childEnv,suite,overviewNavigation,overviewQuickAdd,releaseDefault,reportRefinement,reportComparisons,punchClient,punchClientComparisons,historicalPrintComparisons,reusable,formsScreenshots,projectSpatialScreenshots,fullEvidence,sha};
if(require.main===module)main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
