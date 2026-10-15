const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {root,open} = require('./harness.cjs');
const fixture = require('./workspace-fixture.cjs');
const baseline = '76501b5f9cd50c3103c83656a38604ca2b2c4086';
const sizes = [['desktop',1440,900],['tablet',768,1024],['mobile',390,844]];
const priorityPanels = ['dailyWorks','rfis','variations','incidents','deliveries','qualityTesting'];
const snapshot = p => p.evaluate(()=>{
 const payload=__opsTest.shareableState();delete payload.publishedAt;
 return {state:structuredClone(__opsTest.state),storage:{...localStorage},sync:{...__opsTest.sync},payload};
});
const ready = p => p.waitForFunction(()=>document.body.classList.contains('d-forms-enabled'));
async function settings(p) {
 if (!await p.locator('#btnSettings').isVisible()) await p.locator('#headerMenu summary').click();
 await p.locator('#btnSettings').click();
 await p.waitForFunction(()=>document.getElementById('settingsModal').classList.contains('open'));
}
async function item(p,pid,id) {
 await p.locator(id?`[data-edit="${pid}:${id}"]`:`[data-add="${pid}"]`).click();
 await p.waitForFunction(()=>document.getElementById('itemModal').classList.contains('open')&&document.activeElement===document.getElementById(document.getElementById('fldRef').style.display==='none'?'fMain':'fRef'));
}
async function cancel(p,modal) {
 await p.locator(`#${modal} [data-close]`).click();
 await p.waitForFunction(id=>!document.getElementById(id).classList.contains('open'),modal);
}
const controls = (p,id) => p.locator('#'+id).evaluate(modal=>{
 const wpPrerequisite=e=>e.matches('#fWPPrerequisites input[type="checkbox"][name="wpPrerequisite"]');
 const nodes=[...modal.querySelectorAll('input,select,textarea')].filter(e=>{
  if(!wpPrerequisite(e))return true;
  if(!e.closest('#fldWPReadiness')||!__opsTest.state.panels.workPackages.some(it=>it.id===e.value))throw new Error('Unexpected Work Package prerequisite control');
  // The shared form retains generated choices after leaving Work Packages.
  // Compare every visible choice by its stable record ID, not its generated DOM ID.
  return !!e.getClientRects().length;
 });
 return nodes.map((e,index)=>({
  key:wpPrerequisite(e)?'wpPrerequisite:'+e.value:e.dataset.fx?'extra:'+e.dataset.fx:e.id&&!/^ui-field-|^d-field-/.test(e.id)?e.id:Object.entries(e.dataset).map(([k,v])=>k+'='+v).join('|')||e.className+'#'+index,
  tag:e.tagName,type:e.type,value:e.getClientRects().length?e.value:undefined,checked:e.getClientRects().length?e.checked:undefined,readOnly:e.readOnly,disabled:e.disabled,required:e.required,
  min:e.getAttribute('min'),max:e.getAttribute('max'),step:e.getAttribute('step'),pattern:e.getAttribute('pattern'),multiple:e.multiple,
  visible:!!e.getClientRects().length,options:e.getClientRects().length&&e.options?[...e.options].map(o=>[o.value,o.text]):undefined
 })).sort((a,b)=>a.key.localeCompare(b.key));
});
async function assertKeyboardBoundary(p,modal,save) {
 await p.locator('#'+save).focus();await p.keyboard.press('Tab');
 await p.waitForFunction(id=>document.querySelector('#'+id+' .modal-close')===document.activeElement,modal);
 assert.ok(await p.locator(`#${modal} .modal-close`).evaluate(e=>e===document.activeElement),'Tab wraps to original close: '+await p.evaluate(()=>document.activeElement.outerHTML));
 await p.keyboard.press('Shift+Tab');
 await p.waitForFunction(id=>document.getElementById(id)===document.activeElement,save);
 assert.ok(await p.locator('#'+save).evaluate(e=>e===document.activeElement),'Shift+Tab wraps to original Save: '+await p.evaluate(()=>document.activeElement.outerHTML));
}
async function keyboardViewport(p,modal,save) {
 await p.evaluate(()=>{
  Object.defineProperty(visualViewport,'height',{configurable:true,value:360});
  Object.defineProperty(visualViewport,'offsetTop',{configurable:true,value:24});
  visualViewport.dispatchEvent(new Event('resize'));
 });
 await p.waitForFunction(id=>document.getElementById(id).style.getPropertyValue('--d-visible-top')==='24px',modal);
 const box=await p.locator('#'+save).evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,start:visualViewport.offsetTop,end:visualViewport.offsetTop+visualViewport.height};});
 assert.ok(box.top>=box.start&&box.bottom<=box.end,'Save stays inside simulated keyboard viewport: '+JSON.stringify(box));
 const last=p.locator(`#${modal} .modal-body input:not([type="checkbox"]):visible,#${modal} .modal-body select:visible,#${modal} .modal-body textarea:visible`).last();
 await last.focus();
 await p.waitForFunction(id=>{
  const field=document.activeElement.getBoundingClientRect(),body=document.querySelector('#'+id+' .modal-body').getBoundingClientRect();
  return field.top>=body.top-1&&field.bottom<=body.bottom+1;
 },modal);
 await p.evaluate(()=>{delete visualViewport.height;delete visualViewport.offsetTop;visualViewport.dispatchEvent(new Event('resize'));});
}
async function delayedStylesheet(env,kind) {
 let release,seen,pageCreated,run;
 const withheld=new Promise(resolve=>release=resolve),intercepted=new Promise(resolve=>seen=resolve),created=new Promise(resolve=>pageCreated=resolve);
 const delayed={...env,browser:{newContext:async options=>{
  const context=await env.browser.newContext(options);
  context.on('page',async page=>{
   // Page routing takes precedence over the harness's broad context route.
   await page.route('**/ui-forms.css',async route=>{seen();await withheld;await route.continue();});pageCreated(page);
  });return context;
 }}};
 const opening=open(delayed,{data:fixture(),audience:'?ui=workspaces&workspace=all&workspaceProject=default'});
 try {
  const p=await Promise.race([created,opening.then(result=>result.page)]);
  await p.waitForFunction(()=>window.__opsTest?.ready&&document.querySelector('[data-add="dailyWorks"]'));await intercepted;
  assert.equal(await p.locator('body').evaluate(e=>e.classList.contains('d-forms-enabled')),false,'The new stylesheet is genuinely withheld');
  const before=await snapshot(p),modal=kind==='item'?'itemModal':'settingsModal',field=kind==='item'?'fMain':'setProj';
  if(kind==='item')await item(p,'dailyWorks');else await settings(p);
  await p.locator('#'+field).fill('Synthetic text entered before the stylesheet loads');
  await p.evaluate(({field,kind})=>{
   window.__dDelayedField=document.getElementById(field);
   window.__dDelayedOpener=kind==='item'?document.querySelector('[data-add="dailyWorks"]'):document.getElementById('btnSettings');
   __dDelayedField.setSelectionRange(5,19,'backward');
  },{field,kind});
  const selection=()=>p.locator('#'+field).evaluate(e=>({focused:e===document.activeElement,value:e.value,start:e.selectionStart,end:e.selectionEnd,direction:e.selectionDirection}));
  const previous=await selection();assert.equal(previous.focused,true);
  release();run=await opening;await ready(p);
  await p.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
  assert.deepEqual(await selection(),previous,kind+' retains in-progress focus, text and selection when presentation loads');
  assert.ok(await p.evaluate(()=>__dDelayedField.isConnected&&document.getElementById(__dDelayedField.id)===__dDelayedField),'Original field instance retained');
  assert.deepEqual(await snapshot(p),before,'Late presentation does not save or mark the board dirty');
  await cancel(p,modal);await p.waitForFunction(()=>document.activeElement===__dDelayedOpener);
  assert.deepEqual(await snapshot(p),before,'Cancel still discards the unsaved modal value');assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
 }finally{release();run=run||await opening;await run.close();}
}
module.exports = async (env,check) => {
 await check('Forms and Settings: exact C2 domain runtime, settings handlers and mandatory regression assertions retained',()=>{
  for(const file of ['index.html','ui-v2.js','ui-v2.css','ui-field.css','ui-spatial.css','ui-overview.js','ui-overview.css','tests/regression.cjs']) {
   assert.equal(require('./stage-e-source.cjs').normalise(file,fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n')),execFileSync('git',['show',baseline+':'+file],{cwd:root,encoding:'utf8',maxBuffer:2e6}).replace(/\r\n/g,'\n'),file);
  }
  const adapter=fs.readFileSync(path.join(root,'ui-forms.js'),'utf8');
  assert.doesNotMatch(adapter,/\bfetch\s*\(|localStorage\s*\.|sessionStorage\s*\.|__opsTest|shareableState|\.setView\s*\(|\bstate\./,'Presentation must not read or write operational state');
  const loader="  // Stage D: load presentation only; existing forms and handlers stay authoritative.\n  const formsScript = document.createElement('script');\n  formsScript.src = 'ui-forms.js'; document.head.append(formsScript);\n";
  const workspace=require('./release-default-source.cjs').workspace(fs.readFileSync(path.join(root,'ui-workspaces.js'),'utf8').replace(/\r\n/g,'\n'));
  assert.equal(workspace.split(loader).length,2,'One explicit presentation-only loader');
  assert.equal(workspace.replace(loader,''),execFileSync('git',['show',baseline+':ui-workspaces.js'],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n'));
 });
 await check('Forms and Settings: all 21 panels retain original fields, constraints, defaults, nodes and attachment workflows',async()=>{
  const run=await open(env,{data:fixture(),token:true}),p=run.page;
  try {
   const before=await snapshot(p),panels=await p.evaluate(()=>__opsTest.PANELS.map(p=>({id:p.id,kind:p.kind})));
   assert.equal(panels.length,21);
   await p.evaluate(()=>window.__dOriginalControls=[...document.querySelectorAll('#itemModal input,#itemModal select,#itemModal textarea,#itemSave,#settingsModal input,#settingsModal select,#setSave')]);
   const original={};
   for(const panel of panels.filter(x=>x.kind!=='files')) {await item(p,panel.id);original[panel.id]=await controls(p,'itemModal');await cancel(p,'itemModal');}
   const fileBefore=p.waitForEvent('filechooser');await p.locator('[data-add="documents"]').click();
   const originalChooser=await fileBefore;assert.ok(await originalChooser.element().evaluate(e=>e.tagName==='INPUT'&&e.type==='file'));
   await p.locator('#wsOptIn').click();await ready(p);
   await p.locator('#wsDestinations [data-ws-route="all"]').click();
   for(const panel of panels.filter(x=>x.kind!=='files')) {
    await item(p,panel.id);assert.deepEqual(await controls(p,'itemModal'),original[panel.id],panel.id);
    assert.ok(await p.locator('#itemModal .d-form-section[data-d-section="record"]').isVisible());
    assert.ok(await p.locator('#itemModal .d-form-section[data-d-section="visibility"]').isVisible());
    for(const input of await p.locator('#itemModal input:not([type="range"]):visible,#itemModal select:visible,#itemModal textarea:visible').all())assert.ok(await input.evaluate(e=>e.labels?.length||e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')),'Input has an accessible label: '+panel.id+' '+await input.evaluate(e=>e.outerHTML));
    await cancel(p,'itemModal');
   }
   const fileAfter=p.waitForEvent('filechooser');await p.locator('[data-add="documents"]').click();
   assert.ok(await(await fileAfter).element().evaluate(e=>e.tagName==='INPUT'&&e.type==='file'));
   assert.ok(await p.evaluate(()=>__dOriginalControls.every(e=>e.isConnected)),'All original static form controls remain mounted');
   assert.deepEqual(await snapshot(p),before);assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
  await delayedStylesheet(env,'item');await delayedStylesheet(env,'settings');
 });
 for(const [device,width,height] of sizes)await check(`Forms and Settings: ${device} priority forms, validation, keyboard, CRUD, context and persistence`,async()=>{
  const run=await open(env,{width,height,touch:width<1200,data:fixture(),audience:'?ui=workspaces&workspace=all&workspaceProject=default'}),p=run.page;
  const dialogs=[];p.on('dialog',d=>{dialogs.push(d.message());d.dismiss();});
  try {
   await ready(p);
   for(const pid of priorityPanels) {
    const before=await snapshot(p);await item(p,pid);
    const box=await p.locator('#itemModal .modal').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1&&box.height<=height);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
    for(const control of await p.locator('#itemModal input:not([type="checkbox"]):not([type="range"]):visible,#itemModal select:visible,#itemModal .modal-foot button').all())assert.ok(await control.evaluate(e=>e.getBoundingClientRect().height>=44),'Touch-height input or action');
    await p.locator('#fMain').fill('   ');await p.locator('#itemSave').click();
    await p.waitForFunction(()=>document.getElementById('fMain').getAttribute('aria-invalid')==='true');
    assert.ok(await p.locator('#dMainError').isVisible());assert.equal(await p.locator('#dMainError').getAttribute('role'),'alert');
    assert.equal(await p.locator('#fMain').getAttribute('required'),null,'No new native validation rule');
    assert.deepEqual(await snapshot(p),before,'Failed original Save does not write state');
    await p.locator('#fMain').fill('');await p.locator('#fMain').press('Enter');
    await p.waitForFunction(()=>document.getElementById('fMain').getAttribute('aria-invalid')==='true');
    assert.ok(await p.locator('#dMainError').isVisible());assert.deepEqual(await snapshot(p),before,'Failed original Enter does not write state');
    const title='STAGE D '+device+' '+pid;await p.locator('#fMain').fill(title);
    if(await p.locator('#fSub').isVisible())await p.locator('#fSub').fill('Synthetic crew and location');
    if(await p.locator('#fRef').isVisible())await p.locator('#fRef').fill('D-017');
    if(await p.locator('#fDue').isVisible())await p.locator('#fDue').fill('2026-10-16');
    const extraValues={};
    for(const control of await p.locator('#fldExtras [data-fx]').all()) {
     const key=await control.getAttribute('data-fx'),type=await control.getAttribute('type'),value=type==='date'?'2026-10-16':type==='time'?'08:30':'Synthetic '+key;
     await control.fill(value);extraValues[key]=value;
    }
    await p.locator('#fTeam').selectOption('site');await p.locator('#fVisClient').uncheck();
    await p.locator('#tglRequired').check();
    // The unchanged toggle handler focuses this newly revealed field asynchronously.
    // Observe that native transition before fill() can focus it ahead of the callback.
    await p.waitForFunction(()=>document.activeElement===document.getElementById('fRequired'));
    await p.locator('#fRequired').fill('2026-10-17');
    if(pid==='rfis'){await assertKeyboardBoundary(p,'itemModal','itemSave');if(width<1200)await keyboardViewport(p,'itemModal','itemSave');}
    await p.locator('#itemSave').click();await p.waitForFunction(()=>!document.getElementById('itemModal').classList.contains('open'));
    const saved=await p.evaluate(({pid,title})=>__opsTest.state.panels[pid].find(i=>i.main===title),{pid,title});
    assert.ok(saved);assert.equal(saved.project,'default');assert.equal(saved.team,'site');assert.equal(saved.vis.client,false);assert.equal(saved.dateRequired,'2026-10-17');
    if(Object.keys(extraValues).length)assert.deepEqual(saved.x,extraValues);
    assert.ok(await p.evaluate(id=>!!__opsTest.state.history[id],saved.id));
    await item(p,pid,saved.id);await p.locator('#fMain').fill(title+' cancelled');
    const unchanged=await snapshot(p);await cancel(p,'itemModal');assert.deepEqual(await snapshot(p),unchanged,'Cancel retains original record');
    await item(p,pid,saved.id);await p.locator('#fMain').fill(title+' edited');
    if(pid==='qualityTesting')await p.locator('#fMain').press('Enter');else await p.locator('#itemSave').click();
    await p.waitForFunction(({pid,id})=>__opsTest.state.panels[pid].find(i=>i.id===id).main.endsWith(' edited'),{pid,id:saved.id});
   }
   const beforeReload=await snapshot(p);await p.reload();await ready(p);assert.deepEqual((await snapshot(p)).state,beforeReload.state);
   await p.locator('#projSelect').selectOption('east');await item(p,'dailyWorks');assert.equal(await p.locator('#fProject').inputValue(),'east');
   assert.equal(await p.locator('#fMain').inputValue(),'');assert.ok(!await p.locator('#dMainError').isVisible(),'No stale validation error');await cancel(p,'itemModal');
   assert.doesNotMatch(await p.locator('#panelsGrid').innerText(),/STAGE D/);
   assert.deepEqual(dialogs,[],'No new blocking confirmation on original Save/Cancel');assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 });
 for(const [device,width,height] of sizes)await check(`Forms and Settings: ${device} settings sections, original controls, keyboard, cancel and save`,async()=>{
  const run=await open(env,{width,height,touch:width<1200,data:fixture()}),p=run.page;
  try {
   await settings(p);const original=await controls(p,'settingsModal'),originalClientHelp=await p.locator('#settingsModal .modal-body > p').first().innerText();await cancel(p,'settingsModal');const before=await snapshot(p);
   await p.locator('#wsOptIn').click();await ready(p);await settings(p);
   assert.deepEqual(await controls(p,'settingsModal'),original,'All original values/options/rules retained after grouping');
   for(const button of await p.locator('#settingsModal button:visible').all())assert.ok(await button.evaluate(e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44;}),'Settings action has 44 px touch target: '+await button.evaluate(e=>e.id||e.title||e.textContent));
   for(const field of await p.locator('#newProjName,#newClientName,#settingsModal [data-proj-name],#settingsModal [data-client-name],#settingsModal [data-client-link]').all())assert.ok(await field.evaluate(e=>e.labels?.length||e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')),'Settings name or link has an accessible label');
   for(const label of await p.locator('#settingsModal .proj-clients label').all())assert.ok(await label.evaluate(e=>e.getBoundingClientRect().height>=44),'Project assignment label has 44 px touch height');
   assert.doesNotMatch(await p.locator('#d-settings-clients > p').first().innerText(),/further down/,'Reordered settings use accurate directions');
   const url=p.url(),names=['projects','clients','mapping','publishing','display','access'];
   assert.deepEqual(await p.locator('#dSettingsNav a').evaluateAll(es=>es.map(e=>e.getAttribute('href').replace('#d-settings-',''))),names);
   for(const name of names) {
    const link=p.locator(`#dSettingsNav a[href="#d-settings-${name}"]`);assert.ok(await link.evaluate(e=>e.getBoundingClientRect().height>=44));await link.click();
    assert.ok(await p.locator('#d-settings-'+name).isVisible());
    const b=await p.locator('#d-settings-'+name).evaluate(e=>{const r=e.getBoundingClientRect(),body=e.closest('.modal-body').getBoundingClientRect();return {top:r.top,bottom:r.bottom,bodyTop:body.top,bodyBottom:body.bottom};});
    assert.ok(b.top<b.bodyBottom&&b.bottom>b.bodyTop,'Jump brings section into original scroll area');
   }
   assert.equal(p.url(),url,'Section jumps do not alter workspace or audience URL');
   assert.equal(await p.locator('#settingsModal .d-settings-section:visible').count(),6,'All sections remain available');
   assert.match(await p.locator('.d-settings-note').first().innerText(),/immediate|straight away|as you/i);
   assert.equal(await p.locator('#setToken').getAttribute('type'),'password');
   await assertKeyboardBoundary(p,'settingsModal','setSave');if(width<1200)await keyboardViewport(p,'settingsModal','setSave');
   await p.locator('#setProj').fill('Cancelled Stage D heading');await cancel(p,'settingsModal');assert.deepEqual(await snapshot(p),before);
   await settings(p);assert.equal(await p.locator('#setProj').inputValue(),before.state.settings.projectName);
   await p.locator('#setProj').fill('Stage D '+device+' synthetic heading');await p.locator('#setSave').click();
   await p.waitForFunction(()=>!document.getElementById('settingsModal').classList.contains('open'));
   assert.equal(await p.evaluate(()=>__opsTest.state.settings.projectName),'Stage D '+device+' synthetic heading');
   assert.deepEqual(await p.evaluate(()=>__opsTest.state.settings.loc),before.state.settings.loc);assert.equal(run.network.writes.length,0);
   await p.reload();await ready(p);await settings(p);assert.equal(await p.locator('#setProj').inputValue(),'Stage D '+device+' synthetic heading');await cancel(p,'settingsModal');
   if(!await p.locator('#wsOriginal').isVisible())await p.locator(await p.locator('#wsMobileMenu').isVisible()?'#wsMobileMenu':'#wsMenu').click();
   await p.locator('#wsOriginal').click();await p.waitForFunction(()=>!document.body.classList.contains('d-forms-enabled'));await settings(p);
   assert.equal(await p.locator('#settingsModal .modal-body > p').first().innerText(),originalClientHelp,'Original board restores exact original Settings help text');await cancel(p,'settingsModal');
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 });
 for(const [query,role] of [['crew=test-site','site'],['view=test-client-0','client']])await check(`Forms and Settings: ${role} display filters retain no editor controls, section names or restricted records`,async()=>{
  const data=fixture(),run=await open(env,{data,width:768,height:1024,touch:true,audience:'?ui=workspaces&workspace=all&workspaceProject=default&'+query}),p=run.page;
  try {
   const before=await snapshot(p);assert.equal(await p.locator('body').evaluate(e=>e.classList.contains('d-forms-enabled')),false);
   assert.equal(await p.locator('#btnSettings:visible,#panelsGrid [data-add]:visible,#panelsGrid [data-edit]:visible,#dSettingsNav:visible,.d-form-section:visible').count(),0);
   for(const id of Object.keys(data.panels).filter(id=>!data.panelVis[id][role]))assert.equal(await p.locator(`[data-card="${id}"]`).count(),0);
   assert.doesNotMatch(await p.locator('#panelsGrid').innerText(),/East project/);if(role==='client')assert.doesNotMatch(await p.locator('#panelsGrid').innerText(),/Prepare bedding/);
   assert.deepEqual(await snapshot(p),before);assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 });
 await check('Forms and Settings: immediate project/client handlers, assignment, history and Original board rollback',async()=>{
  const data=fixture();data.history={north:{id:'north',project:'default',title:'North history',createdAt:'2026-10-12'},east:{id:'east',project:'east',title:'East history',createdAt:'2026-10-12'}};
  const run=await open(env,{data,audience:'?ui=workspaces&workspace=all'}),p=run.page;
  try {
   await ready(p);await settings(p);
   await p.evaluate(()=>window.__dSettingsNodes=[...document.querySelectorAll('#settingsModal .modal-body input[id],#settingsModal .modal-body select[id],#setSave,#itemSave')]);
   await p.locator('[data-proj-name="default"]').fill('Renamed synthetic project');await p.locator('[data-proj-name="default"]').press('Tab');
   assert.equal(await p.evaluate(()=>__opsTest.state.projects.find(x=>x.id==='default').name),'Renamed synthetic project');
   await p.locator('[data-client-name="default"]').fill('Renamed synthetic client');await p.locator('[data-client-name="default"]').press('Tab');
   assert.equal(await p.evaluate(()=>__opsTest.state.clients.find(x=>x.id==='default').name),'Renamed synthetic client');
   await p.locator('[data-pc="default:client-b"]').check();assert.ok(await p.evaluate(()=>__opsTest.state.projects.find(x=>x.id==='default').clients.includes('client-b')));
   await p.locator('#newProjName').fill('Added synthetic project');await p.locator('#addProjBtn').click();
   await p.locator('#newClientName').fill('Added synthetic client');await p.locator('#addClientBtn').click();
   const download=p.waitForEvent('download');await p.locator('#btnHistory').click();const csv=fs.readFileSync(await(await download).path(),'utf8');assert.match(csv,/North history/);assert.match(csv,/East history/);
   const immediate=await snapshot(p);await cancel(p,'settingsModal');assert.deepEqual(await snapshot(p),immediate,'Original immediate Settings mutations survive Cancel');
   await p.locator('#wsOriginal').click();await p.waitForFunction(()=>!document.body.classList.contains('d-forms-enabled'));
   assert.equal(await p.locator('.d-form-section,.d-settings-section,#dSettingsNav,#dMainError').count(),0);
   assert.ok(await p.evaluate(()=>__dSettingsNodes.every(e=>e.isConnected)),'Original controls survive rollback');
   assert.deepEqual(await snapshot(p),immediate);assert.equal(await p.locator('[data-card]').count(),21);assert.equal(run.network.writes.length,0);
   await settings(p);assert.equal(await p.locator('#settingsModal .modal-body > #clientList').count(),1);assert.equal(await p.locator('#settingsModal .modal-body > #projList').count(),1);await cancel(p,'settingsModal');
   assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 });
};
