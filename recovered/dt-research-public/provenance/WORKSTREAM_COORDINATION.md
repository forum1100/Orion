# Concurrent Workstream Coordination

This repository may be updated by multiple authorized ChatGPT work sessions through the same computer. Coordination occurs through committed files, not by controlling another session's terminal.

## Safe handoff rules

1. Fetch and inspect status before editing.
2. Use a distinct new path whenever practical.
3. Never stage with an unrestricted `git add --all` while another workstream is active.
4. Stage only completed, named files.
5. Commit one coherent evidence batch at a time.
6. Push immediately after local verification.
7. If the remote advanced, preserve both versions and reconcile explicitly.
8. Never edit protected Drive sources.
9. Never infer that another workstream finished merely because a process exists.
10. Record gaps rather than silently completing missing source material.

## Source classes

- CANONICAL_SOURCE
- SOURCE_FAITHFUL_EXTRACT
- DERIVED_RECONSTRUCTION
- NEW_RESEARCH
- HISTORICAL_CLAIM_UNVERIFIED
- PROVENANCE_UNRESOLVED

## Active queue

| Priority | Work item | Dependency |
|---|---|---|
| 1 | Import exact 40-equation ledger | Canonical ingestion handoff |
| 2 | Recover five historical Python executables | Source files and hashes |
| 3 | Preserve four failing runs and separate repair | Executables and stdout |
| 4 | Identify official BBN dataset and terms | Canonical download/notice record |
| 5 | Reproduce C-vector positive control | Original inputs, seed, environment |
| 6 | Execute pair/triad/absence tests | Recovered or new labeled implementation |
| 7 | Add visual equation narratives | Reconciled formulas and status |
| 8 | Build GitHub Pages research interface | Stable public content map |
