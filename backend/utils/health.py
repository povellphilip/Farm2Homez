from django.db import connection
from django.http import JsonResponse


def health(request):
    """Load balancer health check: no auth, no throttling, just app + database."""
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
    except Exception:
        return JsonResponse({'status': 'error', 'database': 'unreachable'}, status=503)
    return JsonResponse({'status': 'ok'})
