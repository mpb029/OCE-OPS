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
  overview: ['^Source contract:', '^Overview:'],
  navigation: ['', '^Opt-in,|^Navigation 768×1024|^Keyboard and discoverable drawer 768×1024'],
  audience: ['^Audience parity', '^Audience compatibility|^Absent whole workspace|^Empty permitted'],
  editing: ['^CRUD parity: (dailyWorks|rfis),|^Production stat:', '^Workspace CRUD'],
  backup: ['^Backup repair:|^Readiness: (import|malformed|failed import)', '^Opt-in (Backup repair|Readiness):'],
  spatial: ['^Map:|^Map repair:|^3D', '^Spatial instances'],
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
  else opts.filters = filters.map((value, i) => level === 'focused' ? [value,common[i]].filter(Boolean).join('|') : value);
  opts.filters.filter(Boolean).forEach(value => new RegExp(value));
  if (opts.shots) new RegExp(opts.shots);
  return opts;
}

function plan(opts) {
  const steps = [];
  const add = (id, engine, file, args=[], filter='') => steps.push({id,engine,file,args,filter});
  for (const engine of opts.level === 'fast' ? ['chromium'] : ['chromium','firefox']) {
    if (opts.level === 'full' || opts.filters[0]) add(engine+'-regression',engine,'tests/regression.cjs',[],opts.filters[0]);
    if (opts.level === 'full' || opts.filters[1]) add(engine+'-workspaces',engine,'tests/workspaces.cjs',[],opts.filters[1]);
    if (engine === 'chromium' && ['focused','full'].includes(opts.level)) add('report-comparison',engine,'tests/compare-print.py');
  }
  if (opts.level === 'full') {
    add('workspace-pdfs','chromium','tests/workspace-print.cjs');
    add('workspace-pdf-comparison','chromium','tests/compare-workspace-print.py');
    add('workspace-screenshots','chromium','tests/capture-workspaces.cjs');
    add('classic-screenshots','chromium','tests/capture.cjs',['after']);
    add('model-evidence','chromium','tests/model-inspection.cjs');
    add('complete-recovery','recovery','tests/recovery.cjs');
    add('recovery-verification','recovery','tests/verify-recovery.py');
  } else if (opts.shots) add('workspace-screenshots','chromium','tests/capture-workspaces.cjs',[],opts.shots);
  return steps;
}

function childEnv(step, directory, env = process.env) {
  const result = {...env, OCE_ENGINE:step.engine, OCE_TEST_OUTPUT:directory};
  for (const key of ['OCE_TEST_FILTER','OCE_STAGE_A_FILTER','OCE_SCREENSHOT_FILTER','OCE_MAIN_REF','OCE_BROWSER']) delete result[key];
  if (step.file.endsWith('regression.cjs') && step.filter) result.OCE_TEST_FILTER=step.filter;
  if (step.file === 'tests/workspaces.cjs' && step.filter) result.OCE_STAGE_A_FILTER=step.filter;
  if (step.file.endsWith('capture-workspaces.cjs') && step.filter) result.OCE_SCREENSHOT_FILTER=step.filter;
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
    if (!report.environment) assert.equal(report.tests.filter(t=>t.name?.startsWith('Overview:')).length,13,'All B1 Overview contracts required');
    assert.equal(report.worktreeClean, true);
    assert.ok(report.tests.length >= (report.environment ? 83 : 47), 'Incomplete acceptance suite');
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

function fullEvidence(directory, receipt, commit, main) {
  assert.equal(receipt.level,'full');assert.equal(receipt.status,'PASS');assert.ok(!receipt.reusedFrom);
  assert.equal(receipt.commit,commit);assert.equal(receipt.endCommit,commit);assert.equal(receipt.clean,true);
  assert.equal(receipt.inputs.main,main,'Operational main changed; rerun FULL');
  const expected=plan(options(['full'],{}));
  assert.deepEqual(receipt.inputs.steps,expected,'FULL command plan incomplete');
  assert.deepEqual(receipt.steps.map(s=>[s.id,s.status]),expected.map(s=>[s.id,'PASS']));
  for (const engine of ['chromium','firefox']) for (const file of ['regression-results.json','stage-a-results.json'])
    suite(read(path.join(directory,engine,file)),engine,true,commit);
  const chrome=path.join(directory,'chromium');
  for (const [file,count] of [['print-comparison.json',5],['workspace-pdfs/comparison-results.json',20]]) {
    const result=read(path.join(chrome,file));assert.equal(result.length,count);assert.ok(result.every(r=>r.sameTextOnEveryPage));
  }
  const shots=read(path.join(chrome,'screenshots/manifest.json'));
  assert.equal(shots.commit,commit);assert.equal(shots.fullRun,true);assert.equal(shots.screenshots.length,48);
  for (const shot of shots.screenshots) assert.ok(fs.statSync(path.join(chrome,'screenshots',shot.name)).size>0);
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
    try {execFileSync(process.execPath,['--test','tests/verify.test.cjs'],{cwd:root,stdio:['ignore',descriptor,descriptor]});}
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
module.exports={options,plan,childEnv,suite,reusable,fullEvidence,sha};
if(require.main===module)main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
