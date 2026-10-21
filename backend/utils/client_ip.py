from django.conf import settings


def get_client_ip(request):
    """Client IP for rate limiting, honouring X-Forwarded-For when NUM_PROXIES is set."""
    num_proxies = settings.REST_FRAMEWORK.get('NUM_PROXIES')
    forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if num_proxies and forwarded_for:
        addrs = [addr.strip() for addr in forwarded_for.split(',') if addr.strip()]
        if addrs:
            return addrs[-min(num_proxies, len(addrs))]
    return request.META.get('REMOTE_ADDR', '')
