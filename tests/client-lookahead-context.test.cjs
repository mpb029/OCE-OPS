const test=require('node:test'),assert=require('node:assert/strict'),C=require('../planning-lookahead.js'),P=require('../planning-data.js'),D=require('../workface-data.js'),F=require('./client-lookahead-fixture.cjs');
const options=b=>({clientId:'client-a',from:'2026-10-12',weeks:2,day:'2026-10-13',now:()=> '2026-10-13T01:00:00Z',assigned:(p,id)=>p.clients?.includes(id),visible:(panel,r)=>!!b.panelVis?.[panel]?.client&&r.vis?.client===true&&!r.resolvedAt});
test('Coordination is a read-only allowlist over explicitly shared linked records',()=>{
 const b=F.board(),before=structuredClone(b),v=C.projection(b,options(b));assert.equal(v.subcontractors.length,1);assert.equal(v.permits.length,1);assert.equal(v.approvals.length,1);assert.equal(v.milestones.length,1);
 assert.equal(v.subcontractors[0].onsite,'2026-10-14');assert.equal(v.permits[0].status,'Under review');assert.equal(v.approvals[0].requirements.length,2);assert.equal(v.milestones[0].date,'2026-10-15');
 assert.doesNotMatch(JSON.stringify(v),/PRIVATE|"(?:resourceRefs|coverage|conditions|responsible|evidence|baseline)"\s*:/);assert.deepEqual(b,before);
});
test('Legacy flags default to no extra sharing; unknown compatible metadata is retained',()=>{
 const b=F.board(),p=b.panels.upcoming[0].planning;
 delete p.clientLookahead.shareSubcontractors;delete p.clientLookahead.sharePermits;delete p.clientLookahead.shareApprovals;p.clientLookahead.milestone=false;p.clientLookahead.future={keep:true};
 const v=C.projection(b,options(b));for(const key of ['subcontractors','permits','approvals','milestones'])assert.deepEqual(v[key],[]);assert.deepEqual(P.activityErrors(b.panels.upcoming[0],b),[]);
 for(const key of ['shareSubcontractors','sharePermits','shareApprovals']){p.clientLookahead[key]='yes';assert.ok(P.activityErrors(b.panels.upcoming[0],b).length);assert.equal(C.projection(b,options(b)).activities.length,0);delete p.clientLookahead[key];}
});
test('Project, activity, source panel/item and workface restrictions remove stale context',()=>{
 const base=F.board();
 for(const alter of [b=>b.projects[0].clients=[],b=>b.panels.upcoming[0].vis.client=false,b=>b.panels.upcoming[0].planning.clientLookahead.enabled=false]){
  const b=structuredClone(base);alter(b);const v=C.projection(b,options(b));for(const key of ['subcontractors','permits','approvals','milestones'])assert.equal(v[key].length,0);
 }
 for(const [panel,key]of [['subbiesToday','subcontractors'],['workPackages','permits']]){const b=structuredClone(base);b.panelVis[panel].client=false;assert.equal(C.projection(b,options(b))[key].length,0);}
 const b=structuredClone(base);b.permits[0].vis.client=false;b.panels.rfis[0].vis.client=false;const v=C.projection(b,options(b));assert.equal(v.permits.length,0);assert.equal(v.approvals.length,0);assert.ok(!JSON.stringify(v).includes('Synthetic shutdown permit'));
 b.panels.subbiesToday[0].project='east';assert.equal(C.projection(b,options(b)).subcontractors.length,0);
});
test('References deduplicate and malformed, duplicate, cross-project or retired sources fail closed',()=>{
 const b=F.board(),a=b.panels.upcoming[0];a.planning.resourceRefs.push(...a.planning.resourceRefs);b.panels.workPackages[0].workface.permits.ids.push('permit-a');let v=C.projection(b,options(b));assert.equal(v.subcontractors.length,1);assert.equal(v.permits.length,1);
 const second=structuredClone(a);second.id='second';b.panels.upcoming.push(second);v=C.projection(b,options(b));assert.equal(v.subcontractors.length,1);assert.equal(v.subcontractors[0].works.length,2);
 b.panels.subbiesToday.push(structuredClone(b.panels.subbiesToday[0]));assert.equal(C.projection(b,options(b)).subcontractors.length,0);
 b.permits.push(structuredClone(b.permits[0]));assert.equal(C.projection(b,options(b)).permits.length,0);
});
test('Onsite dates and milestone dates respect the period; completed/cancelled work is not anticipated',()=>{
 const b=F.board();b.panels.subbiesToday[0].due='2026-11-01';assert.equal(C.projection(b,options(b)).subcontractors.length,0);delete b.panels.subbiesToday[0].due;assert.equal(C.projection(b,options(b)).subcontractors[0].onsite,'');
 b.panels.upcoming[0].endDate='2026-11-01';assert.equal(C.projection(b,options(b)).milestones.length,0);
 b.panels.upcoming[0].endDate='2026-10-15';for(const status of ['completed','cancelled']){b.panels.upcoming[0].wstatus=status;const v=C.projection(b,options(b));assert.equal(v.milestones.length,0);assert.equal(v.approvals.length,0);}
});
test('Pending work reuses the existing approval gate and explicitly required decision completion',()=>{
 const b=F.board(),p=b.permits[0],face=b.panels.workPackages[0];p.status='approved';p.conditions=[];p.coverage=b.panels.workPackages.slice(0,2).map(w=>({workfaceId:w.id,verified:true,source:'Synthetic assessment',reviewer:'Synthetic reviewer',date:'2026-10-12',scope:D.coverageScope(p,w)}));
 b.panels.rfis[0].wstatus='completed';assert.equal(P.makeReady(b.panels.upcoming[0],b,'2026-10-13').blockers.filter(x=>x.panel==='permits').length,0);assert.equal(C.projection(b,options(b)).approvals.length,0);
 p.expiryDate='2026-10-14';assert.ok(P.makeReady(b.panels.upcoming[0],b,'2026-10-13').blockers.some(x=>x.panel==='permits'));assert.equal(C.projection(b,options(b)).approvals.length,1);
 p.vis.client=false;b.panels.rfis[0].wstatus='pending';face.workface.links[0].completionRequired=false;assert.equal(C.projection(b,options(b)).approvals.length,0);
});
test('Empty sections are accurately labelled and all recorded text is escaped',()=>{
 const b=F.board();b.panels.subbiesToday[0].main='<script>bad</script>';const html=C.html(C.projection(b,options(b)));
 for(const heading of ['Subcontractors onsite','Permits &amp; approvals required','Works awaiting approval / decision','Anticipated milestones'])assert.ok(html.includes(heading)||html.includes(heading.replace('&amp;','&')));
 assert.ok(html.includes('&lt;script&gt;bad&lt;/script&gt;'));assert.doesNotMatch(html,/<script>bad|PRIVATE|<button/);
 b.panelVis.subbiesToday.client=false;assert.match(C.html(C.projection(b,options(b))),/No linked Client-visible entries shared/);
 b.panels.upcoming=[];assert.doesNotMatch(C.html(C.projection(b,options(b))),/class="cl-coordination"/);
});

test('A required approval with no linked record stays explicitly pending without inventing a permit',()=>{const b=F.board();b.panels.workPackages[0].workface.permits.ids=[];b.panels.workPackages[0].workface.links=[];const v=C.projection(b,options(b));assert.equal(v.permits.length,0);assert.equal(v.approvals.length,1);assert.equal(v.approvals[0].requirements[0].title,'Required approval not yet linked');});
