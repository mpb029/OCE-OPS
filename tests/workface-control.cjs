// WFC-001 standalone FAST/FOCUSED contracts. Synthetic state; all GitHub writes intercepted.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const {root,output,start,open}=require('./harness.cjs'),{board}=require('./workface-fixture.cjs'),D=require('../workface-data.js');
const fast=process.argv.includes('--fast'),filter=process.env.OCE_WFC_FILTER?new RegExp(process.env.OCE_WFC_FILTER):null,results=[],startedAt=new Date().toISOString();
const files=['index.html','workface-data.js','workface-control.js','workface-control.css','tests/workface-control.cjs','tests/workface-fixture.cjs','tests/workface-data.test.cjs'];
const hash=f=>createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex'),hashes=()=>Object.fromEntries(files.map(f=>[f,hash(f)])),sourceHashes=hashes(),dataHash=hash('data.json');
const snapshot=p=>p.evaluate(()=>({state:structuredClone(__opsTest.state),storage:{...localStorage},dirty:__opsTest.sync.dirty}));
const row=(p,id)=>p.locator('[data-card="workPackages"] .card-body > .list > li').filter({has:p.locator('.main').filter({hasText:new RegExp('^'+(id==='legacy'?'Legacy package':'Workface '+id)+'$')})});
const opened=p=>p.waitForFunction(()=>document.getElementById('itemModal').classList.contains('open')&&document.activeElement===document.getElementById('fMain'));
async function edit(p,id){await p.locator('[data-edit="workPackages:'+id+'"]').click();await opened(p);}
async function save(p){await p.locator('#itemSave').click();await p.waitForFunction(()=>!document.getElementById('itemModal').classList.contains('open'));}
async function cancel(p){await p.locator('#itemModal [data-close]').click();await p.waitForFunction(()=>!document.getElementById('itemModal').classList.contains('open'));}
async function entry(env,options={}){return open(env,{data:board(),audience:'?ui=workspaces&workspace=operations&workspaceProject=default',...options});}
async function ready(p,id,go){assert.equal(await row(p,id).locator(go?'.wp-go':'.wp-no-go').count(),1,'Readiness '+id+' '+go);}
async function register(p){await p.locator('[data-card="workPackages"] > .card-body > .wfc-panel-summary [data-wfc-open-register]').click();await p.waitForFunction(()=>document.getElementById('wfcRegisterModal').classList.contains('open'));}
async function editPermit(p,id='permit-a'){await register(p);await p.locator('#wfcRegisterModal [data-wfc-edit-permit="'+id+'"]').click();}
async function savePermit(p){await p.locator('#wfcSavePermit').click();await p.waitForFunction(()=>!document.getElementById('wfcPermitModal').classList.contains('open'));await p.locator('#wfcRegisterModal [data-close]').click();}
async function noWrites(run,before){assert.deepEqual(run.network.writes,[]);assert.deepEqual(run.network.errors,[]);if(before)assert.deepEqual(await snapshot(run.page),before);}
async function exported(p){if(!await p.locator('#btnExport').isVisible())await p.locator('#headerMenu summary').click();const pending=p.waitForEvent('download');await p.locator('#btnExport').click();return JSON.parse(fs.readFileSync(await(await pending).path(),'utf8'));}
async function restore(p,data){await p.locator('#fileImport').setInputFiles({name:'wfc-synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});const download=p.waitForEvent('download');await p.locator('#importBackup').click();await download;await p.locator('#importBackupSaved').check();await p.locator('#importConfirm').click();await p.waitForFunction(()=>!document.getElementById('importModal').classList.contains('open'));}
async function check(name,fn){if(filter&&!filter.test(name))return;try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}catch(error){results.push({name,status:'FAIL',error:error.stack});console.error('FAIL '+name+': '+error.stack);}}
(async()=>{const env=await start();try{
 await check('WFC create/edit: original Work Package, structured fields, existing record links, readiness checks, cancel and history',async()=>{
  const run=await entry(env),p=run.page;
  try{
   const before=await snapshot(p);await edit(p,'legacy');assert.equal(await p.locator('#wfcEnabled').isChecked(),false);await cancel(p);await noWrites(run,before);
   await p.locator('[data-add="workPackages"]').click();await opened(p);await p.locator('#fMain').fill('Workface created');await p.locator('#fMaterialsStatus').selectOption('available');await p.locator('#wfcEnabled').check();
   await p.locator('#wfcDescription').fill('Recorded scope <img src=x onerror=alert(1)>');await p.locator('#wfcLocation').fill('Northern trench');await p.locator('#wfcChainageStart').fill('10.5');await p.locator('#wfcChainageEnd').fill('25.25');await p.locator('#wfcStart').fill('2026-10-13');await p.locator('#wfcEnd').fill('2026-10-14');
   await p.locator('#wfcLinks').locator('..').locator('summary').click();await p.locator('#wfcAddLink').click();await p.locator('.wfc-link-edit').getByLabel('Existing record',{exact:true}).selectOption('doc-a');await save(p);
   await ready(p,'created',false);const saved=(await snapshot(p)).state.panels.workPackages.find(w=>w.main==='Workface created');assert.equal(saved.workface.chainageStart,10.5);assert.equal(saved.workface.permits.assessment,'unassessed');assert.equal(saved.workface.links[0].id,'doc-a');assert.deepEqual((await snapshot(p)).state.history[saved.id].workface,saved.workface);
   await edit(p,saved.id);await p.locator('#wfcApplicability').selectOption('not-required');await p.locator('#wfcAssessmentSource').fill('Recorded project review');await p.locator('#wfcAssessmentReviewer').fill('Engineer');await p.locator('#wfcAssessmentDate').fill('2026-10-13');await save(p);await ready(p,'created',true);
   await edit(p,saved.id);await p.locator('#wfcChecks').locator('..').locator('summary').click();await p.locator('#wfcAddCheck').click();await p.locator('.wfc-check-edit').getByLabel('Readiness check / action',{exact:true}).fill('Release hold point');await save(p);await ready(p,'created',false);
   const after=(await snapshot(p)).state;for(const [panel,items]of Object.entries(before.state.panels))if(panel!=='workPackages')assert.deepEqual(after.panels[panel],items);assert.equal(await row(p,'created').locator('img').count(),0);await noWrites(run);
  }finally{await run.close();}
 });
 await check('WFC approval changes: shared status/conditions recalculate every workface; legacy and material gates retained',async()=>{
  const run=await entry(env),p=run.page;
  try{
   for(const id of ['a','b','legacy'])await ready(p,id,true);
   await editPermit(p);await p.locator('#paStatus').selectOption('submitted');await savePermit(p);await ready(p,'a',false);await ready(p,'b',false);await ready(p,'legacy',true);
   await editPermit(p);await p.locator('#paStatus').selectOption('conditional');await p.locator('#paAddCondition').click();await p.locator('.wfc-condition-edit').getByLabel('Condition (recorded wording)').fill('Inspection complete');await savePermit(p);await ready(p,'a',false);
   await editPermit(p);const c=p.locator('.wfc-condition-edit');await c.getByLabel('Verified satisfied',{exact:true}).check();await c.getByLabel('Confirmation / evidence').fill('Signed inspection');await c.getByLabel('Verified by',{exact:true}).fill('Engineer A');await c.getByLabel('Verification date',{exact:true}).fill('2026-10-13');await savePermit(p);await ready(p,'a',true);await ready(p,'b',true);
   await edit(p,'a');await p.locator('#fMaterialsStatus').selectOption('unavailable');await save(p);await ready(p,'a',false);await ready(p,'b',true);
   await editPermit(p);await p.locator('#paStatus').selectOption('not-required');await p.locator('#paAssessment').fill('Recorded assessment');await p.locator('#paAssessmentReviewer').fill('Reviewer');await p.locator('#paAssessmentDate').fill('2026-10-12');await savePermit(p);await ready(p,'b',true);
   await editPermit(p);await p.locator('#paExpiry').fill('2026-10-12');await savePermit(p);await ready(p,'b',false);assert.match(await row(p,'b').innerText(),/expired/);
   assert.deepEqual((await snapshot(p)).state.permits[0].futureField,{retain:true});assert.deepEqual((await snapshot(p)).state.panels.workPackages[0].futureField,{retain:true});await noWrites(run);
  }finally{await run.close();}
 });
 if(!fast){
 await check('WFC shared register: create, link to multiple workfaces, verify coverage, reject stale coverage and remove without deleting documents',async()=>{
  const run=await entry(env),p=run.page;
  try{
   await register(p);await p.locator('#wfcNewPermit').click();await p.locator('#paTitle').fill('Shared synthetic approval');await p.locator('#paIssuer').fill('Synthetic authority');await p.locator('#paReference').fill('SHARED-2');await p.locator('#paSource').fill('Recorded approval');await p.locator('#paStatus').selectOption('approved');await p.locator('#paApproved').fill('2026-10-12');await p.locator('#paEffective').fill('2026-10-12');await p.locator('#paExpiry').fill('2026-10-20');
   for(const id of ['a','b']){await p.locator('#paAddCoverage').click();const row=p.locator('.wfc-coverage-edit').last();await row.getByLabel('Workface',{exact:true}).selectOption(id);await row.getByLabel('Coverage verified against the source').check();await row.getByLabel('Coverage source / assessment').fill('Verified activity, location and window');await row.getByLabel('Coverage verified by').fill('Reviewer');await row.getByLabel('Coverage verification date').fill('2026-10-13');}
   await savePermit(p);const permit=(await snapshot(p)).state.permits.find(x=>x.title==='Shared synthetic approval');assert.ok(permit.id);assert.deepEqual(permit.vis,{site:false,client:false});
   for(const id of ['a','b']){await edit(p,id);await p.locator('[data-wfc-permit="'+permit.id+'"]').check();await save(p);await ready(p,id,true);}
   await edit(p,'a');await p.locator('#wfcLocation').fill('Different location');await save(p);await ready(p,'a',false);assert.match(await row(p,'a').innerText(),/scope changed/);
   await editPermit(p,permit.id);p.once('dialog',d=>d.accept());await p.locator('#wfcDeletePermit').click();await p.locator('#wfcRegisterModal [data-close]').click();await ready(p,'b',false);assert.equal((await snapshot(p)).state.panels.documents.length,2);await noWrites(run);
  }finally{await run.close();}
 });
 await check('WFC strict atomic rejection: malformed imports, cross-project/missing links, dates, duplicate IDs and invalid forms preserve board/storage/map/model',async()=>{
  const run=await entry(env),p=run.page;
  try{
   const original=await snapshot(p);await p.evaluate(()=>{window.wfcMap=__opsTest.map;window.wfcModels=__opsTest.loadedObjs;});
   for(const mutate of [s=>s.permits.push(structuredClone(s.permits[0])),s=>s.permits[0].expiryDate='2026-02-30',s=>s.permits[0].project='east',s=>s.panels.workPackages[0].workface.permits.ids=['absent'],s=>s.panels.workPackages[0].workface.checks='broken']){
    const bad=structuredClone(original.state);mutate(bad);const dialog=p.waitForEvent('dialog');await p.locator('#fileImport').setInputFiles({name:'invalid-wfc.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});const d=await dialog;assert.match(d.message(),/invalid/i);await d.dismiss();assert.deepEqual(await snapshot(p),original);
   }
   await edit(p,'a');await p.locator('#wfcChainageEnd').fill('1');await p.locator('#itemSave').click();assert.match(await p.locator('#wpReadinessError').innerText(),/chainage/);assert.deepEqual(await snapshot(p),original);await cancel(p);
   await edit(p,'a');await p.locator('#fProject').selectOption('east');await p.locator('#itemSave').click();assert.match(await p.locator('#wpReadinessError').innerText(),/cross-project|different project|coverage/);assert.deepEqual(await snapshot(p),original);await cancel(p);
   await editPermit(p);await p.locator('#paTitle').fill('');await p.locator('#wfcSavePermit').click();assert.match(await p.locator('#paError').innerText(),/title/);assert.deepEqual(await snapshot(p),original);await p.locator('#wfcPermitModal [data-close]').click();
   assert.equal(await p.evaluate(()=>wfcMap===__opsTest.map&&wfcModels===__opsTest.loadedObjs),true);await noWrites(run,original);
  }finally{await run.close();}
 });
 await check('WFC persistence: reload, complete export/import, unknown fields, original intercepted publish and viewer refresh',async()=>{
  const run=await entry(env,{token:true}),p=run.page;
  try{
   await edit(p,'a');await p.locator('#wfcDescription').fill('Updated recorded scope');await save(p);await editPermit(p);await p.locator('#paNotes').fill('Recorded outstanding action');await savePermit(p);
   const saved=(await snapshot(p)).state;await p.reload();await p.waitForFunction(()=>__opsTest?.ready);assert.deepEqual((await snapshot(p)).state,saved);const backup=await exported(p);await editPermit(p);await p.locator('#paNotes').fill('Temporary edit');await savePermit(p);await restore(p,backup);assert.deepEqual((await snapshot(p)).state,backup);assert.deepEqual(await exported(p),backup);await noWrites(run);
   const expected=await p.evaluate(()=>__opsTest.shareableState());if(!await p.locator('#btnPublish').isVisible())await p.locator('#headerMenu summary').click();await p.locator('#btnPublish').click();await p.waitForFunction(()=>!__opsTest.sync.busy&&!__opsTest.sync.dirty);assert.equal(run.network.writes.length,1);assert.match(run.network.writes[0].url,/regression-fixture\/test-board\/contents\/data.json/);assert.deepEqual(JSON.parse(Buffer.from(run.network.writes[0].body.content,'base64').toString()),expected);
   const viewer=await entry(env,{data:expected,audience:'?ui=workspaces&workspace=operations&workspaceProject=default&crew=test-site'});try{assert.deepEqual((await snapshot(viewer.page)).state.permits,expected.permits);await ready(viewer.page,'a',true);await noWrites(viewer);}finally{await viewer.close();}
  }finally{await run.close();}
 });
 await check('WFC audience and print: hidden linked names/notes/documents never leak; approved records, blockers, evidence and existing photos retained',async()=>{
  const data=board();data.permits[0].vis={site:false,client:false};data.permits[0].title='SECRET APPROVAL';data.permits[0].notes='SECRET NOTES';data.permits[0].document={panel:'documents',id:'doc-secret'};data.permits[0].status='submitted';
  data.panels.workPackages[0].workface.links=[{category:'documents',panel:'documents',id:'doc-secret',completionRequired:false},{category:'documents',panel:'documents',id:'doc-a',completionRequired:false}];
  data.panels.workPackages[0].photos=[{name:'SYNTHETIC PHOTO',url:env.url+'/after/tests/fixture-image.png'}];
  for(const role of ['', '&crew=test-site','&view=test-client-0']){
   const run=await entry(env,{data,audience:'?ui=workspaces&workspace=operations&workspaceProject=default'+role}),p=run.page;
   try{
    const before=await snapshot(p);await ready(p,'a',false);await row(p,'a').locator('.wfc-detail > summary').click();
    if(role){const html=await p.locator('[data-card="workPackages"]').innerHTML();for(const secret of ['SECRET APPROVAL','SECRET NOTES','SECRET DOCUMENT'])assert.ok(!html.includes(secret));assert.equal(await p.locator('[data-edit]:visible,[data-add]:visible').count(),0);}
    await p.locator('[data-wp-print="a"]').click();await p.waitForFunction(()=>window.__printCalls===1);await p.emulateMedia({media:'print'});const sheet=p.locator('#wpPrintSheet'),text=await sheet.innerText();
    for(const expected of ['Workface a','Workface Control','North work area','NO GO','2026-10-13','2026-10-15','Recorded approval.pdf','SYNTHETIC PHOTO','not regulatory'])assert.ok(text.includes(expected),'Print includes '+expected);
    assert.equal(await sheet.locator('img').count(),1);if(role)for(const secret of ['SECRET APPROVAL','SECRET NOTES','SECRET DOCUMENT'])assert.ok(!text.includes(secret));else assert.ok(text.includes('SECRET APPROVAL'));
    await p.emulateMedia({media:'screen'});await p.evaluate(()=>dispatchEvent(new Event('afterprint')));assert.equal(await p.locator('#wpPrintSheet').count(),0);await noWrites(run,before);
   }finally{await run.close();}
  }
 });
 await check('WFC tablet/mobile: labelled touch forms, Save/Cancel, no overflow, same panels and Original board; map/model instances retained',async()=>{
  for(const [width,height]of [[768,1024],[1024,768],[390,844]]){
   const data=board();data.models=[{id:'synthetic-model',name:'Synthetic GLB',url:env.url+'/after/tests/fixture.glb',visible:true,upAxis:'y',project:'default'}];
   const run=await entry(env,{data,width,height,touch:true}),p=run.page;
   try{
    const before=await snapshot(p);await p.waitForFunction(()=>__opsTest.loadedObjs['synthetic-model']?.parent===__opsTest.three?.scene,{},{timeout:90000});await p.evaluate(()=>{window.wfcMap=__opsTest.map;window.wfcThree=__opsTest.three;window.wfcLoaded=__opsTest.loadedObjs['synthetic-model'];});
    assert.ok(await p.evaluate(()=>{let meshes=0;wfcLoaded.traverse(o=>{if(o.isMesh&&o.geometry?.attributes.position?.count>0)meshes++;});return meshes>0;}),'Actual GLB geometry loaded');
    await edit(p,'a');await p.locator('#wfcLocation').fill('Unsaved keyboard entry');assert.ok(await p.getByLabel('Planned start',{exact:true}).count());const saveBox=await p.locator('#itemSave').boundingBox();assert.ok(saveBox.y>=0&&saveBox.y+saveBox.height<=height+1);await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.getElementById('itemModal').classList.contains('open'));await noWrites(run,before);
    await editPermit(p);await p.locator('#paNotes').fill('Unsaved note');await p.locator('#paNotes').focus();const box=await p.locator('#wfcSavePermit').boundingBox();assert.ok(box.y>=0&&box.y+box.height<=height+1);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);await p.keyboard.press('Escape');await noWrites(run,before);
    await p.locator('#wsOriginal').evaluate(e=>e.click());await p.waitForFunction(()=>!document.body.classList.contains('ws-enabled'));assert.equal(await p.locator('[data-card]').count(),21);assert.equal(await p.evaluate(()=>wfcMap===__opsTest.map&&wfcThree===__opsTest.three&&wfcLoaded===__opsTest.loadedObjs['synthetic-model']),true);assert.ok(await p.evaluate(()=>__opsTest.map.getCenter().lat));await noWrites(run,before);
   }finally{await run.close();}
  }
 });
 await check('WFC linked navigation reuses original records and preserves audience/project; legacy prerequisites retain completion semantics',async()=>{
  const data=board();data.panels.workPackages[0].workface.links=[{category:'progress',panel:'issuesDelays',id:'issue-a',completionRequired:true}];data.panels.workPackages[2].prerequisiteIds=['retired'];data.panels.workPackages.push({id:'retired',main:'Retired prerequisite',project:'default',wstatus:'completed',resolvedAt:'2026-10-01T00:00:00Z'});
  const run=await entry(env,{data}),p=run.page;
  try{await ready(p,'a',false);await ready(p,'legacy',true);await row(p,'a').locator('.wfc-detail > summary').click();const section=row(p,'a').locator('.wfc-links').filter({hasText:'Progress / constraints'});await section.locator('summary').click();await section.locator('[data-wfc-record="issuesDelays"]').click();await p.waitForFunction(()=>document.body.dataset.workspace==='quality');assert.match(new URL(p.url()).searchParams.get('workspaceRecord'),/issue-a/);assert.equal(new URL(p.url()).searchParams.get('workspaceProject'),'default');assert.equal(await p.locator('.ws-record-target').count(),1);await noWrites(run);}finally{await run.close();}
 });
 }
 }finally{
 const version=env.browser.version();await env.close();const report={build:'WFC-001',commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),mode:fast?'FAST':'FOCUSED',engine:env.engine,browserVersion:version,startedAt,completedAt:new Date().toISOString(),sourceHashes,inputsUnchanged:JSON.stringify(sourceHashes)===JSON.stringify(hashes()),operationalDataUnchanged:dataHash===hash('data.json'),tests:results,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length};fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'workface-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed,inputsUnchanged:report.inputsUnchanged,operationalDataUnchanged:report.operationalDataUnchanged}));if(report.failed||!results.length||!report.inputsUnchanged||!report.operationalDataUnchanged)process.exitCode=1;
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
