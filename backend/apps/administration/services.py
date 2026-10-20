from django.db import transaction
from django.utils import timezone

from apps.accounts.services import revoke_all_refresh_tokens
from apps.core import audit
from apps.core.exceptions import Conflict, ServiceError
from apps.core.notifications import send_email


@transaction.atomic
def suspend_user(user, *, reason, actor, request=None):
    if user.pk == actor.pk:
        raise Conflict('You cannot suspend your own account.', code='cannot_suspend_self')
    if not reason.strip():
        raise ServiceError('Give a reason for the suspension.', code='note_required', errors={'reason': ['A reason is required.']})
    if not user.is_active:
        raise Conflict('This account is already suspended.', code='already_suspended')
    user.is_active = False
    user.suspended_at = timezone.now()
    user.suspension_reason = reason.strip()
    user.save(update_fields=['is_active', 'suspended_at', 'suspension_reason', 'updated_at'])
    revoke_all_refresh_tokens(user)
    audit.record('user.suspended', actor=actor, target=user, metadata={'reason': user.suspension_reason}, request=request)
    send_email(
        'Your account has been suspended',
        f'Hi {user.full_name},\n\nYour Farm2Home account has been suspended.\n\nReason: {user.suspension_reason}\n\n'
        'Reply to this email if you believe this is a mistake.\n',
        [user.email],
    )
    return user


@transaction.atomic
def reactivate_user(user, *, actor, request=None):
    if user.is_active:
        raise Conflict('This account is already active.', code='already_active')
    previous_reason = user.suspension_reason
    user.is_active = True
    user.suspended_at = None
    user.suspension_reason = ''
    user.save(update_fields=['is_active', 'suspended_at', 'suspension_reason', 'updated_at'])
    audit.record('user.reactivated', actor=actor, target=user, metadata={'previous_reason': previous_reason}, request=request)
    send_email('Your account has been reactivated', f'Hi {user.full_name},\n\nYour Farm2Home account is active again.\n', [user.email])
    return user
