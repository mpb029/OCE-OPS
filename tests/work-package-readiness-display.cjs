// Targeted display regression: one prerequisite line, unchanged readiness and audience filters.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {start,open,output}=require('./harness.cjs'),fixture=require('./workspace-fixture.cjs');
const results=[];
const wp=(id,fields={})=>({id,main:'Package '+id,project:'default',pct:50,materialsStatus:'not-required',vis:{site:true,client:true},...fields});
const snapshot=p=>p.evaluate(()=>({board:structuredClone(__opsTest.state),storage:{...localStorage},dirty:__opsTest.sync.dirty}));
async function check(env,name,items,verify,audience=''){
 const data=fixture();data.panels.workPackages=items;
 const run=await open(env,{data,audience:'?ui=workspaces&workspace=operations&workspaceProject=default'+audience}),p=run.page;
 try{
  const card=p.locator('[data-card="workPackages"]'),root=card.locator('.card-body>.list>li').filter({has:p.locator('.main').filter({hasText:'Package root'})}).locator('.wp-readiness');
  await root.waitFor();const before=await snapshot(p);
  await verify(root,p);assert.deepEqual(await snapshot(p),before);assert.deepEqual(run.network.writes,[]);assert.deepEqual(run.network.errors,[]);
  results.push({name,status:'PASS'});console.log('PASS '+name);
 }catch(error){results.push({name,status:'FAIL',error:error.stack});console.error('FAIL '+name+' '+error.stack);}finally{await run.close();}
}
(async()=>{const env=await start();try{
 await check(env,'Incomplete, cancelled and completed prerequisites appear once with exact notes; NO GO retained',[
  wp('root',{prerequisiteIds:['B05','B11','cancelled','completed'],constraints:'Root hold-up'}),
  wp('B05',{constraints:'Supplier delay - TBC (30 NOV or 11 DEC)'}),
  wp('B11',{constraints:'RFI pending; Switchboard slab and conduit penetrations\nSB landing Jan 27'}),
  wp('cancelled',{wstatus:'cancelled'}),wp('completed',{wstatus:'completed'})
 ],async root=>{
  assert.equal(await root.locator('.wp-no-go').count(),1);
  for(const id of ['B05','B11','cancelled','completed'])assert.equal((await root.innerText()).split('Package '+id+':').length-1,1,id+' appears once');
  assert.equal(await root.locator('.wp-prerequisite-note').count(),4);
  assert.match(await root.innerText(),/Package B05: Not completed — Supplier delay - TBC \(30 NOV or 11 DEC\)/);
  assert.ok((await root.innerText()).includes('RFI pending; Switchboard slab and conduit penetrations\nSB landing Jan 27'));
  assert.match(await root.innerText(),/Package cancelled: Cancelled, not completed/);
  assert.match(await root.innerText(),/Package completed: Completed/);
  assert.match(await root.innerText(),/Root hold-up/);
 });
 await check(env,'Materials and missing-reference blockers remain explicit; completed prerequisites still permit GO',[
  wp('root',{materialsStatus:'unconfirmed',prerequisiteIds:['B05','missing']}),wp('B05')
 ],async root=>{
  assert.equal(await root.locator('.wp-no-go').count(),1);assert.match(await root.locator('.wp-reasons').innerText(),/Materials unconfirmed/);
  assert.match(await root.locator('.wp-reasons').innerText(),/Missing or ambiguous prerequisite: missing/);
  assert.equal((await root.innerText()).split('Package B05:').length-1,1);
 });
 await check(env,'Completed and retired dependencies retain GO without changing recorded data',[
  wp('root',{prerequisiteIds:['completed','retired'],constraints:'Note only; does not block'}),
  wp('completed',{done:true}),wp('retired',{wstatus:'completed',resolvedAt:'2026-10-10T00:00:00Z',constraints:'Retired record note'})
 ],async root=>{assert.equal(await root.locator('.wp-go').count(),1);assert.match(await root.innerText(),/Package completed: Completed/);});
 for(const [role,audience]of [['Site','&crew=test-site'],['Client','&view=test-client-0']])await check(env,role+' hides restricted prerequisites while retaining NO GO and permitted notes',[
  wp('root',{prerequisiteIds:['B05','private']}),wp('B05',{constraints:'Permitted note'}),
  wp('private',{main:'SECRET PACKAGE',constraints:'SECRET NOTE',vis:{site:false,client:false}})
 ],async(root,p)=>{
  assert.equal(await root.locator('.wp-no-go').count(),1);
  assert.equal((await root.innerText()).split('Package B05:').length-1,1);
  assert.match(await root.innerText(),/Permitted note/);
  assert.match(await root.locator('.wp-reasons').innerText(),/details are not available/);
  assert.doesNotMatch(await p.locator('#panelsGrid').innerText(),/SECRET PACKAGE|SECRET NOTE/);
  assert.equal(await p.locator('[data-edit]:visible,[data-add]:visible').count(),0);
 },audience);
}finally{await env.close();}
const receipt={engine:env.engine,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,tests:results};
fs.writeFileSync(path.join(output,'readiness-display-results.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify({passed:receipt.passed,failed:receipt.failed}));if(receipt.failed)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
