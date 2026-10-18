import tempfile, time, unittest
from pathlib import Path
import coordinator_core as core
import spark_window as sw

class SparkWindowTests(unittest.TestCase):
    def setUp(self):
        self.td = tempfile.TemporaryDirectory()
        self.old = core.DB
        core.DB = Path(self.td.name) / 'c.db'
        sw.init_spark_windows()
    def tearDown(self):
        core.DB = self.old
        self.td.cleanup()
    def test_duplicate_owner_excluded(self):
        c=core.init_db(); sw.init_spark_windows(c)
        a=sw.claim_spark_window(c,'Completion','T',100,200,'A',60)
        b=sw.claim_spark_window(c,'Completion','T',100,200,'B',60)
        self.assertEqual(a['fencing_token'],1); self.assertIsNone(b); c.close()
    def test_expired_reclaim_fences_old_owner(self):
        c=core.init_db(); sw.init_spark_windows(c)
        a=sw.claim_spark_window(c,'Completion','T',100,200,'A',0.01); time.sleep(0.03)
        b=sw.claim_spark_window(c,'Completion','T',100,200,'B',60)
        self.assertEqual(b['fencing_token'],2)
        self.assertFalse(sw.heartbeat_spark_window(c,'Completion','T',100,'A',1))
        self.assertTrue(sw.heartbeat_spark_window(c,'Completion','T',100,'B',2,cursor='x')); c.close()
    def test_restart_reconstructs_cursor_and_release(self):
        c=core.init_db(); sw.init_spark_windows(c)
        a=sw.claim_spark_window(c,'Librarian','T',100,200,'A',60)
        self.assertTrue(sw.heartbeat_spark_window(c,'Librarian','T',100,'A',a['fencing_token'],cursor='CUR'))
        c.close(); c=core.init_db(); row=sw.active_window(c,'Librarian','T',100)
        self.assertEqual(row['cursor'],'CUR')
        self.assertTrue(sw.release_spark_window(c,'Librarian','T',100,'A',a['fencing_token'],'DONE'))
        self.assertEqual(sw.active_window(c,'Librarian','T',100)['state'],'RELEASED'); c.close()

if __name__ == '__main__': unittest.main()
