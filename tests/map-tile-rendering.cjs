// Targeted post-release check: real saved G1B tiles, no operational mutations.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {root,output,start,open}=require('./harness.cjs');
const {normalise,tileBefore,tileAfter}=require('./overview-record-source.cjs');
const baseline='48d55e260726a3933b7d89c76ed4f3434cb7d489';
const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/\r\n/g,'\n');
const prior=execFileSync('git',['show',baseline+':index.html'],{cwd:root,encoding:'utf8',maxBuffer:2e6}).replace(/\r\n/g,'\n');
const results=[];
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}catch(error){results.push({name,status:'FAIL',error:error.stack});throw error;}}
async function readyTiles(p){await p.waitForFunction(()=>{
 const tiles=[...document.querySelectorAll('#map img.leaflet-tile')];
 return tiles.length>=4&&tiles.every(e=>e.complete&&e.naturalWidth>0&&getComputedStyle(e).opacity==='1')&&!__opsTest.map._animatingZoom&&!__opsTest.map._panAnim?._inProgress;
});}
async function main(){
 await check('Only the approved tile CSS differs from the deployed application',()=>{
  assert.equal(html.split(tileAfter).length,2);assert.equal(html.replace(tileAfter,tileBefore),prior);
  assert.equal(normalise('index.html',html),normalise('index.html',prior));
  assert.throws(()=>normalise('index.html',html+tileAfter));
  assert.notEqual(normalise('index.html',html.replace(tileAfter,tileAfter+'\n.leaflet-tile {width:257px!important}')),normalise('index.html',prior));
 });
 await check('Current main operational data and attachments unchanged',()=>require('./preservation.cjs')(root,output));
 const env=await start();
 try{
  // The removed rule overrode any inline tileSize, including 512px providers.
  for(const dpr of [1,1.25,2])await check(`Native 256/512px tile dimensions at display scale ${dpr}`,async()=>{
   const ctx=await env.browser.newContext({deviceScaleFactor:dpr,viewport:{width:1100,height:700}});
   try{const p=await ctx.newPage(),styles=[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
    await p.setContent(`<style>${styles}</style><div class="leaflet-container"><img class="leaflet-tile" style="width:256px;height:256px"><img class="leaflet-tile" style="width:512px;height:512px"></div>`);
    assert.deepEqual(await p.locator('.leaflet-tile').evaluateAll(es=>es.map(e=>[parseFloat(getComputedStyle(e).width),parseFloat(getComputedStyle(e).height)])),[[256,256],[512,512]]);
   }finally{await ctx.close();}
  });
  for(const [name,width,height] of [['desktop',1440,900],['reported-layout',978,870],['tablet',768,1024],['phone',390,844]])await check(`G1B ${name}: imagery, zoom, switching and read-only state`,async()=>{
   const run=await open(env,{width,height,touch:width<1200,liveClock:true,audience:'?ui=workspaces&workspace=site'}),p=run.page;
   try{
    const initial=await p.evaluate(()=>JSON.stringify(__opsTest.state));
    await p.evaluate(()=>{const t=__opsTest,r=t.state.mapLayers.find(r=>r.name==='G1B_Dashboard');window.tileOriginalMap=t.map;t.map.fitBounds(t.userLayers[r.id].getBounds(),{padding:[20,20],maxZoom:20,animate:false});});
    await p.locator('#map').scrollIntoViewIfNeeded();await readyTiles(p);
    const dimensions=await p.locator('#map img.leaflet-tile').evaluateAll(es=>es.map(e=>({actual:[getComputedStyle(e).width,getComputedStyle(e).height],assigned:[e.style.width,e.style.height]})));
    for(const tile of dimensions)assert.deepEqual(tile.actual,tile.assigned);
    if(name==='reported-layout'&&env.engine==='chromium'){
     const old=await p.addStyleTag({content:tileBefore});await p.screenshot({path:path.join(output,'g1b-before.png')});await old.evaluate(e=>e.remove());
     await p.screenshot({path:path.join(output,'g1b-after.png')});
    }
    const zoom=await p.evaluate(()=>__opsTest.map.getZoom());
    await p.locator('.leaflet-control-zoom-out').click();await p.waitForFunction(z=>__opsTest.map.getZoom()===z-1,zoom);await readyTiles(p);
    await p.locator('.leaflet-control-zoom-in').click();await p.waitForFunction(z=>__opsTest.map.getZoom()===z,zoom);await readyTiles(p);
    await p.locator('#projSelect').selectOption({label:'SPS G1B Renewal'});await readyTiles(p);
    assert.ok(await p.locator('[data-lc-toggle="sl7ul7e"]').isChecked());
    assert.ok(await p.locator('[data-lc-toggle="by8ida4"]').isChecked());
    const position=await p.evaluate(()=>({center:__opsTest.map.getCenter(),zoom:__opsTest.map.getZoom()}));
    for(const route of ['overview','site']){
     if(await p.locator('#wsMobileMenu').isVisible()&&!await p.locator('#wsSidebar').isVisible())await p.locator('#wsMobileMenu').click();
     await p.locator(`#wsDestinations [data-ws-route="${route}"]`).click();
     await p.waitForFunction(r=>document.body.dataset.workspace===r,route);
    }
    await readyTiles(p);
    // Leaflet rounds its pixel origin when responsive containers are revealed.
    // A subpixel shift is not a reset; bound it to one screen pixel at the same zoom.
    const view=await p.evaluate(before=>{const m=__opsTest.map;return {zoom:m.getZoom(),pixelShift:m.project(m.getCenter()).distanceTo(m.project(before.center))};},position);
    assert.equal(view.zoom,position.zoom);assert.ok(view.pixelShift<=1,JSON.stringify(view));
    assert.ok(await p.evaluate(()=>__opsTest.map===window.tileOriginalMap));
    assert.equal(await p.evaluate(()=>JSON.stringify(__opsTest.state)),initial);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
    assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
   }finally{await run.close();}
  });
 }finally{await env.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>fs.writeFileSync(path.join(output,'map-tile-results.json'),JSON.stringify({engine:process.env.OCE_ENGINE||'chromium',results},null,2)));
