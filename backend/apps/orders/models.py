from django.conf import settings
from django.db import models
from django.db.models import Q


class OrderStatus(models.TextChoices):
    """Overall order state, derived from its per-producer fulfilments."""

    PENDING = 'PENDING', 'Pending'
    IN_PROGRESS = 'IN_PROGRESS', 'In progress'
    COMPLETED = 'COMPLETED', 'Completed'
    CANCELLED = 'CANCELLED', 'Cancelled'


class FulfillmentStatus(models.TextChoices):
    PENDING = 'PENDING', 'Awaiting producer'
    CONFIRMED = 'CONFIRMED', 'Confirmed'
    PROCESSING = 'PROCESSING', 'Processing'
    SHIPPED = 'SHIPPED', 'Shipped'
    OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY', 'Out for delivery'
    DELIVERED = 'DELIVERED', 'Delivered'
    REJECTED = 'REJECTED', 'Rejected by producer'
    CANCELLED = 'CANCELLED', 'Cancelled'


TERMINAL_STATUSES = (FulfillmentStatus.DELIVERED, FulfillmentStatus.REJECTED, FulfillmentStatus.CANCELLED)
VOID_STATUSES = (FulfillmentStatus.REJECTED, FulfillmentStatus.CANCELLED)

# Allowed fulfilment transitions. Role-specific limits are applied in services.transition().
TRANSITIONS = {
    FulfillmentStatus.PENDING: {FulfillmentStatus.CONFIRMED, FulfillmentStatus.REJECTED, FulfillmentStatus.CANCELLED},
    FulfillmentStatus.CONFIRMED: {
        FulfillmentStatus.PROCESSING, FulfillmentStatus.SHIPPED, FulfillmentStatus.OUT_FOR_DELIVERY, FulfillmentStatus.CANCELLED,
    },
    FulfillmentStatus.PROCESSING: {FulfillmentStatus.SHIPPED, FulfillmentStatus.OUT_FOR_DELIVERY, FulfillmentStatus.CANCELLED},
    FulfillmentStatus.SHIPPED: {FulfillmentStatus.OUT_FOR_DELIVERY, FulfillmentStatus.DELIVERED},
    FulfillmentStatus.OUT_FOR_DELIVERY: {FulfillmentStatus.DELIVERED},
}


class PaymentMethod(models.TextChoices):
    COD = 'COD', 'Cash on delivery'
    MOCK_ONLINE = 'MOCK_ONLINE', 'Test online payment (no real money)'


class Order(models.Model):
    number = models.CharField(max_length=24, unique=True)
    consumer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='orders')
    status = models.CharField(max_length=12, choices=OrderStatus.choices, default=OrderStatus.PENDING, db_index=True)
    payment_method = models.CharField(max_length=12, choices=PaymentMethod.choices)
    currency = models.CharField(max_length=3, default='INR')
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    delivery_total = models.DecimalField(max_digits=12, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)

    # Delivery address snapshot at the time of purchase.
    ship_name = models.CharField(max_length=150)
    ship_phone = models.CharField(max_length=20)
    ship_line1 = models.CharField(max_length=200)
    ship_line2 = models.CharField(max_length=200, blank=True)
    ship_city = models.CharField(max_length=100)
    ship_district = models.CharField(max_length=100, blank=True)
    ship_state = models.CharField(max_length=100)
    ship_postal_code = models.CharField(max_length=12)
    ship_country = models.CharField(max_length=60, default='India')
    notes = models.TextField(blank=True)

    idempotency_key = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['consumer', 'idempotency_key'], name='uniq_order_idempotency_key'),
            models.CheckConstraint(condition=Q(total__gte=0), name='order_total_non_negative'),
        ]

    def __str__(self):
        return self.number


class ProducerOrder(models.Model):
    """The part of an order fulfilled by one producer."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='producer_orders')
    producer = models.ForeignKey('producers.ProducerProfile', on_delete=models.PROTECT, related_name='orders')
    status = models.CharField(max_length=16, choices=FulfillmentStatus.choices, default=FulfillmentStatus.PENDING)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    status_note = models.TextField(blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    shipped_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [models.UniqueConstraint(fields=['order', 'producer'], name='uniq_producer_per_order')]
        indexes = [models.Index(fields=['producer', 'status'])]

    def __str__(self):
        return f'{self.order.number} / {self.producer}'

    @property
    def allowed_transitions(self):
        return sorted(TRANSITIONS.get(self.status, set()))


class OrderItem(models.Model):
    producer_order = models.ForeignKey(ProducerOrder, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('products.Product', null=True, blank=True, on_delete=models.SET_NULL, related_name='order_items')
    # Snapshot of the listing at purchase time.
    product_name = models.CharField(max_length=160)
    product_slug = models.CharField(max_length=180)
    unit = models.CharField(max_length=10)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField()
    line_total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        constraints = [models.CheckConstraint(condition=Q(quantity__gte=1), name='order_item_quantity_positive')]

    def __str__(self):
        return f'{self.quantity} x {self.product_name}'


class OrderStatusEvent(models.Model):
    producer_order = models.ForeignKey(ProducerOrder, on_delete=models.CASCADE, related_name='events')
    from_status = models.CharField(max_length=16, blank=True)
    to_status = models.CharField(max_length=16)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    actor_role = models.CharField(max_length=10, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']

    def __str__(self):
        return f'{self.from_status or "NEW"} -> {self.to_status}'
