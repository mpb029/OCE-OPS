const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {start,open,root,output}=require('./harness.cjs'),fixture=require('./workspace-fixture.cjs');
const filter=process.env.OCE_SCREENSHOT_FILTER||'',selected=filter?new RegExp(filter):null;
const shots=path.join(output,'screenshots');fs.mkdirSync(shots,{recursive:true});
(async()=>{const env=await start(),records=[];try{
 for(const [device,width,height,view] of [['desktop',1440,900,'rfi'],['tablet',768,1024,'settings'],['mobile',390,844,'dailyWorks']]) {
  const name=`stage-d-${device}.png`;if(selected&&!selected.test(name))continue;
  const run=await open(env,{width,height,touch:width<1200,data:fixture(),liveClock:true,audience:'?ui=workspaces&workspace=all&workspaceProject=default'}),p=run.page;
  try{
   await p.waitForFunction(()=>document.body.classList.contains('d-forms-enabled')&&[...document.styleSheets].some(s=>s.href?.endsWith('/ui-forms.css')));
   if(view==='settings'){
    if(!await p.locator('#btnSettings').isVisible())await p.locator('#headerMenu summary').click();
    await p.locator('#btnSettings').click();
   }else{
    await p.locator(`[data-add="${view==='rfi'?'rfis':'dailyWorks'}"]`).click();
    await p.waitForFunction(()=>document.activeElement===document.getElementById(document.getElementById('fldRef').style.display==='none'?'fMain':'fRef'));
    await p.locator('#fMain').fill(view==='rfi'?'RFI-024 — Confirm tie-in fitting arrangement':'Install watermain — northern work front');
    if(view==='rfi') await p.locator('[data-fx="detail"]').fill('Confirm the proposed fitting orientation and shutdown window before the tie-in. Synthetic review record.');
    else await p.locator('#fSub').fill('Crew A · Chainage 240–320 · Bedding and pipe installation');
   }
   await p.evaluate(async()=>{document.activeElement?.blur();document.querySelector('.d-form.open .modal-body').scrollTop=0;await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
   await p.screenshot({path:path.join(shots,name)});
   records.push({name,width,height,view,fixture:'Synthetic review board; original controls; no save or publishing',physicalDevice:false});
   assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 }
 assert.ok(records.length,'Screenshot filter matched zero captures');
}finally{await env.close();fs.writeFileSync(path.join(shots,'manifest.json'),JSON.stringify({commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),fullRun:!filter,filter,screenshots:records},null,2));console.log('Captured '+records.length+' Stage D screenshots');}})().catch(e=>{console.error(e);process.exitCode=1;});
