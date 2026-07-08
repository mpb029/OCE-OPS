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

- **Map layers:** the layer box (top-right of the map) lists the work area and any uploaded
  layers, each with a checkbox to show/hide and a **zoom** icon to fit the map to that layer's
  extent. The **Fit** button in the map toolbar zooms out to show everything at once.
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
- **Production Stats:** add a stat with a **title**, then optionally add any number of
  **extra fields** (a label + value each, e.g. "Crew: Blue", "Pipe laid: 120 m") and tick
  **Show a progress bar** to add a value/target bar. Each tile has its own S / C toggles.
- **Documents & Files:** attach files (PDFs, drawings, spreadsheets, photos, etc.) that the
  site supervisor and client can download straight from the board. Hit **+** on the panel,
  pick a file, and it uploads to a `files/` folder in your repo (needs your GitHub token, same
  as publishing). The board only stores the download link, so it stays fast. Each file has S / C
  toggles like everything else. **Note:** the file uploads to the repo immediately, but you
  still need to **Publish** for it to appear on the site/client pages. Max 25 MB per file.
  Because the repo is public, attached files are reachable by anyone with the link — the S / C
  toggle hides them from view but is not access control (same caveat as the rest of the board).
- **Printing:**
  - **One panel** — the small printer icon in any panel's header prints just that panel and
    its items, clean and ink-friendly, ready to pin up on site. (Use your browser's "Save as
    PDF" in the print dialog for a PDF.)
  - **Whole report** — the **Print** button in the top bar lays the map, stats, and every
    visible panel out as a tidy report with a heading, project name, and date/time. On the
    **client page** it prints exactly what the client can see at that moment — a keepable
    snapshot for their file.
- **Punch List photos & field sheet:** each punch-list item can carry **instruction photos**
  (open the item, hit *Add photo*). On screen they show as thumbnails on the item. When you
  **print** the punch list, the items print as a numbered checklist (each with a tick box and
  a **Comments:** line to fill in by hand), and the photos are collected into a **labelled
  "Photos" section after the list** — printed large for detail, with each group headed by its
  item number and name so it's clear which item they belong to.
- **Weekly Update Photos:** a titled photo-gallery panel — add an entry, give it a title
  (e.g. "Week 12 — headwall pour"), and attach photos. This panel shows for the client by
  default and its photos appear in the client's printed report.
- **Recently changed panels float to the top:** whenever you add, edit, remove, or re-flag
  something in a panel and Publish, that panel moves to the top of the **site and client**
  pages, so viewers see what's new first. Your own editor layout stays in its fixed order.
- **Projects:** run several jobs off one board. Add your projects in **Settings → Projects**
  (each with a **Client** tick that controls whether the client can see it). A **project
  dropdown** in the top bar filters the whole board — panels, items and map markers — to the
  selected project, or **All projects**. When adding any item or marker you pick which project
  it belongs to (it defaults to whatever's selected). The client only ever sees projects you've
  ticked as client-visible, and their dropdown only lists those.
- **Edit-page password (optional):** set one in **Settings → Edit-page password**, then Publish.
  After that, opening the editor URL on **any device** shows a **full-screen lock** — nothing on
  the board is visible until the correct password is entered. It re-checks the published password
  on every device (not just the one that set it). Site (`?crew=`) and client (`?view=`) links are
  never locked. **This is a casual gate, not hard security** — the repo is public, so a determined
  technical person could read the underlying data; the real protection against *changes* is your
  GitHub token, which never leaves your browser and is required to publish.
- **Complete / incomplete:** items on any dated panel (deliveries, works, punch list, meetings,
  etc.) have a **✓ toggle** — mark them complete any time, early or on the due date. Done items
  show a green **Done** badge (and stop flagging as overdue) and are struck through.
- **Assign to a team:** each task can be tagged **Engineering**, **Site**, or **Administration**
  (a coloured tag on the item), chosen in the item's edit box.
- **Optional dates & status (any item):** in an item's edit box you can toggle on a **Date
  assigned** and/or a **Date required** (each reveals a date picker), and toggle on a **Status**
  of **In Progress**, **Completed**, or **Cancelled**. A required date flags overdue like a due
  date until the item is resolved; Completed/Cancelled items are dimmed (Cancelled struck
  through). Leave a toggle off and that field simply doesn't appear on the item.
- **Move markers:** on the editor page you can **drag any existing pin** to reposition it; the
  new location saves automatically (Publish to share it).
- **Printing tweaks:** the **client** report leaves out the map and weather forecast by default,
  and **Weekly Update Photos** print large — at least half a page each, full width and labelled.
  The report header carries the **Offaly Civil logo** and the title names the selected project,
  e.g. *Offaly Civil Engineering — Client Report — Tin Can Bay Watermain*.
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
- **Site supervisor (read-only):** `https://mpb029.github.io/OCE-OPS/?crew=XXXX` — the
  `crew` value is a private code unique to your board (copy the exact link from
  **Settings → Share links**). Keep this one to the supervisor.
- **Client (read-only):** `https://mpb029.github.io/OCE-OPS/?view=client`

The site link deliberately uses a private code so the **client can't reach the site page by
editing their own link** — trimming `?view=client` just lands them back on the client page,
never the site or editor view. (Old `?view=site` links now open the client page, so re-send
the supervisor the new link from Settings.)

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
