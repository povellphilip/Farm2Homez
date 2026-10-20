"""Admin portal API. Every endpoint requires the ADMIN role, checked on the server."""
from django.db.models import Prefetch, ProtectedError
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.analytics import reports
from apps.analytics.views import period_days
from apps.core import audit
from apps.core.exceptions import Conflict
from apps.core.models import AuditLog
from apps.core.permissions import IsAdmin
from apps.core.utils import unique_slug
from apps.inquiries import services as inquiry_services
from apps.inquiries.models import Inquiry
from apps.inquiries.serializers import InquiryReplySerializer, InquirySerializer, ReplySerializer
from apps.orders import services as order_services
from apps.orders.models import Order, OrderItem, ProducerOrder
from apps.orders.serializers import AdminOrderSerializer, OrderListSerializer, TransitionSerializer
from apps.producers import services as producer_services
from apps.producers.models import ProducerProfile
from apps.producers.serializers import AdminProducerSerializer, VerificationDecisionSerializer
from apps.products import services as product_services
from apps.products.models import Category, Product
from apps.products.serializers import AdminCategorySerializer, AdminProductSerializer, ModerationSerializer

from . import services
from .serializers import AdminUserSerializer, AuditLogSerializer, SuspendSerializer


class AdminViewMixin:
    permission_classes = [IsAdmin]


class AdminUserViewSet(AdminViewMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = AdminUserSerializer
    queryset = User.objects.select_related('producer_profile').order_by('-date_joined')
    filterset_fields = ['role', 'is_active', 'email_verified']
    search_fields = ['email', 'full_name', 'phone_number', 'producer_profile__farm_name']
    ordering_fields = ['date_joined', 'last_login', 'email']

    @extend_schema(request=SuspendSerializer, responses=AdminUserSerializer)
    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        serializer = SuspendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.suspend_user(self.get_object(), reason=serializer.validated_data['reason'], actor=request.user, request=request)
        return Response(AdminUserSerializer(user).data)

    @extend_schema(request=None, responses=AdminUserSerializer)
    @action(detail=True, methods=['post'])
    def reactivate(self, request, pk=None):
        user = services.reactivate_user(self.get_object(), actor=request.user, request=request)
        return Response(AdminUserSerializer(user).data)


class AdminProducerViewSet(AdminViewMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = AdminProducerSerializer
    queryset = ProducerProfile.objects.select_related('user').order_by('-created_at')
    filterset_fields = ['verification_status', 'state']
    search_fields = ['farm_name', 'user__email', 'user__full_name', 'city', 'district']
    ordering_fields = ['created_at', 'farm_name']

    @extend_schema(request=VerificationDecisionSerializer, responses=AdminProducerSerializer)
    @action(detail=True, methods=['post'])
    def verification(self, request, pk=None):
        serializer = VerificationDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = producer_services.decide_verification(self.get_object(), actor=request.user, request=request, **serializer.validated_data)
        return Response(AdminProducerSerializer(profile).data)


class AdminProductViewSet(AdminViewMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = AdminProductSerializer
    queryset = Product.objects.select_related('producer', 'category', 'subcategory').prefetch_related('images').order_by('-updated_at')
    filterset_fields = ['status', 'moderation_status', 'category__slug', 'producer__slug', 'is_available']
    search_fields = ['name', 'producer__farm_name', 'description']
    ordering_fields = ['updated_at', 'created_at', 'price', 'stock_quantity']

    @extend_schema(request=ModerationSerializer, responses=AdminProductSerializer)
    @action(detail=True, methods=['post'])
    def moderate(self, request, pk=None):
        serializer = ModerationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = product_services.moderate(self.get_object(), actor=request.user, request=request, **serializer.validated_data)
        return Response(AdminProductSerializer(product).data)


class AdminOrderViewSet(AdminViewMixin, viewsets.ReadOnlyModelViewSet):
    lookup_field = 'number'
    filterset_fields = ['status', 'payment_method']
    search_fields = ['number', 'consumer__email', 'ship_name', 'producer_orders__producer__farm_name']
    ordering_fields = ['created_at', 'total']

    def get_queryset(self):
        return (
            Order.objects.select_related('consumer', 'payment')
            .prefetch_related(
                Prefetch(
                    'producer_orders',
                    queryset=ProducerOrder.objects.select_related('producer').prefetch_related(
                        Prefetch('items', queryset=OrderItem.objects.select_related('product').prefetch_related('product__images')), 'events'
                    ),
                )
            )
            .distinct()
        )

    def get_serializer_class(self):
        return OrderListSerializer if self.action == 'list' else AdminOrderSerializer

    @extend_schema(request=TransitionSerializer, responses=AdminOrderSerializer)
    @action(detail=True, methods=['post'], url_path=r'fulfillments/(?P<fulfillment_id>[0-9]+)/status')
    def fulfillment_status(self, request, number=None, fulfillment_id=None):
        order = self.get_object()
        producer_order = get_object_or_404(ProducerOrder, pk=fulfillment_id, order=order)
        serializer = TransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order_services.transition(
            producer_order, serializer.validated_data['status'], actor=request.user, note=serializer.validated_data['note'], request=request
        )
        return Response(AdminOrderSerializer(self.get_queryset().get(pk=order.pk)).data)


class AdminInquiryViewSet(AdminViewMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = InquirySerializer
    queryset = Inquiry.objects.select_related('producer', 'product').prefetch_related('replies')
    filterset_fields = ['status']
    search_fields = ['subject', 'name', 'email', 'message', 'producer__farm_name']

    def get_queryset(self):
        queryset = super().get_queryset()
        scope = self.request.query_params.get('scope')
        if scope == 'platform':
            queryset = queryset.filter(producer__isnull=True)
        elif scope == 'producers':
            queryset = queryset.filter(producer__isnull=False)
        return queryset

    @extend_schema(parameters=[OpenApiParameter('scope', str, enum=['platform', 'producers'])])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(request=ReplySerializer, responses={201: InquiryReplySerializer})
    @action(detail=True, methods=['post'])
    def reply(self, request, pk=None):
        inquiry = self.get_object()
        if inquiry.producer_id:
            raise Conflict('Producers answer their own inquiries. Admins can only reply to platform messages.', code='not_platform_inquiry')
        serializer = ReplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = inquiry_services.reply(inquiry, author=request.user, message=serializer.validated_data['message'])
        return Response(InquiryReplySerializer(entry).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses=InquirySerializer)
    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        inquiry = inquiry_services.close(self.get_object())
        audit.record('inquiry.closed', actor=request.user, target=inquiry, request=request)
        return Response(InquirySerializer(inquiry).data)


class AdminCategoryViewSet(AdminViewMixin, viewsets.ModelViewSet):
    serializer_class = AdminCategorySerializer
    queryset = Category.objects.select_related('parent').order_by('parent__id', 'position', 'name')
    pagination_class = None
    filter_backends = []

    def perform_create(self, serializer):
        category = serializer.save(slug=unique_slug(Category, serializer.validated_data['name'], max_length=90))
        audit.record('category.created', actor=self.request.user, target=category, request=self.request)

    def perform_update(self, serializer):
        changes = {key: str(value) for key, value in serializer.validated_data.items()}
        category = serializer.save()
        audit.record('category.updated', actor=self.request.user, target=category, metadata={'changes': changes}, request=self.request)

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError as exc:
            raise Conflict(
                'This category still has products or subcategories. Deactivate it instead.', code='category_in_use'
            ) from exc
        audit.record('category.deleted', actor=self.request.user, metadata={'name': instance.name}, request=self.request)


class AuditLogViewSet(AdminViewMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    queryset = AuditLog.objects.all()
    filterset_fields = ['action', 'target_type']
    search_fields = ['actor_email', 'target_repr', 'action']


class ReportsOverviewView(AdminViewMixin, APIView):
    @extend_schema(parameters=[OpenApiParameter('days', int)], responses={200: dict})
    def get(self, request):
        return Response(reports.platform_overview(period_days(request)))
