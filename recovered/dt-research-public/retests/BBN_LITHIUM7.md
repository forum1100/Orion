# RT-BBN-001 â€” Lithium-7 Surrogate Retest

**Scientific status:** theoretical candidate; historical toy calculation; not cosmology validation.

## Preserved historical claim

A surrogate calculation used a baseline abundance of (5.38\times10^{-10}) and a suppression factor (e^{-1.23}\approx0.292), yielding approximately (1.57\times10^{-10}).

The original integral did not independently reproduce (\Xi_\gamma=1.23). A corrected (q_\gamma) was therefore required. That correction is part of the failure history, not a validated derivation.

## Frozen retest requirements

1. Recover the exact original source, code, constants, and output.
2. Reproduce the historical result without silently repairing it.
3. Record the failing integral and corrected branch separately.
4. Derive or explicitly parameterize (\Xi_\gamma); do not fit it after observing the target.
5. Integrate through a recognized BBN solver such as AlterBBN.
6. Compare lithium and all other predicted abundances with accepted observational datasets.
7. Reject the candidate if improvement in lithium damages other abundances beyond preregistered tolerances.
8. Preserve numerical failures, nulls, sensitivity results, and competing explanations.

## Historical numerical-source provenance

User clarification on 2026-09-10: the BBN numbers used in the historical work were taken from the **AlterBBN homepage on HEPForge**, shared as https://share.google/StTp4jHxKcGg4WRp5. Preserve that source pointer separately from the later DT suppression operator and from observational abundance targets. The precise historical page revision/run configuration remains to be matched against the archived AlterBBN source and outputs.

## Current successor state

Stock AlterBBN v2.2 has now been recovered, compiled, and executed on the current host. A source-isolated mass-7 rate sensitivity screen and preregistered R17/R27/R34 triad were also executed; see [AlterBBN Successor Execution 2026-09-08](BBN_ALTERBBN_EXECUTION_2026-09-08.md).

The modest local rate-adjustment mechanism is weakened: the strongest preregistered triad reduced Li7/H by about 29.7%, far short of the historical 70.8% suppression target, and showed mild sub-additivity rather than relational amplification.

Remaining blockers are a first-principles DT operator or independently justified reaction-rate modification, observational-data reconciliation, full uncertainty/likelihood analysis, and recovery of the separate official dataset whose citation/notification terms remain unresolved.