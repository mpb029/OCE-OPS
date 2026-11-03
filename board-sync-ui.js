/* WFC-002: small editor-only review UI and GitHub Contents transport. */
window.OCEBoardSyncUI=function(a){
  'use strict';
  const R=OCEReconcile,$=id=>document.getElementById(id),e=a.escape;let controller,last={},resolveReview=null,reviewing=false;
  const identity=()=>({owner:a.sync.owner,repo:a.sync.repo,branch:a.sync.branch,path:a.path});
  const initialIdentity=identity();
  const store=OCEBoardStorage(initialIdentity);
  function api(){const i=identity();if(!i.owner||!i.repo||!i.branch||!i.path)throw Error('Set repository owner, name, branch and data path before publishing.');return 'https://api.github.com/repos/'+encodeURIComponent(i.owner)+'/'+encodeURIComponent(i.repo);}
  function headers(){return {Accept:'application/vnd.github.object+json',...(a.token()?{Authorization:'Bearer '+a.token()}: {})};}
  const message=status=>status===401||status===403?'GitHub access was rejected. Check the connection in Settings.':status===404?'The selected repository, branch or data file is unavailable. No data was written.':'GitHub request failed (HTTP '+status+'). Draft retained.';
  async function response(url,options){let r;try{r=await fetch(url,{cache:'no-store',...options});}catch{throw Error('Network unavailable or publication response interrupted. Draft retained.');}if(!r.ok){const error=Error(message(r.status));error.status=r.status;throw error;}return r.json();}
  const decode=s=>new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(s.replace(/\s/g,'')),c=>c.charCodeAt(0)));
  async function remote(){
    const i=identity(),meta=await response(api()+'/contents/'+i.path.split('/').map(encodeURIComponent).join('/')+'?ref='+encodeURIComponent(i.branch),{headers:headers()});
    if(typeof meta.sha!=='string'||!meta.sha)throw Error('GitHub did not supply a file revision. Publication is blocked.');
    const data=meta.encoding==='base64'?meta:await response(api()+'/git/blobs/'+encodeURIComponent(meta.sha),{headers:headers()});
    if(data.encoding!=='base64'||typeof data.content!=='string'||(data.sha&&data.sha!==meta.sha))throw Error('Authoritative board content could not be verified.');
    let board;try{board=JSON.parse(decode(data.content));}catch{throw Error('The authoritative board is not valid JSON. Local draft retained.');}
    a.validate(board);return {sha:meta.sha,board:a.normalise(board)};
  }
  async function put(board,sha){
    if(!a.token())throw Error('Connect GitHub in Settings before publishing.');
    const bytes=new TextEncoder().encode(JSON.stringify(board,null,2));let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
    const i=identity(),result=await response(api()+'/contents/'+i.path.split('/').map(encodeURIComponent).join('/'),{method:'PUT',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({message:'Update site board — '+new Date().toLocaleString('en-AU'),content:btoa(binary),branch:i.branch,sha})});
    return {sha:result.content?.sha};
  }
  function title(s){if(s.localConflict)return 'Review conflicts — local recovery needed';if(s.saveFailed)return 'Local save failed';if(s.error)return 'Publish / revision check needs attention';if(s.busy)return 'Publishing';if(s.pending)return 'Review conflicts';if(s.remoteChanged)return 'Remote changes detected';if(s.savedGeneration!==s.generation)return 'Changes held in memory — saving locally';if(s.dirty)return 'Saved locally — unpublished';return 'Published';}
  function status(s){last=s;a.sync.dirty=s.dirty;a.sync.busy=s.busy;a.update();
    const editor=a.canReview(),pill=$('syncPill'),notice=$('integrityNotice');notice.hidden=!editor||(!s.error&&!s.localConflict&&!s.pending&&!s.remoteChanged&&!s.recoveries);
    if(editor){pill.style.display='inline-flex';pill.textContent=title(s);pill.className='sync-pill '+(s.error||s.localConflict?'connect':s.dirty?'dirty':'clean');pill.setAttribute('role','button');pill.tabIndex=0;pill.title='Review sync status and recovery';}
    else{pill.removeAttribute('role');pill.removeAttribute('tabindex');}
    $('integrityMessage').textContent=s.error||(s.pending?'A published snapshot and newer draft need review.':s.localConflict?'Another local draft is preserved for review.':s.recoveries?'Saved recovery drafts are available.':'The remote revision advanced. Publishing will require review.');
    $('integrityReviewButton').hidden=!editor;
    if(editor){const b=$('btnPublish');if(!s.busy&&a.token()&&(s.localConflict||s.pending||s.remoteChanged||s.missingBase))b.querySelector('span').textContent='Review & publish';}
  }
  function summary(v){if(v===undefined)return 'Deleted / absent';return R.object(v)?(v.main||v.name||v.title||v.id||'Metadata'):'Recorded value';}
  async function review(plan){
    if(!a.canReview())throw Error('Unlock the editor to review publication changes.');reviewing=true;
    $('syncReviewTitle').textContent=plan.kind==='local'?'Review local drafts':plan.kind==='later-edits'?'Review edits made during publishing':plan.kind==='unbased'?'Establish a reviewed common base':'Review remote changes';
    const choices={};$('syncReviewBody').innerHTML='<p>'+e(plan.kind==='unbased'?'A trusted editing base is missing. Every differing value needs your choice. The reviewed result will be saved as an unpublished draft; publish separately.':'Independent changes are combined by stable record ID. Conflicting records require your choice. Nothing is published until you confirm.')+'</p><p>'+plan.changes.length+' independent record / metadata changes; '+plan.conflicts.length+' conflicts.</p><div id="syncConflictList"></div><details><summary>Independent changes retained</summary><ul>'+plan.changes.map(x=>'<li>'+e(x.path.join(' / ')+' — '+x.side+' '+x.action)+'</li>').join('')+'</ul></details>';
    const container=$('syncConflictList');
    for(const c of plan.conflicts){const row=document.createElement('section');row.className='sync-conflict';const project=[...(plan.local.projects||[]),...(plan.remote.projects||[])].find(p=>p.id===c.project);
      row.innerHTML='<h3>'+e(c.title)+'</h3><p>'+e((project?.name||c.project||'Board configuration')+' · '+c.path.slice(0,-1).join(' / ')+' · '+c.recordId)+'</p><p>'+e(c.category)+'</p><div class="sync-versions"><div><strong>Local — '+e(summary(c.local))+'</strong><p>'+e(R.changedFields(c.base,c.local).join(', '))+'</p><details><summary>Local record</summary><pre></pre></details></div><div><strong>Remote — '+e(summary(c.remote))+'</strong><p>'+e(R.changedFields(c.base,c.remote).join(', '))+'</p><details><summary>Remote record</summary><pre></pre></details></div></div><label>Proposed resolution <select><option value="">Choose a version…</option><option value="local">Keep local version</option><option value="remote">Keep remote version</option></select></label>';
      const pre=row.querySelectorAll('pre');pre[0].textContent=c.local===undefined?'Absent / deleted':JSON.stringify(c.local,null,2);pre[1].textContent=c.remote===undefined?'Absent / deleted':JSON.stringify(c.remote,null,2);
      row.querySelector('select').onchange=event=>{choices[c.key]=event.target.value;$('syncConfirm').disabled=plan.conflicts.some(x=>!choices[x.key]);};container.append(row);
    }
    $('syncConfirm').textContent=['unbased','local','later-edits'].includes(plan.kind)?'Use reviewed draft (not published)':'Confirm merged publication';$('syncConfirm').disabled=plan.conflicts.length>0;$('syncConfirm').hidden=false;
    a.openModal('syncReviewModal');
    return new Promise(resolve=>{resolveReview=resolve;$('syncConfirm').onclick=()=>{resolveReview=null;reviewing=false;a.closeModal('syncReviewModal');resolve(choices);};});
  }
  async function show(){if(!a.canReview()||reviewing)return;
    $('syncReviewTitle').textContent='Sync & recovery';$('syncReviewBody').innerHTML='<p>'+e(title(last))+'</p><p>'+e(last.error||'The browser journal retains the draft, common base and interrupted publication snapshots. This is conflict-managed publishing, not real-time collaboration.')+'</p><button class="btn" id="syncRetry">Retry local save</button> <button class="btn" id="syncReviewLocal">Review local / remote changes</button><h3>Recovery drafts</h3><div id="syncRecoveryList"></div><details><summary>Recent Workface / Permit change events (self-declared, not a certified audit trail)</summary><ul>'+[...(a.board().changeEvents||[])].slice(-30).reverse().map(event=>'<li>'+e(event.at+' · '+event.recordType+' '+event.recordId+' · '+event.action+' · '+event.fields.join(', ')+(event.editorLabel?' · '+event.editorLabel+' (self-declared)':''))+'</li>').join('')+'</ul></details>';
    $('syncConfirm').hidden=true;$('syncRetry').onclick=()=>controller.retry();$('syncReviewLocal').onclick=()=>{a.closeModal('syncReviewModal');last.localConflict?controller.reviewLocal():controller.publish();};
    const exportCopies=document.createElement('button');exportCopies.className='btn';exportCopies.textContent='Export recovery copies';exportCopies.onclick=async()=>{
      const copies={version:1,identity:initialIdentity,currentDraft:R.copy(a.board())};
      try{copies.localBoardCopy=store.mirror();}catch{copies.localBoardCopyUnavailable=true;}
      try{copies.journal=await store.read();copies.recoveryDrafts=await store.recoveries();}catch{copies.journalUnavailable=true;}
      const url=URL.createObjectURL(new Blob([JSON.stringify(copies,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='oce-ops-recovery-copies.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };$('syncRecoveryList').append(exportCopies);
    try{for(const record of await controller.recoveries()){const row=document.createElement('p'),button=document.createElement('button');row.textContent='Saved '+record.at+' · unpublished recovery ';button.textContent='Review this draft';button.className='btn';button.onclick=()=>{a.closeModal('syncReviewModal');controller.recover(record.recoveryId);};row.append(button);$('syncRecoveryList').append(row);}}
    catch{const warning=document.createElement('p');warning.textContent='Recovery storage is unavailable. Export the current in-memory draft now.';$('syncRecoveryList').append(warning);}
    a.openModal('syncReviewModal');
  }
  controller=OCEBoardIntegrity.create({...a,store,initialIdentity,identity,remote,put,review,status,uid:()=>crypto.randomUUID(),now:()=>new Date().toISOString(),label:()=>{try{const l=localStorage.getItem('offaly_ops_editor_label')||'';return l&&l!==a.token()?l.slice(0,80):'';}catch{return '';}}});
  $('syncPill').addEventListener('click',show);$('syncPill').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();show();}});
  $('integrityExport').onclick=a.export;$('syncExport').onclick=a.export;$('integrityReviewButton').onclick=show;
  new MutationObserver(()=>{if(!$('syncReviewModal').classList.contains('open')&&resolveReview){const resolve=resolveReview;resolveReview=null;reviewing=false;resolve(null);}}).observe($('syncReviewModal'),{attributes:true,attributeFilter:['class']});
  addEventListener('storage',event=>{if(event.key===a.storeKey&&a.editorPage())controller.external();});
  // Storage events plus journal CAS are authoritative; notifications never overwrite a draft.
  addEventListener('beforeunload',event=>{const s=controller.status();if(a.editorPage()&&(s.busy||s.error||s.savedGeneration!==s.generation)){event.preventDefault();event.returnValue='';}});
  return {...controller,refresh:()=>status(controller.status()),show};
};
