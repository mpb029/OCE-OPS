const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {open}=require('./harness.cjs'),fixture=require('./workspace-fixture.cjs');
module.exports=async({env,selected,shots,records})=>{
 for(const [device,width,height] of [['desktop',1440,900],['tablet-portrait',768,1024],['tablet-landscape',1024,768],['mobile',390,844]]){
  const routes=['operations','resources','quality','coordination'];
  if(![...routes,'form'].some(route=>selected(`c2-${device}-${route}.png`)))continue;
  const captured=new Set();
  // Within a fresh FULL, reuse the identical view captured earlier in THIS run.
  // Never read an earlier run: records and shots belong to its new output directory.
  for(const route of routes){
   const name=`c2-${device}-${route}.png`,source=`editor-${device==='tablet-portrait'?'tablet':device}-${route}.png`;
   if(selected(name)&&records.some(r=>r.name===source&&r.width===width&&r.height===height&&r.audience==='editor'&&r.workspace===route)){
    fs.copyFileSync(path.join(shots,source),path.join(shots,name));captured.add(route);
    records.push({name,width,height,audience:'editor',workspace:route,fixture:'Same synthetic project, audience and viewport',sameRunCapture:source});
   }
  }
  if(routes.every(route=>!selected(`c2-${device}-${route}.png`)||captured.has(route))&&!selected(`c2-${device}-form.png`))continue;
  const run=await open(env,{width,height,touch:width<1200,data:fixture(),liveClock:true,audience:'?ui=workspaces&workspace=operations&workspaceProject=default'}),p=run.page;
  const nav=async route=>{if(await p.locator('#wsMobileMenu').isVisible()&&!await p.locator('#wsSidebar').isVisible())await p.locator('#wsMobileMenu').click();await p.locator(`#wsDestinations [data-ws-route="${route}"]`).click();await p.waitForFunction(r=>document.body.dataset.workspace===r,route);};
  try{
   for(const route of routes){const name=`c2-${device}-${route}.png`;if(!selected(name)||captured.has(route))continue;
    await nav(route);await p.waitForFunction(()=>getComputedStyle(document.querySelector('.fo-navigation')).display==='flex');
    await p.evaluate(async()=>{document.activeElement?.blur();scrollTo(0,0);await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);await p.screenshot({path:path.join(shots,name)});
    records.push({name,width,height,audience:'editor',workspace:route,fixture:'Synthetic review board; original authoritative records',baseline:'C1 be9a80d'});
   }
   const name=`c2-${device}-form.png`;
   if(selected(name)){await nav('coordination');await p.locator('[data-add="rfis"]').click();
    await p.waitForFunction(()=>document.getElementById('itemModal').classList.contains('fo-item-form'));
    await p.locator('#fMain').fill('Confirm tie-in fitting arrangement');
    await p.locator('[data-fx="detail"]').fill('Confirm orientation and shutdown window. Synthetic review only.');
    await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await p.screenshot({path:path.join(shots,name)});records.push({name,width,height,audience:'editor',workspace:'coordination',fixture:'Original RFI form, synthetic inputs; no keyboard or physical-device acceptance claim'});
    await p.locator('#itemModal [data-close]').click();
   }
   assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 }
};
