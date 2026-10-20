"""Inquiries, reviews, addresses, favourites, analytics and health checks."""
import uuid

import pytest
from django.core import mail

from apps.analytics.models import ProductViewDaily
from apps.inquiries.models import Inquiry

from .conftest import as_user, make_producer, make_user

pytestmark = pytest.mark.django_db


class TestInquiries:
    def test_anonymous_inquiry_to_producer_and_reply(self, api, product, django_capture_on_commit_callbacks):
        payload = {'product_slug': product.slug, 'name': 'Ravi', 'email': 'ravi@example.com', 'subject': 'Bulk order', 'message': 'Can you supply 50 kg weekly?'}
        with django_capture_on_commit_callbacks(execute=True):
            response = api.post('/api/inquiries/', payload)
        assert response.status_code == 201
        assert {tuple(m.to) for m in mail.outbox} == {(product.producer.user.email,), ('ravi@example.com',)}

        owner = as_user(product.producer.user)
        inquiries = owner.get('/api/producers/me/inquiries/').data
        assert inquiries['count'] == 1 and inquiries['results'][0]['product']['slug'] == product.slug
        inquiry_id = inquiries['results'][0]['id']
        assert owner.post(f'/api/producers/me/inquiries/{inquiry_id}/reply/', {'message': 'Yes, from next week.'}).status_code == 201
        assert Inquiry.objects.get().status == 'ANSWERED'
        assert as_user(make_producer()).get(f'/api/producers/me/inquiries/{inquiry_id}/').status_code == 404

        assert owner.post(f'/api/producers/me/inquiries/{inquiry_id}/close/').status_code == 200
        assert owner.post(f'/api/producers/me/inquiries/{inquiry_id}/reply/', {'message': 'x'}).status_code == 409

    def test_anonymous_inquiry_needs_contact_details(self, api, product):
        response = api.post('/api/inquiries/', {'product_slug': product.slug, 'subject': 'Hi', 'message': 'Is this available?'})
        assert response.status_code == 400 and set(response.data['errors']) == {'name', 'email'}

    def test_signed_in_consumer_thread(self, consumer, product):
        client = as_user(consumer)
        response = client.post('/api/inquiries/', {'producer_slug': product.producer.slug, 'subject': 'Visit', 'message': 'Can I visit the farm?', 'email': 'spoof@example.com'})
        assert response.data['email'] == consumer.email  # signed-in sender identity comes from the account
        inquiry_id = response.data['id']
        assert client.get('/api/inquiries/mine/').data['count'] == 1
        assert client.post(f'/api/inquiries/mine/{inquiry_id}/reply/', {'message': 'Any weekend works.'}).status_code == 201
        assert as_user(make_user()).get(f'/api/inquiries/mine/{inquiry_id}/').status_code == 404

    def test_platform_contact_message_goes_to_admins(self, api, admin_user, django_capture_on_commit_callbacks, settings):
        with django_capture_on_commit_callbacks(execute=True):
            api.post('/api/inquiries/', {'name': 'Meera', 'email': 'meera@example.com', 'subject': 'Partnership', 'message': 'We run a co-operative.'})
        assert any(settings.ADMIN_NOTIFICATION_EMAIL in m.to for m in mail.outbox)
        admin = as_user(admin_user)
        platform = admin.get('/api/admin/inquiries/', {'scope': 'platform'}).data
        assert platform['count'] == 1
        assert admin.post(f'/api/admin/inquiries/{platform["results"][0]["id"]}/reply/', {'message': 'Thanks!'}).status_code == 201

    def test_unknown_or_hidden_farm(self, api):
        hidden = make_producer(verified=False)
        payload = {'producer_slug': hidden.producer_profile.slug, 'name': 'a', 'email': 'a@example.com', 'subject': 's', 'message': 'message text'}
        assert api.post('/api/inquiries/', payload).status_code == 404


def deliver(consumer, product):
    client = as_user(consumer)
    client.post('/api/cart/items/', {'product_slug': product.slug, 'quantity': 1})
    address = {'name': 'A', 'phone': '+919900000111', 'line1': 'x', 'city': 'y', 'state': 'z', 'postal_code': '123456'}
    order = client.post('/api/orders/checkout/', {'address': address, 'payment_method': 'COD'}, format='json', HTTP_IDEMPOTENCY_KEY=uuid.uuid4().hex)
    po = order.data['producer_orders'][0]['id']
    farm = as_user(product.producer.user)
    for status in ['CONFIRMED', 'SHIPPED', 'DELIVERED']:
        farm.post(f'/api/producers/me/orders/{po}/status/', {'status': status})


class TestReviews:
    def test_only_buyers_with_delivered_orders_can_review(self, consumer, product, api):
        client = as_user(consumer)
        payload = {'product': product.slug, 'rating': 5, 'comment': 'Creamy and ripe.'}
        assert client.post('/api/reviews/', payload).data['code'] == 'not_purchased'
        deliver(consumer, product)
        response = client.post('/api/reviews/', payload)
        assert response.status_code == 201
        assert response.data['reviewer'] == consumer.full_name.split()[0]
        assert client.post('/api/reviews/', payload).status_code == 409

        public = api.get('/api/reviews/', {'product': product.slug}).data
        assert public['count'] == 1
        detail = api.get(f'/api/products/{product.slug}/').data
        assert detail['average_rating'] == 5.0 and detail['review_count'] == 1

    def test_rating_range(self, consumer, product):
        deliver(consumer, product)
        assert as_user(consumer).post('/api/reviews/', {'product': product.slug, 'rating': 6}).status_code == 400

    def test_cannot_edit_others_reviews(self, consumer, product):
        deliver(consumer, product)
        review_id = as_user(consumer).post('/api/reviews/', {'product': product.slug, 'rating': 4}).data['id']
        assert as_user(make_user()).patch(f'/api/reviews/{review_id}/', {'rating': 1}).status_code == 404


class TestConsumerAccount:
    ADDRESS = {'recipient_name': 'Asha', 'phone_number': '+919900000111', 'line1': '12 MG Road', 'city': 'Kochi', 'state': 'Kerala', 'postal_code': '682001'}

    def test_address_book_default_handling(self, consumer):
        client = as_user(consumer)
        first = client.post('/api/consumers/me/addresses/', self.ADDRESS).data
        second = client.post('/api/consumers/me/addresses/', {**self.ADDRESS, 'label': 'Office'}).data
        assert first['is_default'] and not second['is_default']
        client.post(f'/api/consumers/me/addresses/{second["id"]}/set-default/')
        defaults = [a['id'] for a in client.get('/api/consumers/me/addresses/').data if a['is_default']]
        assert defaults == [second['id']]
        client.delete(f'/api/consumers/me/addresses/{second["id"]}/')
        assert client.get('/api/consumers/me/addresses/').data[0]['is_default']
        assert as_user(make_user()).get(f'/api/consumers/me/addresses/{first["id"]}/').status_code == 404

    def test_favorites(self, consumer, product):
        client = as_user(consumer)
        assert client.post('/api/consumers/me/favorites/products/', {'product_slug': product.slug}).status_code == 201
        assert client.post('/api/consumers/me/favorites/products/', {'product_slug': product.slug}).status_code == 200
        assert client.get('/api/consumers/me/favorites/products/').data['count'] == 1
        assert client.delete(f'/api/consumers/me/favorites/products/{product.slug}/').status_code == 204

        slug = product.producer.slug
        assert client.post('/api/consumers/me/favorites/producers/', {'producer_slug': slug}).status_code == 201
        assert client.get('/api/consumers/me/favorites/producers/').data['results'][0]['producer']['slug'] == slug


class TestAnalytics:
    def test_view_counting_ignores_owner(self, api, product):
        assert api.post('/api/analytics/product-views/', {'product': product.slug}).status_code == 202
        api.post('/api/analytics/product-views/', {'product': product.slug})
        as_user(product.producer.user).post('/api/analytics/product-views/', {'product': product.slug})
        assert ProductViewDaily.objects.get(product=product).views == 2

    def test_producer_overview_uses_real_data(self, consumer, product, categories):
        deliver(consumer, product)
        data = as_user(product.producer.user).get('/api/analytics/producer/overview/').data
        assert data['orders']['by_status'] == {'DELIVERED': 1}
        assert str(data['sales']['revenue_delivered']) == '369.00'
        assert data['sales']['top_products'][0]['product_name'] == product.name
        assert data['listings']['total'] == 1

    def test_overview_is_producer_only(self, consumer):
        assert as_user(consumer).get('/api/analytics/producer/overview/').status_code == 403


class TestPlatform:
    def test_health_endpoints(self, api):
        assert api.get('/api/health/live/').json() == {'status': 'ok'}
        assert api.get('/api/health/').json() == {'status': 'ok', 'database': 'ok'}

    def test_openapi_schema_generates(self, api):
        response = api.get('/api/schema/')
        assert response.status_code == 200
        assert b'/api/orders/checkout/' in response.content

    def test_unknown_route_returns_json_404(self, api):
        response = api.get('/api/does-not-exist/')
        assert response.status_code == 404


def test_seed_demo_is_idempotent_and_public(api, settings):
    from django.core.management import call_command

    call_command('seed_demo', with_admin=True)
    call_command('seed_demo', with_admin=True)
    response = api.get('/api/products/', {'page_size': 100})
    assert response.data['count'] == 15
    assert api.get('/api/producers/').data['count'] == 4  # the pending farm stays hidden

    settings.IS_PRODUCTION = True
    with pytest.raises(Exception, match='development only'):
        call_command('seed_demo')
