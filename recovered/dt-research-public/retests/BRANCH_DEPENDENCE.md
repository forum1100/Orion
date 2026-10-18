# Relational Branch-Dependence Protocol

A branch can fail alone yet become meaningful when paired with a necessary neighbor. Conversely, an apparently successful branch can disappear when an adjacent dependency is removed.

## Minimal test set

For candidate branches (A), (B), and (C), freeze outcome measure (O) and compare:

[
O(A), O(B), O(C), O(A+B), O(A+C), O(B+C), O(A+B+C).
]

Interaction residual:

[
Delta_{AB}=O(A+B)-O(A)-O(B).
]

Then perform absence tests by removing one branch from each previously successful combination.

## Required classifications

- independently sufficient
- conditionally useful
- mutually reinforcing
- suppressive or interfering
- necessary neighbor
- redundant
- unresolved
- failed under recorded conditions

Report uncertainty, multiple-comparison controls, negative results, and any change to downstream topology. Do not use brute-force enumeration as the primary discovery method; select the smallest discriminating combinations from the causal model.
