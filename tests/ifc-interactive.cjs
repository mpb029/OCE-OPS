// Isolated actual-file IFC interaction checks. The private G12 fixtures stay outside Git.
// Run with OCE_ENGINE=chromium or firefox; --fast is the bounded import/visibility check.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {root, output, start, open} = require('./harness.cjs');
const board = require('./workspace-fixture.cjs');
const {stl} = require('./fixtures.cjs');
const source = process.env.OCE_IFC_G12 || path.join(os.homedir(), 'OneDrive', 'Desktop', 'SPS-G12_Rev0_Coordination.ifc');
const manifestPath = process.env.OCE_IFC_G12_MANIFEST || path.join(os.homedir(), 'Downloads', 'SPS_G12_IFC_Element_Manifest.json');
const expectedHash = '17d1deefc3e84ed00ada03c4e8067bd182bfd09ffc8b0cb4ce7b22317b1636cf';
// The supplied manifest omits this source IFCTANK. Keep the discrepancy explicit:
// geometry and metadata must retain the actual IFC element, not silently drop it.
const manifestOmission = {expressID:170670,globalId:'19hdx20rvVOBt0lIOegNKB',ifcClass:'IFCTANK',name:'NEW emergency storage tank outer envelope',status:'NEW',category:'New tank',display:'Solid',ifcGroups:['NEW | New tank']};
const viewerStorageKey = 'oce_ifc_views_v1:' + expectedHash;
const fast = process.argv.includes('--fast');
const capture = process.argv.includes('--screenshot');
const results = [];
let failureDiagnostics = async () => null;
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const git = args => execFileSync('git', args, {cwd:root, encoding:'utf8'}).trim();
const sorted = values => [...values].sort();
const near = (actual, expected, label, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) < tolerance, `${label}: ${actual} versus ${expected}`);
const vectorNear = (actual, expected, label, tolerance) => actual.forEach((value, i) => near(value, expected[i], `${label}[${i}]`, tolerance));
const hashFiles = files => Object.fromEntries(files.map(file => [file, sha(path.join(root, file))]));
const sourceFiles = ['index.html','ifc-loader.js','ifc-worker.js','ifc-controls.js','ifc-controls.css','ifc-presets.js','tests/ifc-interactive.cjs','tests/harness.cjs','tests/workspace-fixture.cjs'];
const operationalFiles = () => git(['ls-files', 'data.json', 'workarea.geojson', 'files', 'aerial']).split(/\r?\n/).filter(Boolean);

async function check(name, callback) {
  const started = Date.now();
  try { await callback(); results.push({name, passed:true, ms:Date.now()-started}); console.log('PASS ' + name); return true; }
  catch (error) { const diagnostics=await failureDiagnostics().catch(error=>({diagnosticError:error.message}));results.push({name,passed:false,ms:Date.now()-started,error:error.stack,diagnostics});console.error('FAIL '+name+'\n'+error.stack+'\nDiagnostics: '+JSON.stringify(diagnostics));return false; }
}
async function state(page) {
  return page.evaluate(key => {
    const payload = __opsTest.shareableState(); delete payload.publishedAt;
    const storage = {...localStorage}; delete storage.offaly_ops_proj; delete storage[key];
    return {state:structuredClone(__opsTest.state), payload, storage, dirty:__opsTest.sync.dirty};
  }, viewerStorageKey);
}
async function focus(page) {
  const shortcut = page.locator('.ws-shortcuts [data-ws-target="#modelCard"]');
  if (await shortcut.isVisible()) await shortcut.click();
  await page.locator('#modelStage').scrollIntoViewIfNeeded();
}
async function settled(page) {
  await page.waitForFunction(() => {
    const t = __opsTest.three, values = [...t.camera.position.toArray(), ...t.controls.target.toArray()];
    const old = window.__ifcTestCamera || {values:[], stable:0};
    const stable = values.every((value, i) => Math.abs(value-old.values[i]) < 1e-8) ? old.stable+1 : 0;
    window.__ifcTestCamera = {values, stable}; return stable >= 8;
  });
}
async function upload(page, file) {
  const before = await page.evaluate(() => Object.keys(__opsTest.sessionModels));
  await page.locator('#fileModel').setInputFiles(file);
  await page.waitForFunction(ids => Object.keys(__opsTest.sessionModels).some(id => !ids.includes(id)), before);
  const id = await page.evaluate(ids => Object.keys(__opsTest.sessionModels).find(id => !ids.includes(id)), before);
  await page.waitForFunction(id => !!__opsTest.three && !!__opsTest.loadedObjs[id] && __opsTest.loadedObjs[id].parent === __opsTest.three.scene, id, {timeout:90000});
  await settled(page); return id;
}
async function reveal(locator) {
  // Open the real disclosure controls before interacting with a nested element row.
  while (!await locator.isVisible()) {
    const closed = locator.locator('xpath=ancestor::details[not(@open)]').first();
    if (!await closed.count()) break;
    await closed.locator(':scope > summary').click();
  }
  return locator;
}
async function visible(page, id) {
  return page.evaluate(id => {
    const ids = new Set();
    __opsTest.loadedObjs[id].traverse(part => {
      if (!part.userData.ifcGlobalId || !(part.isMesh || part.isLine)) return;
      for (let node = part; node; node = node.parent) if (!node.visible) return;
      ids.add(part.userData.ifcGlobalId);
    });
    return [...ids].sort();
  }, id);
}
async function view(page, id) {
  return page.evaluate(id => {
    const value = __opsTest.loadedObjs[id].userData.ifcView;
    return {hidden:[...value.hidden].sort(), selected:value.selected, groundOpacity:value.groundOpacity, sectionEnabled:value.sectionEnabled, sectionHeight:value.sectionHeight,
      camera:__opsTest.three.camera.position.toArray(),target:__opsTest.three.controls.target.toArray(),near:__opsTest.three.camera.near,far:__opsTest.three.camera.far};
  }, id);
}
async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((input, value) => { input.value = String(value); }, value);
  await page.locator(selector).dispatchEvent('input');
  await page.locator(selector).dispatchEvent('change');
}
async function nav(page, route) {
  if (await page.locator('#wsMobileMenu').isVisible() && !await page.locator('#wsSidebar').isVisible()) await page.locator('#wsMobileMenu').click();
  await page.locator(`#wsDestinations [data-ws-route="${route}"]`).click();
  await page.waitForFunction(route => document.body.dataset.workspace === route, route);
}
async function select(page, globalId) {
  const button = await reveal(page.locator(`[data-ifc-select="${globalId}"]`));
  await button.click();
}
async function showAll(page) {
  await page.locator('#ifcSearch').fill('');
  await page.locator('#ifcShowAll').click();
  await page.locator('#ifcSectionReset').click();
  await setRange(page, '#ifcGroundOpacity', 100);
}
async function frameBounds(page, id, globalId) {
  return page.evaluate(({id, globalId}) => {
    const object = __opsTest.loadedObjs[id], t = __opsTest.three, box = new THREE.Box3();
    object.updateMatrixWorld(true); t.camera.updateMatrixWorld(true);
    object.traverse(part => { if (part.geometry && (!globalId || part.userData.ifcGlobalId === globalId)) box.expandByObject(part); });
    const corners = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x,y,z).project(t.camera).toArray());
    return {center:box.getCenter(new THREE.Vector3()).toArray(), size:box.getSize(new THREE.Vector3()).toArray(), target:t.controls.target.toArray(), corners};
  }, {id, globalId});
}

(async () => {
  // Missing private fixtures are a failing prerequisite, never a skipped acceptance check.
  assert.ok(fs.existsSync(source), 'Required G12 IFC is missing; set OCE_IFC_G12 to the supplied IFC path.');
  assert.ok(fs.existsSync(manifestPath), 'Required G12 manifest is missing; set OCE_IFC_G12_MANIFEST to the supplied JSON path.');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')), manifestHash = sha(manifestPath);
  assert.equal(sha(source), expectedHash, 'Actual supplied G12 IFC SHA-256');
  assert.equal(manifest.sourceSHA256, expectedHash); assert.equal(fs.statSync(source).size, 14049990);
  assert.equal(manifest.productCount, 131); assert.equal(manifest.elements.length, 131); assert.equal(manifest.groupCount, 20); assert.equal(manifest.groups.length, 20);
  assert.equal(new Set(manifest.elements.map(element=>element.globalId)).size,131,'The manifest itself must contain unique GlobalIds');
  const expectedElements = [...manifest.elements,manifestOmission], expectedIds = sorted(expectedElements.map(element=>element.globalId));
  const expectedGroups = manifest.groups.map(group=>({...group,count:group.count+(group.name==='NEW | New tank'?1:0)}));
  assert.equal(new Set(expectedIds).size,132,'The exact source tank is absent from the supplied manifest');
  const initialCommit = git(['rev-parse','HEAD']), initialSources = hashFiles(sourceFiles), initialOperational = hashFiles(operationalFiles());
  const env = await start();let run,id,rendering=null;
  try {
    run = await open(env, {data:board(), liveClock:true, audience:'?ui=workspaces&workspace=site'});
    const {page, context, network} = run, externalWrites = [];
    // The harness forces software SwiftShader. With the actual 106k-triangle G12
    // model, observed post-click rendering exceeded its normal 12-second limit.
    page.setDefaultTimeout(30000);
    failureDiagnostics=()=>page.evaluate(id=>{
      const dimensions={};for(const selector of ['#modelCard','#modelStage','#ifcPanel','.model-canvas']){const node=document.querySelector(selector);if(node){const rect=node.getBoundingClientRect();dimensions[selector]={x:rect.x,y:rect.y,width:rect.width,height:rect.height,styleHeight:getComputedStyle(node).height,canvasWidth:node.width,canvasHeight:node.height};}}
      const object=__opsTest.loadedObjs[id],v=object?.userData.ifcView;return {dimensions,selected:v?.selected,hidden:v?[...v.hidden]:[],inScene:!!object&&object.parent===__opsTest.three?.scene,render:__opsTest.three?.renderer.info.render};
    },id);
    context.on('request', request => { if (!['GET','HEAD'].includes(request.method())) externalWrites.push({method:request.method(),url:request.url()}); });
    await focus(page); const before = await state(page);
    const imported = await check('Actual G12 exact hash, all 131 manifest GlobalIds plus the source tank, 20 IFC groups and rendered geometry', async () => {
      id = await upload(page, source); await page.locator('#ifcPanel').waitFor({state:'visible'});
      rendering=await page.evaluate(async()=>{
        const timestamps=[];await new Promise(resolve=>{const sample=time=>{timestamps.push(time);if(timestamps.length===9)resolve();else requestAnimationFrame(sample);};requestAnimationFrame(sample);});
        const renderer=__opsTest.three.renderer,canvas=renderer.domElement,rect=canvas.getBoundingClientRect();
        return {cssWidth:rect.width,cssHeight:rect.height,drawingBufferWidth:canvas.width,drawingBufferHeight:canvas.height,averageFrameMs:(timestamps.at(-1)-timestamps[0])/8,triangles:renderer.info.render.triangles,lines:renderer.info.render.lines,calls:renderer.info.render.calls};
      });
      console.log('G12 render timing '+JSON.stringify(rendering));
      const actual = await page.evaluate(id => {
        const object = __opsTest.loadedObjs[id], metadata = object.userData.ifc, parts = [];
        object.traverse(part => {
          if (!part.geometry || !(part.isMesh || part.isLine)) return;
          const position = part.geometry.getAttribute('position');
          parts.push({globalId:part.userData.ifcGlobalId, expressID:part.userData.ifcExpressID, mesh:!!part.isMesh, line:!!part.isLine,
            vertices:position.count, finite:Array.from(position.array).every(Number.isFinite), primitives:(part.geometry.index?.count || position.count)/(part.isMesh ? 3 : 2)});
        });
        return {metadata, parts, rendered:__opsTest.three.renderer.info.render, rotation:object.rotation.toArray().slice(0,3)};
      }, id);
      assert.equal(actual.metadata.contentHash, expectedHash); assert.match(actual.metadata.schema, /IFC4/i);
      assert.deepEqual(actual.metadata.unsupported,[],'All actual source representations are supported');
      assert.equal(actual.metadata.coordinateSystem.ahdVerified,true);assert.equal(actual.metadata.coordinateSystem.verticalDatum,'AHD');assert.match(actual.metadata.coordinateSystem.crs,/EPSG:7856/);
      for(const key of ['eastings','northings','orthogonalHeight'])assert.equal(actual.metadata.coordinateSystem.mapConversion[key],manifest.coordinateSystem.mapConversion[key]);
      assert.equal(actual.metadata.elements.length,132);assert.equal(actual.metadata.groups.length,20);
      assert.deepEqual(actual.metadata.elements.filter(element=>!manifest.elements.some(expected=>expected.globalId===element.globalId)).map(element=>({expressID:element.expressID,globalId:element.globalId,name:element.name,ifcClass:element.ifcClass.toUpperCase()})),[{expressID:manifestOmission.expressID,globalId:manifestOmission.globalId,name:manifestOmission.name,ifcClass:manifestOmission.ifcClass}],'Only the verified omitted source IFCTANK is additional to the manifest');
      const actualById = new Map(actual.metadata.elements.map(element => [element.globalId, element]));
      assert.deepEqual(sorted(actualById.keys()), expectedIds, 'Every source GlobalId survives import exactly once');
      const groupsById = new Map(actual.metadata.groups.map(group => [group.expressID, group]));
      for (const expected of expectedElements) {
        const element = actualById.get(expected.globalId);
        for (const key of ['expressID','name','status','category','display']) assert.equal(element[key], expected[key], `${expected.globalId} ${key}`);
        assert.equal(element.ifcClass.toUpperCase(), expected.ifcClass);
        assert.deepEqual(sorted(element.groups.map(group => groupsById.get(group)?.name)), sorted(expected.ifcGroups), expected.name + ' actual IFC group assignments');
        assert.equal(element.properties.Pset_ConstructionStatus.Status, expected.status);
        assert.equal(element.properties.Pset_ConstructionStatus.Category, expected.category);
      }
      assert.deepEqual(actual.metadata.groups.map(group=>({name:group.name,count:group.elementIds.length})).sort((a,b)=>a.name.localeCompare(b.name)),[...expectedGroups].sort((a,b)=>a.name.localeCompare(b.name)));
      for (const group of actual.metadata.groups) assert.deepEqual(sorted(group.elementIds),sorted(expectedElements.filter(element=>element.ifcGroups.includes(group.name)).map(element=>element.globalId)),group.name);
      assert.deepEqual(sorted(new Set(actual.parts.map(part=>part.globalId))),expectedIds,'All 132 source products have real surface or source curve geometry');
      assert.ok(actual.parts.every(part => part.finite && part.vertices > 1 && part.primitives > 0));
      assert.equal(new Set(actual.parts.filter(part=>part.mesh).map(part=>part.globalId)).size,108,'108 surface products including the source tank');
      assert.equal(new Set(actual.parts.filter(part=>part.line).map(part=>part.globalId)).size, 24, '24 source curve products');
      assert.ok(actual.parts.length < 300, 'Geometry is grouped by product, not one object per triangle');
      assert.ok(actual.rendered.triangles > 100); assert.ok(actual.rendered.lines > 0); vectorNear(actual.rotation, [0,0,0], 'IFC orientation');
      assert.equal(await page.locator('[data-ifc-group]').count(),20);assert.equal(await page.locator('[data-ifc-element]').count(),132);
      assert.deepEqual(await visible(page, id), expectedIds); assert.deepEqual(await state(page), before, 'Import does not alter operational data or publish state');
    });
    if (imported) {
      const groups = await page.evaluate(id => __opsTest.loadedObjs[id].userData.ifc.groups, id);
      const pipes = groups.find(group => group.name === 'NEW | New pipework');
      const ground = groups.find(group => group.name === 'EXISTING_GROUND | Existing ground');
      const selected = manifest.elements.find(element => element.name === 'NEW flowmeter chamber base slab');
      await check('Actual IFC group and element hide/show, isolate and show-all control rendered products', async () => {
        const groupToggle = await reveal(page.locator(`[data-ifc-group="${pipes.expressID}"]`));
        await groupToggle.uncheck(); assert.deepEqual(await visible(page,id), expectedIds.filter(gid=>!pipes.elementIds.includes(gid)));
        await groupToggle.check(); assert.deepEqual(await visible(page,id), expectedIds);
        await (await reveal(page.locator(`[data-ifc-isolate-group="${pipes.expressID}"]`))).click();
        assert.deepEqual(await visible(page,id), sorted(pipes.elementIds));
        await page.locator('#ifcShowAll').click();
        const elementToggle = await reveal(page.locator(`[data-ifc-element="${selected.globalId}"]`));
        await elementToggle.uncheck(); assert.deepEqual(await visible(page,id), expectedIds.filter(gid=>gid!==selected.globalId));
        await elementToggle.check(); await select(page,selected.globalId); await page.locator('#ifcIsolateSelected').click();
        assert.deepEqual(await visible(page,id), [selected.globalId]); await page.locator('#ifcShowAll').click();
        assert.deepEqual(await visible(page,id), expectedIds); assert.deepEqual(await state(page),before);
      });
      if (!fast) {
        await check('Canvas click selects a real IFC surface and exposes identity plus source property sets', async () => {
          await showAll(page); await select(page, selected.globalId); await page.locator('#ifcIsolateSelected').click(); await page.locator('#ifcFitSelected').click(); await settled(page); await focus(page);
          const framed = await frameBounds(page,id,selected.globalId); vectorNear(framed.target,framed.center,'Selected element frame centre');
          assert.ok(framed.corners.every(([x,y,z])=>Math.abs(x)<1&&Math.abs(y)<1&&Math.abs(z)<1),'Selected geometry is wholly in the viewport');
          const selectedToggle=await reveal(page.locator(`[data-ifc-element="${selected.globalId}"]`));await selectedToggle.uncheck();await selectedToggle.check();
          assert.ok(!(await view(page,id)).selected,'Hiding and re-showing the slab leaves no stale selection');await focus(page);
          // Independent Three raycasts choose actual blank and surface pixels; selection still happens through mouse events.
          const points = await page.evaluate(({id,globalId}) => {
            const t=__opsTest.three, canvas=t.renderer.domElement.getBoundingClientRect(), meshes=[];
            __opsTest.loadedObjs[id].traverse(part=>{if(part.isMesh&&part.userData.ifcGlobalId===globalId&&part.visible)meshes.push(part);});
            const ray=new THREE.Raycaster(), points={}; t.camera.updateMatrixWorld(true);
            for(let y=.05;y<.96;y+=.05) for(let x=.05;x<.96;x+=.05) {
              ray.setFromCamera(new THREE.Vector2(x*2-1,1-y*2),t.camera);
              const hit=ray.intersectObjects(meshes,false)[0], key=hit?'surface':'blank';
              if(!points[key])points[key]={x:canvas.x+x*canvas.width,y:canvas.y+y*canvas.height};
              if(points.surface&&points.blank)return points;
            }
            return points;
          },{id,globalId:selected.globalId});
          assert.ok(points.surface&&points.blank,'The isolated real slab has selectable surface and blank pixels');
          await page.mouse.click(points.blank.x,points.blank.y);assert.ok(!(await view(page,id)).selected,'Blank canvas does not select hidden IFC geometry');
          await page.mouse.click(points.surface.x,points.surface.y); assert.equal((await view(page,id)).selected,selected.globalId);
          const properties=await page.locator('#ifcProperties').innerText();
          for(const value of [selected.globalId,selected.name,String(selected.expressID),'Pset_ConstructionStatus','Pset_ModelEvidence','FloorRL','51.23'])assert.ok(properties.includes(value),'Property panel includes '+value);
          await page.locator('#ifcSearch').fill(selected.globalId); assert.equal(await page.locator('[data-ifc-select]:visible').count(),1); await page.locator('#ifcSearch').fill('');
        });
        await check('Ground visibility and opacity leave all other IFC products unchanged', async () => {
          await showAll(page);
          const materials=()=>page.evaluate(id=>{
            const rows=[];__opsTest.loadedObjs[id].traverse(part=>{if(part.userData.ifcGlobalId&&part.material)rows.push({gid:part.userData.ifcGlobalId,opacity:part.material.opacity});});return rows;
          },id);
          const initial=await materials(); await setRange(page,'#ifcGroundOpacity',25); const reduced=await materials();
          for(let i=0;i<initial.length;i++) {
            if(ground.elementIds.includes(initial[i].gid))near(reduced[i].opacity,initial[i].opacity*.25,'Ground opacity');
            else near(reduced[i].opacity,initial[i].opacity,'Non-ground material opacity');
          }
          const toggle=await reveal(page.locator(`[data-ifc-group="${ground.expressID}"]`));await toggle.uncheck();
          assert.deepEqual(await visible(page,id),expectedIds.filter(gid=>!ground.elementIds.includes(gid)));await toggle.check();await setRange(page,'#ifcGroundOpacity',100);
          assert.deepEqual(await materials(),initial);assert.deepEqual(await visible(page,id),expectedIds);
          await (await reveal(page.locator(`[data-ifc-isolate-group="${ground.expressID}"]`))).click();await settled(page);await setRange(page,'#ifcGroundOpacity',0);
          await select(page,ground.elementIds[0]);await toggle.uncheck();await toggle.check();await focus(page);
          const transparentPixel=await page.evaluate(id=>{
            const t=__opsTest.three,objects=[];__opsTest.loadedObjs[id].traverseVisible(part=>{if(part.geometry&&part.userData.ifcGlobalId)objects.push(part);});
            const rect=t.renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.params.Line.threshold=.08;t.camera.updateMatrixWorld(true);
            for(const y of [.5,.25,.75,.1,.9])for(const x of [.5,.25,.75,.1,.9]){ray.setFromCamera(new THREE.Vector2(x*2-1,1-y*2),t.camera);if(ray.intersectObjects(objects,false).length)return {x:rect.x+x*rect.width,y:rect.y+y*rect.height};}return null;
          },id);
          assert.ok(transparentPixel,'Independent raycast locates the actual ground behind its zero-opacity material');
          await page.mouse.click(transparentPixel.x,transparentPixel.y);assert.ok(!(await view(page,id)).selected,'Fully transparent ground cannot intercept canvas selection');await showAll(page);
        });
        await check('Horizontal clipping uses world Y and distinguishes local height from verified AHD', async () => {
          await showAll(page);await page.locator('#ifcSectionEnabled').check();
          const limits=await page.locator('#ifcSection').evaluate(input=>({min:Number(input.min),max:Number(input.max)}));
          assert.ok(Number.isFinite(limits.min)&&Number.isFinite(limits.max)&&limits.max>limits.min);
          const height=Math.round((limits.min+(limits.max-limits.min)*.45)*100)/100;await setRange(page,'#ifcSection',height);
          const clipping=await page.evaluate(id=>{
            const t=__opsTest.three,object=__opsTest.loadedObjs[id],planes=[];
            object.traverse(part=>{if(part.material&&part.userData.ifcGlobalId)planes.push((part.material.clippingPlanes||[]).map(plane=>({normal:plane.normal.toArray(),constant:plane.constant})));});
            return {enabled:t.renderer.localClippingEnabled,planes,height:object.userData.ifcView.sectionHeight};
          },id);
          assert.equal(clipping.enabled,true);near(clipping.height,height,'Local section height');assert.ok(clipping.planes.length>=132);
          for(const planes of clipping.planes){assert.equal(planes.length,1);vectorNear(planes[0].normal.map(Math.abs),[0,1,0],'Horizontal section normal');near(planes[0].normal[1]*height+planes[0].constant,0,'World-Y clipping plane');}
          const label=await page.locator('#ifcSectionValue').innerText();assert.match(label,/AHD/i);
          assert.ok(label.includes((height+50).toFixed(2)),'Clipping label reports source-verified AHD offset +50 m');
          await page.locator('#ifcSectionReset').click();assert.equal((await view(page,id)).sectionEnabled,false);
          assert.ok(await page.evaluate(id=>{let clean=true;__opsTest.loadedObjs[id].traverse(part=>{if(part.material&&part.userData.ifcGlobalId&&part.material.clippingPlanes?.length)clean=false;});return clean;},id));
        });
        await check('G12 presets and saved local view restore useful camera, visibility and inspection state', async () => {
          await showAll(page);const signatures=[];
          for(const preset of ['whole','wetwell','vent','storage']) {
            await page.locator('#ifcPreset').selectOption(preset);await settled(page);const snapshot=await view(page,id);
            assert.ok(snapshot.camera.every(Number.isFinite)&&snapshot.target.every(Number.isFinite));assert.ok((await visible(page,id)).length>0);signatures.push(JSON.stringify([snapshot.camera,snapshot.target,snapshot.hidden]));
            if(preset==='whole')assert.deepEqual(await visible(page,id),expectedIds);
          }
          assert.equal(new Set(signatures).size,4,'Named G12 views produce distinct useful views');
          await page.locator('#ifcPreset').selectOption('whole');await settled(page);const whole=await view(page,id);
          await page.locator('#ifcViewName').fill('G12 whole regression view');await page.locator('#ifcSaveView').click();
          const wholeOption=await page.locator('#ifcPreset option').evaluateAll(options=>options.find(option=>option.textContent.includes('G12 whole regression view'))?.value);
          await showAll(page);await select(page,selected.globalId);await page.locator('#ifcIsolateSelected').click();await page.locator('#ifcFitSelected').click();await setRange(page,'#ifcGroundOpacity',35);await settled(page);
          const saved=await view(page,id);await page.locator('#ifcViewName').fill('G12 focused regression view');await page.locator('#ifcSaveView').click();
          const savedOption=await page.locator('#ifcPreset option').evaluateAll(options=>options.find(option=>option.textContent.includes('G12 focused regression view'))?.value);assert.ok(savedOption,'Saved view appears in the preset selector');
          assert.ok(await page.evaluate(key=>localStorage.getItem(key),viewerStorageKey),'Saved view uses the content-hash-specific viewer key');
          await page.locator('#ifcPreset').selectOption('whole');await page.locator('#ifcPreset').selectOption(savedOption);await settled(page);
          const restored=await view(page,id);assert.deepEqual(restored.hidden,saved.hidden);assert.equal(restored.selected,saved.selected);near(restored.groundOpacity,saved.groundOpacity,'Saved opacity');vectorNear(restored.camera,saved.camera,'Saved camera');vectorNear(restored.target,saved.target,'Saved target');near(restored.near,saved.near,'Saved near plane');near(restored.far,saved.far,'Saved far plane');
          await page.locator('#ifcPreset').selectOption(wholeOption);await settled(page);const restoredWhole=await view(page,id);near(restoredWhole.near,whole.near,'Whole-model near plane after fitting one slab');near(restoredWhole.far,whole.far,'Whole-model far plane after fitting one slab');
          assert.ok((await frameBounds(page,id)).corners.every(([x,y,z])=>Math.abs(x)<1&&Math.abs(y)<1&&Math.abs(z)<1),'Saved whole-model view restores camera depth range after fitting a small element');
          await page.locator('#ifcPreset').selectOption(savedOption);await settled(page);
          assert.deepEqual(await state(page),before,'Saving local views does not change operational storage or publishing payload');
        });
        await check('Workspace navigation preserves the same IFC objects and inspection state', async () => {
          await settled(page);const saved=await view(page,id);await page.evaluate(id=>window.__ifcTestIdentity={viewer:__opsTest.three,object:__opsTest.loadedObjs[id],url:__opsTest.sessionModels[id].url},id);
          for(const route of ['overview','operations','site'])await nav(page,route);await focus(page);await settled(page);
          assert.ok(await page.evaluate(id=>__opsTest.three===__ifcTestIdentity.viewer&&__opsTest.loadedObjs[id]===__ifcTestIdentity.object&&__opsTest.loadedObjs[id].parent===__opsTest.three.scene&&__opsTest.sessionModels[id].url===__ifcTestIdentity.url,id));
          const restored=await view(page,id);assert.deepEqual(restored.hidden,saved.hidden);assert.equal(restored.selected,saved.selected);assert.equal(restored.sectionEnabled,saved.sectionEnabled);near(restored.groundOpacity,saved.groundOpacity,'Workspace opacity');vectorNear(restored.camera,saved.camera,'Workspace camera');vectorNear(restored.target,saved.target,'Workspace target');assert.deepEqual(await state(page),before);
          if(capture&&env.engine==='chromium'){await page.locator('#ifcPreset').selectOption('whole');await settled(page);await page.locator('#modelCard').screenshot({path:path.join(output,'ifc-g12-interactive.png')});}
        });
        await check('Existing STL remains usable; IFC and STL removal dispose resources and session URLs', async () => {
          await showAll(page);const legacy=await upload(page,{name:'existing-model.stl',mimeType:'model/stl',buffer:stl});
          const bounds=await page.evaluate(id=>{const b=new THREE.Box3().setFromObject(__opsTest.loadedObjs[id]);return {min:b.min.toArray(),max:b.max.toArray()};},legacy);vectorNear(bounds.min,[0,0,-3],'STL minimum');vectorNear(bounds.max,[4,2,0],'STL maximum');
          await page.evaluate(ids=>{
            const geometries=new Set(),materials=new Set();window.__ifcTestDisposal={geometry:0,material:0,revoked:[],urls:ids.map(id=>__opsTest.sessionModels[id].url)};
            ids.forEach(id=>__opsTest.loadedObjs[id].traverse(part=>{if(part.geometry)geometries.add(part.geometry);for(const material of [].concat(part.material||[]))materials.add(material);}));
            __ifcTestDisposal.expectedGeometry=geometries.size;__ifcTestDisposal.expectedMaterial=materials.size;
            geometries.forEach(geometry=>geometry.addEventListener('dispose',()=>__ifcTestDisposal.geometry++));materials.forEach(material=>material.addEventListener('dispose',()=>__ifcTestDisposal.material++));
            const original=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=url=>{__ifcTestDisposal.revoked.push(url);original(url);};
          },[id,legacy]);
          await page.locator(`[data-model-del="${id}"]`).click();assert.equal(await page.locator('#ifcPanel').isVisible(),false);assert.ok(await page.evaluate(id=>__opsTest.loadedObjs[id]?.parent===__opsTest.three.scene,legacy));
          await page.locator(`[data-model-del="${legacy}"]`).click();const disposed=await page.evaluate(()=>__ifcTestDisposal);assert.equal(disposed.geometry,disposed.expectedGeometry);assert.equal(disposed.material,disposed.expectedMaterial);assert.deepEqual(sorted(disposed.revoked),sorted(disposed.urls));
          assert.equal(await page.evaluate(()=>Object.keys(__opsTest.loadedObjs).length),0);assert.equal(await page.evaluate(()=>Object.keys(__opsTest.sessionModels).length),0);assert.deepEqual(await state(page),before);
        });
      }
    }
    await check('No operational state changes, external mutations or uncaught runtime errors', async()=>{assert.deepEqual(await state(page),before);assert.deepEqual(externalWrites,[]);assert.deepEqual(network.writes,[]);assert.deepEqual(network.errors,[]);});
  } finally {
    if(run)await run.close();await env.close();
    const report={commit:initialCommit,endCommit:git(['rev-parse','HEAD']),engine:env.engine,mode:fast?'FAST':'FOCUSED',rendering,fixture:{name:path.basename(source),sha256:expectedHash,bytes:14049990,manifestElements:131,sourceElements:132,groups:20,manifestOmission,manifestSha256:manifestHash},sourceHashes:initialSources,
      inputsUnchanged:JSON.stringify(initialSources)===JSON.stringify(hashFiles(sourceFiles)),operationalFilesUnchanged:JSON.stringify(initialOperational)===JSON.stringify(hashFiles(operationalFiles())),fixturesUnchanged:sha(source)===expectedHash&&sha(manifestPath)===manifestHash,results};
    fs.writeFileSync(path.join(output,'ifc-interactive-results.json'),JSON.stringify(report,null,2)+'\n');
    if(results.some(result=>!result.passed)||!report.inputsUnchanged||!report.operationalFilesUnchanged||!report.fixturesUnchanged||report.endCommit!==initialCommit)process.exitCode=1;
    console.log(`${results.filter(result=>result.passed).length}/${results.length} interactive IFC checks passed (${env.engine}, ${report.mode})`);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
