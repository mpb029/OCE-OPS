# Client Lookahead — coordination sections

Baseline: deployed PLN-001 `f648250`. Feature branch: `feature/client-lookahead-context`.

The Client screen and native A3/A4 PDF now use the same published projection for:

- **Subcontractors onsite:** existing linked Subcontractor records; name and recorded `due` onsite date only. Personal contact/crew details are excluded. Dated entries must fall in the selected period/week.
- **Permits & approvals required:** required permit IDs from the linked Work Package, with recorded type, status, effective/expiry dates and related Client-visible work.
- **Works awaiting approval / decision:** selected activities with outstanding permit/coverage blockers from the original `makeReady` calculation, or explicitly completion-required RFI/design/variation links that the original completion rule considers incomplete. Required approval records not yet linked are stated as such. No full GO / NO GO is inferred from this subset.
- **Anticipated milestones:** the existing explicit milestone flag; recorded planned finish (or start), in the selected period. Completed/cancelled activities are excluded.

## Sharing and compatibility

In **Scheduled Works → Edit → Client Lookahead Programme**, select the additional sharing checkboxes and use the existing subcontractor references / linked Work Package. Source project, panel, item, retirement and permit Client visibility still apply. Hidden sources contribute no titles, counts or pending-work rows.

The existing optional `planning.clientLookahead` metadata accepts three additional optional booleans: `shareSubcontractors`, `sharePermits`, `shareApprovals`. Missing means false. Legacy records and unknown compatible metadata remain valid. No duplicate operational records or new registers are created.

The Client and office Client PDF use the last verified published board, never local draft changes. Original Save, reload, backup restoration and explicit Publish handle the metadata. Import still requires the existing review and never publishes automatically. Live board data is not enabled or changed by deploying this feature.

Dates are source records, not attendance verification or new forecasts. This feature does not grant work approval or provide authentication for public GitHub Pages data.

## Verification

- `node --test tests/client-lookahead-context.test.cjs tests/planning-lookahead.test.cjs tests/planning-data.test.cjs`: **31 PASS**.
- `OCE_OFFLINE=1 OCE_ENGINE=<chromium|firefox> node tests/client-lookahead-context.cjs`: **3 PASS per engine**, synthetic data and intercepted publication. Tests include desktop/tablet/phone width, readonly/hidden fields, original form, unpublished output, reload, export/import and explicit publishing.
- `OCE_OFFLINE=1 OCE_ENGINE=<chromium|firefox> node tests/planning-page.cjs --fast`: **5 PASS per engine**, retaining routing, filtering, original forms and real map/model state.
- One representative native A3 PDF: **1 page**, all four sections plus original schedule, 10pt table text, no clipped characters or private sentinels. Render visually inspected. `OCE_CLIENT_CONTEXT_PDF=1` enables this optional Chromium-only artifact; ordinary runs produce no PDFs.
- Existing PDF checks now count explicit activity references across both coordination summaries and schedule rows; ordered content and repeated headers remain required. No FULL, unrelated PDF suite, recovery archive or screenshot gallery was run.
- Projection/privacy unit tests are included in the existing CI unit stage. Historical source-parity assertions are unchanged.

Changed runtime files: `planning-lookahead.js`, `planning-control.js`, `planning-data.js`, `planning-page.css`. Existing application shell, storage/publishing implementations, engines and operational files are unchanged.

Physical Android use/native printer output remains owner acceptance. Existing release issues STAT-001/NAV-001 are untouched.
