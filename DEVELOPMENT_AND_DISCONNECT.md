# Dual-channel development and eventual GitHub disconnection

Status: operating policy adopted 18 October 2026; implementation and end-to-end synchronization still require validation.

## Responsibilities

- **Local Orion/Guardian**: protected authority, agent orchestration, task execution, local source, evaluation, rollback and release gating.
- **Google Drive**: durable memory, Memory Convergence, Perception Points, append-only source and execution records, simulation evidence, checkpoints, agent identity archives, lineage and recovery.
- **GitHub**: public development source, reviewable changes, branches, tests, documentation, issue coordination and published releases when authorized.

Neither a GitHub push nor a Drive upload is evidence of successful runtime deployment. Preserve executable hashes, versions, test commands, artifacts and failure/residual records.

## Personal-information boundary

Before publishing, inspect tracked, untracked and historical files for secrets, private personal or family data, third-party protected material, credential-bearing URLs, logs containing access tokens, and sensitive embedded contents. Exclude or redact **before first public commit**. An ignored file can still be published if explicitly added; .gitignore is not a security boundary. Content accidentally pushed to a public repository may remain in caches, clones and git history.

The owner has authorized publishing proprietary Orion engineering and research; being proprietary is not itself a reason to withhold it. Personal/private data requires separately scoped authorization and must not be assumed safe merely because the code is public.

## Current integration state

This repository establishes the public publishing policy only. It does **not** assert that Orion has automatic GitHub sync, deploy hooks, access tokens, webhooks, or finished source mirroring. Do not create a second Orion process, alter Guardian pins, or replace Google Drive custody merely to enable GitHub publishing.

## GitHub removal after Orion development

1. Verify a complete, separately accessible source snapshot and reproducible build/rollback evidence outside GitHub.
2. Verify Google Drive retention, source links, historical simulation receipts, agent identities, Perception Points and recovery procedures independently of GitHub.
3. Disable any GitHub mirror/push schedule, webhook, external token, connector, CI secret or runtime dependency; revoke access from the relevant provider.
4. Test Orion startup, source custody, agent continuity, backups and recovery while GitHub is inaccessible.
5. Preserve a dated disconnect decision, revocation receipts and unresolved residuals. Do not erase history or lose existing branch provenance.

Disconnecting GitHub access does not remove public copies, earlier clones, forks or content distributed while the repository was public. The user must separately decide whether public hosting should continue after development.
