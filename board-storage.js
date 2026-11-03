/* WFC-002: browser-only journal. Web Locks serialize the IndexedDB + legacy mirror writes. */
window.OCEBoardStorage=function(identity,{storeKey='offaly_ops_v1',dirtyKey='offaly_ops_dirty'}={}){
  const key=JSON.stringify(identity), lock='oce-board:'+storeKey;let database;
  function open(){if(database)return database;database=new Promise((resolve,reject)=>{
    const req=indexedDB.open('oce-ops-integrity-v1',1);
    req.onupgradeneeded=()=>{const db=req.result;db.createObjectStore('boards',{keyPath:'key'});db.createObjectStore('recovery',{keyPath:'key'});};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(Error('Browser recovery storage could not be opened.'));req.onblocked=()=>reject(Error('Another tab is blocking browser recovery storage.'));
  });return database;}
  async function transaction(store,mode,fn){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode),os=tx.objectStore(store);let result;try{fn(os,v=>result=v);}catch(e){tx.abort();reject(e);return;}tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(Error('Browser recovery storage failed.'));tx.onabort=()=>reject(Error('Browser recovery storage was not committed.'));});}
  const read=()=>transaction('boards','readonly',(os,set)=>{const r=os.get(key);r.onsuccess=()=>set(r.result||null);});
  async function locked(fn){if(!navigator.locks?.request)throw Error('This browser cannot safely coordinate local tabs. Keep this tab open and export a backup.');return navigator.locks.request(lock,fn);}
  const mirror=()=>localStorage.getItem(storeKey);
  async function commit(value,expected,reviewedMirror){return locked(async()=>{
    const previous=await read(),raw=localStorage.getItem(storeKey),dirty=localStorage.getItem(dirtyKey);
    if((previous?.revision||0)!==expected){const err=Error('Another tab saved a newer draft.');err.code='TAB_CONFLICT';err.remote=previous;throw err;}
    if(reviewedMirror!==undefined&&raw!==reviewedMirror){const err=Error('The local copy changed during review. Review again.');err.code='TAB_CONFLICT';throw err;}
    if(previous&&raw!==JSON.stringify(previous.board)&&raw!==reviewedMirror){
      const err=Error('Another tab or older application changed the local board.');err.code='TAB_CONFLICT';err.remote=previous;err.external=raw;throw err;
    }
    const next={...structuredClone(value),key,revision:expected+1};
    // If either write fails, do not acknowledge a save. Retain the prior mirror and journal.
    try{
      localStorage.setItem(storeKey,JSON.stringify(next.board));
      next.dirty?localStorage.setItem(dirtyKey,'1'):localStorage.removeItem(dirtyKey);
      await transaction('boards','readwrite',(os)=>os.put(next));
    }catch(error){
      try{raw===null?localStorage.removeItem(storeKey):localStorage.setItem(storeKey,raw);dirty===null?localStorage.removeItem(dirtyKey):localStorage.setItem(dirtyKey,dirty);}catch(restore){/* Persistent warning + recovery branch; never claim successful rollback. */}
      throw Error('Local save failed. Keep this tab open and export the current draft.');
    }
    return next;
  });}
  async function fork(value,id){const record={...structuredClone(value),workspace:key,key:key+'|'+id,recoveryId:id};await transaction('recovery','readwrite',os=>os.put(record));return record;}
  async function recoveries(){return transaction('recovery','readonly',(os,set)=>{const r=os.getAll();r.onsuccess=()=>set(r.result.filter(x=>x.workspace===key));});}
  async function removeRecovery(id){return transaction('recovery','readwrite',os=>os.delete(key+'|'+id));}
  return {read,commit,fork,recoveries,removeRecovery,mirror,key};
};
