# Public Release Gate â€” 2026-09-18

Release target: additive research/Pages update on current main.

## Gate results
- BL-006 public-file inventory: PASS â€” `PUBLIC_FILE_INVENTORY_2026-09-18.md`.
- BL-007 exact disclosure dates: PASS â€” dates derived from Git first-add history.
- BL-012 dependency licenses: PASS for current replay manifests â€” `docs/DEPENDENCY_LICENSES.md`.
- BL-060 access review: PASS for this release lane â€” managed connector write remains 403; authenticated local Git is the authorized publication path.
- BL-062 secret scan: PASS â€” zero AWS-key, private-key, Windows-profile, Drive-URL, or generic hard-coded secret hits in reviewed public text files.
- BL-066 backup-security review: PASS for public boundary â€” private vault/backup artifacts are not included in this repository or Pages delta.
- BL-071 open-critical-risk review: PASS for this release scope â€” connector 403 and DT Works deployment remain explicit residuals, not hidden as completed.
- BL-100 release dry run: PASS — local HTTP 200 readback for `/`, `updates.html`, `sitemap.xml`, `robots.txt`, `platform/urls.md`, and `DEPENDENCY_LICENSES.md`; sitemap XML parse PASS.
- BL-101 public-summary scan: PASS â€” no private paths/credentials and capability claims retain verified/partial/pending distinctions.
- BL-102 public claim matrix: PASS â€” Desktop 0.3.0 claims are tied to clean build/tests/hash/runtime receipts; literal second-machine and DT Works deployment remain unverified/pending.
- BL-103 published hash log: PASS — remote commits `039da16c...` and corrective `7a66175f...` were read back; Pages workflow `35411157249` completed successfully; public root, updates, sitemap, and dependency-license page returned live HTTP 200 readbacks. See `PUBLISHED_HASH_LOG_2026-09-18.md`.

## Changed-file pre-publication hashes
- `docs/index.html` â€” `B536588A42ECE2A548191E0A73BDAA53327F0F696FE5E0CBEC6D4EC04E34C7BC`
- `docs/updates.html` â€” `FF60137B672DA4491DF0F54D3A2F6E6B09687B8D8F902938880C77CFD708D7E5`
- `docs/sitemap.xml` â€” `034E302548BBA79D149F74FB6F98BFD568BC164DD3D8E81AEE2EFDB71496C0CE`
- `provenance/RECOVERY_STATUS_2026-09-18.md` â€” `8D97D8028C66C3BF72619DDB6B78668755CEEE9552B3EE8E2E90935248E906EB`

## Residual boundaries
The GitHub managed connector still cannot write despite advertised repository permission. The local authenticated Git path is separate and must receive its own push/readback receipt. DT Works remains a separate website deployment lane and is not promoted by this research-site publication.