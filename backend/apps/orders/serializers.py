import re

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.accounts.serializers import clean_phone
from apps.producers.serializers import ProducerBriefSerializer

from .models import FulfillmentStatus, Order, OrderItem, OrderStatusEvent, PaymentMethod, ProducerOrder
from .services import CONSUMER_CANCELLABLE

IDEMPOTENCY_KEY = re.compile(r'^[A-Za-z0-9_-]{8,64}$')


class OrderItemSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ['id', 'product_id', 'product_slug', 'product_name', 'unit', 'unit_price', 'quantity', 'line_total', 'image']

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_image(self, item):
        if item.product_id is None:
            return None
        images = list(item.product.images.all())
        return images[0].image.url if images else None


class StatusEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderStatusEvent
        fields = ['from_status', 'to_status', 'actor_role', 'note', 'created_at']


class ShippingSerializer(serializers.Serializer):
    name = serializers.CharField(source='ship_name')
    phone = serializers.CharField(source='ship_phone')
    line1 = serializers.CharField(source='ship_line1')
    line2 = serializers.CharField(source='ship_line2')
    city = serializers.CharField(source='ship_city')
    district = serializers.CharField(source='ship_district')
    state = serializers.CharField(source='ship_state')
    postal_code = serializers.CharField(source='ship_postal_code')
    country = serializers.CharField(source='ship_country')


class PaymentSummarySerializer(serializers.Serializer):
    provider = serializers.CharField()
    status = serializers.CharField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    is_test = serializers.BooleanField()
    reference = serializers.CharField()


class ConsumerProducerOrderSerializer(serializers.ModelSerializer):
    producer = ProducerBriefSerializer(read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    events = StatusEventSerializer(many=True, read_only=True)

    class Meta:
        model = ProducerOrder
        fields = [
            'id', 'producer', 'status', 'subtotal', 'delivery_fee', 'total', 'status_note', 'items', 'events',
            'confirmed_at', 'shipped_at', 'delivered_at', 'cancelled_at',
        ]


class OrderSerializer(serializers.ModelSerializer):
    """The consumer's view of their order."""

    shipping = ShippingSerializer(source='*', read_only=True)
    payment = PaymentSummarySerializer(read_only=True)
    producer_orders = ConsumerProducerOrderSerializer(many=True, read_only=True)
    can_cancel = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'number', 'status', 'payment_method', 'payment', 'currency', 'subtotal', 'delivery_total', 'total',
            'shipping', 'notes', 'producer_orders', 'can_cancel', 'created_at', 'updated_at',
        ]

    def get_can_cancel(self, order) -> bool:
        return any(po.status in CONSUMER_CANCELLABLE for po in order.producer_orders.all())


class OrderListSerializer(serializers.ModelSerializer):
    item_count = serializers.SerializerMethodField()
    farms = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = ['number', 'status', 'payment_method', 'currency', 'total', 'item_count', 'farms', 'created_at']

    def get_item_count(self, order) -> int:
        return sum(item.quantity for po in order.producer_orders.all() for item in po.items.all())

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_farms(self, order):
        return [po.producer.farm_name for po in order.producer_orders.all()]


class ProducerOrderSerializer(serializers.ModelSerializer):
    """The producer's view: only their own items plus what they need to deliver."""

    order_number = serializers.CharField(source='order.number', read_only=True)
    order_notes = serializers.CharField(source='order.notes', read_only=True)
    payment_method = serializers.CharField(source='order.payment_method', read_only=True)
    shipping = ShippingSerializer(source='order', read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    events = StatusEventSerializer(many=True, read_only=True)
    allowed_transitions = serializers.SerializerMethodField()

    class Meta:
        model = ProducerOrder
        fields = [
            'id', 'order_number', 'status', 'subtotal', 'delivery_fee', 'total', 'status_note', 'payment_method',
            'shipping', 'order_notes', 'items', 'events', 'allowed_transitions', 'confirmed_at', 'shipped_at',
            'delivered_at', 'cancelled_at', 'created_at',
        ]

    @extend_schema_field(serializers.ListField(child=serializers.ChoiceField(choices=FulfillmentStatus.choices)))
    def get_allowed_transitions(self, producer_order):
        allowed = producer_order.allowed_transitions
        if producer_order.status == FulfillmentStatus.PENDING:
            allowed = [s for s in allowed if s != FulfillmentStatus.CANCELLED]
        return allowed


class ConsumerRefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    full_name = serializers.CharField()


class AdminOrderSerializer(OrderSerializer):
    consumer = serializers.SerializerMethodField()

    class Meta(OrderSerializer.Meta):
        fields = OrderSerializer.Meta.fields + ['consumer']

    @extend_schema_field(ConsumerRefSerializer)
    def get_consumer(self, order):
        return {'id': order.consumer_id, 'email': order.consumer.email, 'full_name': order.consumer.full_name}


class AddressInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=20)
    line1 = serializers.CharField(max_length=200)
    line2 = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')
    city = serializers.CharField(max_length=100)
    district = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    state = serializers.CharField(max_length=100)
    postal_code = serializers.RegexField(r'^[0-9]{4,10}$', max_length=10, error_messages={'invalid': 'Enter a valid postal code.'})
    country = serializers.CharField(max_length=60, required=False, default='India')

    def validate_phone(self, value):
        value = clean_phone(value)
        if not value:
            raise serializers.ValidationError('A phone number is required for delivery.')
        return value


class CheckoutSerializer(serializers.Serializer):
    address_id = serializers.IntegerField(required=False)
    address = AddressInputSerializer(required=False)
    save_address = serializers.BooleanField(default=False)
    payment_method = serializers.ChoiceField(choices=PaymentMethod.choices)
    notes = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')
    expected_total = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)

    def validate(self, attrs):
        if bool(attrs.get('address_id')) == bool(attrs.get('address')):
            raise serializers.ValidationError('Choose a saved address or enter a new one.')
        return attrs


class TransitionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=FulfillmentStatus.choices)
    note = serializers.CharField(max_length=1000, required=False, allow_blank=True, default='')


class CancelSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=1000, required=False, allow_blank=True, default='')


class PaymentMethodSerializer(serializers.Serializer):
    code = serializers.CharField()
    label = serializers.CharField()
    is_test = serializers.BooleanField()
