import random

from django.conf import settings
from django.core.cache import cache

from .tasks import send_otp_email


def otp_cache_key(email, purpose):
    return f'otp:{purpose}:{email.lower()}'


def generate_otp():
    return str(random.randint(100000, 999999))


def create_and_send_otp(email, purpose='signup'):
    otp = generate_otp()
    cache.set(otp_cache_key(email, purpose), otp, timeout=settings.OTP_EXPIRY_SECONDS)
    try:
        send_otp_email.delay(email, otp, purpose)
    except Exception:
        send_otp_email.apply(args=[email, otp, purpose])
    return otp


def verify_otp(email, otp, purpose='signup', delete=True):
    key = otp_cache_key(email, purpose)
    expected = cache.get(key)
    if not expected or expected != otp:
        return False
    if delete:
        cache.delete(key)
    return True
