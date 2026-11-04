// Opt-in deterministic test transport. Real pinned libraries, never production URL changes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=body=>crypto.createHash('sha256').update(body).digest('hex');
function load(directory=path.join(__dirname,'vendor'),read=fs.readFileSync){
 const manifestBytes=read(path.join(directory,'manifest.json')),manifest=JSON.parse(manifestBytes),assets=new Map();
 const expected={leaflet:'1.9.4',proj4:'2.11.0',three:'0.128.0','@fortawesome/fontawesome-free':'6.5.2'};
 if(manifest.version!==1||!Array.isArray(manifest.assets))throw Error('Unsupported offline dependency manifest');
 for(const [name,version]of Object.entries(expected))if(!manifest.packages.some(p=>p.name===name&&p.version===version&&p.archive.startsWith('https://registry.npmjs.org/')&&p.integrity.startsWith('sha512-')))throw Error('Wrong offline dependency version: '+name);
 for(const asset of manifest.assets){const file=path.resolve(directory,asset.file);if(!file.startsWith(path.resolve(directory)+path.sep))throw Error('Unsafe offline dependency path');const body=read(file);if(sha(body)!==asset.sha256||body.length!==asset.bytes)throw Error('Offline dependency integrity failed: '+asset.file);for(const raw of asset.urls){const url=new URL(raw);if(url.protocol!=='https:')throw Error('Unsafe offline dependency URL');if(assets.has(url.href))throw Error('Duplicate offline dependency URL');assets.set(url.href,{body,contentType:asset.contentType,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});}}
 return {manifest,manifestSha256:sha(manifestBytes),assets};
}
function create({output,tile}){
 const data=load(),report={mode:'network-independent',manifestSha256:data.manifestSha256,harnessSha256:sha(fs.readFileSync(path.join(__dirname,'harness.cjs'))),routerSha256:sha(fs.readFileSync(__filename)),packages:data.manifest.packages,assetHashes:data.manifest.assets.map(a=>({file:a.file,sha256:a.sha256})),served:0,syntheticTiles:0,unexpected:[],contexts:0};
 function response(url){const asset=data.assets.get(url.href);if(asset){report.served++;return asset;}if(/(^|\.)(tile\.openstreetmap\.org|arcgisonline\.com)$/.test(url.hostname)){report.syntheticTiles++;return {body:tile,contentType:'image/png'};}return null;}
 function unexpected(url){const name=url.origin+url.pathname;if(!report.unexpected.includes(name))report.unexpected.push(name);}
 function finish(){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'offline-environment.json'),JSON.stringify(report,null,2));if(report.unexpected.length)throw Error('Offline test attempted unexpected external requests: '+report.unexpected.join(', '));}
 return {response,unexpected,finish,report};
}
module.exports={load,create};
