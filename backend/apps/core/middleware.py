import hmac

from django.conf import settings
from django.http import JsonResponse


class OriginVerifyMiddleware:
    """Reject requests that did not come through our CloudFront distribution.

    CloudFront adds a secret `X-Origin-Verify` header to every request it forwards to the API.
    Requests sent straight to the App Runner URL lack it and are refused, so the CDN's security
    headers, caching and host checks can't be bypassed. Disabled when no secret is configured
    (local development and tests).
    """

    HEADER = 'HTTP_X_ORIGIN_VERIFY'

    def __init__(self, get_response):
        self.get_response = get_response
        self.secret = settings.ORIGIN_VERIFY_SECRET

    def __call__(self, request):
        if self.secret and not request.path.startswith('/api/health/'):
            supplied = request.META.get(self.HEADER, '')
            if not hmac.compare_digest(supplied.encode(), self.secret.encode()):
                return JsonResponse({'code': 'forbidden_origin', 'message': 'Requests must come through the Farm2Home site.', 'errors': {}}, status=403)
        return self.get_response(request)
