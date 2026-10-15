const path=require('node:path'),assert=require('node:assert/strict');
const {root,open}=require('./harness.cjs'),fixture=require('./workspace-fixture.cjs'),files=require('./fixtures.cjs');
module.exports=async({env,selected,shots,records})=>{
 for(const [device,width,height] of [['desktop',1440,900],['tablet-portrait',768,1024],['tablet-landscape',1024,768],['mobile',390,844]]){
  const views=['map','model','layers',...(width===1440?['both']:[])];
  if(!views.some(view=>selected(`c1-${device}-${view}.png`)))continue;
  const run=await open(env,{width,height,touch:width<1200,data:fixture(),liveClock:true,audience:'?ui=workspaces&workspace=site&workspaceProject=default'}),p=run.page;
  try{
   await p.locator('#fileModel').setInputFiles(path.join(root,'G4N.obj'));
   await p.waitForFunction(()=>__opsTest.three?.renderer.info.render.triangles>0,null,{timeout:60000});
   await p.evaluate(()=>__opsTest.map.setView([-25.9055,153.087],17,{animate:false}));
   await p.waitForFunction(()=>getComputedStyle(document.getElementById('toast')).opacity==='0');
   for(const view of views){
    const name=`c1-${device}-${view}.png`;if(!selected(name))continue;
    await p.locator(`.ws-shortcuts [data-ws-target="#${view==='model'?'modelCard':'mapCard'}"]`).click();
    if(view==='both')await p.locator('#spBoth').click();
    if(view==='layers'){
     await p.locator('#fileGeo').setInputFiles({name:'Review alignment.geojson',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({type:'Feature',properties:{name:'Synthetic review alignment'},geometry:{type:'LineString',coordinates:[[153.087,-25.9055],[153.089,-25.9065]]}}))});
     await p.waitForFunction(()=>__opsTest.state.mapLayers.length===1);
     await p.locator('#fileGeo').setInputFiles({name:'Review imagery.tif',mimeType:'image/tiff',buffer:files.geotiff()});await p.waitForFunction(()=>Object.keys(__opsTest.rasterLayers).length===1);
     await p.evaluate(()=>__opsTest.map.setView([-25.9055,153.087],17,{animate:false}));
     await p.waitForFunction(()=>getComputedStyle(document.getElementById('toast')).opacity==='0');
     await p.locator('#spLayers').click();await p.locator('[data-lc-toggle][data-lc-kind="raster"]').scrollIntoViewIfNeeded();
    }
    else if(await p.locator('#spLayers').getAttribute('aria-expanded')==='true')await p.locator('#spLayers').click();
    await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{document.activeElement?.blur();scrollTo(0,0);resolve();}))));
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
    await p.screenshot({path:path.join(shots,name)});
    records.push({name,width,height,audience:'editor',workspace:'site',view,fixture:'Synthetic review board',model:'Actual unchanged G4N.obj, session import',triangles:await p.evaluate(()=>__opsTest.three.renderer.info.render.triangles),importedLayers:await p.evaluate(()=>[...__opsTest.state.mapLayers.map(l=>l.name),...Object.values(__opsTest.rasterLayers).map(l=>l.name)])});
   }
   assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 }
};
