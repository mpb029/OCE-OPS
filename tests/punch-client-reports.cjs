// Stage F2: existing Punch List and Client handlers, isolated synthetic data only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const {execFileSync}=require('node:child_process');
const {root,output,start,open}=require('./harness.cjs');
const synthetic=require('./workspace-fixture.cjs');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:3e6});
const base='08a70b4', commit=git(['rev-parse','HEAD']).trim(),engine=process.env.OCE_ENGINE||'chromium';
const baselineOnly=process.argv.includes('--baseline-only'),pdfs=baselineOnly||process.argv.includes('--pdf');
const results=[],directory=path.join(output,'punch-client-reports');fs.mkdirSync(directory,{recursive:true});
const baselineCSS=git(['show',base+':ui-report-print.css']);
async function check(name,fn){try{const detail=await fn();results.push({name,status:'PASS',detail});console.log('PASS '+name);}catch(e){results.push({name,status:'FAIL',error:e.stack});console.error('FAIL '+name+': '+e.message.slice(0,500));}}
function crc(buffer){let c=0xffffffff;for(const b of buffer){c^=b;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function png(width,height,variant){
 const chunk=(type,data)=>{const t=Buffer.from(type),b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);t.copy(b,4);data.copy(b,8);b.writeUInt32BE(crc(Buffer.concat([t,data])),data.length+8);return b;};
 const h=Buffer.alloc(13);h.writeUInt32BE(width);h.writeUInt32BE(height,4);h[8]=8;h[9]=2;
 const raw=Buffer.alloc(height*(width*3+1));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const at=y*(width*3+1)+1+x*3,sky=y<height*.39,road=Math.abs(x-width*.5)<width*(.12+.28*y/height),pipe=y>height*.58&&y<height*.71;
  const colour=sky?[160+variant*6,195,220]:pipe?[55+variant*9,87,108]:road?[185,161+variant*4,123]:[101+variant*7,125,84];
  for(let c=0;c<3;c++)raw[at+c]=Math.max(0,Math.min(255,colour[c]+((x+y+variant*11)%17)-8));
 }
 return 'data:image/png;base64,'+Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',h),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]).toString('base64');
}

function fixture(empty=false){
 const d=synthetic();d.settings.projectName='SYNTHETIC REPORT REVIEW - North watermain';
 const images=[png(960,600,1),png(600,900,2),png(960,600,3),png(600,900,4),png(960,600,5),png(600,900,6)];
 const photo=n=>({name:'Synthetic inspection '+(n+1)+(n%2?' - Portrait.png':' - Landscape.png'),url:images[n],mime:'image/png'});
 const notes='Inspection notes: confirm verge levels, reinstate topsoil and verify access remains clear. Record the check with the site supervisor before closing the action. '+
  'The adjacent service marker must remain visible. Close-out evidence should identify chainage and workfront so the completed record can be traced to its original observation.';
 d.panels.punchlist=Array.from({length:10},(_,n)=>({id:'punch-'+n,project:'default',main:['Reinstate verge at northern crossing','Inspect valve chamber surround','Repair pavement edge','Complete property access','Remove redundant marker','Check service clearance','Finalise trench reinstatement','Confirm survey mark protection','Review drainage inlet','Complete workfront handover'][n],
  sub:notes+(n===2?' '+notes:''),team:n%2?'pipe':'eng',dateAssigned:'2026-10-12',dateRequired:'2026-10-16',due:'2026-10-16',wstatus:n%3===0?'complete':'inprogress',priority:n%2?'med':'high',status:n%3===0?'closed':'open',
  vis:{site:true,client:true},photos:n===0?[0,1,2,3].map(photo):n===1?[4,5].map(photo):[]}));
 d.panels.punchlist.push({...structuredClone(d.panels.punchlist[0]),id:'private-punch',main:'EDITOR ONLY - commercial closeout review',photos:[],vis:{site:false,client:false}});
 d.panels.punchlist.push({...structuredClone(d.panels.punchlist[0]),id:'east-punch',project:'east',main:'EAST ONLY - drainage closeout',photos:[]});
 d.panels.weeklyPhotos=[{id:'week-north',project:'default',main:'North crossing - Inspection evidence and workfront completion',x:{folderDate:'2026-10-13'},vis:{site:true,client:true},photos:[photo(0),photo(1)]},
 {id:'week-private',project:'default',main:'EDITOR ONLY - restricted photo folder',vis:{site:false,client:false},photos:[photo(2)]},
 {id:'week-east',project:'east',main:'EAST ONLY - drainage photographs',vis:{site:true,client:true},photos:[photo(3)]}];
 d.panelVis.punchlist={site:true,client:true};d.panelVis.incidents={site:false,client:false};d.panels.incidents[0].main='RESTRICTED PANEL - incident record';
 if(empty){for(const key of Object.keys(d.panels))d.panels[key]=[];d.stats=[];d.projectSummary={};}
 return d;
}
const state=p=>p.evaluate(()=>({state:structuredClone(__opsTest.state),storage:{...localStorage},sync:{...__opsTest.sync}}));
async function beginPrint(p,mode){
 const calls=await p.evaluate(()=>window.__printCalls||0);
 await p.locator(mode==='punchlist'?'[data-print-panel="punchlist"]':'#btnPrint').evaluate(e=>e.click());
 await p.waitForFunction(n=>(window.__printCalls||0)>n,calls,{timeout:15000});
 await p.emulateMedia({media:'print'});await p.evaluate(()=>document.fonts.ready);
}
const snapshot=p=>p.evaluate(()=>{
 const visible=e=>!!e?.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';const norm=s=>s.replace(/\s+/g,' ').trim();
 const card=document.querySelector('[data-card="punchlist"]');
 return {title:norm(document.getElementById('phTitle').textContent),meta:norm(document.getElementById('phMeta').textContent),
 panels:[...document.querySelectorAll('#panelsGrid>[data-card]')].filter(visible).map(e=>({id:e.dataset.card,text:norm(e.innerText)})),
 sections:['summaryCard','prodStatsCard'].map(id=>{const e=document.getElementById(id);return{id,visible:visible(e),text:visible(e)?norm(e.innerText):''};}),
 photos:[...document.querySelectorAll('#panelsGrid .photo img,#panelsGrid .ap-photo img')].filter(visible).map(e=>({src:e.getAttribute('src'),alt:e.getAttribute('alt'),width:e.naturalWidth,height:e.naturalHeight})),
 numbers:[...(card?.querySelectorAll('.pl-num')||[])].filter(visible).map(e=>e.textContent),
 checklist:[...(card?.querySelectorAll('.print-sheet')||[])].filter(visible).map(e=>({text:e.innerText,tick:visible(e.querySelector('.tickbox'))})),
 appendix:[...(card?.querySelectorAll('.ap-label')||[])].filter(visible).map(e=>norm(e.textContent)),
 map:visible(document.querySelector('.map-card')),weather:visible(document.getElementById('weatherCard')),model:visible(document.getElementById('modelCard'))};
});
(async()=>{
 await check('F2 source boundary: original runtime and F1 print styles preserved',()=>{
  assert.equal(fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/\r\n/g,'\n'),git(['show',base+':index.html']).replace(/\r\n/g,'\n'));
  assert.ok(fs.readFileSync(path.join(root,'ui-report-print.css'),'utf8').replace(/\r\n/g,'\n').startsWith(baselineCSS.replace(/\r\n/g,'\n').trimEnd()));
 });
 const env=await start();
 try{
 const specs=[
  {name:'punch-editor',mode:'punchlist',project:'default',audience:'',representative:true},
  {name:'client-north',mode:'client',project:'all',audience:'&view=test-client-0',representative:true},
  {name:'punch-editor-all',mode:'punchlist',project:'all',audience:''},
  {name:'punch-site',mode:'punchlist',project:'default',audience:'&crew=test-site'},
  {name:'punch-client',mode:'punchlist',project:'all',audience:'&view=test-client-0'},
  {name:'client-east',mode:'client',project:'all',audience:'&view=test-client-1'},
  {name:'punch-empty',mode:'punchlist',project:'default',audience:'',empty:true},
  {name:'client-empty',mode:'client',project:'all',audience:'&view=test-client-0',empty:true}
 ];
 for(const spec of specs.filter(s=>!baselineOnly||s.representative)){
  const captures={};
  for(const version of baselineOnly?['before']:['before','after']){
   const run=await open(env,{data:fixture(spec.empty),audience:'?ui=workspaces&workspace=quality'+spec.audience}),p=run.page;
   try{
    if(version==='before'){
     await p.route('**/ui-report-print.css',r=>r.fulfill({body:baselineCSS,contentType:'text/css'}));
     await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__opsTest?.ready&&document.querySelector('#panelsGrid .card'));
    }
    if(await p.locator('#projSelect').isVisible())await p.locator('#projSelect').selectOption(spec.project);
    const original=await state(p);
    await check(`F2 ${spec.name}/${version}: original handler, scoped content, checklist and no writes`,async()=>{
     await beginPrint(p,spec.mode);const actual=await snapshot(p);captures[version]=actual;
     const text=actual.panels.map(i=>i.text).join(' ');
     assert.equal(actual.model,false);assert.equal(await p.locator('.ws-chrome:visible').count(),0);
     if(spec.mode==='punchlist')assert.deepEqual(actual.panels.map(i=>i.id),['punchlist']);
     if(spec.audience){assert.ok(!text.includes('EDITOR ONLY'));assert.ok(!text.includes('RESTRICTED PANEL'));}
     if(spec.name==='client-east')assert.ok(!text.includes('Reinstate verge at northern crossing'));
     else if(spec.project==='default'||spec.audience.includes('test-client-0'))assert.ok(!text.includes('EAST ONLY'));
     if(spec.mode==='client'){assert.match(actual.title,/Client Report/);assert.equal(actual.map,false);assert.equal(actual.weather,false);}
     if(spec.empty){assert.equal(actual.photos.length,0);assert.equal(actual.numbers.length,0);assert.ok(text.includes('Nothing listed.'));}
     else{
      assert.deepEqual(actual.numbers,actual.numbers.map((_,n)=>(n+1)+'.'));
      assert.equal(actual.checklist.length,actual.numbers.length);assert.ok(actual.checklist.every(c=>c.tick&&c.text==='Comments:'));
      assert.ok(actual.photos.every(i=>i.width>1&&i.height>1),'All actual photo objects loaded');
      if(spec.name!=='client-east'){assert.ok(actual.photos.length>=6);assert.ok(actual.appendix.length>=2);assert.ok(text.includes('Inspection notes:'));}
     }
     if(pdfs&&engine==='chromium'&&spec.representative)await p.pdf({path:path.join(directory,`${version}-${spec.mode}.pdf`),format:'A4',printBackground:true});
     await p.emulateMedia({media:'screen'});await p.evaluate(()=>dispatchEvent(new Event('afterprint')));
     assert.equal(await p.locator('body').getAttribute('data-print'),null);assert.equal(await p.locator('.pf-hide,.print-this').count(),0);
     assert.deepEqual(await state(p),original);assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
     return{panels:actual.panels.map(i=>i.id),items:actual.numbers.length,photos:actual.photos.length,appendix:actual.appendix};
    });
   }finally{await run.close();}
  }
  if(!baselineOnly)await check(`F2 ${spec.name}: text, ordering, photos, numbering and comments retained`,()=>{assert.ok(captures.before&&captures.after);assert.deepEqual(captures.after,captures.before);});
 }
 }finally{await env.close();fs.writeFileSync(path.join(output,'punch-client-results.json'),JSON.stringify({commit,endCommit:git(['rev-parse','HEAD']).trim(),engine,tests:results,baselineOnly,pdfs:pdfs&&engine==='chromium',firefoxLimitation:'Print-media DOM tested; Playwright cannot export native Firefox PDFs.'},null,2));}
 if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
