// Isolated IFC integration checks. No production board, file writes or publishing.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {root, output, start, open} = require('./harness.cjs');
const board = require('./workspace-fixture.cjs');
const {stl} = require('./fixtures.cjs');
const fixtures = path.join(__dirname, 'fixtures-ifc');
const small = path.join(fixtures, 'transformed-millimetres-ifc4.ifc');
const revit = path.join(fixtures, 'revit-2021-ifc2x3.ifc');
const fast = process.argv.includes('--fast');
const capture = process.argv.includes('--screenshot');
const results = [];
const closeTo = (actual, expected, label, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) < tolerance, `${label}: ${actual} versus ${expected}`);
const vectorClose = (actual, expected, label, tolerance) => actual.forEach((value, i) => closeTo(value, expected[i], `${label}[${i}]`, tolerance));
const tracked = () => [...new Set(execFileSync('git', ['ls-files', '-c', '-o', '--exclude-standard'], {cwd:root, encoding:'utf8'}).trim().split(/\r?\n/))].filter(file => /^(?:index\.html|.*ifc.*\.(?:js|cjs|wasm|ifc)|tests\/fixtures-ifc\/.*|tests\/overview-record-source\.cjs)$/.test(file));
const hashes = () => Object.fromEntries(tracked().map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
const initialHashes = hashes();
const initialCommit = execFileSync('git', ['rev-parse','HEAD'], {cwd:root,encoding:'utf8'}).trim();
const state = page => page.evaluate(() => {
  const payload = __opsTest.shareableState(); delete payload.publishedAt;
  const storage = {...localStorage}; delete storage.offaly_ops_proj;
  return {state:structuredClone(__opsTest.state), payload, storage, dirty:__opsTest.sync.dirty};
});
async function focus(page) {
  const button = page.locator('.ws-shortcuts [data-ws-target="#modelCard"]');
  if (await button.isVisible()) await button.click();
  await page.locator('#modelStage').scrollIntoViewIfNeeded();
}
async function settled(page) {
  await page.evaluate(() => new Promise(resolve => {
    let previous = [], stable = 0;
    function frame() {
      const t = __opsTest.three, values = [...t.camera.position.toArray(), ...t.controls.target.toArray()];
      stable = values.every((v,i) => Math.abs(v-previous[i]) < 1e-8) ? stable+1 : 0; previous = values;
      if (stable >= 8) resolve(); else requestAnimationFrame(frame);
    }
    frame();
  }));
}
async function loaded(page, id) {
  await page.waitForFunction(id => {
    const t = window.__opsTest;
    return !!t?.three && t.loadedObjs[id]?.parent === t.three.scene && t.three.renderer.info.render.triangles > 0;
  }, id, {timeout:90000});
  await settled(page);
}
async function upload(page, file) {
  const before = await page.evaluate(() => Object.keys(__opsTest.sessionModels));
  await page.locator('#fileModel').setInputFiles(file);
  await page.waitForFunction(ids => Object.keys(__opsTest.sessionModels).some(id => !ids.includes(id)), before);
  const id = await page.evaluate(ids => Object.keys(__opsTest.sessionModels).find(id => !ids.includes(id)), before);
  await loaded(page,id); return id;
}
async function geometry(page,id) {
  return page.evaluate(id => {
    const object = __opsTest.loadedObjs[id]; object.updateMatrixWorld(true);
    const meshes = [];
    object.traverse(c => { if (c.isMesh) {
      const b = new THREE.Box3().setFromObject(c), position = c.geometry.getAttribute('position');
      meshes.push({min:b.min.toArray(),max:b.max.toArray(),size:b.getSize(new THREE.Vector3()).toArray(),center:b.getCenter(new THREE.Vector3()).toArray(),vertices:position.count,triangles:(c.geometry.index?.count || position.count)/3,finite:Array.from(position.array).every(Number.isFinite)});
    }});
    const b = new THREE.Box3().setFromObject(object);
    return {meshes,min:b.min.toArray(),max:b.max.toArray(),size:b.getSize(new THREE.Vector3()).toArray(),rotation:object.rotation.toArray().slice(0,3),ifc:object.userData.ifc,rendered:__opsTest.three.renderer.info.render.triangles};
  },id);
}
async function nav(page,route) {
  if (await page.locator('#wsMobileMenu').isVisible() && !await page.locator('#wsSidebar').isVisible()) await page.locator('#wsMobileMenu').click();
  await page.locator(`#wsDestinations [data-ws-route="${route}"]`).click();
  await page.waitForFunction(route => document.body.dataset.workspace === route,route);
}
async function use(env,options,callback) {
  const run = await open(env,{data:board(),liveClock:true,audience:'?ui=workspaces&workspace=site',...options});
  try { if(await run.page.locator('#modelCard').isVisible())await focus(run.page); await callback(run.page,run); assert.equal(run.network.writes.length,0,'No external mutations'); assert.deepEqual(run.network.errors,[],'No uncaught runtime errors'); }
  finally { await run.close(); }
}
async function check(name,callback) {
  const started=Date.now();
  try { await callback(); results.push({name,passed:true,ms:Date.now()-started}); console.log('PASS '+name); }
  catch(error) { results.push({name,passed:false,ms:Date.now()-started,error:error.stack}); console.error('FAIL '+name+'\n'+error.stack); }
}
(async () => {
  const env=await start();
  try {
    await check('IFC4 millimetres, nested placement, rotation, relative position and visible triangles',() => use(env,{},async (page,run) => {
      const before=await state(page), id=await upload(page,small), result=await geometry(page,id);
      assert.equal(result.meshes.length,2); assert.ok(result.meshes.every(m=>m.finite&&m.triangles===12));
      vectorClose(result.min,[8,3,-24],'Combined minimum'); vectorClose(result.max,[13,6.5,-16.5],'Combined maximum');
      const [tall,short]=result.meshes.sort((a,b)=>b.size[1]-a.size[1]);
      vectorClose(tall.size,[2,3,4],'Rotated tall solid'); vectorClose(short.size,[2,1,1],'Rotated short solid');
      vectorClose(short.center.map((v,i)=>v-tall.center[i]),[3,-1.5,5],'Relative placement');
      assert.match(result.ifc?.schema||'',/IFC4/); assert.ok(result.rendered>=24); vectorClose(result.rotation,[0,0,0],'No double axis rotation');
      assert.deepEqual(await state(page),before,'Session IFC does not change stored board or publishing payload');
      assert.ok(!JSON.stringify((await state(page)).payload).includes(id));
      assert.match(await page.locator('#fileModel').getAttribute('accept'),/\.ifc/);
      for(const extension of ['.obj','.stl','.glb','.gltf'])assert.ok((await page.locator('#fileModel').getAttribute('accept')).includes(extension));
    }));
    await check('IFC invalid and unsupported files produce clear errors without cached or scene geometry',() => use(env,{},async page => {
      for(const [name,buffer,expected] of [
        ['invalid.ifc',Buffer.from('This is not an IFC model.'),/IFC|invalid|parse|format/i],
        ['unsupported.ifc',Buffer.from(fs.readFileSync(small,'utf8').replace("FILE_SCHEMA(('IFC4'))","FILE_SCHEMA(('IFC99'))")),/IFC99|unsupported|schema/i]
      ]) {
        const ids=await page.evaluate(()=>Object.keys(__opsTest.sessionModels));
        await page.locator('#fileModel').setInputFiles({name,mimeType:'application/octet-stream',buffer});
        await page.waitForFunction(ids=>Object.keys(__opsTest.sessionModels).some(id=>!ids.includes(id)),ids);
        const id=await page.evaluate(ids=>Object.keys(__opsTest.sessionModels).find(id=>!ids.includes(id)),ids);
        await page.waitForFunction(()=>/could not|failed|invalid|unsupported|error/i.test(document.querySelector('#modelEmpty').textContent),null,{timeout:90000});
        assert.match(await page.locator('#modelEmpty,#modelList').allTextContents().then(t=>t.join(' ')),expected);
        assert.equal(await page.evaluate(id=>!!__opsTest.loadedObjs[id],id),false);
        await page.locator(`[data-model-del="${id}"]`).click();
        assert.equal(await page.evaluate(id=>!!__opsTest.sessionModels[id],id),false);
      }
      assert.equal(await page.locator('#modelToolbar').isVisible(),false);
      // A parser can fail after producing some meshes. Exercise that failure
      // deterministically with native Three resources, without replacing any
      // runtime parser in the real-file integration cases.
      const cleanup=await page.evaluate(async()=>{
        const {loadIFCModel}=await import(new URL('./ifc-loader.js',location.href));
        const OriginalWorker=window.Worker,disposeGeometry=THREE.BufferGeometry.prototype.dispose,disposeMaterial=THREE.Material.prototype.dispose;
        const counts={geometries:0,materials:0,terminated:0,message:''};
        THREE.BufferGeometry.prototype.dispose=function(){counts.geometries++;return disposeGeometry.call(this);};
        THREE.Material.prototype.dispose=function(){counts.materials++;return disposeMaterial.call(this);};
        window.Worker=class {
          terminate(){counts.terminated++;}
          postMessage(){queueMicrotask(()=>{
            this.onmessage({data:{type:'mesh',id:1,matrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],color:{x:.6,y:.7,z:.8,w:1},vertices:new Float32Array([0,0,0,0,0,1,1,0,0,0,0,1,0,1,0,0,0,1]),indices:new Uint32Array([0,1,2])}});
            this.onmessage({data:{type:'error',message:'Synthetic stream failure after a valid mesh'}});
          });}
        };
        try{await loadIFCModel('synthetic-failure.ifc',THREE);}catch(error){counts.message=error.message;}
        finally{window.Worker=OriginalWorker;THREE.BufferGeometry.prototype.dispose=disposeGeometry;THREE.Material.prototype.dispose=disposeMaterial;}
        return counts;
      });
      assert.deepEqual(cleanup,{geometries:1,materials:1,terminated:1,message:'Synthetic stream failure after a valid mesh'});
    }));
    if(!fast) {
      await check('Actual Revit 2021 IFC2X3 export loads finite geometry with visible camera framing',() => use(env,{},async page => {
        const id=await upload(page,revit), result=await geometry(page,id);
        assert.match(result.ifc?.schema||'',/IFC2X3/i); assert.ok(result.meshes.length>5); assert.ok(result.meshes.every(m=>m.finite&&m.vertices>0));
        assert.ok(result.rendered>50); assert.ok(result.size.every(v=>v>1&&v<1000),'Representative building dimensions in metres: '+result.size);
        const framing=await page.evaluate(id=>{
          const t=__opsTest.three,b=new THREE.Box3().setFromObject(__opsTest.loadedObjs[id]);t.camera.updateMatrixWorld();
          const corners=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])corners.push(new THREE.Vector3(x,y,z).project(t.camera).toArray());
          return corners;
        },id);
        assert.ok(framing.every(([x,y,z])=>Math.abs(x)<1&&Math.abs(y)<1&&Math.abs(z)<1),'Entire actual building bounds are in view');
        if(capture&&env.engine==='chromium')await page.locator('#modelCard').screenshot({path:path.join(output,'ifc-revit-viewer.png')});
      }));
      await check('Existing orbit, pan, zoom, fit and fullscreen control the IFC model',() => use(env,{width:1024,height:768,touch:true},async page => {
        const id=await upload(page,small); await focus(page);
        const camera=()=>page.evaluate(()=>__opsTest.three.camera.position.toArray());
        const drag=async()=>{const b=await page.locator('.model-canvas').boundingBox();await page.mouse.move(b.x+b.width*.5,b.y+b.height*.45);await page.mouse.down();await page.mouse.move(b.x+b.width*.5+55,b.y+b.height*.45+24,{steps:6});await page.mouse.up();await settled(page);};
        await page.locator('[data-mtool="orbit"]').click(); const initial=await camera(); await drag(); assert.notDeepEqual(await camera(),initial);
        await page.locator('[data-mtool="pan"]').click();const target=await page.evaluate(()=>__opsTest.three.controls.target.toArray());await drag();assert.notDeepEqual(await page.evaluate(()=>__opsTest.three.controls.target.toArray()),target);
        const distance=()=>page.evaluate(()=>__opsTest.three.camera.position.distanceTo(__opsTest.three.controls.target));
        const d0=await distance();await page.locator('[data-mtool="zoomin"]').click();assert.ok(await distance()<d0);await page.locator('[data-mtool="zoomout"]').click();assert.ok(await distance()>d0*.9);
        await page.locator('[data-mtool="reset"]').click();await settled(page);vectorClose(await page.evaluate(()=>__opsTest.three.controls.target.toArray()),[10.5,4.75,-20.25],'Fit centre');
        await page.locator('[data-mtool="full"]').click();await page.waitForFunction(()=>document.fullscreenElement?.id==='modelCard');assert.ok((await page.locator('#modelStage').boundingBox()).height>384);
        await page.locator('[data-mtool="full"]').click();await page.waitForFunction(()=>!document.fullscreenElement);assert.ok((await geometry(page,id)).rendered>0);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),1024);
      }));
      await check('IFC hide/show, project and workspace changes preserve viewer, meshes and inspection state',() => use(env,{width:768,height:1024,touch:true},async page => {
        const before=await state(page),id=await upload(page,small);
        await page.evaluate(id=>{
          const t=__opsTest; t.three.camera.position.add(new THREE.Vector3(2,3,4));t.three.controls.target.add(new THREE.Vector3(1,2,3));t.three.controls.update();
          window.__ifcState={viewer:t.three,object:t.loadedObjs[id],url:t.sessionModels[id].url};
        },id);await settled(page);
        await page.evaluate(()=>{__ifcState.camera=__opsTest.three.camera.position.toArray();__ifcState.target=__opsTest.three.controls.target.toArray();});
        for(const route of ['overview','operations','site','all','site'])await nav(page,route);
        await focus(page);
        assert.ok(await page.evaluate(id=>__opsTest.three===__ifcState.viewer&&__opsTest.loadedObjs[id]===__ifcState.object&&__opsTest.sessionModels[id].url===__ifcState.url,id));
        assert.ok(await page.evaluate(()=>__opsTest.three.camera.position.toArray().every((v,i)=>Math.abs(v-__ifcState.camera[i])<1e-7)&&__opsTest.three.controls.target.toArray().every((v,i)=>Math.abs(v-__ifcState.target[i])<1e-7)));
        await page.locator(`[data-model-project="${id}"]`).selectOption('default');
        await page.locator('#projSelect').selectOption('east');await page.waitForFunction(id=>!__opsTest.loadedObjs[id].parent,id);
        await page.locator('#projSelect').selectOption('default');await loaded(page,id);assert.ok(await page.evaluate(id=>__opsTest.loadedObjs[id]===__ifcState.object,id));
        await focus(page);await page.locator(`[data-model-toggle="${id}"]`).uncheck();assert.equal(await page.evaluate(id=>!!__opsTest.loadedObjs[id].parent,id),false);
        await page.locator(`[data-model-toggle="${id}"]`).check();await loaded(page,id);assert.ok(await page.evaluate(id=>__opsTest.loadedObjs[id]===__ifcState.object,id));
        assert.deepEqual(await state(page),before);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),768);
      }));
      await check('IFC and existing STL removal dispose GPU resources and revoke only their session URLs',() => use(env,{},async page => {
        const ifc=await upload(page,small),legacy=await upload(page,{name:'existing-model.stl',mimeType:'model/stl',buffer:stl});
        const bounds=await geometry(page,legacy);vectorClose(bounds.min,[0,0,-3],'STL orientation minimum');vectorClose(bounds.max,[4,2,0],'STL orientation maximum');
        await page.evaluate(ids=>{
          window.__disposal={geometries:0,materials:0,expectedGeometries:0,expectedMaterials:0,revoked:[],urls:ids.map(id=>__opsTest.sessionModels[id].url)};
          const gs=new Set(),ms=new Set();ids.forEach(id=>__opsTest.loadedObjs[id].traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of [].concat(o.material||[]))ms.add(m);}));
          __disposal.expectedGeometries=gs.size;__disposal.expectedMaterials=ms.size;gs.forEach(g=>g.addEventListener('dispose',()=>__disposal.geometries++));ms.forEach(m=>m.addEventListener('dispose',()=>__disposal.materials++));
          const original=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=url=>{__disposal.revoked.push(url);original(url);};
        },[ifc,legacy]);
        for(const id of [ifc,legacy])await page.locator(`[data-model-del="${id}"]`).click();
        const disposed=await page.evaluate(()=>__disposal);assert.equal(disposed.geometries,disposed.expectedGeometries);assert.equal(disposed.materials,disposed.expectedMaterials);assert.deepEqual(disposed.revoked.sort(),disposed.urls.sort());
        assert.equal(await page.evaluate(()=>Object.keys(__opsTest.loadedObjs).length),0);assert.equal(await page.evaluate(()=>Object.keys(__opsTest.sessionModels).length),0);
      }));
      await check('Hosted IFC preserves shared references and project/audience filtering without automatic upload',async()=>{
        const data=board();data.models=[{id:'ifc-north',name:'North IFC',url:env.url+'/after/tests/fixtures-ifc/transformed-millimetres-ifc4.ifc',fmt:'ifc',project:'default',visible:true}];
        await use(env,{data},async page=>{
          await loaded(page,'ifc-north');const before=await state(page);assert.deepEqual(before.payload.models,data.models);
          await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__opsTest?.ready);await loaded(page,'ifc-north');assert.deepEqual(await state(page),before);
        });
        for(const [audience,allowed] of [['?ui=workspaces&workspace=site&view=test-client-0',true],['?ui=workspaces&workspace=site&view=test-client-1',false],['?ui=workspaces&workspace=site&crew=test-site',true]])await use(env,{data,audience},async page=>{
          if(allowed){await loaded(page,'ifc-north');assert.equal(await page.locator('[data-model-toggle="ifc-north"]').count(),1);}
          else{assert.equal(await page.locator('[data-model-toggle="ifc-north"]').count(),0);assert.equal(await page.evaluate(()=>!!__opsTest.loadedObjs['ifc-north']),false);assert.doesNotMatch(await page.locator('#modelList').textContent(),/North IFC/);}
          assert.equal(await page.locator('#modelTools').isVisible(),false);
        });
      });
      await check('Removal while a hosted IFC is loading cannot resurrect the removed model',() => use(env,{},async(page,run)=>{
        // Prime the existing viewer, then hold only the model response (not a timer).
        await upload(page,{name:'existing-model.stl',mimeType:'model/stl',buffer:stl});
        let release;const held=new Promise(resolve=>release=resolve);
        await run.context.route('**/held-model.ifc',async route=>{await held;try{await route.fulfill({contentType:'application/octet-stream',body:fs.readFileSync(small)});}catch(error){if(!/closed|disposed|abort|handled|Invalid InterceptionId/i.test(error.message))throw error;}});
        // The download originates in a dedicated Worker, so observe the context
        // request stream rather than relying on a Page-associated request event.
        const requested=run.context.waitForEvent('request',{predicate:request=>new URL(request.url()).pathname.endsWith('/held-model.ifc'),timeout:15000});
        const answers=[env.url+'/after/held-model.ifc','Held IFC'];page.on('dialog',dialog=>dialog.accept(answers.shift()));await page.locator('#btnModelUrl').click();await requested;
        const id=await page.evaluate(()=>__opsTest.state.models.find(m=>m.name==='Held IFC').id);
        const status=page.locator(`[data-model-status="${id}"]`);assert.equal(await status.getAttribute('role'),'status');assert.match(await status.textContent(),/Downloading IFC|Loading IFC/);
        await page.locator(`[data-model-del="${id}"]`).click();release();
        // A subsequent valid IFC completing observes the actual importer, rather than sleeping.
        await upload(page,small);
        assert.equal(await page.evaluate(id=>!!__opsTest.loadedObjs[id]||__opsTest.state.models.some(m=>m.id===id)||__opsTest.three.scene.children.some(o=>o===__opsTest.loadedObjs[id]),id),false);
        assert.equal(await page.locator(`[data-model-toggle="${id}"]`).count(),0);
      }));
    }
  } finally {
    await env.close();
    const finalHashes=hashes(),report={commit:initialCommit,endCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),cleanAtEnd:!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),engine:env.engine,mode:fast?'FAST':'FOCUSED',inputsUnchanged:JSON.stringify(initialHashes)===JSON.stringify(finalHashes),hashes:initialHashes,results};
    fs.writeFileSync(path.join(output,'ifc-import-results.json'),JSON.stringify(report,null,2)+'\n');
    if(results.some(result=>!result.passed)||!report.inputsUnchanged||report.endCommit!==initialCommit)process.exitCode=1;
    console.log(`${results.filter(r=>r.passed).length}/${results.length} IFC checks passed (${env.engine})`);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
