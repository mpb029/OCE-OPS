const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const playwright = require('playwright');
const engine = process.env.OCE_ENGINE || 'chromium';
const fixtures = require('./fixtures.cjs');

const root = path.resolve(__dirname, '..');
const baseline = 'bee28796bb00f860d17b723d6a3c0b01bd5f4101';
const original = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const output = path.resolve(process.env.OCE_TEST_OUTPUT || path.join(root, 'test-results'));
fs.mkdirSync(output, { recursive: true });
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.geojson': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.obj': 'text/plain', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json' };

// These read-only probes exist only in the test server's response, never the deployed app.
const probe = `window.__opsTest = {
 get ready() { return remoteResolved; },
 get state() { return state; }, get sync() { return sync; }, get map() { return map; },
 get geoLayer() { return geoLayer; }, get markerLayer() { return markerLayer; },
 get userLayers() { return userLayers; }, get currentProject() { return currentProject; },
 get three() { return three; }, get loadedObjs() { return loadedObjs; },
 get sessionModels() { return sessionModels; }, get rasterLayers() { return rasterLayers; },
 PANELS, CATEGORIES, shareableState, sortItemsForDisplay, visiblePanelItems, orderedPanels,
 projInScope, cyrb53, defaultState
};\n`;

async function start() {
 const server = http.createServer((req, res) => {
  if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
  const url = new URL(req.url, 'http://localhost');
  const before = url.pathname.startsWith('/before/');
  let rel = decodeURIComponent(url.pathname.replace(/^\/(before|after)\//, ''));
  if (!rel || rel.endsWith('/')) rel += 'index.html';
  const generated = {
    'tests/fixture.glb': ['model/gltf-binary', fixtures.glb],
    'tests/fixture.gltf': ['model/gltf+json', () => JSON.stringify(fixtures.gltf())],
    'tests/fixture-image.png': ['image/png', () => fixtures.pixel]
  }[rel];
  if (generated) { res.writeHead(200, { 'Content-Type': generated[0] }); return res.end(generated[1]()); }
  const file = path.resolve(root, rel);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  try {
   let body = before && rel === 'index.html' ? execFileSync('git', ['show', `${baseline}:index.html`], { cwd: root, maxBuffer: 2e6 }) : fs.readFileSync(file);
   if (rel === 'index.html') body = body.toString().replace(/\}\)\(\);\s*<\/script>\s*<\/body>/, probe + '})();\n</script>\n</body>');
   res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
   res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
 });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 const browser = await playwright[engine].launch({ headless: true, executablePath: process.env.OCE_BROWSER || undefined, ...(engine==='chromium'?{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{firefoxUserPrefs:{'webgl.force-enabled':true}}) }).catch(error => { server.close(); throw error; });
 return { browser, engine, url: `http://127.0.0.1:${server.address().port}`, close: async () => { await browser.close(); await new Promise(resolve => server.close(resolve)); } };
}

function fixture() {
 const data = structuredClone(original);
 // Only the isolated in-memory fixture uses a known test gate and audience links.
 data.settings.editPass = '';
 data.settings.siteKey = 'test-site';
 data.clients.forEach((c, i) => c.key = `test-client-${i}`);
 return data;
}

async function open(env, { version = 'after', width = 1440, height = 900, audience = '', data = fixture(), token = false, touch = false, liveClock = false, workArea = 'root' } = {}) {
 const context = await env.browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ...(engine==='chromium'?{isMobile:touch}:{}), hasTouch: touch, locale: 'en-AU', timezoneId: 'Australia/Brisbane', acceptDownloads: true });
 const network = { writes: [], errors: [], console: [], failed: [], sharedReads: 0, publishFailure: false };
 const page = await context.newPage();
 page.setDefaultTimeout(12000);
 page.on('pageerror', e => network.errors.push(e.message));
 page.on('requestfailed', req => network.failed.push({ url: req.url(), error: req.failure()?.errorText }));
 page.on('console', m => { if (m.type() === 'error') network.console.push(m.text()); });
 // Comparisons freeze timestamps; captures allow Date.now to advance for Leaflet fades.
 if (liveClock) await page.clock.setSystemTime(new Date('2026-10-13T00:00:00+10:00'));
 else await page.clock.setFixedTime(new Date('2026-10-13T00:00:00+10:00'));
 await context.addInitScript(({ token }) => {
   localStorage.setItem('offaly_ops_repo', JSON.stringify({ owner: 'regression-fixture', repo: 'test-board', branch: 'test-only' }));
   if (token) localStorage.setItem('offaly_ops_token', 'fixture-token-not-a-credential');
   window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; };
 }, { token });
 await context.route('**/*', async route => {
  const req = route.request(), url = new URL(req.url());
  if (url.pathname.endsWith('/workarea.geojson') && workArea !== 'root') {
    if (workArea === 'legacy' && url.pathname.includes('/data/')) return route.fulfill({path:path.join(root,'workarea.geojson'),contentType:'application/json'});
    return route.fulfill({status:404,body:'Missing fixture'});
  }
  if (/\/data\.json$/.test(url.pathname) && url.hostname !== 'api.github.com') {
    network.sharedReads++;
    return route.fulfill({ json: data });
  }
  if (url.hostname === 'api.github.com') {
    if (req.method() !== 'GET') {
      network.writes.push({ url: req.url(), method: req.method(), body: req.postDataJSON() });
      if (network.publishFailure) return route.fulfill({ status: 403, json: { message: 'Test rejection' } });
      return route.fulfill({ json: { content: { sha: 'test-sha', download_url: env.url + '/after/tests/' + (/\.png/i.test(req.postDataJSON().message) ? 'fixture-image.png' : 'fixture-file.txt') }, commit: { sha: 'test-commit' } } });
    }
    return route.fulfill({ json: { sha: 'test-sha' } });
  }
  // Explicitly prevent every external mutation, including accidental production writes.
  if (!['GET', 'HEAD'].includes(req.method())) return route.abort('blockedbyclient');
  if (url.hostname === 'api.open-meteo.com') {
    const time = ['2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18'];
    return route.fulfill({ json: { current: { temperature_2m: 24, relative_humidity_2m: 64, apparent_temperature: 25, weather_code: 2, wind_speed_10m: 12 }, daily: { time, weather_code: [2,1,3,2,61,1,0], temperature_2m_max: [26,27,26,25,24,27,28], temperature_2m_min: [18,18,17,18,18,17,18], precipitation_probability_max: [10,5,15,20,60,5,0] } } });
  }
  // Use the repository's unchanged attachments, avoiding live data dependencies.
  const fileMatch = /\/(files|aerial)\/(.+)$/.exec(decodeURIComponent(url.pathname));
  if (fileMatch && ['mpb029.github.io','raw.githubusercontent.com'].includes(url.hostname)) {
    const local = path.resolve(root, fileMatch[1], fileMatch[2]);
    if (local.startsWith(root + path.sep) && fs.existsSync(local)) return route.fulfill({ path: local });
  }
  return route.continue();
 });
 const target = new URL(`${env.url}/${version}/index.html${audience}`);
 if (env.workspaces && version === 'after') { target.searchParams.set('ui','workspaces'); if(!target.searchParams.has('workspace'))target.searchParams.set('workspace','all'); }
 await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
 // Board readiness is independent of continuously loading third-party map tiles.
 await page.waitForFunction(() => window.__opsTest?.ready && document.querySelector('#panelsGrid .card'));
 await page.evaluate(() => document.fonts.ready);
 return { page, context, network, data, close: () => context.close() };
}

module.exports = { root, baseline, original, output, start, open, fixture };
