// Explicitly delimit the only B1 addition to the authoritative inline runtime.
// Removing it for comparison keeps every pre-existing function under byte parity.
const assert = require('node:assert/strict');
module.exports = function stripOverview(source) {
  const start = '  // BEGIN B1 read-only adapter. Original filters/formatters remain authoritative.\n';
  const end = '  // END B1 read-only adapter.\n\n';
  assert.equal(source.split(start).length,2);assert.equal(source.split(end).length,2);
  const from=source.indexOf(start),to=source.indexOf(end)+end.length;
  const adapter=source.slice(from,to);
  assert.doesNotMatch(adapter,/\b(save|stampResolved|recordHistory|touchPanel|renderAll|publish|fetch|setItem|removeItem)\s*\(/);
  return source.slice(0,from)+source.slice(to);
};
