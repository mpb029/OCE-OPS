// G2: narrow checks of Overview entry points to the original Add workflow.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {root,output,start,open}=require('./harness.cjs');
const fixture=require('./workspace-fixture.cjs');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const commit=git(['rev-parse','HEAD']),startedAt=new Date().toISOString();
const inputFiles=['index.html','ui-overview.js','ui-overview.css','ui-workspaces.js','ui-workspaces.css','ui-forms.js','ui-forms.css','tests/harness.cjs','tests/workspace-fixture.cjs','tests/overview-record-source.cjs','tests/overview-quick-add-source.cjs','tests/overview-quick-add.cjs'];
const inputHashes=()=>Object.fromEntries(inputFiles.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
const sourceHashes=inputHashes();
const actions={dailyWorks:'New Daily Work',upcoming:'New Scheduled Work',issuesDelays:'New Issue / Delay'};
const snapshot=p=>p.evaluate(()=>({state:structuredClone(__opsTest.state),storage:{...localStorage},sync:{...__opsTest.sync}}));
const button=(p,pid)=>p.locator(`[data-ov-add="${pid}"]`);
const entry=(env,options={})=>open(env,{data:fixture(),...options,audience:options.audience||'?ui=workspaces&workspace=overview&workspaceProject=default'});
const form=p=>p.locator('#itemModal').evaluate(modal=>({title:modal.querySelector('#itemModalTitle').textContent,fields:[...modal.querySelectorAll('input,select,textarea')].map(e=>({id:e.id,extra:e.dataset.fx,type:e.type,value:e.value,checked:e.checked,disabled:e.disabled,required:e.required,visible:!!e.getClientRects().length,options:e.options?[...e.options].map(o=>[o.value,o.text]):undefined}))}));
async function ready(p){await p.waitForFunction(()=>document.body.classList.contains('d-forms-enabled')&&document.querySelectorAll('[data-ov-add]').length===3);}
async function opened(p){await p.waitForFunction(()=>document.getElementById('itemModal').classList.contains('open')&&document.activeElement===document.getElementById('fMain'));}
async function cancel(p){await p.locator('#itemModal [data-close]').click();await p.waitForFunction(()=>!document.getElementById('itemModal').classList.contains('open'));}
async function noWrites(run,before){assert.deepEqual(await snapshot(run.page),before);assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);}
const results=[];
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}catch(error){results.push({name,status:'FAIL',error:error.stack});console.error('FAIL '+name+': '+error.message);}}
(async()=>{
 const env=await start();
 try{
  await check('G2 original forms: three labelled actions open the same controls and defaults without writes',async()=>{
   const run=await entry(env),p=run.page;
   try{
    await ready(p);const before=await snapshot(p);await p.evaluate(()=>{window.__g2Modal=document.getElementById('itemModal');window.__g2Main=document.getElementById('fMain');});
    for(const [pid,label] of Object.entries(actions)){
     assert.equal(await button(p,pid).innerText(),label);await button(p,pid).click();await opened(p);const quick=await form(p);
     assert.equal(await p.locator('#fProject').inputValue(),'default');await cancel(p);
     // Original panel remains mounted, with its original Add listener.
     await p.locator(`[data-card="${pid}"] [data-add="${pid}"]`).evaluate(el=>el.click());await opened(p);
     assert.deepEqual(await form(p),quick);assert.ok(await p.evaluate(()=>__g2Modal===document.getElementById('itemModal')&&__g2Main===document.getElementById('fMain')));await cancel(p);
    }
    await noWrites(run,before);
   }finally{await run.close();}
  });
  await check('G2 project context: East and All Projects retain original project-default rules',async()=>{
   const run=await entry(env),p=run.page;
   try{
    await ready(p);
    for(const selected of ['east','all']){
     await p.locator('#projSelect').selectOption(selected);await p.waitForFunction(value=>__opsTest.currentProject===value,selected);await ready(p);const before=await snapshot(p);
     for(const pid of Object.keys(actions)){
      await button(p,pid).click();await opened(p);assert.equal(await p.locator('#fProject').inputValue(),selected==='all'?'default':'east');assert.equal(await p.locator('#projSelect').inputValue(),selected);await cancel(p);
     }
     await noWrites(run,before);
    }
   }finally{await run.close();}
  });
  await check('G2 Save: existing required-title validation, record creation, history and local persistence; no publishing',async()=>{
   const run=await entry(env,{audience:'?ui=workspaces&workspace=overview&workspaceProject=east',token:true}),p=run.page;
   try{
    await ready(p);const original=await snapshot(p);const saved=[];
    for(const pid of Object.keys(actions)){
     await button(p,pid).click();await opened(p);const before=await snapshot(p);await p.locator('#itemSave').click();
     assert.equal(await p.locator('#itemModal').evaluate(e=>e.classList.contains('open')),true);assert.equal(await p.locator('#fMain').evaluate(e=>e===document.activeElement),true);await noWrites(run,before);
     const title='G2 synthetic '+pid;await p.locator('#fMain').fill(title);await p.locator('#fSub').fill('Entered through the original form');await p.locator('#itemSave').click();
     await p.waitForFunction(({pid,title})=>!document.getElementById('itemModal').classList.contains('open')&&__opsTest.state.panels[pid].some(i=>i.main===title),{pid,title});
     const after=await snapshot(p),item=after.state.panels[pid].find(i=>i.main===title);assert.equal(item.project,'east');assert.equal(item.sub,'Entered through the original form');assert.equal(after.state.panels[pid].length,before.state.panels[pid].length+1);
     assert.equal(after.state.history[item.id].title,title);assert.deepEqual(JSON.parse(after.storage.offaly_ops_v1).panels[pid],after.state.panels[pid]);assert.equal(after.sync.dirty,true);assert.equal(run.network.writes.length,0);saved.push([pid,item.id,title]);
    }
    const after=await snapshot(p);for(const pid of Object.keys(original.state.panels).filter(pid=>!actions[pid]))assert.deepEqual(after.state.panels[pid],original.state.panels[pid]);
    await p.reload();await ready(p);
    for(const [pid,id,title] of saved){assert.equal(await p.evaluate(({pid,id})=>__opsTest.state.panels[pid].find(i=>i.id===id).main,{pid,id}),title);}
    assert.equal(await p.locator('#projSelect').inputValue(),'east');assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
   }finally{await run.close();}
  });
  await check('G2 Cancel and Escape: unsaved entries leave board, storage, sync and route unchanged',async()=>{
   const run=await entry(env),p=run.page;
   try{
    await ready(p);const before=await snapshot(p),url=p.url();
    for(const pid of Object.keys(actions)){
     await button(p,pid).click();await opened(p);await p.locator('#fMain').fill('Discarded synthetic entry');await cancel(p);
     await button(p,pid).click();await opened(p);assert.equal(await p.locator('#fMain').inputValue(),'');await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.getElementById('itemModal').classList.contains('open'));
    }
    assert.equal(p.url(),url);await noWrites(run,before);
   }finally{await run.close();}
  });
  await check('G2 permissions: Site and both Client views expose no Quick Add actions or editing entry points',async()=>{
   for(const audience of ['crew=test-site','view=test-client-0','view=test-client-1']){
    const run=await entry(env,{audience:'?ui=workspaces&workspace=overview&'+audience}),p=run.page;
    try{
     await p.waitForFunction(()=>document.querySelector('#wsOverview .ov-card'));const before=await snapshot(p);
     assert.equal(await p.locator('[data-ov-add]').count(),0);assert.equal(await p.locator('[data-add]:visible').count(),0);assert.equal(await p.locator('#itemModal').isVisible(),false);await noWrites(run,before);
    }finally{await run.close();}
   }
  });
  await check('G2 locked editor: no actions at startup; stale editor buttons fail closed after lock or audience changes',async()=>{
   const data=fixture();data.settings.editPass='test-locked-hash';const locked=await entry(env,{data});
   try{await locked.page.waitForFunction(()=>document.body.classList.contains('locked'));assert.equal(await locked.page.locator('[data-ov-add]:visible').count(),0);assert.equal(await locked.page.locator('#itemModal').isVisible(),false);assert.equal(locked.network.writes.length,0);}finally{await locked.close();}
   for(const blocked of ['locked','viewer']){
    const run=await entry(env),p=run.page;
    try{
     await ready(p);const before=await snapshot(p);
     await p.evaluate(blocked=>{const b=document.querySelector('[data-ov-add="dailyWorks"]');document.body.classList.add(blocked);b.click();},blocked);
     assert.equal(await p.locator('#itemModal').isVisible(),false);await noWrites(run,before);
    }finally{await run.close();}
   }
  });
  await check('G2 tablet and phone: touch and keyboard actions fit, preserve context and use accessible original forms',async()=>{
   for(const [width,height] of [[768,1024],[390,844]]){
   const run=await entry(env,{width,height,touch:true}),p=run.page;
   try{
    await ready(p);const before=await snapshot(p);
    // Keep the accepted B2 initial-screen hierarchy while adding these actions.
    const limit=width<681?(await p.locator('.ws-bottom').boundingBox()).y:height;
    for(const pid of Object.keys(actions)){
     const box=await p.locator(`[data-ov-count="${pid}"]`).boundingBox();assert.ok(box.y>=0&&box.y+box.height<limit,pid+' quick access above fold');assert.ok(box.height>=44);
    }
    const record=await p.locator('[data-ov-panel="dailyWorks"] .ov-record-link').first().boundingBox();assert.ok(record.y+record.height<=limit,'First Daily Works record above fold');
    for(const pid of Object.keys(actions)){
     const box=await button(p,pid).boundingBox();assert.ok(box.width>=44&&box.height>=44,'Quick Add touch target is at least 44px');await button(p,pid).tap();await opened(p);
     assert.equal(await p.locator('#fProject').inputValue(),'default');assert.equal(await p.locator('#itemSave').isVisible(),true);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);await cancel(p);
    }
    await button(p,'dailyWorks').focus();await p.keyboard.press('Enter');await opened(p);await p.keyboard.press('Escape');await noWrites(run,before);
   }finally{await run.close();}
   }
  });
  await check('G2 compatibility: empty board actions work, G1 record navigation and all original panel instances remain',async()=>{
   const data=fixture();Object.keys(data.panels).forEach(pid=>data.panels[pid]=[]);const empty=await entry(env,{data});
   try{await ready(empty.page);await button(empty.page,'dailyWorks').click();await opened(empty.page);await cancel(empty.page);assert.equal(empty.network.writes.length,0);}finally{await empty.close();}
   const run=await entry(env),p=run.page;
   try{
    await ready(p);const before=await snapshot(p);await p.evaluate(()=>window.__g2Panels=[...document.querySelectorAll('[data-card]')]);
    await button(p,'dailyWorks').click();await opened(p);await cancel(p);await p.locator('[data-ov-panel="dailyWorks"] .ov-record-link').first().click();
    await p.waitForFunction(()=>document.body.dataset.workspace==='operations'&&document.querySelector('.ws-record-target'));await p.goBack();await ready(p);
    await p.locator('#wsOriginal').click();assert.equal(await p.locator('[data-card]:visible').count(),21);assert.equal(await p.locator('[data-ov-add]').count(),0);assert.ok(await p.evaluate(()=>__g2Panels.every(e=>e===document.querySelector(`[data-card="${e.dataset.card}"]`))));await noWrites(run,before);
   }finally{await run.close();}
  });
 }finally{
  await env.close();const directory=path.join(output,'overview-quick-add');fs.mkdirSync(directory,{recursive:true});
  const inputsUnchanged=JSON.stringify(sourceHashes)===JSON.stringify(inputHashes());
  const report={commit,endCommit:git(['rev-parse','HEAD']),worktreeClean:!git(['status','--porcelain']),startedAt,completedAt:new Date().toISOString(),engine:env.engine,browserVersion:env.browser.version(),sourceHashes,inputsUnchanged,tests:results,passed:results.filter(t=>t.status==='PASS').length,failed:results.filter(t=>t.status==='FAIL').length};
  fs.writeFileSync(path.join(directory,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed,inputsUnchanged}));if(report.failed||!inputsUnchanged)process.exitCode=1;
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
