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

The dashboard now accepts **either** of these straight from QGIS:

- **WGS84 lat/long (EPSG:4326)** — the native web-map system, used as-is.
- **GDA94 / MGA Zone 56 (EPSG:28356)** — your QGIS project's grid. The dashboard
  **reprojects it to lat/long automatically on load** (using proj4), so you can export
  without changing your project.

By default the CRS is **auto-detected**: it reads the `crs` tag QGIS writes into the
file, and falls back to checking the coordinate values (metres vs degrees). If a file
ever loads in the wrong spot, open **Settings** and force the *Imported GeoJSON
coordinate system* to either 4326 or 28356.

To export from QGIS:

1. Right-click your layer → **Export → Save Features As…**
2. Format: **GeoJSON**
3. CRS: leave it as your project's **EPSG:28356 - GDA94 / MGA zone 56**, *or* pick
   **EPSG:4326 - WGS 84** — both work.
4. Save as **`workarea.geojson`** into the repo's **`data/`** folder, replacing the sample.

To preview an export without committing it, use the **Load GeoJSON** button on the map
toolbar — the status line under the map confirms which CRS was detected and whether it
was reprojected.

Any attribute columns (Asset, Stage, Status, etc.) show up in the feature pop-up
automatically. A column named `Asset` or `name` is used as the heading.

> Note: only **EPSG:4326** and **EPSG:28356** are wired in (that's your region — Zone 56
> covers ~150–156°E). A different MGA zone would need its definition added; the map will
> tell you if it hits an unsupported CRS.

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

## 4. Saving your data — read this

Everything you add (markers, notes, lists, stats) is saved in **this browser's local
storage**. That means:

- It persists across refreshes and restarts **on this device + browser**.
- It does **not** sync to other computers or phones on its own.

To back up or move data:

- **Export** downloads a `.json` backup file.
- **Import** loads one back in (on any device).

If you want the data to be the same for everyone who opens the site, **Export** the
JSON and commit it to the repo, and load it on each device via **Import**. (True
multi-user live sync would need a backend, which is outside a static GitHub Pages site.)

---

## Notes

- Internet is needed for the map tiles, weather, fonts, and icons (all from public CDNs).
- Weather defaults to Rainbow Beach, QLD — change it in **Settings**.
- No tracking, no accounts, no keys.
