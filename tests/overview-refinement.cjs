const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {root,open}=require('./harness.cjs');
const fixture=require('./workspace-fixture.cjs');
const baseline='8315740977438b1ab825b04374d6cab545547c7d';
const snapshot=p=>p.evaluate(()=>{
  const payload=__opsTest.shareableState();delete payload.publishedAt;
  return {state:structuredClone(__opsTest.state),storage:{...localStorage},sync:{...__opsTest.sync},payload};
});
module.exports=async function refinementChecks(env,check){
  await check('Overview refinement: exact accepted B1 runtime, adapter and metric contracts retained',()=>{
    for(const file of ['index.html','ui-v2.js','ui-v2.css','ui-workspaces.css','tests/overview-checks.cjs','tests/overview-source.cjs','tests/regression.cjs']){
      const before=execFileSync('git',['show',`${baseline}:${file}`],{cwd:root,encoding:'utf8',maxBuffer:2e6}).replace(/\r\n/g,'\n');
      assert.equal(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n'),before,file);
    }
  });
  await check('Overview refinement: default only within opt-in; explicit routes, anchors and audience aliases survive',async()=>{
    for(const [query,expected,audience] of [
      ['',null,'editor'],['?ui=classic',null,'editor'],['?ui=workspaces','overview','editor'],
      ['?ui=workspaces&crew=test-site','overview','site'],['?ui=workspaces&view=test-client-0','overview','client'],
      ['?ui=workspaces#client','overview','client'],['?ui=workspaces&workspace=all','all','editor'],
      ['?ui=workspaces&workspace=operations','operations','editor'],['?ui=workspaces&workspace=unknown','all','editor'],
      ['?ui=workspaces#activity-dailyWorks','operations','editor']]){
      const run=await open(env,{data:fixture(),audience:query});const p=run.page;
      try{
        assert.equal(await p.locator('body').evaluate(e=>e.classList.contains('ws-enabled')),expected!==null,query);
        if(expected)assert.equal(await p.locator('body').getAttribute('data-workspace'),expected,query);
        assert.equal(await p.evaluate(()=>__opsTest.sync.audience),audience,query);
        assert.equal(await p.locator('[data-card]').count(),audience==='editor'?21:await p.evaluate(()=>__opsTest.PANELS.filter(x=>__opsTest.state.panelVis[x.id][__opsTest.sync.audience]).length));
        assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
      }finally{await run.close();}
    }
  });
  for(const [width,height] of [[1440,900],[768,1024],[390,844]])for(const [role,audience] of [['editor',''],['site','crew=test-site'],['client','view=test-client-0']])
    await check(`Overview refinement: ${role} ${width}×${height} hierarchy, disclosure, touch/keyboard and read-only state`,async()=>{
      const run=await open(env,{width,height,touch:width<1200,data:fixture(),audience:'?ui=workspaces&workspaceProject=default&'+audience});const p=run.page;
      try{
        const before=await snapshot(p),briefing=p.locator('.ov-briefing'),toggle=p.locator('.ov-briefing-toggle');
        assert.equal(await briefing.evaluate(e=>e.open),width>=1200);
        assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);
        const limit=width<681?(await p.locator('.ws-bottom').boundingBox()).y:height;
        for(const id of ['dailyWorks','upcoming',...(role==='client'?[]:['issuesDelays'])]){
          const box=await p.locator(`[data-ov-count="${id}"]`).boundingBox();assert.ok(box.y>=0&&box.y+box.height<limit,id+' quick access above fold');assert.ok(box.height>=44);
        }
        const record=await p.locator('[data-ov-panel="dailyWorks"] .ov-record-link').first().boundingBox();
        assert.ok(record.y+record.height<=limit,'First Daily Works record above fold');
        if(role==='client')assert.equal(await p.locator('[data-ov-panel="issuesDelays"],[data-ov-count="issuesDelays"]').count(),0);
        for(const selector of ['.ov-record-link','.ov-tag','.ov-metric-label'])
          assert.ok(await p.locator(selector).first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=14),selector+' readable text');
        assert.ok((await toggle.boundingBox()).height>=44);
        // Native disclosure works with keyboard and actual touch events; no timer or synthetic click bypass.
        await toggle.focus();await p.keyboard.press('Enter');assert.equal(await briefing.evaluate(e=>e.open),width<1200);
        if(width>=1200)await toggle.press('Space');
        assert.equal(await p.locator('.ov-summary-facts').isVisible(),true);
        await p.locator('.ov-outlook summary').focus();await p.keyboard.press('Enter');
        assert.match(await p.locator('.ov-outlook').innerText(),/First 240 m installed/);
        await p.evaluate(()=>document.dispatchEvent(new Event('oce:panels-rendered')));
        assert.equal(await briefing.evaluate(e=>e.open),true,'Refresh retains the briefing disclosure choice');
        if(width<1200){await toggle.tap();assert.equal(await briefing.evaluate(e=>e.open),false);await toggle.tap();}
        else {await toggle.click();await toggle.click();}
        assert.equal(await briefing.evaluate(e=>e.open),true);
        assert.deepEqual(await snapshot(p),before);assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
      }finally{await run.close();}
    });
  await check('Overview refinement: compact all-project briefing, context reset, long text and empty records',async()=>{
    const data=fixture();data.projectSummary.default.statusComment='Long recorded note '.repeat(100);
    const run=await open(env,{width:390,height:844,touch:true,data,audience:'?ui=workspaces'});const p=run.page;
    try{
      assert.equal(await p.locator('.ov-summary').count(),2);
      assert.equal(await p.locator('.ov-briefing').evaluate(e=>e.open),false);
      assert.ok((await p.locator('[data-ov-panel="dailyWorks"] .ov-record-link').first().boundingBox()).y<772);
      await p.locator('.ov-briefing-toggle').tap();assert.match(await p.locator('.ov-briefing').innerText(),/Long recorded note/);
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);
      await p.locator('#projSelect').selectOption('east');
      assert.equal(await p.locator('.ov-briefing').evaluate(e=>e.open),false);
      assert.doesNotMatch(await p.locator('#wsOverview').textContent(),/Long recorded note|North workfront|Prepare bedding/);
      assert.equal(run.network.writes.length,0);
    }finally{await run.close();}
    const empty=fixture();Object.keys(empty.panels).forEach(id=>empty.panels[id]=[]);empty.projectSummary={};empty.stats=[];
    const blank=await open(env,{width:390,height:844,touch:true,data:empty,audience:'?ui=workspaces&workspaceProject=default'});
    try{
      const p=blank.page;assert.equal(await p.locator('[data-ov-count="dailyWorks"] strong').innerText(),'0');
      assert.match(await p.locator('[data-ov-panel="dailyWorks"]').innerText(),/No active records in this view/);
      await p.locator('.ov-briefing-toggle').tap();assert.match(await p.locator('.ov-summary-facts').innerText(),/Not recorded/);
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);assert.equal(blank.network.writes.length,0);
    }finally{await blank.close();}
  });
};
