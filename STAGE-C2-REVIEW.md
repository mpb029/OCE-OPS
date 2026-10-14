# Stage C2 — Field Operations usability

Accepted C1 base: `be9a80d998df2e1c08a0b73c3dc9a165f995919e`. Branch `ui/phase2-stage-c2` stacks against `ui/phase2-stage-c1`. PRs #1–#6 remain unchanged and draft. C2 stays opt-in and subject to owner review; no merge, deployment, operational publishing or Stage D work.

## Assessment and implementation plan

Operations, Resources, Quality/Risk and Coordination were assessed at 1440×900 desktop, 768×1024 portrait tablet, 1024×768 landscape tablet and 390×844 phone sizes. Twelve exact-C1 screenshots were reused; only four missing landscape baselines were captured. The main gaps were shortcuts disappearing during long-panel review, small icon controls, metadata readability and the item form's dependence on layout viewport height when a keyboard reduces the visible area.

1. Preserve the original rendered panels, records, forms and handlers. Add an explicit presentation adapter in the existing workspace shell, plus a scoped stylesheet.
2. Keep existing panel links available in a persistent strip; add a native touch selector for quick movement without scrolling back to the workspace heading.
3. Make original panel headers remain reachable during long-record review. Give Add, Print and Edit visible labels and enlarge existing action/visibility controls to at least 44 px.
4. Allow reversible collapse through each panel title, with a visible chevron, keyboard button semantics and an expanded-state announcement. Keep the panel in its original position. Direct panel links expand it.
5. Fit the original item dialog to `visualViewport.height` and `offsetTop`; keep its original Save/Cancel area separate from the scrolling field body. Retain every field, validation rule and handler.
6. Verify the affected workflows in Chromium/Firefox, then freeze the final candidate and run FULL plus the acceptance gate once at that commit.

## Architecture and exact behaviour

Only `ui-workspaces.js` and new `ui-field.css` change production presentation. `index.html`, Phase 1 files, existing workspace CSS, Overview adapter/metric definitions and C1 spatial CSS/adapter remain unchanged. No framework, second record store, duplicate CRUD or schema/publishing change is introduced.

The C2 adapter reads original permitted links/cards after workspace rendering. The same panel/card instances remain authoritative. Existing navigation links and original Add/Edit/Complete/Remove/Print/Site/Client handlers are retained. New labels supplement the original controls. Metadata is enlarged without transforming recorded values, dates, crew labels or statuses. Complete remains available only where the original runtime supplies it; no completion action or status is invented for other panels.

The native panel selector invokes the original link. It includes only panel names permitted by the existing renderer, in the original workspace/DOM order. The persistent strip indicates the panel currently being reviewed. Grouped-panel anchors use the document scroller and measured strip offset; the original deep-link assertion exposed native `scrollIntoView` stopping five pixels short of the available document limit on a short workspace. Scrolling/navigation/disclosure does not save records, mark the board dirty or publish. Collapse choices exist only in memory, survive workspace switching, reset for a different project and reload, and are removed by Original board. A direct panel link reveals its records. All 21 panels, Overview, Site & Models, All Panels and Original board remain available.

**History CSV exports the existing board history for all projects**, regardless of the selected project/workspace. The new editor shortcut states that scope and invokes the original Settings history button. It does not add filtering, new history logic or a viewer action. Existing Site/Client display rules remain authoritative; no editor controls, hidden panel names or hidden record counts are added to audience navigation.

Original forms retain their DOM instances, fields, input order, default values, validation, Enter behaviour, Save/Cancel handlers and focus restoration. C2 only adjusts the item dialog's visible viewport geometry, text-input size and touch target sizes while a grouped operational workspace is active. It does not restyle Settings or implement Stage D. Focused inputs scroll within the original field body. Reduced-viewport tests include a nonzero top offset and require Save and the focused field to remain reachable; physical keyboard/IME behaviour remains unverified.

Print styles reveal every original record even when a panel is collapsed. Navigation, disclosure icons and added action labels are excluded. Report content remains independent of the current workspace. Original board removes C2 panel enhancements immediately; no reload or migration is needed. Spatial instances, models/layers, backup compatibility, retirement/history, storage, project selection and publishing remain under the original runtime.

## Source and verification

| File | Purpose |
|---|---|
| `ui-workspaces.js` | Explicit DOM presentation adapter, title disclosure, persistent permitted panel links/selector, original History CSV shortcut, item visual-viewport sizing. |
| `ui-field.css` | C2 screen-only field workspace/action/metadata styles and item-dialog sizing; print removes added chrome while retaining titles and records. |
| `tests/field-usability.cjs` | Twelve C2 contracts: exact C1/domain parity, four responsive long-panel/navigation/action checks, four original-form/viewport/CRUD/persistence checks, Site/Client rules and history/print/cancel/project-reset checks. |
| `tests/capture-field.cjs`, `tests/capture-workspaces.cjs` | Sixteen actual affected workspace captures and four original RFI forms, using isolated synthetic inputs. All previous captures retained. |
| `tests/workspaces.cjs` | Integrates C2 into the existing filtered and complete suites. |
| `tests/verify.cjs`, `tests/verify.test.cjs` | Adds field scope and requires all C2 assertions/screenshots in FULL; preserves every prior gate. |
| `.github/workflows/review-checks.yml` | Ordinary C2 PR iterations use small FAST field evidence; FOCUSED/FULL remain explicitly selectable. |
| `VERIFICATION.md`, `STAGE-C2-REVIEW.md` | Commands, scope, history definition, physical-device limits and rollback. |

FULL requires **332 browser checks**, 25 PDF comparisons and 81 workspace captures, plus original responsive/model evidence, protected data/assets, self-contained recovery and its independent verification. Twelve identical C2 views reuse captures produced earlier within that same fresh FULL directory; previous-run evidence is never used for acceptance. Source contracts compare the entire original runtime/forms, C1 spatial presentation and all mandatory browser assertions to C1. STAT-001 remains unresolved; its original production-stat editing assertion is unchanged, mandatory and included in the field scope. No arbitrary sleeps, relaxed values or automatic retries are added.

STAT-001 recurred during local default field FOCUSED verification (`120` returned after editing to `180`). That receipt remains failed evidence. Independent C2 FOCUSED validation used explicit affected-workflow filters in both browsers; it is separate from the failed default scope. Default field CI and final FULL retain the production-stat assertion. A failure in final FULL blocks the acceptance gate; targeted success cannot replace it. The final external report records exact executed results and all earlier failures.

## Physical Android and remaining boundaries

The owner instructed continued development and will flag physical-device issues later. No tablet model, browser version, orientation/keyboard defect or other physical finding has been supplied. Browser touch emulation, reduced viewport simulation and Chromium/Firefox checks are not physical acceptance. C1's Android acceptance also remains outstanding.

On the isolated preview, the owner should check:

1. Portrait/landscape: select/jump to each permitted panel, scroll a long list, use sticky Add/Print, collapse/reopen and verify original ordering.
2. Actual on-screen keyboard: add/edit a representative Daily Works, delivery, punch item and RFI; move between fields, scroll to the last field, Save/Cancel and rotate. Verify no essential action is covered, including date pickers and IME completion.
3. Tap Complete/Undo where supplied and Site/Client controls; confirm the original records/history and visibility outcomes. Check History CSV's all-project scope.
4. Switch projects and audience links; check fresh records and absence of restricted labels. Verify full/single-panel native printing includes collapsed records.
5. Return to Site & Models and confirm the C1 inspection state; test All Panels and Original board rollback. Never publish the preview to live operational data.

Native printing, physical Android/GPU/IME and real disposable-repository publishing remain separate acceptance items. Site/Client visibility remains display filtering rather than access control. External CDN/tile availability remains a dependency. Rainbow Beach GeoJSON, saved coordinates, spatial layer defaults and operational files are untouched.

Keyboard handling follows the visible viewport rather than changing the application's viewport meta tag or using device detection. Browser/keyboard modes can resize different viewports or overlay the keyboard; actual device behaviour still requires owner checks. [Chrome's documented keyboard viewport behaviour](https://developer.chrome.com/blog/viewport-resize-behavior) explains this boundary. Tablet browser desktop-site mode should also be included in manual review. [Chrome's tablet guidance](https://developer.chrome.com/blog/desktop-mode) supports testing touch interaction in that mode.

## Rollback

Choose **Original board** (phone: Menu → Original board), use `?ui=classic`, or remove `ui`. All Panels removes C2 grouped-panel presentation while retaining the workspace shell. To revert source, revert only C2 commits on the C2 branch; restoring C1's `ui-workspaces.js` leaves the new stylesheet unused. Preserve data/assets and the accepted C1 recovery artifacts. The final delivery supplies exact commit, test receipts, preservation hashes and self-contained recovery. Draft status and owner approval remain required before merge/deployment.
