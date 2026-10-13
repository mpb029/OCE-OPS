const path = require('node:path');
const assert = require('node:assert/strict');
const { start, open, output } = require('./harness.cjs');
(async () => {
 const env = await start();
 try {
  const version = process.argv[2] || 'after';
  for (const [name, width, height] of [['desktop',1440,900], ['mobile',390,844], ...(version==='after' ? [['1920x1080',1920,1080],['1366x768',1366,768],['1024x768',1024,768],['768x1024',768,1024],['375x812',375,812],['360x800',360,800]] : [])]) {
   const run = await open(env, { version, width, height, touch: width < 1100, liveClock: true });
   if(version==='after'&&['desktop','mobile','768x1024'].includes(name)){
    await run.page.waitForTimeout(1200);
    await run.page.screenshot({path:path.join(output,`initial-${name}.png`)});
   }
   if(version==='after' && width<=680) await run.page.locator('.mobile-map-toggle').click();
   const savedLayer = await run.page.evaluate(() => __opsTest.state.mapLayers.find(l => l.type !== 'tiles')?.id);
   await run.page.locator(`[data-lc-zoom="${savedLayer}"]`).click();
   // Use the same real location and satellite zoom in both review captures.
   while(await run.page.evaluate(()=>__opsTest.map.getZoom())>18)await run.page.locator('.leaflet-control-zoom-out').click();
   await run.page.waitForTimeout(1200);
   if(version==='after' && width<=680) await run.page.locator('.mobile-map-toggle').click();
   await run.page.evaluate(()=>scrollTo(0,0));
   await run.page.screenshot({ path: path.join(output, `${version}-${name}.png`) });
   if(version==='after' && (name==='desktop'||name==='mobile')){
    await run.page.screenshot({path:path.join(output,`after-${width}x${height}.png`)});
    await run.page.locator('#panelsGrid').evaluate(el=>el.scrollIntoView({block:'start'}));
    await run.page.screenshot({path:path.join(output,`panels-${width}x${height}.png`)});
    await run.page.locator('[data-add="rfis"]').click();await run.page.waitForTimeout(50);
    await run.page.locator('#fMain').fill('Confirm tie-in arrangement');
    await run.page.locator('[data-fx="detail"]').fill('Confirm the proposed tie-in arrangement and shutdown window.');
    assert.equal(await run.page.locator('#fMain').inputValue(),'Confirm tie-in arrangement');
    await run.page.screenshot({path:path.join(output,`rfi-${width}x${height}.png`)});
    await run.page.keyboard.press('Escape');await run.page.evaluate(()=>scrollTo(0,0));
    await run.page.locator('#headerMenu summary').click();
    await run.page.screenshot({path:path.join(output,`actions-${width}x${height}.png`)});
    await run.page.keyboard.press('Escape');
    if(!(await run.page.locator('#btnSettings').isVisible()))await run.page.locator('#headerMenu summary').click();
    await run.page.locator('#btnSettings').click();await run.page.waitForTimeout(50);
    await run.page.screenshot({path:path.join(output,`settings-${width}x${height}.png`)});
   }
   console.log(JSON.stringify({ version, name, width, documentWidth: await run.page.evaluate(() => document.documentElement.scrollWidth), errors: run.network.errors }));
   await run.close();
  }
  if(version==='after')for(const [name,audience]of [['site','?crew=test-site'],['client-1','?view=test-client-1']]){
   const run=await open(env,{audience,liveClock:true});const p=run.page;
   const savedLayer=await p.evaluate(()=>__opsTest.state.mapLayers.find(l=>l.type!=='tiles')?.id);
   await p.locator(`[data-lc-zoom="${savedLayer}"]`).click();while(await p.evaluate(()=>__opsTest.map.getZoom())>18)await p.locator('.leaflet-control-zoom-out').click();await p.waitForTimeout(1200);
   await p.screenshot({path:path.join(output,`${name}-view.png`)});
   await p.setViewportSize({width:390,height:844});await p.screenshot({path:path.join(output,`${name}-mobile.png`)});await run.close();
  }
 } finally { await env.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
