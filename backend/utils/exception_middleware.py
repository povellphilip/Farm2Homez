import logging

from django.http import JsonResponse
from django_ratelimit.exceptions import Ratelimited

logger = logging.getLogger(__name__)


class APIExceptionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_exception(self, request, exception):
        if not request.path.startswith('/api/'):
            return None

        if isinstance(exception, Ratelimited):
            return JsonResponse(
                {'success': False, 'message': 'Too many requests. Please try again shortly.', 'errors': {}},
                status=429,
            )

        logger.exception('Unhandled API exception', exc_info=exception)
        return JsonResponse(
            {'success': False, 'message': 'Internal server error', 'errors': {}},
            status=500,
        )
