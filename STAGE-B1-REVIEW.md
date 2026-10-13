# Phase 2 Stage B1 — Functional Overview

An opt-in, read-only project briefing built on `2e371d797066f344a108e10a10b10f995974a7f2`, including accepted Stage A `938ad27`. The new branch stacks against `chore/verification-levels`. PRs #1, #2 and #3 retain their existing heads and draft status. No merge, deployment, live publication, operational-schema change or B2 work is authorised.

## Review and rollback

Use an isolated synthetic-data review environment. Choose **Try workspaces**, then **Overview**, or use `?ui=workspaces&workspace=overview`. All Panels remains the default landing page. Audience parameters and permitted project selections remain intact. Do not enter a production publishing token into a review environment.

Choose **Original board**, use `?ui=classic`, or remove `ui` to return to the accepted Phase 1 board without changing operational data. To remove B1 source, revert only this PR's source commits on its own branch. No data migration or recovery import is required. Keep the accepted Phase 1, Stage A and optimisation evidence; the final B1 FULL run creates its own complete bundle/source ZIP and byte-verified recovery manifest.

## Metric and content definitions

| Display | Authoritative source and exact definition |
|---|---|
| Project name and selected scope | Existing `projects()`, `projInScope()` and original project selector. All projects shows each permitted project's summary separately; no combined health score. |
| GREEN / AMBER / RED | Recorded `projectSummary[project.id].status`, using existing `SUM_STATUS`. No inferred “on track” assessment. An absent/unrecognised status produces no badge. |
| Current stage and status note | Recorded summary `stage` and `statusComment`; missing values are omitted. |
| Next key milestone | Recorded summary `milestone`. It is descriptive text, not a calculated date. Missing values say “Not recorded”. |
| Anticipated completion | Existing `compValue()` formatting of `compType`, `compDate` or legacy/free-text `comp`. No computed forecast. Missing/invalid values say “Not recorded”. |
| Project outlook | Existing `SUM_ROWS`: achievement, client action, key constraint/risk, impacts and approved scope changes, only when populated. Expand the disclosure to read all recorded text. |
| Daily Works count/list | `dailyWorks` records in the existing project/audience scope, after `sortItemsForDisplay()` and excluding `isResolved()`. This counts active entries as listed, **not work dated today**. |
| Scheduled Works count/list | Same rule for `upcoming`. All active scheduled entries count, including undated or past-date entries. No new future/overdue filter. |
| Potential Issues & Delays count/list | Same rule for `issuesDelays`; active entries, not inferred severity or quantified delay. |
| Quality & Testing count/list | Same rule for `qualityTesting`. A passed test remains active if its original done/work-status fields do not resolve it. Results status does not silently substitute for the original lifecycle. |
| Operational attention | Permitted active records from Quality & Testing, Punchlist and Incidents / Events, grouped and counted separately. This is a review list, not a risk score, new priority ranking or assertion that each incident is unresolved. Extra incident resolution text/date does not replace the original lifecycle. |
| Record badges | Existing `rangeBadge`, `dueBadge`, `reqBadge`, `fmtDay`, work-status, priority, results-status and team formatters. Scheduled duration uses the original inclusive day rule. Any due wording comes from the existing dated-panel rules; there is no new aggregate overdue metric. |
| Production statistics | Exact audience-filtered display from original `renderStats()`: label, existing value/target line, displayed bar width and extra fields. This reuses legacy `type`/`freq` handling. **Board-wide, not filtered by project.** No new project completion percentage. |

Active means the original `isResolved()` is false: not done, completed or cancelled. The original retirement display filter also applies, including its handling of `resolvedAt`. Whole-panel permissions are checked before record filtering, using `panelVisOf()`; `visiblePanelItems()` retains project/client assignment and per-item visibility. Preview lists show at most three active entries in the original order and state the full count when truncated. Links open the relevant original panel, not a duplicate item editor. Completed/retired items and detailed fields remain in the original panels/history according to existing rules.

## Architecture and precise source boundary

- `index.html`: two resource tags and one delimited 34-line synchronous read adapter. It calls existing filters/formatters and returns detached, whitelisted text/array objects. It does not export raw state, credentials or mutation methods, and returns nothing while locked or before remote readiness. Every pre-existing inline runtime function and print style remains under strict baseline comparison.
- `ui-overview.js`: transient rendering of the adapter snapshot using text nodes. No operational store, CRUD, persistence, timers, API calls, business-status algorithm or framework. No original IDs/handlers are cloned.
- `ui-overview.css`: screen-only Overview layout, responsive summary/cards and readable record metadata. Existing Phase 1 and Stage A styles remain unchanged.
- `ui-workspaces.js`: replaces the placeholder, refreshes Overview after the existing panel-render notification and on navigation, clears stale/hidden Overview content, and adds permitted summary/statistics anchors to All Panels. Sidebar architecture, default landing and map/model resizing remain intact.
- `tests/overview-checks.cjs` and `tests/overview-source.cjs`: 13 focused contracts and explicit subtraction of the new adapter while retaining byte parity for all pre-existing runtime code. Existing production-stat assertion is unchanged.
- Verification/capture/print configuration: adds `overview` scope and FULL requirements, five additional PDF comparisons from Overview, six additional audience Overview screenshots. `workspace-fixture.cjs` adds synthetic scheduled start/end dates only.

All 21 original operational card instances stay in their original container. Navigation and snapshot rendering cannot save, stamp lifecycle/history, publish, upload, change maps/models or alter dirty state. The original runtime still handles actual edits and broadcasts its existing render notification. When returning from editing summary/statistics, navigation reads their freshly rendered values. Live viewer updates use the existing polling renderer; B1 introduces no extra polling.

The original map, 3D, weather, Settings, project/client management, forms, history, retirement, print/report, documents/photos, backup, local storage and publishing implementations remain available. Full-board/individual reports omit Overview chrome and retain original content regardless of screen workspace. `data.json`, attachments, GeoJSON, coordinates/defaults, publishing payloads, `ui-v2.*`, legacy files and package dependencies are unchanged.

## Verification and acceptance

```sh
npm run verify:fast -- --scope overview --shots 'editor-(desktop|tablet)-overview'
npm run verify:focused -- --scope overview
# Commit the final candidate before running the following fresh checks:
npm run verify:full
npm run verify:gate -- --evidence test-results/verification/full-COMMIT-UNIQUE
```

See [VERIFICATION.md](VERIFICATION.md). FULL requires 83 original + 34 Stage A + 13 Overview checks in **each** Chromium and Firefox, 25 per-page PDF comparisons, full responsive/audience/model screenshots, protected-asset checks and independently restored complete recovery artifacts. Filters/reused evidence cannot satisfy FULL. PR CI defaults to small FAST Overview checks; an explicit `verification:full` label requests FULL on the exact PR head. A green FAST check is not milestone acceptance.

The delivery report outside the source checkout records exact candidate SHA, every executed receipt, any failed development checks, final screenshots, source patch and preservation/recovery hashes. A newly committed source change invalidates final acceptance evidence.

## Remaining limitations

- Site/Client visibility remains a **display filter, not access control**. Anyone able to fetch public board data/assets can inspect them independently of this UI. B1 avoids additional navigation/summary leaks but does not add server authentication or data segregation.
- No real Android tablet, native printer or production publishing is exercised by automated browser emulation. Keep physical-device/manual acceptance and the separate disposable-repository publishing test as owner release gates. No live publishing is performed here.
- **STAT-001 remains unresolved**. Keep its original production-stat edit assertion and failed Stage A CI evidence. No sleeps, assertion relaxations or automatic retries are added to hide it.
- Summary/statistics are only as current as the stored records. Dates use the existing browser-local formatting rules. Weather remains in the original board; map/3D remain immediately accessible in Site & Models.
- Rainbow Beach GeoJSON and Gympie-labelled coordinates/defaults are preserved, pending a separate approved location/layer decision.
- B1 retains All Panels as landing. No B2/C/D features, inline Overview editors, derived completion forecasts or new operational schema are included.
