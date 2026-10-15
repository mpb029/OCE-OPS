# IFC import

The existing Three.js r128 viewer accepts IFC2x3 and IFC4 STEP files, including
Revit exports. OBJ, STL, GLB and GLTF keep their existing loaders and controls.

`ifc-worker.js` lazily imports the pinned, MPL-2.0 licensed
[web-ifc 0.0.78](https://github.com/ThatOpen/engine_web-ifc/tree/4310503d8618a0870c2166f101471078d528f4c1)
browser module and matching WASM from jsDelivr. Its single-thread WASM runs inside
a dedicated worker; static GitHub Pages needs no server, build, isolation headers
or new rendering framework. The worker terminates after success, failure or removal.

Geometry uses web-ifc's metre scaling and per-instance placement matrices, including
its IFC Z-up to Three Y-up conversion. `COORDINATE_TO_ORIGIN` is explicitly false:
parts and separately imported models retain their original relative positions.
No geographic guessing, per-part recentring or second axis conversion is applied.

Add file remains session-only and uploads nothing. Add URL retains the existing
saved/shared reference, project filtering and explicit publishing workflow. File
upload limits, operational records and publishing payload construction are unchanged.

Limits: current browsers with WebAssembly SIMD/exceptions and network access to
the pinned parser CDN are required. Large exports can consume substantial memory
and draw calls. Unsupported IFC geometry can be omitted by web-ifc; this is a
geometry viewer, not a completeness validator. IFCZIP, IFCXML, IFC4X3 and native RVT
are not supported here. Survey-scale coordinates retain existing float precision
limits. Validate important exports against the source model. No properties,
selection, quantities or IFC export are implemented.

Targeted commands (using the existing Playwright environment):

```sh
node tests/ifc-import.cjs --fast
OCE_ENGINE=chromium node tests/ifc-import.cjs --screenshot
OCE_ENGINE=firefox node tests/ifc-import.cjs
```

Only Chromium's `--screenshot` creates the single actual Revit IFC image. The tests
also use a small IFC4 fixture with known millimetre dimensions, nested placements
and rotations; fixture provenance/licensing is in `tests/fixtures-ifc/PROVENANCE.md`.
