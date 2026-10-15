# Phase 2 Stage B2 — Overview refinement

Based on accepted B1 `8315740977438b1ab825b04374d6cab545547c7d`. This draft PR stacks against `ui/phase2-stage-b1`; PRs #1–#4 keep their accepted heads and draft status. B2 refines the Overview presentation and its opt-in landing route only. No merge, deployment, live publishing, operational data changes or Stage C work is included.

## Visible changes

- Overview becomes the landing page for **Try workspaces** and `?ui=workspaces` with no explicit workspace. Normal URLs and `?ui=classic` retain the original board. Explicit workspace URLs and permitted activity anchors take precedence. Unknown/restricted destinations still fall back to All Panels.
- Project briefing uses a native keyboard/touch disclosure, initially expanded on desktop (1200 px and wider), collapsed on tablet/phone. It contains every permitted project's recorded status, stage, note, milestone, anticipated completion and outlook, with the original Project details link. A single permitted project's recorded status is also shown on the collapsed header. No aggregate health status is invented.
- The disclosure preserves its open/closed choice during a refresh of the same permitted project context; a new context uses the viewport default. It is transient DOM state, never operational data or local storage. Crossing a viewport breakpoint does not override a user's current choice; a new Overview visit uses the current viewport. Removed/restricted content is rebuilt from the B1 filtered adapter, never cached.
- Compact activity links use the same active counts and titles, with explicit accessible names. Daily Works, Scheduled Works and permitted Issues links appear ahead of the lists. Existing mobile bottom navigation remains available.
- Smaller-screen Overview heading/header spacing is reduced. The full selected project remains in the heading; the project selector, Connect/Publish and Actions retain their original handlers. Other workspaces and the classic board retain their styling.
- Record titles are 16 px, operational metadata 14 px, and links/disclosures have at least 44 px targets. Clear empty states link back to original panels/history; no zero value is turned into an invented assessment.

## Definitions and architecture

**Every [B1 metric definition](STAGE-B1-REVIEW.md#metric-and-content-definitions) is unchanged.** Active records use the existing project/audience filters, lifecycle and retirement display logic. Daily Works counts listed active entries, not entries dated today. Scheduled Works includes all active scheduled entries, without a new future/overdue calculation. Issues, Quality, Punchlist and Incidents keep their separate original lifecycles. Preview lists show up to three entries in the original order. Production statistics remain the exact existing **board-wide** display, not project completion. Summary status/dates/text are recorded values, not inferred health or forecasts.

The B1 adapter and entire `index.html` are byte-identical in Git. No new runtime hook, records, business logic, CRUD, forms, framework, dependencies, storage keys, polling or API calls are introduced. Original `ui-v2.*`, `ui-workspaces.css` and all original regression assertions remain unchanged. All 21 original panel instances, map/Three instances, editing/history, documents/photos, Settings, weather, reports, backup and publishing functions remain available through the existing navigation and original board.

Source changes:

| File | Purpose |
|---|---|
| `ui-overview.js` | Native briefing disclosure, transient open state, compact permitted activity links and clearer empty wording; consumes the unchanged adapter. |
| `ui-overview.css` | Screen-only Overview typography, spacing, briefing and activity layout; compact header rules apply only to the opt-in Overview. |
| `ui-workspaces.js` | Opt-in Overview landing only; B2 footer label. Explicit destinations, audience queries, anchors and rollback remain intact. |
| `tests/overview-refinement.cjs` | Twelve B2 contracts: exact B1 source parity; default/explicit/classic/audience routes; nine responsive audience combinations; multi-project/context/long-text/empty handling. |
| `tests/workspaces.cjs` | Includes B2 tests; updates only the authorised default expectation, explicitly selects All Panels for compatibility tests, and includes Overview in loaded G4N/raster navigation. |
| `tests/verify.cjs`, `tests/verify.test.cjs` | Overview scope includes B1+B2; FULL requires all 12 B2 contracts as well as all 13 B1 contracts and existing tests. |
| `STAGE-B2-REVIEW.md`, `VERIFICATION.md` | Scope, verification, unchanged definitions and rollback instructions. |

## Verification and release boundary

```sh
npm run verify:fast -- --scope overview --shots 'editor-(desktop|tablet|mobile)-overview'
npm run verify:focused -- --scope overview
# Freeze and commit the candidate, then run FULL once:
npm run verify:full
git fetch origin main
npm run verify:gate -- --evidence test-results/verification/full-COMMIT-UNIQUE
```

FULL requires **83 original + 34 Stage A + 13 B1 + 12 B2 checks per engine** (284 total), the existing 25 per-page PDF comparisons, 48 workspace screenshots, classic/model evidence, 181 protected assets and independent complete recovery verification. It rejects partial, dirty or reused evidence. CI retains the existing small FAST Overview default; B2 contracts automatically join it. CI configuration and large-artifact policy do not change. The delivery outside the checkout records exact commit, full results, screenshots, failed development receipts and hashes.

STAT-001 remains unresolved. Its original production-stat edit assertion is unchanged and still mandatory in FULL; no sleeps, retries or relaxed expected values are added. Physical Android tablet/phone, native printer and real disposable-repository publishing remain owner release checks. Automated touch/viewport testing is not hardware acceptance. No production publishing is performed.

Site/Client visibility is still **display filtering, not access control**; public source data/assets can be fetched outside the UI. B2 reveals only B1-permitted information and adds no server security. Rainbow Beach sample GeoJSON, Gympie-labelled coordinates and layer defaults remain untouched pending separate approval.

## Rollback

Choose **Original board** (phone: Menu → Original board), use `?ui=classic`, or remove `ui`. This immediately restores the original board without saving, importing or migrating operational data. All Panels remains a permanent destination and explicit `?ui=workspaces&workspace=all` link. To remove B2 source while retaining B1, revert only B2's commits on its own branch or restore its three UI files from the B1 baseline; no data reset is required. Keep B1's recovery artifacts and the final B2 self-contained bundle/source ZIP separately. Do not merge any stacked PR without owner approval and fresh evidence for its exact head.
