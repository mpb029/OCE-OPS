# IFC inspection

The existing Three.js viewer now keeps IFC GlobalIds, groups and recorded property sets alongside geometry from the pinned, lazy-loaded web-ifc parser. Group/element visibility, isolation, selection, ground opacity and horizontal clipping are viewer state only. Existing model imports, project assignments, upload limits and publishing remain unchanged.

Named views save camera position, clipping range and visibility in browser storage, keyed by the exact IFC SHA-256. They are not operational board data or published settings. Whole-model and user-created views work with other IFCs. The three supplied G12 views use explicit GlobalId selections in `ifc-presets.js`, restricted to the supplied file hash; a revised export does not silently inherit those selections. HTTPS/localhost enables persistent file-verified views; plain HTTP previews retain session inspection.

The supplied IFC has **132 products**, not the manifest's 131: `19hdx20rvVOBt0lIOegNKB` is the additional emergency-storage-tank shell. All 20 actual IFC groups are retained. The model produces 108 surface products and 24 original polyline products. Curves are rendered from their recorded vertices and placements; unsupported representations are reported, not reconstructed.

The parser reports 102 geometry warnings for this source, with the first 20 available in the viewer. Every product has geometry, but this does not establish that every BRep face triangulated correctly. The viewer is not a design-certification check. AHD section labels are enabled only for the verified metre-unit, identity-axis IFC map conversion; otherwise they report local viewer height.

## Targeted verification

Use the existing Node/Playwright environment. Set `OCE_IFC_G12` and `OCE_IFC_G12_MANIFEST` to the supplied local files when outside the owner's environment.

```text
node tests/ifc-interactive.cjs --fast
OCE_ENGINE=chromium node tests/ifc-interactive.cjs --screenshot
OCE_ENGINE=firefox node tests/ifc-interactive.cjs
```

The fixture and protected-file hashes are included in the results. Tests use isolated data and reject external mutations. No FULL suite is required for this intermediate enhancement. Physical Android performance remains an owner check; browser tests do not substitute for it.
