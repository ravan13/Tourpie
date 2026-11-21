"""Focused tests for H-7: .env must not override variables already set in the OS environment.

The backend loads dotenv in ``app/database.py`` and ``app/auth.py`` with
``override=False``. ``app/main.py`` used ``override=True`` for the same ``.env`` file,
which let a checked-out ``.env`` silently override real OS/deployment environment
variables as soon as ``app.main`` was imported.

Run with:
    backend/.venv/Scripts/python.exe tests/test_dotenv_precedence.py
"""

import os
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

BACKEND_DIR = Path(__file__).resolve().parents[1]
STRONG_KEY = "8fJ2pQ7wZ1nR4tY6uM0bV3xC5dS9gH2kL7aN4eW8qT1zB6vD0"

# Keys read lazily (only inside create_default_admin), so probing them cannot change
# the import-time behaviour of app.main.
_SAFE_PROBE_KEYS = ("DEFAULT_ADMIN_NAME", "DEFAULT_ADMIN_EMAIL", "DEFAULT_ADMIN_PASSWORD")


def run_py(code, env_overrides=None):
    """Run ``code`` in a fresh interpreter with a deterministic environment."""
    env = dict(os.environ)
    env["TOURPIE_ENV"] = ""
    env["ENV"] = ""
    env["ENVIRONMENT"] = "development"
    env["SECRET_KEY"] = STRONG_KEY
    # Keep import-time schema patching away from any real database.
    env["TOURPIE_AUTO_SCHEMA"] = "0"
    env["EMAIL_DEBUG_TO_CONSOLE"] = "0"
    env["SMS_DEBUG_TO_CONSOLE"] = "0"
    env["AUTH_DEBUG_DELIVERY"] = "0"
    env["AUTH_DEBUG_OTP"] = "0"
    if env_overrides:
        env.update(env_overrides)
    return subprocess.run(
        [sys.executable, "-c", code],
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
    )


def _value(stdout, key):
    for line in stdout.splitlines():
        if line.startswith(key + "="):
            return line[len(key) + 1:]
    return None


def _dotenv_probe_key():
    """Return ``(key, value)`` for a safe key defined in a .env file that main loads."""
    for path in (BACKEND_DIR / ".env", BACKEND_DIR.parent / ".env"):
        if not path.exists():
            continue
        values = {}
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            name, _, raw_value = line.partition("=")
            values[name.strip()] = raw_value.strip().strip('"').strip("'")
        for key in _SAFE_PROBE_KEYS:
            if values.get(key):
                return key, values[key]
    return None, None


class DotenvPrecedenceTests(unittest.TestCase):
    def test_os_environment_takes_precedence_over_dotenv(self):
        key, dotenv_value = _dotenv_probe_key()
        if key is None:
            self.skipTest("no .env file with a safe probe key was found")

        os_sentinel = "from-os-environment-h7"
        self.assertNotEqual(os_sentinel, dotenv_value)

        code = (
            "import os\n"
            "import app.main\n"
            "print('VAL=' + str(os.getenv({!r})))"
        ).format(key)

        result = run_py(code, {key: os_sentinel})
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertEqual(
            _value(result.stdout, "VAL"),
            os_sentinel,
            msg="app.main must not let .env override an existing OS environment variable",
        )

    def test_dotenv_is_loaded_when_os_value_is_absent(self):
        key, dotenv_value = _dotenv_probe_key()
        if key is None:
            self.skipTest("no .env file with a safe probe key was found")

        # Simulate a fresh environment with the variable unset: the .env value must load.
        code = (
            "import os\n"
            "os.environ.pop({key!r}, None)\n"
            "import app.main\n"
            "print('VAL=' + str(os.getenv({key!r})))"
        ).format(key=key)

        result = run_py(code)
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertEqual(_value(result.stdout, "VAL"), dotenv_value)


if __name__ == "__main__":
    unittest.main(verbosity=2)
