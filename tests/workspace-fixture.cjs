// Fully synthetic board for navigation tests and review captures. No operational data.
module.exports = function workspaceFixture() {
  const titles = {
    dailyWorks:'Install watermain · Chainage 240–300', deliveries:'DN300 pipe delivery · Laydown north', trafficControl:'Lane closure · Northbound shoulder', upcoming:'Pressure test · Section 2',
    subbiesToday:'Survey crew · Set out tie-in', staffAway:'Site engineer · Training Friday', siteInputs:'Confirm shutdown window', plantTransport:'20 t excavator · Transfer to north workfront',
    stakeholders:'Resident liaison · Access arrangements', punchlist:'Reinstate verge at crossing', materialPickup:'Collect trench shields', meetings:'Weekly coordination · Site office',
    documents:'Construction notes', weeklyPhotos:'Week 42 · Progress photos', workPackages:'Watermain renewal · Northern section', qualityTesting:'Compaction testing · Lot 04',
    designChanges:'Valve chamber detail · Revision C', variations:'Additional service crossing', issuesDelays:'Existing service depth requires confirmation', rfis:'Confirm tie-in fitting arrangement', incidents:'Minor equipment damage · Inspected'
  };
  const panels = Object.fromEntries(Object.entries(titles).map(([id,main])=>[id,[{
    id:'demo-'+id,project:'default',main,sub:'Synthetic review record · North workfront',team:'eng',due:'2026-10-15',dateAssigned:'2026-10-13',dateRequired:'2026-10-15',wstatus:'inprogress',
    vis:{site:true,client:true},createdAt:'2026-10-12T00:00:00Z',updatedAt:'2026-10-13T00:00:00Z',
    x:{date:'2026-10-14',time:'07:00',contact:'Review crew',folderDate:'2026-10-13'},photos:[]
  }]]));
  panels.dailyWorks.push({id:'demo-daily-2',project:'default',main:'Prepare bedding · Crossing 3',sub:'Pipe crew · Hold point before backfill',team:'pipe',wstatus:'pending',vis:{site:true,client:false}});
  panels.dailyWorks.push({id:'demo-east-only',project:'east',main:'East project · Drainage set out',sub:'Synthetic East record',vis:{site:true,client:true}});
  panels.workPackages[0].pct = 40;
  panels.upcoming[0].startDate = '2026-10-14'; panels.upcoming[0].endDate = '2026-10-16';
  panels.qualityTesting[0].status = 'pending'; panels.punchlist[0].priority = 'high'; panels.punchlist[0].status = 'open';
  panels.documents = [{id:'demo-document',project:'default',name:'Synthetic construction notes.txt',size:160,mime:'text/plain',path:'tests/fixture-file.txt',url:'tests/fixture-file.txt',vis:{site:true,client:true}}];
  panels.weeklyPhotos[0].photos = [{name:'Synthetic progress image.png',url:'tests/fixture-image.png',path:'tests/fixture-image.png',mime:'image/png'}];
  return {
    settings:{projectName:'SYNTHETIC REVIEW · Civil works',loc:{name:'Synthetic review location',lat:-25.906,lng:153.088},geojsonCRS:'auto',siteKey:'test-site',editPass:''},
    clients:[{id:'default',name:'Review Client A',key:'test-client-0'},{id:'client-b',name:'Review Client B',key:'test-client-1'}],
    projects:[{id:'default',name:'North workfront · Watermain renewal',clients:['default']},{id:'east',name:'East workfront · Drainage upgrade',clients:['client-b']}],
    base:'street',markers:[{id:'demo-marker',project:'default',cat:'dig',title:'Synthetic workfront',notes:'Review-only marker',lat:-25.9055,lng:153.087,vis:{site:true,client:false}}],
    stats:[{id:'demo-stat',label:'Pipe installed · Board total',value:'240',target:600,unit:'m',bar:true,fields:[{label:'Crew size',value:'6'},{label:'Shift hours',value:'8'}],vis:{site:true,client:true}}],
    panels,mapLayers:[],models:[],panelVis:Object.fromEntries(Object.keys(titles).map(id=>[id,{site:!['variations','designChanges'].includes(id),client:['dailyWorks','upcoming','workPackages','qualityTesting','documents','weeklyPhotos','rfis'].includes(id)}])),
    panelMeta:{dailyWorks:{updated:'2026-10-13T00:00:00Z'},upcoming:{updated:'2026-10-12T00:00:00Z'}},history:{},
    projectSummary:{default:{status:'green',statusComment:'Workfront progressing to plan',stage:'Pipe installation',compType:'approx',comp:'October 2026',milestone:'Section 2 pressure test · Thursday',achievement:'First 240 m installed',clientAction:'Confirm shutdown window',risk:'Service depth at crossing 3',impacts:'Northbound shoulder closure',scope:'Synthetic watermain renewal project'},east:{status:'amber',stage:'Set out',statusComment:'Awaiting survey confirmation'}},publishedAt:'2026-10-13T00:00:00Z'
  };
};
