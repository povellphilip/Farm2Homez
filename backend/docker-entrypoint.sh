#!/bin/sh
# Container entrypoint: apply migrations (serialised across instances), optionally create the
# first administrator, then serve.
set -e
python manage.py migrate_with_lock

# One-time admin bootstrap. App Runner has no shell, so set F2H_ADMIN_EMAIL (and the
# F2H_ADMIN_PASSWORD secret) for one deployment, then clear them. A failure here is logged
# but never stops the site from starting.
if [ -n "$F2H_ADMIN_EMAIL" ]; then
  python manage.py create_admin --email "$F2H_ADMIN_EMAIL" --if-missing || echo "Admin bootstrap skipped: see the message above."
fi

exec gunicorn config.wsgi:application --config gunicorn.conf.py
