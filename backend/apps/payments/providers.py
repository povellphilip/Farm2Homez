"""Payment integration layer.

Each provider turns a newly created order into a Payment record. Adding a real gateway
means adding a provider here plus a verified webhook endpoint that moves the payment
from PENDING to PAID; order code does not need to change.
"""
import secrets

from django.conf import settings

from apps.core.exceptions import ServiceError

from .models import Payment, PaymentStatus


class CashOnDelivery:
    code = 'COD'
    label = 'Cash on delivery'
    is_test = False

    def start(self, order):
        return Payment.objects.create(order=order, provider=self.code, amount=order.total, currency=order.currency)

    def on_completed(self, payment):
        # Cash is collected at the door when the final delivery is made.
        payment.status = PaymentStatus.PAID


class MockOnlinePayment:
    """Development-only stand-in for an online gateway. Marks the order paid immediately and
    flags the payment as a test. No card details are collected and no money moves."""

    code = 'MOCK_ONLINE'
    label = 'Test online payment (no real money)'
    is_test = True

    def start(self, order):
        return Payment.objects.create(
            order=order,
            provider=self.code,
            amount=order.total,
            currency=order.currency,
            status=PaymentStatus.PAID,
            is_test=True,
            reference=f'TEST-{secrets.token_hex(6).upper()}',
        )

    def on_completed(self, payment):
        pass


_PROVIDERS = {CashOnDelivery.code: CashOnDelivery(), MockOnlinePayment.code: MockOnlinePayment()}


def available_providers():
    providers = [_PROVIDERS['COD']]
    if settings.PAYMENTS_MOCK_ENABLED:
        providers.append(_PROVIDERS['MOCK_ONLINE'])
    return providers


def get_provider(code):
    for provider in available_providers():
        if provider.code == code:
            return provider
    raise ServiceError('This payment method is not available.', code='payment_method_unavailable', errors={'payment_method': ['Not available.']})


def on_order_completed(order):
    payment = getattr(order, 'payment', None)
    if payment and payment.status == PaymentStatus.PENDING:
        _PROVIDERS[payment.provider].on_completed(payment)
        payment.save(update_fields=['status', 'updated_at'])


def on_order_cancelled(order):
    payment = getattr(order, 'payment', None)
    if payment is None:
        return
    if payment.status == PaymentStatus.PENDING:
        payment.status = PaymentStatus.CANCELLED
    elif payment.status == PaymentStatus.PAID and payment.is_test:
        payment.status = PaymentStatus.REFUNDED
    else:
        return
    payment.save(update_fields=['status', 'updated_at'])
