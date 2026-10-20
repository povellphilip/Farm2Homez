"""Run the backend test suite against a throwaway embedded PostgreSQL server.

Usage (from backend/):  python scripts/test_postgres.py [pytest args]
Requires the dev dependency `pgserver` (requirements-dev.txt). Uses a data directory
under the system temp folder and stops the server afterwards.
"""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import pgserver


def ensure_timezone_data():
    """Some pgserver builds (notably Windows) ship without PostgreSQL's time zone files, so
    `SET TimeZone = 'UTC'` fails. Copy the IANA zone files from the tzdata package in."""
    import shutil

    import tzdata

    target = Path(pgserver.__file__).parent / 'pginstall' / 'share' / 'postgresql' / 'timezone'
    if not (target / 'UTC').exists():
        shutil.copytree(Path(tzdata.__file__).parent / 'zoneinfo', target, dirs_exist_ok=True)


def main():
    ensure_timezone_data()
    data_dir = Path(tempfile.gettempdir()) / 'farm2home_pgdata'
    server = pgserver.get_server(data_dir, cleanup_mode='stop')
    env = {**os.environ, 'DATABASE_URL': server.get_uri(), 'DB_SSL_REQUIRE': 'False'}
    command = [sys.executable, '-m', 'pytest', '--nomigrations' if '--migrations' not in sys.argv else '', *sys.argv[1:]]
    return subprocess.call([part for part in command if part and part != '--migrations'], env=env)


if __name__ == '__main__':
    sys.exit(main())
