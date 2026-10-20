"""Server-side pricing. The client never supplies prices or totals."""
from decimal import Decimal

from django.conf import settings

CENT = Decimal('0.01')


def delivery_fee(producer_subtotal):
    fee = Decimal(str(settings.DELIVERY_FEE_PER_PRODUCER))
    threshold = Decimal(str(settings.FREE_DELIVERY_THRESHOLD))
    return Decimal('0.00') if producer_subtotal >= threshold else fee.quantize(CENT)


def line_total(unit_price, quantity):
    return (unit_price * quantity).quantize(CENT)


def summarise(lines):
    """`lines` is an iterable of (producer, unit_price, quantity). Returns per-producer and grand totals."""
    groups = {}
    for producer, unit_price, quantity in lines:
        group = groups.setdefault(producer.pk, {'producer': producer, 'subtotal': Decimal('0.00')})
        group['subtotal'] += line_total(unit_price, quantity)
    for group in groups.values():
        group['delivery_fee'] = delivery_fee(group['subtotal'])
        group['total'] = group['subtotal'] + group['delivery_fee']
    subtotal = sum((g['subtotal'] for g in groups.values()), Decimal('0.00'))
    delivery_total = sum((g['delivery_fee'] for g in groups.values()), Decimal('0.00'))
    return {
        'groups': list(groups.values()),
        'subtotal': subtotal,
        'delivery_total': delivery_total,
        'total': subtotal + delivery_total,
    }
