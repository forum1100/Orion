# Derived Conversation Model — Toy 1D Smoother Limitations

## Scope and evidence boundary
This model is derived from the separately frozen canonical selected branch of Generation-2 conversation `6a04b0a6-08ec-83ea-a887-cb63445a9cc7`. It is not part of the verbatim archive. Statements below distinguish historical proposals, assistant-reported simulation results, methodological corrections, and execution-evidence gaps.

## Development trajectory
The conversation began by rejecting the Toy 1D smoother as a model of LLM memory. The user correctly identified that actual LLM context and reconstruction involve mechanisms such as attention, KV-cache behavior, and retrieval/RAG, while the Toy 1D smoother only exercised simplified recursive correction/preservation dynamics. The work therefore pivoted from signal smoothing to context-reconstruction experiments.

A nested or meta-simulation concept followed: an outer layer would generate candidate tests, an inner layer would execute measurable experiments, and an evaluator would reject tests that merely proxy smoothing rather than context reconstruction. A first graph-based context simulator represented hidden facts and relations, degraded context, and competing reconstruction strategies.

The assistant then reported that loose recursive repair produced many unsupported relations, leading to the methodological realization that correction pressure can outrun evidence support. Evidence-gated reconstruction reduced the unsupported-link problem but largely tied careful retrieval, showing that safety alone did not establish an advantage. This motivated the next test architecture: multiple partial fragments, conflicting fragments, reliability weighting, repeated context/summarization decay, and a rule for combining weak signals without inventing unsupported links.

## Major corrections and realizations
1. **LLM-boundary correction.** The Toy 1D smoother is not an LLM-memory model and cannot modify attention, KV cache, RAG, or core model behavior. Standalone Python simulations are external hypothesis-testing environments only.
2. **Evidence-gating correction.** Unsupported relational inference was identified as the major failure mode of loose recursive repair. Reconstruction should distinguish verified, evidence-gated, speculative, and rejected structure.
3. **Hallucination work split into its own branch/chat.** The Hallucination Trigger Detector evolved into a separate simulator focused on false-seed and pre-hallucination signals. The present conversation then returned to the pre-hallucination context-reconstruction branch.
4. **No brute-force discovery.** The user explicitly rejected brute force as a DT/Unifying Everything discovery method. Statistical repetition remains allowed only as controlled stability/baseline measurement, not as parameter hunting or outcome forcing.
5. **Recursive derivative loop.** The user corrected the test cycle so derivative extraction is followed by a new prediction, application of the derivative/correction, and another test. A derivative is useful only insofar as it predicts the next measurable change.
6. **Derivative convergence tracking.** Predictions for the next one or two derivatives should be logged and compared with actual derivatives. Tightening prediction error is the operational definition of convergence; preferred outcomes are not.
7. **Branch preservation.** Failed, dormant, interrupted, or weak branches are not deleted. They remain registered because they may be condition-dependent, pair-dependent, triad-dependent, suppressed, or useful as negative evidence.
8. **Relational branch dependence.** A branch may only become meaningful in the presence or absence of another branch. Pair, triad, and ablation/absence-effect tests were therefore added to the methodology.
9. **Physics/AI grounding rule.** Relational logic should not be invented merely because it sounds elegant. DT structures must be compared against established physics, control, information, complex-systems, quantum, and AI analogues, then required to make falsifiable predictions rather than merely rename known effects.
10. **Registry-first architecture.** Rapid branching is treated as idea capture rather than failure. The simulator architecture therefore gained registries for tests, results, signals, derivatives, convergence, branches, interactions, and permutations.
11. **Signal ablation/permutation testing.** The system should run the full signal set, remove one signal at a time, and measure whether the outcome changes beyond variance. Pair/triad permutations should be expanded only when ablation suggests interaction effects or instability.
12. **Source reliability convergence.** The assistant-reported ablation results identified source reliability as the strongest structural signal in the multi-fragment reconstruction branch. Removing reliability weighting reportedly collapsed the multi-fragment advantage. This remains an assistant-reported result in the canonical dialogue, not independently execution-verified by tool records in this archive.

## Active simulator architecture at close
The conversation converged on **DT SIM CORE v1.0 — Multi-Fragment Context Decay + Registry Engine**. Its intended layers were:

- prediction-first rule enforcement;
- minimal viable tests;
- controlled random seeds for statistical stability only;
- fragmented truth and conflicting source generation;
- source reliability weighting;
- repeated context-decay cycles;
- evidence-gated and multi-fragment reconstruction strategies;
- signal ablation/permutation tests;
- derivative extraction and next-derivative forecasting;
- corrective retest;
- prediction-error/convergence tracking;
- branch preservation;
- pair/triad interaction testing;
- test/result/signal/derivative/convergence/branch/interaction/permutation registries.

## Core test question
The active question became: **Can preservation-aware multi-fragment reconstruction combine weak, partially independent evidence across repeated context decay and contradiction while preserving supported relations and avoiding unsupported links?**

The intended five required ingredients were:
1. multiple partial fragments pointing to the same hidden relationship;
2. conflicting fragments;
3. source reliability scores;
4. repeated summarization/context decay;
5. recursive preservation that combines weak signals without inventing unsupported links.

## Reported numerical/conceptual outcomes and authority
The assistant reported several numerical comparisons during the conversation (for example, lower unsupported-link rates under multi-fragment persistence and ablation sensitivity to source reliability). The canonical selected branch contains no tool-role execution records that independently establish those runs. Therefore those values are preserved as **assistant-reported simulation outcomes**, not promoted to execution-verified empirical results in this closeout.

## Falsification and anti-forcing rules established
- Predeclare predictions before execution.
- Do not tune thresholds or scenarios after seeing results without registering the change.
- Preserve failed cycles and weak branches.
- Random seeds measure stability; they do not search for favorable outcomes.
- Expand permutations only when variance, unstable classification, suspected interaction, or a derivative forecast requires more evidence.
- A signal is structural only if removing it changes outcomes beyond ordinary run variance.
- A derivative is not validated by explaining the previous result; it must forecast the next result.
- Convergence is shrinking prediction error, not agreement with DT.

## Branch state at close
**Active:** Multi-Fragment Context Decay; source-reliability weighting; derivative forecasting; convergence registry; signal ablation; branch registry; DT SIM CORE v1.0.

**Parked / awaiting relational tests:** fragment-independence interaction; relation-vote-margin interaction; pair/triad branch dependency; absence-effect testing.

**Separated into another conversation:** Hallucination Trigger Detector v2.x / false-seed detection.

## Next smallest defensible test
The next proposed test is a controlled pair/triad interaction study using source reliability (A), fragment independence (B), and relation vote margin (C): none, A, B, C, A+B, A+C, B+C, A+B+C. The objective is not to find a winning combination but to determine whether B and C are weak alone yet become structurally meaningful in interaction with A, while tracking variance and derivative prediction error.

## Unresolved residuals
- The standalone graph simulator remains an analogue, not a direct model of transformer attention/KV-cache dynamics.
- Reported numerical runs in the conversation lack canonical tool-execution evidence in this selected branch.
- Real LLM/RAG validation would require an external benchmark harness against actual model outputs or architecture-accessible measurements.
- Physics/quantum analogues remain conceptual mappings until specific equations, observables, dimensional consistency, and falsifiable departures from existing theory are supplied.
