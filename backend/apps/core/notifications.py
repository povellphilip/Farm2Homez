"""Transactional email. Sends after the surrounding transaction commits so a rolled-back
operation never emails anyone, and never lets a mail failure break the request."""
import logging

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction

logger = logging.getLogger(__name__)


def _deliver(subject, body, recipients):
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, recipients, fail_silently=False)
    except Exception:  # noqa: BLE001 - mail outages must not break user flows
        logger.exception('Email delivery failed: subject=%r recipients=%d', subject, len(recipients))


def send_email(subject, body, recipients):
    recipients = [r for r in recipients if r]
    if not recipients:
        return
    transaction.on_commit(lambda: _deliver(f'Farm2Home: {subject}', body, recipients))
