from drf_spectacular.utils import extend_schema
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsConsumer, IsProducer

from . import services
from .models import Inquiry
from .serializers import InquiryCreateSerializer, InquiryReplySerializer, InquirySerializer, ReplySerializer


class InquiryCreateView(APIView):
    """Send a question to a farm (producer_slug or product_slug) or to the Farm2Home team (neither)."""

    permission_classes = [permissions.AllowAny]
    throttle_scope = 'inquiry'

    @extend_schema(request=InquiryCreateSerializer, responses={201: InquirySerializer})
    def post(self, request):
        serializer = InquiryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        inquiry = services.create_inquiry(sender=request.user, **serializer.validated_data)
        return Response(InquirySerializer(inquiry).data, status=status.HTTP_201_CREATED)


class _InquiryThreadViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = InquirySerializer
    filterset_fields = ['status']
    search_fields = ['subject', 'name', 'message']

    def base_queryset(self):
        return Inquiry.objects.select_related('producer', 'product').prefetch_related('replies')

    @extend_schema(request=ReplySerializer, responses={201: InquiryReplySerializer})
    @action(detail=True, methods=['post'])
    def reply(self, request, pk=None):
        serializer = ReplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = services.reply(self.get_object(), author=request.user, message=serializer.validated_data['message'])
        return Response(InquiryReplySerializer(entry).data, status=status.HTTP_201_CREATED)


class ConsumerInquiryViewSet(_InquiryThreadViewSet):
    """Inquiries the signed-in consumer has sent."""

    permission_classes = [IsConsumer]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Inquiry.objects.none()
        return self.base_queryset().filter(sender=self.request.user)


class ProducerInquiryViewSet(_InquiryThreadViewSet):
    """Inquiries addressed to the signed-in producer's farm."""

    permission_classes = [IsProducer]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Inquiry.objects.none()
        return self.base_queryset().filter(producer__user=self.request.user)

    @extend_schema(request=None, responses=InquirySerializer)
    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        return Response(InquirySerializer(services.close(self.get_object())).data)
