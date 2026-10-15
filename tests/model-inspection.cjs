const fs = require('node:fs');
const path = require('node:path');
const { start, open, root, output } = require('./harness.cjs');
const noScreenshots = process.argv.includes('--no-screenshots');
(async () => {
 const env = await start(), results = [];
 try {
  for (const version of ['before', 'after']) {
   const run = await open(env, { version, liveClock: true }); const p = run.page;
   try {
    await p.locator('#fileModel').setInputFiles(path.join(root, 'G4N.obj'));
    await p.waitForFunction(() => __opsTest.three && Object.values(__opsTest.loadedObjs).some(o => o.parent) && __opsTest.three.renderer.info.render.triangles > 0, null, { timeout: 60000 });
    await p.locator('#modelCard').evaluate(el => el.scrollIntoView({ block: 'start' }));
    await p.waitForTimeout(350);
    const measure = () => p.evaluate(() => {
     const { three, loadedObjs } = __opsTest, objects = [];
     Object.values(loadedObjs).forEach(o => o.traverse(c => { if (c.isMesh) { c.geometry.computeBoundingBox(); objects.push({ name: c.name, vertices: c.geometry.attributes.position.count, bounds: c.geometry.boundingBox, rotation: o.rotation.x }); } }));
     return { objects, triangles: three.renderer.info.render.triangles, camera: three.camera.position.toArray(), target: three.controls.target.toArray(), aspect: three.camera.aspect, near: three.camera.near, far: three.camera.far };
    });
    results.push({ version, ...await measure() });
    if (!noScreenshots) await p.screenshot({ path: path.join(output, `g4n-${version}-default.png`) });
    await p.locator('[data-model-flip]').click();
    await p.waitForTimeout(350);
    if (!noScreenshots) await p.screenshot({ path: path.join(output, `g4n-${version}-y-up.png`) });
    for (let i = 0; i < 5; i++) await p.locator('[data-mtool="zoomin"]').click();
    await p.waitForTimeout(350);
    if (!noScreenshots) await p.screenshot({ path: path.join(output, `g4n-${version}-detail.png`) });
   } finally { await run.close(); }
  }
  fs.writeFileSync(path.join(output, 'g4n-inspection.json'), JSON.stringify(results, null, 2));
 } finally { await env.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
