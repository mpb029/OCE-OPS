# G12 geometry completeness — PR #17

The `8196c6d` importer is retained. The warnings correspond to **real but microscopic face omissions**, not missing products or substantial missing surfaces. No source geometry is repaired, approximated or replaced, and warnings remain visible.

The checked IFC SHA-256 is `17d1deefc3e84ed00ada03c4e8067bd182bfd09ffc8b0cb4ce7b22317b1636cf`.

## Accounting

- All **132 source products and 20 groups** match imported GlobalIds and memberships. This includes tank `19hdx20rvVOBt0lIOegNKB`, which the original 131-element manifest omitted.
- **108 surface-bearing products** produce **106,602 triangles**. These include the original ground surface; a surface is not treated as a closed solid.
- **24 curve products** retain their original **3,917 polyline segments**, including the existing wet-well and demolition outlines. They correctly do not acquire solid meshes.
- Source polygon loops define **67,242 faces**, nominally **107,990 triangles**. The parser's numerical rules omit **1,038 faces**, accounting exactly for **1,388 nominal triangles**. The remaining **66,204 faces** have imported triangle incidence. Every product's independent predicted triangle count matches its imported count.

| Cause | Source faces | Nominal triangles omitted | Source area omitted |
|---|---:|---:|---:|
| Logged `No basis found for brep`: thin quads | 100 | 200 | 0.2275883612 mm² |
| Same warning: two tank pole caps, 128 vertices each | 2 | 252 | 0.0000062806 mm² |
| Unlogged `AddFace` minimum-area rejection | 936 | 936 | 0.0022041409 mm² |
| **Total** | **1,038** | **1,388** | **0.2297987826 mm²** |

The faces have nonzero recorded area; they are not exactly collinear or duplicate-coordinate faces. Quad widths are 0.058–188.55 nm, below the source's 1 µm context precision. Tank pole-cap diameters are approximately 2 µm. The omitted tiny triangles reach approximately 19.75 µm diameter; not every omission is strictly below the stated length precision. The tank's 3,200 body faces remain represented by 6,400 triangles; only its two microscopic pole caps are omitted.

## Warning ownership

All 102 warnings name `IFCFACE` IDs belonging to `Brep` representations. Exact warning face IDs are retained in the audit fixture's `source.warningFaceAudit.affectedProducts`.

| Product ExpressID | GlobalId | Logged warnings | All omitted faces |
|---|---|---:|---:|
| #25733 Concrete driveway/apron | `0E$p_CGTPRtRHhAGy$ZKUS` | 39 | 541 |
| #27802 Island concrete infill | `3mkrZXqofIqwacedhmXEt1` | 11 | 117 |
| #30890 AC14M road tie-in | `3Krlv7wm5ShPY5vYPBpzti` | 17 | 97 |
| #33979 Type2.1 road base | `2ksO0$IRjHdAFWke3IKxQk` | 13 | 93 |
| #37068 Type2.3 road subbase | `3V0UIp2OjK4O8n07mVimgB` | 13 | 93 |
| #43736 Topsoil/turf | `0TlcN3jarPge6O9p_mz9Uj` | 7 | 95 |
| #170670 Emergency storage tank | `19hdx20rvVOBt0lIOegNKB` | 2 | 2 |

## Evidence and limits

Independent STEP traversal follows face → shell → representation → product and calculates areas from original decimal coordinates. Replaying the pinned parser's basis-selection rules predicts exactly the 102 logged face IDs. Its `AddFace` cross-product threshold of `1e-10` predicts exactly the other 936 face IDs. See the pinned [triangulation routine](https://github.com/ThatOpen/engine_web-ifc/blob/4310503d8618a0870c2166f101471078d528f4c1/src/cpp/web-ifc/geometry/operations/geometryutils.h#L196), [AddFace implementation](https://github.com/ThatOpen/engine_web-ifc/blob/4310503d8618a0870c2166f101471078d528f4c1/src/cpp/web-ifc/geometry/operations/bim-geometry/geometry.cpp#L69) and [normal calculation](https://github.com/ThatOpen/engine_web-ifc/blob/4310503d8618a0870c2166f101471078d528f4c1/src/cpp/web-ifc/geometry/operations/bim-geometry/utils.h#L51).

Every nonzero imported triangle maps to source face vertices within 3 µm; the maximum nearest-vertex error is 1.173 µm. There are no unmatched triangles or unexplained omission IDs. Near-coincident vertices make 365 face-incidence assignments ambiguous at this tolerance; these are retained explicitly rather than claiming exact topology from rounded vertices. Unambiguous per-face area checks pass. Per-product sorted world-coordinate triangle hashes tie the audited output to the actual Chromium and Firefox geometry. Source-derived counts, bounds, line segments and material display instructions provide independent comparisons.

No visibly significant missing or wrongly replaced geometry was found in the tank, wet well, pipework, ground or demolition representations. This is a coordination-view completeness result, **not a claim of bit-exact or watertight geometry**. Replacing the parser to preserve microscopic faces is not justified for this viewer task.

Run `node tests/ifc-geometry.cjs` with `OCE_ENGINE=chromium` or `firefox` in the existing test environment. Set `OCE_IFC_G12` to the original local IFC when needed. The committed audit fixture is tied to that file hash; an updated IFC requires a new source audit. Tests include layer visibility, isolation and selection for the five requested model areas. No FULL suite, PDFs or screenshot gallery is involved.
