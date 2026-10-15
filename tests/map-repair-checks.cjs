const assert=require('node:assert/strict');
const {open,fixture}=require('./harness.cjs');
module.exports=async(env,check)=>{
 for(const location of ['root','legacy','missing']) await check(`Map repair: base GeoJSON ${location} path`,async()=>{
  const run=await open(env,{workArea:location}),p=run.page;
  try{
   if(location==='missing'){assert.equal(await p.locator('[data-lc-toggle="__repo__"]').count(),0);assert.match(await p.locator('#mapHint').innerText(),/No work-area GeoJSON/);}
   else{await p.waitForFunction(()=>__opsTest.geoLayer?.getLayers().length===4);assert.equal(await p.locator('[data-lc-toggle="__repo__"]').count(),1);assert.equal(await p.evaluate(()=>__opsTest.map.hasLayer(__opsTest.geoLayer)),true);}
   assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 });
 await check('Map repair: Fit includes visible markers/vectors and excludes hidden layers',async()=>{
  const data=fixture(),project=data.projects[0].id;
  data.markers=[{id:'fit-marker',lat:-25.9,lng:153.1,category:'note',project,vis:{site:true,client:true}}];
  const point=(id,lat,lng,visible)=>({id,name:id,visible,data:{type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[lng,lat]}}]}});
  data.mapLayers=[point('visible',-25.91,153.12,true),point('hidden',10,10,false)];
  const centers=[];
  for(const version of ['before','after']){
   const run=await open(env,{version,data,workArea:'missing'}),p=run.page;
   try{
    await p.evaluate(()=>__opsTest.map.setView([0,0],2,{animate:false}));await p.locator('#btnFit').click();await p.waitForTimeout(250);
    const result=await p.evaluate(()=>({center:__opsTest.map.getCenter(),zoom:__opsTest.map.getZoom(),marker:__opsTest.map.getBounds().contains([-25.9,153.1]),vector:__opsTest.map.getBounds().contains([-25.91,153.12]),hidden:__opsTest.map.getBounds().contains([10,10])}));
    centers.push({version,...result});
    if(version==='before'){assert.equal(result.center.lat,0);assert.equal(result.center.lng,0);}else{assert.ok(result.marker&&result.vector);assert.equal(result.hidden,false);assert.ok(result.zoom>2);}
    assert.deepEqual(run.network.errors,[]);
   }finally{await run.close();}
  }
  return centers;
 });
 await check('Map repair: no-feature Fit is a no-op; one marker and session GeoTIFF fit safely',async()=>{
  const data=fixture();data.markers=[];data.mapLayers=[];
  const run=await open(env,{data,workArea:'missing'}),p=run.page;
  try{
   await p.evaluate(()=>__opsTest.map.setView([0,0],2,{animate:false}));await p.locator('#btnFit').click();assert.equal(await p.evaluate(()=>__opsTest.map.getZoom()),2);
   await p.locator('#fileGeo').setInputFiles({name:'fit-raster.tif',mimeType:'image/tiff',buffer:require('./fixtures.cjs').geotiff()});
   await p.waitForFunction(()=>Object.keys(__opsTest.rasterLayers).length===1,null,{timeout:60000});
   await p.evaluate(()=>__opsTest.map.setView([0,0],2,{animate:false}));await p.locator('#btnFit').click();await p.waitForTimeout(200);
   assert.equal(await p.evaluate(()=>__opsTest.map.getBounds().contains(Object.values(__opsTest.rasterLayers)[0].layer.getBounds())),true);
   await p.locator('[data-lc-remove]').click();
   await p.locator('#btnAddMode').click();await p.locator('#map').click({position:{x:100,y:160}});await p.locator('#mkSave').click();
   await p.locator('#btnFit').click();assert.ok(await p.evaluate(()=>Number.isFinite(__opsTest.map.getZoom())));assert.deepEqual(run.network.errors,[]);
  }finally{await run.close();}
 });
};
