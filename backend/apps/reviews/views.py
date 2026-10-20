from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.exceptions import Conflict, ServiceError
from apps.core.permissions import IsConsumer
from apps.orders.models import FulfillmentStatus, OrderItem
from apps.products.models import Product

from .models import Review
from .serializers import ReviewCreateSerializer, ReviewSerializer


class ReviewViewSet(viewsets.ModelViewSet):
    """Public product reviews. Only consumers who received the product can review it."""

    filter_backends = []
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_permissions(self):
        if self.action == 'list':
            return [permissions.AllowAny()]
        return [IsConsumer()]

    def get_serializer_class(self):
        return ReviewCreateSerializer if self.action == 'create' else ReviewSerializer

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Review.objects.none()
        queryset = Review.objects.select_related('consumer', 'product')
        if self.action == 'list':
            slug = self.request.query_params.get('product')
            if not slug:
                raise ServiceError('Pass ?product=<slug> to list reviews.', code='product_required')
            return queryset.filter(product__slug=slug, product__in=Product.objects.public())
        return queryset.filter(consumer=self.request.user)

    @extend_schema(parameters=[OpenApiParameter('product', str, required=True)])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = get_object_or_404(Product.objects.public(), slug=serializer.validated_data['product'])
        received = OrderItem.objects.filter(
            product=product,
            producer_order__order__consumer=request.user,
            producer_order__status=FulfillmentStatus.DELIVERED,
        ).exists()
        if not received:
            raise ServiceError('You can review products after they have been delivered to you.', code='not_purchased', status_code=403)
        if Review.objects.filter(consumer=request.user, product=product).exists():
            raise Conflict('You have already reviewed this product. Edit your existing review instead.', code='already_reviewed')
        review = Review.objects.create(
            consumer=request.user, product=product, rating=serializer.validated_data['rating'], comment=serializer.validated_data['comment']
        )
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def mine(self, request):
        page = self.paginate_queryset(self.get_queryset())
        return self.get_paginated_response(ReviewSerializer(page, many=True).data)
