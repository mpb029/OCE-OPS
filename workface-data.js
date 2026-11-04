/* WFC-001: deterministic, read-only validation and planning gates. No storage or DOM. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OCEWorkfaceData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const categories = {
    documents: ['Drawings / documents / revisions', ['documents']],
    traffic: ['Traffic management', ['trafficControl', 'documents']],
    services: ['Services / utilities', ['stakeholders', 'documents', 'rfis', 'issuesDelays']],
    materials: ['Materials / deliveries', ['deliveries', 'materialPickup', 'documents']],
    resources: ['Labour / plant / subcontractors', ['subbiesToday', 'plantTransport', 'staffAway', 'siteInputs']],
    quality: ['QA / inspections / testing', ['qualityTesting', 'punchlist', 'documents']],
    decisions: ['RFIs / instructions / decisions', ['rfis', 'designChanges', 'variations', 'meetings', 'documents']],
    evidence: ['Photos / survey / as-built evidence', ['weeklyPhotos', 'documents', 'qualityTesting']],
    progress: ['Progress / constraints', ['dailyWorks', 'upcoming', 'issuesDelays', 'incidents', 'siteInputs']]
  };
  const types = ['Road occupancy / corridor access', 'Traffic management / staging', 'Excavation / road opening', 'Utility-owner authorisation', 'Water / sewer shutdown or connection', 'Environmental', 'Site access / landowner', 'Other'];
  const statuses = { 'not-started':'Not started', submitted:'Submitted', review:'Under review', approved:'Approved', conditional:'Approved with conditions', rejected:'Rejected', revoked:'Suspended / revoked', expired:'Expired', 'not-required':'Not required' };
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const text = v => typeof v === 'string' && !!v.trim();
  const project = x => x?.project || 'default';
  const list = v => Array.isArray(v) ? v : [];
  const packages = s => list(s.panels?.workPackages);
  const lookup = (rows,id) => { const matches = list(rows).filter(x => object(x) && x.id === id); return text(id) && matches.length === 1 ? matches[0] : null; };
  const complete = r => r?.wstatus !== 'cancelled' && (r?.done === true || r?.wstatus === 'completed');
  function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(value+'T00:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0,10) === value;
  }
  function today(now = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  function days(a,b) { return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000); }
  function fields(o, strings, dates, numbers, errors, prefix) {
    for (const k of strings) if (o[k] !== undefined && typeof o[k] !== 'string') errors.push(prefix+': invalid '+k);
    for (const k of dates) if (o[k] !== undefined && o[k] !== '' && !date(o[k])) errors.push(prefix+': invalid '+k+' date');
    for (const k of numbers) if (o[k] !== undefined && o[k] !== null && (!Number.isFinite(o[k]) || o[k] < 0)) errors.push(prefix+': invalid '+k);
    if (o.chainageStart != null && o.chainageEnd != null && o.chainageStart > o.chainageEnd) errors.push(prefix+': end chainage precedes start');
  }
  function unique(rows, key, errors, label) {
    const seen = new Set();
    if (!Array.isArray(rows)) { errors.push(label+': expected a list'); return []; }
    for (const r of rows) { const id = object(r) ? r[key] : r; if (!text(id) || seen.has(id) || ['__proto__','constructor','prototype'].includes(id)) errors.push(label+': invalid or duplicate ID'); seen.add(id); }
    return rows;
  }
  function assessment(a, errors, label) {
    if (!object(a)) { errors.push(label+': assessment is missing'); return; }
    fields(a,['source','reviewer'],['date'],[],errors,label);
    if (!text(a.source) || !text(a.reviewer) || !date(a.date)) errors.push(label+': record assessment source, reviewer and date');
  }
  function workfaceErrors(w,s,refs = true) {
    if (w.workface === undefined) return [];
    const f = w.workface, e = [], label = 'Workface';
    if (!object(f) || f.version !== 1) return ['Workface: unsupported or malformed structure'];
    if (!lookup(s.projects,project(w))) e.push('Workface: project is unavailable');
    if (packages(s).filter(x=>x.id===w.id).length > 1) e.push('Workface: duplicate package ID');
    fields(f,['description','location','activity','asset','responsible'],['plannedStart','plannedEnd'],['chainageStart','chainageEnd'],e,label);
    if (f.plannedStart && f.plannedEnd && f.plannedStart > f.plannedEnd) e.push('Workface: completion date precedes start');
    const links = list(f.links); // A record may be referenced in different categories.
    if (!Array.isArray(f.links)) e.push('Workface: links must be a list');
    const seen = new Set();
    for (const l of links) {
      if (!object(l) || !categories[l.category]?.[1].includes(l.panel) || !text(l.id) || typeof l.completionRequired !== 'boolean') { e.push('Workface: malformed linked record'); continue; }
      const key = l.category+'|'+l.panel+'|'+l.id;
      if (seen.has(key)) e.push('Workface: duplicate linked record'); seen.add(key);
      if (l.completionRequired && ['documents','weeklyPhotos'].includes(l.panel)) e.push('Workface: evidence cannot be treated as a completed task');
      const target = lookup(s.panels?.[l.panel],l.id);
      if (refs && (!target || project(target)!==project(w))) e.push('Workface: missing, ambiguous or cross-project linked record');
    }
    const p = f.permits;
    if (!object(p) || !['unassessed','required','not-required'].includes(p.assessment)) e.push('Workface: invalid permit applicability');
    else {
      const ids = unique(p.ids,'id',e,'Workface approvals');
      if (p.assessment !== 'required' && ids.length) e.push('Workface: only Required applicability may link approvals');
      if (p.assessment === 'not-required') assessment(p,e,'Workface not-required assessment');
      fields(p,['source','reviewer'],['date'],[],e,'Workface permit assessment');
      for (const id of ids) { const target = lookup(s.permits,id); if (refs && (!target || project(target)!==project(w))) e.push('Workface: missing, ambiguous or cross-project approval'); }
    }
    for (const c of unique(f.checks,'id',e,'Readiness checks')) {
      if (!object(c) || !text(c.title) || typeof c.satisfied !== 'boolean') {e.push('Workface: malformed readiness check');continue;}
      fields(c,['title','responsible','evidence'],['due'],[],e,'Readiness check');
      if (c.satisfied && !text(c.evidence)) e.push('Readiness check: satisfaction evidence is required');
    }
    return [...new Set(e)];
  }
  function permitErrors(p,s,refs = true) {
    const e = [];
    if (!object(p)) return ['Approval: invalid record'];
    if (!text(p.id) || !text(p.title) || !lookup(s.projects,p.project) || !types.includes(p.type) || !Object.hasOwn(statuses,p.status)) e.push('Approval: valid ID, project, title, type and status are required');
    fields(p,['title','description','issuer','reference','source','responsible','location','activity','restrictions','workingWindows','correspondence','reviewer','notes'],['submittedDate','approvalDate','effectiveDate','expiryDate'],['chainageStart','chainageEnd'],e,'Approval');
    if (p.effectiveDate && p.expiryDate && p.effectiveDate > p.expiryDate) e.push('Approval: expiry precedes effective date');
    if (!object(p.vis) || typeof p.vis.site !== 'boolean' || typeof p.vis.client !== 'boolean') e.push('Approval: explicit Site/Client visibility is required');
    if (p.status === 'not-required') assessment(p.assessment,e,'Approval not-required assessment');
    if (p.assessment !== undefined && !object(p.assessment)) e.push('Approval: malformed assessment');
    else if (p.assessment) fields(p.assessment,['source','reviewer'],['date'],[],e,'Approval assessment');
    if (p.document !== undefined && p.document !== null) {
      if (!object(p.document) || p.document.panel !== 'documents' || !text(p.document.id)) e.push('Approval: invalid document reference');
      else {const d=lookup(s.panels?.documents,p.document.id);if(refs&&(!d||project(d)!==p.project))e.push('Approval: missing or cross-project document');}
    }
    for (const c of unique(p.conditions,'id',e,'Approval conditions')) {
      if (!object(c) || !text(c.text) || typeof c.required !== 'boolean' || typeof c.verified !== 'boolean') {e.push('Approval: malformed condition');continue;}
      fields(c,['text','evidence','reviewer'],['date','due'],[],e,'Condition');
      if (c.verified) assessment({source:c.evidence,reviewer:c.reviewer,date:c.date},e,'Condition verification');
    }
    for (const c of unique(p.coverage,'workfaceId',e,'Approval coverage')) {
      if (!object(c) || !text(c.workfaceId) || typeof c.verified !== 'boolean') {e.push('Approval: malformed coverage');continue;}
      fields(c,['source','reviewer','scope'],['date'],[],e,'Coverage');
      if (c.verified) assessment(c,e,'Coverage verification');
      const w=lookup(packages(s),c.workfaceId);
      if(refs&&(!w||project(w)!==p.project))e.push('Approval: missing or cross-project workface coverage');
    }
    return [...new Set(e)];
  }
  function validate(s) {
    const e=[];
    if(s.permits!==undefined) for(const p of unique(s.permits,'id',e,'Approvals'))e.push(...permitErrors(p,s));
    for(const w of packages(s))e.push(...workfaceErrors(w,s));
    return [...new Set(e)];
  }
  // Shared WP1 dependency validation; the original form and planning use one rule.
  function dependencyIssues(root,s) {
    const issues=[],active=new Set(),visited=new Set(),stack=[{item:root}];
    const issue=(item,reason,dependency)=>issues.push({item,reason,dependency});
    while(stack.length){
      const {item,exit}=stack.pop();if(exit){active.delete(item);visited.add(item);continue;}
      if(active.has(item)){issue(item,'Circular prerequisite dependency');continue;}if(visited.has(item))continue;
      active.add(item);stack.push({item,exit:true});const ids=item.prerequisiteIds===undefined?[]:item.prerequisiteIds;
      if(!Array.isArray(ids)){issue(item,'Invalid prerequisite list');continue;}const seen=new Set();
      for(const id of ids){if(!text(id)){issue(item,'Invalid prerequisite ID');continue;}if(id===item.id){issue(item,'A package cannot depend on itself');continue;}if(seen.has(id)){issue(item,'Duplicate prerequisite');continue;}seen.add(id);
        const saved=lookup(packages(s),id),dependency=saved&&id===root.id?root:saved;
        if(!dependency){issue(item,'Missing or ambiguous prerequisite: '+id);continue;}
        if(!lookup(s.projects,project(item))||!lookup(s.projects,project(dependency))){issue(item,'Prerequisite project is missing or invalid',dependency);continue;}
        if(project(dependency)!==project(item)){issue(item,'Prerequisite belongs to a different project',dependency);continue;}stack.push({item:dependency});
      }
    }return issues;
  }
  function coverageScope(p,w) {
    const f=w?.workface||{};
    // Evidence is tied to exact recorded scope, not an inferred geographic match.
    return JSON.stringify([p.project,p.location,p.activity,p.chainageStart,p.chainageEnd,p.restrictions,p.workingWindows,p.effectiveDate,p.expiryDate,
      project(w),f.location,f.activity,f.asset,f.chainageStart,f.chainageEnd,f.plannedStart,f.plannedEnd].map(v=>v==null||v===''?null:v));
  }
  function permitGate(p,w,s,day=today()) {
    const reasons=permitErrors(p,s), f=w.workface;
    if(!date(day))return ['Invalid evaluation date'];
    if (!p || reasons.length) return reasons.length?reasons:['Approval unavailable'];
    if (p.project!==project(w)) reasons.push('Approval belongs to another project');
    if (!['approved','conditional','not-required'].includes(p.status)) reasons.push('Approval is '+statuses[p.status]);
    if (p.status === 'not-required') {
      if(p.assessment?.date>day)reasons.push('Not-required assessment is dated in the future');
      // An assessed exemption may itself have recorded effective/expiry limits.
      if(p.effectiveDate&&(p.effectiveDate>day||(f?.plannedStart&&p.effectiveDate>f.plannedStart)))reasons.push('Assessment is not yet effective for this work');
      if(p.expiryDate&&(p.expiryDate<day||(f?.plannedEnd&&p.expiryDate<f.plannedEnd)||(f?.plannedStart&&p.expiryDate<f.plannedStart)))reasons.push('Assessment expires before the work or is expired');
    } else if (['approved','conditional'].includes(p.status)) {
      if (!text(p.issuer) || !text(p.source) || (!text(p.reference) && !p.document)) reasons.push('Recorded authority, source and approval reference / document are required');
      if (!date(p.approvalDate) || p.approvalDate>day) reasons.push('Approval date is missing or in the future');
      if (!date(p.effectiveDate)) reasons.push('Effective date is not recorded');
      else if (p.effectiveDate>day || (f?.plannedStart && p.effectiveDate>f.plannedStart)) reasons.push('Approval is not yet effective for this work');
      if (p.expiryDate && (p.expiryDate<day || (f?.plannedEnd && p.expiryDate<f.plannedEnd) || (f?.plannedStart && p.expiryDate<f.plannedStart))) reasons.push('Approval expires before the work or is expired');
      if (p.status==='conditional' && !p.conditions.length) reasons.push('Approval conditions have not been recorded');
    }
    const coverage = list(p.coverage).find(c=>c.workfaceId===w.id);
    if (!coverage?.verified || !text(coverage.source) || !text(coverage.reviewer) || !date(coverage.date) || coverage.date>day) reasons.push('Activity, location and working-window coverage is not verified');
    else if (coverage.scope!==coverageScope(p,w)) reasons.push('Workface or approval scope changed; reverify coverage');
    if (p.chainageStart!=null && (f?.chainageStart==null || f.chainageStart<p.chainageStart)) reasons.push('Start chainage is outside or not verified against approval coverage');
    if (p.chainageEnd!=null && (f?.chainageEnd==null || f.chainageEnd>p.chainageEnd)) reasons.push('End chainage is outside or not verified against approval coverage');
    for (const c of list(p.conditions)) if (c.required && (!c.verified || !text(c.evidence) || !text(c.reviewer) || !date(c.date) || c.date>day)) reasons.push('Condition not verified: '+c.text+(c.reviewer?' — '+c.reviewer:'')+(c.due?' · required '+c.due:''));
    return [...new Set(reasons)];
  }
  function evaluate(w,s,day=today()) {
    if(w.workface===undefined)return {configured:false,reasons:[],permits:[],warnings:[]};
    const reasons=workfaceErrors(w,s).map(text=>({text})), permits=[], warnings=[];
    const f=object(w.workface)?w.workface:{};
    if(f.permits?.assessment==='unassessed') reasons.push({text:'Permit / approval applicability has not been assessed'});
    if(f.permits?.assessment==='not-required' && f.permits.date>day)reasons.push({text:'Permit applicability assessment is dated in the future'});
    if(f.permits?.assessment==='required' && !list(f.permits.ids).length)reasons.push({text:'Required approvals have not been linked'});
    for(const id of list(f.permits?.ids)) {
      const p=lookup(s.permits,id), problems=p?permitGate(p,w,s,day):['Required approval is missing or ambiguous'];
      permits.push({id,record:p,reasons:problems});
      problems.forEach(text=>reasons.push({text,permitId:id}));
      if(p?.expiryDate && date(p.expiryDate) && days(day,p.expiryDate)>=0 && days(day,p.expiryDate)<=14)warnings.push({text:'Expires '+p.expiryDate+' (within 14 calendar days)',permitId:id});
    }
    for(const l of list(f.links)) {
      const target=lookup(s.panels?.[l?.panel],l?.id);
      if(l?.completionRequired && !complete(target))reasons.push({text:'Linked task is not completed',link:l});
    }
    for(const c of list(f.checks)) if(object(c)&&!c.satisfied)reasons.push({text:c.title+(c.responsible?' — '+c.responsible:'')+(c.due?' · required '+c.due:'')});
    return {configured:true,reasons,permits,warnings};
  }
  return {categories,types,statuses,object,text,list,project,lookup,complete,date,today,days,workfaceErrors,permitErrors,validate,dependencyIssues,coverageScope,permitGate,evaluate};
});
