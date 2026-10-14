const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {start,open,root,output}=require('./harness.cjs'),spatial=require('./project-spatial.cjs');
const filter=process.env.OCE_SCREENSHOT_FILTER||'',selected=filter?new RegExp(filter):null;
const shots=path.join(output,'screenshots');fs.mkdirSync(shots,{recursive:true});
(async()=>{const env=await start(),records=[];try{
 for(const [device,width,height,view] of [['desktop',1440,900,'map-and-model'],['tablet',768,1024,'project-layers'],['mobile',390,844,'project-model']]){
  const name=`stage-e-${device}.png`;if(selected&&!selected.test(name))continue;
  const data=spatial.fixture(env);data.models=[{id:'north-review-model',name:'North workfront · Civil model',project:'default',url:env.url+'/after/G4N.obj',fmt:'obj',upAxis:'z',visible:true}];
  const run=await open(env,{width,height,touch:width<1200,data,liveClock:true,audience:'?ui=workspaces&workspace=site&workspaceProject=default'}),p=run.page;
  try{
   await p.waitForFunction(()=>__opsTest.three?.renderer.info.render.triangles>0,null,{timeout:60000});await p.waitForFunction(()=>__opsTest.geoLayer?.getLayers().length===4);
   await p.evaluate(()=>__opsTest.map.setView([-25.905,153.089],16,{animate:false}));
   if(view==='project-model')await p.locator('.ws-shortcuts [data-ws-target="#modelCard"]').click();
   else{await p.locator('.ws-shortcuts [data-ws-target="#mapCard"]').click();if(view==='map-and-model')await p.locator('#spBoth').click();else await p.locator('#spLayers').click();}
   await p.evaluate(async()=>{await document.fonts.ready;document.activeElement?.blur();scrollTo(0,0);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);await p.screenshot({path:path.join(shots,name)});
   records.push({name,width,height,view,project:'Synthetic North workfront',fixture:'Synthetic project assignments and operational records',model:'Unchanged G4N.obj; hosted locally by test harness',triangles:await p.evaluate(()=>__opsTest.three.renderer.info.render.triangles),physicalDevice:false});assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 }
 assert.ok(records.length,'Screenshot filter matched zero captures');
}finally{await env.close();fs.writeFileSync(path.join(shots,'manifest.json'),JSON.stringify({commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),fullRun:!filter,filter,screenshots:records},null,2));console.log('Captured '+records.length+' Stage E screenshots');}})().catch(e=>{console.error(e);process.exitCode=1;});
