// Actual original print handlers, five report families, three distinct workspace routes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {start,open,output,root}=require('./harness.cjs');
const directory=path.join(output,'workspace-pdfs');fs.mkdirSync(directory,{recursive:true});
const command=async(p,id)=>{if(!await p.locator('#'+id).isVisible())await p.locator('#headerMenu summary').click();await p.locator('#'+id).click();};
const evidence=[];
(async()=>{
 const env=await start();
 try{
  for(const mode of ['report','dailyWorks','punchlist','photos','client']){
   const audience=mode==='client'?'?view=test-client-1':'';
   for(const route of ['baseline','operations','site','all','overview']){
    console.log(`START PDF ${route}/${mode}`);
    const run=await open({...env,workspaces:route!=='baseline'},{version:route==='baseline'?'before':'after',audience:audience+(audience?'&':'?')+(route==='baseline'?'':'workspace='+route)});const p=run.page;
    try{
     const layer=await p.evaluate(()=>__opsTest.state.mapLayers.find(l=>l.type!=='tiles')?.id);
     if(layer){
      await p.locator(`[data-lc-zoom="${layer}"]`).evaluate(e=>e.click());await p.waitForTimeout(300);
      // Stabilise the selected map extent, without an unbounded animated zoom loop.
      await p.evaluate(()=>{const m=__opsTest.map;m.stop();m.setView(m.getCenter(),Math.min(m.getZoom(),18),{animate:false});});
     }
     const count=await p.evaluate(()=>window.__printCalls||0);
     if(mode==='report'||mode==='client')await command(p,'btnPrint');
     else if(mode==='photos'){
      // Exercise the existing report handler even when its card is screen-filtered.
      await p.locator('[data-photo-report="weeklyPhotos"]').evaluate(e=>e.click());
      const picks=p.locator('#photoFolderList input');for(let i=1;i<await picks.count();i++)await picks.nth(i).uncheck();await p.locator('#photoPrintGo').click();
     }else await p.locator(`[data-print-panel="${mode}"]`).evaluate(e=>e.click());
     await p.waitForFunction(n=>(window.__printCalls||0)>n,count,{timeout:15000});
     await p.emulateMedia({media:'print'});
     // Screen-only Phase 1 typography can leave the original print fonts unused.
     // Flush print layout and await those font faces before Chromium snapshots it.
     const printLayout=await p.evaluate(async()=>{
      document.body.getBoundingClientRect();await document.fonts.ready;
      return {fonts:document.fonts.status,headerFont:getComputedStyle(document.getElementById('phTitle')).fontFamily,
       cards:[...document.querySelectorAll('#overview > *,#panelsGrid > [data-card]')].map(e=>({id:e.id||e.dataset.card,height:e.getBoundingClientRect().height}))};
     });
     assert.equal(await p.locator('.ws-chrome:visible').count(),0);
     const panels=await p.locator('[data-card]:visible').evaluateAll(es=>es.map(e=>e.dataset.card));
     if(mode==='report')assert.equal(panels.length,21);else if(mode!=='client')assert.equal(panels.length,1);
     if(mode==='client'){assert.equal(await p.locator('.map-card').isVisible(),false);assert.equal(await p.locator('#weatherCard').isVisible(),false);}
     await p.pdf({path:path.join(directory,`${route}-${mode}.pdf`),format:'A4',printBackground:true});
     await p.emulateMedia({media:'screen'});await p.evaluate(()=>dispatchEvent(new Event('afterprint')));
     assert.deepEqual(run.network.errors,[]);assert.equal(run.network.writes.length,0);
     evidence.push({mode,route,panels,printLayout,status:'PASS'});console.log(`PASS PDF ${route}/${mode}`);
    }finally{await run.close();}
   }
  }
 }finally{await env.close();fs.writeFileSync(path.join(directory,'capture-results.json'),JSON.stringify({commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),reports:evidence},null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
