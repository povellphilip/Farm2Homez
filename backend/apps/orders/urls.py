from rest_framework.routers import DefaultRouter

from .views import AdminOrderViewSet, CustomerOrderViewSet, SellerOrderViewSet

router = DefaultRouter()
router.register('customer', CustomerOrderViewSet, basename='customer-order')
router.register('seller', SellerOrderViewSet, basename='seller-order')
router.register('admin', AdminOrderViewSet, basename='admin-order')

urlpatterns = router.urls
