/* Stage A navigation only. The existing runtime owns every record, card and action.
 * Opt in with ?ui=workspaces; remove it or choose Original board to opt out.
 * Read permitted cards AFTER renderPanels; never read or write operational state.
 */
function initWorkspaces() {
  'use strict';
  const destinations = [
    {id:'overview', title:'Overview', short:'Overview', icon:'house', panels:[]},
    {id:'operations', title:'Operations', short:'Works', icon:'helmet-safety', panels:['dailyWorks','upcoming','workPackages','trafficControl']},
    {id:'resources', title:'Resources & Logistics', short:'Resources', icon:'truck', panels:['deliveries','subbiesToday','staffAway','siteInputs','plantTransport','materialPickup']},
    {id:'quality', title:'Quality, Safety & Risk', short:'Quality', icon:'shield-halved', panels:['qualityTesting','punchlist','incidents','issuesDelays']},
    {id:'coordination', title:'Coordination & Commercial', short:'Coordination', icon:'comments', panels:['designChanges','variations','rfis','meetings','stakeholders']},
    {id:'documents', title:'Documents & Photos', short:'Documents', icon:'folder-open', panels:['documents','weeklyPhotos']},
    {id:'site', title:'Site & Models', short:'Site & models', icon:'map-location-dot', panels:[]},
    {id:'all', title:'All Panels', short:'All panels', icon:'table-cells-large', panels:[]}
  ];
  const groupFor = pid => destinations.find(d => d.panels.includes(pid));
  const byId = id => document.getElementById(id);
  const body = document.body;
  const grid = byId('panelsGrid');
  const project = byId('projSelect');
  const wrap = document.querySelector('.wrap');
  if (!grid || !project || !wrap) return;
  let enabled = false, active = 'all', cards = [], available = [], collapsed = false;
  let restoring = false, initialRoute = true, pending = false, scrollTimer, resizeFrame;
  let lastProject = project.value, drawerReturn = null, poppedURL = '', lastLayout = '';
  const desktop = matchMedia('(min-width: 1200px)');
  const phone = matchMedia('(max-width: 680px)');
  const icon = name => {
    const el = document.createElement('i');
    el.className = 'fa-solid fa-' + name; el.setAttribute('aria-hidden','true'); return el;
  };
  const element = (tag, cls, text) => {
    const el = document.createElement(tag); el.className = cls || '';
    if (text) el.textContent = text; return el;
  };
  const button = (text, id, glyph) => {
    const el = element('button','ws-button',text); el.id = id; el.type = 'button';
    if (glyph) el.prepend(icon(glyph)); return el;
  };
  const entry = () => history.state?.oceWorkspace;
  const putEntry = value => history.replaceState({...history.state, oceWorkspace:value},'',location.href);
  const remember = () => {
    if (enabled && !restoring && !initialRoute) putEntry({workspace:active, project:lastProject, scrollY:scrollY, target:location.hash});
  };
  const permitted = pid => cards.some(c => c.dataset.card === pid);
  const usableTarget = hash => {
    const id = hash.replace(/^#/,'');
    if (id.startsWith('activity-')) return permitted(id.slice(9)) ? byId(id) : null;
    if (id === 'panelsGrid' || id === 'mapCard') return byId(id);
    if (['modelCard','summaryCard','prodStatsCard'].includes(id) && byId(id)?.style.display !== 'none') return byId(id);
    return null;
  };
  const targetWorkspace = hash => {
    if (hash.startsWith('#activity-')) return groupFor(hash.slice(10))?.id;
    if (hash === '#mapCard' || hash === '#modelCard') return 'site';
    if (['#panelsGrid','#summaryCard','#prodStatsCard'].includes(hash)) return 'all';
    return null;
  };
  function routeURL(workspace, target = '', optIn = true) {
    const url = new URL(location.href);
    url.searchParams.set('ui',optIn ? 'workspaces' : 'classic');
    if (optIn) {
      url.searchParams.set('workspace',workspace);
      if (project.value) url.searchParams.set('workspaceProject',project.value);
    } else {
      url.searchParams.delete('workspace'); url.searchParams.delete('workspaceProject');
    }
    // Legacy audience hashes must survive a new activity anchor and a reload.
    // Preserve their existing meaning using the runtime's existing query aliases.
    if (target && !['crew','view','client'].some(k => url.searchParams.has(k))) {
      const h = url.hash.toLowerCase();
      if (h.includes('crew')) url.searchParams.set('crew','');
      else if (h.includes('view') || h.includes('client')) url.searchParams.set('view','');
    }
    if (target) url.hash = target;
    else if (targetWorkspace(url.hash)) url.hash = '';
    return url;
  }
  function link(text, workspace, target, cls = '') {
    const a = element('a',cls,text); a.href = routeURL(workspace,target).href;
    a.dataset.wsRoute = workspace; if (target) a.dataset.wsTarget = target; return a;
  }

  const optIn = element('a','ws-chrome ws-optin','Try workspaces');
  optIn.id = 'wsOptIn'; optIn.href = routeURL('overview').href;
  document.querySelector('.board-nav').append(optIn);

  const sidebar = element('aside','ws-chrome ws-sidebar'); sidebar.id = 'wsSidebar';
  sidebar.setAttribute('aria-label','Workspace navigation');
  const brand = element('div','ws-brand'); brand.append(element('strong','','OCE–OPS'),element('span','','Operations workspace'));
  const menu = button('Menu','wsMenu','bars'); menu.setAttribute('aria-controls','wsDestinations');
  const nav = element('nav','ws-destinations'); nav.id = 'wsDestinations'; nav.setAttribute('aria-label','Workspaces');
  const footer = element('div','ws-sidebar-footer');
  const original = element('a','ws-original','Original board'); original.id = 'wsOriginal'; original.href = routeURL('all','',false).href;
  original.prepend(icon('arrow-left')); footer.append(original,element('p','','Stage B2 · opt-in workspaces'));
  sidebar.append(brand,menu,nav,footer); body.append(sidebar);
  const shade = button('Close navigation','wsShade'); shade.className = 'ws-chrome ws-shade'; shade.tabIndex = -1; shade.hidden = true; body.append(shade);

  const heading = element('section','ws-chrome ws-heading'); heading.id = 'wsHeading';
  const headingText = element('div','ws-heading-text');
  const scope = element('div','ws-scope'); const title = element('h1'); title.id = 'wsTitle'; title.tabIndex = -1;
  const description = element('p','ws-description');
  headingText.append(scope,title,description);
  const allLink = link('All Panels','all','','ws-all-link'); allLink.prepend(icon('table-cells-large'));
  heading.append(headingText,allLink); wrap.prepend(heading);
  const shortcuts = element('nav','ws-chrome ws-shortcuts'); shortcuts.setAttribute('aria-label','Available panels in this workspace'); heading.after(shortcuts);
  const placeholder = element('section','ws-chrome ws-overview'); placeholder.id = 'wsOverview';
  placeholder.setAttribute('aria-label','Project overview');
  shortcuts.after(placeholder);
  const bottom = element('nav','ws-chrome ws-bottom'); bottom.setAttribute('aria-label','Quick navigation'); body.append(bottom);
  const chrome = [sidebar,heading,shortcuts,placeholder,bottom];

  function closeDrawer(returnFocus = false) {
    body.classList.remove('ws-drawer-open'); shade.hidden = true;
    sidebar.removeAttribute('role'); sidebar.removeAttribute('aria-modal');
    document.querySelectorAll('[data-ws-inert]').forEach(el => { el.inert = false; el.removeAttribute('data-ws-inert'); });
    updateMenu();
    if (returnFocus && drawerReturn?.isConnected) drawerReturn.focus();
  }
  function updateMenu() {
    const full = desktop.matches ? !collapsed : body.classList.contains('ws-drawer-open');
    menu.replaceChildren(icon(full ? 'angles-left' : 'bars'),document.createTextNode(full ? (desktop.matches ? 'Collapse' : 'Close menu') : 'Menu'));
    menu.setAttribute('aria-expanded',String(full));
    byId('wsMobileMenu')?.setAttribute('aria-expanded',String(body.classList.contains('ws-drawer-open')));
    menu.setAttribute('aria-label',full ? (desktop.matches ? 'Collapse navigation' : 'Close navigation') : 'Expand navigation menu');
  }
  function toggleMenu(trigger = menu) {
    if (desktop.matches) { collapsed = !collapsed; body.classList.toggle('ws-rail',collapsed); updateMenu(); reveal(); return; }
    if (body.classList.contains('ws-drawer-open')) { closeDrawer(true); return; }
    drawerReturn = trigger; body.classList.add('ws-drawer-open'); shade.hidden = false;
    sidebar.setAttribute('role','dialog'); sidebar.setAttribute('aria-modal','true');
    [document.querySelector('.topbar'),wrap,bottom].forEach(el => { if (!el.inert) { el.inert = true; el.dataset.wsInert = ''; } });
    updateMenu(); menu.focus();
  }
  menu.addEventListener('click',() => toggleMenu()); shade.addEventListener('click',() => closeDrawer(true));
  document.addEventListener('keydown',event => {
    if (!body.classList.contains('ws-drawer-open')) return;
    if (event.key === 'Escape') { event.preventDefault(); closeDrawer(true); }
    if (event.key === 'Tab') {
      const items = [...sidebar.querySelectorAll('a,button')].filter(e => e.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  function reveal() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => document.dispatchEvent(new Event('oce:workspace-reveal')));
  }
  function renderNavigation() {
    // Names and counts come only from cards retained by the original audience renderer.
    const focused = document.activeElement;
    const focusedRoute = nav.contains(focused) ? focused.dataset.wsRoute : null;
    nav.replaceChildren(...available.map(d => {
      const a = link('' ,d.id,'','ws-nav-link');
      a.setAttribute('aria-label',d.title);
      a.append(icon(d.icon),element('span','ws-nav-full',d.title),element('span','ws-nav-short',d.short));
      a.querySelector('.ws-nav-short').setAttribute('aria-hidden','true');
      if (active === d.id) a.setAttribute('aria-current','page');
      return a;
    }));
    if (focusedRoute) nav.querySelector(`[data-ws-route="${focusedRoute}"]`)?.focus({preventScroll:true});
    const destination = destinations.find(d => d.id === active);
    scope.textContent = project.selectedOptions[0]?.textContent || 'Project board';
    title.textContent = destination.title;
    const visibleCards = active === 'all' ? cards : cards.filter(c => destination.panels.includes(c.dataset.card));
    description.textContent = active === 'site' ? 'Map and model tools · Board-wide references' : active === 'overview' ? 'Project status and active work · Open any record in its original panel' : `${visibleCards.length} available ${visibleCards.length === 1 ? 'panel' : 'panels'}${active === 'all' ? ' · Original board layout' : ''}`;
    allLink.hidden = active === 'all'; allLink.href = routeURL('all').href;
    const targets = active === 'site'
      ? [['mapCard','Work Area Map'],...(byId('modelCard')?.style.display !== 'none' ? [['modelCard','3D Models']] : [])]
      : (active === 'overview' ? [] : visibleCards.map(c => [c.id,c.querySelector('.ttl').textContent.trim()]));
    // All Panels keeps quick daily access without repeating a second 21-item navigation list.
    shortcuts.replaceChildren(...targets.filter(([id]) => active !== 'all' || ['activity-dailyWorks','activity-upcoming','activity-issuesDelays'].includes(id)).map(([id,label]) => link(label,targetWorkspace('#'+id) || active,'#'+id)));
    shortcuts.hidden = !shortcuts.childElementCount;
    bottom.replaceChildren();
    const quick = [['dailyWorks','Daily','helmet-safety'],['upcoming','Schedule','calendar-days'],['issuesDelays','Issues','triangle-exclamation']];
    for (const [pid,label,glyph] of quick) if (permitted(pid)) {
      const a = link(label,groupFor(pid).id,'#activity-'+pid); a.prepend(icon(glyph)); bottom.append(a);
    }
    const site = link('Site','site'); site.prepend(icon('map-location-dot')); bottom.append(site);
    const more = button('Menu','wsMobileMenu','bars'); more.setAttribute('aria-controls','wsSidebar'); more.setAttribute('aria-expanded','false');
    more.addEventListener('click',() => toggleMenu(more)); bottom.append(more);
    original.href = routeURL('all','',false).href;
    optIn.href = routeURL('overview').href;
    updateMenu();
  }
  function present() {
    const wasEnabled = body.classList.contains('ws-enabled');
    body.classList.toggle('ws-enabled',enabled);
    body.classList.toggle('ws-rail',enabled && collapsed);
    body.dataset.workspace = enabled ? active : '';
    optIn.hidden = enabled;
    chrome.forEach(el => { el.hidden = !enabled; });
    if (!enabled) {
      placeholder.replaceChildren();
      grid.removeAttribute('data-ws-suppressed'); byId('overview').removeAttribute('data-ws-suppressed');
      cards.forEach(c => c.removeAttribute('data-ws-suppressed'));
      closeDrawer(); history.scrollRestoration = 'auto'; lastLayout = '';
      if (wasEnabled) reveal(); return;
    }
    history.scrollRestoration = 'manual';
    const padding = getComputedStyle(wrap);
    byId('overview').style.setProperty('--ws-spatial-width',`${wrap.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight)}px`);
    grid.toggleAttribute('data-ws-suppressed',['overview','site'].includes(active));
    byId('overview').toggleAttribute('data-ws-suppressed',!['all','site'].includes(active));
    const d = destinations.find(d => d.id === active);
    cards.forEach(c => c.toggleAttribute('data-ws-suppressed',active !== 'all' && !d.panels.includes(c.dataset.card)));
    placeholder.hidden = active !== 'overview';
    if (active === 'overview') window.OCEOverview.render(placeholder,(label,id,cls) => {
      const target = ['summaryCard','prodStatsCard','mapCard'].includes(id) ? '#'+id : '#activity-'+id;
      return link(label,targetWorkspace(target),target,cls);
    });
    else placeholder.replaceChildren();
    renderNavigation();
    const layout = [active,collapsed,wrap.clientWidth].join(':');
    if (layout !== lastLayout) { lastLayout = layout; reveal(); }
  }
  function setProject(id) {
    if (!id || id === project.value || ![...project.options].some(o => o.value === id)) return;
    restoring = true;
    project.value = id; project.dispatchEvent(new Event('change',{bubbles:true}));
    restoring = false;
  }
  function scrollToRoute(target, y, focus) {
    requestAnimationFrame(() => {
      const el = usableTarget(target || '');
      if (typeof y === 'number' && !focus) scrollTo(0,y);
      else if (el) {
        el.scrollIntoView({block:'start'});
        if (focus) { el.tabIndex = -1; el.focus({preventScroll:true}); }
      } else { scrollTo(0,y || 0); if (focus) title.focus({preventScroll:true}); }
    });
  }
  function refresh() {
    pending = false;
    enabled = new URL(location.href).searchParams.get('ui') === 'workspaces';
    const url = new URL(location.href);
    const savedEntry = entry();
    // Do not canonicalise deep links against the temporary, locked startup board.
    if (!project.options.length || body.classList.contains('locked')) { chrome.forEach(el => {el.hidden = true;}); placeholder.replaceChildren(); return; }
    if (enabled && initialRoute) setProject(url.searchParams.get('workspaceProject') || entry()?.project);
    cards = [...grid.querySelectorAll(':scope > [data-card]')];
    cards.forEach(c => { c.id = 'activity-'+c.dataset.card; });
    available = destinations.filter(d => !d.panels.length || d.panels.some(permitted));
    const target = usableTarget(url.hash);
    const requested = target ? targetWorkspace(url.hash) : (url.searchParams.get('workspace') || 'overview');
    active = available.some(d => d.id === requested) ? requested : 'all';
    lastProject = project.value;
    present();
    if (enabled) {
      const canonical = routeURL(active,target ? url.hash : '');
      if (!target && /^#activity-|^#modelCard$/.test(url.hash)) canonical.hash = '';
      history.replaceState({...history.state,oceWorkspace:{workspace:active,project:lastProject,scrollY:entry()?.scrollY || 0,target:target ? url.hash : ''}},'',canonical);
      if (initialRoute) scrollToRoute(target ? url.hash : '',savedEntry?.scrollY,false);
    }
    initialRoute = false;
  }
  function scheduleRefresh() {
    if (!pending) { pending = true; queueMicrotask(refresh); }
  }
  function navigate(workspace, target = '', optIn = true) {
    clearTimeout(scrollTimer); remember(); closeDrawer();
    const url = routeURL(workspace,target,optIn);
    history.pushState({...history.state,oceWorkspace:{workspace,project:project.value,scrollY:0,target}},'',url);
    refresh(); scrollToRoute(target,0,optIn);
  }
  document.addEventListener('click',event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const a = event.target.closest('a'); if (!a) return;
    if (a === optIn) { event.preventDefault(); navigate('overview'); return; }
    if (a === original) { event.preventDefault(); navigate('all','',false); return; }
    if (!enabled) return;
    if (a.dataset.wsRoute) { event.preventDefault(); navigate(a.dataset.wsRoute,a.dataset.wsTarget || ''); return; }
    const url = new URL(a.href,location.href);
    if (url.origin === location.origin && url.pathname === location.pathname && usableTarget(url.hash)) {
      event.preventDefault(); navigate(targetWorkspace(url.hash),url.hash);
    }
  });
  project.addEventListener('change',() => {
    if (!enabled || restoring) return;
    remember();
    history.pushState({...history.state,oceWorkspace:{workspace:active,project:project.value,scrollY:scrollY,target:''}},'',routeURL(active));
    lastProject = project.value; scheduleRefresh();
  });
  addEventListener('popstate',() => {
    clearTimeout(scrollTimer);
    const saved = entry(); const url = new URL(location.href);
    if (url.searchParams.get('ui') === 'workspaces') setProject(url.searchParams.get('workspaceProject') || saved?.project);
    refresh(); poppedURL = location.href;
    if (enabled) scrollToRoute(saved?.target || url.hash,saved?.scrollY,false);
  });
  addEventListener('hashchange',() => {
    if (poppedURL === location.href) { poppedURL = ''; return; }
    if (enabled) { refresh(); scrollToRoute(location.hash,undefined,false); }
  });
  addEventListener('scroll',() => { clearTimeout(scrollTimer); scrollTimer = setTimeout(remember,150); },{passive:true});
  addEventListener('pagehide',remember);
  const responsive = () => { if (!enabled) return; closeDrawer(); updateMenu(); reveal(); };
  desktop.addEventListener('change',responsive); phone.addEventListener('change',responsive);
  document.addEventListener('oce:panels-rendered',scheduleRefresh);
  refresh();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',initWorkspaces,{once:true});
else initWorkspaces();
