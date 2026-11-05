/* PLN-001: read-only, explicit client projection over published WFC-003 records. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('./planning-data.js'):root.OCEPlanningData,node?require('./workface-data.js'):root.OCEWorkfaceData);if(node)module.exports=api;else root.OCEClientLookahead=api;})(globalThis,function(P,D){
 'use strict';
 const text=v=>typeof v==='string'?v:'',esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const metadataErrors=P.clientLookaheadErrors;
 const decisionPanels={rfis:'RFI / required decision',designChanges:'Design change',variations:'Variation approval'};
 function projection(board,{clientId,projectId='all',from=D.today(),weeks=3,week='',area='',status='',day=D.today(),visible=()=>false,assigned=()=>false,now=()=>new Date().toISOString()}={}){
  const range=P.horizon(weeks,from),projects=D.list(board?.projects).filter(p=>assigned(p,clientId)&&(projectId==='all'||p.id===projectId)).map(p=>({id:p.id,name:text(p.name)})),ids=new Set(projects.map(p=>p.id));
  const selected=D.list(board?.panels?.upcoming).filter(r=>ids.has(D.project(r))&&visible('upcoming',r)&&r.planning?.clientLookahead?.enabled===true&&metadataErrors(r.planning.clientLookahead).length===0);
  const rows=P.activities({panels:{upcoming:selected}},{projectId,from,weeks,week,area,status,day});
  const activities=rows.map(r=>{const p=r.planning,workface=D.lookup(board?.panels?.workPackages,p.workPackageId),permittedWorkface=workface&&D.project(workface)===D.project(r)&&visible('workPackages',workface);return {id:r.id,project:D.project(r),title:text(r.main),start:D.date(r.startDate)?r.startDate:'',finish:D.date(r.endDate)?r.endDate:'',location:text(p.location),chainageStart:Number.isFinite(p.chainageStart)?p.chainageStart:null,chainageEnd:Number.isFinite(p.chainageEnd)?p.chainageEnd:null,workface:permittedWorkface?text(workface.main):'',quantity:Number.isFinite(p.quantity)?p.quantity:null,unit:text(p.unit),status:P.activityStatus(r,day),milestone:p.clientLookahead.milestone,notes:p.clientLookahead.notes};});
  const subcontractors=new Map(),permits=new Map(),approvals=[],milestones=[],coordination=projects.map(p=>({project:p.id,subcontractors:false,permits:false,approvals:false,milestones:false}));
  const inPeriod=date=>!date||P.overlap(date,date,range.start,range.end)&&(!week||P.overlap(date,date,week,P.addDays(week,6)));
  const sourceAllowed=(panel,r,project)=>!!r&&D.project(r)===project&&visible(panel,r);
  for(const activity of rows){
   const p=activity.planning,share=p.clientLookahead,project=D.project(activity),flags=coordination.find(f=>f.project===project),work={id:activity.id,title:text(activity.main)};
   for(const [flag,key]of [['shareSubcontractors','subcontractors'],['sharePermits','permits'],['shareApprovals','approvals'],['milestone','milestones']])if(share[flag]===true)flags[key]=true;
   if(share.milestone&&!D.complete(activity)&&activity.wstatus!=='cancelled'){
    const planned=D.date(activity.endDate)?activity.endDate:D.date(activity.startDate)?activity.startDate:'';
    if(inPeriod(planned))milestones.push({...work,project,date:planned,status:P.activityStatus(activity,day)});
   }
   if(share.shareSubcontractors===true&&activity.wstatus!=='cancelled')for(const ref of D.list(p.resourceRefs)){
    if(ref?.panel!=='subbiesToday')continue;
    const r=D.lookup(board?.panels?.subbiesToday,ref.id);
    if(!sourceAllowed('subbiesToday',r,project))continue;
    const onsite=D.date(r.due)?r.due:'';
    if(!inPeriod(onsite))continue;
    const key=JSON.stringify([project,r.id]),entry=subcontractors.get(key)||{id:r.id,project,name:text(r.main),onsite,works:[]};
    if(!entry.works.some(w=>w.id===work.id))entry.works.push({...work});
    subcontractors.set(key,entry);
   }
   if(!share.sharePermits&&!share.shareApprovals)continue;
   const face=D.lookup(board?.panels?.workPackages,p.workPackageId);
   if(!sourceAllowed('workPackages',face,project)||!D.object(face.workface))continue;
   const active=!D.complete(activity)&&activity.wstatus!=='cancelled',requirements=new Map(),ready=P.makeReady(activity,board,day);
   if(share.shareApprovals===true&&active&&face.workface.permits?.assessment==='required'&&!D.list(face.workface.permits.ids).length)requirements.set('unlinked:'+face.id,{id:face.id,panel:'workPackages',title:'Required approval not yet linked',type:'Permit / approval',status:'Approval requirement recorded; approval record not linked'});
   if(face.workface.permits?.assessment==='required')for(const id of new Set(D.list(face.workface.permits.ids))){
    const permit=D.lookup(board?.permits,id);
    // The permit register belongs to Work Packages; retain its panel and record filters.
    if(!sourceAllowed('workPackages',permit,project)||permit.vis?.client!==true||!Object.hasOwn(D.statuses,permit.status))continue;
    const pending=ready.blockers.some(b=>b.panel==='permits'&&b.id===id),recordedStatus=D.statuses[permit.status];
    if(share.sharePermits===true){
     const key=JSON.stringify([project,id]),entry=permits.get(key)||{id,project,title:text(permit.title),type:text(permit.type),status:recordedStatus,effective:D.date(permit.effectiveDate)?permit.effectiveDate:'',expiry:D.date(permit.expiryDate)?permit.expiryDate:'',works:[]};
     if(!entry.works.some(w=>w.id===work.id))entry.works.push({...work,pending});
     permits.set(key,entry);
    }
    if(share.shareApprovals===true&&active&&pending)requirements.set('permits:'+id,{id,panel:'permits',title:text(permit.title),type:'Permit / approval',status:recordedStatus+' · approval / coverage verification outstanding'});
   }
   if(share.shareApprovals===true&&active)for(const link of D.list(face.workface.links)){
    if(link?.category!=='decisions'||link.completionRequired!==true||!Object.hasOwn(decisionPanels,link.panel))continue;
    const r=D.lookup(board?.panels?.[link.panel],link.id);
    if(!sourceAllowed(link.panel,r,project)||D.complete(r))continue;
    requirements.set(link.panel+':'+r.id,{id:r.id,panel:link.panel,title:text(r.main),type:decisionPanels[link.panel],status:r.wstatus==='cancelled'?'Cancelled — required decision remains unresolved':'Required record not completed'});
   }
   if(requirements.size)approvals.push({...work,project,start:D.date(activity.startDate)?activity.startDate:'',finish:D.date(activity.endDate)?activity.endDate:'',requirements:[...requirements.values()]});
  }
  return {version:1,loaded:!!board,range,projects,activities,coordination,subcontractors:[...subcontractors.values()],permits:[...permits.values()],approvals,milestones,publishedAt:typeof board?.publishedAt==='string'&&Number.isFinite(Date.parse(board.publishedAt))?board.publishedAt:'',generatedAt:now()};
 }
 const activityReference=w=>'<span class="cl-context-reference" data-report-activity-reference>'+esc(w.title)+'</span>';
 function coordinationHtml(view,project){
  const flags=D.list(view.coordination).find(p=>p.project===project.id);
  if(!flags)return '';
  const table=(title,heads,rows)=>'<section class="cl-context-card"><h3>'+title+'</h3><div class="cl-context-scroll" tabindex="0" role="region" aria-label="'+title+'"><table class="cl-context-table"><thead><tr class="cl-context-project"><th colspan="'+heads.length+'">'+esc(project.name)+' · '+title+'</th></tr><tr>'+heads.map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div></section>';
  const empty=cols=>'<tr><td colspan="'+cols+'">No linked Client-visible entries shared for this period.</td></tr>';
  let html='';
  if(flags.milestones)html+=table('Anticipated milestones',['Milestone','Recorded planned date'],D.list(view.milestones).filter(r=>r.project===project.id).map(r=>'<tr><td>'+activityReference(r)+'</td><td>'+esc(r.date||'Date not recorded')+'</td></tr>').join('')||empty(2));
  if(flags.subcontractors)html+=table('Subcontractors onsite',['Subcontractor','Recorded onsite date','Related work'],D.list(view.subcontractors).filter(r=>r.project===project.id).map(r=>'<tr><td>'+esc(r.name||'Not recorded')+'</td><td>'+esc(r.onsite||'Date not recorded')+'</td><td>'+r.works.map(activityReference).join('')+'</td></tr>').join('')||empty(3));
  if(flags.permits)html+=table('Permits & approvals required',['Permit / approval','Recorded status / dates','Related work'],D.list(view.permits).filter(r=>r.project===project.id).map(r=>'<tr><td><strong>'+esc(r.title)+'</strong><small>'+esc(r.type)+'</small></td><td>'+esc(r.status)+'<small>Effective '+esc(r.effective||'not recorded')+' · Expiry '+esc(r.expiry||'not recorded')+'</small></td><td>'+r.works.map(w=>activityReference(w)+(w.pending?'<small>Approval / coverage verification outstanding</small>':'')).join('')+'</td></tr>').join('')||empty(3));
  if(flags.approvals)html+=table('Works awaiting approval / decision',['Work / planned dates','Outstanding approval or required decision'],D.list(view.approvals).filter(r=>r.project===project.id).map(r=>'<tr><td>'+activityReference(r)+'<small>'+esc(r.start||'Not recorded')+' to '+esc(r.finish||'Not recorded')+'</small></td><td>'+r.requirements.map(q=>'<div class="cl-requirement"><strong>'+esc(q.title)+'</strong><small>'+esc(q.type)+' · '+esc(q.status)+'</small></div>').join('')+'</td></tr>').join('')||empty(2));
  return html?'<p class="cl-context-explanation">Recorded, explicitly shared coordination information. Onsite dates are not attendance confirmation; planned milestones are not forecasts. Approval status does not authorise work.</p><div class="cl-coordination">'+html+'</div>':'';
 }
 const labels={upcoming:'Upcoming',current:'Current planned window',delayed:'Delayed / not completed',completed:'Completed',cancelled:'Cancelled',undated:'Dates not recorded'};
 function html(view){const range=view.range;let out='<header class="cl-report-heading"><p class="cl-report-kicker">CLIENT LOOKAHEAD PROGRAMME</p><h1>'+esc(view.projects.length===1?view.projects[0].name:'Client-visible lookahead')+'</h1><p>'+esc(range.start)+' to '+esc(range.end)+' · '+range.weeks+'-week rolling lookahead</p><p class="cl-publication">Generated '+esc(new Date(view.generatedAt).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'}))+' (Brisbane) · '+(view.publishedAt?'Published board '+esc(view.publishedAt):'Publication reference not recorded')+'</p><p class="cl-report-status">Published, explicitly client-enabled information only. This dated view is not programme approval, contractual certification or permission to perform work.</p></header>';
  if(!view.loaded)return out+'<p class="cl-empty">Published planning information is unavailable. No local unpublished planning data is shown.</p>';
  if(!view.projects.length)return out+'<p class="cl-empty">No projects are available for this client and project selection.</p>';
  for(const project of view.projects){const activities=view.activities.filter(r=>r.project===project.id);out+='<section class="cl-project"><h2>'+esc(project.name)+'</h2>';out+=coordinationHtml(view,project);if(!activities.length)out+='<p class="cl-empty">No explicitly client-enabled activities match this planning period and filters.</p>';const groups=new Map();for(const row of activities){const key=row.start&&row.finish?P.monday(row.start<range.start?range.start:row.start):'undated';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}for(const [key,rows]of groups){const begin=key==='undated'?'':key<range.start?range.start:key,end=key==='undated'?'':P.addDays(key,6)>range.end?range.end:P.addDays(key,6);out+='<section class="cl-week" tabindex="0" role="region" aria-label="Client lookahead activities"><table class="cl-table"><colgroup><col style="width:25%"><col style="width:19%"><col style="width:9%"><col style="width:9%"><col style="width:11%"><col style="width:8%"><col style="width:19%"></colgroup><thead><tr class="cl-week-title"><th colspan="7">'+esc(project.name)+' · '+(key==='undated'?'Dates not recorded':'Week commencing '+esc(key)+' · '+esc(begin)+' to '+esc(end))+'</th></tr><tr>'+['Activity / milestone','Workface / location','Planned start','Planned finish','Recorded status','Planned quantity','Client programme notes'].map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr data-client-activity="'+esc(r.id)+'"><td><strong data-report-activity-reference>'+esc(r.title)+'</strong>'+(r.milestone?'<span class="cl-milestone">Recorded milestone</span>':'')+'</td><td>'+esc([r.workface,r.location].filter(Boolean).join(' · ')||'Not recorded')+((r.chainageStart!==null||r.chainageEnd!==null)?'<small>Ch '+esc(r.chainageStart??'not recorded')+'–'+esc(r.chainageEnd??'not recorded')+' m</small>':'')+'</td><td>'+esc(r.start||'Not recorded')+'</td><td>'+esc(r.finish||'Not recorded')+'</td><td>'+esc(labels[r.status]||'Not recorded')+'</td><td>'+esc(r.quantity===null?'Not recorded':r.quantity+' '+r.unit)+'</td><td class="cl-note">'+esc(r.notes||'None shared')+'</td></tr>').join('')+'</tbody></table></section>';}out+='</section>';}
  return out;
 }
 return {metadataErrors,projection,html};
});
