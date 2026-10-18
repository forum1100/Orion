# Recovery Status — 2026-09-18

Source class: DERIVED PUBLIC-SAFE STATUS RECORD
Canonicality: additive public record; does not replace underlying receipts

## DT Desktop Suite 0.3.0

VERIFIED — DT Desktop Suite 0.3.0 was reproduced from a clean source copy using `npm ci`, passed 75/75 tests, and produced both portable and NSIS Windows artifacts.

VERIFIED — Dependency review after upgrading Electron to 44.4.3 reports zero npm audit vulnerabilities. The desktop renderer remains isolated with context isolation enabled, Node integration disabled, and sandboxing enabled.

VERIFIED — Portable SHA-256: `4EA02C7DE0B4160C0C98F01AF05BDC06D6AD29EA29264615185E89055039039C`. The owner-controlled Programs copy was replaced with those exact bytes after preserving the previous executable.

VERIFIED — Cold startup from the installed Programs path returned the local gateway at `127.0.0.1:11740`. The vault recorded runtime version `0.3.0` and produced verified automatic recovery exports for prior dirty sessions.

VERIFIED — The DT Desktop Suite source was published to `forum1100/DT-Desktop-Suite` main at commit `9b3c0c6`.

PARTIAL — Fresh-profile / clean-source reproduction passed on CoffeeMaker3737. A literal second physical clean Windows machine has not yet supplied an independent receipt.

FAILED BRANCH PRESERVED — The 0.3.0 NSIS installer built successfully, but one silent `/S` installation attempt returned exit code 128. The verified portable Programs replacement remains the working installation lane; the failed installer attempt is not rewritten as success.

## Public research publication

VERIFIED — The public research repository was current at main `a604b210455b83df722e05ab0a7edfe6f0be1826` before this update. The managed GitHub connector again returned HTTP 403 when asked to create a branch despite reporting repository push/admin permissions, so connector write access remains blocked.

CURRENT ACTION — This status update is being published through the authenticated local Git path on CoffeeMaker3737 without force-replacing history.

## DT Works website

PENDING LIVE DEPLOYMENT — Website source/candidate work remains separate from the desktop and public research repository. A new ChatGPT Sites deployment receipt and live readback are still required before declaring the DT Works website synchronized with this 0.3.0 desktop release.