# Verification levels

## Current policy

- **FAST during development.** Run only relevant checks, basic source/integrity checks and protected-asset hashes. Capture only an affected view when useful. Do not generate recovery archives, extensive galleries or comprehensive PDF packages.
- **FOCUSED at feature completion.** Test affected workflows in Chromium and Firefox, with relevant audience/project, persistence and print safeguards. Reuse valid evidence only under the exact-input rules below. Feature completion does not automatically require FULL.
- **FULL only at the consolidated production release gate, or when a specific high-risk change justifies it.** Record the risk and reason before a discretionary FULL run. A feature milestone, draft PR or ordinary iteration alone is not a reason. FULL remains mandatory before production merge authorisation; it is not run automatically after every feature.

This policy supersedes earlier milestone-specific instructions to run FULL after every stage. Historical accepted evidence and recovery artifacts remain preserved. It does not authorise merging, deployment, production publishing or operational-data changes.

Use Node.js 24, `npm ci`, Playwright Chromium/Firefox and, for PDF comparisons, Python with `pypdf==6.10.0`. Linux uses `LIBGL_ALWAYS_SOFTWARE=1` and `xvfb-run --auto-servernum`. Tests use isolated contexts and intercepted synthetic publishing requests; never provide production credentials. Run one browser engine at a time.

| Level | Example | Evidence |
|---|---|---|
| FAST | `npm run verify:fast -- --scope report-refinement` | Relevant Chromium checks, syntax, integrity, protected-file hashes and orchestration tests. No PDFs or recovery. |
| FOCUSED | `npm run verify:focused -- --scope report-refinement` | Both engines test only full-board/weekly-photo report behavior and relevant project/audience/read-only contracts. Four representative Chromium PDFs (before/after for two reports), with complete ordered text and photograph preservation checks. No broad browser suites, 25-report package, galleries or recovery. |
| FULL | `npm run verify:full` | Complete original and workspace suites in both engines, all mandatory assertions, report comparisons, required screenshots, protected assets and independently verified self-contained recovery. Production release or documented high-risk use only. |

Scopes: `workflow` (FAST source/tooling only), `navigation`, `overview`, `audience`, `editing`, `backup`, `spatial`, `project-spatial`, `field`, `forms`, `print`, `report-refinement`. Select the affected scope; use multiple scopes only for independently affected workflows. `--plan` prints the exact commands without executing them. Existing standalone test commands remain available.

General FOCUSED scopes retain their established common source, audience/project, persistence, navigation and print guards plus five report comparisons. **`report-refinement` deliberately uses its own narrow standalone contracts**: neither broad browser suite nor unrelated deep-link tests run in this scope. Those assertions remain unchanged and mandatory at the production FULL gate. This is task selection, not a waiver of open release issues.

For precise FAST selection in existing suites use `OCE_STAGE_A_FILTER` and/or `OCE_TEST_FILTER`. A zero-match selection fails. General FOCUSED adds its common guards. The dedicated report-refinement runner always executes its complete small contract set and ignores unrelated suite filters. FULL clears all filters and rejects scoped screenshots and reuse. Partial or failed evidence never satisfies the production gate.

## Stage F1: full-board and weekly-photo reporting

Baseline: Stage E `76cb688`. Only those two report layouts may intentionally repaginate. Compare their complete ordered text and actual drawn photograph content; page-count or per-page-text changes alone are not failures. The historical `client` PDF is the same full-board handler in Client view, so it follows the same content-preservation rule. Daily Works and punchlist reports retain their existing per-page parity requirements. Test source normalization allows only one exact print-only stylesheet link; earlier application functions and regression assertions remain unchanged.

During development run `npm run verify:fast -- --scope report-refinement`; at completion run `npm run verify:focused -- --scope report-refinement`. The latter creates exactly `before-report.pdf`, `after-report.pdf`, `before-photos.pdf` and `after-photos.pdf` in the run's Chromium `report-refinement/` folder. Chromium produces the representative PDFs; Firefox verifies the same report DOM/print behavior. Native Firefox print-to-PDF and physical printer behavior remain manual checks. No FULL run is required for F1.

Future consolidated FULL includes the new report contracts in both engines and the two representative content comparisons, in addition to existing suites. It retains 83 original and 104 workspace contracts per engine, 5 original plus 20 workspace report comparisons, three representative Stage E captures, model inspection, all protected assets and complete recovery. Intentional pagination is permitted only for full-board and weekly photos; content loss remains a failure. Do not regenerate this package during ordinary feature development.

## Scoped captures and receipts

Use `--shots` only when a changed screen needs evidence, for example `npm run verify:fast -- --scope navigation --shots '^editor-tablet-drawer\.png$'`. Existing workspace captures use `{editor|site|client}-{desktop|tablet|mobile}-{route}.png`; forms use `stage-d-{desktop|tablet|mobile}.png`; project-spatial uses `stage-e-{desktop|tablet|mobile}.png`. Report-refinement rejects `--shots` because its deliverable is the two PDF comparisons. Omitting `--shots` captures no extra gallery. Original assertion-generated failure/workflow images remain evidence.

Every invocation creates a fresh `test-results/verification/<level>-<commit>-<unique>/` directory with `verification.json`. It never appends filtered results to old accepted evidence. `OCE_VERIFY_OUTPUT` sets an alternative parent; `OCE_PYTHON` selects Python; `OCE_BROWSER` selects Chromium only. Receipts record commit, filters/commands, source/input hashes, browser/tool/platform fingerprints and artifact hashes. Dirty development work is labelled. FULL requires a clean committed checkout throughout.

## Evidence reuse

Within 24 hours explicitly request FOCUSED reuse with `npm run verify:focused -- --scope navigation --reuse test-results/verification/focused-COMMIT-UNIQUE`.

The original executed run must have passed. All non-documentation repository inputs (including untracked source, tests, fixtures, data and assets), selected commands, main baseline, tool/browser bytes and platform must match. Every artifact must exist with its original hash. Changed or missing inputs reject reuse. Basic integrity checks always rerun. The new receipt identifies the original run and does not claim fresh browser execution. Chained reuse is forbidden. FULL never reuses prior acceptance evidence.

This saves duplicate testing after documentation-only changes. It does not recheck CDN availability, physical devices, native printing or real publishing; rerun relevant checks when those conditions change.

## CI and production acceptance

Ordinary PR open/reopen/update events run FAST in the current affected scope (F1: `report-refinement`). Small scoped artifacts remain for seven days. No recovery, comprehensive PDFs or screenshot gallery is generated by default. CI never automatically retries failed assertions.

Adding `verification:focused` explicitly requests FOCUSED on the exact PR head. Adding `verification:full` explicitly requests FULL **only for the consolidated release or a documented high-risk reason**. Each label-add event runs once; later pushes remain FAST. Workflow dispatch provides level/scope/branch choices once the workflow is on the default branch. FULL checkout uses the actual PR head, fetches main, retains complete evidence for 30 days and validates the gate. Permissions remain `contents: read`; there is no deployment, publishing, ready-for-review or merge job.

Before production merge authorisation obtain a successful FULL run at the current exact candidate SHA, then in the same clean environment run:

```sh
git fetch origin main
npm run verify:gate -- --evidence test-results/verification/full-COMMIT-UNIQUE
```

The gate verifies the complete command plan, both full suites, report content/pagination rules, required captures, recovery, hashes, current environment and latest fetched main. New commits, operational-main changes, missing evidence, partial suites or failed assertions invalidate release acceptance. Fetch the PR head and confirm the same SHA. FAST/FOCUSED or an older FULL cannot authorise production merge. Preserve owner approval, physical-device review and separate disposable-publishing acceptance requirements. The documented gate is not GitHub branch protection; configure any server-side rules separately.

Downloaded evidence must be checked against its exact source, tool versions and recorded artifacts. Different paths/platforms require a fresh release FULL rather than claiming reproduction. The Git bundle and source ZIP provide self-contained repository recovery; unpublished browser-local data still needs the application's export/recovery download.

## Open release issues

### STAT-001 — intermittent production-stat editing

At Stage A `938ad27`, Linux CI run `38450800909` attempt 1 read `120` after Save, expected `180`, in **Production stat: extra fields, target, edit, visibility and delete**. An unchanged rerun and subsequent local probes passed. Root cause remains unresolved; scheduled initial focus is only a hypothesis.

Keep the original `tests/regression.cjs` assertion unchanged. Do not suppress it, accept `120`, add arbitrary sleeps, automatically retry into green or remove failed evidence. It remains in FULL and the editing scope. Diagnostic command:

```powershell
$env:OCE_TEST_FILTER = '^Production stat:'
npm run verify:focused -- --scope workflow
Remove-Item Env:OCE_TEST_FILTER
```

Preserve failed receipts, browser/version, exact commit and event/focus/value timing. A diagnostic rerun is separate evidence, not a replacement. Any remedy needs a demonstrated cause and regression test. Original evidence remains in Stage A `ci-attempts.json`, `development/stat-timing.json` and [CI run 38450800909](https://github.com/mpb029/OCE-OPS/actions/runs/38450800909).

### NAV-001 — Firefox initial deep-link positioning

Stage E `76cb688` FULL passed 373/374 checks; Firefox initial deep-link positioning failed and was reproduced diagnostically. The punchlist target was measured at approximately `y=100.35` after the browser moved it. Root cause is unproven. Preserve the original deep-link assertion, failed receipt and diagnostic evidence in `outputs/stage-e`; do not weaken thresholds or hide the result with retries. This remains a production release-gate blocker. F1 does not modify navigation or claim to resolve this issue.

## Rollback

Revert only the applicable workflow/tooling or interface commit. Never reset protected data/assets or regenerate old recovery packages for ordinary iterations. Earlier PRs and milestone artifacts stay preserved. A successful focused feature review does not change the owner's separate merge/deployment approval boundary.
