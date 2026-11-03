/* WFC-002: transport-independent publication/recovery controller. No credentials in its journal. */
(function(root,factory){const R=typeof module==='object'&&module.exports?require('./board-reconcile.js'):root.OCEReconcile;const api=factory(R);if(typeof module==='object'&&module.exports)module.exports=api;else root.OCEBoardIntegrity=api;})(globalThis,function(R){
  'use strict';
  function create(a){
    let base=null,sha=null,generation=0,revision=0,observed=R.copy(a.board()),diskBase=R.copy(a.board()),operation=null,pending=null,localConflict=false,remoteChanged=false,error='',savedGeneration=-1,busy=false,started=false,ready=false,saveFailed=false,queue=Promise.resolve(),recoveryCount=0;
    const writer=a.uid(),now=()=>a.now(),uid=()=>a.uid();
    const dirty=()=>!base||!R.sameBoard(a.board(),base);
    function status(){return {ready,generation,savedGeneration,dirty:dirty(),busy,localConflict,remoteChanged,error,saveFailed,pending:!!pending,missingBase:!base,operation:!!operation,recoveries:recoveryCount,sha,localSaved:savedGeneration===generation&&!saveFailed&&!localConflict};}
    const notify=()=>a.status(status());
    function envelope(board=a.board()){return {version:1,identity:a.identity(),board:R.copy(board),base:R.copy(base),sha,generation,dirty:!base||!R.sameBoard(board,base),operation:R.copy(operation),pending:R.copy(pending),writer,at:now()};}
    function assertIdentity(){if(!R.equal(a.identity(),a.initialIdentity))throw Error('Repository settings changed. Export the draft and reload before publishing to the new destination.');}
    async function preserveBranch(){try{await a.store.fork(envelope(),writer);recoveryCount=(await a.store.recoveries()).length;}catch(e){error='Local save failed — current changes are held in memory only. Export now.';}}
    function persist(){
      const work=async()=>{
        const captured=envelope(),capturedGeneration=generation;
        try{
          assertIdentity();
          if(localConflict){await preserveBranch();notify();return false;}
          const record=await a.store.commit(captured,revision);revision=record.revision;diskBase=R.copy(captured.board);savedGeneration=capturedGeneration;if(saveFailed)error='';saveFailed=false;notify();return true;
        }catch(e){
          if(e.code==='TAB_CONFLICT'){localConflict=true;error='Another tab changed this workspace. Review both drafts before replacing either.';}
          else {error=e.message||'Local save failed — export the current draft.';saveFailed=true;}
          await preserveBranch();notify();return false;
        }
      };
      queue=queue.then(work,work);return queue;
    }
    function withEvents(before,after,action,reference){
      const next=R.copy(after),extra=R.audit(before,next,{uid,now,revision:sha,generation:generation+1,label:a.label?.()||'',action,reference});
      const events=R.combineEvents(before?.changeEvents,next.changeEvents,extra);if(events.length||next.changeEvents!==undefined)next.changeEvents=events;
      return next;
    }
    function acceptCleanRemote(remote){
      const next=R.copy(remote.board),events=R.combineEvents(a.board().changeEvents,next.changeEvents);
      if(events.length||next.changeEvents!==undefined)next.changeEvents=events;
      // An older publisher may omit the optional log. Retain it as an unpublished
      // local difference, while the base remains the exact verified remote board.
      base=R.copy(remote.board);sha=remote.sha;a.setBoard(next,true);observed=R.copy(next);remoteChanged=false;
    }
    function changed(action){
      if(!started)return Promise.resolve(false);
      try{assertIdentity();const next=withEvents(observed,a.board(),action);generation++;if(next.changeEvents!==undefined)a.board().changeEvents=next.changeEvents;observed=R.copy(next);error='';notify();return persist();}
      catch(e){error=e.message;notify();return Promise.resolve(false);}
    }
    function replace(candidate,{action='restored',unbased=false,render=true,beforeBoard,draft=false}={}){
      const work=async()=>{
      assertIdentity();(draft&&a.validateDraft?a.validateDraft:a.validate)(candidate);
      if(localConflict){error='Review the other local draft before importing or replacing records.';notify();return false;}
      if(unbased&&busy)throw Error('Finish the publication before importing a backup.');
      const before={base,sha,generation,observed,operation,pending},next=withEvents(beforeBoard||a.board(),candidate,action);
      if(unbased){base=null;sha=null;operation=null;pending=null;}generation++;
      try{const record=await a.store.commit(envelope(next),revision);revision=record.revision;diskBase=R.copy(next);observed=R.copy(next);savedGeneration=generation;a.setBoard(next,render);saveFailed=false;error='';remoteChanged=false;notify();return true;}
      catch(e){({base,sha,generation,observed,operation,pending}=before);if(e.code==='TAB_CONFLICT')localConflict=true;else saveFailed=true;error=e.message;notify();return false;}
      };queue=queue.then(work,work);return queue;
    }
    async function start({localPresent=false,legacyDirty=false,loadError=''}={}){
      let stored;
      try{stored=await a.store.read();recoveryCount=(await a.store.recoveries()).length;
        if(stored){
          if(stored.version!==1||!R.equal(stored.identity,a.identity()))throw Error('Stored revision metadata is incompatible. Export the draft for recovery.');
          (a.validateDraft||a.validate)(stored.board);if(stored.base)a.validate(stored.base);
          if(!!stored.base!==!!stored.sha||!Number.isSafeInteger(stored.revision)||!Number.isSafeInteger(stored.generation))throw Error('Stored revision metadata needs recovery. The local copies have not been replaced.');
          base=R.copy(stored.base);sha=stored.sha;generation=stored.generation||0;revision=stored.revision;operation=R.copy(stored.operation);pending=R.copy(stored.pending);a.setBoard(R.copy(stored.board),false);diskBase=R.copy(stored.board);savedGeneration=generation;
          // A legacy tab can write the compatibility mirror without using our journal.
          if(a.legacyBoard&&a.legacyBoard()&&!R.equal(a.legacyBoard(),stored.board)){localConflict=true;error='The browser has another local board copy. Review it before saving.';await a.store.fork({...envelope(a.legacyBoard()),base:null,sha:null},uid());recoveryCount++;}
        }else if(loadError){error=loadError;localConflict=true;}
      }catch(e){error=e.message;localConflict=true;}
      observed=R.copy(a.board());started=true;notify();
      try{
        const remote=await a.remote();a.validate(remote.board);a.remoteAccess?.(remote.board);
        if(operation?.candidate&&R.sameBoard(remote.board,operation.candidate))await finish(operation,remote);
        else if(operation){operation=null;remoteChanged=true;error='Interrupted publication was not confirmed. Draft retained; fetch and review before publishing.';await persist();}
        else if(!localConflict&&!loadError&&(!localPresent&&!stored || (!base&&R.sameBoard(a.board(),remote.board)))){
          base=R.copy(remote.board);sha=remote.sha;a.setBoard(R.copy(remote.board),true);observed=R.copy(remote.board);await persist();
        }else if(base){
          if(remote.sha!==sha){remoteChanged=true;if(!dirty()&&!localConflict){acceptCleanRemote(remote);await persist();}}
        }else {remoteChanged=true;if(!stored&&localPresent&&!localConflict&&!loadError)await persist();}
      }catch(e){if(!error)error='Offline or authoritative revision unavailable. Local draft retained.';await a.offline?.(!!stored||localPresent);observed=R.copy(a.board());}
      ready=true;notify();return status();
    }
    async function poll(){if(busy||!started)return;try{assertIdentity();const remote=await a.remote();a.validate(remote.board);a.remoteAccess?.(remote.board);
      if(base&&remote.sha===sha)return;
      remoteChanged=true;
      if(base&&!dirty()&&!localConflict&&!pending&&!a.editing?.()){acceptCleanRemote(remote);await persist();}
      notify();
    }catch(e){/* Offline polling never clears a local draft or successful-save acknowledgement. */}}
    async function reviewPlan(b,l,r,kind,unknown=false){
      const initial=R.merge(b,l,r,{},unknown),choices=await a.review({...initial,kind,base:R.copy(b),local:R.copy(l),remote:R.copy(r)});
      if(choices===null)return null;
      const result=R.merge(b,l,r,choices,unknown);if(result.unresolved.length)throw Error('Every conflict needs an explicit resolution.');a.validate(result.board);return result.board;
    }
    async function reconcileTabs(recovery){
      await queue;let current=await a.store.read();
      if(!current){const remote=await a.remote();a.validate(remote.board);current={version:1,identity:a.identity(),board:remote.board,base:remote.board,sha:remote.sha,revision:0,generation:0};}
      if(!Number.isSafeInteger(current.revision))throw Error('Recovery journal revision is invalid. Export recovery copies before repairing browser storage.');
      const local=R.copy(recovery?.board||a.board()),atGeneration=generation;
      const mirror=a.store.mirror?.();let other=current.board,external=false;
      if(mirror!==undefined&&mirror!==JSON.stringify(current.board)){
        external=true;
        try{other=JSON.parse(mirror);(a.validateDraft||a.validate)(other);}catch{other=current.board;}
        // Preserve even an unreadable mirror verbatim before an explicitly reviewed replacement.
        await a.store.fork({...current,board:R.copy(other),rawMirror:mirror,base:null,sha:null,at:now()},uid());
      }
      // An older tab has no journal ancestry: require a choice for every difference.
      const combined=await reviewPlan(recovery||external?null:diskBase,local,other,'local',!!recovery||external);
      if(!combined)return false;if(atGeneration!==generation)throw Error('The draft changed during review. Review again.');
      a.validate(combined);const old={base,sha,generation,operation,pending};
      const trusted=current.version===1&&R.equal(current.identity,a.identity())&&current.base&&typeof current.sha==='string'&&current.sha;
      base=trusted?R.copy(current.base):null;sha=trusted?current.sha:null;generation=Math.max(generation,Number.isSafeInteger(current.generation)?current.generation:0)+1;operation=null;pending=null;
      const value=withEvents(local,combined,'restored',{kind:'local-reconciliation'});
      try{const stored=await a.store.commit(envelope(value),current.revision,mirror);revision=stored.revision;diskBase=R.copy(value);a.setBoard(value,true);observed=R.copy(value);savedGeneration=generation;localConflict=false;saveFailed=false;error='';if(recovery)await a.store.removeRecovery(recovery.recoveryId);notify();return true;}
      catch(e){({base,sha,generation,operation,pending}=old);throw e;}
    }
    async function finish(op,remote){
      await queue;
      base=R.copy(remote.board);sha=remote.sha;operation=null;remoteChanged=false;
      const current=R.copy(a.board());
      if(generation===op.generation&&R.sameBoard(current,op.snapshot)){
        a.setBoard(R.copy(remote.board),true);observed=R.copy(remote.board);pending=null;
      }else{
        const result=R.merge(op.snapshot,current,remote.board);
        if(result.unresolved.length){pending={base:R.copy(op.snapshot),remote:R.copy(remote.board),sha:remote.sha};error='Earlier snapshot published. Review conflicts with edits made while publishing.';}
        else{a.validate(result.board);a.setBoard(result.board,true);observed=R.copy(result.board);pending=null;}
      }
      const saved=await persist();if(saved&&pending)error='Earlier snapshot published. Review conflicts with newer local edits.';notify();return saved;
    }
    async function publish(){
      if(busy)return false;busy=true;error='';notify();
      try{
        assertIdentity();await queue;
        if(localConflict){await reconcileTabs();return false;}
        if(pending){const captured=generation,combined=await reviewPlan(pending.base,a.board(),pending.remote,'later-edits');if(!combined)return false;if(captured!==generation)throw Error('The draft changed during review. Review again.');a.setBoard(combined,true);observed=R.copy(combined);pending=null;generation++;await persist();return false;}
        const op={id:uid(),snapshot:R.copy(a.board()),generation,startedAt:now(),status:'checking'};operation=op;
        a.validate(op.snapshot);if(!await persist())return false;
        for(let attempt=0;attempt<3;attempt++){
          const remote=await a.remote();a.validate(remote.board);
          if(!base){
            const currentGeneration=generation,reviewed=await reviewPlan(null,op.snapshot,remote.board,'unbased',true);
            if(!reviewed){operation=null;await persist();return false;}
            if(currentGeneration!==generation)throw Error('The draft changed during review. Nothing was published; review again.');
            base=R.copy(remote.board);sha=remote.sha;operation=null;a.setBoard(withEvents(a.board(),reviewed,'restored',{operation:op.id,kind:'base-review'}),true);observed=R.copy(a.board());generation++;remoteChanged=false;await persist();notify();return false;
          }
          let candidate=R.copy(op.snapshot);
          if(remote.sha!==sha){remoteChanged=true;notify();candidate=await reviewPlan(base,op.snapshot,remote.board,'remote');if(!candidate){operation=null;await persist();return false;}}
          candidate=withEvents(op.snapshot,candidate,undefined,{operation:op.id,kind:'reconciliation'});candidate.publishedAt=now();a.validate(candidate);
          op.candidate=R.copy(candidate);op.expectedSha=remote.sha;op.status='uploading';operation=op;
          if(!await persist())return false;
          try{
            const uploaded=await a.put(R.copy(candidate),remote.sha);if(!uploaded.sha)throw Error('Publication response did not confirm a file revision. Refresh to verify; the draft is retained.');
            await finish(op,{board:candidate,sha:uploaded.sha});return true;
          }catch(e){if(e.status!==409)throw e;if(attempt===2)throw Error('Remote data kept changing. Nothing further was retried; draft retained.');op.status='checking';}
        }
      }catch(e){error=e.message||'Publish failed. Draft retained.';notify();return false;}
      finally{busy=false;notify();}
    }
    async function recover(id){if(busy)return false;busy=true;notify();try{const entries=await a.store.recoveries();const record=entries.find(r=>r.recoveryId===id);if(!record)throw Error('Recovery draft unavailable.');return await reconcileTabs(record);}catch(e){error=e.message;notify();return false;}finally{busy=false;notify();}}
    async function reviewLocal(){if(busy)return false;busy=true;notify();try{return await reconcileTabs();}catch(e){error=e.message;notify();return false;}finally{busy=false;notify();}}
    return {start,changed,replace,publish,poll,status,flush:()=>queue,retry:persist,reviewLocal,recover,recoveries:()=>a.store.recoveries(),external:()=>{localConflict=true;error='Another tab changed this workspace. Review drafts before saving.';notify();}};
  }
  return {create};
});
