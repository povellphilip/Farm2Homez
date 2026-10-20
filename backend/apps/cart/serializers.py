from rest_framework import serializers

from apps.producers.serializers import ProducerBriefSerializer
from apps.products.serializers import ProductListSerializer

from .services import MAX_LINE_QUANTITY


class CartLineSerializer(serializers.Serializer):
    id = serializers.IntegerField(source='item.id')
    product = ProductListSerializer(source='item.product')
    quantity = serializers.IntegerField(source='item.quantity')
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    issue = serializers.CharField(allow_null=True)


class CartGroupSerializer(serializers.Serializer):
    producer = ProducerBriefSerializer()
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)
    delivery_fee = serializers.DecimalField(max_digits=10, decimal_places=2)
    total = serializers.DecimalField(max_digits=12, decimal_places=2)


class CartSerializer(serializers.Serializer):
    items = CartLineSerializer(many=True)
    groups = CartGroupSerializer(many=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)
    delivery_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    total = serializers.DecimalField(max_digits=12, decimal_places=2)
    item_count = serializers.IntegerField()
    can_checkout = serializers.BooleanField()


class AddToCartSerializer(serializers.Serializer):
    product_slug = serializers.SlugField(max_length=180)
    quantity = serializers.IntegerField(min_value=1, max_value=MAX_LINE_QUANTITY, default=1)


class UpdateCartItemSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1, max_value=MAX_LINE_QUANTITY)
