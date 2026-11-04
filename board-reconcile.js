/* WFC-002: pure JSON reconciliation. Records are atomic; unknown values are retained. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OCEReconcile=api;})(globalThis,function(){
  'use strict';
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const copy=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
  const canonical=v=>v===undefined?'undefined':JSON.stringify(v,(_,x)=>object(x)?Object.keys(x).sort().reduce((o,k)=>(Object.defineProperty(o,k,{value:x[k],enumerable:true,configurable:true,writable:true}),o),{}):x);
  const equal=(a,b)=>canonical(a)===canonical(b);
  const content=board=>{const b=copy(board);if(b)delete b.publishedAt;return b;};
  const sameBoard=(a,b)=>equal(content(a),content(b));
  const ids=a=>Array.isArray(a)&&a.every(v=>object(v)&&typeof v.id==='string'&&v.id.trim())&&new Set(a.map(v=>v.id)).size===a.length;
  const recordArrays=new Set(['projects','clients','markers','stats','mapLayers','models','permits','constraints','weeklyCommitments']);
  const maps=new Set(['history','panelVis','panelMeta','projectSummary']);
  function merge(base,local,remote,choices={},unknownBase=false){
    const conflicts=[],changes=[],missing=undefined;
    function conflict(path,b,l,r,category){
      const key=JSON.stringify(path),choice=choices[key],record=l||r||b;
      const entry={key,path,category,base:copy(b),local:copy(l),remote:copy(r),recordId:record?.id||path.at(-1),project:record?.project||'',title:record?.main||record?.name||record?.title||path.join(' / '),choice:choice||''};
      conflicts.push(entry);
      return copy(choice==='local'?l:choice==='remote'?r:b);
    }
    function atom(b,l,r,path){
      if(equal(l,r))return copy(l);
      if(!unknownBase&&equal(l,b)){changes.push({path,side:'remote',action:r===undefined?'deleted':b===undefined?'added':'updated'});return copy(r);}
      if(!unknownBase&&equal(r,b)){changes.push({path,side:'local',action:l===undefined?'deleted':b===undefined?'added':'updated'});return copy(l);}
      return conflict(path,b,l,r,unknownBase?'Unknown common base':b===undefined?'Conflicting additions':l===undefined||r===undefined?'Deleted versus modified':'Both modified');
    }
    function records(b,l,r,path){
      if(!ids(l)||!ids(r)||(b!==undefined&&!ids(b)))return atom(b,l,r,path);
      const bm=new Map((b||[]).map(x=>[x.id,x])),lm=new Map(l.map(x=>[x.id,x])),rm=new Map(r.map(x=>[x.id,x]));
      const merged=new Map();
      for(const id of new Set([...bm.keys(),...lm.keys(),...rm.keys()])){const v=atom(bm.get(id),lm.get(id),rm.get(id),[...path,id]);if(v!==undefined)merged.set(id,v);}
      // Reordering is not inferred from additions/deletions. Conflicting relative order is explicit.
      const common=(b||[]).map(x=>x.id).filter(id=>lm.has(id)&&rm.has(id));
      const relative=a=>a.map(x=>x.id).filter(id=>common.includes(id));
      const bo=common,lo=relative(l),ro=relative(r);
      let order;
      if(equal(lo,ro))order=l.map(x=>x.id);
      else if(equal(lo,bo))order=r.map(x=>x.id);
      else if(equal(ro,bo))order=l.map(x=>x.id);
      else order=conflict([...path,'$order'],bo,lo,ro,'Conflicting order')||[];
      return [...new Set([...order,...r.map(x=>x.id),...l.map(x=>x.id),...merged.keys()])].filter(id=>merged.has(id)).map(id=>merged.get(id));
    }
    function events(b,l,r){
      if(!ids(l||[])||!ids(r||[])||!ids(b||[]))return atom(b,l,r,['changeEvents']);
      const result=new Map();
      for(const event of [...(b||[]),...(l||[]),...(r||[])]){
        const previous=result.get(event.id);
        if(previous&&!equal(previous,event))result.set(event.id,conflict(['changeEvents',event.id],previous,l?.find(x=>x.id===event.id),r?.find(x=>x.id===event.id),'Changed append-only event'));
        else result.set(event.id,copy(event));
      }
      return [...result.values()].filter(Boolean).sort((a,b)=>String(a.at).localeCompare(String(b.at))||a.id.localeCompare(b.id));
    }
    function map(b,l,r,path){
      if(!object(l)||!object(r)||(b!==undefined&&!object(b)))return atom(b,l,r,path);
      const out={};for(const key of new Set([...Object.keys(b||{}),...Object.keys(l),...Object.keys(r)])){
        const val=path.length===1&&path[0]==='panels'?records(b?.[key],l[key],r[key],[...path,key]):atom(b?.[key],l[key],r[key],[...path,key]);
        if(val!==undefined)Object.defineProperty(out,key,{value:val,enumerable:true,writable:true,configurable:true});
      }return out;
    }
    const out={};
    for(const key of new Set([...Object.keys(base||{}),...Object.keys(local||{}),...Object.keys(remote||{})])){
      let value;
      if(key==='publishedAt'){value=remote?.publishedAt;}
      else if(key==='changeEvents')value=events(base?.[key],local?.[key],remote?.[key]);
      else if(recordArrays.has(key))value=records(base?.[key],local?.[key],remote?.[key],[key]);
      else if(key==='panels'||maps.has(key))value=map(base?.[key],local?.[key],remote?.[key],[key]);
      else value=atom(base?.[key],local?.[key],remote?.[key],[key]);
      if(value!==missing)Object.defineProperty(out,key,{value,enumerable:true,writable:true,configurable:true});
    }
    return {board:out,conflicts,changes,unresolved:conflicts.filter(c=>!['local','remote'].includes(c.choice))};
  }
  function changedFields(before,after,prefix=''){
    const keys=new Set([...Object.keys(before||{}),...Object.keys(after||{})]),out=[];
    for(const k of keys){if(equal(before?.[k],after?.[k]))continue;const path=prefix+k;if(object(before?.[k])&&object(after?.[k]))out.push(...changedFields(before[k],after[k],path+'.'));else out.push(path);}
    return out.sort();
  }
  function audit(before,after,{uid,now,revision=null,generation=0,label='',action,reference}={}){
    const events=[];
    for(const [type,b,a] of [['workPackage',before?.panels?.workPackages||[],after?.panels?.workPackages||[]],['permit',before?.permits||[],after?.permits||[]]]){
      if(!ids(b)||!ids(a))throw Error('Cannot record history for ambiguous record IDs.');
      for(const id of new Set([...b.map(r=>r.id),...a.map(r=>r.id)])){
        const old=b.find(r=>r.id===id),next=a.find(r=>r.id===id);if(equal(old,next))continue;
        const restored=!old&&next&&(before?.changeEvents||[]).some(e=>e.recordId===id&&e.recordType===type&&e.action==='deleted');
        events.push({id:uid(),recordId:id,recordType:type,project:(next||old).project||'default',action:!next?'deleted':action==='restored'||restored?'restored':!old?'created':'updated',at:now(),fields:changedFields(old,next),revision,generation,...(label?{editorLabel:label}:{}),...(reference?{reference}: {})});
      }
    }return events;
  }
  function combineEvents(...lists){
    const out=new Map();for(const items of lists){if(!ids(items||[]))throw Error('Invalid change-event IDs.');for(const event of items||[]){if(out.has(event.id)&&!equal(out.get(event.id),event))throw Error('A change-event ID has conflicting contents.');out.set(event.id,copy(event));}}
    return [...out.values()].sort((a,b)=>String(a.at).localeCompare(String(b.at))||a.id.localeCompare(b.id));
  }
  function install(target,source){
    if(Array.isArray(target)&&Array.isArray(source)&&ids(target)&&ids(source)){
      const old=new Map(target.map(v=>[v.id,v]));target.splice(0,target.length,...source.map(v=>old.has(v.id)?install(old.get(v.id),v):copy(v)));return target;
    }
    if(object(target)&&object(source)){
      for(const k of Object.keys(target))if(!Object.hasOwn(source,k))delete target[k];
      for(const k of Object.keys(source))Object.defineProperty(target,k,{value:install(target[k],source[k]),enumerable:true,writable:true,configurable:true});return target;
    }
    return copy(source);
  }
  return {object,copy,canonical,equal,content,sameBoard,ids,merge,audit,combineEvents,changedFields,install};
});
