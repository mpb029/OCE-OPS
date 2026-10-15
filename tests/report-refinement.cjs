// Stage F1 only: original full-board/photo handlers, isolated synthetic records.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const {execFileSync}=require('node:child_process');
const {root,output,start,open}=require('./harness.cjs');
const synthetic=require('./workspace-fixture.cjs');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:3e6}).trim();
const commit=git(['rev-parse','HEAD']),engine=process.env.OCE_ENGINE||'chromium',pdfs=process.argv.includes('--pdf');
const results=[],directory=path.join(output,'report-refinement');fs.mkdirSync(directory,{recursive:true});
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
function fixture(){
 const d=synthetic();d.settings.projectName='SYNTHETIC REPORT REVIEW · North watermain';
 const detail='Recorded site observations: bedding checked against the approved detail; crew coordinated the crossing with adjacent works. Access retained for residents. Survey and quality records remain attached to the original operational record.';
 for(const [id,items]of Object.entries(d.panels))for(const item of items)if(item.sub)item.sub+=' · '+detail;
 for(let n=1;n<=9;n++)d.panels.dailyWorks.push({...structuredClone(d.panels.dailyWorks[0]),id:'report-daily-'+n,main:`Watermain workfront ${n} · Chainage ${300+n*20}–${320+n*20}`,sub:detail+' Inspection reference DW-'+String(n).padStart(2,'0')+'.'});
 d.panels.dailyWorks.push({...structuredClone(d.panels.dailyWorks[0]),id:'report-private',main:'EDITOR ONLY · internal coordination record',vis:{site:false,client:false}});
 const images=[png(960,600,1),png(600,900,2),png(960,600,3),png(600,900,4),png(960,600,5)];
 d.panels.weeklyPhotos=[
  {id:'photo-north-01',project:'default',main:'Northern trench · Bedding and pipe installation',sub:'SYNTHETIC IMAGES · Representative landscape and portrait evidence',x:{folderDate:'2026-10-13'},vis:{site:true,client:true},photos:[{name:'Bedding inspection · Landscape.png',url:images[0],mime:'image/png'},{name:'Pipe installation · Portrait.png',url:images[1],mime:'image/png'}]},
  {id:'photo-north-02',project:'default',main:'Crossing 3 · Reinstatement progress',sub:'SYNTHETIC IMAGES · Original photograph order retained',x:{folderDate:'2026-10-12'},vis:{site:true,client:true},photos:[{name:'Crossing works · Landscape.png',url:images[2],mime:'image/png'},{name:'Reinstatement · Portrait.png',url:images[3],mime:'image/png'}]},
  {id:'photo-private',project:'default',main:'EDITOR ONLY · internal photographic record',x:{folderDate:'2026-10-11'},vis:{site:false,client:false},photos:[{name:'Internal review.png',url:images[4],mime:'image/png'}]},
  {id:'photo-east',project:'east',main:'EAST ONLY · drainage evidence',x:{folderDate:'2026-10-10'},vis:{site:true,client:true},photos:[{name:'East review.png',url:images[4],mime:'image/png'}]}
 ];
 return d;
}
const state=p=>p.evaluate(()=>({state:structuredClone(__opsTest.state),storage:{...localStorage},sync:{...__opsTest.sync}}));
async function beginPrint(p,mode){
 const calls=await p.evaluate(()=>window.__printCalls||0);
 if(mode==='report')await p.locator('#btnPrint').evaluate(e=>e.click());
 else{
  await p.locator('[data-photo-report="weeklyPhotos"]').evaluate(e=>e.click());
  for(const input of await p.locator('#photoFolderList input').all())await input.setChecked(['photo-north-01','photo-north-02'].includes(await input.getAttribute('value')));
  await p.locator('#photoPrintGo').click();
 }
 await p.waitForFunction(n=>(window.__printCalls||0)>n,calls,{timeout:15000});
 await p.emulateMedia({media:'print'});
 await p.evaluate(async()=>{document.body.getBoundingClientRect();await document.fonts.ready;});
}
const snapshot=p=>p.evaluate(()=>{
 const visible=e=>!!e?.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
 const norm=s=>s.replace(/\s+/g,' ').trim();
 return {title:norm(document.getElementById('phTitle').textContent),meta:norm(document.getElementById('phMeta').textContent),
  panels:[...document.querySelectorAll('#panelsGrid>[data-card]')].filter(visible).map(e=>({id:e.dataset.card,text:norm(e.innerText)})),
  sections:['summaryCard','prodStatsCard'].map(id=>{const e=document.getElementById(id);return{id,visible:visible(e),text:visible(e)?norm(e.innerText):''};}),
  photos:[...document.querySelectorAll('#panelsGrid .photo img,#panelsGrid .ap-photo img')].filter(visible).map(e=>({src:e.getAttribute('src'),alt:e.getAttribute('alt'),width:e.naturalWidth,height:e.naturalHeight})),
  folders:[...document.querySelectorAll('.photo-folder')].filter(visible).map(e=>e.dataset.folder),
  map:visible(document.querySelector('.map-card')),weather:visible(document.getElementById('weatherCard')),model:visible(document.getElementById('modelCard'))};
});
(async()=>{
 await check('F1 exact source boundary: only the print stylesheet link added to Stage E runtime',()=>{
  const before=git(['show','76cb688:index.html']).replace(/\r\n/g,'\n');
  const after=require('./overview-record-source.cjs').normalise('index.html',fs.readFileSync(path.join(root,'index.html'),'utf8'));
  const links=[...after.matchAll(/^[ \t]*<link[^\n]*href="ui-report-print\.css"[^\n]*>\n/gm)];
  assert.equal(links.length,1);assert.match(links[0][0],/media="print"/);
  assert.equal(after.replace(links[0][0],'').trim(),before.trim());
 });
 const env=await start();
 try{
  const contexts=[{name:'editor-north',project:'default',audience:''},{name:'editor-all',project:'all',audience:''},{name:'site-north',project:'default',audience:'&crew=test-site'},{name:'client-north',project:'default',audience:'&view=test-client-0'}];
  for(const spec of contexts){
   const captures={};
   for(const version of ['before','after']){
    const run=await open(env,{data:fixture(),audience:'?ui=workspaces&workspace=operations'+spec.audience});const p=run.page;
    try{
     if(version==='before')await p.locator('link[href="ui-report-print.css"]').evaluate(e=>e.remove());
     // A client with a single assigned project has no visible project picker.
     // Exercise its ordinary audience-scoped All Projects view instead.
     if(await p.locator('#projSelect').isVisible())await p.locator('#projSelect').selectOption(spec.project);
     else assert.equal(spec.name,'client-north');
     const original=await state(p);captures[version]={};
     for(const mode of ['report','photos'])await check(`F1 ${spec.name}/${version}/${mode}: original handler, scoped content and no writes`,async()=>{
      await beginPrint(p,mode);const actual=await snapshot(p);captures[version][mode]=actual;
      assert.equal(actual.model,false);assert.ok(actual.photos.length>=4);assert.ok(actual.photos.every(i=>i.width>1&&i.height>1),'Photographs really loaded');
      assert.equal(await p.locator('.ws-chrome:visible').count(),0);
      if(mode==='photos'){assert.deepEqual(actual.panels.map(p=>p.id),['weeklyPhotos']);assert.deepEqual(actual.folders,['photo-north-01','photo-north-02']);}
      if(mode==='report'&&spec.name.startsWith('editor'))assert.equal(actual.panels.length,21);
      const text=actual.panels.map(p=>p.text).join(' ');
      if(!spec.name.startsWith('editor'))assert.ok(!text.includes('EDITOR ONLY'));
      if(spec.project==='default')assert.ok(!text.includes('EAST ONLY'));
      if(spec.name.startsWith('client')){assert.equal(actual.map,false);assert.equal(actual.weather,false);}
      if(pdfs&&engine==='chromium'&&spec.name==='editor-north')await p.pdf({path:path.join(directory,`${version}-${mode}.pdf`),format:'A4',printBackground:true});
      await p.emulateMedia({media:'screen'});await p.evaluate(()=>dispatchEvent(new Event('afterprint')));
      assert.equal(await p.locator('body').getAttribute('data-print'),null);assert.equal(await p.locator('.pf-hide,.print-this').count(),0);
      assert.deepEqual(await state(p),original);assert.equal(run.network.writes.length,0);assert.deepEqual(run.network.errors,[]);
      return {panels:actual.panels.map(p=>p.id),photographs:actual.photos.length};
     });
    }finally{await run.close();}
   }
   for(const mode of ['report','photos'])await check(`F1 ${spec.name}/${mode}: all original text, photos and ordering retained`,()=>{
    assert.ok(captures.before[mode]&&captures.after[mode]);assert.deepEqual(captures.after[mode],captures.before[mode]);
   });
  }
 }finally{await env.close();const endCommit=git(['rev-parse','HEAD']);fs.writeFileSync(path.join(output,'report-refinement-results.json'),JSON.stringify({commit,endCommit,engine,tests:results,pdfs:pdfs&&engine==='chromium',firefoxLimitation:'Print-media DOM verified; Playwright does not export Firefox PDFs.'},null,2));}
 if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
