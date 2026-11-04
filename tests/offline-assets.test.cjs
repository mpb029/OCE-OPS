const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load}=require('./offline-assets.cjs'),directory=path.join(__dirname,'vendor');
test('offline assets are real pinned packages with verified hashes and complete CSS/font/loader routes',()=>{
 const d=load();assert.deepEqual(d.manifest.packages.map(p=>p.name+'@'+p.version),['leaflet@1.9.4','proj4@2.11.0','three@0.128.0','@fortawesome/fontawesome-free@6.5.2']);
 for(const url of ['https://unpkg.com/leaflet@1.9.4/dist/leaflet.js','https://unpkg.com/leaflet@1.9.4/dist/leaflet.css','https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png','https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.11.0/proj4.js','https://unpkg.com/three@0.128.0/examples/js/loaders/GLTFLoader.js'])assert.ok(d.assets.has(url),url);
 assert.match(d.assets.get('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js').body.toString(),/version="1\.9\.4"/);
 assert.ok(d.manifest.assets.some(a=>a.file.endsWith('OrbitControls.js')));assert.ok(d.manifest.assets.filter(a=>a.file.includes('google-fonts/google-font-')).length>0);
});
test('a changed or missing Leaflet asset fails closed before any browser is launched',()=>{
 assert.throws(()=>load(directory,file=>{const body=fs.readFileSync(file);return file.endsWith(path.join('dist','leaflet.js'))?Buffer.concat([body,Buffer.from('changed')]):body;}),/integrity failed/);
 assert.throws(()=>load(directory,file=>{if(file.endsWith(path.join('dist','leaflet.js')))throw Error('Missing real Leaflet');return fs.readFileSync(file);}),/Missing real Leaflet/);
});
