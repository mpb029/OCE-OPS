// Exact reversible G1 allowances for historical source-parity contracts.
// No wildcard removal: unexpected edits remain visible to the original assertion.
const assert = require('node:assert/strict');
const oldRecord = '          title: text(it.main), detail: text(it.sub), project: text(projName(effProj(it))),';
const newRecord = '          id: text(it.id), title: text(it.main), detail: text(it.sub), project: text(projName(effProj(it))),';
const resolver = `  // G1: resolve only a currently permitted record to its original rendered row.
  document.addEventListener("oce:record-target", (event) => {
    if (!remoteResolved || editLocked || typeof event.detail?.accept !== "function") return;
    const { panelId, recordId } = event.detail;
    const panel = PANELS.find((p) => p.id === panelId);
    if (!panel || (sync.audience !== "editor" && !panelVisOf(panelId)[sync.audience])) return;
    const card = document.querySelector('.card[data-card="' + panelId + '"]');
    if (!card) return;
    const index = sortItemsForDisplay(visiblePanelItems(panelId)).findIndex((it) => String(it.id) === recordId);
    if (index >= 0) event.detail.accept(card.querySelectorAll('.card-body > .list > li')[index] || null);
  });
`;
const highlight = `@media screen {
  .ws-enabled .ws-record-target { outline:3px solid #2678b7;outline-offset:-3px;background:#eaf3fb; }
}
`;
const oldLink = "        const li = el('li'), a = panelLink(panel, item.title || 'Untitled record'); a.className = 'ov-record-link';";
const newLink = "        const li = el('li'), a = route(item.title || 'Untitled record', panel.id, 'ov-record-link', item.id);";
function once(source, from, to, label) {
  assert.equal(source.split(from).length, 2, label + ' must occur exactly once and match its complete approved body');
  return source.replace(from, to);
}
function normalise(file, source) {
  source = require('./overview-quick-add-source.cjs').normalise(file, source);
  if (file === 'index.html' && (source.includes('oce:record-target') || source.includes(newRecord))) {
    source = once(source, resolver, '', 'G1 record resolver');
    source = once(source, newRecord, oldRecord, 'G1 original record ID');
  }
  if (file === 'ui-workspaces.css' && source.includes('ws-record-target'))
    source = once(source, highlight, '', 'G1 screen-only highlight');
  if (file === 'ui-overview.js' && source.includes("route(item.title || 'Untitled record'"))
    source = once(source, newLink, oldLink, 'G1 original-record link');
  return source;
}
module.exports = {normalise, oldRecord, newRecord, resolver, highlight, oldLink, newLink};
