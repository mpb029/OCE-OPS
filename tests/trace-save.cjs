// Optional read-only interaction trace for isolated synthetic save/recovery diagnostics.
const fs=require('node:fs'),path=require('node:path');
module.exports=async function(context,page,file){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 page.on('console',message=>{const text=message.text();if(text.startsWith('OCE_SAVE_TRACE '))fs.appendFileSync(file,text.slice(15)+'\n');});
 await context.addInitScript(()=>{
  let sequence=0;
  function record(stage,event){if(sequence>2000)return;const test=window.__opsTest,button=document.getElementById('itemSave'),box=button?.getBoundingClientRect(),s=test?.integrityStatus;console.debug('OCE_SAVE_TRACE '+JSON.stringify({sequence:++sequence,time:performance.now(),stage,target:event?.target?.id||event?.target?.getAttribute?.('data-close')||'',focus:document.activeElement?.id,modal:!!document.querySelector('#itemModal.open'),field:document.getElementById('fWPConstraints')?.value,record:test?.state?.panels?.workPackages?.find(r=>r.id==='a')?.constraints,status:s?{generation:s.generation,savedGeneration:s.savedGeneration,localConflict:s.localConflict,localSaved:s.localSaved,error:s.error,busy:s.busy}:null,saveBox:box?{x:box.x,y:box.y,width:box.width,height:box.height}:null}));}
  for(const name of ['focusin','pointerdown','click'])addEventListener(name,event=>{if(event.target?.closest?.('#itemModal,#integrityReviewButton,#syncReviewModal')){record(name+' before',event);queueMicrotask(()=>record(name+' after',event));}},true);
  addEventListener('DOMContentLoaded',()=>{const pill=document.getElementById('syncPill');if(pill)new MutationObserver(()=>record('sync status')).observe(pill,{childList:true,subtree:true,characterData:true});});
 });
};
