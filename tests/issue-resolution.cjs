// Narrow Issues and Delays checks: original forms, synthetic data, intercepted publishing.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const {root,output,start,open}=require('./harness.cjs');
const fixture=require('./workspace-fixture.cjs');
const fast=process.argv.includes('--fast'),results=[],startedAt=new Date().toISOString();
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const commit=git(['rev-parse','HEAD']);
const inputFiles=['index.html','ui-forms.js','ui-forms.css','ui-overview.js','ui-workspaces.js','tests/harness.cjs','tests/workspace-fixture.cjs','tests/issue-resolution.cjs'];
const digest=file=>createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const hashes=()=>Object.fromEntries(inputFiles.map(file=>[file,digest(file)]));
const sourceHashes=hashes(),operationalHash=digest('data.json');
const owners=['Site','Engineering','Client','Supplier'];
const detail='Confirm service depth <not approved> & access.\nAwait the recorded survey response.';
const issue=(id,fields={})=>({id,main:'Issue '+id,sub:'Retained mitigation',project:'default',vis:{site:true,client:true},...fields});
const board=items=>{const data=fixture();data.panels.issuesDelays=items;data.panelVis.issuesDelays={site:true,client:true};return data;};
const snapshot=p=>p.evaluate(()=>({state:structuredClone(__opsTest.state),storage:{...localStorage},sync:{...__opsTest.sync}}));
const records=p=>p.evaluate(()=>structuredClone(__opsTest.state.panels.issuesDelays));
const fx=(p,key)=>p.locator('#fldExtras [data-fx="'+key+'"]');
const panel=p=>p.locator('[data-card="issuesDelays"]');
const row=(p,id)=>panel(p).locator('.card-body > .list > li').filter({has:p.locator('.main').filter({hasText:new RegExp('^Issue '+id+'$')})});
async function entry(env,items,options={}){const run=await open(env,{data:board(items),audience:'?ui=workspaces&workspace=quality&workspaceProject=default',...options});return run;}
async function opened(p){await p.waitForFunction(()=>document.getElementById('itemModal').classList.contains('open')&&document.activeElement===document.getElementById('fMain'));}
async function edit(p,id){await p.locator('[data-edit="issuesDelays:'+id+'"]').click();await opened(p);}
async function add(p){await p.locator('[data-add="issuesDelays"]').click();await opened(p);}
async function save(p){await p.locator('#itemSave').click();await p.waitForFunction(()=>!document.getElementById('itemModal').classList.contains('open'));}
async function cancel(p){await p.locator('#itemModal [data-close]').click();await p.waitForFunction(()=>!document.getElementById('itemModal').classList.contains('open'));}
async function noWrites(run,before){if(before)assert.deepEqual(await snapshot(run.page),before);assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);}
async function exported(p){if(!await p.locator('#btnExport').isVisible())await p.locator('#headerMenu summary').click();const pending=p.waitForEvent('download');await p.locator('#btnExport').click();return JSON.parse(fs.readFileSync(await(await pending).path(),'utf8'));}
async function restore(p,data){await p.locator('#fileImport').setInputFiles({name:'issues-synthetic-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});const pending=p.waitForEvent('download');await p.locator('#importBackup').click();await pending;await p.locator('#importBackupSaved').check();await p.locator('#importConfirm').click();await p.waitForFunction(()=>!document.getElementById('importModal').classList.contains('open'));}
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}catch(error){results.push({name,status:'FAIL',error:error.stack});console.error('FAIL '+name+': '+error.stack);}}

(async()=>{
 const env=await start();
 try{
  await check('Issues: original Add supports four resolution owners, multiline details and dates; Save/reload retain values without publishing',async()=>{
   const run=await entry(env,[]),p=run.page;
   try{
    const before=await snapshot(p);assert.match(await panel(p).locator('.card-head').innerText(),/Issues and Delays/);
    await add(p);const empty=await snapshot(p);await p.locator('#itemSave').click();assert.ok(await p.locator('#itemModal').isVisible());await noWrites(run,empty);
    assert.equal(await fx(p,'resolutionOwner').inputValue(),'');assert.equal(await fx(p,'dateRaised').inputValue(),'');assert.equal(await p.locator('#fRequired').inputValue(),'');
    assert.deepEqual(await fx(p,'resolutionOwner').locator('option').evaluateAll(options=>options.map(o=>o.value)),['',...owners]);
    await p.locator('#fMain').fill('Issue new');await p.locator('#fSub').fill('Keep mitigation distinct');await fx(p,'detail').fill(detail);await fx(p,'dateRaised').fill('2026-10-20');
    await p.locator('#tglRequired').check();await p.locator('#fRequired').fill('2026-10-29');await fx(p,'resolutionOwner').selectOption('Site');await save(p);
    let saved=(await records(p))[0];assert.equal(saved.dateRequired,'2026-10-29');assert.equal(saved.project,'default');assert.deepEqual(saved.x,{detail,resolutionOwner:'Site',dateRaised:'2026-10-20'});
    const id=saved.id;assert.ok(id);assert.equal(await row(p,'new').locator('.fb-v').filter({hasText:detail}).textContent(),detail);assert.equal(await row(p,'new').locator('not').count(),0);
    for(const owner of owners.slice(1)){await edit(p,id);await fx(p,'resolutionOwner').selectOption(owner);await save(p);assert.equal((await records(p))[0].x.resolutionOwner,owner);}
    const after=await snapshot(p);assert.deepEqual(JSON.parse(after.storage.offaly_ops_v1).panels.issuesDelays,after.state.panels.issuesDelays);
    assert.match(after.state.history[id].detail,/Resolution responsibility: Supplier/);assert.match(after.state.history[id].detail,/Date raised \/ identified: 2026-10-20/);
    for(const pid of Object.keys(before.state.panels).filter(pid=>pid!=='issuesDelays'))assert.deepEqual(after.state.panels[pid],before.state.panels[pid]);
    await p.reload();await p.waitForFunction(()=>window.__opsTest?.ready);saved=(await records(p))[0];assert.equal(saved.id,id);assert.equal(saved.x.detail,detail);assert.equal(saved.x.resolutionOwner,'Supplier');assert.equal(saved.dateRequired,'2026-10-29');await noWrites(run);
   }finally{await run.close();}
  });
  await check('Issues: legacy mitigation, deadline and unknown fields survive edits; clearing and Cancel are explicit',async()=>{
   const legacy=issue('legacy',{team:'eng',dateAssigned:'2026-10-19',dateRequired:'2026-10-30',wstatus:'inprogress',x:{futureExtension:{reference:'retain'}},futureRecord:{version:2}});
   const run=await entry(env,[legacy]),p=run.page;
   try{
    const initial=await snapshot(p);await edit(p,'legacy');assert.equal(await p.locator('#fSub').inputValue(),legacy.sub);assert.equal(await p.locator('#fRequired').inputValue(),legacy.dateRequired);assert.equal(await fx(p,'detail').inputValue(),'');assert.equal(await fx(p,'resolutionOwner').inputValue(),'');
    await fx(p,'detail').fill('Discard this');await fx(p,'resolutionOwner').selectOption('Client');await cancel(p);await noWrites(run,initial);
    await edit(p,'legacy');await fx(p,'detail').fill(detail);await fx(p,'resolutionOwner').selectOption('Engineering');await fx(p,'dateRaised').fill('2026-10-20');await save(p);
    let saved=(await records(p))[0];for(const key of ['id','sub','team','dateAssigned','dateRequired','wstatus','futureRecord','vis'])assert.deepEqual(saved[key],legacy[key]);assert.deepEqual(saved.x.futureExtension,legacy.x.futureExtension);
    await edit(p,'legacy');await fx(p,'detail').fill('');await fx(p,'resolutionOwner').selectOption('');await fx(p,'dateRaised').fill('');await p.locator('#tglRequired').uncheck();await save(p);
    saved=(await records(p))[0];assert.deepEqual(saved.x,legacy.x);assert.equal(saved.dateRequired,'');assert.equal(saved.sub,legacy.sub);await noWrites(run);
   }finally{await run.close();}
  });
  if(!fast){
   await check('Issues: existing export/import, history and intercepted publishing preserve all resolution fields',async()=>{
    const run=await entry(env,[issue('roundtrip',{dateRequired:'2026-10-29',x:{detail,resolutionOwner:'Client',dateRaised:'2026-10-20'}})],{token:true}),p=run.page;
    try{
     await edit(p,'roundtrip');await p.locator('#fSub').fill('Saved mitigation');await save(p);const backup=await exported(p);await edit(p,'roundtrip');await fx(p,'detail').fill('Transient replacement');await save(p);
     await restore(p,backup);assert.deepEqual((await records(p)),backup.panels.issuesDelays);assert.deepEqual((await snapshot(p)).state.history,backup.history);assert.equal(run.network.writes.length,0);assert.deepEqual(await exported(p),backup);
     const expected=await p.evaluate(()=>__opsTest.shareableState());await p.locator('#btnPublish').click();await p.waitForFunction(()=>!__opsTest.sync.busy&&!__opsTest.sync.dirty);
     assert.equal(run.network.writes.length,1);const write=run.network.writes[0];assert.match(write.url,/regression-fixture\/test-board\/contents\/data.json/);assert.equal(write.body.branch,'test-only');assert.deepEqual(JSON.parse(Buffer.from(write.body.content,'base64').toString()),expected);assert.deepEqual(expected.panels.issuesDelays,backup.panels.issuesDelays);assert.deepEqual(run.network.errors,[]);
    }finally{await run.close();}
   });
   await check('Issues: Site/Client and project filters hide restricted details, responsibilities and dates',async()=>{
    const items=[issue('allowed',{x:{detail:'ALLOWED_DETAIL',resolutionOwner:'Supplier',dateRaised:'2026-10-20'}}),issue('private',{vis:{site:false,client:false},x:{detail:'PRIVATE_DETAIL',resolutionOwner:'PRIVATE_OWNER',dateRaised:'2099-12-31'}}),issue('east',{project:'east',x:{detail:'EAST_DETAIL',resolutionOwner:'Engineering',dateRaised:'2026-10-22'}})];
    for(const [audience,shown,hidden] of [['crew=test-site',['ALLOWED_DETAIL'],['PRIVATE_DETAIL','PRIVATE_OWNER','EAST_DETAIL']],['view=test-client-0',['ALLOWED_DETAIL'],['PRIVATE_DETAIL','PRIVATE_OWNER','EAST_DETAIL']],['view=test-client-1',['EAST_DETAIL'],['PRIVATE_DETAIL','PRIVATE_OWNER','ALLOWED_DETAIL']]]){
     const run=await entry(env,items,{audience:'?ui=workspaces&workspace=quality&workspaceProject='+ (audience.endsWith('-1')?'east':'default')+'&'+audience}),p=run.page;
     try{const text=await panel(p).innerText();shown.forEach(s=>assert.ok(text.includes(s)));hidden.forEach(s=>assert.ok(!text.includes(s)));assert.equal(await p.locator('[data-edit]:visible,[data-add]:visible').count(),0);await noWrites(run);}finally{await run.close();}
    }
    const data=board(items);data.panelVis.issuesDelays={site:false,client:false};const run=await entry(env,items,{data,audience:'?ui=workspaces&workspace=overview&crew=test-site'});
    try{assert.equal(await panel(run.page).isVisible(),false);const overview=await run.page.locator('#wsOverview').innerText();assert.ok(!overview.includes('Issues and Delays'));assert.ok(!overview.includes('ALLOWED_DETAIL'));await noWrites(run);}finally{await run.close();}
   });
   await check('Issues: tablet and phone forms fit, expose labelled fields and retain keyboard/Save/Cancel controls',async()=>{
    for(const [width,height] of [[768,1024],[390,844]]){
     const run=await entry(env,[],{width,height,touch:true}),p=run.page;
     try{
      await p.waitForFunction(()=>document.body.classList.contains('d-forms-enabled'));const initial=await snapshot(p);await p.locator('[data-add="issuesDelays"]').tap();await opened(p);
      for(const name of ['Details','Resolution responsibility','Date raised / identified'])assert.equal(await p.getByLabel(name,{exact:true}).count(),1,name+' accessible label');
      await p.getByLabel('Details',{exact:true}).fill('Touch form\nSecond line');await p.getByLabel('Resolution responsibility',{exact:true}).selectOption('Site');await p.locator('#tglRequired').check();await p.locator('#fRequired').fill('2026-10-29');
      assert.equal(await p.locator('#fRequired').getAttribute('aria-label'),'Resolution required by');
      const modal=await p.locator('#itemModal .modal').boundingBox(),saveBox=await p.locator('#itemSave').boundingBox();assert.ok(modal.x>=0&&modal.x+modal.width<=width+1);assert.ok(saveBox.y>=0&&saveBox.y+saveBox.height<=height+1);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
      await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.getElementById('itemModal').classList.contains('open'));await noWrites(run,initial);
      await p.locator('[data-add="issuesDelays"]').focus();await p.keyboard.press('Enter');await opened(p);await p.locator('#fMain').fill('Issue touch');await fx(p,'resolutionOwner').selectOption('Site');await save(p);assert.equal((await records(p))[0].x.resolutionOwner,'Site');await noWrites(run);
     }finally{await run.close();}
    }
   });
   await check('Issues: Overview and Original board reuse the renamed panel; completion/history and unrelated forms remain intact',async()=>{
    const run=await entry(env,[issue('navigation',{dateRequired:'2026-10-29',x:{detail,resolutionOwner:'Engineering',dateRaised:'2026-10-20'}})]),p=run.page;
    try{
     await p.locator('[data-ws-route="overview"]').first().click();await p.waitForFunction(()=>document.querySelector('[data-ov-panel="issuesDelays"]'));
     const section=p.locator('[data-ov-panel="issuesDelays"]');assert.match(await section.innerText(),/Issues and Delays/);assert.ok(!(await section.innerText()).includes('Potential Issues'));
     await section.locator('.ov-record-link').click();await p.waitForFunction(()=>document.body.dataset.workspace==='quality');await edit(p,'navigation');await p.locator('#tglWStatus').check();await p.locator('#fWStatus').selectOption('completed');await save(p);
     const saved=(await records(p))[0];assert.equal(saved.wstatus,'completed');assert.ok(saved.resolvedAt);assert.match((await snapshot(p)).state.history.navigation.detail,/Resolution responsibility: Engineering/);
     await p.locator('#wsOriginal').click();assert.equal(await p.locator('[data-card]:visible').count(),21);assert.match(await panel(p).innerText(),/Issues and Delays/);
     await p.locator('[data-add="dailyWorks"]').click();await opened(p);assert.equal(await p.locator('#fldExtras [data-fx="resolutionOwner"]').count(),0);assert.ok(!(await p.locator('#itemModal').innerText()).includes('Resolution required by'));await cancel(p);await noWrites(run);
    }finally{await run.close();}
   });
  }
 }finally{
  await env.close();const inputsUnchanged=JSON.stringify(sourceHashes)===JSON.stringify(hashes()),operationalDataUnchanged=operationalHash===digest('data.json');
  const report={commit,endCommit:git(['rev-parse','HEAD']),engine:env.engine,fast,startedAt,completedAt:new Date().toISOString(),sourceHashes,inputsUnchanged,operationalDataUnchanged,tests:results,passed:results.filter(t=>t.status==='PASS').length,failed:results.filter(t=>t.status==='FAIL').length};
  fs.writeFileSync(path.join(output,'issue-resolution-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed,inputsUnchanged,operationalDataUnchanged}));if(report.failed||!inputsUnchanged||!operationalDataUnchanged)process.exitCode=1;
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
