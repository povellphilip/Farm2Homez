from django.conf import settings
from django.db.models import Count, Q
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, viewsets
from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsProducer
from apps.products.models import ModerationStatus, ProductStatus

from . import services
from .models import ProducerProfile, VerificationStatus
from .serializers import ProducerProfileSerializer, ProducerPublicSerializer


class ProducerPublicViewSet(viewsets.ReadOnlyModelViewSet):
    """Public farm directory and profiles."""

    permission_classes = [permissions.AllowAny]
    serializer_class = ProducerPublicSerializer
    lookup_field = 'slug'
    filter_backends = [SearchFilter]
    search_fields = ['farm_name', 'city', 'district', 'state', 'description']

    def get_queryset(self):
        live = Q(
            products__status=ProductStatus.PUBLISHED,
            products__moderation_status=ModerationStatus.APPROVED,
            products__category__is_active=True,
        )
        queryset = ProducerProfile.objects.filter(user__is_active=True).annotate(product_count=Count('products', filter=live))
        if settings.PRODUCER_VERIFICATION_REQUIRED:
            queryset = queryset.filter(verification_status=VerificationStatus.VERIFIED)
        state = self.request.query_params.get('state')
        if state:
            queryset = queryset.filter(state__iexact=state)
        return queryset.order_by('farm_name')


class ProducerMeView(APIView):
    permission_classes = [IsProducer]

    @extend_schema(responses=ProducerProfileSerializer)
    def get(self, request):
        return Response(ProducerProfileSerializer(request.user.producer_profile).data)

    @extend_schema(request=ProducerProfileSerializer, responses=ProducerProfileSerializer)
    def patch(self, request):
        serializer = ProducerProfileSerializer(request.user.producer_profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ResubmitVerificationView(APIView):
    permission_classes = [IsProducer]

    @extend_schema(request=None, responses=ProducerProfileSerializer)
    def post(self, request):
        profile = services.resubmit_verification(request.user.producer_profile, request=request)
        return Response(ProducerProfileSerializer(profile).data)
