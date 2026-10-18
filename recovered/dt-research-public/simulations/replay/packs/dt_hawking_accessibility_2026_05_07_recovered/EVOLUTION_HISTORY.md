# Evolution History — DT Hawking Accessibility Toy Simulation

Status: `RECOVERED_CAUSAL_RUN_HISTORY`

This file preserves why each historical run changed. A later successful run does not replace the failed or weak run that caused the change.

## Run 1 — initial horizon leakage model
Historical run: `91ffca24-4e9b-4674-8a58-5b5d804b131b`

The first model produced escaped and absorbed flux proxies, but outside persistence memory saturated at the hard maximum (`5.0`) and 100% of the outside grid retained persistent signal. The contemporaneous assistant interpretation explicitly identified over-stabilization and proposed a stricter run with weaker memory feedback.

This run therefore remains evidence of a failure mode: excessive persistence feedback can manufacture a clean-looking leakage pattern by saturating the state rather than discriminating dynamics.

## Run 2 — explicit DT ablations
Historical run: `c11600f4-705a-4b98-a20d-f1cc7248ae6a`

The model introduced ablations for the void term, persistence threshold, and `S+V` transparency term. The outputs saturated badly: all four variants reached the same escaped-flux ceiling (`219`) and the same outside-persistence mass (`300`). That made escaped flux non-discriminating even though other diagnostics differed.## Run 3 — stricter anti-saturation model
Historical run: `b6c20fe8-3ad4-4efa-9e17-4a8321ca4c37`

The stricter revision weakened memory/persistence gain, reduced diffusion and fluctuation amplitude, increased the threshold, and lowered state clipping. This successfully removed the earlier saturation, but it overcorrected in the opposite direction: the Full-DT model produced zero emitted horizon events and nearly zero final escaped flux, while removing the threshold produced runaway persistence (`63.35` escaped-flux proxy).

This run therefore exposed the next constraint: the threshold was suppressing the modeled event process too aggressively, while no threshold allowed uncontrolled growth.

## Run 4 — threshold/fluctuation retuning
Historical run: `4d5501e1-d8f0-4692-9a36-30dfc4f3331e`

The historical code changed `gamma0` from `0.08` to `0.018`, increased fluctuation amplitude from `0.028` to `0.05`, and raised persistence gain from `0.015` to `0.02`. The resulting Full-DT run produced nonzero event/leakage proxies without returning to the original global saturation regime.

The ablations remained essential: removing the threshold still produced runaway outside persistence, removing the void term changed absorption to zero, and removing `S+V` transparency sharply reduced escaped flux.

## Interpretation boundary
These changes are evidence about the behavior of this toy model, not evidence that DT explains Hawking radiation physically. The scientific next step would be recovering known GR/QFT scaling and horizon thermodynamics before treating any DT-specific residual as meaningful.