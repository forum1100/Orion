from __future__ import annotations
import json, sqlite3, time, uuid
from datetime import datetime, timezone
from coordinator_core import DB, conn, append_event


def utcnow():
    return datetime.now(timezone.utc).isoformat()


def init_spark_windows(c=None):
    owned = c is None
    c = c or conn()
    c.execute('''CREATE TABLE IF NOT EXISTS spark_windows(
      role TEXT NOT NULL, topology_id TEXT NOT NULL, window_start REAL NOT NULL,
      window_end REAL NOT NULL, invocation_id TEXT NOT NULL, fencing_token INTEGER NOT NULL,
      lease_until REAL NOT NULL, state TEXT NOT NULL, cursor TEXT, updated_at TEXT NOT NULL,
      PRIMARY KEY(role, topology_id, window_start))''')
    if owned:
        c.close()


def claim_spark_window(c, role, topology_id, window_start, window_end, invocation_id, lease_seconds=60):
    now = time.time()
    c.execute('BEGIN IMMEDIATE')
    try:
        row = c.execute('SELECT * FROM spark_windows WHERE role=? AND topology_id=? AND window_start=?',
                        (role, topology_id, window_start)).fetchone()
        if row and row['lease_until'] >= now and row['state'] == 'ACTIVE':
            c.execute('ROLLBACK'); return None
        token = (row['fencing_token'] + 1) if row else 1
        if row:
            c.execute('''UPDATE spark_windows SET window_end=?,invocation_id=?,fencing_token=?,lease_until=?,
                         state='ACTIVE',updated_at=? WHERE role=? AND topology_id=? AND window_start=?''',
                      (window_end, invocation_id, token, now+lease_seconds, utcnow(), role, topology_id, window_start))
        else:
            c.execute('''INSERT INTO spark_windows(role,topology_id,window_start,window_end,invocation_id,
                         fencing_token,lease_until,state,cursor,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)''',
                      (role, topology_id, window_start, window_end, invocation_id, token,
                       now+lease_seconds, 'ACTIVE', None, utcnow()))
        append_event(c, invocation_id, 'SPARK_WINDOW_CLAIMED', None,
                     {'role': role, 'topology_id': topology_id, 'window_start': window_start, 'fencing_token': token})
        c.execute('COMMIT')
        return dict(c.execute('SELECT * FROM spark_windows WHERE role=? AND topology_id=? AND window_start=?',
                              (role, topology_id, window_start)).fetchone())
    except Exception:
        try: c.execute('ROLLBACK')
        except sqlite3.OperationalError: pass
        raise


def _fenced_update(c, sql, params, invocation_id, event_type, data):
    cur = c.execute(sql, params)
    if cur.rowcount != 1:
        append_event(c, invocation_id, 'STALE_SPARK_WINDOW_REJECTED', None, data)
        return False
    append_event(c, invocation_id, event_type, None, data)
    return True


def heartbeat_spark_window(c, role, topology_id, window_start, invocation_id, token, lease_seconds=60, cursor=None):
    now = time.time()
    data = {'role': role, 'topology_id': topology_id, 'window_start': window_start, 'fencing_token': token}
    return _fenced_update(c, '''UPDATE spark_windows SET lease_until=?,cursor=?,updated_at=? WHERE role=? AND topology_id=?
        AND window_start=? AND invocation_id=? AND fencing_token=? AND state='ACTIVE' ''',
        (now+lease_seconds, cursor, utcnow(), role, topology_id, window_start, invocation_id, token),
        invocation_id, 'SPARK_WINDOW_HEARTBEAT', data)


def release_spark_window(c, role, topology_id, window_start, invocation_id, token, cursor=None):
    data = {'role': role, 'topology_id': topology_id, 'window_start': window_start, 'fencing_token': token}
    return _fenced_update(c, '''UPDATE spark_windows SET state='RELEASED',lease_until=0,cursor=?,updated_at=? WHERE role=?
        AND topology_id=? AND window_start=? AND invocation_id=? AND fencing_token=? AND state='ACTIVE' ''',
        (cursor, utcnow(), role, topology_id, window_start, invocation_id, token),
        invocation_id, 'SPARK_WINDOW_RELEASED', data)


def active_window(c, role, topology_id, window_start):
    row = c.execute('SELECT * FROM spark_windows WHERE role=? AND topology_id=? AND window_start=?',
                    (role, topology_id, window_start)).fetchone()
    return dict(row) if row else None
