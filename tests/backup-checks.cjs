const fs=require('node:fs');
const assert=require('node:assert/strict');
const {open}=require('./harness.cjs');
const read=p=>p.evaluate(()=>structuredClone(__opsTest.state));
const upload=(p,data)=>p.locator('#fileImport').setInputFiles({name:'isolated-backup.json',mimeType:'application/json',buffer:Buffer.from(typeof data==='string'?data:JSON.stringify(data))});
async function restore(p,data){
 await upload(p,data);
 const waiting=p.waitForEvent('download');await p.locator('#importBackup').click();await waiting;
 await p.locator('#importBackupSaved').check();await p.locator('#importConfirm').click();
}
async function exported(p){
 if(!(await p.locator('#btnExport').isVisible()))await p.locator('#headerMenu summary').click();
 const waiting=p.waitForEvent('download');await p.locator('#btnExport').click();
 return JSON.parse(fs.readFileSync(await (await waiting).path(),'utf8'));
}
module.exports=async(env,check)=>{
 await check('Backup repair: complete export/import/export round-trip, reload and no remote writes',async()=>{
  const run=await open(env),p=run.page;
  try{
   const backup=await exported(p);
   backup.projects[0].name='Restored project';backup.clients[0].name='Restored client';
   backup.models=[{id:'restored-model',name:'Retained model',url:env.url+'/after/tests/fixture.glb',fmt:'glb',visible:false,upAxis:'y',futureModel:{v:2}}];
   backup.futureExtension={version:3,records:[{id:'future-id',flags:[true,false,null]}]};
   backup.panels.subbiesTomorrow=[{id:'legacy-record',main:'Legacy record',futureField:{value:0}}];
   backup.panels.futurePanel=[{id:'future-item',main:'Unknown panel record'}];
   backup.settings.futureSetting={nested:['retain',false,0]};
   const before=await open(env,{version:'before'});
   try{await upload(before.page,backup);await before.page.waitForFunction(()=>__opsTest.state.panels.subbiesTomorrow?.[0]?.id==='legacy-record');assert.equal(Object.hasOwn(await read(before.page),'projects'),false);}finally{await before.close();}
   await restore(p,backup);await p.waitForFunction(()=>__opsTest.state.futureExtension?.version===3);
   assert.deepEqual(await read(p),backup);assert.deepEqual(await exported(p),backup);
   assert.ok((await p.locator('#projSelect option').allTextContents()).includes('Restored project'));
   assert.ok((await p.locator('#modelList').innerText()).includes('Retained model'));
   assert.equal(await p.evaluate(()=>__opsTest.sync.dirty),true);assert.equal(run.network.writes.length,0);
   await p.reload({waitUntil:'networkidle'});assert.deepEqual(await read(p),backup);assert.deepEqual(await exported(p),backup);
   assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
   return {roundTrip:'all keys and identifiers deep-equal, including unknown/legacy fields',historyRecords:Object.keys(backup.history).length};
  }finally{await run.close();}
 });
 await check('Backup repair: legacy backup defaults retain legacy fields and project identifiers',async()=>{
  const run=await open(env),p=run.page;
  try{
   await restore(p,{settings:{projectName:'Legacy site'},panels:{dailyWorks:[{id:'legacy-1',main:'Legacy activity',project:'default'}],subbiesTomorrow:[]},futureZero:0});
   await p.waitForFunction(()=>__opsTest.state.settings.projectName==='Legacy site');
   const state=await read(p);assert.equal(state.projects[0].id,'default');assert.equal(state.projects[0].name,'Legacy site');assert.equal(state.clients[0].id,'client-default');
   assert.equal(state.panels.dailyWorks[0].id,'legacy-1');assert.equal(state.futureZero,0);assert.ok(Object.hasOwn(state.panels,'rfis'));
   assert.deepEqual(await exported(p),state);assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 });
 await check('Backup repair: malformed, incompatible and unreadable JSON leave data unchanged',async()=>{
  const run=await open(env),p=run.page;
  try{
   const state=await read(p),stored=await p.evaluate(()=>localStorage.getItem('offaly_ops_v1'));
   const invalid=['{',null,[],{}, {settings:{},panels:[]},{settings:{},panels:{dailyWorks:{}}},{settings:{},panels:{},projects:'bad'},{settings:{loc:{lat:'bad',lng:0}},panels:{}},{settings:{},panels:{},stats:[{fields:'bad'}]}];
   for(const input of invalid){const dialog=p.waitForEvent('dialog');await upload(p,input);const alert=await dialog;assert.match(alert.message(),/not imported/);await alert.accept();assert.deepEqual(await read(p),state);assert.equal(await p.evaluate(()=>localStorage.getItem('offaly_ops_v1')),stored);}
   assert.equal(run.network.writes.length,0);
  }finally{await run.close();}
 });
 await check('Backup repair: storage failure and render failure roll back the entire board',async()=>{
  const run=await open(env),p=run.page;
  try{
   await p.locator('[data-add="dailyWorks"]').click();await p.locator('#fMain').fill('Retain this unpublished local item');await p.locator('#itemSave').click();
   const state=await read(p);
   const stored=await p.evaluate(()=>localStorage.getItem('offaly_ops_v1'));
   const candidate=structuredClone(state);candidate.settings.projectName='Must not replace';
   await p.evaluate(()=>{window.savedSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='offaly_ops_v1')throw new DOMException('Test quota rejection','QuotaExceededError');return window.savedSetItem.call(this,k,v);};});
   let waiting=p.waitForEvent('dialog').then(dialog=>dialog.accept());await restore(p,candidate);await waiting;assert.deepEqual(await read(p),state);assert.equal(await p.evaluate(()=>localStorage.getItem('offaly_ops_v1')),stored);
   await p.evaluate(()=>Storage.prototype.setItem=window.savedSetItem);
   candidate.mapLayers=[{id:'invalid-geometry',data:{type:'UnsupportedGeometry'}}];
   waiting=p.waitForEvent('dialog').then(dialog=>dialog.accept());await upload(p,candidate);await waiting;assert.deepEqual(await read(p),state);assert.equal(await p.evaluate(()=>localStorage.getItem('offaly_ops_v1')),stored);assert.equal(await p.evaluate(()=>__opsTest.sync.dirty),true);
   await p.reload({waitUntil:'networkidle'});assert.deepEqual(await read(p),state);
   assert.equal(run.network.writes.length,0);
  }finally{await run.close();}
 });
 await check('Backup repair: imported base, summaries, client assignments and model cache refresh',async()=>{
  const run=await open(env),p=run.page;
  try{
   let backup=await read(p);backup.models=[{id:'same-id',name:'First model',url:env.url+'/after/tests/fixture.glb',visible:true}];
   await restore(p,backup);await p.waitForFunction(()=>__opsTest.loadedObjs['same-id']?.parent);
   const oldId=await p.evaluate(()=>__opsTest.loadedObjs['same-id'].uuid);
   backup=structuredClone(backup);backup.base='street';backup.models[0].name='Replacement model';backup.models[0].url=env.url+'/after/tests/fixture.gltf';backup.projects[0].clients=[];
   await restore(p,backup);await p.waitForFunction(old=>__opsTest.loadedObjs['same-id']?.parent&&__opsTest.loadedObjs['same-id'].uuid!==old,oldId);
   assert.deepEqual(await read(p),backup);assert.equal(await p.locator('#btnBase .lbl').innerText(),'Satellite');
   assert.ok((await p.locator('#modelList').innerText()).includes('Replacement model'));assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 });
};
