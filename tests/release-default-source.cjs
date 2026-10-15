// Exact approved release-default and G1 navigation reversals for historical parity.
// Complete literal hunks only: no wildcard removal and no assertion changes.
const assert=require('node:assert/strict');
const defaultPatches=[
  [
    " * Opt in with ?ui=workspaces; remove it or choose Original board to opt out.",
    " * Workspaces are the default; ?ui=classic or Original board restores the original view."
  ],
  [
    "footer.append(original,element('p','','Stage C2 · opt-in workspaces'));",
    "footer.append(original,element('p','','Operations workspace'));"
  ],
  [
    "enabled = new URL(location.href).searchParams.get('ui') === 'workspaces';",
    "enabled = new URL(location.href).searchParams.get('ui') !== 'classic';"
  ],
  [
    "if (url.searchParams.get('ui') === 'workspaces') setProject",
    "if (url.searchParams.get('ui') !== 'classic') setProject"
  ]
];
const g1Patches=[
  [
    "  if (!grid || !project || !wrap) return;\n  let enabled = false, active = 'all', cards = [], available = [], collapsed = false;\n  let restoring = false, initialRoute = true, pending = false, scrollTimer, resizeFrame;\n  let lastProject = project.value, drawerReturn = null, poppedURL = '', lastLayout = '';\n  const desktop = matchMedia('(min-width: 1200px)');\n  const phone = matchMedia('(max-width: 680px)');\n",
    "  if (!grid || !project || !wrap) return;\n  let enabled = false, active = 'all', cards = [], available = [], collapsed = false;\n  let restoring = false, initialRoute = true, pending = false, scrollTimer, resizeFrame;\n  let highlightedRecord = null, highlightTimer;\n  let lastProject = project.value, drawerReturn = null, poppedURL = '', lastLayout = '';\n  const desktop = matchMedia('(min-width: 1200px)');\n  const phone = matchMedia('(max-width: 680px)');\n"
  ],
  [
    "    if (['#panelsGrid','#summaryCard','#prodStatsCard'].includes(hash)) return 'all';\n    return null;\n  };\n  function routeURL(workspace, target = '', optIn = true) {\n    const url = new URL(location.href);\n    url.searchParams.set('ui',optIn ? 'workspaces' : 'classic');\n    if (optIn) {\n      url.searchParams.set('workspace',workspace);\n      if (project.value) url.searchParams.set('workspaceProject',project.value);\n",
    "    if (['#panelsGrid','#summaryCard','#prodStatsCard'].includes(hash)) return 'all';\n    return null;\n  };\n  function routeURL(workspace, target = '', optIn = true, record = '') {\n    const url = new URL(location.href);\n    url.searchParams.set('ui',optIn ? 'workspaces' : 'classic');\n    if (optIn && record) url.searchParams.set('workspaceRecord',record);\n    else url.searchParams.delete('workspaceRecord');\n    if (optIn) {\n      url.searchParams.set('workspace',workspace);\n      if (project.value) url.searchParams.set('workspaceProject',project.value);\n"
  ],
  [
    "    else if (targetWorkspace(url.hash)) url.hash = '';\n    return url;\n  }\n  function link(text, workspace, target, cls = '') {\n    const a = element('a',cls,text); a.href = routeURL(workspace,target).href;\n    a.dataset.wsRoute = workspace; if (target) a.dataset.wsTarget = target; return a;\n  }\n\n",
    "    else if (targetWorkspace(url.hash)) url.hash = '';\n    return url;\n  }\n  function link(text, workspace, target, cls = '', record = '') {\n    const a = element('a',cls,text); a.href = routeURL(workspace,target,true,record).href;\n    if (record) a.dataset.wsRecord = record;\n    a.dataset.wsRoute = workspace; if (target) a.dataset.wsTarget = target; return a;\n  }\n\n"
  ],
  [
    "    const d = destinations.find(d => d.id === active);\n    cards.forEach(c => c.toggleAttribute('data-ws-suppressed',active !== 'all' && !d.panels.includes(c.dataset.card)));\n    placeholder.hidden = active !== 'overview';\n    if (active === 'overview') window.OCEOverview.render(placeholder,(label,id,cls) => {\n      const target = ['summaryCard','prodStatsCard','mapCard'].includes(id) ? '#'+id : '#activity-'+id;\n      return link(label,targetWorkspace(target),target,cls);\n    });\n    else placeholder.replaceChildren();\n    renderNavigation();\n",
    "    const d = destinations.find(d => d.id === active);\n    cards.forEach(c => c.toggleAttribute('data-ws-suppressed',active !== 'all' && !d.panels.includes(c.dataset.card)));\n    placeholder.hidden = active !== 'overview';\n    if (active === 'overview') window.OCEOverview.render(placeholder,(label,id,cls,record) => {\n      const target = ['summaryCard','prodStatsCard','mapCard'].includes(id) ? '#'+id : '#activity-'+id;\n      return link(label,targetWorkspace(target),target,cls,record);\n    });\n    else placeholder.replaceChildren();\n    renderNavigation();\n"
  ],
  [
    "    restoring = false;\n  }\n  function scrollToRoute(target, y, focus) {\n    requestAnimationFrame(() => {\n      const el = usableTarget(target || '');\n      if (typeof y === 'number' && !focus) scrollTo(0,y);\n      else if (el) {\n        if (!field.scrollTarget(el)) el.scrollIntoView({block:'start'});\n        if (focus) { el.tabIndex = -1; el.focus({preventScroll:true}); }\n      } else { scrollTo(0,y || 0); if (focus) title.focus({preventScroll:true}); }\n    });\n  }\n  function refresh() {\n    pending = false;\n    enabled = new URL(location.href).searchParams.get('ui') === 'workspaces';\n    const url = new URL(location.href);\n    const savedEntry = entry();\n    // Do not canonicalise deep links against the temporary, locked startup board.\n    if (!project.options.length || body.classList.contains('locked')) { chrome.forEach(el => {el.hidden = true;}); placeholder.replaceChildren(); return; }\n    if (enabled && initialRoute) setProject(url.searchParams.get('workspaceProject') || entry()?.project);\n",
    "    restoring = false;\n  }\n  function scrollToRoute(target, y, focus) {\n    const href = location.href;\n    requestAnimationFrame(() => {\n      if (href !== location.href) return;\n      const panel = usableTarget(target || '');\n      const recordId = new URL(location.href).searchParams.get('workspaceRecord');\n      let record = null;\n      if (panel?.dataset.card && recordId) document.dispatchEvent(new CustomEvent('oce:record-target', {\n        detail:{panelId:panel.dataset.card,recordId,accept:node => {record = node;}}\n      }));\n      const el = record || panel;\n      if (panel?.dataset.card && recordId) field.expand(panel);\n      clearRecordHighlight();\n      if (record) {\n        highlightedRecord = record; record.classList.add('ws-record-target');\n        highlightTimer = setTimeout(clearRecordHighlight,2400);\n      } else if (recordId) {\n        const url = new URL(location.href); url.searchParams.delete('workspaceRecord');\n        history.replaceState(history.state,'',url);\n      }\n      if (typeof y === 'number' && !focus && !recordId) scrollTo(0,y);\n      else if (el) {\n        if (!field.scrollTarget(el)) el.scrollIntoView({block:'start'});\n        if (focus) { el.tabIndex = -1; el.focus({preventScroll:true}); }\n      } else { scrollTo(0,y || 0); if (focus) title.focus({preventScroll:true}); }\n    });\n  }\n  function clearRecordHighlight() {\n    clearTimeout(highlightTimer); highlightedRecord?.classList.remove('ws-record-target'); highlightedRecord = null;\n  }\n  function refresh() {\n    pending = false;\n    enabled = new URL(location.href).searchParams.get('ui') === 'workspaces';\n    const url = new URL(location.href);\n    const savedEntry = entry();\n    // Record links must not be rejected against the temporary startup board.\n    // The existing read-only adapter stays unavailable until published data is ready.\n    if (enabled && initialRoute && url.searchParams.has('workspaceRecord')) {\n      let ready = false;\n      document.dispatchEvent(new CustomEvent('oce:overview-read',{detail:{accept:() => {ready = true;}}}));\n      if (!ready) { chrome.forEach(el => {el.hidden = true;}); return; }\n    }\n    // Do not canonicalise deep links against the temporary, locked startup board.\n    if (!project.options.length || body.classList.contains('locked')) { chrome.forEach(el => {el.hidden = true;}); placeholder.replaceChildren(); return; }\n    if (enabled && initialRoute) setProject(url.searchParams.get('workspaceProject') || entry()?.project);\n"
  ],
  [
    "    lastProject = project.value;\n    present();\n    if (enabled) {\n      const canonical = routeURL(active,target ? url.hash : '');\n      if (!target && /^#activity-|^#modelCard$/.test(url.hash)) canonical.hash = '';\n      history.replaceState({...history.state,oceWorkspace:{workspace:active,project:lastProject,scrollY:entry()?.scrollY || 0,target:target ? url.hash : ''}},'',canonical);\n      if (initialRoute) scrollToRoute(target ? url.hash : '',savedEntry?.scrollY,false);\n",
    "    lastProject = project.value;\n    present();\n    if (enabled) {\n      const canonical = routeURL(active,target ? url.hash : '',true,target ? url.searchParams.get('workspaceRecord') : '');\n      if (!target && /^#activity-|^#modelCard$/.test(url.hash)) canonical.hash = '';\n      history.replaceState({...history.state,oceWorkspace:{workspace:active,project:lastProject,scrollY:entry()?.scrollY || 0,target:target ? url.hash : ''}},'',canonical);\n      if (initialRoute) scrollToRoute(target ? url.hash : '',savedEntry?.scrollY,false);\n"
  ],
  [
    "  function scheduleRefresh() {\n    if (!pending) { pending = true; queueMicrotask(refresh); }\n  }\n  function navigate(workspace, target = '', optIn = true) {\n    clearTimeout(scrollTimer); remember(); closeDrawer();\n    const url = routeURL(workspace,target,optIn);\n    history.pushState({...history.state,oceWorkspace:{workspace,project:project.value,scrollY:0,target}},'',url);\n    refresh(); scrollToRoute(target,0,optIn);\n  }\n",
    "  function scheduleRefresh() {\n    if (!pending) { pending = true; queueMicrotask(refresh); }\n  }\n  function navigate(workspace, target = '', optIn = true, record = '') {\n    clearTimeout(scrollTimer); clearRecordHighlight(); remember(); closeDrawer();\n    const url = routeURL(workspace,target,optIn,record);\n    history.pushState({...history.state,oceWorkspace:{workspace,project:project.value,scrollY:0,target}},'',url);\n    refresh(); scrollToRoute(target,0,optIn);\n  }\n"
  ],
  [
    "    if (a === optIn) { event.preventDefault(); navigate('overview'); return; }\n    if (a === original) { event.preventDefault(); navigate('all','',false); return; }\n    if (!enabled) return;\n    if (a.dataset.wsRoute) { event.preventDefault(); navigate(a.dataset.wsRoute,a.dataset.wsTarget || ''); return; }\n    const url = new URL(a.href,location.href);\n    if (url.origin === location.origin && url.pathname === location.pathname && usableTarget(url.hash)) {\n      event.preventDefault(); navigate(targetWorkspace(url.hash),url.hash);\n    }\n  });\n  project.addEventListener('change',() => {\n    if (!enabled || restoring) return;\n    remember();\n    history.pushState({...history.state,oceWorkspace:{workspace:active,project:project.value,scrollY:scrollY,target:''}},'',routeURL(active));\n    lastProject = project.value; scheduleRefresh();\n",
    "    if (a === optIn) { event.preventDefault(); navigate('overview'); return; }\n    if (a === original) { event.preventDefault(); navigate('all','',false); return; }\n    if (!enabled) return;\n    if (a.dataset.wsRoute) { event.preventDefault(); navigate(a.dataset.wsRoute,a.dataset.wsTarget || '',true,a.dataset.wsRecord || ''); return; }\n    const url = new URL(a.href,location.href);\n    if (url.origin === location.origin && url.pathname === location.pathname && usableTarget(url.hash)) {\n      event.preventDefault(); navigate(targetWorkspace(url.hash),url.hash,true,url.searchParams.get('workspaceRecord') || '');\n    }\n  });\n  project.addEventListener('change',() => {\n    if (!enabled || restoring) return;\n    clearRecordHighlight();\n    remember();\n    history.pushState({...history.state,oceWorkspace:{workspace:active,project:project.value,scrollY:scrollY,target:''}},'',routeURL(active));\n    lastProject = project.value; scheduleRefresh();\n"
  ],
  [
    "  window.visualViewport?.addEventListener('resize',viewport);\n  window.visualViewport?.addEventListener('scroll',viewport);\n  addEventListener('resize',viewport);\n  return {scrollTarget(target){\n    if(!active || !target.hasAttribute('data-card')) return false;\n    // Align after stylesheet/fonts and their layout frame. An earlier document\n    // limit can clamp an initial anchor while viewer/layout sizing is pending.\n    const request=++alignment,href=location.href;\n    layoutReady.then(()=>document.fonts.ready).then(()=>requestAnimationFrame(()=>{\n      if(request!==alignment || !active || !target.isConnected || href!==location.href) return;\n      const margin=parseFloat(getComputedStyle(target).scrollMarginTop) || 0;\n      scrollTo(0,Math.max(0,scrollY+target.getBoundingClientRect().top-margin));\n    }));\n    return true;\n",
    "  window.visualViewport?.addEventListener('resize',viewport);\n  window.visualViewport?.addEventListener('scroll',viewport);\n  addEventListener('resize',viewport);\n  return {expand:card=>disclosure(card,true),scrollTarget(target){\n    const card = target.closest('[data-card]');\n    if(!active || !card) return false;\n    // Align after stylesheet/fonts and their layout frame. An earlier document\n    // limit can clamp an initial anchor while viewer/layout sizing is pending.\n    const request=++alignment,href=location.href;\n    layoutReady.then(()=>document.fonts.ready).then(()=>requestAnimationFrame(()=>{\n      if(request!==alignment || !active || !target.isConnected || href!==location.href) return;\n      const margin=(parseFloat(getComputedStyle(card).scrollMarginTop) || 0) + (target === card ? 0 : card.querySelector('.card-head').getBoundingClientRect().height + 8);\n      scrollTo(0,Math.max(0,scrollY+target.getBoundingClientRect().top-margin));\n    }));\n    return true;\n"
  ]
];
const sourcePatches={
  "tests/field-usability.cjs": [
    [
      "fs.readFileSync(path.join(root,'ui-workspaces.js'),'utf8').replace(/\\r\\n/g,'\\n')",
      "require('./release-default-source.cjs').workspace(fs.readFileSync(path.join(root,'ui-workspaces.js'),'utf8').replace(/\\r\\n/g,'\\n'))"
    ]
  ],
  "tests/forms-settings.cjs": [
    [
      "fs.readFileSync(path.join(root,'ui-workspaces.js'),'utf8').replace(/\\r\\n/g,'\\n')",
      "require('./release-default-source.cjs').workspace(fs.readFileSync(path.join(root,'ui-workspaces.js'),'utf8').replace(/\\r\\n/g,'\\n'))"
    ]
  ]
};
function reverse(source,patches,label){
 source=source.replace(/\r\n/g,'\n');
 for(const [before,after] of patches){assert.equal(source.split(after).length,2,label+' must match once');source=source.replace(after,before);}
 return source;
}
function defaults(source){return reverse(source,defaultPatches,'Release default');}
function workspace(source){return reverse(defaults(source),g1Patches,'Approved G1 navigation');}
function normalise(file,source){return sourcePatches[file]?reverse(source,sourcePatches[file],file+' read wrapper'):source;}
module.exports={defaults,workspace,normalise,defaultPatches,g1Patches,sourcePatches};
if(require.main===module){
 const test=require('node:test'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
 const root=path.resolve(__dirname,'..'),git=ref=>execFileSync('git',['show',ref+':ui-workspaces.js'],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n');
 test('Release default is exactly reversible to approved G2',()=>{
  const source=fs.readFileSync(path.join(root,'ui-workspaces.js'),'utf8').replace(/\r\n/g,'\n');
  assert.equal(defaults(source),git('949f1d6'));
  for(const [,after]of defaultPatches){assert.throws(()=>defaults(source.replace(after,'')));assert.throws(()=>defaults(source+after));}
  assert.notEqual(defaults(source+'\n// unrelated edit'),git('949f1d6'));
 });
 test('Historical G1 navigation allowance retains exact pre-G1 runtime',()=>{
  const source=fs.readFileSync(path.join(root,'ui-workspaces.js'),'utf8').replace(/\r\n/g,'\n');
  assert.equal(workspace(source),git('6920ece'));
  for(const [,after]of g1Patches){assert.throws(()=>reverse(git('cfdcdd2').replace(after,''),g1Patches,'G1'));assert.throws(()=>reverse(git('cfdcdd2')+after,g1Patches,'G1'));}
  assert.notEqual(workspace(source+'\n// unrelated edit'),git('6920ece'));
 });
}
