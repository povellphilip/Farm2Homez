from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import IsConsumer
from apps.producers.models import ProducerProfile, VerificationStatus
from apps.products.models import Product

from .models import Address, FavoriteProducer, FavoriteProduct
from .serializers import AddressSerializer, FavoriteProducerSerializer, FavoriteProductSerializer


class AddressViewSet(viewsets.ModelViewSet):
    permission_classes = [IsConsumer]
    serializer_class = AddressSerializer
    pagination_class = None
    filter_backends = []

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Address.objects.none()
        return Address.objects.filter(user=self.request.user)

    @transaction.atomic
    def perform_create(self, serializer):
        is_first = not Address.objects.filter(user=self.request.user).exists()
        serializer.save(user=self.request.user, is_default=is_first)

    @transaction.atomic
    def perform_destroy(self, instance):
        was_default = instance.is_default
        instance.delete()
        if was_default:
            replacement = Address.objects.filter(user=self.request.user).first()
            if replacement:
                replacement.is_default = True
                replacement.save(update_fields=['is_default', 'updated_at'])

    @extend_schema(request=None, responses=AddressSerializer)
    @action(detail=True, methods=['post'], url_path='set-default')
    @transaction.atomic
    def set_default(self, request, pk=None):
        address = self.get_object()
        Address.objects.filter(user=request.user, is_default=True).exclude(pk=address.pk).update(is_default=False)
        address.is_default = True
        address.save(update_fields=['is_default', 'updated_at'])
        return Response(AddressSerializer(address).data)


class _FavoriteViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsConsumer]
    filter_backends = []
    lookup_url_kwarg = 'slug'


class FavoriteProductViewSet(_FavoriteViewSet):
    serializer_class = FavoriteProductSerializer

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return FavoriteProduct.objects.none()
        public_ids = Product.objects.public().values('id')
        return (
            FavoriteProduct.objects.filter(user=self.request.user, product_id__in=public_ids)
            .select_related('product__producer__user', 'product__category', 'product__subcategory')
            .prefetch_related('product__images')
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = get_object_or_404(Product.objects.public(), slug=serializer.validated_data['product_slug'])
        favorite, created = FavoriteProduct.objects.get_or_create(user=request.user, product=product)
        return Response(self.get_serializer(favorite).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def get_object(self):
        return get_object_or_404(FavoriteProduct, user=self.request.user, product__slug=self.kwargs['slug'])


class FavoriteProducerViewSet(_FavoriteViewSet):
    serializer_class = FavoriteProducerSerializer

    def _visible_producers(self):
        queryset = ProducerProfile.objects.filter(user__is_active=True)
        if settings.PRODUCER_VERIFICATION_REQUIRED:
            queryset = queryset.filter(verification_status=VerificationStatus.VERIFIED)
        return queryset

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return FavoriteProducer.objects.none()
        return FavoriteProducer.objects.filter(
            user=self.request.user, producer__in=self._visible_producers()
        ).select_related('producer')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        producer = get_object_or_404(self._visible_producers(), slug=serializer.validated_data['producer_slug'])
        favorite, created = FavoriteProducer.objects.get_or_create(user=request.user, producer=producer)
        return Response(self.get_serializer(favorite).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def get_object(self):
        return get_object_or_404(FavoriteProducer, user=self.request.user, producer__slug=self.kwargs['slug'])
