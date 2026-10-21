from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.accounts.serializers import clean_phone
from apps.producers.serializers import ProducerBriefSerializer

from .models import Inquiry, InquiryReply


class InquiryReplySerializer(serializers.ModelSerializer):
    class Meta:
        model = InquiryReply
        fields = ['id', 'author_role', 'message', 'created_at']


class ProductRefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    slug = serializers.CharField()


class InquirySerializer(serializers.ModelSerializer):
    producer = ProducerBriefSerializer(read_only=True, allow_null=True)
    product = serializers.SerializerMethodField()
    replies = InquiryReplySerializer(many=True, read_only=True)

    class Meta:
        model = Inquiry
        fields = ['id', 'producer', 'product', 'name', 'email', 'phone', 'subject', 'message', 'status', 'replies', 'created_at', 'updated_at']

    @extend_schema_field(ProductRefSerializer(allow_null=True))
    def get_product(self, inquiry):
        if inquiry.product_id is None:
            return None
        return {'id': inquiry.product_id, 'name': inquiry.product.name, 'slug': inquiry.product.slug}


class InquiryCreateSerializer(serializers.Serializer):
    producer_slug = serializers.SlugField(required=False, allow_blank=True, default='')
    product_slug = serializers.SlugField(required=False, allow_blank=True, default='')
    name = serializers.CharField(max_length=150, required=False, allow_blank=True, default='')
    email = serializers.EmailField(required=False, allow_blank=True, default='')
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default='')
    subject = serializers.CharField(max_length=200)
    message = serializers.CharField(min_length=10, max_length=5000)

    def validate_phone(self, value):
        return clean_phone(value)


class ReplySerializer(serializers.Serializer):
    message = serializers.CharField(min_length=1, max_length=5000)
