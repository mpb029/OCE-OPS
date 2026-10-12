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
The known original import defect is reported separately from passing checks.

See [the review report](../docs/phase1/REVIEW.md) for results, limitations and the approval gate.
