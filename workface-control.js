/* WFC-001 UI. The adapter owns original state, saves, filtering, history and printing. */
window.OCEWorkfaceControl = function (a) {
  'use strict';
  const D=window.OCEWorkfaceData, e=a.escape, $=id=>document.getElementById(id);
  const copy=v=>structuredClone(v), list=D.list, records=v=>list(v).filter(D.object), state=()=>a.state();
  const canEdit=()=>a.editor() && !a.locked();
  const note='Planning readiness only — not regulatory, engineering or safety authorisation.';
  let formOriginal=null, permitDraft=null, permitOriginal=null, registerProject='';
  const select=(id,label,options,value)=>`<div class="field"><label for="${id}">${e(label)}</label><select id="${id}">${options.map(([v,t])=>`<option value="${e(v)}" ${v===value?'selected':''}>${e(t)}</option>`).join('')}</select></div>`;
  const input=(id,label,value='',type='text')=>`<div class="field"><label for="${id}">${e(label)}</label><input id="${id}" type="${type}" ${type==='number'?'min="0" step="any"':''} value="${e(value??'')}"></div>`;
  const area=(id,label,value='')=>`<div class="field"><label for="${id}">${e(label)}</label><textarea id="${id}" rows="2">${e(value)}</textarea></div>`;
  const check=(id,label,checked=false)=>`<label class="chkline"><input id="${id}" type="checkbox" ${checked?'checked':''}> ${e(label)}</label>`;
  const value=id=>$(id)?.value||'', checked=id=>!!$(id)?.checked, number=id=>value(id)===''?null:Number(value(id));
  const invalidInput=root=>[...root.querySelectorAll('input,select,textarea')].find(el=>!el.disabled&&!el.checkValidity());
  const optionRows=(rows,selected,label)=>{
    const options=rows.map(r=>[r.id,label(r)]);
    if(selected && !rows.some(r=>r.id===selected)) options.push([selected,'Unavailable reference — '+selected]);
    return [['','Select…'],...options];
  };
  const permits=()=>list(state().permits);
  const permitted=(p)=>!!p && a.projectInScope(p.project) && (a.editor() || p.vis?.[a.audience()]===true);
  function recordVisible(panel,r) { return !!r && a.recordVisible(panel,r); }
  function recordLink(panel,r) {
    if(!recordVisible(panel,r))return '';
    const routes={dailyWorks:'operations',upcoming:'operations',workPackages:'operations',trafficControl:'operations',deliveries:'resources',subbiesToday:'resources',staffAway:'resources',siteInputs:'resources',plantTransport:'resources',materialPickup:'resources',qualityTesting:'quality',punchlist:'quality',incidents:'quality',issuesDelays:'quality',designChanges:'coordination',variations:'coordination',rfis:'coordination',meetings:'coordination',stakeholders:'coordination',documents:'documents',weeklyPhotos:'documents'};
    const url=new URL(location.href);url.hash='activity-'+panel;url.searchParams.set('workspace',routes[panel]);url.searchParams.set('workspaceRecord',r.id);
    return `<a href="${e(url.href)}" data-ws-route="${routes[panel]}" data-ws-target="#activity-${panel}" data-ws-record="${e(r.id)}" data-wfc-record="${e(panel)}">${e(r.main||r.name||'Untitled record')}</a>`;
  }
  function safeReason(reason) {
    if(reason.permitId) {
      const p=D.lookup(permits(),reason.permitId);
      return permitted(p)?p.title+': '+reason.text:'An approval cannot be validated; details are unavailable in this view.';
    }
    if(reason.link) {
      const l=reason.link,r=D.lookup(state().panels?.[l.panel],l.id);
      return recordVisible(l.panel,r)?(r.main||r.name)+': '+reason.text:'A linked readiness task cannot be validated; details are unavailable in this view.';
    }
    return reason.text;
  }
  function assessment(w) {
    const result=D.evaluate(w,state());
    const reason=r=>r.permitId&&D.lookup(permits(),r.permitId)?.project!==D.project(w)?'A required approval is missing or belongs to a different project.':safeReason(r);
    return {...result,reasons:[...new Set(result.reasons.map(reason))],warnings:[...new Set(result.warnings.filter(r=>permitted(D.lookup(permits(),r.permitId))).map(reason))]};
  }
  const dl=fields=>`<dl class="wfc-meta">${fields.filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=>`<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join('')}</dl>`;
  function permitHtml(p,w,print=false) {
    if(!permitted(p))return '';
    const blocked=w?D.permitGate(p,w,state()):[], day=D.today();
    const flags=[];
    if(p.expiryDate && p.expiryDate<day)flags.push('Expired '+p.expiryDate);
    else if(p.expiryDate && D.date(p.expiryDate)&&D.days(day,p.expiryDate)<=14)flags.push('Expires within 14 days: '+p.expiryDate);
    if(p.effectiveDate && p.effectiveDate>day)flags.push('Not effective until '+p.effectiveDate);
    if(['submitted','review'].includes(p.status))flags.push('Awaiting response');
    if(records(p.conditions).some(c=>c.required&&!c.verified))flags.push('Outstanding conditions');
    const documentRecord=D.lookup(state().panels?.documents,p.document?.id);
    const doc=recordVisible('documents',documentRecord)?recordLink('documents',documentRecord):'';
    const linked=D.list(state().panels?.workPackages).filter(w=>w.workface?.permits?.ids?.includes(p.id)&&recordVisible('workPackages',w));
    return `<section class="wfc-permit"><h4>${e(p.title)} <span class="wfc-status">${e(D.statuses[p.status]||'Invalid status')}</span></h4>`+
      dl([['Type',p.type],['Reference',p.reference],['Authority / organisation',p.issuer],['Source requirement',p.source],['Responsible',p.responsible],['Description',p.description],['Location / activity',[p.location,p.activity].filter(Boolean).join(' · ')],['Chainage',p.chainageStart!=null||p.chainageEnd!=null?`${p.chainageStart??'—'} to ${p.chainageEnd??'—'} m`:''],['Restrictions',p.restrictions],['Working windows',p.workingWindows],['Submitted',p.submittedDate],['Approved',p.approvalDate],['Effective',p.effectiveDate],['Expiry',p.expiryDate],['Correspondence',p.correspondence],['Verification responsibility',p.reviewer],['Notes / outstanding actions',p.notes]])+
      (p.status==='not-required'?dl([['Not required — assessment',p.assessment?.source],['Reviewer',p.assessment?.reviewer],['Assessed',p.assessment?.date]]):'')+
      (flags.length?`<p class="wfc-warning">${flags.map(e).join(' · ')}</p>`:'')+
      (blocked.length?`<ul class="wfc-blockers">${blocked.map(t=>`<li>${e(t)}</li>`).join('')}</ul>`:'')+
      `<ul class="wfc-conditions">${records(p.conditions).map(c=>`<li>${e(c.text)} — ${c.required?'Required':'Advisory'} · ${c.verified?'Verified':'Not verified'}${c.evidence?' · Evidence: '+e(c.evidence):''}${c.reviewer?' · '+e(c.reviewer):''}${c.date?' · '+e(c.date):''}${c.due?' · Required '+e(c.due):''}</li>`).join('')}</ul>`+
      (doc?`<p>Approval document: ${doc}</p>`:'')+
      (linked.length?`<p>Associated permitted workfaces: ${linked.map(r=>recordLink('workPackages',r)).join(', ')}</p>`:'')+
      (!print&&canEdit()?`<button class="btn" data-wfc-edit-permit="${e(p.id)}">Edit approval</button>`:'')+'</section>';
  }
  function detailHtml(w,print=false) {
    const f=w.workface;if(!D.object(f))return '<p>Workface / permit assessment: Not assessed. Legacy materials and prerequisites only.</p>';
    const r=assessment(w), p=f.permits;
    let html=dl([['Workface ID',w.id],['Description / scope',f.description],['Location / work area',f.location],['Chainage',f.chainageStart!=null||f.chainageEnd!=null?`${f.chainageStart??'—'} to ${f.chainageEnd??'—'} m`:''],['Activity / discipline',f.activity],['Asset / infrastructure',f.asset],['Planned start',f.plannedStart],['Planned completion',f.plannedEnd],['Responsible person',f.responsible]])+
      `<p class="wfc-disclaimer">${note}</p><h4>Permits & approvals — ${e({'unassessed':'Not assessed',required:'Required','not-required':'Assessed as not required'}[p?.assessment]||'Invalid assessment')}</h4>`;
    if(p?.assessment==='not-required') html+=dl([['Assessment source / rationale',p.source],['Reviewer',p.reviewer],['Assessment date',p.date]]);
    html+=r.permits.filter(x=>permitted(x.record)&&x.record.project===D.project(w)).map(x=>permitHtml(x.record,w,print)).join('');
    if(r.reasons.length)html+=`<ul class="wfc-blockers">${r.reasons.map(x=>`<li>${e(x)}</li>`).join('')}</ul>`;
    if(r.warnings.length)html+=`<p class="wfc-warning">${r.warnings.map(e).join(' · ')}</p>`;
    html+='<h4>Linked construction records / completion evidence</h4>';
    for(const [key,[label]] of Object.entries(D.categories)) {
      const links=records(f.links).filter(l=>l.category===key).map(l=>({l,r:D.lookup(state().panels?.[l.panel],l.id)}));
      const shown=links.filter(({l,r})=>recordVisible(l.panel,r)&&D.project(r)===D.project(w));
      const invalid=links.some(({r})=>!r||D.project(r)!==D.project(w));
      if(!shown.length&&!canEdit())continue;
      const content=shown.map(({l,r})=>`<li>${recordLink(l.panel,r)} <span class="wfc-status">${e(r.wstatus||r.status||(r.done?'Completed':'No completion recorded'))}</span>${l.completionRequired?' · Completion required':''}${r.dateRequired||r.due?' · Required '+e(r.dateRequired||r.due):''}${r.team?' · '+e(r.team):''}</li>`).join('');
      html+=print?`<h4>${e(label)} (${shown.length})</h4><ul>${content}</ul>`:`<details class="wfc-links"><summary>${e(label)} · ${shown.length} visible link${shown.length===1?'':'s'}</summary><ul>${content||'<li>No visible records linked.</li>'}</ul>${invalid?'<p>Unavailable or cross-project reference. Edit to resolve.</p>':''}</details>`;
    }
    if(records(f.checks).length)html+='<h4>Explicit readiness checks / outstanding actions</h4><ul>'+records(f.checks).map(c=>`<li>${e(c.title)} — ${c.satisfied?'Satisfied':'Outstanding'}${c.responsible?' · '+e(c.responsible):''}${c.due?' · Required '+e(c.due):''}${c.evidence?' · Evidence: '+e(c.evidence):''}</li>`).join('')+'</ul>';
    return html;
  }
  function rowHtml(w) {
    return `<details class="wfc-detail"><summary>Workface Control${w.workface?'':' · Not assessed'}</summary>${detailHtml(w)}${canEdit()?`<button class="btn" data-wfc-open-register="${e(D.project(w))}">Permits & approvals</button>`:''}</details>`;
  }
  function panelHtml(items) {
    const configured=items.filter(w=>w.workface), blocked=configured.filter(w=>assessment(w).reasons.length), expiry=configured.filter(w=>assessment(w).warnings.length);
    return `<div class="wfc-panel-summary"><strong>Workface Control</strong><span>${configured.length} configured · ${blocked.length} with approval / control blockers${expiry.length?' · '+expiry.length+' with upcoming expiry':''}</span><button class="btn" data-wfc-open-register="">Permits & approvals</button></div>`;
  }
  function plannedHtml() {
    const rows=list(state().panels?.workPackages).filter(w=>recordVisible('workPackages',w)&&w.workface&&(assessment(w).reasons.length||assessment(w).warnings.length));
    if(!rows.length)return '';
    return '<details class="wfc-panel-summary"><summary>Workface approval lookahead · '+rows.length+'</summary><ul>'+rows.map(w=>'<li>'+recordLink('workPackages',w)+(w.workface.plannedStart?' · planned '+e(w.workface.plannedStart):'')+(assessment(w).reasons.length?' · Approval / control blockers':'')+' '+assessment(w).warnings.map(e).join(' · ')+'</li>').join('')+'</ul></details>';
  }
  function blankWorkface() {return {version:1,description:'',location:'',chainageStart:null,chainageEnd:null,activity:'',asset:'',responsible:'',plannedStart:'',plannedEnd:'',links:[],permits:{assessment:'unassessed',ids:[],source:'',reviewer:'',date:''},checks:[]};}
  function formOpen(w) {
    formOriginal=w.workface===undefined?null:copy(w.workface);
    const f=D.object(formOriginal)?formOriginal:blankWorkface(), box=$('wfcFields');
    box.innerHTML=check('wfcEnabled','Configure integrated Workface Control',w.workface!==undefined)+
      '<p class="wp-help">Existing materials, prerequisites, progress, team, status and attachments stay in this form. Free-text constraints remain notes; add explicit checks below to block readiness.</p>'+
      `<div id="wfcFormBody">${area('wfcDescription','Description / scope',f.description)}<div class="wfc-grid">${input('wfcLocation','Location / street / work area',f.location)}${input('wfcActivity','Activity / discipline',f.activity)}${input('wfcChainageStart','Start chainage (m)',f.chainageStart,'number')}${input('wfcChainageEnd','End chainage (m)',f.chainageEnd,'number')}${input('wfcAsset','Asset / infrastructure ID',f.asset)}${input('wfcResponsible','Responsible person',f.responsible)}${input('wfcStart','Planned start',f.plannedStart,'date')}${input('wfcEnd','Planned completion',f.plannedEnd,'date')}</div>`+
      select('wfcApplicability','Permit / approval applicability',[['unassessed','Not assessed'],['required','Required'],['not-required','Assessed as not required']],f.permits?.assessment)+
      `<div id="wfcAssessment">${area('wfcAssessmentSource','Assessment source / rationale',f.permits?.source)}<div class="wfc-grid">${input('wfcAssessmentReviewer','Assessment reviewer',f.permits?.reviewer)}${input('wfcAssessmentDate','Assessment date',f.permits?.date,'date')}</div></div><div id="wfcPermitChoices"></div>`+
      '<p class="wp-help">Save this workface before creating an approval in the shared register. Approval coverage needs explicit verification for each workface.</p>'+
      '<details><summary>Linked project records</summary><div id="wfcLinks"></div><button type="button" class="btn" id="wfcAddLink">Link record</button></details>'+
      '<details><summary>Readiness checks / outstanding actions</summary><div id="wfcChecks"></div><button type="button" class="btn" id="wfcAddCheck">Add readiness check</button></details></div>';
    $('wfcEnabled').disabled=w.workface!==undefined;
    const refresh=()=>{$('wfcFormBody').hidden=!checked('wfcEnabled');$('wfcAssessment').hidden=value('wfcApplicability')!=='not-required';$('wfcPermitChoices').hidden=value('wfcApplicability')!=='required';};
    $('wfcEnabled').onchange=refresh;$('wfcApplicability').onchange=refresh;refresh();
    renderPermitChoices(list(f.permits?.ids));
    records(f.links).forEach(addLink);records(f.checks).forEach(addCheck);
    $('wfcAddLink').onclick=()=>addLink({category:'documents',panel:'documents',id:'',completionRequired:false});
    $('wfcAddCheck').onclick=()=>addCheck({id:a.uid(),title:'',responsible:'',due:'',satisfied:false,evidence:''});
  }
  function renderPermitChoices(ids) {
    const available=permits().filter(p=>p.project===value('fProject'));
    const rows=available.map(p=>[p.id,p.title+' · '+(D.statuses[p.status]||'Invalid')]);
    for(const id of ids)if(!available.some(p=>p.id===id))rows.push([id,'Unavailable reference — '+id]);
    $('wfcPermitChoices').innerHTML='<fieldset><legend>Required approvals</legend>'+rows.map(([id,title])=>`<label class="chkline"><input type="checkbox" data-wfc-permit="${e(id)}" ${ids.includes(id)?'checked':''}> ${e(title)}</label>`).join('')+(!rows.length?'<p>No approvals in this project yet.</p>':'')+'</fieldset>';
  }
  function addLink(l) {
    const row=document.createElement('div');row.className='wfc-link-edit';row._value=copy(l);
    const id=a.uid();row.innerHTML=select(id+'cat','Category',Object.entries(D.categories).map(([k,[v]])=>[k,v]),l.category)+select(id+'panel','Existing panel',[],l.panel)+select(id+'record','Existing record',[],l.id)+check(id+'required','Require explicit task completion',l.completionRequired)+'<button type="button" class="btn" data-remove>Remove link</button>';
    $('wfcLinks').append(row);
    const fillRecords=(selected)=>{
      const panel=value(id+'panel'),rows=list(state().panels?.[panel]).filter(r=>D.project(r)===value('fProject'));
      $(id+'record').innerHTML=optionRows(rows,selected,r=>(r.main||r.name)+(D.complete(r)?' · Completed':'')).map(([v,t])=>`<option value="${e(v)}">${e(t)}</option>`).join('');$(id+'record').value=selected||'';
      $(id+'required').disabled=['documents','weeklyPhotos'].includes(panel);if($(id+'required').disabled)$(id+'required').checked=false;
    };
    const fillPanels=(selected,record)=>{$(id+'panel').innerHTML=(D.categories[value(id+'cat')]?.[1]||[]).map(p=>`<option value="${e(p)}">${e(a.panelTitle(p))}</option>`).join('');if(selected)$(id+'panel').value=selected;fillRecords(record);};
    fillPanels(l.panel,l.id);
    $(id+'cat').onchange=()=>fillPanels();$(id+'panel').onchange=()=>fillRecords();
    row.querySelector('[data-remove]').onclick=()=>row.remove();
    row.read=()=>({...row._value,category:value(id+'cat'),panel:value(id+'panel'),id:value(id+'record'),completionRequired:checked(id+'required')});
    row.refresh=()=>fillRecords(value(id+'record'));
  }
  function addCheck(c) {
    const row=document.createElement('div');row.className='wfc-check-edit';const id=a.uid();
    row.innerHTML=input(id+'title','Readiness check / action',c.title)+`<div class="wfc-grid">${input(id+'owner','Responsible',c.responsible)}${input(id+'due','Required completion date',c.due,'date')}</div>`+check(id+'ok','Satisfied',c.satisfied)+area(id+'evidence','Satisfaction evidence',c.evidence)+'<button type="button" class="btn" data-remove>Remove check</button>';
    $('wfcChecks').append(row);row.querySelector('[data-remove]').onclick=()=>row.remove();
    row.read=()=>({...c,title:value(id+'title'),responsible:value(id+'owner'),due:value(id+'due'),satisfied:checked(id+'ok'),evidence:value(id+'evidence')});
  }
  function formProjectChanged() {
    renderPermitChoices([...document.querySelectorAll('[data-wfc-permit]:checked')].map(el=>el.dataset.wfcPermit));
    document.querySelectorAll('.wfc-link-edit').forEach(row=>row.refresh());
  }
  function formRead(existing) {
    if(!checked('wfcEnabled')&&existing?.workface===undefined)return undefined;
    const f={...(D.object(formOriginal)?copy(formOriginal):blankWorkface()),version:1};
    Object.assign(f,{description:value('wfcDescription'),location:value('wfcLocation'),activity:value('wfcActivity'),asset:value('wfcAsset'),responsible:value('wfcResponsible'),chainageStart:number('wfcChainageStart'),chainageEnd:number('wfcChainageEnd'),plannedStart:value('wfcStart'),plannedEnd:value('wfcEnd'),links:[...document.querySelectorAll('.wfc-link-edit')].map(r=>r.read()),checks:[...document.querySelectorAll('.wfc-check-edit')].map(r=>r.read())});
    f.permits={...f.permits,assessment:value('wfcApplicability'),source:value('wfcAssessmentSource'),reviewer:value('wfcAssessmentReviewer'),date:value('wfcAssessmentDate'),ids:value('wfcApplicability')==='required'?[...document.querySelectorAll('[data-wfc-permit]:checked')].map(el=>el.dataset.wfcPermit):[]};
    return f;
  }
  function formErrors() {
    if(!checked('wfcEnabled'))return [];
    const invalid=invalidInput($('wfcFields'));
    if(invalid){invalid.reportValidity();return ['Correct the invalid workface date or numeric field before saving.'];}
    if(formOriginal && (!D.object(formOriginal)||formOriginal.version!==1||!Array.isArray(formOriginal.links)||!Array.isArray(formOriginal.checks)||!D.object(formOriginal.permits)||formOriginal.links.some(l=>!D.object(l))||formOriginal.checks.some(c=>!D.object(c))))return ['The stored workface structure is malformed or from an unsupported version. Export a backup for repair; this form has not overwritten it.'];
    return [];
  }
  function openRegister(projectId) {
    if(a.locked() || !a.panelVisible('workPackages'))return;
    registerProject=projectId||a.currentProject();
    $('wfcRegisterBody').innerHTML=select('wfcRegisterProject','Project',[['all','All permitted projects'],...a.projects().map(p=>[p.id,p.name])],registerProject)+'<p class="wp-help">Categories are selectable, not automatically required. Visibility filters are not access control. Files in a public repository remain public.</p><div id="wfcRegisterList"></div>';
    $('wfcRegisterProject').onchange=()=>{registerProject=value('wfcRegisterProject');renderRegister();};
    $('wfcNewPermit').hidden=!canEdit();renderRegister();a.openModal('wfcRegisterModal');
  }
  function renderRegister() {
    const rows=permits().filter(p=>permitted(p)&&(registerProject==='all'||p.project===registerProject));
    $('wfcRegisterList').innerHTML=rows.map(p=>permitHtml(p,null)).join('')||'<p>No visible approvals in this project.</p>';
  }
  function blankPermit() {return {id:a.uid(),project:registerProject!=='all'?registerProject:(a.projects()[0]?.id||''),title:'',type:D.types[0],status:'not-started',vis:{site:false,client:false},conditions:[],coverage:[]};}
  function openPermit(id) {
    if(!canEdit())return;
    const saved=id?D.lookup(permits(),id):null;if(id&&!saved)return;
    permitDraft=copy(saved||blankPermit());permitOriginal=saved?JSON.stringify(saved):null;const p=permitDraft;
    a.closeModal('wfcRegisterModal');$('wfcPermitTitle').textContent=(saved?'Edit':'New')+' permit / approval';
    $('wfcPermitBody').innerHTML='<p class="wfc-disclaimer">Record project evidence. This register does not grant approval or determine legal requirements.</p><fieldset><legend>Identification</legend>'+
      select('paProject','Project',a.projects().map(p=>[p.id,p.name]),p.project)+select('paType','Type',D.types.map(t=>[t,t]),p.type)+input('paTitle','Title (required)',p.title)+area('paDescription','Description',p.description)+input('paIssuer','Issuing authority / organisation',p.issuer)+input('paReference','Approval / reference number',p.reference)+area('paSource','Source requirement / document reference',p.source)+input('paResponsible','Responsible person',p.responsible)+'</fieldset>'+
      '<fieldset><legend>Scope & restrictions</legend>'+input('paLocation','Applicable location / work area',p.location)+`<div class="wfc-grid">${input('paChainageStart','Coverage start chainage (m)',p.chainageStart,'number')}${input('paChainageEnd','Coverage end chainage (m)',p.chainageEnd,'number')}</div>`+input('paActivity','Construction activity',p.activity)+area('paRestrictions','Geographical / activity restrictions',p.restrictions)+area('paWindows','Permitted working windows (recorded wording)',p.workingWindows)+'</fieldset>'+
      '<fieldset><legend>Status & dates</legend>'+select('paStatus','Approval status',Object.entries(D.statuses),p.status)+`<div class="wfc-grid">${input('paSubmitted','Application / submission date',p.submittedDate,'date')}${input('paApproved','Approval date',p.approvalDate,'date')}${input('paEffective','Effective start date',p.effectiveDate,'date')}${input('paExpiry','Expiry date (blank if none recorded)',p.expiryDate,'date')}</div>`+area('paAssessment','Not required — assessment source / rationale',p.assessment?.source)+input('paAssessmentReviewer','Not required — reviewer',p.assessment?.reviewer)+input('paAssessmentDate','Not required — assessment date',p.assessment?.date,'date')+'</fieldset>'+
      '<fieldset><legend>Conditions & evidence</legend><div id="paConditions"></div><button type="button" class="btn" id="paAddCondition">Add condition</button>'+select('paDocument','Linked approval document',optionRows(list(state().panels?.documents).filter(r=>D.project(r)===p.project),p.document?.id,r=>r.name),p.document?.id||'')+input('paCorrespondence','Correspondence reference',p.correspondence)+input('paReviewer','Review / verification responsibility',p.reviewer)+area('paNotes','Notes / outstanding actions',p.notes)+'</fieldset>'+
      '<fieldset><legend>Verified workface coverage</legend><p class="wp-help">Explicitly verify activity, location, dates, restrictions and working windows against the source. Changes to either scope invalidate the earlier verification. Links to the approval are chosen in each Work Package.</p><div id="paCoverage"></div><button type="button" class="btn" id="paAddCoverage">Add workface coverage</button></fieldset>'+
      '<fieldset><legend>Display permission (not secure access)</legend>'+check('paVisSite','Show approval details to Site',p.vis?.site)+check('paVisClient','Show approval details to Client',p.vis?.client)+'</fieldset><p id="paError" role="alert" tabindex="-1" hidden></p>';
    records(p.conditions).forEach(addCondition);records(p.coverage).forEach(addCoverage);
    $('paAddCondition').onclick=()=>addCondition({id:a.uid(),text:'',required:true,verified:false});
    $('paAddCoverage').onclick=()=>addCoverage({workfaceId:'',verified:false});
    $('paProject').onchange=()=>{
      const selected=value('paDocument');$('paDocument').innerHTML=optionRows(list(state().panels?.documents).filter(r=>D.project(r)===value('paProject')),selected,r=>r.name).map(([v,t])=>`<option value="${e(v)}">${e(t)}</option>`).join('');$('paDocument').value=selected;
      document.querySelectorAll('.wfc-coverage-edit').forEach(r=>r.refresh());
    };
    $('wfcDeletePermit').hidden=!saved;a.openModal('wfcPermitModal');
  }
  function addCondition(c) {
    const row=document.createElement('div'),id=a.uid();row.className='wfc-condition-edit';
    row.innerHTML=area(id+'text','Condition (recorded wording)',c.text)+check(id+'required','Required for readiness',c.required)+check(id+'verified','Verified satisfied',c.verified)+area(id+'evidence','Confirmation / evidence',c.evidence)+`<div class="wfc-grid">${input(id+'reviewer','Verified by',c.reviewer)}${input(id+'date','Verification date',c.date,'date')}${input(id+'due','Required completion date',c.due,'date')}</div><button type="button" class="btn" data-remove>Remove condition</button>`;
    $('paConditions').append(row);row.querySelector('[data-remove]').onclick=()=>row.remove();
    row.read=()=>({...c,text:value(id+'text'),required:checked(id+'required'),verified:checked(id+'verified'),evidence:value(id+'evidence'),reviewer:value(id+'reviewer'),date:value(id+'date'),due:value(id+'due')});
  }
  function addCoverage(c) {
    const row=document.createElement('div'),id=a.uid();row.className='wfc-coverage-edit';let reverified=false;
    row.innerHTML=select(id+'workface','Workface',[],c.workfaceId)+check(id+'verified','Coverage verified against the source',c.verified)+area(id+'source','Coverage source / assessment',c.source)+input(id+'reviewer','Coverage verified by',c.reviewer)+input(id+'date','Coverage verification date',c.date,'date')+'<button type="button" class="btn" data-remove>Remove coverage</button>';
    $('paCoverage').append(row);
    row.refresh=()=>{const selected=value(id+'workface')||c.workfaceId;$(id+'workface').innerHTML=optionRows(list(state().panels?.workPackages).filter(w=>D.project(w)===value('paProject')),selected,w=>w.main).map(([v,t])=>`<option value="${e(v)}">${e(t)}</option>`).join('');$(id+'workface').value=selected;};row.refresh();
    $(id+'verified').onchange=()=>{reverified=true;};$(id+'workface').onchange=()=>{$(id+'verified').checked=false;reverified=true;};
    row.querySelector('[data-remove]').onclick=()=>row.remove();
    row.read=p=>({...c,workfaceId:value(id+'workface'),verified:checked(id+'verified'),source:value(id+'source'),reviewer:value(id+'reviewer'),date:value(id+'date'),scope:reverified&&checked(id+'verified')?D.coverageScope(p,D.lookup(state().panels?.workPackages,value(id+'workface'))):c.scope});
  }
  function readPermit() {
    const p={...permitDraft,project:value('paProject'),type:value('paType'),title:value('paTitle'),description:value('paDescription'),issuer:value('paIssuer'),reference:value('paReference'),source:value('paSource'),responsible:value('paResponsible'),location:value('paLocation'),chainageStart:number('paChainageStart'),chainageEnd:number('paChainageEnd'),activity:value('paActivity'),restrictions:value('paRestrictions'),workingWindows:value('paWindows'),status:value('paStatus'),submittedDate:value('paSubmitted'),approvalDate:value('paApproved'),effectiveDate:value('paEffective'),expiryDate:value('paExpiry'),document:value('paDocument')?{...permitDraft.document,panel:'documents',id:value('paDocument')}:null,correspondence:value('paCorrespondence'),reviewer:value('paReviewer'),notes:value('paNotes'),vis:{...permitDraft.vis,site:checked('paVisSite'),client:checked('paVisClient')},assessment:{...permitDraft.assessment,source:value('paAssessment'),reviewer:value('paAssessmentReviewer'),date:value('paAssessmentDate')},conditions:[...document.querySelectorAll('.wfc-condition-edit')].map(r=>r.read())};
    p.coverage=[...document.querySelectorAll('.wfc-coverage-edit')].map(r=>r.read(p));return p;
  }
  function permitError(message) {const el=$('paError');el.textContent=message;el.hidden=false;el.focus();}
  function savePermit() {
    if(!canEdit())return;
    const invalid=invalidInput($('wfcPermitBody'));
    if(invalid){invalid.reportValidity();return permitError('Correct the invalid approval date or numeric field before saving.');}
    if(!Array.isArray(permitDraft.conditions)||!Array.isArray(permitDraft.coverage)||permitDraft.conditions.some(c=>!D.object(c))||permitDraft.coverage.some(c=>!D.object(c)))return permitError('The stored approval structure is malformed. Export a backup for repair; nothing has been overwritten.');
    const p=readPermit(), existing=D.lookup(permits(),p.id);
    if(permitOriginal!==null && JSON.stringify(existing)!==permitOriginal)return permitError('This approval changed while the form was open. Close and reopen it. Nothing was saved.');
    if(permitOriginal===null&&existing)return permitError('Duplicate approval ID. Reopen the form.');
    const candidate=[...permits().filter(x=>x.id!==p.id),p],s={...state(),permits:candidate},errors=D.permitErrors(p,s);
    const incoming=list(state().panels?.workPackages).some(w=>list(w.workface?.permits?.ids).includes(p.id)&&D.project(w)!==p.project);
    if(incoming)errors.push('Remove cross-project workface links before changing the approval project.');
    if(errors.length)return permitError(errors.join('. '));
    if(!a.savePermits(candidate))return permitError('Local storage could not save this approval. Nothing was changed. Export existing data and free space before retrying.');
    a.closeModal('wfcPermitModal');openRegister(p.project);
  }
  function removePermit() {
    if(!canEdit()||!permitOriginal)return;
    if(JSON.stringify(D.lookup(permits(),permitDraft.id))!==permitOriginal)return permitError('This approval changed while the form was open. Close and reopen it before removing.');
    if(!confirm('Remove this approval reference? Every linked workface will become NO GO until its missing approval is resolved. Documents will not be deleted.'))return;
    if(!a.savePermits(permits().filter(p=>p.id!==permitDraft.id)))return permitError('Local storage could not save this removal. Nothing was changed.');
    a.closeModal('wfcPermitModal');openRegister(registerProject);
  }
  document.addEventListener('click',ev=>{
    const target=ev.target.closest('[data-wfc-open-register],[data-wfc-edit-permit],[data-wfc-record]');if(!target)return;
    if(target.hasAttribute('data-wfc-open-register'))openRegister(target.dataset.wfcOpenRegister);
    else if(target.hasAttribute('data-wfc-edit-permit'))openPermit(target.dataset.wfcEditPermit);
    else if(!document.body.classList.contains('ws-enabled')){
      ev.preventDefault();document.dispatchEvent(new CustomEvent('oce:record-target',{detail:{panelId:target.dataset.wfcRecord,recordId:target.dataset.wsRecord,accept:row=>row?.scrollIntoView({block:'center'})}}));
    }
  });
  $('wfcNewPermit').onclick=()=>openPermit();$('wfcSavePermit').onclick=savePermit;$('wfcDeletePermit').onclick=removePermit;
  // Keep the sticky footer inside the actual visual viewport when a touch keyboard opens.
  function viewport() {
    document.querySelectorAll('.wfc-modal').forEach(m=>{m.style.setProperty('--wfc-vh',(window.visualViewport?.height||innerHeight)+'px');m.style.top=(window.visualViewport?.offsetTop||0)+'px';});
    const focused=document.activeElement,body=focused?.closest('.wfc-modal.open .modal-body');
    if(body){const b=body.getBoundingClientRect(),f=focused.getBoundingClientRect();if(f.bottom>b.bottom-8)body.scrollTop+=f.bottom-b.bottom+8;if(f.top<b.top+8)body.scrollTop-=b.top-f.top+8;}
  }
  window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);
  document.querySelectorAll('.wfc-modal').forEach(m=>m.addEventListener('focusin',viewport));
  function refreshViews() {
    if(a.locked()||!a.panelVisible('workPackages')){a.closeModal('wfcRegisterModal');a.closeModal('wfcPermitModal');return;}
    if($('wfcRegisterModal').classList.contains('open'))renderRegister();
  }
  return {assessment,rowHtml,panelHtml,plannedHtml,refreshViews,printHtml:w=>'<h2>Workface Control</h2>'+detailHtml(w,true),formOpen,formRead,formErrors,formProjectChanged};
};
