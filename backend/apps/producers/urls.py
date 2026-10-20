from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.inquiries.views import ProducerInquiryViewSet
from apps.orders.views import ProducerOrderViewSet
from apps.products.views import ProducerProductViewSet

from .views import ProducerMeView, ProducerPublicViewSet, ResubmitVerificationView

me_router = SimpleRouter()
me_router.register('me/products', ProducerProductViewSet, basename='producer-product')
me_router.register('me/orders', ProducerOrderViewSet, basename='producer-order')
me_router.register('me/inquiries', ProducerInquiryViewSet, basename='producer-inquiry')

public_router = SimpleRouter()
public_router.register('', ProducerPublicViewSet, basename='producer')

urlpatterns = [
    path('me/', ProducerMeView.as_view(), name='producer-me'),
    path('me/resubmit-verification/', ResubmitVerificationView.as_view(), name='producer-resubmit'),
    *me_router.urls,
    *public_router.urls,
]
