const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {root,open}=require('./harness.cjs'),fixture=require('./workspace-fixture.cjs'),files=require('./fixtures.cjs');
const baseline='97a2f9a2bd7f33d6d6b90dbfcc45a19a874d96ba';
const sizes=[['desktop',1440,900],['portrait tablet',768,1024],['landscape tablet',1024,768],['mobile',390,844]];
const snapshot=p=>p.evaluate(()=>{const payload=__opsTest.shareableState();delete payload.publishedAt;return {state:structuredClone(__opsTest.state),storage:{...localStorage},sync:{...__opsTest.sync},payload};});
async function nav(p,route){if(await p.locator('#wsMobileMenu').isVisible()&&!await p.locator('#wsSidebar').isVisible())await p.locator('#wsMobileMenu').click();await p.locator(`#wsDestinations [data-ws-route="${route}"]`).click();await p.waitForFunction(r=>document.body.dataset.workspace===r,route);}
async function focus(p,id){await p.locator(`.ws-shortcuts [data-ws-target="#${id}"]`).click();await p.waitForFunction(id=>!document.getElementById(id).hasAttribute('data-sp-hidden'),id);}
async function loaded(p){await p.waitForFunction(()=>__opsTest.three?.renderer.info.render.triangles>0,null,{timeout:60000});}
module.exports=async(env,check)=>{
await check('Spatial usability: exact B2 domain, presentation baselines and mandatory assertions retained',()=>{
 for(const file of ['index.html','ui-v2.js','ui-v2.css','ui-workspaces.css','ui-overview.js','ui-overview.css','tests/regression.cjs','tests/overview-checks.cjs','tests/overview-refinement.cjs','tests/overview-source.cjs'])assert.equal(require('./stage-e-source.cjs').normalise(file,fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n')),execFileSync('git',['show',`${baseline}:${file}`],{cwd:root,encoding:'utf8',maxBuffer:2e6}).replace(/\r\n/g,'\n'),file);
 const adapter=fs.readFileSync(path.join(root,'ui-workspaces.js'),'utf8').split('function initSitePresentation(clearTarget)')[1];
 assert.ok(adapter);assert.doesNotMatch(adapter,/localStorage|sessionStorage|fetch\(|shareableState|__opsTest|\.fitBounds\(|\.setView\(|frameAll\(|syncScene\(/);
});
for(const [device,width,height] of sizes)await check(`Spatial usability: ${device} controls, actual map/model interaction and no overflow`,async()=>{
 const data=fixture();data.models=[{id:'shared-review',name:'Synthetic shared model',url:env.url+'/after/tests/fixture.glb',fmt:'glb',visible:true}];
 const run=await open(env,{width,height,touch:width<1200,data,liveClock:true,audience:'?ui=workspaces&workspace=site'}),p=run.page;
 try{
  await loaded(p);const before=await snapshot(p);
  assert.equal(await p.locator('body').getAttribute('data-sp-view'),width>=1200?'both':'map');
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
  if(width<681){await p.locator('#spMapTools').tap();assert.ok(await p.locator('#btnAddMode').isVisible());assert.ok(await p.locator('#btnLoadGeo').isVisible());await p.locator('#spMapTools').tap();assert.equal(await p.locator('#btnLoadGeo').isVisible(),false);}
  // Firefox's protocol subtracts rounded quad coordinates (44 becomes 43.999969).
  // Measure DOMRect.height directly; retain the exact 44 px acceptance threshold.
  for(const el of await p.locator('.ws-shortcuts a:visible,#spLayers:visible,#btnBase:visible,#btnFit:visible,.mobile-map-toggle:visible,.leaflet-control-zoom a:visible').all())assert.ok(await el.evaluate(e=>e.getBoundingClientRect().height>=44),'Touch target '+await el.textContent());
  assert.equal(await p.locator('.layer-ctl').isVisible(),false);
  await p.locator('#spLayers')[width<1200?'tap':'click']();assert.ok(await p.locator('.layer-ctl').isVisible());
  assert.ok(await p.locator('.lc-name').first().evaluate(e=>e.tagName==='LABEL'&&e.control?.matches('[data-lc-toggle]')));
  for(const el of await p.locator('.lc-zoom:visible,.lc-name:visible,#spLayersClose').all())assert.ok(await el.evaluate(e=>e.getBoundingClientRect().height>=44));
  await p.locator('#spLayersClose').focus();await p.keyboard.press('Escape');assert.equal(await p.locator('#spLayers').evaluate(e=>e===document.activeElement),true);
  const zoom=await p.evaluate(()=>__opsTest.map.getZoom());await p.locator('.leaflet-control-zoom-in').click();await p.waitForFunction(z=>__opsTest.map.getZoom()===z+1,zoom);
  await p.waitForFunction(()=>!__opsTest.map._animatingZoom);await p.locator('#map').scrollIntoViewIfNeeded();
  const center=await p.evaluate(()=>{const p=__opsTest.map.getCenter();return [p.lat,p.lng];});
  const box=await p.locator('#map').boundingBox(),point={x:box.x+box.width*.25,y:box.y+box.height*.35};
  assert.ok(await p.evaluate(({x,y})=>!document.elementFromPoint(x,y).closest('.leaflet-marker-icon,.leaflet-control'),point),'Pan starts on map, not a draggable annotation');
  await p.mouse.move(point.x,point.y);await p.mouse.down();await p.mouse.move(point.x+60,point.y+25,{steps:6});await p.mouse.up();
  await p.waitForFunction(c=>{const p=__opsTest.map.getCenter();return p.lat!==c[0]||p.lng!==c[1];},center);
  await focus(p,'modelCard');assert.ok(await p.locator('#modelStage').isVisible());
  const camera=await p.evaluate(()=>__opsTest.three.camera.position.toArray());
  const canvas=await p.locator('.model-canvas').boundingBox();await p.mouse.move(canvas.x+canvas.width*.45,canvas.y+100);await p.mouse.down();await p.mouse.move(canvas.x+canvas.width*.45+50,canvas.y+130,{steps:6});await p.mouse.up();
  await p.waitForFunction(c=>__opsTest.three.camera.position.toArray().some((v,i)=>Math.abs(v-c[i])>1e-5),camera);
  for(const el of await p.locator('#modelToolbar button').all()){assert.ok(await el.evaluate(e=>e.getBoundingClientRect().height>=44));assert.ok(await el.locator('.sp-tool-label').isVisible());}
  await p.locator('[data-mtool="pan"]').click();assert.ok(await p.locator('[data-mtool="pan"]').evaluate(e=>e.classList.contains('on')));
  await p.locator('[data-mtool="full"]').click();await p.waitForFunction(()=>document.fullscreenElement?.id==='modelCard');
  assert.ok((await p.locator('#modelStage').boundingBox()).height>height/2);await p.locator('[data-mtool="full"]').click();await p.waitForFunction(()=>!document.fullscreenElement);
  await p.locator('#btnModelToggle').click();assert.equal(await p.locator('#modelStage').isVisible(),false);
  await focus(p,'modelCard');assert.ok(await p.locator('#modelStage').isVisible());
  await focus(p,'mapCard');await p.locator('.mobile-map-toggle').click();assert.equal(await p.locator('#map').isVisible(),false);
  await focus(p,'mapCard');assert.ok(await p.locator('#map').isVisible());
  if(width>=1200){await p.locator('#spBoth').click();assert.equal(await p.locator('body').getAttribute('data-sp-view'),'both');assert.equal(new URL(p.url()).hash,'');await p.evaluate(()=>document.dispatchEvent(new Event('oce:panels-rendered')));await p.waitForFunction(()=>document.body.dataset.spView==='both');}
  assert.deepEqual(await snapshot(p),before);assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
 }finally{await run.close();}
});
for(const [device,width,height] of sizes)await check(`Spatial usability: ${device} repeated focus/workspace switching preserves imported objects and view state`,async()=>{
 const run=await open(env,{width,height,touch:width<1200,data:fixture(),liveClock:true,audience:'?ui=workspaces&workspace=site'}),p=run.page;
 try{
  await p.locator('#fileModel').setInputFiles(path.join(root,'G4N.obj'));await loaded(p);
  await p.locator('#fileGeo').setInputFiles({name:'synthetic-raster.tif',mimeType:'image/tiff',buffer:files.geotiff()});
  await p.waitForFunction(()=>Object.keys(__opsTest.rasterLayers).length===1);
  await p.locator('#fileGeo').setInputFiles({name:'synthetic-vector.geojson',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',properties:{name:'Synthetic pipeline'},geometry:{type:'LineString',coordinates:[[153.087,-25.9055],[153.089,-25.9065]]}}]}))});
  await p.waitForFunction(()=>__opsTest.state.mapLayers.length===1);
  await focus(p,'mapCard');await p.locator('#spLayers').click();
  const bounds=await p.evaluate(()=>{const map=document.getElementById('map').getBoundingClientRect(),layers=document.querySelector('.layer-ctl').getBoundingClientRect();return {mapBottom:map.bottom,layersBottom:layers.bottom};});
  assert.ok(bounds.layersBottom<=bounds.mapBottom,'Layer list must fit inside its map viewport: '+JSON.stringify(bounds));
  const rasterToggle=p.locator('[data-lc-toggle][data-lc-kind="raster"]');
  await rasterToggle.scrollIntoViewIfNeeded();await rasterToggle.uncheck();await rasterToggle.check();
  assert.ok(await rasterToggle.evaluate(el=>{const b=el.getBoundingClientRect(),m=document.getElementById('map').getBoundingClientRect();return b.top>=m.top&&b.bottom<=m.bottom;}),'Last imported layer is reachable through the scrollable list');
  await p.locator('[data-lc-toggle="__repo__"]').uncheck();
  const vectorId=await p.evaluate(()=>__opsTest.state.mapLayers[0].id);
  await p.locator(`[data-lc-toggle="${vectorId}"]`).uncheck();await p.locator('#spLayersClose').click();
  await focus(p,'modelCard');await p.locator('[data-mtool="pan"]').click();
  await p.evaluate(()=>{
   const t=__opsTest; t.map.setView([-25.9055,153.087],17,{animate:false});
   t.markerLayer.getLayers()[0].openPopup();
   // Deterministic inspection pose, deliberately different from automatic import Fit.
   t.three.camera.position.add(new THREE.Vector3(5,7,11));t.three.controls.target.add(new THREE.Vector3(2,3,4));t.three.controls.update();
  });
  // Wait for OrbitControls' real damping to settle; no timer or retry masks drift.
  await p.evaluate(()=>new Promise(resolve=>{let last=[],stable=0;function frame(){const now=__opsTest.three.camera.position.toArray();stable=now.every((v,i)=>Math.abs(v-last[i])<1e-8)?stable+1:0;last=now;if(stable>=8)resolve();else requestAnimationFrame(frame);}frame();}));
  await p.waitForFunction(()=>!__opsTest.map._panAnim?._inProgress&&!__opsTest.map._animatingZoom);
  await p.evaluate(()=>{const t=__opsTest;window.__c1={map:t.map,three:t.three,scene:t.three.scene,canvas:t.three.renderer.domElement,objects:{...t.loadedObjs},raster:{...t.rasterLayers},markers:t.markerLayer.getLayers(),geo:t.geoLayer,camera:t.three.camera.position.toArray(),target:t.three.controls.target.toArray(),center:t.map.getCenter(),zoom:t.map.getZoom(),session:JSON.stringify(t.sessionModels),mode:t.three.controls.mouseButtons.LEFT};});
  const before=await snapshot(p);
  for(let cycle=0;cycle<2;cycle++)for(const route of ['overview','operations','all','site']){
   await nav(p,route);
   if(route==='site'){await focus(p,'mapCard');await p.locator('#spLayers').click();await p.locator('#spLayersClose').click();await focus(p,'modelCard');}
   const result=await p.evaluate(()=>{const t=__opsTest,b=__c1;return {same:t.map===b.map&&t.three===b.three&&t.three.scene===b.scene&&t.three.renderer.domElement===b.canvas&&t.geoLayer===b.geo&&b.markers.every(m=>t.markerLayer.hasLayer(m))&&Object.entries(b.objects).every(([id,o])=>t.loadedObjs[id]===o&&o.parent===b.scene)&&Object.entries(b.raster).every(([id,r])=>t.rasterLayers[id]===r&&t.map.hasLayer(r.layer)),pixels:t.map.project(t.map.getCenter()).distanceTo(t.map.project(b.center)),zoom:t.map.getZoom()===b.zoom,camera:t.three.camera.position.toArray().every((v,i)=>Math.abs(v-b.camera[i])<1e-7),target:t.three.controls.target.toArray().every((v,i)=>Math.abs(v-b.target[i])<1e-7),session:JSON.stringify(t.sessionModels)===b.session,mode:t.three.controls.mouseButtons.LEFT===b.mode,triangles:t.three.renderer.info.render.triangles};});
   assert.ok(result.same&&result.zoom&&result.camera&&result.target&&result.session&&result.mode,JSON.stringify(result));assert.ok(result.pixels<1,`${route} cycle ${cycle}: map centre rounding stays below one pixel (${result.pixels})`);assert.ok(result.triangles>0);
   assert.equal(await p.evaluate(()=>__opsTest.map.hasLayer(__opsTest.geoLayer)),false,'Hidden base layer stays hidden');
   assert.ok(await p.evaluate(()=>__opsTest.markerLayer.getLayers()[0].isPopupOpen()),'Annotation popup preserved');
  }
  assert.deepEqual(await snapshot(p),before);assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
 }finally{await run.close();}
});
for(const [role,key] of [['site','crew=test-site'],['client','view=test-client-0']])await check(`Spatial usability: ${role} retains baseline controls and original spatial display rules`,async()=>{
 const data=fixture();const run=await open(env,{width:768,height:1024,touch:true,data,audience:'?ui=workspaces&workspace=site&'+key}),p=run.page;
 try{
  assert.equal(await p.locator('.ws-shortcuts a').allTextContents().then(x=>x.some(s=>s.includes('3D'))),false);
  for(const id of ['btnAddMode','btnLoadGeo','modelTools'])assert.equal(await p.locator('#'+id).isVisible(),false,id);
  // The original viewer exposes Imagery. C1 preserves that existing exception.
  assert.ok(await p.locator('#btnImagery').isVisible());
  await p.locator('#spLayers').click();assert.ok(await p.locator('[data-lc-toggle="__repo__"]').isVisible());
  assert.equal(await p.locator('.lc-remove:visible,.lc-style:visible,.lc-clear:visible').count(),0);
  assert.equal(await p.evaluate(()=>__opsTest.markerLayer.getLayers().length),role==='site'?1:0);
  const before=await snapshot(p);await p.locator('#spLayersClose').click();await nav(p,'overview');await nav(p,'site');assert.deepEqual(await snapshot(p),before);
  assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
 }finally{await run.close();}
});
await check('Spatial usability: empty viewer, deep links, keyboard focus and Original board rollback',async()=>{
 const run=await open(env,{width:768,height:1024,data:fixture(),audience:'?ui=workspaces&workspace=site#modelCard'}),p=run.page;
 try{
  assert.equal(await p.locator('body').getAttribute('data-sp-view'),'model');assert.ok(await p.locator('#modelStage').isVisible());assert.match(await p.locator('#modelEmpty').innerText(),/No 3D model/);
  const before=await snapshot(p);await p.locator('.ws-shortcuts [data-ws-target="#mapCard"]').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('body').getAttribute('data-sp-view'),'map');
  await p.locator('#wsOriginal').click();assert.equal(await p.locator('body').evaluate(e=>e.classList.contains('sp-site')),false);assert.equal(await p.locator('#spLayers').isVisible(),false);assert.ok(await p.locator('.layer-ctl').isVisible());assert.equal(await p.locator('.layer-ctl').evaluate(e=>e.inert),false);
  assert.deepEqual(await snapshot(p),before);assert.equal(await p.locator('[data-card]').count(),21);assert.equal(run.network.writes.length,0);
 }finally{await run.close();}
});
};
