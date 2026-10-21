from django.db.models import Avg, Count, F, Q
from django.shortcuts import get_object_or_404
from django_filters import rest_framework as filters
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.generics import ListAPIView
from rest_framework.response import Response

from apps.core.permissions import IsProducer

from . import services, uploads
from .models import Category, Product, ProductImage
from .serializers import (
    CategorySerializer,
    ImageOrderSerializer,
    ImageUploadSerializer,
    ProducerProductSerializer,
    ProductDetailSerializer,
    ProductImageSerializer,
    ProductListSerializer,
    UploadConfirmSerializer,
    UploadRequestSerializer,
    UploadTicketSerializer,
)


def public_products():
    return (
        Product.objects.public()
        .select_related('producer', 'producer__user', 'category', 'subcategory')
        .prefetch_related('images')
        .annotate(average_rating=Avg('reviews__rating'), review_count=Count('reviews'))
    )


class ProductFilter(filters.FilterSet):
    category = filters.CharFilter(method='filter_category', help_text='Category or subcategory slug.')
    subcategory = filters.CharFilter(field_name='subcategory__slug')
    producer = filters.CharFilter(field_name='producer__slug', help_text='Producer (farm) slug.')
    state = filters.CharFilter(field_name='producer__state', lookup_expr='iexact')
    min_price = filters.NumberFilter(field_name='price', lookup_expr='gte')
    max_price = filters.NumberFilter(field_name='price', lookup_expr='lte')
    in_stock = filters.BooleanFilter(method='filter_in_stock')
    organic = filters.BooleanFilter(field_name='is_organic')
    seasonal = filters.BooleanFilter(field_name='is_seasonal')

    class Meta:
        model = Product
        fields = []

    def filter_category(self, queryset, name, value):
        return queryset.filter(Q(category__slug=value) | Q(subcategory__slug=value))

    def filter_in_stock(self, queryset, name, value):
        purchasable = Q(is_available=True, stock_quantity__gte=F('min_order_quantity'))
        return queryset.filter(purchasable) if value else queryset.exclude(purchasable)


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    """Public marketplace catalogue. Only published, approved listings from verified, active producers."""

    permission_classes = [permissions.AllowAny]
    lookup_field = 'slug'
    filter_backends = [filters.DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = ProductFilter
    search_fields = ['name', 'description', 'origin', 'producer__farm_name', 'category__name', 'subcategory__name']
    ordering_fields = ['price', 'published_at', 'name']
    ordering = ['-published_at']

    def get_queryset(self):
        return public_products()

    def get_serializer_class(self):
        return ProductDetailSerializer if self.action == 'retrieve' else ProductListSerializer


class CategoryListView(ListAPIView):
    """Active categories with their subcategories and the number of live listings."""

    permission_classes = [permissions.AllowAny]
    serializer_class = CategorySerializer
    pagination_class = None
    filter_backends = []

    def get_queryset(self):
        counts = dict(
            Product.objects.public().values_list('category_id').annotate(n=Count('id')).values_list('category_id', 'n')
        )
        categories = list(
            Category.objects.filter(parent__isnull=True, is_active=True).prefetch_related('children')
        )
        for category in categories:
            category.product_count = counts.get(category.id, 0)
        return categories


class ProducerProductViewSet(viewsets.ModelViewSet):
    """A producer's own listings: drafts, published and unpublished."""

    permission_classes = [IsProducer]
    serializer_class = ProducerProductSerializer
    filter_backends = [filters.DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'moderation_status', 'is_available']
    search_fields = ['name']
    ordering_fields = ['name', 'price', 'stock_quantity', 'created_at', 'updated_at']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Product.objects.none()
        return (
            Product.objects.filter(producer__user=self.request.user)
            .select_related('category', 'subcategory', 'producer', 'producer__user')
            .prefetch_related('images')
        )

    def get_throttles(self):
        if self.action in ('upload_image', 'upload_url', 'confirm_upload'):
            self.throttle_scope = 'upload'
        return super().get_throttles()

    def perform_create(self, serializer):
        serializer.instance = services.create_product(self.request.user.producer_profile, serializer.validated_data)

    def perform_update(self, serializer):
        serializer.instance = services.update_product(serializer.instance, serializer.validated_data)

    def perform_destroy(self, instance):
        services.delete_product(instance)

    @extend_schema(request=None, responses=ProducerProductSerializer)
    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        product = services.publish(self.get_object())
        return Response(self.get_serializer(product).data)

    @extend_schema(request=None, responses=ProducerProductSerializer)
    @action(detail=True, methods=['post'])
    def unpublish(self, request, pk=None):
        product = services.unpublish(self.get_object())
        return Response(self.get_serializer(product).data)

    @extend_schema(request={'multipart/form-data': ImageUploadSerializer}, responses={201: ProductImageSerializer})
    @action(detail=True, methods=['post'], url_path='images')
    def upload_image(self, request, pk=None):
        product = self.get_object()
        serializer = ImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        image = services.add_image(product, serializer.validated_data['image'], serializer.validated_data['alt_text'])
        return Response(ProductImageSerializer(image).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=UploadRequestSerializer, responses=UploadTicketSerializer)
    @action(detail=True, methods=['post'], url_path='images/upload-url')
    def upload_url(self, request, pk=None):
        """Start an image upload. Returns either a presigned S3 POST or the multipart endpoint to use."""
        serializer = UploadRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(uploads.request_upload(self.get_object(), **serializer.validated_data))

    @extend_schema(request=UploadConfirmSerializer, responses={201: ProductImageSerializer})
    @action(detail=True, methods=['post'], url_path='images/confirm')
    def confirm_upload(self, request, pk=None):
        serializer = UploadConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        image = uploads.confirm_upload(self.get_object(), serializer.validated_data['upload_id'], serializer.validated_data['alt_text'])
        return Response(ProductImageSerializer(image).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses={204: None})
    @action(detail=True, methods=['delete'], url_path=r'images/(?P<image_id>[0-9]+)')
    def delete_image(self, request, pk=None, image_id=None):
        product = self.get_object()
        image = get_object_or_404(product.images, pk=image_id)
        services.delete_image(image)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=ImageOrderSerializer, responses=ProductImageSerializer(many=True))
    @action(detail=True, methods=['post'], url_path='images/order')
    def reorder_images(self, request, pk=None):
        product = self.get_object()
        serializer = ImageOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.reorder_images(product, serializer.validated_data['image_ids'])
        return Response(ProductImageSerializer(ProductImage.objects.filter(product=product), many=True).data)
