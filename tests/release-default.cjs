// Release-only acceptance of the owner's workspace-default / classic rollback decision.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const {root,output,start,open}=require('./harness.cjs'),fixture=require('./workspace-fixture.cjs');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const inputFiles=['index.html','ui-workspaces.js','ui-workspaces.css','ui-overview.js','ui-overview.css','tests/harness.cjs','tests/workspace-fixture.cjs','tests/release-default.cjs','tests/release-default-source.cjs'];
const hashes=()=>Object.fromEntries(inputFiles.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
const sourceHashes=hashes(),commit=git(['rev-parse','HEAD']),clean=!git(['status','--porcelain']),startedAt=new Date().toISOString(),results=[];
const snapshot=p=>p.evaluate(()=>({state:structuredClone(__opsTest.state),storage:{...localStorage},sync:{...__opsTest.sync}}));
const entry=(env,options={})=>open(env,{data:fixture(),ui:null,...options});
async function ready(p,workspace='overview'){await p.waitForFunction(id=>document.body.classList.contains('ws-enabled')&&document.body.dataset.workspace===id,workspace);}
async function route(p,id){if(await p.locator('#wsMobileMenu').isVisible()&&!await p.locator('#wsSidebar').isVisible())await p.locator('#wsMobileMenu').click();await p.locator(`#wsDestinations [data-ws-route="${id}"]`).click();await ready(p,id);}
async function original(p){if(await p.locator('#wsMobileMenu').isVisible()&&!await p.locator('#wsSidebar').isVisible())await p.locator('#wsMobileMenu').click();await p.locator('#wsOriginal').click();await p.waitForFunction(()=>!document.body.classList.contains('ws-enabled'));}
async function unchanged(run,before){assert.deepEqual(await snapshot(run.page),before);assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);}
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}catch(error){results.push({name,status:'FAIL',error:error.stack});console.error('FAIL '+name+': '+error.message);}}
(async()=>{const env=await start();try{
 await check('Release default: fresh editor URL opens Overview and retains all original panels without writes',async()=>{
  const run=await entry(env),p=run.page;try{
   await ready(p);assert.equal(await p.locator('#wsTitle').innerText(),'Overview');assert.equal(await p.locator('#panelsGrid>[data-card]').count(),21);assert.equal(await p.locator('[data-ov-add]').count(),3);
   const before=await snapshot(p);await p.evaluate(()=>window.__releasePanels=[...document.querySelectorAll('#panelsGrid>[data-card]')]);
   await route(p,'all');assert.equal(await p.locator('#panelsGrid>[data-card]:visible').count(),21);
   await route(p,'operations');await route(p,'overview');assert.ok(await p.evaluate(()=>__releasePanels.every(node=>node===document.querySelector(`[data-card="${node.dataset.card}"]`))));await unchanged(run,before);
  }finally{await run.close();}
 });
 await check('Release default: tablet and phone entry, drawer, navigation and immediate Original board rollback',async()=>{
  for(const [width,height]of [[768,1024],[390,844]]){const run=await entry(env,{width,height,touch:true}),p=run.page;try{
   await ready(p);const before=await snapshot(p);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
   await route(p,'operations');assert.ok(await p.locator('[data-add="dailyWorks"]').isVisible());await original(p);
   assert.equal(new URL(p.url()).searchParams.get('ui'),'classic');assert.equal(await p.locator('#panelsGrid>[data-card]:visible').count(),21);await unchanged(run,before);
  }finally{await run.close();}}
 });
 await check('Release default: Site, Client and legacy audience hashes retain existing permitted records only',async()=>{
  for(const [audience,mode]of [['?crew=test-site','site'],['?view=test-client-0','client'],['?view=test-client-1','client'],['#crew','site'],['#client','client']]){const run=await entry(env,{audience}),p=run.page;try{
   await ready(p);const before=await snapshot(p);assert.equal(before.sync.audience,mode);assert.equal(await p.locator('[data-ov-add]').count(),0);assert.equal(await p.locator('[data-add]:visible').count(),0);
   const allowed=await p.evaluate(()=>__opsTest.orderedPanels().filter(panel=>__opsTest.state.panelVis[panel.id][__opsTest.sync.audience]).map(panel=>panel.id));
   assert.deepEqual(await p.locator('#panelsGrid>[data-card]').evaluateAll(nodes=>nodes.map(node=>node.dataset.card)),allowed);
   for(const panel of Object.keys(fixture().panels).filter(id=>!allowed.includes(id)))assert.equal(await p.locator(`#wsOverview [data-ov-panel="${panel}"],#wsOverview [data-ov-add="${panel}"]`).count(),0);
   await route(p,'all');await original(p);assert.equal(await p.evaluate(()=>__opsTest.sync.audience),mode);await unchanged(run,before);
  }finally{await run.close();}}
 });
 await check('Release default: explicit classic persists through reload; workspace navigation and browser Back restore it',async()=>{
  const run=await entry(env,{audience:'?ui=classic&keep=original'}),p=run.page;try{
   assert.equal(await p.locator('body').evaluate(node=>node.classList.contains('ws-enabled')),false);const before=await snapshot(p);
   await p.locator('#wsOptIn').click();await ready(p);await p.goBack();await p.waitForFunction(()=>!document.body.classList.contains('ws-enabled'));
   await p.reload();await p.waitForFunction(()=>__opsTest?.ready);assert.equal(await p.locator('body').evaluate(node=>node.classList.contains('ws-enabled')),false);assert.equal(new URL(p.url()).searchParams.get('keep'),'original');await unchanged(run,before);
  }finally{await run.close();}
 });
 await check('Release default: project, workspace and record links retain original query and audience semantics',async()=>{
  const run=await entry(env,{audience:'?workspace=operations&workspaceProject=east&keep=original#activity-dailyWorks'}),p=run.page;try{
   await ready(p,'operations');assert.equal(await p.locator('#projSelect').inputValue(),'east');assert.match(await p.locator('[data-card="dailyWorks"]').innerText(),/East project/);
   const before=await snapshot(p);await route(p,'overview');await p.locator('#wsOverview .ov-record-link').filter({hasText:'East project'}).click();await ready(p,'operations');assert.equal(new URL(p.url()).searchParams.get('workspaceRecord'),'demo-east-only');
   await p.waitForFunction(()=>document.querySelector('.ws-record-target'));assert.match(await p.locator('.ws-record-target').innerText(),/East project/);assert.equal(new URL(p.url()).searchParams.get('keep'),'original');assert.equal(await p.locator('#projSelect').inputValue(),'east');await unchanged(run,before);
  }finally{await run.close();}
 });
 await check('Release default: existing locked editor and sign-in settings remain authoritative',async()=>{
  const data=fixture();data.settings.editPass='existing-test-lock';const run=await entry(env,{data}),p=run.page;try{
   await p.waitForFunction(()=>document.body.classList.contains('locked'));assert.equal(await p.locator('[data-ov-add]:visible').count(),0);assert.equal(await p.locator('[data-add]:visible').count(),0);assert.equal(await p.locator('#wsSidebar').isVisible(),false);
   assert.equal(await p.evaluate(()=>__opsTest.state.settings.editPass),'existing-test-lock');assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 });
}finally{
 await env.close();const inputsUnchanged=JSON.stringify(sourceHashes)===JSON.stringify(hashes());
 const report={commit,endCommit:git(['rev-parse','HEAD']),worktreeClean:clean&&!git(['status','--porcelain']),startedAt,completedAt:new Date().toISOString(),engine:env.engine,sourceHashes,inputsUnchanged,tests:results,passed:results.filter(t=>t.status==='PASS').length,failed:results.filter(t=>t.status==='FAIL').length};
 const directory=path.join(output,'release-default');fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed,inputsUnchanged}));if(report.failed||!inputsUnchanged)process.exitCode=1;
}})().catch(error=>{console.error(error);process.exitCode=1;});
