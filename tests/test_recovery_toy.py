"""Local deterministic checks; examples only, no Guardian/live authority."""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from simulations.recovery_toy import (OBSERVATIONS, PREDICTIONS,
                                      mean_absolute_error, run, stable_sha256)


class ToyModelTest(unittest.TestCase):
    def test_known_scores(self):
        self.assertAlmostEqual(mean_absolute_error(PREDICTIONS["candidate_biased"], OBSERVATIONS), 0.65)
        self.assertAlmostEqual(mean_absolute_error(PREDICTIONS["candidate_calibrated"], OBSERVATIONS), 0.15)

    def test_failing_branch_is_preserved(self):
        result = run()
        self.assertEqual([b["status"] for b in result["branches"]],
                         ["FAILED_PRESERVED", "ISOLATED_TOY_PASS"])
        self.assertEqual(len(result["branches"]), 2)
        self.assertTrue(all(b["deployment_status"] == "NOT_DEPLOYED"
                            for b in result["branches"]))

    def test_deterministic_receipts(self):
        first = run()
        self.assertEqual(first, run())
        self.assertEqual(len(first["evidence_sha256"]), 64)
        self.assertFalse(first["historical_execution"])

    def test_rejects_invalid_inputs(self):
        cases = [((), ()), ((0.5,), (1, 0)), ((2.0,), (1,)), ((0.5,), (2,))]
        for p, y in cases:
            with self.assertRaises(ValueError):
                mean_absolute_error(p, y)

    def test_schema_and_manifest_are_valid_json(self):
        base = Path(__file__).resolve().parents[1]
        schema = json.loads((base / "schemas" / "contribution.schema.json").read_text(encoding="utf-8-sig"))
        manifest = json.loads((base / "contributions" / "EXAMPLE.json").read_text(encoding="utf-8-sig"))
        self.assertEqual(schema["type"], "object")
        self.assertTrue(set(schema["required"]).issubset(manifest))
        self.assertEqual(manifest["provider"], "illustrative")

    def test_source_hash_changes_on_modified_input(self):
        self.assertNotEqual(stable_sha256({"x": 1}), stable_sha256({"x": 2}))


if __name__ == "__main__":
    unittest.main()
