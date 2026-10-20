from django.conf import settings
from django.db import transaction
from rest_framework import status

from apps.accounts.models import Role
from apps.core.exceptions import Conflict, ServiceError
from apps.core.notifications import send_email
from apps.producers.models import ProducerProfile, VerificationStatus
from apps.products.models import Product

from .models import Inquiry, InquiryReply, InquiryStatus


def _visible_producers():
    queryset = ProducerProfile.objects.filter(user__is_active=True).select_related('user')
    if settings.PRODUCER_VERIFICATION_REQUIRED:
        queryset = queryset.filter(verification_status=VerificationStatus.VERIFIED)
    return queryset


@transaction.atomic
def create_inquiry(*, sender, producer_slug, product_slug, name, email, phone, subject, message):
    product = None
    producer = None
    if product_slug:
        product = Product.objects.public().select_related('producer__user').filter(slug=product_slug).first()
        if product is None:
            raise ServiceError('This product could not be found.', code='product_not_found', status_code=status.HTTP_404_NOT_FOUND)
        producer = product.producer
    elif producer_slug:
        producer = _visible_producers().filter(slug=producer_slug).first()
        if producer is None:
            raise ServiceError('This farm could not be found.', code='producer_not_found', status_code=status.HTTP_404_NOT_FOUND)

    if sender is not None and sender.is_authenticated:
        name = name or sender.full_name
        email = sender.email
        phone = phone or sender.phone_number
    else:
        sender = None
        errors = {}
        if not name.strip():
            errors['name'] = ['Enter your name.']
        if not email:
            errors['email'] = ['Enter your email so we can reply.']
        if errors:
            raise ServiceError('Please correct the highlighted fields.', code='validation_error', errors=errors)

    inquiry = Inquiry.objects.create(
        producer=producer, product=product, sender=sender, name=name.strip(), email=email, phone=phone,
        subject=subject.strip(), message=message.strip(),
    )
    if producer:
        about = f' about "{product.name}"' if product else ''
        send_email(
            f'New inquiry{about}',
            f'Hi {producer.user.full_name},\n\n{inquiry.name} sent you a question{about}:\n\n{inquiry.subject}\n\n{inquiry.message}\n\n'
            'Reply from the Inquiries section of your producer dashboard.\n',
            [producer.user.email],
        )
    else:
        send_email(
            f'Contact form: {inquiry.subject}',
            f'From: {inquiry.name} <{inquiry.email}> {inquiry.phone}\n\n{inquiry.message}\n',
            [settings.ADMIN_NOTIFICATION_EMAIL],
        )
    send_email(
        'We received your message',
        f'Hi {inquiry.name},\n\nThanks for getting in touch. Your message "{inquiry.subject}" has been delivered and you will get a reply by email.\n',
        [inquiry.email],
    )
    return inquiry


@transaction.atomic
def reply(inquiry, *, author, message):
    inquiry = Inquiry.objects.select_for_update().get(pk=inquiry.pk)
    if inquiry.status == InquiryStatus.CLOSED:
        raise Conflict('This conversation is closed.', code='inquiry_closed')
    entry = InquiryReply.objects.create(inquiry=inquiry, author=author, author_role=author.role, message=message.strip())
    if author.role == Role.CONSUMER:
        inquiry.status = InquiryStatus.OPEN
        recipient = inquiry.producer.user.email if inquiry.producer else settings.ADMIN_NOTIFICATION_EMAIL
        send_email(f'New reply: {inquiry.subject}', f'{inquiry.name} replied:\n\n{entry.message}\n', [recipient])
    else:
        inquiry.status = InquiryStatus.ANSWERED
        sender_name = inquiry.producer.farm_name if inquiry.producer else 'The Farm2Home team'
        send_email(
            f'Reply: {inquiry.subject}',
            f'Hi {inquiry.name},\n\n{sender_name} replied to your message:\n\n{entry.message}\n',
            [inquiry.email],
        )
    inquiry.save(update_fields=['status', 'updated_at'])
    return entry


def close(inquiry):
    inquiry.status = InquiryStatus.CLOSED
    inquiry.save(update_fields=['status', 'updated_at'])
    return inquiry
