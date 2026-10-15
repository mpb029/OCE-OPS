// Exact reversible source allowance for the separately tested Stage E adapter.
// All earlier domain functions and assertion bodies still compare byte-for-byte.
const assert = require('node:assert/strict');
const read = "fs.readFileSync(path.join(root,file),'utf8').replace(/\\r\\n/g,'\\n')";
const normalRead = "require('./stage-e-source.cjs').normalise(file," + read + ')';
const indexRead = "fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/\\r\\n/g,'\\n')";
const sourcePatches = {
  'tests/regression.cjs': [[
    "const currentHTML = fs.readFileSync(path.join(root,'index.html'),'utf8');",
    "const currentHTML = require('./stage-e-source.cjs').normalise('index.html',fs.readFileSync(path.join(root,'index.html'),'utf8'));"
  ]],
  'tests/overview-refinement.cjs': [[read, normalRead]],
  'tests/spatial-usability.cjs': [[read, normalRead]],
  'tests/field-usability.cjs': [[read, normalRead]],
  'tests/forms-settings.cjs': [[read, normalRead]],
  'tests/workspaces.cjs': [
    [indexRead, "require('./stage-e-source.cjs').normalise('index.html'," + indexRead + ')'],
    ["  await require('./forms-settings.cjs')(env,check);", "  await require('./forms-settings.cjs')(env,check);\n  await require('./project-spatial.cjs')(env,check);"]
  ]
};
const start = '  // BEGIN E project spatial adapter.\n';
const end = '  // END E project spatial adapter.\n\n';
const link = '  <link rel="stylesheet" href="ui-project-spatial.css" />\n';
const printLink = '  <link rel="stylesheet" href="ui-report-print.css" media="print" />\n';
function once(source, from, to, label) {
  assert.equal(source.split(from).length, 2, label + ' must occur exactly once');
  return source.replace(from, to);
}
function normalise(file, source) {
  source = require('./overview-record-source.cjs').normalise(file, source);
  if (file === 'index.html') {
    if(source.includes(printLink))source=once(source,printLink,'','Stage F1 print stylesheet');
    assert.equal(source.split(start).length, 2, 'One Stage E adapter start');
    assert.equal(source.split(end).length, 2, 'One Stage E adapter end');
    const from = source.indexOf(start), to = source.indexOf(end);
    assert.ok(to > from, 'Stage E markers must be ordered');
    source = source.slice(0, from) + source.slice(to + end.length);
    return once(source, link, '', 'Stage E stylesheet');
  }
  for (const [before, after] of sourcePatches[file] || []) source = once(source, after, before, file + ' exact source allowance');
  return source;
}
module.exports = {normalise, sourcePatches, start, end, link, printLink};
