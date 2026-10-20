from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import ConsumerInquiryViewSet, InquiryCreateView

router = SimpleRouter()
router.register('mine', ConsumerInquiryViewSet, basename='my-inquiry')

urlpatterns = [
    path('', InquiryCreateView.as_view(), name='inquiry-create'),
    *router.urls,
]
