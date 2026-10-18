# RT-BBN-001 — AlterBBN Successor Execution 2026-09-08

**Status:** executed computational successor test; not cosmology validation.

AlterBBN v2.2 was recovered from the historical archive, hashed, compiled from an untouched source copy, and executed on a separate build copy with GCC 16.2.0 / GNU Make 4.4.1.

Recovered AlterBBN archive SHA-256:
`46B94253CDE6AFCE15DDB9367FA454BAC91B25C9A1D3412CC19E512EC3515C17`

Stock failsafe=1 central output:
- Yp = 2.472892431214e-01
- D/H = 2.434823987112e-05
- He3/H = 1.031143037369e-05
- Li7/H = 5.466171494978e-10
- Li6/H = 1.072668319169e-14
- Be7/H = 5.179861834299e-10

The stock executable reported compatibility with its bundled BBN constraints with and without correlations. AlterBBN adds Be7 to Li7 post-BBN, so the printed Li7/H is the relevant final mass-7 quantity for this test.

Baseline execution record SHA-256:
`DCF209C517DC2C71C916D00BE20B752EABE0F793D00B86DA084DAD640827CFBD`

## Historical source provenance clarification — 2026-09-10

TJ identified the historical source used for the BBN numbers as the **AlterBBN homepage on HEPForge**, supplied through this Google share redirect: https://share.google/StTp4jHxKcGg4WRp5. This is preserved as a user-supplied provenance pointer. The redirect was not directly fetchable in the current web environment, so this note does not by itself prove the exact historical page revision or exact numerical run configuration. The independently recovered AlterBBN v2.2 archive and the reproduced stock execution above remain the stronger executable evidence for the numerical baseline.

## Local +10% sensitivity screen

Rate perturbations were applied one channel at a time in isolated source copies. Largest Li7/H responses were:
- R27, He3+He4 -> Be7: +9.7794%
- R17, Be7+n -> p+Li7: -6.2270%
- R60, Be7+He4 -> C11: +0.0885%
- R34, Be7+D -> p+2He4: -0.0861%

R19, R42, R49, and the R14 adjacent control each changed Li7/H by less than 0.07% in this screen.

This identifies R17 and R27 as the dominant tested local mass-7 levers. It does not establish that a 10% rate change is experimentally allowed.

## Preregistered relational triad

Before execution, three bounded mechanism probes were frozen:
- A: R17 x1.20
- B: R27 x0.80
- C: R34 x1.20

All singles, pairs, and A+B+C were then executed. Li7/H changes were A -11.5453%, B -20.2220%, C -0.1721%, AB -29.6204%, AC -11.6801%, BC -20.3595%, and ABC -29.7280%.

AB was 2.147 percentage points less suppressive than simple addition of isolated fractional effects; ABC was 2.211 points less suppressive than the isolated-effect sum. The tested combination was mildly sub-additive, not synergistically reinforcing.

## Successor decision

The strongest tested A+B+C case produced Li7/H = 3.841190679596e-10. Applying the historical 0.292 survival factor to the reproduced stock baseline would require approximately 1.596122076534e-10.

Therefore the tested modest local-rate mechanism does not reproduce the historical DT suppression target, and the relational combination did not reveal hidden amplification.

**Successor status:** `[LOCAL MASS-7 RATE-ADJUSTMENT MECHANISM WEAKENED]`.

This does not erase the historical DT-BBN branch and does not falsify every possible DT-BBN formulation. A surviving successor must independently derive a physical operator or justified reaction-rate change, preserve neighboring abundances, and survive external observational and nuclear-rate constraints.

AlterBBN's README requires citation of the Arbey et al. AlterBBN papers if the software is used in a paper. The separate historical memory of an external BBN dataset requiring both citation and provider notification remains provenance-unresolved and is not attributed to AlterBBN.
