import logging

from rest_framework.throttling import BaseThrottle

from .models import AuditLog

logger = logging.getLogger('apps.audit')


def client_ip(request):
    if request is None:
        return None
    # Reuses DRF's proxy-aware lookup (honours REST_FRAMEWORK['NUM_PROXIES']).
    ident = BaseThrottle().get_ident(request)
    return ident or None


def record(action, *, actor=None, target=None, metadata=None, request=None):
    """Write an audit entry. `target` may be any model instance."""
    entry = AuditLog.objects.create(
        actor=actor if actor is not None and actor.is_authenticated else None,
        actor_email=getattr(actor, 'email', '') or '',
        action=action,
        target_type=target._meta.label if target is not None else '',
        target_id=str(target.pk) if target is not None else '',
        target_repr=str(target)[:255] if target is not None else '',
        metadata=metadata or {},
        ip_address=client_ip(request),
    )
    logger.info('audit %s by %s on %s', action, entry.actor_email or 'system', entry.target_repr)
    return entry
