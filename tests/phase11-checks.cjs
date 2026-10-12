const assert = require('node:assert/strict');
const path = require('node:path');
const { open, root } = require('./harness.cjs');
module.exports = async (env, check) => {
 for (const audience of ['', '?crew=test-site', '?view=test-client-1']) {
  await check(`Phase 1.1 mobile landing and one-click activity access: ${audience || 'editor'}`, async () => {
   const run = await open(env, { width:360, height:800, touch:true, audience }); const p = run.page;
   try {
    const state = await p.evaluate(() => structuredClone(__opsTest.state));
    const links = p.locator('.activity-shortcuts a');
    assert.ok(await links.count());
    assert.ok((await links.last().boundingBox()).y < 400);
    for (const link of await links.all()) {
     const target = await link.getAttribute('href');
     assert.equal(await p.locator(target).count(), 1);
     await link.click();
     assert.ok((await p.locator(target).boundingBox()).y < 50, target);
    }
    assert.equal(await p.locator('#map').isVisible(), false);
    assert.equal(await p.locator('#mapHint').isVisible(), false);
    await p.emulateMedia({media:'print'});
    assert.equal(await p.locator('#map').evaluate(el=>getComputedStyle(el).position),'relative','Leaflet positioning must survive print media');
    await p.emulateMedia({media:'screen'});
    await p.locator('.mobile-map-toggle').click();
    assert.equal(await p.locator('#map').isVisible(), true);
    await p.waitForTimeout(200);
    assert.equal(await p.evaluate(() => __opsTest.map.getSize().x), await p.locator('#map').evaluate(el => el.clientWidth));
    await p.waitForFunction(()=>__opsTest.map.getZoom()>1);
    await p.locator('.leaflet-control-zoom-in').click();
    await p.waitForTimeout(300);
    const selectedView=await p.evaluate(()=>({zoom:__opsTest.map.getZoom(),center:__opsTest.map.getCenter()}));
    await p.locator('.mobile-map-toggle').click();
    await p.locator('.mobile-map-toggle').click();
    await p.waitForTimeout(200);
    const reopenedView=await p.evaluate(()=>({zoom:__opsTest.map.getZoom(),center:__opsTest.map.getCenter()}));
    assert.equal(reopenedView.zoom,selectedView.zoom,'Reopening must preserve the user zoom');
    assert.ok(Math.abs(reopenedView.center.lat-selectedView.center.lat)<1e-6&&Math.abs(reopenedView.center.lng-selectedView.center.lng)<1e-6,'Reopening must preserve the user centre');
    await p.setViewportSize({width:1440,height:900});
    assert.equal(await p.locator('#map').isVisible(), true);
    assert.deepEqual(await p.evaluate(() => structuredClone(__opsTest.state)),state);
    assert.deepEqual(run.network.errors,[]);
   } finally { await run.close(); }
  });
 }
 await check('Phase 1.1 visibility labels, readable summary/stats and unchanged one-click flags', async () => {
  const run = await open(env);const p=run.page;
  try {
   for(const selector of ['.sum-v','.stat .lbl','.stat .sf']) assert.ok(await p.locator(selector).first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=13),selector);
   const chip=p.locator('[data-vis^="site:"]').first(),hook=await chip.getAttribute('data-vis');
   assert.equal(await chip.innerText(),'Site');
   const before=await p.evaluate(()=>structuredClone(__opsTest.state));
   await chip.click();
   assert.notDeepEqual(await p.evaluate(()=>structuredClone(__opsTest.state.panels)),before.panels);
   await p.locator(`[data-vis="${hook}"]`).click();
   assert.deepEqual(await p.evaluate(()=>structuredClone(__opsTest.state.panels)),before.panels);
  }finally{await run.close();}
 });
 await check('3D framing: actual G4N geometry fits desktop/tablet/mobile and both up-axes', async () => {
  const run=await open(env,{liveClock:true}),p=run.page;
  try {
   await p.locator('#fileModel').setInputFiles(path.join(root,'G4N.obj'));
   await p.waitForFunction(()=>__opsTest.three && Object.values(__opsTest.loadedObjs).some(o=>o.parent) && __opsTest.three.renderer.info.render.triangles>0,null,{timeout:60000});
   const measurements=[];
   for(const [width,height] of [[1440,900],[768,1024],[390,844]]) {
    await p.setViewportSize({width,height});
    for(let axis=0;axis<2;axis++) {
     await p.locator('[data-mtool="reset"]').click();
     await p.waitForTimeout(120);
     const m=await p.evaluate(()=>{
      const {three,loadedObjs}=__opsTest,min=[Infinity,Infinity],max=[-Infinity,-Infinity];let meshes=0,vertices=0;
      three.camera.updateMatrixWorld(true);
      Object.values(loadedObjs).forEach(o=>o.traverse(c=>{if(!c.isMesh)return;meshes++;const a=c.geometry.attributes.position;vertices+=a.count;for(let i=0;i<a.count;i++){const v=new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(c.matrixWorld).project(three.camera);min[0]=Math.min(min[0],v.x);min[1]=Math.min(min[1],v.y);max[0]=Math.max(max[0],v.x);max[1]=Math.max(max[1],v.y);}}));
      return {min,max,meshes,vertices,aspect:three.camera.aspect,stageAspect:document.getElementById('modelStage').clientWidth/document.getElementById('modelStage').clientHeight};
     });
     assert.equal(m.meshes,8);assert.equal(m.vertices,17640);assert.ok(Math.abs(m.aspect-m.stageAspect)<0.001);
     assert.ok(m.min.every(x=>x>=-1)&&m.max.every(x=>x<=1),JSON.stringify(m));
     assert.ok(Math.max(m.max[0]-m.min[0],m.max[1]-m.min[1])>0.85,'Network occupies a useful fraction of the viewport');
     measurements.push({width,height,...m});await p.locator('[data-model-flip]').click();
    }
   }
   assert.deepEqual(run.network.errors,[]);
   return measurements;
  }finally{await run.close();}
 });
};
