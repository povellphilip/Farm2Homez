from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.consumers.models import Address
from apps.core.exceptions import ServiceError
from apps.core.permissions import IsConsumer, IsProducer
from apps.payments import providers
from apps.products.models import ProductImage

from . import services
from .models import Order, OrderItem, ProducerOrder
from .serializers import (
    IDEMPOTENCY_KEY,
    CancelSerializer,
    CheckoutSerializer,
    OrderListSerializer,
    OrderSerializer,
    PaymentMethodSerializer,
    ProducerOrderSerializer,
    TransitionSerializer,
)

_ITEMS = Prefetch(
    'items', queryset=OrderItem.objects.select_related('product').prefetch_related(Prefetch('product__images', queryset=ProductImage.objects.order_by('position', 'id')))
)


def consumer_orders(user):
    return Order.objects.filter(consumer=user).select_related('payment').prefetch_related(
        Prefetch('producer_orders', queryset=ProducerOrder.objects.select_related('producer').prefetch_related(_ITEMS, 'events'))
    )


class PaymentMethodsView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(responses=PaymentMethodSerializer(many=True))
    def get(self, request):
        return Response(PaymentMethodSerializer(providers.available_providers(), many=True).data)


class CheckoutView(APIView):
    permission_classes = [IsConsumer]
    throttle_scope = 'checkout'

    @extend_schema(
        request=CheckoutSerializer,
        responses={201: OrderSerializer, 200: OrderSerializer},
        parameters=[OpenApiParameter('Idempotency-Key', location=OpenApiParameter.HEADER, required=True)],
    )
    def post(self, request):
        key = request.headers.get('Idempotency-Key', '')
        if not IDEMPOTENCY_KEY.match(key):
            raise ServiceError('Send a unique Idempotency-Key header (8-64 letters, digits, - or _).', code='idempotency_key_required')
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if data.get('address_id'):
            saved = get_object_or_404(Address, pk=data['address_id'], user=request.user)
            address = {
                'name': saved.recipient_name, 'phone': saved.phone_number, 'line1': saved.line1, 'line2': saved.line2,
                'city': saved.city, 'district': saved.district, 'state': saved.state,
                'postal_code': saved.postal_code, 'country': saved.country,
            }
        else:
            address = data['address']

        order, created = services.checkout(
            request.user,
            idempotency_key=key,
            address=address,
            payment_method=data['payment_method'],
            notes=data['notes'],
            expected_total=data.get('expected_total'),
        )
        if created and data.get('address') and data['save_address']:
            Address.objects.create(
                user=request.user,
                recipient_name=address['name'], phone_number=address['phone'], line1=address['line1'], line2=address['line2'],
                city=address['city'], district=address['district'], state=address['state'],
                postal_code=address['postal_code'], country=address['country'],
                is_default=not Address.objects.filter(user=request.user).exists(),
            )
        order = consumer_orders(request.user).get(pk=order.pk)
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class ConsumerOrderViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsConsumer]
    lookup_field = 'number'
    filterset_fields = ['status']
    ordering_fields = ['created_at', 'total']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Order.objects.none()
        return consumer_orders(self.request.user)

    def get_serializer_class(self):
        return OrderListSerializer if self.action == 'list' else OrderSerializer

    @extend_schema(request=CancelSerializer, responses=OrderSerializer)
    @action(detail=True, methods=['post'])
    def cancel(self, request, number=None):
        serializer = CancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = services.cancel_order(self.get_object(), actor=request.user, note=serializer.validated_data['reason'], request=request)
        return Response(OrderSerializer(consumer_orders(request.user).get(pk=order.pk)).data)


class ProducerOrderViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Orders containing the producer's products. Each record is that producer's part only."""

    permission_classes = [IsProducer]
    serializer_class = ProducerOrderSerializer
    filterset_fields = ['status']
    search_fields = ['order__number', 'order__ship_name']
    ordering_fields = ['created_at', 'total', 'status']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return ProducerOrder.objects.none()
        return (
            ProducerOrder.objects.filter(producer__user=self.request.user)
            .select_related('order')
            .prefetch_related(_ITEMS, 'events')
        )

    @extend_schema(request=TransitionSerializer, responses=ProducerOrderSerializer)
    @action(detail=True, methods=['post'])
    def status(self, request, pk=None):
        serializer = TransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        producer_order = services.transition(
            self.get_object(), serializer.validated_data['status'], actor=request.user, note=serializer.validated_data['note'], request=request
        )
        return Response(self.get_serializer(self.get_queryset().get(pk=producer_order.pk)).data)
