/* WFC-003: pure planning rules over original Scheduled Works, Daily Works and Workfaces. */
(function(root,factory){const D=typeof module==='object'&&module.exports?require('./workface-data.js'):root.OCEWorkfaceData,R=typeof module==='object'&&module.exports?require('./board-reconcile.js'):root.OCEReconcile;const api=factory(D,R);if(typeof module==='object'&&module.exports)module.exports=api;else root.OCEPlanningData=api;})(globalThis,function(D,R){
  'use strict';
  const {object,text,list,date,days,project,lookup,complete}=D,copy=R.copy;
  const categories=['Drawings / design','Permits / approvals','Existing services','Traffic management','Materials / deliveries','Labour','Plant / equipment','Subcontractors','Site access','Survey / setout','QA / inspections','Client decisions','Environmental controls','Temporary works','Construction methodology','Other'];
  const statuses={open:'Open',underway:'Action underway',external:'Awaiting external response',resolved:'Resolved — pending verification',closed:'Closed / verified',cancelled:'Cancelled / not applicable'};
  const reasons=['Materials unavailable','Approval outstanding','Design information missing','Existing service conflict','Access / traffic restriction','Plant unavailable','Labour / subcontractor unavailable','Weather / ground conditions','Client instruction','Prior activity incomplete','Other / unclassified'];
  const resourcePanels=['plantTransport','subbiesToday'],evidencePanels=['documents','weeklyPhotos','qualityTesting','issuesDelays','rfis','dailyWorks'];
  const scheduled=s=>list(s.panels?.upcoming),daily=s=>list(s.panels?.dailyWorks),packages=s=>list(s.panels?.workPackages);
  function addDays(d,n){return new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);}
  function monday(d){const weekday=new Date(d+'T00:00:00Z').getUTCDay();return addDays(d,-((weekday+6)%7));}
  function horizon(weeks=3,from=D.today()){if(![2,3,4,5,6].includes(Number(weeks))||!date(from))throw Error('Choose a valid date and 2–6 week horizon.');return {start:from,end:addDays(from,Number(weeks)*7-1),weeks:Number(weeks)};}
  const overlap=(a,b,c,d)=>date(a)&&date(b)&&date(c)&&date(d)&&a<=d&&c<=b;
  function fields(o,strings,dates,numbers,e,label){
    if(!object(o)){e.push(label+': malformed structure');return;}
    for(const k of strings)if(o[k]!==undefined&&typeof o[k]!=='string')e.push(label+': invalid '+k);
    for(const k of dates)if(o[k]!==undefined&&o[k]!==''&&!date(o[k]))e.push(label+': invalid '+k+' date');
    for(const k of numbers)if(o[k]!==undefined&&o[k]!==null&&(!Number.isFinite(o[k])||o[k]<0))e.push(label+': invalid '+k+' quantity / chainage');
  }
  function unique(rows,e,label){if(!Array.isArray(rows)){e.push(label+': expected a list');return [];}const seen=new Set();for(const r of rows){const id=object(r)?r.id:r;if(!text(id)||seen.has(id)||['__proto__','constructor','prototype'].includes(id))e.push(label+': missing or duplicate ID');seen.add(id);}return rows;}
  function ref(panel,id,p,s,e,label,strict=true){const r=lookup(s.panels?.[panel],id);if(!r){if(strict)e.push(label+': missing or ambiguous '+panel+' reference');}else if(project(r)!==p)e.push(label+': cross-project '+panel+' reference');return r;}
  function references(rows,allowed,p,s,e,label,strict){
    if(rows!==undefined&&!Array.isArray(rows)){e.push(label+': expected a list');return;}const seen=new Set();
    for(const r of list(rows)){if(!object(r)||!allowed.includes(r.panel)||!text(r.id)){e.push(label+': invalid reference type / ID');continue;}const key=r.panel+'|'+r.id;if(seen.has(key))e.push(label+': duplicate reference');seen.add(key);ref(r.panel,r.id,p,s,e,label,strict);}
  }
  function identity(r,s,e,label){if(!text(r.id)||!text(r.project)||!lookup(s.projects,r.project))e.push(label+': stable ID and valid project are required');}
  function quantity(q,u,e,label){if(q!=null&&!text(u))e.push(label+': record the quantity unit');}
  function clientLookaheadErrors(v){return v===undefined?[]:(!object(v)||v.version!==1||typeof v.enabled!=='boolean'||typeof v.milestone!=='boolean'||typeof v.notes!=='string'||v.notes.length>2000||['shareSubcontractors','sharePermits','shareApprovals'].some(key=>v[key]!==undefined&&typeof v[key]!=='boolean')?['Activity: invalid client-lookahead display settings.']:[]);}
  function activityErrors(a,s,strict=true,day=D.today()){
    if(a.planning===undefined)return [];const p=a.planning,e=[];if(!object(p)||p.version!==1)return ['Activity: unsupported planning structure'];identity(a,s,e,'Activity');e.push(...clientLookaheadErrors(p.clientLookahead));
    fields(p,['workPackageId','location','supervisor','crew','plant','unit','notes'],['actualStart','actualFinish'],['quantity','chainageStart','chainageEnd'],e,'Activity');
    if(!date(a.startDate)||!date(a.endDate)||a.startDate>a.endDate)e.push('Activity: valid planned start and finish are required');
    if(p.chainageStart!=null&&p.chainageEnd!=null&&p.chainageStart>p.chainageEnd)e.push('Activity: chainage finish precedes start');
    if(p.actualStart&&p.actualFinish&&p.actualStart>p.actualFinish)e.push('Activity: actual finish precedes actual start');
    if(p.actualStart>day||p.actualFinish>day)e.push('Activity: actual dates cannot be in the future');
    if(p.workPackageId)ref('workPackages',p.workPackageId,project(a),s,e,'Activity workface',strict);
    quantity(p.quantity,p.unit,e,'Activity');
    if(!object(p.baseline))e.push('Activity: baseline structure is required');else{
      const b=p.baseline;fields(b,['source','revision','unit'],['dataDate','start','finish'],['quantity'],e,'Programme baseline');
      if(b.start&&b.finish&&b.start>b.finish)e.push('Programme baseline: finish precedes start');quantity(b.quantity,b.unit,e,'Programme baseline');
    }
    references(p.resourceRefs,resourcePanels,project(a),s,e,'Activity resources',strict);references(p.evidence,evidencePanels,project(a),s,e,'Activity evidence',strict);
    for(const h of unique(p.changes||[],e,'Programme changes'))if(!object(h)||!text(h.reason)||!text(h.at))e.push('Programme changes: reason and timestamp are required');
    const units=daily(s).filter(d=>d.allocation?.activityId===a.id&&project(d)===project(a)&&d.allocation.actualQuantity!=null).map(d=>d.allocation.unit);
    if(units.some(u=>u!==p.unit))e.push('Activity: existing Daily Works quantities use a different unit; retain their unit or create a separate activity');
    return e;
  }
  function allocationErrors(d,s,strict=true,day=D.today()){
    if(d.allocation===undefined)return [];const p=d.allocation,e=[];if(!object(p)||p.version!==1)return ['Daily allocation: unsupported structure'];identity(d,s,e,'Daily allocation');
    fields(p,['activityId','commitmentId','crew','plant','unit','interruptionCode','interruptionNotes','notes'],['workDate','actualStart','actualFinish'],['plannedQuantity','actualQuantity'],e,'Daily allocation');
    if(!text(p.activityId)||!date(p.workDate))e.push('Daily allocation: activity and work date are required');
    const a=ref('upcoming',p.activityId,project(d),s,e,'Daily allocation',strict);
    if(a&&p.unit!==a.planning?.unit&&(p.actualQuantity!=null||p.plannedQuantity!=null))e.push('Daily allocation: quantity unit must match the activity');
    quantity(p.actualQuantity,p.unit,e,'Daily actual');quantity(p.plannedQuantity,p.unit,e,'Daily planned');
    if(p.actualStart&&p.actualFinish&&p.actualStart>p.actualFinish)e.push('Daily allocation: actual finish precedes start');
    if(p.actualStart>day||p.actualFinish>day||(p.actualQuantity!=null&&p.workDate>day))e.push('Daily allocation: actual production cannot be recorded in the future');
    if(p.interruptionCode&&!reasons.includes(p.interruptionCode))e.push('Daily allocation: invalid interruption reason');
    if(p.commitmentId){const c=lookup(s.weeklyCommitments,p.commitmentId);if(!c){if(strict)e.push('Daily allocation: missing commitment');}else if(c.project!==project(d)||c.activityId!==p.activityId)e.push('Daily allocation: commitment belongs to another project or activity');else if(a&&c.snapshot.workPackageId!==(a.planning?.workPackageId||''))e.push('Daily allocation: activity workface differs from the frozen commitment; review the plan or allocate without claiming this commitment');}
    references(p.resourceRefs,resourcePanels,project(d),s,e,'Daily resources',strict);references(p.evidence,evidencePanels,project(d),s,e,'Daily evidence',strict);return e;
  }
  function constraintErrors(c,s,strict=true,day=D.today()){
    const e=[];if(!object(c))return ['Constraint: invalid record'];identity(c,s,e,'Constraint');
    if(!text(c.title)||!categories.includes(c.category)||!Object.hasOwn(statuses,c.status)||!['low','normal','high','urgent'].includes(c.priority))e.push('Constraint: title, category, priority and status are required');
    fields(c,['title','description','sourceReference','responsible','action','organisation','resolutionNotes'],['identified','requiredBy','resolvedDate'],[],e,'Constraint');
    if(!date(c.identified))e.push('Constraint: date identified is required');
    if(c.identified>day||c.resolvedDate>day||(c.resolvedDate&&c.identified&&c.resolvedDate<c.identified))e.push('Constraint: check identified / resolved dates; reported events cannot be future-dated');
    if(!object(c.vis)||typeof c.vis.site!=='boolean'||typeof c.vis.client!=='boolean')e.push('Constraint: explicit audience visibility is required');
    for(const [key,panel]of [['activityIds','upcoming'],['workPackageIds','workPackages']])for(const id of unique(c[key]||[],e,'Constraint '+key))ref(panel,id,c.project,s,e,'Constraint',strict);
    references(c.evidence,evidencePanels,c.project,s,e,'Constraint evidence',strict);
    if(!object(c.verification))e.push('Constraint: verification structure required');else{
      fields(c.verification,['by','evidence'],['date'],[],e,'Constraint verification');
      if(typeof c.verification.confirmed!=='boolean')e.push('Constraint: verification must be explicitly confirmed');
      if(c.status==='closed'&&(!c.verification.confirmed||!text(c.verification.by)||!date(c.verification.date)||c.verification.date>day||(!text(c.verification.evidence)&&!list(c.evidence).length)||!date(c.resolvedDate)))e.push('Constraint: closed requires resolution date, explicit verification, verifier/date and evidence');
      if(c.status==='closed'&&c.verification.date<c.resolvedDate)e.push('Constraint: verification cannot precede the reported resolution');
    }
    if(c.status==='resolved'&&!date(c.resolvedDate))e.push('Constraint: record the reported resolution date');
    if(c.status==='cancelled'&&!text(c.resolutionNotes))e.push('Constraint: record why it is not applicable');
    for(const h of unique(c.history||[],e,'Constraint history'))if(!object(h)||!text(h.at)||!Object.hasOwn(statuses,h.status))e.push('Constraint: invalid history event');return e;
  }
  function commitmentErrors(c,s,strict=true,day=D.today()){
    const e=[];if(!object(c))return ['Commitment: invalid record'];identity(c,s,e,'Commitment');if(!date(c.week)||monday(c.week)!==c.week||!text(c.activityId))e.push('Commitment: activity and Monday week commencing are required');
    const a=ref('upcoming',c.activityId,c.project,s,e,'Commitment',strict),b=c.snapshot;
    if(!object(b))return [...e,'Commitment: original snapshot is required'];
    fields(b,['title','workPackageId','scope','unit','crew','responsible','criteria','readiness'],['start','finish','completion','committedDate'],['quantity'],e,'Commitment baseline');
    if(b.committedDate>day)e.push('Commitment: commitment date cannot be in the future');
    if(!text(b.title)||!text(b.scope)||!text(b.criteria)||!date(b.completion)||!date(b.committedDate)||!['READY','NOT READY','NOT ASSESSED'].includes(b.readiness)||!Array.isArray(b.blockers))e.push('Commitment: complete original scope, criteria, readiness and dates are required');
    if(date(c.week)&&date(b.completion)&&(b.completion<c.week||b.completion>addDays(c.week,6)))e.push('Commitment: original completion must fall in the selected week');
    if(b.readiness!=='READY'&&b.acknowledged!==true)e.push('Commitment: outstanding readiness must be explicitly acknowledged');
    if(b.workPackageId)ref('workPackages',b.workPackageId,c.project,s,e,'Commitment workface',strict);quantity(b.quantity,b.unit,e,'Commitment');
    const o=c.outcome;if(!object(o)||!['unassessed','achieved','missed','partial'].includes(o.status))e.push('Commitment: invalid outcome');else{
      fields(o,['by','reason','notes','evidence'],['date','actualFinish'],['quantity'],e,'Commitment outcome');
      if(o.status!=='unassessed'&&(!text(o.by)||!date(o.date)||o.date>day))e.push('Commitment: record assessor and assessment date');
      if(o.actualFinish&&(o.actualFinish>day||(o.date&&o.actualFinish>o.date)))e.push('Commitment: actual completion cannot be in the future or after its assessment');
      if(['missed','partial'].includes(o.status)&&!reasons.includes(o.reason))e.push('Commitment: record a reason for non-completion');
      if(o.status==='achieved'&&(!o.criteriaSatisfied||!date(o.actualFinish)||o.actualFinish>b.completion||(!text(o.evidence)&&!list(o.evidenceRefs).length)||(b.quantity!=null&&(o.quantity==null||o.quantity<b.quantity))))e.push('Commitment: achieved requires original criteria, evidence, on-time completion and the original quantity where recorded');
      references(o.evidenceRefs,evidencePanels,c.project,s,e,'Commitment evidence',strict);
    }
    for(const h of unique(c.amendments||[],e,'Commitment amendments')){if(!object(h)||!text(h.reason)||!text(h.at))e.push('Commitment amendment: reason is required');fields(h,['scope','crew','unit'],['completion'],['quantity'],e,'Commitment amendment');}
    for(const h of unique(c.outcomeHistory||[],e,'Commitment outcome history'))if(!object(h)||!text(h.at)||!object(h.outcome))e.push('Commitment: invalid outcome history');
    if(c.vis!==undefined&&(!object(c.vis)||typeof c.vis.site!=='boolean'||typeof c.vis.client!=='boolean'))e.push('Commitment: invalid audience visibility');return e;
  }
  function validate(s,{refs=true,day=D.today()}={}){const e=[];for(const a of scheduled(s))e.push(...activityErrors(a,s,refs,day));for(const d of daily(s))e.push(...allocationErrors(d,s,refs,day));for(const key of ['constraints','weeklyCommitments'])if(s[key]!==undefined)for(const r of unique(s[key],e,key))e.push(...(key==='constraints'?constraintErrors:commitmentErrors)(r,s,refs,day));return [...new Set(e)];}
  function activityStatus(a,day=D.today()){if(a.wstatus==='cancelled')return 'cancelled';if(complete(a))return 'completed';if(!date(a.startDate)||!date(a.endDate))return 'undated';if(a.endDate<day)return 'delayed';return a.wstatus==='inprogress'?'current':a.startDate>day?'upcoming':'current';}
  function progress(a,s){
    const p=a.planning||{},rows=daily(s).filter(d=>project(d)===project(a)&&d.allocation?.activityId===a.id),reported=rows.filter(d=>d.allocation.actualQuantity!=null&&d.wstatus!=='cancelled'),compatible=reported.every(d=>d.allocation.unit===p.unit),actual=reported.length&&compatible?reported.reduce((n,d)=>n+d.allocation.actualQuantity,0):null;
    const starts=[p.actualStart,...rows.filter(d=>d.wstatus!=='cancelled').map(d=>d.allocation.actualStart)].filter(date).sort();
    return {planned:p.quantity??null,unit:p.unit||'',actual,remaining:actual!=null&&p.quantity!=null?Math.max(0,p.quantity-actual):null,percent:actual!=null&&p.quantity>0?Math.min(100,100*actual/p.quantity):null,excess:actual!=null&&p.quantity!=null?Math.max(0,actual-p.quantity):null,actualStart:starts[0]||'',actualFinish:p.actualFinish||'',compatible,rows};
  }
  function makeReady(a,s,day=D.today()){
    const blockers=[],p=a.planning||{},w=lookup(packages(s),p.workPackageId),push=(text,panel,id,unassessed=false,owner='',needBy='',kind='derived')=>blockers.push({text,panel,id,unassessed,owner,needBy,kind});
    for(const error of activityErrors(a,s,false,day))push(error,'upcoming',a.id,true);
    if(!a.planning||!date(a.startDate)||!date(a.endDate))push('Activity scope / dates have not been assessed','upcoming',a.id,true);
    if(!w||project(w)!==project(a))push('Workface link is missing, ambiguous or belongs to another project','upcoming',a.id,true);
    else{
      const materials=w.materialsStatus||'unconfirmed';if(!['available','not-required'].includes(materials))push(materials==='unavailable'?'Materials unavailable':'Materials availability is not assessed','workPackages',w.id,materials!=='unavailable',w.workface?.responsible||'',a.startDate);
      for(const issue of D.dependencyIssues(w,s))push(issue.reason,'workPackages',issue.dependency?.id||issue.item?.id,false,'',a.startDate);
      for(const id of list(w.prerequisiteIds)){const dep=lookup(packages(s),id);if(dep&&project(dep)===project(w)&&!complete(dep))push('Prerequisite is not completed','workPackages',id,false,dep.workface?.responsible||'',a.startDate);}
      const result=D.evaluate(w,s,day);if(!result.configured)push('Legacy Work Package: Workface / permit applicability not assessed','workPackages',w.id,true);
      if((p.chainageStart!=null&&w.workface?.chainageStart!=null&&p.chainageStart<w.workface.chainageStart)||(p.chainageEnd!=null&&w.workface?.chainageEnd!=null&&p.chainageEnd>w.workface.chainageEnd))push('Activity chainage extends outside the linked workface; verify the recorded activity scope','workPackages',w.id,true,w.workface?.responsible||'',a.startDate);
      for(const r of result.reasons)push(r.text,r.permitId?'permits':r.link?.panel||'workPackages',r.permitId||r.link?.id||w.id,/not been assessed|not assessed|unassessed|not been linked|not recorded|missing or in the future/.test(r.text),r.permitId?lookup(s.permits,r.permitId)?.responsible||'':w.workface?.responsible||'',a.startDate);
      for(const id of list(w.workface?.permits?.ids)){const permit=lookup(s.permits,id);if(!permit||project(permit)!==project(a))continue;
        if(permit.effectiveDate&&a.startDate&&permit.effectiveDate>a.startDate)push('Planned work '+a.startDate+' to '+a.endDate+' starts before approval effective '+permit.effectiveDate,'permits',id,false,permit.responsible,a.startDate);
        if(permit.expiryDate&&a.endDate&&permit.expiryDate<a.endDate)push('Planned work '+a.startDate+' to '+a.endDate+' extends beyond approval expiry '+permit.expiryDate,'permits',id,false,permit.responsible,a.startDate);
        if((p.chainageStart!=null&&permit.chainageStart!=null&&p.chainageStart<permit.chainageStart)||(p.chainageEnd!=null&&permit.chainageEnd!=null&&p.chainageEnd>permit.chainageEnd))push('Activity chainage is outside the recorded approval coverage','permits',id,false,permit.responsible,a.startDate);
      }
    }
    for(const c of list(s.constraints).filter(c=>c.project===project(a)&&(list(c.activityIds).includes(a.id)||(w&&list(c.workPackageIds).includes(w.id))))){if(!['closed','cancelled'].includes(c.status)||constraintErrors(c,s,false,day).length)push(c.title+': '+(statuses[c.status]||'Invalid status')+(c.action?' — '+c.action:''),'constraints',c.id,false,c.responsible,c.requiredBy,'manual');}
    const uniqueBlockers=[...new Map(blockers.map(b=>[JSON.stringify([b.text,b.panel,b.id]),b])).values()];return {state:uniqueBlockers.some(b=>!b.unassessed)?'NOT READY':uniqueBlockers.length?'NOT ASSESSED':'READY',blockers:uniqueBlockers,workface:w,notes:w?.constraints||''};
  }
  function activities(s,{projectId='all',weeks=3,from=D.today(),week='',area='',supervisor='',status='',readiness='',day=D.today()}={}){const h=horizon(weeks,from);return scheduled(s).filter(a=>projectId==='all'||project(a)===projectId).filter(a=>!date(a.startDate)||!date(a.endDate)||overlap(a.startDate,a.endDate,h.start,h.end)).filter(a=>!week||overlap(a.startDate,a.endDate,week,addDays(week,6))).filter(a=>!area||(a.planning?.location||'').toLowerCase().includes(area.toLowerCase())).filter(a=>!supervisor||(a.planning?.supervisor||'').toLowerCase().includes(supervisor.toLowerCase())).filter(a=>!status||activityStatus(a,day)===status).filter(a=>!readiness||makeReady(a,s,day).state===readiness).sort((a,b)=>(a.startDate||'9999').localeCompare(b.startDate||'9999')||a.id.localeCompare(b.id));}
  function resourceConflicts(a,s,workDate){const refs=list(a.allocation?.resourceRefs||a.planning?.resourceRefs).map(r=>r.panel+':'+r.id);if(!refs.length)return [];const start=workDate||a.startDate,end=workDate||a.endDate;return scheduled(s).filter(b=>b.id!==a.id&&b.id!==a.allocation?.activityId&&project(b)===project(a)&&!complete(b)&&b.wstatus!=='cancelled'&&overlap(start,end,b.startDate,b.endDate)&&list(b.planning?.resourceRefs).some(r=>refs.includes(r.panel+':'+r.id))).map(b=>({panel:'upcoming',id:b.id})).concat(daily(s).filter(b=>b.id!==a.id&&project(b)===project(a)&&b.wstatus!=='cancelled'&&date(b.allocation?.workDate)&&overlap(start,end,b.allocation.workDate,b.allocation.workDate)&&list(b.allocation?.resourceRefs).some(r=>refs.includes(r.panel+':'+r.id))).map(b=>({panel:'dailyWorks',id:b.id})));}
  function reviseActivity(old,next,{uid,now,reason}){
    const p=next.planning;if(!p)return next;if(old?.planning){
      const beforeBaseline=old.planning.baseline||{};
      for(const [key,value]of Object.entries(beforeBaseline))if(value!==null&&value!==undefined&&value!==''&&!R.equal(p.baseline?.[key],value))throw Error('Original programme baseline is frozen. Record working changes without overwriting it.');
      const before={start:old.startDate,finish:old.endDate,quantity:old.planning.quantity,unit:old.planning.unit,baseline:copy(beforeBaseline)},after={start:next.startDate,finish:next.endDate,quantity:p.quantity,unit:p.unit,baseline:copy(p.baseline)};
      p.changes=copy(old.planning.changes||[]);if(!R.equal(before,after)){if(!text(reason))throw Error('Record the reason for changing lookahead dates, scope or previously unrecorded baseline information.');p.changes.push({id:uid(),at:now(),reason,before,after});}
    }return next;
  }
  function reviseConstraint(old,next,{uid,now,reason=''}){next.history=copy(old?.history||[]);if(!old||!R.equal({...old,history:[]},{...next,history:[]}))next.history.push({id:uid(),at:now(),status:next.status,verification:copy(next.verification),resolutionNotes:next.resolutionNotes||'',reason:reason||'Recorded update'});return next;}
  function commitActivity(a,s,fields,{uid,now,day=D.today()}){const readiness=makeReady(a,s,day),p=a.planning||{};return {id:uid(),project:project(a),activityId:a.id,week:fields.week,vis:{site:false,client:false},snapshot:{title:a.main,workPackageId:p.workPackageId||'',scope:fields.scope,quantity:fields.quantity??null,unit:p.unit||'',crew:fields.crew||p.crew||'',responsible:p.supervisor||'',location:p.location||'',start:a.startDate||'',finish:a.endDate||'',completion:fields.completion,committedDate:day,committedAt:now(),criteria:fields.criteria,readiness:readiness.state,blockers:copy(readiness.blockers),acknowledged:!!fields.acknowledged},outcome:{status:'unassessed'},amendments:[],outcomeHistory:[]};}
  function reviseCommitment(old,{outcome,amendment,vis},{uid,now}){const next=copy(old);if(vis)next.vis=vis;if(amendment){if(!text(amendment.reason))throw Error('Record why the weekly plan is being amended.');next.amendments=[...list(next.amendments),{...copy(amendment),id:uid(),at:now()}];}if(outcome&&!R.equal(outcome,old.outcome)){if(old.outcome.status!=='unassessed'&&outcome.status==='unassessed')throw Error('An assessed commitment cannot be removed from PPC by marking it unassessed. Record a corrected outcome.');next.outcomeHistory=[...list(next.outcomeHistory),{id:uid(),at:now(),outcome:copy(old.outcome)}];next.outcome=copy(outcome);}return next;}
  function workingCommitment(c){const result={scope:c.snapshot.scope,quantity:c.snapshot.quantity,unit:c.snapshot.unit,crew:c.snapshot.crew,completion:c.snapshot.completion};for(const change of list(c.amendments))for(const key of ['scope','quantity','crew','completion'])if(change[key]!==''&&change[key]!=null)result[key]=change[key];return result;}
  function ppc(rows){const assessed=rows.filter(c=>['achieved','missed','partial'].includes(c.outcome?.status)),achieved=assessed.filter(c=>c.outcome?.status==='achieved'),missed=assessed.filter(c=>['missed','partial'].includes(c.outcome?.status)),counts={};for(const c of missed){const reason=c.outcome.reason||'Other / unclassified';counts[reason]=(counts[reason]||0)+1;}return {committed:rows.length,assessed:assessed.length,achieved:achieved.length,missed:missed.length,unassessed:rows.length-assessed.length,percent:assessed.length?100*achieved.length/assessed.length:null,reasons:counts};}
  return {categories,statuses,reasons,resourcePanels,evidencePanels,scheduled,daily,packages,addDays,monday,horizon,overlap,clientLookaheadErrors,activityErrors,allocationErrors,constraintErrors,commitmentErrors,validate,activityStatus,progress,makeReady,activities,resourceConflicts,reviseActivity,reviseConstraint,commitActivity,reviseCommitment,workingCommitment,ppc};
});
