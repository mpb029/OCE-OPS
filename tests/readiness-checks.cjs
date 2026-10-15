const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {open,output,fixture}=require('./harness.cjs');
const upload=(p,data)=>p.locator('#fileImport').setInputFiles({name:'review-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
async function recovery(p){
 const wait=p.waitForEvent('download');await p.locator('#importBackup').click();
 const file=await wait;assert.match(file.suggestedFilename(),/^offaly-ops-before-import-/);
 return JSON.parse(fs.readFileSync(await file.path(),'utf8'));
}
const snapshot=p=>p.evaluate(()=>({state:structuredClone(__opsTest.state),storage:{...localStorage},sync:{...__opsTest.sync},
 center:__opsTest.map.getCenter(),zoom:__opsTest.map.getZoom(),layers:Object.keys(__opsTest.map._layers).sort(),
 models:Object.entries(__opsTest.loadedObjs).map(([id,o])=>[id,o.uuid,o.parent?.uuid]),session:__opsTest.sessionModels,
 camera:__opsTest.three?{position:__opsTest.three.camera.position.toArray(),target:__opsTest.three.controls.target.toArray(),near:__opsTest.three.camera.near,far:__opsTest.three.camera.far}:null}));
module.exports=async(env,check)=>{
 for(const audience of ['', '?crew=test-site','?view=test-client-1'])await check(`Readiness: portrait-tablet hierarchy and spatial/activity access ${audience||'editor'}`,async()=>{
  const run=await open(env,{width:768,height:1024,touch:true,audience}),p=run.page;
  try{
   const state=await p.evaluate(()=>structuredClone(__opsTest.state));
   for(const [width,height]of[[768,1024],[820,1180],[1024,1366]]){
    await p.setViewportSize({width,height});await p.evaluate(()=>scrollTo(0,0));
    const summary=await p.locator('#summaryCard').boundingBox(),map=await p.locator('.map-card').boundingBox();
    if(summary){assert.ok(summary.y<330);assert.ok(summary.y<map.y);}
    assert.equal(await p.locator('.activity-shortcuts a[href="#mapCard"]').isVisible(),true);
    if(!audience)assert.equal(await p.locator('.activity-shortcuts a[href="#modelCard"]').isVisible(),true);
    for(const a of await p.locator('.activity-shortcuts a:visible').all()){
     assert.ok((await a.boundingBox()).y<260);
     const href=await a.getAttribute('href');await a.click();const target=await p.locator(href).boundingBox();assert.ok(target.y>=0&&target.y<height-50,href);await p.evaluate(()=>scrollTo(0,0));
    }
    assert.equal(await p.locator('#map').isVisible(),true);
    if(!audience){await p.locator('#btnModelToggle').click();assert.equal(await p.locator('#modelStage').isVisible(),true);await p.locator('#btnModelToggle').click();}
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
   }
   assert.deepEqual(await p.evaluate(()=>structuredClone(__opsTest.state)),state);assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 });
 await check('Readiness: import confirmation, exact recovery copy, cancel, stale backup guard and recovery round-trip',async()=>{
  const run=await open(env,{token:true}),p=run.page;
  try{
   await p.locator('[data-add="dailyWorks"]').click();await p.locator('#fMain').fill('Unpublished item to recover');await p.locator('#itemSave').click();
   const before=await snapshot(p),candidate=structuredClone(before.state);candidate.settings.projectName='Replacement board';
   await upload(p,candidate);assert.equal(await p.locator('#importConfirm').isEnabled(),false);assert.equal(await p.locator('#importBackupSaved').isEnabled(),false);
   assert.match(await p.locator('#importModal').innerText(),/Unpublished local changes will be replaced/);
   await p.screenshot({path:path.join(output,'import-confirmation-desktop.png')});
   await p.setViewportSize({width:390,height:844});await p.screenshot({path:path.join(output,'import-confirmation-mobile.png')});
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);
   await p.setViewportSize({width:1440,height:900});
   // Resize belongs to the screenshot exercise, not Import cancellation. Leaflet
   // rounds pixel origins; keep exact non-spatial checks and bound that rounding.
   await p.evaluate(()=>new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(ok)))));
   const beforeCancel=await snapshot(p);
   const {center:initialCenter,...initialRest}=before,{center:resizedCenter,...resizedRest}=beforeCancel;
   assert.deepEqual(resizedRest,initialRest);
   assert.ok(await p.evaluate(([a,b])=>__opsTest.map.project(a).distanceTo(__opsTest.map.project(b))<1,[initialCenter,resizedCenter]),'Resize must retain the map view within one pixel');
   const saved=await recovery(p);assert.deepEqual(saved,before.state);await p.keyboard.press('Escape');assert.deepEqual(await snapshot(p),beforeCancel);
   await upload(p,candidate);await recovery(p);await p.locator('#importBackupSaved').check();
   // A pending remote refresh or another edit must invalidate the downloaded snapshot.
   await p.evaluate(()=>__opsTest.state.settings.projectName='Changed while confirming');
   let wait=p.waitForEvent('dialog').then(async dialog=>{assert.match(dialog.message(),/restart Import/);await dialog.accept();});await p.locator('#importConfirm').click();await wait;
   await p.evaluate(name=>__opsTest.state.settings.projectName=name,before.state.settings.projectName);await p.keyboard.press('Escape');
   for(const board of[candidate,saved]){await upload(p,board);await recovery(p);await p.locator('#importBackupSaved').check();await p.locator('#importConfirm').click();await p.waitForFunction(name=>__opsTest.state.settings.projectName===name,board.settings.projectName);}
   assert.deepEqual(await p.evaluate(()=>structuredClone(__opsTest.state)),saved);assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 });
 await check('Readiness: malformed required records and empty collections rejected before confirmation',async()=>{
  const run=await open(env),p=run.page;
  try{
   const before=await snapshot(p),base={settings:{},panels:{}};
   const invalid=[{}, {settings:{}},{panels:{}},{...base,projects:[]},{...base,clients:[]},
    {...base,projects:[{name:'No ID'}]},{...base,projects:[{id:'p',name:'A'},{id:'p',name:'B'}]},
    {...base,clients:[{id:'c',name:'No key'}]},{...base,panels:{dailyWorks:[{id:'empty-main'}]}},
    {...base,panels:{documents:[{id:'f',name:'Missing URL'}]}},{...base,panels:{weeklyPhotos:[{id:'p',main:'Photos',photos:[{}]}]}},
    {...base,panels:{dailyWorks:[{id:'p',main:'Bad visibility',vis:{client:'false'}}]}},
    {...base,panels:{dailyWorks:[{id:'p',main:'Bad extras',x:[]}]}},
    {...base,models:[{id:'m'}]},{...base,mapLayers:[{id:'l',data:{type:'Invalid'}}]},
    {...base,history:{broken:null}},{...base,projectSummary:{p:[]}}];
   for(const data of invalid){const wait=p.waitForEvent('dialog');await upload(p,data);const dialog=await wait;assert.match(dialog.message(),/not imported/);await dialog.accept();assert.deepEqual(await snapshot(p),before);assert.equal(await p.locator('#importModal').isVisible(),false);}
   assert.equal(run.network.writes.length,0);return {rejectedCases:invalid.length};
  }finally{await run.close();}
 });
 await check('Readiness: failed import preserves exact storage, publishing, map layers/view and model scene',async()=>{
  const run=await open(env,{token:true,liveClock:true}),p=run.page;
  try{
   await p.locator('#fileModel').setInputFiles({name:'session.stl',mimeType:'model/stl',buffer:require('./fixtures.cjs').stl});
   await p.waitForFunction(()=>__opsTest.three&&Object.values(__opsTest.loadedObjs).some(o=>o.parent),null,{timeout:60000});await p.waitForTimeout(250);
   await p.locator('[data-mtool="zoomin"]').click();
   await p.locator('#projSelect').selectOption(run.data.projects[0].id);
   await p.locator('[data-add="dailyWorks"]').click();await p.locator('#fMain').fill('Retain unpublished change');await p.locator('#itemSave').click();
   await p.waitForTimeout(400);
   for(const failAt of ['offaly_ops_v1','offaly_ops_proj','offaly_ops_dirty','render']){
    const before=await snapshot(p),candidate=structuredClone(before.state);candidate.base='street';candidate.settings.loc={name:'Test',lat:-27,lng:152};candidate.projects[0].name='Candidate';candidate.mapLayers=[];candidate.markers=[];
    await upload(p,candidate);assert.deepEqual(await recovery(p),before.state);await p.locator('#importBackupSaved').check();
    await p.evaluate(failAt=>{
     if(failAt==='render'){const original=__opsTest.map.setView;__opsTest.map.setView=function(...args){this.setView=original;throw new Error('Injected render failure after layer replacement');};}
     else {const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===failAt){Storage.prototype.setItem=original;throw new DOMException('Injected storage failure','QuotaExceededError');}return original.call(this,key,value);};}
    },failAt);
    const wait=p.waitForEvent('dialog').then(async dialog=>{const message=dialog.message();await dialog.accept();assert.match(message,/not imported.*unchanged/);});await p.locator('#importConfirm').click();await wait;
    assert.deepEqual(await snapshot(p),before,failAt);assert.equal(await p.locator('#projSelect').inputValue(),before.state.projects[0].id);
   }
   assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);return {failures:['board storage','project storage','dirty flag storage','render after replacing map layers']};
  }finally{await run.close();}
 });
 await check('Readiness: preserved sample GeoJSON remains global across project and audience scopes',async()=>{
  const evidence=[];
  for(const audience of ['', '?crew=test-site','?view=test-client-0','?view=test-client-1']){
   const run=await open(env,{audience}),p=run.page;
   try{
    await p.waitForFunction(()=>__opsTest.geoLayer?.getLayers().length===4);
    const projects=await p.locator('#projSelect option').evaluateAll(es=>es.map(e=>e.value));
    if(await p.locator('#projSelect').isVisible()){
     for(const project of projects){await p.locator('#projSelect').selectOption(project);assert.equal(await p.evaluate(()=>__opsTest.map.hasLayer(__opsTest.geoLayer)),true);}
    }else{
     assert.deepEqual(projects,['all'],'Unassigned client has no project choices');
     assert.equal(await p.evaluate(()=>__opsTest.markerLayer.getLayers().length),0);
    }
    assert.equal(await p.evaluate(()=>__opsTest.map.hasLayer(__opsTest.geoLayer)),true);
    await p.locator('#btnFit').click();await p.waitForTimeout(250);
    assert.equal(await p.evaluate(()=>__opsTest.map.getBounds().contains(__opsTest.geoLayer.getBounds())),true);
    const withSample=await p.evaluate(()=>({zoom:__opsTest.map.getZoom(),bounds:__opsTest.map.getBounds().toBBoxString()}));
    await p.locator('[data-lc-toggle="__repo__"]').uncheck();await p.locator('#btnFit').click();await p.waitForTimeout(250);
    assert.equal(await p.evaluate(()=>__opsTest.map.hasLayer(__opsTest.geoLayer)),false);
    evidence.push({audience:audience||'editor',projects,withSample,withoutSample:await p.evaluate(()=>({zoom:__opsTest.map.getZoom(),bounds:__opsTest.map.getBounds().toBBoxString()}))});
    assert.deepEqual(run.network.errors,[]);
   }finally{await run.close();}
  }
  fs.writeFileSync(path.join(output,'geojson-assessment.json'),JSON.stringify(evidence,null,2));return evidence;
 });
};
