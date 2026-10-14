# Stage E — Project-specific mapping

Based on Stage D `aeac20f`. Review branch only; no merge, deployment or production publishing.

Editors can assign saved GeoJSON, XYZ imagery and hosted 3D models in the existing layer/model lists. The sole persisted extension is optional `record.project`, containing an existing project ID. Missing or empty means **Global (all projects)**; choosing Global removes the property. No data migration or location inference occurs. New imports remain Global until explicitly assigned.

Project selection shows eligible assigned records plus Global records, retaining each record's visibility preference. All Projects includes all editor/site records; Client continues to restrict assigned projects using its existing project display filter. Session GeoTIFF/model assignments stay in memory and never enter backups or publishing. An assignment to a removed project is retained: select All Projects as editor and reassign the **Unavailable project** entry.

The root Rainbow Beach work-area file and base maps remain Global with their existing defaults. Map Fit includes only attached eligible geometry: visible root geometry, markers, imported vectors and session rasters. XYZ tile URLs provide no bounds and do not independently expand Fit. A visible Global root layer can still widen Fit to Rainbow Beach; toggle it off explicitly when appropriate. No saved location was corrected or reassigned.

`index.html` contains a labelled adapter around the existing spatial functions; `ui-project-spatial.css` styles its assignment controls. Original records, forms, 21 panels and publishing/backup functions remain authoritative. Project/workspace navigation retains cached Leaflet/Three objects and camera/map position. Use the existing model Fit control when a newly selected project's geometry lies outside the retained camera view. Stale asynchronous model loads cannot attach to an ineligible project.

Assignments are **display filtering, not access control**. Public repository data and asset URLs remain readable outside the interface. Global assets remain visible to all audiences. Existing audience controls are unchanged; no new security guarantee is provided.

Verification uses `node tests/verify.cjs fast --scope project-spatial`, then `focused --scope project-spatial`. The final clean committed candidate requires `full` and `gate --evidence <FULL-directory>`: all 374 browser checks, 25 PDF comparisons, protected assets, three representative captures and complete recovery. Ten new contracts cover legacy Global behaviour, scope/Fit, reassignment/deleted projects, session imports, object/view preservation, exact backups/failed imports/intercepted publishing, both audiences, delayed loads and responsive/keyboard/rollback behaviour. Historical assertion bodies remain unchanged under an explicit reversible source allowance.

Original board remains a presentation rollback; project filtering continues there. For code rollback, use the preserved Stage D branch or revert the Stage E commits on a separate review branch. Export current local data first: Stage D retains optional fields but does not apply their project filtering. No rollback requires rewriting operational files. STAT-001 remains open; browser touch emulation does not establish physical Android acceptance.
