from django.urls import path
from rest_framework.routers import DefaultRouter

from .admin_api import AdminUserViewSet
from .views import (
    CustomerRegisterView,
    ForgotPasswordView,
    LoginView,
    LogoutView,
    ProfileView,
    RefreshView,
    ResendOTPView,
    ResetPasswordView,
    SellerRegisterView,
    VerifyOTPView,
)

router = DefaultRouter()
router.register('admin/users', AdminUserViewSet, basename='admin-user')

urlpatterns = [
    path('customer/register/', CustomerRegisterView.as_view(), name='customer-register'),
    path('seller/register/', SellerRegisterView.as_view(), name='seller-register'),
    path('verify-otp/', VerifyOTPView.as_view(), name='verify-otp'),
    path('resend-otp/', ResendOTPView.as_view(), name='resend-otp'),
    path('login/', LoginView.as_view(), name='login'),
    path('refresh/', RefreshView.as_view(), name='token-refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),
    path('profile/', ProfileView.as_view(), name='profile'),
] + router.urls
