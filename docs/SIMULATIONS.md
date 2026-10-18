# Simulations, runnable examples and run evidence

**Rule:** code, parameters, predicted results, actual output and failures all belong together. A claim `replayed` needs exact source or a clearly identified reconstruction and a verifiable execution receipt.

## Example included in this repository
`simulations/recovery_toy.py` is a **new teaching model** that scores two hypothetical prediction branches and stores the failed branch rather than deleting it. It models a small part of prediction -> execution -> validation -> residual preservation. It is not a copy of historical Orion software and does not claim to implement the entire Perception Points or upgrade pipeline.

Run locally (no network, no paid service):
```powershell
python simulations/recovery_toy.py
python -m unittest discover -s tests -v
```

The program emits JSON, including code-independent input records, expected outcomes, error calculation, status and SHA-256 of the canonical input block. Store actual output under `runs/` with Python version and execution date. A generated run must be compared to the checked-in known example before a replay claim.

## Source preservation template
Each **real** run needs: unique run ID; claimed origin (model/provider/person); code commit/ref and exact source hash; whether verbatim source or later rewrite; environment/dependencies; RNG seed; fixed input and dataset origin; pre-execution hypothesis; command; timestamp; stdout/stderr/exit code; duration; output hashes; tests; failures; reproduction instructions; evidence classification; privacy classification; independent review state; residuals.

A timeout is not silently converted to a success. A historical claim that code ran is not a current executable receipt. A positive toy test does not establish physical or social science.

## Research repository relationship
The separate [Distel Theory Research replay registry](https://github.com/forum1100/Distel-Theory-Research/blob/main/simulations/replay/registry.json) catalogues **nine** simulation families with mixed status. Examples include recovered historical code, derived synthetic history and partial runs/timeouts. Orion may link to these families as external research inputs; do not copy claims without retaining the original source class and failures.

## Historical Orion branch classification
`d6a4448` and other local Git SHAs are source-history references, not automatically simulation-run IDs. Their tests require separate environment-specific verification. Avoid making new synthetic outputs look like October historical run receipts.
