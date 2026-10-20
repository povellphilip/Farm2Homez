from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import CheckoutView, ConsumerOrderViewSet, PaymentMethodsView

router = SimpleRouter()
router.register('', ConsumerOrderViewSet, basename='order')

urlpatterns = [
    path('checkout/', CheckoutView.as_view(), name='checkout'),
    path('payment-methods/', PaymentMethodsView.as_view(), name='payment-methods'),
    *router.urls,
]
