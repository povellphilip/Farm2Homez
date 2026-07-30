from django_filters.rest_framework import FilterSet, filters
from rest_framework import permissions, viewsets
from rest_framework.decorators import action

from utils.responses import success_response

from .models import Product
from .permissions import IsAdminRole, IsSeller, IsSellerOwnerOrAdmin
from .serializers import ProductApprovalSerializer, ProductSerializer, SellerProductSerializer


class ProductFilter(FilterSet):
    min_price = filters.NumberFilter(field_name='price', lookup_expr='gte')
    max_price = filters.NumberFilter(field_name='price', lookup_expr='lte')

    class Meta:
        model = Product
        fields = ['category', 'subcategory', 'district', 'state', 'organic', 'seller', 'approved']


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.AllowAny]
    serializer_class = ProductSerializer
    queryset = Product.objects.filter(active=True, approved=True).select_related('seller')
    filterset_class = ProductFilter
    search_fields = ['name', 'category', 'subcategory', 'district', 'state', 'seller__farm_name', 'seller__owner_name']
    ordering_fields = ['price', 'created_at', 'stock']


class SellerProductViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSeller, IsSellerOwnerOrAdmin]
    serializer_class = SellerProductSerializer
    filterset_class = ProductFilter
    search_fields = ['name', 'category', 'subcategory', 'district', 'state']
    ordering_fields = ['price', 'created_at', 'stock']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Product.objects.none()
        return Product.objects.filter(seller=self.request.user).select_related('seller')

    def perform_create(self, serializer):
        serializer.save(seller=self.request.user)


class AdminProductViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    queryset = Product.objects.all().select_related('seller')
    serializer_class = ProductSerializer
    filterset_class = ProductFilter
    search_fields = ['name', 'category', 'subcategory', 'district', 'state', 'seller__email']
    ordering_fields = ['price', 'created_at', 'stock']

    @action(detail=True, methods=['post'], serializer_class=ProductApprovalSerializer)
    def approval(self, request, pk=None):
        product = self.get_object()
        serializer = ProductApprovalSerializer(product, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response('Product approval updated.', ProductSerializer(product).data)
