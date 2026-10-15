/* Stage B2: transient, read-only presentation. The B1 runtime supplies permitted data.
 * No operational records, persistence, polling, editing or publishing live here.
 */
window.OCEOverview = Object.freeze({
  render(container, route) {
    'use strict';
    let data;
    document.dispatchEvent(new CustomEvent('oce:overview-read', {detail:{accept:value => { data = value; }}}));
    // Preserve a user's disclosure choice only while the permitted project context
    // is unchanged. Never retain data/markup from an earlier project or audience.
    const previous = container.querySelector('.ov-briefing');
    const context = data && JSON.stringify(data.projects.map(p => [p.id,p.name]));
    const expanded = previous && previous.dataset.context === context ? previous.open : matchMedia('(min-width:1200px)').matches;
    container.replaceChildren();
    if (!data) return;
    const el = (tag, cls, text) => {
      const node = document.createElement(tag); node.className = cls || '';
      if (text !== undefined) node.textContent = text; return node;
    };
    const panelLink = (panel, label = 'Open panel') => route(label, panel.id, 'ov-link');
    const head = (title, note, action) => {
      const h = el('header','ov-section-head'), copy = el('div');
      copy.append(el('h2','',title), el('p','ov-note',note)); h.append(copy);
      if (action) h.append(action); return h;
    };
    const panelById = id => data.panels.find(p => p.id === id);
    const empty = text => el('p','ov-empty',text);
    const list = panel => {
      const ul = el('ul','ov-list');
      for (const item of panel.items.slice(0,3)) {
        const li = el('li'), a = route(item.title || 'Untitled record', panel.id, 'ov-record-link', item.id);
        li.append(a);
        if (item.detail) li.append(el('p','ov-detail',item.detail));
        const meta = el('div','ov-meta');
        if (data.multipleProjects && item.project) meta.append(el('span','ov-project-tag',item.project));
        item.labels.forEach(label => meta.append(el('span','ov-tag',label)));
        if (meta.childElementCount) li.append(meta);
        ul.append(li);
      }
      return ul;
    };
    const panelSection = panel => {
      const section = el('section','ov-card'); section.dataset.ovPanel = panel.id;
      section.append(head(panel.title,`${panel.items.length} active ${panel.items.length === 1 ? 'record' : 'records'} · ${panel.id === 'dailyWorks' ? 'As listed, not limited to today' : 'As recorded in the panel'}`, panelLink(panel)));
      section.append(panel.items.length ? list(panel) : empty('No active records in this view. Open the panel for completed records and available history.'));
      if (panel.items.length > 3) section.append(el('p','ov-list-foot',`Showing 3 of ${panel.items.length} · Open the panel for the complete list.`));
      return section;
    };

    // G2: shortcuts invoke the original Add controls; all form logic stays there.
    if (!document.body.matches('.viewer,.locked')) {
      const actions = el('div','ov-add-actions'); actions.setAttribute('role','group'); actions.setAttribute('aria-label','Quick Add');
      for (const [id,label] of [['dailyWorks','New Daily Work'],['upcoming','New Scheduled Work'],['issuesDelays','New Issue / Delay']]) {
        if (!panelById(id)) continue;
        const button = el('button','ov-add-action',label); button.type = 'button'; button.dataset.ovAdd = id;
        button.addEventListener('click',() => {
          if (!button.isConnected || container.hidden || document.body.matches('.viewer,.locked')) return;
          let current;
          document.dispatchEvent(new CustomEvent('oce:overview-read',{detail:{accept:value => {current = value;}}}));
          if (!current?.panels.some(panel => panel.id === id)) return;
          const original = document.querySelector('#panelsGrid [data-add="'+id+'"]');
          if (!original || original.disabled) return;
          button.focus({preventScroll:true}); original.click();
        });
        actions.append(button);
      }
      if (actions.childElementCount) container.append(actions);
    }
    // END G2 Quick Add.
    const briefing = el('details','ov-card ov-briefing'); briefing.open = expanded; briefing.dataset.context = context;
    const toggle = el('summary','ov-briefing-toggle'), briefingTitle = el('span','ov-briefing-title');
    briefingTitle.append(el('strong','','Project briefing'),el('span','ov-note','Recorded status, milestones & outlook'));
    toggle.append(briefingTitle);
    if (data.projects.length === 1 && data.projects[0].status) {
      const badge = el('span','ov-rag',data.projects[0].status); badge.dataset.rag = data.projects[0].status; toggle.append(badge);
    }
    toggle.append(el('span','ov-disclosure-icon','')); briefing.append(toggle);
    const briefingBody = el('div','ov-briefing-body');
    for (const project of data.projects) {
      const section = el('section','ov-card ov-summary'); section.dataset.ovProject = project.id;
      const intro = el('div','ov-summary-intro');
      const label = el('div','ov-eyebrow','PROJECT STATUS');
      if (project.status) { const badge = el('span','ov-rag',project.status); badge.dataset.rag = project.status; label.append(badge); }
      intro.append(label,el('h2','',project.name));
      if (project.stage) intro.append(el('p','ov-stage',project.stage));
      if (project.note) intro.append(el('p','ov-detail',project.note));
      const details = route('Project details', 'summaryCard','ov-link'); intro.append(details);
      section.append(intro);
      const facts = el('dl','ov-summary-facts');
      for (const [title,value] of [['Next key milestone',project.milestone],['Anticipated completion',project.completion]]) {
        const fact = el('div'); fact.append(el('dt','ov-eyebrow',title),el('dd','',value || 'Not recorded')); facts.append(fact);
      }
      section.append(facts);
      if (project.outlook.length) {
        const more = el('details','ov-outlook'); more.append(el('summary','','Project outlook'));
        const dl = el('dl');
        project.outlook.forEach(([label,value]) => { const row=el('div');row.append(el('dt','',label),el('dd','',value));dl.append(row); });
        more.append(dl); section.append(more);
      }
      briefingBody.append(section);
    }
    if (data.projects.length) { briefing.append(briefingBody); container.append(briefing); }
    else container.append(empty('No project summary available in this view.'));

    const quick = el('nav','ov-quick'); quick.setAttribute('aria-label','Overview activity counts');
    quick.append(el('p','ov-quick-label','Active records · Open original panel'));
    for (const id of ['dailyWorks','upcoming','issuesDelays','qualityTesting']) {
      const panel = panelById(id); if (!panel) continue;
      const a = panelLink(panel); a.className = 'ov-metric'; a.dataset.ovCount = id; a.replaceChildren();
      a.append(el('span','ov-metric-label',panel.title),el('strong','',String(panel.items.length)),el('span','ov-arrow','↗'));
      a.setAttribute('aria-label',`${panel.title}: ${panel.items.length} active records. Open original panel.`);
      quick.append(a);
    }
    if (quick.childElementCount > 1) {
      quick.style.setProperty('--ov-count',String(quick.childElementCount - 1)); container.append(quick);
    }
    const columns = el('div','ov-columns');
    for (const id of ['dailyWorks','upcoming','issuesDelays']) { const panel=panelById(id);if(panel)columns.append(panelSection(panel)); }
    const attention = data.panels.filter(p => ['qualityTesting','punchlist','incidents'].includes(p.id));
    if (attention.length) {
      const section = el('section','ov-card ov-attention');
      section.append(head('Operational attention','Active records · Review the recorded status in each panel'));
      for (const panel of attention) {
        const group = el('div','ov-attention-group'); group.dataset.ovPanel=panel.id;
        const h = el('h3'); h.append(panelLink(panel,`${panel.title} · ${panel.items.length} active`)); group.append(h);
        group.append(panel.items.length ? list(panel) : empty('No active records in this view.'));
        if (panel.items.length > 3) group.append(el('p','ov-list-foot',`Showing 3 of ${panel.items.length}`));
        section.append(group);
      }
      columns.append(section);
    }
    if (columns.childElementCount) container.append(columns);
    else container.append(empty('No operational panels available in this view.'));

    if (data.stats !== null) {
      const section = el('section','ov-card ov-production');
      section.append(head('Production statistics','Board-wide · Not filtered by project',route('Open statistics','prodStatsCard','ov-link')));
      const stats = el('div','ov-stats');
      for (const stat of data.stats) {
        const card = el('article','ov-stat'); card.append(el('h3','',stat.label));
        if (stat.value) card.append(el('p','ov-stat-value',stat.value));
        if (stat.bar) { const bar=el('div','ov-bar'),fill=el('span');fill.style.width=stat.bar;bar.append(fill);card.append(bar); }
        const fields=el('dl');stat.fields.forEach(([label,value])=>{const row=el('div');row.append(el('dt','',label),el('dd','',value));fields.append(row);});card.append(fields);stats.append(card);
      }
      section.append(stats.childElementCount ? stats : empty('No production statistics recorded.')); container.append(section);
    }
    const footer=el('div','ov-footer');
    footer.append(el('p','ov-note','Counts include visible, active records in the selected project scope. Completed, cancelled and retired records remain available through the original panels and history.'),route('Open Site & Models','mapCard','ov-link'));
    container.append(footer);
  }
});
