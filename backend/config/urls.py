from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.core.views import health_live, health_ready

urlpatterns = [
    # Django's built-in admin lives at /django-admin/ so the SPA can own /admin/*.
    path('django-admin/', admin.site.urls),
    path('api/health/', health_ready, name='health-ready'),
    path('api/health/live/', health_live, name='health-live'),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/producers/', include('apps.producers.urls')),
    path('api/consumers/', include('apps.consumers.urls')),
    path('api/categories/', include('apps.products.category_urls')),
    path('api/products/', include('apps.products.urls')),
    path('api/cart/', include('apps.cart.urls')),
    path('api/orders/', include('apps.orders.urls')),
    path('api/inquiries/', include('apps.inquiries.urls')),
    path('api/reviews/', include('apps.reviews.urls')),
    path('api/analytics/', include('apps.analytics.urls')),
    path('api/admin/', include('apps.administration.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

handler404 = 'apps.core.views.not_found'
handler500 = 'apps.core.views.server_error'
