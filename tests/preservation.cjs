const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
module.exports=function(root,output){
 const git=args=>execFileSync('git',args,{cwd:root,maxBuffer:10e6}).toString().trim();
 const ref=process.env.OCE_MAIN_REF||'origin/main';
 const assets=git(['ls-tree','-r','--name-only',ref]).split('\n').filter(p=>p==='data.json'||/^(files|aerial)\//.test(p)||/\.(obj|stl|glb|gltf|geojson|png|jpe?g|gif|webp|pdf|tiff?)$/i.test(p));
 assert.ok(assets.includes('data.json'));
 assert.equal(git(['diff','--name-only',ref,'--',...assets]),'','Latest main data or an attachment was modified');
 const sha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'data.json'),'utf8').replace(/\r\n/g,'\n')).digest('hex');
 const mainHash=crypto.createHash('sha256').update(execFileSync('git',['show',ref+':data.json'],{cwd:root})).digest('hex');
 assert.equal(sha256,mainHash);
 const evidence={mainCommit:git(['rev-parse',ref]),candidateCommit:git(['rev-parse','HEAD']),protectedFiles:assets.length,dataSHA256:sha256,unchanged:true,assets:git(['ls-tree','-r',ref,'--',...assets]).split('\n')};
 fs.writeFileSync(path.join(output,'preservation.json'),JSON.stringify(evidence,null,2));
 return {mainCommit:evidence.mainCommit,protectedFiles:assets.length,dataSHA256:sha256};
};
