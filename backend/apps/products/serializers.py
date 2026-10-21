from decimal import Decimal

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.producers.serializers import ProducerBriefSerializer, ProducerPublicSerializer

from .models import Category, Product, ProductImage


class CategoryBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug']


class CategorySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()
    product_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'position', 'product_count', 'children']

    @extend_schema_field(CategoryBriefSerializer(many=True))
    def get_children(self, category):
        children = [child for child in category.children.all() if child.is_active]
        return CategoryBriefSerializer(children, many=True).data


class AdminCategorySerializer(serializers.ModelSerializer):
    parent = serializers.PrimaryKeyRelatedField(queryset=Category.objects.filter(parent__isnull=True), allow_null=True, required=False, default=None
    )

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'parent', 'position', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'slug', 'created_at', 'updated_at']

    def validate_parent(self, parent):
        if parent and self.instance and (parent.pk == self.instance.pk or self.instance.children.exists()):
            raise serializers.ValidationError('Categories can only be nested one level deep.')
        return parent


class ProductImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ['id', 'url', 'alt_text', 'position', 'width', 'height']

    def get_url(self, image) -> str:
        return image.image.url


def _primary_image(product):
    images = list(product.images.all())
    return ProductImageSerializer(images[0]).data if images else None


class ProductListSerializer(serializers.ModelSerializer):
    category = CategoryBriefSerializer(read_only=True)
    subcategory = CategoryBriefSerializer(read_only=True, allow_null=True)
    producer = ProducerBriefSerializer(read_only=True)
    primary_image = serializers.SerializerMethodField()
    is_purchasable = serializers.BooleanField(read_only=True)
    in_season = serializers.BooleanField(read_only=True)
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Product
        fields = [
            'id', 'slug', 'name', 'category', 'subcategory', 'producer', 'price', 'currency', 'unit',
            'stock_quantity', 'min_order_quantity', 'origin', 'is_seasonal', 'is_available', 'is_organic',
            'in_season', 'is_purchasable', 'primary_image', 'average_rating', 'review_count', 'published_at',
        ]

    @extend_schema_field(ProductImageSerializer(allow_null=True))
    def get_primary_image(self, product):
        return _primary_image(product)

    @extend_schema_field(serializers.FloatField(allow_null=True))
    def get_average_rating(self, product):
        value = getattr(product, 'average_rating', None)
        return round(float(value), 1) if value is not None else None


class ProductDetailSerializer(ProductListSerializer):
    producer = ProducerPublicSerializer(read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + ['description', 'harvest_info', 'available_from', 'available_until', 'images']


class ProducerProductSerializer(serializers.ModelSerializer):
    """A producer's view of their own listing, including drafts and moderation state."""

    category = serializers.SlugRelatedField(slug_field='slug', queryset=Category.objects.filter(parent__isnull=True, is_active=True))
    subcategory = serializers.SlugRelatedField(
        slug_field='slug', queryset=Category.objects.filter(parent__isnull=False, is_active=True), required=False, allow_null=True
    )
    images = ProductImageSerializer(many=True, read_only=True)
    is_purchasable = serializers.BooleanField(read_only=True)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'), max_value=Decimal('9999999.99'))
    min_order_quantity = serializers.IntegerField(min_value=1, max_value=100000, required=False)
    stock_quantity = serializers.IntegerField(min_value=0, max_value=10_000_000, required=False)

    class Meta:
        model = Product
        fields = [
            'id', 'slug', 'name', 'category', 'subcategory', 'description', 'price', 'currency', 'unit',
            'stock_quantity', 'min_order_quantity', 'origin', 'harvest_info', 'is_seasonal', 'available_from',
            'available_until', 'is_available', 'is_organic', 'status', 'moderation_status', 'moderation_note',
            'is_purchasable', 'images', 'published_at', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'slug', 'currency', 'status', 'moderation_status', 'moderation_note', 'published_at', 'created_at', 'updated_at',
        ]

    def validate_name(self, value):
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError('Enter a product name.')
        return value

    def validate(self, attrs):
        category = attrs.get('category', getattr(self.instance, 'category', None))
        subcategory = attrs.get('subcategory', getattr(self.instance, 'subcategory', None))
        if subcategory and subcategory.parent_id != getattr(category, 'id', None):
            raise serializers.ValidationError({'subcategory': ['This subcategory does not belong to the selected category.']})
        start = attrs.get('available_from', getattr(self.instance, 'available_from', None))
        end = attrs.get('available_until', getattr(self.instance, 'available_until', None))
        if start and end and end < start:
            raise serializers.ValidationError({'available_until': ['The end date must be on or after the start date.']})
        return attrs


class ModerationSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=['APPROVED', 'REJECTED'])
    note = serializers.CharField(required=False, allow_blank=True, default='', max_length=2000)


class AdminProductSerializer(ProducerProductSerializer):
    producer = ProducerBriefSerializer(read_only=True)

    class Meta(ProducerProductSerializer.Meta):
        fields = ProducerProductSerializer.Meta.fields + ['producer']
        read_only_fields = ProducerProductSerializer.Meta.fields + ['producer']


class ImageUploadSerializer(serializers.Serializer):
    image = serializers.FileField()
    alt_text = serializers.CharField(required=False, allow_blank=True, default='', max_length=200)


class ImageOrderSerializer(serializers.Serializer):
    image_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)


class UploadRequestSerializer(serializers.Serializer):
    content_type = serializers.ChoiceField(choices=['image/jpeg', 'image/png', 'image/webp'])
    size = serializers.IntegerField(min_value=1)


class UploadTicketSerializer(serializers.Serializer):
    strategy = serializers.ChoiceField(choices=['multipart', 'presigned-post'])
    url = serializers.CharField()
    upload_id = serializers.UUIDField(required=False)
    fields = serializers.DictField(child=serializers.CharField(), required=False)


class UploadConfirmSerializer(serializers.Serializer):
    upload_id = serializers.UUIDField()
    alt_text = serializers.CharField(required=False, allow_blank=True, default='', max_length=200)
