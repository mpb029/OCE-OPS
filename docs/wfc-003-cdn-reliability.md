# WFC-003 closeout: CDN reliability finding

Assessment date: 5 November 2026 (Australia/Brisbane). Production dependency configuration is unchanged by this closeout.

## Observed verification failure

All eight historical Firefox WFC-001 failures stopped at the same harness page-initialization condition. They did not reach their workflow assertions. The separate diagnostic recorded `NS_ERROR_UNKNOWN_HOST` for Leaflet/proj4 and other CDN hosts, followed by `L is not defined`, no rendered panels and no ready board. The OS HTTP request also failed to resolve `unpkg.com`. Those receipts remain under `test-results/wfc-003/firefox-final/` and `firefox-diagnostic/`.

The same application and assertions subsequently passed with the real pinned libraries served from hash-verified local assets. That establishes the dependency/DNS cause of the original initialization blocker. A later recovery-test ordering failure was investigated separately; it was not attributed to DNS or hidden by an automatic retry. Its trace and explicit Save-generation synchronization are documented in `wfc-003.md`.

## Production relevance

This is a genuine **cold-start availability dependency**, inherited from the existing application. The production entry point loads Leaflet from `unpkg.com`; startup calls Leaflet without a local library fallback. If a client can load OCE-OPS but cannot resolve/reach that dependency and has no usable cached copy, startup can fail in the same way. Three.js is also loaded externally, with failures affecting model loading; fonts/icons have their own external dependencies. Version pinning provides compatibility, not availability.

The recorded failure occurred on the verification host. It is **not evidence of a global CDN outage or confirmed production-user incident**. Network access worked again during closeout. No operational-data loss was demonstrated; availability of the application/recovery UI is the concern. Saved data and protected operational files were not modified.

## Bounded disposition

The test environment now routes original asset URLs to verified copies of the exact compatible packages, including real Leaflet/Three libraries and fonts, and rejects unexpected outbound application traffic. This makes verification deterministic; it does not fix production hosting.

A separately authorised reliability task could self-host the pinned critical runtime assets with their licences and add a clear dependency-load failure/recovery message. That work is deferred. This build does not change production dependency URLs, versions, caching, authentication, hosting, publishing semantics or operational data.
