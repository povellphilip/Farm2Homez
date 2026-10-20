import logging

from django.db import connection
from django.http import JsonResponse

logger = logging.getLogger(__name__)


def health_live(request):
    """Liveness: the process is up and serving requests."""
    return JsonResponse({'status': 'ok'})


def health_ready(request):
    """Readiness: the database is reachable. Used by load-balancer health checks."""
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
    except Exception:  # noqa: BLE001
        logger.exception('Readiness check failed')
        return JsonResponse({'status': 'unavailable', 'database': 'error'}, status=503)
    return JsonResponse({'status': 'ok', 'database': 'ok'})


def not_found(request, exception=None):
    return JsonResponse({'code': 'not_found', 'message': 'Not found.', 'errors': {}}, status=404)


def server_error(request):
    return JsonResponse({'code': 'server_error', 'message': 'Something went wrong on our side.', 'errors': {}}, status=500)
