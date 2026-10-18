# Start here — Orion public technical handbook

**What is Orion?** Orion is a desktop-native AI platform designed to coordinate durable agents, tools, memory, experiments and supervision. It is publicly developed and free to use, with optional voluntary donations via the owner's X presence. **This repository is not an assertion that the complete proposed system is deployed or independently validated.**

## Read in this order
1. [Architecture](ARCHITECTURE.md): the complete system picture and data flow.
2. [Components](COMPONENTS.md): what each major module does, why it exists, who may change it, and its evidence requirements.
3. [Living dictionary and model crosswalk](TERMINOLOGY.md): DT and Orion names in ordinary terms, plus Google/Grok/ChatGPT translations.
4. [Formalism and equations](EQUATIONS.md): carefully scoped engineering equations and historical speculative expressions.
5. [Memory / provenance standard](PROVENANCE.md): historical frozen moments, Perception Points, duplicates, source integrity.
6. [Multi-AI contribution contract](AI_CONTRIBUTIONS.md): contributor identity, branches, manifests, receipts and review.
7. [September–October Git history recovery](GIT_RECOVERY.md): actual local evidence and open remote failures.
8. [Simulation and run standard](SIMULATIONS.md): runnable reference model, reproducibility, and failures.
9. [Source registry](SOURCES.md): primary citations and their verification scope.

## How to interpret status
- **OWNER_REQUIREMENT**: owner explicitly wants this behavior; it may not exist yet.
- **HISTORICAL_SOURCE**: imported statement, code, or record; not necessarily verified.
- **SOURCE_OBSERVED**: actual file/module seen; functionality not automatically verified.
- **ISOLATED_TESTED**: a bounded test executed in isolation and was recorded.
- **STAGED_CANDIDATE**: prepared but not approved or deployed to Orion.
- **LIVE_VERIFIED**: observed operational on the actual relevant runtime during a dated inspection.
- **INDEPENDENTLY_VALIDATED**: a distinct independent empirical or security validation, with methods/results.
- **UNKNOWN/BLOCKED**: missing evidence, permissions, or environmental prerequisite. Preserve the gap.

The current public example under `simulations/` is a **new illustrative reconstruction** written for this documentation, not an imported historic execution.
