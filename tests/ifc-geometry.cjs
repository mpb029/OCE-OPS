// Narrow actual-IFC source/representation coverage check; no screenshot or broad UI suite.
// The audit combines independent raw-STEP semantics with source-face incidence proof.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process'),{root,output,start,open}=require('./harness.cjs'),board=require('./workspace-fixture.cjs');
const source=process.env.OCE_IFC_G12||path.join(os.homedir(),'OneDrive/Desktop/SPS-G12_Rev0_Coordination.ifc');
const auditPath=process.env.OCE_IFC_G12_AUDIT||path.join(__dirname,'fixtures-ifc/g12-geometry-audit.json');
const expectedHash='17d1deefc3e84ed00ada03c4e8067bd182bfd09ffc8b0cb4ce7b22317b1636cf';
const targets={tank:'19hdx20rvVOBt0lIOegNKB',wetwell:'2A0qFaKezGego6GVfucLSw',pipework:'3RHgcYQWrUaPh7Z11nWBoE',ground:'0JccQv4I1LHwREXDjM_8qH',demolition:'3t7In6gATJGvaaJcSYKQu9'};
const sorted=values=>[...values].sort(),hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim(),results=[];
const inputs=['index.html','ifc-worker.js','ifc-loader.js','ifc-controls.js','ifc-controls.css','ifc-presets.js','tests/ifc-geometry.cjs','tests/fixtures-ifc/g12-geometry-audit.json','tests/harness.cjs'];
const hashes=()=>Object.fromEntries(inputs.map(file=>[file,hash(path.join(root,file))]));
async function state(page){return page.evaluate(()=>{const payload=__opsTest.shareableState();delete payload.publishedAt;return {state:structuredClone(__opsTest.state),payload,dirty:__opsTest.sync.dirty};});}
async function visible(page,id){return page.evaluate(id=>{const ids=new Set();__opsTest.loadedObjs[id].traverseVisible(part=>{if(part.geometry&&part.userData.ifcGlobalId)ids.add(part.userData.ifcGlobalId);});return [...ids].sort();},id);}
async function reveal(locator){while(!await locator.isVisible()){const closed=locator.locator('xpath=ancestor::details[not(@open)]').first();assert.ok(await closed.count(),'Element must be in a visible or expandable IFC group');await closed.locator(':scope > summary').click();}return locator;}
async function check(name,fn){const started=Date.now();await fn();results.push({name,passed:true,ms:Date.now()-started});console.log('PASS '+name);}

(async()=>{
  assert.ok(fs.existsSync(source),'Required actual IFC missing; set OCE_IFC_G12.');
  assert.ok(fs.existsSync(auditPath),'Independent source audit missing; set OCE_IFC_G12_AUDIT.');
  const fixture=JSON.parse(fs.readFileSync(auditPath,'utf8')),audit=fixture.source,coverage=fixture.rendered,auditHash=hash(auditPath);
  assert.equal(hash(source),expectedHash);assert.equal(audit.sourceSHA256,expectedHash);
  assert.equal(coverage.summary.sourceSHA256,expectedHash);assert.equal(coverage.summary.sourceFaces,67242);assert.equal(audit.products.reduce((sum,product)=>sum+product.sourceFaceCount,0),67242);
  assert.equal(coverage.summary.omissionIDsMatchSourceRules,true);assert.equal(coverage.summary.expectedOmittedFaceIDs.length,1038);assert.equal(coverage.summary.coveredFaces,66204);
  assert.deepEqual(coverage.summary.unambiguousAreaMismatches,[]);assert.equal(coverage.summary.unmatchedTriangleCount,0);assert.equal(coverage.summary.ambiguousFaceCount,365);
  assert.equal(audit.products.length,132);assert.equal(audit.groups.length,20);
  const expectedIds=sorted(audit.products.map(product=>product.globalId));assert.equal(new Set(expectedIds).size,132);
  assert.equal(audit.products.filter(product=>product.kind==='surface').length,108);assert.equal(audit.products.filter(product=>product.kind==='curve').length,24);
  const initialCommit=git(['rev-parse','HEAD']),sourceHashes=hashes(),operationalHash=hash(path.join(root,'data.json'));
  const env=await start();let run,actual,error;
  try{
    run=await open(env,{data:board(),liveClock:true,audience:'?ui=workspaces&workspace=site'});const {page}=run;
    page.setDefaultTimeout(30000); // The shared harness forces software rendering in Chromium.
    const before=await state(page),shortcut=page.locator('.ws-shortcuts [data-ws-target="#modelCard"]');if(await shortcut.isVisible())await shortcut.click();
    await page.locator('#fileModel').setInputFiles(source);
    await page.waitForFunction(()=>Object.values(__opsTest.loadedObjs).some(object=>object.userData.ifc?.contentHash==='17d1deefc3e84ed00ada03c4e8067bd182bfd09ffc8b0cb4ce7b22317b1636cf'&&object.parent===__opsTest.three?.scene),null,{timeout:90000});
    await page.locator('#ifcPanel').waitFor({state:'visible'});const id=await page.evaluate(()=>Object.keys(__opsTest.loadedObjs).find(id=>__opsTest.loadedObjs[id].userData.ifc));
    actual=await page.evaluate(async id=>{
      const object=__opsTest.loadedObjs[id],products={};object.updateMatrixWorld(true);
      object.traverse(part=>{
        if(!part.geometry||!(part.isMesh||part.isLine))return;
        const gid=part.userData.ifcGlobalId,position=part.geometry.getAttribute('position'),index=part.geometry.index;
        const row=products[gid]||={expressID:part.userData.ifcExpressID,globalId:gid,meshes:0,lines:0,triangles:0,segments:0,surfaceArea:0,finite:true,materialModes:[],records:[],min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
        const count=index?index.count:position.count;row.meshes+=part.isMesh?1:0;row.lines+=part.isLine?1:0;row.triangles+=part.isMesh?count/3:0;row.segments+=part.isLine?count/2:0;
        for(const material of [].concat(part.material||[]))row.materialModes.push(part.isLine?'line':material.wireframe?'wireframe':'solid');
        row.finite&&=count>0&&count%(part.isMesh?3:2)===0;
        const points=[];for(let i=0;i<count;i++){const vertex=index?index.getX(i):i;if(vertex<0||vertex>=position.count){row.finite=false;continue;}const point=new THREE.Vector3().fromBufferAttribute(position,vertex).applyMatrix4(part.matrixWorld);point.toArray().forEach((value,axis)=>{row.finite&&=Number.isFinite(value);row.min[axis]=Math.min(row.min[axis],value);row.max[axis]=Math.max(row.max[axis],value);});if(part.isMesh){points[i%3]=point;if(i%3===2){row.surfaceArea+=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).length()/2;row.records.push(points.map(point=>point.toArray().map(Math.fround).join(',')).sort().join('|'));}}}
      });
      for(const row of Object.values(products)){if(row.meshes)row.geometrySHA256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(row.records.sort().join('\n')))),byte=>byte.toString(16).padStart(2,'0')).join('');delete row.records;}
      return {metadata:object.userData.ifc,products:Object.values(products),canvas:{width:__opsTest.three.renderer.domElement.width,height:__opsTest.three.renderer.domElement.height}};
    },id);
    await check('All source products and IFC group relationships survive import with their intended representation kind',async()=>{
      assert.equal(actual.metadata.contentHash,expectedHash);assert.equal(actual.metadata.elements.length,132);assert.equal(actual.metadata.groups.length,20);
      assert.deepEqual(sorted(actual.metadata.elements.map(product=>product.globalId)),expectedIds);assert.deepEqual(sorted(actual.products.map(product=>product.globalId)),expectedIds);
      const rows=new Map(actual.products.map(product=>[product.globalId,product]));
      for(const sourceProduct of audit.products){
        const meta=actual.metadata.elements.find(product=>product.globalId===sourceProduct.globalId),rendered=rows.get(sourceProduct.globalId);
        for(const key of ['expressID','globalId','name','ifcClass'])assert.equal(meta[key],sourceProduct[key],sourceProduct.globalId+' '+key);
        assert.equal(rendered.expressID,sourceProduct.expressID);assert.ok(rendered.finite,sourceProduct.name+' finite indexed geometry');
        assert.ok(sourceProduct.representationTypes.length>0,sourceProduct.name+' source representation type');
        for(const type of sourceProduct.representationTypes)assert.ok((sourceProduct.kind==='curve'?['GeometricCurveSet','Curve2D','Curve3D']:['Brep','SweptSolid','SurfaceModel','Tessellation','Clipping','CSG']).includes(type),'Audited representation '+type);
        assert.ok(sourceProduct.kind==='curve'?rendered.lines>0&&rendered.segments>0&&rendered.meshes===0:rendered.meshes>0&&rendered.triangles>0&&rendered.lines===0,sourceProduct.name+' source representation retained');
        assert.ok(rendered.materialModes.every(mode=>mode===(sourceProduct.kind==='curve'?'line':String(meta.display).toLowerCase()==='wireframe'?'wireframe':'solid')),sourceProduct.name+' recorded display mode');
        if(sourceProduct.kind==='curve')assert.equal(rendered.segments,sourceProduct.expectedSegments,sourceProduct.name+' exact source line segments');
        for(const bound of ['min','max'])for(let axis=0;axis<3;axis++)assert.ok(Math.abs(rendered[bound][axis]-sourceProduct.sourceBounds[bound][axis])<3e-6,sourceProduct.name+' source '+bound+' bounds, 3-micrometre Float32 tolerance');
      }
      for(const group of audit.groups){const rendered=actual.metadata.groups.find(candidate=>candidate.expressID===group.expressID);assert.ok(rendered,group.name);assert.equal(rendered.name,group.name);assert.equal(rendered.globalId,group.globalId);assert.deepEqual(sorted(rendered.elementIds),sorted(group.elementIds),group.name+' membership');}
      assert.deepEqual(await visible(page,id),expectedIds);
    });
    await check('Browser surface fingerprints exactly match the independently audited face coverage',async()=>{
      const surfaces=audit.products.filter(product=>product.kind==='surface');assert.deepEqual(sorted(coverage.products.map(product=>product.globalId)),sorted(surfaces.map(product=>product.globalId)));
      assert.equal(actual.products.reduce((sum,product)=>sum+product.triangles,0),106602);assert.equal(actual.products.reduce((sum,product)=>sum+product.segments,0),3917);
      assert.equal(actual.metadata.diagnostics.parserWarningCount,102,'Known source-face warnings remain visible');
      for(const expected of coverage.products){const rendered=actual.products.find(product=>product.globalId===expected.globalId),sourceProduct=surfaces.find(product=>product.globalId===expected.globalId);assert.equal(expected.sourceFaceCount,sourceProduct.sourceFaceCount,expected.name+' source face count');assert.equal(expected.expectedRenderedTriangles,expected.renderedTriangles,expected.name+' source-derived triangle expectation');assert.equal(rendered.triangles,expected.renderedTriangles,expected.name+' audited triangle count');assert.match(expected.geometrySHA256,/^[a-f0-9]{64}$/);assert.equal(rendered.geometrySHA256,expected.geometrySHA256,expected.name+' exact Float32 triangle geometry');assert.ok(Math.abs(rendered.surfaceArea-expected.renderedArea)<1e-7,expected.name+' audited rendered area');}
    });
    await check('Tank, wet well, pipework, ground and demolition retain group visibility, isolation and selection',async()=>{
      for(const [label,globalId]of Object.entries(targets)){
        const product=audit.products.find(product=>product.globalId===globalId),group=audit.groups.find(group=>group.elementIds.includes(globalId));assert.ok(product&&group,label+' source identity');
        await page.locator('#ifcShowAll').click();const toggle=await reveal(page.locator(`[data-ifc-group="${group.expressID}"]`));
        await toggle.uncheck();assert.deepEqual(await visible(page,id),expectedIds.filter(gid=>!group.elementIds.includes(gid)),label+' group hidden');await toggle.check();
        await (await reveal(page.locator(`[data-ifc-isolate-group="${group.expressID}"]`))).click();assert.deepEqual(await visible(page,id),sorted(group.elementIds),label+' group isolated');
        await (await reveal(page.locator(`[data-ifc-select="${globalId}"]`))).click();assert.equal(await page.evaluate(id=>__opsTest.loadedObjs[id].userData.ifcView.selected,id),globalId);
        const properties=await page.locator('#ifcProperties').innerText();assert.ok(properties.includes(globalId)&&properties.includes(product.name),label+' selected source identity');
        await page.locator('#ifcIsolateSelected').click();assert.deepEqual(await visible(page,id),[globalId],label+' element isolated');
      }
      await page.locator('#ifcShowAll').click();assert.deepEqual(await visible(page,id),expectedIds);
    });
    await check('Coverage inspection leaves operational data and external services unchanged',async()=>{assert.deepEqual(await state(page),before);assert.deepEqual(run.network.writes,[]);assert.deepEqual(run.network.errors,[]);});
  }catch(failure){error=failure;results.push({name:'Coverage failure',passed:false,error:failure.stack});console.error(failure);}
  finally{
    if(run)await run.close();await env.close();
    const report={commit:initialCommit,endCommit:git(['rev-parse','HEAD']),engine:env.engine,sourceSHA256:expectedHash,auditSHA256:auditHash,sourceHashes,inputsUnchanged:JSON.stringify(sourceHashes)===JSON.stringify(hashes()),sourceUnchanged:hash(source)===expectedHash&&hash(auditPath)===auditHash,operationalDataUnchanged:hash(path.join(root,'data.json'))===operationalHash,faceAudit:{sourceFaces:coverage.summary.sourceFaces,coveredFaces:coverage.summary.coveredFaces,omittedSourceFaces:coverage.summary.expectedOmittedFaceIDs.length,ambiguousFaces:coverage.summary.ambiguousFaceCount,unmatchedTriangles:coverage.summary.unmatchedTriangleCount,unambiguousAreaMismatches:coverage.summary.unambiguousAreaMismatches.length},products:actual?.products,diagnostics:actual?.metadata.diagnostics,results};
    fs.writeFileSync(path.join(output,'ifc-geometry-results.json'),JSON.stringify(report,null,2)+'\n');
    if(error||!report.inputsUnchanged||!report.sourceUnchanged||!report.operationalDataUnchanged||report.commit!==report.endCommit)process.exitCode=1;
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
