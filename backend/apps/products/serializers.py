from rest_framework import serializers

from apps.accounts.serializers import UserSerializer
from services.cloudinary_service import upload_product_image

from .models import Product


class ProductSerializer(serializers.ModelSerializer):
    seller = UserSerializer(read_only=True)
    uploaded_images = serializers.ListField(
        child=serializers.ImageField(),
        write_only=True,
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = Product
        fields = [
            'id',
            'seller',
            'name',
            'description',
            'price',
            'stock',
            'images',
            'uploaded_images',
            'location',
            'district',
            'state',
            'organic',
            'category',
            'subcategory',
            'flagged_for_admin_review',
            'approved',
            'active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'seller', 'category', 'subcategory', 'flagged_for_admin_review', 'approved', 'created_at', 'updated_at']

    def create(self, validated_data):
        uploaded_images = validated_data.pop('uploaded_images', [])
        existing_urls = validated_data.get('images') or []
        uploaded_urls = [upload_product_image(image) for image in uploaded_images]
        validated_data['images'] = [*existing_urls, *uploaded_urls]
        return super().create(validated_data)

    def update(self, instance, validated_data):
        uploaded_images = validated_data.pop('uploaded_images', [])
        if uploaded_images:
            existing_urls = validated_data.get('images', instance.images or [])
            uploaded_urls = [upload_product_image(image) for image in uploaded_images]
            validated_data['images'] = [*existing_urls, *uploaded_urls]
        return super().update(instance, validated_data)


class SellerProductSerializer(ProductSerializer):
    class Meta(ProductSerializer.Meta):
        read_only_fields = ['id', 'seller', 'category', 'subcategory', 'flagged_for_admin_review', 'approved', 'created_at', 'updated_at']

    def validate(self, attrs):
        request = self.context['request']
        if request.user.role != 'admin' and not request.user.seller_verified:
            raise serializers.ValidationError('Seller account must be admin verified before publishing products.')
        return attrs


class ProductApprovalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['approved', 'active']
