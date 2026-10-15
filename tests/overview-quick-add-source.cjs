// Exact reversible G2 additions. Existing source-parity checks remain unchanged.
const assert = require('node:assert/strict');
const additions = {
  'ui-overview.js': `    // G2: shortcuts invoke the original Add controls; all form logic stays there.
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
`,
  'ui-overview.css': `/* G2: compact shortcuts to the existing Add forms. */
@media screen {
  .ov-add-actions { display:flex;flex-wrap:wrap;gap:8px; }
  .ov-add-action { min-height:44px;padding:8px 14px;border:1px solid #b8cde0;border-radius:6px;background:#fff;color:#1b5b8e;font:600 14px/1.4 var(--font-body);cursor:pointer; }
  .ov-add-action:hover { background:#edf5fc;border-color:#2678b7; }
  .ov-add-action:focus-visible { outline:3px solid #3189d4;outline-offset:2px; }
  body.viewer .ov-add-actions,body.locked .ov-add-actions { display:none; }
  @media(max-width:680px) {
    .ov-add-actions { display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr) minmax(0,1fr); }
    .ov-add-action { padding:8px 4px; }
  }
}
/* END G2 Quick Add. */
`
};
function normalise(file, source) {
  source = source.replace(/\r\n/g, '\n');
  if (additions[file]) {
    assert.equal(source.split(additions[file]).length, 2, file + ' G2 addition must occur once and match its complete approved body');
    return source.replace(additions[file], '');
  }
  return source;
}
module.exports = { normalise, additions };

if (require.main === module) {
  const test = require('node:test'), fs = require('node:fs'), path = require('node:path');
  const { execFileSync } = require('node:child_process'), root = path.resolve(__dirname, '..');
  for (const [file, addition] of Object.entries(additions)) test('G2 exact source allowance: ' + file, () => {
    const baseline = execFileSync('git', ['show', 'cfdcdd2:' + file], { cwd: root, encoding: 'utf8' }).replace(/\r\n/g, '\n');
    const current = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(normalise(file, current), baseline, 'Original source remains byte-identical');
    assert.throws(() => normalise(file, current + addition), 'Duplicate addition rejected');
    assert.throws(() => normalise(file, current.replace(addition, '')), 'Missing addition rejected');
    assert.throws(() => normalise(file, current.replace(addition, addition.replace('G2:', 'G2 changed:'))), 'Altered addition rejected');
    assert.notEqual(normalise(file, current + '\n/* unrelated change */'), baseline, 'Unrelated changes remain visible');
  });
}
