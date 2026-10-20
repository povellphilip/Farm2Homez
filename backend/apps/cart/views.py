from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsConsumer

from . import services
from .models import CartItem
from .serializers import AddToCartSerializer, CartSerializer, UpdateCartItemSerializer


def cart_response(user, status_code=status.HTTP_200_OK):
    return Response(CartSerializer(services.build_cart(user)).data, status=status_code)


class CartView(APIView):
    permission_classes = [IsConsumer]

    @extend_schema(responses=CartSerializer)
    def get(self, request):
        return cart_response(request.user)

    @extend_schema(responses=CartSerializer)
    def delete(self, request):
        CartItem.objects.filter(user=request.user).delete()
        return cart_response(request.user)


class CartItemsView(APIView):
    permission_classes = [IsConsumer]

    @extend_schema(request=AddToCartSerializer, responses={201: CartSerializer})
    def post(self, request):
        serializer = AddToCartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.add_item(request.user, **serializer.validated_data)
        return cart_response(request.user, status.HTTP_201_CREATED)


class CartItemDetailView(APIView):
    permission_classes = [IsConsumer]

    def _item(self, request, item_id):
        return get_object_or_404(CartItem.objects.select_related('product__producer__user', 'product__category'), pk=item_id, user=request.user)

    @extend_schema(request=UpdateCartItemSerializer, responses=CartSerializer)
    def patch(self, request, item_id):
        serializer = UpdateCartItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.set_quantity(self._item(request, item_id), serializer.validated_data['quantity'])
        return cart_response(request.user)

    @extend_schema(responses=CartSerializer)
    def delete(self, request, item_id):
        self._item(request, item_id).delete()
        return cart_response(request.user)
