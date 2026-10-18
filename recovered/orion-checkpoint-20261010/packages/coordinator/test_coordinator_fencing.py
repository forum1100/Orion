from __future__ import annotations
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import coordinator_core as cc


class CoordinatorFencingContractTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "coordinator.db"
        self.db_patch = patch.object(cc, "DB", self.db)
        self.db_patch.start()
        self.c = cc.init_db()

    def tearDown(self):
        self.c.close()
        self.db_patch.stop()
        self.tmp.cleanup()

    def _submit(self):
        return cc.submit_task("demo", {"value": 1}, priority=1)

    def test_claim_returns_current_owner_and_generation(self):
        task_id = self._submit()
        task = cc.claim_task(self.c, "worker-a", ["demo"], lease_seconds=30)
        self.assertEqual(task["task_id"], task_id)
        self.assertEqual(task["claimed_by"], "worker-a")
        self.assertEqual(task["status"], "CLAIMED")
        self.assertEqual(task["claim_generation"], 1)

    def test_stale_owner_cannot_finish_after_reclaim(self):
        task_id = self._submit()
        first = cc.claim_task(self.c, "worker-a", ["demo"], lease_seconds=0)
        time.sleep(0.01)
        second = cc.claim_task(self.c, "worker-b", ["demo"], lease_seconds=30)
        self.assertGreater(second["claim_generation"], first["claim_generation"])
        with self.assertRaises(cc.StaleClaimError):
            cc.finish_task(self.c, "worker-a", task_id, first["claim_generation"], {"stale": True})
        cc.finish_task(self.c, "worker-b", task_id, second["claim_generation"], {"ok": True})
        row = self.c.execute("SELECT status,claimed_by,result FROM tasks WHERE task_id=?", (task_id,)).fetchone()
        self.assertEqual(row["status"], "DONE")
        self.assertEqual(row["claimed_by"], "worker-b")

    def test_stale_owner_cannot_fail_after_reclaim(self):
        task_id = self._submit()
        first = cc.claim_task(self.c, "worker-a", ["demo"], lease_seconds=0)
        time.sleep(0.01)
        second = cc.claim_task(self.c, "worker-b", ["demo"], lease_seconds=30)
        with self.assertRaises(cc.StaleClaimError):
            cc.fail_task(self.c, "worker-a", task_id, first["claim_generation"], "stale")
        row = self.c.execute("SELECT status,claimed_by FROM tasks WHERE task_id=?", (task_id,)).fetchone()
        self.assertEqual(row["status"], "CLAIMED")
        self.assertEqual(row["claimed_by"], "worker-b")


if __name__ == "__main__":
    unittest.main()
