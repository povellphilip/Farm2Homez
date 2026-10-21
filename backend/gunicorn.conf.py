"""Gunicorn settings for the production container (App Runner)."""
import os

bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"
# Small instances: a couple of workers with a few threads each handles I/O-bound API traffic well.
workers = int(os.environ.get('WEB_CONCURRENCY', '2'))
threads = int(os.environ.get('GUNICORN_THREADS', '4'))
worker_class = 'gthread'
timeout = int(os.environ.get('GUNICORN_TIMEOUT', '30'))
graceful_timeout = 20
keepalive = 5
max_requests = 2000
max_requests_jitter = 200

# Log to stdout/stderr so App Runner ships everything to CloudWatch Logs.
accesslog = '-'
errorlog = '-'
loglevel = os.environ.get('LOG_LEVEL', 'info').lower()
access_log_format = '%(h)s "%(r)s" %(s)s %(b)s %(D)sus "%(a)s"'

# TLS terminates at CloudFront/App Runner; trust their forwarded-proto header.
forwarded_allow_ips = '*'
secure_scheme_headers = {'X-FORWARDED-PROTO': 'https'}
proc_name = 'farm2home'
