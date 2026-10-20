import uuid
from decimal import Decimal

import pytest

from apps.cart.models import CartItem
from apps.orders.models import Order, OrderItem, OrderStatus, ProducerOrder
from apps.payments.models import PaymentStatus

from .conftest import as_user, make_producer, make_product, make_user

pytestmark = pytest.mark.django_db

ADDRESS = {
    'name': 'Asha Menon', 'phone': '+919900000111', 'line1': '12 MG Road', 'city': 'Kochi',
    'state': 'Kerala', 'postal_code': '682001',
}


def add(client, product, quantity=1):
    return client.post('/api/cart/items/', {'product_slug': product.slug, 'quantity': quantity})


def checkout(client, key=None, **overrides):
    payload = {'address': ADDRESS, 'payment_method': 'COD', **overrides}
    return client.post('/api/orders/checkout/', payload, format='json', HTTP_IDEMPOTENCY_KEY=key or uuid.uuid4().hex)


@pytest.fixture
def shop(categories):
    """Two farms with products priced around the free-delivery threshold (500)."""
    farm_a = make_producer(farm_name='Farm A')
    farm_b = make_producer(farm_name='Farm B')
    return {
        'farm_a': farm_a,
        'farm_b': farm_b,
        'avocado': make_product(farm_a, categories['fruits'], name='Avocado', price='320.00', stock=10),
        'rambutan': make_product(farm_a, categories['fruits'], name='Rambutan', price='260.00', stock=5, moq=2),
        'honey': make_product(farm_b, categories['honey-bee-products'], name='Honey', price='150.00', stock=3),
    }


class TestCart:
    def test_add_merge_update_remove(self, consumer, shop):
        client = as_user(consumer)
        assert add(client, shop['avocado']).status_code == 201
        response = add(client, shop['avocado'], 2)
        assert response.data['items'][0]['quantity'] == 3
        assert response.data['subtotal'] == '960.00'

        item_id = response.data['items'][0]['id']
        response = client.patch(f'/api/cart/items/{item_id}/', {'quantity': 1})
        assert response.data['total'] == '369.00'  # 320 + 49 delivery (below 500)

        response = client.delete(f'/api/cart/items/{item_id}/')
        assert response.data['items'] == [] and response.data['can_checkout'] is False

    def test_cart_validates_minimum_and_stock(self, consumer, shop):
        client = as_user(consumer)
        response = add(client, shop['rambutan'], 1)
        assert response.status_code == 400 and response.data['code'] == 'below_minimum'
        response = add(client, shop['rambutan'], 6)
        assert response.data['code'] == 'insufficient_stock'

    def test_cannot_add_unlisted_product(self, consumer, categories):
        hidden = make_product(make_producer(verified=False), categories['fruits'])
        assert add(as_user(consumer), hidden).status_code == 404

    def test_cart_reports_items_that_became_unavailable(self, consumer, shop):
        client = as_user(consumer)
        add(client, shop['honey'], 2)
        shop['honey'].stock_quantity = 1
        shop['honey'].save()
        response = client.get('/api/cart/')
        assert response.data['items'][0]['issue'] == 'Only 1 kg available.'
        assert response.data['can_checkout'] is False

    def test_cart_is_private(self, consumer, shop):
        client = as_user(consumer)
        add(client, shop['avocado'])
        item_id = client.get('/api/cart/').data['items'][0]['id']
        other = as_user(make_user())
        assert other.patch(f'/api/cart/items/{item_id}/', {'quantity': 5}).status_code == 404
        assert other.delete(f'/api/cart/items/{item_id}/').status_code == 404
        assert other.get('/api/cart/').data['items'] == []

    def test_producers_and_admins_have_no_cart(self, shop, admin_user):
        assert as_user(shop['farm_a']).get('/api/cart/').status_code == 403
        assert as_user(admin_user).get('/api/cart/').status_code == 403


class TestCheckout:
    def test_multi_producer_order_split_and_server_totals(self, consumer, shop, django_capture_on_commit_callbacks):
        client = as_user(consumer)
        add(client, shop['avocado'], 2)  # 640 at farm A -> free delivery
        add(client, shop['honey'], 1)  # 150 at farm B -> 49 delivery
        with django_capture_on_commit_callbacks(execute=True) as callbacks:
            response = checkout(client, expected_total='839.00', notes='Leave at the gate')
        assert response.status_code == 201, response.data
        data = response.data
        assert data['subtotal'] == '790.00'
        assert data['delivery_total'] == '49.00'
        assert data['total'] == '839.00'
        assert data['status'] == OrderStatus.PENDING
        assert data['payment']['status'] == PaymentStatus.PENDING and data['payment']['is_test'] is False
        assert len(data['producer_orders']) == 2
        by_farm = {po['producer']['farm_name']: po for po in data['producer_orders']}
        assert by_farm['Farm A']['total'] == '640.00'
        assert by_farm['Farm B']['total'] == '199.00'
        assert len(callbacks) == 3  # consumer confirmation + one email per farm

        shop['avocado'].refresh_from_db()
        shop['honey'].refresh_from_db()
        assert shop['avocado'].stock_quantity == 8
        assert shop['honey'].stock_quantity == 2
        assert not CartItem.objects.filter(user=consumer).exists()

    def test_order_items_snapshot_the_listing(self, consumer, shop):
        client = as_user(consumer)
        add(client, shop['avocado'], 1)
        number = checkout(client).data['number']
        shop['avocado'].price = Decimal('999.00')
        shop['avocado'].name = 'Renamed'
        shop['avocado'].save()
        item = OrderItem.objects.get(producer_order__order__number=number)
        assert (item.product_name, item.unit_price, item.unit) == ('Avocado', Decimal('320.00'), 'kg')
        assert client.get(f'/api/orders/{number}/').data['producer_orders'][0]['items'][0]['product_name'] == 'Avocado'

    def test_same_idempotency_key_never_creates_a_second_order(self, consumer, shop):
        client = as_user(consumer)
        add(client, shop['avocado'], 1)
        key = uuid.uuid4().hex
        first = checkout(client, key)
        add(client, shop['avocado'], 1)  # even with a new cart, the key replays the original
        second = checkout(client, key)
        assert first.status_code == 201 and second.status_code == 200
        assert first.data['number'] == second.data['number']
        assert Order.objects.filter(consumer=consumer).count() == 1

    def test_idempotency_key_required(self, consumer, shop):
        client = as_user(consumer)
        add(client, shop['avocado'])
        response = client.post('/api/orders/checkout/', {'address': ADDRESS, 'payment_method': 'COD'}, format='json')
        assert response.status_code == 400 and response.data['code'] == 'idempotency_key_required'

    def test_empty_cart(self, consumer, db):
        response = checkout(as_user(consumer))
        assert response.status_code == 400 and response.data['code'] == 'cart_empty'

    def test_stock_revalidated_at_checkout(self, consumer, shop):
        client = as_user(consumer)
        add(client, shop['honey'], 3)
        shop['honey'].stock_quantity = 2
        shop['honey'].save()
        response = checkout(client)
        assert response.status_code == 409 and response.data['code'] == 'cart_invalid'
        shop['honey'].refresh_from_db()
        assert shop['honey'].stock_quantity == 2
        assert not Order.objects.exists()

    def test_unpublished_product_blocks_checkout(self, consumer, shop):
        client = as_user(consumer)
        add(client, shop['avocado'])
        shop['avocado'].status = 'UNPUBLISHED'
        shop['avocado'].save()
        assert checkout(client).data['code'] == 'cart_invalid'

    def test_price_change_detected(self, consumer, shop):
        client = as_user(consumer)
        add(client, shop['avocado'], 1)
        response = checkout(client, expected_total='100.00')
        assert response.status_code == 409 and response.data['code'] == 'price_changed'
        assert response.data['errors']['total'] == ['369.00']

    def test_saved_address_must_belong_to_consumer(self, consumer, shop):
        from apps.consumers.models import Address

        foreign = Address.objects.create(
            user=make_user(), recipient_name='X', phone_number='+919999999999', line1='a', city='b', state='c', postal_code='123456'
        )
        client = as_user(consumer)
        add(client, shop['avocado'])
        response = client.post('/api/orders/checkout/', {'address_id': foreign.pk, 'payment_method': 'COD'}, format='json', HTTP_IDEMPOTENCY_KEY=uuid.uuid4().hex)
        assert response.status_code == 404

    def test_save_address_option(self, consumer, shop):
        client = as_user(consumer)
        add(client, shop['avocado'])
        checkout(client, save_address=True)
        assert consumer.addresses.get().is_default

    def test_mock_payment_is_flagged_as_test(self, consumer, shop):
        client = as_user(consumer)
        add(client, shop['avocado'])
        payment = checkout(client, payment_method='MOCK_ONLINE').data['payment']
        assert payment == {**payment, 'status': PaymentStatus.PAID, 'is_test': True, 'provider': 'MOCK_ONLINE'}
        assert payment['reference'].startswith('TEST-')

    def test_mock_payment_unavailable_when_disabled(self, consumer, shop, settings, api):
        settings.PAYMENTS_MOCK_ENABLED = False
        assert [m['code'] for m in api.get('/api/orders/payment-methods/').data] == ['COD']
        client = as_user(consumer)
        add(client, shop['avocado'])
        assert checkout(client, payment_method='MOCK_ONLINE').data['code'] == 'payment_method_unavailable'


def place_order(consumer, *products):
    client = as_user(consumer)
    for product in products:
        add(client, product, product.min_order_quantity)
    return Order.objects.get(number=checkout(client).data['number'])


def move(user, producer_order, status, note=''):
    return as_user(user).post(f'/api/producers/me/orders/{producer_order.pk}/status/', {'status': status, 'note': note})


class TestFulfilment:
    def test_full_lifecycle_completes_order_and_cod_payment(self, consumer, shop):
        order = place_order(consumer, shop['honey'])
        po = order.producer_orders.get()
        farm = shop['farm_b']
        for status in ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED']:
            response = move(farm, po, status)
            assert response.status_code == 200, response.data
        order.refresh_from_db()
        assert order.status == OrderStatus.COMPLETED
        assert order.payment.status == PaymentStatus.PAID
        po.refresh_from_db()
        assert po.confirmed_at and po.shipped_at and po.delivered_at
        assert [e.to_status for e in po.events.all()] == ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED']

    @pytest.mark.parametrize('start, target', [('PENDING', 'DELIVERED'), ('PENDING', 'SHIPPED'), ('DELIVERED', 'CANCELLED')])
    def test_invalid_transitions_rejected(self, consumer, shop, start, target):
        order = place_order(consumer, shop['honey'])
        po = order.producer_orders.get()
        ProducerOrder.objects.filter(pk=po.pk).update(status=start)
        response = move(shop['farm_b'], po, target, note='x')
        assert response.status_code == 409 and response.data['code'] == 'invalid_transition'

    def test_rejection_requires_reason_and_restocks(self, consumer, shop):
        order = place_order(consumer, shop['honey'])
        po = order.producer_orders.get()
        assert move(shop['farm_b'], po, 'REJECTED').data['code'] == 'note_required'
        assert move(shop['farm_b'], po, 'REJECTED', 'Sold out at the market').status_code == 200
        shop['honey'].refresh_from_db()
        assert shop['honey'].stock_quantity == 3
        order.refresh_from_db()
        assert order.status == OrderStatus.CANCELLED
        assert order.payment.status == PaymentStatus.CANCELLED

    def test_partial_rejection_keeps_rest_of_order(self, consumer, shop):
        order = place_order(consumer, shop['avocado'], shop['honey'])
        po_b = order.producer_orders.get(producer=shop['farm_b'].producer_profile)
        move(shop['farm_b'], po_b, 'REJECTED', 'No stock')
        order.refresh_from_db()
        assert order.status == OrderStatus.PENDING
        po_a = order.producer_orders.get(producer=shop['farm_a'].producer_profile)
        move(shop['farm_a'], po_a, 'CONFIRMED')
        order.refresh_from_db()
        assert order.status == OrderStatus.IN_PROGRESS

    def test_consumer_can_cancel_before_processing(self, consumer, shop):
        order = place_order(consumer, shop['avocado'], shop['honey'])
        po_a = order.producer_orders.get(producer=shop['farm_a'].producer_profile)
        for status in ['CONFIRMED', 'PROCESSING']:
            move(shop['farm_a'], po_a, status)
        response = as_user(consumer).post(f'/api/orders/{order.number}/cancel/', {'reason': 'Changed my mind'})
        assert response.status_code == 200
        statuses = {po['producer']['farm_name']: po['status'] for po in response.data['producer_orders']}
        assert statuses == {'Farm A': 'PROCESSING', 'Farm B': 'CANCELLED'}
        shop['honey'].refresh_from_db()
        assert shop['honey'].stock_quantity == 3
        # Nothing cancellable remains.
        assert as_user(consumer).post(f'/api/orders/{order.number}/cancel/').status_code == 409

    def test_mock_payment_refunded_when_cancelled(self, consumer, shop):
        client = as_user(consumer)
        add(client, shop['honey'])
        number = checkout(client, payment_method='MOCK_ONLINE').data['number']
        client.post(f'/api/orders/{number}/cancel/')
        assert Order.objects.get(number=number).payment.status == PaymentStatus.REFUNDED

    def test_producer_cannot_cancel_pending_instead_of_rejecting(self, consumer, shop):
        po = place_order(consumer, shop['honey']).producer_orders.get()
        assert move(shop['farm_b'], po, 'CANCELLED', 'x').data['code'] == 'invalid_transition'


class TestOrderPrivacy:
    def test_consumer_sees_only_own_orders(self, consumer, shop):
        order = place_order(consumer, shop['avocado'])
        stranger = as_user(make_user())
        assert stranger.get(f'/api/orders/{order.number}/').status_code == 404
        assert stranger.post(f'/api/orders/{order.number}/cancel/').status_code == 404
        assert stranger.get('/api/orders/').data['count'] == 0
        assert as_user(consumer).get('/api/orders/').data['count'] == 1

    def test_producer_sees_only_their_part(self, consumer, shop):
        order = place_order(consumer, shop['avocado'], shop['honey'])
        response = as_user(shop['farm_a']).get('/api/producers/me/orders/')
        assert response.data['count'] == 1
        record = response.data['results'][0]
        assert record['order_number'] == order.number
        assert [item['product_name'] for item in record['items']] == ['Avocado']
        assert record['shipping']['name'] == 'Asha Menon'
        assert 'email' not in str(record).lower()  # no consumer email exposed to producers

        po_b = order.producer_orders.get(producer=shop['farm_b'].producer_profile)
        assert as_user(shop['farm_a']).get(f'/api/producers/me/orders/{po_b.pk}/').status_code == 404
        assert move(shop['farm_a'], po_b, 'CONFIRMED').status_code == 404

    def test_role_boundaries(self, consumer, shop, api):
        order = place_order(consumer, shop['avocado'])
        po = order.producer_orders.get()
        assert as_user(consumer).post(f'/api/producers/me/orders/{po.pk}/status/', {'status': 'CONFIRMED'}).status_code == 403
        assert as_user(shop['farm_a']).get('/api/orders/').status_code == 403
        assert as_user(shop['farm_a']).post('/api/orders/checkout/', {}, HTTP_IDEMPOTENCY_KEY='abcdefgh123').status_code == 403
        assert api.get('/api/orders/').status_code == 401


class TestProductDeletionWithOrders:
    def test_delete_blocked_while_orders_open_then_allowed(self, consumer, shop):
        order = place_order(consumer, shop['honey'])
        farm = as_user(shop['farm_b'])
        response = farm.delete(f'/api/producers/me/products/{shop["honey"].pk}/')
        assert response.status_code == 409 and response.data['code'] == 'product_has_open_orders'
        move(shop['farm_b'], order.producer_orders.get(), 'REJECTED', 'x')
        assert farm.delete(f'/api/producers/me/products/{shop["honey"].pk}/').status_code == 204
        item = OrderItem.objects.get(producer_order__order=order)
        assert item.product is None and item.product_name == 'Honey'  # history survives deletion
