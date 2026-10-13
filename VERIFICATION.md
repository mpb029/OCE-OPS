# Verification levels

Development tooling only. The accepted Stage A milestone remains `938ad274d232aa8a045e54b5b15531b6a9c61b3a`; retain its existing review/recovery artifacts. PR #1 and PR #2 stay draft. The workflow does not authorise application changes: Stage B1 is separately approved and documented in STAGE-B1-REVIEW.md. PR #3 remains at 2e371d7. Operational data, attachments, location defaults, schema and publishing code remain protected.

Use Node.js 24, `npm ci`, and Playwright's Chromium/Firefox installations. FOCUSED/FULL also require Python and `pypdf==6.10.0`. On Linux use `LIBGL_ALWAYS_SOFTWARE=1` and `xvfb-run --auto-servernum` as CI does. Tests use isolated browser contexts and intercept publishing requests; never supply production credentials. One browser engine runs at a time.

| Level | Command | Evidence and purpose |
|---|---|---|
| FAST | `npm run verify:fast -- --scope navigation` | Syntax, inline-script compilation, diff/integrity checks, protected assets, orchestration tests, selected Chromium checks. No bulk screenshots/PDF comparisons/recovery. |
| FOCUSED | `npm run verify:focused -- --scope navigation` | Selected feature checks in Chromium and Firefox, plus original source contracts, project/audience filtering, persistence, deep links and print safeguards; five Chromium report comparisons. No bulk captures or recovery. |
| FULL | `npm run verify:full` | Complete 83 original + 34 Stage A + 13 B1 assertions in each engine, 5 original + 20 workspace PDF comparisons (including Overview), all 48 workspace screenshots, original responsive/model evidence, protected assets, standalone bundle/archive and independent recovery verification. |

Scopes: `workflow` (FAST source/tooling only), `navigation`, `overview`, `audience`, `editing`, `backup`, `spatial`, `print`. Select the affected scope after reviewing the diff; run multiple scopes for unrelated changes. For a tooling-only edit start with `npm run verify:fast`. Add `--plan` to inspect the exact command/filter selection without executing tests. Existing `npm test`, `test:workspaces` and other individual commands remain available.

For more precise FAST selection, set the existing `OCE_STAGE_A_FILTER` and/or `OCE_TEST_FILTER` to a test-name regular expression. A filter matching zero tests fails the runner. FOCUSED adds its common safeguards even when custom filters are set. FULL clears both filters, screenshot filters and alternate main references; it rejects scoped screenshots and reuse. A partial or failed run cannot satisfy acceptance.

Capture only an affected view when useful:

```sh
npm run verify:fast -- --scope navigation --shots '^editor-tablet-drawer\.png$'
```

`--shots` selects actual synthetic workspace captures by filename: `{editor|site|client}-{desktop|tablet|mobile}-{route}.png`; editor forms use `rfi`, navigation uses `drawer` (tablet/mobile), actual model evidence uses `editor-desktop-site-g4n.png`. Existing standalone capture supports `OCE_SCREENSHOT_FILTER`. Omitting a screenshot selection in FAST/FOCUSED captures nothing extra; FULL always captures everything. Tests that themselves record a failure/workflow image retain that evidence.

Every invocation writes a fresh `test-results/verification/<level>-<commit>-<unique>/` directory and `verification.json`. It never merges filtered results into an old JSON or overwrites accepted evidence. `OCE_VERIFY_OUTPUT` can select a different parent; `OCE_TEST_OUTPUT` is assigned separately to each engine. `OCE_PYTHON` selects a Python executable; `OCE_BROWSER` selects Chromium only and is removed for Firefox. Receipts record commit, command plan, selected filters, tool/platform/browser fingerprints and artifact SHA-256 hashes. Dirty development trees are labelled; FULL requires a clean committed tree throughout.

For B1 development: `npm run verify:fast -- --scope overview --shots 'editor-(desktop|tablet)-overview'`. At feature completion: `npm run verify:focused -- --scope overview`. The 13 Overview contracts run inside the existing workspace suite, use `OCE_STAGE_A_FILTER`, and are mandatory in FULL. FULL also compares five report families from Overview and captures editor/site/client Overview at all three sizes.

## Evidence reuse

Within 24 hours, an explicitly requested FOCUSED reuse is available:

```sh
npm run verify:focused -- --scope navigation --reuse test-results/verification/focused-COMMIT-UNIQUE
```

The original executed FOCUSED run must have passed. Every non-documentation repository input (including untracked source, all tests/configuration, fixtures, data and protected assets), selected commands, main baseline, Node/Python/Playwright versions, browser executable bytes and OS must match. Every recorded artifact must still exist with its recorded hash. A change or missing artifact rejects reuse; run without `--reuse` to execute anew. Basic integrity checks always run. The new receipt names the original commit/run and explicitly marks reuse; it never claims a fresh browser test. Chained reuse is forbidden.

This saves repeated execution after documentation/review-only changes. It does not recheck external CDN/map-tile availability, hardware, native printing or real publishing. Rerun if those conditions may have changed. FULL never reuses prior browser, PDF, screenshot or recovery evidence, even at the same commit.

## CI and the acceptance gate

On the B1 branch, PR open/reopen/update events run FAST Overview checks plus source/integrity/tooling checks. Select navigation explicitly for navigation-only changes. They upload small scoped evidence for seven days. They do not create recovery bundles, PDF comparison batches or the 48-image gallery.

Add the PR label `verification:focused` or `verification:full` to request that level on its exact head SHA. The label-add event runs once; later pushes remain FAST even if the label remains. Remove/re-add the label to request another run. Unrelated label events run no tests. This works on draft PRs before this workflow exists on main. Once available on the default branch, Actions **Run workflow** also provides level/scope choices and a branch selector. GitHub documents the [default-branch requirement for workflow_dispatch](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch).

FULL CI checks out the PR head (not the synthetic merge commit), fetches main, runs both engines, exports the complete evidence and independently validates the receipt again. Full artifacts are retained for 30 days with compression disabled for the already-compressed recovery files. Download and preserve them outside temporary CI storage. Permissions remain `contents: read`; there is no deployment, publishing, PR-ready or merge job. CI performs no automatic test retry.

**Before any merge authorisation**, obtain a successful FULL run at the current exact candidate SHA, then in that same clean verification environment run:

```sh
git fetch origin main
npm run verify:gate -- --evidence test-results/verification/full-COMMIT-UNIQUE
```

The gate checks the complete command plan, both full suites, PDF comparisons, all workspace captures, recovery results, hashes, current source/tool environment and latest fetched main. New commits, operational-main changes, missing evidence, partial suites or failed assertions invalidate acceptance. Fetch the current PR head and confirm it still equals that candidate; a green FAST/FOCUSED check, a skipped job or an older FULL run is insufficient. Keep owner approval, physical-device review and the existing separate disposable-publishing acceptance requirements. This change does not configure GitHub branch protection; do not mistake the documented owner gate for a server-enforced merge lock. If configuring branch rules separately, require the actual FULL check and owner review, never the generic workflow's green status.

For independently checking downloaded evidence, use its exact source commit, tool versions and recorded artifacts; paths/platform changes require a fresh FULL execution rather than pretending to reproduce the original environment. The bundle and source ZIP remain self-contained repository recovery. Browser-local unpublished data still requires the application's existing export/recovery download.

## Open intermittent failure: STAT-001

At Stage A commit `938ad27`, Linux CI run `38450800909` attempt 1 failed **Production stat: extra fields, target, edit, visibility and delete**: the immediate read after Save returned `120`, expected `180`. Other checks passed. An unchanged rerun passed, as did the final local Chromium/Firefox suites and 30 separate baseline/candidate rapid-edit probes. Root cause is **unresolved**; a scheduled initial-focus callback is only a hypothesis, not an established explanation.

Keep the original assertion in `tests/regression.cjs` unchanged. Do not suppress the test, accept `120`, add arbitrary sleeps, automatically retry it into green or remove the failed attempt from the report. It remains included in FULL and the `editing` scope. For targeted investigation in PowerShell:

```powershell
$env:OCE_TEST_FILTER = '^Production stat:'
npm run verify:focused -- --scope workflow
Remove-Item Env:OCE_TEST_FILTER
```

Preserve failing receipts/logs, browser/version, exact commit and event/focus/value timing evidence. A diagnostic rerun is separate evidence, not a replacement for the failure. Any remedy needs a demonstrated cause and a regression test; final acceptance still requires a complete successful FULL run and disclosure of earlier failures. Original evidence is retained in the Stage A delivery (`ci-attempts.json`, `development/stat-timing.json`) and [CI run 38450800909](https://github.com/mpb029/OCE-OPS/actions/runs/38450800909).

## Rollback

Revert only the workflow/tooling commit to restore the previous per-PR full pipeline. Do not reset data/assets or rebuild the accepted Stage A recovery packages for ordinary iterations. The application at `938ad27` remains unchanged by either workflow choice.
