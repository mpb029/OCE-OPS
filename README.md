# Offaly Civil — Site Operations Dashboard

A single-page, static dashboard for a civil/water construction work area. It runs
entirely in the browser, so it hosts straight off **GitHub Pages** with no server,
database, or build step.

It shows:

- An interactive **work-area map** (Leaflet) that loads features exported from QGIS
- **Add / remove map markers** (hydrants, valves, tie-ins, hazards, deliveries, etc.)
  with **notes that pop up when you click the pin**
- **Daily Works**, **Incoming Deliveries**, **Upcoming Works**,
  **Subcontractors Onsite**, **Subbies Onsite Tomorrow**
- A live **weather forecast** for your site (Open-Meteo — free, no API key)
- Editable **Production Stats** tiles (with optional progress-vs-target bars)

---

## 1. Put it on GitHub Pages

1. Create a new repository (e.g. `offaly-ops`).
2. Upload these files, keeping the folder structure:
   ```
   index.html
   css/styles.css
   js/app.js
   data/workarea.geojson
   README.md
   ```
3. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a
   branch**, pick `main` / `/ (root)`, **Save**.
4. After a minute it's live at `https://<your-username>.github.io/offaly-ops/`.

> **Testing locally:** opening `index.html` directly with a `file://` path will block
> the GeoJSON from loading (browser security). Either push to GitHub Pages, or run a
> quick local server: `python3 -m http.server` then open `http://localhost:8000`.
> Markers still work either way — only the auto-load of the repo's GeoJSON needs a server.

---

## 2. Get your map in from QGIS

The dashboard accepts GeoJSON in **either** coordinate system straight from QGIS:

- **WGS84 lat/long (EPSG:4326)** — the native web-map system, used as-is.
- **GDA94 / MGA Zone 56 (EPSG:28356)** — your QGIS project's grid. The dashboard
  **reprojects it to lat/long automatically** on load. Only 4326 and 28356 are wired in
  (Zone 56 covers your whole patch); the map tells you if it hits an unsupported CRS.

By default the CRS is **auto-detected** (it reads the tag QGIS writes and checks the
coordinate values). To force it, use **Settings → Imported GeoJSON coordinate system**.

**Two ways to get features onto the map:**

1. **Base layer (auto-loads for everyone):** export your main layer as
   **`data/workarea.geojson`** in the repo. It loads on every visit as "Work area".
   - QGIS: Right-click layer → **Export → Save Features As…** → Format **GeoJSON** →
     CRS **EPSG:28356** (or 4326) → save as `data/workarea.geojson`.
2. **Add more layers in the app:** click **Add layers** on the map toolbar and select
   **one or more** GeoJSON files at once. Each becomes its own named, colour-coded layer
   with a show/hide/remove panel top-right of the map. These layers are **saved with the
   board and published to the supervisor** when you hit Publish — so they see the full
   map too, no repo editing needed.

> Tip: uploaded layers travel inside `data.json`, so keep them sensibly sized (simplify
> dense layers in QGIS first). A very large permanent base map is lighter committed as
> `data/workarea.geojson`.

Attribute columns (Asset, Stage, Status, etc.) appear in each feature's pop-up. A column
named `Asset` or `name` is used as the heading.

---

## 3. Using the dashboard

- **Add marker:** click *Add marker*, pick a type, click the spot on the map. A pin
  drops and the notes box opens. Click any pin later to read, **Edit**, or **Delete** it.
- **Satellite / Street:** toggles aerial imagery vs street map.
- **Fit:** zooms to show all features and markers.
- **Lists:** each panel has a **+** to add and pen/bin icons on hover to edit/remove.
- **Production Stats:** click a tile to edit; add a target to get a progress bar.
- **Settings:** set the project name and the weather location (lat/long).

---

## 4. Live sharing — you edit, the supervisor views

The board is shared through a `data.json` file committed to this repo:

- **You (editor):** open the normal URL — `https://mpb029.github.io/OCE-OPS/`. Everything
  is editable straight away. To share changes, connect a token once (below) and hit
  **Publish**.
- **The supervisor (viewer):** send them the **read-only link** — the same URL with
  **`?view`** on the end:
  `https://mpb029.github.io/OCE-OPS/?view`
  That opens a locked-down, read-only board that **auto-refreshes every ~45 seconds**, so
  your published changes show up within about a minute. No token, no account — just the link.

You can edit and use the whole dashboard **without** connecting a token; your changes just
stay on your machine until you connect and Publish.

### One-time setup: connect your GitHub token (only needed to Publish)

1. On GitHub: avatar → **Settings** → **Developer settings** → **Personal access tokens**
   → **Fine-grained tokens** → **Generate new token**.
2. Name it (e.g. `OCE-OPS publish`), pick an expiry.
3. **Resource owner:** your account. **Repository access:** *Only select repositories* →
   **OCE-OPS**.
4. **Permissions → Repository permissions → Contents → Read and write.**
5. **Generate token**, copy it (`github_pat_…`).
6. In the dashboard: click **Connect** (or **Settings**) → paste it into *GitHub access
   token* → **Save**. The **Publish** button goes live.

### Token safety

- The token is stored **only in your browser**, never in the repo and never inside
  `data.json` (Publish/Export deliberately exclude it).
- It's scoped to **just this one repo's contents** — it can't touch anything else in your
  account. Give it an expiry, and if it ever leaks, revoke it on GitHub and make a new one.
- Because the repo is **public**, `data.json` (daily works, deliveries, subbies) is
  readable by anyone with the link. Fine for most site info; if it's sensitive, a private
  repo with Pages needs a paid GitHub plan.

### Notes on timing

This is *near* real-time, not instant-to-the-second: after you Publish, the supervisor
sees it on their next refresh (within ~45s), give or take a few seconds for GitHub's
cache. **Export/Import** still works as a manual backup if you ever want a local snapshot.

---

## Notes

- Internet is needed for the map tiles, weather, fonts, and icons (all from public CDNs).
- Weather defaults to Rainbow Beach, QLD — change it in **Settings**.
- No tracking, no accounts, no keys.
