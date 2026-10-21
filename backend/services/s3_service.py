import os
import uuid

import boto3
from django.conf import settings

_client = None


def _s3():
    global _client
    if _client is None:
        # Credentials come from the EC2 instance profile (LabRole)
        _client = boto3.client('s3', region_name=settings.AWS_REGION)
    return _client


def upload_product_image(file_obj):
    extension = os.path.splitext(getattr(file_obj, 'name', ''))[1].lower() or '.jpg'
    key = f'media/products/{uuid.uuid4().hex}{extension}'
    _s3().upload_fileobj(
        file_obj,
        settings.AWS_MEDIA_BUCKET,
        key,
        ExtraArgs={'ContentType': getattr(file_obj, 'content_type', None) or 'application/octet-stream'},
    )
    return f"{settings.MEDIA_BASE_URL.rstrip('/')}/{key}"
