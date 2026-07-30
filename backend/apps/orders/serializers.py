from django.db import transaction
from rest_framework import serializers

from apps.cart.models import CartItem
from apps.products.serializers import ProductSerializer

from .models import Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'seller', 'quantity', 'price']


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = ['id', 'customer', 'status', 'shipping_address', 'district', 'state', 'phone_number', 'total_amount', 'items', 'created_at', 'updated_at']
        read_only_fields = ['id', 'customer', 'status', 'total_amount', 'items', 'created_at', 'updated_at']

    def create(self, validated_data):
        request = self.context['request']
        cart_items = CartItem.objects.filter(customer=request.user).select_related('product', 'product__seller')
        if not cart_items.exists():
            raise serializers.ValidationError('Cannot place an order with an empty cart.')

        with transaction.atomic():
            order = Order.objects.create(customer=request.user, **validated_data)
            total = 0
            order_items = []
            for cart_item in cart_items:
                product = cart_item.product
                if product.stock < cart_item.quantity:
                    raise serializers.ValidationError(f'{product.name} does not have enough stock.')
                product.stock -= cart_item.quantity
                product.save(update_fields=['stock', 'updated_at'])
                total += product.price * cart_item.quantity
                order_items.append(
                    OrderItem(order=order, product=product, seller=product.seller, quantity=cart_item.quantity, price=product.price)
                )
            OrderItem.objects.bulk_create(order_items)
            order.total_amount = total
            order.save(update_fields=['total_amount'])
            cart_items.delete()
        return order


class OrderStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ['status']
