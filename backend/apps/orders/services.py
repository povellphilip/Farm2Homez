"""Checkout and order fulfilment rules."""
import logging
import secrets
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import status

from apps.accounts.models import Role, User
from apps.cart.models import CartItem
from apps.core import audit
from apps.core.exceptions import Conflict, ServiceError
from apps.core.notifications import send_email
from apps.payments import providers
from apps.products.models import Product

from . import pricing
from .models import (
    TRANSITIONS,
    VOID_STATUSES,
    FulfillmentStatus,
    Order,
    OrderItem,
    OrderStatus,
    OrderStatusEvent,
    ProducerOrder,
)

logger = logging.getLogger(__name__)

ADDRESS_FIELDS = ['name', 'phone', 'line1', 'line2', 'city', 'district', 'state', 'postal_code', 'country']


def _new_order_number():
    while True:
        number = f'F2H-{timezone.localdate():%y%m%d}-{secrets.token_hex(3).upper()}'
        if not Order.objects.filter(number=number).exists():
            return number


def checkout(consumer, *, idempotency_key, address, payment_method, notes='', expected_total=None):
    """Create an order from the consumer's cart.

    Returns (order, created). Repeating a request with the same idempotency key returns
    the original order instead of placing a second one.
    """
    existing = Order.objects.filter(consumer=consumer, idempotency_key=idempotency_key).first()
    if existing:
        return existing, False
    provider = providers.get_provider(payment_method)
    try:
        return _place_order(consumer, idempotency_key, address, provider, notes, expected_total)
    except IntegrityError:
        # Safety net for databases without row locks: a concurrent request with the same key won.
        existing = Order.objects.filter(consumer=consumer, idempotency_key=idempotency_key).first()
        if existing is None:
            raise
        return existing, False


@transaction.atomic
def _place_order(consumer, idempotency_key, address, provider, notes, expected_total):
    # Serialise checkouts per consumer, then re-check the key: a double-submitted request waits
    # here and receives the order the first request created instead of finding an empty cart.
    User.objects.select_for_update().filter(pk=consumer.pk).first()
    existing = Order.objects.filter(consumer=consumer, idempotency_key=idempotency_key).first()
    if existing:
        return existing, False

    cart = list(CartItem.objects.filter(user=consumer).order_by('product_id'))
    if not cart:
        raise ServiceError('Your cart is empty.', code='cart_empty')

    # Lock every product row in a consistent order so concurrent checkouts serialise per product
    # and cannot deadlock. (SQLite has no row locks; the conditional update below still prevents overselling.)
    products = {
        product.pk: product
        for product in Product.objects.select_related('producer__user', 'category')
        .select_for_update(of=('self',))
        .filter(pk__in=[item.product_id for item in cart])
        .order_by('pk')
    }

    problems = {}
    for item in cart:
        product = products[item.product_id]
        if not product.is_purchasable:
            problems[str(item.pk)] = f'{product.name} is no longer available.'
        elif item.quantity < product.min_order_quantity:
            problems[str(item.pk)] = f'The minimum order for {product.name} is {product.min_order_quantity}.'
        elif item.quantity > product.stock_quantity:
            problems[str(item.pk)] = f'Only {product.stock_quantity} {product.unit} of {product.name} left.'
    if problems:
        raise Conflict('Some items in your cart need attention before you can check out.', code='cart_invalid', errors={'items': problems})

    totals = pricing.summarise((products[i.product_id].producer, products[i.product_id].price, i.quantity) for i in cart)
    if expected_total is not None and Decimal(str(expected_total)) != totals['total']:
        raise Conflict(
            'Prices changed since you opened your cart. Please review the updated total.',
            code='price_changed',
            errors={'total': [str(totals['total'])]},
        )

    for item in cart:
        updated = Product.objects.filter(pk=item.product_id, stock_quantity__gte=item.quantity).update(
            stock_quantity=F('stock_quantity') - item.quantity
        )
        if updated != 1:
            raise Conflict('An item sold out while you were checking out.', code='insufficient_stock', errors={'items': {str(item.pk): 'Sold out.'}})

    order = Order.objects.create(
        number=_new_order_number(),
        consumer=consumer,
        payment_method=provider.code,
        currency=next(iter(products.values())).currency,
        subtotal=totals['subtotal'],
        delivery_total=totals['delivery_total'],
        total=totals['total'],
        notes=notes,
        idempotency_key=idempotency_key,
        **{f'ship_{field}': address.get(field, '') for field in ADDRESS_FIELDS},
    )
    producer_orders = {}
    for group in totals['groups']:
        producer_orders[group['producer'].pk] = ProducerOrder.objects.create(
            order=order,
            producer=group['producer'],
            subtotal=group['subtotal'],
            delivery_fee=group['delivery_fee'],
            total=group['total'],
        )
    OrderItem.objects.bulk_create(
        OrderItem(
            producer_order=producer_orders[products[item.product_id].producer_id],
            product=products[item.product_id],
            product_name=products[item.product_id].name,
            product_slug=products[item.product_id].slug,
            unit=products[item.product_id].unit,
            unit_price=products[item.product_id].price,
            quantity=item.quantity,
            line_total=pricing.line_total(products[item.product_id].price, item.quantity),
        )
        for item in cart
    )
    OrderStatusEvent.objects.bulk_create(
        OrderStatusEvent(producer_order=po, to_status=FulfillmentStatus.PENDING, actor=consumer, actor_role=Role.CONSUMER, note='Order placed.')
        for po in producer_orders.values()
    )
    provider.start(order)
    CartItem.objects.filter(user=consumer).delete()
    _notify_order_placed(order, producer_orders.values())
    return order, True


def _notify_order_placed(order, producer_orders):
    send_email(
        f'Order {order.number} received',
        f'Hi {order.consumer.full_name},\n\nThanks for your order {order.number}. Total: {order.currency} {order.total}.\n'
        f'Each farm will confirm its part of the order separately. You can follow progress in your account.\n',
        [order.consumer.email],
    )
    for po in producer_orders:
        send_email(
            f'New order {order.number}',
            f'Hi {po.producer.user.full_name},\n\nYou have a new order ({order.number}) worth {order.currency} {po.total}. '
            f'Please confirm or reject it from your producer dashboard.\n',
            [po.producer.user.email],
        )


# ---------------------------------------------------------------------------
# Fulfilment transitions
# ---------------------------------------------------------------------------
_TIMESTAMP_FIELDS = {
    FulfillmentStatus.CONFIRMED: 'confirmed_at',
    FulfillmentStatus.SHIPPED: 'shipped_at',
    FulfillmentStatus.OUT_FOR_DELIVERY: 'shipped_at',
    FulfillmentStatus.DELIVERED: 'delivered_at',
    FulfillmentStatus.REJECTED: 'cancelled_at',
    FulfillmentStatus.CANCELLED: 'cancelled_at',
}
CONSUMER_CANCELLABLE = (FulfillmentStatus.PENDING, FulfillmentStatus.CONFIRMED)


def _check_role_rules(producer_order, to_status, actor, note):
    current = producer_order.status
    if to_status not in TRANSITIONS.get(current, set()):
        raise Conflict(
            f'An order that is {producer_order.get_status_display().lower()} cannot be moved to '
            f'{FulfillmentStatus(to_status).label.lower()}.',
            code='invalid_transition',
        )
    if actor.role == Role.CONSUMER:
        if producer_order.order.consumer_id != actor.pk:
            raise ServiceError('Not found.', code='not_found', status_code=status.HTTP_404_NOT_FOUND)
        if to_status != FulfillmentStatus.CANCELLED or current not in CONSUMER_CANCELLABLE:
            raise Conflict('Orders can only be cancelled before the farm starts processing them.', code='invalid_transition')
    elif actor.role == Role.PRODUCER:
        if producer_order.producer.user_id != actor.pk:
            raise ServiceError('Not found.', code='not_found', status_code=status.HTTP_404_NOT_FOUND)
        if current == FulfillmentStatus.PENDING and to_status == FulfillmentStatus.CANCELLED:
            raise Conflict('Reject the order instead of cancelling it.', code='invalid_transition')
    elif actor.role != Role.ADMIN:
        raise ServiceError('Not allowed.', code='permission_denied', status_code=status.HTTP_403_FORBIDDEN)

    if to_status in VOID_STATUSES and actor.role != Role.CONSUMER and not note.strip():
        raise ServiceError('Give a reason so the customer knows what happened.', code='note_required', errors={'note': ['A reason is required.']})


def _refresh_order_status(order):
    statuses = list(order.producer_orders.values_list('status', flat=True))
    active = [s for s in statuses if s not in VOID_STATUSES]
    if not active:
        new_status = OrderStatus.CANCELLED
    elif all(s == FulfillmentStatus.DELIVERED for s in active):
        new_status = OrderStatus.COMPLETED
    elif all(s == FulfillmentStatus.PENDING for s in active):
        new_status = OrderStatus.PENDING
    else:
        new_status = OrderStatus.IN_PROGRESS
    if new_status != order.status:
        order.status = new_status
        order.save(update_fields=['status', 'updated_at'])
        if new_status == OrderStatus.COMPLETED:
            providers.on_order_completed(order)
        elif new_status == OrderStatus.CANCELLED:
            providers.on_order_cancelled(order)


@transaction.atomic
def transition(producer_order, to_status, *, actor, note='', request=None):
    producer_order = (
        ProducerOrder.objects.select_for_update(of=('self',))
        .select_related('order__consumer', 'producer__user')
        .get(pk=producer_order.pk)
    )
    _check_role_rules(producer_order, to_status, actor, note)

    previous = producer_order.status
    producer_order.status = to_status
    producer_order.status_note = note.strip()
    fields = ['status', 'status_note', 'updated_at']
    timestamp_field = _TIMESTAMP_FIELDS.get(to_status)
    if timestamp_field and getattr(producer_order, timestamp_field) is None:
        setattr(producer_order, timestamp_field, timezone.now())
        fields.append(timestamp_field)
    producer_order.save(update_fields=fields)

    OrderStatusEvent.objects.create(
        producer_order=producer_order, from_status=previous, to_status=to_status, actor=actor, actor_role=actor.role, note=note.strip()
    )

    if to_status in VOID_STATUSES:
        for item in producer_order.items.filter(product__isnull=False):
            Product.objects.filter(pk=item.product_id).update(stock_quantity=F('stock_quantity') + item.quantity)

    _refresh_order_status(producer_order.order)

    if actor.role == Role.ADMIN:
        audit.record(
            'order.status_changed',
            actor=actor,
            target=producer_order,
            metadata={'from': previous, 'to': to_status, 'note': note.strip()},
            request=request,
        )

    order = producer_order.order
    label = FulfillmentStatus(to_status).label.lower()
    reason = f'\nNote: {note.strip()}\n' if note.strip() else ''
    if actor.role != Role.CONSUMER:
        send_email(
            f'Order {order.number} update',
            f'Hi {order.consumer.full_name},\n\nThe items from {producer_order.producer.farm_name} in order {order.number} '
            f'are now {label}.{reason}\n',
            [order.consumer.email],
        )
    else:
        send_email(
            f'Order {order.number} cancelled by customer',
            f'Hi {producer_order.producer.user.full_name},\n\nThe customer cancelled their order {order.number}.{reason}\n',
            [producer_order.producer.user.email],
        )
    return producer_order


def cancel_order(order, *, actor, note='', request=None):
    """Consumer cancellation of every part of the order that has not started processing."""
    cancellable = order.producer_orders.filter(status__in=CONSUMER_CANCELLABLE)
    if not cancellable.exists():
        raise Conflict('This order can no longer be cancelled.', code='invalid_transition')
    for producer_order in cancellable:
        transition(producer_order, FulfillmentStatus.CANCELLED, actor=actor, note=note, request=request)
    order.refresh_from_db()
    return order
