from rest_framework import viewsets

from apps.products.permissions import IsAdminRole

from .models import CartItem, WishlistItem
from .serializers import CartItemSerializer, WishlistItemSerializer


class IsCustomerOrAdmin(IsAdminRole):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['customer', 'admin']


class CartItemViewSet(viewsets.ModelViewSet):
    serializer_class = CartItemSerializer
    permission_classes = [IsCustomerOrAdmin]
    queryset = CartItem.objects.none()

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return CartItem.objects.none()
        if self.request.user.role == 'admin':
            return CartItem.objects.all().select_related('product', 'customer')
        return CartItem.objects.filter(customer=self.request.user).select_related('product')

    def perform_create(self, serializer):
        product = serializer.validated_data['product']
        item, created = CartItem.objects.get_or_create(
            customer=self.request.user,
            product=product,
            defaults={'quantity': serializer.validated_data.get('quantity', 1)},
        )
        if not created:
            item.quantity += serializer.validated_data.get('quantity', 1)
            item.save(update_fields=['quantity', 'updated_at'])
        serializer.instance = item


class WishlistItemViewSet(viewsets.ModelViewSet):
    serializer_class = WishlistItemSerializer
    permission_classes = [IsCustomerOrAdmin]
    queryset = WishlistItem.objects.none()

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return WishlistItem.objects.none()
        if self.request.user.role == 'admin':
            return WishlistItem.objects.all().select_related('product', 'customer')
        return WishlistItem.objects.filter(customer=self.request.user).select_related('product')

    def perform_create(self, serializer):
        item, _ = WishlistItem.objects.get_or_create(
            customer=self.request.user,
            product=serializer.validated_data['product'],
        )
        serializer.instance = item
