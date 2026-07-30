import multiprocessing
import os

# Server socket
bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"
backlog = 2048

# Worker processes
workers = int(os.environ.get('WEB_CONCURRENCY', multiprocessing.cpu_count() * 2 + 1))
worker_class = 'sync'
threads = int(os.environ.get('GUNICORN_THREADS', '2'))
worker_connections = 1000
timeout = int(os.environ.get('GUNICORN_TIMEOUT', '120'))
keepalive = 5

# Logging
accesslog = '-'
errorlog = '-'
loglevel = os.environ.get('LOG_LEVEL', 'info').lower()
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = 'farm2homez'

# Server mechanics
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

# SSL
keyfile = None
certfile = None
ssl_version = None
cert_reqs = 0
ca_certs = None
suppress_ragged_eof = True

# Application
raw_env = []
forwarded_allow_ips = '*'
secure_scheme_header = 'HTTP_X_FORWARDED_PROTO'
