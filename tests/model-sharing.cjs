// Focused shared-model workflow checks. Synthetic board/files; all GitHub writes intercepted.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const {root,output,start,open}=require('./harness.cjs'),fixture=require('./workspace-fixture.cjs'),files=require('./fixtures.cjs');
const fast=process.argv.includes('--fast'),capture=process.argv.includes('--screenshot'),results=[],startedAt=new Date().toISOString();
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim(),commit=git(['rev-parse','HEAD']);
const digest=file=>createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const inputs=['index.html','ifc-loader.js','ifc-controls.js','ui-spatial.css','ui-workspaces.js','tests/model-sharing.cjs','tests/harness.cjs','tests/fixtures.cjs','tests/fixtures-ifc/transformed-millimetres-ifc4.ifc'];
const hashes=()=>Object.fromEntries(inputs.map(file=>[file,digest(file)])),sourceHashes=hashes(),dataHash=digest('data.json');
const small=path.join(root,'tests/fixtures-ifc/transformed-millimetres-ifc4.ifc');
const glb={name:'Shared site model.glb',mimeType:'model/gltf-binary',buffer:files.glb()};
const ifc={name:'Shared coordination.ifc',mimeType:'application/octet-stream',buffer:fs.readFileSync(small)};
const models=p=>p.evaluate(()=>structuredClone(__opsTest.state.models));
const snapshot=p=>p.evaluate(()=>({state:structuredClone(__opsTest.state),storage:{...localStorage},dirty:__opsTest.sync.dirty}));
const uploadWrites=run=>run.network.writes.filter(write=>/\/contents\/files\/models\//.test(write.url));
const publishWrites=run=>run.network.writes.filter(write=>/\/contents\/data\.json$/.test(write.url));
const board=()=>{const data=fixture();data.models=[];return data;};
async function entry(env,options={}){
 const run=await open(env,{data:board(),token:true,liveClock:true,audience:'?ui=workspaces&workspace=site&workspaceProject=default',...options});
 run.uploadFailure=false;run.holdUpload=null;
 await run.page.route('https://api.github.com/repos/regression-fixture/test-board/contents/files/models/**',async route=>{
  const req=route.request();if(req.method()==='GET')return route.fulfill({json:{sha:'test-model-sha'}});
  const body=req.postDataJSON();run.network.writes.push({url:req.url(),method:req.method(),body});
  if(run.holdUpload)await run.holdUpload;
  if(run.uploadFailure)return route.fulfill({status:403,json:{message:'Synthetic upload rejection'}});
  const target=/\.ifc$/i.test(body.message)?'tests/fixtures-ifc/transformed-millimetres-ifc4.ifc':'tests/fixture.glb';
  return route.fulfill({json:{content:{sha:'test-model-sha',download_url:env.url+'/after/'+target},commit:{sha:'test-upload-commit'}}});
 });
 return run;
}
async function focus(p){const shortcut=p.locator('.ws-shortcuts [data-ws-target="#modelCard"]');if(await shortcut.isVisible())await shortcut.click();await p.locator('#modelCard').scrollIntoViewIfNeeded();}
async function modal(p){await focus(p);await p.locator('#btnModelShare').click();await p.locator('#modelShareModal').waitFor({state:'visible'});}
async function select(p,file=glb){await p.locator('#modelShareFile').setInputFiles(file);}
async function uploaded(p){await p.waitForFunction(()=>__opsTest.state.models.length>0);return(await models(p)).at(-1);}
async function loaded(p,id){await p.waitForFunction(id=>!!__opsTest.three&&__opsTest.loadedObjs[id]?.parent===__opsTest.three.scene&&__opsTest.three.renderer.info.render.triangles>0,id,{timeout:90000});}
async function settled(p){await p.evaluate(()=>new Promise(resolve=>{let prior=[],stable=0;function tick(){const t=__opsTest.three,next=[...t.camera.position.toArray(),...t.controls.target.toArray()];stable=next.every((n,i)=>Math.abs(n-prior[i])<1e-8)?stable+1:0;prior=next;if(stable>=8)resolve();else requestAnimationFrame(tick);}tick();}));}
async function close(p){await p.locator('#modelShareModal [data-close]').click();await p.locator('#modelShareModal').waitFor({state:'hidden'});}
async function nav(p,route){if(await p.locator('#wsMobileMenu').isVisible()&&!await p.locator('#wsSidebar').isVisible())await p.locator('#wsMobileMenu').click();await p.locator(`#wsDestinations [data-ws-route="${route}"]`).click();await p.waitForFunction(route=>document.body.dataset.workspace===route,route);}
async function exported(p){if(!await p.locator('#btnExport').isVisible())await p.locator('#headerMenu summary').click();const pending=p.waitForEvent('download');await p.locator('#btnExport').click();return JSON.parse(fs.readFileSync(await(await pending).path(),'utf8'));}
async function restore(p,data){await p.locator('#fileImport').setInputFiles({name:'synthetic-model-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});const pending=p.waitForEvent('download');await p.locator('#importBackup').click();await pending;await p.locator('#importBackupSaved').check();await p.locator('#importConfirm').click();await p.locator('#importModal').waitFor({state:'hidden'});}
async function check(name,fn){const start=Date.now();try{await fn();results.push({name,status:'PASS',ms:Date.now()-start});console.log('PASS '+name);}catch(error){results.push({name,status:'FAIL',ms:Date.now()-start,error:error.stack});console.error('FAIL '+name+'\n'+error.stack);}}
async function safe(run){assert.deepEqual(run.network.errors,[]);assert.ok(run.network.writes.every(write=>write.method==='PUT'&&/regression-fixture\/test-board\/contents\/(files\/models\/|data\.json$)/.test(write.url)),'Only synthetic model upload or deliberate Publish');}

(async()=>{
 const env=await start();
 try{
  await check('Sharing: explicit IFC and GLB upload creates ordinary project records and visible geometry, never an automatic board publish',async()=>{
   for(const file of [ifc,glb]){
    const run=await entry(env),p=run.page;
    try{
     const before=await snapshot(p);await modal(p);assert.equal(await p.locator('#modelShareProject').inputValue(),'default');assert.equal(await p.locator('#modelSharePublish').isVisible(),false);
     await select(p,file);await p.locator('#modelShareName').fill('Synthetic shared coordination');assert.equal(run.network.writes.length,0);assert.deepEqual(await snapshot(p),before);
     await p.locator('#modelShareUpload').click();const saved=await uploaded(p);await loaded(p,saved.id);
     assert.equal(saved.name,'Synthetic shared coordination');assert.equal(saved.project,'default');assert.equal(saved.visible,true);assert.equal(saved.fmt,file===ifc?'ifc':'glb');assert.match(saved.url,/^http:\/\/127\.0\.0\.1:/);assert.equal(saved.url.startsWith('blob:'),false);
     assert.equal(uploadWrites(run).length,1);assert.equal(publishWrites(run).length,0);assert.equal(uploadWrites(run)[0].body.branch,'test-only');assert.deepEqual(Buffer.from(uploadWrites(run)[0].body.content,'base64'),file.buffer);
     const after=await snapshot(p);assert.equal(after.dirty,true);assert.deepEqual(JSON.parse(after.storage.offaly_ops_v1).models,[saved]);assert.deepEqual(after.state.panels,before.state.panels);assert.deepEqual(after.state.mapLayers,before.state.mapLayers);
     const geometry=await p.evaluate(id=>{const o=__opsTest.loadedObjs[id],box=new THREE.Box3().setFromObject(o);return{size:box.getSize(new THREE.Vector3()).toArray(),elements:o.userData.ifc?.elements.length,finite:[...box.min.toArray(),...box.max.toArray()].every(Number.isFinite)};},saved.id);
     assert.ok(geometry.finite&&geometry.size.every(n=>n>0));if(file===ifc)assert.equal(geometry.elements,2);assert.equal(await p.locator('#modelSharePublish').isVisible(),true);if(capture&&env.engine==='chromium'&&file===ifc)await p.screenshot({path:path.join(output,'model-sharing.png')});await safe(run);
    }finally{await run.close();}
   }
  });
  await check('Sharing: session IFC promotion keeps stable ID, object, camera, inspection state and workspace navigation',async()=>{
   const run=await entry(env),p=run.page;
   try{
    await focus(p);await p.locator('#fileModel').setInputFiles(ifc);await p.waitForFunction(()=>Object.keys(__opsTest.sessionModels).length===1);const id=await p.evaluate(()=>Object.keys(__opsTest.sessionModels)[0]);await loaded(p,id);assert.equal((await models(p)).length,0);assert.equal(run.network.writes.length,0);
    await p.locator(`[data-model-project="${id}"]`).selectOption('default');
    const toggle=p.locator('[data-ifc-element]').first();while(!await toggle.isVisible()){const details=toggle.locator('xpath=ancestor::details[not(@open)]').first();if(!await details.count())break;await details.locator(':scope > summary').click();}await toggle.uncheck();await p.locator('#ifcSectionEnabled').check();
    await p.locator('[data-mtool="zoomin"]').click();await settled(p);
    const before=await p.evaluate(id=>{const t=__opsTest,o=t.loadedObjs[id],v=o.userData.ifcView;window.__modelBefore={object:o,viewer:t.three,view:v};return{camera:t.three.camera.position.toArray(),target:t.three.controls.target.toArray(),hidden:[...v.hidden],section:v.sectionEnabled};},id);
    await p.locator(`[data-model-share="${id}"]`).click();await p.locator('#modelShareModal').waitFor({state:'visible'});assert.equal(await p.locator('#modelShareProject').inputValue(),'default');await p.locator('#modelShareName').fill('Renamed shared coordination');await p.locator('#modelShareUpload').click();const saved=await uploaded(p);assert.equal(saved.id,id);assert.equal(saved.name,'Renamed shared coordination');await close(p);assert.equal(await p.locator('#ifcModel option:checked').textContent(),'Renamed shared coordination');
    await nav(p,'operations');await nav(p,'site');await settled(p);
    const after=await p.evaluate(id=>{const t=__opsTest,o=t.loadedObjs[id],v=o.userData.ifcView;return{camera:t.three.camera.position.toArray(),target:t.three.controls.target.toArray(),hidden:[...v.hidden],section:v.sectionEnabled,same:o===__modelBefore.object&&t.three===__modelBefore.viewer&&v===__modelBefore.view,session:!!t.sessionModels[id],inScene:o.parent===t.three.scene};},id);
    assert.equal(after.same,true);assert.equal(after.session,false);assert.equal(after.inScene,true);for(const key of ['camera','target'])after[key].forEach((n,i)=>assert.ok(Math.abs(n-before[key][i])<1e-7,key+' preserved'));assert.deepEqual(after.hidden,before.hidden);assert.equal(after.section,true);assert.equal(uploadWrites(run).length,1);assert.equal(publishWrites(run).length,0);await safe(run);
   }finally{await run.close();}
  });
  if(!fast){
   await check('Sharing: reload, JSON backup and deliberate existing Publish preserve uploaded model and unrelated local work',async()=>{
    const run=await entry(env),p=run.page;
    try{
     await modal(p);await select(p);await p.locator('#modelShareUpload').click();const saved=await uploaded(p);await loaded(p,saved.id);await close(p);const backup=await exported(p);
     await p.reload();await p.waitForFunction(()=>__opsTest?.ready);assert.deepEqual(await models(p),[saved]);await loaded(p,saved.id);
     await focus(p);await p.locator(`[data-model-del="${saved.id}"]`).click();assert.deepEqual(await models(p),[]);assert.equal(run.network.writes.length,1);await restore(p,backup);assert.deepEqual(await models(p),backup.models);assert.deepEqual((await snapshot(p)).state.panels,backup.panels);
     // A second explicit upload exposes the existing board Publish action.
     await modal(p);await select(p);await p.locator('#modelShareName').fill('Second model');await p.locator('#modelShareUpload').click();await p.waitForFunction(()=>__opsTest.state.models.length===2);assert.equal(publishWrites(run).length,0);
     const expected=await p.evaluate(()=>__opsTest.shareableState());await p.locator('#modelSharePublish').click();await p.waitForFunction(()=>!__opsTest.sync.busy&&!__opsTest.sync.dirty);assert.equal(publishWrites(run).length,1);
     const payload=JSON.parse(Buffer.from(publishWrites(run)[0].body.content,'base64').toString());delete payload.publishedAt;delete expected.publishedAt;assert.deepEqual(payload,expected);assert.deepEqual(payload.panels,backup.panels);await safe(run);
    }finally{await run.close();}
   });
   await check('Sharing: cancellation, unsupported/empty/oversized files and external-resource GLTF do not upload or change the board',async()=>{
    const run=await entry(env),p=run.page;
    try{
     const before=await snapshot(p);await modal(p);await select(p);await close(p);assert.deepEqual(await snapshot(p),before);
     const external=files.gltf();external.buffers[0].uri='external.bin';
     for(const file of [{name:'bad.rvt',mimeType:'application/octet-stream',buffer:Buffer.from('unsupported')},{name:'empty.ifc',mimeType:'application/octet-stream',buffer:Buffer.alloc(0)},{name:'large.glb',mimeType:'model/gltf-binary',buffer:Buffer.alloc(25*1024*1024+1)},{name:'external.gltf',mimeType:'model/gltf+json',buffer:Buffer.from(JSON.stringify(external))}]){
      await modal(p);await select(p,file);if(await p.locator('#modelShareUpload').isEnabled())await p.locator('#modelShareUpload').click();await p.waitForFunction(()=>document.querySelector('#modelShareStatus').textContent.trim().length>0);assert.equal(run.network.writes.length,0,file.name+' must not upload');assert.deepEqual(await snapshot(p),before);await close(p);
     }
     await safe(run);
    }finally{await run.close();}
   });
   await check('Sharing: failed upload retains selection; in-flight controls prevent duplicate/cancel actions and preserve original project',async()=>{
    const run=await entry(env),p=run.page;
    try{
     const before=await snapshot(p);run.uploadFailure=true;await modal(p);await select(p);await p.locator('#modelShareUpload').click();await p.waitForFunction(()=>!document.querySelector('#modelShareUpload').disabled&&/failed|rejected|403/i.test(document.querySelector('#modelShareStatus').textContent));assert.deepEqual(await snapshot(p),before);assert.equal(await p.locator('#modelShareFile').evaluate(input=>input.files.length),1);assert.equal(uploadWrites(run).length,1);
     run.uploadFailure=false;let finish;run.holdUpload=new Promise(resolve=>finish=resolve);await p.locator('#modelShareUpload').click();await p.waitForFunction(()=>document.querySelector('#modelShareUpload').disabled);assert.equal(await p.locator('#modelShareModal [data-close]').isEnabled(),false);await p.keyboard.press('Escape');assert.equal(await p.locator('#modelShareModal').isVisible(),true);
     // Project changes from another context while the network request is pending must not relabel the chosen project.
     await p.locator('#projSelect').evaluate(select=>{select.value='east';select.dispatchEvent(new Event('change',{bubbles:true}));});finish();const saved=await uploaded(p);assert.equal(saved.project,'default');assert.equal(uploadWrites(run).length,2,'One rejected request and one explicit retry');assert.equal(publishWrites(run).length,0);assert.equal((await models(p)).length,1);await safe(run);
    }finally{await run.close();}
   });
   await check('Sharing: Site/Client filtering and locked/no-token guards retain display rules with no file writes',async()=>{
    const data=board();data.models=[{id:'global-model',name:'Global shared model',url:env.url+'/after/tests/fixture.glb',fmt:'glb',visible:true},{id:'north-model',name:'North shared model',url:env.url+'/after/tests/fixture.glb',fmt:'glb',visible:true,project:'default'},{id:'east-model',name:'East private model',url:env.url+'/after/tests/fixture.glb',fmt:'glb',visible:true,project:'east'}];
    for(const [audience,ids] of [['crew=test-site',['global-model','north-model']],['view=test-client-0',['global-model','north-model']],['view=test-client-1',['global-model','east-model']]]){
     const run=await entry(env,{data,audience:'?ui=workspaces&workspace=site&workspaceProject='+(audience.endsWith('-1')?'all':'default')+'&'+audience}),p=run.page;
     try{
      await loaded(p,'global-model');assert.equal(await p.locator('#btnModelShare').isVisible(),false);assert.equal(await p.locator('[data-model-share]:visible').count(),0);assert.deepEqual((await p.locator('[data-model-toggle]').evaluateAll(nodes=>nodes.map(n=>n.dataset.modelToggle))).sort(),ids.sort());
      const before=await snapshot(p);await p.locator('#btnModelShare').evaluate(button=>button.click());assert.equal(await p.locator('#modelShareModal').isVisible(),false);assert.deepEqual(await snapshot(p),before);assert.equal(run.network.writes.length,0);await safe(run);
     }finally{await run.close();}
    }
    const locked=board();locked.settings.editPass='synthetic-nonempty-lock';const run=await entry(env,{data:locked}),p=run.page;
    try{assert.equal(await p.locator('#lockScreen').isVisible(),true);await p.locator('#btnModelShare').evaluate(button=>button.click());assert.equal(await p.locator('#modelShareModal').isVisible(),false);assert.equal(run.network.writes.length,0);}finally{await run.close();}
    const disconnected=await entry(env,{token:false});try{await focus(disconnected.page);await disconnected.page.locator('#btnModelShare').click();await disconnected.page.locator('#settingsModal').waitFor({state:'visible'});assert.equal(disconnected.network.writes.length,0);assert.deepEqual(await models(disconnected.page),[]);}finally{await disconnected.close();}
   });
   await check('Sharing: portrait tablet and phone dialog fits; All Projects defaults to Global and keyboard Cancel remains safe',async()=>{
    for(const [width,height] of [[768,1024],[390,844]]){
     const run=await entry(env,{width,height,touch:true,audience:'?ui=workspaces&workspace=site&workspaceProject=all'}),p=run.page;
     try{
      const before=await snapshot(p);await modal(p);assert.equal(await p.locator('#modelShareProject').inputValue(),'');await select(p);const box=await p.locator('#modelShareModal .modal').boundingBox(),button=await p.locator('#modelShareUpload').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);assert.ok(button.y>=0&&button.y+button.height<=height+1);assert.ok(button.height>=40);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
      await p.keyboard.press('Escape');await p.locator('#modelShareModal').waitFor({state:'hidden'});assert.deepEqual(await snapshot(p),before);assert.equal(run.network.writes.length,0);await safe(run);
     }finally{await run.close();}
    }
   });
   await check('Sharing: removed project requires explicit reassignment and an in-flight board Publish blocks model upload',async()=>{
    const run=await entry(env,{audience:'?ui=workspaces&workspace=site&workspaceProject=all'}),p=run.page;
    try{
     await focus(p);await p.locator('#fileModel').setInputFiles(glb);await p.waitForFunction(()=>Object.keys(__opsTest.sessionModels).length===1);const id=await p.evaluate(()=>Object.keys(__opsTest.sessionModels)[0]);await loaded(p,id);await p.locator(`[data-model-project="${id}"]`).selectOption('east');
     await p.locator('#btnSettings').click();await p.locator('[data-proj-del="east"]').evaluate(button=>button.click());await p.locator('#settingsModal [data-close]').click();await p.locator(`[data-model-share="${id}"]`).click();assert.equal(await p.locator('#modelShareProject').inputValue(),'east');assert.match(await p.locator('#modelShareProject option:checked').innerText(),/Unavailable project/);
     await p.locator('#modelShareUpload').click();await p.waitForFunction(()=>/project/i.test(document.querySelector('#modelShareStatus').textContent));assert.equal(run.network.writes.length,0);assert.deepEqual(await models(p),[]);assert.equal(await p.evaluate(id=>__opsTest.sessionModels[id].project,id),'east');await close(p);await safe(run);
    }finally{await run.close();}
    const data=board();data.models=[{id:'existing',name:'Existing model',url:env.url+'/after/tests/fixture.glb',fmt:'glb',visible:true}];const busy=await entry(env,{data}),q=busy.page;let finish;
    try{
     await loaded(q,'existing');await focus(q);await q.locator('[data-model-project="existing"]').selectOption('default');await modal(q);await select(q);const pending=new Promise(resolve=>finish=resolve);
     await q.route('https://api.github.com/repos/regression-fixture/test-board/contents/data.json',async route=>{const req=route.request();if(req.method()==='GET')return route.fulfill({json:{sha:'test-sha'}});busy.network.writes.push({url:req.url(),method:req.method(),body:req.postDataJSON()});await pending;return route.fulfill({json:{content:{sha:'test-sha'},commit:{sha:'test-commit'}}});});
     await q.locator('#btnPublish').evaluate(button=>button.click());await q.waitForFunction(()=>__opsTest.sync.busy);await q.locator('#modelShareUpload').click();assert.match(await q.locator('#modelShareStatus').innerText(),/Wait.*Publish/i);assert.equal(uploadWrites(busy).length,0);assert.equal((await models(q)).length,1);
     await q.locator('#btnModelShare').evaluate(button=>button.click());assert.equal(await q.locator('#modelShareFile').evaluate(input=>input.files.length),1,'Busy guard does not reset the open selection');finish();await q.waitForFunction(()=>!__opsTest.sync.busy);assert.equal(publishWrites(busy).length,1);await safe(busy);
    }finally{if(finish)finish();await busy.close();}
   });
  }
 }finally{
  await env.close();const inputsUnchanged=JSON.stringify(sourceHashes)===JSON.stringify(hashes()),operationalDataUnchanged=dataHash===digest('data.json');
  const report={commit,endCommit:git(['rev-parse','HEAD']),engine:env.engine,fast,startedAt,completedAt:new Date().toISOString(),sourceHashes,inputsUnchanged,operationalDataUnchanged,tests:results,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length};
  fs.writeFileSync(path.join(output,'model-sharing-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed,inputsUnchanged,operationalDataUnchanged}));if(report.failed||!inputsUnchanged||!operationalDataUnchanged)process.exitCode=1;
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
