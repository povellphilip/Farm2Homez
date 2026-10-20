"""Account business logic: registration, one-time codes, portal login and token handling."""
import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import status
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core import audit
from apps.core.exceptions import ServiceError
from apps.core.notifications import send_email
from apps.core.utils import unique_slug
from apps.producers.models import ProducerProfile

from .models import OneTimeCode, Role, User

INVALID_CODE = 'This code is invalid or has expired. Request a new one.'


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------
@transaction.atomic
def register_consumer(*, email, password, full_name, phone_number=''):
    user = User.objects.create_user(
        email=email, password=password, full_name=full_name, phone_number=phone_number, role=Role.CONSUMER
    )
    issue_code(user, OneTimeCode.Purpose.EMAIL_VERIFICATION)
    return user


@transaction.atomic
def register_producer(*, email, password, full_name, phone_number, farm, request=None):
    user = User.objects.create_user(
        email=email, password=password, full_name=full_name, phone_number=phone_number, role=Role.PRODUCER
    )
    ProducerProfile.objects.create(user=user, slug=unique_slug(ProducerProfile, farm['farm_name']), **farm)
    issue_code(user, OneTimeCode.Purpose.EMAIL_VERIFICATION)
    audit.record('producer.registered', actor=user, target=user.producer_profile, request=request)
    return user


# ---------------------------------------------------------------------------
# One-time codes
# ---------------------------------------------------------------------------
def issue_code(user, purpose):
    OneTimeCode.objects.filter(user=user, purpose=purpose, used_at__isnull=True).update(used_at=timezone.now())
    code = f'{secrets.randbelow(1_000_000):06d}'
    OneTimeCode.objects.create(
        user=user,
        purpose=purpose,
        code_hash=OneTimeCode.hash_code(code),
        expires_at=timezone.now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES),
    )
    if purpose == OneTimeCode.Purpose.EMAIL_VERIFICATION:
        subject, action = 'Verify your email', 'verify your email address'
    else:
        subject, action = 'Reset your password', 'reset your password'
    send_email(
        subject,
        f'Hi {user.full_name},\n\nUse this code to {action}: {code}\n\n'
        f'It expires in {settings.OTP_EXPIRY_MINUTES} minutes. If you did not request it, you can ignore this email.\n',
        [user.email],
    )
    return code


def consume_code(user, purpose, code):
    """Return True and mark the code used if it matches; count failed attempts."""
    if user is None:
        return False
    otp = OneTimeCode.objects.filter(user=user, purpose=purpose, used_at__isnull=True).first()
    if otp is None or not otp.is_usable:
        return False
    OneTimeCode.objects.filter(pk=otp.pk).update(attempts=F('attempts') + 1)
    if not hmac.compare_digest(otp.code_hash, OneTimeCode.hash_code(code)):
        return False
    # Conditional update guards against the same code being redeemed twice concurrently.
    return OneTimeCode.objects.filter(pk=otp.pk, used_at__isnull=True).update(used_at=timezone.now()) == 1


def _user_by_email(email):
    return User.objects.filter(email__iexact=email.strip()).first()


def verify_email(email, code):
    # Not wrapped in a transaction: a failed attempt must stay counted when we raise.
    user = _user_by_email(email)
    if user is None or not consume_code(user, OneTimeCode.Purpose.EMAIL_VERIFICATION, code):
        raise ServiceError(INVALID_CODE, code='invalid_code')
    if not user.email_verified:
        user.email_verified = True
        user.save(update_fields=['email_verified', 'updated_at'])
    return user


def resend_verification(email):
    """Silently does nothing for unknown or already verified addresses (no account enumeration)."""
    user = _user_by_email(email)
    if user and user.is_active and not user.email_verified:
        issue_code(user, OneTimeCode.Purpose.EMAIL_VERIFICATION)


def request_password_reset(email):
    """Silently does nothing for unknown or suspended addresses (no account enumeration)."""
    user = _user_by_email(email)
    if user and user.is_active:
        issue_code(user, OneTimeCode.Purpose.PASSWORD_RESET)


def reset_password(email, code, new_password, request=None):
    # The code check runs outside the transaction so failed attempts stay counted.
    user = _user_by_email(email)
    if user is None or not user.is_active or not consume_code(user, OneTimeCode.Purpose.PASSWORD_RESET, code):
        raise ServiceError(INVALID_CODE, code='invalid_code')
    with transaction.atomic():
        user.set_password(new_password)
        # Completing a reset proves control of the inbox.
        user.email_verified = True
        user.save(update_fields=['password', 'email_verified', 'updated_at'])
        revoke_all_refresh_tokens(user)
        audit.record('auth.password_reset', actor=user, target=user, request=request)
    return user


@transaction.atomic
def change_password(user, current_password, new_password, request=None):
    if not user.check_password(current_password):
        raise ServiceError('Your current password is incorrect.', code='invalid_password', errors={'current_password': ['Incorrect password.']})
    user.set_password(new_password)
    user.save(update_fields=['password', 'updated_at'])
    revoke_all_refresh_tokens(user)
    audit.record('auth.password_changed', actor=user, target=user, request=request)


# ---------------------------------------------------------------------------
# Login and tokens
# ---------------------------------------------------------------------------
_PORTAL_NAMES = {Role.CONSUMER: 'consumer', Role.PRODUCER: 'producer', Role.ADMIN: 'admin'}


def authenticate_for_portal(email, password, role, request=None):
    user = _user_by_email(email)
    if user is None:
        make_password(password)  # equalise timing with the found-user path
        raise ServiceError('Invalid email or password.', code='invalid_credentials', status_code=status.HTTP_401_UNAUTHORIZED)
    if not user.check_password(password):
        if user.role == Role.ADMIN:
            audit.record('auth.admin_login_failed', target=user, request=request)
        raise ServiceError('Invalid email or password.', code='invalid_credentials', status_code=status.HTTP_401_UNAUTHORIZED)
    if not user.is_active:
        raise ServiceError(
            'This account has been suspended. Contact support if you think this is a mistake.',
            code='account_suspended',
            status_code=status.HTTP_403_FORBIDDEN,
        )
    if user.role != role:
        portal = _PORTAL_NAMES.get(user.role, 'correct')
        raise ServiceError(
            f'This is not a {_PORTAL_NAMES[role]} account. Please sign in through the {portal} portal.',
            code='wrong_portal',
            status_code=status.HTTP_403_FORBIDDEN,
            errors={'portal': user.role},
        )
    if not user.email_verified:
        raise ServiceError(
            'Please verify your email address before signing in.',
            code='email_not_verified',
            status_code=status.HTTP_403_FORBIDDEN,
        )
    if user.role == Role.ADMIN:
        audit.record('auth.admin_login', actor=user, target=user, request=request)
    return user


def issue_tokens(user):
    refresh = RefreshToken.for_user(user)
    refresh['role'] = user.role
    user.last_login = timezone.now()
    user.save(update_fields=['last_login'])
    return str(refresh.access_token), str(refresh)


def revoke_all_refresh_tokens(user):
    for token in OutstandingToken.objects.filter(user=user).exclude(blacklistedtoken__isnull=False):
        BlacklistedToken.objects.get_or_create(token=token)
