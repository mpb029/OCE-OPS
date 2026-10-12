# OCE-OPS Phase 1.1 — refinement and repair review

**Draft review candidate. No merge, deployment or Phase 2 navigation rewrite is authorised.**

The navy/blue design, cards and corrected desktop grid remain. Mobile now exposes
Daily works, Scheduled works and All panels directly beneath the project controls.
The map starts collapsed on phones and opens with its existing controls intact.
Project status and production figures use larger text; Site/Client visibility is a
labelled, one-click segmented control. Repeated edit/delete/print buttons have quieter
styling and remain visible on touch.

## Screenshots

These are actual browser captures using a cloned operational dataset. No live data was
edited. Weather is a deterministic fixture; audience keys and publishing credentials
are test values. Satellite imagery is real. The RFI dialog contains an unsaved example.

| View | Phase 1.1 | Previously reviewed Phase 1 |
| --- | --- | --- |
| Desktop 1440 × 900 | [Desktop](after-desktop.png) | [Phase 1](../phase1/after-desktop.png) |
| Mobile 390 × 844 | [Mobile landing](after-mobile.png) | [Phase 1](../phase1/after-mobile.png) |
| Tablet 768 × 1024 | [Tablet](after-768x1024.png) | [Phase 1](../phase1/after-768x1024.png) |
| Panel controls | [Desktop](panels-1440x900.png), [mobile](panels-390x844.png) | — |
| Settings | [Desktop](settings-1440x900.png), [mobile](settings-390x844.png) | — |
| RFI editing | [Desktop](rfi-1440x900.png), [mobile](rfi-390x844.png) | — |
| Audience views | [Site](site-view.png), [client](client-1-view.png) | — |
| Actual G4N geometry | [Whole network, Y-up](g4n-after-y-up.png), [close-up](g4n-after-detail.png) | [Previous framing](g4n-before-y-up.png) |

## Independent review boundaries

The UI, 3D framing, Import repair and map repairs are separate source commits in the
draft PR. Dedicated browser scenarios accompany each repair. The local delivery also
includes a patch series retaining the individual changes and their tests.

- **UI:** `ui-v2.css` and `ui-v2.js`; presentation only. Shortcuts target existing
  audience-filtered panels; they do not introduce workspaces, routes or data filtering.
- **3D:** only `frameAll()` changes in the application. The camera fits all eight bounds
  corners using viewport aspect and FOV, with a margin. No geometry or saved axis values change.
- **Backup:** `load()`, `importData()` and the new validation helper. All known state
  sections and unknown/legacy fields survive import/export and local reload. Invalid
  input is rejected before replacement; storage/render failure restores the old board.
  Import refreshes project controls, summaries, base map and model caches, and marks
  the local board unpublished. It never publishes automatically.
- **Map:** `loadWorkArea()` and `fitFeatures()` only. Root `workarea.geojson` is loaded
  first, with the legacy `data/` location as a 404-only fallback. Fit descends through
  marker groups, includes visible vectors/rasters, excludes hidden layers, and handles
  empty bounds safely. Projection, styling and saved map data retain their original rules.
- **CI:** optional test infrastructure; no runtime build step or framework. The workflow
  uses pinned GitHub Actions, read-only repository permissions and no deployment job.

The original inline stylesheet, including every print rule, is unchanged. A source
contract check confirms that application code outside the explicitly listed repair
functions remains unchanged. Existing static IDs/action hooks and all 21 panels remain.
No data schema, role model, publishing field list or project/client route was changed.

## Why G4N originally looked almost empty

G4N is a sparse utility network, not a solid building/site surface. It contains **eight
meshes, 5,880 rendered triangles and 17,640 triangle vertices**, spanning approximately
47.46 × 15.18 × 155.93 model units. OBJ does not declare units. Thin pipe geometry is
naturally small relative to the overall extent.

The old camera used a fixed distance based on the largest dimension and placed the
camera on three axes at once. This left the network unnecessarily small. The revised
fit was checked against every actual geometry vertex at desktop, tablet and mobile
sizes, in both Y-up and Z-up: all vertices fit within the viewport and the model occupies
a useful fraction of it. Captures wait for geometry attachment and actual rendered triangles.

The file's geometry is consistent with Y as the vertical axis. The existing OBJ default
remains Z-up for compatibility with other civil exports. The Y-up screenshots use the
existing **Flip up-axis** control once; the close-up then uses the existing Zoom in control.
No automatic orientation guess or file-specific transformation is saved. G4N references
an MTL file that is absent from the repository; the existing neutral material remains.
The close-up visibly shows cylindrical manholes and connecting pipes.

## Regression evidence

The suite contains **76 automated checks**, including the original workflows and new
mobile, framing, backup and map-repair scenarios. The [draft PR delivery](https://github.com/mpb029/OCE-OPS/pull/1)
retains machine-readable results recording the exact tested commit, main commit,
full/filtered-run flag, clean-worktree state and timestamps. Final-head runs are
retained in the attached review package, local delivery folder and CI artifact.

| Area | Verification |
| --- | --- |
| Responsive interface | Eight sizes: 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 390×844, 375×812, 360×800. No horizontal document overflow; all panels and controls accessible. |
| Mobile landing | Activity links are visible near the top, point only to available panels, and reach them in one click. Map disclosure correctly resizes Leaflet without changing state. |
| Operational parity | All 19 ordinary panel types plus files/photos; add/edit/delete, dates, teams, statuses, completion/history, production extras, Settings, client/project assignments, visibility, locks and polling. |
| Persistence/publishing | State and publishing payload parity with baseline; local reloads, dirty/clean and rejection states; all remote writes intercepted. |
| Backup repair | Exact full export/import/export equality, including all history, projects, clients, models, panel metadata, summaries, legacy panels and unknown nested fields; reload equality; invalid-input rejection; quota/render rollback; model-cache refresh. |
| Mapping | Real Leaflet/proj4, markers, MGA56 transformation, GeoJSON styles, base/imagery controls, real GeoTIFF parsing, root/legacy/missing base file, mixed-feature Fit, hidden layers, empty/single-marker bounds. |
| 3D | Actual G4N OBJ geometry, STL and hosted GLB/GLTF, framing at three sizes/both axes, orbit/pan/zoom/reset/fullscreen, disclosure/resizing, editor/site/client controls. |
| Printing | Full board, single panel, punch checklist/photo appendix, selected weekly photos and client rules; hidden screen controls excluded from rendered print text. |

[Five actual PDF comparisons](print-comparison.json) retain identical page counts and text
on every corresponding page: full board 63, Daily Works 1, punch list 1, selected photo
folder 7, client 2. The print comparison selects the same operational layer and map zoom
in both versions and waits for the application's image-preload/print callback. This
avoids comparing different initial extents after the base-map repair. The full suite
and screenshot commands are documented in [tests](../../tests/README.md).

## Latest main and operational data

Latest fetched main: `bee28796bb00f860d17b723d6a3c0b01bd5f4101`.
The preservation check compares the candidate against the freshly fetched main and
verifies **181 data/attachment files**. See [the asset manifest](preservation.json).

`data.json` Git-blob SHA-256 remains
`0e2310fe1d07573b4cea10ca335afd76b545a34952abebbed02665ca7fe45d36`.
No operational JSON, uploaded file, imagery tile, G4N model or GeoJSON content changed.
The original recovery bundle and the reviewed Phase 1 commit are retained locally.

## Remaining limitations

1. Testing uses Chromium, keyboard/mouse and emulated touch. Physical phones, Safari and
   Firefox remain untested. CDN availability and real weather responses are external dependencies.
2. GitHub publishing/upload writes are intercepted. No production Publish, real token
   permission test or write to an external test repository was performed.
3. Backups contain attachment references, not copies of their binary files. Complete
   repository recovery still needs the attachments/Git history. The publishing field list
   is unchanged: unknown extension keys remain in local backups, rather than being newly published.
4. The root GeoJSON is the existing `workarea_sample` near Rainbow Beach. Loading it now
   exposes that preserved sample; the owner should verify its operational relevance. Fit
   correctly includes it when visible, which can make the combined map cover a wider area.
5. G4N needs Y-up selected for the illustrated orientation. Missing materials are not
   reconstructed, and whole-network views cannot make real thin pipes appear like solid surfaces.
6. Existing imagery coverage/max-zoom constraints and print spacing remain: the supplied
   full report spans 63 pages and the selected photo report begins with a heading-only page.
7. Site/client visibility remains the existing display-filter model, not new server-side access control.

**Approval is still required before merge or deployment. Phase 2 has not started.**
