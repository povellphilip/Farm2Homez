import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3})
def send_otp_email(self, email, otp, purpose):
    subject = 'Farm 2 Homez verification code'
    action = 'verify your email' if purpose == 'signup' else 'reset your password'
    message = f'Your Farm 2 Homez OTP to {action} is {otp}. It expires in 10 minutes.'
    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False)
    logger.info('OTP email queued for %s', email)
