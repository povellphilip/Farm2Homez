from rest_framework import serializers

from apps.accounts.serializers import clean_phone
from apps.producers.serializers import ProducerPublicSerializer
from apps.products.serializers import ProductListSerializer

from .models import Address, FavoriteProducer, FavoriteProduct


class AddressSerializer(serializers.ModelSerializer):
    postal_code = serializers.RegexField(r'^[0-9]{4,10}$', max_length=10, error_messages={'invalid': 'Enter a valid postal code.'})

    class Meta:
        model = Address
        fields = [
            'id', 'label', 'recipient_name', 'phone_number', 'line1', 'line2', 'city', 'district', 'state',
            'postal_code', 'country', 'is_default', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'is_default', 'created_at', 'updated_at']

    def validate_phone_number(self, value):
        value = clean_phone(value)
        if not value:
            raise serializers.ValidationError('A phone number is required for delivery.')
        return value


class FavoriteProductSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)
    product_slug = serializers.SlugField(write_only=True)

    class Meta:
        model = FavoriteProduct
        fields = ['id', 'product', 'product_slug', 'created_at']


class FavoriteProducerSerializer(serializers.ModelSerializer):
    producer = ProducerPublicSerializer(read_only=True)
    producer_slug = serializers.SlugField(write_only=True)

    class Meta:
        model = FavoriteProducer
        fields = ['id', 'producer', 'producer_slug', 'created_at']
