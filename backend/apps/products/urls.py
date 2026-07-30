from rest_framework.routers import DefaultRouter

from .views import AdminProductViewSet, ProductViewSet, SellerProductViewSet

router = DefaultRouter()
router.register('seller/manage', SellerProductViewSet, basename='seller-product')
router.register('admin/manage', AdminProductViewSet, basename='admin-product')
router.register('', ProductViewSet, basename='product')

urlpatterns = router.urls
