// WP2 only: original forms, synthetic files, intercepted GitHub writes and native print.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const {root,output,start,open}=require('./harness.cjs'),fixture=require('./workspace-fixture.cjs');
const fast=process.argv.includes('--fast'),pdf=process.argv.includes('--pdf'),results=[],startedAt=new Date().toISOString();
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim(),commit=git(['rev-parse','HEAD']);
const inputs=['index.html','ui-forms.js','ui-forms.css','tests/work-package-attachments.cjs','tests/work-package-attachments-source.cjs','tests/work-package-source.cjs','tests/harness.cjs','tests/workspace-fixture.cjs'];
const hashes=()=>Object.fromEntries(inputs.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
const sourceHashes=hashes(),directory=path.join(output,'work-package-attachments');fs.mkdirSync(directory,{recursive:true});
const wp=(id,fields={})=>({id,main:'Package '+id,project:'default',pct:35,team:'site',dateAssigned:'2026-10-13',dateRequired:'2026-10-16',wstatus:'inprogress',materialsStatus:'available',vis:{site:true,client:true},...fields});
const board=items=>{const data=fixture();data.panels.workPackages=items;return data;};
const snapshot=p=>p.evaluate(()=>({state:structuredClone(__opsTest.state),storage:{...localStorage},dirty:__opsTest.sync.dirty}));
const records=p=>p.evaluate(()=>structuredClone(__opsTest.state.panels.workPackages));
const row=(p,id)=>p.locator('[data-card="workPackages"] .card-body > .list > li').filter({has:p.locator('.main').filter({hasText:new RegExp('^Package '+id+'$')})});
const imageName='WP2 synthetic workfront.png',fileName='WP2 inspection checklist.pdf';
// A deterministic 800 x 480 RGB fixture; no live photographs or external image service.
function png(){
 const width=800,height=480,raw=Buffer.alloc((width*3+1)*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*(width*3+1)+1+x*3,road=y>220&&y<350,pipe=x>90&&x<710&&y>270&&y<302;
  const c=pipe?[32,122,168]:road?[177,163,139]:y<190?[197,222,235]:[116,148,103];raw[i]=c[0];raw[i+1]=c[1];raw[i+2]=c[2];
 }
 const crc=b=>{let n=0xffffffff;for(const v of b){n^=v;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return(n^0xffffffff)>>>0;};
 const chunk=(name,data)=>{const type=Buffer.from(name),head=Buffer.alloc(4),tail=Buffer.alloc(4);head.writeUInt32BE(data.length);tail.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([head,type,data,tail]);};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const image=png(),documentBytes=Buffer.from('%PDF-1.4\n% Synthetic reference fixture; listed, never merged into the Work Package report.\n');
const photo=(name=imageName)=>({name,mimeType:'image/png',buffer:image}),file=(name=fileName)=>({name,mimeType:'application/pdf',buffer:documentBytes});
async function opened(p){await p.waitForFunction(()=>document.getElementById('itemModal').classList.contains('open')&&document.activeElement===document.getElementById('fMain'));}
async function edit(p,id){await p.locator('[data-edit="workPackages:'+id+'"]').click();await opened(p);}
async function cancel(p){await p.locator('#itemModal [data-close]').click();await p.waitForFunction(()=>!document.getElementById('itemModal').classList.contains('open'));}
async function save(p){await p.locator('#itemSave').click();await p.waitForFunction(()=>!document.getElementById('itemModal').classList.contains('open'));}
async function pick(p,files){await p.locator('#photoAttach').setInputFiles(files);}
async function noErrors(run){assert.deepEqual(run.network.errors,[]);}
async function entry(env,items,options={}){return open(env,{data:board(items),token:true,audience:'?ui=workspaces&workspace=operations&workspaceProject=default',...options});}
async function assets(run,env,hook){
 const uploads=[];
 await run.page.route('**/wp2-asset/**',route=>route.fulfill({contentType:/\.png$/.test(new URL(route.request().url()).pathname)?'image/png':'application/pdf',body:/\.png$/.test(new URL(route.request().url()).pathname)?image:documentBytes}));
 await run.page.route('https://api.github.com/repos/regression-fixture/test-board/contents/**',async route=>{
  const req=route.request();if(req.method()!=='PUT'||new URL(req.url()).pathname.endsWith('/data.json'))return route.fallback();
  const request={url:req.url(),method:req.method(),body:req.postDataJSON()};uploads.push(request);run.network.writes.push(request);
  const action=hook?await hook(request,uploads.length):null;
  if(action==='fail')return route.fulfill({status:503,json:{message:'Synthetic upload rejection'}});
  const name=request.body.message.replace(/^Add /,'');
  return route.fulfill({json:{content:{sha:'wp2-test-sha-'+uploads.length,download_url:env.url+'/wp2-asset/'+encodeURIComponent(name)},commit:{sha:'wp2-test-commit'}}});
 });
 return uploads;
}
async function exported(p){if(!await p.locator('#btnExport').isVisible())await p.locator('#headerMenu summary').click();const pending=p.waitForEvent('download');await p.locator('#btnExport').click();return JSON.parse(fs.readFileSync(await(await pending).path(),'utf8'));}
async function restore(p,data){await p.locator('#fileImport').setInputFiles({name:'wp2-synthetic-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});const pending=p.waitForEvent('download');await p.locator('#importBackup').click();await pending;await p.locator('#importBackupSaved').check();await p.locator('#importConfirm').click();await p.waitForFunction(()=>!document.getElementById('importModal').classList.contains('open'));}
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}catch(error){results.push({name,status:'FAIL',error:error.stack});console.error('FAIL '+name+': '+error.message);}}

(async()=>{const env=await start();try{
 await check('WP2 cancel and validation: staged new/edit files never upload or mutate records before validated Save',async()=>{
  const run=await entry(env,[wp('existing')]),p=run.page;const uploads=await assets(run,env);
  try{
   const before=await snapshot(p);
   await p.locator('[data-add="workPackages"]').click();await opened(p);await pick(p,[photo(),file()]);
   assert.equal(await p.locator('#photoStrip .wp-attachment').count(),2);assert.equal(await p.locator('#photoStrip img').count(),1);
   assert.equal(await p.locator('#photoAttach').getAttribute('accept'),'');assert.equal(uploads.length,0);
   await p.locator('#itemSave').click();assert.equal(await p.locator('#itemModal').isVisible(),true);assert.deepEqual(await snapshot(p),before);assert.equal(uploads.length,0);
   await cancel(p);assert.deepEqual(await snapshot(p),before);
   await edit(p,'existing');assert.equal(await p.locator('#photoStrip .wp-attachment').count(),0);await pick(p,[photo()]);await p.keyboard.press('Escape');
   await p.waitForFunction(()=>!document.getElementById('itemModal').classList.contains('open'));assert.deepEqual(await snapshot(p),before);assert.equal(uploads.length,0);
   await edit(p,'existing');assert.equal(await p.locator('#photoStrip .wp-attachment').count(),0);await cancel(p);await noErrors(run);
  }finally{await run.close();}
 });
 await check('WP2 unchanged limits: images over 15 MB and files over 25 MB are rejected before staging or upload',async()=>{
  const run=await entry(env,[wp('limits')]),p=run.page;const uploads=await assets(run,env);
  try{const before=await snapshot(p);await edit(p,'limits');await pick(p,[{name:'oversize.png',mimeType:'image/png',buffer:Buffer.alloc(15*1024*1024+1)},{name:'oversize.pdf',mimeType:'application/pdf',buffer:Buffer.alloc(25*1024*1024+1)}]);assert.equal(await p.locator('#photoStrip .wp-attachment').count(),0);assert.equal(uploads.length,0);await cancel(p);assert.deepEqual(await snapshot(p),before);await noErrors(run);}finally{await run.close();}
 });
 await check('WP2 multiple attachments: original Save persists metadata, ready state, notes, history and reload without automatic board publish',async()=>{
  const run=await entry(env,[wp('dependency',{wstatus:'completed',constraints:'Survey approved'})]),p=run.page;const uploads=await assets(run,env);
  try{
   const before=await snapshot(p);await p.locator('[data-add="workPackages"]').click();await opened(p);await p.locator('#fMain').fill('Package target');await p.locator('#fMaterialsStatus').selectOption('available');await p.locator('#fWPPrerequisites input[value="dependency"]').check();await p.locator('#fWPConstraints').fill('Keep access clear\nConfirm crew briefing');await pick(p,[photo(),photo('WP2 second workfront.png'),file()]);await save(p);
   assert.equal(uploads.length,3);assert.ok(uploads.every(r=>r.body.branch==='test-only'));assert.ok(!run.network.writes.some(r=>/\/data\.json$/.test(r.url)));
   const saved=(await records(p)).find(i=>i.main==='Package target');assert.ok(saved.id);assert.equal(saved.project,'default');assert.equal(saved.photos.length,2);assert.equal(saved.attachments.length,1);
   for(const meta of [...saved.photos,...saved.attachments])for(const key of ['name','path','url','sha','size','mime'])assert.ok(meta[key],key+' metadata retained');
   assert.deepEqual(saved.prerequisiteIds,['dependency']);assert.equal(saved.materialsStatus,'available');assert.equal(saved.constraints,'Keep access clear\nConfirm crew briefing');assert.equal(await row(p,'target').locator('.wp-go').count(),1);
   assert.equal(await row(p,'target').locator('.wp-attachments img').count(),2);assert.match(await row(p,'target').locator('.wp-attachments').innerText(),/WP2 inspection checklist\.pdf/);
   const after=await snapshot(p);assert.deepEqual(JSON.parse(after.storage.offaly_ops_v1).panels.workPackages,after.state.panels.workPackages);assert.equal(after.state.history[saved.id].photos,2);assert.equal(after.dirty,true);
   for(const [pid,items] of Object.entries(before.state.panels))if(pid!=='workPackages')assert.deepEqual(after.state.panels[pid],items);
   await p.reload();assert.deepEqual((await records(p)).find(i=>i.id===saved.id),saved);await edit(p,saved.id);assert.equal(await p.locator('#photoStrip .wp-attachment').count(),3);await cancel(p);assert.equal(uploads.length,3);await noErrors(run);
  }finally{await run.close();}
 });
 if(!fast){
 await check('WP2 failure recovery: busy Save/Escape/backdrop cannot orphan uploads; retry retains successful references and uploads only pending files',async()=>{
  const run=await entry(env,[wp('target')]),p=run.page;let release,entered;const started=new Promise(r=>entered=r),hold=new Promise(r=>release=r);
  const uploads=await assets(run,env,async(req,n)=>{if(n===1){entered();await hold;}return n===2?'fail':null;});
  try{
   await edit(p,'target');await pick(p,[photo(),file()]);await p.locator('#itemSave').click();await started;
   assert.equal(await p.locator('#itemSave').isDisabled(),true);assert.equal(await p.locator('#itemModal [data-close]').isDisabled(),true);
   await p.keyboard.press('Escape');await p.locator('#itemModal').evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));
   await p.locator('#itemSave').evaluate(e=>e.click());assert.equal(await p.locator('#itemModal').isVisible(),true);assert.equal(uploads.length,1);
   release();await p.waitForFunction(()=>!document.getElementById('itemSave').disabled&&document.getElementById('itemModal').classList.contains('open'));
   assert.equal(uploads.length,2);const partial=(await records(p)).find(i=>i.id==='target');assert.equal(partial.photos.length,1);assert.equal((partial.attachments||[]).length,0);
   assert.deepEqual(JSON.parse((await snapshot(p)).storage.offaly_ops_v1).panels.workPackages.find(i=>i.id==='target'),partial);
   assert.ok((await p.locator('#wpAttachmentNotice').innerText()).trim(),'Failure feedback remains visible');await save(p);
   const final=(await records(p)).find(i=>i.id==='target');assert.equal(final.photos.length,1);assert.equal(final.attachments.length,1);assert.equal(uploads.length,3);assert.equal(uploads.filter(r=>r.body.message==='Add '+imageName).length,1);assert.equal(uploads.filter(r=>r.body.message==='Add '+fileName).length,2);
   assert.ok(!run.network.writes.some(r=>r.method==='DELETE'||/\/data\.json$/.test(r.url)));await noErrors(run);
  }finally{release?.();await run.close();}
 });
 await check('WP2 storage failure: reject uploads before durable Save, retain uploaded metadata after failure and retry without duplicate PUTs',async()=>{
  for(const timing of ['before','after']){
   const run=await entry(env,[wp('target')]),p=run.page;
   await p.evaluate(()=>{window.__wp2StorageSet=Storage.prototype.setItem;window.__wp2StorageFail=false;Storage.prototype.setItem=function(key,value){if(key==='offaly_ops_v1'&&window.__wp2StorageFail)throw new DOMException('Synthetic storage quota failure','QuotaExceededError');return window.__wp2StorageSet.call(this,key,value);};});
   const uploads=await assets(run,env,async()=>{if(timing==='after')await p.evaluate(()=>window.__wp2StorageFail=true);});
   try{
    await edit(p,'target');await p.locator('#fWPConstraints').fill('Keep this unsaved-storage recovery note');await pick(p,[photo()]);
    if(timing==='before')await p.evaluate(()=>window.__wp2StorageFail=true);
    await p.locator('#itemSave').click();await p.waitForFunction(()=>!document.getElementById('itemSave').disabled&&/local storage/i.test(document.getElementById('wpAttachmentNotice').textContent));
    assert.equal(await p.locator('#itemModal').isVisible(),true);assert.equal(uploads.length,timing==='before'?0:1);const memory=(await records(p)).find(i=>i.id==='target');
    assert.equal((memory.photos||[]).length,timing==='before'?0:1);assert.match(await p.locator('#wpAttachmentNotice').innerText(),/export.*backup/i);
    const durable=JSON.parse((await snapshot(p)).storage.offaly_ops_v1).panels.workPackages.find(i=>i.id==='target');assert.notDeepEqual(durable,memory,'Failed persistence must remain explicit');
    await p.locator('#itemSave').click();await p.waitForFunction(()=>!document.getElementById('itemSave').disabled&&/local storage/i.test(document.getElementById('wpAttachmentNotice').textContent));
    assert.equal(await p.locator('#itemModal').isVisible(),true);assert.equal(uploads.length,timing==='before'?0:1);assert.deepEqual((await records(p)).find(i=>i.id==='target'),memory);
    await p.evaluate(()=>window.__wp2StorageFail=false);
    // The after-upload hook must not run again: the successful reference is retried locally only.
    await save(p);assert.equal(uploads.length,1);const final=(await records(p)).find(i=>i.id==='target');assert.equal(final.photos.length,1);assert.equal(final.constraints,'Keep this unsaved-storage recovery note');
    assert.deepEqual(JSON.parse((await snapshot(p)).storage.offaly_ops_v1).panels.workPackages.find(i=>i.id==='target'),final);assert.ok(!run.network.writes.some(r=>r.method==='DELETE'||/\/data\.json$/.test(r.url)));await noErrors(run);
   }finally{await p.evaluate(()=>{Storage.prototype.setItem=window.__wp2StorageSet;window.__wp2StorageFail=false;});await run.close();}
  }
 });
 await check('WP2 reference removal, download, backup and intercepted publishing preserve shared files and original data flow',async()=>{
  const run=await entry(env,[wp('target')]),p=run.page;const uploads=await assets(run,env);
  try{
   await edit(p,'target');await pick(p,[photo(),file()]);await save(p);const original=(await records(p)).find(i=>i.id==='target');
   // Reference sharing is seeded only in isolated test memory, as legacy/backup data can contain shared URLs.
   await p.evaluate(meta=>{__opsTest.state.panels.documents.push({id:'shared-wp2-file',project:'default',vis:{site:true,client:true},...meta});},original.attachments[0]);
   const before=await exported(p),download=p.waitForEvent('download');await row(p,'target').locator('[data-wp-download]').last().click();assert.equal((await download).suggestedFilename(),fileName);
   await edit(p,'target');const remove=p.locator('#photoStrip .wp-attachment').filter({hasText:fileName}).locator('[data-wp-remove]');await remove.click();await save(p);
   assert.equal(((await records(p)).find(i=>i.id==='target').attachments||[]).length,0);assert.equal(uploads.length,2);assert.equal(run.network.writes.filter(r=>r.method==='DELETE').length,0);
   assert.deepEqual((await snapshot(p)).state.panels.documents.find(i=>i.id==='shared-wp2-file'),before.panels.documents.find(i=>i.id==='shared-wp2-file'));
   await restore(p,before);assert.deepEqual((await snapshot(p)).state,before);assert.deepEqual(await exported(p),before);await p.reload();assert.deepEqual((await records(p)).find(i=>i.id==='target'),original);
   for(const invalid of ['not-an-array',[null],[{name:'Missing reference.pdf'}]]){
    const malformed=structuredClone(before);malformed.panels.workPackages.find(i=>i.id==='target').attachments=invalid;const unchanged=await snapshot(p),dialog=p.waitForEvent('dialog');
    await p.locator('#fileImport').setInputFiles({name:'wp2-invalid-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(malformed))});const alert=await dialog;assert.match(alert.message(),/not imported/i);await alert.accept();assert.deepEqual(await snapshot(p),unchanged,'Malformed attachment backups cannot replace the board');
   }
   const expected=await p.evaluate(()=>__opsTest.shareableState());if(!await p.locator('#btnPublish').isVisible())await p.locator('#headerMenu summary').click();await p.locator('#btnPublish').click();await p.waitForFunction(()=>!__opsTest.sync.busy&&!__opsTest.sync.dirty);
   const publications=run.network.writes.filter(r=>/\/data\.json$/.test(r.url));assert.equal(publications.length,1);const published=JSON.parse(Buffer.from(publications[0].body.content,'base64').toString());assert.deepEqual(published,expected);assert.equal(publications[0].body.branch,'test-only');
   const refreshed=await open(env,{data:published,audience:'?ui=workspaces&workspace=operations&workspaceProject=default'});
   try{await assets(refreshed,env);assert.deepEqual((await records(refreshed.page)).find(i=>i.id==='target'),original);assert.equal(await row(refreshed.page,'target').locator('.wp-attachments .wp-attachment').count(),2);assert.equal(refreshed.network.writes.length,0);await noErrors(refreshed);}finally{await refreshed.close();}
   await noErrors(run);
  }finally{await run.close();}
 });
 await check('WP2 audience and project display rules: restricted attachments/notes/print controls stay hidden and stale print action cannot expose them',async()=>{
  const common={name:'RESTRICTED evidence.pdf',mime:'application/pdf',url:env.url+'/wp2-asset/restricted.pdf',path:'files/restricted.pdf'};
  const items=[wp('public',{prerequisiteIds:['secret','allowed']}),wp('secret',{wstatus:'completed',constraints:'SECRET CONSTRAINT',vis:{site:false,client:false},attachments:[common]}),wp('allowed',{wstatus:'completed',constraints:'Allowed prerequisite note'}),wp('east',{project:'east',attachments:[{...common,name:'EAST evidence.pdf'}]})];
  for(const role of ['crew=test-site','view=test-client-0']){
   const run=await entry(env,items,{audience:'?ui=workspaces&workspace=operations&workspaceProject=default&'+role,token:false}),p=run.page;
   try{await assets(run,env);const before=await snapshot(p),text=await p.locator('#panelsGrid').innerText();for(const secret of ['RESTRICTED evidence.pdf','SECRET CONSTRAINT','EAST evidence.pdf'])assert.ok(!text.includes(secret),secret+' hidden');assert.equal(await p.locator('[data-wp-print="secret"],[data-wp-print="east"]').count(),0);assert.equal(await p.locator('[data-edit="workPackages:public"]').count(),0);await p.locator('[data-wp-print="public"]').click();await p.waitForFunction(()=>window.__printCalls>0);const sheet=await p.locator('#wpPrintSheet').innerText();assert.ok(!sheet.includes('SECRET CONSTRAINT'));assert.match(sheet,/Allowed prerequisite note/);await p.evaluate(()=>dispatchEvent(new Event('afterprint')));assert.deepEqual(await snapshot(p),before);assert.equal(run.network.writes.length,0);await noErrors(run);}finally{await run.close();}
  }
  const run=await entry(env,items),p=run.page;
  try{await p.locator('[data-wp-print="public"]').evaluate(e=>window.__wp2OldPrint=e);await p.locator('#projSelect').selectOption('east');await p.evaluate(()=>window.__wp2OldPrint.click());assert.equal(await p.locator('#wpPrintSheet').count(),0);assert.equal(await p.evaluate(()=>window.__printCalls||0),0);assert.equal(run.network.writes.length,0);await noErrors(run);}finally{await run.close();}
 });
 await check('WP2 native Work Package sheet: metadata, readiness, prerequisites, notes, photos and attachment references without unrelated records',async()=>{
  const run=await entry(env,[wp('approved',{main:'Survey and excavation release',wstatus:'completed',constraints:'Survey set-out accepted'}),wp('pending',{main:'Service clearance',constraints:'Await written utility clearance'}),wp('print',{main:'Package print',pct:40,prerequisiteIds:['approved','pending'],constraints:'Maintain resident access\nBrief the excavation crew'}),wp('unrelated',{main:'UNRELATED PACKAGE MUST NOT PRINT'})]),p=run.page;await assets(run,env);
  try{
   await edit(p,'print');await pick(p,[photo(),photo('WP2 detail photograph.png'),file()]);await save(p);const before=await snapshot(p);await p.locator('[data-wp-print="print"]').click();await p.waitForFunction(()=>window.__printCalls===1);await p.emulateMedia({media:'print'});await p.evaluate(()=>document.fonts.ready);
   const sheet=p.locator('#wpPrintSheet');assert.equal(await sheet.isVisible(),true);const text=await sheet.innerText();
   for(const expected of ['North workfront','Package print','Site','40%','In Progress','2026','NO GO','Available','Survey and excavation release','Completed','Service clearance','not completed','Maintain resident access','Brief the excavation crew','Survey set-out accepted','Await written utility clearance',imageName,fileName])assert.ok(text.toLowerCase().includes(expected.toLowerCase()),'Printed sheet includes '+expected);
   assert.equal(await sheet.locator('img').count(),2);assert.ok(await sheet.locator('img').evaluateAll(imgs=>imgs.every(img=>img.complete&&img.naturalWidth===800)));assert.ok(text.includes('/files/')||text.includes('files/'),'File references are printed');
   const visibleText=await p.locator('body').innerText();assert.ok(!visibleText.includes('UNRELATED PACKAGE MUST NOT PRINT'));assert.ok(!visibleText.includes('Install watermain · Chainage'));
   assert.equal(await sheet.locator('iframe,embed,object').count(),0,'External documents are listed, never merged');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(pdf&&env.engine==='chromium')await p.pdf({path:path.join(directory,'representative-work-package.pdf'),format:'A4',printBackground:true});
   await p.emulateMedia({media:'screen'});await p.evaluate(()=>dispatchEvent(new Event('afterprint')));assert.equal(await p.locator('#wpPrintSheet').count(),0);assert.equal(await p.locator('body.wp-sheet-print').count(),0);assert.equal(await p.locator('body').getAttribute('data-print'),null);assert.deepEqual(await snapshot(p),before);await noErrors(run);
  }finally{await run.close();}
 });
 await check('WP2 phone and Original board: original form remains usable, reference removal cancel is reversible, all 21 panels retained',async()=>{
  for(const [width,height,classic] of [[390,844,false],[1440,900,true]]){
   const run=await entry(env,[wp('target')],{width,height,touch:!classic,audience:classic?'?ui=classic':'?ui=workspaces&workspace=operations&workspaceProject=default'}),p=run.page;await assets(run,env);
   try{assert.equal(await p.locator('[data-card]').count(),21);await edit(p,'target');await pick(p,[photo(),file()]);assert.equal(await p.locator('#itemSave').isVisible(),true);assert.equal(await p.locator('#itemModal [data-close]').isVisible(),true);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);await save(p);const before=await snapshot(p);await edit(p,'target');await p.locator('[data-wp-remove]').first().click();await cancel(p);assert.deepEqual(await snapshot(p),before);assert.equal(await row(p,'target').locator('.wp-go').count(),1);await noErrors(run);}finally{await run.close();}
  }
 });
 }
}finally{
 const browserVersion=env.browser.version();await env.close();const inputsUnchanged=JSON.stringify(sourceHashes)===JSON.stringify(hashes());
 const report={commit,endCommit:git(['rev-parse','HEAD']),worktreeClean:!git(['status','--porcelain']),startedAt,completedAt:new Date().toISOString(),engine:env.engine,browserVersion,mode:fast?'FAST':'FOCUSED',sourceHashes,inputsUnchanged,tests:results,passed:results.filter(t=>t.status==='PASS').length,failed:results.filter(t=>t.status==='FAIL').length};
 fs.writeFileSync(path.join(directory,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed,inputsUnchanged}));if(report.failed||!inputsUnchanged)process.exitCode=1;
}})().catch(error=>{console.error(error);process.exitCode=1;});
