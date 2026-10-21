import pytest
from django.conf import settings
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.core.models import AuditLog
from apps.producers.models import VerificationStatus
from apps.products.models import Category

from .conftest import PASSWORD, as_user, make_producer, make_product, make_user

pytestmark = pytest.mark.django_db

ADMIN_ENDPOINTS = [
    '/api/admin/users/', '/api/admin/producers/', '/api/admin/products/', '/api/admin/orders/',
    '/api/admin/inquiries/', '/api/admin/categories/', '/api/admin/audit-logs/', '/api/admin/reports/overview/',
]


@pytest.mark.parametrize('endpoint', ADMIN_ENDPOINTS)
def test_admin_endpoints_reject_everyone_else(endpoint, api, consumer, producer, admin_user):
    assert api.get(endpoint).status_code == 401
    assert as_user(consumer).get(endpoint).status_code == 403
    assert as_user(producer).get(endpoint).status_code == 403
    assert as_user(admin_user).get(endpoint).status_code == 200


def test_staff_flag_alone_does_not_grant_admin_api(consumer):
    consumer.is_staff = True
    consumer.save()
    assert as_user(consumer).get('/api/admin/users/').status_code == 403


class TestProducerVerification:
    def test_verify_enables_publishing_and_is_audited(self, admin_user, categories, django_capture_on_commit_callbacks):
        user = make_producer(verified=False)
        profile = user.producer_profile
        admin = as_user(admin_user)
        pending = admin.get('/api/admin/producers/', {'verification_status': 'PENDING'}).data
        assert [p['id'] for p in pending['results']] == [profile.pk]
        assert pending['results'][0]['email'] == user.email  # admins see contact details

        with django_capture_on_commit_callbacks(execute=True) as callbacks:
            response = admin.post(f'/api/admin/producers/{profile.pk}/verification/', {'decision': 'VERIFIED'})
        assert response.status_code == 200
        assert response.data['verification_status'] == VerificationStatus.VERIFIED
        assert len(callbacks) == 1
        log = AuditLog.objects.get(action='producer.verified')
        assert log.actor == admin_user and log.metadata['previous'] == 'PENDING'

        product = make_product(user, categories['fruits'], published=False)
        assert as_user(user).post(f'/api/producers/me/products/{product.pk}/publish/').status_code == 200

    def test_rejection_needs_note_and_producer_can_resubmit(self, admin_user):
        user = make_producer(verified=False)
        profile = user.producer_profile
        admin = as_user(admin_user)
        url = f'/api/admin/producers/{profile.pk}/verification/'
        assert admin.post(url, {'decision': 'REJECTED'}).data['code'] == 'note_required'
        assert admin.post(url, {'decision': 'REJECTED', 'note': 'Upload your FSSAI number'}).status_code == 200

        producer_client = as_user(user)
        me = producer_client.get('/api/producers/me/').data
        assert me['verification_status'] == 'REJECTED' and me['verification_note'] == 'Upload your FSSAI number'
        producer_client.patch('/api/producers/me/', {'registration_number': 'FSSAI-123', 'verification_status': 'VERIFIED'})
        profile.refresh_from_db()
        assert profile.verification_status == 'REJECTED'  # producers cannot verify themselves
        assert producer_client.post('/api/producers/me/resubmit-verification/').data['verification_status'] == 'PENDING'


class TestSuspension:
    def test_suspend_blocks_login_and_reactivate_restores(self, admin_user, consumer):
        admin = as_user(admin_user)
        url = f'/api/admin/users/{consumer.pk}/'
        assert admin.post(f'{url}suspend/', {}).status_code == 400
        response = admin.post(f'{url}suspend/', {'reason': 'Fraudulent orders'})
        assert response.status_code == 200 and response.data['is_active'] is False

        login = {'email': consumer.email, 'password': PASSWORD, 'role': Role.CONSUMER}
        assert APIClient().post('/api/auth/login/', login).data['code'] == 'account_suspended'

        assert admin.post(f'{url}reactivate/').status_code == 200
        assert APIClient().post('/api/auth/login/', login).status_code == 200
        assert list(AuditLog.objects.filter(target_id=str(consumer.pk)).values_list('action', flat=True)) == [
            'user.reactivated', 'user.suspended',
        ]

    def test_suspension_revokes_sessions(self, admin_user, consumer):
        client = APIClient()
        client.post('/api/auth/login/', {'email': consumer.email, 'password': PASSWORD, 'role': Role.CONSUMER})
        as_user(admin_user).post(f'/api/admin/users/{consumer.pk}/suspend/', {'reason': 'x'})
        consumer.is_active = True  # even if reactivated directly in the DB, old refresh tokens stay revoked
        consumer.save()
        assert client.post('/api/auth/refresh/').status_code == 401

    def test_suspended_producer_listings_disappear(self, admin_user, product, api):
        as_user(admin_user).post(f'/api/admin/users/{product.producer.user.pk}/suspend/', {'reason': 'Investigating'})
        assert api.get(f'/api/products/{product.slug}/').status_code == 404

    def test_admin_cannot_suspend_self(self, admin_user):
        response = as_user(admin_user).post(f'/api/admin/users/{admin_user.pk}/suspend/', {'reason': 'x'})
        assert response.data['code'] == 'cannot_suspend_self'


class TestModerationAndOrders:
    def test_reject_requires_note_and_hides_listing(self, admin_user, product, api):
        admin = as_user(admin_user)
        url = f'/api/admin/products/{product.pk}/moderate/'
        assert admin.post(url, {'decision': 'REJECTED'}).data['code'] == 'note_required'
        assert admin.post(url, {'decision': 'REJECTED', 'note': 'Misleading description'}).status_code == 200
        assert api.get(f'/api/products/{product.slug}/').status_code == 404
        assert AuditLog.objects.filter(action='product.rejected').exists()

    def test_admin_can_list_and_update_any_order(self, admin_user, consumer, product):
        import uuid

        client = as_user(consumer)
        client.post('/api/cart/items/', {'product_slug': product.slug, 'quantity': 1})
        number = client.post(
            '/api/orders/checkout/',
            {'address': {'name': 'A', 'phone': '+919900000111', 'line1': 'x', 'city': 'y', 'state': 'z', 'postal_code': '123456'}, 'payment_method': 'COD'},
            format='json',
            HTTP_IDEMPOTENCY_KEY=uuid.uuid4().hex,
        ).data['number']
        admin = as_user(admin_user)
        assert admin.get('/api/admin/orders/', {'search': consumer.email}).data['count'] == 1
        detail = admin.get(f'/api/admin/orders/{number}/').data
        assert detail['consumer']['email'] == consumer.email
        fulfilment = detail['producer_orders'][0]['id']
        response = admin.post(f'/api/admin/orders/{number}/fulfillments/{fulfilment}/status/', {'status': 'CANCELLED', 'note': 'Payment dispute'})
        assert response.status_code == 200 and response.data['status'] == 'CANCELLED'
        assert AuditLog.objects.filter(action='order.status_changed').exists()


class TestCategories:
    def test_crud_and_protection(self, admin_user, product):
        admin = as_user(admin_user)
        response = admin.post('/api/admin/categories/', {'name': 'Grains & Pulses'})
        assert response.status_code == 201 and response.data['slug'] == 'grains-pulses'
        child = admin.post('/api/admin/categories/', {'name': 'Millets', 'parent': response.data['id']})
        assert child.status_code == 201
        # Only one level of nesting.
        assert admin.post('/api/admin/categories/', {'name': 'Deep', 'parent': child.data['id']}).status_code == 400

        fruits = Category.objects.get(slug='fruits')
        response = admin.delete(f'/api/admin/categories/{fruits.pk}/')
        assert response.status_code == 409 and response.data['code'] == 'category_in_use'
        assert admin.patch(f'/api/admin/categories/{fruits.pk}/', {'is_active': False}).status_code == 200
        assert admin.delete(f'/api/admin/categories/{child.data["id"]}/').status_code == 204


class TestReports:
    def test_overview_shape(self, admin_user, product):
        make_producer(verified=False)
        data = as_user(admin_user).get('/api/admin/reports/overview/', {'days': 7}).data
        assert data['producers']['pending_verification'] == 1
        assert data['products']['live'] == 1
        assert len(data['revenue']['daily']) == 7
        assert data['users']['by_role'][Role.ADMIN] == 1

    def test_audit_log_listing(self, admin_user):
        as_user(admin_user).post(f'/api/admin/users/{make_user().pk}/suspend/', {'reason': 'x'})
        logs = as_user(admin_user).get('/api/admin/audit-logs/', {'action': 'user.suspended'}).data
        assert logs['count'] == 1 and logs['results'][0]['actor_email'] == admin_user.email


def test_create_admin_command(db, monkeypatch):
    from django.core.management import call_command

    from apps.accounts.models import User

    monkeypatch.setenv('F2H_ADMIN_PASSWORD', 'Str0ngAdminPass')
    call_command('create_admin', email='Ops@Example.com', name='Ops')
    admin = User.objects.get(email='ops@example.com')
    assert admin.role == Role.ADMIN and admin.email_verified and not admin.is_superuser
    assert AuditLog.objects.filter(action='admin.provisioned').exists()
    assert settings.REFRESH_COOKIE_NAME  # sanity


def test_create_admin_if_missing_is_idempotent(db, monkeypatch):
    from django.core.management import call_command

    from apps.accounts.models import User

    monkeypatch.setenv('F2H_ADMIN_PASSWORD', 'Str0ngAdminPass')
    call_command('create_admin', email='boot@example.com', if_missing=True)
    call_command('create_admin', email='boot@example.com', if_missing=True)
    assert User.objects.filter(email='boot@example.com', role=Role.ADMIN).count() == 1


def test_create_admin_if_missing_needs_password(db, monkeypatch):
    from django.core.management import call_command
    from django.core.management.base import CommandError

    monkeypatch.delenv('F2H_ADMIN_PASSWORD', raising=False)
    with pytest.raises(CommandError, match='F2H_ADMIN_PASSWORD'):
        call_command('create_admin', email='boot2@example.com', if_missing=True)
