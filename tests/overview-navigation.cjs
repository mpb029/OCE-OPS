// G1: focused navigation coverage against original records and isolated data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {root,output,start,open}=require('./harness.cjs');
const fixture=require('./workspace-fixture.cjs');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const commit=git(['rev-parse','HEAD']),clean=!git(['status','--porcelain']),startedAt=new Date().toISOString();
const supported={dailyWorks:'operations',upcoming:'operations',issuesDelays:'quality',qualityTesting:'quality',punchlist:'quality',incidents:'quality'};
const state=p=>p.evaluate(()=>({state:structuredClone(__opsTest.state),storage:{...localStorage},sync:{...__opsTest.sync}}));
const read=p=>p.evaluate(()=>{let d;document.dispatchEvent(new CustomEvent('oce:overview-read',{detail:{accept:x=>d=x}}));return d;});
const entry=(env,options={})=>open(env,{data:fixture(),...options,audience:options.audience||'?ui=workspaces&workspace=overview&workspaceProject=default'});
const link=(p,panel,title)=>p.locator(`[data-ov-panel="${panel}"] .ov-record-link`).filter({hasText:title});
const row=(p,panel,title)=>p.locator(`[data-card="${panel}"] .list > li`).filter({hasText:title});
async function noWrites(run,before){assert.deepEqual(await state(run.page),before);assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);}
async function selected(p,handle,panel,id){
 await p.waitForFunction(({panel,id})=>document.body.dataset.workspace===panel&&new URL(location.href).searchParams.get('workspaceRecord')===id,{panel:supported[panel],id});
 await p.waitForFunction(el=>el.isConnected&&document.activeElement===el&&el.classList.contains('ws-record-target'),handle);
 assert.equal(await p.locator('.ws-record-target').count(),1);
 assert.ok(await handle.evaluate(el=>el.closest('[data-card]')?.dataset.card===new URL(location.href).hash.slice(10)));
 await p.waitForFunction(el=>{const r=el.getBoundingClientRect(),bar=document.querySelector('.fo-navigation'),head=el.closest('[data-card]').querySelector('.card-head'),bottom=document.querySelector('.ws-bottom');const min=Math.max(bar?.getClientRects().length?bar.getBoundingClientRect().bottom:0,head?.getClientRects().length?head.getBoundingClientRect().bottom:0);const max=bottom?.getClientRects().length?bottom.getBoundingClientRect().top:innerHeight;return r.top>=min-2&&r.top<max-20;},handle);
}
async function oldLink(p,href){await p.evaluate(href=>{const a=document.createElement('a');a.href=href;a.id='testSavedRecordLink';a.textContent='Saved record link';document.body.append(a);},href);await p.locator('#testSavedRecordLink').click();}
const results=[];
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}catch(error){results.push({name,status:'FAIL',error:error.stack});console.error('FAIL '+name+': '+error.message);}}
(async()=>{
 const env=await start();
 try{
  await check('G1 adapter: original identifiers, permitted records and detached read-only data',async()=>{
   const run=await entry(env);const p=run.page;
   try{
    const before=await state(p),dto=await read(p);
    for(const panel of dto.panels){
     const ids=await p.evaluate(pid=>__opsTest.sortItemsForDisplay(__opsTest.visiblePanelItems(pid)).filter(i=>!i.done&&!['completed','cancelled'].includes(i.wstatus)).map(i=>String(i.id??'')),panel.id);
     assert.deepEqual(panel.items.map(i=>i.id),ids);
     const links=await p.locator(`[data-ov-panel="${panel.id}"] .ov-record-link`).evaluateAll(es=>es.map(e=>({href:e.href,record:e.dataset.wsRecord})));
     assert.deepEqual(links.map(a=>new URL(a.href).searchParams.get('workspaceRecord')),ids.slice(0,3));
     assert.ok(links.every(a=>new URL(a.href).hash==='#activity-'+panel.id));
    }
    await p.evaluate(()=>document.dispatchEvent(new CustomEvent('oce:overview-read',{detail:{accept:d=>d.panels[0].items[0].id='MUTATED'}})));
    assert.deepEqual(await read(p),dto);await noWrites(run,before);
   }finally{await run.close();}
  });
  await check('G1 desktop: all six record types focus original DOM and correct workspace without writes',async()=>{
   const data=fixture(),run=await entry(env,{data});const p=run.page;
   try{
    const before=await state(p);await p.evaluate(()=>{window.__g1Cards=[...document.querySelectorAll('[data-card]')];window.__g1Map=__opsTest.map;window.__g1Three=__opsTest.three;});
    for(const panel of Object.keys(supported)){
     const item=data.panels[panel][0],original=await row(p,panel,item.main).elementHandle();
     await link(p,panel,item.main).click();await selected(p,original,panel,item.id);
     assert.ok(await p.evaluate(()=>__g1Cards.every(e=>e===document.querySelector(`[data-card="${e.dataset.card}"]`))&&__g1Map===__opsTest.map&&__g1Three===__opsTest.three));
     assert.equal(await p.locator(`[data-edit="${panel}:${item.id}"]`).isVisible(),true);
     assert.equal(await p.locator('#projSelect').inputValue(),'default');await noWrites(run,before);
     await p.goBack();await p.waitForFunction(()=>document.body.dataset.workspace==='overview');
    }
   }finally{await run.close();}
  });
  await check('G1 keyboard: Enter reveals collapsed panel, preserves form handler and transient highlight',async()=>{
   const data=fixture(),run=await entry(env,{data});const p=run.page;
   try{
    const item=data.panels.dailyWorks[0];await link(p,'dailyWorks',item.main).click();
    await p.locator('[data-card="dailyWorks"] .fo-collapse').click();
    assert.equal(await p.locator('[data-card="dailyWorks"]').getAttribute('data-fo-collapsed'),'');
    await p.goBack();await p.waitForFunction(()=>document.body.dataset.workspace==='overview');const before=await state(p);
    const a=link(p,'dailyWorks',item.main),original=await row(p,'dailyWorks',item.main).elementHandle();await a.focus();await p.keyboard.press('Enter');
    await selected(p,original,'dailyWorks',item.id);assert.equal(await p.locator('[data-card="dailyWorks"]').getAttribute('data-fo-collapsed'),null);
    await p.waitForFunction(()=>!document.querySelector('.ws-record-target'));assert.ok(await original.evaluate(el=>document.activeElement===el));
    await p.locator(`[data-edit="dailyWorks:${item.id}"]`).click();await p.locator('#itemModal').waitFor({state:'visible'});assert.equal(await p.locator('#fMain').inputValue(),item.main);
    await p.locator('#itemModal [data-close]').click();await noWrites(run,before);
   }finally{await run.close();}
  });
  for(const [name,width,height] of [['portrait tablet',768,1024],['phone',390,844]])await check(`G1 ${name}: touch record navigation clears fixed bars and preserves project and data`,async()=>{
   const data=fixture(),run=await entry(env,{data,width,height,touch:true});const p=run.page;
   try{
    const before=await state(p),item=data.panels.dailyWorks[1],original=await row(p,'dailyWorks',item.main).elementHandle();
    await link(p,'dailyWorks',item.main).tap();await selected(p,original,'dailyWorks',item.id);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);assert.equal(await p.locator('#projSelect').inputValue(),'default');await noWrites(run,before);
   }finally{await run.close();}
  });
  await check('G1 URL: encoded original IDs, reload and browser history preserve audience and target',async()=>{
   const data=fixture(),id='crew/client/view ?#& + unicode-\u03b1';data.panels.dailyWorks[0].id=id;
   const run=await entry(env,{data});const p=run.page;
   try{
    const item=data.panels.dailyWorks[0],before=await state(p);await link(p,'dailyWorks',item.main).click();
    assert.equal(new URL(p.url()).searchParams.get('workspaceRecord'),id);assert.equal(new URL(p.url()).hash,'#activity-dailyWorks');
    await p.reload();await p.waitForFunction(()=>__opsTest.ready&&document.querySelector('.ws-record-target'));
    assert.equal(await p.evaluate(()=>__opsTest.sync.audience),'editor');assert.equal(await p.locator('body').getAttribute('data-workspace'),'operations');assert.equal(await row(p,'dailyWorks',item.main).evaluate(e=>e.classList.contains('ws-record-target')),true);
    await p.goBack();await p.waitForFunction(()=>document.body.dataset.workspace==='overview');await p.goForward();await p.waitForFunction(()=>document.body.dataset.workspace==='operations');
    assert.equal(new URL(p.url()).searchParams.get('workspaceRecord'),id);await noWrites(run,before);
   }finally{await run.close();}
  });
  await check('G1 project context: selection removes stale links and record routes cannot bypass scope',async()=>{
   const data=fixture(),run=await entry(env,{data});const p=run.page;
   try{
    const href=await link(p,'dailyWorks',data.panels.dailyWorks[0].main).getAttribute('href');await p.locator('#projSelect').selectOption('east');
    await p.waitForFunction(()=>document.querySelector('[data-ov-panel="dailyWorks"]').textContent.includes('Drainage set out'));
    assert.equal(await link(p,'dailyWorks',data.panels.dailyWorks[0].main).count(),0);
    const stale=new URL(href);stale.searchParams.set('workspaceProject','east');const before=await state(p);await oldLink(p,stale.href);
    await p.waitForFunction(()=>document.body.dataset.workspace==='operations');assert.equal(await p.locator('#projSelect').inputValue(),'east');
    assert.equal(await p.locator('.ws-record-target').count(),0);assert.equal(await row(p,'dailyWorks',data.panels.dailyWorks[0].main).count(),0);assert.equal(await row(p,'dailyWorks',data.panels.dailyWorks[2].main).count(),1);
    // Route focus is applied in requestAnimationFrame after the workspace becomes visible.
    await p.waitForFunction(()=>document.activeElement===document.getElementById('activity-dailyWorks'));
    assert.equal(await p.locator('#activity-dailyWorks').evaluate(e=>document.activeElement===e),true);await noWrites(run,before);
   }finally{await run.close();}
  });
  await check('G1 audience: Site and both Clients expose only permitted links and original read-only rows',async()=>{
   const data=fixture();data.panels.dailyWorks.push({id:'private',project:'default',main:'RESTRICTED RECORD',vis:{site:false,client:false}});
   for(const audience of ['crew=test-site','view=test-client-0','view=test-client-1']){
    const run=await entry(env,{data,audience:'?ui=workspaces&workspace=overview&'+audience});const p=run.page;
    try{
     const before=await state(p),dto=await read(p);assert.doesNotMatch(await p.locator('#wsOverview').textContent(),/RESTRICTED RECORD/);
     for(const panel of dto.panels){const allowed=await p.evaluate(pid=>__opsTest.visiblePanelItems(pid).map(i=>String(i.id)),panel.id);assert.ok(panel.items.every(i=>allowed.includes(i.id)));}
     const panel=dto.panels.find(x=>x.id==='dailyWorks'),item=panel.items[0],original=await row(p,'dailyWorks',item.title).elementHandle();
     await link(p,'dailyWorks',item.title).click();await selected(p,original,'dailyWorks',item.id);
     // Original panel Add buttons remain in DOM but the audience CSS hides them.
     assert.equal(await p.locator('[data-edit]').count(),0);assert.equal(await p.locator('[data-add]:visible').count(),0);assert.equal(new URL(p.url()).searchParams.get(audience.split('=')[0]),audience.split('=')[1]);await noWrites(run,before);
    }finally{await run.close();}
   }
  });
  await check('G1 unavailable records: deleted, hidden item and hidden panel links fail closed',async()=>{
   const data=fixture(),item=data.panels.dailyWorks[0],run=await entry(env,{data});const p=run.page;
   try{
    const href=await link(p,'dailyWorks',item.main).getAttribute('href');await link(p,'dailyWorks',item.main).click();
    p.once('dialog',dialog=>dialog.accept());await p.locator(`[data-del="dailyWorks:${item.id}"]`).click();await p.waitForFunction(id=>!__opsTest.state.panels.dailyWorks.some(x=>x.id===id),item.id);
    const before=await state(p);await oldLink(p,href);await p.waitForFunction(()=>document.activeElement===document.getElementById('activity-dailyWorks'));
    assert.equal(await p.locator('.ws-record-target').count(),0);assert.equal(await row(p,'dailyWorks',item.main).count(),0);await noWrites(run,before);
   }finally{await run.close();}
   for(const [panel,id] of [['dailyWorks','demo-daily-2'],['incidents','demo-incidents']]){
    const denied=await entry(env,{data:fixture(),audience:`?ui=workspaces&workspace=overview&view=test-client-0&workspaceRecord=${id}#activity-${panel}`});
    try{
     const q=denied.page;assert.equal(await q.locator('.ws-record-target').count(),0);assert.equal(await row(q,panel, panel==='dailyWorks'?'Prepare bedding':'Minor equipment damage').count(),0);
     assert.equal(await q.locator('[data-edit]').count(),0);assert.equal(await q.locator('[data-add]:visible').count(),0);if(panel==='dailyWorks')assert.equal(await q.locator('#activity-dailyWorks').isVisible(),true);else assert.equal(await q.locator('[data-card="incidents"]').count(),0);
     assert.equal(denied.network.writes.length,0);assert.deepEqual(denied.network.errors,[]);
    }finally{await denied.close();}
   }
  });
  await check('G1 compatibility: empty data, legacy panel anchors, Original board and all 21 instances retained',async()=>{
   const data=fixture(),run=await entry(env,{data});const p=run.page;
   try{
    const before=await state(p);await p.evaluate(()=>window.__g1Cards=[...document.querySelectorAll('[data-card]')]);
    await link(p,'dailyWorks',data.panels.dailyWorks[0].main).click();await p.locator('#wsOriginal').click();
    assert.equal(await p.locator('[data-card]:visible').count(),21);assert.equal(await p.locator('#wsOverview').textContent(),'');assert.equal(new URL(p.url()).searchParams.has('workspaceRecord'),false);
    assert.ok(await p.evaluate(()=>__g1Cards.every(e=>e===document.querySelector(`[data-card="${e.dataset.card}"]`))));await noWrites(run,before);
   }finally{await run.close();}
   const legacy=await entry(env,{audience:'?ui=workspaces#activity-upcoming'});
   try{assert.equal(await legacy.page.locator('body').getAttribute('data-workspace'),'operations');assert.equal(await legacy.page.locator('.ws-record-target').count(),0);assert.equal(legacy.network.writes.length,0);}finally{await legacy.close();}
   const empty=fixture();Object.keys(empty.panels).forEach(pid=>empty.panels[pid]=[]);const blank=await entry(env,{data:empty});
   try{assert.equal(await blank.page.locator('.ov-record-link').count(),0);assert.match(await blank.page.locator('[data-ov-panel="dailyWorks"]').innerText(),/No active records/);assert.deepEqual(blank.network.errors,[]);}finally{await blank.close();}
  });
 }finally{
  await env.close();const directory=path.join(output,'overview-navigation');fs.mkdirSync(directory,{recursive:true});
  const report={commit,endCommit:git(['rev-parse','HEAD']),worktreeClean:clean&&!git(['status','--porcelain']),startedAt,completedAt:new Date().toISOString(),engine:env.engine,browserVersion:env.browser.version(),fullRun:true,tests:results,passed:results.filter(t=>t.status==='PASS').length,failed:results.filter(t=>t.status==='FAIL').length};
  fs.writeFileSync(path.join(directory,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
