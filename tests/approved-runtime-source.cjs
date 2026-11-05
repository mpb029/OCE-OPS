// Test-only compatibility for explicitly accepted runtime revisions.
// Immutable commits + complete, unique literal hunks; no regex/wildcard code removal.
'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),cache=new Map();
const steps=[
 {file:'index.html',base:'26397eb53ab2947222e27df7a7a71224dca8f492',approved:'41011d4f8941566b28f3f5597eb3842fb7bc9287',
  markers:['planning-lookahead.js','publishedPlanningIdentity','clientLookaheadPrint']},
 {file:'index.html',base:'e4aec10d2ce5658c2ac2a2d8286a79da4bbf84c6',approved:'26397eb53ab2947222e27df7a7a71224dca8f492',
  markers:['OCESiteDiaryControl','OCEBoardIntegrity','modelShareModal']},
 {file:'ui-workspaces.js',base:'26397eb53ab2947222e27df7a7a71224dca8f492',approved:'41011d4f8941566b28f3f5597eb3842fb7bc9287',
  markers:["{id:'planning'","const planningPage = byId('planningModal')",'oce:workspace-navigate']}
].map(Object.freeze);
function hunks(step){
 if(cache.has(step))return cache.get(step);
 for(const ref of [step.base,step.approved])assert.match(ref,/^[a-f0-9]{40}$/);
 const diff=execFileSync('git',['diff','--no-ext-diff','--no-textconv','--no-renames','--diff-algorithm=myers','--no-indent-heuristic','--unified=10',step.base,step.approved,'--',step.file],{cwd:root,encoding:'utf8',maxBuffer:5e6,windowsHide:true});
 const result=[];let h=null;
 for(const line of diff.split('\n')){
  if(/^@@ /.test(line)){if(h)result.push(h);h={before:'',after:''};continue;}
  if(!h)continue;
  if(line.startsWith(' ')){h.before+=line.slice(1)+'\n';h.after+=line.slice(1)+'\n';}
  else if(line.startsWith('-'))h.before+=line.slice(1)+'\n';
  else if(line.startsWith('+'))h.after+=line.slice(1)+'\n';
  else assert.ok(line==='', 'Only complete text hunks with final newlines are supported');
 }
 if(h)result.push(h);
 assert.ok(result.length,'Approved revision must contain explicit source edits');
 result.forEach(h=>{assert.ok(h.before&&h.after,'Reversal requires complete surrounding context');Object.freeze(h);});
 cache.set(step,Object.freeze(result));return cache.get(step);
}
function reverse(step,source){
 source=source.replace(/\r\n/g,'\n');
 for(const [i,h]of hunks(step).entries()){
  assert.equal(source.split(h.after).length,2,step.file+' approved '+step.approved.slice(0,7)+' hunk '+i+' must match exactly once');
  source=source.replace(h.after,h.before);
 }
 return source;
}
function normalise(file,source){
 source=source.replace(/\r\n/g,'\n');
 for(const step of steps)if(step.file===file&&step.markers.some(marker=>source.includes(marker)))source=reverse(step,source);
 return source;
}
module.exports={normalise,reverse,hunks,steps};
