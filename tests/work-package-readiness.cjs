// WP1 focused contracts. Synthetic records, original forms and intercepted publishing only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {root,output,start,open}=require('./harness.cjs');
const fixture=require('./workspace-fixture.cjs');
const fast=process.argv.includes('--fast'),results=[],startedAt=new Date().toISOString();
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const commit=git(['rev-parse','HEAD']);
const inputFiles=['index.html','ui-forms.js','ui-forms.css','ui-workspaces.js','ui-workspaces.css','tests/harness.cjs','tests/workspace-fixture.cjs','tests/work-package-readiness.cjs','tests/work-package-source.cjs','tests/overview-record-source.cjs'];
const hashes=()=>Object.fromEntries(inputFiles.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
const sourceHashes=hashes();
const wp=(id,fields={})=>({id,main:'Package '+id,project:'default',pct:25,vis:{site:true,client:true},...fields});
const board=items=>{const data=fixture();data.panels.workPackages=items;return data;};
const snapshot=p=>p.evaluate(()=>({state:structuredClone(__opsTest.state),storage:{...localStorage},sync:{...__opsTest.sync}}));
const records=p=>p.evaluate(()=>structuredClone(__opsTest.state.panels.workPackages));
const row=(p,id)=>p.locator('[data-card="workPackages"] .card-body > .list > li').filter({has:p.locator('.main').filter({hasText:new RegExp('^Package '+id+'$')})});
const prerequisite=(p,id)=>p.locator('#fWPPrerequisites input[name="wpPrerequisite"]').filter({visible:true}).locator('xpath=self::*[@value="'+id+'"]');
async function ready(p){await p.waitForFunction(()=>document.querySelector('[data-card="workPackages"] .wp-readiness'));}
async function edit(p,id){await p.locator('[data-edit="workPackages:'+id+'"]').click();await opened(p);}
async function opened(p){await p.waitForFunction(()=>document.getElementById('itemModal').classList.contains('open')&&document.activeElement===document.getElementById('fMain'));}
async function cancel(p){await p.locator('#itemModal [data-close]').click();await p.waitForFunction(()=>!document.getElementById('itemModal').classList.contains('open'));}
async function save(p){await p.locator('#itemSave').click();await p.waitForFunction(()=>!document.getElementById('itemModal').classList.contains('open'));}
async function expectReady(p,id,go){assert.equal(await row(p,id).locator(go?'.wp-go':'.wp-no-go').count(),1,id+' readiness');assert.equal(await row(p,id).locator(go?'.wp-no-go':'.wp-go').count(),0);}
async function noWrites(run,before){if(before)assert.deepEqual(await snapshot(run.page),before);assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);}
async function exported(p){if(!await p.locator('#btnExport').isVisible())await p.locator('#headerMenu summary').click();const pending=p.waitForEvent('download');await p.locator('#btnExport').click();return JSON.parse(fs.readFileSync(await(await pending).path(),'utf8'));}
async function restore(p,data){await p.locator('#fileImport').setInputFiles({name:'wp1-synthetic-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});const pending=p.waitForEvent('download');await p.locator('#importBackup').click();await pending;await p.locator('#importBackupSaved').check();await p.locator('#importConfirm').click();await p.waitForFunction(()=>!document.getElementById('importModal').classList.contains('open'));}
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}catch(error){results.push({name,status:'FAIL',error:error.stack});console.error('FAIL '+name+': '+error.message);}}
async function entry(env,items,options={}){const run=await open(env,{data:board(items),audience:'?ui=workspaces&workspace=operations&workspaceProject=default',...options});await ready(run.page);return run;}

(async()=>{
 const env=await start();
 try{
  await check('WP1 source and preservation: exact additions only, syntax valid, historical guards reject altered bodies, protected assets unchanged',()=>{
   const {normalise,blocks}=require('./work-package-source.cjs');
   for(const file of ['index.html','ui-forms.js']){
    const current=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
    const before=execFileSync('git',['show','3692d1ec744459333fd2e7d41b8e08abdebaadcf:'+file],{cwd:root,encoding:'utf8',maxBuffer:2e6}).replace(/\r\n/g,'\n');
    assert.equal(require('./ifc-source.cjs').normalise(file,normalise(file,current)),before,file+' has only exact Work Package and IFC additions');
    assert.notEqual(normalise(file,current+'\n// unrelated edit'),before);
    if(file==='index.html'){
     for(const [start] of blocks){assert.throws(()=>normalise(file,current+start));assert.throws(()=>normalise(file,current.replace(start,start+' altered')));}
     for(const script of current.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(script[1].trim())new(require('node:vm').Script)(script[1]);
    }
   }
   require('./preservation.cjs')(root,output);
  });
  await check('WP1 legacy and materials: missing defaults, four states, unknown values and no stored GO flag',async()=>{
   const items=[wp('legacy'),...['unconfirmed','available','unavailable','not-required','unknown'].map(materialsStatus=>wp(materialsStatus,{materialsStatus}))];
   const run=await entry(env,items),p=run.page;
   try{
    const before=await snapshot(p);
    for(const item of items)await expectReady(p,item.id,['available','not-required'].includes(item.materialsStatus));
    assert.match(await row(p,'legacy').locator('.wp-reasons').innerText(),/material/i);
    assert.match(await row(p,'unavailable').locator('.wp-reasons').innerText(),/material/i);
    await edit(p,'legacy');assert.equal(await p.locator('#fMaterialsStatus').inputValue(),'unconfirmed');assert.equal(await p.locator('#fWPConstraints').inputValue(),'');assert.equal(await p.locator('#fWPPrerequisites input:checked').count(),0);
    await cancel(p);await noWrites(run,before);
    assert.deepEqual(await records(p),items,'Rendering and opening legacy records must not migrate data');
    assert.equal(await p.locator('#itemModal input[name="go"],#itemModal select[name="go"]').count(),0);
   }finally{await run.close();}
  });
  await check('WP1 completion: explicit completed/legacy done and retired records satisfy; progress, cancellation and deleted history do not',async()=>{
   const states={active:{},percent:{pct:100},completed:{wstatus:'completed'},done:{done:true},cancelled:{done:true,wstatus:'cancelled'},retired:{wstatus:'completed',resolvedAt:'2026-10-10T00:00:00Z'}};
   const items=Object.entries(states).flatMap(([id,fields])=>[wp('dep-'+id,fields),wp('use-'+id,{materialsStatus:'available',prerequisiteIds:['dep-'+id]})]);
   items.push(wp('multiple',{materialsStatus:'not-required',prerequisiteIds:['dep-completed','dep-retired','dep-done']}),wp('deleted',{materialsStatus:'available',prerequisiteIds:['removed']}));
   const data=board(items);data.history.removed={id:'removed',panel:'Work Packages',project:'North workfront · Watermain renewal',title:'Deleted completed package',workStatus:'Completed',done:true,removed:true};
   const run=await entry(env,items,{data}),p=run.page;
   try{
    for(const id of Object.keys(states))await expectReady(p,'use-'+id,['completed','done','retired'].includes(id));
    await expectReady(p,'multiple',true);await expectReady(p,'deleted',false);assert.equal(await row(p,'dep-retired').count(),0);
    assert.match(await row(p,'deleted').locator('.wp-reasons').innerText(),/missing|unavailable|invalid|not found/i);
    await edit(p,'dep-completed');await p.locator('#tglWStatus').check();await p.locator('#fWStatus').selectOption('inprogress');await save(p);await expectReady(p,'use-completed',false);await expectReady(p,'multiple',false);
    await edit(p,'dep-completed');await p.locator('#fWStatus').selectOption('completed');await save(p);await expectReady(p,'use-completed',true);await expectReady(p,'multiple',true);
    assert.ok((await records(p)).some(x=>x.id==='dep-retired'));await noWrites(run);
   }finally{await run.close();}
  });
  await check('WP1 dependency validation: direct/indirect cycles, self, duplicate, malformed, missing and cross-project links fail closed',async()=>{
   const items=[wp('complete',{wstatus:'completed'}),wp('east',{project:'east',wstatus:'completed'}),
    wp('orphan-prerequisite',{project:'missing-project',wstatus:'completed'}),wp('orphan-project',{project:'missing-project',materialsStatus:'available',prerequisiteIds:['orphan-prerequisite']}),
    wp('ambiguous',{wstatus:'completed'}),wp('ambiguous',{wstatus:'completed'}),wp('ambiguous-reference',{materialsStatus:'available',prerequisiteIds:['ambiguous']}),
    wp('self',{materialsStatus:'available',prerequisiteIds:['self']}),wp('duplicate',{materialsStatus:'available',prerequisiteIds:['complete','complete']}),
    wp('missing',{materialsStatus:'available',prerequisiteIds:['missing-id']}),wp('cross',{materialsStatus:'available',prerequisiteIds:['east']}),
    wp('malformed',{materialsStatus:'available',prerequisiteIds:'complete'}),wp('bad-entry',{materialsStatus:'available',prerequisiteIds:[null]}),
    wp('a',{materialsStatus:'available',prerequisiteIds:['b']}),wp('b',{materialsStatus:'available',prerequisiteIds:['c']}),wp('c',{materialsStatus:'available',prerequisiteIds:['a']})];
   const run=await entry(env,items,{audience:'?ui=workspaces&workspace=operations&workspaceProject=all'}),p=run.page;
   try{
    const before=await snapshot(p);
    for(const id of ['self','duplicate','missing','cross','malformed','bad-entry','a','b','c','orphan-project','ambiguous-reference']){await expectReady(p,id,false);assert.ok((await row(p,id).locator('.wp-reasons').innerText()).trim(),id+' has specific blocking feedback');}
    await noWrites(run,before);
   }finally{await run.close();}
  });
  if(!fast){
  await check('WP1 original form: same-project multi-select, self exclusion, cycle prevention and project-change validation retain unsaved state',async()=>{
   const items=[wp('a',{materialsStatus:'available',prerequisiteIds:['b']}),wp('b',{materialsStatus:'available'}),wp('c',{wstatus:'completed'}),wp('east',{project:'east',wstatus:'completed'})];
   const run=await entry(env,items),p=run.page;
   try{
    await edit(p,'b');const before=await snapshot(p);
    assert.equal(await p.locator('#fWPPrerequisites input[value="b"]').count(),0);assert.equal(await p.locator('#fWPPrerequisites input[value="east"]').count(),0);
    const a=prerequisite(p,'a');assert.equal(await a.count(),1);
    if(await a.isDisabled()){assert.equal(await a.isChecked(),false);await cancel(p);}else{
     await a.check();await p.locator('#itemSave').click();assert.equal(await p.locator('#itemModal').isVisible(),true);assert.match(await p.locator('#wpReadinessError').innerText(),/circular|cycle/i);await noWrites(run,before);await cancel(p);
    }
    await edit(p,'b');const incomingBefore=await snapshot(p);await p.locator('#fProject').selectOption('east');await p.locator('#itemSave').click();
    assert.equal(await p.locator('#itemModal').isVisible(),true);assert.match(await p.locator('#wpReadinessError').innerText(),/prerequisite|dependenc/i);await noWrites(run,incomingBefore);await cancel(p);
    await edit(p,'a');assert.equal(await prerequisite(p,'b').isChecked(),true);await p.locator('#fProject').selectOption('east');
    assert.equal(await prerequisite(p,'b').isChecked(),true,'Changing project retains the invalid link for explicit removal');
    const unmodified=await snapshot(p);await p.locator('#itemSave').click();assert.equal(await p.locator('#itemModal').isVisible(),true);assert.match(await p.locator('#wpReadinessError').innerText(),/project|invalid/i);await noWrites(run,unmodified);
    await prerequisite(p,'b').uncheck();await prerequisite(p,'east').check();await save(p);
    const moved=(await records(p)).find(i=>i.id==='a');assert.equal(moved.project,'east');assert.deepEqual(moved.prerequisiteIds,['east']);
    await p.locator('#projSelect').selectOption('east');await expectReady(p,'a',true);await noWrites(run);
   }finally{await run.close();}
  });
  await check('WP1 editing and persistence: original Add, required title, multiple prerequisites, notes, history, reload and escaped multiline presentation',async()=>{
   const items=[wp('one',{wstatus:'completed',constraints:'Relevant prerequisite note'}),wp('two',{done:true})];
   const run=await entry(env,items),p=run.page,notes='Hold point <img src=x onerror="window.wp1Injected=true">\nConfirm access with site supervisor';
   try{
    const original=await snapshot(p);await p.locator('[data-add="workPackages"]').click();await opened(p);await p.locator('#itemSave').click();assert.equal(await p.locator('#itemModal').isVisible(),true);await noWrites(run,original);
    await p.locator('#fMain').fill('Package added');await p.locator('#fMaterialsStatus').selectOption('available');await prerequisite(p,'one').check();await prerequisite(p,'two').check();await p.locator('#fWPConstraints').fill(notes);await p.locator('#fPct').fill('35');await save(p);
    await expectReady(p,'added',true);const saved=(await records(p)).find(i=>i.main==='Package added');assert.ok(saved.id);assert.equal(saved.materialsStatus,'available');assert.deepEqual(saved.prerequisiteIds,['one','two']);assert.equal(saved.constraints,notes);assert.equal(saved.pct,35);
    const after=await snapshot(p);for(const key of ['materialsStatus','prerequisiteIds','constraints'])assert.deepEqual(after.state.history[saved.id][key],saved[key],key+' retained in existing history');
    assert.deepEqual(JSON.parse(after.storage.offaly_ops_v1).panels.workPackages,after.state.panels.workPackages);assert.equal(after.sync.dirty,true);
    assert.equal(await row(p,'added').locator('img').count(),0);assert.equal(await p.evaluate(()=>window.wp1Injected),undefined);assert.ok((await row(p,'added').innerText()).includes(notes));
    assert.match(await row(p,'added').innerText(),/Relevant prerequisite note/);assert.ok(await row(p,'added').locator('.wp-constraints').first().evaluate(e=>['pre-wrap','pre-line','break-spaces'].includes(getComputedStyle(e).whiteSpace)));
    for(const [pid,rows] of Object.entries(original.state.panels))if(pid!=='workPackages')assert.deepEqual(after.state.panels[pid],rows);
    await p.reload();await ready(p);assert.deepEqual((await records(p)).find(i=>i.id===saved.id),saved);await expectReady(p,'added',true);
    await edit(p,saved.id);await p.locator('#fWPConstraints').fill('Changed note only');await save(p);await expectReady(p,'added',true);await edit(p,saved.id);await p.locator('#fMaterialsStatus').selectOption('unavailable');await save(p);await expectReady(p,'added',false);await noWrites(run);
   }finally{await run.close();}
  });
  await check('WP1 backup and publishing: complete export/import round-trip and original intercepted publication preserve new and legacy fields',async()=>{
   const items=[wp('prerequisite',{wstatus:'completed'}),wp('saved',{materialsStatus:'available',prerequisiteIds:['prerequisite'],constraints:'Line one\nLine two',futureField:{keep:true}}),wp('legacy')];
   const run=await entry(env,items,{token:true}),p=run.page;
   try{
    await edit(p,'saved');await save(p);const backup=await exported(p);await edit(p,'saved');await p.locator('#fWPConstraints').fill('Temporary edit');await save(p);
    await restore(p,backup);assert.deepEqual((await snapshot(p)).state,backup);assert.deepEqual(await exported(p),backup);await expectReady(p,'saved',true);await expectReady(p,'legacy',false);await noWrites(run);
    await p.reload();await ready(p);assert.deepEqual((await snapshot(p)).state,backup);const expected=await p.evaluate(()=>__opsTest.shareableState());
    if(!await p.locator('#btnPublish').isVisible())await p.locator('#headerMenu summary').click();await p.locator('#btnPublish').click();await p.waitForFunction(()=>!__opsTest.sync.busy&&!__opsTest.sync.dirty);
    assert.equal(run.network.writes.length,1);const write=run.network.writes[0];assert.match(write.url,/regression-fixture\/test-board\/contents\/data.json/);assert.equal(write.body.branch,'test-only');assert.deepEqual(JSON.parse(Buffer.from(write.body.content,'base64').toString()),expected);assert.deepEqual(run.network.errors,[]);
   }finally{await run.close();}
  });
  await check('WP1 Site and Client filtering: restricted/retired prerequisite details never leak, permitted notes remain and controls stay read-only',async()=>{
   const items=[wp('public',{materialsStatus:'available',prerequisiteIds:['allowed','secret','retired'],constraints:'Public hold-up'}),
    wp('public-blocked',{materialsStatus:'available',prerequisiteIds:['secret-active']}),wp('secret-active',{constraints:'SECRET ACTIVE NOTE',vis:{site:false,client:false}}),
    wp('allowed',{wstatus:'completed',constraints:'Permitted prerequisite note'}),wp('secret',{wstatus:'completed',constraints:'SECRET NOTE',vis:{site:false,client:false}}),
    wp('retired',{wstatus:'completed',resolvedAt:'2026-10-10T00:00:00Z',constraints:'RETIRED NOTE'}),wp('east',{project:'east',constraints:'EAST NOTE'})];
   for(const role of ['crew=test-site','view=test-client-0']){
    const run=await entry(env,items,{audience:'?ui=workspaces&workspace=operations&workspaceProject=default&'+role}),p=run.page;
    try{const before=await snapshot(p);await expectReady(p,'public',true);await expectReady(p,'public-blocked',false);assert.match(await row(p,'public-blocked').locator('.wp-reasons').innerText(),/prerequisite.*incomplete|prerequisite.*validat/i);const text=await p.locator('#panelsGrid').innerText();for(const hidden of ['Package secret','SECRET NOTE','Package secret-active','SECRET ACTIVE NOTE','Package retired','RETIRED NOTE','Package east','EAST NOTE'])assert.ok(!text.includes(hidden),hidden+' hidden');assert.match(await row(p,'public').innerText(),/Public hold-up/);assert.match(await row(p,'public').innerText(),/Permitted prerequisite note/);assert.equal(await p.locator('[data-edit]:visible,[data-add]:visible').count(),0);await noWrites(run,before);}finally{await run.close();}
   }
   const data=board(items);data.panelVis.workPackages={site:false,client:false};const hidden=await open(env,{data,audience:'?ui=workspaces&workspace=operations&crew=test-site'});
   try{assert.equal(await hidden.page.locator('[data-card="workPackages"]').count(),0);assert.ok(!(await hidden.page.locator('#panelsGrid').innerText()).includes('Public hold-up'));await noWrites(hidden);}finally{await hidden.close();}
  });
  await check('WP1 touch/keyboard and Original board: one form, responsive fields, cancel without writes, all 21 panels retained',async()=>{
   for(const [width,height] of [[768,1024],[390,844]]){
    const run=await entry(env,[wp('target',{materialsStatus:'available'}),wp('dependency',{wstatus:'completed'})],{width,height,touch:true}),p=run.page;
    try{
     const before=await snapshot(p);await edit(p,'target');await p.locator('#fWPConstraints').fill('Unsaved note');await prerequisite(p,'dependency').check();
     assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);assert.equal(await p.locator('#itemSave').isVisible(),true);assert.equal(await p.locator('#fMaterialsStatus').isVisible(),true);assert.equal(await p.locator('#fWPConstraints').isVisible(),true);
     await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.getElementById('itemModal').classList.contains('open'));await noWrites(run,before);
     await p.locator('#wsOriginal').evaluate(e=>e.click());await p.waitForFunction(()=>!document.body.classList.contains('ws-enabled'));assert.equal(await p.locator('[data-card]').count(),21);await edit(p,'target');await p.locator('#fMaterialsStatus').selectOption('not-required');await save(p);await expectReady(p,'target',true);await noWrites(run);
    }finally{await run.close();}
   }
  });
  }
 }finally{
  const browserVersion=env.browser.version();await env.close();const directory=path.join(output,'work-package-readiness');fs.mkdirSync(directory,{recursive:true});
  const inputsUnchanged=JSON.stringify(sourceHashes)===JSON.stringify(hashes());
  const report={commit,endCommit:git(['rev-parse','HEAD']),worktreeClean:!git(['status','--porcelain']),startedAt,completedAt:new Date().toISOString(),engine:env.engine,browserVersion,mode:fast?'FAST':'FOCUSED',sourceHashes,inputsUnchanged,tests:results,passed:results.filter(t=>t.status==='PASS').length,failed:results.filter(t=>t.status==='FAIL').length};
  fs.writeFileSync(path.join(directory,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed,inputsUnchanged}));if(report.failed||!inputsUnchanged)process.exitCode=1;
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
