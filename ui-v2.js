/* UI-only enhancements. No access to application state, storage, roles or publishing. */
(() => {
  'use strict';
  function initPresentation() {
    const menu = document.getElementById('headerMenu');
    const menuList = document.getElementById('headerActionList');
    const secondary = document.getElementById('headerSecondary');
    const commands = ['btnPrint', 'btnSettings'].map(id => document.getElementById(id));
    const compact = matchMedia('(max-width: 900px)');
    function placeCommands() {
      if (compact.matches) menuList.prepend(...commands);
      else secondary.append(...commands);
      menu.open = false;
    }
    placeCommands();
    compact.addEventListener('change', placeCommands);
    document.addEventListener('click', event => {
      if (!menu.contains(event.target) || event.target.closest('button')) menu.open = false;
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open) {
        menu.open = false;
        menu.querySelector('summary').focus();
      }
    });

    // Small-screen shortcuts use the existing, audience-filtered panels. No new views.
    const shortcuts = document.createElement('nav');
    shortcuts.className = 'activity-shortcuts';
    shortcuts.setAttribute('aria-label', 'Activity shortcuts');
    document.querySelector('.topbar').append(shortcuts);
    function syncShortcuts() {
      const links = [];
      for (const [id, label] of [['dailyWorks', 'Daily works'], ['upcoming', 'Scheduled works']]) {
        const panel = document.querySelector(`[data-card="${id}"]`);
        if (!panel) continue;
        panel.id = `activity-${id}`;
        links.push(`<a href="#${panel.id}">${label}</a>`);
      }
      const spatial = `<a class="tablet-shortcut" href="#mapCard">Map</a>${document.getElementById('modelCard').style.display !== 'none' ? '<a class="tablet-shortcut" href="#modelCard">3D viewer</a>' : ''}`;
      shortcuts.innerHTML = `<span>Site activities</span><div>${links.join('')}${spatial}<a href="#panelsGrid">All panels <span aria-hidden="true">↓</span></a></div>`;
    }
    new MutationObserver(syncShortcuts).observe(document.getElementById('panelsGrid'), { childList: true });
    syncShortcuts();

    const mobile = matchMedia('(max-width: 680px)');
    const mapCard = document.querySelector('.map-card');
    mapCard.id = 'mapCard';
    // Leaflet normally sets this inline. Retain it for print when starting collapsed.
    document.getElementById('map').style.position = 'relative';
    const mapToggle = document.createElement('button');
    mapToggle.type = 'button'; mapToggle.className = 'tool-btn mobile-map-toggle';
    mapToggle.setAttribute('aria-controls', 'map');
    mapCard.querySelector('.card-head').append(mapToggle);
    function showMap(expanded) {
      mapCard.classList.toggle('mobile-map-collapsed', !expanded);
      mapToggle.setAttribute('aria-expanded', String(expanded));
      mapToggle.textContent = expanded ? 'Close map' : 'Open map';
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
    mapToggle.addEventListener('click', () => showMap(mapCard.classList.contains('mobile-map-collapsed')));
    mobile.addEventListener('change', () => showMap(!mobile.matches));
    showMap(!mobile.matches);

    const model = document.getElementById('modelCard');
    const modelToggle = document.getElementById('btnModelToggle');
    let modelCount = 0;
    function expandModel(expanded) {
      model.classList.toggle('model-collapsed', !expanded);
      modelToggle.setAttribute('aria-expanded', String(expanded));
      modelToggle.querySelector('span').textContent = expanded ? 'Close viewer' : 'Open viewer';
      modelToggle.querySelector('i').className = `fa-solid fa-chevron-${expanded ? 'up' : 'down'}`;
      // Leaflet and the existing Three viewer already handle the window resize event.
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
    function syncModel() {
      const count = model.querySelectorAll('.model-row').length;
      if (count > modelCount) expandModel(true);
      else if (!count) expandModel(false);
      modelCount = count;
      syncShortcuts();
    }
    modelToggle.addEventListener('click', () => expandModel(model.classList.contains('model-collapsed')));
    new MutationObserver(syncModel).observe(document.getElementById('modelList'), { childList: true });
    syncModel();

    // Add names and pressed state to existing action hooks without replacing their handlers.
    function labelControls(root) {
      root.querySelectorAll('button[title]').forEach(button => {
        if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', button.title);
      });
      root.querySelectorAll('.vchip, .donebtn').forEach(button => button.setAttribute('aria-pressed', String(button.classList.contains('on'))));
      root.querySelectorAll('.vchip').forEach(button => {
        const hook = button.dataset.vis || button.dataset.pvis || button.dataset.stvis || '';
        const label = hook.startsWith('site') ? 'Site' : hook.startsWith('client') ? 'Client' : '';
        if (label && button.textContent !== label) button.textContent = label;
      });
      root.querySelectorAll('.field').forEach(field => {
        const label = field.querySelector('label:not(.chkline)');
        const input = field.querySelector('input:not([type="checkbox"]), select, textarea');
        if (label && input && !label.htmlFor && !label.contains(input)) {
          if (!input.id) input.id = `ui-field-${++fieldId}`;
          label.htmlFor = input.id;
        }
      });
    }
    let fieldId = 0;
    labelControls(document);
    ['panelsGrid', 'statGrid', 'summaryBody', 'modelList', 'fldExtras', 'sFields', 'projList', 'clientList'].forEach(id => {
      const root = document.getElementById(id);
      new MutationObserver(() => labelControls(root)).observe(root, { childList: true, subtree: true });
    });

    const focusable = root => [...root.querySelectorAll('button, input, select, textarea, a[href], [tabindex]')]
      .filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
    const modalOpeners = new Map();
    document.querySelectorAll('.modal-back').forEach(back => {
      const dialog = back.querySelector('.modal');
      const heading = back.querySelector('.modal-head > span');
      if (!heading.id) heading.id = `${back.id}Heading`;
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', heading.id);
      const close = document.createElement('button');
      close.type = 'button'; close.className = 'modal-close'; close.textContent = '×';
      close.setAttribute('aria-label', 'Close dialog');
      // Use the existing Cancel handler, including rollback of a newly placed marker.
      close.addEventListener('click', () => back.querySelector('[data-close]').click());
      back.querySelector('.modal-head').append(close);
      new MutationObserver(() => {
        const opened = back.classList.contains('open');
        document.body.classList.toggle('ui-modal-open', !!document.querySelector('.modal-back.open'));
        if (opened) {
          const opener = document.activeElement;
          if (!back.contains(opener)) modalOpeners.set(back, opener);
          const first = focusable(back).find(el => !el.classList.contains('modal-close'));
          if (first && !back.contains(document.activeElement)) first.focus({ preventScroll: true });
        } else {
          let opener = modalOpeners.get(back);
          // A save may rebuild the originating row. Restore focus to its corresponding hook.
          if (opener && !opener.isConnected) {
            const hook = [...opener.attributes].find(a => a.name.startsWith('data-'));
            opener = hook ? document.querySelector(`[${hook.name}="${CSS.escape(hook.value)}"]`) : null;
          }
          if (opener && opener.getClientRects().length) opener.focus({ preventScroll: true });
          else if (modalOpeners.get(back)?.closest('.header-action-list')) menu.querySelector('summary').focus({ preventScroll: true });
          modalOpeners.delete(back);
        }
      }).observe(back, { attributes: true, attributeFilter: ['class'] });
      back.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const elements = focusable(back), first = elements[0], last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPresentation);
  else initPresentation();
})();
