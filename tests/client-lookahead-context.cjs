// Focused client coordination contracts; synthetic storage/publishing only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {start,open,root,output}=require('./harness.cjs'),F=require('./client-lookahead-fixture.cjs');
const results=[],filter=process.env.OCE_CLIENT_CONTEXT_FILTER?new RegExp(process.env.OCE_CLIENT_CONTEXT_FILTER):null;
const clientURL='?view=test-client-0&ui=workspaces&workspace=planning&workspaceProject=default&planFrom=2026-10-12&planWeeks=2';
const snap=p=>p.evaluate(()=>({board:structuredClone(__opsTest.state),storage:{...localStorage},dirty:__opsTest.sync.dirty}));
async function noWrites(run,before){if(before)assert.deepEqual(await snap(run.page),before);assert.deepEqual(run.network.writes,[]);assert.deepEqual(run.network.errors,[]);}
async function check(name,fn){if(filter&&!filter.test(name))return;try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}catch(e){results.push({name,status:'FAIL',error:e.stack});console.error('FAIL '+name+' '+e.stack);}}
async function print(p){const before=await p.evaluate(()=>window.__printCalls||0);await p.locator('[data-plan-action="print-client"]').click();await p.waitForFunction(n=>(window.__printCalls||0)>n,before);return p.locator('#clientLookaheadPrint');}
async function cleanPrint(p){await p.evaluate(()=>dispatchEvent(new Event('afterprint')));}
async function exportBoard(p){if(!await p.locator('#btnExport').isVisible())await p.locator('#headerMenu summary').click();const next=p.waitForEvent('download');await p.locator('#btnExport').click();return JSON.parse(fs.readFileSync(await(await next).path(),'utf8'));}
async function restore(p,board){await p.locator('#fileImport').setInputFiles({name:'client-coordination-synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(board))});const backup=p.waitForEvent('download');await p.locator('#importBackup').click();await backup;await p.locator('#importBackupSaved').check();await p.locator('#importConfirm').click();await p.waitForFunction(()=>!document.querySelector('#importModal.open'));}
(async()=>{const env=await start();try{
 await check('Client coordination: desktop/tablet/phone, all four sections, native print and read-only privacy',async()=>{
  const run=await open(env,{data:F.board(),audience:clientURL}),p=run.page;
  try{
   await p.locator('#planningBody .cl-context-table').first().waitFor();const before=await snap(p);
   assert.equal(await p.locator('#planningBody .cl-context-table').count(),4);
   const text=await p.locator('#planningBody').innerText();for(const value of ['Synthetic Civil Crew','2026-10-14','Synthetic shutdown permit','Under review','Confirm shutdown access','Anticipated milestones'])assert.ok(text.includes(value),value);
   assert.doesNotMatch(text,/PRIVATE/);assert.equal(await p.locator('[data-plan-action="new-activity"]:visible,[data-edit]:visible,#btnPublish:visible').count(),0);
   for(const [width,height]of [[1440,900],[768,1024],[390,844]]){await p.setViewportSize({width,height});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+' no page overflow');assert.ok(await p.locator('[data-plan-action="print-client"]').isVisible());assert.ok(await p.locator('[data-plan-action="print-client"]').evaluate(e=>e.getBoundingClientRect().height>=44));}
   const sheet=await print(p);assert.equal(await sheet.locator('.cl-context-table').count(),4);assert.doesNotMatch(await sheet.innerText(),/PRIVATE/);await p.emulateMedia({media:'print'});assert.equal(await sheet.locator('.cl-context-project').first().evaluate(e=>getComputedStyle(e).display),'table-row');assert.equal(await sheet.locator('.cl-context-table thead').first().evaluate(e=>getComputedStyle(e).display),'table-header-group');await p.emulateMedia({media:'screen'});await cleanPrint(p);await noWrites(run,before);
  }finally{await run.close();}
 });
 await check('Original form: sharing flags save/reload, backup restore and explicit synthetic publishing preserve context',async()=>{
  const data=F.board(),share=data.panels.upcoming[0].planning.clientLookahead;
  delete share.shareSubcontractors;delete share.sharePermits;delete share.shareApprovals;share.futureFlag={keep:true};
  const run=await open(env,{data,token:true,audience:'?ui=workspaces&workspace=planning&workspaceProject=default&planFrom=2026-10-12'}),p=run.page;
  try{
   await p.locator('[data-plan-action="edit-activity"][data-plan-id="activity-a"]').click();await p.locator('#itemModal.open').waitFor();
   for(const id of ['plClientSubcontractors','plClientPermits','plClientApprovals']){assert.equal(await p.locator('#'+id).isChecked(),false);await p.locator('#'+id).check();}
   await p.locator('#itemSave').click();await p.waitForFunction(()=>!document.querySelector('#itemModal.open')&&__opsTest.integrityStatus.localSaved);
   const saved=await p.evaluate(()=>structuredClone(__opsTest.state.panels.upcoming.find(a=>a.id==='activity-a').planning.clientLookahead));for(const key of ['shareSubcontractors','sharePermits','shareApprovals'])assert.equal(saved[key],true);assert.deepEqual(saved.futureFlag,{keep:true});
   let sheet=await print(p);assert.ok(!(await sheet.innerText()).includes('Synthetic Civil Crew'),'unpublished local flags excluded from Client print');await cleanPrint(p);
   await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>__opsTest?.ready);assert.deepEqual(await p.evaluate(()=>__opsTest.state.panels.upcoming.find(a=>a.id==='activity-a').planning.clientLookahead),saved);
   const backup=await exportBoard(p);assert.deepEqual(backup.panels.upcoming.find(a=>a.id==='activity-a').planning.clientLookahead,saved);
   if(!await p.locator('#btnPublish').isVisible())await p.locator('#headerMenu summary').click();await p.locator('#btnPublish').click();await p.waitForFunction(()=>!__opsTest.sync.busy&&!__opsTest.sync.dirty);
   assert.equal(run.network.writes.length,1);const payload=JSON.parse(Buffer.from(run.network.writes[0].body.content,'base64').toString());assert.deepEqual(payload.panels.upcoming.find(a=>a.id==='activity-a').planning.clientLookahead,saved);
   const client=await open(env,{data:run.network.authoritative,audience:clientURL});try{await client.page.locator('#planningBody .cl-context-table').first().waitFor();assert.match(await client.page.locator('#planningBody').innerText(),/Synthetic Civil Crew/);await noWrites(client);}finally{await client.close();}
   await restore(p,backup);assert.deepEqual(await p.evaluate(()=>__opsTest.state.panels.upcoming.find(a=>a.id==='activity-a').planning.clientLookahead),saved);
   assert.equal(run.network.writes.length,1,'Backup restore never publishes automatically');assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 });
 await check('Published audience changes remove stale subcontractors, permits, decisions and milestones',async()=>{
  const data=F.board(),run=await open(env,{data,audience:clientURL}),p=run.page;
  try{await p.locator('#planningBody .cl-context-table').first().waitFor();data.panels.subbiesToday[0].vis.client=false;data.permits[0].vis.client=false;data.panels.rfis[0].vis.client=false;data.panels.upcoming[0].planning.clientLookahead.milestone=false;await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>__opsTest?.ready);const body=await p.locator('#planningBody').innerText();assert.doesNotMatch(body,/Synthetic Civil Crew|Synthetic shutdown permit|Confirm shutdown access|Anticipated milestones/);assert.match(body,/No linked Client-visible entries shared/);await noWrites(run);
  }finally{await run.close();}
 });
 if(process.env.OCE_CLIENT_CONTEXT_PDF==='1')await check('Representative native A3 Client coordination PDF',async()=>{
  assert.equal(env.engine,'chromium');const run=await open(env,{data:F.board(),audience:clientURL}),p=run.page;
  try{await p.locator('#planningBody .cl-context-table').first().waitFor();await print(p);await p.emulateMedia({media:'print'});await p.pdf({path:path.join(output,'client-lookahead-coordination.pdf'),preferCSSPageSize:true,printBackground:true});await noWrites(run);}finally{await run.close();}
 });
}finally{await env.close();}
assert.ok(results.length,'Filter must match a test');const files=['planning-lookahead.js','planning-control.js','planning-data.js','planning-page.css','tests/client-lookahead-context.cjs','tests/client-lookahead-fixture.cjs'];const receipt={engine:env.engine,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,tests:results,sourceHashes:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]))};fs.writeFileSync(path.join(output,'client-context-results.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({passed:receipt.passed,failed:receipt.failed}));if(receipt.failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
