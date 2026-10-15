# IFC import fixtures

`revit-2021-ifc2x3.ifc` is an unchanged copy of the public `examples/example.ifc`
fixture in That Open Company's `engine_web-ifc` repository at commit
`4310503d8618a0870c2166f101471078d528f4c1`, the source revision of npm `web-ifc@0.0.78`.

- Source: https://github.com/ThatOpen/engine_web-ifc/blob/4310503d8618a0870c2166f101471078d528f4c1/examples/example.ifc
- Repository licence: Mozilla Public License 2.0; unchanged copy in `LICENSE-MPL-2.0.txt`.
- Header identifies Autodesk Revit 2021 (ENU), IFC2X3.
- SHA-256: `db372f3f57796e2f572958c1c144bf3d8be7912493738636a2152cf18f08a14d`.
- Used only as a representative import test fixture; it is not operational OCE-OPS data.

The accompanying synthetic IFC4 fixture uses known millimetre dimensions and nested
placements to verify metre scaling and orientation independently of visual inspection.
The parser's existing normalization maps IFC `(x, y, z)` to Three.js `(x, z, -y)`.
