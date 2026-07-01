# Offaly Civil Engineering — Site Operations Dashboard

A single-page, static dashboard for a civil/water construction work area. It runs
entirely in the browser, so it hosts straight off **GitHub Pages** with no server,
database, or build step.

It shows:

- An interactive **work-area map** (Leaflet) that loads features exported from QGIS
- **Add / remove map markers** (tie-ins, open excavations, deliveries, laydown areas, plant, traffic control, hazards, etc.)
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

- **Add marker:** click *Add marker*, pick a type, click the spot on the map. A pin drops
  and the notes box opens. Marker types: General note, **Tie-in / connection** (shows a
  **user-assigned letter** on the pin — A, B, C… auto-suggested), **Open Excavation**,
  **Delivery**, **Laydown Area**, **Plant / equipment** (excavator), **Site compound**,
  **Traffic control** (cone), and **Hazard**. Click any pin later to read, **Edit**, or
  **Delete**, and to set who can see it.
- **Panels:** each has a **+** to add and pen/bin icons on hover to edit/remove. Special
  panels: **Punch List** takes a **due date** plus a **priority** (High / Medium / Low badge);
  **Meetings/Site Visits** take a **due date** (overdue items flag red); **Work Packages**
  take a **% complete** and show a progress bar. Multi-field panels: **Incoming Deliveries**
  (item details, date, expected time, supplier, contact), **Traffic Control** (location, date,
  no. of traffic controllers, no. of utes), **Subcontractors** (name, works, date onsite,
  time onsite, contact), **Stakeholders** (details, date, action required, contact). Status
  panels show a coloured badge: **Quality & Testing** (Pass / Fail / Results pending),
  **Design Changes** (Approved / Pending), **Variations** (number + Approved / Pending), and
  **Potential Issues & Delays** (issue + mitigation).
- **Production Stats:** two types — **Value & target** (shows a progress bar toward a target)
  and **Count** (a headline number with a frequency label, e.g. "14 per day"). Each tile has
  its own S / C visibility toggles.
- **Who-sees-what:** two levels, both with tappable **S** (site) / **C** (client) chips
  (green = shown):
  - **Whole panel** — chips in each panel's header. Master switch per audience: turn a
    panel's **C** on to let the client see it, off to hide the whole panel. Site sees
    every panel by default; the client sees a panel only once you switch its **C** on.
  - **Individual rows** — chips on each item, to hide a specific line inside a panel that's
    otherwise shown. **Production Stats tiles** and **markers** have the same two toggles.
- **Satellite / Street**, **Fit**, **Add layers** (multiple QGIS files), **Production Stats**
  (click a tile to edit; add a target for a bar).
- **Settings:** project name, weather location, publishing token, and the **share links**.

---

## 4. Live sharing — you edit, site + client view

The board is shared through a `data.json` file committed to this repo. There are three
ways to open it:

- **You (editor):** the normal URL — `https://mpb029.github.io/OCE-OPS/`. Fully editable.
  Connect a token once (below) and hit **Publish** to share.
- **Site supervisor (read-only):** `https://mpb029.github.io/OCE-OPS/?view=site`
- **Client (read-only):** `https://mpb029.github.io/OCE-OPS/?view=client`

Both read-only links auto-refresh every ~45 seconds and need no token or account — just
the link. Each shows **only the items and markers you've flagged for that audience** (the
S / C chips). You'll find both links ready to copy in **Settings → Share links**.

> **Important — this is a display filter, not a lock.** Because the repo is public, the
> raw `data.json` is readable by anyone who knows the URL. Hiding an item from the client
> keeps it off their *page*, but a technical person could still read the underlying file.
> Fine for keeping the client's view tidy; don't rely on it for anything truly sensitive.

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
