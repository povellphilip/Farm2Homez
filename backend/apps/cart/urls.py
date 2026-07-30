from rest_framework.routers import DefaultRouter

from .views import CartItemViewSet, WishlistItemViewSet

router = DefaultRouter()
router.register('items', CartItemViewSet, basename='cart-item')
router.register('wishlist', WishlistItemViewSet, basename='wishlist-item')

urlpatterns = router.urls
