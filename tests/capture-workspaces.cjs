const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {start,open,root,output}=require('./harness.cjs');
const fixture=require('./workspace-fixture.cjs');
const shots=path.join(output,'screenshots');fs.mkdirSync(shots,{recursive:true});
const records=[];
const filter=process.env.OCE_SCREENSHOT_FILTER||'';
const expression=filter?new RegExp(filter):null;
const selected=name=>!expression||expression.test(name);
(async()=>{const env=await start();try{
 for(const [device,width,height] of [['desktop',1440,900],['tablet',768,1024],['mobile',390,844]]){
  for(const [audience,key] of [['editor',''],['site','crew=test-site'],['client','view=test-client-0']]){
   const routes=audience==='editor'?['all','operations','quality','coordination','documents','resources','site','overview']:['operations','all','overview'];
   const extras=audience==='editor'?['rfi',...(device==='desktop'?[]:['drawer'])]:[];
   if(![...routes,...extras].some(route=>selected(`${audience}-${device}-${route}.png`)))continue;
   const run=await open(env,{width,height,touch:width<1100,data:fixture(),liveClock:true,audience:`?ui=workspaces&workspace=operations&workspaceProject=default&${key}`});const p=run.page;
   try{
    for(const route of routes){
     if(!selected(`${audience}-${device}-${route}.png`))continue;
     if(device==='mobile')await p.locator('#wsMobileMenu').click();
     await p.locator(`#wsDestinations [data-ws-route="${route}"]`).click();
     await p.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0);});await p.waitForTimeout(400);
     assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
     const name=`${audience}-${device}-${route}.png`;await p.screenshot({path:path.join(shots,name)});records.push({name,width,height,audience,workspace:route,fixture:'Synthetic review board',model:'none'});
    }
    if(audience==='editor'&&extras.some(route=>selected(`editor-${device}-${route}.png`))){
     if(device==='mobile')await p.locator('#wsMobileMenu').click();
     await p.locator('#wsDestinations [data-ws-route="coordination"]').click();
     if(selected(`editor-${device}-rfi.png`)){
     await p.locator('[data-add="rfis"]').click();await p.waitForTimeout(70);await p.locator('#fMain').fill('Review tie-in arrangement');await p.locator('[data-fx="detail"]').fill('Confirm fitting orientation and the agreed shutdown window. Synthetic review only.');
     const name=`editor-${device}-rfi.png`;await p.screenshot({path:path.join(shots,name)});records.push({name,width,height,audience,workspace:'coordination',fixture:'Synthetic review board; original RFI form'});await p.keyboard.press('Escape');
     }
     if(device!=='desktop'&&selected(`editor-${device}-drawer.png`)){
      await p.locator(device==='mobile'?'#wsMobileMenu':'#wsMenu').click();const name=`editor-${device}-drawer.png`;await p.screenshot({path:path.join(shots,name)});records.push({name,width,height,audience,workspace:'navigation',fixture:'Synthetic review board'});await p.keyboard.press('Escape');
     }
    }
    assert.deepEqual(run.network.errors,[]);assert.equal(run.network.writes.length,0);
   }finally{await run.close();}
  }
 }
 if(selected('editor-desktop-site-g4n.png')){
 const run=await open(env,{data:fixture(),audience:'?ui=workspaces&workspace=site',liveClock:true});
 try{const p=run.page;await p.locator('#fileModel').setInputFiles(path.join(root,'G4N.obj'));await p.waitForFunction(()=>__opsTest.three?.renderer.info.render.triangles>0,null,{timeout:60000});await p.locator('#modelCard').scrollIntoViewIfNeeded();await p.waitForTimeout(300);const name='editor-desktop-site-g4n.png';await p.screenshot({path:path.join(shots,name)});records.push({name,width:1440,height:900,audience:'editor',workspace:'site',fixture:'Synthetic board',model:'Actual unchanged G4N.obj, session import'});}finally{await run.close();}
 }
 await require('./capture-spatial.cjs')({env,selected,shots,records});
 assert.ok(records.length,'Screenshot filter matched zero captures');
}finally{await env.close();fs.writeFileSync(path.join(shots,'manifest.json'),JSON.stringify({commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),fullRun:!filter,filter,screenshots:records},null,2));console.log('Captured '+records.length+' actual application screenshots');}})().catch(e=>{console.error(e);process.exitCode=1;});
