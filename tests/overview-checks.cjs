const assert=require('node:assert/strict');
const {open}=require('./harness.cjs');
const fixture=require('./workspace-fixture.cjs');
const supported=['dailyWorks','upcoming','issuesDelays','qualityTesting','punchlist','incidents'];
const read=p=>p.evaluate(()=>{let data;document.dispatchEvent(new CustomEvent('oce:overview-read',{detail:{accept:d=>data=d}}));return data;});
const snapshot=p=>p.evaluate(()=>{
  const payload=__opsTest.shareableState();delete payload.publishedAt;
  return {state:structuredClone(__opsTest.state),storage:{...localStorage},sync:{...__opsTest.sync},payload};
});
const enter=p=>p.locator('#wsDestinations [data-ws-route="overview"]').click();
const openOverview=(env,options={})=>open(env,{data:fixture(),...options,audience:'?ui=workspaces&workspace=overview&'+(options.audience||'')});
module.exports=async function overviewChecks(env,check){
  await check('Overview: authoritative counts, lifecycle, dates and recorded project status',async()=>{
    const data=fixture();data.panels.dailyWorks.push(
      {id:'done',main:'DONE SECRET',done:true}, {id:'complete',main:'COMPLETE SECRET',wstatus:'completed'},
      {id:'cancel',main:'CANCEL SECRET',wstatus:'cancelled'}, {id:'old',main:'RETIRED SECRET',resolvedAt:'2020-01-01T00:00:00Z'});
    data.panels.upcoming[0].startDate='2026-10-14';data.panels.upcoming[0].endDate='2026-10-16';
    data.projectSummary.default.compType='exact';data.projectSummary.default.compDate='2026-11-30';
    const run=await openOverview(env,{data});const p=run.page;
    try{
      const dto=await read(p);assert.equal(dto.panels.find(x=>x.id==='dailyWorks').items.length,3);
      assert.equal(await p.locator('[data-ov-count="dailyWorks"] strong').innerText(),'3');
      assert.equal(dto.projects[0].status,'GREEN');assert.equal(dto.projects[0].completion,'30 Nov 2026');
      assert.ok(dto.panels.find(x=>x.id==='upcoming').items[0].labels.includes('14 Oct → 16 Oct · 3 days'));
      assert.doesNotMatch(await p.locator('#wsOverview').innerText(),/SECRET|On track|\d+%|NaN|undefined/);
      for(const id of supported){const actual=await p.evaluate(id=>__opsTest.sortItemsForDisplay(__opsTest.visiblePanelItems(id)).filter(i=>!i.done&&!['completed','cancelled'].includes(i.wstatus)).length,id);assert.equal(dto.panels.find(x=>x.id===id).items.length,actual,id);}
      assert.deepEqual(run.network.errors,[]);
    }finally{await run.close();}
  });
  await check('Overview: project selection, history, reload and board-wide statistics',async()=>{
    const run=await openOverview(env);const p=run.page;
    try{
      const before=await snapshot(p),stats=(await read(p)).stats;
      await p.locator('#projSelect').selectOption('east');
      assert.equal(await p.locator('[data-ov-count="dailyWorks"] strong').innerText(),'1');
      assert.equal(await p.locator('[data-ov-project]').count(),1);
      assert.match(await p.locator('.ov-summary').innerText(),/East workfront/);
      assert.doesNotMatch(await p.locator('#wsOverview').innerText(),/North workfront|Prepare bedding/);
      assert.deepEqual((await read(p)).stats,stats);
      await p.goBack();assert.equal(await p.locator('[data-ov-count="dailyWorks"] strong').innerText(),'3');
      await p.goForward();assert.equal(await p.locator('[data-ov-count="dailyWorks"] strong').innerText(),'1');
      await p.reload();await p.waitForFunction(()=>window.__opsTest?.ready&&document.querySelector('[data-ov-count]'));
      assert.equal(await p.locator('#projSelect').inputValue(),'east');assert.equal(await p.locator('[data-ov-count="dailyWorks"] strong').innerText(),'1');
      const after=await snapshot(p);assert.deepEqual(after.state,before.state);assert.deepEqual(after.sync,before.sync);assert.deepEqual(after.payload,before.payload);
      delete after.storage.offaly_ops_proj;delete before.storage.offaly_ops_proj;assert.deepEqual(after.storage,before.storage);
      assert.equal(run.network.writes.length,0);
    }finally{await run.close();}
  });
  for(const [name,audience] of [['site','crew=test-site'],['client A','view=test-client-0'],['client B','view=test-client-1'],['legacy client','view='],['legacy site','crew=']])
    await check('Overview: audience filtering '+name,async()=>{
      const data=fixture();data.stats.push({id:'hidden',label:'RESTRICTED STAT',value:999,bar:true,vis:{site:false,client:false}});
      data.panels.dailyWorks.push({id:'hidden',main:'RESTRICTED ITEM',vis:{site:false,client:false}});
      const run=await openOverview(env,{data,audience});const p=run.page;
      try{
        const dto=await read(p),permitted=await p.locator('#panelsGrid [data-card]').evaluateAll(es=>es.map(e=>e.dataset.card));
        assert.deepEqual(dto.panels.map(x=>x.id),permitted.filter(id=>supported.includes(id)));
        for(const id of supported.filter(id=>!permitted.includes(id))){assert.equal(await p.locator(`[data-ov-count="${id}"], [data-ov-panel="${id}"]`).count(),0);const title=await p.evaluate(id=>__opsTest.PANELS.find(p=>p.id===id).title,id);assert.ok(!(await p.locator('#wsOverview').textContent()).includes(title));}
        assert.doesNotMatch(JSON.stringify(dto),/RESTRICTED/);assert.doesNotMatch(await p.locator('#wsOverview').textContent(),/RESTRICTED/);
        const scope=await p.evaluate(()=>__opsTest.state.projects.filter(p=>__opsTest.projInScope(p.id)).map(p=>p.id));assert.deepEqual(dto.projects.map(p=>p.id),scope);
        for(const panel of dto.panels){const titles=await p.evaluate(id=>__opsTest.sortItemsForDisplay(__opsTest.visiblePanelItems(id)).filter(i=>!i.done&&!['completed','cancelled'].includes(i.wstatus)).map(i=>i.main||''),panel.id);assert.deepEqual(panel.items.map(i=>i.title),titles);}
        assert.equal(await p.locator('#wsOverview [data-edit],#wsOverview [data-add],#wsOverview [data-vis]').count(),0);assert.equal(run.network.writes.length,0);
      }finally{await run.close();}
    });
  await check('Overview: empty and missing optional fields, legacy stats, safe text and preview limits',async()=>{
    const data=fixture();Object.keys(data.panels).forEach(id=>data.panels[id]=[]);data.projectSummary={};data.stats=[];
    const run=await openOverview(env,{data});const p=run.page;
    try{
      assert.equal(await p.locator('[data-ov-count="dailyWorks"] strong').innerText(),'0');
      assert.match(await p.locator('#wsOverview').innerText(),/Not recorded/);
      assert.equal((await read(p)).panels.reduce((n,p)=>n+p.items.length,0),0);assert.equal(run.network.writes.length,0);
    }finally{await run.close();}
    const sparse=fixture();sparse.panels.dailyWorks=Array.from({length:5},(_,i)=>({id:'sparse'+i,main:i?'Plain record '+i:'<img src=x onerror=alert(1)>',dateAssigned:'bad',dateRequired:'bad'}));
    sparse.projectSummary={default:{compType:'exact',compDate:'bad'}};
    sparse.stats=[{id:'legacy',label:'Legacy statistic',type:'progress',value:'25 m',target:100,unit:'m',freq:'Daily'}];
    const legacy=await openOverview(env,{data:sparse});
    try{
      const p=legacy.page;assert.equal(await p.locator('[data-ov-count="dailyWorks"] strong').innerText(),'5');
      assert.equal(await p.locator('[data-ov-panel="dailyWorks"] li').count(),3);assert.equal(await p.locator('#wsOverview img').count(),0);
      assert.doesNotMatch(await p.locator('#wsOverview').innerText(),/NaN|undefined|Invalid Date/);
      assert.equal((await read(p)).stats[0].bar,'25%');assert.deepEqual((await read(p)).stats[0].fields,[['Frequency','Daily']]);
      assert.deepEqual(legacy.network.errors,[]);
    }finally{await legacy.close();}
  });
  await check('Overview: links retain original editing, summary/stat controls and rollback',async()=>{
    const run=await openOverview(env,{audience:'workspaceProject=default'});const p=run.page;
    try{
      await p.evaluate(()=>{window.__overviewCards=[...document.querySelectorAll('[data-card]')];window.__overviewMap=__opsTest.map;});
      const before=await snapshot(p);
      await p.locator('[data-ov-panel="dailyWorks"] .ov-record-link').first().click();
      assert.equal(await p.locator('body').getAttribute('data-workspace'),'operations');assert.equal(await p.locator('[data-add="dailyWorks"]').isVisible(),true);
      assert.ok(await p.evaluate(()=>__overviewCards.every(e=>e===document.querySelector(`[data-card="${e.dataset.card}"]`))&&__overviewMap===__opsTest.map));assert.deepEqual(await snapshot(p),before);
      await p.locator('[data-edit="dailyWorks:demo-dailyWorks"]').click();await p.locator('#itemModal').waitFor({state:'visible'});
      await p.locator('#fMain').fill('Updated through original form');await p.locator('#itemSave').click();await p.locator('#itemModal').waitFor({state:'hidden'});
      await enter(p);assert.match(await p.locator('[data-ov-panel="dailyWorks"]').innerText(),/Updated through original form/);
      assert.ok(await p.evaluate(()=>__opsTest.state.history['demo-dailyWorks']));
      for(const [target,control] of [['summaryCard','[data-sum-edit]'],['prodStatsCard','#statGrid .lbl']]){
        await p.locator(`#wsOverview [data-ws-target="#${target}"]`).first().click();assert.equal(await p.locator('body').getAttribute('data-workspace'),'all');assert.equal(await p.locator(control).first().isVisible(),true);await enter(p);
      }
      await p.locator('#wsOriginal').click();assert.equal(await p.locator('[data-card]:visible').count(),21);assert.equal(await p.locator('#wsOverview').textContent(),'');assert.equal(run.network.writes.length,0);
    }finally{await run.close();}
  });
  await check('Overview: detached adapter data and repeated rendering cannot mutate operational state',async()=>{
    const run=await openOverview(env);const p=run.page;
    try{
      const before=await snapshot(p);
      await p.evaluate(()=>{document.dispatchEvent(new CustomEvent('oce:overview-read',{detail:{accept:d=>{d.projects[0].name='MUTATION';d.panels[0].items.length=0;d.stats[0].fields.push(['bad','bad']);}}}));for(let i=0;i<5;i++)document.dispatchEvent(new Event('oce:panels-rendered'));});
      assert.deepEqual(await snapshot(p),before);assert.doesNotMatch(await p.locator('#wsOverview').textContent(),/MUTATION/);assert.equal(run.network.writes.length,0);
    }finally{await run.close();}
  });
  await check('Overview: viewers with no summaries or stats expose no stale hidden content',async()=>{
    const data=fixture();data.projectSummary={};data.stats.forEach(s=>{s.vis={site:false,client:false};s.value='98765';});
    const run=await openOverview(env,{data,audience:'view=test-client-0'});
    try{
      const p=run.page,dto=await read(p);assert.deepEqual(dto.projects,[]);assert.equal(dto.stats,null);
      assert.equal(await p.locator('#wsOverview [data-ws-target="#summaryCard"],#wsOverview .ov-production').count(),0);
      assert.doesNotMatch(await p.locator('#wsOverview').textContent(),/Production statistics|Pipe installed|98765|Status note/);
    }finally{await run.close();}
  });
  await check('Overview: published visibility changes remove every restricted title and count',async()=>{
    const run=await openOverview(env,{audience:'view=test-client-0'});const p=run.page;
    try{
      Object.values(run.data.panelVis).forEach(v=>v.client=false);
      run.data.stats.forEach(s=>s.vis.client=false);run.data.projectSummary={};
      run.data.publishedAt='2026-10-13T00:01:00Z';
      await p.clock.fastForward(46000);await p.waitForFunction(()=>!document.querySelector('[data-card]'));
      const dto=await read(p);assert.deepEqual(dto.panels,[]);assert.deepEqual(dto.projects,[]);assert.equal(dto.stats,null);
      assert.equal(await p.locator('#wsOverview [data-ov-count],#wsOverview [data-ov-panel]').count(),0);
      for(const title of Object.values(fixture().panels).flat().map(r=>r.main).filter(Boolean))assert.ok(!(await p.locator('#wsOverview').textContent()).includes(title));
      assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
    }finally{await run.close();}
  });
  await check('Overview: locked editor releases no adapter data before unlock',async()=>{
    const first=await openOverview(env);const hash=await first.page.evaluate(()=>__opsTest.cyrb53('overview-test'));await first.close();
    const data=fixture();data.settings.editPass=hash;const run=await openOverview(env,{data});const p=run.page;
    try{
      assert.equal(await read(p),undefined);assert.equal(await p.locator('#wsOverview').textContent(),'');
      await p.locator('#lockPass').fill('overview-test');await p.locator('#lockBtn').click();
      await p.waitForFunction(()=>document.querySelector('[data-ov-count]'));
      assert.equal((await read(p)).panels.length,6);assert.equal(run.network.writes.length,0);
    }finally{await run.close();}
  });
};
