/* =========================================================================
   Offaly Civil — Site Operations Dashboard
   Static, client-side only. Data persists in this browser (localStorage)
   with Export / Import for backup and moving between devices.
   ========================================================================= */
(function () {
  "use strict";

  const STORE_KEY = "offaly_ops_v1";

  /* ---------- Projection: GDA94 / MGA Zone 56 -> WGS84 ------------------ */
  if (window.proj4) {
    proj4.defs(
      "EPSG:28356",
      "+proj=utm +zone=56 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs"
    );
  }

  /* ---------- Marker categories (Font Awesome solid glyphs + colour) ---- */
  const CATEGORIES = [
    { id: "note",     label: "General note",     icon: "fa-note-sticky",        color: "#f7a600" },
    { id: "hydrant",  label: "Hydrant",          icon: "fa-fire-flame-curved",  color: "#d2342b" },
    { id: "valve",    label: "Valve",            icon: "fa-gauge-high",         color: "#2f6fb0" },
    { id: "tie",      label: "Tie-in / connection", icon: "fa-link",            color: "#7b4fb0" },
    { id: "dig",      label: "Excavation",       icon: "fa-person-digging",     color: "#8a5a1e" },
    { id: "delivery", label: "Delivery / stockpile", icon: "fa-truck",          color: "#1e9e6a" },
    { id: "plant",    label: "Plant / equipment", icon: "fa-truck-front",       color: "#3a4a55" },
    { id: "traffic",  label: "Traffic control",  icon: "fa-traffic-light",      color: "#e8542a" },
    { id: "hazard",   label: "Hazard",           icon: "fa-triangle-exclamation", color: "#d2342b" },
    { id: "survey",   label: "Survey / setout",  icon: "fa-location-crosshairs", color: "#14202b" }
  ];
  const catById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];

  /* ---------- List panels ----------------------------------------------- */
  const PANELS = [
    { id: "dailyWorks",    title: "Daily Works",            icon: "fa-helmet-safety",   color: "#f7a600", span: false, mainLbl: "Task",     subLbl: "Crew / location / detail" },
    { id: "deliveries",    title: "Incoming Deliveries",    icon: "fa-truck-ramp-box",  color: "#1e9e6a", span: false, mainLbl: "Item",     subLbl: "Supplier / ETA / qty" },
    { id: "upcoming",      title: "Upcoming Works",         icon: "fa-calendar-week",   color: "#2f6fb0", span: false, mainLbl: "Task",     subLbl: "When / detail" },
    { id: "subbiesToday",  title: "Subcontractors Onsite",  icon: "fa-people-group",    color: "#e8542a", span: false, mainLbl: "Subbie",   subLbl: "Scope / contact" },
    { id: "subbiesTomorrow", title: "Subbies Onsite Tomorrow", icon: "fa-user-clock",  color: "#7b4fb0", span: false, mainLbl: "Subbie",   subLbl: "Scope / contact" }
  ];
  const panelById = (id) => PANELS.find((p) => p.id === id);

  /* ---------- WMO weather codes ----------------------------------------- */
  const WX = {
    0:  ["Clear",            "fa-sun"],
    1:  ["Mainly clear",     "fa-cloud-sun"],
    2:  ["Partly cloudy",    "fa-cloud-sun"],
    3:  ["Overcast",         "fa-cloud"],
    45: ["Fog",              "fa-smog"],
    48: ["Rime fog",         "fa-smog"],
    51: ["Light drizzle",    "fa-cloud-rain"],
    53: ["Drizzle",          "fa-cloud-rain"],
    55: ["Heavy drizzle",    "fa-cloud-showers-heavy"],
    61: ["Light rain",       "fa-cloud-rain"],
    63: ["Rain",             "fa-cloud-showers-heavy"],
    65: ["Heavy rain",       "fa-cloud-showers-heavy"],
    66: ["Freezing rain",    "fa-cloud-showers-heavy"],
    67: ["Freezing rain",    "fa-cloud-showers-heavy"],
    71: ["Light snow",       "fa-snowflake"],
    73: ["Snow",             "fa-snowflake"],
    75: ["Heavy snow",       "fa-snowflake"],
    80: ["Showers",          "fa-cloud-sun-rain"],
    81: ["Showers",          "fa-cloud-showers-heavy"],
    82: ["Violent showers",  "fa-cloud-showers-water"],
    95: ["Thunderstorm",     "fa-cloud-bolt"],
    96: ["Storm + hail",     "fa-cloud-bolt"],
    99: ["Storm + hail",     "fa-cloud-bolt"]
  };
  const wxInfo = (code) => WX[code] || ["—", "fa-cloud"];

  /* ---------- Default state --------------------------------------------- */
  function defaultState() {
    const uid = () => Math.random().toString(36).slice(2, 9);
    return {
      settings: {
        projectName: "Rainbow Beach STP — Bio-Solid Drying Bed",
        loc: { name: "Rainbow Beach, QLD", lat: -25.9060, lng: 153.0880 },
        geojsonCRS: "auto"
      },
      base: "street", // or "sat"
      markers: [],
      stats: [
        { id: uid(), label: "Pipe laid",       value: "0", unit: "m",   target: null },
        { id: uid(), label: "Connections",     value: "0", unit: "",    target: null },
        { id: uid(), label: "Reinstatement",   value: "0", unit: "m",   target: null },
        { id: uid(), label: "Days vs program", value: "0", unit: "",    target: null }
      ],
      panels: {
        dailyWorks: [],
        deliveries: [],
        upcoming: [],
        subbiesToday: [],
        subbiesTomorrow: []
      }
    };
  }

  /* ---------- State load / save ----------------------------------------- */
  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const d = defaultState();
      // shallow-merge to tolerate older saves
      return {
        settings: Object.assign({}, d.settings, parsed.settings),
        base: parsed.base || d.base,
        markers: parsed.markers || [],
        stats: parsed.stats || d.stats,
        panels: Object.assign({}, d.panels, parsed.panels)
      };
    } catch (e) {
      console.warn("Could not read saved data, starting fresh.", e);
      return defaultState();
    }
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { console.warn("Save failed", e); }
  }

  const uid = () => Math.random().toString(36).slice(2, 9);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* =======================================================================
     MAP
     ======================================================================= */
  let map, geoLayer, markerLayer, baseStreet, baseSat;
  let addMode = false;

  function initMap() {
    const { lat, lng } = state.settings.loc;
    map = L.map("map", { zoomControl: true }).setView([lat, lng], 16);

    baseStreet = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "&copy; OpenStreetMap contributors"
    });
    baseSat = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "Imagery &copy; Esri" }
    );

    (state.base === "sat" ? baseSat : baseStreet).addTo(map);
    syncBaseBtn();

    markerLayer = L.layerGroup().addTo(map);

    // Place marker on click while in add-mode
    map.on("click", (e) => {
      if (!addMode) return;
      const catId = document.getElementById("catSelect").value;
      const m = { id: uid(), lat: e.latlng.lat, lng: e.latlng.lng, category: catId, title: "", notes: "", ts: Date.now() };
      state.markers.push(m);
      save();
      drawMarkers();
      openMarkerModal(m.id, true);
      setAddMode(false);
    });

    renderMarkers();
    loadWorkArea();           // try repo file first
    setMapHint(`<b>Tip:</b> click <b>Add marker</b>, pick a type, then click the map to drop a pin.`);
  }

  function syncBaseBtn() {
    const b = document.getElementById("btnBase");
    const sat = state.base === "sat";
    b.classList.toggle("is-on", sat);
    b.querySelector(".lbl").textContent = sat ? "Street" : "Satellite";
  }

  function toggleBase() {
    if (state.base === "sat") { map.removeLayer(baseSat); baseStreet.addTo(map); state.base = "street"; }
    else { map.removeLayer(baseStreet); baseSat.addTo(map); state.base = "sat"; }
    syncBaseBtn(); save();
  }

  function pinIcon(cat) {
    return L.divIcon({
      className: "pin",
      html: `<div class="pin-body" style="--c:${cat.color}"><i class="fa-solid ${cat.icon}"></i></div>`,
      iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28]
    });
  }

  function drawMarkers() { renderMarkers(); }

  function renderMarkers() {
    markerLayer.clearLayers();
    state.markers.forEach((m) => {
      const cat = catById(m.category);
      const lm = L.marker([m.lat, m.lng], { icon: pinIcon(cat) }).addTo(markerLayer);
      const notes = m.notes ? esc(m.notes) : "No notes yet.";
      lm.bindPopup(
        `<div class="mk-pop">
           <div class="mk-cat"><span class="dot" style="background:${cat.color}"></span>${esc(cat.label)}</div>
           <h4>${esc(m.title || "(untitled)")}</h4>
           <div class="mk-notes ${m.notes ? "" : "empty"}">${notes}</div>
           <div class="mk-actions">
             <button class="edit" data-mk-edit="${m.id}"><i class="fa-solid fa-pen"></i>Edit</button>
             <button class="del"  data-mk-del="${m.id}"><i class="fa-solid fa-trash"></i>Delete</button>
           </div>
         </div>`
      );
    });
  }

  // delegated clicks inside Leaflet popups
  document.addEventListener("click", (e) => {
    const ed = e.target.closest("[data-mk-edit]");
    const dl = e.target.closest("[data-mk-del]");
    if (ed) { openMarkerModal(ed.getAttribute("data-mk-edit"), false); }
    if (dl) { deleteMarker(dl.getAttribute("data-mk-del")); }
  });

  function deleteMarker(id) {
    state.markers = state.markers.filter((m) => m.id !== id);
    save(); renderMarkers(); map.closePopup();
  }

  /* ---- GeoJSON (QGIS export) ------------------------------------------- */
  function styleFeature(f) {
    const t = f.geometry && f.geometry.type;
    if (t === "LineString" || t === "MultiLineString")
      return { color: "#e8542a", weight: 4, opacity: 0.9 };
    return { color: "#2f6fb0", weight: 2, fillColor: "#2f6fb0", fillOpacity: 0.12 };
  }

  function onEachFeature(f, layer) {
    const p = f.properties || {};
    const keys = Object.keys(p);
    if (!keys.length) return;
    const ttl = p.Asset || p.name || p.Name || p.id || "Feature";
    const rows = keys
      .filter((k) => k !== "Asset" && k !== "name" && k !== "Name")
      .map((k) => `<dt>${esc(k)}</dt><dd>${esc(p[k])}</dd>`).join("");
    layer.bindPopup(`<div class="feat-pop"><div class="feat-ttl">${esc(ttl)}</div><dl>${rows}</dl></div>`);
  }

  function pointToLayer(f, latlng) {
    return L.circleMarker(latlng, { radius: 6, color: "#fff", weight: 2, fillColor: "#2f6fb0", fillOpacity: 1 });
  }

  /* ---- CRS detection + reprojection (QGIS exports) --------------------- */
  // Geographic systems we can treat as lat/long without transforming.
  const GEOGRAPHIC = ["4326", "4283", "CRS84"];

  function firstCoord(data) {
    let f = null;
    if (data.type === "FeatureCollection" && data.features.length) f = data.features[0];
    else if (data.type === "Feature") f = data;
    const g = f ? f.geometry : data;
    if (!g) return null;
    let c = g.coordinates || (g.geometries && g.geometries[0] && g.geometries[0].coordinates);
    while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
    return Array.isArray(c) ? c : null;
  }

  // Returns the EPSG code (string) the file's coordinates are in.
  function detectSourceCRS(data) {
    const setting = (state.settings.geojsonCRS || "auto");
    if (setting !== "auto") return setting;

    const name = data && data.crs && data.crs.properties && data.crs.properties.name;
    if (name) {
      if (/CRS84/i.test(name)) return "4326";
      const m = String(name).match(/EPSG[:]{1,2}(\d+)/i);
      if (m) return m[1];
    }
    // No usable crs member — judge by coordinate magnitude.
    const c = firstCoord(data);
    if (c && (Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90)) return "28356"; // projected metres -> assume MGA56
    return "4326";
  }

  function reproject(data, fromCode) {
    if (!fromCode || GEOGRAPHIC.indexOf(fromCode) !== -1) return { data, code: fromCode || "4326", ok: true };
    if (!window.proj4) return { data, code: fromCode, ok: false, reason: "proj4 unavailable" };
    const from = "EPSG:" + fromCode;
    try { proj4(from); } catch (e) { return { data, code: fromCode, ok: false, reason: "unknown CRS " + from }; }

    const tx = (p) => {
      const o = proj4(from, "EPSG:4326", [p[0], p[1]]);
      return p.length > 2 ? [o[0], o[1], p[2]] : [o[0], o[1]];
    };
    const walk = (c) => (typeof c[0] === "number" ? tx(c) : c.map(walk));
    const doGeom = (g) => {
      if (!g) return;
      if (g.coordinates) g.coordinates = walk(g.coordinates);
      if (g.geometries) g.geometries.forEach(doGeom);
    };
    const clone = JSON.parse(JSON.stringify(data));
    if (clone.type === "FeatureCollection") clone.features.forEach((f) => doGeom(f.geometry));
    else if (clone.type === "Feature") doGeom(clone.geometry);
    else doGeom(clone);
    if (clone.crs) delete clone.crs;
    return { data: clone, code: fromCode, ok: true, transformed: true };
  }

  function addGeoJSON(data, fitTo) {
    if (geoLayer) { map.removeLayer(geoLayer); geoLayer = null; }
    const from = detectSourceCRS(data);
    const r = reproject(data, from);
    geoLayer = L.geoJSON(r.data, { style: styleFeature, onEachFeature, pointToLayer }).addTo(map);
    if (fitTo) fitFeatures();
    return r;
  }

  function reportGeo(r, label) {
    if (!r.ok) {
      setMapHint(`Loaded ${esc(label)}, but its coordinate system (<b>EPSG:${esc(r.code)}</b>) isn't supported here — re-export from QGIS as <b>EPSG:4326</b> or <b>EPSG:28356</b>.`);
      return;
    }
    if (r.transformed) setMapHint(`${esc(label)} loaded &middot; reprojected from <b>EPSG:${esc(r.code)}</b> (GDA94/MGA) to lat/long.`);
    else setMapHint(`${esc(label)} loaded &middot; coordinates already lat/long (<b>EPSG:${esc(r.code)}</b>).`);
  }

  function loadWorkArea() {
    fetch("data/workarea.geojson", { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((d) => { reportGeo(addGeoJSON(d, true), "Work area"); })
      .catch(() => {
        setMapHint(`No <b>data/workarea.geojson</b> loaded yet — use <b>Load GeoJSON</b> to open your QGIS export, or drop the file into the repo's <b>data/</b> folder.`);
      });
  }

  function fitFeatures() {
    const groups = [];
    if (geoLayer) groups.push(geoLayer);
    if (markerLayer && markerLayer.getLayers().length) groups.push(markerLayer);
    if (!groups.length) return;
    const fg = L.featureGroup(groups);
    try { map.fitBounds(fg.getBounds().pad(0.2)); } catch (e) {}
  }

  function setMapHint(html) {
    const el = document.getElementById("mapHint");
    el.innerHTML = html; el.style.display = html ? "block" : "none";
  }

  function setAddMode(on) {
    addMode = on;
    const b = document.getElementById("btnAddMode");
    b.classList.toggle("is-on", on);
    b.querySelector(".lbl").textContent = on ? "Click map…" : "Add marker";
    map.getContainer().style.cursor = on ? "crosshair" : "";
  }

  /* =======================================================================
     MARKER MODAL
     ======================================================================= */
  let editingMarkerId = null;
  let newMarkerPending = false;

  function openMarkerModal(id, isNew) {
    const m = state.markers.find((x) => x.id === id);
    if (!m) return;
    editingMarkerId = id; newMarkerPending = isNew;
    const sel = document.getElementById("mkCat");
    sel.innerHTML = CATEGORIES.map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join("");
    sel.value = m.category;
    document.getElementById("mkTitle").value = m.title || "";
    document.getElementById("mkNotes").value = m.notes || "";
    document.getElementById("markerModalTitle").textContent = isNew ? "New marker" : "Edit marker";
    openModal("markerModal");
    setTimeout(() => document.getElementById("mkTitle").focus(), 30);
  }

  function saveMarker() {
    const m = state.markers.find((x) => x.id === editingMarkerId);
    if (!m) return;
    m.category = document.getElementById("mkCat").value;
    m.title = document.getElementById("mkTitle").value.trim();
    m.notes = document.getElementById("mkNotes").value.trim();
    save(); renderMarkers(); closeModal("markerModal");
  }

  function deleteMarkerFromModal() {
    if (editingMarkerId) deleteMarker(editingMarkerId);
    closeModal("markerModal");
  }

  // if a freshly-placed marker's modal is cancelled, drop the empty pin
  function cancelMarkerModal() {
    if (newMarkerPending && editingMarkerId) {
      const m = state.markers.find((x) => x.id === editingMarkerId);
      if (m && !m.title && !m.notes) deleteMarker(editingMarkerId);
    }
    closeModal("markerModal");
  }

  /* =======================================================================
     WEATHER (Open-Meteo, no API key)
     ======================================================================= */
  function loadWeather() {
    const { lat, lng, name } = state.settings.loc;
    document.getElementById("wxLoc").textContent = name || `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
    const now = document.getElementById("wxNow");
    now.className = "wx-loading"; now.textContent = "Loading forecast…";
    document.getElementById("wxDays").innerHTML = "";

    const url = "https://api.open-meteo.com/v1/forecast"
      + `?latitude=${lat}&longitude=${lng}`
      + "&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m"
      + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum"
      + "&timezone=Australia%2FBrisbane&forecast_days=6";

    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(renderWeather)
      .catch((e) => {
        now.className = "wx-error";
        now.textContent = "Couldn't load the forecast — check the internet connection, then refresh.";
        console.warn("weather", e);
      });
  }

  function renderWeather(d) {
    const c = d.current || {};
    const [cond, ico] = wxInfo(c.weather_code);
    const now = document.getElementById("wxNow");
    now.className = "wx-now";
    now.innerHTML =
      `<div class="ico"><i class="fa-solid ${ico}"></i></div>
       <div class="big">${Math.round(c.temperature_2m)}<sup>&deg;C</sup></div>
       <div class="meta">
         <div class="cond">${esc(cond)}</div>
         <div>Wind ${Math.round(c.wind_speed_10m)} km/h &middot; Humidity ${Math.round(c.relative_humidity_2m)}%</div>
       </div>`;

    const dl = d.daily;
    const days = dl.time.map((t, i) => {
      const dt = new Date(t + "T00:00:00");
      const dow = i === 0 ? "Today" : dt.toLocaleDateString("en-AU", { weekday: "short" });
      const [, di] = wxInfo(dl.weather_code[i]);
      const pop = dl.precipitation_probability_max[i];
      return `<div class="wx-day">
        <div class="dow">${esc(dow)}</div>
        <div class="di"><i class="fa-solid ${di}"></i></div>
        <div class="hi">${Math.round(dl.temperature_2m_max[i])}&deg;</div>
        <div class="lo">${Math.round(dl.temperature_2m_min[i])}&deg;</div>
        <div class="pop">${pop != null ? pop + "%" : ""}</div>
      </div>`;
    }).join("");
    document.getElementById("wxDays").innerHTML = days;
  }

  /* =======================================================================
     PRODUCTION STATS
     ======================================================================= */
  let editingStatId = null;

  function renderStats() {
    const g = document.getElementById("statGrid");
    if (!state.stats.length) {
      g.innerHTML = `<div class="empty span-2" style="grid-column:span 2">No stats yet. <button id="emptyStat">Add one</button></div>`;
      const b = document.getElementById("emptyStat");
      if (b) b.onclick = () => openStatModal(null);
      return;
    }
    g.innerHTML = state.stats.map((s) => {
      let bar = "";
      const tgt = parseFloat(s.target);
      const val = parseFloat(String(s.value).replace(/[^0-9.\-]/g, ""));
      if (!isNaN(tgt) && tgt > 0 && !isNaN(val)) {
        const pct = Math.max(0, Math.min(100, (val / tgt) * 100));
        bar = `<div class="bar"><span style="width:${pct}%"></span></div><div class="tgt">${esc(s.value)} / ${esc(s.target)} ${esc(s.unit || "")}</div>`;
      }
      return `<div class="stat" data-stat="${s.id}">
        <button class="x" data-stat-del="${s.id}" title="Remove"><i class="fa-solid fa-xmark"></i></button>
        <div class="lbl">${esc(s.label)}</div>
        <div class="val">${esc(s.value)}${s.unit ? `<span class="unit">${esc(s.unit)}</span>` : ""}</div>
        ${bar}
      </div>`;
    }).join("");

    g.querySelectorAll("[data-stat]").forEach((el) => {
      el.addEventListener("click", (ev) => {
        if (ev.target.closest("[data-stat-del]")) return;
        openStatModal(el.getAttribute("data-stat"));
      });
    });
    g.querySelectorAll("[data-stat-del]").forEach((el) => {
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        state.stats = state.stats.filter((s) => s.id !== el.getAttribute("data-stat-del"));
        save(); renderStats();
      });
    });
  }

  function openStatModal(id) {
    editingStatId = id;
    const s = id ? state.stats.find((x) => x.id === id) : { label: "", value: "", unit: "", target: "" };
    document.getElementById("statModalTitle").textContent = id ? "Edit stat" : "Add stat";
    document.getElementById("sLabel").value = s.label || "";
    document.getElementById("sValue").value = s.value || "";
    document.getElementById("sUnit").value = s.unit || "";
    document.getElementById("sTarget").value = s.target == null ? "" : s.target;
    openModal("statModal");
    setTimeout(() => document.getElementById("sLabel").focus(), 30);
  }

  function saveStat() {
    const label = document.getElementById("sLabel").value.trim();
    if (!label) { document.getElementById("sLabel").focus(); return; }
    const data = {
      label,
      value: document.getElementById("sValue").value.trim() || "0",
      unit: document.getElementById("sUnit").value.trim(),
      target: document.getElementById("sTarget").value.trim() || null
    };
    if (editingStatId) {
      const s = state.stats.find((x) => x.id === editingStatId);
      Object.assign(s, data);
    } else {
      state.stats.push(Object.assign({ id: uid() }, data));
    }
    save(); renderStats(); closeModal("statModal");
  }

  /* =======================================================================
     LIST PANELS
     ======================================================================= */
  function renderPanels() {
    const grid = document.getElementById("panelsGrid");
    grid.innerHTML = PANELS.map((p) => {
      const items = state.panels[p.id] || [];
      const body = items.length
        ? `<ul class="list">${items.map((it) => `
            <li>
              <span class="marker" style="background:${p.color}"></span>
              <span class="txt">
                <span class="main">${esc(it.main)}</span>
                ${it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ""}
              </span>
              <span class="row-act">
                <button class="e" data-edit="${p.id}:${it.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="d" data-del="${p.id}:${it.id}" title="Remove"><i class="fa-solid fa-trash"></i></button>
              </span>
            </li>`).join("")}</ul>`
        : `<div class="empty">Nothing listed. <button data-empty-add="${p.id}">Add the first one</button></div>`;
      return `<section class="card">
        <div class="card-head">
          <span class="ttl"><span class="tag" style="background:${p.color}"><i class="fa-solid ${p.icon}"></i></span>${esc(p.title)}</span>
          <span class="spacer"></span>
          <span class="count">${items.length}</span>
          <button class="add" data-add="${p.id}" title="Add"><i class="fa-solid fa-plus"></i></button>
        </div>
        <div class="card-body">${body}</div>
      </section>`;
    }).join("");

    grid.querySelectorAll("[data-add]").forEach((b) =>
      b.addEventListener("click", () => openItemModal(b.getAttribute("data-add"), null)));
    grid.querySelectorAll("[data-empty-add]").forEach((b) =>
      b.addEventListener("click", () => openItemModal(b.getAttribute("data-empty-add"), null)));
    grid.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => {
        const [pid, iid] = b.getAttribute("data-edit").split(":");
        openItemModal(pid, iid);
      }));
    grid.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => {
        const [pid, iid] = b.getAttribute("data-del").split(":");
        state.panels[pid] = state.panels[pid].filter((x) => x.id !== iid);
        save(); renderPanels();
      }));
  }

  let editingItem = { panel: null, id: null };

  function openItemModal(panelId, itemId) {
    const p = panelById(panelId);
    editingItem = { panel: panelId, id: itemId };
    const it = itemId ? state.panels[panelId].find((x) => x.id === itemId) : { main: "", sub: "" };
    document.getElementById("itemModalTitle").textContent = (itemId ? "Edit — " : "Add to — ") + p.title;
    document.getElementById("itemModalIcon").className = "fa-solid " + p.icon;
    document.getElementById("lblMain").textContent = p.mainLbl;
    document.getElementById("lblSub").textContent = p.subLbl;
    document.getElementById("fMain").value = it.main || "";
    document.getElementById("fSub").value = it.sub || "";
    openModal("itemModal");
    setTimeout(() => document.getElementById("fMain").focus(), 30);
  }

  function saveItem() {
    const main = document.getElementById("fMain").value.trim();
    const sub = document.getElementById("fSub").value.trim();
    if (!main) { document.getElementById("fMain").focus(); return; }
    const { panel, id } = editingItem;
    if (id) {
      const it = state.panels[panel].find((x) => x.id === id);
      it.main = main; it.sub = sub;
    } else {
      state.panels[panel].push({ id: uid(), main, sub });
    }
    save(); renderPanels(); closeModal("itemModal");
  }

  /* =======================================================================
     SETTINGS
     ======================================================================= */
  function openSettings() {
    const s = state.settings;
    document.getElementById("setProj").value = s.projectName || "";
    document.getElementById("setLocName").value = s.loc.name || "";
    document.getElementById("setLat").value = s.loc.lat;
    document.getElementById("setLng").value = s.loc.lng;
    document.getElementById("setCRS").value = s.geojsonCRS || "auto";
    openModal("settingsModal");
  }

  function saveSettings() {
    const s = state.settings;
    s.projectName = document.getElementById("setProj").value.trim() || "Untitled project";
    s.loc.name = document.getElementById("setLocName").value.trim() || "Site";
    const lat = parseFloat(document.getElementById("setLat").value);
    const lng = parseFloat(document.getElementById("setLng").value);
    if (!isNaN(lat)) s.loc.lat = lat;
    if (!isNaN(lng)) s.loc.lng = lng;
    const prevCRS = s.geojsonCRS;
    s.geojsonCRS = document.getElementById("setCRS").value;
    save();
    renderHeader();
    loadWeather();
    if (map) map.setView([s.loc.lat, s.loc.lng]);
    if (s.geojsonCRS !== prevCRS) loadWorkArea(); // re-read with the new CRS interpretation
    closeModal("settingsModal");
  }

  /* =======================================================================
     EXPORT / IMPORT
     ======================================================================= */
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = URL.createObjectURL(blob);
    a.download = `offaly-ops-backup-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importData(file) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const parsed = JSON.parse(fr.result);
        state = {
          settings: Object.assign(defaultState().settings, parsed.settings),
          base: parsed.base || "street",
          markers: parsed.markers || [],
          stats: parsed.stats || [],
          panels: Object.assign(defaultState().panels, parsed.panels)
        };
        save();
        renderHeader(); renderStats(); renderPanels(); renderMarkers();
        loadWeather();
        if (map) map.setView([state.settings.loc.lat, state.settings.loc.lng]);
      } catch (e) {
        alert("That file couldn't be read as a dashboard backup. Make sure it's a JSON file exported from this dashboard.");
      }
    };
    fr.readAsText(file);
  }

  /* =======================================================================
     HEADER / CLOCK
     ======================================================================= */
  function renderHeader() {
    document.getElementById("brandProj").textContent = state.settings.projectName;
    document.title = "Offaly Civil — " + state.settings.projectName;
  }

  function tickClock() {
    const now = new Date();
    document.getElementById("clockDay").textContent =
      now.toLocaleDateString("en-AU", { weekday: "long" });
    document.getElementById("clockDate").textContent =
      now.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
    document.getElementById("footNote").textContent =
      "Offaly Civil site ops · data saved locally in this browser · use Export to back up · " +
      now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
  }

  /* =======================================================================
     MODAL HELPERS
     ======================================================================= */
  function openModal(id) { document.getElementById(id).classList.add("open"); }
  function closeModal(id) { document.getElementById(id).classList.remove("open"); }

  document.querySelectorAll(".modal-back").forEach((back) => {
    back.addEventListener("click", (e) => {
      if (e.target === back) {
        if (back.id === "markerModal") cancelMarkerModal();
        else back.classList.remove("open");
      }
    });
    back.querySelectorAll("[data-close]").forEach((b) =>
      b.addEventListener("click", () => {
        if (back.id === "markerModal") cancelMarkerModal();
        else back.classList.remove("open");
      }));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-back.open").forEach((m) => {
        if (m.id === "markerModal") cancelMarkerModal(); else m.classList.remove("open");
      });
    }
  });

  /* =======================================================================
     WIRE-UP
     ======================================================================= */
  function init() {
    renderHeader();
    tickClock(); setInterval(tickClock, 30000);

    // category select on toolbar
    document.getElementById("catSelect").innerHTML =
      CATEGORIES.map((c) => `<option value="${c.id}">${c.label}</option>`).join("");

    initMap();
    renderStats();
    renderPanels();
    loadWeather();

    // toolbar
    document.getElementById("btnAddMode").onclick = () => setAddMode(!addMode);
    document.getElementById("btnBase").onclick = toggleBase;
    document.getElementById("btnFit").onclick = fitFeatures;
    document.getElementById("btnLoadGeo").onclick = () => document.getElementById("fileGeo").click();
    document.getElementById("fileGeo").onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        try { reportGeo(addGeoJSON(JSON.parse(fr.result), true), f.name); }
        catch (err) { alert("That file isn't valid GeoJSON. Export from QGIS as GeoJSON (EPSG:4326 or EPSG:28356)."); }
      };
      fr.readAsText(f);
      e.target.value = "";
    };

    // header actions
    document.getElementById("btnSettings").onclick = openSettings;
    document.getElementById("btnExport").onclick = exportData;
    document.getElementById("btnImport").onclick = () => document.getElementById("fileImport").click();
    document.getElementById("fileImport").onchange = (e) => {
      const f = e.target.files[0]; if (f) importData(f); e.target.value = "";
    };

    // stats
    document.getElementById("addStat").onclick = () => openStatModal(null);
    document.getElementById("sSave").onclick = saveStat;

    // item modal
    document.getElementById("itemSave").onclick = saveItem;
    document.getElementById("fMain").addEventListener("keydown", (e) => { if (e.key === "Enter") saveItem(); });
    document.getElementById("fSub").addEventListener("keydown", (e) => { if (e.key === "Enter") saveItem(); });

    // marker modal
    document.getElementById("mkSave").onclick = saveMarker;
    document.getElementById("mkDelete").onclick = deleteMarkerFromModal;

    // settings
    document.getElementById("setSave").onclick = saveSettings;
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
