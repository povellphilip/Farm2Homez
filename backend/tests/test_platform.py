"""Deployment plumbing: CloudFront origin verification and startup migrations."""
import pytest
from django.core.management import call_command

pytestmark = pytest.mark.django_db


@pytest.fixture
def origin_secret(settings):
    settings.ORIGIN_VERIFY_SECRET = 's3cret-from-cloudfront'
    settings.USE_X_FORWARDED_HOST = True
    settings.ALLOWED_HOSTS = ['.cloudfront.net', 'testserver']


def test_requests_without_cloudfront_secret_are_refused(origin_secret, api):
    response = api.get('/api/products/')
    assert response.status_code == 403
    assert response.json()['code'] == 'forbidden_origin'
    assert api.get('/api/products/', HTTP_X_ORIGIN_VERIFY='wrong').status_code == 403


def test_requests_with_secret_pass_and_use_viewer_host(origin_secret, api, product, settings):
    settings.FRONTEND_URL = ''
    response = api.get('/api/seo/sitemap.xml', HTTP_X_ORIGIN_VERIFY='s3cret-from-cloudfront', HTTP_X_FORWARDED_HOST='d1abc.cloudfront.net')
    assert response.status_code == 200
    assert '<loc>http://d1abc.cloudfront.net/products/' in response.content.decode()


def test_forwarded_host_must_still_be_allowed(origin_secret, api):
    response = api.get('/api/products/', HTTP_X_ORIGIN_VERIFY='s3cret-from-cloudfront', HTTP_X_FORWARDED_HOST='evil.example.com')
    assert response.status_code == 400


def test_health_checks_skip_origin_verification(origin_secret, api):
    assert api.get('/api/health/live/').status_code == 200


def test_migrate_with_lock_is_idempotent(db):
    call_command('migrate_with_lock')
    call_command('migrate_with_lock')
