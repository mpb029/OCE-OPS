// The historical board has no WP readiness or per-record Print action. Allow only
// these exact additions on legacy records; compare every original node as before.
const assert = require('node:assert/strict');
const compact = text => text.replace(/\s+/g, '');
const readiness = 'NO GOMaterials: UnconfirmedMaterials unconfirmed';
async function additions(page) {
  const result = await page.evaluate(() => {
    const card = document.querySelector('[data-card="workPackages"]');
    if (!card) return [];
    return [...card.querySelectorAll('[data-wp-print]')].map(button => {
      const row = button.closest('li'), block = row.querySelector('.wp-readiness');
      const record = __opsTest.state.panels.workPackages.find(it => it.id === button.dataset.wpPrint);
      return {record, button:button.textContent, readiness:block?.textContent,
        blocks:row.querySelectorAll('.wp-readiness').length,
        visible:!!block?.getClientRects().length && getComputedStyle(block).visibility !== 'hidden'};
    });
  });
  for (const item of result) {
    assert.ok(item.record, 'Print action retains the authoritative Work Package ID');
    for (const key of ['materialsStatus','prerequisiteIds','constraints','photos','attachments'])
      assert.equal(item.record[key], undefined, 'Legacy parity allowance requires absent optional WP fields: '+key);
    assert.equal(item.button, 'Print Work Package');
    assert.equal(item.blocks, 1);
    assert.equal(compact(item.readiness), compact(readiness), 'Only the exact legacy Unconfirmed/NO GO display is additive');
  }
  // A missing readiness block or action must not evade the allowance.
  const counts = await page.evaluate(() => {
    const card=document.querySelector('[data-card="workPackages"]');
    return {blocks:card?.querySelectorAll('.wp-readiness').length||0,actions:card?.querySelectorAll('[data-wp-print]').length||0,
      rows:card?.querySelectorAll('.card-body > .list > li').length||0,historical:location.pathname.startsWith('/before/')};
  });
  assert.equal(counts.blocks,result.length); assert.equal(counts.actions,result.length);
  if (!counts.historical) assert.equal(result.length,counts.rows,'Every rendered legacy package has readiness and its Print action');
  return result.filter(item=>item.visible).map(()=>readiness);
}
async function legacySnapshot(page, capture) {
  await additions(page);
  // Phase 1 expands S/C to Site/Client. Assert the exact original control identity,
  // title and state independently; these labels are not operational record text.
  const visibilityControls=await page.evaluate(()=>[...document.querySelectorAll('#panelsGrid [data-vis]')].map(button=>({
    hook:button.dataset.vis,title:button.title,label:button.textContent,on:button.classList.contains('on'),
    recordExists:(__opsTest.state.panels[button.dataset.vis.split(':')[1]]||[]).some(it=>it.id===button.dataset.vis.split(':')[2])
  })));
  for(const control of visibilityControls){
    assert.match(control.hook,/^(site|client):[^:]+:[^:]+$/);
    const site=control.hook.startsWith('site:');
    assert.ok([site?'S':'C',site?'Site':'Client'].includes(control.label),'Exact approved visibility label');
    assert.equal(control.title,site?'Show to site supervisor':'Show to client');
    assert.equal(control.recordExists,true,'Visibility action retains original record identity');
    delete control.label;
  }
  // Test-only, temporary DOM subtraction keeps innerText/textContent semantics
  // identical to the original assertion. Restore the same nodes before printing.
  await page.evaluate(() => {
    window.__wpParityNodes = [...document.querySelectorAll('[data-card="workPackages"] .wp-readiness,[data-card="workPackages"] [data-wp-print],#panelsGrid [data-vis]')].map(node => {
      const marker=document.createComment('WP parity');node.replaceWith(marker);return {node,marker};
    });
  });
  try { return {...await capture(),visibilityControls}; }
  finally { await page.evaluate(()=>{for(const {node,marker} of window.__wpParityNodes)marker.replaceWith(node);delete window.__wpParityNodes;}); }
}
module.exports={additions,legacySnapshot,readiness};
