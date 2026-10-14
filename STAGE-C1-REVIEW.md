# Phase 2 Stage C1 — Site & Models usability

Based on accepted B2 `97a2f9a2bd7f33d6d6b90dbfcc45a19a874d96ba`. Branch `ui/phase2-stage-c1` stacks against `ui/phase2-stage-b2`. PRs #1–#5 retain their heads and draft status. C1 remains opt-in, draft and subject to owner review. No deployment, merge, live publishing, C2 or Forms/Settings redesign.

## Interaction and architecture

- Desktop (1200 px+) initially shows map and model side by side. Work Area Map / 3D Models select a full-width viewer; Side by side restores the paired layout. Tablets and phones initially show the map with immediate access to the model through the same links. Explicit existing `#mapCard` / `#modelCard` URLs select and expand the requested permitted viewer.
- Layout and Layers disclosure choices are transient presentation state. Workspace navigation preserves them within the page. They never enter local storage, the operational schema or publishing payload. Resizing to a compact viewport uses one viewer; returning to desktop restores a chosen paired layout.
- The original map and model cards, file inputs, selectors, tools and event handlers remain in place. A viewer outside the selected focus stays measurable but invisible to pointer/keyboard interaction. No new Leaflet map, Three scene, renderer, model cache, CRUD system or operational data store is created.
- The layer list is available through Layers with larger controls, native clickable name labels, keyboard Escape and a Close button. Original repo/vector/raster/imagery visibility, styling, import, zoom and removal handlers are retained. Existing map collapse is available at every Site & Models size.
- Viewport height fits the available screen with a 260 px minimum; it updates on layout/size changes, never on scrolling. On phones, Map tools expands the original marker/import/imagery controls; base selection and Fit stay visible. No controls or handlers are duplicated.
- Model controls have visible action labels, larger touch targets and a lower toolbar. Original orbit, pan, zoom, fit, fullscreen, visibility, up-axis, session file and shared URL controls remain authoritative. Empty models use a compact presentation. Original fullscreen still fits geometry as it did before C1; ordinary workspace navigation does not fit or reset either viewer.
- The existing Stage A resize event resizes existing viewports only. The entire `index.html`, B1 adapter, B2 Overview files, Phase 1 UI files, existing workspace stylesheet and original regression assertions remain unchanged.
- Site/Client model availability and editor tools follow the original DOM display rules. The original board-wide spatial semantics are retained: selecting a project does not assign or filter spatial layers/models differently. No synthetic audience switcher is introduced.

## Source ledger

| File | Purpose |
|---|---|
| `ui-workspaces.js` | C1 presentation adapter, explicit static stylesheet load, focus/disclosure integration and C1 footer. No operational state access. |
| `ui-spatial.css` | Screen-only Site & Models layout/control styles; original board, All Panels and reports retain their existing rules. |
| `tests/spatial-usability.cjs` | Twelve C1 contracts: exact baseline parity; four responsive interaction tests; four actual-object state tests; Site/Client rules; empty/deep-link/keyboard/rollback coverage. |
| `tests/capture-spatial.cjs`, `tests/capture-workspaces.cjs` | Thirteen additional actual G4N captures at desktop, portrait tablet, landscape tablet and mobile sizes, with rendered-triangle evidence. Existing 48 captures retained. |
| `tests/workspaces.cjs` | Adds the C1 contracts to the existing filtered/full suite. |
| `tests/verify.cjs`, `tests/verify.test.cjs` | Spatial scope includes C1 plus spatial/navigation/audience checks. FULL additionally requires all twelve C1 contracts and thirteen geometry-backed screenshots. |
| `.github/workflows/review-checks.yml` | This branch's ordinary PR checks use FAST spatial scope. FOCUSED/FULL, exact-SHA gate and artifact policies are unchanged. |
| `STAGE-C1-REVIEW.md`, `VERIFICATION.md` | Scope, testing, limitations and rollback. |

## Verification

```sh
npm run verify:fast -- --scope spatial
# Optional affected screenshots only:
npm run verify:fast -- --scope spatial --shots '^c1-'
npm run verify:focused -- --scope spatial
# After freezing and committing the final candidate:
npm run verify:full
git fetch origin main
npm run verify:gate -- --evidence test-results/verification/full-COMMIT-UNIQUE
```

FULL retains 83 original + 34 Stage A + 13 B1 + 12 B2 checks and adds 12 C1 checks per engine: **308 browser checks** across Chromium and Firefox. It retains 25 PDF comparisons, all prior screenshot/model evidence, all protected operational assets, self-contained recovery and independent archive verification. The workspace gallery grows from 48 to 61 captures. No complete recovery package is generated during FAST/FOCUSED development. The final external delivery records exact SHA, receipts, hashes and actual failures/corrections; this source document does not claim execution results in advance.

Actual state checks import unchanged `G4N.obj`, a deterministic real GeoTIFF and synthetic GeoJSON. They keep hidden repo/vector layers, a visible session raster, an open marker annotation, a non-default inspection pose and Pan mode through repeated focus/workspace changes. They compare original object identities, geometry, camera/target, zoom, centre (less than one projected pixel of Leaflet rounding), model/session references, records, publishing state and local storage. New gesture tests wait for actual zoom/pan animation completion and avoid draggable markers; no arbitrary timing sleeps or weakened historical assertions are used.

## Limitations and owner Android acceptance

Automated touch emulation is not physical Android acceptance. Use the isolated synthetic preview without production credentials; do not perform production publishing.

1. On the actual tablet, check portrait and landscape readability, Menu discovery, Map / 3D switching and access to all existing controls. Rotate and return without losing the inspection pose.
2. Pan/pinch the map, use zoom/Fit, select/toggle layers, scroll the layer list and open/close it. Confirm scrolling controls does not unintentionally pan the map.
3. Add/edit/cancel/drag a synthetic marker using the on-screen keyboard. Keep its annotation open; switch through Overview, Operations, All Panels and Site & Models and verify location, layer choices and annotation remain intact.
4. Import representative OBJ/GLB and GeoTIFF files using Android's file picker. Check GPU responsiveness/memory, orbit, one-finger Pan, pinch zoom, axis/visibility, collapse/reopen, fullscreen and Android Back behaviour.
5. Check Site and Client links with isolated records, project changes and Original board rollback. Validate native printing separately. Any real publishing test belongs in the already-approved disposable repository workflow, never the operational repository.

Known inherited limitations remain: Site/Client rules are display filtering, **not access control**; public data/assets are fetchable independently. The existing Imagery button is visible in viewer modes and retains its legacy behaviour; C1 does not expand or repair that authority boundary. Shared spatial references remain board-wide. The Rainbow Beach sample GeoJSON, Gympie-labelled saved coordinates and layer defaults are unchanged pending separate owner approval. G4N has elongated engineering geometry; use its existing Fit/zoom/orbit controls for detail. External CDN/tile availability and physical-device GPU limits remain external dependencies.

STAT-001 remains unresolved. The exact production-stat edit assertion remains mandatory in FULL, without suppression, retries or adjusted values. Retain the historical failed CI evidence. Physical Android, native printing and real disposable-repository publishing are reported separately from automated verification.

## Rollback

Choose **Original board** (phone: Menu → Original board), use `?ui=classic`, or remove `ui`; no reload, import or data migration is required for the in-page control. All Panels remains a permanent destination. To remove C1 source while retaining accepted B2, revert only C1 commits on the C1 branch. The two production changes are `ui-workspaces.js` and new `ui-spatial.css`; restoring the B2 workspace script leaves the unused stylesheet inert. Never reset operational data or assets. Preserve B2's recovery artifacts and the final C1 self-contained bundle/source ZIP separately. Owner review and a passing fresh exact-head FULL gate are required before any merge authorisation.
