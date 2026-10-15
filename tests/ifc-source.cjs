// Exact IFC-only reversals for historical source-parity assertions.
// Every integration fragment must match once; unexpected edits remain visible.
const assert = require('node:assert/strict');
const patches = [
  ["/* IFC feedback stays with its permitted model row, including partial failures. */\n.model-row:has(.model-import-status) { flex-wrap: wrap; }\n.model-import-status { flex-basis: 100%; padding: 4px 8px; font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }\n.model-import-status[data-error=\"true\"] { color: #a52c24; }\n", ""],
  ["            <button class=\"tool-btn\" id=\"btnModelUpload\" title=\"View a 3D model (.ifc/.obj/.stl/.glb/.gltf) this session\"><i class=\"fa-solid fa-file-import\"></i><span class=\"lbl\">Add file</span></button>\n", "            <button class=\"tool-btn\" id=\"btnModelUpload\" title=\"View a 3D model (.stl/.glb/.gltf) this session\"><i class=\"fa-solid fa-file-import\"></i><span class=\"lbl\">Add file</span></button>\n"],
  ["            <input type=\"file\" id=\"fileModel\" class=\"hidden-file\" accept=\".ifc,.stl,.obj,.glb,.gltf,model/stl,model/obj,model/gltf-binary,model/gltf+json\" />\n", "            <input type=\"file\" id=\"fileModel\" class=\"hidden-file\" accept=\".stl,.obj,.glb,.gltf,model/stl,model/obj,model/gltf-binary,model/gltf+json\" />\n"],
  ["  const modelFmt = (s) => { const m = /\\.(glb|gltf|stl|obj|ifc)(\\?|#|$)/i.exec(s || \"\"); return m ? m[1].toLowerCase() : \"\"; };\n", "  const modelFmt = (s) => { const m = /\\.(glb|gltf|stl|obj)(\\?|#|$)/i.exec(s || \"\"); return m ? m[1].toLowerCase() : \"\"; };\n"],
  ["  // IFC imports and feedback are transient viewer resources, never board data.\n  const ifcImports = new Map(), modelFeedback = new Map();\n  function setModelFeedback(model, text, error = false) {\n    const current = modelRecord(model.id);\n    if (!current || current.url !== model.url) return;\n    modelFeedback.set(model.id, {text, error});\n    const node = document.querySelector('[data-model-status=\"' + CSS.escape(model.id) + '\"]');\n    if (node) { node.textContent = text; node.dataset.error = String(error); }\n  }\n  function disposeModelObject(object) {\n    if (!object) return;\n    if (object.parent) object.parent.remove(object);\n    const geometries = new Set(), materials = new Set(), textures = new Set();\n    object.traverse((part) => {\n      if (part.geometry) geometries.add(part.geometry);\n      for (const material of (Array.isArray(part.material) ? part.material : [part.material])) {\n        if (!material) continue; materials.add(material);\n        Object.values(material).forEach((value) => { if (value?.isTexture) textures.add(value); });\n      }\n    });\n    geometries.forEach((value) => value.dispose()); materials.forEach((value) => value.dispose()); textures.forEach((value) => value.dispose());\n  }\n  function releaseModel(id) {\n    ifcImports.get(id)?.abort(); ifcImports.delete(id); modelFeedback.delete(id);\n    disposeModelObject(loadedObjs[id]); delete loadedObjs[id];\n  }\n", ""],
  ["        if (fmt === \"ifc\") {\n          const controller = new AbortController(); ifcImports.set(m.id, controller);\n          setModelFeedback(m, \"Loading IFC…\");\n          import('./ifc-loader.js').then(({loadIFCModel}) => loadIFCModel(m.url, THREE, {\n            signal:controller.signal, progress:(text) => setModelFeedback(m, text)\n          })).then((object) => {\n            setModelFeedback(m, object.userData.ifc.schema + \" · \" + object.userData.ifc.parts + \" geometry parts\"); done(object);\n          }).catch((error) => {\n            if (error.name !== \"AbortError\") setModelFeedback(m, \"IFC import failed: \" + error.message, true);\n            rej(error);\n          }).finally(() => { if (ifcImports.get(m.id) === controller) ifcImports.delete(m.id); });\n        }\n        else if (fmt === \"stl\") new THREE.STLLoader().load(m.url, (geo) => { geo.computeVertexNormals(); const g = new THREE.Group(); g.add(new THREE.Mesh(geo, grey())); done(g); }, undefined, rej);\n", "        if (fmt === \"stl\") new THREE.STLLoader().load(m.url, (geo) => { geo.computeVertexNormals(); const g = new THREE.Group(); g.add(new THREE.Mesh(geo, grey())); done(g); }, undefined, rej);\n"],
  ["    if (!models.length) { list.innerHTML = editor ? `<div class=\"model-hint\">Add a 3D model (<b>.ifc</b>, .stl, .obj, .glb or .gltf) with the buttons above. Upload views it here for you now; a hosted <b>URL</b> is shared with site &amp; clients.</div>` : \"\"; return; }\n", "    if (!models.length) { list.innerHTML = editor ? `<div class=\"model-hint\">Add a 3D model (<b>.stl</b>, .obj, .glb or .gltf) with the buttons above. Upload views it here for you now; a hosted <b>URL</b> is shared with site &amp; clients.</div>` : \"\"; return; }\n"],
  ["        ${m.fmt === \"ifc\" ? `<span class=\"model-import-status\" role=\"status\" data-model-status=\"${esc(m.id)}\" data-error=\"${!!modelFeedback.get(m.id)?.error}\">${esc(modelFeedback.get(m.id)?.text || \"IFC2x3 / IFC4\")}</span>` : \"\"}\n", ""],
  ["    if (!/^https?:\\/\\//i.test(url)) { toast(\"Enter a full https URL to a .ifc / .stl / .obj / .glb / .gltf file\", true); return; }\n", "    if (!/^https?:\\/\\//i.test(url)) { toast(\"Enter a full https URL to a .stl / .obj / .glb / .gltf file\", true); return; }\n"],
  ["    if (!fmt) { toast(\"That should be a .ifc, .stl, .obj, .glb or .gltf file URL\", true); return; }\n", "    if (!fmt) { toast(\"That should be a .stl, .obj, .glb or .gltf file URL\", true); return; }\n"],
  ["    const url = window.prompt(\"Paste the URL of a hosted 3D model (.ifc, .stl, .obj, .glb or .gltf).\\n\\nTip: commit the file to your repo (e.g. /models/site.ifc) then use:\\nhttps://mpb029.github.io/OCE-OPS/models/site.ifc\");\n", "    const url = window.prompt(\"Paste the URL of a hosted 3D model (.stl, .obj, .glb or .gltf).\\n\\nTip: commit the file to your repo (e.g. /models/site.stl) then use:\\nhttps://mpb029.github.io/OCE-OPS/models/site.stl\");\n"],
  ["    if (!fmt) { toast(\"Please choose a .ifc, .stl, .obj, .glb or .gltf file\", true); return; }\n    sessionModels[uid()] = { name: file.name.replace(/\\.(glb|gltf|stl|obj|ifc)$/i, \"\"), url: URL.createObjectURL(file), fmt: fmt, visible: true };\n", "    if (!fmt) { toast(\"Please choose a .stl, .obj, .glb or .gltf file\", true); return; }\n    sessionModels[uid()] = { name: file.name.replace(/\\.(glb|gltf|stl|obj)$/i, \"\"), url: URL.createObjectURL(file), fmt: fmt, visible: true };\n"],
  ["    toast((fmt === \"ifc\" ? \"Importing IFC\" : \"Model loaded\") + \" (this session only \\u2014 add a hosted URL to share it)\");\n", "    toast(\"Model loaded (this session only \\u2014 add a hosted URL to share it)\");\n"],
  ["  function removeModel(id) {\n    releaseModel(id);\n", "  function removeModel(id) {\n    if (three && loadedObjs[id] && loadedObjs[id].parent) three.scene.remove(loadedObjs[id]);\n    delete loadedObjs[id];\n"],
  ["        new Set([...Object.keys(loadedObjs), ...ifcImports.keys()]).forEach((id) => {\n", "        Object.keys(loadedObjs).forEach((id) => {\n"],
  ["          releaseModel(id);\n", "          const obj = loadedObjs[id]; if (obj.parent) obj.parent.remove(obj); delete loadedObjs[id];\n"],
  ["      releaseModel(model.id);\n", "      const previous = loadedObjs[model.id]; if (previous.parent) previous.parent.remove(previous);\n      delete loadedObjs[model.id];\n"],
  ["        disposeModelObject(object);\n", "        if (object.parent) object.parent.remove(object);\n"],
];
function normalise(file, source) {
  source = source.replace(/\r\n/g, '\n');
  if (file !== 'index.html' || (!source.includes("import('./ifc-loader.js')") && !source.includes('model-import-status'))) return source;
  patches.forEach(([from, to], index) => {
    assert.equal(source.split(from).length, 2, 'IFC integration fragment ' + (index + 1) + ' must match exactly once');
    source = source.replace(from, to);
  });
  return source;
}
module.exports = {normalise};

if (require.main === module) {
  const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
  const root = path.resolve(__dirname, '..');
  const current = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const baseline = cp.execFileSync('git', ['show', '3692d1ec744459333fd2e7d41b8e08abdebaadcf:index.html'],
    {cwd:root, encoding:'utf8', maxBuffer:5*1024*1024}).replace(/\r\n/g, '\n');
  assert.equal(require('./work-package-source.cjs').normalise('index.html', normalise('index.html', current)), baseline, 'Combined Work Package and IFC changes reverse exactly to main');
  assert.equal(normalise('index.html', baseline), baseline, 'historical source is unchanged');
  assert.equal(require('./overview-record-source.cjs').normalise('index.html', current),
    require('./overview-record-source.cjs').normalise('index.html', baseline), 'earlier source contracts remain authoritative');
  patches.forEach(([fragment], index) => {
    const changed = fragment.slice(0, -1) + '~' + fragment.slice(-1);
    assert.throws(() => normalise('index.html', current.replace(fragment, changed)), undefined, 'modified fragment ' + index);
    assert.throws(() => normalise('index.html', current.replace(fragment, fragment + fragment)), undefined, 'duplicated fragment ' + index);
  });
  const unrelated = current.replace('let three = null;', 'let three = 7;');
  assert.notEqual(unrelated, current);
  assert.notEqual(normalise('index.html', unrelated), baseline, 'unrelated edits remain visible');
  console.log('PASS exact IFC source reversal, historical contracts, ' + patches.length + ' modified/duplicate fragment rejections and unrelated-edit detection.');
}
