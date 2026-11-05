// Negative controls for the accepted-revision adapter; historical assertions remain unchanged.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const A=require('./approved-runtime-source.cjs'),root=path.resolve(__dirname,'..');
const source=(ref,file)=>execFileSync('git',['show',ref+':'+file],{cwd:root,encoding:'utf8',maxBuffer:5e6,windowsHide:true}).replace(/\r\n/g,'\n');
test('Accepted revisions reverse complete exact hunks to immutable approved checkpoints',()=>{
 for(const step of A.steps)assert.equal(A.reverse(step,source(step.approved,step.file)),source(step.base,step.file));
 assert.equal(A.normalise('index.html',source('41011d4f8941566b28f3f5597eb3842fb7bc9287','index.html')),source('e4aec10d2ce5658c2ac2a2d8286a79da4bbf84c6','index.html'));
 assert.equal(A.normalise('index.html',source('26397eb53ab2947222e27df7a7a71224dca8f492','index.html')),source('e4aec10d2ce5658c2ac2a2d8286a79da4bbf84c6','index.html'));
 assert.equal(A.normalise('ui-workspaces.js',source('41011d4f8941566b28f3f5597eb3842fb7bc9287','ui-workspaces.js')),source('26397eb53ab2947222e27df7a7a71224dca8f492','ui-workspaces.js'));
});
test('Every accepted hunk rejects deletion, alteration and duplication',()=>{
 for(const step of A.steps){
  const current=source(step.approved,step.file);
  for(const [i,h]of A.hunks(step).entries()){
   const label=step.file+' '+step.approved.slice(0,7)+' hunk '+i;
   assert.throws(()=>A.reverse(step,current.replace(h.after,'')),undefined,label+' deleted');
   const at=h.after.search(/\S/);
   assert.throws(()=>A.reverse(step,current.replace(h.after,h.after.slice(0,at)+'~'+h.after.slice(at+1))),undefined,label+' altered');
   assert.throws(()=>A.reverse(step,current+h.after),undefined,label+' duplicated');
  }
 }
});
test('Unrelated edits remain visible; legacy samples and operational data are not rewritten',()=>{
 const added='\n// unrelated source edit\n';
 for(const step of A.steps)assert.equal(A.reverse(step,source(step.approved,step.file)+added),source(step.base,step.file)+added);
 const legacy=source('e4aec10d2ce5658c2ac2a2d8286a79da4bbf84c6','index.html');
 assert.equal(A.normalise('index.html',legacy),legacy);
 assert.equal(A.normalise('index.html','prefix\n  extension();\nsuffix\n'),'prefix\n  extension();\nsuffix\n');
 assert.equal(A.normalise('data.json','{"settings":"OCESiteDiaryControl"}'),'{"settings":"OCESiteDiaryControl"}');
});
