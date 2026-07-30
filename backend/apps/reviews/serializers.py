from rest_framework import serializers

from apps.products.models import Product
from apps.products.serializers import ProductSerializer

from .models import Review


class ReviewSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(queryset=Product.objects.filter(active=True, approved=True), source='product', write_only=True)

    class Meta:
        model = Review
        fields = ['id', 'customer', 'product', 'product_id', 'rating', 'comment', 'created_at', 'updated_at']
        read_only_fields = ['id', 'customer', 'created_at', 'updated_at']

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError('Rating must be between 1 and 5.')
        return value
