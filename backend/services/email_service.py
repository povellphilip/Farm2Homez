import logging

from django.conf import settings
from django.core.mail import send_mail

from apps.communications.models import EmailLog

logger = logging.getLogger(__name__)


def _send_email(subject, message, recipients, related_contact=None):
    log = EmailLog.objects.create(
        contact=related_contact,
        subject=subject,
        recipients=recipients,
        status=EmailLog.Status.PENDING,
    )
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipients,
            fail_silently=False,
        )
        log.status = EmailLog.Status.SENT
        log.save(update_fields=['status', 'updated_at'])
        return True
    except Exception as exc:
        logger.exception('Email delivery failed')
        log.status = EmailLog.Status.FAILED
        log.error_message = str(exc)
        log.save(update_fields=['status', 'error_message', 'updated_at'])
        return False


def send_contact_emails(contact):
    admin_message = (
        f'New contact submission\n\n'
        f'Name: {contact.name}\n'
        f'Email: {contact.email}\n'
        f'Phone: {contact.phone}\n'
        f'Company: {contact.company}\n\n'
        f'Message:\n{contact.message}'
    )
    customer_message = (
        f'Hi {contact.name},\n\n'
        'Thanks for contacting Farm2Homez. Our team received your request and will respond shortly.\n\n'
        'Farm2Homez Team'
    )

    _send_email('New Farm2Homez contact submission', admin_message, [settings.ADMIN_NOTIFICATION_EMAIL], contact)
    _send_email('We received your Farm2Homez request', customer_message, [contact.email], contact)
