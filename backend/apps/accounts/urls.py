from django.urls import path

from . import views

urlpatterns = [
    path('csrf/', views.CsrfView.as_view(), name='auth-csrf'),
    path('consumer/register/', views.ConsumerRegisterView.as_view(), name='consumer-register'),
    path('producer/register/', views.ProducerRegisterView.as_view(), name='producer-register'),
    path('verify-email/', views.VerifyEmailView.as_view(), name='verify-email'),
    path('verify-email/resend/', views.ResendVerificationView.as_view(), name='verify-email-resend'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('refresh/', views.RefreshView.as_view(), name='token-refresh'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('password/forgot/', views.PasswordForgotView.as_view(), name='password-forgot'),
    path('password/reset/', views.PasswordResetView.as_view(), name='password-reset'),
    path('password/change/', views.PasswordChangeView.as_view(), name='password-change'),
    path('me/', views.MeView.as_view(), name='me'),
]
