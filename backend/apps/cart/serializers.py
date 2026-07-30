from rest_framework import serializers

from apps.products.models import Product
from apps.products.serializers import ProductSerializer

from .models import CartItem, WishlistItem


class CartItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(queryset=Product.objects.filter(active=True, approved=True), source='product', write_only=True)

    class Meta:
        model = CartItem
        fields = ['id', 'product', 'product_id', 'quantity', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class WishlistItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(queryset=Product.objects.filter(active=True, approved=True), source='product', write_only=True)

    class Meta:
        model = WishlistItem
        fields = ['id', 'product', 'product_id', 'created_at']
        read_only_fields = ['id', 'created_at']
