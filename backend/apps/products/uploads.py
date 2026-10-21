"""Image upload strategies.

local: the browser posts the file to the API (multipart); used in development.
s3:    the API issues a presigned POST limited to one key, content type and size; the
       browser uploads straight to the private bucket, then calls `confirm`. The API reads
       the object back, validates and re-encodes it like a direct upload, stores the result
       under products/<id>/ and deletes the raw upload.
"""
import uuid
from datetime import timedelta

from botocore.exceptions import ClientError
from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import Conflict, ServiceError

from . import services
from .models import PendingUpload

EXTENSIONS = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'}


def _s3_client():
    import boto3

    return boto3.client('s3', region_name=settings.AWS_S3_REGION_NAME)


def uses_s3():
    return settings.STORAGE_BACKEND == 's3'


def request_upload(product, *, content_type, size):
    if content_type not in EXTENSIONS:
        raise ServiceError('Upload a JPEG, PNG or WebP image.', code='image_type')
    if size > settings.MAX_IMAGE_UPLOAD_BYTES:
        raise ServiceError(f'Images must be {settings.MAX_IMAGE_UPLOAD_BYTES // (1024 * 1024)} MB or smaller.', code='image_too_large')
    if product.images.count() >= settings.MAX_IMAGES_PER_PRODUCT:
        raise ServiceError(f'A product can have at most {settings.MAX_IMAGES_PER_PRODUCT} images.', code='image_limit')

    if not uses_s3():
        return {'strategy': 'multipart', 'url': f'/api/producers/me/products/{product.pk}/images/'}

    key = f'{settings.S3_UPLOAD_PREFIX}products/{product.pk}/{uuid.uuid4().hex}.{EXTENSIONS[content_type]}'
    pending = PendingUpload.objects.create(
        product=product,
        key=key,
        content_type=content_type,
        expires_at=timezone.now() + timedelta(seconds=settings.UPLOAD_URL_EXPIRY_SECONDS),
    )
    post = _s3_client().generate_presigned_post(
        Bucket=settings.AWS_STORAGE_BUCKET_NAME,
        Key=key,
        Fields={'Content-Type': content_type},
        Conditions=[
            {'Content-Type': content_type},
            ['content-length-range', 1, settings.MAX_IMAGE_UPLOAD_BYTES],
        ],
        ExpiresIn=settings.UPLOAD_URL_EXPIRY_SECONDS,
    )
    return {'strategy': 'presigned-post', 'upload_id': str(pending.id), 'url': post['url'], 'fields': post['fields']}


def confirm_upload(product, upload_id, alt_text=''):
    if not uses_s3():
        raise ServiceError('Direct uploads are not enabled on this server.', code='uploads_not_enabled')
    with transaction.atomic():
        pending = PendingUpload.objects.select_for_update().filter(pk=upload_id, product=product).first()
        if pending is None:
            raise ServiceError('Upload not found.', code='not_found', status_code=404)
        if pending.consumed_at:
            raise Conflict('This upload was already processed.', code='upload_consumed')
        if pending.expires_at < timezone.now() - timedelta(minutes=10):
            raise ServiceError('This upload has expired. Please try again.', code='upload_expired')
        pending.consumed_at = timezone.now()
        pending.save(update_fields=['consumed_at'])

    client = _s3_client()
    bucket = settings.AWS_STORAGE_BUCKET_NAME
    try:
        head = client.head_object(Bucket=bucket, Key=pending.key)
    except ClientError as exc:
        raise ServiceError('We did not receive the file. Please upload it again.', code='upload_missing') from exc
    try:
        if head['ContentLength'] > settings.MAX_IMAGE_UPLOAD_BYTES:
            raise ServiceError(f'Images must be {settings.MAX_IMAGE_UPLOAD_BYTES // (1024 * 1024)} MB or smaller.', code='image_too_large')
        body = client.get_object(Bucket=bucket, Key=pending.key)['Body'].read()
        return services.add_image(product, ContentFile(body, name=pending.key.rsplit('/', 1)[-1]), alt_text)
    finally:
        client.delete_object(Bucket=bucket, Key=pending.key)
