# Evidence, perspective and source lifecycle

## Two axes are always separate
1. **Source fidelity:** ORIGINAL, EXACT_COPY, EXPORT, TRANSCRIPT/OCR, RECONSTRUCTION, SUMMARY/INDEX, GENERATED_EXAMPLE.
2. **Execution status:** NOT_RUN, HISTORICAL_REPORTED, RECOVERED_CODE, REPLAYED, ISOLATED_TESTED, STAGED, DEPLOYED_VERIFIED, INDEPENDENTLY_VALIDATED, FAILED_PRESERVED.

A verbatim source can contain a false statement. A later reconstruction can pass tests but not be the historical implementation. An owner requirement is not a runtime observation.

## Perception Point template
Record: `pp_id, source_ids, source_class, event_time, observed_time, timezone, actor_perspective, available_permissions, current_branch, original_question, observation, uncertainty, competing_interpretations, decision, action, test_receipts, residuals, next_task, restriction, hash`.

- **Event time** is when the actor originally acted. **Observed time** is when the record was later recovered.
- Keep the earlier actor's knowledge and permissions frozen. Later discovery becomes a new event linked by `corrects` or `interprets`, never a silent rewrite.
- Keep exact originals untouched. Derive a frozen copy and a working/index copy with distinct identifiers.
- A duplicate Drive mirror is another custody object, not an independent confirming experiment.

## Simple causal graph
```text
Original/source S --copied_to--> Frozen F --derived_to--> Working W
    |                                      |
    +--observed_by--> Actor A at time t   +--indexed_by--> Perception Point P
P --motivated--> Hypothesis H --predicted--> Expected E
E --executed_as--> Run R --yielded--> Outcome O
O --evaluated_by--> Review V --allowed/blocked--> Next task T
```

The graph allows reconstruction of why an agent did something, which evidence it could see then, and which later test disagreed with it.

## Safety/provenance rules
- Record the **source that actually supplied a claim**, even if it was an AI-generated passage forwarded through email.
- When resolving two conflicting sources, preserve both and add a later comparison/reconciliation event.
- Do not infer source equality from matching titles or summaries; byte-level identity requires hashes on actual original bytes.
- No HTML, copied prompt or provider output may define its own authorization.
- Personal records stay in access-controlled stores, even if a public index refers to their existence.
- Prediction and validation must use independently specified criteria where possible; target-derived constraints are not independent discovery.

## Source promotion example
A historical Google numeric solver may be archived as `HISTORICAL_SOURCE`; a cleaned rewrite may be `GENERATED_EXAMPLE`. A passing `python -m unittest` proves only that bounded example tests passed in the tested environment. Nothing here proves a novel physical field, special VRAM isolation, or a functioning Orion release.
