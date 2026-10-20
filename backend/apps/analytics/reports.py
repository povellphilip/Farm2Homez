"""Read-only aggregate queries for producer and admin dashboards."""
from datetime import timedelta
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Count, F, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.accounts.models import User
from apps.inquiries.models import Inquiry, InquiryStatus
from apps.orders.models import VOID_STATUSES, FulfillmentStatus, Order, OrderItem, ProducerOrder
from apps.producers.models import ProducerProfile, VerificationStatus
from apps.products.models import ModerationStatus, Product, ProductStatus

from .models import ProductViewDaily

ZERO = Decimal('0.00')
CENT = Decimal('0.01')
LOW_STOCK_THRESHOLD = 5


def money(value):
    """Money as a 2-decimal string, matching how serializers render prices."""
    return str((value or ZERO).quantize(CENT))


def _money_rows(rows, field='revenue'):
    return [{**row, field: money(row[field])} for row in rows]


def record_view(product):
    today = timezone.localdate()
    updated = ProductViewDaily.objects.filter(product=product, date=today).update(views=F('views') + 1)
    if not updated:
        try:
            with transaction.atomic():
                ProductViewDaily.objects.create(product=product, date=today, views=1)
        except IntegrityError:
            ProductViewDaily.objects.filter(product=product, date=today).update(views=F('views') + 1)


def _daily_series(producer_orders, days):
    start = timezone.localdate() - timedelta(days=days - 1)
    rows = (
        producer_orders.filter(created_at__date__gte=start)
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(orders=Count('id'), revenue=Sum('total'))
    )
    by_day = {row['day']: row for row in rows}
    series = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        row = by_day.get(day, {})
        series.append({'date': day.isoformat(), 'orders': row.get('orders', 0), 'revenue': money(row.get('revenue'))})
    return series


def _status_counts(queryset, field='status'):
    return {row[field]: row['n'] for row in queryset.values(field).annotate(n=Count('id'))}


def producer_overview(producer, days=30):
    products = Product.objects.filter(producer=producer)
    producer_orders = ProducerOrder.objects.filter(producer=producer)
    live_orders = producer_orders.exclude(status__in=VOID_STATUSES)
    since = timezone.now() - timedelta(days=days)

    top_products = (
        OrderItem.objects.filter(producer_order__in=live_orders)
        .values('product_id', 'product_name')
        .annotate(quantity=Sum('quantity'), revenue=Sum('line_total'))
        .order_by('-revenue')[:5]
    )
    views = ProductViewDaily.objects.filter(product__producer=producer, date__gte=timezone.localdate() - timedelta(days=days - 1))
    low_stock = products.filter(status=ProductStatus.PUBLISHED, stock_quantity__lte=LOW_STOCK_THRESHOLD).values(
        'id', 'name', 'slug', 'stock_quantity', 'unit'
    )[:10]

    return {
        'listings': {
            'total': products.count(),
            'by_status': _status_counts(products),
            'pending_moderation': products.filter(moderation_status=ModerationStatus.PENDING).count(),
            'rejected': products.filter(moderation_status=ModerationStatus.REJECTED).count(),
            'low_stock': list(low_stock),
        },
        'orders': {
            'total': producer_orders.count(),
            'by_status': _status_counts(producer_orders),
            'awaiting_action': producer_orders.filter(status=FulfillmentStatus.PENDING).count(),
        },
        'sales': {
            'revenue_total': money(live_orders.aggregate(v=Sum('total'))['v']),
            'revenue_delivered': money(producer_orders.filter(status=FulfillmentStatus.DELIVERED).aggregate(v=Sum('total'))['v']),
            'revenue_period': money(live_orders.filter(created_at__gte=since).aggregate(v=Sum('total'))['v']),
            'daily': _daily_series(live_orders, days),
            'top_products': _money_rows(top_products),
        },
        'views': {
            'period_total': views.aggregate(v=Sum('views'))['v'] or 0,
            'top_products': list(
                views.values('product_id', 'product__name').annotate(views=Sum('views')).order_by('-views')[:5]
            ),
        },
        'inquiries': {'open': Inquiry.objects.filter(producer=producer, status=InquiryStatus.OPEN).count()},
        'period_days': days,
    }


def platform_overview(days=30):
    since = timezone.now() - timedelta(days=days)
    # Revenue excludes orders paid with the development test-payment method.
    live_orders = ProducerOrder.objects.exclude(status__in=VOID_STATUSES).exclude(order__payment__is_test=True)
    test_orders = ProducerOrder.objects.exclude(status__in=VOID_STATUSES).filter(order__payment__is_test=True)
    top_producers = (
        live_orders.values('producer_id', 'producer__farm_name')
        .annotate(orders=Count('id'), revenue=Sum('total'))
        .order_by('-revenue')[:5]
    )
    return {
        'users': {
            'by_role': _status_counts(User.objects.all(), 'role'),
            'new_in_period': User.objects.filter(date_joined__gte=since).count(),
            'suspended': User.objects.filter(is_active=False).count(),
        },
        'producers': {
            'by_verification': _status_counts(ProducerProfile.objects.all(), 'verification_status'),
            'pending_verification': ProducerProfile.objects.filter(verification_status=VerificationStatus.PENDING).count(),
        },
        'products': {
            'by_status': _status_counts(Product.objects.all()),
            'pending_moderation': Product.objects.filter(
                status=ProductStatus.PUBLISHED, moderation_status=ModerationStatus.PENDING
            ).count(),
            'live': Product.objects.public().count(),
            'out_of_stock_live': Product.objects.public().filter(stock_quantity__lt=F('min_order_quantity')).count(),
        },
        'orders': {
            'total': Order.objects.count(),
            'by_status': _status_counts(Order.objects.all()),
            'in_period': Order.objects.filter(created_at__gte=since).count(),
            'fulfilments_by_status': _status_counts(ProducerOrder.objects.all()),
        },
        'revenue': {
            'gross_total': money(live_orders.aggregate(v=Sum('total'))['v']),
            'gross_period': money(live_orders.filter(created_at__gte=since).aggregate(v=Sum('total'))['v']),
            'delivered_total': money(live_orders.filter(status=FulfillmentStatus.DELIVERED).aggregate(v=Sum('total'))['v']),
            'test_payments_total': money(test_orders.aggregate(v=Sum('total'))['v']),
            'daily': _daily_series(live_orders, days),
            'top_producers': _money_rows(top_producers),
        },
        'inquiries': {
            'open': Inquiry.objects.filter(status=InquiryStatus.OPEN).count(),
            'platform_open': Inquiry.objects.filter(producer__isnull=True, status=InquiryStatus.OPEN).count(),
        },
        'period_days': days,
    }

