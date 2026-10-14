const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {open,root}=require('./harness.cjs'),board=require('./workspace-fixture.cjs'),files=require('./fixtures.cjs');
const geo=(name,lng,lat)=>({type:'FeatureCollection',features:[{type:'Feature',properties:{name},geometry:{type:'LineString',coordinates:[[lng,lat],[lng+.002,lat+.001]]}}]});
function fixture(env){
 const data=board();
 data.mapLayers=[
  {id:'global-vector',name:'Global survey reference',data:geo('Global reference',153.08,-25.91),visible:true,color:'#2463a6',style:{color:'#2463a6',weight:6,dash:'8,6'}},
  {id:'north-vector',name:'North project alignment',project:'default',data:geo('North alignment',153.09,-25.9),visible:true},
  {id:'east-vector',name:'East project alignment',project:'east',data:geo('East alignment',152.7,-27.2),visible:true},
  {id:'north-imagery',name:'North project imagery',project:'default',type:'tiles',url:env.url+'/after/tests/fixture-image.png?z={z}&x={x}&y={y}',visible:true,opacity:.65},
  {id:'hidden-vector',name:'Hidden survey preference',project:'default',data:geo('Hidden geometry',160,-10),visible:false},
  {id:'orphan-vector',name:'Retained unavailable-project survey',project:'retired-project',data:geo('Unavailable project geometry',151,-29),visible:true}
 ];
 data.models=[
  {id:'global-model',name:'Global reference model',url:env.url+'/after/tests/fixture.glb',fmt:'glb',visible:true},
  {id:'north-model',name:'North project model',project:'default',url:env.url+'/after/tests/fixture.glb',fmt:'glb',visible:true,upAxis:'y'},
  {id:'east-model',name:'East project model',project:'east',url:env.url+'/after/tests/fixture.gltf',fmt:'gltf',visible:true},
  {id:'hidden-model',name:'Hidden model preference',project:'default',url:env.url+'/after/tests/fixture.glb',fmt:'glb',visible:false},
  {id:'orphan-model',name:'Retained unavailable-project model',project:'retired-project',url:env.url+'/after/tests/fixture.glb',fmt:'glb',visible:true}
 ];
 return data;
}
const read=p=>p.evaluate(()=>structuredClone(__opsTest.state));
const stable=p=>p.evaluate(()=>{
 const payload=__opsTest.shareableState();delete payload.publishedAt;
 const storage={...localStorage};delete storage.offaly_ops_proj;
 return {state:structuredClone(__opsTest.state),payload,sync:{...__opsTest.sync},storage};
});
const mapIds=p=>p.evaluate(()=>Object.keys(__opsTest.userLayers).filter(id=>__opsTest.map.hasLayer(__opsTest.userLayers[id])).sort());
const modelIds=p=>p.evaluate(()=>Object.keys(__opsTest.loadedObjs).filter(id=>__opsTest.loadedObjs[id]?.parent===__opsTest.three?.scene).sort());
const rowIds=(p,kind)=>p.locator(kind==='model'?'[data-model-toggle]':'[data-lc-toggle]:not([data-lc-toggle="__repo__"])').evaluateAll(es=>es.map(e=>e.getAttribute(e.hasAttribute('data-model-toggle')?'data-model-toggle':'data-lc-toggle')).sort());
async function selected(p,project){await p.locator('#projSelect').selectOption(project);await p.waitForFunction(id=>__opsTest.currentProject===id,project);}
async function scene(p,ids){await p.waitForFunction(ids=>window.__opsTest?.three&&Object.keys(__opsTest.loadedObjs).filter(id=>__opsTest.loadedObjs[id]?.parent===__opsTest.three.scene).sort().join('|')===ids.slice().sort().join('|'),ids,{timeout:60000});}
async function layers(p){await p.locator('#spLayers').waitFor({state:'visible'});if(await p.locator('#spLayers').getAttribute('aria-expanded')!=='true')await p.locator('#spLayers').click();await p.locator('.layer-ctl').waitFor({state:'visible'});await p.waitForFunction(()=>!document.querySelector('.layer-ctl').inert);}
async function focus(p,id){await p.locator(`.ws-shortcuts [data-ws-target="#${id}"]`).click();await p.waitForFunction(id=>!document.getElementById(id).hasAttribute('data-sp-hidden'),id);}
async function nav(p,route){if(await p.locator('#wsMobileMenu').isVisible()&&!await p.locator('#wsSidebar').isVisible())await p.locator('#wsMobileMenu').click();await p.locator(`#wsDestinations [data-ws-route="${route}"]`).click();await p.waitForFunction(r=>document.body.dataset.workspace===r,route);}
async function settled(p){await p.evaluate(()=>new Promise(resolve=>{let last=[],same=0;function tick(){const t=__opsTest.three,now=t?[...t.camera.position.toArray(),...t.controls.target.toArray()]:[];same=now.every((v,i)=>Math.abs(v-last[i])<1e-8)?same+1:0;last=now;if(same>=8&&!__opsTest.map._panAnim?._inProgress&&!__opsTest.map._animatingZoom)resolve();else requestAnimationFrame(tick);}tick();}));}
async function exported(p){if(!await p.locator('#btnExport').isVisible())await p.locator('#headerMenu summary').click();const pending=p.waitForEvent('download');await p.locator('#btnExport').click();return JSON.parse(fs.readFileSync(await(await pending).path(),'utf8'));}
const upload=(p,data)=>p.locator('#fileImport').setInputFiles({name:'synthetic-project-spatial-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
async function restore(p,data){await upload(p,data);const pending=p.waitForEvent('download');await p.locator('#importBackup').click();const backup=JSON.parse(fs.readFileSync(await(await pending).path(),'utf8'));await p.locator('#importBackupSaved').check();await p.locator('#importConfirm').click();return backup;}
module.exports=async(env,check)=>{
 await check('Project spatial: legacy records remain Global without migration, defaults or unauthorised writes',async()=>{
  const data=fixture(env);for(const record of [...data.mapLayers,...data.models])delete record.project;
  const run=await open(env,{data,audience:'?ui=workspaces&workspace=site'}),p=run.page;
  try{
   await scene(p,['global-model','north-model','east-model','orphan-model']);await p.waitForFunction(()=>__opsTest.geoLayer?.getLayers().length===4);
   const before=await stable(p);
   for(const project of ['default','east','all']){await selected(p,project);await scene(p,['global-model','north-model','east-model','orphan-model']);assert.deepEqual(await mapIds(p),['east-vector','global-vector','north-imagery','north-vector','orphan-vector']);assert.ok(await p.evaluate(()=>__opsTest.map.hasLayer(__opsTest.geoLayer)));}
   assert.deepEqual(await stable(p),before);assert.ok((await read(p)).mapLayers.every(r=>!Object.hasOwn(r,'project')));assert.ok((await read(p)).models.every(r=>!Object.hasOwn(r,'project')));
   assert.equal(await p.locator('[data-lc-project="__repo__"]').count(),0);assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 });
 await check('Project spatial: selected project and All Projects show eligible actual geometry; Fit excludes hidden and ineligible layers',async()=>{
  const data=fixture(env);data.markers=[];const run=await open(env,{data,audience:'?ui=workspaces&workspace=site'}),p=run.page;
  try{
   await scene(p,['global-model','north-model','east-model','orphan-model']);await p.waitForFunction(()=>__opsTest.geoLayer?.getLayers().length===4);await layers(p);await p.locator('[data-lc-toggle="__repo__"]').uncheck();
   const before=await stable(p);
   await selected(p,'default');await scene(p,['global-model','north-model']);assert.deepEqual(await mapIds(p),['global-vector','north-imagery','north-vector']);assert.deepEqual(await rowIds(p,'layer'),['global-vector','hidden-vector','north-imagery','north-vector']);assert.deepEqual(await rowIds(p,'model'),['global-model','hidden-model','north-model']);
   await p.locator('#btnFit').click();await p.waitForFunction(()=>!__opsTest.map._panAnim?._inProgress&&!__opsTest.map._animatingZoom);
   assert.ok(await p.evaluate(()=>{const b=__opsTest.map.getBounds();return b.contains([-25.91,153.08])&&b.contains([-25.899,153.092])&&!b.contains([-27.2,152.7])&&!b.contains([-10,160]);}),'Fit includes visible North/Global geometry only');
   await selected(p,'east');await scene(p,['global-model','east-model']);assert.deepEqual(await mapIds(p),['east-vector','global-vector']);assert.deepEqual(await rowIds(p,'layer'),['east-vector','global-vector']);
   await p.locator('#btnFit').click();await p.waitForFunction(()=>!__opsTest.map._panAnim?._inProgress&&!__opsTest.map._animatingZoom);assert.ok(await p.evaluate(()=>__opsTest.map.getBounds().contains([-27.2,152.7])));
   await selected(p,'all');await scene(p,['global-model','north-model','east-model','orphan-model']);assert.equal(await p.locator('[data-lc-project="orphan-vector"] option:checked').innerText(),'Unavailable project');
   assert.deepEqual(await stable(p),before);assert.equal(await p.locator('[data-card]').count(),21);assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 });
 await check('Project spatial: assignment controls reassign saved vectors, imagery and models without reimport; persistence and Global removal',async()=>{
  const run=await open(env,{data:fixture(env),audience:'?ui=workspaces&workspace=site'}),p=run.page;
  try{
   await scene(p,['global-model','north-model','east-model','orphan-model']);await layers(p);const before=await read(p);
   await p.evaluate(()=>{window.__eAssignment={layer:__opsTest.userLayers['global-vector'],object:__opsTest.loadedObjs['global-model']};});
   await p.locator('[data-lc-project="global-vector"]').selectOption('east');await p.locator('[data-lc-project="north-imagery"]').selectOption('east');await focus(p,'modelCard');await p.locator('[data-model-project="global-model"]').selectOption('east');
   const assigned=await read(p),expected=structuredClone(before);expected.mapLayers.find(l=>l.id==='global-vector').project='east';expected.mapLayers.find(l=>l.id==='north-imagery').project='east';expected.models.find(m=>m.id==='global-model').project='east';assert.deepEqual(assigned,expected);
   assert.ok(await p.evaluate(()=>__opsTest.userLayers['global-vector']===__eAssignment.layer&&__opsTest.loadedObjs['global-model']===__eAssignment.object));assert.equal(await p.evaluate(()=>__opsTest.sync.dirty),true);assert.equal(run.network.writes.length,0);
   await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__opsTest?.ready);await scene(p,['global-model','north-model','east-model','orphan-model']);assert.deepEqual(await read(p),assigned);
   await focus(p,'mapCard');await layers(p);await p.locator('[data-lc-project="global-vector"]').selectOption('');await p.locator('[data-lc-project="north-imagery"]').selectOption('');await focus(p,'modelCard');await p.locator('[data-model-project="global-model"]').selectOption('');
   const cleared=await read(p);for(const record of [cleared.mapLayers[0],cleared.mapLayers[3],cleared.models[0]])assert.equal(Object.hasOwn(record,'project'),false);
   assert.deepEqual(cleared.mapLayers[0].style,before.mapLayers[0].style);assert.equal(cleared.mapLayers.find(l=>l.id==='hidden-vector').visible,false);assert.equal(cleared.models.find(m=>m.id==='hidden-model').visible,false);assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
   if(!await p.locator('#btnSettings').isVisible())await p.locator('#headerMenu summary').click();await p.locator('#btnSettings').click();await p.locator('[data-proj-del="east"]').click();await p.locator('#settingsModal .modal-close').click();
   const removed=await read(p);assert.ok(!removed.projects.some(project=>project.id==='east'));assert.deepEqual(removed.mapLayers,cleared.mapLayers);assert.deepEqual(removed.models,cleared.models,'Deleting a project retains spatial IDs and assignments without guessing a replacement');
   await focus(p,'mapCard');await layers(p);assert.equal(await p.locator('[data-lc-project="east-vector"] option:checked').innerText(),'Unavailable project');await focus(p,'modelCard');assert.equal(await p.locator('[data-model-project="east-model"] option:checked').innerText(),'Unavailable project');
   // Viewer fixtures use the existing published payload, whose timestamp is kept
   // separately from editor state. No actual Publish request is performed.
   const clientPayload=await p.evaluate(()=>__opsTest.shareableState());assert.deepEqual(clientPayload.mapLayers,removed.mapLayers);assert.deepEqual(clientPayload.models,removed.models);
   const client=await open(env,{data:clientPayload,audience:'?ui=workspaces&workspace=site&view=test-client-1'});
   try{await scene(client.page,['global-model']);assert.deepEqual(await mapIds(client.page),['global-vector','north-imagery']);assert.deepEqual(await rowIds(client.page,'model'),['global-model']);assert.doesNotMatch(await client.page.locator('.layer-ctl,#modelList').allTextContents().then(a=>a.join(' ')),/East project|unavailable-project/);assert.equal(client.network.writes.length,0);assert.deepEqual(client.network.errors,[]);}finally{await client.close();}
  }finally{await run.close();}
 });
 await check('Project spatial: session GeoTIFF and model assignments stay ephemeral and preserve hidden preferences and imported objects',async()=>{
  const data=board(),run=await open(env,{data,audience:'?ui=workspaces&workspace=site&workspaceProject=default',liveClock:true}),p=run.page;
  try{
   const before=await stable(p);
   await p.locator('#fileGeo').setInputFiles({name:'Synthetic session raster.tif',mimeType:'image/tiff',buffer:files.geotiff()});await p.waitForFunction(()=>Object.keys(__opsTest.rasterLayers).length===1,null,{timeout:60000});
   await p.locator('#fileModel').setInputFiles({name:'Synthetic session model.stl',mimeType:'model/stl',buffer:files.stl});await p.waitForFunction(()=>Object.values(__opsTest.loadedObjs).some(o=>o.parent),null,{timeout:60000});
   const ids=await p.evaluate(()=>({raster:Object.keys(__opsTest.rasterLayers)[0],model:Object.keys(__opsTest.sessionModels)[0]}));
   assert.ok(await p.evaluate(({raster,model})=>!Object.hasOwn(__opsTest.rasterLayers[raster],'project')&&!Object.hasOwn(__opsTest.sessionModels[model],'project'),ids),'Imports under a selected project remain Global until explicitly assigned');
   await focus(p,'mapCard');await layers(p);await p.locator(`[data-lc-project="${ids.raster}"]`).selectOption('default');await p.locator(`[data-lc-toggle="${ids.raster}"]`).uncheck();await focus(p,'modelCard');await p.locator(`[data-model-project="${ids.model}"]`).selectOption('default');await p.locator(`[data-model-toggle="${ids.model}"]`).uncheck();
   await p.evaluate(({raster,model})=>window.__eSession={raster:__opsTest.rasterLayers[raster],object:__opsTest.loadedObjs[model],url:__opsTest.sessionModels[model].url},ids);
   for(const id of ['east','all','default'])await selected(p,id);
   assert.ok(await p.evaluate(({raster,model})=>__opsTest.rasterLayers[raster]===__eSession.raster&&__opsTest.loadedObjs[model]===__eSession.object&&__opsTest.sessionModels[model].url===__eSession.url&&!__opsTest.map.hasLayer(__opsTest.rasterLayers[raster].layer)&&!__opsTest.loadedObjs[model].parent,ids));
   await focus(p,'mapCard');await layers(p);await p.locator(`[data-lc-toggle="${ids.raster}"]`).check();await focus(p,'modelCard');await p.locator(`[data-model-toggle="${ids.model}"]`).check();await scene(p,[ids.model]);
   await selected(p,'east');await scene(p,[]);assert.equal(await p.evaluate(id=>__opsTest.map.hasLayer(__opsTest.rasterLayers[id].layer),ids.raster),false);
   await selected(p,'default');await scene(p,[ids.model]);assert.ok(await p.evaluate(id=>__opsTest.map.hasLayer(__opsTest.rasterLayers[id].layer),ids.raster));assert.deepEqual(await stable(p),before);
   await p.locator('#fileGeo').setInputFiles({name:'New saved survey.geojson',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(geo('New saved survey',153.09,-25.91)))});await p.waitForFunction(()=>__opsTest.state.mapLayers.length===1);assert.equal(Object.hasOwn((await read(p)).mapLayers[0],'project'),false);
   const responses=[env.url+'/after/tests/fixture.glb','New shared model'];p.on('dialog',d=>d.accept(responses.shift()));await focus(p,'modelCard');await p.locator('#btnModelUrl').click();await p.waitForFunction(()=>__opsTest.state.models.length===1);assert.equal(Object.hasOwn((await read(p)).models[0],'project'),false,'New saved model remains Global under a selected project');
   const payload=await p.evaluate(()=>__opsTest.shareableState());assert.equal(payload.models.length,1);assert.equal(payload.mapLayers.length,1);assert.ok(!JSON.stringify(payload).includes(ids.model)&&!JSON.stringify(payload).includes(ids.raster),'Session content and assignments never enter publishing');assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 });
 await check('Project spatial: project/workspace switching retains Leaflet/Three instances, geometry caches, camera, styles and visibility',async()=>{
  const run=await open(env,{data:fixture(env),liveClock:true,audience:'?ui=workspaces&workspace=site'}),p=run.page;
  try{
   await scene(p,['global-model','north-model','east-model','orphan-model']);await settled(p);
   await p.evaluate(()=>{const t=__opsTest;t.map.setView([-25.906,153.088],17,{animate:false});t.three.camera.position.add(new THREE.Vector3(5,7,11));t.three.controls.target.add(new THREE.Vector3(2,3,4));t.three.controls.update();});await settled(p);
   await p.evaluate(()=>{const t=__opsTest;window.__eView={map:t.map,geo:t.geoLayer,three:t.three,scene:t.three.scene,canvas:t.three.renderer.domElement,layers:{...t.userLayers},objects:{...t.loadedObjs},center:t.map.getCenter(),zoom:t.map.getZoom(),camera:t.three.camera.position.toArray(),target:t.three.controls.target.toArray()};});
   const before=await stable(p);
   for(let cycle=0;cycle<2;cycle++)for(const project of ['default','east','all']){
    await selected(p,project);await scene(p,project==='all'?['global-model','north-model','east-model','orphan-model']:project==='east'?['global-model','east-model']:['global-model','north-model']);
    for(const route of ['overview','operations','all','site'])await nav(p,route);await settled(p);
    const result=await p.evaluate(()=>{const t=__opsTest,b=__eView;return {instances:t.map===b.map&&t.geoLayer===b.geo&&t.three===b.three&&t.three.scene===b.scene&&t.three.renderer.domElement===b.canvas,layers:Object.entries(b.layers).every(([id,o])=>t.userLayers[id]===o),objects:Object.entries(b.objects).every(([id,o])=>t.loadedObjs[id]===o),pixels:t.map.project(t.map.getCenter()).distanceTo(t.map.project(b.center)),zoom:t.map.getZoom()===b.zoom,camera:t.three.camera.position.toArray().every((v,i)=>Math.abs(v-b.camera[i])<1e-7),target:t.three.controls.target.toArray().every((v,i)=>Math.abs(v-b.target[i])<1e-7),triangles:t.three.renderer.info.render.triangles};});
    assert.ok(result.instances&&result.layers&&result.objects&&result.zoom&&result.camera&&result.target,JSON.stringify(result));assert.ok(result.pixels<1);assert.ok(result.triangles>0);
   }
   assert.deepEqual(await stable(p),before);assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 });
 await check('Project spatial: exact backup round-trip, invalid metadata rollback and explicit mocked publishing retain assignments',async()=>{
  const run=await open(env,{data:fixture(env),token:true,audience:'?ui=workspaces&workspace=site'}),p=run.page;
  try{
   await scene(p,['global-model','north-model','east-model','orphan-model']);const original=await exported(p),candidate=structuredClone(original);candidate.mapLayers[0].project='east';candidate.models[0].project='default';candidate.mapLayers[0].futureSpatial={retain:true};
   assert.deepEqual(await restore(p,candidate),original);await p.waitForFunction(()=>__opsTest.state.mapLayers[0].project==='east');assert.deepEqual(await exported(p),candidate);assert.equal(run.network.writes.length,0);assert.equal(await p.evaluate(()=>__opsTest.sync.dirty),true);
   await scene(p,['global-model','north-model','east-model','orphan-model']);await settled(p);const before=await stable(p);
   await p.evaluate(()=>window.__eInvalid={map:__opsTest.map,layers:{...__opsTest.userLayers},objects:{...__opsTest.loadedObjs}});
   for(const key of ['mapLayers','models'])for(const value of [null,42,{},[]]){const invalid=structuredClone(candidate);invalid[key][0].project=value;const pending=p.waitForEvent('dialog');await upload(p,invalid);const dialog=await pending;assert.match(dialog.message(),/not imported/);await dialog.accept();assert.deepEqual(await stable(p),before);assert.equal(await p.locator('#importModal').isVisible(),false);}
   assert.ok(await p.evaluate(()=>__opsTest.map===__eInvalid.map&&Object.entries(__eInvalid.layers).every(([id,l])=>__opsTest.userLayers[id]===l)&&Object.entries(__eInvalid.objects).every(([id,o])=>__opsTest.loadedObjs[id]===o)));
   const failed=structuredClone(candidate);failed.models[0].url=env.url+'/after/tests/must-not-load.glb';failed.models.push({id:'candidate-only',name:'Must not load failed backup',url:env.url+'/after/tests/must-not-load.glb',visible:true,project:'default'});
   let candidateRequests=0;await p.route('**/must-not-load.glb',route=>{candidateRequests++;return route.fulfill({contentType:'model/gltf-binary',body:files.glb()});});
   const pose=await p.evaluate(()=>({camera:__opsTest.three.camera.position.toArray(),target:__opsTest.three.controls.target.toArray()}));await upload(p,failed);const recovery=p.waitForEvent('download');await p.locator('#importBackup').click();assert.deepEqual(JSON.parse(fs.readFileSync(await(await recovery).path(),'utf8')),candidate);await p.locator('#importBackupSaved').check();
   await p.evaluate(()=>{const original=__opsTest.map.setView;__opsTest.map.setView=function(...args){this.setView=original;throw new Error('Stage E injected post-refresh map failure');};});
   const rejected=p.waitForEvent('dialog').then(async d=>{assert.match(d.message(),/not imported.*unchanged/);await d.accept();});await p.locator('#importConfirm').click();await rejected;await settled(p);
   assert.deepEqual(await stable(p),before);assert.equal(candidateRequests,0,'Failed backup cannot start any candidate model load');assert.equal(await p.evaluate(()=>!!__opsTest.loadedObjs['candidate-only']),false);assert.ok(await p.evaluate(()=>Object.entries(__eInvalid.objects).every(([id,o])=>__opsTest.loadedObjs[id]===o&&o.parent===__opsTest.three.scene)));assert.deepEqual(await p.evaluate(()=>({camera:__opsTest.three.camera.position.toArray(),target:__opsTest.three.controls.target.toArray()})),pose);
   const expected=await p.evaluate(()=>__opsTest.shareableState());await p.locator('#btnPublish').click();await p.waitForFunction(()=>!__opsTest.sync.busy&&!__opsTest.sync.dirty);assert.equal(run.network.writes.length,1);const write=run.network.writes[0];assert.match(write.url,/regression-fixture\/test-board\/contents\/data.json/);assert.deepEqual(JSON.parse(Buffer.from(write.body.content,'base64').toString()),expected);
   // The intercepted synthetic repository now serves the successfully published payload.
   Object.assign(run.data,expected);await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__opsTest?.ready);assert.equal((await read(p)).mapLayers[0].project,'east');assert.equal((await read(p)).models[0].project,'default');assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 });
 for(const [role,query] of [['site','crew=test-site'],['client','view=test-client-0']])await check(`Project spatial: ${role} project display filters reveal no restricted rows, options or geometry`,async()=>{
  const run=await open(env,{data:fixture(env),width:768,height:1024,touch:true,audience:'?ui=workspaces&workspace=site&'+query}),p=run.page;
  try{
   await scene(p,role==='client'?['global-model','north-model']:['global-model','north-model','east-model','orphan-model']);
   assert.equal(await p.locator('[data-lc-project],[data-model-project]').count(),0,'Assignment remains editor-only');
   if(role==='client'){assert.deepEqual(await rowIds(p,'layer'),['global-vector','hidden-vector','north-imagery','north-vector']);assert.deepEqual(await rowIds(p,'model'),['global-model','hidden-model','north-model']);assert.equal(await p.locator('#projSelect option[value="east"]').count(),0);assert.doesNotMatch(await p.locator('.layer-ctl,#modelList').allTextContents().then(a=>a.join(' ')),/East project|unavailable-project/);}
   else{await selected(p,'east');await scene(p,['global-model','east-model']);assert.deepEqual(await mapIds(p),['east-vector','global-vector']);assert.deepEqual(await rowIds(p,'model'),['east-model','global-model']);}
   await p.waitForFunction(()=>__opsTest.geoLayer?.getLayers().length===4);assert.ok(await p.evaluate(()=>__opsTest.map.hasLayer(__opsTest.geoLayer)),'Preserved repository sample is still Global');
   const before=await stable(p);await nav(p,'overview');await nav(p,'site');assert.deepEqual(await stable(p),before);assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 });
 await check('Project spatial: a delayed model response cannot attach ineligible geometry or reset the camera after a project change',async()=>{
  let release,seen;const withheld=new Promise(r=>release=r),requested=new Promise(r=>seen=r);
  const wrapped={...env,browser:{newContext:async options=>{const context=await env.browser.newContext(options);context.on('page',async p=>{await p.route('**/delayed-project-model.glb',async route=>{seen();await withheld;await route.fulfill({contentType:'model/gltf-binary',body:files.glb()});});});return context;}}};
  const data=board();data.models=[{id:'delayed-model',name:'Delayed North geometry',project:'default',visible:true,url:env.url+'/after/tests/delayed-project-model.glb',fmt:'glb'}];
  const run=await open(wrapped,{data,audience:'?ui=workspaces&workspace=site&workspaceProject=default',liveClock:true}),p=run.page;
  try{
   await requested;await selected(p,'east');await p.waitForFunction(()=>!!__opsTest.three);
   await settled(p);const camera=await p.evaluate(()=>({position:__opsTest.three.camera.position.toArray(),target:__opsTest.three.controls.target.toArray()}));const before=await stable(p);release();await p.waitForFunction(()=>!!__opsTest.loadedObjs['delayed-model'],null,{timeout:60000});await settled(p);
   assert.equal(await p.evaluate(()=>!!__opsTest.loadedObjs['delayed-model'].parent),false);assert.equal(await p.locator('[data-model-toggle="delayed-model"]').count(),0);assert.deepEqual(await p.evaluate(()=>({position:__opsTest.three.camera.position.toArray(),target:__opsTest.three.controls.target.toArray()})),camera);
   await p.evaluate(()=>window.__delayedObject=__opsTest.loadedObjs['delayed-model']);await selected(p,'default');await scene(p,['delayed-model']);assert.ok(await p.evaluate(()=>__opsTest.loadedObjs['delayed-model']===__delayedObject));assert.deepEqual(await stable(p),before);assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
  }finally{release();await run.close();}
 });
 await check('Project spatial: desktop/tablet/mobile assignment controls, empty scopes and Original board preserve all original workflows',async()=>{
  for(const [width,height] of [[1440,900],[768,1024],[390,844]]){
   const data=fixture(env);data.projects.push({id:'empty-project',name:'Empty project',clients:[]});const run=await open(env,{data,width,height,touch:width<1200,audience:'?ui=workspaces&workspace=site'}),p=run.page;
   try{
    await scene(p,['global-model','north-model','east-model','orphan-model']);await layers(p);
    for(const el of await p.locator('[data-lc-project]:visible').all()){assert.ok(await el.evaluate(e=>e.getBoundingClientRect().height>=44));assert.ok(await el.getAttribute('aria-label')||await el.evaluate(e=>!!e.labels?.length));}
    await p.locator('[data-lc-project="north-vector"]').focus();await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');assert.ok(await p.locator('[data-lc-project="north-vector"]').inputValue());assert.ok(await p.locator('[data-lc-project="north-vector"]').evaluate(e=>e===document.activeElement),'Replaced layer assignment retains keyboard focus after change');
    await selected(p,'default');await layers(p);await p.locator('[data-lc-project="global-vector"]').focus();await p.locator('[data-lc-project="global-vector"]').selectOption('east');assert.equal(await p.locator('[data-lc-project="global-vector"]').count(),0);assert.ok(await p.evaluate(()=>document.activeElement.isConnected&&document.activeElement.getClientRects().length&&!!document.activeElement.closest('#mapCard')),'A newly ineligible layer returns focus to an available map control');
    await selected(p,'all');await layers(p);await p.locator('[data-lc-project="global-vector"]').selectOption('');
    await focus(p,'modelCard');for(const el of await p.locator('[data-model-project]:visible').all()){assert.ok(await el.evaluate(e=>e.getBoundingClientRect().height>=44));assert.ok(await el.getAttribute('aria-label')||await el.evaluate(e=>!!e.labels?.length));}
    await p.locator('[data-model-project="north-model"]').focus();await p.locator('[data-model-project="north-model"]').selectOption('east');assert.ok(await p.locator('[data-model-project="north-model"]').evaluate(e=>e===document.activeElement),'Replaced model assignment retains keyboard focus after change');
    await selected(p,'default');await p.locator('[data-model-project="global-model"]').focus();await p.locator('[data-model-project="global-model"]').selectOption('east');assert.equal(await p.locator('[data-model-project="global-model"]').count(),0);assert.ok(await p.evaluate(()=>document.activeElement.isConnected&&document.activeElement.getClientRects().length&&!!document.activeElement.closest('#modelCard')),'A newly ineligible model returns focus to an available viewer control');
    await selected(p,'all');await p.locator('[data-model-project="global-model"]').selectOption('');
    await selected(p,'empty-project');await scene(p,['global-model']);assert.deepEqual(await mapIds(p),['global-vector']);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
    const before=await stable(p);if(width<1200&&!await p.locator('#wsOriginal').isVisible())await p.locator(width<681?'#wsMobileMenu':'#wsMenu').click();await p.locator('#wsOriginal').click();assert.equal(await p.locator('body').evaluate(e=>e.classList.contains('ws-enabled')),false);assert.equal(await p.locator('[data-card]').count(),21);assert.deepEqual(await mapIds(p),['global-vector']);assert.deepEqual(await stable(p),before);
    await p.locator('#wsOptIn').click();await nav(p,'all');assert.equal(await p.locator('[data-card]').count(),21);assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
   }finally{await run.close();}
  }
 });
};
module.exports.fixture=fixture;
