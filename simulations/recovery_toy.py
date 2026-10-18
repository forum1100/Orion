"""Orion documentation-only reference simulation; newly authored, NOT historical runtime code.

The two branches share a fixed public toy observation set. Predictions are scored
with mean absolute error; the failed branch remains in output and no branch
acquires agent/security authority. Only Python's standard library is used.
"""
from __future__ import annotations

import hashlib
import json
import sys
from typing import Any

MODEL_ID = "orion-provenance-prediction-toy-v1"
THRESHOLD = 0.25

# Toy observations, not measured Orion telemetry, user's data or an actual
# scientific field dataset. Keep them distinct from all historical claims.
OBSERVATIONS = (1, 0, 1, 1)
PREDICTIONS = {
    "candidate_biased": (0.90, 0.80, 0.10, 0.20),
    "candidate_calibrated": (0.90, 0.20, 0.80, 0.90),
}


def stable_sha256(value: Any) -> str:
    """Fingerprint a canonical JSON representation of an evidence object."""
    canonical = json.dumps(value, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def mean_absolute_error(predictions: tuple[float, ...], outcomes: tuple[int, ...]) -> float:
    """Average absolute forecast error, not a physical constraint."""
    if not outcomes or len(predictions) != len(outcomes):
        raise ValueError("Nonempty, equal-length predictions and outcomes required")
    if any(not 0.0 <= p <= 1.0 for p in predictions):
        raise ValueError("Forecasts must be probabilities from 0 to 1")
    if any(y not in (0, 1) for y in outcomes):
        raise ValueError("Outcomes must be binary")
    return sum(abs(p - y) for p, y in zip(predictions, outcomes)) / len(outcomes)


def run() -> dict[str, Any]:
    """Return self-contained, deterministic toy predictions and dispositions."""
    evidence = {
        "observations": list(OBSERVATIONS),
        "predictions": {name: list(values) for name, values in PREDICTIONS.items()},
        "threshold": THRESHOLD,
        "source_class": "GENERATED_TOY_EXAMPLE",
    }
    branches = []
    for name, predictions in PREDICTIONS.items():
        error = round(mean_absolute_error(predictions, OBSERVATIONS), 8)
        status = "ISOLATED_TOY_PASS" if error <= THRESHOLD else "FAILED_PRESERVED"
        branches.append({
            "branch_id": name,
            "prediction": list(predictions),
            "outcomes": list(OBSERVATIONS),
            "mae": error,
            "status": status,
            "deployment_status": "NOT_DEPLOYED",
            "note": "Toy metric only; cannot prove an Orion or scientific safety result.",
        })
    return {
        "model_id": MODEL_ID,
        "source_class": "NEW_DOCUMENTATION_RECONSTRUCTION",
        "historical_execution": False,
        "independent_validation": False,
        "evidence_sha256": stable_sha256(evidence),
        "equation": "MAE = sum(abs(prediction_i - observed_i)) / n",
        "input": evidence,
        "branches": branches,
        "residuals": [
            "Toy observations and forecasts were manually selected.",
            "No external dataset, independent test or live Orion integration.",
        ],
    }


if __name__ == "__main__":
    print(json.dumps(run(), indent=2, sort_keys=True))
