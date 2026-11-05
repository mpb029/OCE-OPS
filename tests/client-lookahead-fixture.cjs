// Synthetic published coordination records; no operational input.
const F=require('./planning-fixture.cjs');
function board(){
 const b=F.board();b.clients=[{id:'client-a',name:'Synthetic Council',key:'test-client-0'}];b.projects[0].clients=['client-a'];b.projects[0].name='Synthetic G12 Renewal — TEST DATA';
 b.publishedAt='2026-10-13T00:00:00Z';
 Object.assign(b.panelVis,{subbiesToday:{site:true,client:true},rfis:{site:true,client:true},designChanges:{site:true,client:true}});
 const a=b.panels.upcoming[0];a.main='CLIENT WORK 001 — Wet well connection';a.planning.clientLookahead={version:1,enabled:true,milestone:true,notes:'Shared access window',shareSubcontractors:true,sharePermits:true,shareApprovals:true};
 a.planning.notes='PRIVATE INTERNAL COMMENT';a.planning.resourceRefs=[{panel:'subbiesToday',id:'contractor-client'}];
 b.panels.subbiesToday=[{id:'contractor-client',project:'default',main:'Synthetic Civil Crew',due:'2026-10-14',vis:{site:true,client:true},x:{works:'PRIVATE RESOURCE DETAIL',contact:'PRIVATE PHONE'},sub:'PRIVATE LABOUR NOTE'}];
 b.panels.rfis=[{id:'decision-client',project:'default',main:'Confirm shutdown access',ref:'RFI-TEST-01',wstatus:'pending',sub:'PRIVATE DESIGN DISCUSSION',vis:{site:true,client:true}}];
 b.panels.workPackages[0].workface.links.push({category:'decisions',panel:'rfis',id:'decision-client',completionRequired:true});
 b.permits[0].title='Synthetic shutdown permit';b.permits[0].status='review';b.permits[0].notes='PRIVATE PERMIT NOTE';b.permits[0].responsible='PRIVATE OFFICER';b.permits[0].conditions=[{id:'condition-test',text:'PRIVATE CONDITION',required:true,verified:false,evidence:'',reviewer:'',date:''}];
 return b;
}
module.exports={board};
