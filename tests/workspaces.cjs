const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {root,output,start,open,fixture} = require('./harness.cjs');
const synthetic = require('./workspace-fixture.cjs');
const groups = {
 operations:['dailyWorks','trafficControl','upcoming','workPackages'], resources:['deliveries','subbiesToday','staffAway','siteInputs','plantTransport','materialPickup'],
 quality:['punchlist','qualityTesting','issuesDelays','incidents'], coordination:['stakeholders','meetings','designChanges','variations','rfis'], documents:['documents','weeklyPhotos']
};
const routes = ['overview',...Object.keys(groups),'site','all'];
const results = [];
const git = args => execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const commit = git(['rev-parse','HEAD']), clean = !git(['status','--porcelain']);
const startedAt = new Date().toISOString();
async function check(name,fn) {
 if (process.env.OCE_STAGE_A_FILTER && !new RegExp(process.env.OCE_STAGE_A_FILTER).test(name)) return;
 try { const detail = await fn(); results.push({name,status:'PASS',detail}); console.log('PASS '+name); }
 catch(e) {results.push({name,status:'FAIL',error:e.stack});console.error('FAIL '+name+': '+e.message.slice(0,400));}
}
async function nav(p,route,target) {
 if (await p.locator('#wsMobileMenu').isVisible() && !await p.locator('#wsSidebar').isVisible()) await p.locator('#wsMobileMenu').click();
 await p.locator(`#wsDestinations [data-ws-route="${route}"]`).click();
 await p.waitForFunction(r=>document.body.dataset.workspace===r,route);
 if (target) await p.locator(`.ws-shortcuts [data-ws-target="#activity-${target}"]`).click();
 await p.waitForTimeout(60);
}
const snapshot = p => p.evaluate(()=>{
 const payload=__opsTest.shareableState(); delete payload.publishedAt; // Generated on every call; stored timestamp is checked in state/sync.
 return {state:structuredClone(__opsTest.state),payload,storage:{...localStorage},sync:{...__opsTest.sync}};
});
const ids = p => p.locator('#panelsGrid > [data-card]:visible').evaluateAll(es=>es.map(e=>e.dataset.card));
const command = async (p,id) => {if(!await p.locator('#'+id).isVisible())await p.locator('#headerMenu summary').click();await p.locator('#'+id).click();};
async function enabled(env,options={}) {
 const run = await open(env,{data:synthetic(),...options,audience:'?ui=workspaces&'+(options.audience || '')});
 await run.page.waitForFunction(()=>document.body.classList.contains('ws-enabled'));
 return run;
}
(async()=>{
 const env=await start();
 try {
  await require('./overview-checks.cjs')(env,check);
  await check('Exact accepted Phase 1 source retained outside the explicit Stage A adapter',()=>{
   const before=execFileSync('git',['show','35f23679f1c97c5f781067f11d28b24740e25b5b:index.html'],{cwd:root,encoding:'utf8',maxBuffer:2e6}).replace(/\r\n/g,'\n');
   let after=require('./overview-source.cjs')(fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/\r\n/g,'\n'));
   after=after.replace('  <link rel="stylesheet" href="ui-overview.css" />\n  <script src="ui-overview.js" defer></script>\n','');
   for(const addition of [
    '  <link rel="stylesheet" href="ui-workspaces.css" />\n  <script src="ui-workspaces.js" defer></script>\n',
    '    // Stage A presentation hook: the original renderer remains authoritative.\n    document.dispatchEvent(new Event("oce:panels-rendered"));\n',
    '  // Stage A viewport adapter: resize existing instances without fitting or saving.\n  document.addEventListener("oce:workspace-reveal", () => {\n    if (map && document.getElementById("map").getClientRects().length) map.invalidateSize({ animate: false });\n    if (three && document.getElementById("modelStage").getClientRects().length) three.resize();\n  });\n\n'
   ]){assert.equal(after.split(addition).length,2);after=after.replace(addition,'');}
   assert.equal(after,before);
   assert.equal(git(['diff','35f2367','--','ui-v2.js','ui-v2.css','package-lock.json']),'');
  });
  await check('Opt-in, All Panels landing, URL opt-out and exact original runtime hooks',async()=>{
   const run=await open(env,{data:synthetic()}); const p=run.page;
   try {
    assert.equal(await p.locator('body').evaluate(e=>e.classList.contains('ws-enabled')),false);
    await p.evaluate(()=>{window.__workspaceReveals=0;document.addEventListener('oce:workspace-reveal',()=>window.__workspaceReveals++);});
    for(const size of [{width:768,height:1024},{width:390,height:844},{width:1440,height:900}]){await p.setViewportSize(size);await p.waitForTimeout(100);}
    assert.equal(await p.evaluate(()=>window.__workspaceReveals),0,'Classic mode must not add viewport callbacks');
    const before=await snapshot(p); await p.locator('#wsOptIn').click();
    assert.equal(await p.locator('#wsTitle').innerText(),'All Panels'); assert.equal((await ids(p)).length,21);
    assert.equal(await p.locator('#wsDestinations a').count(),8);
    await nav(p,'operations'); await p.locator('#wsOriginal').click();
    assert.equal(await p.locator('#wsSidebar').isVisible(),false); assert.equal((await ids(p)).length,21);
    assert.deepEqual(await snapshot(p),before); assert.equal(run.network.writes.length,0);
    await p.waitForTimeout(100);await p.evaluate(()=>window.__workspaceReveals=0);
    await p.setViewportSize({width:768,height:1024});await p.waitForTimeout(100);
    assert.equal(await p.evaluate(()=>window.__workspaceReveals),0,'Opt-out must stop viewport callbacks');
    await p.reload(); await p.waitForFunction(()=>window.__opsTest?.ready);
    assert.equal(await p.locator('#wsSidebar').isVisible(),false);
   } finally {await run.close();}
  });
  for (const [width,height] of [[1440,900],[768,1024],[390,844],[1024,768],[360,800]]) await check(`Navigation ${width}×${height}: eight routes, original nodes, no writes or overflow`,async()=>{
   const run=await enabled(env,{width,height,touch:width<1100}); const p=run.page;
   try {
    const before=await snapshot(p);
    await p.evaluate(()=>{window.__cards=[...document.querySelectorAll('[data-card]')];window.__map=__opsTest.map;});
    for(const route of routes) {
     await nav(p,route);
     assert.deepEqual(await ids(p),groups[route] || (route==='all'?Object.keys(synthetic().panels):[]),route);
     assert.equal(await p.locator('[data-card]').count(),21);
     assert.ok(await p.evaluate(()=>__cards.every(e=>e===document.querySelector(`[data-card="${e.dataset.card}"]`))&&__map===__opsTest.map));
     assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
     const controls = p.locator('.ws-shortcuts a:visible, #wsMenu:visible, .ws-bottom a:visible, .ws-bottom button:visible');
     for (const c of await controls.all()) {const box=await c.boundingBox();assert.ok(box.height>=44,'Touch height');}
    }
    assert.deepEqual(await snapshot(p),before); assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
   } finally {await run.close();}
  });
  for(const [width,height] of [[1440,900],[768,1024],[390,844]]) await check(`Keyboard and discoverable drawer ${width}×${height}`,async()=>{
   const run=await enabled(env,{width,height,touch:width<1100});const p=run.page;
   try {
    const control = width<681?'#wsMobileMenu':'#wsMenu';
    assert.ok(await p.locator(control).isVisible());assert.match(await p.locator(control).innerText(),/Menu|Collapse/);
    await p.locator(control).focus();await p.keyboard.press('Enter');
    if(width>=1200){assert.equal(await p.locator('body').evaluate(e=>e.classList.contains('ws-rail')),true);await p.locator(control).click();}
    else {
     assert.equal(await p.locator('#wsSidebar').getAttribute('aria-modal'),'true');assert.equal(await p.locator('.wrap').evaluate(e=>e.inert),true);
     await p.locator('#wsMenu').focus();await p.keyboard.press('Shift+Tab');assert.equal(await p.locator('#wsOriginal').evaluate(e=>e===document.activeElement),true);
     await p.keyboard.press('Tab');assert.equal(await p.locator('#wsMenu').evaluate(e=>e===document.activeElement),true);
     await p.keyboard.press('Escape');assert.equal(await p.locator('.wrap').evaluate(e=>e.inert),false);
     assert.equal(await p.locator(control).evaluate(e=>e===document.activeElement),true);
    }
    await nav(p,'operations'); await p.locator('[data-add="dailyWorks"]').click();await p.waitForTimeout(70);
    assert.equal(await p.locator('#itemModal').isVisible(),true);if(width<681)assert.equal(await p.locator('#wsMobileMenu').isVisible(),false);
    await p.keyboard.press('Escape');assert.equal(await p.locator('[data-add="dailyWorks"]').evaluate(e=>e===document.activeElement),true);
    await command(p,'btnSettings');assert.equal(await p.locator('#settingsModal').isVisible(),true);await p.keyboard.press('Escape');
    await p.setViewportSize({width:width===768?1024:768,height:width===768?768:1024});
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   } finally {await run.close();}
  });
  await check('Deep links wait for initial board; retain query/audience, anchors, reload, Back/Forward and project',async()=>{
   const run=await enabled(env,{audience:'workspace=quality&workspaceProject=default&keep=original#activity-punchlist'});const p=run.page;
   try {
    assert.equal(await p.locator('#wsTitle').innerText(),'Quality, Safety & Risk');assert.equal(await p.locator('#projSelect').inputValue(),'default');
    await p.waitForFunction(()=>{const y=document.getElementById('activity-punchlist').getBoundingClientRect().y;return y>=0 && (y<100 || scrollY>=document.documentElement.scrollHeight-innerHeight-2);});
    await nav(p,'operations');await p.locator('#projSelect').selectOption('east');await p.waitForTimeout(200);
    assert.match(await p.locator('[data-card="dailyWorks"]').innerText(),/East project/);assert.doesNotMatch(await p.locator('[data-card="dailyWorks"]').innerText(),/Install watermain/);
    await p.evaluate(()=>scrollTo(0,300));await p.waitForTimeout(200); const y=await p.evaluate(()=>scrollY);
    await nav(p,'resources');await p.goBack();await p.waitForTimeout(200);
    assert.equal(await p.locator('#wsTitle').innerText(),'Operations');assert.equal(await p.locator('#projSelect').inputValue(),'east');assert.ok(Math.abs(await p.evaluate(()=>scrollY)-y)<2);
    await p.goBack();await p.waitForTimeout(100);assert.equal(await p.locator('#projSelect').inputValue(),'default');
    await p.goForward();await p.waitForTimeout(100);assert.equal(await p.locator('#projSelect').inputValue(),'east');
    await p.reload();await p.waitForFunction(()=>window.__opsTest?.ready&&document.body.dataset.workspace==='operations');
    assert.equal(await p.locator('#projSelect').inputValue(),'east');assert.equal(new URL(p.url()).searchParams.get('keep'),'original');
   } finally {await run.close();}
  });
  for(const [audience,role] of [['crew=test-site','site'],['view=test-client-0','client'],['client=test-client-0','client'],['view=unknown','client'],['#crew','site'],['#client','client'],['#overview','client']]) await check(`Audience compatibility and no restricted names, records or counts: ${audience}`,async()=>{
   const run=await enabled(env,{audience});const p=run.page;
   try {
    assert.equal(await p.evaluate(()=>__opsTest.sync.audience),role);
    const all=await p.locator('[data-card]').evaluateAll(es=>es.map(e=>({id:e.dataset.card,title:e.querySelector('.ttl').textContent.trim(),text:e.innerText})));
    const visible=all.map(e=>e.id),expected=Object.keys(synthetic().panels).filter(id=>synthetic().panelVis[id][role]);
    assert.deepEqual([...visible].sort(),expected.sort());
    assert.equal(await p.locator('.ws-description').innerText(),`${visible.length} available panels · Original board layout`);
    const before=await snapshot(p);
    const destinations=await p.locator('#wsDestinations a').evaluateAll(es=>es.map(e=>e.dataset.wsRoute));
    for(const route of destinations) {
     await nav(p,route);
     const originalOrder=all.filter(e=>route==='all'||groups[route]?.includes(e.id)).map(e=>e.id);
     assert.deepEqual(await ids(p),originalOrder);
     const links=await p.locator('.ws-chrome a[data-ws-target]').evaluateAll(es=>es.map(e=>e.dataset.wsTarget));
     for(const href of links.filter(x=>x.startsWith('#activity-')))assert.ok(visible.includes(href.slice(10)));
     assert.equal(await p.locator('#btnPublish').isVisible(),false);
    }
    assert.deepEqual(await snapshot(p),before);assert.equal(run.network.writes.length,0);
    await nav(p,'operations','dailyWorks'); await p.reload(); await p.waitForFunction(()=>window.__opsTest?.ready);
    assert.equal(await p.evaluate(()=>__opsTest.sync.audience),role);
    assert.equal(await p.locator('body').evaluate(e=>e.classList.contains('viewer')),true);
    assert.deepEqual(run.network.errors,[]);
   } finally {await run.close();}
  });
  await check('Absent whole workspace and forbidden deep link fall back without a restricted title',async()=>{
   const data=synthetic();for(const id of groups.quality)data.panelVis[id].client=false;
   const run=await enabled(env,{data,audience:'view=test-client-0&workspace=quality#activity-incidents'});const p=run.page;
   try {assert.equal(await p.locator('#wsTitle').innerText(),'All Panels');assert.equal(await p.locator('#wsDestinations [data-ws-route="quality"]').count(),0);assert.equal(await p.locator('[href*="activity-incidents"]').count(),0);assert.equal(new URL(p.url()).hash,'');}
   finally{await run.close();}
  });
  await check('Empty permitted panel set has no fabricated workspace names or counts',async()=>{
   const data=synthetic();Object.values(data.panelVis).forEach(v=>v.client=false);
   // The shared harness waits for a card; start with one then exercise the real polling renderer.
   data.panelVis.dailyWorks.client=true;const run=await enabled(env,{data,audience:'view=test-client-0'});const p=run.page;
   try{run.data.panelVis.dailyWorks.client=false;run.data.publishedAt='2026-10-13T00:01:00Z';await p.clock.fastForward(46000);await p.waitForFunction(()=>!document.querySelector('[data-card]'));assert.equal(await p.locator('.ws-description').innerText(),'0 available panels · Original board layout');assert.deepEqual(await p.locator('#wsDestinations a').evaluateAll(es=>es.map(e=>e.dataset.wsRoute)),['overview','site','all']);}
   finally{await run.close();}
  });
  await check('Workspace CRUD, original rerenders, completion/history and retirement',async()=>{
   const run=await enabled(env);const p=run.page;
   try {
    for(const [route,pids] of Object.entries(groups)) {
     await nav(p,route);
     for(const pid of pids.filter(id=>!['documents','weeklyPhotos'].includes(id))) {
      await p.locator(`[data-add="${pid}"]`).click();await p.waitForTimeout(50);await p.locator('#fMain').fill('Stage A '+pid);await p.locator('#itemSave').click();
      const item=await p.evaluate(id=>__opsTest.state.panels[id].find(i=>i.main==='Stage A '+id),pid);assert.ok(item);
      assert.equal(await p.locator(`[data-card="${pid}"]`).count(),1);assert.equal(await p.locator(`[data-card="${pid}"]`).isVisible(),true);
      await p.locator(`[data-edit="${pid}:${item.id}"]`).click();await p.waitForTimeout(50);await p.locator('#fMain').fill('Edited '+pid);await p.locator('#itemSave').click();
      await p.locator(`[data-del="${pid}:${item.id}"]`).click();
      assert.equal(await p.evaluate(({pid,id})=>__opsTest.state.panels[pid].some(i=>i.id===id),{pid,id:item.id}),false);
      assert.equal(await p.evaluate(id=>__opsTest.state.history[id].removed,item.id),true);
     }
    }
    await nav(p,'resources');const done=p.locator('[data-done]:visible').first();assert.ok(await done.count());const hook=await done.getAttribute('data-done');await done.click();assert.ok(await p.evaluate(()=>Object.values(__opsTest.state.history).some(h=>h.done)));
    await p.clock.setFixedTime(new Date('2026-10-14T02:00:00+10:00'));await p.locator('#projSelect').selectOption('default');
    assert.equal(await p.locator(`[data-edit="${hook}"]`).count(),0,'Resolved record retires from display after 24 hours');
    assert.ok(await p.evaluate(h=>{const [pid,id]=h.split(':');return __opsTest.state.panels[pid].some(i=>i.id===id)&&__opsTest.state.history[id];},hook),'Retired record stays in saved data/history');
    assert.equal(await p.locator('[data-card]').count(),21);assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
   }finally{await run.close();}
  });
  await check('Spatial instances, G4N geometry, session raster, camera and map view survive repeated navigation',async()=>{
   const run=await enabled(env,{audience:'workspace=site',liveClock:true});const p=run.page;
   try {
    await p.locator('#fileModel').setInputFiles(path.join(root,'G4N.obj'));
    await p.waitForFunction(()=>__opsTest.three&&__opsTest.three.renderer.info.render.triangles>0,null,{timeout:60000});
    await p.locator('#fileGeo').setInputFiles({name:'test-raster.tif',mimeType:'image/tiff',buffer:require('./fixtures.cjs').geotiff()});
    await p.waitForFunction(()=>Object.keys(__opsTest.rasterLayers).length===1,null,{timeout:60000});
    await p.waitForTimeout(500);
    await p.evaluate(()=>{__opsTest.map.stop();__opsTest.map.setView([-25.906,153.088],17,{animate:false});window.__spatial={map:__opsTest.map,three:__opsTest.three,scene:__opsTest.three.scene,canvas:__opsTest.three.renderer.domElement,objects:{...__opsTest.loadedObjs},raster:Object.values(__opsTest.rasterLayers)[0]};});
    await p.waitForTimeout(200);
    const read=()=>p.evaluate(()=>({center:__opsTest.map.getCenter(),zoom:__opsTest.map.getZoom(),position:__opsTest.three.camera.position.toArray(),target:__opsTest.three.controls.target.toArray(),objects:Object.values(__opsTest.loadedObjs).map(o=>[o.uuid,o.parent?.uuid]),session:__opsTest.sessionModels}));
    const before=await read(),board=await snapshot(p);
    for(const route of ['operations','quality','documents','all','site','coordination','site']){
     await nav(p,route);
     // Leaflet rounds pixel origins on resize; require less than one screen pixel,
     // at EVERY transition, rather than masking an intervening jump on return.
     const view=await p.evaluate(center=>({pixels:__opsTest.map.project(__opsTest.map.getCenter()).distanceTo(__opsTest.map.project(center)),center:__opsTest.map.getCenter(),zoom:__opsTest.map.getZoom()}),before.center);
     assert.ok(view.pixels<1,route+' changed map centre '+JSON.stringify({before,view}));
    }
    const after=await read();assert.equal(after.zoom,before.zoom);
    for(const k of ['position','target'])after[k].forEach((v,i)=>assert.ok(Math.abs(v-before[k][i])<1e-7,k));
    assert.deepEqual(after.objects,before.objects);assert.deepEqual(after.session,before.session);
    assert.ok(await p.evaluate(()=>__spatial.map===__opsTest.map&&__spatial.three===__opsTest.three&&__spatial.scene===__opsTest.three.scene&&__spatial.canvas===__opsTest.three.renderer.domElement&&__spatial.raster===Object.values(__opsTest.rasterLayers)[0]));
    assert.equal(await p.evaluate(()=>__opsTest.map.getSize().x),await p.locator('#map').evaluate(e=>e.clientWidth));assert.equal(await p.evaluate(()=>__opsTest.three.renderer.domElement.width),await p.locator('#modelStage').evaluate(e=>e.clientWidth));
    assert.deepEqual(await snapshot(p),board);assert.deepEqual(run.network.errors,[]);
   }finally{await run.close();}
  });
  await check('Full-board and single-panel print scope from all eight routes; no navigation chrome',async()=>{
   const run=await enabled(env);const p=run.page;
   try{
    for(const route of routes){
     await nav(p,route);await command(p,'btnPrint');await p.emulateMedia({media:'print'});
     assert.equal((await ids(p)).length,21,route);assert.equal(await p.locator('.ws-chrome:visible').count(),0);
     await p.emulateMedia({media:'screen'});await p.evaluate(()=>dispatchEvent(new Event('afterprint')));
     await p.locator('[data-print-panel="dailyWorks"]').evaluate(e=>e.click());await p.emulateMedia({media:'print'});assert.deepEqual(await ids(p),['dailyWorks']);
     await p.emulateMedia({media:'screen'});await p.evaluate(()=>dispatchEvent(new Event('afterprint')));
     assert.equal(await p.locator('body').getAttribute('data-workspace'),route);
    }
   }finally{await run.close();}
  });
  await check('Locked editor exposes no shell and unlock restores the requested workspace',async()=>{
   const first=await open(env,{data:synthetic()});const pass=await first.page.evaluate(()=>__opsTest.cyrb53('stage-a-test'));await first.close();
   const data=synthetic();data.settings.editPass=pass;const run=await open(env,{data,audience:'?ui=workspaces&workspace=quality'});const p=run.page;
   try{assert.equal(await p.locator('.ws-chrome:visible').count(),0);await p.locator('#lockPass').fill('stage-a-test');await p.locator('#lockBtn').click();await p.waitForFunction(()=>document.body.dataset.workspace==='quality');assert.deepEqual(await ids(p),groups.quality);assert.equal(run.network.writes.length,0);}
   finally{await run.close();}
  });
  // Reuse the complete accepted backup contracts with the integrated shell enabled.
  await require('./backup-checks.cjs')({...env,workspaces:true},(name,fn)=>check('Opt-in '+name,fn));
  await require('./readiness-checks.cjs')({...env,workspaces:true},(name,fn)=>/import|malformed/.test(name)?check('Opt-in '+name,fn):Promise.resolve());
  await check('Explicit mocked publishing and document/photo workflows from grouped workspaces',async()=>{
   const run=await enabled(env,{token:true});const p=run.page;
   try {
    await nav(p,'operations');await p.locator('[data-add="dailyWorks"]').click();await p.waitForTimeout(50);await p.locator('#fMain').fill('Synthetic publishing check');await p.locator('#itemSave').click();
    const payload=await p.evaluate(()=>__opsTest.shareableState());assert.equal(run.network.writes.length,0);
    await p.locator('#btnPublish').click();await p.waitForFunction(()=>!__opsTest.sync.dirty&&!__opsTest.sync.busy);
    assert.equal(run.network.writes.length,1);
    const published=JSON.parse(Buffer.from(run.network.writes[0].body.content,'base64').toString('utf8'));assert.deepEqual(published,payload);assert.ok(!JSON.stringify(published).includes('workspaceProject'));
    await nav(p,'documents');await p.locator('[data-add="documents"]').click();await p.locator('#fileAttach').setInputFiles({name:'synthetic-review.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic review document')});
    await p.waitForFunction(()=>__opsTest.state.panels.documents.some(f=>f.name==='synthetic-review.txt'));
    const doc=await p.evaluate(()=>__opsTest.state.panels.documents.find(f=>f.name==='synthetic-review.txt'));
    await p.locator(`[data-fdel="documents:${doc.id}"]`).click();await p.waitForFunction(id=>!__opsTest.state.panels.documents.some(f=>f.id===id),doc.id);
    await p.locator('[data-add="weeklyPhotos"]').click();await p.waitForTimeout(50);await p.locator('#fMain').fill('Stage A photo folder');await p.locator('#itemSave').click();
    assert.ok(await p.evaluate(()=>__opsTest.state.panels.weeklyPhotos.some(f=>f.main==='Stage A photo folder')));
    assert.deepEqual(run.network.errors,[]);
    return {writes:'Explicit requests intercepted by test harness; no live API mutation',publishPayload:'Exact original whitelist',attachments:'Original upload/delete and folder handlers'};
   }finally{await run.close();}
  });
  await check('Production source and all protected operational assets match latest main',()=>require('./preservation.cjs')(root,output));
 }finally{
  await env.close();
  const report={commit,endCommit:git(['rev-parse','HEAD']),worktreeClean:clean&&!git(['status','--porcelain']),startedAt,completedAt:new Date().toISOString(),engine:env.engine,browserVersion:env.browser.version(),fullRun:!process.env.OCE_STAGE_A_FILTER,tests:results,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length};
  fs.writeFileSync(path.join(output,'stage-a-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed}));
  if(report.failed)process.exitCode=1;
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
