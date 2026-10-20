from datetime import timedelta

import pytest
from django.conf import settings
from django.core import mail
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import OneTimeCode, Role, User
from apps.producers.models import VerificationStatus

from .conftest import PASSWORD, as_user, last_code, make_producer, make_user

pytestmark = pytest.mark.django_db

COOKIE = settings.REFRESH_COOKIE_NAME

CONSUMER_PAYLOAD = {
    'full_name': 'Asha Menon',
    'email': 'Asha@Example.com',
    'phone_number': '+91 99000 00111',
    'password': PASSWORD,
    'confirm_password': PASSWORD,
}

PRODUCER_PAYLOAD = {
    **CONSUMER_PAYLOAD,
    'email': 'farmer@example.com',
    'farm_name': 'Hill View Farm',
    'description': 'Coffee and pepper estate.',
    'address_line1': 'Estate Road',
    'city': 'Madikeri',
    'district': 'Kodagu',
    'state': 'Karnataka',
    'postal_code': '571201',
}


def login(client, email, role, password=PASSWORD):
    return client.post('/api/auth/login/', {'email': email, 'password': password, 'role': role})


class TestRegistration:
    def test_consumer_registration_then_verification_then_login(self, api, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=True):
            response = api.post('/api/auth/consumer/register/', CONSUMER_PAYLOAD)
        assert response.status_code == 201
        user = User.objects.get(email='asha@example.com')
        assert user.role == Role.CONSUMER
        assert user.phone_number == '+919900000111'
        assert not user.email_verified
        assert user.password != PASSWORD  # hashed

        # Unverified accounts cannot sign in.
        response = login(api, 'asha@example.com', Role.CONSUMER)
        assert response.status_code == 403
        assert response.data['code'] == 'email_not_verified'

        code = last_code('asha@example.com')
        response = api.post('/api/auth/verify-email/', {'email': 'asha@example.com', 'code': code})
        assert response.status_code == 200

        response = login(api, 'ASHA@example.com', Role.CONSUMER)
        assert response.status_code == 200
        assert response.data['user']['role'] == Role.CONSUMER
        assert 'access' in response.data
        assert 'refresh' not in response.data  # refresh token only travels in the HttpOnly cookie
        cookie = response.cookies[COOKIE]
        assert cookie['httponly']
        assert cookie['path'] == '/api/auth/'
        assert cookie['samesite'] == 'Lax'

    def test_producer_registration_creates_pending_profile(self, api):
        response = api.post('/api/auth/producer/register/', PRODUCER_PAYLOAD)
        assert response.status_code == 201
        user = User.objects.get(email='farmer@example.com')
        assert user.role == Role.PRODUCER
        assert user.producer_profile.verification_status == VerificationStatus.PENDING
        assert user.producer_profile.slug == 'hill-view-farm'

    def test_producer_registration_requires_farm_details(self, api):
        payload = {**PRODUCER_PAYLOAD}
        payload.pop('farm_name')
        payload['phone_number'] = ''
        response = api.post('/api/auth/producer/register/', payload)
        assert response.status_code == 400
        assert response.data['code'] == 'validation_error'
        assert {'farm_name', 'phone_number'} <= set(response.data['errors'])

    @pytest.mark.parametrize('role', ['ADMIN', 'PRODUCER'])
    def test_role_cannot_be_escalated_through_registration(self, api, role):
        response = api.post('/api/auth/consumer/register/', {**CONSUMER_PAYLOAD, 'role': role, 'is_staff': True})
        assert response.status_code == 201
        user = User.objects.get(email='asha@example.com')
        assert user.role == Role.CONSUMER
        assert not user.is_staff and not user.is_superuser

    def test_duplicate_email_rejected_case_insensitively(self, api):
        make_user(email='asha@example.com')
        response = api.post('/api/auth/consumer/register/', CONSUMER_PAYLOAD)
        assert response.status_code == 400
        assert 'email' in response.data['errors']

    @pytest.mark.parametrize(
        'password, message_fragment',
        [('short1', 'too short'), ('allletterspassword', 'letter and one number'), ('1234567890123', 'entirely numeric')],
    )
    def test_weak_passwords_rejected(self, api, password, message_fragment):
        response = api.post('/api/auth/consumer/register/', {**CONSUMER_PAYLOAD, 'password': password, 'confirm_password': password})
        assert response.status_code == 400
        assert any(message_fragment in msg for msg in response.data['errors']['password'])

    def test_password_confirmation_must_match(self, api):
        response = api.post('/api/auth/consumer/register/', {**CONSUMER_PAYLOAD, 'confirm_password': 'Different123'})
        assert response.status_code == 400
        assert 'confirm_password' in response.data['errors']


class TestOneTimeCodes:
    def test_wrong_code_counts_attempts_and_locks(self, api):
        user = make_user(verified=False)
        from apps.accounts.services import issue_code

        code = issue_code(user, OneTimeCode.Purpose.EMAIL_VERIFICATION)
        wrong = '000000' if code != '000000' else '111111'
        for _ in range(settings.OTP_MAX_ATTEMPTS):
            assert api.post('/api/auth/verify-email/', {'email': user.email, 'code': wrong}).status_code == 400
        # Even the right code fails once attempts are exhausted.
        response = api.post('/api/auth/verify-email/', {'email': user.email, 'code': code})
        assert response.status_code == 400
        assert response.data['code'] == 'invalid_code'

    def test_code_is_single_use(self, api):
        user = make_user(verified=False)
        from apps.accounts.services import issue_code

        code = issue_code(user, OneTimeCode.Purpose.EMAIL_VERIFICATION)
        assert api.post('/api/auth/verify-email/', {'email': user.email, 'code': code}).status_code == 200
        assert api.post('/api/auth/verify-email/', {'email': user.email, 'code': code}).status_code == 400

    def test_expired_code_rejected(self, api):
        user = make_user(verified=False)
        from apps.accounts.services import issue_code

        code = issue_code(user, OneTimeCode.Purpose.EMAIL_VERIFICATION)
        OneTimeCode.objects.filter(user=user).update(expires_at=OneTimeCode.objects.get(user=user).created_at - timedelta(minutes=1))
        assert api.post('/api/auth/verify-email/', {'email': user.email, 'code': code}).status_code == 400

    def test_only_hash_is_stored(self):
        user = make_user(verified=False)
        from apps.accounts.services import issue_code

        code = issue_code(user, OneTimeCode.Purpose.EMAIL_VERIFICATION)
        assert OneTimeCode.objects.get(user=user).code_hash != code


class TestLogin:
    def test_invalid_credentials(self, api, consumer):
        response = login(api, consumer.email, Role.CONSUMER, password='WrongPass123')
        assert response.status_code == 401
        assert response.data['code'] == 'invalid_credentials'

    def test_unknown_email_gives_same_error(self, api, db):
        response = login(api, 'nobody@example.com', Role.CONSUMER)
        assert response.status_code == 401
        assert response.data['code'] == 'invalid_credentials'

    @pytest.mark.parametrize('portal', [Role.PRODUCER, Role.ADMIN])
    def test_consumer_cannot_sign_in_through_other_portals(self, api, consumer, portal):
        response = login(api, consumer.email, portal)
        assert response.status_code == 403
        assert response.data['code'] == 'wrong_portal'
        assert COOKIE not in response.cookies

    def test_producer_portal_login(self, api):
        user = make_producer(verified=False)
        response = login(api, user.email, Role.PRODUCER)
        assert response.status_code == 200
        assert response.data['user']['producer']['verification_status'] == VerificationStatus.PENDING

    def test_suspended_account(self, api):
        user = make_user(active=False)
        response = login(api, user.email, Role.CONSUMER)
        assert response.status_code == 403
        assert response.data['code'] == 'account_suspended'

    def test_admin_login_is_audited(self, api, admin_user):
        from apps.core.models import AuditLog

        assert login(api, admin_user.email, Role.ADMIN).status_code == 200
        login(api, admin_user.email, Role.ADMIN, password='WrongPass123')
        actions = list(AuditLog.objects.values_list('action', flat=True))
        assert 'auth.admin_login' in actions and 'auth.admin_login_failed' in actions


class TestSession:
    def test_refresh_rotates_cookie_and_old_cookie_is_rejected(self, consumer):
        client = APIClient()
        login(client, consumer.email, Role.CONSUMER)
        first = client.cookies[COOKIE].value

        response = client.post('/api/auth/refresh/')
        assert response.status_code == 200
        assert response.data['user']['email'] == consumer.email
        second = client.cookies[COOKIE].value
        assert second != first

        replay = APIClient()
        replay.cookies[COOKIE] = first
        response = replay.post('/api/auth/refresh/')
        assert response.status_code == 401
        assert response.data['code'] == 'session_expired'

    def test_refresh_without_cookie(self, api, db):
        response = api.post('/api/auth/refresh/')
        assert response.status_code == 401
        assert response.data['code'] == 'no_session'

    def test_logout_revokes_refresh_token(self, consumer):
        client = APIClient()
        login(client, consumer.email, Role.CONSUMER)
        token = client.cookies[COOKIE].value
        assert client.post('/api/auth/logout/').status_code == 200

        replay = APIClient()
        replay.cookies[COOKIE] = token
        assert replay.post('/api/auth/refresh/').status_code == 401

    def test_refresh_requires_csrf_token(self, consumer):
        client = APIClient(enforce_csrf_checks=True)
        client.get('/api/auth/csrf/')
        csrf = client.cookies['csrftoken'].value
        response = client.post('/api/auth/login/', {'email': consumer.email, 'password': PASSWORD, 'role': Role.CONSUMER}, HTTP_X_CSRFTOKEN=csrf)
        assert response.status_code == 200

        assert client.post('/api/auth/refresh/').status_code == 403
        assert client.post('/api/auth/refresh/', HTTP_X_CSRFTOKEN=csrf).status_code == 200

    def test_suspension_invalidates_refresh(self, consumer):
        client = APIClient()
        login(client, consumer.email, Role.CONSUMER)
        consumer.is_active = False
        consumer.save()
        assert client.post('/api/auth/refresh/').status_code == 401

    def test_expired_access_token_rejected(self, api, consumer):
        token = AccessToken.for_user(consumer)
        token.set_exp(lifetime=-timedelta(seconds=1))
        api.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = api.get('/api/auth/me/')
        assert response.status_code == 401
        assert response.data['code'] == 'token_invalid'

    def test_tampered_token_rejected(self, api, consumer):
        token = str(AccessToken.for_user(consumer))
        api.credentials(HTTP_AUTHORIZATION=f'Bearer {token[:-4]}abcd')
        assert api.get('/api/auth/me/').status_code == 401

    def test_access_token_stops_working_after_suspension(self, api, consumer):
        api.credentials(HTTP_AUTHORIZATION=f'Bearer {AccessToken.for_user(consumer)}')
        assert api.get('/api/auth/me/').status_code == 200
        consumer.is_active = False
        consumer.save()
        assert api.get('/api/auth/me/').status_code == 401


class TestPasswordRecovery:
    def test_forgot_password_does_not_reveal_accounts(self, api, consumer, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=True):
            known = api.post('/api/auth/password/forgot/', {'email': consumer.email})
            unknown = api.post('/api/auth/password/forgot/', {'email': 'ghost@example.com'})
        assert known.status_code == unknown.status_code == 200
        assert known.data == unknown.data
        assert [m.to for m in mail.outbox] == [[consumer.email]]

    def test_reset_flow_revokes_existing_sessions(self, consumer, django_capture_on_commit_callbacks):
        client = APIClient()
        login(client, consumer.email, Role.CONSUMER)
        old_refresh = client.cookies[COOKIE].value

        anon = APIClient()
        with django_capture_on_commit_callbacks(execute=True):
            anon.post('/api/auth/password/forgot/', {'email': consumer.email})
        code = last_code(consumer.email)
        new_password = 'NewHarvest2027'
        response = anon.post(
            '/api/auth/password/reset/',
            {'email': consumer.email, 'code': code, 'new_password': new_password, 'confirm_password': new_password},
        )
        assert response.status_code == 200
        assert login(APIClient(), consumer.email, Role.CONSUMER, password=new_password).status_code == 200
        assert login(APIClient(), consumer.email, Role.CONSUMER).status_code == 401

        replay = APIClient()
        replay.cookies[COOKIE] = old_refresh
        assert replay.post('/api/auth/refresh/').status_code == 401

    def test_change_password_requires_current_password(self, consumer):
        client = as_user(consumer)
        response = client.post(
            '/api/auth/password/change/',
            {'current_password': 'nope', 'new_password': 'Another2027x', 'confirm_password': 'Another2027x'},
        )
        assert response.status_code == 400
        response = client.post(
            '/api/auth/password/change/',
            {'current_password': PASSWORD, 'new_password': 'Another2027x', 'confirm_password': 'Another2027x'},
        )
        assert response.status_code == 200
        consumer.refresh_from_db()
        assert consumer.check_password('Another2027x')


class TestProfile:
    def test_me_get_and_update(self, consumer):
        client = as_user(consumer)
        assert client.get('/api/auth/me/').data['email'] == consumer.email
        response = client.patch('/api/auth/me/', {'full_name': 'New Name', 'role': Role.ADMIN, 'email': 'x@example.com'})
        assert response.status_code == 200
        consumer.refresh_from_db()
        assert consumer.full_name == 'New Name'
        assert consumer.role == Role.CONSUMER
        assert consumer.email != 'x@example.com'

    def test_me_requires_authentication(self, api, db):
        response = api.get('/api/auth/me/')
        assert response.status_code == 401
        assert response.data['code'] == 'not_authenticated'


def test_login_is_rate_limited(api, consumer, monkeypatch):
    from django.core.cache import cache
    from rest_framework.throttling import ScopedRateThrottle

    from apps.accounts.views import LoginView

    cache.clear()
    monkeypatch.setattr(LoginView, 'throttle_classes', [ScopedRateThrottle])
    monkeypatch.setattr(ScopedRateThrottle, 'THROTTLE_RATES', {'auth_login': '3/min'})
    codes = [login(api, consumer.email, Role.CONSUMER, password='Wrong12345').status_code for _ in range(4)]
    assert codes == [401, 401, 401, 429]
    response = login(api, consumer.email, Role.CONSUMER)
    assert response.data['code'] == 'throttled' and response.data['retry_after'] > 0
