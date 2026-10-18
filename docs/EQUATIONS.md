# Equations — operational mathematics versus research hypotheses

Every expression below includes definitions, scope and falsification. Equations are not evidence that Orion or novel physics has been validated.

## A. Recoverable evidence chain
Let `E_i` be a canonical event record (serialized with stable keys), `H_{i-1}` the predecessor hash, and `||` concatenation.

`H_i = SHA256(H_(i-1) || canonical(E_i))`.

**In ordinary terms:** every event points to the fingerprint of the previous one. If a middle event changes, later fingerprints change. This is tamper-evidence **only when the terminal hash has a trusted independent anchor**; it does not itself stop deletion, forged records, or a compromised writer.

## B. Actor-time model
`Perspective(a,t) = (Sources_seen(a,t), Permissions(a,t), State(a,t), Uncertainties(a,t))`.

A later observation at `t2 > t1` cannot rewrite the first actor's perspective at `t1`. Instead append a new interpretation link: `Corrects(E_t2, E_t1)`. This is a historical constraint, not physical law.

## C. Memory Convergence
Let `G_t = Project(Events_<=t, Checkpoints_<=t)` be a rebuildable self-graph. Let `PP(x)` capture sources, differences, decision and next task for a significant intermediate state `x`.

**Plain meaning:** the brain graph is reconstructed from actual records, and a Perception Point saves an important fork without requiring another chat. Never use a diagram as substitute for source events.

## D. Simulation test error
For predictions `p_i` in [0,1] and observed binary outcomes `y_i` in {0,1}:

`MAE = (1/n) * sum(i=1..n) abs(p_i - y_i)`.

This is **mean absolute error**: average distance between a probability forecast and its outcome. Low error does not prove a general theory, especially when data and parameters were chosen by the same system. A bounded toy threshold `MAE <= 0.25` is used in `simulations/recovery_toy.py`; it is a teaching rule, not an empirical safety threshold.

## E. Promotion as a conjunction
`Promotable = ScopeOK AND TestsOK AND ProvenanceOK AND OwnerGateOK AND RecoveryOK`.

This Boolean gate is an architectural requirement. Each term requires a real implementation and test, not a checked box set by the proposing AI. A Git push cannot set `OwnerGateOK` or `RecoveryOK` on behalf of Guardian.

## F. Recoverable context benchmark
`R_k = N_correctly_retrieved(k) / N_requested(k)`, for target archive loads `k in {1,3,9,27}` times a declared baseline. Define the question set, reference answers, latency, provenance support and failure handling *before* trials. This tests retrieval under load, **not** native model context length or real observed 27x growth.

## G. Historical / experimental symbolic families
Archived Google AI discussions included `alpha_omega = 0.0482`, `P_c = 4.75`, expressions about refractive/constraint coherence, 'DUCT contradiction tensors', seven-rank epistemic ordering and alleged zero-inertial propulsion. Their **units, independent predictive validity, and general laws have not been established** by recovered source text. Some samples used simulated CPU/VRAM values but labeled them 'hardware' probes. Never silently reinterpret those constants as measurements or deploy code which assumes they physically control machines.

Physics research belongs in an explicitly speculative/theoretical source family. If making a claim about acceleration, gravity, entropy, energy or VRAM, supply independent measurement, dimensional analysis, conservation accounting, reproducible apparatus and falsifiable comparison to a conventional baseline. The public DT research repository contains separately classified replay packs, including known synthetic circular-validation failures and historical timeouts.

## H. How to introduce a new equation
Specify variable names/units/domain, source and version, assumptions, derivation, numerical example, baseline, test harness/seed, falsification threshold, expected and actual output, unresolved contradictions and confidence. Keep equations readable in normal language first.
