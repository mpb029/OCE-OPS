# Isolated UI regression checks

Run `npm ci`, `npx playwright install chromium`, then `npm test` from the repository root.
The optional harness needs Node.js, Git and internet access for the existing CDN libraries.
It has no production credentials and intercepts every GitHub API write.

The baseline is commit `bee28796bb00f860d17b723d6a3c0b01bd5f4101`; retain Git history when cloning.
Results, screenshots and PDFs go to ignored `test-results/` by default.
`OCE_TEST_OUTPUT` selects another output directory; `OCE_BROWSER` selects an installed Chromium executable.

`npm run screenshots -- before` and `npm run screenshots -- after` capture the actual interface.
Weather and audience keys are fixtures. Screenshots use a moving clock for Leaflet's tile fade;
data comparisons use a fixed clock for deterministic history timestamps.

`OCE_TEST_FILTER` is an optional regular expression for focused reruns. Results are merged by
test name when filtering, so the report retains the latest result for every exercised check.
Phase 1.1 replaces the known-import-defect check with complete round trips, legacy
compatibility, invalid-input rejection, storage/render rollback and model-cache tests.
Map repairs and actual G4N framing have dedicated checks. Every full report records
the candidate commit, latest fetched main commit, clean/dirty status and timestamps.

Run `python -m pip install pypdf==6.10.0` followed by `python tests/compare-print.py`
after the suite to compare all five PDFs. `node tests/model-inspection.cjs` records
real geometry measurements and default/Y-up/close-up captures using existing controls.
Print parity selects the same operational map layer/zoom in both versions and waits
for the app's image-preload/print callback; the repaired base loader intentionally
changes the initial map extent. No production print behavior is altered by this setup.

The pull-request CI workflow checks the exact PR head, fetches main, runs all checks,
compares PDFs and retains screenshots/results for 14 days. It has read-only repository
permissions, does not retain checkout credentials, and contains no deployment step.
External CDN availability is still required. CI does not exercise real GitHub writes.

See [the Phase 1 report](../docs/phase1/REVIEW.md) for the original comparison and
[Phase 1.1](../docs/phase1.1/REVIEW.md) for the subsequent refinements and isolated repairs.
