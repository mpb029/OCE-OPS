// Read-only inspection state belongs to the loaded model, never the operational board.
import {coordinationPresets} from './ifc-presets.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const display = value => value == null ? 'Not recorded' : typeof value === 'object' ? JSON.stringify(value) : String(value);
export function createIFCInspector({THREE, viewer, getModels}) {
  const card=document.getElementById('modelCard'), panel=document.createElement('section');
  panel.id='ifcPanel'; panel.hidden=true; panel.setAttribute('aria-label','IFC layers and properties');
  card.insertBefore(panel,document.getElementById('modelList'));
  const records=new Map(); let active=null, pointer=null;
  const $=id=>panel.querySelector('#'+id);
  const key=r=>'oce_ifc_views_v1:'+r.meta.contentHash;
  const camera=()=>({position:viewer.camera.position.toArray(),target:viewer.controls.target.toArray(),near:viewer.camera.near,far:viewer.camera.far});
  const validCamera=c=>c && ['position','target'].every(k=>Array.isArray(c[k])&&c[k].length===3&&c[k].every(Number.isFinite));
  function restoreCamera(c) {
    if(!validCamera(c))return;const cam=viewer.camera;cam.position.fromArray(c.position);viewer.controls.target.fromArray(c.target);
    if(Number.isFinite(c.near)&&Number.isFinite(c.far)&&c.near>0&&c.far>c.near){cam.near=c.near;cam.far=c.far;}
    else if(active){const box=bounds(active),extent=Math.max(box.getSize(new THREE.Vector3()).length(),1);cam.near=extent/10000;cam.far=Math.max(extent*100,cam.position.distanceTo(box.getCenter(new THREE.Vector3()))+extent*2);}
    cam.updateProjectionMatrix();viewer.controls.update();
  }
  function snapshot(r) { return {hidden:[...r.view.hidden],groundOpacity:r.view.groundOpacity,sectionEnabled:r.view.sectionEnabled,sectionHeight:r.view.sectionHeight,camera:camera()}; }
  function persist(r) {
    if(!r?.meta.contentHash)return;
    try { localStorage.setItem(key(r),JSON.stringify({...snapshot(r),presets:r.saved})); }
    catch { if(active===r && $('ifcMessage'))$('ifcMessage').textContent='View remains available this session; browser storage is unavailable.'; }
  }
  function bounds(r, ids=null) {
    const box=new THREE.Box3();r.object.updateMatrixWorld(true);
    r.object.traverse(part=>{if(part.geometry && (!ids || ids.has(part.userData.ifcGlobalId))) {
      if(!part.geometry.boundingBox)part.geometry.computeBoundingBox();
      box.union(part.geometry.boundingBox.clone().applyMatrix4(part.matrixWorld));
    }});return box;
  }
  function fit(r, ids) {
    const box=bounds(r,ids);if(box.isEmpty())return;
    viewer.resize();const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
    const extent=Math.max(size.x,size.y,size.z,.1),cam=viewer.camera;
    const direction=cam.position.clone().sub(viewer.controls.target).normalize();if(direction.length()<.1)direction.set(1,.7,1).normalize();
    cam.position.copy(center).add(direction);cam.lookAt(center);
    const inverse=cam.quaternion.clone().invert(),ty=Math.tan(THREE.MathUtils.degToRad(cam.fov/2)),tx=ty*cam.aspect;
    let distance=0;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]) {
      const v=new THREE.Vector3(x,y,z).sub(center).applyQuaternion(inverse);distance=Math.max(distance,v.z+Math.abs(v.x)/tx,v.z+Math.abs(v.y)/ty);
    }
    cam.near=extent/10000;cam.far=extent*100;cam.updateProjectionMatrix();
    cam.position.copy(center).addScaledVector(direction,Math.max(distance*1.15,extent*.1));viewer.controls.target.copy(center);viewer.controls.update();
  }
  function sectionLabel(r) {
    const cs=r.meta.coordinateSystem || {}, origin=cs.mapConversion?.orthogonalHeight;
    const upright=Math.abs(r.object.rotation.x)+Math.abs(r.object.rotation.y)+Math.abs(r.object.rotation.z)<1e-8;
    return cs.ahdVerified && upright && Number.isFinite(origin)
      ? `${(r.view.sectionHeight+origin).toFixed(3)} m AHD (recorded IFC datum)`
      : `${r.view.sectionHeight.toFixed(3)} m · local viewer height`;
  }
  function apply(r, save=true) {
    const v=r.view;r.plane.constant=v.sectionHeight;
    r.object.traverse(part=>{
      const id=part.userData.ifcGlobalId;if(!id)return;
      part.visible=!v.hidden.has(id);
      const element=r.byId.get(id),ground=element?.status==='EXISTING_GROUND';
      for(const material of [].concat(part.material || [])) {
        const base=material.userData.ifcBase;
        material.opacity=ground?v.groundOpacity:base.opacity;
        material.transparent=material.opacity<1; material.depthWrite=material.opacity>=1;
        const clipped=v.sectionEnabled;
        if(Boolean(material.clippingPlanes?.length)!==clipped) {material.clippingPlanes=clipped?[r.plane]:[];material.needsUpdate=true;}
        if(material.emissive)material.emissive.set(id===v.selected?0x236a94:0x000000);
        else if(material.color)material.color.copy(id===v.selected?r.highlight:base.color);
      }
    });
    if(v.selected && v.hidden.has(v.selected)){v.selected=null; apply(r,false);}
    if(active===r) update();if(save)persist(r);
  }
  function properties() {
    const r=active,e=r?.byId.get(r.view.selected);
    $('ifcIsolateSelected').disabled=!e;$('ifcFitSelected').disabled=!e;
    if(!e){$('ifcProperties').innerHTML='<p>Select an element in the model or layer list to inspect its recorded properties.</p>';return;}
    const pairs=[['IFC class',e.ifcClass],['GlobalId',e.globalId],['ExpressID',e.expressID],['Status',e.status],['Category',e.category],['Phase',e.phase],['Display',e.display]];
    const dl=rows=>'<dl>'+rows.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(display(v))}</dd>`).join('')+'</dl>';
    $('ifcProperties').innerHTML=`<h4>${esc(e.name || e.ifcClass)}</h4>${dl(pairs)}`+
      Object.entries(e.properties || {}).map(([name,values])=>`<details open><summary>${esc(name)}</summary>${dl(Object.entries(values))}</details>`).join('')+
      '<p class="ifc-note">Recorded IFC values. No missing engineering properties are inferred; this view does not certify design or setting-out.</p>';
  }
  function update() {
    const r=active;if(!r)return;
    const v=r.view;
    panel.querySelectorAll('[data-ifc-element]').forEach(c=>c.checked=!v.hidden.has(c.dataset.ifcElement));
    panel.querySelectorAll('[data-ifc-select]').forEach(b=>b.setAttribute('aria-pressed',String(v.selected===b.dataset.ifcSelect)));
    panel.querySelectorAll('[data-ifc-group]').forEach(c=>{const ids=r.groups.find(g=>String(g.expressID)===c.dataset.ifcGroup).elementIds;
      const count=ids.filter(id=>!v.hidden.has(id)).length;c.checked=count===ids.length;c.indeterminate=count>0&&count<ids.length;});
    $('ifcCount').textContent=`${r.meta.elements.length-v.hidden.size} / ${r.meta.elements.length} elements · ${r.meta.groups.length} groups`;
    $('ifcGroundOpacity').value=Math.round(v.groundOpacity*100);$('ifcGroundValue').textContent=Math.round(v.groundOpacity*100)+'%';
    const box=bounds(r);$('ifcSection').min=box.min.y;$('ifcSection').max=box.max.y;$('ifcSection').value=v.sectionHeight;
    $('ifcSectionEnabled').checked=v.sectionEnabled;$('ifcSection').disabled=!v.sectionEnabled;$('ifcSectionValue').textContent=sectionLabel(r);
    properties();
  }
  function select(r,id) { if(!r.byId.has(id))return;if(active!==r)activate(r);r.view.selected=id;apply(r,false); }
  function isolate(r,ids) { const keep=new Set(ids);r.view.hidden=new Set(r.meta.elements.filter(e=>!keep.has(e.globalId)).map(e=>e.globalId));apply(r);fit(r,keep);persist(r); }
  function usePreset(r,preset) {
    if(preset.globalIds)r.view.hidden=new Set(r.meta.elements.filter(e=>!preset.globalIds.includes(e.globalId)).map(e=>e.globalId));
    else r.view.hidden=new Set((preset.hidden || []).filter(id=>r.byId.has(id)));
    r.view.sectionEnabled=Boolean(preset.sectionEnabled);
    if(Number.isFinite(preset.sectionHeight))r.view.sectionHeight=preset.sectionHeight;
    if(Number.isFinite(preset.groundOpacity))r.view.groundOpacity=Math.min(1,Math.max(0,preset.groundOpacity));
    apply(r,false);
    if(validCamera(preset.camera))restoreCamera(preset.camera);else fit(r,new Set(r.meta.elements.filter(e=>!r.view.hidden.has(e.globalId)).map(e=>e.globalId)));
    persist(r);
  }
  function presetOptions(r) {
    $('ifcPreset').innerHTML='<option value="">Choose a view…</option>'+r.presets.concat(r.saved).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  }
  function activate(r) {
    active=r;panel.hidden=!r;card.classList.toggle('ifc-present',!!r);if(!r)return;
    const available=[...records.values()].filter(x=>x.object.parent===viewer.scene && getModels().some(m=>m.id===x.id&&m.visible));
    panel.innerHTML=`<div class="ifc-heading"><h3>IFC layers & inspection</h3></div>
      <label>Model <select id="ifcModel" aria-label="IFC model">${available.map(x=>`<option value="${esc(x.id)}" ${x===r?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
      <p id="ifcCount" class="ifc-note"></p><div class="ifc-tools"><button id="ifcShowAll">Show all / reset visibility</button><select id="ifcPreset" aria-label="Focused view"></select></div>
      <div class="ifc-tools"><input class="ifc-save" id="ifcViewName" aria-label="Saved view name" placeholder="Name this view" maxlength="80"><button id="ifcSaveView">Save view</button><button id="ifcDeleteView" title="Delete the selected browser-local saved view">Delete saved view</button></div>
      <p class="ifc-note" id="ifcMessage">Visibility and named views are saved in this browser for this exact IFC file. They are not published.</p>
      <label>Existing ground opacity <input id="ifcGroundOpacity" aria-label="Existing ground opacity" type="range" min="0" max="100" step="1"><output id="ifcGroundValue"></output></label>
      <div class="ifc-tools"><label><input id="ifcSectionEnabled" type="checkbox"> Horizontal section</label><button id="ifcSectionReset">Reset section</button></div>
      <label><input id="ifcSection" aria-label="Horizontal section height" type="range" step="0.01"><output id="ifcSectionValue"></output></label>
      <div class="ifc-layout"><div><input id="ifcSearch" type="search" aria-label="Search IFC layers" placeholder="Search groups, elements or GlobalId"><div class="ifc-tree" id="ifcTree"></div></div>
      <div class="ifc-detail"><div class="ifc-tools"><button id="ifcIsolateSelected">Isolate selected</button><button id="ifcFitSelected">Fit selected</button></div><div id="ifcProperties" aria-live="polite"></div></div></div>
      <div id="ifcWarnings" class="ifc-note"></div>`;
    $('ifcTree').innerHTML=r.groups.map(g=>`<details class="ifc-group" data-ifc-group-row="${esc(g.expressID)}"><summary>${esc(g.name)} (${g.elementIds.length})</summary><div class="ifc-group-controls"><label><input type="checkbox" data-ifc-group="${esc(g.expressID)}" aria-label="Show ${esc(g.name)}">Show group</label><button data-ifc-isolate-group="${esc(g.expressID)}">Isolate group</button></div>`+
      g.elementIds.map(id=>{const e=r.byId.get(id);return `<div class="ifc-element"><input type="checkbox" data-ifc-element="${esc(id)}" aria-label="Show ${esc(e.name)}"><button data-ifc-select="${esc(id)}" aria-pressed="false">${esc(e.name || e.ifcClass)}${e.rendered===false?' · Geometry unavailable':''}</button></div>`;}).join('')+'</details>').join('');
    const issues=r.meta.unsupported || [];
    const diagnostics=r.meta.diagnostics || {}, warnings=diagnostics.warnings || [];
    $('ifcWarnings').innerHTML=(issues.length?`<details class="ifc-warning"><summary>${issues.length} elements have unavailable or partial geometry</summary>${issues.map(e=>`<p>${esc(e.name || e.globalId || e.expressID)}: ${esc(e.reason || 'Unsupported representation')}</p>`).join('')}</details>`:'')+
      (warnings.length?`<details class="ifc-warning"><summary>${diagnostics.parserWarningCount || warnings.length} parser warnings · geometry may be incomplete</summary><p>Element coverage does not guarantee every face was triangulated.${diagnostics.parserWarningsTruncated?' First 20 parser messages shown.':''}</p>${warnings.map(w=>`<p>${esc(w)}</p>`).join('')}</details>`:'');
    $('ifcModel').onchange=()=>activate(records.get($('ifcModel').value));
    $('ifcShowAll').onclick=()=>{r.view.hidden.clear();apply(r);};
    $('ifcGroundOpacity').disabled=!r.meta.elements.some(e=>e.status==='EXISTING_GROUND');
    $('ifcGroundOpacity').oninput=()=>{r.view.groundOpacity=Number($('ifcGroundOpacity').value)/100;apply(r);};
    $('ifcSectionEnabled').onchange=()=>{r.view.sectionEnabled=$('ifcSectionEnabled').checked;apply(r);};
    $('ifcSection').oninput=()=>{r.view.sectionHeight=Number($('ifcSection').value);apply(r);};
    $('ifcSectionReset').onclick=()=>{r.view.sectionEnabled=false;r.view.sectionHeight=bounds(r).max.y;apply(r);};
    $('ifcIsolateSelected').onclick=()=>{if(r.view.selected)isolate(r,[r.view.selected]);};
    $('ifcFitSelected').onclick=()=>{if(r.view.selected){fit(r,new Set([r.view.selected]));persist(r);}};
    $('ifcSearch').oninput=()=>{
      const query=$('ifcSearch').value.trim().toLowerCase();
      panel.querySelectorAll('[data-ifc-group-row]').forEach(row=>{
        const g=r.groups.find(g=>String(g.expressID)===row.dataset.ifcGroupRow),groupMatch=g.name.toLowerCase().includes(query);let found=false;
        row.querySelectorAll('.ifc-element').forEach(el=>{const id=el.querySelector('[data-ifc-element]').dataset.ifcElement,e=r.byId.get(id);
          const match=groupMatch || [e.name,e.globalId,e.ifcClass,e.status,e.category].join(' ').toLowerCase().includes(query);el.hidden=!match;found ||= match;});
        row.hidden=!found;if(query&&found)row.open=true;
      });
    };
    panel.querySelectorAll('[data-ifc-element]').forEach(c=>c.onchange=()=>{c.checked?r.view.hidden.delete(c.dataset.ifcElement):r.view.hidden.add(c.dataset.ifcElement);apply(r);});
    panel.querySelectorAll('[data-ifc-select]').forEach(b=>b.onclick=()=>select(r,b.dataset.ifcSelect));
    panel.querySelectorAll('[data-ifc-group]').forEach(c=>c.onchange=()=>{r.groups.find(g=>String(g.expressID)===c.dataset.ifcGroup).elementIds.forEach(id=>c.checked?r.view.hidden.delete(id):r.view.hidden.add(id));apply(r);});
    panel.querySelectorAll('[data-ifc-isolate-group]').forEach(b=>b.onclick=()=>isolate(r,r.groups.find(g=>String(g.expressID)===b.dataset.ifcIsolateGroup).elementIds));
    presetOptions(r);$('ifcPreset').onchange=()=>{const p=r.presets.concat(r.saved).find(p=>p.id===$('ifcPreset').value);if(p)usePreset(r,p);};
    if(!r.meta.contentHash)$('ifcMessage').textContent='Views are session-only here. Use HTTPS or localhost for persistent, file-verified views.';
    $('ifcSaveView').onclick=()=>{const name=$('ifcViewName').value.trim();if(!name){$('ifcViewName').focus();return;}
      const old=r.saved.find(p=>p.name===name),id=old?.id || 'saved-'+Date.now().toString(36);
      if(!old&&r.saved.length>=50){$('ifcMessage').textContent='50 saved views reached. Delete a saved view or reuse its name.';return;}
      r.saved=r.saved.filter(p=>p.id!==id);r.saved.push({id,name,...snapshot(r)});presetOptions(r);$('ifcPreset').value=id;persist(r);};
    $('ifcDeleteView').onclick=()=>{const id=$('ifcPreset').value;if(!r.saved.some(p=>p.id===id))return;r.saved=r.saved.filter(p=>p.id!==id);presetOptions(r);persist(r);};
    update();viewer.resize();
  }
  function register(model,object) {
    const meta=object.userData.ifc,byId=new Map(meta.elements.map(e=>[e.globalId,e]));
    const assigned=new Set(meta.groups.flatMap(g=>g.elementIds)),ungrouped=meta.elements.filter(e=>!assigned.has(e.globalId));
    const groups=meta.groups.map(g=>({...g,elementIds:g.elementIds.filter(id=>byId.has(id))}));
    if(ungrouped.length)groups.push({expressID:'ungrouped',name:'Ungrouped IFC elements',elementIds:ungrouped.map(e=>e.globalId)});
    const r={id:model.id,name:model.name,object,meta,byId,groups,plane:new THREE.Plane(new THREE.Vector3(0,-1,0),0),highlight:new THREE.Color(0x42c4ff),saved:[]};
    const box=bounds(r);r.view={hidden:new Set(),selected:null,groundOpacity:1,sectionEnabled:false,sectionHeight:box.max.y};object.userData.ifcView=r.view;
    r.presets=[{id:'whole',name:'Whole model',hidden:[],groundOpacity:1,sectionEnabled:false},...coordinationPresets(meta)];
    try {const saved=JSON.parse(localStorage.getItem(key(r)) || 'null');if(saved){
      r.view.hidden=new Set((Array.isArray(saved.hidden)?saved.hidden:[]).filter(id=>byId.has(id)));
      if(Number.isFinite(saved.groundOpacity))r.view.groundOpacity=Math.min(1,Math.max(0,saved.groundOpacity));
      r.view.sectionEnabled=saved.sectionEnabled===true;if(Number.isFinite(saved.sectionHeight))r.view.sectionHeight=Math.min(box.max.y,Math.max(box.min.y,saved.sectionHeight));
      r.saved=Array.isArray(saved.presets)?saved.presets.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&Array.isArray(p.hidden)).slice(0,50):[];
      if(validCamera(saved.camera))r.initialCamera=saved.camera;
    }}catch{/* Bad/disabled browser storage cannot block model import. */}
    object.traverse(p=>{for(const m of [].concat(p.material || []))if(!m.userData.ifcBase)m.userData.ifcBase={opacity:m.opacity,color:m.color?.clone()};});
    viewer.renderer.localClippingEnabled=true;records.set(model.id,r);apply(r,false);
    object.userData.ifcDetach=()=>{if(records.get(model.id)===r){records.delete(model.id);sync();}};
  }
  function sync() {
    const allowed=new Set(getModels().filter(m=>m.visible).map(m=>m.id));
    const visible=[...records.values()].filter(r=>allowed.has(r.id)&&r.object.parent===viewer.scene);
    const r=visible.includes(active)?active:visible[0];
    if(!r){active=null;panel.hidden=true;panel.innerHTML='';card.classList.remove('ifc-present');viewer.resize();return;}
    if(active!==r || Array.from($('ifcModel')?.options || [],o=>o.value).join('|')!==visible.map(x=>x.id).join('|'))activate(r);else update();
    if(r.initialCamera){restoreCamera(r.initialCamera);r.initialCamera=null;return true;}
    return false;
  }
  const down=e=>{if(e.isPrimary && e.button===0)pointer={x:e.clientX,y:e.clientY};};
  const up=e=>{
    if(!pointer)return;const distance=Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y);pointer=null;if(distance>5)return;
    const rect=viewer.renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();
    ray.params.Line.threshold=.08;ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),viewer.camera);
    const objects=[],owners=new Map();records.forEach(r=>{if(r.object.parent!==viewer.scene)return;r.object.traverseVisible(p=>{if(p.geometry&&p.userData.ifcGlobalId&&[].concat(p.material || []).some(m=>m.visible&&m.opacity>0)){objects.push(p);owners.set(p,r);}});});
    const hit=ray.intersectObjects(objects,false).find(hit=>{const r=owners.get(hit.object);return !r.view.sectionEnabled || r.plane.distanceToPoint(hit.point)>=0;});
    if(hit)select(owners.get(hit.object),hit.object.userData.ifcGlobalId);
  };
  viewer.renderer.domElement.addEventListener('pointerdown',down);
  viewer.renderer.domElement.addEventListener('pointerup',up);
  viewer.renderer.domElement.addEventListener('pointercancel',()=>{pointer=null;});
  return {register,sync,remove(id){records.delete(id);sync();}};
}
