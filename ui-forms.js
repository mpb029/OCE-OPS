/* Stage D: reversible DOM presentation. The original runtime owns all fields,
 * validation, focus management, confirmations, saves and publishing. */
(() => {
  'use strict';
  const byId = id => document.getElementById(id), body = document.body;
  const item = byId('itemModal'), settings = byId('settingsModal');
  if (!item || !settings) return;
  let styled = false;
  const sheet = document.createElement('link');
  sheet.rel = 'stylesheet'; sheet.href = 'ui-forms.css';
  sheet.addEventListener('load',() => {styled = true; apply();},{once:true});
  document.head.append(sheet);
  const modals = ['itemModal','settingsModal','summaryModal','statModal','markerModal'].map(byId);
  const original = new Map([item,settings].map(back => [back,[...back.querySelector('.modal-body').childNodes]]));
  let active = false, viewportFrame, sections = [], added = [], settingsFrame;
  const textChanges = new Map(), labelled = new Set();
  const extraLabels = {fAssigned:'Date assigned',fRequired:'Date required',fWStatus:'Work status',fPctRange:'Percentage complete',fPct:'Percentage complete',newClientName:'New client name',newProjName:'New project name'};
  const make = (tag,cls,text) => {
    const el = document.createElement(tag); el.className = cls;
    if (text) el.textContent = text; return el;
  };
  const appendNote = (back,text,cls) => {
    const note = make('p',cls,text); back.querySelector('.modal-foot').prepend(note); added.push(note);
  };
  function groupForm() {
    const area = item.querySelector('.modal-body');
    const fields = [
      ['record','Record',['fldFolder','fldProject','fldRef',byId('fMain').closest('.field'),'fldSub']],
      ['details','Additional details',['fldExtras','fldCustom','fldWPReadiness']],
      ['planning','Planning & status',['fldTeam','fldDue','fldPct','fldPriority','fldStatus','fldRange','fldDates','fldWStatus','fldDone']],
      ['photos','Photos',['fldPhotos']],
      ['visibility','Audience visibility',[area.querySelector('.vis-field')]]
    ];
    sections = fields.map(([id,title,nodes]) => {
      const section = make('section','d-form-section'); section.dataset.dSection = id;
      const heading = make('h3','d-section-title',title); heading.id = 'd-form-'+id;
      section.setAttribute('aria-labelledby',heading.id);
      const contents = make('div','d-section-fields'); section.append(heading,contents);
      nodes.map(node => typeof node === 'string' ? byId(node) : node).forEach(node => contents.append(node));
      area.append(section); return section;
    });
    const error = make('p','d-field-error'); error.id = 'dMainError'; error.setAttribute('role','alert'); error.hidden = true;
    byId('fMain').after(error); added.push(error);
    byId('fMain').setAttribute('aria-required','true');
    const hint = make('span','d-required','Required'); byId('lblMain').after(hint); added.push(hint);
    appendNote(item,'Save updates this browser. Publishing remains a separate action.','d-save-note');
  }
  function groupSettings() {
    const area = settings.querySelector('.modal-body');
    const chunks = new Map(); let current;
    [...area.children].forEach(node => {
      if (node.classList.contains('set-section')) {current = []; chunks.set(node.textContent.trim(),current);}
      current?.push(node);
    });
    const section = (id,title,nodes) => {
      const el = make('section','d-settings-section'); el.id = 'd-settings-'+id;
      const heading = make('h3','d-section-title',title); heading.tabIndex = -1;
      el.append(heading,...nodes); area.append(el); return el;
    };
    const board = chunks.get('Board'), headingField = byId('setProj').closest('.field');
    const groups = [
      ['projects','Projects',chunks.get('Projects')],
      ['clients','Clients',chunks.get('Clients')],
      ['mapping','Mapping & weather',board.filter(n => n !== headingField && !n.classList.contains('set-section'))],
      ['publishing','Publishing & sharing',[...chunks.get('Live sharing (publish to the site)'),...chunks.get('Share links (read-only)')]],
      ['display','Display',[board[0],headingField]],
      ['access','Access & history',[...chunks.get('Edit-page password (optional)'),...chunks.get('Project history')]]
    ];
    const nav = make('nav','d-settings-nav'); nav.id = 'dSettingsNav'; nav.setAttribute('aria-label','Settings sections');
    groups.forEach(([id,title,nodes]) => {
      const el = section(id,title,nodes);
      const link = make('a','',title); link.href = '#'+el.id;
      link.addEventListener('click',event => {
        event.preventDefault();
        area.scrollTo({top:area.scrollTop+el.getBoundingClientRect().top-area.getBoundingClientRect().top-16,behavior:'instant'});
        el.querySelector('h3').focus({preventScroll:true});
      });
      nav.append(link);
    });
    // A jump list keeps every setting available and does not change its save timing.
    settingsFrame = make('div','d-settings-frame'); area.before(settingsFrame); settingsFrame.append(nav,area);
    const note = make('p','d-settings-note','Project/client edits apply immediately in this browser, including Add, Remove and assignments. Save applies the other configuration fields; Cancel does not undo project/client edits.');
    area.prepend(note); added.push(note);
    const warning = make('p','d-settings-note','Site and Client links filter the display; they are not access control. Anyone with repository access can read the underlying data.');
    byId('d-settings-publishing').append(warning); added.push(warning);
    for (const node of chunks.get('Clients')[1].childNodes) if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('further down')) {
      textChanges.set(node,node.textContent); node.textContent = node.textContent.replace('further down','in the Projects section');
    }
    appendNote(settings,'Save configuration locally. Publish separately when ready.','d-save-note');
  }
  function labelSettings() {
    if (!active) return;
    for (const [selector,label] of [['[data-proj-name]','Project name'],['[data-client-name]','Client name'],['[data-client-link]','Client display link']]) {
      settings.querySelectorAll(selector).forEach(el => {
        if (!el.hasAttribute('aria-label')) {el.setAttribute('aria-label',label);labelled.add(el);}
      });
    }
  }
  [byId('projList'),byId('clientList')].forEach(el => new MutationObserver(labelSettings).observe(el,{childList:true,subtree:true}));
  function clearFeedback() {
    const error = byId('dMainError'); if (error) {error.hidden = true; error.textContent = '';}
    byId('fMain').removeAttribute('aria-invalid'); byId('fMain').removeAttribute('aria-describedby');
  }
  // Run after the existing Save/Enter handler. Only explain its existing rejection;
  // do not cancel the event or introduce browser constraint validation.
  function feedback(event) {
    if (!active || !item.classList.contains('open')) return;
    const attempted = event.type === 'click' ? event.target.closest('#itemSave') :
      event.key === 'Enter' && ['fMain','fSub'].includes(event.target.id);
    if (!attempted || document.activeElement !== byId('fMain') || byId('fMain').value.trim()) return;
    const error = byId('dMainError'); error.textContent = byId('lblMain').textContent+' is required.'; error.hidden = false;
    byId('fMain').setAttribute('aria-invalid','true'); byId('fMain').setAttribute('aria-describedby',error.id);
  }
  item.addEventListener('click',feedback); item.addEventListener('keydown',feedback);
  byId('fMain').addEventListener('input',clearFeedback);
  function refreshSections() {
    if (!active) return;
    sections.forEach(section => {
      const children = [...section.querySelector('.d-section-fields').children];
      section.hidden = !children.some(el => el.style.display !== 'none' &&
        (!['fldExtras','fldCustom'].includes(el.id) || el.children.length));
    });
  }
  function viewport() {
    viewportFrame = null;
    if (!active) return;
    const visible = window.visualViewport;
    modals.forEach(back => {
      back.style.setProperty('--d-visible-height',Math.max(1,visible?.height || innerHeight)+'px');
      back.style.setProperty('--d-visible-top',Math.max(0,visible?.offsetTop || 0)+'px');
    });
    const focused = document.activeElement;
    const area = focused.closest?.('.d-form.open .modal-body');
    if (area && focused.matches('input,select,textarea')) {
      const a = area.getBoundingClientRect(), f = focused.getBoundingClientRect();
      if (f.bottom > a.bottom-8) area.scrollTop += f.bottom-a.bottom+8;
      else if (f.top < a.top+8) area.scrollTop -= a.top-f.top+8;
    }
  }
  const scheduleViewport = () => {if (active && !viewportFrame) viewportFrame = requestAnimationFrame(viewport);};
  modals.forEach(back => {
    new MutationObserver(() => {
      if (!active) return;
      if (!back.classList.contains('open') && back === item) clearFeedback();
      refreshSections(); scheduleViewport();
    }).observe(back,{attributes:true,attributeFilter:['class']});
    back.addEventListener('focusin',scheduleViewport);
  });
  new MutationObserver(refreshSections).observe(item.querySelector('.modal-body'),{subtree:true,childList:true,attributes:true,attributeFilter:['style']});
  window.visualViewport?.addEventListener('resize',scheduleViewport);
  window.visualViewport?.addEventListener('scroll',scheduleViewport);
  addEventListener('resize',scheduleViewport);
  function apply() {
    const next = styled && body.classList.contains('ws-enabled') && !body.classList.contains('viewer') && !body.classList.contains('locked');
    if (next === active) return;
    // Moving the original controls must not interrupt an already-open form when
    // the stylesheet arrives late, or replace the original focus-return target.
    const focused = document.activeElement;
    const openDialog = [item,settings].find(back => back.classList.contains('open') && back.contains(focused));
    const selection = openDialog && typeof focused.selectionStart === 'number' ?
      [focused.selectionStart,focused.selectionEnd,focused.selectionDirection] : null;
    active = next;
    body.classList.toggle('d-forms-enabled',active);
    if (active) {
      groupForm(); groupSettings(); labelSettings();
      Object.entries(extraLabels).forEach(([id,label]) => byId(id).setAttribute('aria-label',label));
      modals.forEach(back => back.classList.add('d-form')); refreshSections(); scheduleViewport();
    }
    else {
      clearFeedback(); byId('fMain').removeAttribute('aria-required');
      Object.keys(extraLabels).forEach(id => byId(id).removeAttribute('aria-label'));
      labelled.forEach(el => el.removeAttribute('aria-label')); labelled.clear();
      textChanges.forEach((text,node) => {node.textContent = text;}); textChanges.clear();
      for (const [back,nodes] of original) back.querySelector('.modal-body').replaceChildren(...nodes);
      if (settingsFrame) {settingsFrame.before(settings.querySelector('.modal-body')); settingsFrame.remove(); settingsFrame = null;}
      added.forEach(el => el.remove()); added = []; sections = [];
      modals.forEach(back => {back.classList.remove('d-form');back.style.removeProperty('--d-visible-height');back.style.removeProperty('--d-visible-top');});
    }
    if (openDialog?.classList.contains('open') && focused.isConnected && focused.getClientRects().length &&
        !body.classList.contains('viewer') && !body.classList.contains('locked')) {
      focused.focus({preventScroll:true});
      if (selection) focused.setSelectionRange(...selection);
    }
  }
  new MutationObserver(apply).observe(body,{attributes:true,attributeFilter:['class']});
  apply();
})();
