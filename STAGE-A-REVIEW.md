# Phase 2 Stage A — opt-in workspace navigation

Review only. Based on the exact accepted Phase 1 candidate `35f23679f1c97c5f781067f11d28b24740e25b5b`. Keep this branch's draft PR stacked against `ui/phase1-modernisation`; do not target main, merge, deploy or publish live board data without owner approval. Phase 1 PR #1 remains unchanged. No Stage B, C or D implementation is included.

## Try and reverse

On an isolated review server, choose **Try workspaces** or add `?ui=workspaces`. The temporary landing is **All Panels**. Select **Original board**, use `?ui=classic`, or remove the `ui` parameter to return to the accepted Phase 1 presentation. This changes no board data or dirty/publishing flags. Do not connect a real publishing token to a review environment.

Navigation uses `workspace=overview|operations|resources|quality|coordination|documents|site|all`. `workspaceProject` is a UI route parameter containing an existing permitted project ID. All existing query options, including `crew`, `view` and `client`, are retained. Existing `#activity-*`, `#mapCard`, `#modelCard` and `#panelsGrid` links remain supported. A permitted activity anchor selects its containing workspace. Unknown/restricted workspace or activity routes safely fall back to All Panels. Browser history contains only workspace, project and scroll position. There is no new local-storage namespace or operational schema.

The legacy hash audience rules are preserved. In particular, `#overview` already means client view in the original runtime. Stage A never creates that hash: its Overview route is `?workspace=overview`. When an activity link replaces a legacy audience hash, the equivalent existing `crew`/`view` query alias is retained so reload cannot switch the audience.

## Exact integration boundary

- `index.html`: load two presentation files; dispatch one event after the original `renderPanels()` has finished binding handlers; respond to a reveal event by resizing existing Leaflet/Three instances. No business function is replaced. The original inline print stylesheet is byte-identical.
- `ui-workspaces.js`: an explicit adapter reads the already audience-filtered cards, adds stable activity anchors, builds navigation, manages UI-only URLs/history and applies screen presentation. No state object, CRUD replacement, API client, save, publish or upload path is introduced. No new MutationObserver is used.
- `ui-workspaces.css`: responsive shell, labelled tablet rail/drawer, phone quick routes and screen-only workspace filtering. Hidden spatial content stays measurable and invisible off screen so the original report preparation can still calculate map dimensions. All navigation chrome disappears in print; the original print rules restore the full eligible board.
- Development checks: extend the source contract with exact subtraction of the two allowed hooks; retain strict comparison of all other original business code. Add the integrated navigation suite, synthetic fixture, actual screenshots and multi-route PDF comparisons. CI runs both engines, contains no deployment job and keeps `contents: read`.

`ui-v2.css`, `ui-v2.js`, legacy `app.js`/`styles.css`, `data.json`, operational attachments, GeoJSON, location settings, publishing payloads and data structures are unchanged. The application remains static HTML/CSS/JavaScript with no required build step or new framework.

## Preservation map

| Destination | Original panel IDs |
|---|---|
| Operations | `dailyWorks`, `trafficControl`, `upcoming`, `workPackages` |
| Resources & Logistics | `deliveries`, `subbiesToday`, `staffAway`, `siteInputs`, `plantTransport`, `materialPickup` |
| Quality, Safety & Risk | `punchlist`, `qualityTesting`, `issuesDelays`, `incidents` |
| Coordination & Commercial | `stakeholders`, `meetings`, `designChanges`, `variations`, `rfis` |
| Documents & Photos | `documents`, `weeklyPhotos` |
| Site & Models | Original map and 3D cards; outside the 21-panel registry |
| All Panels | Original full board, including project status, weather and production statistics |
| Overview | Clearly labelled Stage B placeholder; no invented metrics or summaries |

One set of operational cards stays in `#panelsGrid`. Navigation never re-renders or reparents them. When actual data changes, the original renderer replaces and rebinds them as before, then notifies the adapter. Existing editor order and recently-updated viewer order remain authoritative within every group. Whole-panel visibility, per-record visibility, client/project assignment and retirement remain in the existing runtime; sidebar links, shortcuts and available-panel counts derive from its rendered result.

All original Add/Edit/Delete/Done, extra fields, photo/file attachment, history, Settings, project/client management, backup, print, statistics and publishing handlers remain the only implementation of those workflows. The header still contains the original Print, Settings, backup and Publish controls, with their existing audience and responsive behavior. Global summary/statistics/weather remain in All Panels until Stage B.

Map/model/layer controls remain unchanged. Navigation retains Leaflet, Three.js, scene, loaded-object cache, camera/target, markers, layers, raster instances and session models. Resizing does not call Fit or `frameAll`. Leaflet can round the geographic centre by less than one screen pixel during resize; tests check every transition to catch any real jump. No reference layer is assigned to a project by this change. The Rainbow Beach sample and existing location coordinates/defaults are preserved for a separate owner decision.

## Repeatable verification

With Node.js 24 and Python installed:

```sh
npm ci
npx playwright install chromium firefox
python -m pip install pypdf==6.10.0
npm test
python tests/compare-print.py
npm run test:workspaces
npm run test:workspace-print
python tests/compare-workspace-print.py
npm run screenshots:workspaces
```

Run `npm test` and `npm run test:workspaces` again with `OCE_ENGINE=firefox` (and unset `OCE_BROWSER` if it points to Chromium). In Linux CI, use `xvfb-run` and `LIBGL_ALWAYS_SOFTWARE=1`. `OCE_TEST_OUTPUT` selects the evidence directory. The original 83 operational checks test the integrated source with opt-in disabled; the additional Stage A suite exercises the enabled shell, including all groups, all 21 cards, original CRUD, both read-only audiences, all legacy audience forms, backup contracts, intercepted publishing, files/photos, lock, project/history/scroll, touch/keyboard, actual G4N geometry and GeoTIFF retention. PDF content and page counts are compared for all five original report families, additionally from Operations, Site & Models and All Panels. All eight routes receive print-media scope checks in both engines. Single-panel/photo print handlers are also invoked while their cards are screen-filtered to verify report independence.

Tests use separate browser contexts and intercepted GitHub requests. They cannot perform real production publishing. Screenshots use the separate fully synthetic fixture; the model inspection screenshot intentionally shows the unchanged real `G4N.obj` loaded as a session model. Final exact-commit results and review screenshots accompany the PR rather than being inferred from prototype tests.

## Recovery and limitations

The accepted Phase 1 full Git bundle and source-and-attachments ZIP remain preserved and independently verified. The final Stage A delivery also includes a complete Git bundle, all tracked source/attachments ZIP, hash manifest, offline clone/fsck verification and ZIP byte verification. For source rollback before release, choose Original board or discard this unmerged branch. To remove Stage A from a deployed source in a future explicitly authorised operation, restore only the changed source/test files from the accepted Phase 1 ref or revert the Stage A commits; never restore `data.json` or attachment files from an older snapshot over live operational updates. Do not use a hard reset as a data rollback procedure.

Site/Client views are display filters, **not access control**. The public repository and raw board/attachment URLs can expose data omitted from a viewer's interface. Navigation does not strengthen that security model. The password gate is browser-side. Do not treat client-visible-only screenshots as evidence of confidentiality.

Physical Android tablet/outdoor/glove/soft-keyboard acceptance remains an owner release gate. Desktop browser touch/viewport emulation is not hardware testing. Firefox print-media is tested; Playwright PDF export and the PDF comparisons use Chromium. Native print dialogs, actual printers, Safari/iOS and assistive-technology conformance are not established by these checks. CDN/map/weather connectivity still follows the original application; no offline-cache promise is introduced. The existing disposable real-publishing acceptance test is separate and does not authorise live publishing. Do not begin derived Overview, focused spatial tabs or form/Settings redesign until the corresponding later stage is approved.
