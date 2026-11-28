"""Focused tests for the /ready database readiness endpoint in app.main.

Verifies that:
  * /ready returns HTTP 200 with the unchanged payload shape only when the database
    answers ``SELECT 1``.
  * /ready returns HTTP 503 with the same payload shape when the database is
    unavailable.
  * The route depends on ``get_db`` (not ``Depends(SessionLocal)``), so the session
    lifecycle is owned by the dependency.
  * The handler executes ``SELECT 1`` and does not close the session itself; ``get_db``
    closes it on both the normal and the error path.
  * /health is untouched.

No live database is required: the endpoint is exercised with a fake session, and
``app.main`` is imported with schema bootstrapping disabled so nothing connects.

Run with:
    backend/.venv/Scripts/python.exe tests/test_readiness_endpoint.py
"""

import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

BACKEND_DIR = Path(__file__).resolve().parents[1]
STRONG_KEY = "8fJ2pQ7wZ1nR4tY6uM0bV3xC5dS9gH2kL7aN4eW8qT1zB6vD0"

_SCRIPT = r'''
import asyncio
import json

import app.database as d
import app.main as m

out = {}

# --- route wiring -------------------------------------------------------------
ready = next(r for r in m.app.routes if getattr(r, "path", None) == "/ready")
deps = ready.dependant.dependencies
out["dep_count"] = len(deps)
out["uses_get_db"] = bool(deps) and deps[0].call is m.get_db
out["uses_sessionlocal"] = any(dep.call is m.SessionLocal for dep in deps)

health = next(r for r in m.app.routes if getattr(r, "path", None) == "/health")
out["health_methods"] = sorted(getattr(health, "methods", []))


# --- readiness behaviour with a fake session ----------------------------------
class FakeSession:
    def __init__(self, fail=False):
        self.fail = fail
        self.statements = []
        self.closed = False

    def execute(self, statement, *args, **kwargs):
        self.statements.append(str(statement))
        if self.fail:
            raise RuntimeError("database unavailable")
        return None

    def close(self):
        self.closed = True


async def invoke(fail):
    session = FakeSession(fail=fail)
    result = await m.readiness_check(session)
    return session, result


ok_session, ok_result = asyncio.run(invoke(False))
bad_session, bad_result = asyncio.run(invoke(True))

out["ok_status"] = getattr(ok_result, "status_code", 200)
out["ok_body"] = ok_result if isinstance(ok_result, dict) else json.loads(ok_result.body)
out["ok_sql"] = ok_session.statements
out["ok_handler_closed"] = ok_session.closed
out["bad_status"] = bad_result.status_code
out["bad_body"] = json.loads(bad_result.body)


# --- get_db owns the session lifecycle ----------------------------------------
sessions = []


class RecordingSession:
    def __init__(self):
        self.closed = False

    def close(self):
        self.closed = True


class RecordingSessionLocal:
    def __call__(self):
        session = RecordingSession()
        sessions.append(session)
        return session


d.SessionLocal = RecordingSessionLocal()

gen = d.get_db()
first = next(gen)
try:
    next(gen)
except StopIteration:
    pass
out["get_db_closed_normal"] = first.closed

gen2 = d.get_db()
second = next(gen2)
try:
    gen2.throw(RuntimeError("boom"))
except RuntimeError:
    pass
out["get_db_closed_on_error"] = second.closed

print("RESULT=" + json.dumps(out, sort_keys=True))
'''


def run_probe():
    """Import app.main in a fresh interpreter (no schema bootstrap, no connection)."""
    env = dict(os.environ)
    env["TOURPIE_ENV"] = ""
    env["ENV"] = ""
    env["ENVIRONMENT"] = "development"
    env["SECRET_KEY"] = STRONG_KEY
    env["TOURPIE_AUTO_SCHEMA"] = "0"
    env["EMAIL_DEBUG_TO_CONSOLE"] = "0"
    env["SMS_DEBUG_TO_CONSOLE"] = "0"
    env["AUTH_DEBUG_DELIVERY"] = "0"
    env["AUTH_DEBUG_OTP"] = "0"
    proc = subprocess.run(
        [sys.executable, "-c", _SCRIPT],
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
    )
    for line in proc.stdout.splitlines():
        if line.startswith("RESULT="):
            return proc, json.loads(line[len("RESULT="):])
    return proc, None


class ReadinessEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.proc, cls.data = run_probe()
        if cls.data is None:
            raise AssertionError(
                "probe failed (rc={}):\n{}".format(cls.proc.returncode, cls.proc.stderr)
            )

    def test_route_depends_on_get_db(self):
        self.assertTrue(self.data["uses_get_db"])
        self.assertFalse(self.data["uses_sessionlocal"])
        self.assertGreaterEqual(self.data["dep_count"], 1)

    def test_health_endpoint_untouched(self):
        self.assertIn("GET", self.data["health_methods"])

    def test_healthy_database_returns_200(self):
        self.assertEqual(self.data["ok_status"], 200)
        body = self.data["ok_body"]
        self.assertEqual(body["status"], "ok")
        self.assertEqual(body["checks"], {"database": "ok"})
        self.assertIn("timestamp", body)

    def test_unavailable_database_returns_503(self):
        self.assertEqual(self.data["bad_status"], 503)
        body = self.data["bad_body"]
        self.assertEqual(body["status"], "degraded")
        self.assertEqual(body["checks"], {"database": "error"})
        self.assertIn("timestamp", body)

    def test_response_structure_preserved_across_states(self):
        self.assertEqual(set(self.data["ok_body"]), {"status", "checks", "timestamp"})
        self.assertEqual(set(self.data["bad_body"]), {"status", "checks", "timestamp"})
        self.assertEqual(set(self.data["ok_body"]["checks"]), {"database"})
        self.assertEqual(set(self.data["bad_body"]["checks"]), {"database"})

    def test_select_1_is_executed(self):
        self.assertEqual(self.data["ok_sql"], ["SELECT 1"])

    def test_handler_does_not_close_session(self):
        # get_db owns the lifecycle; the handler must leave the session open.
        self.assertFalse(self.data["ok_handler_closed"])

    def test_get_db_closes_session_on_normal_and_error_paths(self):
        self.assertTrue(self.data["get_db_closed_normal"])
        self.assertTrue(self.data["get_db_closed_on_error"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
