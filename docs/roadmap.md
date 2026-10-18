# Orion public development roadmap

Status: development plan only. These milestones are **not** claims that components are fully implemented or production-validated.

## Stage A — Public research and development baseline
- Publish source-safe architectural overviews for Orion, the protected Guardian, agent lineage, Librarian, Memory Convergence, Perception Points and simulation evidence.
- Inventory historical local source and Drive versions with original hashes and classifications. Explicitly distinguish restored source, later reconstructions, live installations and unverified records.
- Preserve Google Drive's current operational and archive workflows.

## Stage B — Reproducible source and validation
- Introduce selectively reviewed and sanitized source modules, tests, setup instructions and local development scripts.
- Define test fixtures and negative controls for memory retrieval, contradiction detection, agent authority, tool permission denial and stale release candidates.
- Capture command/env/seed/version/inputs/outputs and failures without publishing private logs.

## Stage C — Safe update/promotion system
- Implement source-only change proposals, isolate candidate testing, comparison against the current version, and explicit release/rollback gates.
- Confirm actual Guardian supervision and authorization behavior before using stronger implementation labels.
- Maintain distinct states for documented, implemented, synthetically tested, qualified, training-active and released.

## Stage D — Optional no-surprise automation
- Start with manual local Git commands and documented review steps. GitHub Actions currently disabled.
- Consider automation only after verifying its provider, pricing, token scope, free quota, non-spend guarantee or explicit cost cap and revocation path.
- Any later schedule or bot must remain optional and cannot become the only source of task continuation, memory, or recovery.

## Stage E — Finished development / optional GitHub separation
- Freeze and independently verify source/build and Drive memory backups.
- Remove development-only GitHub tokens, schedules, hooks and remote coupling, then test Orion and Guardian in a GitHub-offline state.
- Preserve the history and distinguish disconnecting integration from retracting public source already published.

**Standing constraints:** Orion remains free with optional donations, Google Drive remains operational, privacy is preserved, and no third-party wrapper can generate unexpected charges.
