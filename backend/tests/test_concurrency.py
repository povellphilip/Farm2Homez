"""Concurrent checkout. Needs PostgreSQL row locks; run with scripts/test_postgres.py."""
import threading
import uuid

import pytest
from django.db import connection, connections

from apps.cart.models import CartItem
from apps.core.exceptions import ServiceError
from apps.orders import services
from apps.orders.models import Order

from .conftest import make_producer, make_product, make_user

ADDRESS = {'name': 'A', 'phone': '+919900000111', 'line1': 'x', 'city': 'Kochi', 'state': 'Kerala', 'postal_code': '682001'}

pytestmark = [
    pytest.mark.postgres,
    pytest.mark.django_db(transaction=True),
    pytest.mark.skipif(connection.vendor != 'postgresql', reason='row-level locking requires PostgreSQL'),
]


def run_concurrently(calls):
    barrier = threading.Barrier(len(calls))
    results = [None] * len(calls)

    def worker(index, call):
        try:
            barrier.wait()
            results[index] = ('ok', call())
        except ServiceError as exc:
            results[index] = ('error', exc.error_code)
        except Exception as exc:  # noqa: BLE001
            results[index] = ('crash', repr(exc))
        finally:
            connections.close_all()

    threads = [threading.Thread(target=worker, args=(i, call)) for i, call in enumerate(calls)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=60)
    return results


def test_last_units_cannot_be_sold_twice(categories):
    product = make_product(make_producer(), categories['honey-bee-products'], stock=5)
    buyers = [make_user() for _ in range(12)]
    for buyer in buyers:
        CartItem.objects.create(user=buyer, product=product, quantity=1)

    results = run_concurrently([
        (lambda b=buyer: services.checkout(b, idempotency_key=uuid.uuid4().hex, address=ADDRESS, payment_method='COD'))
        for buyer in buyers
    ])

    outcomes = [kind for kind, _ in results]
    assert 'crash' not in outcomes, results
    assert outcomes.count('ok') == 5
    assert {code for kind, code in results if kind == 'error'} == {'cart_invalid'}
    product.refresh_from_db()
    assert product.stock_quantity == 0
    assert Order.objects.count() == 5


def test_double_submit_with_same_key_creates_one_order(categories):
    product = make_product(make_producer(), categories['fruits'], stock=50)
    buyer = make_user()
    CartItem.objects.create(user=buyer, product=product, quantity=2)
    key = uuid.uuid4().hex

    results = run_concurrently([
        lambda: services.checkout(buyer, idempotency_key=key, address=ADDRESS, payment_method='COD') for _ in range(4)
    ])

    assert all(kind == 'ok' for kind, _ in results), results
    numbers = {value[0].number for _, value in results}
    assert len(numbers) == 1
    assert sum(1 for _, (order, created) in results if created) == 1
    product.refresh_from_db()
    assert product.stock_quantity == 48
