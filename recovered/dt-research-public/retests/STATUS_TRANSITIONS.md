# Retest Status Transitions

Retesting appends successor evidence. It never rewrites the state that was historically recorded.

| From | New evidence | Successor state |
|---|---|---|
| Failed | Reproduction fails the same way | Failure reproduced |
| Failed | Repair makes code run | Software-repaired; claim unvalidated |
| Failed | Synthetic result supports mechanism | Synthetically supported |
| Failed | External data favors prediction | Empirically supported within scope |
| Failed | Independent replication succeeds | Independently replicated within scope |
| Unresolved | Sources remain missing | Provenance unresolved |
| Unresolved | Canonical source recovered | Source recovered; reassess separately |
| Speculative | Dimensional audit fails | Mathematically inconsistent |
| Speculative | Dimensional audit passes | Dimensionally admissible, not validated |
| Any state | Rival explains result equally well | Nondiscriminating |
| Any state | Adjacent predictions are damaged | Locally improved, systemically failed |

## Forbidden transitions

- Code ran → theory proven
- Fit improved → mechanism established
- Historical number recalled → source verified
- AI agreement → independent replication
- Missing failure record → failure never occurred
- New evidence → old record deleted
