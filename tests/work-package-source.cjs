// Exact WP1 reversal for historical source guards. Hash every allowed body;
// missing, duplicated, altered or unrelated code still fails the original guards.
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const blocks = [
  ['#fldWPReadiness {', '#map {', '57c9f3a553189652a11d8a014c712fe71947f16bca97d703191be3f446c651fb'],
  ['        <div id="fldWPReadiness"', '        <div class="field" id="fldDue"', '50e4da870a4daaf9327b8033f4d6dd41bb5e8cdd20550b95eb20bc36b2d9496a'],
  ['    if (pid === "workPackages") {', '  }\n\n  function fmtDay', 'e109ae4443b981f77bd7833d2a0bf16295d37bcc6a53d57ee6b1589fcd8d78b8'],
  ['  /* WP1: derived readiness', '  function openItemModal(', '7ccdbe56ac6b9fcce31ac6972f0f858d7955ef9c6a23b1500194d31330382b14'],
  ['\n    document.getElementById("fldWPReadiness").style.display', '\n\n    const showRef', '25d06760e1c0fa9b29eac0c43313bb99326abba79e6ed5a62ee98ef725c532a5'],
  ['\n\n    if (panel === "workPackages") {', '\n\n    let saved;', '16df34499a5401ef4385538c29a2bccbda8350f67d2a5d1e6023a6bb462fcf4b']
];
const once = (source, from, to) => {
  assert.equal(source.split(from).length, 2, 'WP1 exact integration must occur once');
  return source.replace(from, to);
};
function normalise(file, source) {
  source = require('./work-package-attachments-source.cjs').normalise(file, source);
  source = source.replace(/\r\n/g, '\n');
  if (file === 'ui-forms.js' && source.includes("'fldWPReadiness'"))
    return once(source, "['fldExtras','fldCustom','fldWPReadiness']", "['fldExtras','fldCustom']");
  if (file !== 'index.html' || !/WP1|fldWPReadiness|workPackageReadinessHtml/.test(source)) return source;
  for (const [start, end, hash] of blocks) {
    assert.equal(source.split(start).length, 2, 'WP1 block must occur once: ' + start);
    const a = source.indexOf(start), b = source.indexOf(end, a);
    assert.ok(b > a, 'WP1 block end missing');
    const body = source.slice(a, b);
    assert.equal(createHash('sha256').update(body).digest('hex'), hash, 'WP1 block must match its tested body');
    source = source.slice(0, a) + source.slice(b);
  }
  for (const variable of ['panelId', 'panel']) source = once(source,
    `    if (${variable} === "workPackages" && (sync.audience !== "editor" || editLocked)) return;\n`, '');
  return once(source,
    '<span class="sub">${pct}% complete</span>${p.id === "workPackages" ? workPackageReadinessHtml(it) : ""}</span>',
    '<span class="sub">${pct}% complete</span></span>');
}
module.exports = {normalise, blocks};
