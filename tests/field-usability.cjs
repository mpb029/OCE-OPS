const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {root,open}=require('./harness.cjs'),fixture=require('./workspace-fixture.cjs');
const baseline='be9a80d998df2e1c08a0b73c3dc9a165f995919e';
const sizes=[['desktop',1440,900],['portrait tablet',768,1024],['landscape tablet',1024,768],['mobile',390,844]];
const routes=['operations','resources','quality','coordination'];
const snapshot=p=>p.evaluate(()=>{const payload=__opsTest.shareableState();delete payload.publishedAt;return {state:structuredClone(__opsTest.state),storage:{...localStorage},sync:{...__opsTest.sync},payload};});
async function nav(p,route){if(await p.locator('#wsMobileMenu').isVisible()&&!await p.locator('#wsSidebar').isVisible())await p.locator('#wsMobileMenu').click();await p.locator(`#wsDestinations [data-ws-route="${route}"]`).click();await p.waitForFunction(r=>document.body.dataset.workspace===r,route);}
async function ready(p){await p.waitForFunction(()=>document.body.classList.contains('fo-workspace')&&getComputedStyle(document.querySelector('.fo-navigation')).display==='flex');}
module.exports=async(env,check)=>{
await check('Field usability: exact C1 runtime, forms, spatial presentation and mandatory assertions retained',()=>{
 for(const file of ['index.html','ui-v2.js','ui-v2.css','ui-workspaces.css','ui-spatial.css','ui-overview.js','ui-overview.css','tests/regression.cjs','tests/spatial-usability.cjs','tests/overview-checks.cjs','tests/overview-refinement.cjs'])assert.equal(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n'),execFileSync('git',['show',baseline+':'+file],{cwd:root,encoding:'utf8',maxBuffer:2e6}).replace(/\r\n/g,'\n'),file);
 let source=fs.readFileSync(path.join(root,'ui-workspaces.js'),'utf8').replace(/\r\n/g,'\n');
 const adapter=source.match(/\/\/ C2 consumes[\s\S]+?(?=function initSitePresentation\(clearTarget\))/)[0];
 assert.doesNotMatch(adapter,/localStorage|sessionStorage|fetch\(|__opsTest|shareableState|\.setView\(|frameAll\(|\bstate\./);
 source=source.replace(adapter,'').replace('  const field = initFieldPresentation();\n','').replace('      field.present(false,active,shortcuts);\n','').replace('    field.present(enabled,active,shortcuts);\n','').replace('if (!field.scrollTarget(el)) el.scrollIntoView','el.scrollIntoView').replace('Stage C2 · opt-in workspaces','Stage C1 · opt-in workspaces');
 assert.equal(source,execFileSync('git',['show',baseline+':ui-workspaces.js'],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n'));
});
for(const [device,width,height] of sizes)await check(`Field usability: ${device} panel access, touch targets, disclosure and no navigation writes`,async()=>{
 const data=fixture();data.panels.dailyWorks.push(...Array.from({length:12},(_,i)=>({id:'extended-'+i,project:'default',main:'Synthetic extended daily record '+i,sub:'Review-only extended workfront notes',vis:{site:true,client:true}})));
 const run=await open(env,{width,height,touch:width<1200,data,audience:'?ui=workspaces&workspace=operations&workspaceProject=default'}),p=run.page;
 try{
  await ready(p);const before=await snapshot(p);
  await p.evaluate(()=>window.__c2Cards=[...document.querySelectorAll('#panelsGrid>[data-card]')]);
  for(const route of routes){await nav(p,route);await ready(p);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
   assert.equal(await p.locator('.fo-links a').count(),await p.locator('#panelsGrid>[data-card]:visible').count());
   for(const control of await p.locator('#panelsGrid>[data-card]:visible .card-head button,#panelsGrid>[data-card]:visible .row-act button,#panelsGrid>[data-card]:visible .vis button,.fo-history:visible,.fo-jump select:visible').all())assert.ok(await control.evaluate(e=>e.getBoundingClientRect().height>=44),'44 px original control: '+await control.getAttribute('title'));
   for(const control of await p.locator('#panelsGrid>[data-card]:visible [data-add],#panelsGrid>[data-card]:visible [data-print-panel],#panelsGrid>[data-card]:visible [data-edit]').all())assert.ok(await control.locator('.fo-label').isVisible());
   for(const meta of await p.locator('#panelsGrid>[data-card]:visible .stbadge,#panelsGrid>[data-card]:visible .team-tag,#panelsGrid>[data-card]:visible .due,#panelsGrid>[data-card]:visible .dt-badge').all())assert.ok(await meta.evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=13));
   const card=p.locator('#panelsGrid>[data-card]:visible').first(),pid=await card.getAttribute('data-card');
   if(route==='operations'){
    await card.locator('.list>li').last().scrollIntoViewIfNeeded();
    const action=await card.locator('[data-add]').evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight};});
    assert.ok(action.top>=0&&action.bottom<=action.height,'Original Add stays reachable while reviewing a long panel: '+JSON.stringify(action));
    await card.locator('[data-add]').click();await p.waitForFunction(()=>document.getElementById('itemModal').classList.contains('open'));await p.locator('#itemModal [data-close]').click();
   }
   await card.locator('.fo-collapse')[width<1200?'tap':'click']();assert.equal(await card.locator('.card-body').isVisible(),false);
   assert.equal(await card.locator('.fo-collapse').getAttribute('aria-expanded'),'false');
   if(width<1200)await p.locator('#foPanelJump').selectOption('#activity-'+pid);else await p.locator(`.fo-links a[data-ws-target="#activity-${pid}"]`).click();
   await p.waitForFunction(id=>!document.querySelector(`[data-card="${id}"]`).hasAttribute('data-fo-collapsed'),pid);
   assert.ok(await card.locator('.card-body').isVisible());
   const last=p.locator('.fo-links a').last(),target=await last.getAttribute('data-ws-target');await last.click();
   await p.waitForFunction(id=>{const card=document.getElementById(id),nav=document.querySelector('.ws-shortcuts');return card.getBoundingClientRect().top>=nav.getBoundingClientRect().bottom;},target.slice(1));
   assert.ok(await p.locator('.ws-shortcuts').evaluate(e=>e.getBoundingClientRect().top>=0&&e.getBoundingClientRect().bottom<innerHeight));
  }
  assert.ok(await p.evaluate(()=>__c2Cards.every(e=>e===document.getElementById(e.id))),'Navigation retains original panel nodes/order');
  assert.deepEqual(await snapshot(p),before);assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
  await nav(p,'all');assert.equal(await p.locator('.fo-collapse,.fo-label').count(),0);assert.equal(await p.locator('#panelsGrid>[data-card]').count(),21);
  assert.ok(await p.locator('#panelsGrid>[data-card]').evaluateAll(es=>es.every(e=>e.querySelector('.ttl').textContent.trim()===__opsTest.PANELS.find(p=>p.id===e.dataset.card).title)),'Original titles restored after disclosure rollback');
  if(await p.locator('#wsMobileMenu').isVisible())await p.locator('#wsMobileMenu').click();await p.locator('#wsOriginal').click();assert.equal(await p.locator('body').evaluate(e=>e.classList.contains('fo-workspace')),false);
 }finally{await run.close();}
});
for(const [device,width,height] of sizes)await check(`Field usability: ${device} original forms, simulated keyboard viewport, save/edit/complete and persistence`,async()=>{
 const run=await open(env,{width,height,touch:width<1200,data:fixture(),audience:'?ui=workspaces&workspace=operations&workspaceProject=default'}),p=run.page;
 try{
  await ready(p);
  await p.evaluate(()=>{window.__c2Form=document.getElementById('itemModal');window.__c2Save=document.getElementById('itemSave');window.__c2Inputs=[...__c2Form.querySelectorAll('input,select,textarea')];});
  for(const [route,pid] of [['operations','dailyWorks'],['resources','deliveries'],['quality','punchlist'],['coordination','rfis']]){
   await nav(p,route);await p.locator(`[data-add="${pid}"]`).click();
   await p.waitForFunction(()=>document.getElementById('itemModal').classList.contains('fo-item-form')&&document.activeElement===document.getElementById(document.getElementById('fldRef').style.display==='none'?'fMain':'fRef'));
   const title='C2 '+device+' '+pid;await p.locator('#fMain').fill(title);
   if(width<1200){
    await p.evaluate(()=>{
     const v=window.visualViewport;window.__c2Viewport={height:v.height,offsetTop:v.offsetTop};
     Object.defineProperty(v,'height',{configurable:true,value:Math.min(420,innerHeight/2)});
     Object.defineProperty(v,'offsetTop',{configurable:true,value:24});v.dispatchEvent(new Event('resize'));
    });
    await p.waitForFunction(()=>document.getElementById('itemModal').style.getPropertyValue('--fo-visible-top')==='24px');
    const rect=await p.locator('#itemSave').evaluate(e=>{const b=e.getBoundingClientRect(),v=visualViewport;return {top:b.top,bottom:b.bottom,start:v.offsetTop,end:v.offsetTop+v.height};});
    assert.ok(rect.top>=rect.start&&rect.bottom<=rect.end,'Save remains inside reduced visual viewport: '+JSON.stringify(rect));
    const inputs=p.locator('#itemModal .modal-body input:not([type="checkbox"]):visible,#itemModal .modal-body select:visible');
    await inputs.last().focus();await p.waitForFunction(()=>{const input=document.activeElement,area=document.querySelector('#itemModal .modal-body'),i=input.getBoundingClientRect(),a=area.getBoundingClientRect();return i.top>=a.top&&i.bottom<=a.bottom;});
   }
   await p.locator('#itemSave').click();await p.waitForFunction(()=>!document.getElementById('itemModal').classList.contains('open'));
   if(width<1200)await p.evaluate(()=>{delete visualViewport.height;delete visualViewport.offsetTop;visualViewport.dispatchEvent(new Event('resize'));});
   const saved=await p.evaluate(({pid,title})=>__opsTest.state.panels[pid].find(i=>i.main===title),{pid,title});assert.ok(saved&&saved.project==='default');
   await p.locator(`[data-edit="${pid}:${saved.id}"]`).click();await p.waitForFunction(()=>document.activeElement===document.getElementById(document.getElementById('fldRef').style.display==='none'?'fMain':'fRef'));
   await p.locator('#fMain').fill(title+' updated');await p.locator('#itemSave').click();
   await p.waitForFunction(({pid,id})=>__opsTest.state.panels[pid].find(i=>i.id===id).main.endsWith(' updated'),{pid,id:saved.id});
   const done=p.locator(`[data-done="${pid}:${saved.id}"]`);if(await done.count()){await done.click();assert.ok(await p.evaluate(id=>__opsTest.state.history[id].done,saved.id));await p.locator(`[data-done="${pid}:${saved.id}"]`).click();}
   const flag=await p.evaluate(({pid,id})=>__opsTest.state.panels[pid].find(i=>i.id===id).vis.client,{pid,id:saved.id});
   const vis=p.locator(`[data-vis="client:${pid}:${saved.id}"]`);await vis.click();assert.equal(await p.evaluate(({pid,id})=>__opsTest.state.panels[pid].find(i=>i.id===id).vis.client,{pid,id:saved.id}),!flag);
  }
  assert.ok(await p.evaluate(()=>__c2Form===document.getElementById('itemModal')&&__c2Save===document.getElementById('itemSave')&&__c2Inputs.every(e=>e.isConnected)),'Original form/control instances retained');
  const before=await snapshot(p);await p.reload();await ready(p);assert.deepEqual((await snapshot(p)).state,before.state);
  assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
 }finally{await run.close();}
});
for(const [audience,role] of [['crew=test-site','site'],['view=test-client-0','client']])await check(`Field usability: ${role} permitted panels/records, context changes and no editor/history leaks`,async()=>{
 const data=fixture(),run=await open(env,{width:768,height:1024,touch:true,data,audience:'?ui=workspaces&workspace=operations&workspaceProject=default&'+audience}),p=run.page;
 try{
  const before=await snapshot(p);
  const available=await p.locator('#wsDestinations a').evaluateAll(es=>es.map(e=>e.dataset.wsRoute));
  for(const route of routes.filter(r=>available.includes(r))){await nav(p,route);await ready(p);
   const ids=await p.locator('#panelsGrid>[data-card]:visible').evaluateAll(es=>es.map(e=>e.id));
   assert.deepEqual((await p.locator('#foPanelJump option').evaluateAll(es=>es.map(e=>e.value.slice(1)))).sort(),[...ids].sort());
   assert.equal(await p.locator('#foHistory').isVisible(),false);
   assert.equal(await p.locator('#panelsGrid [data-add]:visible,#panelsGrid [data-edit]:visible,#panelsGrid [data-vis]:visible').count(),0);
   for(const id of Object.keys(data.panels).filter(id=>!data.panelVis[id][role]))assert.equal(await p.locator(`.fo-links [data-ws-target="#activity-${id}"],#foPanelJump option[value="#activity-${id}"]`).count(),0);
   assert.doesNotMatch(await p.locator('#panelsGrid').innerText(),/East project/);
   if(role==='client')assert.doesNotMatch(await p.locator('#panelsGrid').innerText(),/Prepare bedding/);
  }
  assert.deepEqual(await snapshot(p),before);assert.equal(run.network.writes.length,0);
 }finally{await run.close();}
});
await check('Field usability: all-project history CSV, collapsed print parity, cancel and project reset',async()=>{
 const data=fixture();data.history={north:{id:'north',project:'default',title:'North history',createdAt:'2026-10-12'},east:{id:'east',project:'east',title:'East history',createdAt:'2026-10-12'}};
 const run=await open(env,{data,audience:'?ui=workspaces&workspace=operations&workspaceProject=default'}),p=run.page;
 try{
  await ready(p);const before=await snapshot(p);
  const download=p.waitForEvent('download');await p.locator('#foHistory').click();const csv=fs.readFileSync(await(await download).path(),'utf8');assert.match(csv,/North history/);assert.match(csv,/East history/);assert.match(await p.locator('#foHistory').getAttribute('title'),/all projects/);
  await p.locator('[data-card="dailyWorks"] .fo-collapse').click();
  await p.locator('[data-print-panel="dailyWorks"]').click();await p.emulateMedia({media:'print'});
  assert.ok(await p.locator('[data-card="dailyWorks"] .card-body').isVisible());assert.equal(await p.locator('.fo-navigation:visible,.fo-disclosure-icon:visible,.fo-label:visible').count(),0);
  assert.match(await p.locator('[data-card="dailyWorks"] .card-head').innerText(),/Daily Works/,'Print retains original panel title');
  await p.emulateMedia({media:'screen'});await p.evaluate(()=>dispatchEvent(new Event('afterprint')));
  assert.equal(await p.locator('[data-card="dailyWorks"] .card-body').isVisible(),false);
  await p.locator('[data-add="dailyWorks"]').click();await p.waitForFunction(()=>document.getElementById('itemModal').classList.contains('open'));await p.locator('#fMain').fill('Cancelled C2 edit');await p.locator('#itemModal [data-close]').click();assert.deepEqual(await snapshot(p),before);
  await p.locator('#projSelect').selectOption('east');await p.waitForFunction(()=>!document.querySelector('[data-card="dailyWorks"]').hasAttribute('data-fo-collapsed'));
  assert.match(await p.locator('[data-card="dailyWorks"]').innerText(),/East project/);assert.doesNotMatch(await p.locator('[data-card="dailyWorks"]').innerText(),/Install watermain/);
  assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
 }finally{await run.close();}
});
};
