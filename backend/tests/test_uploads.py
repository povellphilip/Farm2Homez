"""Direct-to-S3 image uploads (against moto's in-memory S3) and the sitemap."""
import boto3
import pytest
from django.core.files.storage import storages
from moto import mock_aws

from apps.products.models import PendingUpload, ProductImage

from .conftest import as_user, image_file, make_producer

pytestmark = pytest.mark.django_db

BUCKET = 'farm2home-test-media'


@pytest.fixture
def s3(settings, monkeypatch):
    monkeypatch.setenv('AWS_ACCESS_KEY_ID', 'testing')
    monkeypatch.setenv('AWS_SECRET_ACCESS_KEY', 'testing')
    monkeypatch.setenv('AWS_DEFAULT_REGION', 'ap-south-1')
    with mock_aws():
        client = boto3.client('s3', region_name='ap-south-1')
        client.create_bucket(Bucket=BUCKET, CreateBucketConfiguration={'LocationConstraint': 'ap-south-1'})
        settings.STORAGE_BACKEND = 's3'
        settings.AWS_STORAGE_BUCKET_NAME = BUCKET
        settings.STORAGES = {
            **settings.STORAGES,
            'default': {
                'BACKEND': 'apps.core.storage.MediaStorage',
                'OPTIONS': {'bucket_name': BUCKET, 'region_name': 'ap-south-1', 'location': 'media', 'default_acl': None},
            },
        }
        field = ProductImage._meta.get_field('image')
        original_storage = field.storage
        storages._storages = {}
        field.storage = storages['default']
        try:
            yield client
        finally:
            field.storage = original_storage
            storages._storages = {}


def ticket_url(product):
    return f'/api/producers/me/products/{product.pk}/images/upload-url/'


def test_local_backend_points_to_multipart(product):
    response = as_user(product.producer.user).post(ticket_url(product), {'content_type': 'image/jpeg', 'size': 1000})
    assert response.status_code == 200
    assert response.data == {'strategy': 'multipart', 'url': f'/api/producers/me/products/{product.pk}/images/'}


def test_presigned_upload_round_trip(product, s3):
    client = as_user(product.producer.user)
    ticket = client.post(ticket_url(product), {'content_type': 'image/png', 'size': 5000}).data
    assert ticket['strategy'] == 'presigned-post'
    key = ticket['fields']['key']
    assert key.startswith(f'uploads/products/{product.pk}/') and key.endswith('.png')
    assert ticket['fields']['Content-Type'] == 'image/png'
    assert 'policy' in ticket['fields']  # size and type limits are signed into the policy

    # Simulate the browser's upload to S3.
    s3.put_object(Bucket=BUCKET, Key=key, Body=image_file('PNG', name='x.png').read(), ContentType='image/png')

    response = client.post(f'/api/producers/me/products/{product.pk}/images/confirm/', {'upload_id': ticket['upload_id'], 'alt_text': 'Hass avocados'})
    assert response.status_code == 201, response.data
    # Same-origin URL; CloudFront maps /media/* to the bucket's media/ prefix.
    assert response.data['url'].startswith(f'/media/products/{product.pk}/')
    image = ProductImage.objects.get()
    keys = {obj['Key'] for obj in s3.list_objects_v2(Bucket=BUCKET).get('Contents', [])}
    assert f'media/{image.image.name}' in keys
    assert key not in keys  # raw upload removed

    again = client.post(f'/api/producers/me/products/{product.pk}/images/confirm/', {'upload_id': ticket['upload_id']})
    assert again.status_code == 409


def test_invalid_object_is_rejected_and_removed(product, s3):
    client = as_user(product.producer.user)
    ticket = client.post(ticket_url(product), {'content_type': 'image/jpeg', 'size': 100}).data
    s3.put_object(Bucket=BUCKET, Key=ticket['fields']['key'], Body=b'not an image', ContentType='image/jpeg')
    response = client.post(f'/api/producers/me/products/{product.pk}/images/confirm/', {'upload_id': ticket['upload_id']})
    assert response.status_code == 400 and response.data['code'] == 'image_invalid'
    assert s3.list_objects_v2(Bucket=BUCKET).get('KeyCount') == 0
    assert not ProductImage.objects.exists()


def test_confirm_without_upload(product, s3):
    client = as_user(product.producer.user)
    ticket = client.post(ticket_url(product), {'content_type': 'image/jpeg', 'size': 100}).data
    response = client.post(f'/api/producers/me/products/{product.pk}/images/confirm/', {'upload_id': ticket['upload_id']})
    assert response.data['code'] == 'upload_missing'


def test_upload_tickets_are_owner_only(product, s3):
    intruder = as_user(make_producer())
    assert intruder.post(ticket_url(product), {'content_type': 'image/jpeg', 'size': 100}).status_code == 404
    ticket = as_user(product.producer.user).post(ticket_url(product), {'content_type': 'image/jpeg', 'size': 100}).data
    other_product_confirm = f'/api/producers/me/products/{product.pk}/images/confirm/'
    assert intruder.post(other_product_confirm, {'upload_id': ticket['upload_id']}).status_code == 404
    assert PendingUpload.objects.get().consumed_at is None


def test_ticket_validation(product, settings):
    client = as_user(product.producer.user)
    assert client.post(ticket_url(product), {'content_type': 'image/gif', 'size': 100}).status_code == 400
    response = client.post(ticket_url(product), {'content_type': 'image/jpeg', 'size': settings.MAX_IMAGE_UPLOAD_BYTES + 1})
    assert response.data['code'] == 'image_too_large'


def test_signed_urls_when_no_public_base(product, s3, settings):
    settings.MEDIA_PUBLIC_BASE = ''
    client = as_user(product.producer.user)
    ticket = client.post(ticket_url(product), {'content_type': 'image/jpeg', 'size': 100}).data
    s3.put_object(Bucket=BUCKET, Key=ticket['fields']['key'], Body=image_file().read(), ContentType='image/jpeg')
    url = client.post(f'/api/producers/me/products/{product.pk}/images/confirm/', {'upload_id': ticket['upload_id']}).data['url']
    assert 'X-Amz-Signature' in url or 'Signature=' in url


def test_sitemap_lists_public_pages_only(api, product, categories, settings):
    settings.FRONTEND_URL = 'https://farm2home.example'
    hidden = make_producer(verified=False)
    response = api.get('/api/seo/sitemap.xml')
    body = response.content.decode()
    assert response['Content-Type'] == 'application/xml'
    assert f'<loc>https://farm2home.example/products/{product.slug}</loc>' in body
    assert f'/farms/{product.producer.slug}' in body
    assert hidden.producer_profile.slug not in body
    assert '/categories/fruits' in body


def test_sitemap_falls_back_to_request_host(api, product, settings):
    settings.FRONTEND_URL = ''
    body = api.get('/api/seo/sitemap.xml').content.decode()
    assert f'<loc>http://testserver/products/{product.slug}</loc>' in body
