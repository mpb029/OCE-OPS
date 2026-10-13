const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { root, baseline, original, output, start, open, fixture } = require('./harness.cjs');

const results = [], observations = [];
const startedAt = new Date().toISOString();
const git = args => execFileSync('git',args,{cwd:root}).toString().trim();
const startCommit = git(['rev-parse','HEAD']);
const cleanAtStart = !git(['status','--porcelain']);
const readState = page => page.evaluate(() => structuredClone(__opsTest.state));
// Firefox supports print-media assertions but Playwright PDF export is Chromium-only.
const savePDF = (page, options) => process.env.OCE_ENGINE === 'firefox' ? Promise.resolve() : page.pdf(options);
const value = (page, expression) => page.evaluate(expression);
async function check(name, action) {
 if (process.env.OCE_TEST_FILTER && !new RegExp(process.env.OCE_TEST_FILTER).test(name)) return;
 try { const detail = await action(); const status = detail?.preservation === 'KNOWN BASELINE FAILURE' ? 'KNOWN BASELINE DEFECT' : 'PASS'; results.push({ name, status, detail }); console.log(`${status} ${name}`); }
 catch (error) { results.push({ name, status: 'FAIL', error: error.message }); console.error(`FAIL ${name}: ${error.message.slice(0,400)}`); }
}
async function clickCommand(page, id) {
 if (!(await page.locator('#' + id).isVisible())) await page.locator('#headerMenu summary').click();
 await page.locator('#' + id).click();
}
const withoutId = object => { const copy = structuredClone(object); delete copy.id; return copy; };
async function download(page, action) {
 const waiting = page.waitForEvent('download'); await action();
 const result = await waiting;
 return { name: result.suggestedFilename(), bytes: fs.readFileSync(await result.path()) };
}
async function endPrint(page) {
 await page.emulateMedia({ media: 'screen' });
 await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
}
async function printSnapshot(page) {
 await page.emulateMedia({ media: 'print' });
 return page.evaluate(() => {
  const visible = el => !!el && !!el.getClientRects().length && getComputedStyle(el).display !== 'none';
  return {
   mode: document.body.dataset.print,
   panels: [...document.querySelectorAll('#panelsGrid [data-card]')].filter(visible).map(el => ({ id:el.dataset.card, text:el.innerText, width:Math.round(el.getBoundingClientRect().width) })),
   map: visible(document.querySelector('.map-card')), mapPosition: getComputedStyle(document.getElementById('map')).position, summary: visible(document.querySelector('#summaryCard')),
   models: visible(document.querySelector('#modelCard')), weather: visible(document.querySelector('#weatherCard')),
   header: document.getElementById('phTitle').textContent,
   fonts: getComputedStyle(document.body).fontFamily,
   photos: [...document.querySelectorAll('.photo-folder')].filter(visible).map(el=>el.dataset.folder)
  };
 });
}

async function main() {
 const baselineHTML = execFileSync('git', ['show', `${baseline}:index.html`], { cwd:root, maxBuffer:2e6 }).toString();
 const currentHTML = fs.readFileSync(path.join(root,'index.html'),'utf8');
 await check('Source contract: original print stylesheet and non-repaired business code unchanged', () => {
  const script = html => html.match(/<script>\s*\/\*[^]*?<\/script>/)[0].replace(/\r\n/g,'\n');
  const style = html => html.match(/<style>[^]*?<\/style>/)[0].replace(/\r\n/g,'\n');
  // Deliberately isolated, separately tested repairs. Everything outside these functions
  // must still match the original application, including publishing and role filtering.
  const approved = ['frameAll', 'load', 'importData', 'normaliseBackup', 'loadWorkArea', 'fitFeatures'];
  // Only the two exact, presentation-only Stage A hooks may differ in the runtime.
  // Keeping this an exact subtraction still catches changes inside any CRUD handler.
  const stageAHooks = [
    '    // Stage A presentation hook: the original renderer remains authoritative.\n    document.dispatchEvent(new Event("oce:panels-rendered"));\n',
    '  // Stage A viewport adapter: resize existing instances without fitting or saving.\n  document.addEventListener("oce:workspace-reveal", () => {\n    if (map && document.getElementById("map").getClientRects().length) map.invalidateSize({ animate: false });\n    if (three && document.getElementById("modelStage").getClientRects().length) three.resize();\n  });\n\n'
  ];
  for (const hook of stageAHooks) assert.equal(script(currentHTML).split(hook).length,2,'Stage A hook must be exact and occur once');
  const unchanged = html => approved.reduce((s,name)=>s.replace(new RegExp('  function '+name+'\\([^]*?\\n  }\\n?'),''),stageAHooks.reduce((s,hook)=>s.replace(hook,''),(html===currentHTML ? require('./overview-source.cjs')(script(html)) : script(html)))).replace(/\n{3,}/g,'\n\n');
  assert.equal(unchanged(currentHTML), unchanged(baselineHTML)); assert.equal(style(currentHTML),style(baselineHTML));
 });
 await check('Source contract: all original static IDs and data hooks retained', () => {
  const ids = html => new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]));
  const before = ids(baselineHTML), after = ids(currentHTML);
  for(const id of before) assert.ok(after.has(id), `Missing ${id}`);
  const hooks = html => [...html.matchAll(/\bdata-[a-z-]+(?==)/g)].map(x=>x[0]).sort();
  assert.deepEqual(hooks(currentHTML.replace(/<!-- Backup replacement[^]*?<!-- ============================ ITEM MODAL/, '<!-- ============================ ITEM MODAL')),hooks(baselineHTML));
 });
 await check('Operational data and all attachments unchanged from latest main', () => require('./preservation.cjs')(root,output));
 const env = await start();
 try {
  await require('./phase11-checks.cjs')(env, check);
  await require('./readiness-checks.cjs')(env, check);
  await require('./map-repair-checks.cjs')(env, check);
  const views = [['1920x1080',1920,1080],['1440x900',1440,900],['1366x768',1366,768],['1024x768',1024,768],['768x1024',768,1024],['390x844',390,844],['375x812',375,812],['360x800',360,800]];
  for (const [name,width,height] of views) await check(`Layout ${name}: 21 panels, no overflow, controls and dialogs`, async () => {
    const run = await open(env,{width,height,touch:width<=1024});
    try {
      const p = run.page;
      assert.equal(await p.locator('[data-card]').count(),21);
      const overflow = await p.evaluate(() => ({width:innerWidth,document:document.documentElement.scrollWidth, offenders:[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width && (r.right>innerWidth+1||r.left < -1) && getComputedStyle(el).position!=='absolute';}).map(el=>el.id||el.className).slice(0,12)}));
      assert.ok(overflow.document<=width,JSON.stringify(overflow));
      if(width>1100) { const map = await p.locator('.map-card').boundingBox(), status = await p.locator('#summaryCard').boundingBox(); assert.ok(status.x>map.x);assert.ok(Math.abs(status.y-map.y)<2); }
      assert.equal(await p.locator('#modelStage').isVisible(),false);
      await p.locator('#btnModelToggle').click(); assert.equal(await p.locator('#modelStage').isVisible(),true);
      await p.locator('#btnModelToggle').click();
      await p.locator('#headerMenu summary').click();
      const menuBox = await p.locator('#headerActionList').boundingBox(); assert.ok(menuBox.x>=0 && menuBox.x+menuBox.width<=width);
      await p.screenshot({path:path.join(output,`actions-${name}.png`)});
      await p.keyboard.press('Escape');
      await clickCommand(p,'btnSettings');
      assert.equal(await p.locator('#settingsModal').isVisible(),true);
      const modalBox = await p.locator('#settingsModal .modal').boundingBox(); assert.ok(modalBox.x>=0&&modalBox.x+modalBox.width<=width&&modalBox.height<=height);
      assert.ok(await p.locator('#setToken').count());assert.equal(await p.locator('#setToken').getAttribute('type'),'password');
      await p.locator('#setSave').focus(); await p.keyboard.press('Tab');assert.equal(await p.locator('#settingsModal .modal-close').evaluate(el=>el===document.activeElement),true);
      if(width===1440||width===390) await p.screenshot({path:path.join(output,`settings-${name}.png`)});
      await p.keyboard.press('Escape');assert.equal(await p.locator('#settingsModal').isVisible(),false);
      await p.locator('[data-add="rfis"]').click();await p.waitForTimeout(50);await p.locator('#fMain').fill('Interface review — field-rich RFI');
      await p.locator('[data-fx="detail"]').fill('Confirm the proposed tie-in arrangement and shutdown window.');
      assert.ok(await p.locator('#itemSave').isVisible());
      if(width===1440||width===390) await p.screenshot({path:path.join(output,`rfi-${name}.png`)});
      await p.keyboard.press('Escape');
      assert.equal(await p.locator('[data-add="rfis"]').evaluate(el=>el===document.activeElement),true);
      const row = p.locator('.row-act:visible').first();assert.equal(await row.evaluate(el=>getComputedStyle(el).opacity),'1');
      if(width<=680) assert.ok((await row.locator('button').first().boundingBox()).width>=40);
      if(width<=680) await p.locator('.mobile-map-toggle').click();
      await p.locator('[data-lc-zoom]').first().click();
      if(width<=680) await p.locator('.mobile-map-toggle').click();
      await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(800);
      await p.screenshot({path:path.join(output,`after-${name}.png`)});
      if(width===1440||width===390) {await p.locator('#panelsGrid').evaluate(el=>el.scrollIntoView({block:'start'})); await p.screenshot({path:path.join(output,`panels-${name}.png`)});}
      assert.deepEqual(run.network.errors,[]);
      return { documentWidth:overflow.document, panels:21 };
    } finally {await run.close();}
  });

  const before = await open(env,{version:'before',token:true}), after = await open(env,{token:true});
  try {
    const a=before.page,b=after.page;
    await check('Loaded state, IDs, panel order and share payload match baseline', async () => {
      assert.deepEqual(await readState(b), await readState(a));
      assert.deepEqual(await b.locator('[data-card]').evaluateAll(es=>es.map(e=>e.dataset.card)), await a.locator('[data-card]').evaluateAll(es=>es.map(e=>e.dataset.card)));
      assert.deepEqual(await b.evaluate(()=>__opsTest.shareableState()),await a.evaluate(()=>__opsTest.shareableState()));
    });
    await check('Settings: all mounted fields save the same state as baseline', async () => {
      for(const p of [a,b]) {await clickCommand(p,'btnSettings');await p.locator('#setSave').click();}
      assert.deepEqual(await readState(b),await readState(a));
      assert.equal(await b.locator('#settingsModal').isVisible(),false);
    });
    for(const project of fixture().projects) await check(`Project selection ${project.id}: items and marker scope match baseline`, async () => {
      for(const p of [a,b]) await p.locator('#projSelect').selectOption(project.id);
      const snap=p=>p.evaluate(()=>({ panels:[...document.querySelectorAll('[data-card]')].map(el=>[el.dataset.card,el.querySelector('.count').textContent,el.querySelector('.card-body').textContent.replace(/\s+/g,' ')]),markers:[...document.querySelectorAll('.leaflet-marker-icon')].map(el=>el.title),summary:document.getElementById('summaryBody').textContent.replace(/\s+/g,' ') }));
      assert.deepEqual(await snap(b),await snap(a));
    });
    for(const p of [a,b]) await p.locator('#projSelect').selectOption('all');
    const panels = await b.evaluate(()=>__opsTest.PANELS.map(p=>({id:p.id,kind:p.kind,extras:p.extras})));
    for(const panel of panels.filter(p=>!['files','photos'].includes(p.kind))) await check(`CRUD parity: ${panel.id}, including special fields and history`, async () => {
      const saved=[];
      for(const p of [a,b]) {
        await p.locator(`[data-add="${panel.id}"]`).click();
        await p.waitForTimeout(50); // The existing modal schedules its initial focus at 30 ms.
        await p.locator('#fMain').fill(`REGRESSION ${panel.id}`);
        for(const [selector,text] of [['#fSub','Location / crew details'],['#fRef','REG-012'],['#fDue','2026-10-14'],['#fPct','45']]) if(await p.locator(selector).isVisible()) await p.locator(selector).fill(text);
        for(const extra of panel.extras||[]) await p.locator(`[data-fx="${extra.key}"]`).fill(extra.type==='date'?'2026-10-14':extra.type==='time'?'08:30':extra.type==='number'?'2':`Test ${extra.key}`);
        await p.locator('#fTeam').selectOption('eng');
        await p.locator('#tglAssigned').check();await p.waitForTimeout(30);await p.locator('#fAssigned').fill('2026-10-13');
        await p.locator('#tglRequired').check();await p.waitForTimeout(30);await p.locator('#fRequired').fill('2026-10-15');
        await p.locator('#tglWStatus').check();await p.waitForTimeout(30);await p.locator('#fWStatus').selectOption('inprogress');
        await p.locator('#fVisClient').check();
        if(await p.locator('#tglRange').isVisible()) {await p.locator('#tglRange').check();await p.locator('#fStart').fill('2026-10-14');await p.locator('#fEnd').fill('2026-10-16');}
        if(await p.locator('#fPriority').isVisible()) await p.locator('#fPriority').selectOption('high');
        if(await p.locator('#fStatus').isVisible()) await p.locator('#fStatus').selectOption({index:0});
        await p.locator('#itemSave').click();
        const it=(await readState(p)).panels[panel.id].find(x=>x.main===`REGRESSION ${panel.id}`);assert.ok(it,`Saved ${panel.id}: ${JSON.stringify((await readState(p)).panels[panel.id].at(-1))}`);
        await p.locator(`[data-edit="${panel.id}:${it.id}"]`).click();await p.waitForTimeout(50);await p.locator('#fMain').fill(`EDITED ${panel.id}`);await p.locator('#itemSave').click();
        const state=await readState(p);saved.push({item:withoutId(state.panels[panel.id].find(x=>x.id===it.id)),history:withoutId(state.history[it.id])});
        await p.locator(`[data-del="${panel.id}:${it.id}"]`).click();assert.ok(!(await readState(p)).panels[panel.id].some(x=>x.id===it.id));assert.ok((await readState(p)).history[it.id]);
      }
      assert.deepEqual(saved[1],saved[0]);
    });
    await check('Completion, active sorting and 24-hour retirement retain history', async () => {
      const p=b; await p.locator('[data-add="meetings"]').click();await p.locator('#fMain').fill('RETIREMENT TEST');await p.locator('#fDue').fill('2026-10-13');await p.locator('#itemSave').click();
      const item=(await readState(p)).panels.meetings.find(i=>i.main==='RETIREMENT TEST');
      await p.locator(`[data-done="meetings:${item.id}"]`).click();assert.equal((await readState(p)).panels.meetings.find(i=>i.id===item.id).done,true);
      const selected=await p.evaluate(id=>__opsTest.sortItemsForDisplay(__opsTest.state.panels.meetings).map(i=>i.id).includes(id),item.id);assert.equal(selected,true);
      await p.clock.setFixedTime(new Date('2026-10-14T01:00:00+10:00'));
      assert.equal(await p.evaluate(id=>__opsTest.sortItemsForDisplay(__opsTest.state.panels.meetings).some(i=>i.id===id),item.id),false);
      assert.ok((await readState(p)).history[item.id]);await p.clock.setFixedTime(new Date('2026-10-13T00:00:00+10:00'));
      await p.locator(`[data-del="meetings:${item.id}"]`).click();
    });
    await check('Item and panel S/C toggles preserve one-click state changes', async () => {
      const p=b;await p.locator('[data-add="dailyWorks"]').click();await p.waitForTimeout(50);await p.locator('#fMain').fill('VISIBILITY TEST');await p.locator('#itemSave').click();
      const beforeState=await readState(p);const control=p.locator('[data-vis^="client:dailyWorks:"]').first();const hook=await control.getAttribute('data-vis');assert.ok(hook);
      await control.click();assert.equal(await p.locator(`[data-vis="${hook}"]`).getAttribute('aria-pressed'),String(!beforeState.panels.dailyWorks.find(i=>i.id===hook.split(':')[2]).vis.client));
      await p.locator(`[data-vis="${hook}"]`).click();
      const old=beforeState.panelVis.dailyWorks?.client||false;await p.locator('[data-pvis="client:dailyWorks"]').click();assert.equal((await readState(p)).panelVis.dailyWorks.client,!old);await p.locator('[data-pvis="client:dailyWorks"]').click();
      await p.locator(`[data-del="dailyWorks:${hook.split(':')[2]}"]`).click();
    });
    await check('Production stat: extra fields, target, edit, visibility and delete', async () => {
      const p=b;await p.locator('#addStat').click();await p.locator('#sLabel').fill('TEST pipe installed');await p.locator('#sBar').check();await p.locator('#sValue').fill('120');await p.locator('#sTarget').fill('240');await p.locator('#sUnit').fill('m');await p.locator('#sAddField').click();await p.locator('.sf-label').last().fill('Crew');await p.locator('.sf-value').last().fill('Blue');await p.locator('#sVisClient').check();await p.locator('#sSave').click();
      let stat=(await readState(p)).stats.find(s=>s.label==='TEST pipe installed');assert.ok(stat);assert.equal(stat.target,'240');assert.deepEqual(stat.fields,[{label:'Crew',value:'Blue'}]);
      await p.locator(`[data-stat="${stat.id}"] .lbl`).click();await p.locator('#sValue').fill('180');await p.locator('#sSave').click();assert.equal((await readState(p)).stats.find(s=>s.id===stat.id).value,'180');
      await p.locator(`[data-stvis="client:${stat.id}"]`).click();assert.equal((await readState(p)).stats.find(s=>s.id===stat.id).vis.client,false);
      await p.locator(`[data-stat-del="${stat.id}"]`).click();assert.ok(!(await readState(p)).stats.some(s=>s.id===stat.id));
    });
    await check('Publishing: intercepted payload, pending, clean, rejection, no real writes', async () => {
      const p=b;const expected=await p.evaluate(()=>__opsTest.shareableState());await p.locator('#btnPublish').click();await p.waitForFunction(()=>!__opsTest.sync.busy&&!__opsTest.sync.dirty);
      const write=after.network.writes.at(-1);assert.match(write.url,/regression-fixture\/test-board\/contents\/data.json/);assert.equal(write.body.branch,'test-only');assert.deepEqual(JSON.parse(Buffer.from(write.body.content,'base64').toString()),expected);assert.ok(!write.body.content.includes('fixture-token'));assert.ok(await p.locator('#btnPublish').getAttribute('class').then(c=>c.includes('pub-clean')));
      await p.locator('[data-pvis="site:dailyWorks"]').click();after.network.publishFailure=true;await p.locator('#btnPublish').click();await p.waitForFunction(()=>!__opsTest.sync.busy);assert.equal(await p.evaluate(()=>__opsTest.sync.dirty),true);assert.match(await p.locator('#toast').innerText(),/rejected/);after.network.publishFailure=false;
    });
    await check('Export: complete saved state and legacy panel retained', async () => {
      const state=await readState(b);const exported=await download(b,()=>clickCommand(b,'btnExport'));assert.deepEqual(JSON.parse(exported.bytes),state);assert.ok(Object.hasOwn(JSON.parse(exported.bytes).panels,'subbiesTomorrow'));
      const csv=await download(b,()=>clickCommand(b,'btnSettings').then(()=>b.locator('#btnHistory').click()));assert.match(csv.name,/\.csv$/);assert.ok(csv.bytes.length>100);await b.keyboard.press('Escape');
    });
    await check('Original operational entries, IDs and legacy keys preserved after editing', async () => {
      const state=await readState(b), initial=fixture();
      for(const [pid,items] of Object.entries(initial.panels)) for(const item of items) assert.deepEqual(state.panels[pid].find(i=>i.id===item.id),item);
      assert.deepEqual(state.projects,initial.projects);assert.deepEqual(state.clients,initial.clients);assert.deepEqual(state.markers,initial.markers);assert.deepEqual(state.mapLayers,initial.mapLayers);
    });
    await check('Browser runtime has no new uncaught errors after all editing workflows',()=>assert.deepEqual(after.network.errors,before.network.errors));
  } finally {await before.close();await after.close();}

  for (const audience of ['?crew=test-site','?view=test-client-0','?view=test-client-1','?view=unknown']) await check(`Audience parity ${audience}: panels, assignments, read-only controls`, async () => {
    const a=await open(env,{version:'before',audience}),b=await open(env,{audience});
    try {
      const snap=p=>p.evaluate(()=>({role:__opsTest.sync.audience,clientId:__opsTest.sync.clientId,projects:[...document.querySelector('#projSelect').options].map(o=>({id:o.value,text:o.text})),panels:[...document.querySelectorAll('[data-card]')].map(el=>({id:el.dataset.card,body:el.querySelector('.card-body').textContent.replace(/\s+/g,' ')})),stats:document.querySelector('#statGrid').textContent.replace(/\s+/g,' '),markers:document.querySelectorAll('.leaflet-marker-icon').length}));
      assert.deepEqual(await snap(b.page),await snap(a.page));
      for(const selector of ['#btnSettings','#btnImport','#btnPublish','[data-edit]','[data-del]','[data-pvis]','#modelTools']) assert.equal(await b.page.locator(selector+':visible').count(),0,selector);
      await b.page.screenshot({path:path.join(output,audience.includes('crew')?'site-view.png':audience.endsWith('1')?'client-1-view.png':'client-view.png')});
    } finally {await a.close();await b.close();}
  });

  await check('Empty board: all panel entry points, Settings and model access remain usable', async () => {
    const data=fixture();for(const key of Object.keys(data.panels))data.panels[key]=[];data.markers=[];data.stats=[];data.mapLayers=[];data.history={};data.projectSummary={};
    const run=await open(env,{data,width:360,height:800,touch:true});try{assert.equal(await run.page.locator('[data-card]').count(),21);assert.equal(await run.page.locator('[data-empty-add]').count(),21);assert.ok(await run.page.locator('#btnModelUpload').isVisible());assert.equal(await run.page.evaluate(()=>document.documentElement.scrollWidth),360);await run.page.screenshot({path:path.join(output,'empty-mobile.png')});}finally{await run.close();}
  });

  await require('./backup-checks.cjs')(env, check);

  await check('Print parity: full report, single panel, punch sheet and photo folder selection', async () => {
    const a=await open(env,{version:'before'}),b=await open(env);
    try {
      // The repaired base-map loader intentionally changes the initial map extent.
      // Compare print layout using the same selected operational layer and zoom.
      for(const run of [a,b]) {
        const p=run.page;
        const layer=await p.evaluate(()=>__opsTest.state.mapLayers.find(l=>l.type!=='tiles').id);
        await p.locator(`[data-lc-zoom="${layer}"]`).click();
        while(await p.evaluate(()=>__opsTest.map.getZoom())>18)await p.locator('.leaflet-control-zoom-out').click();
      }
      for(const mode of ['report','dailyWorks','punchlist','photos']) {
        const snapshots=[];
        for(const run of [a,b]) {
          const p=run.page;await endPrint(p);
          const printCalls=await p.evaluate(()=>window.__printCalls||0);
          if(mode==='report')await clickCommand(p,'btnPrint');
          else if(mode==='photos'){await p.locator('[data-photo-report="weeklyPhotos"]').click();const picks=p.locator('#photoFolderList input');for(let i=1;i<await picks.count();i++)await picks.nth(i).uncheck();await p.locator('#photoPrintGo').click();}
          else await p.locator(`[data-print-panel="${mode}"]`).click();
          // Honour the application's image preload/print callback before capturing.
          await p.waitForFunction(n=>(window.__printCalls||0)>n,printCalls,{timeout:15000});
          snapshots.push(await printSnapshot(p));
        }
        assert.deepEqual(snapshots[1],snapshots[0],mode);
        assert.equal(snapshots[1].models,false);
        if(mode==='report') assert.equal(snapshots[1].panels.length,21);else assert.equal(snapshots[1].panels.length,1);
        if(mode==='photos')assert.equal(snapshots[1].photos.length,1);
        if(mode==='punchlist')assert.ok(await b.page.locator('.print-this .print-sheet:visible').count()>0);
        await b.page.screenshot({path:path.join(output,`print-${mode}.png`)});
        await savePDF(a.page,{path:path.join(output,`before-print-${mode}.pdf`),format:'A4',printBackground:true});
        await savePDF(b.page,{path:path.join(output,`print-${mode}.pdf`),format:'A4',printBackground:true});
      }
    } finally {await a.close();await b.close();}
  });
  await check('Client report parity: same authorized panels, no map or weather', async () => {
    const a=await open(env,{version:'before',audience:'?view=test-client-1'}),b=await open(env,{audience:'?view=test-client-1'});
    try{for(const run of[a,b])await clickCommand(run.page,'btnPrint');const actual=await printSnapshot(b.page);assert.deepEqual(actual,await printSnapshot(a.page));assert.equal(actual.map,false);assert.equal(actual.weather,false);await savePDF(a.page,{path:path.join(output,'before-print-client.pdf'),format:'A4',printBackground:true});await savePDF(b.page,{path:path.join(output,'print-client.pdf'),format:'A4',printBackground:true});}finally{await a.close();await b.close();}
  });

  await spatialChecks(env);
  await fileChecks(env);
  await accessChecks(env);
  await finalChecks(env);
 } finally {await env.close();}
 const previousPath=path.join(output,'regression-results.json');
 let merged=results, notes=observations;
 if(process.env.OCE_TEST_FILTER && fs.existsSync(previousPath)) {const previous=JSON.parse(fs.readFileSync(previousPath));const byName=new Map(previous.tests.map(r=>[r.name,r]));results.forEach(r=>byName.set(r.name,r));merged=[...byName.values()];notes=[...previous.observations,...observations.filter(o=>!previous.observations.some(p=>p.detail===o.detail))];}
 const endCommit = git(['rev-parse','HEAD']);
 const report={ baseline, commit:startCommit, endCommit, sourceChangedDuringRun:startCommit!==endCommit, mainCommit:git(['rev-parse','origin/main']), worktreeClean:cleanAtStart&&!git(['status','--porcelain']), startedAt, completedAt:new Date().toISOString(), fullRun:!process.env.OCE_TEST_FILTER, environment:{engine:env.engine,browserVersion:env.browser.version(),platform:process.platform,fixtures:'isolated server; real Leaflet/proj4/Three; synthetic weather; intercepted GitHub writes',limitations:env.engine==='firefox'?['Native print dialog and PDF export untested; print-media parity checked']:[]}, tests:merged, observations:notes };
 fs.writeFileSync(path.join(output,'regression-results.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,knownBaselineDefects:results.filter(r=>r.status==='KNOWN BASELINE DEFECT').length,observations},null,2));
 if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
 if(process.env.CI && (report.sourceChangedDuringRun || !report.worktreeClean)) { console.error('CI source changed or was not clean during verification');process.exitCode=1; }
}

// Appended below: real map/3D, files, lock and polling exercises.
async function spatialChecks(env) {
 await check('Map: marker add, edit, drag, tie-in letter, visibility, delete and cancel',async()=>{
  const data=fixture();data.markers=[];data.mapLayers=[];
  const run=await open(env,{data});const p=run.page;
  try {
   assert.equal(await p.locator('#catSelect option').count(),9);
   await p.locator('#catSelect').selectOption('tie');await p.locator('#btnAddMode').click();await p.locator('#map').click({position:{x:180,y:190}});
   // The original modal schedules title focus after 30 ms; allow that callback before typing.
   await p.waitForTimeout(50);
   await p.locator('#mkTitle').fill('TEST tie-in');await p.locator('#mkNotes').fill('Survey check');await p.locator('#mkLetter').fill('Q');await p.locator('#mkVisClient').check();await p.locator('#mkSave').click();
   let marker=(await readState(p)).markers[0];assert.equal(marker.letter,'Q');assert.equal(marker.notes,'Survey check');assert.equal(marker.vis.client,true);
   await p.locator('.leaflet-marker-icon').click();await p.locator(`[data-mk-edit="${marker.id}"]`).click();await p.locator('#mkTitle').fill('TEST updated tie-in');await p.locator('#mkSave').click();
   const box=await p.locator('.leaflet-marker-icon').boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+55,box.y+35,{steps:10});await p.mouse.up();
   const moved=(await readState(p)).markers[0];assert.notEqual(moved.lng,marker.lng);assert.equal(moved.title,'TEST updated tie-in');
   await p.locator('.leaflet-marker-icon').click();await p.locator(`[data-mk-del="${marker.id}"]`).click();assert.equal((await readState(p)).markers.length,0);
   await p.locator('#btnAddMode').click();await p.locator('#map').click({position:{x:180,y:190}});await p.locator('#markerModal .modal-close').click();assert.equal((await readState(p)).markers.length,0);
   assert.deepEqual(run.network.errors,[]);
  } finally {await run.close();}
 });
 await check('Map: GeoJSON + MGA56 reprojection, styles, visibility, imagery, resizing',async()=>{
  const data=fixture();data.mapLayers=[];data.markers=[];const run=await open(env,{data});const p=run.page;
  try {
   const coords=await p.evaluate(()=>proj4('EPSG:4326','EPSG:28356',[153.088,-25.906]));
   const geo={type:'FeatureCollection',features:[{type:'Feature',properties:{name:'Test alignment'},geometry:{type:'LineString',coordinates:[[153.088,-25.906],[153.089,-25.905]]}}]};
   const mga={type:'FeatureCollection',crs:{type:'name',properties:{name:'EPSG:28356'}},features:[{type:'Feature',properties:{name:'Test survey'},geometry:{type:'Point',coordinates:coords}}]};
   await p.locator('#fileGeo').setInputFiles([{name:'test.geojson',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(geo))},{name:'survey.geojson',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(mga))}]);
   await p.waitForFunction(()=>__opsTest.state.mapLayers.length===2);let layers=(await readState(p)).mapLayers;
   const projected=layers.find(l=>l.name==='survey').data.features[0].geometry.coordinates;assert.ok(Math.abs(projected[0]-153.088)<1e-7);assert.ok(Math.abs(projected[1]+25.906)<1e-7);
   const id=layers.find(l=>l.name==='test').id;
   await p.locator(`[data-lc-w="${id}"]`).fill('7');await p.locator(`[data-lc-w="${id}"]`).press('Tab');
   await p.locator(`[data-lc-dash="${id}"]`).selectOption('8,6');
   await p.locator(`[data-lc-color="${id}"]`).evaluate(el=>{el.value='#123456';el.dispatchEvent(new Event('change',{bubbles:true}));});
   layers=(await readState(p)).mapLayers;assert.deepEqual(layers.find(l=>l.id===id).style,{weight:7,dash:'8,6',color:'#123456'});
   await p.locator(`[data-lc-toggle="${id}"]`).uncheck();assert.equal((await readState(p)).mapLayers.find(l=>l.id===id).visible,false);await p.locator(`[data-lc-toggle="${id}"]`).check();await p.locator(`[data-lc-zoom="${id}"]`).click();
   const previousBase=(await readState(p)).base;await p.locator('#btnBase').click();assert.notEqual((await readState(p)).base,previousBase);await p.locator('#btnBase').click();
   const responses=['https://tiles.example.test/{z}/{x}/{y}.png','Test imagery'];await p.route('https://tiles.example.test/**',route=>route.fulfill({contentType:'image/png',body:require('./fixtures.cjs').pixel}));
   p.on('dialog',dialog=>dialog.accept(responses.shift()));await p.locator('#btnImagery').click();await p.waitForFunction(()=>__opsTest.state.mapLayers.some(l=>l.name==='Test imagery'));
   await p.setViewportSize({width:390,height:844});await p.locator('.mobile-map-toggle').click();await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>__opsTest.map.getSize().x),await p.locator('#map').evaluate(el=>el.clientWidth));
   await p.locator(`[data-lc-remove="${id}"]`).click();assert.ok(!(await readState(p)).mapLayers.some(l=>l.id===id));assert.deepEqual(run.network.errors,[]);
  } finally {await run.close();}
 });
 await check('Map: actual GeoTIFF parser and session raster toggle/zoom/remove',async()=>{
  const run=await open(env);const p=run.page;try{
   const before=await readState(p);await p.locator('#fileGeo').setInputFiles({name:'fixture.tif',mimeType:'image/tiff',buffer:require('./fixtures.cjs').geotiff()});
   await p.waitForFunction(()=>Object.keys(__opsTest.rasterLayers).length===1,null,{timeout:60000});const id=await p.evaluate(()=>Object.keys(__opsTest.rasterLayers)[0]);
   await p.locator(`[data-lc-toggle="${id}"]`).uncheck();assert.equal(await p.evaluate(id=>__opsTest.map.hasLayer(__opsTest.rasterLayers[id].layer),id),false);await p.locator(`[data-lc-toggle="${id}"]`).check();await p.locator(`[data-lc-zoom="${id}"]`).click();
   assert.deepEqual((await readState(p)).mapLayers,before.mapLayers);await p.locator(`[data-lc-remove="${id}"]`).click();assert.equal(await p.evaluate(()=>Object.keys(__opsTest.rasterLayers).length),0);
  }finally{await run.close();}
 });
 await check('3D: real OBJ/STL imports, orbit/pan/zoom/reset, up-axis, collapse/resize/fullscreen',async()=>{
  const run=await open(env);const p=run.page;try {
   await p.locator('#fileModel').setInputFiles(path.join(root,'G4N.obj'));
   await p.waitForFunction(()=>__opsTest.three&&Object.keys(__opsTest.loadedObjs).length===1,null,{timeout:60000});
   assert.equal(await p.locator('#modelStage').isVisible(),true);assert.equal((await readState(p)).models.length,0);assert.equal(await p.locator('[data-model-toggle]').count(),1);
   await p.locator('#modelCard').evaluate(el=>el.scrollIntoView({block:'start'}));await p.screenshot({path:path.join(output,'model-obj.png')});
   const distance=()=>p.evaluate(()=>__opsTest.three.camera.position.distanceTo(__opsTest.three.controls.target));const initial=await distance();await p.locator('[data-mtool="zoomin"]').click();assert.ok(await distance()<initial);await p.locator('[data-mtool="zoomout"]').click();
   await p.locator('[data-mtool="pan"]').click();assert.equal(await p.locator('[data-mtool="pan"]').getAttribute('class'),'mt on');
   const targetBefore=await p.evaluate(()=>__opsTest.three.controls.target.toArray());const canvas=await p.locator('.model-canvas').boundingBox();await p.mouse.move(canvas.x+100,canvas.y+150);await p.mouse.down();await p.mouse.move(canvas.x+160,canvas.y+170,{steps:8});await p.mouse.up();assert.notDeepEqual(await p.evaluate(()=>__opsTest.three.controls.target.toArray()),targetBefore);
   await p.locator('[data-mtool="orbit"]').click();const camBefore=await p.evaluate(()=>__opsTest.three.camera.position.toArray());await p.mouse.move(canvas.x+150,canvas.y+170);await p.mouse.down();await p.mouse.move(canvas.x+220,canvas.y+210,{steps:8});await p.mouse.up();assert.notDeepEqual(await p.evaluate(()=>__opsTest.three.camera.position.toArray()),camBefore);
   await p.locator('[data-mtool="reset"]').click();await p.locator('[data-model-flip]').first().click();assert.equal(await p.evaluate(()=>Object.values(__opsTest.sessionModels)[0].upAxis),'y');
   await p.locator('#btnModelToggle').click();assert.equal(await p.locator('#modelStage').isVisible(),false);await p.locator('#btnModelToggle').click();
   await p.setViewportSize({width:390,height:844});await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>__opsTest.three.renderer.domElement.width),await p.locator('#modelStage').evaluate(el=>el.clientWidth));
   await p.locator('[data-mtool="full"]').click();await p.waitForFunction(()=>!!document.fullscreenElement);await p.locator('[data-mtool="full"]').click();await p.waitForFunction(()=>!document.fullscreenElement);
   await p.locator('#fileModel').setInputFiles({name:'fixture.stl',mimeType:'model/stl',buffer:require('./fixtures.cjs').stl});await p.waitForFunction(()=>Object.keys(__opsTest.loadedObjs).length===2);
   await p.locator('[data-model-toggle]').last().uncheck();await p.locator('[data-model-toggle]').last().check();await p.locator('[data-model-del]').last().click();await p.locator('[data-model-del]').first().click();assert.equal(await p.locator('#modelStage').isVisible(),false);assert.deepEqual(run.network.errors,[]);
  } finally {await run.close();}
 });
 await check('3D: hosted GLB and GLTF load, shared visibility and removal',async()=>{
  const run=await open(env);const p=run.page;try{
   const answers=[`${env.url}/after/tests/fixture.glb`,'Shared GLB',`${env.url}/after/tests/fixture.gltf`,'Shared GLTF'];p.on('dialog',d=>d.accept(answers.shift()));
   await p.locator('#btnModelUrl').click();await p.waitForFunction(()=>__opsTest.three&&Object.keys(__opsTest.loadedObjs).length===1,null,{timeout:60000});
   await p.locator('#btnModelUrl').click();await p.waitForFunction(()=>Object.keys(__opsTest.loadedObjs).length===2);assert.equal((await readState(p)).models.length,2);
   const id=(await readState(p)).models[0].id;await p.locator(`[data-model-toggle="${id}"]`).uncheck();assert.equal((await readState(p)).models[0].visible,false);await p.locator(`[data-model-del="${id}"]`).click();assert.equal((await readState(p)).models.length,1);assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 });
}
async function fileChecks(env) {
 await check('Files: upload/download/delete and unchanged 25 MB limit (intercepted API)',async()=>{
  const run=await open(env,{token:true});const p=run.page;try{
   const initial=(await readState(p)).panels.documents.length;
   const chooser=p.waitForEvent('filechooser');await p.locator('[data-add="documents"]').click();await(await chooser).setFiles({name:'regression.txt',mimeType:'text/plain',buffer:Buffer.from('Test file')});
   await p.waitForFunction(n=>__opsTest.state.panels.documents.length===n+1,initial);const item=(await readState(p)).panels.documents.at(-1);assert.equal(item.name,'regression.txt');assert.equal(run.network.writes.at(-1).method,'PUT');
   const file=await download(p,()=>p.locator(`[data-dl="documents:${item.id}"]`).click());assert.match(file.bytes.toString(),/regression test attachment/);
   await p.locator(`[data-fdel="documents:${item.id}"]`).click();await p.waitForFunction(n=>__opsTest.state.panels.documents.length===n,initial);assert.equal(run.network.writes.at(-1).method,'DELETE');
   const writes=run.network.writes.length;await p.locator('#fileAttach').setInputFiles({name:'oversize.bin',mimeType:'application/octet-stream',buffer:Buffer.alloc(25*1024*1024+1)});assert.match(await p.locator('#toast').innerText(),/25 MB/);assert.equal(run.network.writes.length,writes);
  }finally{await run.close();}
 });
 await check('Photos: evidence add/remove, weekly folders, ZIP download and delete',async()=>{
  const run=await open(env,{token:true});const p=run.page;try{
   await p.locator('[data-add="incidents"]').click();await p.waitForTimeout(50);await p.locator('#fMain').fill('PHOTO TEST');
   const chooser=p.waitForEvent('filechooser');await p.locator('#btnAddPhoto').click();await(await chooser).setFiles({name:'evidence.png',mimeType:'image/png',buffer:require('./fixtures.cjs').pixel});await p.waitForFunction(()=>document.querySelectorAll('#photoStrip .thumb').length===1);
   await p.locator('#itemSave').click();const incident=(await readState(p)).panels.incidents.find(i=>i.main==='PHOTO TEST');assert.equal(incident.photos.length,1);await p.locator(`[data-edit="incidents:${incident.id}"]`).click();await p.locator('[data-ph-del]').click();await p.locator('#itemSave').click();assert.equal((await readState(p)).panels.incidents.find(i=>i.id===incident.id).photos.length,0);
   await p.locator('[data-add="weeklyPhotos"]').click();await p.waitForTimeout(50);await p.locator('#fMain').fill('TEST photo folder');await p.locator('[data-fx="folderDate"]').fill('2026-10-13');
   await p.locator('#photoAttach').setInputFiles({name:'weekly.png',mimeType:'image/png',buffer:require('./fixtures.cjs').pixel});await p.waitForFunction(()=>document.querySelectorAll('#photoStrip .thumb').length===1);await p.locator('#itemSave').click();const folder=(await readState(p)).panels.weeklyPhotos.find(i=>i.main==='TEST photo folder');
   await p.locator(`[data-folder-toggle="${folder.id}"]`).click();assert.ok(await p.locator(`[data-folder="${folder.id}"] .photo img`).isVisible());
   const zip=await download(p,()=>p.locator(`[data-folder-dl="${folder.id}"]`).click());assert.match(zip.name,/\.zip$/);assert.equal(zip.bytes.subarray(0,2).toString(),'PK');
   await p.locator(`[data-del="weeklyPhotos:${folder.id}"]`).click();await p.locator(`[data-del="incidents:${incident.id}"]`).click();assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 });
}
async function accessChecks(env) {
 await check('Lock: wrong password rejected, valid password unlocks, viewer bypass unchanged',async()=>{
  const first=await open(env);const hash=await first.page.evaluate(()=>__opsTest.cyrb53('test-password'));await first.close();
  const data=fixture();data.settings.editPass=hash;const run=await open(env,{data});const p=run.page;try{
   assert.equal(await p.locator('#lockScreen').isVisible(),true);await p.locator('#lockPass').fill('wrong');await p.locator('#lockBtn').click();assert.equal(await p.locator('#lockErr').isVisible(),true);
   await p.locator('#lockPass').fill('test-password');await p.locator('#lockBtn').click();assert.equal(await p.locator('#lockScreen').isVisible(),false);assert.equal(await p.locator('[data-card]').count(),21);
   await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__opsTest?.ready);assert.equal(await p.locator('#lockScreen').isVisible(),false);
  }finally{await run.close();}
  const viewer=await open(env,{data,audience:'?crew=test-site'});try{assert.equal(await viewer.page.locator('#lockScreen').isVisible(),false);assert.equal(await viewer.page.evaluate(()=>__opsTest.sync.audience),'site');}finally{await viewer.close();}
 });
 await check('Read-only polling: remote update after 45 seconds and viewer ordering',async()=>{
  const run=await open(env,{audience:'?crew=test-site'});const p=run.page;try{
   const reads=run.network.sharedReads;run.data.publishedAt='2026-10-13T00:01:00.000Z';run.data.panels.dailyWorks.push({id:'remote-poll-item',main:'REMOTE POLL TEST',vis:{site:true,client:false}});run.data.panelMeta.dailyWorks={updated:'2026-10-13T00:01:00.000Z'};
   await p.clock.fastForward(46000);await p.waitForFunction(()=>__opsTest.state.panels.dailyWorks.some(i=>i.id==='remote-poll-item'));
   assert.ok(run.network.sharedReads>reads);assert.match(await p.locator('[data-card="dailyWorks"]').innerText(),/REMOTE POLL TEST/);assert.equal(await p.locator('[data-card]').first().getAttribute('data-card'),'dailyWorks');
  }finally{await run.close();}
 });
 await check('Local persistence: unpublished edits survive reload and stale remote data',async()=>{
  const run=await open(env);const p=run.page;try{
   await p.locator('[data-add="dailyWorks"]').click();await p.waitForTimeout(50);await p.locator('#fMain').fill('LOCAL PERSISTENCE TEST');await p.locator('#itemSave').click();const before=await readState(p);
   await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__opsTest?.ready);assert.deepEqual(await readState(p),before);assert.equal(await p.evaluate(()=>__opsTest.sync.dirty),true);assert.ok((await readState(p)).panels.dailyWorks.some(i=>i.main==='LOCAL PERSISTENCE TEST'));
  }finally{await run.close();}
 });
}
main().catch(e=>{console.error(e);process.exitCode=1;});

async function finalChecks(env) {
 await check('Settings editing: clients, project assignments, location, CRS, token and password',async()=>{
  const outcomes=[];
  for(const version of ['before','after']) {
   const run=await open(env,{version});const p=run.page;
   try {
    await clickCommand(p,'btnSettings');await p.waitForTimeout(50);
    await p.locator('#newClientName').fill('TEST CLIENT');await p.locator('#addClientBtn').click();
    let state=await readState(p);const client=state.clients.find(c=>c.name==='TEST CLIENT');assert.ok(client.key);
    await p.locator('#newProjName').fill('TEST PROJECT');await p.locator('#addProjBtn').click();
    state=await readState(p);const project=state.projects.find(r=>r.name==='TEST PROJECT');
    await p.locator(`[data-pc="${project.id}:${client.id}"]`).check();
    assert.deepEqual((await readState(p)).projects.find(r=>r.id===project.id).clients,[client.id]);
    await p.locator(`[data-client-name="${client.id}"]`).fill('RENAMED CLIENT');await p.locator(`[data-client-name="${client.id}"]`).press('Tab');
    await p.locator(`[data-proj-name="${project.id}"]`).fill('RENAMED PROJECT');await p.locator(`[data-proj-name="${project.id}"]`).press('Tab');
    assert.equal((await readState(p)).clients.find(c=>c.id===client.id).name,'RENAMED CLIENT');
    assert.equal((await readState(p)).projects.find(r=>r.id===project.id).name,'RENAMED PROJECT');
    await p.locator(`[data-client-del="${client.id}"]`).click();assert.deepEqual((await readState(p)).projects.find(r=>r.id===project.id).clients,[]);
    await p.locator(`[data-proj-del="${project.id}"]`).click();
    for(const[id,text]of Object.entries({setProj:'TEST BOARD',setLocName:'TEST LOCATION',setLat:'-26.2',setLng:'152.7',setOwner:'regression-fixture',setRepo:'test-board',setBranch:'test-only',setToken:'fixture-token-not-a-credential',setPass:'test-password'}))await p.locator('#'+id).fill(text);
    await p.locator('#setCRS').selectOption('4326');await p.locator('#setSave').click();
    state=await readState(p);assert.equal(state.settings.projectName,'TEST BOARD');assert.equal(state.settings.loc.lat,-26.2);assert.equal(state.settings.geojsonCRS,'4326');assert.ok(state.settings.editPass);
    await clickCommand(p,'btnSettings');await p.locator('#clearPass').check();await p.locator('#setSave').click();assert.equal((await readState(p)).settings.editPass,'');
    outcomes.push({state:await readState(p),repo:await p.evaluate(()=>localStorage.getItem('offaly_ops_repo'))});assert.equal(run.network.writes.length,0);
   } finally {await run.close();}
  }
  assert.deepEqual(outcomes[1],outcomes[0]);
 });
 await check('Punch print: numbered checklist, comments and labelled photo appendix match baseline',async()=>{
  const data=fixture();const photo=data.panels.weeklyPhotos.flatMap(i=>i.photos||[])[0];assert.ok(photo);
  data.panels.punchlist=[{id:'print-evidence',main:'TEST evidence reference',prio:'high',vis:{site:true,client:true},photos:[photo]}];
  const snapshots=[];
  for(const version of ['before','after']) {
   const run=await open(env,{version,data:structuredClone(data)});const p=run.page;
   try {
    await p.locator('[data-print-panel="punchlist"]').click();await p.emulateMedia({media:'print'});
    await p.waitForFunction(()=>[...document.querySelectorAll('.photo-appendix img')].every(i=>i.complete&&i.naturalWidth));
    assert.equal(await p.locator('.print-this .print-sheet:visible').count(),1);assert.match(await p.locator('.ap-label').textContent(),/1\. TEST evidence reference/);
    assert.equal(await p.locator('.print-this .vchip:visible').count(),0);
    snapshots.push(await p.locator('.print-this').innerText());
    if(version==='after')await savePDF(p,{path:path.join(output,'print-punch-evidence.pdf'),format:'A4',printBackground:true});
   } finally {await run.close();}
  }
  assert.equal(snapshots[1],snapshots[0]);
 });
 await check('3D viewer audiences: hosted model visible, view controls retained and editor controls absent',async()=>{
  for(const audience of ['?crew=test-site','?view=test-client-1']) {
   const data=fixture();data.models=[{id:'viewer-model',name:'TEST shared GLB',url:env.url+'/after/tests/fixture.glb',fmt:'glb',visible:true}];
   const run=await open(env,{data,audience});const p=run.page;
   try {
    await p.waitForFunction(()=>Object.keys(__opsTest.loadedObjs).length===1,null,{timeout:60000});
    assert.equal(await p.locator('#modelStage').isVisible(),true);assert.equal(await p.locator('#btnModelUpload').isVisible(),false);assert.equal(await p.locator('#btnModelUrl').isVisible(),false);assert.equal(await p.locator('[data-model-del]').count(),0);
    await p.locator('[data-model-toggle]').uncheck();await p.locator('[data-model-toggle]').check();await p.locator('[data-mtool="reset"]').click();
    await p.locator('#btnModelToggle').click();await p.locator('#btnModelToggle').click();assert.equal(await p.locator('#modelStage').isVisible(),true);
    assert.equal(await p.locator('#headerMenu').isVisible(),false);assert.equal(await p.locator('#btnPrint').isVisible(),true);
    await p.setViewportSize({width:390,height:844});assert.equal(await p.locator('#headerMenu').isVisible(),true);await p.locator('#headerMenu summary').click();
    assert.equal(await p.locator('#btnPrint').isVisible(),true);assert.equal(await p.locator('#btnSettings').isVisible(),false);assert.equal(await p.locator('#btnImport').isVisible(),false);
    assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
   } finally {await run.close();}
  }
 });
}
