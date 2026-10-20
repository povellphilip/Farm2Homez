from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsProducer
from apps.products.models import Product

from . import reports


class ProductViewSerializer(serializers.Serializer):
    product = serializers.SlugField()


def period_days(request):
    try:
        days = int(request.query_params.get('days', 30))
    except ValueError:
        days = 30
    return max(1, min(days, 365))


class ProductViewEventView(APIView):
    """Count a product page view. Views by the listing's own producer are ignored."""

    permission_classes = [permissions.AllowAny]
    throttle_scope = 'product_view'

    @extend_schema(request=ProductViewSerializer, responses={202: None})
    def post(self, request):
        serializer = ProductViewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = Product.objects.public().filter(slug=serializer.validated_data['product']).select_related('producer').first()
        if product and not (request.user.is_authenticated and product.producer.user_id == request.user.id):
            reports.record_view(product)
        return Response(status=status.HTTP_202_ACCEPTED)


class ProducerOverviewView(APIView):
    permission_classes = [IsProducer]

    @extend_schema(parameters=[OpenApiParameter('days', int)], responses={200: dict})
    def get(self, request):
        return Response(reports.producer_overview(request.user.producer_profile, period_days(request)))
