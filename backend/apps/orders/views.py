from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission

from apps.products.permissions import IsAdminRole, IsSeller
from utils.responses import success_response

from .models import Order
from .serializers import OrderSerializer, OrderStatusSerializer


class IsCustomer(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'customer'


class CustomerOrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsCustomer]
    http_method_names = ['get', 'post', 'head', 'options']
    queryset = Order.objects.none()

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Order.objects.none()
        return Order.objects.filter(customer=self.request.user).prefetch_related('items__product')

    def perform_create(self, serializer):
        serializer.save()


class SellerOrderViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsSeller]
    queryset = Order.objects.none()

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Order.objects.none()
        return Order.objects.filter(items__seller=self.request.user).distinct().prefetch_related('items__product')

    @action(detail=True, methods=['patch'], serializer_class=OrderStatusSerializer)
    def status(self, request, pk=None):
        order = self.get_object()
        serializer = OrderStatusSerializer(order, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response('Order status updated.', OrderSerializer(order).data)


class AdminOrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all().prefetch_related('items__product')
    serializer_class = OrderSerializer
    permission_classes = [IsAdminRole]
