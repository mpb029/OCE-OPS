// Exact WP2 reversal keeps the WP1 and earlier historical source guards authoritative.
// These reviewed block hashes and literal integration replacements are fixed, not inferred at runtime.
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const blocks = [
  [
    "/* WP2 attachment presentation and the single-record print scope. */",
    "/* End WP2 presentation. */\n",
    "24b965c007153eef0bae94100599f8ecab0569125221985628fc479a8ec3c847"
  ],
  [
    "  /* WP2: draft files use the existing uploader and record persistence, only after Save. */",
    "  /* End WP2 attachment handling. */\n\n",
    "48f3fca0d74464cf345bafb56ccf0aaf38d039ae8b530b32f2a5491e7d9970c6"
  ],
  [
    "  /* WP2: one permitted record, rendered through the existing native panel print path. */",
    "  /* End WP2 single-record printing. */\n\n",
    "619d06a94be8cdd31251176bbc6b918e5cf4fba8e1108996fb4806f742c26fb0"
  ]
];
// [WP2 integration, original WP1 integration], including unchanged surrounding context.
const replacements = [
  [
    "          <label>Photos</label>\n          <div class=\"photo-strip\" id=\"photoStrip\"></div>\n          <button type=\"button\" class=\"btn\" id=\"btnAddPhoto\"><i class=\"fa-solid fa-camera\"></i> Add photo</button>\n          <p id=\"wpAttachmentNotice\" role=\"status\" hidden></p>\n        </div>\n        <div class=\"field vis-field\">\n          <label>Visible to</label>\n",
    "          <label>Photos</label>\n          <div class=\"photo-strip\" id=\"photoStrip\"></div>\n          <button type=\"button\" class=\"btn\" id=\"btnAddPhoto\"><i class=\"fa-solid fa-camera\"></i> Add photo</button>\n        </div>\n        <div class=\"field vis-field\">\n          <label>Visible to</label>\n"
  ],
  [
    "    };\n    if (pid === \"workPackages\") {\n      // Optional readiness fields travel with the existing history entry; no second record store.\n      [\"materialsStatus\", \"prerequisiteIds\", \"constraints\", \"attachments\"].forEach((key) => {\n        if (it[key] !== undefined) state.history[it.id][key] = Array.isArray(it[key]) ? it[key].slice() : it[key];\n      });\n    }\n",
    "    };\n    if (pid === \"workPackages\") {\n      // Optional readiness fields travel with the existing history entry; no second record store.\n      [\"materialsStatus\", \"prerequisiteIds\", \"constraints\"].forEach((key) => {\n        if (it[key] !== undefined) state.history[it.id][key] = Array.isArray(it[key]) ? it[key].slice() : it[key];\n      });\n    }\n"
  ],
  [
    "               <button class=\"e\" data-edit=\"${p.id}:${it.id}\" title=\"Edit\"><i class=\"fa-solid fa-pen\"></i></button>\n               <button class=\"d\" data-del=\"${p.id}:${it.id}\" title=\"Remove\"><i class=\"fa-solid fa-trash\"></i></button>\n             </span>` : \"\";\n        const photos = p.id === \"workPackages\" ? wpAttachmentsHtml(it) : p.photos ? itemPhotosHtml(it, p.printSheet ? \"inline\" : \"\") : \"\";\n        const wpPrint = p.id === \"workPackages\" ? `<button class=\"btn wp-sheet-action\" data-wp-print=\"${esc(it.id)}\">Print Work Package</button>` : \"\";\n        const sheet = p.printSheet\n          ? `<span class=\"print-sheet print-only\"><span class=\"tickbox\"></span><span class=\"cmt-line\">Comments:</span></span>`\n          : \"\";\n        const liClass = [resolved ? \"done\" : \"\", it.wstatus === \"cancelled\" ? \"cancelled\" : \"\"].filter(Boolean).join(\" \");\n        return `<li class=\"${liClass}\"><span class=\"marker\" style=\"background:${p.color}\"></span>${txt}${team}${range}${due}${asg}${req}${wstat}${doneBadge}${prio}${stat}${chips}${acts}${wpPrint}${photos}${sheet}</li>`;\n      }).join(\"\");\n      const emptyMsg = kind === \"files\"\n        ? `No files yet.${editor ? ` <button data-empty-add=\"${p.id}\">Attach a file</button>` : \"\"}`\n",
    "               <button class=\"e\" data-edit=\"${p.id}:${it.id}\" title=\"Edit\"><i class=\"fa-solid fa-pen\"></i></button>\n               <button class=\"d\" data-del=\"${p.id}:${it.id}\" title=\"Remove\"><i class=\"fa-solid fa-trash\"></i></button>\n             </span>` : \"\";\n        const photos = p.photos ? itemPhotosHtml(it, p.printSheet ? \"inline\" : \"\") : \"\";\n        const sheet = p.printSheet\n          ? `<span class=\"print-sheet print-only\"><span class=\"tickbox\"></span><span class=\"cmt-line\">Comments:</span></span>`\n          : \"\";\n        const liClass = [resolved ? \"done\" : \"\", it.wstatus === \"cancelled\" ? \"cancelled\" : \"\"].filter(Boolean).join(\" \");\n        return `<li class=\"${liClass}\"><span class=\"marker\" style=\"background:${p.color}\"></span>${txt}${team}${range}${due}${asg}${req}${wstat}${doneBadge}${prio}${stat}${chips}${acts}${photos}${sheet}</li>`;\n      }).join(\"\");\n      const emptyMsg = kind === \"files\"\n        ? `No files yet.${editor ? ` <button data-empty-add=\"${p.id}\">Attach a file</button>` : \"\"}`\n"
  ],
  [
    "      }));\n    grid.querySelectorAll(\"[data-print-panel]\").forEach((b) =>\n      b.addEventListener(\"click\", () => printPanel(b.getAttribute(\"data-print-panel\"))));\n    grid.querySelectorAll(\"[data-wp-print]\").forEach((b) => b.addEventListener(\"click\", () => printWorkPackage(b.dataset.wpPrint)));\n    grid.querySelectorAll(\"[data-wp-download]\").forEach((b) => b.addEventListener(\"click\", () => {\n      const it = wpPermittedItem(b.dataset.wpDownload), file = it && wpAttachmentEntries(it)[Number(b.dataset.wpFile)];\n      if (file && wpFileUrl(file.meta.url)) downloadFileReference(file.meta);\n    }));\n    grid.querySelectorAll(\"[data-photo-report]\").forEach((b) =>\n      b.addEventListener(\"click\", () => openPhotoPrint(b.getAttribute(\"data-photo-report\"))));\n    grid.querySelectorAll(\"[data-dl]\").forEach((b) =>\n",
    "      }));\n    grid.querySelectorAll(\"[data-print-panel]\").forEach((b) =>\n      b.addEventListener(\"click\", () => printPanel(b.getAttribute(\"data-print-panel\"))));\n    grid.querySelectorAll(\"[data-photo-report]\").forEach((b) =>\n      b.addEventListener(\"click\", () => openPhotoPrint(b.getAttribute(\"data-photo-report\"))));\n    grid.querySelectorAll(\"[data-dl]\").forEach((b) =>\n"
  ],
  [
    "  /* End WP1 derived readiness. */\n\n  function openItemModal(panelId, itemId) {\n    if (wpUploading) return;\n    if (panelId === \"workPackages\" && (sync.audience !== \"editor\" || editLocked)) return;\n    const p = panelById(panelId);\n    const kind = panelKind(p);\n",
    "  /* End WP1 derived readiness. */\n\n  function openItemModal(panelId, itemId) {\n    if (panelId === \"workPackages\" && (sync.audience !== \"editor\" || editLocked)) return;\n    const p = panelById(panelId);\n    const kind = panelKind(p);\n"
  ],
  [
    "    document.getElementById(\"fEnd\").value = it.endDate || \"\";\n\n    // photos (punch list, weekly photos)\n    const showPhotos = !!p.photos || panelId === \"workPackages\";\n    document.getElementById(\"fldPhotos\").style.display = showPhotos ? \"\" : \"none\";\n    modalPhotos = showPhotos ? (it.photos || []).map((x) => Object.assign({}, x)) : [];\n    setupWPAttachments(panelId, it);\n    renderModalPhotos();\n\n    openModal(\"itemModal\");\n",
    "    document.getElementById(\"fEnd\").value = it.endDate || \"\";\n\n    // photos (punch list, weekly photos)\n    const showPhotos = !!p.photos;\n    document.getElementById(\"fldPhotos\").style.display = showPhotos ? \"\" : \"none\";\n    modalPhotos = showPhotos ? (it.photos || []).map((x) => Object.assign({}, x)) : [];\n    renderModalPhotos();\n\n    openModal(\"itemModal\");\n"
  ],
  [
    "  }\n\n  function saveItem() {\n    if (wpUploading) return;\n    const { panel, id } = editingItem;\n    if (panel === \"workPackages\" && (sync.audience !== \"editor\" || editLocked)) return;\n    const p = panelById(panel);\n",
    "  }\n\n  function saveItem() {\n    const { panel, id } = editingItem;\n    if (panel === \"workPackages\" && (sync.audience !== \"editor\" || editLocked)) return;\n    const p = panelById(panel);\n"
  ],
  [
    "      if (constraints || existing?.constraints !== undefined) data.constraints = constraints;\n    }\n\n    if (panel === \"workPackages\") {\n      const existing = id && state.panels[panel].find((it) => it.id === id);\n      const pending = wpAttachmentDraft.some((entry) => entry.file);\n      if (pending && (!hasToken() || !sync.owner || !sync.repo)) { wpFormError(\"Connect GitHub in Settings before saving attachments. Selected files have not been uploaded.\"); return; }\n      for (const [key, photo] of [[\"photos\", true], [\"attachments\", false]]) {\n        const refs = wpAttachmentDraft.filter((entry) => entry.photo === photo && !entry.file).map((entry) => entry.meta);\n        if (refs.length || existing?.[key] !== undefined) data[key] = refs;\n      }\n    }\n    let saved;\n    if (id) { saved = state.panels[panel].find((x) => x.id === id); Object.assign(saved, data); }\n    else { state.panels[panel] = state.panels[panel] || []; saved = Object.assign({ id: uid() }, data); state.panels[panel].push(saved); }\n    stampResolved(saved);\n    recordHistory(panel, saved);\n    if (panel === \"workPackages\") editingItem.id = saved.id;\n    if (panel === \"workPackages\" && wpAttachmentDraft.some((entry) => entry.file)) {\n      touchPanel(panel); save(); renderPanels();\n      saveWPAttachments(saved);\n      return;\n    }\n    touchPanel(panel); save(); renderPanels();\n    if (panel === \"workPackages\" && !wpStored(saved)) {\n      document.getElementById(\"wpAttachmentNotice\").textContent = \"Local storage could not retain this Work Package. It remains on this board; retry Save or Export a backup before closing this page.\";\n      return;\n    }\n    closeModal(\"itemModal\");\n  }\n\n  /* =======================================================================\n",
    "      if (constraints || existing?.constraints !== undefined) data.constraints = constraints;\n    }\n\n    let saved;\n    if (id) { saved = state.panels[panel].find((x) => x.id === id); Object.assign(saved, data); }\n    else { state.panels[panel] = state.panels[panel] || []; saved = Object.assign({ id: uid() }, data); state.panels[panel].push(saved); }\n    stampResolved(saved);\n    recordHistory(panel, saved);\n    touchPanel(panel); save(); renderPanels(); closeModal(\"itemModal\");\n  }\n\n  /* =======================================================================\n"
  ],
  [
    "        if (name === \"documents\" && (!text(item.name) || !text(item.url))) fail(\"documents.name / url\");\n        if (item.x !== undefined && !object(item.x)) fail(\"panels.\" + name + \".x\");\n        if (item.photos !== undefined && (!Array.isArray(item.photos) || !item.photos.every((photo) => object(photo) && text(photo.url)))) fail(\"photos.url\");\n        if (name === \"workPackages\" && item.attachments !== undefined && (!Array.isArray(item.attachments) || !item.attachments.every((file) => object(file) && text(file.url)))) fail(\"workPackages.attachments.url\");\n      });\n    });\n    (parsed.stats || []).forEach((stat) => { if (stat.fields !== undefined && (!Array.isArray(stat.fields) || !stat.fields.every(object))) fail(\"stats.fields\"); });\n",
    "        if (name === \"documents\" && (!text(item.name) || !text(item.url))) fail(\"documents.name / url\");\n        if (item.x !== undefined && !object(item.x)) fail(\"panels.\" + name + \".x\");\n        if (item.photos !== undefined && (!Array.isArray(item.photos) || !item.photos.every((photo) => object(photo) && text(photo.url)))) fail(\"photos.url\");\n      });\n    });\n    (parsed.stats || []).forEach((stat) => { if (stat.fields !== undefined && (!Array.isArray(stat.fields) || !stat.fields.every(object))) fail(\"stats.fields\"); });\n"
  ],
  [
    "    inp.value = \"\"; inp.click();\n  }\n  function onPhotoPicked(e) {\n    if (editingItem.panel === \"workPackages\") { stageWPAttachments(e); return; }\n    const files = Array.from(e.target.files || []);\n    e.target.value = \"\";\n    files.forEach((f) => {\n",
    "    inp.value = \"\"; inp.click();\n  }\n  function onPhotoPicked(e) {\n    const files = Array.from(e.target.files || []);\n    e.target.value = \"\";\n    files.forEach((f) => {\n"
  ],
  [
    "    });\n  }\n  function renderModalPhotos() {\n    if (editingItem.panel === \"workPackages\") { renderWPAttachments(); return; }\n    const wrap = document.getElementById(\"photoStrip\");\n    if (!wrap) return;\n    wrap.innerHTML = modalPhotos.map((ph, i) =>\n",
    "    });\n  }\n  function renderModalPhotos() {\n    const wrap = document.getElementById(\"photoStrip\");\n    if (!wrap) return;\n    wrap.innerHTML = modalPhotos.map((ph, i) =>\n"
  ],
  [
    "\n  function downloadAttachment(pid, iid) {\n    const it = (state.panels[pid] || []).find((x) => x.id === iid);\n    return downloadFileReference(it);\n  }\n  function downloadFileReference(it) {\n    if (!it || !it.url) return;\n    fetch(it.url, { cache: \"no-store\" })\n      .then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); })\n",
    "\n  function downloadAttachment(pid, iid) {\n    const it = (state.panels[pid] || []).find((x) => x.id === iid);\n    if (!it || !it.url) return;\n    fetch(it.url, { cache: \"no-store\" })\n      .then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); })\n"
  ]
];
function normalise(file, source) {
  source = source.replace(/\r\n/g, '\n');
  if (file !== 'index.html' || !/WP2|wpAttachmentDraft|wpPrintSheet/.test(source)) return source;
  for (const [start, end, hash] of blocks) {
    assert.equal(source.split(start).length, 2, 'WP2 block must occur once: ' + start);
    assert.equal(source.split(end).length, 2, 'WP2 block end must occur once: ' + end);
    const a = source.indexOf(start), closing = source.indexOf(end, a);
    assert.ok(closing > a, 'WP2 block end missing');
    const b = closing + end.length;
    assert.equal(createHash('sha256').update(source.slice(a, b)).digest('hex'), hash, 'WP2 block must match its tested body');
    source = source.slice(0, a) + source.slice(b);
  }
  for (const [from, to] of replacements) {
    assert.equal(source.split(from).length, 2, 'WP2 exact integration must occur once');
    source = source.replace(from, to);
  }
  return source;
}
module.exports = {normalise, blocks, replacements};
