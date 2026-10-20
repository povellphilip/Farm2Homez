from rest_framework.routers import SimpleRouter

from .views import AddressViewSet, FavoriteProducerViewSet, FavoriteProductViewSet

router = SimpleRouter()
router.register('me/addresses', AddressViewSet, basename='address')
router.register('me/favorites/products', FavoriteProductViewSet, basename='favorite-product')
router.register('me/favorites/producers', FavoriteProducerViewSet, basename='favorite-producer')

urlpatterns = router.urls
