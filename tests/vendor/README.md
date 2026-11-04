# Offline test assets

These are **test-only copies of the application's existing pinned dependencies**, not replacement map/model engines or production dependency changes.

- Leaflet 1.9.4, including real JavaScript, CSS and control/marker images.
- proj4 2.11.0.
- Three.js 0.128.0 plus its actual OrbitControls, GLTF, STL and OBJ loaders.
- Font Awesome Free 6.5.2 CSS/fonts and the application's requested Google font responses.

`manifest.json` records the package archive URLs/SHA-512 integrity values, request URLs, file sizes and SHA-256 hashes. Package versions are checked against archive `package.json` files before extraction. Only an explicit asset allowlist is extracted. Package licences and Google font OFL licences are retained. Google CSS/font bytes are a pinned capture of the requested stylesheet response, not a newly selected application font.

The local `.gitattributes` preserves these byte-verified upstream files without line-ending conversion or whitespace rewriting. Application and test-source whitespace checks remain in effect.

Use `OCE_OFFLINE=1` with the existing harness. It verifies every asset before browser launch and fulfills the original external request URLs with those exact bytes. Leaflet and Three objects are real. Only basemap tile imagery is synthetic (the existing deterministic PNG fixture); weather and GitHub requests retain the original synthetic fixtures. Unexpected outbound application requests abort and fail the run. A per-run `offline-environment.json` records asset/router/harness hashes, served requests and unexpected requests. Production source and dependency URLs are untouched.

No download or package install occurs during tests. To reproduce the cache acquisition deliberately, from the repository:

```powershell
./tests/prepare-offline-assets.ps1
node tests/prepare-offline-assets.cjs
node --test tests/offline-assets.test.cjs
```

The first command requires network access and saves the original metadata/archives under ignored `test-results/offline-source/`. The second verifies npm archive integrity and extracts the allowlist; it does not run package scripts. Do not replace files or accept new versions merely to obtain passing tests. Review any manifest/hash change explicitly.

This environment verifies application behaviour without CDN/DNS availability. It does not claim production CDN uptime, real basemap imagery availability, physical-tablet acceptance or native-printer acceptance.
