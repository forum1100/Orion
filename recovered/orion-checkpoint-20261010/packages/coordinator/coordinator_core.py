from __future__ import annotations
import json, os, sqlite3, time, uuid, socket, hashlib
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
DB = ROOT / "state" / "coordinator.db"
STATE = ROOT / "state"
LOGS = ROOT / "logs"
INBOX = ROOT / "inbox"
OUTBOX = ROOT / "outbox"
for p in (STATE, LOGS, INBOX, OUTBOX):
    p.mkdir(parents=True, exist_ok=True)

def utcnow():
    return datetime.now(timezone.utc).isoformat()

def conn():
    c = sqlite3.connect(DB, timeout=30, isolation_level=None)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA synchronous=FULL")
    return c

def init_db():
    c = conn()
    c.executescript('''
    CREATE TABLE IF NOT EXISTS workers(
      worker_id TEXT PRIMARY KEY, role TEXT, capabilities TEXT,
      pid INTEGER, host TEXT, last_heartbeat TEXT, status TEXT);
    CREATE TABLE IF NOT EXISTS tasks(
      task_id TEXT PRIMARY KEY, task_type TEXT, payload TEXT,
      priority INTEGER, status TEXT, created_at TEXT, updated_at TEXT,
      claimed_by TEXT, lease_until REAL, attempts INTEGER DEFAULT 0,
      claim_generation INTEGER NOT NULL DEFAULT 0, result TEXT, error TEXT);
    CREATE TABLE IF NOT EXISTS events(
      event_id TEXT PRIMARY KEY, ts TEXT, worker_id TEXT,
      event_type TEXT, task_id TEXT, data TEXT,
      prev_hash TEXT, event_hash TEXT);
    CREATE INDEX IF NOT EXISTS idx_tasks_status_type
      ON tasks(status, task_type, priority);
    ''')
    cols = {r['name'] for r in c.execute('PRAGMA table_info(tasks)')}
    if 'claim_generation' not in cols:
        c.execute('ALTER TABLE tasks ADD COLUMN claim_generation INTEGER NOT NULL DEFAULT 0')
    return c

class StaleClaimError(RuntimeError):
    pass

def append_event(c, worker_id, event_type, task_id=None, data=None):
    prev = c.execute("SELECT event_hash FROM events ORDER BY rowid DESC LIMIT 1").fetchone()
    prev_hash = prev[0] if prev else "GENESIS"
    body = json.dumps({"ts": utcnow(), "worker": worker_id, "type": event_type,
                       "task": task_id, "data": data or {}, "prev": prev_hash}, sort_keys=True)
    event_hash = hashlib.sha256(body.encode()).hexdigest()
    c.execute("INSERT INTO events VALUES(?,?,?,?,?,?,?,?)",
              (str(uuid.uuid4()), utcnow(), worker_id, event_type,
               task_id, json.dumps(data or {}, sort_keys=True), prev_hash, event_hash))
    return event_hash

def submit_task(task_type, payload, priority=100):
    c = init_db()
    task_id = str(uuid.uuid4())
    now = utcnow()
    c.execute("INSERT INTO tasks(task_id,task_type,payload,priority,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
              (task_id, task_type, json.dumps(payload), int(priority), "PENDING", now, now))
    append_event(c, "local-submit", "TASK_SUBMITTED", task_id, {"task_type": task_type, "priority": priority})
    c.close()
    return task_id

def heartbeat(c, worker_id, role, capabilities, status="IDLE"):
    c.execute('''INSERT INTO workers(worker_id,role,capabilities,pid,host,last_heartbeat,status)
                 VALUES(?,?,?,?,?,?,?) ON CONFLICT(worker_id) DO UPDATE SET
                 role=excluded.role, capabilities=excluded.capabilities, pid=excluded.pid,
                 host=excluded.host, last_heartbeat=excluded.last_heartbeat, status=excluded.status''',
              (worker_id, role, json.dumps(capabilities), os.getpid(), socket.gethostname(), utcnow(), status))

def claim_task(c, worker_id, capabilities, lease_seconds=300):
    now = time.time()
    c.execute("BEGIN IMMEDIATE")
    try:
        qs = ','.join('?' for _ in capabilities)
        row = c.execute(f"SELECT * FROM tasks WHERE task_type IN ({qs}) AND (status='PENDING' OR (status='CLAIMED' AND lease_until<?)) ORDER BY priority ASC, created_at ASC LIMIT 1", [*capabilities, now]).fetchone()
        if not row:
            c.execute("COMMIT"); return None
        c.execute("UPDATE tasks SET status='CLAIMED',claimed_by=?,lease_until=?,attempts=attempts+1,claim_generation=claim_generation+1,updated_at=? WHERE task_id=?", (worker_id, now + lease_seconds, utcnow(), row['task_id']))
        current = c.execute("SELECT * FROM tasks WHERE task_id=?", (row['task_id'],)).fetchone()
        append_event(c, worker_id, "TASK_CLAIMED", row['task_id'], {"lease_seconds": lease_seconds, "claim_generation": current['claim_generation']})
        c.execute("COMMIT"); return dict(current)
    except Exception:
        c.execute("ROLLBACK"); raise

def _require_claim_update(c, sql, params, worker_id, task_id, generation, event_type, event_data):
    cur = c.execute(sql, params)
    if cur.rowcount != 1:
        append_event(c, worker_id, "STALE_CLAIM_REJECTED", task_id, {"claim_generation": generation, "attempted_event": event_type})
        raise StaleClaimError(f"stale claim for task {task_id} generation {generation}")
    append_event(c, worker_id, event_type, task_id, event_data)

def finish_task(c, worker_id, task_id, claim_generation, result):
    _require_claim_update(c, "UPDATE tasks SET status='DONE',result=?,error=NULL,lease_until=NULL,updated_at=? WHERE task_id=? AND status='CLAIMED' AND claimed_by=? AND claim_generation=?", (json.dumps(result, sort_keys=True), utcnow(), task_id, worker_id, claim_generation), worker_id, task_id, claim_generation, "TASK_DONE", result)

def fail_task(c, worker_id, task_id, claim_generation, error):
    _require_claim_update(c, "UPDATE tasks SET status='FAILED',error=?,lease_until=NULL,updated_at=? WHERE task_id=? AND status='CLAIMED' AND claimed_by=? AND claim_generation=?", (str(error), utcnow(), task_id, worker_id, claim_generation), worker_id, task_id, claim_generation, "TASK_FAILED", {"error": str(error)})

def status_snapshot():
    c = init_db()
    workers = [dict(r) for r in c.execute("SELECT * FROM workers ORDER BY worker_id")]
    tasks = [dict(r) for r in c.execute("SELECT task_id,task_type,priority,status,claimed_by,attempts,updated_at,error FROM tasks ORDER BY created_at DESC LIMIT 100")]
    return {"workers": workers, "tasks": tasks, "db": str(DB), "generated_at": utcnow()}
