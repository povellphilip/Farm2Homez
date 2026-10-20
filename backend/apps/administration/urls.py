from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register('users', views.AdminUserViewSet, basename='admin-user')
router.register('producers', views.AdminProducerViewSet, basename='admin-producer')
router.register('products', views.AdminProductViewSet, basename='admin-product')
router.register('orders', views.AdminOrderViewSet, basename='admin-order')
router.register('inquiries', views.AdminInquiryViewSet, basename='admin-inquiry')
router.register('categories', views.AdminCategoryViewSet, basename='admin-category')
router.register('audit-logs', views.AuditLogViewSet, basename='admin-audit-log')

urlpatterns = [
    path('reports/overview/', views.ReportsOverviewView.as_view(), name='admin-reports-overview'),
    *router.urls,
]
